import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse } from "cookie";
import { pool } from "../../../../../lib/db.ts";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id, submissionId } = req.query;
    const moduleIdStr = Array.isArray(id) ? id[0] : id;
    const submissionIdStr = Array.isArray(submissionId) ? submissionId[0] : submissionId;

    if (!moduleIdStr || typeof moduleIdStr !== "string") {
      return res.status(400).json({ error: "Validation: field id required" });
    }

    if (!submissionIdStr || typeof submissionIdStr !== "string") {
      return res.status(400).json({ error: "Validation: field submissionId required" });
    }

    // Session validation (same pattern as /api/me.ts)
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

    if (user.role !== "instructor" && user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Module must exist
    const moduleRes = await pool.query(
      `SELECT id, title FROM modules WHERE id = $1`,
      [moduleIdStr]
    );

    if (moduleRes.rowCount === 0) {
      return res.status(404).json({ error: "Module not found" });
    }

    // Instructor must be assigned to module
    if (user.role === "instructor") {
      const assignmentRes = await pool.query(
        `SELECT 1 FROM module_instructors WHERE module_id = $1 AND instructor_id = $2`,
        [moduleIdStr, user.id]
      );

      if (assignmentRes.rowCount === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    // Submission must exist and belong to module
    const submissionRes = await pool.query(
      `
      SELECT s.id, s.module_id, s.student_id, s.status, s.submitted_at,
             COALESCE(u.full_name, u.email) AS student_name
      FROM submissions s
      JOIN users u ON u.id = s.student_id
      WHERE s.id = $1
      `,
      [submissionIdStr]
    );

    if (submissionRes.rowCount === 0) {
      return res.status(404).json({ error: "Submission not found" });
    }

    const submission = submissionRes.rows[0];

    if (submission.module_id !== moduleIdStr) {
      return res.status(404).json({ error: "Submission not found" });
    }

    if (submission.status !== "submitted" && submission.status !== "finalised") {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Submission must belong to a student enrolled in the module
    const enrollmentRes = await pool.query(
      `SELECT 1 FROM module_students WHERE module_id = $1 AND student_id = $2`,
      [moduleIdStr, submission.student_id]
    );

    if (enrollmentRes.rowCount === 0) {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Fetch questions for module
    const questionsRes = await pool.query(
      `
      SELECT id, title, scenario_text, order_index
      FROM questions
      WHERE module_id = $1
      ORDER BY order_index ASC
      `,
      [moduleIdStr]
    );

    const questionIds = questionsRes.rows.map((q) => q.id);

    // Fetch parts for questions
    const partsRes = questionIds.length
      ? await pool.query(
          `
          SELECT id, label, question_id
          FROM parts
          WHERE question_id = ANY($1)
          ORDER BY label ASC
          `,
          [questionIds]
        )
      : { rows: [] };

    const partIds = partsRes.rows.map((p) => p.id);

    // Fetch sub-questions for parts
    const subQuestionsRes = partIds.length
      ? await pool.query(
          `
          SELECT id, part_id, prompt, max_marks, order_index
          FROM sub_questions
          WHERE part_id = ANY($1)
          ORDER BY order_index ASC
          `,
          [partIds]
        )
      : { rows: [] };

    // Fetch artefacts for questions
    const artefactsRes = questionIds.length
      ? await pool.query(
          `
          SELECT id, question_id, filename, file_type
          FROM artefacts
          WHERE question_id = ANY($1)
          ORDER BY created_at ASC
          `,
          [questionIds]
        )
      : { rows: [] };

    // Fetch answers for submission with grades
    const answersRes = await pool.query(
      `
      SELECT a.id, a.sub_question_id, a.answer_text,
             g.marks_awarded, g.feedback
      FROM answers a
      LEFT JOIN grades g ON g.answer_id = a.id
      WHERE a.submission_id = $1
      `,
      [submissionIdStr]
    );

    const answersBySubQuestion: Record<string, { id: string; answer_text: string; marks_awarded: number | null; feedback: string | null }> = {};
    answersRes.rows.forEach((row) => {
      answersBySubQuestion[row.sub_question_id] = {
        id: row.id,
        answer_text: row.answer_text,
        marks_awarded: row.marks_awarded ?? null,
        feedback: row.feedback ?? null
      };
    });

    const partsByQuestion: Record<string, any[]> = {};
    partsRes.rows.forEach((part) => {
      if (!partsByQuestion[part.question_id]) {
        partsByQuestion[part.question_id] = [];
      }
      partsByQuestion[part.question_id].push({ ...part, sub_questions: [] });
    });

    const partsById: Record<string, any> = {};
    Object.values(partsByQuestion).forEach((parts) => {
      parts.forEach((p) => {
        partsById[p.id] = p;
      });
    });

    subQuestionsRes.rows.forEach((sq) => {
      const part = partsById[sq.part_id];
      if (part) {
        const answerData = answersBySubQuestion[sq.id];
        part.sub_questions.push({
          id: sq.id,
          prompt: sq.prompt,
          max_marks: sq.max_marks,
          order_index: sq.order_index,
          submission_answer_id: answerData?.id || null,
          answer_text: answerData?.answer_text || "",
          grade: {
            marks_awarded: answerData?.marks_awarded ?? null,
            feedback: answerData?.feedback ?? null
          }
        });
      }
    });

    const artefactsByQuestion: Record<string, any[]> = {};
    artefactsRes.rows.forEach((a) => {
      if (!artefactsByQuestion[a.question_id]) {
        artefactsByQuestion[a.question_id] = [];
      }
      artefactsByQuestion[a.question_id].push({
        id: a.id,
        filename: a.filename,
        file_type: a.file_type
      });
    });

    const questions = questionsRes.rows.map((q) => ({
      id: q.id,
      title: q.title,
      scenario_text: q.scenario_text,
      order_index: q.order_index,
      parts: partsByQuestion[q.id] || [],
      artefacts: artefactsByQuestion[q.id] || []
    }));

    return res.status(200).json({
      submission_id: submission.id,
      module_id: submission.module_id,
      module_title: moduleRes.rows[0].title,
      student_id: submission.student_id,
      student_name: submission.student_name,
      status: submission.status,
      submitted_at: submission.submitted_at,
      questions
    });
  } catch (err) {
    console.error("Error in /api/instructor/modules/[id]/submissions/[submissionId]:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
