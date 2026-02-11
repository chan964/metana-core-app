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
      return res.status(403).json({ error: "Forbidden: Not a student" });
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

      if (!enrollmentRes.rowCount || enrollmentRes.rowCount === 0) {
        return res.status(403).json({ error: "Forbidden: Not enrolled in module" });
      }

      // Get or create submission
      // Note: We fetch answers for BOTH draft and submitted submissions
      // Students need to see their answers even after submission (read-only)
      let submissionId: string;
      const submissionRes = await pool.query(
        `SELECT id, status FROM submissions WHERE module_id = $1 AND student_id = $2 ORDER BY COALESCE(submitted_at, created_at) DESC LIMIT 1`,
        [moduleId, user.id]
      );

      const submissionStatus =
        submissionRes.rowCount && submissionRes.rows[0]
          ? (submissionRes.rows[0].status as string)
          : "draft";

      if (submissionRes.rowCount === 0) {
        // Create draft submission only if no submission exists
        // Use ON CONFLICT to handle race conditions when multiple requests arrive simultaneously
        submissionId = randomUUID();
        const insertRes = await pool.query(
          `INSERT INTO submissions (id, module_id, student_id, status, created_at)
           VALUES ($1, $2, $3, 'draft', now())
           ON CONFLICT (module_id, student_id) DO NOTHING
           RETURNING id`,
          [submissionId, moduleId, user.id]
        );
        
        // If INSERT was skipped due to conflict, fetch the existing submission
        if (insertRes.rowCount === 0) {
          const existingRes = await pool.query(
            `SELECT id, status FROM submissions WHERE module_id = $1 AND student_id = $2`,
            [moduleId, user.id]
          );
          submissionId = existingRes.rows[0].id;
        }
      } else {
        submissionId = submissionRes.rows[0].id;
      }

      const allowGrades =
        submissionStatus === "submitted" ||
        submissionStatus === "finalised";

      if (!allowGrades) {
        // Draft: return answers only; do NOT return grades
        const answersRes = await pool.query(
          `
          SELECT sa.id, sa.sub_question_id, sa.answer_text
          FROM answers sa
          JOIN sub_questions sq ON sq.id = sa.sub_question_id
          JOIN parts p ON p.id = sq.part_id
          JOIN questions q ON q.id = p.question_id
          WHERE sa.submission_id = $1
            AND q.id = $2
          `,
          [submissionId, questionId]
        );
        return res.status(200).json({
          answers: answersRes.rows,
        });
      }

      // Submitted or finalised: include read-only grade per answer (join answers → grades)
      const answersRes = await pool.query(
        `
        SELECT sa.id, sa.sub_question_id, sa.answer_text, g.marks_awarded, g.feedback
        FROM answers sa
        JOIN sub_questions sq ON sq.id = sa.sub_question_id
        JOIN parts p ON p.id = sq.part_id
        JOIN questions q ON q.id = p.question_id
        LEFT JOIN grades g ON g.answer_id = sa.id
        WHERE sa.submission_id = $1
          AND q.id = $2
        `,
        [submissionId, questionId]
      );

      const answers = answersRes.rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        sub_question_id: row.sub_question_id,
        answer_text: row.answer_text,
        grade: {
          marks_awarded: row.marks_awarded ?? null,
          feedback: row.feedback ?? null,
        },
      }));

      return res.status(200).json({
        answers,
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

      if (!enrollmentRes.rowCount || enrollmentRes.rowCount === 0) {
        return res.status(403).json({ error: "Forbidden: Not enrolled in module" });
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
        INSERT INTO answers (id, submission_id, sub_question_id, answer_text)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (submission_id, sub_question_id)
        DO UPDATE SET answer_text = EXCLUDED.answer_text
        `,
        [answerId, submissionId, sub_question_id, answer_text]
      );

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("Error in /api/answers:", err);
    const isDev = process.env.NODE_ENV !== "production";
    return res.status(500).json({
      error: "Internal server error",
      ...(isDev && { detail: message, stack }),
    });
  }
}
