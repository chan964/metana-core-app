# Manual Testing Guide — Metana Core App

This document is a **detailed summary for manual testing** in the correct order. For each stage it lists: **which user** to use, **what to do in the UI**, **which API endpoints** are hit, and **which database tables/columns** are used. No code changes—analysis only.

---

## Database schema reference (quick reference)

| Table | Key columns |
|-------|-------------|
| **users** | id, email, full_name, role, password_hash, created_at |
| **sessions** | id, user_id, expires_at, created_at |
| **modules** | id, title, description, status, ready_for_publish, published_at, submission_start, submission_end, created_at |
| **module_instructors** | module_id, instructor_id, assigned_at |
| **module_students** | module_id, student_id, enrolled_at |
| **questions** | id, module_id, title, scenario_text, order_index, created_at |
| **parts** | id, question_id, label, created_at |
| **sub_questions** | id, part_id, prompt, max_marks, order_index, created_at |
| **submissions** | id, module_id, student_id, status, created_at, submitted_at, graded_at, finalised_at |
| **answers** | id, submission_id, sub_question_id, answer_text, created_at, updated_at |
| **artefacts** | id, module_id, question_id, filename, file_type, url, storage_key, uploaded_by, created_at |
| **grades** | id, answer_id, instructor_id, marks_awarded, feedback, graded_at |

**Enums:** `role` (admin, instructor, student), `submission_status` (draft, submitted, finalised), `module_status` (draft, published, archived).

---

## Recommended test order (high level)

1. **Auth** — Login as each role; confirm session and redirect.
2. **Admin: Users** — Create admin, instructor, student users.
3. **Admin: Modules** — Create module, assign instructor, enroll student.
4. **Instructor: Content** — Add questions, parts, sub-questions, optionally artefacts; mark ready.
5. **Admin: Publish** — Publish module.
6. **Student: Module & answers** — View module, start submission, answer questions, submit.
7. **Instructor: Grading** — View submissions, grade answers, finalise.
8. **Student: View grades** — See marks/feedback after finalisation.
9. **Admin: Archive** — Archive module (optional).

---

## Stage 1 — Authentication

**Goal:** Verify login, session, and role-based redirect.

### 1.1 Login (any user)

| Item | Detail |
|------|--------|
| **User** | Any (e.g. admin, instructor, student — create via DB or later via Admin UI). |
| **UI** | Go to `/login`, enter email + password, submit. |
| **API** | `POST /api/login` |
| **Body** | `{ "email", "password" }` |
| **DB read** | **users**: `id`, `password_hash` WHERE `email = $1` |
| **DB write** | **sessions**: `INSERT (id, user_id, expires_at)` |
| **Response** | 200 + `Set-Cookie: session=<uuid>` |

### 1.2 Get current user (session check)

| Item | Detail |
|------|--------|
| **Trigger** | After login, app calls `/api/me` (e.g. from `useAuth`). |
| **API** | `GET /api/me` (cookie: `session`) |
| **DB read** | **sessions** JOIN **users**: `u.id, u.email, u.full_name, u.role, u.created_at` WHERE `s.id = $1` AND `s.expires_at > now()` |
| **Response** | 200 + user object, or 401 if no/expired session. |

### 1.3 Logout

| Item | Detail |
|------|--------|
| **UI** | Logout action in header/nav. |
| **API** | `POST /api/logout` (cookie: `session`) |
| **DB write** | **sessions**: `DELETE FROM sessions WHERE id = $1` |
| **Response** | 200 + clear session cookie. |

**Check:** After login you are redirected to `/admin`, `/instructor`, or `/student` by role. After logout, `/api/me` returns 401.

---

## Stage 2 — Admin: User management

**Goal:** Create users so you can test instructor and student flows. Use an existing admin or one created in DB.

### 2.1 List users

