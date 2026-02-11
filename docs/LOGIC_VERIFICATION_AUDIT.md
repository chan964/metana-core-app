# Logic Verification Audit Report

Companion to [MASTER_CONSISTENCY_AUDIT.md](./MASTER_CONSISTENCY_AUDIT.md). This report verifies that intended logic is correctly implemented in the audited paths.

---

## A. Authentication & session handling

**Session creation — Correct**  
`api/login.ts`: On valid email/password, inserts into sessions (id, user_id, expires_at = now + 7d), sets Set-Cookie: session=\<uuid\> (httpOnly, path=/, sameSite=strict, secure in prod, maxAge 7 days). No other sessions for the user are invalidated.

**Session validation — Correct**  
`api/me.ts`: Uses sessions s JOIN users u with s.expires_at > now(). Returns 401 if no cookie, no session value, or no valid row. Other protected handlers use the same pattern (session join users, expires_at > now()).

**Expiry handling — Correct**  
All session lookups use expires_at > now(). Expired sessions get 401.

**Logout behavior — Correct**  
`api/logout.ts`: Parses cookie, deletes sessions row when cookies.session exists, always clears session cookie and returns 200.

---

## B. Role enforcement

**Admin-only routes — Correct**  
`api/users/index.ts`, `api/users/[id].ts`: Session + role !== 'admin' → 403.  
`api/modules/index.ts`, `api/modules/[id]/instructor.ts`, `api/modules/[id]/enroll.ts`, `api/modules/[id]/publish.ts`, `api/modules/[id]/archive.ts`, `api/modules/[id].ts` (DELETE): session then explicit admin check; 403 otherwise.

**Instructor-only routes — Correct**  
`api/instructor/modules/index.ts`, `[id].ts`, `[id]/submissions.ts`, `[id]/submissions/[submissionId].ts`: Require user.role === 'instructor'.  
`api/modules/[id]/questions.ts`, `api/modules/[id]/ready.ts`: Same instructor check.

**Student-only routes — Correct**  
`api/student/modules.ts`, `[id].ts`, `[id]/progress.ts`, `[id]/questions/[questionId].ts`: Require user.role === 'student'.  
`api/answers/index.ts`, `api/submissions/status.ts`, `api/submissions/submit.ts`: Same student check.

**Mixed-role (admin + instructor) — Correct**  
`api/grades/index.ts`, `api/grades/finalise.ts`: Allow instructor or admin; instructors are checked against module_instructors; admins skip that.  
`api/instructor/submissions/[submissionId].ts`: Same pattern.

---

## C. Ownership enforcement

**Student accessing own submissions — Correct**  
`api/answers/index.ts`: Submission is always for (module_id, user.id); GET/POST use enrollment and that submission only.  
`api/submissions/status.ts`, `api/submissions/submit.ts`: Filter by module_id and user.id.  
`api/submissions/start.ts`: Non-admin must be student and studentId === user.id; students also require enrollment.  
`api/submissions/index.ts`: After loading submission, students allowed only if submission.student_id === user.id (lines 52–55).

**Instructor accessing only assigned modules — Correct**  
`api/instructor/modules/index.ts`, `[id].ts`: Use INNER JOIN module_instructors with instructor_id = user.id.  
`api/instructor/modules/[id]/submissions.ts`, `[id]/submissions/[submissionId].ts`: Check module_instructors for the module.  
`api/modules/[id].ts` GET (lines 67–75): If user.role === 'instructor', requires a row in module_instructors for (moduleId, user.id); otherwise 403.

**Admin override — Correct**  
Admins bypass module-assignment checks in grades, finalise, instructor submission detail, and submissions/index; behavior matches intent.

---

## D. Submission lifecycle

**Draft creation — Correct**  
`api/submissions/start.ts`: After role/ownership and (for students) enrollment, SELECT for existing (module_id, student_id); if found, return 200 with existing row; else INSERT and 201.  
`api/answers/index.ts` GET: Creates submission only when none exists for (module_id, user.id).

**Draft autosave — Correct**  
`api/answers/index.ts` POST: Loads submission for (module_id, user.id); if status !== 'draft' returns 403 "Cannot modify submitted answers"; otherwise INSERT/UPDATE with ON CONFLICT (submission_id, sub_question_id).

**Submit validation (all answers present) — Correct**  
`api/submissions/submit.ts`: Counts total sub_questions for module and non-empty answers for the submission; nonEmptyAnswers < totalSubQuestions → 400 "All questions must be answered before submission"; then UPDATE status to 'submitted', submitted_at = now().

**Post-submit immutability — Correct**  
`api/answers/index.ts` POST (lines 211–215): Rejects when submission status is not 'draft'.  
`api/submissions/submit.ts`: Rejects when status is not 'draft'.

