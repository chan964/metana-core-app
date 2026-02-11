-- Clean all app data EXCEPT users.
-- Run against your dev/test DB. Users table is untouched.
--
-- If your answer table is named "answers" (not "submission_answers"),
-- replace "submission_answers" with "answers" in the TRUNCATE list below.

BEGIN;

-- Order: child tables first (dependencies). Do NOT include users.
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
