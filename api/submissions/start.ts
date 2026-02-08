import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse } from "cookie";
import { pool } from "../../lib/db.ts";
import { randomUUID } from "crypto";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
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
    `SELECT 1 FROM sessions WHERE id = $1 AND expires_at > now()`,
    [sessionId]
  );

  if (sessionRes.rowCount === 0) {
    return res.status(401).json({ error: "Unauthenticated" });
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
