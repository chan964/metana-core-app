import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse } from "cookie";
import { pool } from "../../lib/db.ts";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Session validation
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

    // Check role is student
    if (user.role !== "student") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { moduleId } = req.query;

    if (!moduleId || typeof moduleId !== "string") {
      return res.status(400).json({ error: "Validation: field moduleId required" });
    }

    // Get submission status
    const submissionRes = await pool.query(
      `SELECT status FROM submissions WHERE module_id = $1 AND student_id = $2`,
      [moduleId, user.id]
    );

    if (submissionRes.rowCount === 0) {
      return res.status(200).json({ status: 'draft' });
    }

    return res.status(200).json({ status: submissionRes.rows[0].status });
  } catch (err) {
    console.error("Error in /api/submissions/status:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
