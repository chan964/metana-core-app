import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { serialize } from "cookie";
import { v4 as uuid } from "uuid";
import { pool } from "../lib/db.ts";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, password } = req.body;
    console.log("[/api/login] Login attempt for:", email);

    if (!email || !password) {
      console.log("[/api/login] Missing email or password");
      return res.status(400).json({ error: "Email and password required" });
    }

    const userRes = await pool.query(
      "SELECT id, password_hash FROM users WHERE email = $1",
      [email]
    );

    if (userRes.rowCount === 0) {
      console.log("[/api/login] User not found:", email);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = userRes.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      console.log("[/api/login] Invalid password for:", email);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const sessionId = uuid();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
      [sessionId, user.id, expires]
    );

    console.log("[/api/login] Session created:", sessionId);

    // Set cookie with proper options for development
    // Allow credentials for cross-origin requests (important for Vercel dev)
    const cookieValue = serialize("session", sessionId, {
      httpOnly: true,
      path: "/",
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });
    
    console.log("[/api/login] Setting cookie:", {
      value: cookieValue.substring(0, 80),
      sessionId,
      NODE_ENV: process.env.NODE_ENV,
    });
    
    // Add Access-Control headers to allow credentials
    res.setHeader("Set-Cookie", cookieValue);
    res.setHeader("Access-Control-Allow-Credentials", "true");

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[/api/login] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
