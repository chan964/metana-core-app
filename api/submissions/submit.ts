import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse } from "cookie";
import { pool } from "../../lib/db.ts";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
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

    // Check role is student
    if (user.role !== "student") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { moduleId } = req.body;

    if (!moduleId || typeof moduleId !== "string") {
      return res.status(400).json({ error: "Validation: field moduleId required" });
    }

    // Check module is published
    const moduleRes = await pool.query(
      `SELECT status FROM modules WHERE id = $1`,
      [moduleId]
    );

    if (moduleRes.rowCount === 0) {
      return res.status(404).json({ error: "Not found: module" });
    }

    if (moduleRes.rows[0].status !== "published") {
      return res.status(403).json({ error: "Module is not published" });
    }

    // Check student is enrolled
    const enrollmentRes = await pool.query(
      `SELECT 1 FROM module_students WHERE module_id = $1 AND student_id = $2`,
      [moduleId, user.id]
    );

    if (enrollmentRes.rowCount === 0) {
      return res.status(403).json({ error: "Not enrolled in this module" });
    }

    // Get submission
    const submissionRes = await pool.query(
      `SELECT id, status FROM submissions WHERE module_id = $1 AND student_id = $2`,
      [moduleId, user.id]
    );

    if (submissionRes.rowCount === 0) {
      return res.status(400).json({ error: "No draft submission found" });
    }

    const submission = submissionRes.rows[0];

    // Check submission is in draft state
    if (submission.status !== "draft") {
      return res.status(400).json({ error: "Submission already submitted" });
    }

    // Validate ALL sub-questions have non-empty answers
    const validationRes = await pool.query(
      `
      SELECT COUNT(*) as total_sub_questions,
             COUNT(sa.id) as answered_sub_questions,
             COUNT(CASE WHEN sa.answer_text IS NOT NULL AND TRIM(sa.answer_text) != '' THEN 1 END) as non_empty_answers
      FROM sub_questions sq
      JOIN parts p ON p.id = sq.part_id
      JOIN questions q ON q.id = p.question_id
      LEFT JOIN answers sa ON sa.sub_question_id = sq.id AND sa.submission_id = $1
      WHERE q.module_id = $2
      `,
      [submission.id, moduleId]
    );

    const validation = validationRes.rows[0];
    const totalSubQuestions = parseInt(validation.total_sub_questions);
    const nonEmptyAnswers = parseInt(validation.non_empty_answers);

    if (nonEmptyAnswers < totalSubQuestions) {
      return res.status(400).json({ 
        error: "All questions must be answered before submission"
      });
    }

    // Mark submission as submitted
    await pool.query(
      `
      UPDATE submissions
      SET status = 'submitted', submitted_at = now()
      WHERE id = $1
      `,
      [submission.id]
    );

    return res.status(200).json({ 
      success: true,
      message: "Module submitted successfully"
    });
  } catch (err) {
    console.error("Error in /api/submissions/submit:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
