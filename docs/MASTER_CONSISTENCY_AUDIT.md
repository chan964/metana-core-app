# Master Consistency Audit (Read-Only)

**Scope:** Backend routes, frontend usage, database schema (actual usage), documented intent.  
**No code changes; identification of mismatches, drift, and where assumptions break.**

---

## CRITICAL

*None.* Legacy pages that previously called deprecated API wrappers now redirect or show a static deprecation message and do not invoke throwing code.

---

## MAJOR

### 1. Duplicate instructor submission-detail routes; flat route unused

**Mismatch:** Two backend routes serve instructor submission detail:  
- `GET /api/instructor/submissions/[submissionId].ts` (flat)  
- `GET /api/instructor/modules/[id]/submissions/[submissionId].ts` (nested)

The only frontend that loads submission detail is **InstructorSubmissionDetail**, which calls the **nested** URL. No component or direct `fetch` calls the flat route.

**Where it appears:**  
- Backend: `api/instructor/submissions/[submissionId].ts` (unused); `api/instructor/modules/[id]/submissions/[submissionId].ts` (used).  
- Frontend: `src/pages/instructor/InstructorSubmissionDetail.tsx` (fetch to nested route only).

**Impact:** Two implementations to maintain; behaviour and response shape could diverge. New code or external callers using the flat route may get different semantics or auth behaviour than the nested route.

---

### 2. GET /api/submissions (by id) has no active caller

**Mismatch:** `api/submissions/index.ts` implements GET with `req.query.id` to return a single submission (with auth and ownership checks). The only former consumer was the deprecated `getSubmissionById()` in `src/api/submissions.ts`, which throws. No active page or component calls `GET /api/submissions?id=...`.

**Where it appears:**  
- Backend: `api/submissions/index.ts` (line 38: `const submissionId = req.query.id`).  
- Frontend: no active call; deprecated wrapper referenced it.

**Impact:** Route is effectively dead from the app’s perspective. Callers using a different query name (e.g. `submissionId`) would get no id and a failed lookup, leading to 401/404 and confusion.

---

### 3. GET /api/submissions/status does not enforce module enrollment

**Mismatch:** `api/submissions/status.ts` returns submission status for a given `moduleId` and the current user’s `student_id`. It does not check `module_students`. If no submission row exists, it returns `200 { status: 'draft' }` for any `moduleId`.

**Where it appears:**  
- `api/submissions/status.ts`: no enrollment check before querying `submissions` or returning status.

**Impact:** A student can call the endpoint with any module ID and receive 200 with `status: 'draft'` when they have no submission (including when not enrolled). Ambiguous semantics and minor information disclosure (no cross-user data leak).

---

## MINOR

### 4. grades POST 404 message referred to wrong resource (fixed)

**Status:** Previously returned "Submission not found" when the missing resource was the answer; this was corrected to "Answer not found". No remaining mismatch; listed for completeness.

---

### 5. instructor GET module 404 vs 403 semantics (fixed)

**Status:** `api/instructor/modules/[id].ts` was updated to return 404 only when the module does not exist and 403 when the instructor is not assigned. No remaining mismatch; listed for completeness.

---

### 6. Clean-db script comment is outdated

**Mismatch:** `scripts/clean-db-except-users.sql` comment says: "If your answer table is named 'answers' (not 'submission_answers'), replace 'submission_answers' with 'answers' in the TRUNCATE list below." The TRUNCATE list already uses `answers`. The comment implies the list might still say `submission_answers`.

**Where it appears:**  
- `scripts/clean-db-except-users.sql` (lines 4–5 vs lines 10–21).

**Impact:** Maintainers may think they need to edit the list when they do not, or may search for `submission_answers` and not find it.

---

### 7. artefacts.module_id never set on INSERT

**Mismatch:** `backend/schema.sql` defines `artefacts` with a `module_id` column. The insert in `api/artefacts/index.ts` only supplies `(id, question_id, filename, file_type, url, storage_key)` and never sets `module_id`.

**Where it appears:**  
- Schema: `backend/schema.sql` (artefacts table).  
- Backend: `api/artefacts/index.ts` INSERT statement.

