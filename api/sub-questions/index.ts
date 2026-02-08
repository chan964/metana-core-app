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
    const { part_id, prompt, max_marks, order_index } = req.body;

    if (!part_id || typeof part_id !== "string") {
      return res.status(400).json({ error: "Validation: field part_id required" });
    }

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Validation: field prompt required" });
    }

    if (typeof max_marks !== "number" || !Number.isInteger(max_marks) || max_marks <= 0) {
      return res.status(400).json({ error: "Validation: field max_marks invalid" });
    }

    if (order_index !== undefined && (typeof order_index !== "number" || !Number.isInteger(order_index))) {
      return res.status(400).json({ error: "Validation: field order_index invalid" });
    }

    // Check part exists and get module_id via question
    const partRes = await pool.query(
      `SELECT q.module_id FROM parts p JOIN questions q ON p.question_id = q.id WHERE p.id = $1`,
      [part_id]
    );

    if (partRes.rowCount === 0) {
      return res.status(404).json({ error: "Not found: part" });
    }

    const moduleId = partRes.rows[0].module_id;

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

    // Insert sub_question with order_index logic
    const subQuestionId = randomUUID();
    const finalOrderIndex = order_index !== undefined 
      ? order_index 
      : (await pool.query(
          `SELECT COALESCE(MAX(order_index), 0) + 1 AS next_index FROM sub_questions WHERE part_id = $1`,
          [part_id]
        )).rows[0].next_index;

    const insertRes = await pool.query(
      `
      INSERT INTO sub_questions (id, part_id, prompt, max_marks, order_index)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, part_id, prompt, max_marks, order_index, created_at
      `,
      [subQuestionId, part_id, prompt, max_marks, finalOrderIndex]
    );

    return res.status(200).json(insertRes.rows[0]);
  } catch (err) {
    console.error("Error in /api/sub-questions:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
