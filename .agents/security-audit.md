# Security Audit Report — Personal MCP Server

**Audit date:** 2025-07  
**Auditor:** Kiro security audit step (read-only, no changes made)  
**Scope:** Full source read + git history scan + npm audit. Live Vercel deployment was NOT probed; findings are based on code and local git history only.

---

## Architecture Summary

This is a TypeScript MCP server deployed to Vercel as three serverless functions: `/api/mcp` (MCP protocol handler, stateless), `/api/chat` (Gemini-powered chat proxy that calls the same DB tools), and `/` (a static landing page served from an inline HTML string). Data is stored in a Turso (libSQL) cloud database accessed via `@libsql/client`, with credentials read from environment variables at cold-start. A local stdio mode (`src/index.ts`) is also supported for direct AI-client connections. There are no user accounts, no session management, and no authentication layer — every caller, anonymous or not, has equal read/write access to all notes, tasks, and context. The Zod schemas registered on each MCP tool do light type validation but impose no length, size, or format limits on any string field.

---

## Ranked Findings Table

| Severity | ID | Title | Affected File(s) / Route(s) | Description |
|---|---|---|---|---|
| **CRITICAL** | F-01 | Live secrets committed to git history | `.env.production` / commit `d87990b` | TURSO_AUTH_TOKEN, TURSO_DATABASE_URL, and GEMINI_API_KEY were committed with their real values in `.env.production`. Anyone who clones or has cloned the repo has them. |
| **CRITICAL** | F-02 | Live `.env` with real secrets on disk | `.env` (local file) | The local `.env` file contains real, live production credentials (Turso JWT + database URL + Gemini API key). It is in `.gitignore` now, but it was present on disk and must be treated as potentially leaked if the machine or repo was ever shared. |
| **HIGH** | F-03 | No authentication on any API route | `/api/mcp`, `/api/chat` | Any person or automated scanner on the internet can call both endpoints without a token, session cookie, or any credential. They can read, write, and delete all notes, tasks, and context. |
| **HIGH** | F-04 | Error messages from internal errors leak to clients | `src/api/chat.ts` | The `catch` block returns `err.message` verbatim: `res.status(500).json({ error: msg })`. Internal DB errors, Gemini API errors, stack-trace snippets, and connection strings embedded in error objects are all sent to the caller. |
| **HIGH** | F-05 | Vulnerable `@vercel/node` dependency chain (undici, path-to-regexp, busboy) | `package.json` / devDependencies | npm audit reports 4 HIGH + 5 MODERATE vulnerabilities rooted in `@vercel/node ^5.0.0`: ReDoS in `path-to-regexp`, DoS + TLS bypass in `undici`, DoS + CRLF injection in `@fastify/busboy`. |
| **HIGH** | F-06 | `.env.production` not in `.gitignore` | `.gitignore` | Only `.env` is listed in `.gitignore`. `.env.production` (which holds live Vercel env-var exports) is not ignored and was committed to history with real credentials. |
| **MEDIUM** | F-07 | No rate limiting on `/api/chat` or `/api/mcp` | `src/api/chat.ts`, `src/api/mcp.ts` | No request-rate limit, no per-IP throttle, and no daily-spend cap on either endpoint. An attacker can spam `/api/chat` to exhaust the Gemini API quota or run up Turso usage costs. |
| **MEDIUM** | F-08 | No input length limits on any tool parameter | `src/server.ts` (all `registerTool` schemas) | `title`, `content`, `details`, `key`, `value`, `query`, `tags` are all `z.string()` with no `.max()`. A single call could write megabytes to Turso. `limit` and array fields also have no upper bound. `due_date` is `z.string().optional()` with no ISO-8601 format check. |
| **MEDIUM** | F-09 | No HTTP security headers on any route | `src/api/index.ts`, `src/api/mcp.ts`, `src/api/chat.ts` | None of the three API handlers set `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`, or `Content-Security-Policy`. The HTML landing page is served without CSP. |
| **MEDIUM** | F-10 | No CORS restriction on `/api/mcp` or `/api/chat` | `src/api/mcp.ts`, `src/api/chat.ts` | Neither handler sets an `Access-Control-Allow-Origin` header, leaving CORS policy up to Vercel defaults (which allow any origin for serverless functions). Any web page can make credentialed cross-origin calls to both endpoints. |
| **MEDIUM** | F-11 | Vercel OIDC token committed to git history | `.env.production` / commit `d87990b` | The `VERCEL_OIDC_TOKEN` JWT (a time-limited deployment-scoped token) was committed. The token is now expired (it had a short `exp`), but its presence in history reveals the deployment structure and sets a bad precedent. |
| **LOW** | F-12 | No request body size limit | `src/api/mcp.ts` | The body-collection loop in `src/api/mcp.ts` pushes all `data` chunks into an array with no size cap. A caller can stream an arbitrarily large body, consuming memory until the serverless function is killed. |
| **LOW** | F-13 | `searchNotes` LIKE pattern wraps user input without sanitization | `src/db.ts:searchNotes` | The function wraps the query in `%…%` and passes it as a bound parameter — this is correctly parameterized, so there is no SQL injection. However, SQL `LIKE` wildcards (`%`, `_`) in user input are treated literally as wildcards, allowing pattern amplification (e.g., `%` matches everything and forces a full table scan). This is low severity but can amplify DB cost. |
| **LOW** | F-14 | `local.db` SQLite fallback has no `.db` path restriction in Vercel routing | `vercel.json`, `.gitignore` | `*.db` files are gitignored, but `vercel.json` has no rule to block requests to `*.db` paths. If a `.db` file were ever placed in the project root (easy to do accidentally with the local fallback), Vercel could serve it. |

