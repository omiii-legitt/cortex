import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./server.js";

const stdioUserId = process.env.STDIO_USER_ID ?? "local";
serveStdio(() => createServer(stdioUserId));
