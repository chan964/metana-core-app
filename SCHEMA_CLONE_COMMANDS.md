# Schema clone: Dev → Test (run when pg_dump matches server v17)

## 1. Generate schema-only dump from DEV (run from project root)

```bash
pg_dump 'postgresql://neondb_owner:npg_FTGIJP5bx1Zp@ep-fancy-hill-aivtm2r6-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' \
  --schema-only \
  --no-owner \
  --no-privileges \
  -f metana_schema_actual.sql
```

Use your **actual dev database URL** if it differs from above. Requires pg_dump version 17 (Neon server is 17).

## 2. Apply schema to TEST only (after loading .env.test)

```bash
# From metana-core-app, with DATABASE_URL_TEST set (e.g. source .env.test or export):
psql "$DATABASE_URL_TEST" -f metana_schema_actual.sql
```

Or inline:

```bash
psql 'postgresql://neondb_owner:npg_FTGIJP5bx1Zp@ep-fancy-hill-aivtm2r6-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' -f metana_schema_actual.sql
```

## 3. Verify (required tables)

- users, sessions, modules, module_instructors, module_students, questions, parts, sub_questions, submissions, submission_answers, grades, artefacts
- users.role, submissions.status, grades.score, submission_answers.answer_text

**Note:** Test DB was checked and had no tables; safe to apply. Local pg_dump (v14) failed due to server version mismatch; run the dump where client is v17.
