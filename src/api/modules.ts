import { Module, StudentModule, InstructorModule, ApiResponse } from '@/types';

const API_BASE = '/api';

// Get all modules (admin)
export async function getAllModules(): Promise<ApiResponse<Module[]>> {
  const response = await fetch(`${API_BASE}/modules`);
  return response.json();
}

// Get module by ID
export async function getModuleById(id: string): Promise<ApiResponse<Module>> {
  const response = await fetch(`${API_BASE}/modules/${id}`);
  return response.json();
}

// Get modules assigned to student
export async function getStudentModules(): Promise<ApiResponse<StudentModule[]>> {
  const response = await fetch(`${API_BASE}/student/modules`);
  return response.json();
}

// Get modules assigned to instructor
export async function getInstructorModules(): Promise<ApiResponse<InstructorModule[]>> {
  const response = await fetch(`${API_BASE}/instructor/modules`);
  return response.json();
}

// Create module (admin)
export async function createModule(module: Omit<Module, 'id' | 'createdAt'>): Promise<ApiResponse<Module>> {
  const response = await fetch(`${API_BASE}/modules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(module),
  });
  return response.json();
}

// Update module (admin)
export async function updateModule(id: string, module: Partial<Module>): Promise<ApiResponse<Module>> {
  const response = await fetch(`${API_BASE}/modules/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(module),
  });
  return response.json();
}

// Delete module (admin)
export async function deleteModule(id: string): Promise<ApiResponse<void>> {
  const response = await fetch(`${API_BASE}/modules/${id}`, {
    method: 'DELETE',
  });
  return response.json();
}

// Assign instructor to module (admin)
export async function assignInstructor(moduleId: string, instructorId: string): Promise<ApiResponse<Module>> {
  const response = await fetch(`${API_BASE}/modules/${moduleId}/instructor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instructorId }),
  });
  return response.json();
}

// Enroll student in module (admin)
export async function enrollStudent(moduleId: string, studentId: string): Promise<ApiResponse<void>> {
  const response = await fetch(`${API_BASE}/modules/${moduleId}/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId }),
  });
  return response.json();
}
