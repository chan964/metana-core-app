# Logic Verification Audit Report (Read-Only)

**Scope:** Verify that implemented logic enforces intended behavior across authentication, authorization, ownership, lifecycles, data integrity, and error handling. No code changes; findings only.

---

## A. Authentication & session handling

**Session creation**
- **Trace:** `api/login.ts`: Validates email/password via `users` and `bcrypt.compare`; inserts into `sessions` with `id`, `user_id`, `expires_at` (now + 7d); sets `Set-Cookie` with `session=<uuid>`, httpOnly, path=/, sameSite=strict, secure in prod, maxAge 7 days.
- **Intent:** Create session on valid credentials; single session per login; no invalidation of other sessions for the user.
- **Result:** ✅ **Correct.** Session row and cookie are created as intended; no logic to clear other sessions for the same user.

**Session validation**
- **Trace:** `api/me.ts` (lines 31–38): `sessions s JOIN users u`, `s.expires_at > now()`. Returns 401 if no cookie, no session value, or no matching row. Other protected handlers use the same pattern (session join users, `expires_at > now()`).
- **Intent:** Validate session via DB; reject expired or missing session with 401.
- **Result:** ✅ **Correct.** Session is validated against DB with expiry check; 401 on missing/invalid/expired.

**Expiry handling**
- **Trace:** All session lookups use `s.expires_at > now()` in the query (e.g. `api/me.ts` line 37, `api/submissions/start.ts` line 25, `api/grades/index.ts` lines 32–33).
- **Intent:** Expired sessions must not be accepted.
- **Result:** ✅ **Correct.** Expired sessions do not match the query and yield 401.

**Logout behavior**
- **Trace:** `api/logout.ts`: Parses cookie; if `cookies.session` exists, `DELETE FROM sessions WHERE id = $1`; always sets `Set-Cookie` to clear (expires: 0); returns 200.
- **Intent:** Invalidate server session when present and always clear client cookie.
- **Result:** ✅ **Correct.** Session row deleted when cookie present; cookie always cleared; 200 always.

---

## B. Role enforcement

**Admin-only routes**
- **Trace:** `api/users/index.ts` (lines 17–28): Session validated, then `adminRes.rows[0].role !== "admin"` → 403. `api/users/[id].ts`: Same pattern. `api/modules/index.ts` (lines 10–32): `sessionId = req.cookies?.session`, session join, `role !== "admin"` → 403. `api/modules/[id].ts` DELETE branch (lines 177–180): `user.role !== "admin"` → 403. `api/modules/[id]/publish.ts` (lines 51–53), `api/modules/[id]/archive.ts` (lines 49–51): role === "admin" required.
- **Intent:** Only admin can access user CRUD, module list, module delete, publish, archive.
- **Result:** ✅ **Correct.** All these routes explicitly check role === "admin" and return 403 otherwise.

**Instructor-only routes**
- **Trace:** `api/instructor/modules/index.ts`, `[id].ts`, `[id]/submissions.ts`, `[id]/submissions/[submissionId].ts`: After session validation, `user.role !== "instructor"` (and not admin for detail routes) → 403. `api/modules/[id]/questions.ts`, `api/modules/[id]/ready.ts`: `user.role !== "instructor"` → 403.
- **Intent:** Only instructors (and where applicable admin) can access instructor module and submission endpoints and ready.
- **Result:** ✅ **Correct.** Role check enforces instructor (with admin allowed on submission detail and grades).

**Student-only routes**
- **Trace:** `api/student/modules.ts`, `[id].ts`, `[id]/progress.ts`, `[id]/questions/[questionId].ts`: After session, `user.role !== "student"` → 403. `api/answers/index.ts` (line 41), `api/submissions/status.ts` (line 45), `api/submissions/submit.ts` (line 45): same check.
- **Intent:** Only students can access student module list, module detail, progress, question content, answers, submission status, submit.
- **Result:** ✅ **Correct.** All return 403 when role !== "student".

**Mixed-role (admin + instructor)**
- **Trace:** `api/grades/index.ts` (lines 42–45): `user.role !== "instructor" && user.role !== "admin"` → 403; then instructor path checks `module_instructors`; admin skips that. `api/grades/finalise.ts` (lines 39–41): same role check; instructor must be in `module_instructors` (lines 62–70); admin skips. `api/instructor/submissions/[submissionId].ts`: Same pattern (instructor or admin; instructor must be assigned).
- **Intent:** Grades and finalise allow admin or instructor; instructors must be assigned to the module.
- **Result:** ✅ **Correct.** Role allows both; instructor assignment checked only for instructor role.

---

## C. Ownership enforcement