| Item | Detail |
|------|--------|
| **User** | Admin. |
| **UI** | Admin Dashboard → Users tab. |
| **API** | `GET /api/users` or `GET /api/users?role=student` (etc.) |
| **Auth** | **sessions** + **users**: check `u.role = 'admin'`. |
| **DB read** | **users**: `id, email, full_name, role, created_at` ORDER BY created_at DESC (optional filter by role). |
| **Response** | `{ success: true, data: [...] }` |

### 2.2 Create user

| Item | Detail |
|------|--------|
| **UI** | Admin → Users → Create user (email, name, role, password). |
| **API** | `POST /api/users` |
| **Body** | `{ "email", "name", "role", "password" }` — role: admin | instructor | student |
| **Auth** | Same as 2.1 (admin). |
| **DB write** | **users**: `INSERT (id, email, full_name, role, password_hash)` — bcrypt hash for password. |
| **Response** | 201 + created user (no password_hash). |

### 2.3 Get / update / delete user (optional)

| Item | Detail |
|------|--------|
| **APIs** | `GET /api/users/[id]`, `PATCH /api/users/[id]`, `DELETE /api/users/[id]` |
| **DB** | **users**: SELECT by id; PATCH updates email, full_name, role, password_hash; DELETE by id. Auth: admin only via sessions + users. |

**Check:** Create at least one **instructor** and one **student** for the next stages.

---

## Stage 3 — Admin: Module setup (create, assign instructor, enroll student)

**Goal:** One draft module with one instructor and one student.

### 3.1 List modules (admin)

| Item | Detail |
|------|--------|
| **User** | Admin. |
| **UI** | Admin Dashboard → Modules tab. |
| **API** | `GET /api/modules` |
| **Auth** | **sessions** + **users**: role = admin. |
| **DB read** | **modules** LEFT JOIN **module_instructors** + **users**, LEFT JOIN **module_students** + **users** — aggregate instructors and students per module. Columns: m.id, title, description, status, ready_for_publish, created_at, submission_start, submission_end, instructors[], students[]. |
| **Response** | `{ data: [...] }` |

### 3.2 Create module

| Item | Detail |
|------|--------|
| **UI** | Admin → Modules → Create module (title, optional description). |
| **API** | `POST /api/modules` |
| **Body** | `{ "title", "description" }` |
| **Auth** | Admin (sessions + users). |
| **DB write** | **modules**: `INSERT (title, description, status)` with status `'draft'`. |
| **Response** | 201 + module row (id, title, description, status, created_at, submission_start, submission_end). |

### 3.3 Assign instructor to module

| Item | Detail |
|------|--------|
| **UI** | Admin → Modules → Select module → Assign instructor (choose user with role instructor). |
| **API** | `POST /api/modules/[id]/instructor` |
| **Body** | `{ "instructorId" }` (UUID of instructor user). |
| **Auth** | Admin. |
| **DB read** | **module_instructors**: check not already assigned. |
| **DB write** | **module_instructors**: `INSERT (module_id, instructor_id)`. Then SELECT module with instructors/students (same as 3.1 for one module). |
| **Response** | 200 + updated module. |

### 3.4 Enroll student in module

| Item | Detail |
|------|--------|
| **UI** | Admin → Modules → Select module → Enroll student (choose student user). |
| **API** | `POST /api/modules/[id]/enroll` |
| **Body** | `{ "studentId" }` |
| **Auth** | Admin. |
| **DB read** | **module_students**: check not already enrolled. |
| **DB write** | **module_students**: `INSERT (module_id, student_id)`. Then SELECT module with instructors/students. |
| **Response** | 200 + updated module. |

**Check:** Module is draft, has one instructor and one student. Do **not** publish yet.

---

## Stage 4 — Instructor: Module content (questions, parts, sub-questions, artefacts)

**Goal:** Add at least one question with one part and one sub-question so the student has something to answer. Optionally add artefacts.

**User:** Instructor (the one assigned in 3.3).  
**UI base:** Instructor Dashboard → click module → Module Editor (`/instructor/modules/[moduleId]`).

### 4.1 Instructor: List assigned modules

