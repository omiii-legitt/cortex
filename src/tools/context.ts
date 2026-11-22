import { getAllContext, setContext } from "../db.js";

export async function handleGetMyContext(userId: string): Promise<Record<string, string>> {
  const entries = await getAllContext(userId);
  const result: Record<string, string> = {};
  for (const entry of entries) {
    result[entry.key] = entry.value;
  }
  return result;
}

export async function handleSetContext(userId: string, args: { key: string; value: string }) {
  return setContext(userId, args.key, args.value);
}
