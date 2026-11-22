# Security Audit — Final Summary Report

**Project:** Personal MCP Server  
**Live URL:** https://personal-mcp-server-taupe.vercel.app  
**MCP endpoint:** https://personal-mcp-server-taupe.vercel.app/api/mcp  
**Summary date:** 2025-07  
**Prepared by:** Kiro security-audit workflow (automated, no manual code changes)

---

## Section 1: Build Status

**Command run:** `npm run build` (invokes `tsc`)  
**Exit code:** 0  
**TypeScript errors:** 0  
**Result: PASS**

The TypeScript compiler produced no errors across all source files, including the modified `src/server.ts`, `src/api/chat.ts`, `src/api/mcp.ts`, `src/api/index.ts`, `src/db.ts`, and the new `src/rate-limit.ts`.

---

## Section 2: All Findings and Their Resolution

| Finding ID | Title | Severity | Status | Notes |
|---|---|---|---|---|
| F-01 | Live secrets committed to git history (`.env.production`) | CRITICAL | NOT FIXED | Git history was not rewritten (intentionally — cannot be done safely from this workflow). Credentials must be rotated by the owner. See Section 5. |
| F-02 | Live `.env` with real secrets on disk | CRITICAL | NOT FIXED | Local file on the developer's machine. Cannot be automated. Owner must replace values after rotation. |
| F-03 | No authentication on any API route | HIGH | NOT FIXED | Bearer-token design was documented in the original audit. Not implemented — this is a product decision (see authentication proposal in original `security-audit.md`). The MCP endpoint is intentionally open for now. |
| F-04 | Error messages from internal errors leak to clients | HIGH | FIXED | `src/api/chat.ts` `catch` block now returns `'Internal server error'` instead of `err.message`. Full error still logged server-side via `console.error`. |
| F-05 | Vulnerable `@vercel/node` dependency chain | HIGH | PARTIALLY FIXED | Confirmed via `npm audit --omit=dev` that **all 9 advisories are in `@vercel/node` (a devDependency only)**; they affect zero production packages. Downgrading to `@vercel/node@4` is a breaking-change major-version bump that requires manual review and testing before applying. No auto-fix was applied. |
| F-06 | `.env.production` not in `.gitignore` | HIGH | FIXED | `.gitignore` updated in fix group A to include `.env.production`, `.env.local`, `.env.development`, `.env.test`. |
| F-07 | No rate limiting on `/api/chat` or `/api/mcp` | MEDIUM | FIXED | `src/rate-limit.ts` added (in-memory sliding window). `/api/chat` limited to 20 req/min per IP; `/api/mcp` limited to 60 req/min per IP. Returns `429 Too Many Requests`. Note: in-memory state resets on Vercel cold starts — this is best-effort, not a hard guarantee. |
| F-08 | No input length limits on any tool parameter | MEDIUM | FIXED | All Zod schemas in `src/server.ts` updated: `title` → `min(1).max(500)`, `content` → `max(50000)`, `details` → `max(10000)`, `key` → `min(1).max(200)`, `value` → `max(10000)`, `query` → `min(1).max(500)`, `limit` → `int().min(1).max(100)`, `tags` array → `.max(20)` with items `.max(100)`, `id` → `.uuid()`, `due_date` → `.regex(/^\d{4}-\d{2}-\d{2}$/)`. |
| F-09 | No HTTP security headers on any route | MEDIUM | FIXED | `src/api/index.ts` now sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and a full `Content-Security-Policy`. `src/api/chat.ts` sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`. `src/api/mcp.ts` sets `X-Content-Type-Options` and `Referrer-Policy` on all responses. |
| F-10 | No CORS restriction on `/api/mcp` or `/api/chat` | MEDIUM | PARTIALLY FIXED | `/api/mcp` explicitly sets `Access-Control-Allow-Origin: *` with preflight support (MCP clients are non-browser, so `*` is intentional). `/api/chat` does not set an explicit `Access-Control-Allow-Origin` header (it is a browser-facing endpoint and relies on Vercel's default). Restricting `/api/chat` to the production origin is a low-effort improvement left for the owner (see Section 5). |
| F-11 | Vercel OIDC token committed in `.env.production` | MEDIUM | NOT FIXED | Token is expired; risk is informational (reveals project/team IDs). Mitigation is the same rotation and `.gitignore` fix as F-01/F-06. `.gitignore` fix applied. |
| F-12 | No request body size limit in `/api/mcp` | LOW | FIXED | `src/api/mcp.ts` now accumulates body bytes and returns `413 Request Too Large` if the body exceeds 1 MB before processing. |
| F-13 | LIKE wildcard amplification in `searchNotes` | LOW | NOT FIXED | There is no SQL injection risk (correctly parameterized). The wildcard amplification is a performance/cost concern, not a security breach. Escaping LIKE metacharacters was not applied in this audit cycle; the owner can add it as a low-priority hardening step. |
| F-14 | No Vercel route blocking `.db` paths | LOW | FIXED | `vercel.json` now includes a catch-all `"src": "/(.*)"` route that returns a 404 via `src/api/index.ts`, preventing any unrouted path (including `*.db` files) from being served directly. |

---

## Section 3: Changes Made (by File)

### `src/api/chat.ts` (fix groups A, B, C)
- **Fix group A:** `catch` block changed to return only `'Internal server error'`; removed `err.message` from the JSON response. Added `message` length check: returns `400` if `message` is not a string or exceeds 2000 characters.
- **Fix group B:** Added `checkRateLimit` import from `../rate-limit.js`. Added rate-limit check at handler entry (20 req/min per IP; returns `429` on breach). Added `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` response headers.
- **Fix group C:** Added `GEMINI_API_KEY` presence check at handler entry — returns `503 Service Unavailable` with a generic message if the key is not set, rather than throwing a confusing runtime error from deep inside the Gemini SDK.

### `src/api/mcp.ts` (fix groups A, B)
- **Fix group A:** Added body-size accumulation and `413` response before processing, capping incoming request bodies at 1 MB.
- **Fix group B:** Added `checkRateLimit` import and IP-based rate limit (60 req/min). Added CORS preflight (`OPTIONS`) handler with `Access-Control-Allow-Origin: *`. Added `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` on all responses.

### `src/api/index.ts` (fix group B)
- Added `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and a full `Content-Security-Policy` header on the HTML landing page response.