| Item | Detail |
|------|--------|
| **UI** | `/instructor` — Instructor Dashboard. |
| **API** | `GET /api/instructor/modules` |
| **Auth** | **sessions** + **users**: role = instructor. |
| **DB read** | **modules** INNER JOIN **module_instructors** ON instructor_id = current user; LEFT JOIN module_instructors, users, module_students, users, **submissions** — module list with instructors[], students[], and counts: draft_count, submitted_count, finalised_count. |
| **Response** | `{ data: [ { module, submissionCounts } ] }` |

### 4.2 Instructor: Open module editor (get module + questions)

| Item | Detail |
|------|--------|
| **UI** | Click module → Module Editor. |
| **APIs** | `GET /api/instructor/modules/[moduleId]` (module + counts); `GET /api/modules/[moduleId]/questions` (questions with sub_questions, artefacts). |
| **Auth** | Instructor; **module_instructors** must have this instructor for moduleId. |
| **DB read (modules [id])** | **modules** + **module_instructors** + **users** + **module_students** + **submissions** (counts). **modules/[id]/questions**: **questions** WHERE module_id; for each question: **sub_questions** (via **parts**), **artefacts**. |
| **Response** | Module detail + list of questions with parts/sub_questions/artefacts. |

### 4.3 Create question

| Item | Detail |
|------|--------|
| **UI** | Module Editor → Add question (title, scenario text). |
| **API** | `POST /api/questions` |
| **Body** | `{ "module_id", "title", "scenario_text", "order_index" }` |
| **Auth** | Instructor; module must be draft; instructor assigned. |
| **DB read** | **modules** (status), **module_instructors** (assignment), **questions** (MAX(order_index)). |
| **DB write** | **questions**: `INSERT (id, module_id, title, scenario_text, order_index)`. |
| **Response** | 200 + question row. |

### 4.4 Create part (A or B)

| Item | Detail |
|------|--------|
| **UI** | Question editor → Add part (label A or B). |
| **API** | `POST /api/parts` |
| **Body** | `{ "question_id", "label" }` — label 'A' or 'B'. |
| **Auth** | Instructor; module draft; assigned. |
| **DB read** | **questions** (module_id), **modules** (status), **module_instructors**. |
| **DB write** | **parts**: `INSERT (id, question_id, label)` (or ON CONFLICT update). |
| **Response** | 200 + part row. |

### 4.5 Create sub-question

| Item | Detail |
|------|--------|
| **UI** | Question editor → Add sub-question (prompt, max_marks, order_index). |
| **API** | `POST /api/sub-questions` |
| **Body** | `{ "part_id", "prompt", "max_marks", "order_index" }` |
| **Auth** | Instructor; module draft; assigned. |
| **DB read** | **parts** → **questions** (module_id), **modules**, **module_instructors**, **sub_questions** (MAX order_index). |
| **DB write** | **sub_questions**: `INSERT (id, part_id, prompt, max_marks, order_index)`. |
| **Response** | 200 + sub_question row. |

### 4.6 (Optional) Add artefact

| Item | Detail |
|------|--------|
| **UI** | Question editor → Upload/link artefact (filename, file_type, url, storage_key). |
| **API** | `POST /api/artefacts` |
| **Body** | `{ "question_id", "filename", "file_type", "url", "storage_key" }` |
| **Auth** | Instructor; module draft; assigned. |
| **DB read** | **questions** (module_id), **modules** (status), **module_instructors**. |
| **DB write** | **artefacts**: `INSERT (id, question_id, filename, file_type, url, storage_key)`. (uploaded_by exists in schema but may not be set in API.) |
| **Response** | 200 + artefact row. |

### 4.7 Update / delete question (optional)

| Item | Detail |
|------|--------|
| **APIs** | `PATCH` or `PUT /api/questions/[id]` (title, scenario_text); `DELETE /api/questions/[id]`. |
| **DB** | **questions** (and module status, instructor assignment). UPDATE questions; DELETE cascades: **sub_questions** (via parts), **parts**, **artefacts**, **questions**. |

