/**
 * @deprecated This module is deprecated. The routes it called do not exist.
 * Use the actual backend API instead:
 * - Submission status: GET /api/submissions/status?moduleId=...
 * - Submit module: POST /api/submissions/submit (body: { moduleId })
 * - Instructor module submissions: GET /api/instructor/modules/:moduleId/submissions
 * - Instructor submission detail: GET /api/instructor/modules/:moduleId/submissions/:submissionId
 * - Save grade: POST /api/grades (body: { submission_answer_id, score, feedback })
 * - Finalise: POST /api/grades/finalise (body: { submission_id })
 * Do not use these functions; they will throw.
 */

import { ModuleSubmission, SubQuestionAnswer, SubQuestionGrade, ApiResponse } from '@/types';

const DEPRECATED_MSG =
  'src/api/submissions.ts is deprecated. Use the actual backend routes (see file comment).';

/** @deprecated Use GET /api/submissions/status?moduleId=... or equivalent. */
export async function getSubmission(_moduleId: string): Promise<ApiResponse<ModuleSubmission>> {
  throw new Error(DEPRECATED_MSG);
}

/** @deprecated Use POST /api/answers per sub-question or equivalent. */
export async function saveDraft(
  _moduleId: string,
  _answers: SubQuestionAnswer[]
): Promise<ApiResponse<ModuleSubmission>> {
  throw new Error(DEPRECATED_MSG);
}

/** @deprecated Use POST /api/submissions/submit with body { moduleId }. */
export async function submitModule(_moduleId: string): Promise<ApiResponse<ModuleSubmission>> {
  throw new Error(DEPRECATED_MSG);
}

/** @deprecated Use GET /api/instructor/modules/:moduleId/submissions. */
export async function getModuleSubmissions(
  _moduleId: string
): Promise<ApiResponse<ModuleSubmission[]>> {
  throw new Error(DEPRECATED_MSG);
}

/** @deprecated Use GET /api/instructor/modules/:moduleId/submissions/:submissionId. */
export async function getSubmissionById(
  _submissionId: string
): Promise<ApiResponse<ModuleSubmission>> {
  throw new Error(DEPRECATED_MSG);
}

/** @deprecated Use POST /api/grades per answer (submission_answer_id, score, feedback). */
export async function saveGrades(
  _submissionId: string,
  _grades: SubQuestionGrade[]
): Promise<ApiResponse<ModuleSubmission>> {
  throw new Error(DEPRECATED_MSG);
}

/** @deprecated Use POST /api/grades/finalise with body { submission_id }. */
export async function finaliseGrades(
  _submissionId: string
): Promise<ApiResponse<ModuleSubmission>> {
  throw new Error(DEPRECATED_MSG);
}