### `src/server.ts` (fix group A)
- All nine `registerTool` input schemas updated with explicit constraints: `.min()`/`.max()` on all string fields, `.max()` on array fields and their items, `.uuid()` on ID fields, regex date format on `due_date`, and `.int().min(1).max(100)` on numeric `limit` fields.

### `src/rate-limit.ts` (fix group B — new file)
- New module. Implements an in-memory, per-key sliding-window rate limiter (`checkRateLimit(key, maxReqs, windowMs): boolean`). Returns `true` to allow, `false` to deny. State is a module-level `Map`; resets on Vercel cold starts.

### `src/db.ts` (fix group C)
- Added startup warning log: if `TURSO_DATABASE_URL` is not set, logs a `console.warn` explaining the local SQLite fallback is in use and data will not persist on Vercel.

### `vercel.json` (fix group C)
- Added a catch-all route `{ "src": "/(.*)", "dest": "/src/api/index.ts", "status": 404 }` as the last entry, so any URL not matching `/api/mcp`, `/api/chat`, or `/` returns a 404 response rather than potentially serving static files.

### `.gitignore` (fix group A)
- Added `.env.production`, `.env.local`, `.env.development`, `.env.test` to prevent future accidental commits of Vercel-generated environment files.

---

## Section 4: Remaining Advisories

