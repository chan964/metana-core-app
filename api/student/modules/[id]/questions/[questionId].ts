import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool } from "../../../../../lib/db.ts";

/**
 * GET /api/student/modules/:id/questions/:questionId
 * 
 * Student view of a single question within a published module.
 * Returns question details with parts, sub-questions, and artefacts.
 * 
 * Authorization:
 * - Student must be enrolled in the module
 * - Module must be published
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id, questionId } = req.query;
    const moduleIdStr = Array.isArray(id) ? id[0] : id;
    const questionIdStr = Array.isArray(questionId) ? questionId[0] : questionId;

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

    // 3. Check module is published
    const moduleRes = await pool.query(
      `SELECT status FROM modules WHERE id = $1`,
      [moduleIdStr]
    );

    if (moduleRes.rowCount === 0) {
      return res.status(404).json({ error: "Module not found" });
    }

    if (moduleRes.rows[0].status !== "published") {
      return res.status(403).json({ error: "Module not published" });
    }

    // 4. Check student enrollment
    const enrollmentRes = await pool.query(
      `SELECT 1 FROM module_students WHERE module_id = $1 AND student_id = $2`,
      [moduleIdStr, user.id]
    );

    if (enrollmentRes.rowCount === 0) {
      return res.status(403).json({ error: "Not enrolled in this module" });
    }

    // 5. Fetch question with parts and sub-questions
    const questionRes = await pool.query(
      `SELECT 
        q.id,
        q.title,
        q.scenario_text,
        q.module_id
       FROM questions q
       WHERE q.id = $1 AND q.module_id = $2`,
      [questionIdStr, moduleIdStr]
    );

    if (questionRes.rowCount === 0) {
      return res.status(404).json({ error: "Question not found" });
    }

    const question = questionRes.rows[0];

    // 6. Fetch parts with sub-questions
    const partsRes = await pool.query(
      `SELECT 
        p.id,
        p.label,
        json_agg(
          json_build_object(
            'id', sq.id,
            'prompt', sq.prompt,
            'max_marks', sq.max_marks,
            'order_index', sq.order_index,
            'part_id', sq.part_id
          ) ORDER BY sq.order_index ASC
        ) as sub_questions
       FROM parts p
       LEFT JOIN sub_questions sq ON sq.part_id = p.id
       WHERE p.question_id = $1
       GROUP BY p.id
       ORDER BY p.label ASC`,
      [questionIdStr]
    );

    // 7. Fetch artefacts
    const artefactsRes = await pool.query(
      `SELECT id, filename, file_type
       FROM artefacts
       WHERE question_id = $1
       ORDER BY created_at ASC`,
      [questionIdStr]
    );

    return res.status(200).json({
      id: question.id,
      title: question.title,
      scenario_text: question.scenario_text,
      parts: partsRes.rows,
      artefacts: artefactsRes.rows,
    });
  } catch (err) {
    console.error("Error in /api/student/modules/[moduleId]/questions/[questionId]:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
