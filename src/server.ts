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

export async function createServer(): Promise<McpServer> {
  await initDb();
  const server = new McpServer(
    { name: "personal-assistant", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    "create_note",
    {
      description: "Create a new note with a title, content, and optional tags",
      inputSchema: {
        title: z.string(),
        content: z.string(),
        tags: z.array(z.string()).optional(),
      },
    },
    (args) => wrap(() => handleCreateNote(args))
  );

  server.registerTool(
    "get_note",
    {
      description: "Retrieve a note by its ID",
      inputSchema: { id: z.string() },
    },
    (args) => wrap(() => handleGetNote(args))
  );

  server.registerTool(
    "update_note",
    {
      description: "Update the title, content, or tags of an existing note",
      inputSchema: {
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        tags: z.array(z.string()).optional(),
      },
    },
    (args) => wrap(() => handleUpdateNote(args))
  );

  server.registerTool(
    "search_notes",
    {
      description: "Full-text search notes by title and content",
      inputSchema: {
        query: z.string(),
        limit: z.number().int().positive().optional().default(10),
      },
    },
    (args) => wrap(() => handleSearchNotes(args))
  );

  server.registerTool(
    "create_task",
    {
      description: "Create a new task with optional details and due date",
      inputSchema: {
        title: z.string(),
        details: z.string().optional(),
        due_date: z.string().optional(),
      },
    },
    (args) => wrap(() => handleCreateTask(args))
  );

  server.registerTool(
    "list_tasks",
    {
      description: "List tasks, optionally filtered by status (open, in_progress, done)",
      inputSchema: {
        status: z.enum(["open", "in_progress", "done"]).optional(),
        limit: z.number().int().positive().optional().default(20),
      },
    },
    (args) => wrap(() => handleListTasks(args))
  );

  server.registerTool(
    "update_task",
    {
      description: "Update an existing task's title, details, due date, or status",
      inputSchema: {
        id: z.string(),
        title: z.string().optional(),
        details: z.string().optional(),
        due_date: z.string().optional(),
        status: z.enum(["open", "in_progress", "done"]).optional(),
      },
    },
    (args) => wrap(() => handleUpdateTask(args))
  );

  server.registerTool(
    "get_my_context",
    {
      description: "Retrieve all configured personal context key/value pairs",
      inputSchema: {},
    },
    () => wrap(() => handleGetMyContext())
  );

  server.registerTool(
    "set_context",
    {
      description: "Set a personal context key/value pair for the AI to reference",
      inputSchema: {
        key: z.string(),
        value: z.string(),
      },
    },
    (args) => wrap(() => handleSetContext(args))
  );

  console.error("[personal-assistant] MCP server ready");
  return server;
}