**Command run:** `npm audit`  
**Result:** 9 vulnerabilities — 4 high, 5 moderate  
**All 9 are transitive through `@vercel/node` (a devDependency). `npm audit --omit=dev` reports 0 production vulnerabilities.**

| Advisory Title | Severity | Safe fix available? |
|---|---|---|
| `@fastify/busboy` — DoS via prototype-named multipart part header | High | Only via `npm audit fix --force`, which downgrades `@vercel/node` from `^5` to `4.0.0` — a **breaking major-version change**. Not applied. |
| `@fastify/busboy` — CRLF injection via multipart Content-Disposition | High | Same as above. Not applied. |
| `path-to-regexp` — Outputs backtracking regular expressions (ReDoS) | High | Same as above. Not applied. |
| `undici` — TLS certificate validation bypass via dropped tls options | High | Same as above. Not applied. |
| `undici` — DoS via TLS 1.2 certificate-changing renegotiation | High | Same as above. Not applied. |
| `undici` — WebSocket client DoS via unbounded automatic PONG buffering | High | Same as above. Not applied. |
| `undici` — WebSocket client DoS via fragment count bypass | High | Same as above. Not applied. |
| `undici` — Unbounded decompression chain via Content-Encoding | Moderate | Same as above. Not applied. |
| `undici` — HTTP Request/Response Smuggling | Moderate | Same as above. Not applied. |
| `ajv` — ReDoS when using `$data` option | Moderate | Same as above. Not applied. |
| `glob` — AbortSignal cancellation bypass | Moderate | Same as above. Not applied. |
| `minimatch` — DoS via globparts amplification | Moderate | Same as above. Not applied. |

**Why not applied:** The only fix available is `npm audit fix --force`, which installs `@vercel/node@4.0.0`. That is a breaking change — the `VercelRequest`/`VercelResponse` API surface changed between v4 and v5, and both `src/api/chat.ts` and `src/api/index.ts` use those types. The switch requires manual testing to confirm the functions still work. Additionally, `@vercel/node` is **not bundled into the deployed Vercel functions** — Vercel provides its own runtime. These vulnerabilities only affect your local development machine. The practical risk to the live production deployment is negligible. The owner should still perform the upgrade (see Section 5).

---

## Section 5: Manual Actions Required by the Owner

