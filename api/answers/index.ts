import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse } from "cookie";
import { pool } from "../../lib/db.ts";
import { randomUUID } from "crypto";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
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
      `SELECT 1 FROM sessions WHERE id = $1 AND expires_at > now()`,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    // SAVE ANSWER (draft only)
    if (req.method === "POST") {
      const { submissionId, subQuestionId, answerText } = req.body;

      if (!submissionId || !subQuestionId) {
        return res.status(400).json({ success: false, error: "Missing fields" });
      }

      // Check submission state
      const submission = await pool.query(
        `SELECT status FROM submissions WHERE id = $1`,
        [submissionId]
      );

      if (submission.rowCount === 0) {
        return res.status(404).json({ success: false, error: "Submission not found" });
      }

      if (submission.rows[0].status !== "draft") {
        return res.status(403).json({
          success: false,
          error: "Submission locked",
        });
      }

      // Upsert answer
      await pool.query(
        `
        INSERT INTO submission_answers (id, submission_id, sub_question_id, answer_text)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (submission_id, sub_question_id)
        DO UPDATE SET answer_text = EXCLUDED.answer_text
        `,
        [randomUUID(), submissionId, subQuestionId, answerText || ""]
      );

      return res.status(200).json({ success: true });
    }

    // GET ANSWERS
    if (req.method === "GET") {
      const submissionId = req.query.submissionId as string;

      const result = await pool.query(
        `SELECT * FROM submission_answers WHERE submission_id = $1`,
        [submissionId]
      );

      return res.status(200).json({ success: true, data: result.rows });
    }

    return res.status(405).json({ success: false });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}