### 4.8 Mark module ready for publish

| Item | Detail |
|------|--------|
| **UI** | Module Editor → “Mark as ready for publish” (or equivalent). |
| **API** | `PATCH /api/modules/[id]/ready` |
| **Auth** | Instructor; module draft; assigned. |
| **DB read** | **modules** (status, ready_for_publish), **module_instructors**, **questions** (at least one), **sub_questions** (via parts), **parts** (all questions have parts, all parts have sub_questions). |
| **DB write** | **modules**: `UPDATE ready_for_publish = true`. |
| **Response** | 200 + module. |

**Check:** Module is still draft but `ready_for_publish = true`, and has at least one question with at least one part and one sub-question.

---

## Stage 5 — Admin: Publish module

**Goal:** Make the module visible and submittable for students.

| Item | Detail |
|------|--------|
| **User** | Admin. |
| **UI** | Admin → Modules → Select module → Publish. |
| **API** | `PATCH /api/modules/[id]/publish` |
| **Auth** | **sessions** + **users**: role = admin. |
| **DB read** | **modules**: status, ready_for_publish; **module_instructors**: at least one instructor. |
| **DB write** | **modules**: `UPDATE status = 'published', published_at = now()`. |
| **Response** | 200 + module. |

**Check:** Module status = published. Student can now see it under “My modules” and open it.

---

## Stage 6 — Student: View module, start submission, answer questions, submit

**User:** Student (enrolled in 3.4).  
**Goal:** Open module, get/create draft submission, fill all sub-questions, submit.

### 6.1 List my modules (student)

| Item | Detail |
|------|--------|
| **UI** | `/student` or `/student/modules`. |
| **API** | `GET /api/student/modules` |
| **Auth** | **sessions** + **users**: role = student. |
| **DB read** | **modules** INNER JOIN **module_students** ON student_id = current user WHERE m.status = 'published'. Columns: m.id, title, status, created_at. |
| **Response** | Array of modules. |

### 6.2 Get progress for a module (optional, used on list)

| Item | Detail |
|------|--------|
| **API** | `GET /api/student/modules/[id]/progress` |
| **Auth** | Student; **module_students** must have this student. |
| **DB read** | **module_students**; **sub_questions** (via parts, questions) — COUNT total; **submissions** (module_id, student_id); **answers** — COUNT where answer_text non-empty for that submission. |
| **Response** | `{ total, answered, percentage }`. |

### 6.3 Open module detail (student)

| Item | Detail |
|------|--------|
| **UI** | Click module → `/student/modules/[moduleId]`. |
| **API** | `GET /api/student/modules/[id]` |
| **Auth** | Student; module status = published; **module_students** enrollment. |
| **DB read** | **modules** (id, title, description, status), **questions** (id, title, scenario_text, order_index) for module. |
| **Response** | Module + questions list. |

### 6.4 Get submission status

| Item | Detail |
|------|--------|
| **API** | `GET /api/submissions/status?moduleId=...` |
| **Auth** | Student. |
| **DB read** | **submissions**: status WHERE module_id, student_id. |
| **Response** | `{ status: 'draft' | 'submitted' | 'finalised' }` or default 'draft' if no row. |

### 6.5 Start submission (get or create draft)

| Item | Detail |
|------|--------|
| **Trigger** | When student opens a question page or first saves an answer; may call start explicitly depending on frontend. |
| **API** | `POST /api/submissions/start` |
| **Body** | `{ "moduleId", "studentId" }` — student can only use own id. |
| **Auth** | Admin or student (own studentId); if student, **module_students** enrollment. |
| **DB read** | **submissions**: existing row for (module_id, student_id). |
| **DB write** | If no row: **submissions**: `INSERT (id, module_id, student_id, status)` with status 'draft'. |
| **Response** | 200/201 + submission. |

### 6.6 Open a question (student) — question + parts + sub-questions + artefacts

