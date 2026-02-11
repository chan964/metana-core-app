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
    `SELECT u.id, u.role FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > now()`,
    [sessionId]
  );

  if (sessionRes.rowCount === 0) {
    return res.status(401).json({ error: "Unauthenticated" });
  }

  const user = sessionRes.rows[0];

  const { moduleId, studentId } = req.body;

  if (!moduleId || !studentId) {
    return res.status(400).json({ success: false, error: "Missing fields" });
  }

  const isAdmin = user.role === "admin";
  const isOwnStudent = user.role === "student" && studentId === user.id;
  if (!isAdmin && !isOwnStudent) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (user.role === "student") {
    const enrollmentRes = await pool.query(
      `SELECT 1 FROM module_students WHERE module_id = $1 AND student_id = $2`,
      [moduleId, user.id]
    );
    if (enrollmentRes.rowCount === 0) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  const existingRes = await pool.query(
    `
    SELECT *
    FROM submissions
    WHERE module_id = $1 AND student_id = $2
    `,
    [moduleId, studentId]
  );

  if (existingRes.rowCount > 0) {
    return res.status(200).json({ success: true, data: existingRes.rows[0] });
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
