/**
 * @deprecated This module is deprecated. It assumed Bearer token auth; the backend uses cookie-based sessions only.
 * Use the app's auth flow instead: GET /api/me with credentials: 'include', POST /api/logout with credentials: 'include'.
 * Do not use these functions; they will throw.
 */

import { User, ApiResponse } from '@/types';

const DEPRECATED_MSG =
  'src/api/auth.ts is deprecated. Backend auth is cookie-based. Use fetch with credentials: "include" to /api/me and /api/logout.';

/**
 * @deprecated Backend uses cookie-based auth, not Bearer token. Use fetch("/api/me", { credentials: "include" }) instead.
 */
export async function getCurrentUser(_token: string): Promise<ApiResponse<User>> {
  throw new Error(DEPRECATED_MSG);
}

/**
 * @deprecated Use fetch("/api/logout", { method: "POST", credentials: "include" }) or the logout from useAuth instead.
 */
export async function logout(): Promise<void> {
  throw new Error(DEPRECATED_MSG);
}
