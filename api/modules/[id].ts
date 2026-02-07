import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool } from "../../lib/db";

/**
 * DELETE /api/modules/:id
 * 
 * Admin deletes a module (only draft modules can be deleted)
 * 
 * Validation:
 * - Role = admin
 * - Status = draft (cannot delete published/archived modules)
 * - No enrolled students (defensive check)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "DELETE") {
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
      return res.status(403).json({ error: "Only admins can delete modules" });
    }

    // 3. Fetch module
    const moduleRes = await pool.query(
      `SELECT id, title, status FROM modules WHERE id = $1`,
      [moduleId]
    );

    if (moduleRes.rowCount === 0) {
      return res.status(404).json({ error: "Module not found" });
    }

    const module = moduleRes.rows[0];

    // 4. Check status = draft
    // Invariant: Only draft modules can be deleted.
    // Published/archived modules are immutable and contain student data.
    if (module.status !== "draft") {
      return res.status(403).json({ 
        error: `Cannot delete ${module.status} module. Only draft modules can be deleted.`
      });
    }

    // 5. Defensive: Check no students are enrolled
    // This should never happen if module is draft-only, but fail loudly if it does
    const enrollmentRes = await pool.query(
      `SELECT COUNT(*) as count FROM module_students WHERE module_id = $1`,
      [moduleId]
    );

    if (enrollmentRes.rows[0].count > 0) {
      return res.status(403).json({ 
        error: "Cannot delete module with enrolled students. This is an invariant violation."
      });
    }

    // 6. Delete the module (cascading deletes handle related records)
    const deleteRes = await pool.query(
      `DELETE FROM modules WHERE id = $1 RETURNING id, title`,
      [moduleId]
    );

    return res.status(200).json({
      success: true,
      data: { id: deleteRes.rows[0].id },
      message: `Module "${deleteRes.rows[0].title}" deleted successfully`
    });
  } catch (error) {
    console.error("Error deleting module:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
