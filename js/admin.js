/**
 * FisherSafe — Admin Dashboard View Controller
 * Full Maritime Surveillance, Fisherman Management, Boat Registry, Alert Management, and Security Auditing.
 */

const AppAdmin = (() => {
  let activeTab = 'overview';
  let cachedStats = null;

  function renderAdminLayout() {
    const user = AppAuth.getCurrentUser() || { fullName: 'Maritime Admin', fishermanId: 'ADMIN001' };

    return `
      <div class="admin-layout" id="admin-view-root">
        <!-- Sidebar Navigation -->
        <aside class="admin-sidebar" id="admin-sidebar">
          <div class="admin-sidebar-header">
            <div class="admin-brand-icon">⚓</div>
            <div>
              <div class="admin-brand-title">FisherSafe HQ</div>
              <div class="admin-brand-sub">Maritime Surveillance</div>
            </div>
          </div>

          <nav class="admin-nav-menu">
            <button class="admin-nav-item ${activeTab === 'overview' ? 'active' : ''}" onclick="AppAdmin.switchTab('overview')">
              <span class="admin-nav-item-icon">📊</span>
              <span>Overview</span>
            </button>
            <button class="admin-nav-item ${activeTab === 'fishermen' ? 'active' : ''}" onclick="AppAdmin.switchTab('fishermen')">
              <span class="admin-nav-item-icon">👨‍✈️</span>
              <span>Fisherman Registry</span>
            </button>
            <button class="admin-nav-item ${activeTab === 'boats' ? 'active' : ''}" onclick="AppAdmin.switchTab('boats')">
              <span class="admin-nav-item-icon">🚢</span>
              <span>Boat Registry</span>
            </button>
            <button class="admin-nav-item ${activeTab === 'alerts' ? 'active' : ''}" onclick="AppAdmin.switchTab('alerts')">
              <span class="admin-nav-item-icon">🚨</span>
              <span>Boundary Alerts</span>
            </button>
            <button class="admin-nav-item ${activeTab === 'emergencies' ? 'active' : ''}" onclick="AppAdmin.switchTab('emergencies')">
              <span class="admin-nav-item-icon">🆘</span>
              <span>Emergency / SOS</span>
            </button>
            <button class="admin-nav-item ${activeTab === 'admins' ? 'active' : ''}" onclick="AppAdmin.switchTab('admins')">
              <span class="admin-nav-item-icon">🛡️</span>
              <span>Admin Accounts</span>
            </button>
            <button class="admin-nav-item ${activeTab === 'audit' ? 'active' : ''}" onclick="AppAdmin.switchTab('audit')">
              <span class="admin-nav-item-icon">📜</span>
              <span>Audit Trail</span>
            </button>
            <button class="admin-nav-item ${activeTab === 'analytics' ? 'active' : ''}" onclick="AppAdmin.switchTab('analytics')">
              <span class="admin-nav-item-icon">📈</span>
              <span>Reports & Analytics</span>
            </button>
          </nav>

          <div class="admin-sidebar-footer">
            <div class="admin-user-pill">
              <div class="admin-user-avatar">👮</div>
              <div class="admin-user-info">
                <div class="admin-user-name" title="${user.fullName}">${user.fullName}</div>
                <div class="admin-user-role">ID: ${user.fishermanId}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm btn-outline" style="flex:1;font-size:0.7rem;padding:5px" onclick="App.navigate('home')">
                🗺️ Vessel Map
              </button>
              <button class="btn btn-sm btn-danger" style="font-size:0.7rem;padding:5px 8px" onclick="App.logout()">
                🚪 Logout
              </button>
            </div>
          </div>
        </aside>

        <!-- Main Body Area -->
        <main class="admin-main">
          <!-- Topbar -->
          <header class="admin-topbar">
            <div class="admin-topbar-left">
              <button class="admin-menu-toggle" onclick="AppAdmin.toggleSidebar()">☰</button>
              <h1 class="admin-section-heading" id="admin-topbar-title">
                ${getTabTitle(activeTab)}
              </h1>
            </div>

            <div class="admin-topbar-right">
              <div class="system-status-indicator">
                <span class="pulse-dot"></span>
                <span>Surveillance Server Online</span>
              </div>
              <button class="btn btn-sm btn-outline" style="font-size:0.72rem;padding:4px 8px" onclick="AppAdmin.refreshCurrentTab()">
                🔄 Refresh
              </button>
            </div>
          </header>

          <!-- Tab Content Container -->
          <section class="admin-content-scroll" id="admin-tab-content">
            <div style="padding:20px;text-align:center;color:#8892b0">
              Loading maritime data...
            </div>
          </section>
        </main>

        <!-- Modal Mount Point -->
        <div id="admin-modal-container"></div>
      </div>
    `;
  }

  function getTabTitle(tab) {
    switch (tab) {
      case 'overview': return '📊 Maritime Surveillance Overview';
      case 'fishermen': return '👨‍✈️ Fisherman Master Registry';
      case 'boats': return '🚢 Vessel & Boat Management';
      case 'alerts': return '🚨 Boundary Warning & Violation Alerts';
      case 'emergencies': return '🆘 Emergency & Distress SOS Response';
      case 'admins': return '🛡️ Authorized Administrator Accounts';
      case 'audit': return '📜 Administrative Action Audit Log';
      case 'analytics': return '📈 Maritime Safety Analytics & Reports';
      default: return 'Admin Command Center';
    }
  }

  function toggleSidebar() {
    const s = document.getElementById('admin-sidebar');
    if (s) s.classList.toggle('open');
  }

  function switchTab(tab) {
    activeTab = tab;
    // Update active nav button
    document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
    // Close mobile sidebar if open
    const s = document.getElementById('admin-sidebar');
    if (s) s.classList.remove('open');

    const titleEl = document.getElementById('admin-topbar-title');
    if (titleEl) titleEl.innerHTML = getTabTitle(tab);

    loadTabData(tab);
  }

  function refreshCurrentTab() {
    loadTabData(activeTab);
  }

  async function loadTabData(tab) {
    const container = document.getElementById('admin-tab-content');
    if (!container) return;

    container.innerHTML = '<div style="padding:40px;text-align:center;color:#8892b0"><div style="font-size:2rem;margin-bottom:8px">⏳</div>Retrieving live maritime records...</div>';

    switch (tab) {
      case 'overview':
        await renderOverview(container);
        break;
      case 'fishermen':
        await renderFishermen(container);
        break;
      case 'boats':
        await renderBoats(container);
        break;
      case 'alerts':
        await renderAlerts(container);
        break;
      case 'emergencies':
        await renderEmergencies(container);
        break;
      case 'admins':
        await renderAdmins(container);
        break;
      case 'audit':
        await renderAudit(container);
        break;
      case 'analytics':
        await renderAnalytics(container);
        break;
    }
  }

  // ----------------------------------------------------------------
  // 1. OVERVIEW TAB
  // ----------------------------------------------------------------
  async function renderOverview(container) {
    const res = await AppAPI.admin.getStats();
    if (!res.success) {
      container.innerHTML = `<div class="admin-empty-state"><div class="admin-empty-icon">⚠️</div><div>Error loading stats: ${res.error || 'Server error'}</div></div>`;
      return;
    }

    const s = res.stats;
    cachedStats = s;

    container.innerHTML = `
      <!-- Authoritative Legal Notice -->
      <div class="authoritative-boundary-banner">
        <span style="font-size:1.3rem">ℹ️</span>
        <div>
          <strong>Authoritative Boundary Data Notice:</strong>
          Official legal maritime borders follow bilateral agreements between the Government of India and Sri Lanka (1974 & 1976 treaties under UNCLOS).
          Configured safety zones (50 km early alert, 20 km strong alert, 5 km critical proximity) represent preventive administrative safety buffers, not legal territorial boundaries.
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="admin-stats-grid">
        <div class="admin-stat-card safe-card">
          <div class="admin-stat-header">
            <span class="admin-stat-title">Total Fishermen</span>
            <span class="admin-stat-icon">👨‍✈️</span>
          </div>
          <div class="admin-stat-value">${s.totalFishermen}</div>
          <div class="admin-stat-sub">
            <span>🟢 ${s.activeFishermen} Active</span>
            <span>⚪ ${s.disabledFishermen} Disabled</span>
          </div>
        </div>

        <div class="admin-stat-card">
          <div class="admin-stat-header">
            <span class="admin-stat-title">Registered Boats</span>
            <span class="admin-stat-icon">🚢</span>
          </div>
          <div class="admin-stat-value">${s.totalBoats}</div>
          <div class="admin-stat-sub">
            <span>✅ ${s.verifiedBoats} Verified</span>
            <span>⏳ ${s.pendingBoats} Pending</span>
          </div>
        </div>

        <div class="admin-stat-card alert-card">
          <div class="admin-stat-header">
            <span class="admin-stat-title">Boundary Alerts</span>
            <span class="admin-stat-icon">🚨</span>
          </div>
          <div class="admin-stat-value">${s.totalAlerts}</div>
          <div class="admin-stat-sub">
            <span style="color:#ffa726">⚠️ ${s.activeAlerts} Active Warnings</span>
            <span style="color:#ef5350">🔴 ${s.criticalAlerts} Critical</span>
          </div>
        </div>

        <div class="admin-stat-card emergency-card">
          <div class="admin-stat-header">
            <span class="admin-stat-title">Emergency Distresses</span>
            <span class="admin-stat-icon">🆘</span>
          </div>
          <div class="admin-stat-value" style="color:#ff5252">${s.totalEmergencies}</div>
          <div class="admin-stat-sub">
            <span style="color:#ff5252;font-weight:700">🚨 ${s.activeEmergencies} Require Action</span>
          </div>
        </div>
      </div>

      <!-- Quick Actions Toolbar -->
      <div class="admin-toolbar">
        <div style="font-weight:700;font-size:0.85rem">⚡ Maritime Command Quick Actions</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-primary" onclick="AppAdmin.switchTab('fishermen')">🔍 Inspect Fishermen</button>
          <button class="btn btn-sm btn-warn" onclick="AppAdmin.switchTab('alerts')">🚨 View Active Alerts</button>
          <button class="btn btn-sm btn-danger" onclick="AppAdmin.switchTab('emergencies')">🆘 Emergency Response</button>
        </div>
      </div>

      <!-- Live Recent Feed Grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px">
        <div class="analytics-card">
          <div class="analytics-card-title">📡 Surveillance System Status</div>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:0.8rem">
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
              <span style="color:#8892b0">Core System Status:</span>
              <span class="badge-status active">${s.systemStatus}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
              <span style="color:#8892b0">Boundary Dataset:</span>
              <span style="color:#64ffda;font-weight:700">UNCLOS Bilateral 1974/76</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
              <span style="color:#8892b0">Coast Guard Channel:</span>
              <span style="color:white;font-weight:700">VHF Marine Ch 16 / 1554</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0">
              <span style="color:#8892b0">Offline Sync Protocol:</span>
              <span class="badge-status safe">ACTIVE</span>
            </div>
          </div>
        </div>

        <div class="analytics-card">
          <div class="analytics-card-title">🛡️ Security & Role Enforcement</div>
          <div style="font-size:0.78rem;color:#ccd6f6;line-height:1.5">
            <p style="margin-bottom:8px">
              ✅ <strong>Backend RBAC:</strong> Server strictly enforces <code>role='admin'</code> on all <code>/api/admin/*</code> routes.
            </p>
            <p style="margin-bottom:8px">
              🔒 <strong>Tamper Protection:</strong> Frontend client changes cannot bypass authorization without a cryptographically signed HMAC-SHA256 JWT token.
            </p>
            <p>
              🔑 <strong>Zero Password Exposure:</strong> Bcrypt password hashes are strictly filtered on the server and never sent to client dashboards.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------------------
  // 2. FISHERMAN REGISTRY TAB
  // ----------------------------------------------------------------
  async function renderFishermen(container, query = '', status = 'all') {
    const res = await AppAPI.admin.getFishermen({ query, status });
    if (!res.success) {
      container.innerHTML = `<div class="admin-empty-state"><div class="admin-empty-icon">⚠️</div><div>Error loading fishermen: ${res.error}</div></div>`;
      return;
    }

    const list = res.fishermen;

    container.innerHTML = `
      <div class="admin-toolbar">
        <div class="admin-search-wrap">
          <span>🔍</span>
          <input type="text" class="admin-search-input" id="fish-search-input"
            placeholder="Search by Name, Fisherman ID, Mobile, or Boat..."
            value="${escapeHtml(query)}"
            onkeydown="if(event.key==='Enter') AppAdmin.searchFishermen()" />
        </div>

        <div class="admin-filter-group">
          <select class="admin-select" id="fish-status-filter" onchange="AppAdmin.searchFishermen()">
            <option value="all" ${status === 'all' ? 'selected' : ''}>All Statuses</option>
            <option value="active" ${status === 'active' ? 'selected' : ''}>Active Accounts</option>
            <option value="disabled" ${status === 'disabled' ? 'selected' : ''}>Disabled Accounts</option>
          </select>
          <button class="btn btn-sm btn-primary" onclick="AppAdmin.searchFishermen()">Apply Filter</button>
        </div>
      </div>

      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Fisherman ID</th>
              <th>Full Name</th>
              <th>Mobile Phone</th>
              <th>Boat Reg No</th>
              <th>Home Port</th>
              <th>Account Status</th>
              <th>Registered Date</th>
              <th style="text-align:right">Admin Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `
              <tr>
                <td colspan="8" style="text-align:center;padding:24px;color:#8892b0">
                  No fishermen match your query criteria.
                </td>
              </tr>
            ` : list.map(u => `
              <tr>
                <td style="font-weight:700;color:#64ffda">${escapeHtml(u.fishermanId)}</td>
                <td style="font-weight:600;color:white">${escapeHtml(u.fullName)}</td>
                <td>${escapeHtml(u.phone)}</td>
                <td><span style="font-weight:700">${escapeHtml(u.boatId || '—')}</span></td>
                <td>${escapeHtml(u.homePort || '—')}</td>
                <td>
                  <span class="badge-status ${u.status === 'active' ? 'active' : 'disabled'}">
                    ${u.status === 'active' ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td style="color:#8892b0;font-size:0.75rem">
                  ${u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}
                </td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="table-action-btn" onclick="AppAdmin.viewFishermanModal('${u.id}')" title="View Details">👁️ View</button>
                  <button class="table-action-btn" onclick="AppAdmin.editFishermanModal('${u.id}')" title="Edit Profile">✏️ Edit</button>
                  ${u.status === 'active'
                    ? `<button class="table-action-btn danger" onclick="AppAdmin.toggleFishermanStatus('${u.id}', 'disabled')" title="Disable Account">🚫 Disable</button>`
                    : `<button class="table-action-btn" onclick="AppAdmin.toggleFishermanStatus('${u.id}', 'active')" style="color:#4caf50" title="Reactivate Account">✅ Enable</button>`
                  }
                  <button class="table-action-btn danger" onclick="AppAdmin.deleteFishermanConfirm('${u.id}', '${escapeHtml(u.fishermanId)}')" title="Delete Account">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="admin-pagination-bar">
          <span>Showing ${list.length} registered vessel captains</span>
          <span>Security Notice: Passwords and hashes are strictly protected</span>
        </div>
      </div>
    `;
  }

  function searchFishermen() {
    const q = document.getElementById('fish-search-input')?.value || '';
    const s = document.getElementById('fish-status-filter')?.value || 'all';
    const container = document.getElementById('admin-tab-content');
    if (container) renderFishermen(container, q, s);
  }

  async function viewFishermanModal(id) {
    const res = await AppAPI.admin.getFisherman(id);
    if (!res.success) {
      alert('Error: ' + res.error);
      return;
    }
    const f = res.fisherman;
    const b = res.boat;

    showModal(`
      <div class="admin-modal-header">
        <h3 class="admin-modal-title">👨‍✈️ Fisherman Profile: ${escapeHtml(f.fullName)}</h3>
        <button class="admin-modal-close" onclick="AppAdmin.closeModal()">✕</button>
      </div>
      <div style="font-size:0.82rem;line-height:1.6">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div><strong style="color:#8892b0">Fisherman ID:</strong><br><span style="color:#64ffda;font-weight:700">${escapeHtml(f.fishermanId)}</span></div>
          <div><strong style="color:#8892b0">Account Status:</strong><br><span class="badge-status ${f.status}">${f.status}</span></div>
          <div><strong style="color:#8892b0">Mobile Number:</strong><br>${escapeHtml(f.phone)}</div>
          <div><strong style="color:#8892b0">Email Address:</strong><br>${escapeHtml(f.email || 'None')}</div>
          <div><strong style="color:#8892b0">Home Port District:</strong><br>${escapeHtml(f.homePort)}</div>
          <div><strong style="color:#8892b0">Boat Registration:</strong><br><strong style="color:white">${escapeHtml(f.boatId)}</strong></div>
          <div><strong style="color:#8892b0">Emergency Contact:</strong><br>${escapeHtml(f.emergencyContact || '—')}</div>
          <div><strong style="color:#8892b0">Emergency Phone:</strong><br>${escapeHtml(f.emergencyPhone || '—')}</div>
          <div><strong style="color:#8892b0">Registered On:</strong><br>${new Date(f.createdAt).toLocaleString('en-IN')}</div>
          <div><strong style="color:#8892b0">Last Login:</strong><br>${f.lastLoginAt ? new Date(f.lastLoginAt).toLocaleString('en-IN') : 'Never'}</div>
        </div>

        ${b ? `
          <div style="background:#020c1b;padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);margin-top:10px">
            <strong style="color:#64ffda">🚢 Associated Vessel Information:</strong>
            <div style="margin-top:4px">Boat Name: <strong>${escapeHtml(b.boatName || '—')}</strong> (${escapeHtml(b.boatType || '—')})</div>
            <div>Status: <span class="badge-status ${b.registrationStatus}">${b.registrationStatus}</span> | Emergency: ${b.emergencyStatus}</div>
            ${b.lastLocation ? `<div>Last GPS Fix: ${b.lastLocation.lat.toFixed(4)}°N, ${b.lastLocation.lon.toFixed(4)}°E</div>` : ''}
          </div>
        ` : ''}
      </div>
      <div style="text-align:right;margin-top:16px">
        <button class="btn btn-sm btn-outline" onclick="AppAdmin.closeModal()">Close</button>
      </div>
    `);
  }

  async function editFishermanModal(id) {
    const res = await AppAPI.admin.getFisherman(id);
    if (!res.success) {
      alert('Error: ' + res.error);
      return;
    }
    const f = res.fisherman;

    showModal(`
      <div class="admin-modal-header">
        <h3 class="admin-modal-title">✏️ Edit Fisherman: ${escapeHtml(f.fishermanId)}</h3>
        <button class="admin-modal-close" onclick="AppAdmin.closeModal()">✕</button>
      </div>
      <form onsubmit="event.preventDefault(); AppAdmin.submitEditFisherman('${f.id}');">
        <div class="admin-form-group">
          <label class="admin-form-label">Full Name</label>
          <input type="text" class="admin-form-input" id="edit-fish-name" value="${escapeHtml(f.fullName)}" required />
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Mobile Number</label>
          <input type="tel" class="admin-form-input" id="edit-fish-phone" value="${escapeHtml(f.phone)}" maxlength="10" required />
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Home Port</label>
          <input type="text" class="admin-form-input" id="edit-fish-port" value="${escapeHtml(f.homePort)}" required />
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Emergency Contact Name</label>
          <input type="text" class="admin-form-input" id="edit-fish-emcontact" value="${escapeHtml(f.emergencyContact || '')}" />
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Emergency Phone</label>
          <input type="tel" class="admin-form-input" id="edit-fish-emphone" value="${escapeHtml(f.emergencyPhone || '')}" maxlength="10" />
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Account Status</label>
          <select class="admin-form-input" id="edit-fish-status">
            <option value="active" ${f.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="disabled" ${f.status === 'disabled' ? 'selected' : ''}>Disabled</option>
          </select>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-sm btn-outline" onclick="AppAdmin.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-sm btn-primary">Save Changes</button>
        </div>
      </form>
    `);
  }

  async function submitEditFisherman(id) {
    const data = {
      fullName: document.getElementById('edit-fish-name').value,
      phone: document.getElementById('edit-fish-phone').value,
      homePort: document.getElementById('edit-fish-port').value,
      emergencyContact: document.getElementById('edit-fish-emcontact').value,
      emergencyPhone: document.getElementById('edit-fish-emphone').value,
      status: document.getElementById('edit-fish-status').value
    };

    const res = await AppAPI.admin.updateFisherman(id, data);
    if (!res.success) {
      alert('Error updating: ' + res.error);
      return;
    }
    AppAlerts.showToast('✅ Profile Updated', res.message, 'safe', 3000);
    closeModal();
    searchFishermen();
  }

  async function toggleFishermanStatus(id, newStatus) {
    if (!confirm(`Are you sure you want to mark this account as ${newStatus.toUpperCase()}?`)) return;
    const res = await AppAPI.admin.updateFisherman(id, { status: newStatus });
    if (!res.success) {
      alert('Error: ' + res.error);
      return;
    }
    AppAlerts.showToast('Account Status Updated', `Account is now ${newStatus}.`, 'safe', 3000);
    searchFishermen();
  }

  async function deleteFishermanConfirm(id, fishermanId) {
    if (!confirm(`⚠️ DANGER: Are you sure you want to PERMANENTLY DELETE fisherman account ${fishermanId}?\n\nThis action cannot be undone and will be logged in the administrative audit trail.`)) {
      return;
    }
    const res = await AppAPI.admin.deleteFisherman(id);
    if (!res.success) {
      alert('Delete failed: ' + res.error);
      return;
    }
    AppAlerts.showToast('🗑️ Account Deleted', res.message, 'warn', 3500);
    searchFishermen();
  }

  // ----------------------------------------------------------------
  // 3. BOAT REGISTRY TAB
  // ----------------------------------------------------------------
  async function renderBoats(container, query = '', status = 'all') {
    const res = await AppAPI.admin.getBoats({ query, status });
    if (!res.success) {
      container.innerHTML = `<div class="admin-empty-state"><div class="admin-empty-icon">⚠️</div><div>Error loading boat registry: ${res.error}</div></div>`;
      return;
    }

    const list = res.boats;

    container.innerHTML = `
      <div class="admin-toolbar">
        <div class="admin-search-wrap">
          <span>🔍</span>
          <input type="text" class="admin-search-input" id="boat-search-input"
            placeholder="Search by Boat Reg No, Boat Name, Owner..."
            value="${escapeHtml(query)}"
            onkeydown="if(event.key==='Enter') AppAdmin.searchBoats()" />
        </div>
        <div class="admin-filter-group">
          <select class="admin-select" id="boat-status-filter" onchange="AppAdmin.searchBoats()">
            <option value="all" ${status === 'all' ? 'selected' : ''}>All Statuses</option>
            <option value="verified" ${status === 'verified' ? 'selected' : ''}>Verified Boats</option>
            <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending Verification</option>
            <option value="suspended" ${status === 'suspended' ? 'selected' : ''}>Suspended</option>
          </select>
          <button class="btn btn-sm btn-primary" onclick="AppAdmin.searchBoats()">Filter</button>
        </div>
      </div>

      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Boat Reg No</th>
              <th>Owner Name / ID</th>
              <th>Vessel Name</th>
              <th>Vessel Type</th>
              <th>Home Port</th>
              <th>Status</th>
              <th>Emergency Status</th>
              <th>Last Position</th>
              <th style="text-align:right">Action</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `
              <tr><td colspan="9" style="text-align:center;padding:24px;color:#8892b0">No vessels found matching filter.</td></tr>
            ` : list.map(b => `
              <tr>
                <td style="font-weight:700;color:#64ffda">${escapeHtml(b.boatId)}</td>
                <td>
                  <div style="color:white;font-weight:600">${escapeHtml(b.ownerName || '—')}</div>
                  <div style="font-size:0.68rem;color:#8892b0">${escapeHtml(b.ownerFishermanId || '—')}</div>
                </td>
                <td>${escapeHtml(b.boatName || '—')}</td>
                <td>${escapeHtml(b.boatType || '—')}</td>
                <td>${escapeHtml(b.homePort || '—')}</td>
                <td><span class="badge-status ${b.registrationStatus}">${b.registrationStatus}</span></td>
                <td>
                  <span class="badge-status ${b.emergencyStatus === 'safe' ? 'safe' : 'critical'}">
                    ${b.emergencyStatus.toUpperCase()}
                  </span>
                </td>
                <td style="font-size:0.75rem;font-family:var(--font-condensed)">
                  ${b.lastLocation ? `${b.lastLocation.lat.toFixed(3)}°N, ${b.lastLocation.lon.toFixed(3)}°E` : '—'}
                </td>
                <td style="text-align:right">
                  <button class="table-action-btn" onclick="AppAdmin.editBoatModal('${b.id}')">✏️ Edit</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function searchBoats() {
    const q = document.getElementById('boat-search-input')?.value || '';
    const s = document.getElementById('boat-status-filter')?.value || 'all';
    const container = document.getElementById('admin-tab-content');
    if (container) renderBoats(container, q, s);
  }

  async function editBoatModal(boatId) {
    const res = await AppAPI.admin.getBoats();
    const b = res.boats.find(x => x.id === boatId || x.boatId === boatId);
    if (!b) return;

    showModal(`
      <div class="admin-modal-header">
        <h3 class="admin-modal-title">🚢 Edit Boat: ${escapeHtml(b.boatId)}</h3>
        <button class="admin-modal-close" onclick="AppAdmin.closeModal()">✕</button>
      </div>
      <form onsubmit="event.preventDefault(); AppAdmin.submitEditBoat('${b.id}');">
        <div class="admin-form-group">
          <label class="admin-form-label">Boat Name</label>
          <input type="text" class="admin-form-input" id="edit-boat-name" value="${escapeHtml(b.boatName || '')}" required />
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Boat Type</label>
          <select class="admin-form-input" id="edit-boat-type">
            <option value="Motorized Trawler" ${b.boatType === 'Motorized Trawler' ? 'selected' : ''}>Motorized Trawler</option>
            <option value="Gillnetter" ${b.boatType === 'Gillnetter' ? 'selected' : ''}>Gillnetter</option>
            <option value="Mechanized Fishing Craft" ${b.boatType === 'Mechanized Fishing Craft' ? 'selected' : ''}>Mechanized Fishing Craft</option>
            <option value="Traditional Country Craft" ${b.boatType === 'Traditional Country Craft' ? 'selected' : ''}>Traditional Country Craft</option>
          </select>
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Registration Status</label>
          <select class="admin-form-input" id="edit-boat-status">
            <option value="verified" ${b.registrationStatus === 'verified' ? 'selected' : ''}>Verified / Approved</option>
            <option value="pending" ${b.registrationStatus === 'pending' ? 'selected' : ''}>Pending Approval</option>
            <option value="suspended" ${b.registrationStatus === 'suspended' ? 'selected' : ''}>Suspended</option>
          </select>
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Emergency Status</label>
          <select class="admin-form-input" id="edit-boat-emg">
            <option value="safe" ${b.emergencyStatus === 'safe' ? 'selected' : ''}>Safe</option>
            <option value="alert" ${b.emergencyStatus === 'alert' ? 'selected' : ''}>Alert</option>
            <option value="sos" ${b.emergencyStatus === 'sos' ? 'selected' : ''}>SOS Active</option>
          </select>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-sm btn-outline" onclick="AppAdmin.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-sm btn-primary">Save Boat Record</button>
        </div>
      </form>
    `);
  }

  async function submitEditBoat(id) {
    const data = {
      boatName: document.getElementById('edit-boat-name').value,
      boatType: document.getElementById('edit-boat-type').value,
      registrationStatus: document.getElementById('edit-boat-status').value,
      emergencyStatus: document.getElementById('edit-boat-emg').value
    };

    const res = await AppAPI.admin.updateBoat(id, data);
    if (!res.success) {
      alert('Error updating boat: ' + res.error);
      return;
    }
    AppAlerts.showToast('Boat Updated', res.message, 'safe', 3000);
    closeModal();
    searchBoats();
  }

  // ----------------------------------------------------------------
  // 4. BOUNDARY ALERTS TAB
  // ----------------------------------------------------------------
  async function renderAlerts(container, status = 'all') {
    const res = await AppAPI.admin.getAlerts({ status });
    if (!res.success) {
      container.innerHTML = `<div class="admin-empty-state"><div class="admin-empty-icon">⚠️</div><div>Error: ${res.error}</div></div>`;
      return;
    }

    const list = res.alerts;

    container.innerHTML = `
      <div class="authoritative-boundary-banner">
        <span>🚨</span>
        <div>
          <strong>Maritime Boundary Surveillance & Safety Zone Alert Engine:</strong>
          All coordinates are checked against UNCLOS 1974 & 1976 bilateral treaty line in the Palk Strait and Gulf of Mannar.
          Alert classifications: <em>50km (Early Warning)</em>, <em>20km (Strong Warning)</em>, <em>5km (Critical Boundary Proximity)</em>.
        </div>
      </div>

      <div class="admin-toolbar">
        <div style="font-weight:700">Safety Alerts Log (${list.length})</div>
        <div class="admin-filter-group">
          <select class="admin-select" id="alert-status-filter" onchange="AppAdmin.filterAlerts(this.value)">
            <option value="all" ${status === 'all' ? 'selected' : ''}>All Alert Statuses</option>
            <option value="warning" ${status === 'warning' ? 'selected' : ''}>Warnings</option>
            <option value="critical" ${status === 'critical' ? 'selected' : ''}>Critical</option>
            <option value="resolved" ${status === 'resolved' ? 'selected' : ''}>Resolved</option>
          </select>
        </div>
      </div>

      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Alert ID</th>
              <th>Vessel / Fisherman</th>
              <th>Alert Severity</th>
              <th>Distance to IMBL</th>
              <th>Status</th>
              <th>Coordinates</th>
              <th>Timestamp</th>
              <th>Acknowledged</th>
              <th style="text-align:right">Action</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `
              <tr><td colspan="9" style="text-align:center;padding:24px;color:#8892b0">No boundary alerts recorded.</td></tr>
            ` : list.map(a => `
              <tr>
                <td style="font-weight:700;color:#64ffda">${escapeHtml(a.alertId)}</td>
                <td>
                  <div style="color:white;font-weight:600">${escapeHtml(a.boatId)}</div>
                  <div style="font-size:0.68rem;color:#8892b0">${escapeHtml(a.fishermanId)}</div>
                </td>
                <td>
                  <span class="badge-status ${a.alertType.includes('critical') ? 'critical' : 'warning'}">
                    ${a.alertType.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td style="font-weight:700;font-family:var(--font-condensed)">
                  ${a.distanceKm.toFixed(1)} km
                </td>
                <td><span class="badge-status ${a.alertStatus.toLowerCase()}">${a.alertStatus}</span></td>
                <td style="font-size:0.75rem;font-family:var(--font-condensed)">
                  ${a.location ? `${a.location.lat.toFixed(3)}°N, ${a.location.lon.toFixed(3)}°E` : '—'}
                </td>
                <td style="font-size:0.72rem;color:#8892b0">
                  ${new Date(a.timestamp).toLocaleString('en-IN')}
                </td>
                <td>
                  ${a.acknowledged
                    ? `<span style="color:#4caf50;font-size:0.72rem">✅ By ${escapeHtml(a.acknowledgedBy || 'HQ')}</span>`
                    : `<span style="color:#ffa726;font-size:0.72rem">⏳ Pending</span>`
                  }
                </td>
                <td style="text-align:right">
                  ${a.alertStatus !== 'Resolved' ? `
                    <button class="table-action-btn" onclick="AppAdmin.acknowledgeAlertModal('${a.id}')">Resolve</button>
                  ` : `<span style="color:#8892b0;font-size:0.7rem">Completed</span>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function filterAlerts(status) {
    const container = document.getElementById('admin-tab-content');
    if (container) renderAlerts(container, status);
  }

  function acknowledgeAlertModal(alertId) {
    showModal(`
      <div class="admin-modal-header">
        <h3 class="admin-modal-title">🚨 Resolve Maritime Boundary Alert</h3>
        <button class="admin-modal-close" onclick="AppAdmin.closeModal()">✕</button>
      </div>
      <form onsubmit="event.preventDefault(); AppAdmin.submitAlertResolution('${alertId}');">
        <div class="admin-form-group">
          <label class="admin-form-label">Resolution Status</label>
          <select class="admin-form-input" id="alert-res-status">
            <option value="Resolved">Resolved — Vessel Returned to Safe Waters</option>
            <option value="Warning">Acknowledged — Active Monitoring</option>
          </select>
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Administrative Action Notes</label>
          <textarea class="admin-form-input" id="alert-res-notes" rows="3" placeholder="Enter Coast Guard VHF broadcast log or interception details..." required></textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-sm btn-outline" onclick="AppAdmin.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-sm btn-primary">Submit Action</button>
        </div>
      </form>
    `);
  }

  async function submitAlertResolution(alertId) {
    const status = document.getElementById('alert-res-status').value;
    const notes = document.getElementById('alert-res-notes').value;
    const res = await AppAPI.admin.updateAlertStatus(alertId, status, notes);
    if (!res.success) {
      alert('Error updating alert: ' + res.error);
      return;
    }
    AppAlerts.showToast('Alert Updated', res.message, 'safe', 3000);
    closeModal();
    filterAlerts('all');
  }

  // ----------------------------------------------------------------
  // 5. EMERGENCY / SOS TAB
  // ----------------------------------------------------------------
  async function renderEmergencies(container, status = 'all') {
    const res = await AppAPI.admin.getEmergencies({ status });
    if (!res.success) {
      container.innerHTML = `<div class="admin-empty-state"><div class="admin-empty-icon">⚠️</div><div>Error: ${res.error}</div></div>`;
      return;
    }

    const list = res.emergencies;

    container.innerHTML = `
      <div style="background:rgba(183, 28, 28, 0.15);border:1px solid rgba(229, 57, 53, 0.4);border-left:4px solid #ef5350;border-radius:var(--r-md);padding:10px 14px;font-size:0.78rem;color:#ffcdd2;display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong>🚨 Coast Guard Distress Surveillance:</strong>
          Direct coordination with Maritime Rescue Coordination Centre (MRCC) Chennai / Tuticorin.
        </div>
        <div>
          <a href="tel:1554" class="btn btn-sm btn-danger" style="font-size:0.72rem;padding:4px 10px;text-decoration:none">📞 Call CG 1554</a>
        </div>
      </div>

      <div class="admin-toolbar">
        <div style="font-weight:700">Distress Beacons (${list.length})</div>
        <div class="admin-filter-group">
          <select class="admin-select" id="emg-status-filter" onchange="AppAdmin.filterEmergencies(this.value)">
            <option value="all" ${status === 'all' ? 'selected' : ''}>All Emergencies</option>
            <option value="active" ${status === 'active' ? 'selected' : ''}>Active Distresses</option>
            <option value="acknowledged" ${status === 'acknowledged' ? 'selected' : ''}>Acknowledged</option>
            <option value="resolved" ${status === 'resolved' ? 'selected' : ''}>Resolved</option>
          </select>
        </div>
      </div>

      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Emergency ID</th>
              <th>Vessel / Owner</th>
              <th>Signal Type</th>
              <th>Coordinates</th>
              <th>Timestamp</th>
              <th>Status</th>
              <th>Notes / Action</th>
              <th style="text-align:right">Action</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `
              <tr><td colspan="8" style="text-align:center;padding:24px;color:#8892b0">No distress signals reported.</td></tr>
            ` : list.map(e => `
              <tr>
                <td style="font-weight:700;color:#ff5252">${escapeHtml(e.emergencyId)}</td>
                <td>
                  <div style="font-weight:700;color:white">${escapeHtml(e.boatId)}</div>
                  <div style="font-size:0.68rem;color:#8892b0">${escapeHtml(e.fishermanId)}</div>
                </td>
                <td>
                  <span class="badge-status critical" style="letter-spacing:1px">${escapeHtml(e.emergencyType)}</span>
                </td>
                <td style="font-size:0.75rem;font-family:var(--font-condensed)">
                  ${e.coords ? `${e.coords.lat.toFixed(4)}°N, ${e.coords.lon.toFixed(4)}°E` : '—'}
                </td>
                <td style="font-size:0.72rem;color:#8892b0">
                  ${new Date(e.timestamp).toLocaleString('en-IN')}
                </td>
                <td>
                  <span class="badge-status ${e.status.toLowerCase()}">${e.status}</span>
                </td>
                <td style="font-size:0.72rem;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(e.adminNotes || '')}">
                  ${escapeHtml(e.adminNotes || 'No notes')}
                </td>
                <td style="text-align:right">
                  ${e.status !== 'Resolved' ? `
                    <button class="table-action-btn danger" onclick="AppAdmin.respondEmergencyModal('${e.id}')">⚡ Respond</button>
                  ` : `<span style="color:#4caf50;font-size:0.72rem">Resolved</span>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function filterEmergencies(status) {
    const container = document.getElementById('admin-tab-content');
    if (container) renderEmergencies(container, status);
  }

  function respondEmergencyModal(id) {
    showModal(`
      <div class="admin-modal-header">
        <h3 class="admin-modal-title">🆘 Respond to Vessel Distress</h3>
        <button class="admin-modal-close" onclick="AppAdmin.closeModal()">✕</button>
      </div>
      <form onsubmit="event.preventDefault(); AppAdmin.submitEmergencyResponse('${id}');">
        <div class="admin-form-group">
          <label class="admin-form-label">Response Action Status</label>
          <select class="admin-form-input" id="emg-res-status">
            <option value="Acknowledged">Acknowledged — Interceptor Dispatched</option>
            <option value="Resolved">Resolved — Vessel Rescued / Returned</option>
          </select>
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Administrative Action Log</label>
          <textarea class="admin-form-input" id="emg-res-notes" rows="4" placeholder="Detail rescue boat dispatched, VHF confirmation, Coast Guard call time..." required></textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-sm btn-outline" onclick="AppAdmin.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-sm btn-danger">Record Response</button>
        </div>
      </form>
    `);
  }

  async function submitEmergencyResponse(id) {
    const status = document.getElementById('emg-res-status').value;
    const adminNotes = document.getElementById('emg-res-notes').value;
    const res = await AppAPI.admin.updateEmergency(id, status, adminNotes);
    if (!res.success) {
      alert('Error updating emergency: ' + res.error);
      return;
    }
    AppAlerts.showToast('Emergency Action Recorded', res.message, 'safe', 3000);
    closeModal();
    filterEmergencies('all');
  }

  // ----------------------------------------------------------------
  // 6. ADMIN ACCOUNTS TAB
  // ----------------------------------------------------------------
  async function renderAdmins(container) {
    const res = await AppAPI.admin.getAdmins();
    if (!res.success) {
      container.innerHTML = `<div class="admin-empty-state"><div class="admin-empty-icon">⚠️</div><div>Error: ${res.error}</div></div>`;
      return;
    }

    const admins = res.admins;
    const current = AppAuth.getCurrentUser();

    container.innerHTML = `
      <div class="admin-toolbar">
        <div>
          <div style="font-weight:700">Authorized Maritime Administrators</div>
          <div style="font-size:0.7rem;color:#8892b0">Admin accounts can only be provisioned by authorized administrators</div>
        </div>
        <button class="btn btn-sm btn-primary" onclick="AppAdmin.addNewAdminModal()">➕ Provision New Administrator</button>
      </div>

      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Admin ID</th>
              <th>Officer Name</th>
              <th>Official Email</th>
              <th>Mobile</th>
              <th>Permissions</th>
              <th>Status</th>
              <th>Created Date</th>
              <th style="text-align:right">Action</th>
            </tr>
          </thead>
          <tbody>
            ${admins.map(a => `
              <tr>
                <td style="font-weight:700;color:#64ffda">${escapeHtml(a.fishermanId)}</td>
                <td style="font-weight:600;color:white">${escapeHtml(a.fullName)}</td>
                <td>${escapeHtml(a.email || '—')}</td>
                <td>${escapeHtml(a.phone)}</td>
                <td><span style="font-size:0.72rem;color:#8892b0">${escapeHtml(a.permissions || 'FULL_ADMIN')}</span></td>
                <td><span class="badge-status ${a.status}">${a.status}</span></td>
                <td style="font-size:0.72rem;color:#8892b0">${new Date(a.createdAt).toLocaleDateString('en-IN')}</td>
                <td style="text-align:right">
                  ${a.id === current.id ? `
                    <span style="font-size:0.7rem;color:#64ffda">(You)</span>
                  ` : `
                    <button class="table-action-btn ${a.status === 'active' ? 'danger' : ''}"
                      onclick="AppAdmin.toggleAdminStatus('${a.id}', '${a.status === 'active' ? 'disabled' : 'active'}')">
                      ${a.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function addNewAdminModal() {
    showModal(`
      <div class="admin-modal-header">
        <h3 class="admin-modal-title">🛡️ Provision New Maritime Administrator</h3>
        <button class="admin-modal-close" onclick="AppAdmin.closeModal()">✕</button>
      </div>
      <form onsubmit="event.preventDefault(); AppAdmin.submitNewAdmin();">
        <div class="admin-form-group">
          <label class="admin-form-label">Full Name of Officer</label>
          <input type="text" class="admin-form-input" id="new-admin-name" placeholder="e.g. Inspector R. Sundaram" required />
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Official Admin ID / Username</label>
          <input type="text" class="admin-form-input" id="new-admin-id" placeholder="e.g. ADMIN002" required />
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Official Email</label>
          <input type="email" class="admin-form-input" id="new-admin-email" placeholder="officer@fishersafe.gov.in" required />
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Official Mobile Phone</label>
          <input type="tel" class="admin-form-input" id="new-admin-phone" placeholder="10-digit mobile" maxlength="10" required />
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Temporary Secure Password (min 8 chars)</label>
          <input type="password" class="admin-form-input" id="new-admin-pass" placeholder="At least 8 characters" required />
        </div>
        <div style="font-size:0.68rem;color:#8892b0;margin-bottom:12px">
          🔒 Public registration is strictly disabled for Admin accounts. This action will be audited.
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-sm btn-outline" onclick="AppAdmin.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-sm btn-primary">Create Administrator</button>
        </div>
      </form>
    `);
  }

  async function submitNewAdmin() {
    const data = {
      fullName: document.getElementById('new-admin-name').value,
      adminId: document.getElementById('new-admin-id').value,
      email: document.getElementById('new-admin-email').value,
      phone: document.getElementById('new-admin-phone').value,
      password: document.getElementById('new-admin-pass').value
    };

    const res = await AppAPI.admin.createAdmin(data);
    if (!res.success) {
      alert('Error: ' + res.error);
      return;
    }
    AppAlerts.showToast('✅ Admin Created', res.message, 'safe', 3500);
    closeModal();
    renderAdmins(document.getElementById('admin-tab-content'));
  }

  async function toggleAdminStatus(id, status) {
    if (!confirm(`Are you sure you want to change this administrator account status to ${status.toUpperCase()}?`)) return;
    const res = await AppAPI.admin.updateAdminStatus(id, status);
    if (!res.success) {
      alert('Error: ' + res.error);
      return;
    }
    AppAlerts.showToast('Status Updated', res.message, 'safe', 3000);
    renderAdmins(document.getElementById('admin-tab-content'));
  }

  // ----------------------------------------------------------------
  // 7. AUDIT LOG TAB
  // ----------------------------------------------------------------
  async function renderAudit(container) {
    const res = await AppAPI.admin.getAuditLogs();
    if (!res.success) {
      container.innerHTML = `<div class="admin-empty-state"><div class="admin-empty-icon">⚠️</div><div>Error: ${res.error}</div></div>`;
      return;
    }

    const logs = res.logs;

    container.innerHTML = `
      <div class="admin-toolbar">
        <div>
          <div style="font-weight:700">Administrative Action Audit Trail</div>
          <div style="font-size:0.7rem;color:#8892b0">Tamper-evident operational record of administrative commands and security events</div>
        </div>
      </div>

      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Operator ID</th>
              <th>Action Code</th>
              <th>Target Type</th>
              <th>Target Identifier</th>
              <th>Details & Notes</th>
              <th>Client IP</th>
            </tr>
          </thead>
          <tbody>
            ${logs.length === 0 ? `
              <tr><td colspan="7" style="text-align:center;padding:24px;color:#8892b0">No audit records logged.</td></tr>
            ` : logs.map(l => `
              <tr>
                <td style="font-size:0.72rem;color:#8892b0;white-space:nowrap">${new Date(l.timestamp).toLocaleString('en-IN')}</td>
                <td style="font-weight:700;color:#64ffda">${escapeHtml(l.adminId)}</td>
                <td><span class="badge-status" style="background:rgba(21,101,192,0.2);color:#90caf9">${escapeHtml(l.action)}</span></td>
                <td>${escapeHtml(l.targetType)}</td>
                <td style="font-weight:600;color:white">${escapeHtml(l.targetId)}</td>
                <td style="font-size:0.75rem;color:#ccd6f6">${escapeHtml(l.details)}</td>
                <td style="font-size:0.7rem;color:#8892b0">${escapeHtml(l.ipAddress || '127.0.0.1')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ----------------------------------------------------------------
  // 8. REPORTS & ANALYTICS TAB
  // ----------------------------------------------------------------
  async function renderAnalytics(container) {
    const res = await AppAPI.admin.getAnalytics();
    if (!res.success) {
      container.innerHTML = `<div class="admin-empty-state"><div class="admin-empty-icon">⚠️</div><div>Error: ${res.error}</div></div>`;
      return;
    }

    const a = res.analytics;

    container.innerHTML = `
      <div class="analytics-grid">
        <!-- Port distribution card -->
        <div class="analytics-card">
          <div class="analytics-card-title">⚓ Fleet Distribution by Home Port</div>
          ${Object.entries(a.portDistribution).map(([port, count]) => {
            const pct = Math.round((count / (a.totalFishermen || 1)) * 100);
            return `
              <div class="progress-bar-row">
                <div class="progress-bar-label">
                  <span>${escapeHtml(port)}</span>
                  <span><strong>${count}</strong> vessels (${pct}%)</span>
                </div>
                <div class="progress-bar-track">
                  <div class="progress-bar-fill" style="width:${pct}%;background:#1565C0"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Alert Breakdown -->
        <div class="analytics-card">
          <div class="analytics-card-title">🚨 Boundary Alert Severity Breakdown</div>
          <div class="progress-bar-row">
            <div class="progress-bar-label">
              <span>Early Warning (50 km buffer)</span>
              <span><strong>${a.alertTypeCounts.warning_early}</strong></span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width:${_pct(a.alertTypeCounts.warning_early, a.totalAlerts)}%;background:#4caf50"></div>
            </div>
          </div>

          <div class="progress-bar-row">
            <div class="progress-bar-label">
              <span>Strong Warning (20 km buffer)</span>
              <span><strong>${a.alertTypeCounts.warning_strong}</strong></span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width:${_pct(a.alertTypeCounts.warning_strong, a.totalAlerts)}%;background:#ffa726"></div>
            </div>
          </div>

          <div class="progress-bar-row">
            <div class="progress-bar-label">
              <span>Critical Proximity (&lt; 5 km from IMBL)</span>
              <span><strong>${a.alertTypeCounts.critical_boundary}</strong></span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width:${_pct(a.alertTypeCounts.critical_boundary, a.totalAlerts)}%;background:#ef5350"></div>
            </div>
          </div>

          <div class="progress-bar-row">
            <div class="progress-bar-label">
              <span>IMBL Crossed</span>
              <span><strong>${a.alertTypeCounts.crossed_boundary}</strong></span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width:${_pct(a.alertTypeCounts.crossed_boundary, a.totalAlerts)}%;background:#b71c1c"></div>
            </div>
          </div>
        </div>

        <!-- Vessel Categories -->
        <div class="analytics-card">
          <div class="analytics-card-title">🚢 Vessel Fleet Categories</div>
          ${Object.entries(a.boatTypeCounts).map(([type, count]) => {
            const pct = _pct(count, a.totalBoats);
            return `
              <div class="progress-bar-row">
                <div class="progress-bar-label">
                  <span>${escapeHtml(type)}</span>
                  <span><strong>${count}</strong> boats</span>
                </div>
                <div class="progress-bar-track">
                  <div class="progress-bar-fill" style="width:${pct}%;background:#64ffda"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Emergency Response Tracking -->
        <div class="analytics-card">
          <div class="analytics-card-title">🆘 Distress Signal Tracking</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:center;margin-top:10px">
            <div style="background:#020c1b;padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1)">
              <div style="font-size:1.6rem;font-weight:900;color:#ef5350">${a.emergencyTypes.MAYDAY}</div>
              <div style="font-size:0.72rem;color:#8892b0">MAYDAY Distresses</div>
            </div>
            <div style="background:#020c1b;padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1)">
              <div style="font-size:1.6rem;font-weight:900;color:#ffa726">${a.emergencyTypes.PANPAN}</div>
              <div style="font-size:0.72rem;color:#8892b0">PAN-PAN Urgencies</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function _pct(count, total) {
    if (!total || total === 0) return 0;
    return Math.round((count / total) * 100);
  }

  // --- Modal Helpers ---
  function showModal(contentHtml) {
    const container = document.getElementById('admin-modal-container') || document.body;
    let modal = document.getElementById('admin-generic-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'admin-modal-backdrop';
      modal.id = 'admin-generic-modal';
      container.appendChild(modal);
    }
    modal.innerHTML = `<div class="admin-modal-box">${contentHtml}</div>`;
  }

  function closeModal() {
    const modal = document.getElementById('admin-generic-modal');
    if (modal) modal.remove();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    renderAdminLayout,
    switchTab,
    refreshCurrentTab,
    toggleSidebar,
    searchFishermen,
    viewFishermanModal,
    editFishermanModal,
    submitEditFisherman,
    toggleFishermanStatus,
    deleteFishermanConfirm,
    searchBoats,
    editBoatModal,
    submitEditBoat,
    filterAlerts,
    acknowledgeAlertModal,
    submitAlertResolution,
    filterEmergencies,
    respondEmergencyModal,
    submitEmergencyResponse,
    addNewAdminModal,
    submitNewAdmin,
    toggleAdminStatus,
    closeModal
  };
})();
