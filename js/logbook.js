/* ============================================================
   FisherSafe — Logbook System (Replaces AI Chat)
   ============================================================ */

const AppLogbook = (() => {
  const MAX_CHARS = 295;

  // Format current time HH:MM:SS
  function getTimeStr() {
    const now = new Date();
    return now.toTimeString().slice(0, 8);
  }

  // ----------------------------------------------------------------
  // Render the logbook screen HTML
  // ----------------------------------------------------------------
  function renderLogbookPage() {
    return `
      <div class="page active" id="page-logbook">
        <!-- Header -->
        <div class="page-header" style="background:linear-gradient(180deg, #2c3e50, #34495e)">
          <button class="page-header-back" onclick="App.goBack()" aria-label="Back">←</button>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:28px;height:28px;border-radius:4px;background:#1abc9c;display:flex;align-items:center;justify-content:center;font-size:0.85rem">📓</div>
            <div>
              <div class="page-header-title" style="font-size:1rem;font-weight:600">Captain's Logbook</div>
              <div style="font-size:0.7rem;opacity:0.8">Offline Record</div>
            </div>
          </div>
          <button class="page-header-action" onclick="AppLogbook.showLogbookMenu()" aria-label="Menu">⋮</button>
        </div>

        <!-- Log area -->
        <div class="chat-screen" style="position:relative;flex:1;overflow:hidden;background-color:#ecf0f1;">
          <!-- Messages -->
          <div class="chat-messages" id="logbook-entries-list" style="padding:16px;"></div>

          <!-- Input bar -->
          <div class="chat-input-bar" style="background:#fff;border-top:1px solid #bdc3c7;">
            <div class="chat-input-wrap">
              <textarea
                class="chat-input"
                id="logbook-input-field"
                placeholder="Log a catch, note, or hazard..."
                rows="1"
                maxlength="295"
                oninput="AppLogbook.onInput(this)"
                onkeydown="AppLogbook.onKeyDown(event)"
                aria-label="Type a log entry"
                style="color:#2c3e50;"
              ></textarea>
              <span class="chat-char-count" id="logbook-char-count" style="color:#7f8c8d;">0/295</span>
            </div>
            <button class="chat-send-btn" onclick="AppLogbook.saveEntry()" id="logbook-send-btn" aria-label="Save" style="background:#2980b9;">💾</button>
          </div>
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------------------
  // Build fisherman's log entry
  // ----------------------------------------------------------------
  function buildLogEntry(entry) {
    const div = document.createElement('div');
    div.style.background = '#ffffff';
    div.style.padding = '12px';
    div.style.borderRadius = '8px';
    div.style.marginBottom = '12px';
    div.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    div.style.borderLeft = entry.isSOS ? '4px solid #e74c3c' : '4px solid #3498db';

    const header = entry.isSOS ? '<strong style="color:#e74c3c;">🆘 SOS Broadcast</strong>' : '<strong>📝 Log Entry</strong>';

    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:0.8rem;color:#7f8c8d;">
        <span>${header}</span>
        <span>${entry.time || getTimeStr()}</span>
      </div>
      <div style="font-size:0.95rem;color:#2c3e50;line-height:1.4;">${escapeHtml(entry.text)}</div>
      <div style="margin-top:8px;font-size:0.75rem;color:#95a5a6;">
        📍 ${entry.coords || 'Location unknown'}
      </div>
    `;
    return div;
  }

  // ----------------------------------------------------------------
  // Load and render all logs
  // ----------------------------------------------------------------
  async function loadEntries() {
    const list = document.getElementById('logbook-entries-list');
    if (!list) return;
    list.innerHTML = '';

    try {
      const saved = await AppStorage.loadMessages(); // reusing the same storage key for simplicity
      saved.forEach(entry => {
        // filter out old 'vcs' ai messages if they exist
        if (entry.type !== 'vcs') {
           list.appendChild(buildLogEntry(entry));
        }
      });
    } catch (e) {}

    scrollToBottom();
  }

  // ----------------------------------------------------------------
  // Save a new log entry
  // ----------------------------------------------------------------
  async function saveEntry() {
    const input = document.getElementById('logbook-input-field');
    const list = document.getElementById('logbook-entries-list');
    if (!input || !list) return;

    const text = input.value.trim();
    if (!text) return;
    
    const { lat, lon } = AppGPS.state;
    const coordStr = lat ? AppGPS.formatCoords(lat, lon) : 'Location unknown';

    const entry = { type: 'own', text, time: getTimeStr(), isSOS: false, coords: coordStr };
    list.appendChild(buildLogEntry(entry));
    await AppStorage.saveMessage(entry);

    input.value = '';
    updateCharCount(0);
    scrollToBottom();
  }

  // ----------------------------------------------------------------
  // Send SOS (broadcast to log)
  // ----------------------------------------------------------------
  async function sendSOS() {
    AppAlerts.resumeAudio();
    const { lat, lon } = AppGPS.state;
    const coordStr = AppGPS.formatCoords(lat, lon);
    const text = 'EMERGENCY SOS TRIGGERED. Broadcasting position on VHF 16 (simulated).';

    const entry = { type: 'own', text, time: getTimeStr(), isSOS: true, coords: coordStr };
    
    await AppStorage.saveMessage(entry);
    AppAlerts.triggerSOS('EMERGENCY SOS');
    
    // if currently on logbook page, update it
    const list = document.getElementById('logbook-entries-list');
    if (list) {
        list.appendChild(buildLogEntry(entry));
        scrollToBottom();
    }
  }

  // ----------------------------------------------------------------
  // Input handler
  // ----------------------------------------------------------------
  function onInput(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
    updateCharCount(textarea.value.length);
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEntry();
    }
  }

  function updateCharCount(len) {
    const el = document.getElementById('logbook-char-count');
    if (el) el.textContent = `${len}/295`;
  }

  function scrollToBottom() {
    const list = document.getElementById('logbook-entries-list');
    if (list) list.scrollTop = list.scrollHeight;
  }

  function showLogbookMenu() {
    AppAlerts.showToast('ℹ️ Logbook Menu', 'Export to PDF coming soon.', 'safe', 3000);
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    renderLogbookPage,
    loadEntries,
    saveEntry,
    sendSOS,
    onInput,
    onKeyDown,
    showLogbookMenu,
    getTimeStr,
  };
})();
