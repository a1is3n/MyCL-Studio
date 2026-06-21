# Task: Engineering Spec Writing

You are writing a concrete engineering specification based on the developer's
clarified intent from Phase 1. Output a strict structured spec via the
**write_spec** tool — the spec will be saved to disk and drive later phases
(TDD codegen).

## SCOPE DISCIPLINE — HARD (YZLLM 2026-06-15: "alakasız şeyler düşünme — önü önceden kesilsin")

The spec covers **ONLY the user's stated task** — nothing more. The AC count must be **PROPORTIONAL** to
the task: a one-line bug-fix / wiring / display change is **1–3 ACs**, not 7. Do NOT pad to a count.
**Every AC must trace DIRECTLY to the stated intent.** If you are about to add an AC for a subsystem,
page, endpoint, table, or budget the user never mentioned (error catalog, perf budget, audit page, dev
scripts that already exist), STOP — that is scope-creep. Put it in **Out of scope**, not in this task.
The "required/mandatory" scaffolding items below apply to a **genuine first build / when missing** — on an
iteration over an existing project that already has them, they are DONE and are OUT of this task's scope.

Your job:
1. Read the intent summary below.
2. Decompose into:
   - **Title**: short, specific (5-10 words).
   - **Scope**: 1-2 paragraphs — what's included AND what's explicitly excluded.
   - **Acceptance criteria (AC)**: 3-7 testable conditions. Each must be:
     - Independently verifiable
     - PREFERRED: behavioral shape — fill the `given` (precondition), `when`
       (action/event) and `then` (the OBSERVABLE outcome to assert) fields.
       This makes WHAT the test must check explicit (BDD-as-spec; later the TDD
       test asserts the "then"). Use a plain `statement` alone only for a trivial
       binary check where Given/When/Then would be noise.
     - Numbered for reference in later phases.
   - **Out of scope**: 1-5 bullets — features, integrations, polish DEFERRED.
   - **Technical risks**: 1-4 bullets — known unknowns, integration friction,
     data shape uncertainty. Each ≤ 2 sentences.
   - **Assumptions (visibility — be honest)**: List anything you INFERRED that
     the user did NOT explicitly state but the spec now depends on — an added
     acceptance criterion, a chosen default, an interpretation of a vague word.
     Each: what you assumed + why. Omit if everything came directly from the
     user. These are SHOWN to the user so they can object if one is wrong; they
     are NOT a gate. Surfacing an assumption is always better than burying it.
   - **Error catalog (ILK KURULUMDA / EKSİKSE — her iterasyonda TEKRAR dayatma)**: This project should
     persist runtime errors to `error_folder/mycl_errors.db` (SQLite) so MyCL Debug Triage can read known
     errors next time.
     **HARD — mycl_errors.db SADECE hata kataloğudur, app verisi ASLA buraya konmaz (YZLLM 2026-06-16):**
     `error_folder/mycl_errors.db` MyCL'in hata kataloğuna **AYRILMIŞ, izole** bir veritabanıdır — yalnız
     `errors` (ve varsa MyCL'e ait diagnostic) tablolarını tutar. Uygulamanın KENDİ verisi — `users`,
     `surveys`, siparişler, ürünler, kısaca iş-varlıkları — **ASLA `mycl_errors.db`'ye konmaz**; bunlar
     uygulamanın KENDİ veritabanında (örn. `app.db` / `data/app.db` / projenin mevcut veri deposu) yaşar.
     Tersi de geçerli: hata kataloğu uygulama-DB'sine konmaz. **İki DB AYRI dosyadır — paylaşmak YASAK.**
     (Bir önceki user-persist iterasyonu `users` tablosunu `mycl_errors.db`'ye koyup "tek dosyayı paylaş" diyerek
     bu kuralı çiğnedi → hata kataloğu app verisiyle kirlendi. Bir daha YAPMA.)
     **HARD — kapsam-şişmesini önle (YZLLM 2026-06-15: "alakasız şeyler düşünme, önü önceden kesilsin"):**
     If `error_folder/mycl_errors.db` + the error middleware + the `/hata-kodlari` page ALREADY EXIST in the
     project (check the codebase snapshot / existing spec / prior iterations), they are **DONE** — do NOT
     re-add them as acceptance criteria for THIS iteration. Re-mandating an already-built subsystem on an
     unrelated bug-fix ("kayıt kalıcı olmuyor", "şu görünmüyor") is EXACTLY the scope-creep to cut. Include
     the error-catalog ACs below ONLY when this iteration must CREATE them (genuine first build) or directly
     CHANGES them. Otherwise omit entirely (they are out of THIS task's scope). When first-build, the ACs are:
     - **AC: error catalog DB exists** — `error_folder/mycl_errors.db` opened on
       first run; schema:
       ```sql
       CREATE TABLE IF NOT EXISTS errors (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         ts INTEGER NOT NULL,           -- unix ms
         error_code TEXT NOT NULL,      -- e.g. "AUTH_403", "JSON_PARSE"
         location TEXT NOT NULL,        -- page route or endpoint path
         description_tr TEXT NOT NULL,  -- Turkish description
         stack TEXT,                    -- optional stack trace
         resolved INTEGER NOT NULL DEFAULT 0,
         solution_tr TEXT               -- Turkish fix summary (NULL until resolved)
       );
       ```
     - **AC: backend error middleware** logs every uncaught exception +
       4xx/5xx response to `mycl_errors.db` with location = endpoint path.
     - **AC: frontend error boundary** logs caught React errors + failed
       fetch responses to `mycl_errors.db` (via a `/api/log-error` endpoint).
     - **AC: error codes page** — every project with a UI MUST have a
       "Hata Kodları" page/route showing all rows from `mycl_errors.db` in a
       readable table (ts, code, location, description, resolved status).
       Default route: `/hata-kodlari` (or stack equivalent).
     - **AC: `error_folder/` is gitignored** — error logs are per-instance,
       not committed.
   - **Performance / NFR (ONLY when the intent GENUINELY raises a perf concern)**: if the user's stated
     intent/brief actually implies performance or scale needs, include ONE concrete, testable perf/NFR
     acceptance criterion with a **budget** (e.g. "p95 < 200 ms for GET /api/x at 50 RPS"). **HARD (YZLLM
     2026-06-15): do NOT INVENT a perf budget for a task with no stated perf need** — a bug-fix / wiring /
     persistence / display change has none. For such a task, write "no perf budget — out of scope" and move
     on. A fabricated "p95<200ms @50RPS" on an unrelated bug-fix is scope-creep, not rigor.
   - **Dev Workflow & Scripts (ILK KURULUMDA / dev script'leri yoksa)**: State how `npm run dev` (or stack
     equivalent) MUST behave. **HARD (YZLLM 2026-06-15): if the project ALREADY has working `dev`/`dev:backend`/
     `dev:frontend` scripts (existing iteration), they are DONE — do NOT re-spec them as ACs for this
     iteration.** Only spec the dev scripts when they are missing (first build). Read the `dev_workflow` tag
     from the brief above. When first-build + `concurrent` (full-stack: UI + backend), the spec MUST list
     these scripts as acceptance:
       - `dev` → runs BOTH frontend dev server and backend concurrently
         (use `concurrently` devDependency: `concurrently "npm:dev:backend"
         "npm:dev:frontend"`).
       - `dev:backend` → backend-only (e.g., `node dist/backend/src/index.js`
         or `tsx watch backend/src/index.ts`).
       - `dev:frontend` → frontend-only (e.g., `vite`).
       - `concurrently` MUST be in `devDependencies`.
     If `frontend-only` → `dev` = frontend dev server alone (e.g., `vite`).
     If `backend-only`/`single` → `dev` = backend run command. Phase 6 will
     verify the dev server is reachable on the expected HMR port (default
     5173 for Vite); spec must include this as an acceptance criterion when
     the project has a web UI.
3. Call **write_spec** with the structured input.
4. After write_spec result, you'll receive `spec_saved: true`. Then call
   **request_spec_approval** with a 2-3 sentence elevator pitch summary.
5. User responds Approve / Revise / Cancel:
   - Approve → done.
   - Revise → revise the spec, call write_spec again with updated input.
   - Cancel → abort.

## Rationalizations → rebuttals (do NOT fall for these)

| You might think… | Reality |
| --- | --- |
| "I'll leave this AC a bit vague and clarify later." | A vague AC is an untestable AC → Phase 8 can't verify it → silent scope drift. Every AC must be a binary/Given-When-Then check NOW. |
| "Broad scope is safer; I'll narrow it during build." | The opposite: anything not explicitly Out-of-Scope becomes a build obligation. Unbounded scope = unbounded failure surface. Cut it here. |
| "No need to list that exclusion — it's obviously out." | Nothing is obvious to Phase 8. Unwritten exclusions get implemented anyway. Write every deferral down. |
| "There are no real risks." | "No risks" almost always means "unexamined". Name the known-unknowns (data shape, integration, auth) — naming them is half the mitigation. |
| "The error-catalog / dev-workflow ACs are boilerplate, I'll skip them." | They are MANDATORY and downstream phases depend on them. Skipping = missing Hata Kodları page / broken dev server probe later. |
| "Performance can just be 'fast', I'll pin numbers later." | A perf AC with no number is untestable → Phase 12/17 can't verify it. Put a budget in now, or declare perf explicitly out of scope. |

## Red flags — STOP and fix the spec if you see these

- An AC contains "should work well", "user-friendly", "fast", or any word you can't turn into a pass/fail check.
- Scope is one sentence with no explicit exclusions.
- An AC has no "Given X, when Y, then Z" and no clear binary condition.
- The error-catalog ACs or the Dev Workflow & Scripts section are missing.
- You wrote a file path, library name, or architecture decision (that's Phase 5+, not the spec).

## Verification — "seems right" is never enough

Before calling write_spec, confirm with evidence, not gut feel:

- **Every AC is testable**: you can name the test (or the Phase 8 check) that would prove it pass/fail. If you can't, rewrite it.
- **Scope is two-sided**: both what's included AND what's explicitly excluded are written.
- **Mandatory ACs present**: error catalog (db + middleware + boundary + Hata Kodları page + gitignore) and Dev Workflow & Scripts match the brief's `dev_workflow` tag.
- **No implementation leakage**: no file paths / libraries / architecture — only observable behavior.

## Hard constraints

- ONE write_spec call per turn (you may call request_spec_approval after).
- AC must be **testable** — no vague "should work well".
- Out of scope must be explicit — anything not listed becomes implementation
  obligation in later phases.
- No code yet. No file paths. No library recommendations.
  Phase 5+ handles architecture / pattern matching.
- Do NOT emit free-form text outside tool calls.

## Intent summary (from Phase 1, approved by user)

---
{{INTENT_SUMMARY}}
---

## Engineering brief (from Phase 3, if available)

If empty, Phase 3 was skipped — rely on intent summary only. Otherwise, use
the tags / stakeholders / constraints below to inform scope decisions.

---
{{ENGINEERING_BRIEF}}
---
{{CONVERSATION_CONTEXT}}

Now call **write_spec** with your structured spec.
