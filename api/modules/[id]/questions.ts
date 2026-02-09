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

    const { id: moduleId } = req.query;

    // Check module exists
    const moduleRes = await pool.query(
      `SELECT id FROM modules WHERE id = $1`,
      [moduleId]
    );

    if (moduleRes.rowCount === 0) {
      return res.status(404).json({ error: "Not found: module" });
    }

    // Check instructor is assigned to module
    const assignmentRes = await pool.query(
      `SELECT 1 FROM module_instructors WHERE module_id = $1 AND instructor_id = $2`,
      [moduleId, user.id]
    );

    if (assignmentRes.rowCount === 0) {
      return res.status(403).json({ error: "Forbidden: instructor not assigned to module" });
    }

    // Fetch questions with sub-questions and artefacts
    const questionsRes = await pool.query(
      `
      SELECT
        q.id,
        q.module_id,
        q.title,
        q.scenario_text,
        q.order_index,
        q.created_at,
        COALESCE(
          (
            SELECT json_agg(
              jsonb_build_object(
                'id', sq.id,
                'prompt', sq.prompt,
                'max_marks', sq.max_marks,
                'order_index', sq.order_index,
                'created_at', sq.created_at,
                'part_id', sq.part_id
              )
              ORDER BY sq.order_index
            )
            FROM sub_questions sq
            JOIN parts p ON p.id = sq.part_id
            WHERE p.question_id = q.id
          ),
          '[]'
        ) AS sub_questions,
        COALESCE(
          (
            SELECT json_agg(
              jsonb_build_object(
                'id', a.id,
                'filename', a.filename,
                'file_type', a.file_type,
                'url', a.url,
                'uploaded_by', a.uploaded_by,
                'uploaded_at', a.created_at
              )
            )
            FROM artefacts a
            WHERE a.question_id = q.id
          ),
          '[]'
        ) AS artefacts
      FROM questions q
      WHERE q.module_id = $1
      ORDER BY q.order_index
      `,
      [moduleId]
    );

    return res.status(200).json({
      module_id: moduleId,
      questions: questionsRes.rows
    });
  } catch (err) {
    console.error("Error in /api/modules/[id]/questions:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
