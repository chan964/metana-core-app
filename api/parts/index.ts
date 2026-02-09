import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse } from "cookie";
import { randomUUID } from "crypto";
import { pool } from "../../lib/db.ts";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
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

    // Check instructor role
    if (user.role !== "instructor") {
      return res.status(403).json({ error: "Forbidden: instructor role required" });
    }

    // Validate request body
    const { question_id, label } = req.body;

    if (!question_id || typeof question_id !== "string") {
      return res.status(400).json({ error: "Validation: field question_id required" });
    }

    if (!label || (label !== "A" && label !== "B")) {
      return res.status(400).json({ error: "Validation: field label invalid" });
    }

    // Check question exists and get module_id
    const questionRes = await pool.query(
      `SELECT module_id FROM questions WHERE id = $1`,
      [question_id]
    );

    if (questionRes.rowCount === 0) {
      return res.status(404).json({ error: "Not found: question" });
    }

    const moduleId = questionRes.rows[0].module_id;

    // Check module is draft
    const moduleRes = await pool.query(
      `SELECT status FROM modules WHERE id = $1`,
      [moduleId]
    );

    if (moduleRes.rowCount === 0 || moduleRes.rows[0].status !== "draft") {
      return res.status(403).json({ error: "Forbidden: Module must be draft to modify content" });
    }

    // Check instructor is assigned to module
    const assignmentRes = await pool.query(
      `SELECT 1 FROM module_instructors WHERE module_id = $1 AND instructor_id = $2`,
      [moduleId, user.id]
    );

    if (assignmentRes.rowCount === 0) {
      return res.status(403).json({ error: "Forbidden: instructor not assigned to module" });
    }

    // Insert part
    const partId = randomUUID();
    const insertRes = await pool.query(
      `
      INSERT INTO parts (id, question_id, label)
      VALUES ($1, $2, $3)
      ON CONFLICT (question_id, label)
      DO UPDATE SET label = EXCLUDED.label
      RETURNING id, question_id, label
      `,
      [partId, question_id, label]
    );

    return res.status(200).json(insertRes.rows[0]);
  } catch (err) {
    console.error("Error in /api/parts:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
