import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export interface ModuleRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  submission_start: string | null;
  submission_end: string | null;
  instructors: {
    id: string;
    full_name: string | null;
    email: string;
  }[];
}
