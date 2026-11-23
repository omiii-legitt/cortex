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
            var msg = '<p class="empty" style="color:#ff6b6b">\u26A0 ' + escHtml(e.message) + '</p>';
            document.getElementById('notesGrid').innerHTML = msg;
            document.getElementById('tasksGrid').innerHTML = msg;
            document.getElementById('contextArea').innerHTML = msg;
          });
      }

      loadData();

      function chatAction(prompt) {
        // Dashboard users are authenticated via session cookie - no anon header needed
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
          document.getElementById('tokenArea').innerHTML = '<p style="color:#ff6b6b;font-size:0.85rem">\u26A0 Failed to load token (' + escHtml(e.message) + '). Try refreshing.</p>';
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
            document.getElementById('tokenArea').innerHTML = '<p style="color:#ff6b6b;font-size:0.85rem">\u26A0 Failed to generate token: ' + escHtml(e.message) + '</p>';
            btn.textContent = 'Generate token';
          })
          .finally(function () { btn.disabled = false; });
      });
    })();
