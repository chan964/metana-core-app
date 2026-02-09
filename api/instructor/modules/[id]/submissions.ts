import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse } from "cookie";
import { pool } from "../../../../lib/db.ts";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Session validation
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const cookies = parse(cookieHeader);
    const sessionId = cookies.session;

    if (!sessionId) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const sessionRes = await pool.query(
      `
      SELECT u.id, u.role
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
        AND s.expires_at > now()
      `,
      [sessionId]
    );

    if (!sessionRes.rowCount || sessionRes.rowCount === 0) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const user = sessionRes.rows[0];

    // Check instructor role
    if (user.role !== "instructor") {
      return res.status(403).json({ error: "Forbidden: instructor role required" });
    }

    const { id: moduleId } = req.query;
    const moduleIdStr = Array.isArray(moduleId) ? moduleId[0] : moduleId;

    if (!moduleIdStr || typeof moduleIdStr !== "string") {
      return res.status(400).json({ error: "Validation: field moduleId required" });
    }

    // Check module exists
    const moduleRes = await pool.query(
      `SELECT 1 FROM modules WHERE id = $1`,
      [moduleIdStr]
    );

    if (moduleRes.rowCount === 0) {
      return res.status(404).json({ error: "Module not found" });
    }

    // Check instructor is assigned to module
    const assignmentRes = await pool.query(
      `SELECT 1 FROM module_instructors WHERE module_id = $1 AND instructor_id = $2`,
      [moduleIdStr, user.id]
    );

    if (assignmentRes.rowCount === 0) {
      return res.status(403).json({ error: "Forbidden: instructor not assigned to module" });
    }

    const submissionsRes = await pool.query(
      `
      SELECT
        sub.id AS submission_id,
        sub.student_id,
        u.full_name AS student_name,
        sub.status,
        sub.submitted_at
      FROM submissions sub
      JOIN users u ON u.id = sub.student_id
      WHERE sub.module_id = $1
        AND sub.status IN ('submitted', 'finalised')
      ORDER BY sub.submitted_at DESC
      `,
      [moduleIdStr]
    );

    return res.status(200).json(submissionsRes.rows);
  } catch (err) {
    console.error("Error in /api/instructor/modules/[id]/submissions:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
