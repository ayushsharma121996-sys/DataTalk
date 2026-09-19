let currentEngineMode = 'with_clarification';
let currentPendingQuestion = '';

document.addEventListener('DOMContentLoaded', () => {
  loadSchema();
});

function setEngineMode(mode) {
  currentEngineMode = mode;
  document.getElementById('mode-with-clarification').classList.toggle('active', mode === 'with_clarification');
  document.getElementById('mode-without-clarification').classList.toggle('active', mode === 'without_clarification');
}

async function loadSchema() {
  try {
    const res = await fetch('/api/schema');
    const data = await res.json();
    renderSchemaTree(data.schema);
  } catch (err) {
    console.error('Failed to load schema:', err);
    document.getElementById('schema-tree').innerHTML = `<div class="error-msg">Failed to load database schema.</div>`;
  }
}

function renderSchemaTree(schema) {
  const container = document.getElementById('schema-tree');
  if (!schema) return;

  let html = '';
  for (const [tableName, cols] of Object.entries(schema)) {
    html += `
      <div class="table-node">
        <div class="table-header">
          <span>📁 ${tableName}</span>
          <span style="font-size: 0.72rem; color: #9ca3af;">${cols.length} cols</span>
        </div>
        <div class="table-cols">
          ${cols.map(c => `
            <div class="col-item">
              <span>${c.pk ? '🔑 ' : ''}${c.name}</span>
              <span class="col-type">${c.type}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}

function useSamplePrompt(text) {
  document.getElementById('query-input').value = text;
  handleQuerySubmit(new Event('submit'));
}

async function handleQuerySubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('query-input');
  const question = input.value.trim();
  if (!question) return;

  // Append user message to feed
  appendUserMessage(question);
  input.value = '';
  currentPendingQuestion = question;

  // Render typing loader
  const loaderId = appendLoaderMessage();

  try {
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, mode: currentEngineMode })
    });

    const data = await res.json();
    removeLoader(loaderId);

    if (data.status === 'clarification_required') {
      renderClarificationPrompt(data);
    } else if (data.status === 'success') {
      renderQueryResponse(data);
    } else {
      appendErrorMessage(data.error || 'Failed to process query.');
    }

  } catch (err) {
    removeLoader(loaderId);
    appendErrorMessage('Connection error. Server is unreachable.');
  }
}

async function submitClarification(choiceKey, choiceLabel) {
  const loaderId = appendLoaderMessage();

  try {
    const res = await fetch('/api/clarify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: currentPendingQuestion,
        choiceKey,
        choiceLabel
      })
    });

    const data = await res.json();
    removeLoader(loaderId);

    if (data.status === 'success') {
      renderQueryResponse(data);
    } else {
      appendErrorMessage(data.error || 'Failed to process clarification choice.');
    }
  } catch (err) {
    removeLoader(loaderId);
    appendErrorMessage('Connection error during clarification submission.');
  }
}

function appendUserMessage(text) {
  const feed = document.getElementById('messages-feed');
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message user-message';
  msgEl.innerHTML = `
    <div class="user-bubble">${escapeHtml(text)}</div>
  `;
  feed.appendChild(msgEl);
  feed.scrollTop = feed.scrollHeight;
}

function renderClarificationPrompt(data) {
  const feed = document.getElementById('messages-feed');
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message bot-message';
  
  const optionsHtml = data.options.map(opt => `
    <button class="option-btn" onclick="submitClarification('${opt.key}', '${escapeHtml(opt.label)}')">
      <span class="option-label">${opt.label}</span>
      <span class="option-desc">${opt.description}</span>
    </button>
  `).join('');

  msgEl.innerHTML = `
    <div class="bot-avatar">🔍</div>
    <div class="message-content">
      <div class="clarification-card">
        <div class="clarification-title">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          Query Disambiguation Required
        </div>
        <div class="clarification-reason">${data.reason}</div>
        <p style="font-size: 0.88rem; font-weight: 500; margin-bottom: 10px;">${data.prompt}</p>
        <div class="options-grid">
          ${optionsHtml}
        </div>
      </div>
    </div>
  `;
  feed.appendChild(msgEl);
  feed.scrollTop = feed.scrollHeight;
}

