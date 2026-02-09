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
    const { submissionId } = req.query;
    const submissionIdStr = Array.isArray(submissionId) ? submissionId[0] : submissionId;

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

    // Fetch submission + student
    const submissionRes = await pool.query(
      `
      SELECT s.id, s.module_id, s.student_id, s.status, s.submitted_at,
             u.full_name AS student_name, u.email AS student_email
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

    if (submission.status !== "submitted" && submission.status !== "finalised") {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Instructor must be assigned to module (admins allowed)
    if (user.role === "instructor") {
      const assignmentRes = await pool.query(
        `SELECT 1 FROM module_instructors WHERE module_id = $1 AND instructor_id = $2`,
        [submission.module_id, user.id]
      );

      if (assignmentRes.rowCount === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    // Student must be enrolled in module
    const enrollmentRes = await pool.query(
      `SELECT 1 FROM module_students WHERE module_id = $1 AND student_id = $2`,
      [submission.module_id, submission.student_id]
    );

    if (enrollmentRes.rowCount === 0) {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Fetch questions
    const questionsRes = await pool.query(
      `
      SELECT id, title, scenario_text, order_index
      FROM questions
      WHERE module_id = $1
      ORDER BY order_index ASC
      `,
      [submission.module_id]
    );

    const questionIds = questionsRes.rows.map((q) => q.id);

    // Fetch parts
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
      : { rows: [] as any[] };

    const partIds = partsRes.rows.map((p: any) => p.id);

    // Fetch sub-questions with answers + grades
    const subQuestionsRes = partIds.length
      ? await pool.query(
          `
          SELECT
            sq.id,
            sq.part_id,
            sq.prompt,
            sq.max_marks,
            sq.order_index,
            sa.id AS submission_answer_id,
            sa.answer_text,
            g.score AS marks_awarded,
            g.feedback
          FROM sub_questions sq
          LEFT JOIN submission_answers sa
            ON sa.sub_question_id = sq.id
           AND sa.submission_id = $1
          LEFT JOIN grades g
            ON g.submission_answer_id = sa.id
          WHERE sq.part_id = ANY($2)
          ORDER BY sq.order_index ASC
          `,
          [submissionIdStr, partIds]
        )
      : { rows: [] as any[] };

    // Fetch artefacts
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
      : { rows: [] as any[] };

    const partsByQuestion: Record<string, any[]> = {};
    partsRes.rows.forEach((part: any) => {
      if (!partsByQuestion[part.question_id]) {
        partsByQuestion[part.question_id] = [];
      }
      partsByQuestion[part.question_id].push({
        id: part.id,
        label: part.label,
        sub_questions: []
      });
    });

    const partsById: Record<string, any> = {};
    Object.values(partsByQuestion).forEach((parts: any) => {
      parts.forEach((p: any) => {
        partsById[p.id] = p;
      });
    });

    subQuestionsRes.rows.forEach((sq: any) => {
      const part = partsById[sq.part_id];
      if (part) {
        part.sub_questions.push({
          id: sq.id,
          prompt: sq.prompt,
          max_marks: sq.max_marks,
          submission_answer_id: sq.submission_answer_id,
          answer_text: sq.answer_text || "",
          grade: {
            marks_awarded: sq.marks_awarded ?? null,
            feedback: sq.feedback ?? null
          }
        });
      }
    });

    const artefactsByQuestion: Record<string, any[]> = {};
    artefactsRes.rows.forEach((a: any) => {
      if (!artefactsByQuestion[a.question_id]) {
        artefactsByQuestion[a.question_id] = [];
      }
      artefactsByQuestion[a.question_id].push({
        id: a.id,
        filename: a.filename,
        file_type: a.file_type
      });
    });

    const questions = questionsRes.rows.map((q: any) => ({
      id: q.id,
      title: q.title,
      scenario_text: q.scenario_text,
      parts: partsByQuestion[q.id] || [],
      artefacts: artefactsByQuestion[q.id] || []
    }));

    return res.status(200).json({
      submission: {
        id: submission.id,
        status: submission.status,
        submitted_at: submission.submitted_at,
        student: {
          id: submission.student_id,
          name: submission.student_name,
          email: submission.student_email
        }
      },
      questions
    });
  } catch (err) {
    console.error("Error in /api/instructor/submissions/[submissionId]:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
