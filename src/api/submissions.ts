import { ModuleSubmission, SubQuestionAnswer, SubQuestionGrade, ApiResponse } from '@/types';

const API_BASE = '/api';

// Get submission for a module (student)
export async function getSubmission(moduleId: string): Promise<ApiResponse<ModuleSubmission>> {
  const response = await fetch(`${API_BASE}/modules/${moduleId}/submission`);
  return response.json();
}

// Save draft answers (student)
export async function saveDraft(moduleId: string, answers: SubQuestionAnswer[]): Promise<ApiResponse<ModuleSubmission>> {
  const response = await fetch(`${API_BASE}/modules/${moduleId}/submission/draft`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  return response.json();
}

// Submit module (student)
export async function submitModule(moduleId: string): Promise<ApiResponse<ModuleSubmission>> {
  const response = await fetch(`${API_BASE}/modules/${moduleId}/submission/submit`, {
    method: 'POST',
  });
  return response.json();
}

// Get all submissions for a module (instructor)
export async function getModuleSubmissions(moduleId: string): Promise<ApiResponse<ModuleSubmission[]>> {
  const response = await fetch(`${API_BASE}/instructor/modules/${moduleId}/submissions`);
  return response.json();
}

// Get specific submission (instructor)
export async function getSubmissionById(submissionId: string): Promise<ApiResponse<ModuleSubmission>> {
  const response = await fetch(`${API_BASE}/instructor/submissions/${submissionId}`);
  return response.json();
}

// Save grades (instructor)
export async function saveGrades(submissionId: string, grades: SubQuestionGrade[]): Promise<ApiResponse<ModuleSubmission>> {
  const response = await fetch(`${API_BASE}/instructor/submissions/${submissionId}/grades`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grades }),
  });
  return response.json();
}

// Finalise grades (instructor) - irreversible
export async function finaliseGrades(submissionId: string): Promise<ApiResponse<ModuleSubmission>> {
  const response = await fetch(`${API_BASE}/instructor/submissions/${submissionId}/finalise`, {
    method: 'POST',
  });
  return response.json();
}
