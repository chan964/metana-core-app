import { Artefact, ApiResponse } from '@/types';

const API_BASE = '/api';

// Get artefacts for a module
export async function getModuleArtefacts(moduleId: string): Promise<ApiResponse<Artefact[]>> {
  const response = await fetch(`${API_BASE}/modules/${moduleId}/artefacts`);
  return response.json();
}

// Upload artefact (admin/instructor only) - triggers API request, file handling is backend
export async function uploadArtefact(
  file: File,
  moduleId?: string,
  questionId?: string
): Promise<ApiResponse<Artefact>> {
  const formData = new FormData();
  formData.append('file', file);
  if (moduleId) formData.append('moduleId', moduleId);
  if (questionId) formData.append('questionId', questionId);

  const response = await fetch(`${API_BASE}/artefacts/upload`, {
    method: 'POST',
    body: formData,
  });
  return response.json();
}

// Delete artefact (admin/instructor only)
export async function deleteArtefact(id: string): Promise<ApiResponse<void>> {
  const response = await fetch(`${API_BASE}/artefacts/${id}`, {
    method: 'DELETE',
  });
  return response.json();
}