---

## CRITICAL Findings

### F-01 — Live secrets committed to git history

**File:** `.env.production`  
**Commit:** `d87990b` ("fix: use Interactions API and gemini-3.8-flash for chatbot")

The file `.env.production` was generated by the Vercel CLI (`vercel env pull .env.production`) and committed to the repository. It contained the real, live values of `GEMINI_API_KEY`, `TURSO_AUTH_TOKEN`, and `TURSO_DATABASE_URL` at the time of that commit. These values now exist in the git object store permanently unless history is rewritten — and even after a rewrite, any clone made before the rewrite retains them.

**Recommended fix:**
1. Rotate all three credentials immediately (see Manual Actions section).
2. Add `.env.production` and `.env*.production` to `.gitignore`.
3. After rotation, optionally rewrite history with `git filter-repo --path .env.production --invert-paths` and force-push (coordinate with any collaborators and invalidate all existing clones). Do not rewrite if the repo is public and has been cloned — rotation alone is the meaningful mitigation.

---

### F-02 — Live `.env` with real secrets on disk

**File:** `.env` (local, not committed)

The local `.env` file contains the production Turso JWT token, the Turso database URL, and the Gemini API key with their current live values. While the file is correctly in `.gitignore` and is not in git history, its presence on the development machine means it would be included if the project directory were ever zipped, backed up to cloud storage, or shared. The token format is a Turso JWT (`eyJhbGciOiJFZERTQSJ9...`) with read/write access.

**Recommended fix:** After rotating credentials (see Manual Actions), replace the values with placeholders. Use only `.env.example` as documentation; pull real values from a password manager or the Vercel CLI on-demand.

---

## HIGH Findings

### F-03 — No authentication on any API route

**Files:** `src/api/mcp.ts`, `src/api/chat.ts`  
**Routes:** `POST /api/mcp`, `POST /api/chat`

Neither endpoint checks for a bearer token, API key header, or any other credential. Any caller — a human with curl, a scanner, or a malicious website — can read all notes, tasks, and context, create or delete records, and invoke the Gemini-backed chat (burning quota) without restriction.

See the **Authentication Gap** section for the proposed bearer-token design.

---

### F-04 — Error messages leak internal details to clients

**File:** `src/api/chat.ts`, lines ~125–129

```typescript
} catch (err) {
  console.error('[chat]', err);
  const msg = err instanceof Error ? err.message : 'Internal server error';
  return res.status(500).json({ error: msg });
}
```

`err.message` from a Turso error includes the SQL statement that failed, the connection URL, and sometimes auth-token fragments. Gemini API errors include model names, quota codes, and sometimes the request payload. All of this is forwarded verbatim to the browser.

**Recommended fix:** Log the full error server-side; return only a generic message to the client:
```typescript
console.error('[chat]', err);
return res.status(500).json({ error: 'Internal server error' });
```

---

### F-05 — Vulnerable `@vercel/node` dependency chain

**File:** `package.json` (`devDependencies: "@vercel/node": "^5.0.0"`)

npm audit (run against the installed `node_modules`) reports the following advisories rooted in `@vercel/node`:

