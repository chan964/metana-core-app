import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool } from "../../lib/db.ts";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {

    const sessionId = req.cookies?.session;

    if (!sessionId) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const sessionRes = await pool.query(
      `
      SELECT u.id, u.role
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
        AND s.expires_at > NOW()
      `,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) {
      return res.status(401).json({ error: "Invalid session" });
    }

    if (sessionRes.rows[0].role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    if (req.method === "GET") {
      const result = await pool.query(
        `
        SELECT
          m.id,
          m.title,
          m.description,
          m.status,
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
            ) FILTER (WHERE u.id IS NOT NULL AND mi.instructor_id IS NOT NULL),
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
          ) AS students
        FROM modules m
        LEFT JOIN module_instructors mi
          ON mi.module_id = m.id
        LEFT JOIN users u
          ON u.id = mi.instructor_id
        LEFT JOIN module_students ms
          ON ms.module_id = m.id
        LEFT JOIN users s
          ON s.id = ms.student_id
        GROUP BY m.id
        ORDER BY m.created_at DESC
        `
      );

      return res.status(200).json({ data: result.rows });
    }

    // -------------------------
    // POST: create module shell (admin only)
    // -------------------------
    // Invariants enforced:
    // - Only admins can create modules
    // - New modules always start in 'draft' status
    // - Title is required, description is optional
    // - Modules have no instructors/students at creation (added separately)
    if (req.method === "POST") {
      const { title, description } = req.body;

      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required" });
      }

      const result = await pool.query(
        `
        INSERT INTO modules (title, description, status)
        VALUES ($1, $2, 'draft')
        RETURNING
          id,
          title,
          description,
          status,
          created_at,
          submission_start,
          submission_end
        `,
        [title, description ?? null]
      );

      return res.status(201).json({ data: result.rows[0] });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("api/modules error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}



// import type { VercelRequest, VercelResponse } from "@vercel/node";
// import { Pool } from "pg";

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: { rejectUnauthorized: false },
// });

// export default async function handler(
//   req: VercelRequest,
//   res: VercelResponse
// ) {
//   try {
//     const sessionId = req.cookies?.session;
//     if (!sessionId) {
//       return res.status(401).json({ error: "Unauthenticated" });
//     }

//     const sessionRes = await pool.query(
//       `
//       SELECT u.id, u.role
//       FROM sessions s
//       JOIN users u ON u.id = s.user_id
//       WHERE s.id = $1 AND s.expires_at > NOW()
//       `,
//       [sessionId]
//     );

//     if (sessionRes.rowCount === 0) {
//       return res.status(401).json({ error: "Invalid session" });
//     }

//     if (sessionRes.rows[0].role !== "admin") {
//       return res.status(403).json({ error: "Admin only" });
//     }

//     // GET: list modules (admin overview)
//     if (req.method === "GET") {
//       const result = await pool.query(
//         `
//         SELECT
//           m.id,
//           m.title,
//           m.description,
//           m.status,
//           m.created_at,
//           m.submission_start,
//           m.submission_end,
//           COALESCE(
//             json_agg(
//               json_build_object(
//                 'id', u.id,
//                 'full_name', u.full_name,
//                 'email', u.email
//               )
//             ) FILTER (WHERE u.id IS NOT NULL),
//             '[]'
//           ) AS instructors
//         FROM modules m
//         LEFT JOIN module_instructors mi ON mi.module_id = m.id
//         LEFT JOIN users u ON u.id = mi.instructor_id
//         GROUP BY m.id
//         ORDER BY m.created_at DESC;
//         `
//       );
//       return res.json({ data: result.rows });
//     }

//     // POST: create empty module shell
//     if (req.method === "POST") {
//       const { title, description } = req.body;

//       if (!title || typeof title !== "string") {
//         return res.status(400).json({ error: "Title required" });
//       }

//       const result = await pool.query(
//         `
//         INSERT INTO modules (title, description, status)
//         VALUES ($1, $2, 'draft')
//         RETURNING
//           id,
//           title,
//           description,
//           status,
//           instructor_id,
//           created_at,
//           submission_start,
//           submission_end
//         `,
//         [title, description || null]
//       );

//       return res.status(201).json({ data: result.rows[0] });
//     }

//     return res.status(405).json({ error: "Method not allowed" });
//   } 
//   catch (err) {
//     console.error("api/modules error:", err);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// }



// //v1 - lovable version

// // import type { VercelRequest, VercelResponse } from "@vercel/node";
// // import { Pool } from "pg";

// // const pool = new Pool({
// //   connectionString: process.env.DATABASE_URL,
// //   ssl: { rejectUnauthorized: false },
// // });

// // export default async function handler(req: VercelRequest, res: VercelResponse) {
// //   try {
// //     const sessionId = req.cookies?.session;
// //     if (!sessionId) {
// //       return res.status(401).json({ error: "Unauthenticated" });
// //     }

// //     const sessionRes = await pool.query(
// //       `
// //       SELECT u.id, u.role
// //       FROM sessions s
// //       JOIN users u ON u.id = s.user_id
// //       WHERE s.id = $1 AND s.expires_at > NOW()
// //       `,
// //       [sessionId]
// //     );

// //     if (sessionRes.rowCount === 0) {
// //       return res.status(401).json({ error: "Invalid session" });
// //     }

// //     const user = sessionRes.rows[0];
// //     if (user.role !== "admin") {
// //       return res.status(403).json({ error: "Admin only" });
// //     }

// //     if (req.method === "GET") {
// //       const result = await pool.query(
// //         `SELECT * FROM modules ORDER BY created_at DESC`
// //       );
// //       return res.json({ data: result.rows });
// //     }

// //     if (req.method === "POST") {
// //       const { title, description } = req.body;

// //       if (!title) {
// //         return res.status(400).json({ error: "Title is required" });
// //       }

// //       const result = await pool.query(
// //         `
// //         INSERT INTO modules (title, description, partA, partB)
// //         VALUES ($1, $2, '[]', '[]')
// //         RETURNING *
// //         `,
// //         [title, description || null]
// //       );

// //       return res.status(201).json({ data: result.rows[0] });
// //     }

// //     return res.status(405).json({ error: "Method not allowed" });
// //   } catch (err) {
// //     console.error("api/modules error:", err);
// //     return res.status(500).json({ error: "Internal server error" });
// //   }
// // }
