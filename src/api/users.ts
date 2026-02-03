import { User, UserRole, ApiResponse } from '@/types';

const API_BASE = '/api';

// Get all users (admin)
export async function getAllUsers(): Promise<ApiResponse<User[]>> {
  const response = await fetch(`${API_BASE}/users`);
  return response.json();
}

// Get user by ID (admin)
export async function getUserById(id: string): Promise<ApiResponse<User>> {
  const response = await fetch(`${API_BASE}/users/${id}`);
  return response.json();
}

// Create user (admin)
export async function createUser(user: { email: string; name: string; role: UserRole; password: string }): Promise<ApiResponse<User>> {
  const response = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
  return response.json();
}

// Update user (admin)
export async function updateUser(id: string, user: Partial<User>): Promise<ApiResponse<User>> {
  const response = await fetch(`${API_BASE}/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
  return response.json();
}

// Delete user (admin)
export async function deleteUser(id: string): Promise<ApiResponse<void>> {
  const response = await fetch(`${API_BASE}/users/${id}`, {
    method: 'DELETE',
  });
  return response.json();
}

// Get users by role (admin)
export async function getUsersByRole(role: UserRole): Promise<ApiResponse<User[]>> {
  const response = await fetch(`${API_BASE}/users?role=${role}`);
  return response.json();
}
