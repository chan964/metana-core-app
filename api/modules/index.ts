import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pool } from "../../lib/db";
import { randomUUID } from "crypto";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method === "GET") {
      const result = await pool.query(
        "SELECT * FROM modules ORDER BY created_at ASC"
      );
      return res.status(200).json({ success: true, data: result.rows });
    }

    if (req.method === "POST") {
      const { title, description } = req.body;

      if (!title) {
        return res
          .status(400)
          .json({ success: false, error: "Title is required" });
      }

      await pool.query(
        "INSERT INTO modules (id, title, description) VALUES ($1, $2, $3)",
        [randomUUID(), title, description || null]
      );

      return res.status(201).json({ success: true });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}
