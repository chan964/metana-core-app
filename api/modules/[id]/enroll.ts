import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool } from "../../../lib/db.ts";

/**
 * POST /api/modules/:id/enroll
 * 
 * Admin enrolls a student in a module
 * 
 * Invariants enforced:
 * - Only admins can enroll students
 * - Cannot enroll same student twice (duplicate prevention)
 * - Uses junction table module_students for many-to-many relationship
 * - No explicit module status check (students can be pre-enrolled before publication)
 * 
 * Fails with 400 if student already enrolled (idempotent).
 * Fails with 403 if not admin role.
 * 
 * Note: Pre-enrollment is allowed. Students appear in roster before module publish.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const sessionId = req.cookies?.session;

    if (!sessionId) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const sessionRes = await pool.query(
      `
      SELECT u.id, u.role
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
        AND s.expires_at > NOW()
      `,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) {
      return res.status(401).json({ error: "Invalid session" });
    }

    if (sessionRes.rows[0].role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    if (req.method === "POST") {
      const { id } = req.query;
      const { studentId } = req.body;

      if (!studentId || typeof studentId !== "string") {
        return res.status(400).json({ error: "studentId is required" });
      }

      // Check if student is already enrolled
      const existingEnrollment = await pool.query(
        `
        SELECT 1 FROM module_students
        WHERE module_id = $1 AND student_id = $2
        `,
        [id, studentId]
      );

      if (existingEnrollment.rowCount && existingEnrollment.rowCount > 0) {
        return res.status(400).json({
          error: "Student is already enrolled in this module",
        });
      }

      // Insert into module_students junction table
      await pool.query(
        `
        INSERT INTO module_students (module_id, student_id)
        VALUES ($1, $2)
        `,
        [id, studentId]
      );

      // Return updated module with instructors and enrolled students
      const result = await pool.query(
        `
        SELECT
          m.id,
          m.title,
          m.description,
          m.status,
          m.created_at,
          m.submission_start,
          m.submission_end,
          COALESCE(
            json_agg(
              json_build_object(
                'id', u.id,
                'full_name', u.full_name,
                'email', u.email
              )
            ) FILTER (WHERE u.id IS NOT NULL AND mi.instructor_id IS NOT NULL),
            '[]'
          ) AS instructors,
          COALESCE(
            json_agg(
              json_build_object(
                'id', s.id,
                'full_name', s.full_name,
                'email', s.email
              )
            ) FILTER (WHERE s.id IS NOT NULL AND ms.student_id IS NOT NULL),
            '[]'
          ) AS students
        FROM modules m
        LEFT JOIN module_instructors mi ON mi.module_id = m.id
        LEFT JOIN users u ON u.id = mi.instructor_id
        LEFT JOIN module_students ms ON ms.module_id = m.id
        LEFT JOIN users s ON s.id = ms.student_id
        WHERE m.id = $1
        GROUP BY m.id
        `,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Module not found" });
      }

      return res.status(200).json({ data: result.rows[0] });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("api/modules/[id]/enroll error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
