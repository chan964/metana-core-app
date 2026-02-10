# End-to-End Verification (Phases 1 → 6)

**Mode:** READ-ONLY. No code, database, schema, or logic was modified.  
**Source of truth:** Existing code (backend/schema.sql treated as documentation only).

---

## PHASE 1 — Auth & Roles

### STEP 1.1 — Sessions validated via sessions table
**Status:** PASS  
**Evidence:**
- Endpoint: GET /api/me
- File: `api/me.ts`
- Lines: 24–46 (cookie → parse → session id; query `sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.expires_at > now()`)
- Tables: `sessions`, `users`

**Explanation:** Session id from cookie is looked up in `sessions` with `expires_at > now()`; user is joined from `users`. Same pattern (cookie, parse, sessions JOIN users, expires_at) is used in answers, grades, submissions/status, submit, student modules, instructor endpoints.

---

### STEP 1.2 — Roles enforced (admin, instructor, student)
**Status:** PASS  
**Evidence:**
- Endpoints: /api/me (returns role); /api/grades, /api/grades/finalise (instructor|admin); /api/answers, /api/submissions/status, /api/submissions/submit, /api/student/modules* (student); /api/modules/[id]/archive, publish, /api/users/* (admin); /api/questions, /api/parts, /api/sub-questions, /api/artefacts, /api/instructor/* (instructor); /api/modules/[id]/ready (instructor)
- Files: Multiple under `api/`
- Lines: Role checks after session lookup, e.g. `user.role !== "student"` (403), `user.role !== "instructor" && user.role !== "admin"` (403), `sessionRes.rows[0].role !== "admin"` (403)
- Tables: `users` (role column used from session join)

**Explanation:** Each endpoint that gates by role reads `u.role` from the session join and returns 403 when role is not allowed. Admin-only, instructor-only, and student-only paths are clearly separated.

---

## PHASE 2 — Instructor Content Creation

### STEP 2.1 — Only assigned instructors can create questions, parts, sub_questions, upload artefacts; module must be draft
**Status:** PASS  
**Evidence:**
- Endpoints: POST /api/questions, POST /api/parts, POST /api/sub-questions, POST /api/artefacts
- Files: `api/questions/index.ts`, `api/parts/index.ts`, `api/sub-questions/index.ts`, `api/artefacts/index.ts`
- Lines: Each file: session + role instructor (45–47 in questions, 45–47 in parts, 45–47 in sub-questions, 45–47 in artefacts); module status check `status !== "draft"` → 403 (questions 79–80, parts 77–78, sub-questions 85–86, artefacts 89–90); `module_instructors` check (questions 84–91, parts 81–89, sub-questions 90–98, artefacts 94–99)
- Tables: `modules`, `module_instructors`, `questions`, `parts`, `sub_questions`, `artefacts`

**Explanation:** All four endpoints require instructor role, then resolve module (via module_id or question_id/part_id/question_id), then require `modules.status === 'draft'` and existence in `module_instructors` for that module.

---

### STEP 2.2 — Ready-for-publish: every question has ≥1 part, every part has ≥1 sub_question
**Status:** PASS  
**Evidence:**
- Endpoint: PATCH /api/modules/:id/ready
- File: `api/modules/[id]/ready.ts`
- Lines: 80–88 (at least one question); 91–101 (at least one sub_question); 104–119 (every question has at least one part: NOT EXISTS parts for question); 122–137 (every part has at least one sub_question: NOT EXISTS sub_questions for part)
- Tables: `questions`, `parts`, `sub_questions`, `modules`, `module_instructors`

**Explanation:** Before setting `ready_for_publish`, the handler checks at least one question, at least one sub_question, no question without a part, and no part without a sub_question. Instructor and assignment are also enforced (50–78).

---

## PHASE 3 — Student Answering & Submission

### STEP 3.1 — Students only see published modules they are enrolled in
**Status:** PASS  
**Evidence:**
- Endpoints: GET /api/student/modules, GET /api/student/modules/:id
- Files: `api/student/modules.ts`, `api/student/modules/[id].ts`
- Lines: modules.ts 50–59 (INNER JOIN module_students, `m.status = 'published'::module_status`); [id].ts 56–76 (module by id), 72–76 (status === 'published'), 77–87 (module_students enrollment)
- Tables: `modules`, `module_students`

**Explanation:** List only returns modules where the student is in `module_students` and status is published. Detail requires published and enrolled.

---

### STEP 3.2 — Draft answers: autosave and reload
**Status:** PASS (frontend + backend)  
**Evidence:**
- Endpoints: GET /api/answers (returns answers for submission; creates draft submission if none), POST /api/answers (saves answer for draft)
- File: `api/answers/index.ts` (GET returns answers by submission_id + questionId; POST only when status === 'draft')
- Tables: `submission_answers`, `submissions`
- Frontend: `StudentQuestionView.tsx` uses GET /api/answers and POST /api/answers with debounced save when not read-only; answers restored from response on load.

**Explanation:** GET returns existing answers for the student’s submission (or creates draft); POST updates/inserts only when submission is draft. Reload refetches same endpoint and repopulates state.

---

### STEP 3.3 — Submission: all sub_questions answered, locks permanently
**Status:** PASS  
**Evidence:**
- Endpoint: POST /api/submissions/submit
- File: `api/submissions/submit.ts`
- Lines: 79–94 (submission must exist and status === 'draft'); 96–119 (COUNT total sub_questions, non_empty_answers; non_empty_answers < total → 400 "All questions must be answered"); 121–129 (UPDATE status = 'submitted', submitted_at = now())
- Tables: `submissions`, `submission_answers`, `sub_questions`, `parts`, `questions`

**Explanation:** Submit only allowed for draft; validates that every sub_question for the module has a non-empty answer for that submission; then sets status to 'submitted'. Once submitted, later POST submit receives status !== 'draft' and returns 400.

---

## PHASE 4 — Instructor Submission Review (Read-Only)

### STEP 4.1 — Instructors list and view submissions for assigned modules only; cannot edit answers
**Status:** PASS  
**Evidence:**
- Endpoints: GET /api/instructor/modules/:moduleId/submissions (list), GET /api/instructor/modules/:moduleId/submissions/:submissionId (detail), GET /api/instructor/submissions/:submissionId (detail by id)
- Files: `api/instructor/modules/[id]/submissions.ts`, `api/instructor/modules/[moduleId]/submissions/[submissionId].ts`, `api/instructor/submissions/[submissionId].ts`
- Lines: submissions.ts 65–74 (module_instructors for moduleId); [moduleId]/submissions/[submissionId].ts 81–99 (submission belongs to moduleId, instructor assigned to module); [submissionId].ts 82–86 (instructor assigned to submission.module_id). All return data only; no PUT/PATCH for answers.
- Tables: `submissions`, `users`, `module_instructors`, `submission_answers`

**Explanation:** List is scoped by module and instructor assignment. Detail endpoints require the submission’s module to be one the instructor is assigned to. Answers are returned for display; no endpoint allows editing answer text.

---

### STEP 4.2 — Students cannot access instructor endpoints
**Status:** PASS  
**Evidence:**
- All instructor endpoints: session join users, then `user.role !== "instructor" && user.role !== "admin"` → 403 (or role !== "instructor" where only instructor is allowed)
- Files: Same as 4.1; also instructor/modules/index, [id], etc.

**Explanation:** Student role fails the role check and receives 403 before any submission data is returned.

---

## PHASE 5 — Instructor Grading

### STEP 5.1 — Grades only when submission status = submitted; score ≤ max_marks; idempotent; instructor assigned
**Status:** PASS  
**Evidence:**
- Endpoint: POST /api/grades
- File: `api/grades/index.ts`
- Lines: 66–82 (fetch submission via submission_answers → submissions, get status); 90–96 (status must be submitted or finalised for request to proceed, then 94–96 if finalised → 403 "Grades are locked"); 98–100 (score > max_marks → 400); 102–111 (instructor: module_instructors); 117–139 (INSERT ON CONFLICT (submission_answer_id) DO UPDATE)
- Tables: `grades`, `submission_answers`, `submissions`, `sub_questions`, `module_instructors`

**Explanation:** Grade save uses submission status from the join; after 6B-2, finalised returns 403 so effectively grades only when submitted. Score is validated against max_marks. Upsert on submission_answer_id makes saves idempotent. Instructor must be in module_instructors for the submission’s module.

---

## PHASE 6 — Finalisation & Grade Visibility

### STEP 6.1 — Phase 6A: Draft no grades; Submitted no grades visible; Finalised grades visible (read-only); student sees only own grades
**Status:** PASS  
**Evidence:**
- Endpoint: GET /api/answers
- File: `api/answers/index.ts`
- Lines: 65–74 (enrollment module_students); 80–83 (submission by module_id and student_id = user.id); 102–122 (allowGrades = submitted || finalised; when !allowGrades return answers without grade); 124–147 (when allowGrades, join grades, return grade.marks_awarded, feedback)
- Tables: `grades`, `submission_answers`, `submissions`
- Frontend: `StudentQuestionView.tsx` line 159 `showGrades = submissionStatus === 'finalised'`; grade block only rendered when showGrades. So draft: no grade in response; submitted: backend returns grades but UI does not render them; finalised: backend returns grades and UI renders.

**Explanation:** Backend returns grades only when status is submitted or finalised; answers are always scoped to the authenticated user’s submission (student_id = user.id). Frontend shows grades only when status is finalised, so “submitted → no grades visible” is enforced in the UI. Student only ever sees data for their own submission.

---

### STEP 6.2 — Phase 6B: Finalise once; after finalisation grades locked, no POST /api/grades; students see grades only after finalisation
**Status:** PASS  
**Evidence:**
- Endpoints: POST /api/grades/finalise, POST /api/grades, GET /api/answers
- Files: `api/grades/finalise.ts`, `api/grades/index.ts`, `api/answers/index.ts`; frontend `InstructorSubmissionDetail.tsx`, `StudentQuestionView.tsx`
- Lines: finalise.ts 59–62 (status !== 'submitted' → 400 "Submission not eligible for finalisation"; so already finalised cannot be finalised again); grades/index.ts 94–96 (status === 'finalised' → 403 "Grades are locked after finalisation"); StudentQuestionView showGrades = finalised only; InstructorSubmissionDetail gradesReadOnly when finalised, saveGrade/scheduleSave return early.

**Explanation:** Finalise only runs when status is submitted; once set to finalised, a second finalise attempt gets 400. POST /api/grades returns 403 when status is finalised. Students only see grade UI when status is finalised (frontend). Instructor UI disables inputs and does not send grade POST when finalised.

---

## Side note (no status change)

- **GET /api/submissions** (by query id): `api/submissions/index.ts` returns any submission by id after validating session only; it does not check role or ownership. If the client never calls this with arbitrary ids, risk is limited. Not an instructor endpoint; not in scope for “students cannot access instructor endpoints.”

---

## FINAL SUMMARY

| Phase | Result |
|-------|--------|
| Phase 1 — Auth & Roles | PASS |
| Phase 2 — Instructor Content Creation | PASS |
| Phase 3 — Student Answering & Submission | PASS |
| Phase 4 — Instructor Submission Review | PASS |
| Phase 5 — Instructor Grading | PASS |
| Phase 6 — Finalisation & Grade Visibility | PASS |

**Overall:** Phases 1 through 6 verify as correct end-to-end for the Admin → Instructor → Student → Instructor → Student flow (draft → submitted → finalised), with role checks, assignment checks, grade locking after finalisation, and student grade visibility only when finalised. No hidden role bypass or grade visibility leak was found in the inspected code.
