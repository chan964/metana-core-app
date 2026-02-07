import { User, ApiResponse } from '@/types';

const API_BASE = '/api';

/**
 * Get current user from Neon DB via Clerk session
 * This replaces the old login flow
 */
export async function getCurrentUser(token: string): Promise<ApiResponse<User>> {
  const response = await fetch(`${API_BASE}/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }
  
  return response.json();
}

/**
 * Logout is handled by Clerk directly
 * No backend API needed
 */
export async function logout(): Promise<void> {
  // Clerk handles logout via signOut()
  return Promise.resolve();
}



// import { User, ApiResponse } from '@/types';

// const API_BASE = '/api';

// export async function login(email: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
//   const response = await fetch(`${API_BASE}/auth/login`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ email, password }),
//   });
//   return response.json();
// }

// export async function logout(): Promise<ApiResponse<void>> {
//   const response = await fetch(`${API_BASE}/auth/logout`, {
//     method: 'POST',
//   });
//   return response.json();
// }

// export async function getCurrentUser(): Promise<ApiResponse<User>> {
//   const response = await fetch(`${API_BASE}/auth/me`);
//   return response.json();
// }