**Student accessing own submissions**
- **Trace:** `api/answers/index.ts`: Submission is always derived from `(module_id, user.id)` via enrollment check and `submissions WHERE module_id = $1 AND student_id = $2` (lines 78–80, 198–201). GET/POST use that submission only. `api/submissions/status.ts`, `api/submissions/submit.ts`: Filter by `module_id` and `user.id` (lines 56–58, 79–81). `api/submissions/start.ts` (lines 41–44): Non-admin must be student and `studentId === user.id`; students also require enrollment (lines 46–54). `api/submissions/index.ts` (lines 50–55): After loading submission by id, students allowed only if `submission.student_id === user.id`.
- **Intent:** Students can only read/write their own submission data for modules they are enrolled in.
- **Result:** ✅ **Correct.** All paths tie submission to current user (and enrollment where required).

**Instructor accessing only assigned modules**
- **Trace:** `api/instructor/modules/index.ts`, `[id].ts`: Use INNER JOIN or explicit query on `module_instructors` with `instructor_id = user.id`. `api/instructor/modules/[id]/submissions.ts`, `[id]/submissions/[submissionId].ts`: Check `module_instructors` for the module (lines 69–77, 70–78). `api/modules/[id].ts` GET (lines 67–75): If `user.role === "instructor"`, requires row in `module_instructors` for `(moduleId, user.id)`; else 403.
- **Intent:** Instructors can only access modules they are assigned to.
- **Result:** ✅ **Correct.** Assignment checked via `module_instructors` on all instructor module/submission routes and shared GET module.

**Admin override**
- **Trace:** `api/submissions/index.ts`: Admin branch allows without ownership check (lines 50–51). `api/grades/index.ts`: Admin skips `module_instructors` check (lines 101–110). `api/grades/finalise.ts`: Admin skips assignment check (lines 62–70). Instructor submission detail: admin allowed without assignment check.
- **Intent:** Admins can access any submission and perform grading/finalise regardless of assignment.
- **Result:** ✅ **Correct.** Admin branches bypass module-assignment checks as intended.

---

## D. Submission lifecycle

**Draft creation**
- **Trace:** `api/submissions/start.ts`: After role/ownership (student must pass own `studentId` and be enrolled), SELECT submissions by `(module_id, student_id)`; if row exists return 200 with existing row; else INSERT with status `'draft'` and 201. `api/answers/index.ts` GET (lines 88–98): If no submission for `(module_id, user.id)`, INSERT new submission with status `'draft'`.
- **Intent:** One submission per (student, module); create only when none exists; return existing otherwise.
- **Result:** ✅ **Correct.** SELECT-before-INSERT and enrollment/ownership enforced. **Gap:** Concurrent GET answers for same module/student could both see no submission and both INSERT; second would hit DB UNIQUE violation (see G).

**Draft autosave**
- **Trace:** `api/answers/index.ts` POST (lines 196–228): Loads submission for `(module_id, user.id)`; if status !== `'draft'` returns 403 "Cannot modify submitted answers"; else INSERT into `answers` with ON CONFLICT `(submission_id, sub_question_id)` DO UPDATE.
- **Intent:** Only draft submissions can be updated; one row per (submission, sub_question).
- **Result:** ✅ **Correct.** Status check and ON CONFLICT enforce intent.

**Submit validation (all answers present)**
- **Trace:** `api/submissions/submit.ts` (lines 95–117): Counts total sub_questions for module and non-empty answers (answer_text IS NOT NULL AND TRIM != '') for the submission; `nonEmptyAnswers < totalSubQuestions` → 400 "All questions must be answered before submission"; then UPDATE status to `'submitted'`, submitted_at = now().
- **Intent:** Submit only when every sub-question has a non-empty answer.
- **Result:** ✅ **Correct.** Validation and transition implemented as described.

**Post-submit immutability**
- **Trace:** `api/answers/index.ts` POST (lines 212–215): If submission status !== `'draft'`, returns 403 "Cannot modify submitted answers". `api/submissions/submit.ts` (lines 91–94): If status !== `'draft'`, returns 400 "Submission already submitted".
- **Intent:** No further changes to answers or submission state after submit.
- **Result:** ✅ **Correct.** Both paths reject modifications when not draft.

**Finalisation**
- **Trace:** `api/grades/finalise.ts`: Requires `submission.status === 'submitted'` (lines 58–60); instructor must be in `module_instructors` (admin skips); UPDATE submissions SET status = `'finalised'`, finalised_at = now().
- **Intent:** Only submitted submissions can be finalised; only assigned instructor or admin.
- **Result:** ✅ **Correct.** Status and role/assignment enforced.

---

## E. Grading lifecycle

