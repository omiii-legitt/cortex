import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initAuthDb, deleteSession } from "../../auth-db.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cookieHeader = req.headers["cookie"] ?? "";
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies["session"];

  if (sessionId) {
    try {
      await initAuthDb();
      await deleteSession(sessionId);
    } catch {
      // non-fatal
    }
  }

  res.setHeader("Set-Cookie", "session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  res.setHeader("Location", "/");
  res.status(302).end();
}
