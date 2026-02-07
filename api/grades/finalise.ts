import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool } from "../../lib/db.ts";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    const { submissionId } = req.body;

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        error: "submissionId is required",
      });
    }

    const result = await pool.query(
      `
      UPDATE submissions
      SET status = 'finalised',
          finalised_at = NOW()
      WHERE id = $1
        AND status = 'graded'
      RETURNING id
      `,
      [submissionId]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        success: false,
        error: "Submission is not finalisable",
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
}
