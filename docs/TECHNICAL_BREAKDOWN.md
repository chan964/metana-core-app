# Complete Implementation-Level Technical Breakdown

**Capstone-grade reverse-engineering. Assume examiners will question every design choice. No vagueness; no skipped flows.**

---

## 1. SYSTEM OVERVIEW

### What problem this system is solving

- **Educational assessment platform** for managing modules, questions, student submissions, and instructor grading.
- Students are enrolled in modules, answer questions (per sub-question), submit for grading; instructors grade sub-question answers and can finalise grades; admins manage users and modules (create, assign instructors, enroll students, publish, archive).

### Intended users and roles

| Role        | Purpose |
|------------|---------|
| **Student**   | View published modules, answer questions (draft auto-save), submit module, view own answers and grades after finalisation. |
| **Instructor**| View assigned modules, see submission list per module, open submission detail, enter marks/feedback per sub-question, finalise grades. |
| **Admin**     | Manage users (CRUD), manage modules (create, delete, assign instructors, enroll students, mark ready, publish, archive). |

### High-level architecture

- **Frontend:** Single-page app (React 18, Vite 5), React Router 6, TanStack Query (minimal use), Tailwind + shadcn/ui. Runs in browser; talks to same-origin API.
- **Backend:** Serverless API on **Vercel** (Node runtime). Each API route is a separate serverless function (no shared middleware). Handlers under `api/*.ts`; Vercel maps paths to files (e.g. `api/login.ts` → POST `/api/login`, `api/modules/[id].ts` → `/api/modules/:id`).
- **Database:** PostgreSQL (e.g. Neon). Single `lib/db.ts` exports a shared `Pool`; all serverless functions use `DATABASE_URL`. No connection pooling layer beyond `pg.Pool`.
- **Auth:** Cookie-based sessions. Login writes an HTTP-only `session` cookie (UUID); `api/me` and all protected routes parse `Cookie` and look up `sessions` + `users`. No JWT, no OAuth in the active code path (Clerk/Firebase in dependencies but not used in current login/me flow).
- **Hosting:** Frontend and API served by Vercel (`vercel dev` locally, Vercel in production). DB is external (Neon).

### Deployment assumptions

- **Local:** `npm run dev` (Vite) or `vercel dev` (Vite + API). `DATABASE_URL` must point to a reachable Postgres.
- **Production:** Vercel builds frontend (Vite build), deploys API as serverless functions. No long-lived server; no shared in-memory state. Schema is applied out-of-band; `backend/schema.sql` is documented as outdated; live schema may differ (e.g. `answers` vs `submission_answers`, `grades.answer_id`/`marks_awarded`, `modules.id` DEFAULT).

---

## 2. FULL LOGIC FLOW (END-TO-END)

### 2.1 Login

- **Entry:** `LoginPage.tsx` → form submit → `POST /api/login` with `{ email, password }`.
- **api/login.ts:** No auth. Reads `users` by `email`; compares `password` to `password_hash` via `bcrypt.compare`. On success: inserts row into `sessions` (id=uuid, user_id, expires_at = now+7d), sets `Set-Cookie: session=<uuid>` (httpOnly, path=/, sameSite=strict, secure in prod), returns `{ success: true }`. On failure: 401, no cookie.
- **Frontend:** On 200, waits 500ms then calls `refetch()` from `useAuth` (GET /api/me), then `navigate("/", { replace: true })`. Root renders `AuthenticatedRedirect` → redirects to `/admin`|`/instructor`|`/student` by `user.role`.
- **DB writes:** `sessions` INSERT. **DB reads:** `users` (email, password_hash).

### 2.2 Session resolution (every protected request)

- **Entry:** Any protected page or API call with `credentials: 'include'`.
- **Frontend:** `AuthProvider` mounts → `loadUser()` → `GET /api/me` with cookie. Response stored in React state (`user`). `ProtectedRoute` allows access only if `user` exists and `user.role` is in `allowedRoles`.
- **api/me.ts:** Parses `Cookie`, gets `session`; queries `sessions` JOIN `users` WHERE session id and `expires_at > now()`. Returns 401 if no row; else returns user row (id, email, full_name, role, created_at).
- **DB reads:** `sessions`, `users`.

### 2.3 Logout

- **Entry:** Header dropdown → “Sign Out” → `logout()` in useAuth → `POST /api/logout` with cookie, then `window.location.href = '/'`.
- **api/logout.ts:** Parses cookie, `DELETE FROM sessions WHERE id = $1`, sets `Set-Cookie: session=; expires=...` to clear cookie, returns 200.
- **DB writes:** `sessions` DELETE.

### 2.4 Admin: list users, create user

