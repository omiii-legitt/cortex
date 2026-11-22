import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import { initAuthDb, findOrCreateUser, createSession } from "../../auth-db.js";

// Initialize auth DB at module load
const authDbReady = initAuthDb();

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

interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  email: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const jwtSecret = process.env.JWT_SECRET;

  if (!clientId || !clientSecret || !jwtSecret) {
    return res.status(503).json({ error: "Auth not configured" });
  }

  const { code, state } = req.query as Record<string, string>;

  if (!code || !state) {
    return res.status(400).json({ error: "Missing code or state" });
  }

  // Verify state via cookie JWT
  const cookieHeader = req.headers["cookie"] ?? "";
  const cookies = parseCookies(cookieHeader);
  const stateJwt = cookies["oauth_state"];

  if (!stateJwt) {
    return res.status(400).json({ error: "Missing oauth_state cookie" });
  }

  let decoded: { state: string };
  try {
    decoded = jwt.verify(stateJwt, jwtSecret) as { state: string };
  } catch {
    return res.status(400).json({ error: "Invalid or expired state" });
  }

  if (decoded.state !== state) {
    return res.status(400).json({ error: "State mismatch" });
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    return res.status(400).json({ error: "Failed to get access token" });
  }

  // Fetch GitHub user
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "personal-mcp-server",
    },
  });
  const githubUser = await userRes.json() as GitHubUser;

  // Try to get primary email if not on profile
  let email: string | null = githubUser.email ?? null;
  if (!email) {
    try {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "personal-mcp-server",
        },
      });
      const emails = await emailsRes.json() as GitHubEmail[];
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary?.email ?? null;
    } catch {
      // non-fatal
    }
  }

  await authDbReady;
  const user = await findOrCreateUser(
    String(githubUser.id),
    githubUser.login,
    email,
    githubUser.avatar_url ?? null
  );
  const sessionId = await createSession(user.id);

  // Clear oauth_state cookie, set session cookie
  const sessionCookie = `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`;
  const clearStateCookie = `oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;

  res.setHeader("Set-Cookie", [sessionCookie, clearStateCookie]);
  res.setHeader("Location", "/dashboard");
  res.status(302).end();
}
