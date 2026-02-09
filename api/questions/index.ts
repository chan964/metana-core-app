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
    const { module_id, title, scenario_text, order_index } = req.body;

    if (!module_id || typeof module_id !== "string") {
      return res.status(400).json({ error: "Validation: field module_id required" });
    }

    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "Validation: field title required" });
    }

    if (!scenario_text || typeof scenario_text !== "string") {
      return res.status(400).json({ error: "Validation: field scenario_text required" });
    }

    if (order_index !== undefined && (typeof order_index !== "number" || !Number.isInteger(order_index))) {
      return res.status(400).json({ error: "Validation: field order_index invalid" });
    }

    // Check module exists
    const moduleRes = await pool.query(
      `SELECT status FROM modules WHERE id = $1`,
      [module_id]
    );

    if (moduleRes.rowCount === 0) {
      return res.status(404).json({ error: "Not found: module" });
    }

    // Check module is draft
    if (moduleRes.rows[0].status !== "draft") {
      return res.status(403).json({ error: "Forbidden: Module must be draft to modify content" });
    }

    // Check instructor is assigned to module
    const assignmentRes = await pool.query(
      `SELECT 1 FROM module_instructors WHERE module_id = $1 AND instructor_id = $2`,
      [module_id, user.id]
    );

    if (assignmentRes.rowCount === 0) {
      return res.status(403).json({ error: "Forbidden: instructor not assigned to module" });
    }

    // Insert question with order_index logic
    const questionId = randomUUID();
    const finalOrderIndex = order_index !== undefined 
      ? order_index 
      : (await pool.query(
          `SELECT COALESCE(MAX(order_index), 0) + 1 AS next_index FROM questions WHERE module_id = $1`,
          [module_id]
        )).rows[0].next_index;

    const insertRes = await pool.query(
      `
      INSERT INTO questions (id, module_id, title, scenario_text, order_index)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, module_id, title, scenario_text, order_index, created_at
      `,
      [questionId, module_id, title, scenario_text, finalOrderIndex]
    );

    return res.status(200).json(insertRes.rows[0]);
  } catch (err) {
    console.error("Error in /api/questions:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
