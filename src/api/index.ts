import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Personal MCP Server</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d1117;
      color: #e6edf3;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, monospace;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 24px;
    }
    .container { max-width: 800px; width: 100%; }
    header { text-align: center; margin-bottom: 40px; }
    h1 { font-size: 2.4rem; font-weight: 700; color: #58a6ff; letter-spacing: -0.5px; }
    .subtitle { color: #8b949e; font-size: 1.1rem; margin-top: 8px; }
    .badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: #0d2a1a; border: 1px solid #26a641;
      color: #3fb950; border-radius: 20px;
      padding: 4px 14px; font-size: 0.85rem; margin-top: 16px;
    }
    .dot { width: 8px; height: 8px; background: #3fb950; border-radius: 50%; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .links { display: flex; gap: 12px; justify-content: center; margin: 32px 0; flex-wrap: wrap; }
    .btn {
      display: inline-block; padding: 10px 24px;
      border-radius: 8px; font-size: 0.95rem; font-weight: 500;
      text-decoration: none; transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.8; }
    .btn-primary { background: #238636; color: #fff; border: 1px solid #2ea043; }
    .btn-secondary { background: #21262d; color: #e6edf3; border: 1px solid #30363d; }
    section { margin-bottom: 40px; }
    h2 { font-size: 1.3rem; color: #c9d1d9; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #21262d; }
    .tools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }
    .tool-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 14px 16px;
    }
    .tool-name { font-family: monospace; color: #79c0ff; font-size: 0.9rem; font-weight: 600; margin-bottom: 4px; }
    .tool-desc { color: #8b949e; font-size: 0.82rem; line-height: 1.4; }
    pre {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 20px;
      overflow-x: auto;
      font-size: 0.85rem;
      line-height: 1.6;
      color: #e6edf3;
    }
    footer { text-align: center; color: #484f58; font-size: 0.82rem; margin-top: 24px; }
    /* Chatbot */
    .chat-section { margin-bottom: 40px; }
    .chat-note { color: #484f58; font-size: 0.78rem; margin-top: 8px; }
    .chat-box {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      height: 300px;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 12px;
    }
    .msg { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 0.88rem; line-height: 1.5; word-break: break-word; }
    .msg-user { background: #1f6feb; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
    .msg-bot { background: #21262d; color: #e6edf3; align-self: flex-start; border-bottom-left-radius: 4px; }
    .msg-thinking { color: #8b949e; font-style: italic; align-self: flex-start; font-size: 0.82rem; }
    .chat-input-row { display: flex; gap: 8px; }
    .chat-input {
      flex: 1; background: #161b22; border: 1px solid #30363d; border-radius: 8px;
      color: #e6edf3; padding: 10px 14px; font-size: 0.9rem; outline: none;
    }
    .chat-input:focus { border-color: #58a6ff; }
    .chat-send { background: #238636; color: #fff; border: 1px solid #2ea043; border-radius: 8px; padding: 10px 20px; font-size: 0.9rem; cursor: pointer; white-space: nowrap; }
    .chat-send:hover { opacity: 0.85; }
    .chat-send:disabled { opacity: 0.4; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Personal MCP Server</h1>
      <p class="subtitle">A Model Context Protocol server for notes, tasks, and personal context</p>
      <span class="badge"><span class="dot"></span> Live</span>
    </header>

    <div class="links">
      <a class="btn btn-primary" href="https://github.com/omiii-legitt/personal-mcp-server" target="_blank" rel="noopener">GitHub</a>
      <a class="btn btn-secondary" href="https://personal-mcp-server-taupe.vercel.app/api/mcp" target="_blank" rel="noopener">API Endpoint</a>
    </div>

    <section>
      <h2>Available Tools</h2>
      <div class="tools-grid">
        <div class="tool-card"><div class="tool-name">create_note</div><div class="tool-desc">Create a note with title, content, and tags</div></div>
        <div class="tool-card"><div class="tool-name">get_note</div><div class="tool-desc">Retrieve a note by ID</div></div>
        <div class="tool-card"><div class="tool-name">update_note</div><div class="tool-desc">Update a note&#39;s title, content, or tags</div></div>
        <div class="tool-card"><div class="tool-name">search_notes</div><div class="tool-desc">Full-text search across notes</div></div>
        <div class="tool-card"><div class="tool-name">create_task</div><div class="tool-desc">Create a task with optional details and due date</div></div>
        <div class="tool-card"><div class="tool-name">list_tasks</div><div class="tool-desc">List tasks filtered by status</div></div>
        <div class="tool-card"><div class="tool-name">update_task</div><div class="tool-desc">Update a task&#39;s title, details, due date, or status</div></div>
        <div class="tool-card"><div class="tool-name">get_my_context</div><div class="tool-desc">Retrieve all personal context key/value pairs</div></div>
        <div class="tool-card"><div class="tool-name">set_context</div><div class="tool-desc">Set a personal context key/value pair</div></div>
      </div>
    </section>

    <section>
      <h2>How to Connect</h2>
      <pre>{
  "mcpServers": {
    "personal-assistant": {
      "url": "https://personal-mcp-server-taupe.vercel.app/api/mcp"
    }
  }
}</pre>
    </section>

    <section class="chat-section">
      <h2>Try it live</h2>
      <div class="chat-box" id="chatBox"></div>
      <div class="chat-input-row">
        <input class="chat-input" id="chatInput" type="text" placeholder="Ask me anything — create a note, list tasks..." />
        <button class="chat-send" id="chatSend">Send</button>
      </div>
      <p class="chat-note">Powered by Gemini &middot; Your data is stored in your personal database</p>
    </section>

    <footer>Built with TypeScript &middot; MCP SDK &middot; Vercel &middot; Turso</footer>
  </div>

    <script>
      (function () {
        var prevId = null;
        var box = document.getElementById('chatBox');
        var input = document.getElementById('chatInput');
        var btn = document.getElementById('chatSend');

        function appendMsg(text, type) {
          var div = document.createElement('div');
          div.className = 'msg msg-' + type;
          div.textContent = text;
          box.appendChild(div);
          box.scrollTop = box.scrollHeight;
          return div;
        }

        async function send() {
          var msg = input.value.trim();
          if (!msg) return;
          input.value = '';
          btn.disabled = true;
          appendMsg(msg, 'user');
          var thinking = appendMsg('Thinking...', 'thinking');
          try {
            var body = { message: msg, previousInteractionId: prevId };
            var res = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            var data = await res.json();
            box.removeChild(thinking);
            if (data.error) {
              appendMsg('Error: ' + data.error, 'bot');
            } else {
              appendMsg(data.reply, 'bot');
              prevId = data.interactionId;
            }
          } catch (e) {
            box.removeChild(thinking);
            appendMsg('Something went wrong, try again.', 'bot');
          }
          btn.disabled = false;
          input.focus();
        }

        btn.addEventListener('click', send);
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') send();
        });
      })();
    </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}
