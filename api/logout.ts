import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse, serialize } from "cookie";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const cookies = parse(req.headers.cookie || "");

    if (cookies.session) {
      await pool.query("DELETE FROM sessions WHERE id = $1", [cookies.session]);
    }

    const isProduction = process.env.NODE_ENV === "production";
    res.setHeader(
      "Set-Cookie",
      serialize("session", "", {
        path: "/",
        expires: new Date(0),
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
      })
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
