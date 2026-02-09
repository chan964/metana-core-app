CREATE TYPE role AS ENUM ('admin', 'instructor', 'student');
CREATE TYPE submission_status AS ENUM ('draft', 'submitted', 'graded', 'finalised');
CREATE TYPE module_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role role NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE modules (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status module_status NOT NULL DEFAULT 'draft',
  ready_for_publish BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE module_instructors (
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (module_id, instructor_id)
);


CREATE TABLE module_students (
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (module_id, student_id)
);

CREATE TABLE questions (
  id UUID PRIMARY KEY,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scenario_text TEXT NOT NULL,
  order_index INT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE parts (
  id UUID PRIMARY KEY,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (question_id, label)
);

CREATE TABLE sub_questions (
  id UUID PRIMARY KEY,
  part_id UUID REFERENCES parts(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  max_marks INT NOT NULL CHECK (max_marks > 0),
  order_index INT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);


CREATE TABLE submissions (
  id UUID PRIMARY KEY,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status submission_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT now(),
  submitted_at TIMESTAMP,
  graded_at TIMESTAMP,
  finalised_at TIMESTAMP,
  UNIQUE (module_id, student_id)
);

CREATE TABLE submission_answers (
  id UUID PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  sub_question_id UUID REFERENCES sub_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE (submission_id, sub_question_id)
);


CREATE TABLE artefacts (
  id UUID PRIMARY KEY,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id),
  filename TEXT NOT NULL,
  file_type TEXT,
  url TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now()
);


CREATE TABLE grades (
  id UUID PRIMARY KEY,
  submission_answer_id UUID REFERENCES submission_answers(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES users(id),
  score INT NOT NULL CHECK (score >= 0),
  feedback TEXT,
  graded_at TIMESTAMP DEFAULT now(),
  UNIQUE (submission_answer_id)
);

