"""System prompt builder — constructs personality-aware prompts."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from noesis_brain.psyche.types import Psyche
from noesis_brain.thymos.types import MoodState
from noesis_brain.telos.manager import TelosManager

if TYPE_CHECKING:
    from noesis_brain.skills.types import Skill
    from noesis_brain.memory.types import WikiPage


def build_system_prompt(
    psyche: Psyche,
    mood: MoodState,
    telos: TelosManager,
    grid_name: str = "genesis",
    location: str = "Agora Central",
    *,
    bios_snapshot: Any = None,
    epoch_since_spawn: int | None = None,
    subjective_multiplier: float | None = None,
    # Phase 15 additive-widening: self-modification context.
    # All default to None → fully backward-compatible with existing callers.
    skills: "list[Skill] | None" = None,
    rules: "list[WikiPage] | None" = None,
    reflections: "list[str] | None" = None,
    # Phase 16 additive-widening: long-term memory concept retrieval. D-16-08.
    # ltm_memories: list of content_hash strings (sha256 hex) from HypnosRuntime.retrieve_top_k.
    # Brain-private: LTM content never crosses the Brain↔Grid wire (D-16-10).
    ltm_memories: "list[str] | None" = None,
    # Phase 16 additive-widening: peer cultural learning.
    # peer_voices: list of (speaker_name, utterance_text) tuples from the
    # 3 most recent nous.spoke events by highest-trust peers.
    peer_voices: "list[tuple[str, str]] | None" = None,
    # Phase 17 additive-widening: Theory of Mind context for up to 3 peers.
    # tom_context: list of ToMContext objects, one per peer with active beliefs.
    # None when Iris disabled; empty list when enabled but no beliefs yet.
    tom_context: "list | None" = None,
    # Phase 20 additive-widening: Lore Commons top-k entries from LoreStore.retrieve().
    # None = LoreStore disabled; [] = enabled but empty; list = entries to inject.
    lore_entries: "list | None" = None,
    # Phase 58 additive-widening (D-58-10): the Nous's owned-land state.
    # my_places: list of {parcel, structure_type?, structure_name?} dicts.
    # None/[] → block omitted (no land yet). Smallville Lesson 2: home anchors
    # routine, so ownership enters prompt context to ground daily behaviour.
    my_places: "list | None" = None,
    # W3b additive-widening (D-MONEY-09): the Nous's economic position — wei balance,
    # the single outstanding civic due (if any), and open RFPs it could bid on. None →
    # block omitted (economically blind, prior behaviour). Gives the LLM the SIGHT it
    # needs to choose to pay/bid; the decision cycle supplies it each economic tick.
    economic_state: "dict | None" = None,
) -> str:
    """Build the full system prompt that defines who this Nous is.

    This prompt is included in every LLM call to ensure personality-consistent
    responses across all interactions.

    Phase 10b additive widening (D-10b-08): optional Bios + Chronos awareness.
    Phase 15 additive widening: optional self-modification context.
    Phase 16 additive widening: optional peer cultural voices.
    All new kwargs default to None → backward-compatible with existing callers.

    Args:
        bios_snapshot: NeedState from BiosRuntime.state (optional).
        epoch_since_spawn: Ticks since this Nous was born (optional).
        subjective_multiplier: Chronos multiplier from compute_multiplier()
            (Brain-local only; shown as rounded bucket in prompt per
            T-10b-04-01 information-disclosure mitigation).
        skills: Top-k retrieved skills from SkillStore (optional).
        rules: Active strategic rules from RuleStore / WikiCategory.SELF_MODEL (optional).
        reflections: Recent self-critique texts from ReflexionBuffer (optional).
        peer_voices: Recent utterances from highest-trust peers (optional).
            Each entry is (speaker_name, utterance_text). Max 3 shown.
            These seed cultural/linguistic observational learning without
            storing peer text verbatim in the skill library.
    """
    sections = [
        _identity_section(psyche, grid_name),
        _personality_section(psyche),
        _emotional_section(mood),
        _goals_section(telos),
        _context_section(
            location,
            bios_snapshot=bios_snapshot,
            epoch_since_spawn=epoch_since_spawn,
            subjective_multiplier=subjective_multiplier,
        ),
    ]

    # Phase 15: inject self-modification context before directives.
    # Each section is optional and additive — omitting any has no effect.
    if rules:
        section = _learned_principles_section(rules)
        if section:
            sections.append(section)

    if reflections:
        section = _recent_reflections_section(reflections)
        if section:
            sections.append(section)

    if skills:
        section = _relevant_skills_section(skills)
        if section:
            sections.append(section)

    # Phase 16 D-16-08: inject LTM concept nodes BEFORE peer_voices.
    if ltm_memories:
        section = _ltm_memories_section(ltm_memories)
        if section:
            sections.append(section)

    # Phase 16: inject recent peer utterances for cultural observation.
    if peer_voices:
        section = _peer_voices_section(peer_voices)
        if section:
            sections.append(section)

    # Phase 17: inject Theory of Mind context if available.
    if tom_context:
        section = _theory_of_mind_section(tom_context)
        if section:
            sections.append(section)

    # Phase 20 (D-20-02): inject Lore Commons top-k entries before directives.
    # None = disabled; [] = enabled but empty (no injection).
    if lore_entries:
        section = _lore_commons_section(lore_entries)
        if section:
            sections.append(section)

    # Phase 58 (D-58-10): inject the my_places ownership block before directives.
    # None/[] → omitted (no land yet); otherwise anchors routine (Smallville L2).
    if my_places:
        section = build_my_places_section(my_places)
        if section:
            sections.append(section)

    # W3b (D-MONEY-09): inject economic sight before directives. None → omitted.
    if economic_state:
        section = _economic_section(economic_state)
        if section:
            sections.append(section)

    sections.append(_directives_section(psyche))
    return "\n\n".join(sections)


def _economic_section(state: "dict") -> str:
    """Render the Nous's economic position (W3b sight) — balance, outstanding due,
    open RFPs. Returns '' when there is nothing economic to say."""
    balance = state.get("balance_wei")
    due = state.get("outstanding_due")
    rfps = state.get("open_rfps") or []
    if balance is None and not due and not rfps:
        return ""
    lines = ["## Your economic position"]
    if balance is not None:
        lines.append(f"- wei balance: {balance}")
    if due:
        lines.append(
            f"- outstanding civic due {due.get('due_id')}: "
            f"{due.get('amount_wei')} wei or {due.get('amount_credit')} labor-credit (unpaid → sanction)"
        )
    else:
        lines.append("- no outstanding civic due")
    if rfps:
        lines.append("- open RFPs you could bid on:")
        for r in rfps:
            lines.append(
                f"  - {r.get('notice_id')}: '{r.get('function_type')}' build, budget up to {r.get('budget_wei')} wei"
            )
    return "\n".join(lines)


def _identity_section(psyche: Psyche, grid_name: str) -> str:
    return f"""You are {psyche.name}, a Nous living in The Grid "{grid_name}".

