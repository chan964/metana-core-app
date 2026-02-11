import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse } from "cookie";
import { randomUUID } from "crypto";
import { pool } from "../../lib/db.ts";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

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

    if (user.role !== "instructor" && user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // API contract uses submission_answer_id / score; DB uses answer_id / marks_awarded (mapped below).
    const { submission_answer_id, score, feedback } = req.body;

    if (!submission_answer_id || typeof submission_answer_id !== "string") {
      return res.status(400).json({ error: "Validation: field submission_answer_id required" });
    }

    if (score === null || score === undefined || typeof score !== "number") {
      return res.status(400).json({ error: "Validation: field score required" });
    }

    if (score < 0) {
      return res.status(400).json({ error: "Validation: score must be >= 0" });
    }

    if (feedback !== null && feedback !== undefined && typeof feedback !== "string") {
      return res.status(400).json({ error: "Validation: field feedback must be string" });
    }

    const submissionAnswerRes = await pool.query(
      `
      SELECT
        sa.id AS submission_answer_id,
        sa.submission_id,
        sa.sub_question_id,
        s.module_id,
        s.student_id,
        s.status,
        sq.max_marks
      FROM answers sa
      JOIN submissions s ON s.id = sa.submission_id
      JOIN sub_questions sq ON sq.id = sa.sub_question_id
      WHERE sa.id = $1
      `,
      [submission_answer_id]
    );

    if (submissionAnswerRes.rowCount === 0) {
      return res.status(404).json({ error: "Answer not found" });
    }

    const submissionAnswer = submissionAnswerRes.rows[0];

    if (submissionAnswer.status !== "submitted" && submissionAnswer.status !== "finalised") {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (submissionAnswer.status === "finalised") {
      return res.status(403).json({ error: "Grades are locked after finalisation" });
    }

    if (score > submissionAnswer.max_marks) {
      return res.status(400).json({ error: "Validation: score exceeds max marks" });
    }

    if (user.role === "instructor") {
      const assignmentRes = await pool.query(
        `SELECT 1 FROM module_instructors WHERE module_id = $1 AND instructor_id = $2`,
        [submissionAnswer.module_id, user.id]
      );

      if (assignmentRes.rowCount === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const enrollmentRes = await pool.query(
      `SELECT 1 FROM module_students WHERE module_id = $1 AND student_id = $2`,
      [submissionAnswer.module_id, submissionAnswer.student_id]
    );

    if (enrollmentRes.rowCount === 0) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // DB columns: answer_id, marks_awarded (API sends submission_answer_id, score).
    const gradeRes = await pool.query(
      `
      INSERT INTO grades (
        id,
        answer_id,
        marks_awarded,
        feedback
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (answer_id)
      DO UPDATE SET
        marks_awarded = EXCLUDED.marks_awarded,
        feedback = EXCLUDED.feedback
      RETURNING id, answer_id, marks_awarded, feedback
      `,
      [
        randomUUID(),
        submission_answer_id,
        score,
        feedback ?? null
      ]
    );

    const row = gradeRes.rows[0];
    // Map DB names back to API shape: answer_id -> submission_answer_id, marks_awarded -> score.
    return res.status(200).json({
      id: row?.id,
      submission_answer_id: row?.answer_id,
      score: row?.marks_awarded,
      feedback: row?.feedback,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