| Package | Advisory Title | Severity |
|---|---|---|
| `undici` | TLS certificate validation bypass via dropped tls options in Agent | HIGH |
| `undici` | DoS via TLS 1.2 certificate-changing renegotiation | HIGH |
| `undici` | WebSocket client DoS via unbounded automatic PONG buffering | HIGH |
| `undici` | WebSocket client DoS via fragment count bypass | HIGH |
| `path-to-regexp` | Outputs backtracking regular expressions (ReDoS) | HIGH |
| `@fastify/busboy` | DoS via prototype-named multipart part header | HIGH |
| `undici` | Unbounded decompression chain via Content-Encoding | MODERATE |
| `undici` | HTTP Request/Response Smuggling | MODERATE |
| `ajv` | ReDoS when using `$data` option | MODERATE |
| `glob` | AbortSignal cancellation bypass allows post-timeout filesystem traversal | MODERATE |
| `minimatch` | DoS via globparts amplification | MODERATE |

The fix available is `@vercel/node@4.0.0`, which is a **major-version downgrade** from `^5.0.0`. Review the Vercel changelog before downgrading; `^4.x` and `^5.x` have different request-object APIs. Test locally before deploying.

---

### F-06 — `.env.production` not in `.gitignore`

**File:** `.gitignore`

The `.gitignore` lists `.env` but not `.env.production`. The Vercel CLI `vercel env pull` command always generates `.env.production`. This gap is what allowed F-01 to happen.

**Recommended fix:** Add these lines to `.gitignore`:
```
.env.production
.env.local
.env.development
.env.test
```

---

## MEDIUM Findings

### F-07 — No rate limiting

**Files:** `src/api/chat.ts`, `src/api/mcp.ts`

No middleware, no Vercel edge config, and no upstream WAF applies a request rate limit to either endpoint. The `/api/chat` endpoint creates a Gemini interaction per request and potentially multiple DB calls per interaction. With no limit, a single abusive caller can exhaust the Gemini free tier in minutes.

**Recommended fix:** At minimum, add a Vercel Edge Middleware (`middleware.ts` at the project root) that counts requests per IP using a KV store (Vercel KV, Upstash Redis) and returns `429 Too Many Requests` above a threshold (e.g., 20 requests/minute for `/api/chat`, 60 for `/api/mcp`). Without a KV store, a simple in-memory counter resets on each cold start and provides weak but non-zero protection.

---

### F-08 — No input length limits in Zod schemas

**File:** `src/server.ts` (all `registerTool` calls)

Every string field uses a bare `z.string()`. The specific gaps:

- `create_note`: `title` (no max), `content` (no max — could be megabytes), `tags` array (no `.max()` on array or items).
- `update_note`: same as above, plus `id` (no UUID format check).
- `create_task` / `update_task`: `title`, `details`, `due_date` all unconstrained. `due_date` accepts any string; `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` or `.date()` (Zod 4) would enforce ISO 8601.
- `search_notes`: `query` unconstrained; `limit` has no `.max()`.
- `set_context`: `key` and `value` unconstrained — a 10 MB context value is accepted.

**Recommended fix example:**
```typescript
title: z.string().min(1).max(500),
content: z.string().max(50_000),
tags: z.array(z.string().max(100)).max(20).optional(),
due_date: z.string().date().optional(),   // Zod 4 built-in
query: z.string().min(1).max(500),
limit: z.number().int().positive().max(100).optional().default(10),
key: z.string().min(1).max(200),
value: z.string().max(10_000),
```

---

### F-09 — No HTTP security headers

**Files:** `src/api/index.ts`, `src/api/mcp.ts`, `src/api/chat.ts`

None of the three handlers set any of the standard defensive HTTP headers. The landing page is served without a `Content-Security-Policy`, meaning any injected `<script>` tag would run. `X-Frame-Options: DENY` is missing, leaving the page embeddable in iframes for clickjacking. `X-Content-Type-Options: nosniff` is not set.

**Recommended fix:** Add these headers to every response (can be done in a shared helper or in `vercel.json` using the `headers` key):

```json
{ "key": "X-Content-Type-Options", "value": "nosniff" },
{ "key": "X-Frame-Options", "value": "DENY" },
{ "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
{ "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'" }
```

Note: the landing page uses inline `<style>` and an inline `<script>` block, so the CSP must include `'unsafe-inline'` for those directives unless the scripts are moved to separate files with nonces.

---

### F-10 — No CORS restriction

**Files:** `src/api/mcp.ts`, `src/api/chat.ts`

Neither handler explicitly sets `Access-Control-Allow-Origin`. Vercel's default for serverless functions is permissive. Any origin can make cross-origin POST requests.

