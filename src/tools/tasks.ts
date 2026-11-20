import { createTask, listTasks, updateTask } from "../db.js";

export async function handleCreateTask(args: {
  title: string;
  details?: string;
  due_date?: string;
}) {
  const task = await createTask(args.title, args.details, args.due_date);
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    created_at: task.created_at,
  };
}

export async function handleListTasks(args: {
  status?: "open" | "in_progress" | "done";
  limit?: number;
}) {
  return listTasks(args.status, args.limit ?? 20);
}

export async function handleUpdateTask(args: {
  id: string;
  title?: string;
  details?: string;
  due_date?: string;
  status?: "open" | "in_progress" | "done";
}) {
  const { id, ...fields } = args;
  const task = await updateTask(id, fields);
  if (!task) return { error: `Task ${id} not found` };
  return task;
}
