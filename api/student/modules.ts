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

    // Fetch published modules where student is enrolled
    const modulesRes = await pool.query(
      `
      SELECT m.id, m.title, m.status, m.created_at
      FROM modules m
      INNER JOIN module_students ms ON ms.module_id = m.id
      WHERE ms.student_id = $1
        AND m.status = 'published'
      ORDER BY m.created_at DESC
      `,
      [user.id]
    );

    return res.status(200).json(modulesRes.rows);
  } catch (err) {
    console.error("Error in /api/student/modules:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