- **Entry:** `AdminDashboard` → tab “Users” → `UserManagement.tsx` → `getAllUsers()` → `GET /api/users` (with cookie).
- **api/users/index.ts:** Validates session; requires `role === 'admin'` (403 otherwise). GET: `SELECT id, email, full_name, role, created_at FROM users [WHERE role = $1] ORDER BY created_at DESC`, returns `{ success: true, data: rows }`. POST: body `email, name, role, password`; hashes password with bcrypt; `INSERT INTO users (id, email, full_name, role, password_hash)` (id = randomUUID()), returns 201 with created row.
- **DB reads:** `sessions`, `users`. **DB writes:** `users` INSERT.

### 2.5 Admin: list modules, create module

- **Entry:** “Modules” tab → `ModuleManagement` → `getAllModules()` → `GET /api/modules`.
- **api/modules/index.ts:** Session required, role must be `admin`. GET: complex query on `modules` LEFT JOIN `module_instructors`/`module_students`/users, returns modules with instructors and students arrays (including `submission_start`, `submission_end` — schema drift). POST: body `title, description`; `INSERT INTO modules (title, description, status)` with no `id` — **schema.sql has modules.id PRIMARY KEY with no DEFAULT; live DB likely has DEFAULT gen_random_uuid() or INSERT would fail.**
- **DB reads:** `sessions`, `modules`, `module_instructors`, `module_students`, `users`. **DB writes:** `modules` INSERT.

### 2.6 Admin: assign instructor, enroll student

- **Entry:** ModuleManagement → dialogs → POST to assign/enroll.
- **api/modules/[id]/instructor.ts:** Admin only. Body `instructorId`. INSERT into `module_instructors` (module_id, instructor_id). Duplicate → 400.
- **api/modules/[id]/enroll.ts:** Admin only. Body `studentId`. INSERT into `module_students` (module_id, student_id). Duplicate → 400.
- **DB writes:** `module_instructors`, `module_students`.

### 2.7 Admin: publish, archive, delete module

- **api/modules/[id]/publish.ts:** Admin only. Checks module status = draft, ready_for_publish = true, at least one instructor assigned. UPDATE modules SET status = 'published', published_at = now().
- **api/modules/[id]/archive.ts:** Admin only. Only published modules; UPDATE status = 'archived'.
- **api/modules/[id].ts DELETE:** Admin only, module must be draft, no enrolled students; DELETE modules (cascades).

### 2.8 Instructor: list my modules

- **Entry:** `/instructor` → `InstructorDashboard` → `GET /api/instructor/modules`.
- **api/instructor/modules/index.ts:** Session, role `instructor`. Query: modules INNER JOIN module_instructors WHERE instructor_id = current user, with submission counts (draft/submitted/graded/finalised) and instructors/students aggregates. Returns `{ data: [{ module, submissionCounts }] }`.
- **DB reads:** `sessions`, `modules`, `module_instructors`, `module_students`, `users`, `submissions`.

### 2.9 Instructor: list submissions for a module

- **Entry:** Click module → `/instructor/modules/:moduleId/submissions` → `InstructorModuleSubmissions` → `GET /api/instructor/modules/:id/submissions`.
- **api/instructor/modules/[id]/submissions.ts:** Session, role instructor; verifies instructor assigned to module. Query: submissions JOIN users for module_id, status IN ('submitted','finalised'). Returns list of submission_id, student_id, student_name, status, submitted_at.
- **DB reads:** `sessions`, `users`, `modules`, `module_instructors`, `submissions`, `users`.

### 2.10 Instructor: open submission detail (grade)

- **Entry:** Click row → `/instructor/modules/:moduleId/submissions/:submissionId` → `InstructorSubmissionDetail` → GET `/api/instructor/modules/:id/submissions/:submissionId` and GET same-module submissions list.
- **api/instructor/modules/[id]/submissions/[submissionId].ts:** Session, role instructor or admin; checks assignment to module. Loads submission, questions (parts, sub_questions), answers from `answers`, returns payload (submission_id, module_id, student_name, status, submitted_at, questions with parts, sub_questions, answer_text). No grades in this route’s response; grades are loaded from `/api/instructor/submissions/[submissionId]` in legacy flow. **Actual grading UI uses this route for detail; grades are fetched/saved via `/api/grades` and `/api/instructor/submissions/[submissionId]` (which returns submission_answer_id, marks_awarded, feedback).**
- **api/instructor/submissions/[submissionId].ts:** Session, instructor or admin; checks assignment to module. Returns submission + questions with parts, sub_questions, answer_text, submission_answer_id, marks_awarded, feedback. Used for grading view.
- **Frontend:** Instructor enters marks/feedback; debounced POST to `POST /api/grades` per sub-question (submission_answer_id, score, feedback). Finalise button → `POST /api/grades/finalise` with submission_id.
- **DB reads:** sessions, users, modules, module_instructors, submissions, questions, parts, sub_questions, answers, grades, artefacts. **DB writes:** `grades` (INSERT/UPDATE via ON CONFLICT answer_id), `submissions` (status finalised, finalised_at via finalise).

### 2.11 Student: list my modules

