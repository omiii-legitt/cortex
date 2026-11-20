import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import {
  initDb,
  createNote,
  getNote,
  updateNote,
  searchNotes,
  createTask,
  listTasks,
  updateTask,
  getAllContext,
  setContext,
} from '../db.js';

const MODEL = 'gemini-2.0-flash-lite';

const SYSTEM_INSTRUCTION =
  "You are a personal assistant with access to the user's notes, tasks, and personal context. Use the available tools to help them. Always confirm what you did after calling a tool.";

// Interactions API: each tool is a flat object with type:"function"
const TOOLS = [
  { type: 'function', name: 'create_note', description: 'Create a new note with a title, content, and optional tags', parameters: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['title', 'content'] } },
  { type: 'function', name: 'get_note', description: 'Retrieve a note by its ID', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { type: 'function', name: 'update_note', description: 'Update a note by ID', parameters: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['id'] } },
  { type: 'function', name: 'search_notes', description: 'Search notes by title and content', parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] } },
  { type: 'function', name: 'create_task', description: 'Create a new task', parameters: { type: 'object', properties: { title: { type: 'string' }, details: { type: 'string' }, due_date: { type: 'string' } }, required: ['title'] } },
  { type: 'function', name: 'list_tasks', description: 'List tasks optionally filtered by status', parameters: { type: 'object', properties: { status: { type: 'string', enum: ['open', 'in_progress', 'done'] }, limit: { type: 'number' } } } },
  { type: 'function', name: 'update_task', description: 'Update a task by ID', parameters: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, details: { type: 'string' }, due_date: { type: 'string' }, status: { type: 'string', enum: ['open', 'in_progress', 'done'] } }, required: ['id'] } },
  { type: 'function', name: 'get_my_context', description: 'Get all personal context key/value pairs', parameters: { type: 'object', properties: {} } },
  { type: 'function', name: 'set_context', description: 'Set a personal context key/value pair', parameters: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] } },
];

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  await initDb();
  switch (name) {
    case 'create_note':
      return createNote(args.title as string, args.content as string, (args.tags as string[] | undefined) ?? []);
    case 'get_note':
      return getNote(args.id as string);
    case 'update_note':
      return updateNote(args.id as string, { title: args.title as string | undefined, content: args.content as string | undefined, tags: args.tags as string[] | undefined });
    case 'search_notes':
      return searchNotes(args.query as string, (args.limit as number | undefined) ?? 10);
    case 'create_task':
      return createTask(args.title as string, args.details as string | undefined, args.due_date as string | undefined);
    case 'list_tasks':
      return listTasks(args.status as string | undefined, args.limit as number | undefined);
    case 'update_task':
      return updateTask(args.id as string, { title: args.title as string | undefined, details: args.details as string | undefined, due_date: args.due_date as string | undefined, status: args.status as string | undefined });
    case 'get_my_context':
      return getAllContext();
    case 'set_context':
      return setContext(args.key as string, args.value as string);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, previousInteractionId } = req.body as {
      message: string;
      previousInteractionId?: string;
    };

    if (!message) return res.status(400).json({ error: 'message is required' });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, httpOptions: { timeout: 55000 } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const interactions = (ai as any).interactions;

    // Turn 1: send user message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let interaction: any = await interactions.create({
      model: MODEL,
      system_instruction: SYSTEM_INSTRUCTION,
      input: message,
      tools: TOOLS,
      ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {}),
    });

    // Function call loop — keep going until no more function_call steps
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fcSteps = (interaction.steps ?? []).filter((s: any) => s.type === 'function_call');
      if (fcSteps.length === 0) break;

      // Execute all function calls and build function_result inputs
      const functionResults = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fcSteps.map(async (step: any) => {
          const result = await executeTool(step.name, step.arguments ?? {});
          return {
            type: 'function_result',
            name: step.name,
            call_id: step.id,
            result: [{ type: 'text', text: JSON.stringify(result) }],
          };
        })
      );

      // Send results back
      interaction = await interactions.create({
        model: MODEL,
        system_instruction: SYSTEM_INSTRUCTION,
        previous_interaction_id: interaction.id,
        input: functionResults,
        tools: TOOLS,
      });
    }

    const reply = interaction.output_text ?? interaction.outputText ?? 'Done.';
    return res.status(200).json({ reply, interactionId: interaction.id });
  } catch (err) {
    console.error('[chat]', err);
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: msg });
  }
}
