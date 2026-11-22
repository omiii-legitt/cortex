import { createMcpHandler } from "@modelcontextprotocol/server";
import type { IncomingMessage, ServerResponse } from "http";
import { createServer } from "../server.js";
// NOTE: rate limit state is in-memory and resets on each Vercel cold start.
import { checkRateLimit } from "../rate-limit.js";
import { initAuthDb, getUserFromMcpToken } from "../auth-db.js";

// Initialize auth DB at module load (cold start) rather than per-request
const authDbReady = initAuthDb();

async function resolveUserId(req: IncomingMessage): Promise<string | null> {
  const auth = req.headers["authorization"];
  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) {
      try {
        await authDbReady;
        const user = await getUserFromMcpToken(token);
        if (user) return user.id;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export default async function nodeHandler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  // Collect the request body from the Node.js stream
  const bodyChunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk: Buffer) => bodyChunks.push(chunk));
    req.on("end", resolve);
    req.on("error", reject);
  });

  const totalBytes = bodyChunks.reduce((sum, c) => sum + c.length, 0);
  if (totalBytes > 1_048_576) {
    res.statusCode = 413;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Request too large" }));
    return;
  }

  const bodyText = Buffer.concat(bodyChunks).toString("utf-8");

  const ip =
    (Array.isArray(req.headers["x-forwarded-for"])
      ? req.headers["x-forwarded-for"][0]
      : req.headers["x-forwarded-for"])
      ?.split(",")[0]
      ?.trim() ?? "unknown";
  if (!checkRateLimit(ip, 60, 60_000)) {
    res.statusCode = 429;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Too many requests. Please wait a minute." }));
    return;
  }

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.statusCode = 204;
    res.end();
    return;
  }

  // Ensure CORS headers on actual requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");

  // Resolve user from Bearer token — return 401 if missing or invalid
  const userId = await resolveUserId(req);
  if (userId === null) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("WWW-Authenticate", 'Bearer realm="Cortex MCP"');
    res.end(JSON.stringify({ error: "Unauthorized. Provide a valid Bearer token. Get your token from https://personal-mcp-server-taupe.vercel.app/dashboard" }));
    return;
  }

  // Create a per-request MCP handler scoped to this user
  const handler = createMcpHandler(
    (_ctx) => createServer(userId),
    { legacy: "stateless" }
  );

  // Build a web-standard Request from the Node IncomingMessage
  const url = `https://${req.headers.host ?? "localhost"}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      for (const v of val) headers.append(key, v);
    } else {
      headers.set(key, val);
    }
  }

  const webReq = new Request(url, {
    method: req.method ?? "GET",
    headers,
    body: bodyText.length > 0 ? bodyText : undefined,
  });

  const webRes = await handler.fetch(webReq);

  res.statusCode = webRes.status;
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (webRes.body) {
    const reader = webRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  }
  res.end();
}
