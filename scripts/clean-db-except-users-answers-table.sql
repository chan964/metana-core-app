-- Same as clean-db-except-users.sql but for DBs where the answer table is named "answers" (not "submission_answers").
-- Use this if your grades table has: FOREIGN KEY (answer_id) REFERENCES answers(id)

BEGIN;

TRUNCATE TABLE
  grades,
  answers,
  submissions,
  sessions,
  artefacts,
  sub_questions,
  parts,
  questions,
  module_instructors,
  module_students,
  modules
RESTART IDENTITY
CASCADE;

COMMIT;
