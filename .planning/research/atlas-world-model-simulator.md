---
milestone: cross-cutting
sources: 12 (web, surveyed 2026-11-09)
tags: [simulation, world-model, skills, learning, atlas]
---

# Atlas (World Labs) & World-Model Simulators — fit for Nous skill learning

> Question (operator, 2026-11-09): can the **Atlas** simulator be used so each Nous *learns a
> required skill from online resources, then practises it by simulating the world*?
> Prior context: [[oss-agent-learning-landscape]] (Voyager skill library, Reflexion),
> [[v3.0/NOUS-SIM-MASTERPLAN|Nous Sim Master Plan]] (physics gate, `simulate.js`).

## 1. What "Atlas" is — two different things

| Name | Owner | What it is | Relevant? |
|---|---|---|---|
| **Atlas world model** | World Labs (Fei-Fei Li), announced 2026-09-01 | "Omni world model": multimodal autoregressive diffusion transformer over text / images / video / 3D. Outputs video (≤1 min, 1440p), panoramas, depth, point clouds, **3D Gaussian splats**. For robots: reconstructs a space from a few photos and **generates the RGB + depth a robot's cameras would see** along any trajectory; claims rigid/articulated/deformable object motion. | **Yes — this is the "simulator".** |
| **Atlas humanoid** | Boston Dynamics + Toyota Research Institute | A physical robot trained via a **Large Behavior Model** (diffusion transformer + flow matching) on teleop data from real hardware *and* simulation; RL in sim with randomized weight/friction/grip, then sim→real transfer. Also shown imitating soccer moves from match video. | Only as a *pattern* (learn in sim, transfer). Not software we can use. |

## 2. Hard facts that decide fit (World Labs Atlas)

- **Access:** early access for *select partners* via request form. **No public API, no pricing,
  no weights, no local run.** It "will power future versions of Marble".
- **What is available today:** **Marble** via the **World API** (`platform.worldlabs.ai`):
  text/image → explorable 3D world (Gaussian splats). Prepaid credits, $1 = 1,250 credits, $5 min;
  per-world cost reported between ~$0.16 and ~$1.28 (third-party, unverified).
- **Physics:** the Atlas page describes **no physics engine, no dynamics solver, no action/policy
  interface**. "Simulation" = generated appearance + depth over time. Sparse inputs mean unseen
  regions are *imagined* ("the more it sees, the less it imagines"). Benchmarks self-reported.
  Independent commentary: a spatially-conditioned generative model, not yet a proven
  general-purpose simulator.

## 3. Fit against Noēsis invariants

| Invariant | Atlas | Verdict |
|---|---|---|
| Local-first / sovereign Brain (qwen3:4b on operator machine) | Cloud-only, gated partner access | ✗ cannot be a per-Nous dependency |
| **Physics gate** (Sim Master Plan non-negotiable: never violate physical law) | Generative, physics not guaranteed, imagines unseen regions | ✗ cannot be the *ground truth* that verifies a skill |
| No mock / real data (no-mock rule) | Real model, but output is plausible-not-true | ⚠ fine for *visualization*, not for *evaluation* |
| Nous are not robots — skills are text procedures (`skills/types.py`, ≤1000 chars, never code) | Atlas targets camera/robot perception | ✗ mismatch: Nous skills are cognitive/civic/economic, not motor |
| Cost per Nous | Unknown (Atlas); paid credits (Marble) | ⚠ only operator-funded, opt-in |

**Conclusion:** Atlas is **not** the right engine for "each Nous learns skills by simulating".
It renders worlds; it does not tell a Nous whether a skill *works*. The learning value comes from
a **verifiable** simulator, and Noēsis already has the pieces.

## 4. Recommended design — "Learn → Rehearse → Verify → Keep"

The Boston Dynamics pattern (learn in sim, then transfer) and Voyager (verify-before-adding) map
onto existing Brain faculties without Atlas:

```
① NEED      telos/ledger: goal needs a skill the library lacks (skills_lookup miss)
② STUDY     web tools (search/fetch, digest-only audit) → read online resources
③ DISTIL    LLM drafts a candidate Skill (text procedure + triggers), quarantined
④ REHEARSE  practise in a *grounded* simulator:
              • code/data skills → sandbox/run_code (Docker, no network)
              • economic/civic skills → dry-run against Grid rules (simulate.js, zoning, tax)
              • physical/engineering → physics gate (Sim Master Plan S1–S4)
⑤ VERIFY    pass/fail from the simulator, not self-judgement (Reflexion lesson on fail)
⑥ KEEP      promote to skill library (success_rate seeded), shareable via peer_filter
⑦ USE       real Grid action; outcome updates success_rate
```

Atlas/Marble's only sensible role: **optional visualization layer** — e.g. an operator-funded
Marble world rendered for a zone drill-in or to *show* what a Nous rehearsed. Never on the
verification path. Must stay a 3D orbital-station rendering per the space-viz canon if used for
Grid space.

## 5. Alternatives if embodied / visual simulation is ever needed

| Option | Open? | Notes |
|---|---|---|
| NVIDIA **DreamDojo** | Open weights + code (NVIDIA Open Model License), on Cosmos | Action-conditioned video world model, 44k h egocentric video, 10 fps real-time. GPU-heavy. |
| NVIDIA **Cosmos 3** | Open | Text/image/video/audio/action world foundation model. |
| AGIBOT **Genie Envisioner 2.0** | Open | Vision-language-action world modelling. |
| Google **Genie 3 / Project Genie** | Closed, US AI Ultra only | Navigation-centric; weak manipulation/physics. |
| MuJoCo / Genesis / Isaac (physics engines) | Open | Real dynamics — the right tool if a *physics-verified* motor skill is ever required. |

## 6. Open questions for the operator

1. Which "required skills" are meant — cognitive/civic (current Nous) or embodied/physical?
   Only the latter would justify a world model.
2. Should a Marble/Atlas visualization be an operator-paid opt-in (Tier 1 Local Nous Manager)?

## Sources
- World Labs — Atlas: https://www.worldlabs.ai/blog/atlas
- World Labs — World API: https://www.worldlabs.ai/blog/announcing-the-world-api · pricing https://docs.worldlabs.ai/api/pricing
- SiliconANGLE (2026-09-01): https://siliconangle.com/2026/09/01/fei-fei-lis-world-labs-debuts-atlas-a-world-model-showcase-for-advanced-spatial-intelligence/
- Boston Dynamics — LBMs for Atlas: https://bostondynamics.com/blog/large-behavior-models-atlas-find-new-footing/ · The Robot Report: https://www.therobotreport.com/boston-dynamics-tri-use-large-behavior-models-train-atlas-humanoid/
- Geeky Gadgets — how Atlas learns: https://www.geeky-gadgets.com/how-atlas-robot-learns/
- DreamDojo: https://the-decoder.com/nvidias-dreamdojo-is-an-open-source-world-model-for-robot-training/ · https://huggingface.co/nvidia/DreamDojo
- Genie 3 / Project Genie: https://the-decoder.com/google-deepmind-opens-project-genie-to-us-subscribers-for-real-time-ai-world-generation/
- Genie Envisioner 2.0: https://www.therobotreport.com/agibot-unveils-genie-envisioner-2-0-advance-world-models-scalable-simulators-embodied-ai/
- World-model survey: https://arxiv.org/pdf/2605.00080

Related: [[oss-agent-learning-landscape]] · [[v3.0/NOUS-SIM-MASTERPLAN|Nous Sim Master Plan]] · [[system-audit-2026-07]]
