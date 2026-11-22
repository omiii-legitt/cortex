import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const jwtSecret = process.env.JWT_SECRET;

  if (!clientId || !jwtSecret) {
    return res.status(503).json({ error: "Auth not configured" });
  }

  const stateUUID = crypto.randomUUID();
  const stateJwt = jwt.sign({ state: stateUUID }, jwtSecret, { expiresIn: "10m" });

  res.setHeader(
    "Set-Cookie",
    `oauth_state=${stateJwt}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`
  );

  const params = new URLSearchParams({
    client_id: clientId,
    scope: "read:user,user:email",
    state: stateUUID,
  });

  res.setHeader("Location", `https://github.com/login/oauth/authorize?${params.toString()}`);
  res.status(302).end();
}
