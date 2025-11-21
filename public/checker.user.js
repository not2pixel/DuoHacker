(function() {
  const container = document.createElement('div');
  container.id = 'duolingo-checker';
  container.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    width: 500px;
    max-height: 700px;
    background: linear-gradient(135deg, #1e293b, #0f172a);
    border: 1px solid #475569;
    border-radius: 12px;
    padding: 20px;
    font-family: 'Monaco', 'Courier New', monospace;
    color: #e2e8f0;
    z-index: 999999;
    box-shadow: 0 20px 25px rgba(0,0,0,0.5);
    overflow-y: auto;
  `;

  const html = `
    <div style="margin-bottom: 15px;">
      <h3 style="margin: 0 0 10px 0; color: #60a5fa; font-size: 16px;">🔍 Super Checker</h3>
    </div>

    <div style="margin-bottom: 12px;">
      <label style="display: block; font-size: 11px; color: #cbd5e1; margin-bottom: 5px; text-transform: uppercase;">🔗 Invite Link / ID</label>
      <input type="text" id="invite-input" style="width: 100%; padding: 8px; background: rgba(71,85,105,0.3); border: 1px solid #475569; border-radius: 6px; color: #e2e8f0; font-size: 12px;" placeholder="https://invite.duolingo.com/family-plan/2-N4GT-L7SD-W1LC-U2XF or 2-N4GT-L7SD-W1LC-U2XF" />
    </div>

    <div style="margin-bottom: 12px;">
      <label style="display: block; font-size: 11px; color: #cbd5e1; margin-bottom: 5px; text-transform: uppercase;">📝 Link List (từng dòng)</label>
      <textarea id="links-input" style="width: 100%; padding: 8px; background: rgba(71,85,105,0.3); border: 1px solid #475569; border-radius: 6px; color: #e2e8f0; font-size: 11px; min-height: 100px; font-family: monospace; resize: vertical;"></textarea>
    </div>

    <div style="display: flex; gap: 8px; margin-bottom: 15px;">
      <button id="check-single" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #3b82f6, #06b6d4); color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; text-transform: uppercase;">✓ Check 1</button>
      <button id="check-batch" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #8b5cf6, #06b6d4); color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; text-transform: uppercase;">✓ Check Batch</button>
      <button id="clear-btn" style="flex: 1; padding: 10px; background: rgba(71,85,105,0.5); color: #cbd5e1; border: 1px solid #475569; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; text-transform: uppercase;">🗑️ Clear</button>
      <button id="close-btn" style="padding: 10px 12px; background: rgba(71,85,105,0.5); color: #cbd5e1; border: 1px solid #475569; border-radius: 6px; cursor: pointer; font-size: 12px;">✕</button>
    </div>

    <div id="results" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #475569;">
      <div style="font-size: 11px; color: #cbd5e1; text-transform: uppercase; margin-bottom: 10px;">📊 Results</div>
      <div id="results-list" style="background: rgba(15,23,42,0.5); border: 1px solid #334155; border-radius: 6px; padding: 10px; max-height: 300px; overflow-y: auto; font-size: 11px; color: #cbd5e1;">
        <div style="color: #94a3b8; text-align: center; padding: 20px;">Kết quả sẽ hiển thị ở đây...</div>
      </div>
      <button id="export-btn" style="width: 100%; margin-top: 10px; padding: 8px; background: rgba(34,197,94,0.2); color: #86efac; border: 1px solid #22c55e; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; display: none;">📥 Export Working</button>
    </div>

    <div id="loading" style="display: none; margin-top: 15px; text-align: center; color: #60a5fa;">
      <div style="display: inline-block; width: 16px; height: 16px; border: 2px solid #475569; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <div style="margin-top: 8px; font-size: 12px;">Đang kiểm tra...</div>
    </div>

    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  `;

  container.innerHTML = html;
  document.body.appendChild(container);

  const results = [];

  document.getElementById('check-single').addEventListener('click', checkSingle);
  document.getElementById('check-batch').addEventListener('click', checkBatch);
  document.getElementById('clear-btn').addEventListener('click', clearResults);
  document.getElementById('close-btn').addEventListener('click', () => container.remove());
  document.getElementById('export-btn').addEventListener('click', exportWorking);

  function extractId(input) {
    if (input.includes('invite.duolingo.com')) {
      return input.split('/family-plan/')[1];
    }
    return input.trim();
  }

  function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
  }

  function addResult(id, status, type, data) {
    const statusColors = {
      'WORKING PREMIUM': { bg: 'rgba(34,197,94,0.2)', color: '#86efac', border: '#22c55e' },
      'WORKING FAMILY': { bg: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '#3b82f6' },
      'INVALID': { bg: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '#ef4444' },
      'ERROR': { bg: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '#ef4444' }
    };

    const colors = statusColors[status] || statusColors['ERROR'];
    const resultObj = { id, status, type, data };
    results.push(resultObj);

    const resultDiv = document.createElement('div');
    resultDiv.style.cssText = `
      padding: 10px;
      margin-bottom: 8px;
      background: ${colors.bg};
      border: 1px solid ${colors.border};
      border-radius: 6px;
      font-size: 11px;
      word-break: break-all;
    `;
    resultDiv.innerHTML = `
      <div style="color: ${colors.color}; font-weight: 600; margin-bottom: 4px;">✓ ${status}</div>
      <div style="color: #cbd5e1; font-size: 10px;">ID: ${id}</div>
      ${type ? `<div style="color: #94a3b8; font-size: 10px;">Type: ${type}</div>` : ''}
    `;

    const resultsList = document.getElementById('results-list');
    if (resultsList.children[0].textContent.includes('Kết quả')) {
      resultsList.innerHTML = '';
    }
    resultsList.insertBefore(resultDiv, resultsList.firstChild);

    updateExportBtn();
  }

  function updateExportBtn() {
    const working = results.filter(r => r.status.includes('WORKING'));
    if (working.length > 0) {
      document.getElementById('export-btn').style.display = 'block';
    }
  }

  function exportWorking() {
    const working = results.filter(r => r.status.includes('WORKING')).map(r => r.id).join('\n');
    navigator.clipboard.writeText(working).then(() => {
      const btn = document.getElementById('export-btn');
      btn.textContent = '✓ Đã copy!';
      setTimeout(() => btn.textContent = '📥 Export Working', 2000);
    });
  }

  async function checkId(id) {
    try {
      const url = `https://www.duolingo.com/2017-06-30/family-plan/invite/${id}`;
      const res = await fetch(url);
      const data = await res.json();

      if (res.status === 200) {
        if (data.isValid) {
          const type = data.subscriptionType || 'unknown';
          if (type === 'premium') {
            addResult(id, 'WORKING PREMIUM', type, data);
            return 'WORKING PREMIUM';
          } else if (type === 'family') {
            addResult(id, 'WORKING FAMILY', type, data);
            return 'WORKING FAMILY';
          } else {
            addResult(id, 'WORKING', type, data);
            return 'WORKING';
          }
        } else {
          addResult(id, 'INVALID', null, data);
          return 'INVALID';
        }
      } else {
        addResult(id, 'ERROR', `Status ${res.status}`, data);
        return `ERROR ${res.status}`;
      }
    } catch (err) {
      addResult(id, 'ERROR', err.message);
      return 'ERROR: ' + err.message;
    }
  }

  async function checkSingle() {
    const input = document.getElementById('invite-input').value.trim();
    if (!input) {
      alert('Vui lòng nhập link hoặc ID!');
      return;
    }

    showLoading(true);
    const id = extractId(input);
    await checkId(id);
    showLoading(false);
  }

  async function checkBatch() {
    const input = document.getElementById('links-input').value.trim();
    if (!input) {
      alert('Vui lòng nhập danh sách link!');
      return;
    }

    const links = input.split('\n').filter(l => l.trim());
    if (links.length === 0) {
      alert('Danh sách trống!');
      return;
    }

    showLoading(true);
    for (const link of links) {
      const id = extractId(link);
      await checkId(id);
      await new Promise(r => setTimeout(r, 100));
    }
    showLoading(false);
  }

  function clearResults() {
    results.length = 0;
    document.getElementById('results-list').innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 20px;">Kết quả sẽ hiển thị ở đây...</div>';
    document.getElementById('export-btn').style.display = 'none';
    document.getElementById('invite-input').value = '';
    document.getElementById('links-input').value = '';
  }
})();
