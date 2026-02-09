import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool } from "../../../lib/db.ts";

/**
 * PATCH /api/modules/:id/ready
 * 
 * Instructor marks module as ready for publishing
 * 
 * Invariants enforced:
 * - Only instructors can mark modules as ready
 * - Only draft modules can transition to ready state
 * - Instructor must be assigned to the module
 * - Module must have at least one question (content validation)
 * - Module must have at least one sub-question (structure validation)
 * 
 * Fails with 403 if any invariant is violated.
 * This prevents instructors from publishing empty or partially-configured modules.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.query;
    const moduleId = Array.isArray(id) ? id[0] : id;

    // 1. Get current user from session
    const sessionId = req.cookies?.session;
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const userRes = await pool.query(
      `SELECT u.id, u.role FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.expires_at > NOW()`,
      [sessionId]
    );

    if (userRes.rowCount === 0) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const user = userRes.rows[0];

    // 2. Check role = instructor
    if (user.role !== "instructor") {
      return res.status(403).json({ error: "Only instructors can mark modules as ready" });
    }

    // 3. Fetch module and check status
    const moduleRes = await pool.query(
      `SELECT status, ready_for_publish FROM modules WHERE id = $1`,
      [moduleId]
    );

    if (moduleRes.rowCount === 0) {
      return res.status(404).json({ error: "Module not found" });
    }

    const module = moduleRes.rows[0];

    if (module.status !== "draft") {
      return res.status(403).json({ error: "Module must be in draft status" });
    }

    // 4. Check instructor is assigned
    const assignedRes = await pool.query(
      `SELECT 1 FROM module_instructors WHERE module_id = $1 AND instructor_id = $2`,
      [moduleId, user.id]
    );

    if (assignedRes.rowCount === 0) {
      return res.status(403).json({ error: "Not assigned to this module" });
    }

    // 5. Check at least one question exists
    const questionRes = await pool.query(
      `SELECT 1 FROM questions WHERE module_id = $1 LIMIT 1`,
      [moduleId]
    );

    if (questionRes.rowCount === 0) {
      return res.status(403).json({ error: "Module must have at least one question" });
    }

    // 6. Check at least one sub_question exists
    const subQuestionRes = await pool.query(
      `SELECT 1 FROM sub_questions sq
       JOIN parts p ON sq.part_id = p.id
       JOIN questions q ON p.question_id = q.id
       WHERE q.module_id = $1 LIMIT 1`,
      [moduleId]
    );

    if (subQuestionRes.rowCount === 0) {
      return res.status(403).json({ error: "Module must have at least one sub-question" });
    }

    // 7. Validate EVERY question has at least one part
    const questionsWithoutParts = await pool.query(
      `SELECT q.id, q.title FROM questions q
       WHERE q.module_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM parts p WHERE p.question_id = q.id
       )
       LIMIT 1`,
      [moduleId]
    );

    if (questionsWithoutParts.rowCount && questionsWithoutParts.rowCount > 0) {
      return res.status(403).json({ 
        error: "All questions must have at least one part"
      });
    }

    // 8. Validate EVERY part has at least one sub-question
    const partsWithoutSubQuestions = await pool.query(
      `SELECT p.id, p.label, q.title FROM parts p
       JOIN questions q ON q.id = p.question_id
       WHERE q.module_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM sub_questions sq WHERE sq.part_id = p.id
       )
       LIMIT 1`,
      [moduleId]
    );

    if (partsWithoutSubQuestions.rowCount && partsWithoutSubQuestions.rowCount > 0) {
      return res.status(403).json({ 
        error: "All parts must have at least one sub-question"
      });
    }

    // 9. Update ready_for_publish flag
    const updateRes = await pool.query(
      `UPDATE modules SET ready_for_publish = true WHERE id = $1 RETURNING *`,
      [moduleId]
    );

    return res.status(200).json({
      success: true,
      data: updateRes.rows[0],
    });
  } catch (error) {
    console.error("Error marking module as ready:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