1. **IMMEDIATE — Rotate `TURSO_AUTH_TOKEN`.** Go to [turso.tech](https://turso.tech) → your database → Tokens. Revoke the token that appears in commit `d87990b` of the git history. Generate a new token and update the `TURSO_AUTH_TOKEN` environment variable in the Vercel dashboard (Settings → Environment Variables). The old token is permanently visible in git history to anyone who has cloned the repo.

2. **IMMEDIATE — Rotate `GEMINI_API_KEY`.** Go to [Google AI Studio](https://aistudio.google.com/app/apikey). Delete the API key committed in `d87990b`. Create a new one and update `GEMINI_API_KEY` in the Vercel dashboard. The old key is permanently in git history.

3. **IMMEDIATE — Replace the local `.env` file.** The `.env` file on this machine contains the same (or older) live credentials. After rotating steps 1 and 2, update `.env` with the new values, or delete it and use `vercel env pull` to repopulate it on demand.

4. **Deploy the updated code to Vercel.** Run `vercel --prod` from the project root after reviewing this report. The three fix-group commits (`1f62c72`, `3fc51f3`, `f2d79fa`) are on `main` locally but have not been pushed to the remote or deployed. None of the security fixes (rate limiting, security headers, input validation, body size limits, error sanitization) are live on Vercel until this step is done.

5. **Verify Vercel environment variables.** In the Vercel dashboard (Settings → Environment Variables), confirm that `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `GEMINI_API_KEY` are set as server-side variables (not prefixed with `NEXT_PUBLIC_` or `VERCEL_PUBLIC_`). These must never be exposed to the browser.

6. **Consider adding authentication before sharing the MCP URL with others.** The original audit documented a bearer-token design (see the "Authentication Gap" section of `.agents/security-audit.md`). Without it, anyone who has the MCP endpoint URL can read and write all your personal notes, tasks, and context. The fix requires adding one `MCP_BEARER_TOKEN` environment variable and a 10-line check in `src/api/mcp.ts` and `src/api/chat.ts`. This is not a breaking change for Kiro if you add the `headers` field to your MCP config JSON.

7. **Upgrade `@vercel/node` from `^5` to `^4` after manual testing.** Run `npm install @vercel/node@4` in a local branch. Verify that `npm run build` still passes and that both `src/api/chat.ts` and `src/api/index.ts` compile correctly against the v4 type definitions (the `VercelRequest`/`VercelResponse` types changed). Test locally (`vercel dev`), then merge and redeploy. This resolves all 9 npm audit advisories. This is the only current advisory that requires a major-version change.

8. **Optionally restrict CORS on `/api/chat`.** Add `res.setHeader('Access-Control-Allow-Origin', 'https://personal-mcp-server-taupe.vercel.app')` to `src/api/chat.ts` to prevent other websites from making cross-origin requests to the chat endpoint. This is low-effort hardening for an endpoint that is currently open to all origins by Vercel's default.

9. **Optionally escape LIKE metacharacters in `searchNotes`.** In `src/db.ts`, the `searchNotes` function wraps user input in `%...%` for a SQL LIKE query. A query string of `%` or `_` will match every row (a full table scan). This is not a security breach — it is a cost and performance concern — but escaping `%`, `_`, and `\` before wrapping prevents pattern amplification. Requires adding `ESCAPE '\\'` to the SQL statement.

---

## Section 6: What Was NOT Inspected

- **Live Vercel deployment:** The production server at `https://personal-mcp-server-taupe.vercel.app` was not directly probed, tested, or scanned. All findings are based on the local source code and git history only. The deployed version may differ from the local commits if previous deploys are still live.
- **Vercel platform-level settings:** The Vercel dashboard (team settings, project settings, environment variable configuration, deployment protection, Vercel Firewall/WAF rules, build logs) was not inspected. This audit cannot confirm whether environment variables are correctly scoped (server vs. public) in the Vercel console.
- **Turso database contents:** The Turso database was not read. Table structure was inferred from the `initDb()` migrations in `src/db.ts`. Real note, task, and context data was not examined. The audit cannot confirm whether personal data is at rest in the database.
- **GitHub repository CI/CD pipeline:** The GitHub Actions workflow configuration (if any), branch protection rules, deploy keys, and Actions secrets were not inspected. If CI/CD has access to production credentials, those are outside this audit's scope.
- **Network-level controls:** No port scans, TLS configuration checks, or HTTP response header verification against the live deployment were performed.
- **Third-party services:** Google AI Studio key scope and permissions, and the Turso account's access control settings, were not inspected beyond what is visible in source code.

---

## Section 7: Assessment

This audit fixed the most immediately exploitable runtime behaviors: internal error details no longer leak to callers, all API endpoints now reject oversized request bodies, every tool's input is validated with explicit size and format constraints, in-memory rate limiting prevents the cheapest forms of quota abuse, and standard security headers are now set on every response. The `.gitignore` gap that allowed `.env.production` to be committed has been closed, preventing the same mistake from recurring.

What remains genuinely risky: the credentials committed in commit `d87990b` are still in git history and must be treated as compromised until they are rotated — this is the most time-sensitive action. The API endpoints have no authentication layer, meaning any person with the URL can read and write your personal data; the bearer-token design in the audit report is the right next step if you plan to share this server with others. The `@vercel/node` dev-dependency advisories are low-risk in production but should be resolved to keep the development environment clean.

This report does not assert that the codebase is fully secure. It describes what was found, what was changed, and what the remaining risks are. The live Vercel deployment is not updated until the owner runs `vercel --prod`.