- **Entry:** `/student` or `/student/modules` → `StudentModules` (Modules.tsx) → `GET /api/student/modules`.
- **api/student/modules.ts:** Session, role student. Query: modules INNER JOIN module_students WHERE student_id = user AND status = 'published'. Returns array of modules (id, title, status, created_at). Frontend then fetches progress per module: `GET /api/student/modules/:id/progress`.
- **DB reads:** `sessions`, `modules`, `module_students`.

### 2.12 Student: open module (question list)

- **Entry:** Click module → `/student/modules/:moduleId` → `StudentModuleView` → `GET /api/modules/:id` (role-based: student gets module only if published).
- **api/modules/[id].ts GET:** Resolves session and user. If student: module must be published; returns legacy-shaped module (questions, partA, partB, artefacts). If instructor/admin: returns same without status restriction.
- **DB reads:** sessions, users, modules, questions, parts, sub_questions, artefacts.

### 2.13 Student: open question, load/save answers

- **Entry:** `/student/modules/:moduleId/questions/:questionId` → `StudentQuestionView`. Fetches: (1) `GET /api/student/modules/:moduleId/questions/:questionId` (question, parts, sub_questions, artefacts), (2) `GET /api/answers?questionId=...` (answers and, if submitted/finalised, grades), (3) `GET /api/submissions/status?moduleId=...` (status).
- **api/answers/index.ts GET:** Session, role student; validates question exists and student enrolled; gets or creates one submission per (module, student); if draft: SELECT from `answers` for that submission and question; if submitted/graded/finalised: same + LEFT JOIN `grades`. Returns `{ answers: [...] }` or `{ answers: [{ ..., grade: { marks_awarded, feedback } }] }`.
- **api/answers/index.ts POST:** Session, student; body `sub_question_id`, `answer_text`; ensures submission is draft; INSERT into `answers` ON CONFLICT (submission_id, sub_question_id) DO UPDATE. Returns 200.
- **DB reads:** sessions, users, questions, module_students, submissions, answers, grades. **DB writes:** submissions (INSERT if none), answers (INSERT/UPDATE).

### 2.14 Student: submit module

- **Entry:** “Submit” in student flow → `POST /api/submissions/submit` with `{ moduleId }`.
- **api/submissions/submit.ts:** Session, student; module must be published, student enrolled; submission must exist and be draft. Validates that every sub_question in the module has a non-empty answer (COUNT from answers). UPDATE submissions SET status = 'submitted', submitted_at = now(). Returns 200 or 400 if not all answered.
- **DB reads:** sessions, users, modules, module_students, submissions, sub_questions, parts, questions, answers. **DB writes:** submissions UPDATE.

### 2.15 Instructor: save grade, finalise

- **POST /api/grades:** Session, instructor or admin; body submission_answer_id, score, feedback. Validates answer exists, submission status in (submitted, finalised), not finalised for editing; instructor must be in module_instructors. INSERT/UPDATE grades (answer_id, marks_awarded, feedback). **Note:** Submission status is never set to `graded` in code; it stays `submitted` until finalise.
- **POST /api/grades/finalise:** Session, instructor or admin; body submission_id. Submission must be status `submitted`. UPDATE submissions SET status = 'finalised', finalised_at = now().

### 2.16 Artefact download

- **Entry:** Link to `/api/artefacts/:id/download` (e.g. in StudentQuestionView or InstructorSubmissionDetail).
- **api/artefacts/[id]/download.ts:** Session required. Looks up artefact by id; checks access (instructor: assigned to module; student: module published and enrolled). Builds AWS Signature V4 request to R2 (env: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT), fetches object, streams buffer with Content-Type and Content-Disposition.
- **DB reads:** sessions, users, artefacts, questions, modules, module_instructors, module_students.

---

## 3. FRONTEND IMPLEMENTATION

### Framework and structure

- **Stack:** React 18, TypeScript, Vite 5, React Router 6, TanStack Query (QueryClient present; most data fetching is raw `fetch` in useEffect), Tailwind CSS, shadcn/ui (Radix in `src/components/ui/`).
- **Entry:** `index.html` → `main.tsx` (ThemeProvider, App) → `App.tsx`. App wraps with QueryClientProvider, AuthProvider, TooltipProvider, Toaster (Sonner), BrowserRouter, Routes.

### Pages, components, and layouts

