/* ============================================================
   FisherSafe — GNSS/GPS Engine
   Real device GNSS via browser Geolocation API.
   Optional native bridge can provide true satellite metadata.
   IMPORTANT: Browser JS cannot directly open a satellite link.
   ============================================================ */

const AppGPS = (() => {
  let watchId = null;
  let simInterval = null;
  let isSimulating = false;
  let positionHistory = [];
  const listeners = [];

  let simLat = 9.2876;
  let simLon = 79.3129;
  let simHeading = 90;

  const MAX_HISTORY = 300;

  const state = {
    lat: null, lon: null, accuracy: null, heading: null, speed: null,
    altitude: null, timestamp: null,
    fixType: 'searching',
    satelliteCount: null,
    gnssSource: 'device-geolocation',
    isSimulated: false,
  };

  function onUpdate(cb) { if (typeof cb === 'function') listeners.push(cb); }
  function _notify() { listeners.forEach(cb => { try { cb({ ...state }); } catch (_) {} }); }

  // Optional Android/WebView bridge:
  // Native code may call window.FisherSafeGNSS.update({...}) with
  // satelliteCount, usedSystems, hdop, vdop, fixQuality, etc.
  function attachNativeGNSSBridge() {
    const bridge = window.FisherSafeGNSS;
    if (!bridge || typeof bridge !== 'object') return false;
    try {
      if (typeof bridge.getLastFix === 'function') {
        const meta = bridge.getLastFix();
        if (meta) applyGNSSMetadata(meta);
      }
      return true;
    } catch (_) { return false; }
  }

  function applyGNSSMetadata(meta) {
    if (!meta || typeof meta !== 'object') return;
    if (Number.isFinite(meta.satelliteCount)) state.satelliteCount = meta.satelliteCount;
    if (meta.gnssSource) state.gnssSource = String(meta.gnssSource);
    if (meta.fixType) state.fixType = String(meta.fixType);
    state.hdop = Number.isFinite(meta.hdop) ? meta.hdop : state.hdop;
    state.vdop = Number.isFinite(meta.vdop) ? meta.vdop : state.vdop;
    state.usedSystems = Array.isArray(meta.usedSystems) ? [...meta.usedSystems] : state.usedSystems;
    _notify();
  }

  // Expose a safe hook for a native Android WebView bridge.
  window.FisherSafeGNSSReceiver = applyGNSSMetadata;

  function classifyAccuracy(accuracy) {
    if (!Number.isFinite(accuracy)) return 'searching';
    if (accuracy <= 5) return 'excellent';
    if (accuracy <= 15) return 'good';
    if (accuracy <= 50) return 'approximate';
    return 'poor';
  }

  function startRealGPS() {
    if (!navigator.geolocation) {
      startSimulation();
      return;
    }
    stopSimulation();

    watchId = navigator.geolocation.watchPosition(
      pos => {
        const c = pos.coords;
        state.lat = Number(c.latitude);
        state.lon = Number(c.longitude);
        state.accuracy = Number.isFinite(c.accuracy) ? c.accuracy : null;
        state.heading = Number.isFinite(c.heading) ? c.heading : null;
        state.speed = Number.isFinite(c.speed) ? c.speed : null;
        state.altitude = Number.isFinite(c.altitude) ? c.altitude : null;
        state.timestamp = pos.timestamp || Date.now();
        state.isSimulated = false;
        state.gnssSource = 'device-geolocation';
        state.fixType = classifyAccuracy(state.accuracy);

        // Never invent satellite count. A normal browser does not expose it.
        if (!window.FisherSafeGNSS) state.satelliteCount = null;

        _recordPosition();
        _notify();

        if (window.AppBoundary && window.AppAlerts) {
          const evaluation = AppBoundary.evaluatePosition(state.lat, state.lon);
          AppAlerts.triggerBoundaryAlert(evaluation);
        }
      },
      err => {
        console.warn('Device GNSS/GPS unavailable:', err.message);
        // Keep the app usable for presentation/testing, but clearly mark it simulated.
        startSimulation();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );

    attachNativeGNSSBridge();
  }

  function stopRealGPS() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  function startSimulation() {
    if (simInterval) return;
    stopRealGPS();
    isSimulating = true;
    state.isSimulated = true;
    state.gnssSource = 'simulation';
    state.fixType = 'simulated';
    state.satelliteCount = null;
    state.accuracy = 8;
    state.lat = simLat;
    state.lon = simLon;
    state.heading = simHeading;
    state.speed = 3.5;
    state.timestamp = Date.now();
    _notify();

    simInterval = setInterval(() => {
      simLon += 0.0008 + (Math.random() - 0.5) * 0.0003;
      simLat += (Math.random() - 0.5) * 0.0002;
      state.lat = simLat;
      state.lon = simLon;
      state.accuracy = 6 + Math.random() * 4;
      state.heading = 85 + (Math.random() - 0.5) * 10;
      state.speed = 3.5 + (Math.random() - 0.5);
      state.timestamp = Date.now();
      _recordPosition();
      _notify();
      if (window.AppBoundary && window.AppAlerts) {
        AppAlerts.triggerBoundaryAlert(AppBoundary.evaluatePosition(simLat, simLon));
      }
    }, 3000);
  }

  function stopSimulation() {
    if (simInterval) clearInterval(simInterval);
    simInterval = null;
    isSimulating = false;
  }

  function resetSimPosition() {
    simLat = 9.2876; simLon = 79.3129;
    state.lat = simLat; state.lon = simLon;
    state.isSimulated = true; state.gnssSource = 'simulation';
    _notify();
  }

  function setSimPosition(lat, lon) {
    simLat = Number(lat); simLon = Number(lon);
    state.lat = simLat; state.lon = simLon;
    state.isSimulated = true; state.gnssSource = 'simulation';
    _notify();
    if (window.AppBoundary && window.AppAlerts)
      AppAlerts.triggerBoundaryAlert(AppBoundary.evaluatePosition(simLat, simLon));
  }

  function _recordPosition() {
    if (Number.isFinite(state.lat) && Number.isFinite(state.lon)) {
      positionHistory.push({ lat: state.lat, lon: state.lon, t: Date.now() });
      if (positionHistory.length > MAX_HISTORY) positionHistory.shift();
    }
  }

  function getHistory() { return [...positionHistory]; }
  function clearHistory() { positionHistory = []; }

  function getSpeedKnots() { return state.speed === null ? null : state.speed * 1.943844; }
  function getSpeedDisplay() {
    const kn = getSpeedKnots(); return kn === null ? '—' : kn.toFixed(1) + ' kn';
  }
  function getHeadingDisplay() { return state.heading === null ? '—' : Math.round(state.heading) + '°'; }
  function getCardinalDirection(deg) {
    if (deg === null || !Number.isFinite(deg)) return '—';
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }
  function formatCoords(lat, lon) {
    if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon))
      return 'Locating... Please wait';
    return `${Math.abs(lat).toFixed(5)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(5)}°${lon >= 0 ? 'E' : 'W'}`;
  }

  function init() {
    if (navigator.geolocation) startRealGPS();
    else startSimulation();
  }

  function destroy() { stopRealGPS(); stopSimulation(); }

  return {
    state, init, destroy, onUpdate, applyGNSSMetadata,
    startSimulation, stopSimulation, resetSimPosition, setSimPosition,
    getHistory, clearHistory, getSpeedKnots, getSpeedDisplay,
    getHeadingDisplay, getCardinalDirection, formatCoords,
  };
})();
