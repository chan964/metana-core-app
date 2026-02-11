# Clean DB (keep users only)

Wipes all app data so you can test from a clean slate. **Users are not deleted.**

---

## How the table name is used in code

The **application code** uses the table name **`submission_answers`** in SQL everywhere (no config or env):

- **api/answers/index.ts** – GET and POST: `FROM submission_answers`, `INSERT INTO submission_answers`
- **api/grades/index.ts** – `FROM submission_answers`
- **api/instructor/submissions/[submissionId].ts** – `LEFT JOIN submission_answers`
- **api/instructor/modules/[id]/submissions/[submissionId].ts** – `FROM submission_answers`
- **api/student/modules/[id]/progress.ts** – `FROM submission_answers`
- **api/submissions/submit.ts** – `LEFT JOIN submission_answers`
- **tests/helpers/db.ts** – truncate list includes `submission_answers`

So in logic: the table name is **hardcoded** as `submission_answers`. If your Neon DB actually has a table named **`answers`** (and grades references `answers(id)`), the app would fail with "relation submission_answers does not exist" unless you either rename the table in the DB to `submission_answers` or change the code to use `answers`. The **clean script** is separate: it just needs to use whatever your table is really called so TRUNCATE works. Use the script that matches your schema.

---

## Option A: Run from Neon dashboard (no terminal)

1. Open [Neon Console](https://console.neon.tech) and select your project.
2. Open **SQL Editor** (or **Query**).
3. Paste one of the scripts below (choose the one that matches your table name).
4. Run the query.

**If your answer table is `submission_answers`** – paste this:

```sql
BEGIN;
TRUNCATE TABLE
  grades,
  submission_answers,
  submissions,
  sessions,
  artefacts,
  sub_questions,
  parts,
  questions,
  module_instructors,
  module_students,
  modules
RESTART IDENTITY CASCADE;
COMMIT;
```

**If your answer table is `answers`** – paste this:

```sql
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
RESTART IDENTITY CASCADE;
COMMIT;
```

---

## Option B: Run with psql (terminal)

From project root:

```bash
psql "$DATABASE_URL" -f scripts/clean-db-except-users.sql
```

If your answer table is **`answers`**, use:

```bash
psql "$DATABASE_URL" -f scripts/clean-db-except-users-answers-table.sql
```

---

## What gets removed

- grades  
- submission_answers (or answers)  
- submissions  
- sessions  
- artefacts  
- sub_questions  
- parts  
- questions  
- module_instructors  
- module_students  
- modules  

## What stays

- **users** (all rows unchanged)

After running, you can log in with existing users and re-create modules, enrollments, submissions, etc. from scratch.
