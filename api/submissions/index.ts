import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse } from "cookie";
import { pool } from "../../lib/db.ts";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
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
    `
    SELECT u.id, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = $1 AND s.expires_at > now()
    `,
    [sessionId]
  );

  if (sessionRes.rowCount === 0) {
    return res.status(401).json({ error: "Unauthenticated" });
  }

  const user = sessionRes.rows[0];

  const submissionId = req.query.id as string;

  const result = await pool.query(
    `SELECT * FROM submissions WHERE id = $1`,
    [submissionId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, error: "Not found" });
  }

  const submission = result.rows[0];

  if (user.role === "admin") {
    // allowed
  } else if (user.role === "student") {
    if (submission.student_id !== user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
  } else if (user.role === "instructor") {
    const assignmentRes = await pool.query(
      `SELECT 1 FROM module_instructors WHERE module_id = $1 AND instructor_id = $2`,
      [submission.module_id, user.id]
    );

    if (assignmentRes.rowCount === 0) {
      return res.status(403).json({ error: "Forbidden" });
    }
  } else {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.status(200).json({ success: true, data: submission });
}