**Impact:** `module_id` is always NULL for new artefacts. Any future query or constraint that assumes `artefacts.module_id` is set will be wrong. Current code derives module via `questions.module_id` (e.g. in artefact download), so behaviour works but the column is redundant and misleading.

---

### 8. submissions.graded_at column never used

**Mismatch:** `backend/schema.sql` defines `submissions.graded_at TIMESTAMP`. No API handler reads or writes this column. The submission_status enum is `draft | submitted | finalised` (no `graded` state).

**Where it appears:**  
- Schema: `backend/schema.sql` (submissions table).  
- Backend: no references in `api/` to `submissions.graded_at` or `graded_at` in submission context.

**Impact:** Dead column; no data corruption. Confusion if someone assumes "graded" is tracked on the submission row.

---

### 9. Artefact download variable naming (documented)

**Mismatch:** In `api/artefacts/[id]/download.ts`, the query selects `m.status` from the modules join; the result row is stored as `artefact`, and the code checks `artefact.status !== "published"` for students. That value is the **module** status, not an artefact property. The artefacts table has no `status` column.

**Where it appears:**  
- `api/artefacts/[id]/download.ts` (query and `artefact.status` check). A clarifying comment was added that `artefact.status` is module.status.

**Impact:** Maintainability only; behaviour is correct. Easy to misinterpret as "artefact status" in the future.

---

### 10. API vs DB naming (documented)

**Mismatch:** Public API for grades uses `submission_answer_id` and `score` in request/response; the database uses `answer_id` and `marks_awarded`. Mapping is done in the handler; comments in `api/grades/index.ts` and in the frontend describe the mapping.

**Where it appears:**  
- Request/response: `api/grades/index.ts`, `src/pages/instructor/InstructorSubmissionDetail.tsx`.  
- DB: `backend/schema.sql` (grades.answer_id, grades.marks_awarded).

**Impact:** No functional bug; risk of confusion when adding features or debugging across layers.

---

### 11. Cookie parsing inconsistency

**Mismatch:** Some handlers use `req.cookies?.session` (e.g. `api/modules/[id].ts`, `api/modules/index.ts`, `api/modules/[id]/ready.ts`, `api/modules/[id]/publish.ts`, `api/modules/[id]/archive.ts`, `api/student/modules/[id]/progress.ts`, `api/student/modules/[id]/questions/[questionId].ts`, `api/modules/[id]/instructor.ts`, `api/modules/[id]/enroll.ts`). Others use `parse(req.headers.cookie)` or equivalent.

**Where it appears:**  
- Multiple files under `api/` as above.

**Impact:** If `req.cookies` is not populated in some runtimes, routes using `req.cookies?.session` could 401 with a valid cookie while others succeed. Environment-dependent behaviour; no missing auth check.

---

## Summary: Why this system still works despite drift

- **Preferred routes are used consistently:** Main flows (student module/question view, instructor module/submissions/detail, grading and finalise) use the correct backend URLs via direct `fetch()`. Legacy URLs mount stub components that redirect or show a deprecation message and do not call deprecated APIs.
- **Auth and ownership are enforced on used routes:** Submissions, grades, finalise, answers, and instructor module/submission endpoints check session, role, enrollment, or assignment. Unused or legacy routes do not weaken security for the paths that are actually called.
- **Schema and code are aligned where it matters:** The live code uses the `answers` table and `grades.answer_id` / `grades.marks_awarded`; submission status is `draft` / `submitted` / `finalised` everywhere. Remaining drift (unused columns, script comment, status endpoint enrollment, naming) does not change the behaviour of the primary flows.
- **State machines are consistent:** Submission status transitions (draft → submitted → finalised) and module status (draft / published / archived) are enforced in the routes that perform updates. No code path uses a removed `graded` status.
- **Naming and documentation drift** (submission_answer_id vs answer_id, score vs marks_awarded, artefact vs module status variable, script comment) are clarity and maintainability issues rather than logic errors, so the system still behaves correctly for the supported flows.

---

**Related:** For verification that auth, roles, ownership, submission/grading/module lifecycles, and data integrity are implemented as intended, see [LOGIC_VERIFICATION_AUDIT_REPORT.md](./LOGIC_VERIFICATION_AUDIT_REPORT.md).
