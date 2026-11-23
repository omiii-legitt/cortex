import type { IncomingMessage } from "http";
import type { VercelRequest } from "@vercel/node";
import { initAuthDb, getSessionUser } from "./auth-db.js";

function parseCookies(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) result[key] = decodeURIComponent(val);
  }
  return result;
}

export type User = {
  id: string;
  github_id: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
};

export async function getUserFromRequest(
  req: IncomingMessage | VercelRequest
): Promise<User | null> {
  const cookieHeader = req.headers["cookie"];
  if (!cookieHeader) return null;
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies["session"];
  if (!sessionId) return null;
  try {
    await initAuthDb();
    return getSessionUser(sessionId);
  } catch {
    return null;
  }
}