| Route | Component | Responsibility |
|-------|-----------|----------------|
| `/` | `AuthenticatedRedirect` | If !user → LandingPage; else Navigate to /admin|/instructor|/student by role. |
| `/login` | `LoginPage` | Form email/password; POST /api/login; refetch + navigate /. |
| `/student`, `/student/modules` | `StudentModules` (pages/student/Modules.tsx) | GET /api/student/modules + per-module progress; cards link to /student/modules/:id. |
| `/student/modules/:moduleId` | `StudentModuleView` (pages/student/StudentModuleView.tsx) | GET /api/modules/:id (legacy shape); lists questions; links to /student/modules/:moduleId/questions/:questionId. |
| `/student/modules/:moduleId/questions/:questionId` | `StudentQuestionView` | GET question, answers, submission status; textareas with debounced save to /api/answers; submit button → /api/submissions/submit; read-only + grades when status !== draft. |
| `/student/module/:moduleId` | `StudentModuleViewLegacy` (StudentModuleView.tsx) | Legacy route; similar module view. |
| `/instructor` | `InstructorDashboard` | GET /api/instructor/modules; cards with submission counts; links to module editor and submissions. |
| `/instructor/modules/:moduleId` | `ModuleEditor` | Module metadata; GET /api/modules/:id, /api/instructor/modules/:id; links to QuestionEditor, submissions. |
| `/instructor/modules/:moduleId/questions/new`, `.../:questionId` | `QuestionEditor` | Create/edit question (title, scenario_text, parts, sub_questions, artefacts); POST questions, parts, sub_questions, artefacts. |
| `/instructor/module/:moduleId/submissions` | `InstructorSubmissions` | Legacy submissions list. |
| `/instructor/modules/:moduleId/submissions` | `InstructorModuleSubmissions` | GET /api/instructor/modules/:id/submissions; table; link to submission detail. |
| `/instructor/modules/:moduleId/submissions/:submissionId` | `InstructorSubmissionDetail` | GET submission detail (instructor/modules/.../submissions/:id) + list; grade inputs; POST /api/grades; finalise → POST /api/grades/finalise. |
| `/instructor/submission/:submissionId` | `GradingView` | Alternative grading view (legacy). |
| `/admin` | `AdminDashboard` | Tabs: Users (UserManagement), Modules (ModuleManagement). |
| `*` | `NotFound` | 404. |

**Layout:** `Layout` (components/Layout.tsx) wraps routes under `<Layout />`: `Header` + `<main><Outlet /></main>`. Header: Logo, theme toggle, user dropdown (name, email, role, Sign Out) or Sign In.

**Relevant files:**

- **App.tsx** – Routes, AuthProvider, ProtectedRoute usage, layout.
- **src/hooks/useAuth.tsx** – AuthProvider, loadUser (GET /api/me), logout (POST /api/logout + redirect), refetch.
- **src/components/ProtectedRoute.tsx** – Role-based route guard; redirect to /login or role dashboard.
- **src/components/Layout.tsx** – Header + Outlet.
- **src/components/Header.tsx** – Logo, theme toggle, user menu.
- **src/components/admin/UserManagement.tsx** – getAllUsers, createUser, updateUser, deleteUser; table + dialogs.
- **src/components/admin/ModuleManagement.tsx** – getAllModules, createAdminModule, deleteModule, assignInstructor, enrollStudent, markModuleReady, publishModule, archiveModule; table + dialogs.
- **src/api/auth.ts** – getCurrentUser (Bearer token — not used in current flow), logout stub.
- **src/api/users.ts** – getAllUsers, createUser, updateUser, deleteUser (fetch to /api/users, /api/users/:id).
- **src/api/modules.ts** – getAllModules, createAdminModule, deleteModule, assignInstructor, enrollStudent, markModuleReady, publishModule, archiveModule.
- **src/api/artefacts.ts**, **src/api/submissions.ts** – Thin wrappers; some pages call fetch directly.

### State management

- **Auth:** React Context in useAuth.tsx. State: user, isLoading. No global store.
- **Server state:** Mostly useState + useEffect + fetch. TanStack Query available but not used consistently. Cache is per-component.
- **Forms:** Local state in LoginPage, UserManagement, ModuleManagement, InstructorSubmissionDetail, StudentQuestionView. react-hook-form in package.json but limited use.

### API interaction pattern

- Relative URLs (`/api/...`), `credentials: 'include'`. Errors: res.ok check, JSON parse, toast or inline Alert. No shared API client or interceptors.

### Auth/session on client

- On load: AuthProvider runs loadUser() once (GET /api/me). No periodic refresh; 401 on next request leaves user null and ProtectedRoute redirects to /login.
- ProtectedRoute: checks user and allowedRoles; redirects to /login or role dashboard.

### Loading and error states

- Loading: Skeleton or “Loading…” in pages. Errors: toast (Sonner) or Alert. No global error boundary.

---

## 4. BACKEND IMPLEMENTATION

### Framework/runtime

- **Vercel serverless.** Each file under `api/` is a serverless function. Handlers: `export default async function handler(req: VercelRequest, res: VercelResponse)`. No Express/Fastify; no shared middleware. Auth is repeated in each handler (parse cookie → query sessions/users → check role).

### Middleware

- **None.** Every handler that needs auth re-implements: read cookie, parse session id, query DB for session + user, check role. Inconsistency risk (e.g. req.cookies?.session vs parse(cookieHeader).session).

### Business logic separation

