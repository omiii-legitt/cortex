import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { initDb } from "./db.js";
import {
  handleCreateNote,
  handleGetNote,
  handleUpdateNote,
  handleSearchNotes,
} from "./tools/notes.js";
import {
  handleCreateTask,
  handleListTasks,
  handleUpdateTask,
} from "./tools/tasks.js";
import { handleGetMyContext, handleSetContext } from "./tools/context.js";

// MCP is machine-to-machine. Per-user MCP auth requires per-user bearer tokens (future enhancement). For now all MCP calls use the 'system' account.

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

async function wrap<T>(fn: () => Promise<T>) {
  try {
    return text(await fn());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return text({ error: msg });
  }
}

export async function createServer(userId: string = "system"): Promise<McpServer> {
  await initDb();
  const server = new McpServer(
    { name: "cortex", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    "create_note",
    {
      description: "Create a new note with a title, content, and optional tags",
      inputSchema: {
        title: z.string().min(1).max(500),
        content: z.string().max(50000),
        tags: z.array(z.string().max(100)).max(20).optional(),
      },
    },
    (args) => wrap(() => handleCreateNote(userId, args))
  );

  server.registerTool(
    "get_note",
    {
      description: "Retrieve a note by its ID",
      inputSchema: { id: z.string().uuid() },
    },
    (args) => wrap(() => handleGetNote(userId, args))
  );

  server.registerTool(
    "update_note",
    {
      description: "Update the title, content, or tags of an existing note",
      inputSchema: {
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        content: z.string().max(50000).optional(),
        tags: z.array(z.string().max(100)).max(20).optional(),
      },
    },
    (args) => wrap(() => handleUpdateNote(userId, args))
  );

  server.registerTool(
    "search_notes",
    {
      description: "Full-text search notes by title and content",
      inputSchema: {
        query: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(100).optional().default(10),
      },
    },
    (args) => wrap(() => handleSearchNotes(userId, args))
  );

  server.registerTool(
    "create_task",
    {
      description: "Create a new task with optional details and due date",
      inputSchema: {
        title: z.string().min(1).max(500),
        details: z.string().max(10000).optional(),
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      },
    },
    (args) => wrap(() => handleCreateTask(userId, args))
  );

  server.registerTool(
    "list_tasks",
    {
      description: "List tasks, optionally filtered by status (open, in_progress, done)",
      inputSchema: {
        status: z.enum(["open", "in_progress", "done"]).optional(),
        limit: z.number().int().min(1).max(100).optional().default(20),
      },
    },
    (args) => wrap(() => handleListTasks(userId, args))
  );

  server.registerTool(
    "update_task",
    {
      description: "Update an existing task's title, details, due date, or status",
      inputSchema: {
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        details: z.string().max(10000).optional(),
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        status: z.enum(["open", "in_progress", "done"]).optional(),
      },
    },
    (args) => wrap(() => handleUpdateTask(userId, args))
  );

  server.registerTool(
    "get_my_context",
    {
      description: "Retrieve all configured personal context key/value pairs",
      inputSchema: {},
    },
    () => wrap(() => handleGetMyContext(userId))
  );

  server.registerTool(
    "set_context",
    {
      description: "Set a personal context key/value pair for the AI to reference",
      inputSchema: {
        key: z.string().min(1).max(200),
        value: z.string().max(10000),
      },
    },
    (args) => wrap(() => handleSetContext(userId, args))
  );

  console.error("[cortex] MCP server ready");
  return server;
}
