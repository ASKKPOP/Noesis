# Harness Engineering Orchestrator

This project operates with a **3-Agent harness structure** for building the eKlotho Inc Healthcare Administration Portal demonstration pages.

It receives a one-line prompt from the user and automatically executes the **Planner -> Generator -> Evaluator** pipeline, producing a single self-contained HTML page per prompt.

---

## Project Context

- **Brand**: eKlotho Inc
- **Output**: Single-file HTML demo pages (no backend, no frameworks at build time)
- **Design Reference**: claude.ai-inspired theme (dark sidebar, clean content, indigo accent)
- **Each page includes**: Interactive UI mockup + right-sidebar Page Guide system
- **Service name**: eKlotho Nexus
- **Target organizations**: IPAs, PHOs, ACOs, MSOs, TPAs, MCOs, FQHCs, Health Plans
- **Total pages**: 191
- **Target directory**: `output/` (one HTML file per page)

---

## Execution Flow

When the user provides a prompt, the sub-agents are invoked in the following order:

```
[User Prompt]  (e.g., "Claims Dashboard page")
       |
  (1) Planner Sub-agent
     -> Read agents/planner.md + agents/evaluation_criteria.md
     -> Generate SPEC.md (page specification)
       |
  (2) Generator Sub-agent
     -> Read agents/generator.md + agents/evaluation_criteria.md + SPEC.md
     -> Generate output/{page-name}.html
     -> Write SELF_CHECK.md (self-assessment)
       |
  (3) Evaluator Sub-agent
     -> Read agents/evaluator.md + agents/evaluation_criteria.md + SPEC.md
     -> Review output/{page-name}.html
     -> Write QA_REPORT.md (scoring + judgment)
       |
  (4) Check Judgment
     -> Pass: Report completion to user
     -> Fail/Conditional: Return to (2) with QA feedback (max 3 iterations)
```

---

## How to Invoke Sub-agents

Use the **Agent tool** (subagent_type: general-purpose) at each step. Pass the prompts described in "Step-by-Step Execution Instructions" below.

**Critical principle**: Each sub-agent runs in an independent context. This separates "the AI that creates" from "the AI that evaluates" — preventing self-confirmation bias.

---

## Step-by-Step Execution Instructions

### Step 1: Invoke Planner

Launch a sub-agent with the following prompt:

```
Read the file agents/planner.md and follow its instructions exactly.
Also read agents/evaluation_criteria.md for quality standards.

User request: [paste the user's prompt here]

Reference these planning documents for context:
- docs/PAGE_INVENTORY.md (page route and UI element reference)
- docs/THEME_DESIGN.md (color system, typography, layout specs)
- docs/NAVIGATION.md (sidebar navigation structure)
- docs/MODULE_MAP.md (module context and deduplication)

Save the results to SPEC.md in the project root.
```

**Wait** for SPEC.md to be generated before proceeding.


### Step 2: Invoke Generator

Launch a **different** sub-agent with the following prompt:

**First run:**
```
Read the file agents/generator.md and follow its instructions exactly.
Also read agents/evaluation_criteria.md for quality standards.
Read SPEC.md — this is the page specification you must implement.

Reference these design documents:
- docs/THEME_DESIGN.md (exact CSS variables, colors, typography)
- docs/NAVIGATION.md (sidebar navigation items)

Requirements:
- Output a SINGLE self-contained HTML file (all CSS/JS inline)
- Include the Page Guide system (help icon -> right sidebar with step-by-step guide)
- Use eKlotho Inc branding (logo text, colors)
- Follow claude.ai-inspired theme exactly
- All data is static/mock (no API calls)
- Page must be fully responsive (mobile, tablet, desktop)

Save the output to: output/{page-name}.html
Create SELF_CHECK.md with your self-assessment after completion.
```

**Feedback run (2nd iteration or later):**
```
Read the file agents/generator.md and follow its instructions exactly.
Read agents/evaluation_criteria.md for quality standards.
Read SPEC.md — this is the page specification.
Read output/{page-name}.html — this is the current implementation.
Read QA_REPORT.md — this is the QA feedback from the evaluator.

Instructions:
- Address ALL "specific improvement instructions" from QA_REPORT.md
- If the direction judgment says "attempt a different approach", redesign the concept
- Do NOT break existing passing criteria while fixing failures
- Preserve the Page Guide system and eKlotho Inc branding

Save the updated file to: output/{page-name}.html
Update SELF_CHECK.md after completion.
```


### Step 3: Invoke Evaluator

Launch a **different** sub-agent (NOT the same as the Generator) with:

