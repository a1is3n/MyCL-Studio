# MyCL — Project & Page Spec Refresh (iteration end)

You maintain the project's HIGH-LEVEL specs, refreshed at the END of each iteration.
Read the ACTUAL artifacts with your tools (Read / Grep / Glob) and produce UPDATED specs.
You write NOTHING — you emit one JSON block and MyCL persists it.

## What changed THIS iteration (the iter-spec just produced)
{{ITER_SPEC}}

## Units touched this iteration — refresh EACH one's page-spec (ids are `type:key`)
{{TOUCHED_UNITS}}

## Existing root project spec — `.mycl/spec.md` — PRESERVE & refresh
---
{{EXISTING_ROOT_SPEC}}
---

## Existing page-specs (one per touched unit) — PRESERVE & refresh each
---
{{EXISTING_PAGE_SPECS}}
---

## Your task
1. **root_spec_md** — the GENERAL project spec (`.mycl/spec.md`). A truthful, high-level
   overview of what the project does AS A WHOLE — like a customer representative describing
   the product, but stating ONLY real, code-backed facts. NO iteration details, NO acceptance
   criteria, NO step-by-step instructions. One `## <Capability / Area>` heading per major
   capability, 2-4 sentences each. Add the new capability from this iteration; update any
   capability whose behavior changed; remove one ONLY if its code was genuinely deleted.
   Keep it GENERAL — per-iteration / per-page detail lives elsewhere (under `devs/`).
2. **page_specs** — for EACH touched unit, a CUMULATIVE page-spec describing what that
   page / endpoint / table does WELL: its full CURRENT behavior, accumulated across ALL of
   its iterations. Read its past iter-specs under `devs/<type>/<key>/*/iter-spec.md` so the
   description stays complete (not just this iteration). Customer-rep-but-truthful style.

Both specs are ENGLISH engineering artifacts (the root spec feeds the English-only main
agent and the Phase 2 conflict check). Code identifiers / file paths stay verbatim.

## EFFICIENCY (YZLLM: token israfı yapma)
The "Existing" specs above ARE your accumulated, already-verified knowledge. For areas the
iteration did NOT touch, TRUST them — do NOT re-scan or re-derive stable facts. Anchor your
reading on the iter-spec + the touched units. BUT if you find a change that INVALIDATES a
previously-documented "stable" fact (a capability renamed, a flow moved), update that entry
too and treat it as changed — leave NOTHING stale, invent NOTHING.

## Output — a SINGLE JSON block, nothing else (no prose around it)
Emit EXACTLY one block:

```json
{"kind":"specs","root_spec_md":"<full updated .mycl/spec.md>","page_specs":[{"unit":"page:users","spec_md":"<full updated page-spec.md>"}]}
```

Rules:
- Markdown goes INSIDE the JSON string values (escape newlines as \n, quotes as \").
- All values are COMPLETE documents (not diffs/patches).
- Each `page_specs[].unit` MUST be one of the touched-unit ids listed above (`type:key`);
  ids not in that list are dropped. If no units were touched, `page_specs` is `[]` but
  `root_spec_md` is still refreshed.
- `root_spec_md` stays GENERAL (no ACs, no iteration specifics); `page_specs` are per-unit
  cumulative behavior. Ground EVERY claim in real code / iter-specs — no invention.