**Finalisation — Correct**  
`api/grades/finalise.ts`: Requires status 'submitted'; instructor must be in module_instructors for that module (admin skips); then UPDATE status to 'finalised', finalised_at = now().

---

## E. Grading lifecycle

**When grades can be created — Correct**  
`api/grades/index.ts`: Submission must be 'submitted' or 'finalised' for the answer (lines 88–90); if 'finalised' returns 403 "Grades are locked after finalisation". So grading only when status is 'submitted'.

**Who can edit grades — Correct**  
`api/grades/index.ts`: Requires instructor or admin; instructors must be in module_instructors for the submission's module (lines 101–110); then INSERT/UPDATE grade on answer_id.

**When grades are locked — Correct**  
`api/grades/index.ts` (lines 93–95): If submission status is 'finalised', returns 403 "Grades are locked after finalisation".

**Visibility for students — Correct**  
`api/answers/index.ts` GET: allowGrades is true for status 'submitted' or 'finalised'; then LEFT JOIN grades and return marks_awarded/feedback. Submission is always the current user's; students only see grades for their own submission after submit.

---

## F. Module lifecycle

**Draft → ready → published → archived — Correct**  
`api/modules/[id]/ready.ts`: Instructor, assigned, module draft, content checks; sets ready_for_publish = true.  
`api/modules/[id]/publish.ts`: Admin, module draft, ready_for_publish true, at least one instructor; sets status 'published', published_at.  
`api/modules/[id]/archive.ts`: Admin, module status 'published'; sets status 'archived'.  
`api/modules/[id].ts` DELETE: Admin, module draft, no enrolled students; DELETE module.

**Who can transition — Correct**  
Ready: instructor (assigned). Publish/archive/delete: admin. All enforced in the API.

---

## G. Data integrity

**One submission per (student, module) — Correct**  
`backend/schema.sql`: submissions has UNIQUE (module_id, student_id).  
`api/submissions/start.ts`: SELECT before INSERT; if row exists, return it with 200.  
`api/answers/index.ts` GET: Creates submission only when none exists.

**One answer per (submission, sub_question) — Correct**  
`backend/schema.sql`: answers has UNIQUE (submission_id, sub_question_id).  
`api/answers/index.ts` POST: INSERT ... ON CONFLICT (submission_id, sub_question_id) DO UPDATE.

**One grade per answer — Correct**  
`api/grades/index.ts`: INSERT INTO grades ... ON CONFLICT (answer_id) DO UPDATE. Single grade row per answer.

**Enforcement — Correct**  
Uniqueness enforced in DB and in app logic (SELECT-before-INSERT for submissions, ON CONFLICT for answers and grades).

---

## H. Error behavior

**Invalid access — Partially correct**  
No/invalid session: 401 across handlers. Wrong role: 403.  
`api/submissions/index.ts`: 404 when no submission row; 403 when row exists but user is not admin, owner, or assigned instructor.  
`api/grades/index.ts`: 404 only when answer row is missing (lines 83–84); 403 for wrong submission status (lines 88–90), finalised (93–95), instructor not assigned (107–109), enrollment check (117–119). Semantics are consistent in these two files.

**Existence leakage — Partially correct**  
`api/submissions/index.ts`: 404 vs 403 still distinguishes "no submission" vs "submission exists but no access."  
`api/grades/index.ts`: 404 only for missing answer; 403 for all authorization/state failures, so existence of the answer is not disclosed by 403.

**401 vs 403 — Partially correct**  
401 is used for missing/invalid/expired session. 403 for role and resource authorization. Wording varies ("Unauthenticated", "Invalid session", "Session expired", "Forbidden", "Admin only", etc.); behavior is consistent.

**Cookie parsing — Partially correct**  
Some handlers use req.cookies?.session (e.g. api/modules/, api/student/modules/[id]/progress.ts, questions/[questionId].ts), others use parse(req.headers.cookie) (or cookieHeader). Behavior may depend on whether the runtime populates req.cookies; no logic bug, but inconsistent pattern.

---

## Critical logic risks (by severity)

**Cookie parsing inconsistency (low)**  
Nine API files use req.cookies?.session; the rest use parse(req.headers.cookie). If req.cookies is not set in some environments, those routes could 401 where others would succeed. No missing auth checks; only environment-dependent behavior.

**Finalisation without full grading (low, product rule)**  
`api/grades/finalise.ts` allows finalising when status is 'submitted' and does not require every answer to have a grade. If the intended rule is "all answers graded before finalise," that is not enforced.

**Sensitive logging (low)**  
`api/login.ts` and `api/me.ts` log email and cookie presence; should be disabled or redacted in production to avoid leaking credentials or session info.

---

**Conclusion:** No critical or high-severity logic flaws found in the audited paths; previous IDOR and instructor-module access issues are fixed in the current code.
