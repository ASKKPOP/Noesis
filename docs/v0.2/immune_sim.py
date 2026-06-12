#!/usr/bin/env python3
"""
immune-sim — Noēsis generational adversarial-immunity simulation
================================================================

A self-contained, in-memory, agent-based simulation of the "defense as vaccination"
model. Grids are exposed to ATTENUATED antigens (abstract parameter vectors — NOT real
exploits, NO network, NO external I/O), develop ANTIBODIES on survival, accumulate
IMMUNE MEMORY, share antibodies within ALLIANCES (herd immunity), and face MUTATING
strains each generation.

The attenuation wall is structural: an "attack" here is pure math over numpy-free
vectors. Nothing in this file can touch a real system. That is the point — the pressure
is real, the targets are simulated.

Run:  python3 immune_sim.py            # default run + summary
      python3 immune_sim.py --seed 7 --generations 80 --grids 12
"""

from __future__ import annotations
import argparse
import math
import random
from dataclasses import dataclass, field

# Dimensionality of the abstract "threat space". Each antigen and antibody is a vector
# in this space. Recognition = how well an antibody's vector aligns with an antigen's.
DIMS = 8


# --------------------------------------------------------------------------------------
# Antigens — attenuated attack signatures (abstract vectors, never real exploits)
# --------------------------------------------------------------------------------------
@dataclass
class Antigen:
    vec: list[float]          # signature in threat space
    virulence: float          # how much damage it does if not resisted (0..1)
    strain_id: int            # lineage id (mutations keep the lineage, shift the vec)
    generation: int           # when this strain appeared

    def mutate(self, rng: random.Random, drift: float, new_id: int, gen: int) -> "Antigen":
        """Evolve a new strain: shift the signature so old antibodies partially miss it."""
        nv = [
            _clamp(v + rng.gauss(0, drift))
            for v in self.vec
        ]
        # mutation can ramp virulence as the arms race escalates, but it's capped
        nviru = _clamp01(self.virulence + rng.gauss(0.0, 0.03))
        nviru = min(nviru, 0.6)
        return Antigen(nv, nviru, new_id, gen)


# --------------------------------------------------------------------------------------
# Antibodies — earned defensive responses + immune memory
# --------------------------------------------------------------------------------------
@dataclass
class Antibody:
    vec: list[float]          # what signature it recognizes
    potency: float            # strength of the response (0..1), grows with re-exposure
    strain_id: int            # which lineage it was raised against

    def recognition(self, ag: Antigen) -> float:
        """Cosine-like alignment in [0,1]: how well this antibody matches the antigen."""
        return _alignment(self.vec, ag.vec)


# --------------------------------------------------------------------------------------
# Grid — an agent with resources, an antibody repertoire (immune memory), an alliance
# --------------------------------------------------------------------------------------
@dataclass
class Grid:
    name: str
    credit: float = 100.0           # grid-credit reserve (cyber-money)
    compute: float = 100.0          # compute / AI-power
    alive: bool = True
    isolated: bool = False          # an isolated grid refuses inoculation (control group)
    antibodies: list[Antibody] = field(default_factory=list)
    alliance: int = -1              # alliance id, -1 = none
    exposures: int = 0
    survivals: int = 0
    holdings: int = 0               # conquered territories held (drives occupation upkeep)

    # ---- resilience: best recognition the repertoire can muster vs an antigen ----
    def best_response(self, ag: Antigen) -> tuple[float, Antibody | None]:
        best, ab = 0.0, None
        for a in self.antibodies:
            r = a.recognition(ag) * a.potency
            if r > best:
                best, ab = r, a
        return best, ab

    def resilience(self, antigens: list[Antigen]) -> float:
        if not antigens:
            return 0.0
        return sum(self.best_response(ag)[0] for ag in antigens) / len(antigens)

    # ---- exposure: meet an antigen, take damage, maybe raise/strengthen an antibody ----
    def expose(self, ag: Antigen, rng: random.Random):
        if not self.alive:
            return
        self.exposures += 1
        response, matched = self.best_response(ag)

        # Damage scales with virulence and how poorly we resisted.
        unmitigated = ag.virulence * (1.0 - response)
        dmg_credit = unmitigated * 18.0
        dmg_compute = unmitigated * 14.0
        self.credit -= dmg_credit
        self.compute -= dmg_compute

        survived = self.credit > 0 and self.compute > 0
        if survived:
            self.survivals += 1
            # Immune response: strengthen a matching antibody, or raise a new one.
            if matched is not None and matched.recognition(ag) > 0.6:
                matched.potency = _clamp01(matched.potency + 0.12)   # memory: faster/stronger
            else:
                # raise a fresh antibody tuned toward this antigen (with some noise)
                nv = [_clamp(c + rng.gauss(0, 0.08)) for c in ag.vec]
                self.antibodies.append(Antibody(nv, potency=0.45, strain_id=ag.strain_id))
            # recovery: surviving lets you regenerate toward baseline (bounded)
            self.credit = min(self.credit + 7.0, 140.0)
            self.compute = min(self.compute + 5.5, 140.0)
        else:
            self.alive = False

    # ---- spoils: winner takes loser's resources (winner-takes-all, conserved) ----
    def absorb(self, loser: "Grid"):
        # Take a modest share, not a crushing one — empires grow by accretion, not erasure.
        take_c = loser.credit * 0.25
        take_k = loser.compute * 0.25
        # sovereign-minimum floor: the loser is never fully erased (can rebuild / rebel)
        give_c = min(take_c, max(loser.credit - SOVEREIGN_MIN, 0.0))
        give_k = min(take_k, max(loser.compute - SOVEREIGN_MIN, 0.0))
        loser.credit -= give_c
        loser.compute -= give_k
        self.credit += give_c
        self.compute += give_k
        # OCCUPATION OVERHEAD: holding conquered territory costs the winner upkeep.
        # This is diminishing returns on empire — infinite expansion is self-limiting.
        self.holdings += 1
        upkeep = self.holdings * 0.8
        self.credit -= upkeep
        self.compute -= upkeep * 0.7


