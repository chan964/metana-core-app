import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse } from "cookie";
import { pool } from "../../lib/db.ts";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === "PATCH" || req.method === "PUT") {
    // UPDATE question endpoint
    try {
      const { id } = req.query;
      const questionId = Array.isArray(id) ? id[0] : id;

      if (!questionId || typeof questionId !== "string") {
        return res.status(400).json({ error: "Validation: field question_id required" });
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

      // Check instructor role
      if (user.role !== "instructor") {
        return res.status(403).json({ error: "Forbidden: instructor role required" });
      }

      // Validate request body
      const { title, scenario_text } = req.body;

      if (!title && !scenario_text) {
        return res.status(400).json({ error: "Validation: at least one field required" });
      }

      if (title !== undefined && (typeof title !== "string" || !title.trim())) {
        return res.status(400).json({ error: "Validation: field title invalid" });
      }

      if (scenario_text !== undefined && (typeof scenario_text !== "string" || !scenario_text.trim())) {
        return res.status(400).json({ error: "Validation: field scenario_text invalid" });
      }

      // Fetch question and module status
      const questionRes = await pool.query(
        `
        SELECT q.id, q.module_id, m.status
        FROM questions q
        JOIN modules m ON m.id = q.module_id
        WHERE q.id = $1
        `,
        [questionId]
      );

      if (questionRes.rowCount === 0) {
        return res.status(404).json({ error: "Not found: question" });
      }

      const moduleId = questionRes.rows[0].module_id;
      const moduleStatus = questionRes.rows[0].status;

      if (moduleStatus !== "draft") {
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

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramIndex}`);
        values.push(title.trim());
        paramIndex++;
      }

      if (scenario_text !== undefined) {
        updates.push(`scenario_text = $${paramIndex}`);
        values.push(scenario_text.trim());
        paramIndex++;
      }

      values.push(questionId);

      const updateRes = await pool.query(
        `
        UPDATE questions
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id, module_id, title, scenario_text, order_index, created_at
        `,
        values
      );

      return res.status(200).json(updateRes.rows[0]);
    } catch (err) {
      console.error("Error in /api/questions/[id] (UPDATE):", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.query;
    const questionId = Array.isArray(id) ? id[0] : id;

    if (!questionId || typeof questionId !== "string") {
      return res.status(400).json({ error: "Validation: field question_id required" });
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

    // Check instructor role
    if (user.role !== "instructor") {
      return res.status(403).json({ error: "Forbidden: instructor role required" });
    }

    // Fetch question and module status
    const questionRes = await pool.query(
      `
      SELECT q.id, q.module_id, m.status
      FROM questions q
      JOIN modules m ON m.id = q.module_id
      WHERE q.id = $1
      `,
      [questionId]
    );

    if (questionRes.rowCount === 0) {
      return res.status(404).json({ error: "Not found: question" });
    }

    const moduleId = questionRes.rows[0].module_id;
    const moduleStatus = questionRes.rows[0].status;

    if (moduleStatus !== "draft") {
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

    await pool.query("BEGIN");

    await pool.query(
      `DELETE FROM sub_questions WHERE part_id IN (SELECT id FROM parts WHERE question_id = $1)`,
      [questionId]
    );
    await pool.query(
      `DELETE FROM parts WHERE question_id = $1`,
      [questionId]
    );
    await pool.query(
      `DELETE FROM artefacts WHERE question_id = $1`,
      [questionId]
    );
    const deleteRes = await pool.query(
      `DELETE FROM questions WHERE id = $1 RETURNING id`,
      [questionId]
    );

    await pool.query("COMMIT");

    return res.status(200).json({ success: true, id: deleteRes.rows[0].id });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Error in /api/questions/[id]:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