- **Minimal.** Business logic inside handler files. No service layer. Validation ad hoc (if (!x) return 400). Shared DB via `lib/db.ts` (pool) only.

### Error handling

- try/catch; on error: console.error + res.status(500).json({ error: '...' }). Some handlers in dev return detail and stack. No global error handler.

### Endpoint list (ALL)

| Route | Method | Purpose | Input | Output | DB |
|-------|--------|---------|-------|--------|-----|
| **Auth** |
| /api/login | POST | Login | body: email, password | 200 + Set-Cookie session, { success: true } / 401 { error } | users read; sessions insert |
| /api/logout | POST | Logout | cookie session | 200, clear cookie | sessions delete |
| /api/me | GET | Current user | cookie session | 200 user { id, email, full_name, role, created_at } / 401 | sessions, users |
| **Health** |
| /api/health | GET | Health check | - | 200 { status, service, timestamp } | none |
| **Users (admin)** |
| /api/users | GET | List users | cookie; query role? | 200 { success, data: users[] } | sessions, users |
| /api/users | POST | Create user | cookie; body email, name?, role, password | 201 { success, data: user } | sessions, users insert |
| /api/users/[id] | GET | Get user | cookie; id | 200 { success, data: user } | sessions, users |
| /api/users/[id] | PATCH | Update user | cookie; id; body email?, full_name?, role?, password? | 200 { success, data: user } | sessions, users update |
| /api/users/[id] | DELETE | Delete user | cookie; id | 200 { success, message } | sessions, users delete |
| **Modules (admin)** |
| /api/modules | GET | List modules (admin) | cookie admin | 200 { data: modules[] } | sessions, modules, module_*, users |
| /api/modules | POST | Create module | cookie admin; body title, description? | 201 { data: module } | sessions, modules insert |
| /api/modules/[id] | GET | Get module (role-based) | cookie; id | 200 { data: legacyModule } | sessions, users, modules, questions, parts, sub_questions, artefacts |
| /api/modules/[id] | DELETE | Delete module (draft only) | cookie admin; id | 200 { success, data, message } | sessions, modules delete |
| /api/modules/[id]/instructor | POST | Assign instructor | cookie admin; id; body instructorId | 200 { data: module } | sessions, module_instructors insert |
| /api/modules/[id]/enroll | POST | Enroll student | cookie admin; id; body studentId | 200 { data: module } | sessions, module_students insert |
| /api/modules/[id]/questions | GET | Questions for module | cookie instructor; id | 200 { module_id, questions } | sessions, questions, parts, sub_questions, artefacts |
| /api/modules/[id]/ready | PATCH | Mark ready for publish | cookie instructor; id | 200 { success, data } | sessions, modules update |
| /api/modules/[id]/publish | PATCH | Publish module | cookie admin; id | 200 { success, data } | sessions, modules update |
| /api/modules/[id]/archive | PATCH | Archive module | cookie admin; id | 200 { success, data } | sessions, modules update |
| **Instructor** |
| /api/instructor/modules | GET | My modules + counts | cookie instructor | 200 { data: [{ module, submissionCounts }] } | sessions, modules, module_*, submissions, users |
| /api/instructor/modules/[id] | GET | Module detail (instructor) | cookie; id | 200 { module, submissionCounts } | sessions, module, submissions, users |
| /api/instructor/modules/[id]/submissions | GET | Submissions list | cookie instructor; id | 200 array of { submission_id, student_id, student_name, status, submitted_at } | sessions, users, modules, module_instructors, submissions |
| /api/instructor/modules/[id]/submissions/[submissionId] | GET | Submission detail (answers, no grades) | cookie; id, submissionId | 200 { submission_id, module_id, student_id, student_name, status, submitted_at, questions } | sessions, modules, module_instructors, submissions, questions, parts, sub_questions, answers, artefacts |
| /api/instructor/submissions/[submissionId] | GET | Submission detail with grades | cookie; submissionId | 200 { submission, questions } (sub_questions have submission_answer_id, answer_text, grade) | sessions, submissions, module_instructors, questions, parts, sub_questions, answers, grades, artefacts |
| **Student** |
| /api/student/modules | GET | My published modules | cookie student | 200 array of { id, title, status, created_at } | sessions, modules, module_students |
| /api/student/modules/[id] | GET | Module + questions (student) | cookie; id | 200 { id, title, description, status, questions } | sessions, module_students, modules, questions |
| /api/student/modules/[id]/progress | GET | Progress % for module | cookie; id | 200 { total, answered, percentage } | sessions, module_students, sub_questions, submissions, answers |
| /api/student/modules/[id]/questions/[questionId] | GET | Question detail (student) | cookie; id, questionId | 200 { id, title, scenario_text, parts, artefacts } | sessions, enrollment, questions, parts, sub_questions, artefacts |
| **Answers** |
| /api/answers | GET | Get answers for question | cookie; query questionId | 200 { answers } or { answers: [{ ..., grade }] } | sessions, users, questions, module_students, submissions, answers, grades |
| /api/answers | POST | Save draft answer | cookie; body sub_question_id, answer_text | 200 { success: true } | sessions, users, sub_questions, parts, questions, module_students, submissions, answers insert/update |
| **Submissions** |
| /api/submissions/status | GET | Submission status for module | cookie student; query moduleId | 200 { status } or { status: 'draft' } | sessions, submissions |
| /api/submissions/submit | POST | Submit module | cookie student; body moduleId | 200 { success, message } / 400 | sessions, modules, module_students, submissions, answers validation, submissions update |
| /api/submissions/start | POST | Create draft submission | cookie (any); body moduleId, studentId | 201 { success, data } | sessions, submissions insert — **NO ROLE OR studentId CHECK: BROKEN ACCESS CONTROL** |
| /api/submissions | GET | Get submission by id | cookie (any); query id | 200 { success, data: submission } | sessions, submissions — **NO CHECK THAT SUBMISSION BELONGS TO USER: IDOR** |
| **Grades** |
| /api/grades | POST | Upsert grade for one answer | cookie instructor/admin; body submission_answer_id, score, feedback | 200 { id, submission_answer_id, score, feedback } | sessions, answers, submissions, sub_questions, module_instructors, grades insert/update |
| /api/grades/finalise | POST | Finalise submission | cookie instructor/admin; body submission_id | 200 { success: true } | sessions, submissions update |
| **Questions / Parts / Sub-questions / Artefacts** |
| /api/questions | POST | Create question | cookie instructor; body module_id, title, scenario_text, order_index? | 200 question row | sessions, questions insert |
| /api/questions/[id] | PATCH/PUT | Update question | cookie instructor; id; body title?, scenario_text? | 200 question row | sessions, questions update |
| /api/questions/[id] | DELETE | Delete question | cookie instructor; id | 200 { success, id } | sessions, questions, parts, sub_questions, artefacts, answers (cascade) delete |
| /api/parts | POST | Create part | cookie instructor; body question_id, label (A|B) | 200 part row | sessions, parts insert |
| /api/sub-questions | POST | Create sub-question | cookie instructor; body part_id, prompt, max_marks, order_index? | 200 sub_question row | sessions, sub_questions insert |
| /api/artefacts | POST | Register artefact | cookie instructor; body question_id, filename, file_type, url, storage_key | 200 artefact row | sessions, artefacts insert |
| /api/artefacts/[id]/download | GET | Download artefact file | cookie; id | 200 binary + headers | sessions, artefacts, R2 fetch |