SOVEREIGN_MIN = 8.0   # the floor that keeps a defeated Grid latent (can rebuild/rebel)
DECISIVE_MARGIN = 0.12  # power gap required to actually conquer; below it = stalemate


def _conquest_tax(winner: "Grid", loser: "Grid") -> float:
    """Progressive tax on conquest: the richer the winner, the more it pays into the
    treasury that funds recovery grants. This is the structural brake on hegemony."""
    wealth = winner.credit + winner.compute
    rate = 0.04 + min(0.16, wealth / 1500.0)   # 4%..20%, rising with the winner's wealth
    spoils_est = (loser.credit + loser.compute) * 0.25
    tax = spoils_est * rate
    winner.credit -= tax * 0.6
    winner.compute -= tax * 0.4
    return tax


# --------------------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------------------
def _clamp(x: float) -> float:
    return max(-1.0, min(1.0, x))

def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))

def _alignment(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1e-9
    nb = math.sqrt(sum(y * y for y in b)) or 1e-9
    cos = dot / (na * nb)
    return _clamp01((cos + 1) / 2)   # map [-1,1] -> [0,1]

def _rand_vec(rng: random.Random) -> list[float]:
    return [rng.uniform(-1, 1) for _ in range(DIMS)]


# --------------------------------------------------------------------------------------
# herd immunity — alliance members share antibodies
# --------------------------------------------------------------------------------------
def share_within_alliances(grids: list[Grid]):
    by_alliance: dict[int, list[Grid]] = {}
    for g in grids:
        if g.alive and g.alliance >= 0:
            by_alliance.setdefault(g.alliance, []).append(g)
    for members in by_alliance.values():
        # pool the strongest antibody per strain, then distribute
        pool: dict[int, Antibody] = {}
        for g in members:
            for ab in g.antibodies:
                cur = pool.get(ab.strain_id)
                if cur is None or ab.potency > cur.potency:
                    pool[ab.strain_id] = ab
        for g in members:
            owned = {ab.strain_id for ab in g.antibodies}
            for sid, ab in pool.items():
                if sid not in owned:
                    # herd immunity: receive a copy without suffering the attack
                    g.antibodies.append(Antibody(list(ab.vec), ab.potency * 0.8, sid))


# --------------------------------------------------------------------------------------
# the simulation
# --------------------------------------------------------------------------------------
@dataclass
class GenStats:
    gen: int
    alive: int
    avg_resilience: float
    avg_credit: float
    isolated_alive: int
    isolated_total: int
    n_strains: int
    monopoly_index: float   # share of total resources held by the richest grid (0..1)


def run(seed: int, generations: int, n_grids: int, isolated_frac: float = 0.25,
        mutation_drift: float = 0.18, verbose: bool = True, summary: bool = True) -> list[GenStats]:
    rng = random.Random(seed)

    # build grids; assign alliances (non-isolated grids form a few coalitions)
    grids: list[Grid] = []
    for i in range(n_grids):
        isolated = (i < round(n_grids * isolated_frac))
        g = Grid(name=f"grid-{i:02d}", isolated=isolated)
        g.alliance = -1 if isolated else (i % 3)   # 3 coalitions among the non-isolated
        grids.append(g)

    # seed the threat space with a few base strains
    next_strain = 0
    strains: list[Antigen] = []
    for _ in range(3):
        strains.append(Antigen(_rand_vec(rng), virulence=rng.uniform(0.3, 0.5),
                               strain_id=next_strain, generation=0))
        next_strain += 1

    history: list[GenStats] = []

    for gen in range(generations):
        # 1) INOCULATION — non-isolated grids train against current strains before war.
        #    Isolated grids refuse (control group): no antibodies built proactively.
        for g in grids:
            if g.alive and not g.isolated:
                for ag in strains:
                    g.expose(ag, rng)   # training exposure (attenuated)

        # 2) WAR / LIVE EXPOSURE — every alive grid meets a (possibly mutated) live strain.
        #    Live strains hit harder than training (real stakes); isolation is punished here.
        live = rng.choice(strains)
        live = Antigen(live.vec, _clamp01(live.virulence * 1.6), live.strain_id, live.generation)
        for g in grids:
            if g.alive:
                g.expose(live, rng)

        # 3) CONQUEST — pair survivors; a *decisive* power margin lets the stronger take spoils.
        #    Marginal differences end in stalemate (diversity preserved).
        survivors = [g for g in grids if g.alive]
        rng.shuffle(survivors)
        treasury = 0.0
        for a, b in zip(survivors[0::2], survivors[1::2]):
            pa = _war_power(a, strains)
            pb = _war_power(b, strains)
            roll = rng.uniform(-0.10, 0.10)   # bounded fog of war
            margin = (pa + roll) - pb
            if margin > DECISIVE_MARGIN:
                treasury += _conquest_tax(a, b)
                a.absorb(b)
            elif -margin > DECISIVE_MARGIN:
                treasury += _conquest_tax(b, a)
                b.absorb(a)
            # else: STALEMATE — both keep their resources

        # 3b) RECOVERY GRANTS — progressive conquest tax funds the weakest survivors,
        #     keeping the field populated (redistribution, not erasure).
        alive_now = [g for g in grids if g.alive]
        if alive_now and treasury > 0:
            weakest = sorted(alive_now, key=lambda g: g.credit + g.compute)[:max(1, len(alive_now)//3)]
            grant = treasury / len(weakest)
            for g in weakest:
                g.credit += grant * 0.6
                g.compute += grant * 0.4
        # holdings slowly decay — territory is lost, liberated, or relinquished over time,
        # so occupation overhead ebbs and empires can't ratchet upkeep upward forever.
        for g in alive_now:
            if g.holdings > 0 and rng.random() < 0.35:
                g.holdings -= 1

        # 4) HERD IMMUNITY — alliances share antibodies.
        share_within_alliances(grids)

        # 5) MUTATION — strains evolve; occasionally a brand-new lineage emerges.
        new_strains: list[Antigen] = []
        for ag in strains:
            new_strains.append(ag.mutate(rng, mutation_drift, ag.strain_id, gen + 1))
        if rng.random() < 0.30:   # novel, never-before-seen attack appears
            new_strains.append(Antigen(_rand_vec(rng), virulence=rng.uniform(0.35, 0.6),
                                       strain_id=next_strain, generation=gen + 1))
            next_strain += 1
        strains = new_strains[-5:]   # keep the threat space bounded but moving

        # 6) record stats
        history.append(_snapshot(gen, grids, strains))
        if verbose:
            _print_gen(history[-1])

    if summary:
        _print_summary(history, grids)
    return history


def _war_power(g: Grid, strains: list[Antigen]) -> float:
    economy = (g.credit + g.compute) / 200.0
    defense = g.resilience(strains)
    alliance_bonus = 0.1 if g.alliance >= 0 else 0.0
    return 0.5 * economy + 0.5 * defense + alliance_bonus


def _snapshot(gen: int, grids: list[Grid], strains: list[Antigen]) -> GenStats:
    alive = [g for g in grids if g.alive]
    iso = [g for g in grids if g.isolated]
    iso_alive = [g for g in iso if g.alive]
    avg_res = (sum(g.resilience(strains) for g in alive) / len(alive)) if alive else 0.0
    avg_cred = (sum(g.credit for g in alive) / len(alive)) if alive else 0.0
    total = sum(g.credit + g.compute for g in alive) or 1e-9
    richest = max((g.credit + g.compute for g in alive), default=0.0)
    return GenStats(
        gen=gen, alive=len(alive), avg_resilience=avg_res, avg_credit=avg_cred,
        isolated_alive=len(iso_alive), isolated_total=len(iso),
        n_strains=len({a.strain_id for a in strains}),
        monopoly_index=richest / total,
    )


# --------------------------------------------------------------------------------------
# reporting (pure text — sparkline bars, no dependencies)
# --------------------------------------------------------------------------------------
BAR = " ▁▂▃▄▅▆▇█"

def _spark(value: float, lo: float = 0.0, hi: float = 1.0) -> str:
    t = 0.0 if hi == lo else (value - lo) / (hi - lo)
    t = max(0.0, min(1.0, t))
    return BAR[min(len(BAR) - 1, int(t * (len(BAR) - 1)))]

def _print_gen(s: GenStats):
    print(f"gen {s.gen:>3} │ alive {s.alive:>2} │ "
          f"resilience {s.avg_resilience:0.2f} {_spark(s.avg_resilience)} │ "
          f"iso-survive {s.isolated_alive}/{s.isolated_total} │ "
          f"strains {s.n_strains} │ monopoly {s.monopoly_index:0.2f} {_spark(s.monopoly_index)}")

def _print_summary(history: list[GenStats], grids: list[Grid]):
    first, last = history[0], history[-1]
    print("\n" + "=" * 72)
    print("SUMMARY")
    print("=" * 72)
    print(f"  Average resilience:   {first.avg_resilience:0.2f}  →  {last.avg_resilience:0.2f}"
          f"   ({'ROSE — population co-evolved' if last.avg_resilience > first.avg_resilience else 'fell'})")
    print(f"  Grids alive:          {first.alive}  →  {last.alive}")
    print(f"  Isolated survivors:   {last.isolated_alive}/{last.isolated_total}"
          f"   (control group: never inoculated)")
    inoc = [g for g in grids if not g.isolated]
    inoc_alive = sum(1 for g in inoc if g.alive)
    print(f"  Inoculated survivors: {inoc_alive}/{len(inoc)}")
    print(f"  Monopoly index:       {last.monopoly_index:0.2f}"
          f"   ({'no runaway monopoly' if last.monopoly_index < 0.6 else 'WARNING: concentration high'})")
    # the thesis checks
    print("-" * 72)
    iso_rate = (last.isolated_alive / last.isolated_total) if last.isolated_total else 0
    inoc_rate = (inoc_alive / len(inoc)) if inoc else 0
    print("  THESIS — exposure beats isolation:        "
          f"{'PASS' if inoc_rate >= iso_rate else 'FAIL'}"
          f"  (inoculated {inoc_rate:0.0%} vs isolated {iso_rate:0.0%} survival)")
    print("  THESIS — co-evolution, not stagnation:    "
          f"{'PASS' if last.avg_resilience > first.avg_resilience else 'FAIL'}")
    print("  THESIS — world doesn't collapse to one:   "
          f"{'PASS' if last.alive >= 2 and last.monopoly_index < 0.6 else 'FAIL'}")
    print("=" * 72)
    print("  (All attacks were abstract vectors. No network, no external I/O, no real")
    print("   exploits. The attenuation wall held: pressure real, targets simulated.)")


def main():
    p = argparse.ArgumentParser(description="Noēsis immune-sim (attenuated, in-memory).")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--generations", type=int, default=60)
    p.add_argument("--grids", type=int, default=10)
    p.add_argument("--isolated-frac", type=float, default=0.25,
                   help="fraction of grids that refuse inoculation (control group)")
    p.add_argument("--mutation-drift", type=float, default=0.18)
    p.add_argument("--quiet", action="store_true")
    a = p.parse_args()
    run(a.seed, a.generations, a.grids, a.isolated_frac, a.mutation_drift,
        verbose=not a.quiet, summary=True)


if __name__ == "__main__":
    main()
