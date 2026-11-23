import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.setHeader("Location", "/api/auth/login");
    res.status(302).end();
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cortex &mdash; Dashboard</title>
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
    .container { max-width: 1000px; margin: 0 auto; }
    *:focus-visible { outline: 2px solid #00ff88; outline-offset: 2px; }

    /* Header */
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 24px 0 32px;
      border-bottom: 1px solid #1a1a1a;
      flex-wrap: wrap;
      gap: 12px;
    }
    .topbar-brand { font-size: 1rem; font-weight: 700; color: #ffffff; text-decoration: none; }
    .topbar-brand:hover { color: #00ff88; }
    .topbar-user { display: flex; align-items: center; gap: 12px; }
    .user-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      border: 1px solid #1a1a1a;
    }
    .user-name { color: #a0a0a0; font-size: 0.85rem; }
    .btn {
      font-family: inherit; font-size: 0.85rem; font-weight: 500;
      padding: 8px 18px; border-radius: 6px; cursor: pointer;
      text-decoration: none; display: inline-block;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }
    .btn-outline {
      background: transparent; color: #ffffff;
      border: 1px solid #333333;
    }
    .btn-outline:hover { border-color: #00ff88; color: #00ff88; }
    .btn-primary {
      background: #00ff88; color: #000000;
      border: none; font-weight: 700;
    }
    .btn-primary:hover { opacity: 0.85; }
    .btn-sm { padding: 6px 14px; font-size: 0.78rem; }

    /* Sections */
    .page-title { font-size: 1.8rem; font-weight: 700; padding: 40px 0 32px; }
    .section { margin-bottom: 56px; }
    .section-heading {
      font-size: 1rem; font-weight: 700; color: #ffffff; text-transform: uppercase;
      letter-spacing: 0.08em; margin-bottom: 20px;
      padding-bottom: 8px; border-bottom: 1px solid #00ff88; display: inline-block;
    }

    /* Cards grid */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .card {
      background: #0a0a0a;
      border: 1px solid #1a1a1a;
      border-radius: 8px;
      padding: 16px;
    }
    .card-title { font-weight: 700; font-size: 0.9rem; margin-bottom: 6px; }
    .card-snippet { color: #a0a0a0; font-size: 0.8rem; line-height: 1.5; margin-bottom: 10px; }
    .card-meta { font-size: 0.75rem; color: #666; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .tag {
      background: #111; border: 1px solid #222;
      color: #a0a0a0; border-radius: 20px;
      padding: 2px 10px; font-size: 0.72rem;
    }

    /* Task status badges */
    .status-badge {
      display: inline-block;
      border-radius: 20px;
      padding: 2px 10px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .status-open { background: #1a1a1a; color: #a0a0a0; }
    .status-in_progress { background: #2a2000; color: #ffcc00; border: 1px solid #664d00; }
    .status-done { background: #002a15; color: #00ff88; border: 1px solid #005a30; }

    /* Context table */
    .context-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.85rem; }
    .context-table th {
      text-align: left; color: #a0a0a0; font-weight: 500;
      padding: 8px 12px; border-bottom: 1px solid #1a1a1a;
    }
    .context-table td {
      padding: 10px 12px; border-bottom: 1px solid #111;
      vertical-align: top;
    }
    .context-table tr:last-child td { border-bottom: none; }
    .context-key { color: #00ff88; font-weight: 500; }
    .context-value { color: #ffffff; word-break: break-all; }

    /* Forms */
    .quick-add {
      background: #0a0a0a;
      border: 1px solid #1a1a1a;
      border-radius: 8px;
      padding: 16px;
      margin-top: 4px;
    }
    .quick-add-title { font-size: 0.8rem; color: #a0a0a0; margin-bottom: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; }
    .form-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .form-field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 140px; }
    .form-label { font-size: 0.72rem; color: #666; }
    .form-input {
      background: #000;
      border: 1px solid #1a1a1a;
      border-radius: 6px;
      color: #ffffff;
      padding: 8px 12px;
      font-family: inherit;
      font-size: 0.82rem;
      outline: none;
      transition: border-color 0.15s;
    }
    .form-input:focus { border-color: #00ff88; }
    .form-actions { display: flex; align-items: flex-end; }

    /* Empty state */
    .empty { color: #444; font-size: 0.85rem; padding: 24px 0; text-align: center; }

    /* Loading */
    .loading { color: #444; font-size: 0.85rem; padding: 16px 0; }

    /* Code block */
    .code-block {
      background: #0a0a0a;
      border: 1px solid #1a1a1a;
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
      font-size: 0.82rem;
      line-height: 1.6;
      color: #ffffff;
      font-family: inherit;
    }

    /* Responsive */
    @media (max-width: 600px) {
      .topbar { flex-direction: column; align-items: flex-start; }
      .cards-grid { grid-template-columns: 1fr; }
      .form-row { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="container">
    <nav class="topbar">
      <a href="/" class="topbar-brand">Cortex</a>
      <div class="topbar-user">
        <img class="user-avatar" id="userAvatar" src="" alt="avatar" style="display:none" />
        <span class="user-name" id="userName"></span>
        <a href="/api/auth/logout" class="btn btn-outline btn-sm">Sign out</a>
      </div>
    </nav>

    <h1 class="page-title">Dashboard</h1>

    <!-- Notes -->
    <section class="section">
      <h2 class="section-heading">Notes</h2>
      <div class="cards-grid" id="notesGrid"><p class="loading">Loading&hellip;</p></div>
      <div class="quick-add">
        <div class="quick-add-title">New note</div>
        <div class="form-row">
          <div class="form-field">
            <label class="form-label" for="noteTitle">Title</label>
            <input class="form-input" id="noteTitle" type="text" placeholder="Note title" />
          </div>
          <div class="form-field" style="flex:2">
            <label class="form-label" for="noteContent">Content</label>
            <input class="form-input" id="noteContent" type="text" placeholder="Content&hellip;" />
          </div>
          <div class="form-actions">
            <button class="btn btn-primary btn-sm" id="addNoteBtn">Add</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Tasks -->
    <section class="section">
      <h2 class="section-heading">Tasks</h2>
      <div class="cards-grid" id="tasksGrid"><p class="loading">Loading&hellip;</p></div>
      <div class="quick-add">
        <div class="quick-add-title">New task</div>
        <div class="form-row">
          <div class="form-field" style="flex:2">
            <label class="form-label" for="taskTitle">Title</label>
            <input class="form-input" id="taskTitle" type="text" placeholder="Task title" />
          </div>
          <div class="form-field">
            <label class="form-label" for="taskDue">Due date (optional)</label>
            <input class="form-input" id="taskDue" type="date" />
          </div>
          <div class="form-actions">
            <button class="btn btn-primary btn-sm" id="addTaskBtn">Add</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Context -->
    <section class="section">
      <h2 class="section-heading">Context</h2>
      <div id="contextArea"><p class="loading">Loading&hellip;</p></div>
      <div class="quick-add">
        <div class="quick-add-title">Set context</div>
        <div class="form-row">
          <div class="form-field">
            <label class="form-label" for="ctxKey">Key</label>
            <input class="form-input" id="ctxKey" type="text" placeholder="e.g. timezone" />
          </div>
          <div class="form-field" style="flex:2">
            <label class="form-label" for="ctxValue">Value</label>
            <input class="form-input" id="ctxValue" type="text" placeholder="Value" />
          </div>
          <div class="form-actions">
            <button class="btn btn-primary btn-sm" id="addCtxBtn">Set</button>
          </div>
        </div>
      </div>
    </section>

    <!-- MCP Token -->
    <section class="section">
      <h2 class="section-heading">MCP Token</h2>
      <p style="color:#a0a0a0;font-size:0.85rem;margin-bottom:16px;line-height:1.6">
        Use this bearer token so AI clients (Kiro, Claude Desktop, Cursor, Windsurf) connect to your personal data.
        Add it to your MCP config as shown below. Keep it secret &mdash; anyone with this token can read and write your data.
      </p>
      <div id="tokenArea" style="margin-bottom:16px">
        <p class="loading">Loading&hellip;</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="generateTokenBtn">Generate token</button>
        <button class="btn btn-outline btn-sm" id="copyTokenBtn" style="display:none">Copy token</button>
      </div>
      <div id="tokenConfig" style="display:none;margin-top:20px">
        <p style="color:#a0a0a0;font-size:0.78rem;margin-bottom:8px">MCP config with your token:</p>
        <pre id="tokenConfigBlock" class="code-block" style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:8px;padding:16px;font-size:0.78rem;overflow-x:auto;white-space:pre"></pre>
        <button class="btn btn-outline btn-sm" id="copyConfigBtn" style="margin-top:8px">Copy config</button>
      </div>
    </section>
  </div>

  <script>
    (function () {
      // Load user info
      fetch('/api/auth/me', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.user) { window.location.href = '/api/auth/login'; return; }
          var u = data.user;
          document.getElementById('userName').textContent = u.username;
          if (u.avatar_url) {
            var av = document.getElementById('userAvatar');
            av.src = u.avatar_url;
            av.style.display = 'inline-block';
          }
        })
        .catch(function () {});

      function escHtml(s) {
        return String(s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      function fmtDate(iso) {
        if (!iso) return '';
        try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
        catch (e) { return iso; }
      }

      function statusBadge(status) {
        var cls = 'status-' + (status || 'open');
        return '<span class="status-badge ' + cls + '">' + escHtml(status || 'open') + '</span>';
      }

      function renderNotes(notes) {
        var grid = document.getElementById('notesGrid');
        if (!notes || notes.length === 0) {
          grid.innerHTML = '<p class="empty">No notes yet. Add one below.</p>';
          return;
        }
        grid.innerHTML = notes.map(function (n) {
          var tags = (n.tags || []).map(function (t) { return '<span class="tag">' + escHtml(t) + '</span>'; }).join('');
          return '<div class="card">'
            + '<div class="card-title">' + escHtml(n.title) + '</div>'
            + '<div class="card-snippet">' + escHtml(n.snippet || '') + '</div>'
            + (tags ? '<div class="tags">' + tags + '</div>' : '')
            + '<div class="card-meta">' + fmtDate(n.updated_at) + '</div>'
            + '</div>';
        }).join('');
      }

      function renderTasks(tasks) {
        var grid = document.getElementById('tasksGrid');
        if (!tasks || tasks.length === 0) {
          grid.innerHTML = '<p class="empty">No tasks yet. Add one below.</p>';
          return;
        }
        grid.innerHTML = tasks.map(function (t) {
          var due = t.due_date ? '<div class="card-meta" style="margin-top:6px">Due: ' + escHtml(t.due_date) + '</div>' : '';
          return '<div class="card">'
            + '<div class="card-title">' + escHtml(t.title) + '</div>'
            + '<div style="margin-top:6px">' + statusBadge(t.status) + '</div>'
            + due
            + '</div>';
        }).join('');
      }

      function renderContext(ctx) {
        var area = document.getElementById('contextArea');
        if (!ctx || ctx.length === 0) {
          area.innerHTML = '<p class="empty">No context entries yet. Set one below.</p>';
          return;
        }
        var rows = ctx.map(function (c) {
          return '<tr><td class="context-key">' + escHtml(c.key) + '</td><td class="context-value">' + escHtml(c.value) + '</td></tr>';
        }).join('');
        area.innerHTML = '<table class="context-table"><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>' + rows + '</tbody></table>';
      }

      function loadData() {
        fetch('/api/dashboard/data', { credentials: 'same-origin' })
          .then(function (r) {
            if (r.status === 401) { window.location.href = '/api/auth/login'; throw new Error('unauth'); }
            if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Failed to load'); });
            return r.json();
          })
          .then(function (data) {
            renderNotes(data.notes);
            renderTasks(data.tasks);
            renderContext(data.context);
          })
          .catch(function (e) {
            if (e.message === 'unauth') return;
            var msg = '<p class="empty" style="color:#ff6b6b">⚠ ' + escHtml(e.message) + '</p>';
            document.getElementById('notesGrid').innerHTML = msg;
            document.getElementById('tasksGrid').innerHTML = msg;
            document.getElementById('contextArea').innerHTML = msg;
          });
      }

      loadData();

      function chatAction(prompt) {
        // Dashboard users are authenticated via session cookie — no anon header needed
        return fetch('/api/chat', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: prompt }),
        }).then(function (r) {
          if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Chat error'); });
          return r.json();
        });
      }

      document.getElementById('addNoteBtn').addEventListener('click', function () {
        var title = document.getElementById('noteTitle').value.trim();
        var content = document.getElementById('noteContent').value.trim();
        if (!title || !content) { alert('Title and content are required'); return; }
        var prompt = 'Create a note titled "' + title + '" with content: ' + content;
        this.disabled = true;
        var btn = this;
        chatAction(prompt)
          .then(function () {
            document.getElementById('noteTitle').value = '';
            document.getElementById('noteContent').value = '';
            loadData();
          })
          .catch(function () { alert('Failed to create note'); })
          .finally(function () { btn.disabled = false; });
      });

      document.getElementById('addTaskBtn').addEventListener('click', function () {
        var title = document.getElementById('taskTitle').value.trim();
        var due = document.getElementById('taskDue').value.trim();
        if (!title) { alert('Title is required'); return; }
        var prompt = 'Create a task titled "' + title + '"' + (due ? ' with due date ' + due : '');
        this.disabled = true;
        var btn = this;
        chatAction(prompt)
          .then(function () {
            document.getElementById('taskTitle').value = '';
            document.getElementById('taskDue').value = '';
            loadData();
          })
          .catch(function () { alert('Failed to create task'); })
          .finally(function () { btn.disabled = false; });
      });

      document.getElementById('addCtxBtn').addEventListener('click', function () {
        var key = document.getElementById('ctxKey').value.trim();
        var value = document.getElementById('ctxValue').value.trim();
        if (!key || !value) { alert('Key and value are required'); return; }
        var prompt = 'Set context key "' + key + '" to: ' + value;
        this.disabled = true;
        var btn = this;
        chatAction(prompt)
          .then(function () {
            document.getElementById('ctxKey').value = '';
            document.getElementById('ctxValue').value = '';
            loadData();
          })
          .catch(function () { alert('Failed to set context'); })
          .finally(function () { btn.disabled = false; });
      });

      // ---- MCP Token ----
      var currentToken = null;

      function renderToken(token) {
        currentToken = token;
        var area = document.getElementById('tokenArea');
        var copyBtn = document.getElementById('copyTokenBtn');
        var configDiv = document.getElementById('tokenConfig');
        var configBlock = document.getElementById('tokenConfigBlock');

        if (!token) {
          area.innerHTML = '<p style="color:#444;font-size:0.85rem">No token yet. Click Generate to create one.</p>';
          copyBtn.style.display = 'none';
          configDiv.style.display = 'none';
          return;
        }

        // Show token masked with reveal toggle
        area.innerHTML =
          '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
          '<code id="tokenDisplay" style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:6px;padding:8px 14px;font-size:0.82rem;color:#00ff88;letter-spacing:0.04em;word-break:break-all">' +
          escHtml(token.slice(0, 8)) + '&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;' +
          '</code>' +
          '<button class="btn btn-outline btn-sm" id="revealBtn">Reveal</button>' +
          '</div>';

        document.getElementById('revealBtn').addEventListener('click', function () {
          var display = document.getElementById('tokenDisplay');
          if (this.textContent === 'Reveal') {
            display.textContent = token;
            this.textContent = 'Hide';
          } else {
            display.innerHTML = escHtml(token.slice(0, 8)) + '&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;';
            this.textContent = 'Reveal';
          }
        });

        copyBtn.style.display = 'inline-block';

        var config = '{\n  "mcpServers": {\n    "cortex": {\n      "url": "https://personal-mcp-server-taupe.vercel.app/api/mcp",\n      "headers": {\n        "Authorization": "Bearer ' + token + '"\n      }\n    }\n  }\n}';
        configBlock.textContent = config;
        configDiv.style.display = 'block';
      }

      fetch('/api/auth/token', { credentials: 'same-origin' })
        .then(function (r) {
          if (!r.ok) throw new Error('Status ' + r.status);
          return r.json();
        })
        .then(function (d) { renderToken(d.token); })
        .catch(function (e) {
          document.getElementById('tokenArea').innerHTML = '<p style="color:#ff6b6b;font-size:0.85rem">⚠ Failed to load token (' + escHtml(e.message) + '). Try refreshing.</p>';
        });

      document.getElementById('copyTokenBtn').addEventListener('click', function () {
        if (!currentToken) return;
        var btn = this;
        navigator.clipboard.writeText(currentToken).then(function () {
          btn.textContent = '\u2713 Copied!';
          btn.style.color = '#00ff88';
          setTimeout(function () { btn.textContent = 'Copy token'; btn.style.color = ''; }, 2000);
        });
      });

      document.getElementById('copyConfigBtn').addEventListener('click', function () {
        var text = document.getElementById('tokenConfigBlock').textContent;
        var btn = this;
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = '\u2713 Copied!';
          btn.style.color = '#00ff88';
          setTimeout(function () { btn.textContent = 'Copy config'; btn.style.color = ''; }, 2000);
        });
      });

      document.getElementById('generateTokenBtn').addEventListener('click', function () {
        var btn = this;
        btn.disabled = true;
        btn.textContent = 'Generating\u2026';
        fetch('/api/auth/token', { method: 'POST', credentials: 'same-origin' })
          .then(function (r) {
            if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Status ' + r.status); });
            return r.json();
          })
          .then(function (d) {
            if (!d.token) throw new Error('No token returned');
            renderToken(d.token);
            btn.textContent = 'Regenerate token';
          })
          .catch(function (e) {
            document.getElementById('tokenArea').innerHTML = '<p style="color:#ff6b6b;font-size:0.85rem">\u26a0 Failed to generate token: ' + escHtml(e.message) + '</p>';
            btn.textContent = 'Generate token';
          })
          .finally(function () { btn.disabled = false; });
      });
    })();
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https://avatars.githubusercontent.com https://*.githubusercontent.com; frame-ancestors 'none'"
  );
  res.status(200).send(html);
}
