/* ============================================================
   FisherSafe — Leaflet Map Engine
   Offline map with boundary overlays + boat marker
   ============================================================ */

const AppMap = (() => {
  let map = null;
  let boatMarker = null;
  let tripPolyline = null;
  let imblLayer = null;
  let eezLayer = null;
  let warnZoneLayer = null;
  let waypointMarkers = [];
  let layersVisible = {
    imbl: true,
    eez: true,
    warnZone: true,
    trip: true,
    waypoints: true,
  };

  // --- Custom boat icon ---
  function createBoatIcon() {
    return L.divIcon({
      className: '',
      html: `
        <div style="position:relative;width:44px;height:44px">
          <div class="boat-pulse-ring"></div>
          <div class="boat-icon-inner">⛵</div>
        </div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -25],
    });
  }

  // --- Waypoint icon ---
  function createWaypointIcon(label) {
    return L.divIcon({
      className: '',
      html: `<div style="
        background:var(--navy);color:white;
        border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        width:28px;height:28px;display:flex;align-items:center;justify-content:center;
        font-size:11px;font-weight:700;border:2px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,.4)">
        <span style="transform:rotate(45deg)">${label || '📍'}</span>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -32],
    });
  }

  // ----------------------------------------------------------------
  // Initialize map
  // ----------------------------------------------------------------
  function init(containerId) {
    if (map) { map.remove(); map = null; }

    const container = document.getElementById(containerId);
    if (!container) return;

    // Center on Palk Strait (between Rameswaram and Sri Lanka)
    map = L.map(containerId, {
      center: [9.2876, 79.3129],
      zoom: 8,
      zoomControl: false,
      attributionControl: true,
    });

    // Basemap: online OSM when available. Boundary/vector safety logic remains local.
    // A service worker may cache previously viewed tiles; it cannot download the entire ocean offline.
    if (navigator.onLine) {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
        minZoom: 4,
      }).addTo(map);
    } else {
      L.rectangle([[7.7, 77.0], [10.5, 81.0]], {
        color: '#78909C', weight: 1, fillColor: '#ECEFF1', fillOpacity: 0.25,
        dashArray: '3 5'
      }).addTo(map).bindTooltip('OFFLINE NAVIGATION MAP — GNSS + local boundary engine active');
    }

    // Add boundary layers
    _addBoundaryLayers();

    // Boat marker at initial GPS state
    const { lat, lon } = AppGPS.state;
    const startLat = lat || AppBoundary.LANDMARKS.rameswaram.lat;
    const startLon = lon || AppBoundary.LANDMARKS.rameswaram.lon;

    boatMarker = L.marker([startLat, startLon], {
      icon: createBoatIcon(),
      zIndexOffset: 1000,
    }).addTo(map);

    boatMarker.bindPopup(`
      <div style="font-family:Roboto,sans-serif;font-size:12px;min-width:140px">
        <b>🚢 Your Vessel</b><br>
        <span id="popup-coords" style="color:#555">Loading GPS...</span>
      </div>
    `);

    // Trip polyline
    tripPolyline = L.polyline([], {
      color: '#1976D2',
      weight: 3,
      opacity: 0.7,
      dashArray: '6 4',
    }).addTo(map);

    // Load saved waypoints
    _loadWaypointMarkers();

    // Listen for GPS updates
    AppGPS.onUpdate(pos => {
      if (pos.lat && pos.lon) {
        updateBoatPosition(pos.lat, pos.lon, pos.heading);
      }
    });

    // Map click to add waypoint
    map.on('contextmenu', e => {
      _showAddWaypointPopup(e.latlng.lat, e.latlng.lng);
    });

    return map;
  }

  // ----------------------------------------------------------------
  // Add boundary + EEZ GeoJSON layers
  // ----------------------------------------------------------------
  function _addBoundaryLayers() {
    // EEZ outer boundary (cyan, transparent fill)
    eezLayer = L.geoJSON(AppBoundary.getEEZGeoJSON(), {
      style: {
        color: '#00BCD4',
        weight: 2,
        opacity: 0.6,
        fillColor: '#00BCD4',
        fillOpacity: 0.05,
        dashArray: '8 4',
      },
    }).addTo(map);

    // IMBL — red dashed line
    imblLayer = L.geoJSON(AppBoundary.getIMBLGeoJSON(), {
      style: {
        color: '#E91E63',
        weight: 3.5,
        opacity: 0.9,
        dashArray: '10 5',
      },
    }).addTo(map);

    imblLayer.bindPopup(`
      <div style="font-family:Roboto,sans-serif;font-size:12px">
        <b style="color:#C62828">⚠️ India–Sri Lanka IMBL</b><br>
        International Maritime Boundary Line<br>
        <small style="color:#757575">1974 & 1976 Agreements</small><br>
        <small style="color:#C62828"><b>Do not cross this line!</b></small>
      </div>
    `);

    // 20km warning zone around IMBL (approximate buffer — simplified circles)
    _addWarningZone();
  }

  function _addWarningZone() {
    // Draw approximate warning circles at key IMBL points
    const warnGroup = L.layerGroup();

    // Key IMBL points where fishermen often approach
    const hotspots = [
      [9.3333, 79.8333],   // Middle Palk Strait
      [9.0000, 79.5000],   // Gulf of Mannar entry
      [8.8333, 79.1667],   // Southern Gulf of Mannar
    ];

    hotspots.forEach(([lat, lon]) => {
      L.circle([lat, lon], {
        radius: 20000, // 20km
        color: '#FF6F00',
        weight: 1.5,
        opacity: 0.5,
        fillColor: '#FF6F00',
        fillOpacity: 0.04,
        dashArray: '4 4',
      }).addTo(warnGroup);

      L.circle([lat, lon], {
        radius: 5000, // 5km critical zone
        color: '#C62828',
        weight: 1.5,
        opacity: 0.6,
        fillColor: '#C62828',
        fillOpacity: 0.06,
      }).addTo(warnGroup);
    });

    warnZoneLayer = warnGroup;
    warnGroup.addTo(map);
  }

  // ----------------------------------------------------------------
  // Update boat position
  // ----------------------------------------------------------------
  function updateBoatPosition(lat, lon, heading) {
    if (!map || !boatMarker) return;

    boatMarker.setLatLng([lat, lon]);

    // Update popup
    const profile = AppStorage.loadProfile();
    const boatId = profile ? profile.boatId : 'UNKNOWN';
    const popupEl = document.getElementById('popup-coords');
    if (popupEl) {
      popupEl.textContent = AppGPS.formatCoords(lat, lon);
    }

    // Update trip polyline
    const history = AppGPS.getHistory();
    if (tripPolyline && layersVisible.trip) {
      tripPolyline.setLatLngs(history.map(p => [p.lat, p.lon]));
    }
  }

  // ----------------------------------------------------------------
  // Center map on boat
  // ----------------------------------------------------------------
  function centerOnBoat(zoom) {
    if (!map) return;
    const { lat, lon } = AppGPS.state;
    if (lat && lon) {
      map.flyTo([lat, lon], zoom || map.getZoom(), { duration: 1 });
    }
  }

  // ----------------------------------------------------------------
  // Waypoints
  // ----------------------------------------------------------------
  async function _loadWaypointMarkers() {
    const wps = await AppStorage.loadWaypoints();
    wps.forEach(wp => _addWaypointMarker(wp));
  }

  function _addWaypointMarker(wp) {
    if (!map) return;
    const marker = L.marker([wp.lat, wp.lon], {
      icon: createWaypointIcon(wp.label || '📍'),
    }).addTo(map);

    marker.bindPopup(`
      <div style="font-family:Roboto,sans-serif;font-size:12px">
        <b>${wp.name || 'Waypoint'}</b><br>
        ${AppGPS.formatCoords(wp.lat, wp.lon)}<br>
        <small style="color:#757575">Saved ${new Date(wp.savedAt || Date.now()).toLocaleDateString()}</small>
      </div>
    `);

    waypointMarkers.push({ id: wp.id, marker });
  }

  function _showAddWaypointPopup(lat, lon) {
    const name = prompt('Waypoint name (e.g., "Good fishing spot"):');
    if (!name) return;
    const wp = { lat, lon, name, label: '📍' };
    AppStorage.saveWaypoint(wp).then(id => {
      _addWaypointMarker({ ...wp, id });
      AppAlerts.showToast('📍 Waypoint Saved', name, 'safe', 3000);
    });
  }

  // ----------------------------------------------------------------
  // Layer toggles (for layers panel)
  // ----------------------------------------------------------------
  function toggleLayer(layerName, visible) {
    layersVisible[layerName] = visible;
    switch (layerName) {
      case 'imbl':
        visible ? imblLayer.addTo(map) : map.removeLayer(imblLayer); break;
      case 'eez':
        visible ? eezLayer.addTo(map) : map.removeLayer(eezLayer); break;
      case 'warnZone':
        visible ? warnZoneLayer.addTo(map) : map.removeLayer(warnZoneLayer); break;
      case 'trip':
        visible ? tripPolyline.addTo(map) : map.removeLayer(tripPolyline); break;
    }
  }

  // ----------------------------------------------------------------
  // Cleanup
  // ----------------------------------------------------------------
  function destroy() {
    if (map) { map.remove(); map = null; }
  }

  return {
    init,
    destroy,
    updateBoatPosition,
    centerOnBoat,
    toggleLayer,
    layersVisible,
  };
})();