function renderQueryResponse(data) {
  const feed = document.getElementById('messages-feed');
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message bot-message';

  const isGood = data.accuracyScore.includes('85%+');

  // Render Table
  let tableHtml = '';
  if (data.data && data.data.length > 0) {
    const cols = Object.keys(data.data[0]);
    const encodedData = encodeURIComponent(JSON.stringify(data.data));
    tableHtml = `
      <div class="data-table-header">
        <span style="font-size: 0.8rem; font-weight: 600; color: #9ca3af;">Query Results (${data.resultCount} rows)</span>
        <button class="action-btn" onclick="exportToCsv('query_results.csv', '${encodedData}')">
          📥 Export CSV
        </button>
      </div>
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>${cols.map(c => `<th>${c.replace(/_/g, ' ')}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${data.data.map(row => `
              <tr>${cols.map(c => `<td>${row[c] !== null ? escapeHtml(String(row[c])) : ''}</td>`).join('')}</tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  const encodedSql = escapeHtml(data.sql);

  msgEl.innerHTML = `
    <div class="bot-avatar">🤖</div>
    <div class="message-content">
      <!-- Summary KPI Card -->
      <div class="summary-kpi-card">
        <div>
          <div class="kpi-title">${data.summaryCard.title}</div>
          <div class="kpi-val">${data.summaryCard.value}</div>
        </div>
        <div class="accuracy-badge ${isGood ? 'good' : 'bad'}">
          ${data.accuracyScore}
        </div>
      </div>

      ${data.assumptionMade ? `<div style="font-size: 0.82rem; color: #fca5a5; background: rgba(239, 68, 68, 0.1); padding: 8px 12px; border-radius: 6px;">⚠️ <strong>Warning:</strong> ${data.assumptionMade}</div>` : ''}
      ${data.clarificationChoice ? `<div style="font-size: 0.82rem; color: #6ee7b7; background: rgba(16, 185, 129, 0.1); padding: 8px 12px; border-radius: 6px;">✅ <strong>Validated Intent:</strong> ${data.clarificationChoice}</div>` : ''}

      <!-- SQL Inspector Box -->
      <div class="sql-box">
        <div class="sql-header">
          <span>Generated T-SQL / SQLite Query</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>Confidence: ${data.confidenceScore}%</span>
            <button class="copy-btn" onclick="copySqlToClipboard(this, \`${data.sql.replace(/`/g, '\\`')}\`)">📋 Copy</button>
          </div>
        </div>
        <div class="sql-code">${encodedSql}</div>
        <div class="sql-explanation">💡 <strong>Plain English Logic:</strong> ${data.explanation}</div>
      </div>

      <!-- Data Result Table -->
      ${tableHtml}
    </div>
  `;

  feed.appendChild(msgEl);
  feed.scrollTop = feed.scrollHeight;
}

function copySqlToClipboard(btn, sqlText) {
  navigator.clipboard.writeText(sqlText).then(() => {
    const orig = btn.innerText;
    btn.innerText = '✓ Copied!';
    setTimeout(() => { btn.innerText = orig; }, 2000);
  }).catch(() => {
    alert('SQL copied to clipboard');
  });
}

function exportToCsv(filename, dataJsonEncoded) {
  try {
    const data = JSON.parse(decodeURIComponent(dataJsonEncoded));
    if (!data || !data.length) return;
    
    const headers = Object.keys(data[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));
    
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header] === null ? '' : String(row[header]);
        const escaped = val.replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Failed to export CSV:', err);
  }
}

function appendLoaderMessage() {
  const feed = document.getElementById('messages-feed');
  const id = 'loader-' + Date.now();
  const msgEl = document.createElement('div');
  msgEl.id = id;
  msgEl.className = 'chat-message bot-message';
  msgEl.innerHTML = `
    <div class="bot-avatar">🤖</div>
    <div class="message-content" style="display: flex; align-items: center; gap: 8px; color: #9ca3af; font-size: 0.85rem;">
      <div class="spinner"></div> Analyzing query & schema...
    </div>
  `;
  feed.appendChild(msgEl);
  feed.scrollTop = feed.scrollHeight;
  return id;
}

function removeLoader(id) {
  const loader = document.getElementById(id);
  if (loader) loader.remove();
}

function appendErrorMessage(errorMsg) {
  const feed = document.getElementById('messages-feed');
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message bot-message';
  msgEl.innerHTML = `
    <div class="bot-avatar">⚠️</div>
    <div class="message-content" style="color: #fca5a5; background: rgba(239, 68, 68, 0.1); padding: 12px; border-radius: 8px;">
      <strong>Error:</strong> ${escapeHtml(errorMsg)}
    </div>
  `;
  feed.appendChild(msgEl);
  feed.scrollTop = feed.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

