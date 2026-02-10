/**
 * Test database helper — uses DATABASE_URL_TEST only.
 * NO production code or schema changes.
 *
 * Tables truncated (in dependency order for TRUNCATE ... CASCADE):
 * - grades (references submission_answers, users)
 * - submission_answers (references submissions, sub_questions)
 * - submissions (references modules, users)
 * - sessions (references users)
 * - artefacts (references modules, questions, users)
 * - sub_questions (references parts)
 * - parts (references questions)
 * - questions (references modules)
 * - module_instructors (references modules, users)
 * - module_students (references modules, users)
 * - modules (no FK to other app tables)
 *
 * Order is safe: we do NOT truncate users. We list every table that references
 * users or other listed tables; CASCADE then truncates only those. No table in
 * our list has a FK from users, so users is never truncated. After truncation
 * we DELETE FROM users WHERE role != 'admin' to remove non-admin users only.
 *
 * Admin preservation: admin is identified by role = 'admin' (not by ID). We
 * never truncate users; we only delete rows where role <> 'admin'.
 */

import { Pool } from "pg";

const TEST_URL = process.env.DATABASE_URL_TEST;
if (!TEST_URL) {
  throw new Error("DATABASE_URL_TEST is not set");
}

const testPool = new Pool({
  connectionString: TEST_URL,
  ssl: TEST_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});

/**
 * Tables to truncate — real names as in codebase. Order does not affect
 * TRUNCATE CASCADE for these; we exclude users so admin is preserved.
 */
const TABLES_TO_TRUNCATE = [
  "grades",
  "submission_answers",
  "submissions",
  "sessions",
  "artefacts",
  "sub_questions",
  "parts",
  "questions",
  "module_instructors",
  "module_students",
  "modules",
] as const;

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

/**
 * Reset the test database: truncate all data tables, then delete every user
 * except those with role = 'admin'. Does not truncate users so admin row(s)
 * remain.
 */
export async function resetDatabase(): Promise<void> {
  const client = await testPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `TRUNCATE ${TABLES_TO_TRUNCATE.join(", ")} RESTART IDENTITY CASCADE`
    );
    await client.query("DELETE FROM users WHERE role != 'admin'");
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Return the admin user row. Identified by role = 'admin' (no hardcoded IDs).
 * Throws if no admin user exists after reset.
 */
export async function getAdminUser(): Promise<AdminUser> {
  const res = await testPool.query(
    `SELECT id, email, full_name, role, created_at FROM users WHERE role = 'admin' LIMIT 1`
  );
  if (!res.rows.length) {
    throw new Error("No admin user found in test database (ensure seed or fixture creates one)");
  }
  return res.rows[0] as AdminUser;
}
