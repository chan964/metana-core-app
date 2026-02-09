import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool } from "../../../../lib/db.ts";

/**
 * GET /api/student/modules/:id/progress
 * 
 * Returns progress data for a module:
 * - Total number of sub-questions
 * - Number of answered sub-questions (non-empty answers)
 * - Progress percentage
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.query;
    const moduleId = Array.isArray(id) ? id[0] : id;

    // 1. Session validation
    const sessionId = req.cookies?.session;
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const sessionRes = await pool.query(
      `SELECT u.id, u.role FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.expires_at > NOW()`,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const user = sessionRes.rows[0];

    // 2. Role check
    if (user.role !== "student") {
      return res.status(403).json({ error: "Students only" });
    }

    // 3. Check student enrollment
    const enrollmentRes = await pool.query(
      `SELECT 1 FROM module_students WHERE module_id = $1 AND student_id = $2`,
      [moduleId, user.id]
    );

    if (enrollmentRes.rowCount === 0) {
      return res.status(403).json({ error: "Not enrolled in this module" });
    }

    // 4. Get total sub-questions count for this module
    const totalRes = await pool.query(
      `SELECT COUNT(sq.id) as total
       FROM sub_questions sq
       JOIN parts p ON p.id = sq.part_id
       JOIN questions q ON q.id = p.question_id
       WHERE q.module_id = $1`,
      [moduleId]
    );

    const total = parseInt(totalRes.rows[0]?.total || '0');

    // 5. Get submission for this student
    const submissionRes = await pool.query(
      `SELECT id FROM submissions WHERE module_id = $1 AND student_id = $2`,
      [moduleId, user.id]
    );

    let answered = 0;

    if (submissionRes.rowCount > 0) {
      const submissionId = submissionRes.rows[0].id;

      // 6. Count answered sub-questions (non-empty answers)
      const answeredRes = await pool.query(
        `SELECT COUNT(sa.id) as answered
         FROM submission_answers sa
         JOIN sub_questions sq ON sq.id = sa.sub_question_id
         JOIN parts p ON p.id = sq.part_id
         JOIN questions q ON q.id = p.question_id
         WHERE sa.submission_id = $1
           AND q.module_id = $2
           AND sa.answer_text IS NOT NULL
           AND TRIM(sa.answer_text) != ''`,
        [submissionId, moduleId]
      );

      answered = parseInt(answeredRes.rows[0]?.answered || '0');
    }

    // 7. Calculate percentage
    const percentage = total > 0 ? Math.round((answered / total) * 100) : 0;

    return res.status(200).json({
      total,
      answered,
      percentage,
    });
  } catch (err) {
    console.error("Error in /api/student/modules/[id]/progress:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
