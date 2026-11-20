import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Personal MCP Server</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #000000;
      --card-bg: #0a0a0a;
      --input-bg: #0d0d0d;
      --border: #1a1a1a;
      --text: #ffffff;
      --muted: #a0a0a0;
      --neon: #00ff88;
      --font: 'JetBrains Mono', 'Courier New', monospace;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #000000;
      color: #ffffff;
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      min-height: 100vh;
      padding: 0 24px 64px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    *:focus-visible { outline: 2px solid #00ff88; outline-offset: 2px; }

    /* Hero */
    .hero { text-align: center; padding: 80px 0 60px; }
    .hero h1 { font-size: 2.8rem; font-weight: 700; color: #ffffff; }
    .subtitle { color: #a0a0a0; margin-top: 12px; }
    .badge {
      color: #00ff88; border: 1px solid #00ff88; border-radius: 20px;
      padding: 4px 14px; font-size: 0.8rem; display: inline-block; margin-top: 16px;
    }
    .hero-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 32px; }
    .btn {
      font-family: inherit; font-size: 0.9rem; font-weight: 500;
      padding: 10px 24px; border-radius: 6px; cursor: pointer;
      text-decoration: none; display: inline-block; transition: border-color 0.15s, color 0.15s;
    }
    .btn-outline {
      background: transparent; color: #ffffff;
      border: 1px solid #333333;
    }
    .btn-outline:hover { border-color: #00ff88; color: #00ff88; }

    /* Sections */
    .section { margin-bottom: 64px; }
    .section-heading {
      font-size: 1.1rem; font-weight: 700; color: #ffffff; text-transform: uppercase;
      letter-spacing: 0.08em; margin-bottom: 24px;
      padding-bottom: 8px; border-bottom: 1px solid #00ff88; display: inline-block;
    }
    .section-text { color: #a0a0a0; line-height: 1.7; margin-bottom: 20px; font-size: 0.9rem; }
    .feature-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    .feature-list li { color: #a0a0a0; font-size: 0.9rem; }
    .feature-list strong { color: #ffffff; }

    /* Tools grid */
    .tools-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    @media (max-width: 639px) {
      .tools-grid { grid-template-columns: 1fr; }
    }
    .tool-group {
      background: #0a0a0a;
      border: 1px solid #1a1a1a;
      border-radius: 8px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .group-label {
      color: #00ff88;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 4px;
    }
    .tool-card {
      background: transparent;
      border-bottom: 1px solid #1a1a1a;
      padding-bottom: 10px;
    }
    .tool-card:last-child { border-bottom: none; padding-bottom: 0; }
    .tool-name { color: #ffffff; font-weight: 700; font-size: 0.85rem; margin-bottom: 2px; }
    .tool-desc { color: #a0a0a0; font-size: 0.78rem; line-height: 1.4; }

    /* Code block */
    .code-block {
      background: #0a0a0a;
      border: 1px solid #1a1a1a;
      border-radius: 8px;
      padding: 20px;
      overflow-x: auto;
      font-size: 0.82rem;
      line-height: 1.6;
      color: #ffffff;
      font-family: inherit;
    }

    /* Chat */
    .sr-only {
      position: absolute; width: 1px; height: 1px;
      padding: 0; margin: -1px; overflow: hidden;
      clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }
    .chat-wrapper {
      background: #0d0d0d;
      border: 1px solid #1a1a1a;
      border-radius: 8px;
      padding: 16px;
    }
    .chat-box {
      min-height: 60px;
      max-height: 400px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 12px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .chip {
      background: #0a0a0a;
      border: 1px solid #1a1a1a;
      color: #a0a0a0;
      border-radius: 20px;
      padding: 6px 14px;
      font-family: inherit;
      font-size: 0.78rem;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    .chip:hover { border-color: #00ff88; color: #00ff88; }
    .msg {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.85rem;
      line-height: 1.5;
      word-break: break-word;
    }
    .msg-user {
      background: #ffffff;
      color: #000000;
      align-self: flex-end;
      border-left: 4px solid #00ff88;
    }
    .msg-bot {
      background: #0a0a0a;
      color: #ffffff;
      align-self: flex-start;
    }
    .msg-error {
      background: #1a0a0a;
      color: #ff6b6b;
      align-self: flex-start;
      border-left: 4px solid #ff6b6b;
    }
    @keyframes thinking-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .msg-thinking {
      color: #a0a0a0;
      align-self: flex-start;
      font-size: 0.82rem;
      animation: thinking-pulse 1.2s ease-in-out infinite;
    }
    .chat-input-row { display: flex; gap: 8px; margin-top: 8px; }
    .chat-input {
      flex: 1;
      background: #000000;
      border: 1px solid #1a1a1a;
      border-radius: 6px;
      color: #ffffff;
      padding: 10px 14px;
      font-family: inherit;
      font-size: 0.88rem;
      outline: none;
      transition: border-color 0.15s;
    }
    .chat-input:focus { border-color: #00ff88; }
    .chat-send {
      background: #00ff88;
      color: #000000;
      border: none;
      border-radius: 6px;
      padding: 10px 20px;
      font-family: inherit;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: opacity 0.15s;
    }
    .chat-send:hover { opacity: 0.85; }
    .chat-send:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Footer */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 24px 0;
      border-top: 1px solid #1a1a1a;
      color: #a0a0a0;
      font-size: 0.78rem;
      margin-top: 40px;
    }
    .footer-link { color: #a0a0a0; text-decoration: none; }
    .footer-link:hover { color: #00ff88; }

    /* Responsive */
    @media (max-width: 639px) {
      h1 { font-size: 1.9rem; }
      .hero-actions { flex-direction: column; align-items: center; }
      .tools-grid { grid-template-columns: 1fr; }
      .footer { flex-direction: column; align-items: center; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="container">

    <header class="hero">
      <h1>Personal MCP Server</h1>
      <p class="subtitle">A tool provider for AI clients. Connect once, use everywhere.</p>
      <span class="badge">&#9679; LIVE</span>
      <div class="hero-actions">
        <a href="#chat" class="btn btn-outline">Try the chat &#8595;</a>
        <a href="https://github.com/omiii-legitt/personal-mcp-server" target="_blank" rel="noopener" class="btn btn-outline">GitHub &#8599;</a>
        <button class="btn btn-outline" id="copyConfig">Copy MCP config</button>
      </div>
    </header>

    <section class="section">
      <h2 class="section-heading">What it does</h2>
      <p class="section-text">This is an MCP (Model Context Protocol) server &#8212; a tool provider for AI clients. It is not a chat app or an AI host. AI clients connect to it and call its tools to manage your notes, tasks, and personal context. The chat below is just a demo that uses the same underlying tools via a Gemini-powered proxy.</p>
      <ul class="feature-list">
        <li>&#128221; <strong>Notes</strong> &#8212; Create, retrieve, update, and search notes</li>
        <li>&#9989; <strong>Tasks</strong> &#8212; Create, list, and update tasks</li>
        <li>&#129504; <strong>Personal Context</strong> &#8212; Store and retrieve personal key/value context</li>
      </ul>
    </section>

    <section class="section">
      <h2 class="section-heading">Tools (9)</h2>
      <div class="tools-grid">
        <div class="tool-group">
          <div class="group-label">Notes</div>
          <div class="tool-card">
            <div class="tool-name">create_note</div>
            <div class="tool-desc">Create a note with title, content, and tags</div>
          </div>
          <div class="tool-card">
            <div class="tool-name">get_note</div>
            <div class="tool-desc">Retrieve a note by ID</div>
          </div>
          <div class="tool-card">
            <div class="tool-name">update_note</div>
            <div class="tool-desc">Update a note&#39;s title, content, or tags</div>
          </div>
          <div class="tool-card">
            <div class="tool-name">search_notes</div>
            <div class="tool-desc">Full-text search across notes</div>
          </div>
        </div>
        <div class="tool-group">
          <div class="group-label">Tasks</div>
          <div class="tool-card">
            <div class="tool-name">create_task</div>
            <div class="tool-desc">Create a task with optional details and due date</div>
          </div>
          <div class="tool-card">
            <div class="tool-name">list_tasks</div>
            <div class="tool-desc">List tasks filtered by status</div>
          </div>
          <div class="tool-card">
            <div class="tool-name">update_task</div>
            <div class="tool-desc">Update a task&#39;s title, details, due date, or status</div>
          </div>
        </div>
        <div class="tool-group">
          <div class="group-label">Personal Context</div>
          <div class="tool-card">
            <div class="tool-name">get_my_context</div>
            <div class="tool-desc">Retrieve all personal context key/value pairs</div>
          </div>
          <div class="tool-card">
            <div class="tool-name">set_context</div>
            <div class="tool-desc">Set a personal context key/value pair</div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-heading">Connect to Kiro</h2>
      <p class="section-text">Add this to your Kiro MCP configuration file, then restart Kiro. The server exposes 9 tools your AI client can call directly.</p>
      <pre class="code-block">{
  "mcpServers": {
    "personal-assistant": {
      "url": "https://personal-mcp-server-taupe.vercel.app/api/mcp"
    }
  }
}</pre>
      <button class="btn btn-outline" id="copyConfigBottom" style="margin-top:12px">Copy config</button>
    </section>

    <section class="section" id="chat">
      <h2 class="section-heading">Try it live</h2>
      <p class="section-text" style="margin-bottom:16px">Powered by Gemini &middot; Data stored in Turso</p>
      <div class="chat-wrapper">
        <div class="chat-box" id="chatBox"></div>
        <div class="chips" id="chips">
          <button class="chip">Create a note about my goals</button>
          <button class="chip">Show all my open tasks</button>
          <button class="chip">What do you know about me?</button>
          <button class="chip">Search notes for projects</button>
        </div>
        <div class="chat-input-row">
          <label for="chatInput" class="sr-only">Message</label>
          <input class="chat-input" id="chatInput" type="text" placeholder="Ask me anything &#8212; create a note, list tasks..." />
          <button class="chat-send" id="chatSend">Send &#8594;</button>
        </div>
      </div>
    </section>

    <footer class="footer">
      <span>Built with TypeScript &middot; MCP SDK &middot; Vercel &middot; Turso</span>
      <a href="https://github.com/omiii-legitt/personal-mcp-server" target="_blank" rel="noopener" class="footer-link">GitHub &#8599;</a>
    </footer>

  </div>

  <script>
    (function () {
      var prevId = null;
      var chipsHidden = false;

      var box = document.getElementById('chatBox');
      var input = document.getElementById('chatInput');
      var btn = document.getElementById('chatSend');
      var chipsEl = document.getElementById('chips');

      var MCP_CONFIG = '{\\n  "mcpServers": {\\n    "personal-assistant": {\\n      "url": "https://personal-mcp-server-taupe.vercel.app/api/mcp"\\n    }\\n  }\\n}';

      function setupCopyBtn(id, originalLabel) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', function () {
          navigator.clipboard.writeText(MCP_CONFIG).then(function () {
            el.textContent = '\\u2713 Copied!';
            el.style.color = '#00ff88';
            setTimeout(function () {
              el.textContent = originalLabel;
              el.style.color = '';
            }, 2000);
          });
        });
      }

      setupCopyBtn('copyConfig', 'Copy MCP config');
      setupCopyBtn('copyConfigBottom', 'Copy config');

      function appendMsg(text, type) {
        var div = document.createElement('div');
        div.className = 'msg msg-' + type;
        div.textContent = text;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
        return div;
      }

      async function send(msg) {
        msg = (msg || '').trim();
        if (!msg) return;
        if (!chipsHidden) {
          chipsEl.style.display = 'none';
          chipsHidden = true;
        }
        appendMsg(msg, 'user');
        btn.disabled = true;
        input.disabled = true;
        var thinking = appendMsg('\\u258b thinking...', 'thinking');
        try {
          var res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg, previousInteractionId: prevId })
          });
          var data = await res.json();
          box.removeChild(thinking);
          if (data.error) {
            appendMsg('\\u26a0 ' + data.error, 'error');
          } else {
            appendMsg(data.reply, 'bot');
            prevId = data.interactionId;
          }
        } catch (e) {
          box.removeChild(thinking);
          appendMsg('\\u26a0 Something went wrong. Try again.', 'error');
        }
        btn.disabled = false;
        input.disabled = false;
        input.focus();
      }

      btn.addEventListener('click', function () {
        var msg = input.value.trim();
        input.value = '';
        send(msg);
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var msg = input.value.trim();
          input.value = '';
          send(msg);
        }
      });

      var chips = document.querySelectorAll('.chip');
      chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          send(chip.textContent);
        });
      });
    })();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}
