import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool } from "../../lib/db.ts";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  const { submissionId } = req.body;

  const result = await pool.query(
    `
    UPDATE submissions
    SET status = 'submitted', submitted_at = NOW()
    WHERE id = $1 AND status = 'draft'
    RETURNING *
    `,
    [submissionId]
  );

  if (result.rowCount === 0) {
    return res.status(400).json({
      success: false,
      error: "Submission not in draft state",
    });
  }

  res.status(200).json({ success: true, data: result.rows[0] });
}
