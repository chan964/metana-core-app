# Phase 7A-1 — Environment & Deployment Safety Audit (READ-ONLY)

**Zero code changes.** All findings are from scanning the codebase; `process.env.*` and `import.meta.env.*` usage is authoritative.

---

## 1. Environment Variable Inventory

| Name | Used in | Required | Failure mode if missing |
|------|---------|----------|--------------------------|
| **DATABASE_URL** | `lib/db.ts` line 4 | Required at runtime when any DB-using endpoint is invoked | Pool is created with `connectionString: undefined`; first `pool.query()` fails (connection error). No explicit check before use. |
| **NODE_ENV** | `api/login.ts` lines 55, 62; `api/logout.ts` line 13 | Optional | If missing: cookie `secure` is false (login 55, logout 13); login logs `NODE_ENV: undefined`. No crash. |
| **R2_ACCESS_KEY_ID** | `api/artefacts/[id]/download.ts` line 119 | Required when artefact download is requested | Read lazily when download handler runs; if missing, handler returns 500 (lines 124–126). |
| **R2_SECRET_ACCESS_KEY** | `api/artefacts/[id]/download.ts` line 120 | Required when artefact download is requested | Same as above; also used in signing (line 160). |
| **R2_BUCKET_NAME** | `api/artefacts/[id]/download.ts` line 121 | Required when artefact download is requested | Same as above. |
| **R2_ENDPOINT** | `api/artefacts/[id]/download.ts` line 122 | Required when artefact download is requested | Same as above; used to build request URL (line 128). |
| **VITE_FIREBASE_API_KEY** | `src/lib/firebase.ts` line 5 | Required at client build/runtime if Firebase is used | Client-side; injected at build time. If missing, config is undefined; Firebase init may fail or misbehave when the app loads. |
| **VITE_FIREBASE_AUTH_DOMAIN** | `src/lib/firebase.ts` line 6 | Same as above | Same as above. |
| **VITE_FIREBASE_PROJECT_ID** | `src/lib/firebase.ts` line 7 | Same as above | Same as above. |
| **VITE_FIREBASE_STORAGE_BUCKET** | `src/lib/firebase.ts` line 8 | Same as above | Same as above. |
| **VITE_FIREBASE_APP_ID** | `src/lib/firebase.ts` line 9 | Same as above | Same as above. |

**Not used in active code (commented out only):**  
`CLERK_SECRET_KEY`, `CLERK_ISSUER` appear only in commented blocks in `api/me.ts` and `api/users/index.ts`. Not required for current runtime behavior.

---

## 2. Boot-Time Safety Assessment

- **Can the app boot with a missing required env var?**  
  **YES** for serverless. There is no single process “boot”; each API route is invoked separately. The health endpoint (`api/health.ts`) does not import `lib/db.ts` and returns 200 without using any env var. So “the app” (e.g. a health check) can respond successfully even if `DATABASE_URL` or R2 vars are missing.  
  **Evidence:** `api/health.ts` has no `process.env` and no import of `lib/db.ts`.

- **Will it fail loudly or silently?**  
  **Depends on which code path runs.**  
  - **DATABASE_URL missing:** First request to any endpoint that imports `lib/db.ts` causes that module to load and creates `Pool({ connectionString: process.env.DATABASE_URL })`. No throw at Pool creation; failure happens on first `pool.query()`, with a connection error. That error is caught in the handler’s try/catch and returned as 500 with a generic message; the underlying cause is logged via `console.error` in each handler. So: **fail at first DB use, logged in server logs, but 500 response is generic.**  
  **Evidence:** `lib/db.ts` lines 3–6 (Pool creation, no check); e.g. `api/me.ts` line 52, `api/login.ts` line 71 (catch and 500).  
  - **R2 vars missing:** Only when artefact download is requested; returns 500 with no distinction from other 500s; logged in that handler’s catch. So: **fail when download is used, generic 500, logged.**  
  **Evidence:** `api/artefacts/[id]/download.ts` lines 119–126, 191–194.