For `/api/chat` (browser-facing): restrict to your own domain:
```typescript
res.setHeader('Access-Control-Allow-Origin', 'https://personal-mcp-server-taupe.vercel.app');
```

For `/api/mcp` (AI-client-facing): MCP clients do not use browsers, so CORS is not relevant to them in the typical threat model; leaving it open or restricting it both work. If you later add a browser-based MCP client, revisit.

---

### F-11 — Vercel OIDC token committed in `.env.production`

**Commit:** `d87990b`  
**Key:** `VERCEL_OIDC_TOKEN`

The OIDC token committed in `.env.production` is a JWT signed by `https://oidc.vercel.com/paradoxxx` with a short expiry (`exp: 1795209992`). It has already expired, so there is no immediate exploit. However, it discloses the Vercel team slug (`paradoxxx`), project ID (`prj_Be7GcPNnxZY34V7ndcp0hmXgbeWN`), and user ID, which could assist targeted attacks against the Vercel account.

---

## LOW Findings

### F-12 — No request body size limit in `/api/mcp`

**File:** `src/api/mcp.ts`, lines ~11–17

The body is collected by pushing all chunks into a `Buffer[]` with no size cap. A caller can send a multi-megabyte body before the serverless function's memory ceiling kills it, potentially causing slow/expensive cold starts.

**Recommended fix:** Add a size guard:
```typescript
let totalBytes = 0;
req.on("data", (chunk: Buffer) => {
  totalBytes += chunk.length;
  if (totalBytes > 1_048_576) { // 1 MB
    req.destroy();
    res.statusCode = 413;
    res.end('Payload Too Large');
    return;
  }
  bodyChunks.push(chunk);
});
```

---

### F-13 — LIKE wildcard amplification in `searchNotes`

**File:** `src/db.ts`, `searchNotes` function

User-supplied `query` is correctly passed as a bound parameter (`args: [pattern, pattern, limit]`), so there is **no SQL injection**. However, the pattern wraps user input as `%${query}%`, meaning a query of `%` or `_` matches every row and forces a full table scan. With a large notes table this costs Turso read units proportional to the table size.

**Recommended fix:** Escape LIKE metacharacters before wrapping:
```typescript
const escaped = query.replace(/[%_\\]/g, '\\$&');
const pattern = `%${escaped}%`;
// Add ESCAPE '\\' to the SQL: "... LIKE ? ESCAPE '\\' ..."
```

---

### F-14 — No Vercel route blocking `.db` paths

**File:** `vercel.json`

The routing table only maps `/api/mcp`, `/api/chat`, and `/`. There is no deny rule for `*.db`, `*.db-shm`, `*.db-wal`. The local SQLite fallback creates `./local.db` relative to the working directory. On Vercel, local SQLite writes are discarded at request end, but a build step or a checked-in `.db` file would be accessible via a direct URL with no route to intercept it.

---

## Authentication Gap

This project currently has no user accounts, sessions, or authentication layer. Every caller reaches the same shared database with full read/write permission.

**Proposed minimum safe design — shared-secret bearer token:**

Add a single environment variable, e.g. `MCP_BEARER_TOKEN`, whose value is a randomly generated 256-bit hex or base64 string. On every incoming request to `/api/mcp` and `/api/chat`, read the `Authorization` header and compare it to the stored secret using a timing-safe comparison (`crypto.timingSafeEqual`). Return `401 Unauthorized` if the header is missing or the value does not match.

```
Authorization: Bearer <MCP_BEARER_TOKEN value>
```

The MCP configuration snippet on the landing page would be updated to include the `headers` field:
```json
{
  "mcpServers": {
    "personal-assistant": {
      "url": "https://personal-mcp-server-taupe.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN_HERE" }
    }
  }
}
```

This design:
- Is reversible (remove the env var to disable it, though that re-opens the endpoint).
- Does not require a database or session store.
- Is compatible with all MCP clients that support custom headers (Kiro does; check other clients before sharing).
- Does not require user accounts, which would be a much larger change.

Limitation: a single shared token cannot distinguish between callers. All holders of the token share one data namespace. If you share the server with friends, they all see your personal data. Per-user isolation requires user accounts, which is out of scope for this design.

---

## Password Storage

This project does **not** store, hash, or handle passwords. There are no user accounts, login flows, password-reset flows, or hashing calls anywhere in the codebase. No password-storage changes are needed.

---

## npm Audit Findings

All 9 vulnerabilities are transitively rooted in the `@vercel/node` dev dependency. The fix available for all of them is `@vercel/node@4.0.0`, which is a major-version change. Advisory titles only (no CVE numbers, no package@version):

