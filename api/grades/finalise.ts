import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse } from "cookie";
import { pool } from "../../lib/db.ts";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

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

    const { submission_id } = req.body;
    if (!submission_id || typeof submission_id !== "string") {
      return res.status(400).json({ error: "Validation: field submission_id required" });
    }

    const submissionRes = await pool.query(
      `SELECT id, module_id, status FROM submissions WHERE id = $1`,
      [submission_id]
    );

    if (!submissionRes.rowCount || submissionRes.rowCount === 0) {
      return res.status(404).json({ error: "Submission not found" });
    }

    const submission = submissionRes.rows[0];
    if (submission.status !== "submitted") {
      return res.status(400).json({ error: "Submission not eligible for finalisation" });
    }

    if (user.role === "instructor") {
      const assignmentRes = await pool.query(
        `SELECT 1 FROM module_instructors WHERE module_id = $1 AND instructor_id = $2`,
        [submission.module_id, user.id]
      );
      if (!assignmentRes.rowCount || assignmentRes.rowCount === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    await pool.query(
      `UPDATE submissions SET status = $1 WHERE id = $2`,
      ["finalised", submission_id]
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error in /api/grades/finalise:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
