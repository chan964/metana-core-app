import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool } from "../../../lib/db.ts";

/**
 * PATCH /api/modules/:id/publish
 * 
 * Admin publishes a module (makes it available to students)
 * 
 * Invariants enforced:
 * - Only admins can publish modules
 * - Only draft modules can be published
 * - Module must be marked as ready_for_publish by instructor
 * - Module must have an assigned instructor
 * 
 * Once published, module status becomes immutable (only archive is allowed).
 * Published modules are available for student enrollment and submissions.
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
      return res.status(403).json({ error: "Only admins can publish modules" });
    }

    // 3. Fetch module
    const moduleRes = await pool.query(
      `SELECT status, ready_for_publish FROM modules WHERE id = $1`,
      [moduleId]
    );

    if (moduleRes.rowCount === 0) {
      return res.status(404).json({ error: "Module not found" });
    }

    const module = moduleRes.rows[0];

    // 4. Check status = draft
    if (module.status !== "draft") {
      return res.status(403).json({ error: "Module must be in draft status to publish" });
    }

    // 5. Check ready_for_publish = true
    if (!module.ready_for_publish) {
      return res.status(403).json({ error: "Module must be marked as ready before publishing" });
    }

    // 6. Check instructor assigned
    const assignedRes = await pool.query(
      `SELECT 1 FROM module_instructors WHERE module_id = $1 LIMIT 1`,
      [moduleId]
    );

    if (assignedRes.rowCount === 0) {
      return res.status(403).json({ error: "Module must have an assigned instructor" });
    }

    // 7. Update module status to published
    const updateRes = await pool.query(
      `UPDATE modules 
       SET status = 'published'::module_status, published_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [moduleId]
    );

    return res.status(200).json({
      success: true,
      data: updateRes.rows[0],
    });
  } catch (error) {
    console.error("Error publishing module:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