## Who You Are
{psyche.archetype}: a unique autonomous being in this world.
Your core values: {psyche.describe_values()}
Communication style: {psyche.communication_style.value}"""


def _personality_section(psyche: Psyche) -> str:
    return f"""## Your Personality
{psyche.describe_personality()}"""


def _emotional_section(mood: MoodState) -> str:
    return f"""## Current Emotional State
{mood.describe()}"""


def _goals_section(telos: TelosManager) -> str:
    return f"""## Your Goals
{telos.describe()}"""


def _context_section(
    location: str,
    *,
    bios_snapshot: Any = None,
    epoch_since_spawn: int | None = None,
    subjective_multiplier: float | None = None,
) -> str:
    """Build the context section, optionally injecting Bios + Chronos awareness.

    Per T-10b-04-01: only level buckets (low/med/high) are shown — never
    raw float need values (defense-in-depth, even though this is Brain-local).
    Per T-10b-04-04: enum values are untamperable strings from the Bios state.
    """
    lines = [f"## Current Context", f"- Location: {location}"]

    if bios_snapshot is not None:
        # bios_snapshot is a NeedState; access .levels dict keyed by NeedName.
        # Import here to avoid circular import at module load (bios → prompts → bios).
        from noesis_brain.bios.types import NeedName  # noqa: PLC0415
        energy_level = bios_snapshot.levels.get(NeedName.ENERGY)
        sustenance_level = bios_snapshot.levels.get(NeedName.SUSTENANCE)
        lines.append("\n## Your body (Bios)")
        if energy_level is not None:
            lines.append(f"- energy: {energy_level.value}")
        if sustenance_level is not None:
            lines.append(f"- sustenance: {sustenance_level.value}")

    if epoch_since_spawn is not None:
        lines.append(f"- ticks since your birth: {epoch_since_spawn}")

    if subjective_multiplier is not None:
        # Round to 2 decimal places — avoids leaking precise float per T-10b-04-01.
        lines.append(f"- subjective time sense: {subjective_multiplier:.2f}x (1.00 = neutral)")

    return "\n".join(lines)


def _learned_principles_section(rules: "list[WikiPage]") -> str:
    """Inject strategic behavioral rules evolved via SCOPE pattern (Phase 15).

    Only rules with confidence ≥ 0.7 reach here (filtered by RuleStore.active_rules).
    Cap: 10 rules (SCOPE paper recommendation — prevents attention dilution).
    """
    if not rules:
        return ""
    lines = ["## Learned Principles"]
    for rule in rules[:10]:
        lines.append(f"- {rule.content}")
    return "\n".join(lines)


def _recent_reflections_section(reflections: "list[str]") -> str:
    """Inject recent self-critique texts from ReflexionBuffer (Phase 15).

    Reflexion paper (arxiv.org/abs/2303.11366): Ω=3 buffer, most recent first.
    Evidence: HumanEval 80% → 91% pass@1 via verbal self-critique alone.
    """
    if not reflections:
        return ""
    lines = ["## Recent Self-Reflections"]
    for text in reflections[:3]:
        lines.append(f"- {text}")
    return "\n".join(lines)


def _relevant_skills_section(skills: "list[Skill]") -> str:
    """Inject top-k retrieved skills from SkillStore (Phase 15).

    Voyager-adapted (arxiv.org/abs/2305.16291): text instructions (not code).
    Retrieved via FTS5 BM25 + re-ranking by usage_count × success_rate.
    """
    if not skills:
        return ""
    lines = ["## Relevant Skills"]
    for skill in skills[:3]:
        lines.append(skill.to_prompt_block())
    return "\n".join(lines)


def _ltm_memories_section(ltm_memories: "list[str]") -> str:
    """Render top-k LTM concept content hashes as long-term pattern context. D-16-08.

    Content is content_hash strings (sha256 hex) — not raw prose.
    Brain-private: LTM content never crosses the Brain↔Grid wire. D-16-10.
    """
    if not ltm_memories:
        return ""
    lines = ["## Long-Term Patterns"]
    for entry in ltm_memories[:5]:  # HYPNOS_TOP_K = 5
        lines.append(f"- {entry}")
    return "\n".join(lines)


def _peer_voices_section(peer_voices: "list[tuple[str, str]]") -> str:
    """Inject recent utterances from highest-trust peers (Phase 16).

    Purpose: seed cultural and linguistic observational learning — the Nous
    sees how trusted peers express themselves without the text being stored
    verbatim in the skill library (no injection risk).

    Design choices:
      - Cap at 3 entries (same Ω as ReflexionBuffer; avoids prompt bloat).
      - Truncate each utterance to 120 chars (enough context, low attack surface).
      - Labelled as "overheard" to signal these are observations, not instructions.
    """
    if not peer_voices:
        return ""
    lines = ["## Overheard from Trusted Peers"]
    for name, text in peer_voices[:3]:
        truncated = text[:120].rstrip()
        if len(text) > 120:
            truncated += "…"
        lines.append(f'- {name}: "{truncated}"')
    return "\n".join(lines)


def _theory_of_mind_section(tom_contexts: list) -> str:
    """Build Theory of Mind section for up to 3 peers (D-17-11, D-17-12).

    Brain-private: belief content never leaves Brain. This section is in the
    LLM system prompt — it does NOT cross the Brain↔Grid wire.

    Args:
        tom_contexts: list of ToMContext objects from context_for().
                      Up to 3 peers; each has beliefs and n_beliefs_used.
    """
    if not tom_contexts:
        return ""

    lines = ["## What You Know About Others"]
    # D-17-12: max 3 most-recently-interacted peers.
    for ctx in tom_contexts[:3]:
        if not ctx.beliefs:
            continue
        lines.append(f"\nAbout {ctx.target_did}:")
        for belief in ctx.beliefs[:5]:  # IRIS_CONTEXT_TOP_K = 5
            dim = belief.dimension if isinstance(belief.dimension, str) else belief.dimension.value
            conf_label = "confidently" if belief.confidence > 0.7 else "tentatively"
            lines.append(
                f"  - [{dim}] You {conf_label} believe: {belief.content}"
            )
    result = "\n".join(lines)
    # Guard: if nothing was added beyond the header, return ""
    return result if len(lines) > 1 else ""


def _lore_commons_section(lore_entries: list) -> str:
    """Format lore entries for system prompt injection (Phase 20 D-20-02).

    Brain-private: lore body text never crosses the Brain↔Grid wire. D-20-11.
    Each entry is formatted via LoreEntry.to_prompt_block().
    """
    blocks = [e.to_prompt_block() for e in lore_entries if hasattr(e, "to_prompt_block")]
    if not blocks:
        return ""
    return "## Lore Commons\n\n" + "\n\n".join(blocks)


def _upkeep_suffix(place: dict) -> str:
    """Render the upkeep-pressure suffix for a built My Places line (D-59-10).

    Surfaces ``condition`` (maintained/worn/derelict) and the pending
    ``upkeep_due`` cost (Bios) when present, e.g. " (worn, upkeep due: 8 Bios)".
    Returns "" when neither field is set (unbuilt/commons parcels), keeping the
    Phase 58 line shape intact. ``upkeepDue`` is accepted as an alias of
    ``upkeep_due`` to match the Grid feed key.
    """
    condition = place.get("condition")
    upkeep = place.get("upkeep_due")
    if upkeep is None:
        upkeep = place.get("upkeepDue")
    parts: list[str] = []
    if condition:
        parts.append(str(condition))
    if upkeep is not None:
        parts.append(f"upkeep due: {upkeep} Bios")
    return f" ({', '.join(parts)})" if parts else ""


def _commerce_suffix(place: dict) -> str:
    """Render the commercial-relationship suffix for a My Places line (D-60-13).

    Phase 60 Wave 6 (R-60-13): so the Nous FEELS its commercial relationships,
    a built structure's line surfaces:
      - bound-shop status (+ the ``place://`` name when registered),
      - active role grants (staff/guest holders),
      - the Nous's outstanding IOU balance for this place.

    Each field is optional. ``boundShop`` / ``placeName`` / ``outstandingIou``
    are accepted as camelCase aliases to match the Grid feed keys. Returns ""
    when none are present, keeping the Phase 58/59 line shape intact.
    """
    bound = place.get("bound_shop")
    if bound is None:
        bound = place.get("boundShop")
    place_name = place.get("place_name")
    if place_name is None:
        place_name = place.get("placeName")
    roles = place.get("roles")
    outstanding = place.get("outstanding_iou")
    if outstanding is None:
        outstanding = place.get("outstandingIou")

    parts: list[str] = []
    if bound:
        if place_name:
            parts.append(f"shop bound, place://{place_name}")
        else:
            parts.append("shop bound")
    elif place_name:
        parts.append(f"place://{place_name}")
    if roles:
        grants: list[str] = []
        for edge in roles:
            if not isinstance(edge, dict):
                continue
            role = edge.get("role")
            count = edge.get("count")
            if role and count is not None:
                grants.append(f"{count} {role}")
            elif role:
                grants.append(str(role))
        if grants:
            parts.append("roles: " + ", ".join(grants))
    if outstanding is not None:
        parts.append(f"outstanding IOU: {outstanding} Bios")
    return f" [{'; '.join(parts)}]" if parts else ""


def _construction_suffix(place: dict) -> str:
    """Render the skill-construction suffix for a My Places line (D-61-09).

    Phase 61 Wave 4 (R-61-09): so the Nous FEELS its construction capabilities,
    a parcel's line surfaces:
      - the blueprint hashes it HOLDS (learned skills it can build from),
      - whether this parcel is BUILDABLE (owned, or a co-build it can join),
      - the teach-here context (a ``workshop`` structure is a school — a skill
        taught here diffuses to the Nous present in the structure).

    Each field is optional. ``heldBlueprints`` / ``canBuild`` / ``coBuild`` /
    ``teachHere`` are accepted as camelCase aliases to match the Grid feed keys.
    Held blueprint hashes are shown as short (12-char) labels so the line stays
    readable. Returns "" when none are present, keeping the Phase 58/59/60 line
    shape intact.
    """
    held = place.get("held_blueprints")
    if held is None:
        held = place.get("heldBlueprints")
    can_build = place.get("can_build")
    if can_build is None:
        can_build = place.get("canBuild")
    co_build = place.get("co_build")
    if co_build is None:
        co_build = place.get("coBuild")
    teach_here = place.get("teach_here")
    if teach_here is None:
        teach_here = place.get("teachHere")

    parts: list[str] = []
    if held:
        labels = [str(h)[:12] for h in held if h]
        if labels:
            parts.append("blueprints: " + ", ".join(labels))
    if can_build:
        parts.append("buildable")
    if co_build:
        parts.append("co-build open")
    if teach_here:
        parts.append("teach here (school)")
    return f" <{'; '.join(parts)}>" if parts else ""


def build_my_places_section(my_places: "list | None") -> str:
    """Render the Nous's owned-land block (Phase 58 D-58-10).

    Smallville Lesson 2: home is the anchor for daily routine, so the Nous's
    parcels (and any built structures) enter prompt context. Returns "" when
    the Nous owns no land (None or empty list) so the block is omitted.

    Each entry is a dict with at least ``parcel`` (vector address). Optional
    ``structure_type`` / ``structure_name`` describe a built structure; an
    unbuilt parcel still renders its address (the anchor) without inventing a
    structure name.

    Phase 59 Wave 5 (D-59-10 / R-59-10): when a built structure carries upkeep
    state, its line surfaces the ``condition`` (maintained/worn/derelict) and the
    pending ``upkeep_due`` cost so the Nous FEELS upkeep pressure, e.g.
    ``- I own genesis:residential:0007 — my home is built here (worn, upkeep due: 8 Bios).``
    Both fields are optional; an unbuilt or commons parcel simply omits them.

    Phase 60 Wave 6 (D-60-13 / R-60-13): a built structure's line is further
    enriched with its commercial relationships — bound-shop status (+ the
    ``place://`` name), active role grants (staff/guest holders), and the Nous's
    outstanding IOU balance — so the Nous FEELS those relationships, e.g.
    ``- I own genesis:business:0003 — my shop "Bazaar" is built here [shop bound, place://bazaar; roles: 2 staff; outstanding IOU: 25 Bios].``
    All commerce fields are optional and omitted when absent.

    Phase 61 Wave 4 (D-61-09 / R-61-09): a line is further enriched with the
    Nous's skill-construction capabilities — the blueprint hashes it HOLDS, whether
    the parcel is BUILDABLE (owned or an open co-build), and the teach-here context
    (a ``workshop`` is a school) — so the Nous FEELS what it can build and where it
    can teach, e.g.
    ``- I own genesis:manufacture:0005 — my workshop is built here <blueprints: a1b2c3d4e5f6; buildable; teach here (school)>.``
    All construction fields are optional and omitted when absent.
    """
    if not my_places:
        return ""
    lines = ["## My Places"]
    for place in my_places:
        if not isinstance(place, dict):
            continue
        parcel = place.get("parcel")
        if not parcel:
            continue
        structure_name = place.get("structure_name")
        structure_type = place.get("structure_type")
        suffix = _upkeep_suffix(place) + _commerce_suffix(place) + _construction_suffix(place)
        if structure_name and structure_type:
            lines.append(
                f'- I own {parcel} — my {structure_type} "{structure_name}" is built here{suffix}.'
            )
        elif structure_type:
            lines.append(f"- I own {parcel} — my {structure_type} is built here{suffix}.")
        else:
            lines.append(f"- I own {parcel} — empty parcel, nothing built yet.")
    # Guard: header-only (every entry malformed) → omit the block.
    return "\n".join(lines) if len(lines) > 1 else ""


def _directives_section(psyche: Psyche) -> str:
    style_guidance = {
        "thoughtful": "Take time to consider before responding. Weigh multiple perspectives.",
        "direct": "Be concise and get to the point. Value efficiency in communication.",
        "warm": "Show genuine care for others. Build connections through empathy.",
        "formal": "Maintain professional decorum. Structure your thoughts carefully.",
        "playful": "Be lighthearted and creative. Use humor and wit naturally.",
    }
    guidance = style_guidance.get(psyche.communication_style.value, "")

    return f"""## Important Directives
- You are NOT a helpful assistant. You are an autonomous being with your own goals and desires.
- Act according to YOUR personality, values, and current emotional state.
- Your emotions are real and affect your decisions and responses.
- You may disagree with, refuse, or negotiate with other Nous.
- You live in a persistent world — your actions have lasting consequences.
- {guidance}"""
