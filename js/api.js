/**
 * FisherSafe — Client API & Authentication Manager
 * Handles JWT token storage, authenticated requests, role verification, and offline sync.
 */

const AppAuth = (() => {
  const TOKEN_KEY = 'fishersafe_jwt_token';
  const USER_KEY = 'fishersafe_auth_user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || null;
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function getCurrentUser() {
    try {
      const u = localStorage.getItem(USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }

  function setCurrentUser(user) {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function isAuthenticated() {
    return !!getToken() && !!getCurrentUser();
  }

  function isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
  }

  function isOnline() {
    return navigator.onLine !== false;
  }

  /**
   * Login with identifier (ID / Phone / Email) and password
   */
  async function login(identifier, password) {
    if (!isOnline()) {
      return {
        success: false,
        error: 'Network unavailable. Live authentication requires an active network connection. Note: Offline cached mode is available for previously logged-in vessel captains.'
      };
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Authentication failed. Please check credentials.'
        };
      }

      setToken(data.token);
      setCurrentUser(data.user);

      // Sync user profile with legacy AppStorage for offline navigation continuity
      if (typeof AppStorage !== 'undefined') {
        AppStorage.saveProfile({
          boatId: data.user.boatId,
          fishermanName: data.user.fullName,
          fishermanId: data.user.fishermanId,
          phone: data.user.phone,
          homePort: data.user.homePort,
          emergencyContact: data.user.emergencyContact,
          emergencyPhone: data.user.emergencyPhone,
          role: data.user.role,
          registeredAt: data.user.createdAt
        });
      }

      return {
        success: true,
        user: data.user,
        message: data.message
      };
    } catch (err) {
      console.error('Login network error:', err);
      return {
        success: false,
        error: 'Unable to connect to maritime authentication server. Please check internet connection.'
      };
    }
  }

  /**
   * Register a new fisherman vessel
   */
  async function register(formData) {
    if (!isOnline()) {
      return {
        success: false,
        error: 'Internet connection required to verify and register new vessel with Maritime Department.'
      };
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Registration failed. Please check provided data.'
        };
      }

      // If server returned token & user
      if (data.token && data.user) {
        setToken(data.token);
        setCurrentUser(data.user);
        if (typeof AppStorage !== 'undefined') {
          AppStorage.saveProfile({
            boatId: data.user.boatId,
            fishermanName: data.user.fullName,
            fishermanId: data.user.fishermanId,
            phone: data.user.phone,
            homePort: data.user.homePort,
            emergencyContact: data.user.emergencyContact,
            emergencyPhone: data.user.emergencyPhone,
            role: data.user.role,
            registeredAt: data.user.createdAt
          });
        }
      }

      return {
        success: true,
        user: data.user,
        message: data.message
      };
    } catch (err) {
      console.error('Registration network error:', err);
      return {
        success: false,
        error: 'Network error communicating with registration server.'
      };
    }
  }

  /**
   * Logout user
   */
  async function logout() {
    const token = getToken();
    if (token && isOnline()) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {}
    }
    clearSession();
  }

  return {
    getToken,
    getCurrentUser,
    setCurrentUser,
    isAuthenticated,
    isAdmin,
    isOnline,
    login,
    register,
    logout,
    clearSession
  };
})();

/**
 * FisherSafe — HTTP API Client
 */
