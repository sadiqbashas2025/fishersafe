/* ============================================================
   FisherSafe — Offline Storage (localStorage + IndexedDB)
   ============================================================ */

const AppStorage = (() => {
  const DB_NAME = 'fishersafe_db';
  const DB_VERSION = 1;
  let db = null;

  // --- IndexedDB init ---
  function initDB() {
    return new Promise((resolve, reject) => {
      if (db) { resolve(db); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('messages'))
          d.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        if (!d.objectStoreNames.contains('waypoints'))
          d.createObjectStore('waypoints', { keyPath: 'id', autoIncrement: true });
        if (!d.objectStoreNames.contains('trips'))
          d.createObjectStore('trips', { keyPath: 'id', autoIncrement: true });
        if (!d.objectStoreNames.contains('alerts'))
          d.createObjectStore('alerts', { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror = e => reject(e.target.error);
    });
  }

  function dbPut(store, obj) {
    return initDB().then(d => new Promise((res, rej) => {
      const tx = d.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(obj);
      req.onsuccess = () => res(req.result);
      req.onerror = e => rej(e.target.error);
    }));
  }

  function dbGetAll(store) {
    return initDB().then(d => new Promise((res, rej) => {
      const tx = d.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = e => rej(e.target.error);
    }));
  }

  function dbDelete(store, id) {
    return initDB().then(d => new Promise((res, rej) => {
      const tx = d.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(id);
      req.onsuccess = () => res();
      req.onerror = e => rej(e.target.error);
    }));
  }

  // --- Profile (localStorage) ---
  function saveProfile(profile) {
    localStorage.setItem('fishersafe_profile', JSON.stringify(profile));
  }

  function loadProfile() {
    try {
      return JSON.parse(localStorage.getItem('fishersafe_profile')) || null;
    } catch { return null; }
  }

  function clearProfile() {
    localStorage.removeItem('fishersafe_profile');
  }

  // --- Settings (localStorage) ---
  function saveSetting(key, value) {
    localStorage.setItem('fishersafe_' + key, JSON.stringify(value));
  }

  function loadSetting(key, defaultVal = null) {
    try {
      const val = localStorage.getItem('fishersafe_' + key);
      return val !== null ? JSON.parse(val) : defaultVal;
    } catch { return defaultVal; }
  }

  // --- Messages ---
  function saveMessage(msg) {
    return dbPut('messages', { ...msg, savedAt: Date.now() });
  }

  function loadMessages() {
    return dbGetAll('messages');
  }

  // --- Waypoints ---
  function saveWaypoint(wp) {
    return dbPut('waypoints', { ...wp, savedAt: Date.now() });
  }

  function loadWaypoints() {
    return dbGetAll('waypoints');
  }

  function deleteWaypoint(id) {
    return dbDelete('waypoints', id);
  }

  // --- Trips ---
  function saveTripPoint(point) {
    return dbPut('trips', point);
  }

  function loadTrips() {
    return dbGetAll('trips');
  }

  // --- Alert history ---
  function saveAlert(alert) {
    return dbPut('alerts', { ...alert, timestamp: Date.now() });
  }

  function loadAlerts() {
    return dbGetAll('alerts');
  }

  // --- Checklist ---
  function saveChecklist(items) {
    localStorage.setItem('fishersafe_checklist', JSON.stringify(items));
  }

  function loadChecklist() {
    try {
      return JSON.parse(localStorage.getItem('fishersafe_checklist')) || null;
    } catch { return null; }
  }

  return {
    initDB,
    saveProfile, loadProfile, clearProfile,
    saveSetting, loadSetting,
    saveMessage, loadMessages,
    saveWaypoint, loadWaypoints, deleteWaypoint,
    saveTripPoint, loadTrips,
    saveAlert, loadAlerts,
    saveChecklist, loadChecklist
  };
})();
