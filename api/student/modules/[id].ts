import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse } from "cookie";
import { pool } from "../../../lib/db.ts";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.query;
    const moduleId = Array.isArray(id) ? id[0] : id;

    if (!moduleId || typeof moduleId !== "string") {
      return res.status(400).json({ error: "Validation: field module_id required" });
    }

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

    // Fetch module and check status
    const moduleRes = await pool.query(
      `
      SELECT m.id, m.title, m.description, m.status
      FROM modules m
      WHERE m.id = $1
      `,
      [moduleId]
    );

    if (moduleRes.rowCount === 0) {
      return res.status(404).json({ error: "Not found: module" });
    }

    const module = moduleRes.rows[0];

    // Check module is published
    if (module.status !== "published") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Check student is enrolled
    const enrollmentRes = await pool.query(
      `
      SELECT 1 FROM module_students
      WHERE module_id = $1 AND student_id = $2
      `,
      [moduleId, user.id]
    );

    if (enrollmentRes.rowCount === 0) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Fetch questions for this module
    const questionsRes = await pool.query(
      `
      SELECT id, title, scenario_text, order_index
      FROM questions
      WHERE module_id = $1
      ORDER BY order_index ASC
      `,
      [moduleId]
    );

    return res.status(200).json({
      id: module.id,
      title: module.title,
      description: module.description,
      status: module.status,
      questions: questionsRes.rows
    });
  } catch (err) {
    console.error("Error in /api/student/modules/[id]:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
