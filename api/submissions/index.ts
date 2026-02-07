import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool } from "../../lib/db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false });
  }

  const submissionId = req.query.id as string;

  const result = await pool.query(
    `SELECT * FROM submissions WHERE id = $1`,
    [submissionId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, error: "Not found" });
  }

  res.status(200).json({ success: true, data: result.rows[0] });
}
