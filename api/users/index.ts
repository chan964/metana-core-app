import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { parse } from "cookie";
import { Pool } from "pg";
import { randomUUID } from "crypto";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {

    const cookies = parse(req.headers.cookie || "");
    const sessionId = cookies.session;

    if (!sessionId) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const adminRes = await pool.query(
      `
      SELECT u.role
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now()
      `,
      [sessionId]
    );

    if (adminRes.rowCount === 0 || adminRes.rows[0].role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (req.method === "GET") {
      const { role } = req.query;

      let query =
        "SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at DESC";
      let params: any[] = [];

      if (role) {
        query =
          "SELECT id, email, full_name, role, created_at FROM users WHERE role = $1 ORDER BY created_at DESC";
        params = [role];
      }

      const result = await pool.query(query, params);
      return res.json({ success: true, data: result.rows });
    }

    if (req.method === "POST") {
      const { email, name, role, password } = req.body;

      if (!email || !role || !password) {
        return res.status(400).json({
          error: "Missing required fields: email, role, password",
        });
      }

      if (!["student", "instructor", "admin"].includes(role)) {
        return res.status(400).json({
          error: "Role must be 'student', 'instructor', or 'admin'",
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = randomUUID();

      try {
        const created = await pool.query(
          `
          INSERT INTO users (id, email, full_name, role, password_hash)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, email, full_name, role, created_at
          `,
          [userId, email, name || null, role, passwordHash]
        );

        return res.status(201).json({
          success: true,
          data: created.rows[0],
        });
      } catch (err: any) {
        if (err.code === "23505") {
          return res.status(400).json({
            error: "User with this email already exists",
          });
        }
        throw err;
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Error in /api/users:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}




// import type { VercelRequest, VercelResponse } from "@vercel/node";
// import { verifyToken, createClerkClient } from "@clerk/backend"; 
// import { Pool } from "pg";

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: { rejectUnauthorized: false },
// });

// // 2. INITIALIZE THE CLIENT MANUALLY
// const clerkClient = createClerkClient({
//   secretKey: process.env.CLERK_SECRET_KEY,
// });

// export default async function handler(req: VercelRequest, res: VercelResponse) {
//   try {
//     const authHeader = req.headers.authorization;
    
//     // Strict header check
//     if (!authHeader || Array.isArray(authHeader) || !authHeader.startsWith("Bearer ")) {
//       return res.status(401).json({ error: "Unauthenticated" });
//     }

//     const token = authHeader.replace("Bearer ", "");
    
//     // Verify token using the Secret Key (compatible with backend environment)
//     const payload = await verifyToken(token, {
//       secretKey: process.env.CLERK_SECRET_KEY!,
//     });

//     const clerkUserId = payload.sub;

//     const adminCheck = await pool.query(
//       `SELECT role FROM users WHERE clerk_user_id = $1`,
//       [clerkUserId]
//     );

//     if (adminCheck.rowCount === 0 || adminCheck.rows[0].role !== "admin") {
//       return res.status(403).json({ error: "Forbidden: Admin access required" });
//     }

//     if (req.method === "GET") {
//       const { role } = req.query;
//       const roleParam = Array.isArray(role) ? role[0] : role;
      
//       let query = `SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC`;
//       let params: any[] = [];
      
//       if (roleParam) {
//         query = `SELECT id, email, name, role, created_at FROM users WHERE role = $1 ORDER BY created_at DESC`;
//         params = [roleParam];
//       }
      
//       const result = await pool.query(query, params);
//       return res.status(200).json({ success: true, data: result.rows });
//     }

//     if (req.method === "POST") {
//       const { email, name, role, password } = req.body;

//       if (!email || !role || !password) {
//         return res.status(400).json({ 
//           error: "Missing required fields: email, role, password" 
//         });
//       }

//       if (!["student", "instructor"].includes(role)) {
//         return res.status(400).json({ 
//           error: "Invalid role. Must be 'student' or 'instructor'" 
//         });
//       }

//       try {
//         // 3. USE THE MANUALLY INITIALIZED CLIENT
//         const clerkUser = await clerkClient.users.createUser({
//           emailAddress: [email],
//           password,
//           skipPasswordRequirement: false,
//         });

//         const dbUser = await pool.query(
//           `
//           INSERT INTO users (email, name, role, clerk_user_id)
//           VALUES ($1, $2, $3, $4)
//           RETURNING id, email, name, role, created_at
//           `,
//           [email, name || null, role, clerkUser.id]
//         );

//         return res.status(201).json({ 
//           success: true, 
//           data: dbUser.rows[0] 
//         });

//       } catch (clerkError: any) {
//         console.error("Clerk user creation failed:", clerkError);
        
//         if (clerkError.errors?.[0]?.code === "form_identifier_exists") {
//           return res.status(400).json({ 
//             error: "Email already exists in Clerk" 
//           });
//         }

//         return res.status(500).json({ 
//           error: "Failed to create user in Clerk",
//           details: clerkError.message 
//         });
//       }
//     }

//     return res.status(405).json({ error: "Method not allowed" });
    
//   } catch (err) {
//     console.error("Error in /api/users:", err);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// }