**When grades can be created**
- **Trace:** `api/grades/index.ts` (lines 89–95): Submission must be `'submitted'` or `'finalised'` for the answer; if `'finalised'` returns 403 "Grades are locked after finalisation". So effective rule: grading only when status is `'submitted'`.
- **Intent:** Allow grading only for submitted (not finalised) submissions.
- **Result:** ✅ **Correct.** Logic matches intent.

**Who can edit grades**
- **Trace:** `api/grades/index.ts`: Requires instructor or admin (lines 42–45); instructors must be in `module_instructors` for the submission’s module (lines 101–110); then INSERT/UPDATE grade on `answer_id` with ON CONFLICT.
- **Intent:** Only assigned instructor or admin can create/update grades.
- **Result:** ✅ **Correct.** Role and assignment enforced.

**When grades are locked**
- **Trace:** `api/grades/index.ts` (lines 93–95): If submission status === `'finalised'`, returns 403 "Grades are locked after finalisation".
- **Intent:** No grade changes after finalisation.
- **Result:** ✅ **Correct.** Finalised submissions reject grade updates.

**Visibility rules for students**
- **Trace:** `api/answers/index.ts` GET (lines 101–104): `allowGrades` is true when status is `'submitted'` or `'finalised'`; then LEFT JOIN grades and return `marks_awarded`/feedback. Submission is always for current user (enrollment + submission by user.id).
- **Intent:** Students see grades only for their own submission and only when submitted or finalised.
- **Result:** ✅ **Correct.** Enrollment and submission ownership ensure students only see their own; grades exposed only when allowGrades is true.

---

## F. Module lifecycle

**Draft → ready → published → archived**
- **Trace:** `api/modules/[id]/ready.ts`: Instructor, assigned, module draft; content checks (question, sub-question, parts); sets `ready_for_publish = true`. `api/modules/[id]/publish.ts`: Admin, module draft, `ready_for_publish` true, at least one instructor; sets status `'published'`, published_at. `api/modules/[id]/archive.ts`: Admin, module status `'published'`; sets status `'archived'`. `api/modules/[id].ts` DELETE: Admin, module draft, no enrolled students; DELETE module.
- **Intent:** Ready: instructor (assigned). Publish/archive/delete: admin. Transitions from correct states only.
- **Result:** ✅ **Correct.** State transitions and role checks implemented in API.

**Who can transition each state**
- **Trace:** Ready: `user.role === "instructor"` and assigned (ready.ts lines 49–76). Publish: `user.role === "admin"` (publish.ts 51–53). Archive: `user.role === "admin"` (archive.ts 49–51). Delete: `user.role === "admin"` ([id].ts 177–180).
- **Intent:** Enforcement in API, not only frontend.
- **Result:** ✅ **Correct.** All enforced in the handlers.

---

## G. Data integrity

**One submission per (student, module)**
- **Trace:** `backend/schema.sql`: `submissions` has UNIQUE (module_id, student_id). `api/submissions/start.ts`: SELECT before INSERT; if row exists return it with 200. `api/answers/index.ts` GET: Creates submission only when none exists (lines 88–98).
- **Intent:** At most one submission per (student, module); app avoids duplicate inserts where possible.
- **Result:** ✅ **Correct.** DB constraint plus SELECT-before-INSERT. **Gap:** In `api/answers/index.ts` GET, two concurrent requests with no existing submission can both pass the SELECT and both INSERT; one will succeed, one will hit UNIQUE violation and surface as 500 unless caught. Same race exists if submission is created in GET and in start.ts for the same (module, student) concurrently.

**One answer per (submission, sub_question)**
- **Trace:** `backend/schema.sql`: `answers` has UNIQUE (submission_id, sub_question_id). `api/answers/index.ts` POST: INSERT ... ON CONFLICT (submission_id, sub_question_id) DO UPDATE.
- **Intent:** At most one answer per (submission, sub_question); upsert by conflict.
- **Result:** ✅ **Correct.** Constraint and ON CONFLICT enforce single row per pair.

**One grade per answer**
- **Trace:** `backend/schema.sql`: `grades` has UNIQUE (answer_id). `api/grades/index.ts`: INSERT ... ON CONFLICT (answer_id) DO UPDATE.
- **Intent:** At most one grade per answer; upsert by conflict.
- **Result:** ✅ **Correct.** Constraint and ON CONFLICT enforce single grade per answer.

**Enforcement points and gaps**
- **Trace:** Uniqueness enforced in DB and in app (SELECT-before-INSERT for submissions, ON CONFLICT for answers and grades). No application-level locking or serialization around submission creation in answers GET vs start.ts.
- **Result:** ⚠️ **Partially correct.** Normal flows are correct. Concurrent submission creation (e.g. two answers GET or one start + one answers GET) can cause one request to hit UNIQUE violation and return 500 instead of a graceful retry or 200 with existing submission.

---

## H. Error behavior

