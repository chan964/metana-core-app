import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool } from "../../lib/db.ts";
import { randomUUID } from "crypto";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  const { moduleId, studentId } = req.body;

  if (!moduleId || !studentId) {
    return res.status(400).json({ success: false, error: "Missing fields" });
  }

  const result = await pool.query(
    `
    INSERT INTO submissions (id, module_id, student_id, status)
    VALUES ($1, $2, $3, 'draft')
    RETURNING *
    `,
    [randomUUID(), moduleId, studentId]
  );

  res.status(201).json({ success: true, data: result.rows[0] });
}