---

## 5. DATABASE DESIGN (CRITICAL)

**Source of truth:** `backend/schema.sql` is **outdated**. Live DB may use: table `answers` (not `submission_answers`), `grades.answer_id` and `grades.marks_awarded` (not `submission_answer_id`/`score`), `modules.id` with DEFAULT gen_random_uuid(), and columns `submission_start`, `submission_end` on modules. Code uses `answers` and grades with `answer_id`/`marks_awarded`.

### Enums

- **role:** 'admin', 'instructor', 'student'
- **submission_status:** 'draft', 'submitted', 'graded', 'finalised'
- **module_status:** 'draft', 'published', 'archived'

### Tables (schema.sql + code usage)

**users**  
- Purpose: User accounts and role.  
- Columns: id (UUID, PK, DEFAULT gen_random_uuid()), email (TEXT, UNIQUE, NOT NULL), full_name (TEXT), role (role, NOT NULL), password_hash (TEXT, NOT NULL), created_at (TIMESTAMP).  
- Used: login, me, all protected APIs, users CRUD, module_instructors/module_students.

**sessions**  
- Purpose: Cookie-based session.  
- Columns: id (UUID, PK), user_id (UUID, FK users ON DELETE CASCADE), expires_at (TIMESTAMP), created_at (TIMESTAMP).  
- Used: login (insert), logout (delete), me and every protected handler.

**modules**  
- Purpose: Assessment module.  
- Schema: id (UUID, PK — **no DEFAULT in schema.sql**), title (TEXT), description (TEXT), status (module_status), ready_for_publish (BOOLEAN), published_at (TIMESTAMP), created_at (TIMESTAMP). Code also references **submission_start, submission_end** — not in schema.sql (drift).  
- Used: admin/instructor/student module lists, CRUD, publish/archive. **INSERT in api/modules does not pass id; live DB likely has DEFAULT.**

**module_instructors**  
- (module_id, instructor_id) PK; FKs to modules, users.  
- Used: instructor module list, submission access, admin assign.

**module_students**  
- (module_id, student_id) PK; FKs to modules, users.  
- Used: student module list, enrollment checks, admin enroll.

**questions**  
- id (UUID, PK), module_id (FK modules), title, scenario_text, order_index, created_at.  
- Used: module detail, question list, answers API.

