import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool } from "../../lib/db.ts";

/**
 * DELETE /api/modules/:id
 * 
 * Admin deletes a module (only draft modules can be deleted)
 * 
 * Validation:
 * - Role = admin
 * - Status = draft (cannot delete published/archived modules)
 * - No enrolled students (defensive check)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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

    if (req.method === "GET") {
      const moduleRes = await pool.query(
        `
        SELECT id, title, description, status, created_at
        FROM modules
        WHERE id = $1
        `,
        [moduleId]
      );

      if (moduleRes.rowCount === 0) {
        return res.status(404).json({ error: "Module not found" });
      }

      const module = moduleRes.rows[0];

      // Role-based access control
      if (user.role === "student") {
        // Students can only access published modules
        if (module.status !== "published") {
          return res.status(403).json({ error: "Forbidden" });
        }
      } else if (user.role !== "instructor" && user.role !== "admin") {
        // Unknown roles are forbidden
        return res.status(403).json({ error: "Forbidden" });
      }

      // Instructors can access only modules they are assigned to
      if (user.role === "instructor") {
        const assignmentRes = await pool.query(
          `SELECT 1 FROM module_instructors WHERE module_id = $1 AND instructor_id = $2`,
          [moduleId, user.id]
        );
        if (assignmentRes.rowCount === 0) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      const questionsRes = await pool.query(
        `
        SELECT id, module_id, title, scenario_text, order_index
        FROM questions
        WHERE module_id = $1
        ORDER BY order_index
        `,
        [moduleId]
      );

      const subQuestionsRes = await pool.query(
        `
        SELECT
          sq.id,
          sq.prompt,
          sq.max_marks,
          sq.order_index,
          p.id AS part_id,
          p.label AS part_label,
          p.question_id
        FROM sub_questions sq
        JOIN parts p ON p.id = sq.part_id
        JOIN questions q ON q.id = p.question_id
        WHERE q.module_id = $1
        ORDER BY p.label, sq.order_index
        `,
        [moduleId]
      );

      const artefactsRes = await pool.query(
        `
        SELECT id, question_id, filename, file_type, url, created_at
        FROM artefacts
        WHERE question_id IN (
          SELECT id FROM questions WHERE module_id = $1
        )
        ORDER BY created_at
        `,
        [moduleId]
      );

      const partA: Array<{
        id: string;
        questionId: string;
        label: string;
        text: string;
        maxScore: number;
      }> = [];

      const partB: Array<{
        id: string;
        questionId: string;
        label: string;
        text: string;
        maxScore: number;
      }> = [];

      for (const row of subQuestionsRes.rows) {
        const partLabel = String(row.part_label || "").toUpperCase();
        const isPartB = partLabel === "B";
        const target = isPartB ? partB : partA;
        const labelPrefix = isPartB ? "B" : "A";

        target.push({
          id: row.id,
          questionId: row.question_id,
          label: `${labelPrefix}${target.length + 1}`,
          text: row.prompt,
          maxScore: Number(row.max_marks)
        });
      }

      const legacyModule = {
        id: moduleRes.rows[0].id,
        title: moduleRes.rows[0].title,
        description: moduleRes.rows[0].description,
        scenario: questionsRes.rows[0]?.scenario_text || "",
        questions: questionsRes.rows.map((q: any) => ({
          id: q.id,
          moduleId: q.module_id,
          text: q.title,
          order: q.order_index
        })),
        partA,
        partB,
        artefacts: artefactsRes.rows.map((a: any) => ({
          id: a.id,
          filename: a.filename,
          fileType: a.file_type,
          url: a.url,
          moduleId,
          questionId: a.question_id,
          createdAt: a.created_at
        })),
        instructorId: null,
        createdAt: moduleRes.rows[0].created_at
      };

      return res.status(200).json({ data: legacyModule });
    }

    // 2. Check role = admin
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can delete modules" });
    }

    // 3. Fetch module
    const moduleRes = await pool.query(
      `SELECT id, title, status FROM modules WHERE id = $1`,
      [moduleId]
    );

    if (moduleRes.rowCount === 0) {
      return res.status(404).json({ error: "Module not found" });
    }

    const module = moduleRes.rows[0];

    // 4. Check status = draft
    // Invariant: Only draft modules can be deleted.
    // Published/archived modules are immutable and contain student data.
    if (module.status !== "draft") {
      return res.status(403).json({ 
        error: `Cannot delete ${module.status} module. Only draft modules can be deleted.`
      });
    }

    // 5. Defensive: Check no students are enrolled
    // This should never happen if module is draft-only, but fail loudly if it does
    const enrollmentRes = await pool.query(
      `SELECT COUNT(*) as count FROM module_students WHERE module_id = $1`,
      [moduleId]
    );

    if (enrollmentRes.rows[0].count > 0) {
      return res.status(403).json({ 
        error: "Cannot delete module with enrolled students. This is an invariant violation."
      });
    }

    // 6. Delete the module (cascading deletes handle related records)
    const deleteRes = await pool.query(
      `DELETE FROM modules WHERE id = $1 RETURNING id, title`,
      [moduleId]
    );

    return res.status(200).json({
      success: true,
      data: { id: deleteRes.rows[0].id },
      message: `Module "${deleteRes.rows[0].title}" deleted successfully`
    });
  } catch (error) {
    console.error("Error deleting module:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
