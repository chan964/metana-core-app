import { User, ApiResponse } from '@/types';

const API_BASE = '/api';

/**
 * DEV ONLY: temporary auth bypass for UI flow testing
 * Remove when Clerk auth is integrated
 */
const DEV_BYPASS_AUTH = true;

const mockAdminUser: User = {
  id: 'dev-admin',
  email: 'admin@dev.local',
  role: 'admin',
  name: 'Dev Admin',
  createdAt: new Date().toISOString(),
};

export async function login(
  email: string,
  password: string
): Promise<ApiResponse<{ user: User; token: string }>> {
  if (DEV_BYPASS_AUTH) {
    return Promise.resolve({
      success: true,
      data: {
        user: mockAdminUser,
        token: 'dev-token',
      },
    });
  }

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  return response.json();
}

export async function logout(): Promise<ApiResponse<void>> {
  if (DEV_BYPASS_AUTH) {
    return Promise.resolve({
      success: true,
      data: undefined,
    });
  }

  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
  });

  return response.json();
}

export async function getCurrentUser(): Promise<ApiResponse<User>> {
  if (DEV_BYPASS_AUTH) {
    return Promise.resolve({
      success: true,
      data: mockAdminUser,
    });
  }

  const response = await fetch(`${API_BASE}/auth/me`);
  return response.json();
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