**parts**  
- id (UUID, PK), question_id (FK questions), label (TEXT), created_at. UNIQUE (question_id, label).  
- Used: sub_questions hierarchy.

**sub_questions**  
- id (UUID, PK), part_id (FK parts), prompt (TEXT), max_marks (INT CHECK > 0), order_index, created_at.  
- Used: answers, grades, submission validation.

**submissions**  
- id (UUID, PK), module_id (FK modules), student_id (FK users), status (submission_status), created_at, submitted_at, graded_at, finalised_at. UNIQUE (module_id, student_id).  
- Used: submit flow, status API, answers (get/create), instructor list/detail, grades finalise. **Note: No code sets status to 'graded'; it goes submitted → finalised.**

**submission_answers (schema) / answers (code)**  
- Schema: **submission_answers** — id, submission_id (FK submissions), sub_question_id (FK sub_questions), answer_text, created_at, updated_at. UNIQUE (submission_id, sub_question_id).  
- Code: table **answers** (same structure); grades reference answers(id).  
- Used: api/answers, api/grades, api/submissions/submit, instructor submission detail, student progress.

**grades**  
- Schema: id (UUID, PK), submission_answer_id (FK submission_answers), instructor_id (FK users), score (INT CHECK >= 0), feedback (TEXT), graded_at. UNIQUE (submission_answer_id).  
- Code: **answer_id** (FK answers(id)), **marks_awarded**, feedback; UNIQUE (answer_id). Used in api/grades, api/answers (GET when submitted/finalised), instructor submission detail.

**artefacts**  
- id (UUID, PK), module_id (FK modules), question_id (FK questions), filename, file_type, url, storage_key, uploaded_by (FK users), created_at.  
- Code: INSERT in api/artefacts does not set uploaded_by. Used: artefact download, question/student view.

### Schema enforcement

- **Implicit/poorly enforced.** No in-app migrations; table/column names differ in production. No single source of truth.

---

## 6. AUTHENTICATION & AUTHORIZATION

### Auth method

- **Cookie-based session.** Login creates a row in `sessions` and sets HTTP-only cookie `session=<uuid>`. No JWT; no OAuth in active path.

### Role model

- **Three roles:** admin, instructor, student. Stored in `users.role`. No per-resource permissions beyond role + module_instructors/module_students.

### How access control is enforced

- **Frontend:** ProtectedRoute checks user.role against allowedRoles; redirects if missing or wrong role.  
- **Backend:** Each handler parses cookie, loads user from sessions+users, then requires specific role and sometimes resource (module_instructors, module_students).

### Where it is weak or inconsistent

- **No shared auth helper:** Logic duplicated; easy to forget a check or use different cookie parsing.  
- **Session not invalidated on role change:** Existing session remains valid until expiry.  
- **No CSRF tokens:** SameSite=strict and same-origin reduce risk but do not eliminate.  
- **Sensitive logging:** login.ts and me.ts log email/cookie presence; should be removed or gated in production.  
- **Critical: POST /api/submissions/start** — Only checks valid session. Does **not** check role or that `studentId === current user.id`. Any authenticated user can create a draft submission for any (moduleId, studentId). **Broken access control.**  
- **Critical: GET /api/submissions?id=** — Only checks valid session. Does **not** check that the submission belongs to the current user (e.g. student_id === user.id or user is instructor for that module). Any authenticated user can read any submission by id. **IDOR.**

---

## 7. SECURITY ANALYSIS (NO MERCY)

- **Broken access control / IDOR:**  
  - **POST /api/submissions/start:** Accepts body `moduleId, studentId`. Any authenticated user can create a submission for any student. Must restrict to: caller is admin, or caller is the student (studentId === session user_id).  
  - **GET /api/submissions?id=:** Returns any submission by id. Must restrict to: submission.student_id === session user (student viewing own), or session user is instructor assigned to submission.module_id, or admin.

- **Missing validation:**  
  - Many endpoints trust req.body/req.query without schema validation (no Zod at API boundary). Email format, password strength, UUID format, max lengths often unchecked.  
  - Artefact upload (if any): type/size/path traversal must be enforced.

- **Over-trusting client:**  
  - Role is server-side; frontend checks are UX only. Submit/finalise and “all answers present” are enforced server-side; ensure no bypass.

- **Sensitive data exposure:**  
  - api/me returns full_name, email, role, created_at (acceptable for current user).  
  - Login/me logging: email or cookie presence can leak; remove or redact in production.  
  - 500 responses: In dev some return detail/stack; must be disabled in production.

- **SQL injection:**  
  - Parameterised queries used throughout ($1, $2, …). Low risk if consistent.

- **Session:**  
  - Session id is UUID; HTTPS and secure cookie in production. No rate limiting on login.

- **OWASP:**  
  - A01 Broken Access Control: submissions/start and submissions GET are explicit failures.  
  - A02 Cryptographic Failures: bcrypt for passwords; ensure DATABASE_URL and cookies not logged.  
  - A03 Injection: parameterised queries.  
  - A07 Identification and Authentication Failures: duplicated session handling; no rate limiting on login.