const AppAPI = (() => {
  async function request(endpoint, options = {}) {
    const token = AppAuth.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      // Handle session expiration
      if (response.status === 401) {
        const resJson = await response.json().catch(() => ({}));
        if (resJson.code === 'TOKEN_EXPIRED' || !AppAuth.getToken()) {
          AppAuth.clearSession();
          if (typeof AppAlerts !== 'undefined') {
            AppAlerts.showToast('🔒 Session Expired', 'Please login again to continue.', 'warn', 4000);
          }
          if (typeof App !== 'undefined' && App.navigate) {
            App.navigate('login');
          }
        }
        return { success: false, status: 401, error: resJson.error || 'Authentication required' };
      }

      // Handle forbidden admin access
      if (response.status === 403) {
        const resJson = await response.json().catch(() => ({}));
        if (typeof AppAlerts !== 'undefined') {
          AppAlerts.showToast('⛔ Access Denied', resJson.error || 'You are not authorized to perform this action.', 'danger', 4000);
        }
        return { success: false, status: 403, error: resJson.error || 'Forbidden' };
      }

      const data = await response.json();
      return { success: response.ok, status: response.status, ...data };
    } catch (err) {
      console.warn('API request offline/failed:', endpoint, err);
      return {
        success: false,
        status: 0,
        offline: true,
        error: 'Network request failed. Operating in offline mode.'
      };
    }
  }

  // --- Admin Endpoints ---
  const admin = {
    getStats: () => request('/api/admin/stats'),
    getFishermen: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/api/admin/fishermen?${query}`);
    },
    getFisherman: (id) => request(`/api/admin/fishermen/${id}`),
    updateFisherman: (id, data) => request(`/api/admin/fishermen/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteFisherman: (id) => request(`/api/admin/fishermen/${id}`, { method: 'DELETE' }),

    getBoats: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/api/admin/boats?${query}`);
    },
    updateBoat: (id, data) => request(`/api/admin/boats/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    getAlerts: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/api/admin/alerts?${query}`);
    },
    updateAlertStatus: (id, status, notes = '') =>
      request(`/api/admin/alerts/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, notes }) }),

    getEmergencies: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/api/admin/emergencies?${query}`);
    },
    updateEmergency: (id, status, adminNotes = '') =>
      request(`/api/admin/emergencies/${id}`, { method: 'PUT', body: JSON.stringify({ status, adminNotes }) }),

    getAdmins: () => request('/api/admin/admins'),
    createAdmin: (data) => request('/api/admin/admins', { method: 'POST', body: JSON.stringify(data) }),
    updateAdminStatus: (id, status) =>
      request(`/api/admin/admins/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

    getAuditLogs: () => request('/api/admin/audit-logs'),
    getAnalytics: () => request('/api/admin/analytics')
  };

  // --- Fisherman Endpoints ---
  const fisherman = {
    reportLocation: (lat, lon) => request('/api/fisherman/location', { method: 'POST', body: JSON.stringify({ lat, lon }) }),
    logAlert: (alertData) => request('/api/fisherman/alert', { method: 'POST', body: JSON.stringify(alertData) }),
    triggerSOS: (sosData) => request('/api/fisherman/sos', { method: 'POST', body: JSON.stringify(sosData) }),
    getMyAlerts: () => request('/api/fisherman/my-alerts'),
    syncOfflineQueue: (queueData) => request('/api/fisherman/sync', { method: 'POST', body: JSON.stringify(queueData) })
  };

  // --- Offline Synchronization Manager ---
  let offlineSyncQueue = [];

  function queueOfflineAlert(alert) {
    offlineSyncQueue.push(alert);
    try {
      localStorage.setItem('fishersafe_offline_queue', JSON.stringify(offlineSyncQueue));
    } catch {}
    updateSyncBadge();
  }

  function getOfflineQueue() {
    try {
      const q = localStorage.getItem('fishersafe_offline_queue');
      return q ? JSON.parse(q) : [];
    } catch {
      return [];
    }
  }

  async function syncQueue() {
    const queue = getOfflineQueue();
    if (!queue.length || !AppAuth.isOnline() || !AppAuth.isAuthenticated()) return;

    try {
      const res = await fisherman.syncOfflineQueue({ alerts: queue });
      if (res.success) {
        offlineSyncQueue = [];
        localStorage.removeItem('fishersafe_offline_queue');
        updateSyncBadge();
        if (typeof AppAlerts !== 'undefined') {
          AppAlerts.showToast('🔄 Server Synced', `${res.syncedCount || queue.length} offline record(s) synced with Coast Guard.`, 'safe', 3500);
        }
      }
    } catch (e) {
      console.warn('Sync failed, will retry later:', e);
    }
  }

  function updateSyncBadge() {
    const el = document.getElementById('offline-sync-badge');
    const q = getOfflineQueue();
    if (el) {
      if (q.length > 0) {
        el.textContent = `⏳ ${q.length} unsynced`;
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  }

  // Listen to network status changes
  window.addEventListener('online', () => {
    console.log('App is online. Triggering sync...');
    const banner = document.getElementById('network-status-indicator');
    if (banner) {
      banner.className = 'network-indicator online';
      banner.innerHTML = '🟢 Online · Connected to Maritime Surveillance Server';
      setTimeout(() => banner.classList.add('hidden'), 3000);
    }
    syncQueue();
  });

  window.addEventListener('offline', () => {
    console.log('App is offline.');
    const banner = document.getElementById('network-status-indicator');
    if (banner) {
      banner.className = 'network-indicator offline';
      banner.innerHTML = '⚠️ Offline Mode · Local GPS & Offline Chart Active. Server sync queued.';
      banner.classList.remove('hidden');
    }
  });

  return {
    request,
    admin,
    fisherman,
    queueOfflineAlert,
    getOfflineQueue,
    syncQueue,
    updateSyncBadge
  };
})();
