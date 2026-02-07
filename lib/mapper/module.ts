import { Module } from "../../src/types";

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

export function mapModuleRow(row: ModuleRow): Module {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as 'draft' | 'published' | 'archived',
    createdAt: new Date(row.created_at),
    submissionStart: row.submission_start
      ? new Date(row.submission_start)
      : undefined,
    submissionEnd: row.submission_end
      ? new Date(row.submission_end)
      : undefined,

    // derived, not a DB column
    instructors: row.instructors,
  };
}
