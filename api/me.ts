import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse } from "cookie";
import { pool } from "../lib/db.ts";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const cookieHeader = req.headers.cookie;
    console.log("[/api/me] Cookie header:", cookieHeader);
    
    if (!cookieHeader) {
      console.log("[/api/me] No cookies provided");
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const cookies = parse(cookieHeader);
    console.log("[/api/me] Parsed cookies:", Object.keys(cookies));
    
    const sessionId = cookies.session;
    console.log("[/api/me] Session ID:", sessionId ? "Found" : "Not found");
    
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const sessionRes = await pool.query(
      `
      SELECT u.id, u.email, u.full_name, u.role, u.created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
        AND s.expires_at > now()
      `,
      [sessionId]
    );

    console.log("[/api/me] Session found:", (sessionRes.rowCount ?? 0) > 0);

    if (!sessionRes.rowCount || sessionRes.rowCount === 0) {
      return res.status(401).json({ error: "Session expired" });
    }

    // 3. Return user
    return res.status(200).json(sessionRes.rows[0]);
  } catch (err) {
    console.error("Error in /api/me:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}



// import type { VercelRequest, VercelResponse } from "@vercel/node";
// //import { createClerkClient } from "@clerk/backend";
// import { Pool } from "pg";

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: { rejectUnauthorized: false },
// });

// //const clerk = createClerkClient({
//   //secretKey: process.env.CLERK_SECRET_KEY!,
// //});

// export default async function handler(req: VercelRequest, res: VercelResponse) {
//   try {
//     // Convert Vercel request → Web Request
//     const url = `http://${req.headers.host}${req.url}`;
//     const webReq = new Request(url, {
//       method: req.method,
//       headers: req.headers as HeadersInit,
//     });

//     const requestState = await clerk.authenticateRequest(webReq);
//     const auth = requestState.toAuth();

//     if (!auth || !auth.userId) {
//       return res.status(401).json({ error: "Unauthenticated" });
//     }

//     const clerkUserId = auth.userId;

//     const result = await pool.query(
//       `
//       SELECT id, email, name, role, created_at
//       FROM users
//       WHERE clerk_user_id = $1
//       `,
//       [clerkUserId]
//     );

//     if (result.rowCount === 0) {
//       return res.status(403).json({ error: "User not provisioned" });
//     }

//     return res.status(200).json(result.rows[0]);
//   } catch (err) {
//     console.error("Error in /api/me:", err);
//     return res.status(401).json({ error: "Invalid session" });
//   }
// }

// // import type { VercelRequest, VercelResponse } from "@vercel/node";
// // import { getAuth } from "@clerk/backend";
// // import { Pool } from "pg";

// // const pool = new Pool({
// //   connectionString: process.env.DATABASE_URL,
// //   ssl: { rejectUnauthorized: false },
// // });

// // export default async function handler(req: VercelRequest, res: VercelResponse) {
// //   if (req.method !== "GET") {
// //     return res.status(405).json({ error: "Method not allowed" });
// //   }

// //   try {
// //     const { userId } = getAuth(req);

// //     if (!userId) {
// //       return res.status(401).json({ error: "Unauthenticated" });
// //     }

// //     const result = await pool.query(
// //       `SELECT id, email, name, role, created_at
// //        FROM users
// //        WHERE clerk_user_id = $1`,
// //       [userId]
// //     );

// //     if (result.rowCount === 0) {
// //       return res.status(403).json({
// //         error: "User not provisioned in database",
// //       });
// //     }

// //     const user = result.rows[0];

// //     return res.status(200).json({
// //       id: user.id,
// //       email: user.email,
// //       name: user.name,
// //       role: user.role,
// //       createdAt: user.created_at,
// //     });
// //   } catch (err) {
// //     console.error("Error in /api/me:", err);
// //     return res.status(401).json({ error: "Invalid session" });
// //   }
// // }
