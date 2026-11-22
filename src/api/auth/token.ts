import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../../auth.js";
import { initAuthDb, getMcpToken, createMcpToken } from "../../auth-db.js";

// Initialize auth DB at module load
const authDbReady = initAuthDb();

// GET  /api/auth/token  — return current token (or null)
// POST /api/auth/token  — generate / regenerate token
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await authDbReady;

  if (req.method === "GET") {
    const token = await getMcpToken(user.id);
    return res.status(200).json({ token });
  }

  if (req.method === "POST") {
    const token = await createMcpToken(user.id);
    return res.status(200).json({ token });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
