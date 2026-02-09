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

    // Check instructor is assigned to module
    const assignmentRes = await pool.query(
      `SELECT 1 FROM module_instructors WHERE module_id = $1 AND instructor_id = $2`,
      [moduleId, user.id]
    );

    if (assignmentRes.rowCount === 0) {
      return res.status(403).json({ error: "Forbidden: instructor not assigned to module" });
    }

    const submissionsRes = await pool.query(
      `
      SELECT
        sub.id,
        sub.module_id,
        sub.student_id,
        sub.status,
        sub.submitted_at,
        sub.created_at,
        COALESCE(u.full_name, u.email) AS student_name
      FROM submissions sub
      JOIN users u ON u.id = sub.student_id
      WHERE sub.module_id = $1
      ORDER BY sub.created_at DESC
      `,
      [moduleId]
    );

    const data = submissionsRes.rows.map((row) => ({
      id: row.id,
      moduleId: row.module_id,
      studentId: row.student_id,
      studentName: row.student_name,
      state: row.status,
      answers: [],
      grades: [],
      totalScore: undefined,
      submittedAt: row.submitted_at,
      gradedAt: undefined,
      finalisedAt: undefined,
      createdAt: row.created_at
    }));

    return res.status(200).json({ data });
  } catch (err) {
    console.error("Error in /api/instructor/modules/[id]/submissions:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
