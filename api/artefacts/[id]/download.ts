import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse } from "cookie";
import { createHash, createHmac } from "crypto";
import { pool } from "../../../lib/db.ts";

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function hashSha256(input: string | Buffer) {
  return createHash("sha256").update(input).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string) {
  return createHmac("sha256", key).update(data).digest();
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function getCanonicalUri(pathname: string) {
  return pathname
    .split("/")
    .map((segment) => encodeRfc3986(segment))
    .join("/");
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
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
      return res.status(401).json({ error: "Session expired" });
    }

    const user = sessionRes.rows[0];
    const { id } = req.query;
    const artefactId = Array.isArray(id) ? id[0] : id;

    if (!artefactId || typeof artefactId !== "string") {
      return res.status(400).json({ error: "Validation: field artefact_id required" });
    }

    const artefactRes = await pool.query(
      `
      SELECT a.id, a.question_id, a.filename, a.file_type, a.storage_key,
             q.module_id, m.status
      FROM artefacts a
      JOIN questions q ON q.id = a.question_id
      JOIN modules m ON m.id = q.module_id
      WHERE a.id = $1
      `,
      [artefactId]
    );

    if (artefactRes.rowCount === 0) {
      return res.status(404).json({ error: "Not found: artefact" });
    }

    const artefact = artefactRes.rows[0];
    // artefact.status is module.status (from JOIN)
    const moduleId = artefact.module_id;

    if (user.role === "instructor") {
      const assignmentRes = await pool.query(
        `SELECT 1 FROM module_instructors WHERE module_id = $1 AND instructor_id = $2`,
        [moduleId, user.id]
      );

      if (assignmentRes.rowCount === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } else if (user.role === "student") {
      if (artefact.status !== "published") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const enrollmentRes = await pool.query(
        `SELECT 1 FROM module_students WHERE module_id = $1 AND student_id = $2`,
        [moduleId, user.id]
      );

      if (enrollmentRes.rowCount === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }

    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const endpoint = process.env.R2_ENDPOINT;

    if (!accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
      return res.status(503).json({ error: "Storage not configured" });
    }

    const url = new URL(endpoint);
    const region = "auto";
    const service = "s3";
    const method = "GET";
    const now = new Date();
    const amzDate = toAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const canonicalUri = getCanonicalUri(`/${bucketName}/${artefact.storage_key}`);
    const payloadHash = hashSha256("");

    const canonicalHeaders =
      `host:${url.host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
      method,
      canonicalUri,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join("\n");

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      hashSha256(canonicalRequest)
    ].join("\n");

    const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
    const kRegion = hmacSha256(kDate, region);
    const kService = hmacSha256(kRegion, service);
    const kSigning = hmacSha256(kService, "aws4_request");
    const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

    const authorization =
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const downloadUrl = `${url.origin}${canonicalUri}`;
    const downloadRes = await fetch(downloadUrl, {
      method,
      headers: {
        "X-Amz-Date": amzDate,
        "X-Amz-Content-Sha256": payloadHash,
        Authorization: authorization,
      },
    });

    if (!downloadRes.ok) {
      return res.status(500).json({ error: "Internal server error" });
    }

    const filename = String(artefact.filename || "download").replace(/"/g, "_");
    const fileType = artefact.file_type || "application/octet-stream";
    const arrayBuffer = await downloadRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", fileType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error("Error in /api/artefacts/[id]/download:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