**HIGH severity:**
- `undici` — TLS certificate validation bypass via dropped tls options in Agent
- `undici` — Denial of Service via TLS 1.2 certificate-changing renegotiation
- `undici` — WebSocket client Denial of Service via unbounded automatic PONG buffering
- `undici` — WebSocket client Denial of Service via fragment count bypass
- `path-to-regexp` — Outputs backtracking regular expressions (ReDoS)
- `@fastify/busboy` — Denial of Service via prototype-named multipart part header

**MODERATE severity:**
- `undici` — Unbounded decompression chain via Content-Encoding (resource exhaustion)
- `undici` — HTTP Request/Response Smuggling
- `undici` — CRLF injection via blob-like body 'type' property
- `undici` — Cookie attribute injection via unsanitized domain
- `@fastify/busboy` — CRLF injection via multipart Content-Disposition filename and name
- `ajv` — ReDoS when using `$data` option
- `glob` — AbortSignal cancellation bypass allows post-timeout filesystem traversal
- `minimatch` — Denial of Service via globparts amplification

> Note: `@vercel/node` is a **dev dependency** used only for local type-checking and local test invocation. It is not bundled into the deployed serverless functions; Vercel provides its own runtime on the server side. The practical exploitability of these vulnerabilities against the production deployment is therefore **low** — they would only be relevant if an attacker could inject malicious content into your local build environment. The vulnerabilities should still be addressed to keep the dev environment clean.

---

## Git History Findings

Three commits were scanned. No `.env` file was ever committed (it is correctly gitignored from commit 1). However:

| Commit | Path | Finding |
|---|---|---|
| `d87990b` | `.env.production` | File committed with live values for `GEMINI_API_KEY`, `TURSO_AUTH_TOKEN`, `TURSO_DATABASE_URL`, and `VERCEL_OIDC_TOKEN`. **Credentials must be rotated.** |
| `0cbaf74` | Various `.ts` and `.json` files | Commit `-S "GEMINI"` match — the string `GEMINI` appears in source code as the env-var name reference (`process.env.GEMINI_API_KEY`). No hardcoded value found in source, only the env-var name. |
| `2237aab` | Various `.ts` and `.json` files | Commit `-S "TURSO"` match — the string `TURSO` appears in source code as env-var name references. No hardcoded value found in source. |
| `2237aab` | Various `.ts`, `.js`, `.json` files | Commit `-S "sk-"` match — this matched the initial commit. After inspection, the `sk-` prefix appears only in the commit subject line context, not as a hardcoded secret in any source file. No OpenAI-style API key was found in source. |

**`.env.production` was NOT added to `.gitignore`** — that is the gap that allowed F-01 to occur (see F-06).

---

## Manual Actions Required

The following items cannot be automated and must be done by the repository owner:

1. **IMMEDIATE — Rotate TURSO_AUTH_TOKEN.** Go to [turso.tech](https://turso.tech) → your database → Tokens, revoke the token that was committed in `d87990b`, and generate a new one. Update the `TURSO_AUTH_TOKEN` environment variable in the Vercel dashboard.

2. **IMMEDIATE — Rotate GEMINI_API_KEY.** Go to [Google AI Studio](https://aistudio.google.com/app/apikey), delete the API key that was committed, and create a new one. Update `GEMINI_API_KEY` in the Vercel dashboard.

3. **IMMEDIATE — Delete or replace `.env` on this machine.** The local `.env` file contains the same (or older) live credentials. After rotation, update the file with the new values, or delete it and always pull credentials with `vercel env pull`.

4. **Add `.env.production` to `.gitignore`** to prevent recurrence.

5. **Review Vercel environment variables** in the Vercel dashboard to confirm `TURSO_AUTH_TOKEN` and `GEMINI_API_KEY` are set there as server-side (not public) variables, and that no other secret is set as an `VERCEL_PUBLIC_` variable.

6. **Consider adding the shared bearer token** (see Authentication Gap) before sharing the MCP URL with other people. Without it, anyone who has the URL can read and write all your personal data.

7. **Evaluate `@vercel/node` version** — run `npm install @vercel/node@4` in a branch, verify local TypeScript compilation still passes, and test before merging. The breaking-change risk is in the `VercelRequest`/`VercelResponse` API surface which both `chat.ts` and `index.ts` use.

---

*This report reflects the state of the repository at audit time. It describes observed conditions; it does not guarantee the absence of other vulnerabilities. The live Vercel deployment was not directly probed.*