**Invalid access**
- **Trace:** No/invalid session: 401 across handlers (e.g. me.ts, submissions/start, grades/index). Wrong role: 403 (e.g. submissions/status line 45, grades/index 43–45). `api/submissions/index.ts`: 404 when no submission row (line 45); 403 when row exists but user is not admin, owner, or assigned instructor (52–66). `api/grades/index.ts`: 404 only when answer row missing (84–85); 403 for wrong submission status, finalised, instructor not assigned, enrollment (89–119).
- **Intent:** 401 for auth; 403 for role/resource authorization; 404 for missing resource where appropriate.
- **Result:** ✅ **Correct.** Semantics consistent in the audited handlers: 404 for missing resource, 403 for no access when resource exists.

**Existence leakage**
- **Trace:** `api/submissions/index.ts`: 404 when no row; 403 when row exists but no access — so 404 vs 403 distinguishes “no submission” vs “exists but forbidden”. `api/grades/index.ts`: 404 only for missing answer; 403 for all authorization/state failures — so 403 does not reveal that the answer exists.
- **Intent:** Avoid leaking existence of resources via 403 when the resource is missing.
- **Result:** ✅ **Correct.** In these handlers, 404 is used for missing resource; 403 for no permission.

**Inconsistent 401 vs 403 behavior**
- **Trace:** 401 used for missing/invalid/expired session (me.ts "Unauthenticated", "Session expired"; others "Unauthenticated"). 403 for role and resource authorization ("Forbidden", "Admin only", "Not assigned to this module", etc.). Wording varies; behavior is consistent (401 = auth, 403 = authorized but not allowed).
- **Result:** ✅ **Correct.** No logic bugs from 401 vs 403; wording variation only.

**Cookie parsing**
- **Trace:** Some handlers use `req.cookies?.session` (e.g. `api/modules/[id].ts` line 23, `api/modules/index.ts` 10, `api/modules/[id]/ready.ts` 32, `api/modules/[id]/publish.ts` 32, `api/modules/[id]/archive.ts` 31, `api/student/modules/[id]/progress.ts` 25, `api/student/modules/[id]/questions/[questionId].ts` 28, `api/modules/[id]/instructor.ts` 22, `api/modules/[id]/enroll.ts` 25). Others use `parse(req.headers.cookie)` or `cookieHeader` (e.g. me.ts, login, grades, answers, submissions/*, instructor modules with parse).
- **Intent:** Read session from cookie in all environments.
- **Result:** ⚠️ **Partially correct.** If `req.cookies` is not populated by the runtime (e.g. in some Vercel/serverless contexts), routes using `req.cookies?.session` would get 401 even with a valid cookie, while routes using `parse(req.headers.cookie)` would succeed. No missing auth check; behavior may be environment-dependent.

**Submission status enrollment**
- **Trace:** `api/submissions/status.ts`: Returns status for (moduleId, user.id) without checking `module_students`. If no submission row, returns 200 `{ status: 'draft' }` for any moduleId.
- **Intent:** (Not specified in audit; previously discussed as possible gap.)
- **Result:** ⚠️ **Partially correct.** Students can call status for any moduleId; response does not distinguish “not enrolled” from “enrolled, no submission”. No leakage of other users’ data; only ambiguity of meaning.

---

## Critical logic risks (by severity)

1. **Cookie parsing inconsistency (low)**  
   Nine API files use `req.cookies?.session`; the rest use `parse(req.headers.cookie)`. If `req.cookies` is unset in some environments, those routes could 401 with a valid cookie. No missing auth; possible environment-dependent behavior.

2. **Concurrent submission creation (low)**  
   `api/answers/index.ts` GET and `api/submissions/start.ts` can both create a submission for the same (module, student). Under concurrency, one request may hit UNIQUE violation and return 500. No data corruption; DB constraint holds; UX/error handling gap.

3. **Finalisation without full grading (low, product rule)**  
   `api/grades/finalise.ts` allows finalising when status is `'submitted'` and does not require every answer to have a grade. If the intended rule is “all answers graded before finalise”, it is not enforced.

4. **Submissions/status does not enforce enrollment (low)**  
   `api/submissions/status.ts` returns 200 `{ status: 'draft' }` for any moduleId when the student has no submission, without checking `module_students`. Ambiguous meaning; no cross-user data leak.

5. **Sensitive logging (low)**  
   `api/login.ts` and `api/me.ts` log email and cookie presence; should be disabled or redacted in production to avoid leaking credentials or session info.

---

**Conclusion:** No critical or high-severity logic flaws found in the audited paths. Authentication, role and ownership enforcement, submission and grading lifecycles, module state transitions, and data integrity (with the noted race and cookie-parsing caveats) match the intended behavior. Remaining items are low-severity or product-rule clarifications.