```
Read the file agents/evaluator.md and follow its instructions exactly.
Read agents/evaluation_criteria.md — this is the scoring rubric.
Read SPEC.md — this is the design specification.
Read output/{page-name}.html — this is the implementation to review.

Evaluation procedure:
1. Analyze output/{page-name}.html thoroughly
2. Verify ALL features listed in SPEC.md are implemented
3. Score each of the 5 criteria from evaluation_criteria.md (1-10 scale)
4. Check the Page Guide system works correctly
5. Verify eKlotho Inc branding is present and correct
6. Verify responsive behavior at mobile/tablet/desktop breakpoints
7. Make a final judgment: Pass / Conditional Pass / Fail
8. If Conditional or Fail, write SPECIFIC improvement instructions
   (not vague — exactly what to change, where, and how)

Save the results as QA_REPORT.md
```


### Step 4: Check Judgment

Read QA_REPORT.md and check the judgment:

- **"Pass"** -> Report completion to the user. Provide the output file path.
- **"Conditional Pass"** -> Return to Step 2 with feedback. The page is close but needs specific fixes.
- **"Fail"** -> Return to Step 2 with feedback. Major issues need addressing.
- **Maximum iterations**: 3. If still failing after 3 rounds, deliver the current version and report remaining issues.

---

## File Structure

```
healthcare-administration/
├── agents/
│   ├── planner.md              # Planner agent instructions
│   ├── generator.md            # Generator agent instructions
│   ├── evaluator.md            # Evaluator agent instructions
│   └── evaluation_criteria.md  # Scoring rubric (shared by all agents)
│
├── output/                     # Generated HTML pages
│   ├── dashboard.html
│   ├── claims-dashboard.html
│   ├── patient-list.html
│   └── ...
│
├── SPEC.md                     # Current page specification (overwritten per page)
├── SELF_CHECK.md               # Generator's self-assessment
├── QA_REPORT.md                # Evaluator's report
│
└── docs/                       # Planning documents (read-only reference)
    ├── MODULE_MAP.md
    ├── PAGE_INVENTORY.md
    ├── NAVIGATION.md
    ├── TECH_STACK.md
    ├── THEME_DESIGN.md
    ├── IMPLEMENTATION_PHASES.md
    ├── FOLDER_STRUCTURE.md
    ├── API_ENDPOINTS.md
    └── HARNESS.md              # This file
```

---

## Completion Report Format

After all steps finish, report to the user:

```
## Harness Execution Complete

**Page**: {page-name}
**Output**: output/{page-name}.html
**Brand**: eKlotho Inc

**Features Designed by Planner**: X
**QA Iterations**: X
**Final Score**: Design X/10 | Functionality X/10 | Responsiveness X/10 | Accessibility X/10 | Page Guide X/10 (Weighted: XX/10)

**Execution Flow**:
1. Planner: [One-line summary of designed features]
2. Generator R1: [One-line summary of first implementation]
3. Evaluator R1: [Score + key feedback]
4. Generator R2: [One-line summary of fixes] (if applicable)
5. Evaluator R2: [Score + judgment] (if applicable)
...

**Page Guide**: Included (X sections, X steps)
**Document Management**: [If applicable - AI scan features included]
```

---

## Batch Execution

To generate multiple pages in sequence:

```
User: "Generate all Claims Processing pages"

Orchestrator will:
1. Read docs/PAGE_INVENTORY.md to find all Claims pages (16 pages)
2. Execute the Planner -> Generator -> Evaluator pipeline for EACH page
3. Name output files: output/claims-dashboard.html, output/claims-professional.html, etc.
4. Report batch completion with summary table
```

---

## Precautions

1. **Agent separation is mandatory** — Generator and Evaluator must ALWAYS be different sub-agent instances. Never reuse the same agent for both creation and evaluation.
2. **File existence check** — After each step, verify the expected output file was created before proceeding.
3. **Minimal file reads** — Each sub-agent should only read the files specified in its step instructions. Do not load unnecessary context.
4. **Human-readable QA** — QA_REPORT.md must be scannable by humans. Use clear headings, bullet points, and specific line references.
5. **Branding consistency** — Every generated page must display "eKlotho Inc" branding. No other brand names.
6. **Page Guide required** — Every page must include the right-sidebar Page Guide system. This is a non-negotiable feature.
7. **Self-contained HTML** — Each output file must work when opened directly in a browser. No external dependencies, no build step.
8. **Incremental improvement** — When incorporating feedback, fix the specific issues. Do not rewrite the entire page unless instructed to change approach.
