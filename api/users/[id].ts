import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { parse } from "cookie";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function verifyAdmin(sessionId: string): Promise<boolean> {
  const adminRes = await pool.query(
    `
    SELECT u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = $1 AND s.expires_at > now()
    `,
    [sessionId]
  );

  return adminRes.rowCount !== 0 && adminRes.rows[0].role === "admin";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const cookies = parse(req.headers.cookie || "");
    const sessionId = cookies.session;

    if (!sessionId) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const isAdmin = await verifyAdmin(sessionId);
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.query;

    // GET a specific user
    if (req.method === "GET") {
      const result = await pool.query(
        "SELECT id, email, full_name, role, created_at FROM users WHERE id = $1",
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({ success: true, data: result.rows[0] });
    }

    // PATCH to update a user
    if (req.method === "PATCH") {
      const { email, full_name, role, password } = req.body;

      // Build dynamic update query
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (email !== undefined) {
        updates.push(`email = $${paramIndex}`);
        params.push(email);
        paramIndex++;
      }

      if (full_name !== undefined) {
        updates.push(`full_name = $${paramIndex}`);
        params.push(full_name);
        paramIndex++;
      }

      if (role !== undefined) {
        if (!["student", "instructor", "admin"].includes(role)) {
          return res.status(400).json({
            error: "Role must be 'student', 'instructor', or 'admin'",
          });
        }
        updates.push(`role = $${paramIndex}`);
        params.push(role);
        paramIndex++;
      }

      if (password !== undefined) {
        const passwordHash = await bcrypt.hash(password, 10);
        updates.push(`password_hash = $${paramIndex}`);
        params.push(passwordHash);
        paramIndex++;
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      params.push(id);
      const query = `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING id, email, full_name, role, created_at`;

      try {
        const result = await pool.query(query, params);

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        return res.json({ success: true, data: result.rows[0] });
      } catch (err: any) {
        if (err.code === "23505") {
          return res.status(400).json({
            error: "Email already in use",
          });
        }
        throw err;
      }
    }

    // DELETE a user
    if (req.method === "DELETE") {
      const result = await pool.query(
        "DELETE FROM users WHERE id = $1 RETURNING id",
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({ success: true, message: "User deleted" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Error in /api/users/[id]:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