---

## 8. ARCHITECTURAL ISSUES & TECH DEBT

- **No shared auth middleware:** Every handler re-implements session resolution and role check. High duplication and inconsistency risk.

- **Tight coupling to DB shape:** Table/column names (answers vs submission_answers, grades columns, submission_start/submission_end) hardcoded. Schema drift causes runtime errors or wrong behaviour. No repository/DAO layer.

- **Inconsistent API response shapes:** Some `{ data }`, some `{ success, data }`, some raw array. No API versioning or contract tests.

- **Modules INSERT vs schema:** schema.sql has modules.id PK with no DEFAULT; api/modules POST does not pass id. Either live DB has DEFAULT or INSERT fails.

- **Two parallel route trees:** Instructor has both `/instructor/module/:moduleId/submissions` (legacy) and `/instructor/modules/:moduleId/submissions`. Redundant and confusing.

- **Submission status “graded”:** Enum has 'graded' but no code sets submission status to 'graded'; flow is submitted → finalised. Counts by status may show graded only if something else sets it; otherwise dead state.

- **Scalability:** Single Pool per invocation; connection count can spike. No read replicas; no caching. Large submission-detail payload in one response.

- **Maintainability:** Large commented-out blocks (Clerk, old me). No shared error codes or logging format. Business rules buried in handlers.

- **Testing:** phase1.auth.test.ts depends on real DB; no in-memory/mock for unit tests.

---

## 9. WHAT THE ASSESSOR WILL ASK

- **“Why did you design it this way?”**  
  Session cookies for simplicity. Role-based access matches three personas. Per-handler auth is a consequence of serverless and was not refactored into a helper.

- **“How does this scale?”**  
  Single DB, no cache, no read replicas. Under load, pool and query latency limit throughput. Scaling would need: connection pooler, read replicas, caching (e.g. /api/me, module list), and possibly splitting large submission payloads.

- **“How is security enforced here?”**  
  Server-side: each protected API resolves session and user, then checks role and sometimes resource (module_instructors, module_students). Client-side: ProtectedRoute is UX only. Weak spots: no shared auth abstraction; **submissions/start and GET /api/submissions have broken access control and IDOR**; logging of sensitive data.

- **“What happens if X fails?”**  
  - DB down: Pool queries throw; handlers return 500; user sees generic error.  
  - Session expired: /api/me returns 401; frontend sets user null; ProtectedRoute redirects to login.  
  - Submit with missing answers: api/submissions/submit validates and returns 400.  
  - Finalise twice: api/grades/finalise checks status; if not submitted returns 400; if already finalised, handler does not set status again (no explicit “already finalised” check in finalise.ts — only status === 'submitted' is required).

- **“Why answers vs submission_answers?”**  
  Historical/migration; live DB uses `answers`. Code and scripts reference both; should be consolidated and schema documented.

---

## 10. IMPROVEMENT ROADMAP

### Immediate (must-do)

- Add a **shared auth helper** (e.g. `getUserFromRequest(req)` or `requireRole(req, ['admin'])`) used by every protected handler; centralise cookie parse, session lookup, role check. Return 401/403 from one place.
- **Fix POST /api/submissions/start:** Require caller to be admin OR `studentId === session user_id`; validate module exists and student is enrolled if needed.
- **Fix GET /api/submissions:** Require submission.student_id === session user (student), OR session user is instructor for submission.module_id, OR admin. Otherwise 403.
- **Remove or gate sensitive logging** (email, cookie presence) in production; never return stack/detail in 500 in production.
- **Fix modules INSERT:** Ensure modules.id has DEFAULT gen_random_uuid() in DB or pass id in INSERT.
- **Validate inputs** at API boundary (e.g. Zod): email format, UUIDs, role enum, max lengths, score bounds.

### Medium-term

- **Service layer** for “get submission for instructor,” “submit module,” “save grade” so business rules live in one place.
- **Single source of truth for schema:** Migrations and align code (answers vs submission_answers; grades columns). Remove or rename duplicate routes.
- **Consistent API contract:** Standardise response shape; document; add contract/integration tests.
- **Session invalidation:** On role/password change, delete or expire that user’s other sessions.
- **Submission status “graded”:** Either implement transition to graded when all answers are graded, or remove from enum/counts.

### Production-grade

- **Auth:** Consider JWT with short expiry + refresh, or keep cookies and add CSRF for state-changing requests; rate limit login.
- **DB:** Connection pooler; read replicas for read-heavy endpoints; cache /api/me and module lists.
- **Structured errors:** Error codes and messages from one module; no stack in response; correlation id for logging.
- **Observability:** Request logging, metrics, tracing.

---

*End of technical breakdown. All references are to the current codebase; behaviour is as implemented. Gaps and bugs are stated explicitly.*
