import { getAllContext, setContext } from "../db.js";

export async function handleGetMyContext(): Promise<Record<string, string>> {
  const entries = await getAllContext();
  const result: Record<string, string> = {};
  for (const entry of entries) {
    result[entry.key] = entry.value;
  }
  return result;
}

export async function handleSetContext(args: { key: string; value: string }) {
  return setContext(args.key, args.value);
}
