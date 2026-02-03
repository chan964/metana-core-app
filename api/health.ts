import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool } from "../lib/db";

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse
) {
  try {
    await pool.query("SELECT 1");
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("DB health check failed:", error);
    return res.status(500).json({ ok: false });
  }
}
