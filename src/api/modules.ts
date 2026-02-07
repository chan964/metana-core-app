import { Module, LegacyModule, StudentModule, InstructorModule, ApiResponse } from '@/types';

const API_BASE = '/api';

export async function createAdminModule(payload: {
  title: string;
  description?: string;
}): Promise<ApiResponse<Module>> {
  const response = await fetch(`${API_BASE}/modules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to create module');
  }

  return response.json();
}



export async function getAllModules(): Promise<ApiResponse<Module[]>> {
  const response = await fetch(`${API_BASE}/modules`);
  return response.json();
}

export async function getModuleById(id: string): Promise<ApiResponse<LegacyModule>> {
  const response = await fetch(`${API_BASE}/modules/${id}`);
  return response.json();
}

export async function getStudentModules(): Promise<ApiResponse<StudentModule[]>> {
  const response = await fetch(`${API_BASE}/student/modules`);
  return response.json();
}

export async function getInstructorModules(): Promise<ApiResponse<InstructorModule[]>> {
  const response = await fetch(`${API_BASE}/instructor/modules`);
  return response.json();
}

export async function createModule(module: Omit<Module, 'id' | 'createdAt'>): Promise<ApiResponse<Module>> {
  const response = await fetch(`${API_BASE}/modules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(module),
  });
  return response.json();
}

export async function updateModule(id: string, module: Partial<Module>): Promise<ApiResponse<Module>> {
  const response = await fetch(`${API_BASE}/modules/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(module),
  });
  return response.json();
}

export async function deleteModule(id: string): Promise<ApiResponse<void>> {
  const response = await fetch(`${API_BASE}/modules/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to delete module');
  }

  return response.json();
}

export async function assignInstructor(moduleId: string, instructorId: string): Promise<ApiResponse<Module>> {
  const response = await fetch(`${API_BASE}/modules/${moduleId}/instructor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ instructorId }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to assign instructor');
  }

  return response.json();
}

export async function enrollStudent(moduleId: string, studentId: string): Promise<ApiResponse<Module>> {
  const response = await fetch(`${API_BASE}/modules/${moduleId}/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ studentId }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to enroll student');
  }

  return response.json();
}

export async function markModuleReady(moduleId: string): Promise<ApiResponse<Module>> {
  const response = await fetch(`${API_BASE}/modules/${moduleId}/ready`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to mark module as ready');
  }

  return response.json();
}

export async function publishModule(moduleId: string): Promise<ApiResponse<Module>> {
  const response = await fetch(`${API_BASE}/modules/${moduleId}/publish`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to publish module');
  }

  return response.json();
}

export async function archiveModule(moduleId: string): Promise<ApiResponse<Module>> {
  const response = await fetch(`${API_BASE}/modules/${moduleId}/archive`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to archive module');
  }

  return response.json();
}
