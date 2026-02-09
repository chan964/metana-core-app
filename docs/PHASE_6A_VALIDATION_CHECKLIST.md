# Phase 6A — Validation checklist (6A-4)

All items must pass. Use this for sign-off and for atomic commit messages.

---

## Backend (api/answers/index.ts)

| Check | Status | Evidence |
|-------|--------|----------|
| Draft submissions never expose grades | Pass | When `submissionStatus !== 'submitted'` and `!== 'finalised'`, handler uses the draft branch: answers query has no JOIN on `grades` and returns `answers: answersRes.rows` with no `grade` field (lines 105–122). |
| Students cannot access grades for other students | Pass | Submission is fetched by `module_id` and `student_id` from session (`user.id`). All answer rows are scoped to that `submission_id`. No other student's data is queried. |
| Enrollment is enforced | Pass | Before any submission/answers logic, enrollment is checked (lines 66–74). 403 returned if not enrolled. |
| No new endpoints added | Pass | Only the existing GET handler in `/api/answers/index.ts` was extended. No new route files or handlers. |

---

## Frontend (StudentQuestionView.tsx)

| Check | Status | Evidence |
|-------|--------|----------|
| Grades appear only after submission | Pass | `showGrades = submissionStatus === 'submitted' \|\| submissionStatus === 'finalised'`. Grade block is rendered only when `showGrades` is true (lines 288–300). |
| Ungraded submissions show "Awaiting grading" | Pass | When `grades[subQuestion.id]?.marks_awarded != null` is false, the UI shows the text "Awaiting grading" (lines 291–293). |
| No layout regression | Pass | Grade block is an extra `<div>` below each textarea only when `showGrades`; structure and order of parts/answers unchanged. |
| No console errors | Pass | No throw in render path; fetches use try/catch and setError/toast; optional chaining used for grades. Manual verification recommended. |

---

## Why each change is safe

**6A-1 (Backend)**  
- Grade data is added only when `submissionStatus` is `submitted` or `finalised`; the draft path is unchanged and returns the same shape as before (no `grade`).  
- Same session, role (student), and enrollment checks; submission is always the current user’s for that module.  
- No schema or grading logic changes; grades are only read via a LEFT JOIN.  
- Response shape is extended with an optional `grade` object per answer; existing fields unchanged.

**6A-2 (Frontend)**  
- Grade display is additive and conditional on `showGrades`; no existing behaviour removed.  
- No new inputs or buttons for grades; answers remain read-only when not draft via existing `disabled={isReadOnly}`.  
- Styling is subtle and student-appropriate; no instructor/admin colours.

**6A-3 (Read-only enforcement)**  
- Autosave runs only when `!isReadOnly` (handler returns early in `handleAnswerChange`).  
- `saveAnswer` has a guard `if (isReadOnly) return` so no POST is sent even if a stale timeout fires.  
- Manual save is hidden and no-op when read-only.  
- Data is refetched on mount so the page is stable on refresh.

---

## Atomic commits per task

Use one commit per task with the following messages:

1. **6A-1**  
   `feat(6A-1): expose read-only grades in GET /api/answers when submitted or finalised`  
   - Only GET in api/answers/index.ts; draft path unchanged; grades joined and returned only when status is submitted/finalised.

2. **6A-2**  
   `feat(6A-2): display read-only grades in StudentQuestionView when submitted or finalised`  
   - Only StudentQuestionView.tsx; grades state and UI block when showGrades; "Awaiting grading" when marks_awarded is null.

3. **6A-3**  
   `chore(6A-3): enforce read-only — guard saveAnswer, document behaviour`  
   - Only StudentQuestionView.tsx; guard in saveAnswer and short 6A-3 comment.

4. **6A-4**  
   `docs(6A-4): add Phase 6A validation checklist`  
   - This file only.

---

## Output requirements

- **Atomic commits per task:** Use the four commit messages above; each touches only the stated files.
- **Explain why each change is safe:** See "Why each change is safe" above.
- **No TODOs:** Confirmed; no TODO/FIXME in api/answers/index.ts or StudentQuestionView.tsx.
- **No commented-out code:** Confirmed; only short inline comments (e.g. "Session validation", "Draft: return answers only") remain; no commented-out blocks.
