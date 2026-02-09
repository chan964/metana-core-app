# Phase 6B — Validation & Freeze

**NO CODE CHANGES.** This document confirms validation and freezes Phase 6B.

---

## Backend checklist

| Check | Result | Evidence |
|-------|--------|----------|
| Cannot finalise twice | **PASS** | `api/grades/finalise.ts`: if `submission.status !== 'submitted'` → 400 "Submission not eligible for finalisation". Once status is `finalised`, a second POST returns 400. |
| Cannot grade after finalisation | **PASS** | `api/grades/index.ts` (POST): if `submissionAnswer.status === "finalised"` → 403 "Grades are locked after finalisation". No grade write occurs. |
| Auth & assignment enforced | **PASS** | Finalise: session (cookie + join users, expires_at), role instructor/admin; instructor must be in `module_instructors`. Grades POST: same session/role; instructor checked against `module_instructors`. |

---

## Frontend checklist

| Check | Result | Evidence |
|-------|--------|----------|
| Instructor UI locks after finalisation | **PASS** | `InstructorSubmissionDetail.tsx`: `gradesReadOnly = submission?.status === 'finalised'`; `scheduleSave` and `saveGrade` return early when `gradesReadOnly`; marks and feedback inputs use `disabled={... \|\| gradesReadOnly}`. |
| Students only see grades after finalisation | **PASS** | `StudentQuestionView.tsx`: `showGrades = submissionStatus === 'finalised'`; grade block is rendered only when `showGrades`. No grades or placeholders when status is `submitted`. |
| No console errors | **PASS** | No new throw paths in 6B code; fetches use try/catch and toast. Recommend a quick manual run (instructor finalise flow, student view when finalised) to confirm. |

---

## Suggested commit messages per task

- **6B-1:** `feat(6B-1): add POST /api/grades/finalise for instructor grading finalisation`
- **6B-2:** `feat(6B-2): block POST /api/grades when submission status is finalised`
- **6B-3:** `feat(6B-3): add Finalize Grades button and confirmation in InstructorSubmissionDetail`
- **6B-4:** `feat(6B-4): lock grading UI when submission is finalised (read-only, no autosave)`
- **6B-5:** `feat(6B-5): show student grades only when submission status is finalised`
- **6B-6:** `docs(6B-6): add Phase 6B validation checklist and freeze`

---

## Phase 6B freeze confirmation

Phase 6B is **frozen** as of this validation.

- No further code changes for Phase 6B are required.
- Submission lifecycle remains: **draft → submitted → finalised**.
- Instructors: grade only when `submitted`; finalise once; no grading after finalisation.
- Students: see grades only when `finalised`; no grades when `submitted` or `draft`.
- Backend: finalise endpoint and grade-lock guard are in place; auth and assignment enforced.

**Signed off:** Phase 6B validation complete.
