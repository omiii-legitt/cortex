import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../../auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  const user = await getUserFromRequest(req);
  return res.status(200).json({ user });
}