- **Are any env vars accessed lazily (only when an endpoint is hit)?**  
  **YES.**  
  - **DATABASE_URL:** Read when `lib/db.ts` is first evaluated, which happens on first import by any handler that uses `pool`. So effectively lazy per serverless cold start.  
  **Evidence:** `lib/db.ts` line 4; no other file reads `DATABASE_URL`; all DB-using API files import `pool` from `lib/db.ts`.  
  - **R2_*:** Read only inside the artefact download handler when a download is attempted.  
  **Evidence:** `api/artefacts/[id]/download.ts` lines 119–122 (inside handler).  
  - **NODE_ENV:** Read only when login or logout runs.  
  **Evidence:** `api/login.ts` 55, 62; `api/logout.ts` 13.

---

## 3. Production Safety Risks (if any)

- **.env not in .gitignore**  
  The project root contains a `.env` file. `.gitignore` does not include `.env`. If `.env` is committed, secrets (e.g. `DATABASE_URL`, R2 keys, or any past Clerk keys) would be in version control.  
  **Evidence:** `list_dir` shows `.env` in project root; `.gitignore` contents have no `.env` entry.

- **Dev-only configuration**  
  `vite.config.ts` line 9 sets `host: "localhost"`. This applies to the Vite dev server only; production build does not run the dev server, so this is not a production path. No change recommended for this audit.

- **NODE_ENV assumptions**  
  Login and logout use `process.env.NODE_ENV === "production"` to set cookie `secure`. If NODE_ENV is unset in production, `secure` is false and the session cookie can be sent over HTTP.  
  **Evidence:** `api/login.ts` line 55; `api/logout.ts` line 13.

- **No hardcoded production URLs/hosts/ports**  
  No production API or app logic uses hardcoded URLs, hosts, or ports. R2 URL comes from `process.env.R2_ENDPOINT`. Commented code in `api/me.ts` builds a URL from `req.headers.host` (not used in active path).

---

## 4. Secrets Handling Sanity Check

- **Secrets logged**  
  **RISK.**  
  - `api/login.ts` line 47: `console.log("[/api/login] Session created:", sessionId)` — logs the session id. Anyone with log access can impersonate the user.  
  - `api/login.ts` lines 59–62: `console.log("[/api/login] Setting cookie:", { value: cookieValue.substring(0, 80), sessionId, NODE_ENV: process.env.NODE_ENV })` — logs the first 80 characters of the cookie value and the full session id. Same impersonation risk.  
  **Evidence:** `api/login.ts` lines 47, 59–62.

- **Secrets returned in API responses**  
  **NONE FOUND.**  
  Login returns `{ success: true }`. `/api/me` returns user row with `id, email, full_name, role, created_at` (no `password_hash`). No endpoint was found returning `password_hash`, session ids, or R2/CLERK secrets.  
  **Evidence:** `api/login.ts` line 69; `api/me.ts` query lines 33–39 and return line 49; no `password_hash` in SELECT in me.

- **Secrets committed in code**  
  **NONE in source files.**  
  No literal secrets in the audited `.ts`/`.tsx` files. `.env` exists and is not in `.gitignore`; if it were ever committed, that would expose secrets (see above).  
  **Evidence:** Grep for `password_hash`, `secret`, `apiKey` in `api/` shows only usage from env or request/DB, not hardcoded values; `.gitignore` has no `.env`.

---

## 5. Recommended Actions (NO CODE YET)

1. **Add `.env` to `.gitignore`** so environment-specific secrets are not committed.
2. **Remove or redact login logging** that includes `sessionId` or cookie value (e.g. lines 47 and 59–62 in `api/login.ts`) to avoid session hijack via logs.
3. **Validate `DATABASE_URL` at Pool creation or first use** so missing DB config fails fast with a clear error instead of a generic connection failure on first query.
4. **Optionally validate R2_* (or document)** when the download handler runs, so missing R2 config returns a distinct error (e.g. 503 “Storage not configured”) instead of a generic 500.
5. **Document or enforce NODE_ENV in production** so cookie `secure` is set correctly (e.g. ensure production deployments set `NODE_ENV=production`).
6. **Document required vs optional env vars** (e.g. in README or a single env.example) from this inventory so deployers know what must be set.

---

**Audit complete. No code was changed. Proceed to Phase 7A-2 only after explicit approval.**
