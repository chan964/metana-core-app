import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool } from "../../lib/db.ts";
import { randomUUID } from "crypto";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const {
      submissionId,
      subQuestionId,
      score,
      feedback,
      instructorId,
    } = req.body;

    if (
      !submissionId ||
      !subQuestionId ||
      score === undefined ||
      !instructorId
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const submissionResult = await pool.query(
      `SELECT status FROM submissions WHERE id = $1`,
      [submissionId]
    );

    if (
      submissionResult.rowCount === 0 ||
      !["submitted", "graded"].includes(submissionResult.rows[0].status)
    ) {
      return res.status(400).json({
        success: false,
        error: "Submission is not gradable",
      });
    }

    const answerResult = await pool.query(
      `
      SELECT id
      FROM submission_answers
      WHERE submission_id = $1
      AND sub_question_id = $2
      `,
      [submissionId, subQuestionId]
    );

    if (answerResult.rowCount === 0) {
      return res.status(400).json({
        success: false,
        error: "Submission answer not found",
      });
    }

    const submissionAnswerId = answerResult.rows[0].id;

    await pool.query(
      `
      INSERT INTO grades (
        id,
        submission_answer_id,
        instructor_id,
        score,
        feedback
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (submission_answer_id)
      DO UPDATE SET
        score = EXCLUDED.score,
        feedback = EXCLUDED.feedback
      `,
      [
        randomUUID(),
        submissionAnswerId,
        instructorId,
        score,
        feedback || null,
      ]
    );

    await pool.query(
      `
      UPDATE submissions
      SET status = 'graded',
          graded_at = NOW()
      WHERE id = $1
        AND status = 'submitted'
      `,
      [submissionId]
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
}