| Item | Detail |
|------|--------|
| **UI** | From module view, click a question → `/student/modules/[moduleId]/questions/[questionId]`. |
| **API** | `GET /api/student/modules/[id]/questions/[questionId]` |
| **Auth** | Student; module published; **module_students** enrollment. |
| **DB read** | **modules** (status), **module_students**, **questions**, **parts** + **sub_questions** (json_agg), **artefacts** (id, filename, file_type). |
| **Response** | Question + parts (with sub_questions) + artefacts. |

### 6.7 Get answers for a question (student)

| Item | Detail |
|------|--------|
| **API** | `GET /api/answers?questionId=...` |
| **Auth** | Student; enrolled in module (via question → module_id). |
| **DB read** | **questions** (module_id), **module_students**, **submissions** (get or create draft), **answers** JOIN sub_questions/parts/questions for that question. If submission is submitted/finalised, also **grades** (marks_awarded, feedback). |
| **Response** | `{ answers: [...] }` (and grades if submitted/finalised). |

### 6.8 Save answer (student)

| Item | Detail |
|------|--------|
| **UI** | Student question view → type answer → save. |
| **API** | `POST /api/answers` |
| **Body** | `{ "sub_question_id", "answer_text" }` |
| **Auth** | Student; enrolled; submission must be draft. |
| **DB read** | **sub_questions** → **questions** (module_id), **module_students**, **submissions** (get or create draft). |
| **DB write** | **answers**: `INSERT ... ON CONFLICT (submission_id, sub_question_id) DO UPDATE answer_text, updated_at`. May create **submissions** row if first answer. |
| **Response** | 200. |

### 6.9 Submit module (student)

| Item | Detail |
|------|--------|
| **UI** | Module view → Submit (only when all sub-questions have non-empty answers). |
| **API** | `POST /api/submissions/submit` |
| **Body** | `{ "moduleId" }` |
| **Auth** | Student; module published; enrolled. |
| **DB read** | **modules** (status), **module_students**, **submissions** (id, status); **sub_questions** + **answers** — validation: COUNT non-empty answers = COUNT sub_questions for module. |
| **DB write** | **submissions**: `UPDATE status = 'submitted', submitted_at = now()` WHERE id. |
| **Response** | 200. |

**Check:** Submission status becomes 'submitted'. Instructor can see it in submissions list.

---

## Stage 7 — Instructor: Grading and finalise

**User:** Instructor (assigned to the module).  
**Goal:** Open submission, grade each answer, then finalise so grades are locked.

### 7.1 List submissions for module

| Item | Detail |
|------|--------|
| **UI** | Instructor → Module → Submissions (`/instructor/modules/[moduleId]/submissions`). |
| **API** | `GET /api/instructor/modules/[id]/submissions` |
| **Auth** | Instructor; **module_instructors** assignment. |
| **DB read** | **modules**, **module_instructors**, **submissions** JOIN **users** (student) WHERE module_id AND status IN ('submitted','finalised'). Columns: submission_id, student_id, student_name, status, submitted_at. |
| **Response** | Array of submissions. |

### 7.2 Get submission detail (for grading view)

| Item | Detail |
|------|--------|
| **UI** | Click a submission → `/instructor/modules/[moduleId]/submissions/[submissionId]`. |
| **API** | `GET /api/instructor/modules/[id]/submissions/[submissionId]` |
| **Auth** | Instructor (or admin); **module_instructors**; submission belongs to module; status submitted/finalised; **module_students** enrollment. |
| **DB read** | **modules**, **module_instructors**, **submissions** + **users** (student_name), **questions**, **parts**, **sub_questions**, **artefacts**, **answers** (sub_question_id, answer_text). |
| **Response** | submission_id, module_id, module_title, student_id, student_name, status, submitted_at, questions (with parts, sub_questions, answers, artefacts). |

### 7.3 Grade an answer (save mark + feedback)

