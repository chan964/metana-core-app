// User roles
export type UserRole = 'student' | 'instructor' | 'admin';

// Submission states (MANDATORY - use ONLY these)
export type SubmissionState = 'draft' | 'submitted' | 'graded' | 'finalised';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

// Artefact type
export interface Artefact {
  id: string;
  filename: string;
  fileType: string;
  url: string;
  moduleId?: string;
  questionId?: string;
  createdAt: string;
}

// Sub-question type
export interface SubQuestion {
  id: string;
  questionId: string;
  label: string;
  text: string;
  maxScore: number;
}

// Question type
export interface Question {
  id: string;
  moduleId: string;
  text: string;
  order: number;
}

// Module type
export interface LegacyModule {
  id: string;
  title: string;
  description: string;
  scenario: string;
  questions: Question[];
  partA: SubQuestion[];
  partB: SubQuestion[];
  artefacts: Artefact[];
  instructorId?: string;
  createdAt: string;
}


export interface ModuleInstructor {
  id: string;
  full_name?: string | null;
  email: string;
}

export interface ModuleStudent {
  id: string;
  full_name?: string | null;
  email: string;
}

export interface Module {
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  ready_for_publish?: boolean;
  published_at?: Date | string | null;
  createdAt: Date;
  submissionStart?: Date;
  submissionEnd?: Date;
  instructors: ModuleInstructor[];
  students?: ModuleStudent[];
}



// Student answer for a sub-question
export interface SubQuestionAnswer {
  subQuestionId: string;
  answer: string;
}

// Grade for a sub-question
export interface SubQuestionGrade {
  subQuestionId: string;
  score: number;
  feedback: string;
}

// Module submission
export interface ModuleSubmission {
  id: string;
  moduleId: string;
  studentId: string;
  studentName: string;
  state: SubmissionState;
  answers: SubQuestionAnswer[];
  grades: SubQuestionGrade[];
  totalScore?: number;
  submittedAt?: string;
  gradedAt?: string;
  finalisedAt?: string;
  createdAt: string;
}

// Module with submission info for student dashboard
export interface StudentModule {
  module: Module;
  submission: ModuleSubmission | null;
}

// Module with submission counts for instructor dashboard
export interface InstructorModule {
  module: Module;
  submissionCounts: {
    draft: number;
    submitted: number;
    graded: number;
    finalised: number;
  };
}

// API Response wrapper
export interface ApiResponse<T> {
  data: T;
  error?: string;
}
