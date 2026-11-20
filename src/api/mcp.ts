import { createMcpHandler } from "@modelcontextprotocol/server";
import type { IncomingMessage, ServerResponse } from "http";
import { createServer } from "../server.js";

const handler = createMcpHandler(
  (_ctx) => createServer(),
  { legacy: "stateless" }
);

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
  const bodyText = Buffer.concat(bodyChunks).toString("utf-8");

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
