# Personal MCP Server

A personal MCP (Model Context Protocol) server that exposes tools for notes, tasks, and personal context. AI clients connect to this server and use the tools to interact with your data. This server does not host an AI or provide a chat interface — it is a tool provider.

**Live deployment:** `https://personal-mcp-server-taupe.vercel.app/api/mcp`

## What it does

- **Notes**: create, read, update, and search notes.
- **Tasks**: create, list, and update tasks with optional details, due dates, and statuses.
- **Personal context**: store key/value pairs that an AI client can retrieve when you ask it to.

---

## Connection modes

### Remote (HTTP via Vercel)

Add this to your MCP client configuration:

```json
{
  "mcpServers": {
    "personal-assistant": {
      "url": "https://personal-mcp-server-taupe.vercel.app/api/mcp"
    }
  }
}
```

Data is stored in the Turso cloud database.

### Local (stdio via Kiro)

The `.kiro/settings/mcp.json` file in this workspace registers the server with Kiro using stdio transport. When you open Kiro in this workspace, it will offer to approve the server. Data falls back to a local `local.db` SQLite file when `TURSO_DATABASE_URL` is not set.

---

## Where data lives

| Mode | Storage |
|------|---------|
| Deployed (Vercel) | Turso cloud database (`TURSO_DATABASE_URL`) |
| Local stdio (no env) | `local.db` in the working directory |

Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in your environment (or `.env` file) to use Turso locally as well.

---

## Install and build

```bash
npm install
npm run build
```

The compiled output goes to `build/`.

---

## Deploy to Vercel

```bash
vercel --yes
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN
vercel --prod
```

---

## Example tool calls

Ask your AI assistant to run any of these:

**Create a note**
```
create_note: { "title": "Meeting notes", "content": "Discussed Q3 roadmap.", "tags": ["work", "meetings"] }
```

**Search notes**
```
search_notes: { "query": "roadmap", "limit": 5 }
```

**Get a note by ID**
```
get_note: { "id": "<uuid returned by create_note>" }
```

**Update a note**
```
update_note: { "id": "<uuid>", "content": "Updated content.", "tags": ["work"] }
```

**Create a task**
```
create_task: { "title": "Review PR #42", "details": "Check the auth changes.", "due_date": "2025-02-01" }
```

**List open tasks**
```
list_tasks: { "status": "open", "limit": 10 }
```

**Update a task**
```
update_task: { "id": "<uuid>", "status": "done" }
```

**Set personal context**
```
set_context: { "key": "preferred_language", "value": "TypeScript" }
```

**Get all personal context**
```
get_my_context: {}
```

---

## Extending with new tools

1. Add a handler function in `src/tools/` (follow the pattern of `notes.ts` or `tasks.ts`).
2. Register the tool in `src/server.ts` with `server.registerTool(name, { description, inputSchema }, handler)`.
3. Run `npm run build` and redeploy.

---

## Troubleshooting

**Check the logs.** The server writes all log output to stderr. If Kiro runs the server as an MCP subprocess, check the MCP server output panel in Kiro.

**Run with the MCP Inspector.** The inspector lets you call tools interactively from a browser UI:

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

**Rebuild after source changes.** The server runs from `build/index.js` (stdio) or `build/api/mcp.js` (HTTP). After editing `src/`, run `npm run build` before restarting or redeploying.
