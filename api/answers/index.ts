import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse } from "cookie";
import { randomUUID } from "crypto";
import { pool } from "../../lib/db.ts";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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

    if (req.method === "GET") {
      const { questionId } = req.query;

      if (!questionId || typeof questionId !== "string") {
        return res.status(400).json({ error: "Validation: field questionId required" });
      }

      // Check question exists and get module_id
      const questionRes = await pool.query(
        `SELECT module_id FROM questions WHERE id = $1`,
        [questionId]
      );

      if (questionRes.rowCount === 0) {
        return res.status(404).json({ error: "Not found: question" });
      }

      const moduleId = questionRes.rows[0].module_id;

      // Check student is enrolled
      const enrollmentRes = await pool.query(
        `SELECT 1 FROM module_students WHERE module_id = $1 AND student_id = $2`,
        [moduleId, user.id]
      );

      if (enrollmentRes.rowCount === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Get or create submission (draft)
      let submissionId: string;
      const submissionRes = await pool.query(
        `SELECT id FROM submissions WHERE module_id = $1 AND student_id = $2`,
        [moduleId, user.id]
      );

      if (submissionRes.rowCount === 0) {
        // Create draft submission
        submissionId = randomUUID();
        await pool.query(
          `INSERT INTO submissions (id, module_id, student_id, status, created_at)
           VALUES ($1, $2, $3, 'draft', now())`,
          [submissionId, moduleId, user.id]
        );
      } else {
        submissionId = submissionRes.rows[0].id;
      }

      // Fetch draft answers for this question
      const answersRes = await pool.query(
        `
        SELECT sa.id, sa.sub_question_id, sa.answer_text
        FROM submission_answers sa
        JOIN sub_questions sq ON sq.id = sa.sub_question_id
        JOIN parts p ON p.id = sq.part_id
        WHERE sa.submission_id = $1
          AND p.question_id = $2
        `,
        [submissionId, questionId]
      );

      return res.status(200).json({
        answers: answersRes.rows
      });
    }

    if (req.method === "POST") {
      const { sub_question_id, answer_text } = req.body;

      if (!sub_question_id || typeof sub_question_id !== "string") {
        return res.status(400).json({ error: "Validation: field sub_question_id required" });
      }

      if (typeof answer_text !== "string") {
        return res.status(400).json({ error: "Validation: field answer_text must be string" });
      }

      // Get sub-question and verify it exists
      const subQuestionRes = await pool.query(
        `
        SELECT q.module_id
        FROM sub_questions sq
        JOIN parts p ON p.id = sq.part_id
        JOIN questions q ON q.id = p.question_id
        WHERE sq.id = $1
        `,
        [sub_question_id]
      );

      if (subQuestionRes.rowCount === 0) {
        return res.status(404).json({ error: "Not found: sub-question" });
      }

      const moduleId = subQuestionRes.rows[0].module_id;

      // Check student is enrolled
      const enrollmentRes = await pool.query(
        `SELECT 1 FROM module_students WHERE module_id = $1 AND student_id = $2`,
        [moduleId, user.id]
      );

      if (enrollmentRes.rowCount === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Get or create submission (draft)
      let submissionId: string;
      const submissionRes = await pool.query(
        `SELECT id, status FROM submissions WHERE module_id = $1 AND student_id = $2`,
        [moduleId, user.id]
      );

      if (submissionRes.rowCount === 0) {
        // Create draft submission
        submissionId = randomUUID();
        await pool.query(
          `INSERT INTO submissions (id, module_id, student_id, status, created_at)
           VALUES ($1, $2, $3, 'draft', now())`,
          [submissionId, moduleId, user.id]
        );
      } else {
        submissionId = submissionRes.rows[0].id;
        
        // Check if submission is still draft
        if (submissionRes.rows[0].status !== "draft") {
          return res.status(403).json({ error: "Cannot modify submitted answers" });
        }
      }

      // Insert or update answer (idempotent)
      const answerId = randomUUID();
      await pool.query(
        `
        INSERT INTO submission_answers (id, submission_id, sub_question_id, answer_text, created_at, updated_at)
        VALUES ($1, $2, $3, $4, now(), now())
        ON CONFLICT (submission_id, sub_question_id)
        DO UPDATE SET answer_text = EXCLUDED.answer_text, updated_at = now()
        `,
        [answerId, submissionId, sub_question_id, answer_text]
      );

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Error in /api/answers:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
