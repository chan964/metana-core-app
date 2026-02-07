import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool } from "../../../lib/db";

/**
 * PATCH /api/modules/:id/archive
 * 
 * Admin archives a published module (hides from student enrollment)
 * 
 * Invariants enforced:
 * - Only admins can archive modules
 * - Only published modules can be archived
 * - Draft modules cannot be archived (use DELETE instead)
 * 
 * Archiving is the terminal state for a published module.
 * Archived modules hide from new enrollment but preserve all student submissions.
 * Fails with 403 if any invariant is violated.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.query;
    const moduleId = Array.isArray(id) ? id[0] : id;

    // 1. Get current user from session
    const sessionId = req.cookies?.session;
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const userRes = await pool.query(
      `SELECT u.id, u.role FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.expires_at > NOW()`,
      [sessionId]
    );

    if (userRes.rowCount === 0) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const user = userRes.rows[0];

    // 2. Check role = admin
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can archive modules" });
    }

    // 3. Fetch module
    const moduleRes = await pool.query(
      `SELECT status FROM modules WHERE id = $1`,
      [moduleId]
    );

    if (moduleRes.rowCount === 0) {
      return res.status(404).json({ error: "Module not found" });
    }

    const module = moduleRes.rows[0];

    // 4. Check status = published
    if (module.status !== "published") {
      return res.status(403).json({ error: "Only published modules can be archived" });
    }

    // 5. Update module status to archived
    const updateRes = await pool.query(
      `UPDATE modules 
       SET status = 'archived'
       WHERE id = $1 
       RETURNING *`,
      [moduleId]
    );

    return res.status(200).json({
      success: true,
      data: updateRes.rows[0],
    });
  } catch (error) {
    console.error("Error archiving module:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
