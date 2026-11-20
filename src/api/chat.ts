import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';
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

const SYSTEM_INSTRUCTION =
  "You are a personal assistant with access to the user's notes, tasks, and personal context. Use the available tools to help them. Always confirm what you did after calling a tool.";

const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'create_note',
    description: 'Create a new note',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        content: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'get_note',
    description: 'Get a note by ID',
    parameters: {
      type: Type.OBJECT,
      properties: { id: { type: Type.STRING } },
      required: ['id'],
    },
  },
  {
    name: 'update_note',
    description: 'Update a note',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        content: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['id'],
    },
  },
  {
    name: 'search_notes',
    description: 'Search notes by text',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING },
        limit: { type: Type.NUMBER },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a task',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        details: { type: Type.STRING },
        due_date: { type: Type.STRING },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List tasks',
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING },
        limit: { type: Type.NUMBER },
      },
      required: [],
    },
  },
  {
    name: 'update_task',
    description: 'Update a task',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        details: { type: Type.STRING },
        due_date: { type: Type.STRING },
        status: { type: Type.STRING },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_my_context',
    description: 'Get all personal context',
    parameters: { type: Type.OBJECT, properties: {}, required: [] },
  },
  {
    name: 'set_context',
    description: 'Set a personal context key/value',
    parameters: {
      type: Type.OBJECT,
      properties: {
        key: { type: Type.STRING },
        value: { type: Type.STRING },
      },
      required: ['key', 'value'],
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  await initDb();
  switch (name) {
    case 'create_note':
      return createNote(
        args.title as string,
        args.content as string,
        (args.tags as string[] | undefined) ?? []
      );
    case 'get_note':
      return getNote(args.id as string);
    case 'update_note':
      return updateNote(args.id as string, {
        title: args.title as string | undefined,
        content: args.content as string | undefined,
        tags: args.tags as string[] | undefined,
      });
    case 'search_notes':
      return searchNotes(args.query as string, (args.limit as number | undefined) ?? 10);
    case 'create_task':
      return createTask(
        args.title as string,
        args.details as string | undefined,
        args.due_date as string | undefined
      );
    case 'list_tasks':
      return listTasks(args.status as string | undefined, args.limit as number | undefined);
    case 'update_task':
      return updateTask(args.id as string, {
        title: args.title as string | undefined,
        details: args.details as string | undefined,
        due_date: args.due_date as string | undefined,
        status: args.status as string | undefined,
      });
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
    const { message, history = [] } = req.body as {
      message: string;
      history: Array<{ role: string; parts: Array<{ text?: string }> }>;
    };

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const contents = [
      ...history,
      { role: 'user', parts: [{ text: message }] },
    ];

    let response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      },
    });

    // Function call loop
    while (true) {
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts ?? [];
      const functionCallPart = parts.find((p) => p.functionCall);

      if (!functionCallPart?.functionCall) {
        // No more function calls — return the text response
        const textPart = parts.find((p) => p.text);
        const reply = textPart?.text ?? 'Done.';
        return res.status(200).json({ reply });
      }

      const { name, args } = functionCallPart.functionCall;
      const toolResult = await executeTool(name ?? '', args as Record<string, unknown>);

      // Append the model's function call turn and our function response
      contents.push({ role: 'model', parts: [{ functionCall: functionCallPart.functionCall } as never] });
      contents.push({
        role: 'function',
        parts: [{ functionResponse: { name, response: { output: toolResult } } } as never],
      });

      response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
        },
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