| Item | Detail |
|------|--------|
| **UI** | Submission detail → enter score and feedback per answer → save. |
| **API** | `POST /api/grades` |
| **Body** | `{ "submission_answer_id", "score", "feedback" }` — submission_answer_id is **answers.id**. |
| **Auth** | Instructor or admin; instructor must be in **module_instructors**; submission status submitted or finalised (but not finalised for writing — see below). |
| **DB read** | **answers** JOIN **submissions**, **sub_questions** (max_marks); **module_instructors**; **module_students**. |
| **DB write** | **grades**: `INSERT (id, answer_id, marks_awarded, feedback) ON CONFLICT (answer_id) DO UPDATE`. (instructor_id in schema may not be set by API.) |
| **Response** | 200 + grade (id, submission_answer_id, score, feedback). |

**Note:** API rejects grading if submission is already 'finalised' (grades locked).

### 7.4 Finalise submission

| Item | Detail |
|------|--------|
| **UI** | Submission detail → “Finalise” (or equivalent). |
| **API** | `POST /api/grades/finalise` |
| **Body** | `{ "submission_id" }` |
| **Auth** | Instructor or admin; **module_instructors** for submission’s module. |
| **DB read** | **submissions** (id, module_id, status); **module_instructors**. |
| **DB write** | **submissions**: `UPDATE status = 'finalised', finalised_at = now()`. |
| **Response** | 200. |

**Check:** Submission status = finalised. No more grade changes. Student can see grades (via GET /api/answers with grades).

---

## Stage 8 — Student: View grades (after finalisation)

| Item | Detail |
|------|--------|
| **UI** | Student → My modules → same module → open question(s). |
| **API** | `GET /api/answers?questionId=...` (submission is now finalised). |
| **DB read** | **submissions** (status), **answers** LEFT JOIN **grades** — returns answer_text, marks_awarded, feedback. |
| **Response** | answers array with nested grade (marks_awarded, feedback). |

**Check:** Student sees marks and feedback on each answer.

---

## Stage 9 — Artefact download (student or instructor)

| Item | Detail |
|------|--------|
| **UI** | Question view → click artefact link. |
| **API** | `GET /api/artefacts/[id]/download` |
| **Auth** | Instructor: **module_instructors** for module (from artefact → question → module). Student: module status = published and **module_students** enrollment. |
| **DB read** | **artefacts** JOIN **questions** (module_id) JOIN **modules** (status); **module_instructors** or **module_students**. Then R2/S3 signed URL using storage_key (external, not a table). |
| **Response** | File stream (Content-Type, Content-Disposition). |

---

## Stage 10 — Admin: Archive module (optional)

| Item | Detail |
|------|--------|
| **User** | Admin. |
| **UI** | Admin → Modules → Select published module → Archive. |
| **API** | `PATCH /api/modules/[id]/archive` |
| **Auth** | Admin. |
| **DB read** | **modules**: status. |
| **DB write** | **modules**: `UPDATE status = 'archived'`. |
| **Response** | 200 + module. |

**Check:** Module no longer appears for new enrollment; existing submissions/grades remain. Only published modules can be archived.

---

## Other endpoints (reference)

- **GET /api/submissions?id=...** — Get one submission by id. Allowed: admin; student (own); instructor (assigned to module). Uses: **submissions**, **module_instructors**.
- **DELETE /api/modules/[id]** — Admin only; module must be **draft** and have **no** rows in **module_students**. Deletes module (cascades to related tables).

---

## Suggested test checklist (short)

- [ ] Login as admin, instructor, student; logout; confirm redirects.
- [ ] Admin: create instructor and student users.
- [ ] Admin: create module, assign instructor, enroll student.
- [ ] Instructor: add question → part → sub-question; mark module ready.
- [ ] Admin: publish module.
- [ ] Student: open module, open question, save answers for all sub-questions, submit.
- [ ] Instructor: open submissions, open submission, enter grades, finalise.
- [ ] Student: open same module/question and confirm grades/feedback visible.
- [ ] (Optional) Student or instructor: download artefact.
- [ ] (Optional) Admin: archive module.

Use this order so dependencies (users → module → content → publish → submission → grades → finalise) are always in place when you test each feature.
