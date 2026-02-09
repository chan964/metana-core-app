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

    // Check module exists and instructor is assigned
    const moduleRes = await pool.query(
      `
      SELECT
        m.id,
        m.title,
        m.description,
        m.status,
        m.ready_for_publish,
        m.created_at,
        m.submission_start,
        m.submission_end,
        COALESCE(
          json_agg(
            json_build_object(
              'id', u.id,
              'full_name', u.full_name,
              'email', u.email
            )
          ) FILTER (WHERE u.id IS NOT NULL AND mi2.instructor_id IS NOT NULL),
          '[]'
        ) AS instructors,
        COALESCE(
          json_agg(
            json_build_object(
              'id', s.id,
              'full_name', s.full_name,
              'email', s.email
            )
          ) FILTER (WHERE s.id IS NOT NULL AND ms.student_id IS NOT NULL),
          '[]'
        ) AS students,
        COUNT(DISTINCT sub.id) FILTER (WHERE sub.status = 'draft') AS draft_count,
        COUNT(DISTINCT sub.id) FILTER (WHERE sub.status = 'submitted') AS submitted_count,
        COUNT(DISTINCT sub.id) FILTER (WHERE sub.status = 'graded') AS graded_count,
        COUNT(DISTINCT sub.id) FILTER (WHERE sub.status = 'finalised') AS finalised_count
      FROM modules m
      INNER JOIN module_instructors mi
        ON mi.module_id = m.id
        AND mi.instructor_id = $1
      LEFT JOIN module_instructors mi2
        ON mi2.module_id = m.id
      LEFT JOIN users u
        ON u.id = mi2.instructor_id
      LEFT JOIN module_students ms
        ON ms.module_id = m.id
      LEFT JOIN users s
        ON s.id = ms.student_id
      LEFT JOIN submissions sub
        ON sub.module_id = m.id
      WHERE m.id = $2
      GROUP BY m.id
      `,
      [user.id, moduleId]
    );

    if (moduleRes.rowCount === 0) {
      return res.status(404).json({ error: "Module not found or not assigned to instructor" });
    }

    const row = moduleRes.rows[0];

    // Transform data to match frontend expectations
    const data = {
      module: {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        ready_for_publish: row.ready_for_publish,
        created_at: row.created_at,
        submission_start: row.submission_start,
        submission_end: row.submission_end,
        instructors: row.instructors,
        students: row.students
      },
      submissionCounts: {
        draft: parseInt(row.draft_count) || 0,
        submitted: parseInt(row.submitted_count) || 0,
        graded: parseInt(row.graded_count) || 0,
        finalised: parseInt(row.finalised_count) || 0
      }
    };

    return res.status(200).json(data);
  } catch (err) {
    console.error("Error in /api/instructor/modules/[id]:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
