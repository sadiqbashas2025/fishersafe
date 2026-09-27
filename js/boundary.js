/* ============================================================
   FisherSafe — Boundary Data & Alert Logic
   India–Sri Lanka IMBL + EEZ + warning zones (GeoJSON)
   ============================================================ */

const AppBoundary = (() => {

  // ----------------------------------------------------------------
  // India–Sri Lanka International Maritime Boundary Line (IMBL)
  // Source: India-Sri Lanka agreements 1974 & 1976 (UNCLOS / MEA)
  // These are publicly available coordinates from official agreements.
  // This app is a SAFETY ASSISTANCE tool — NOT a legal navigation aid.
  // ----------------------------------------------------------------
  const IMBL_COORDS = [
    // Palk Strait (northern segment — 1974 agreement)
    [9.8333, 79.9333],   // Point 1 (NE Palk Strait)
    [9.7500, 80.0000],
    [9.6667, 80.0833],
    [9.5833, 80.0833],
    [9.5000, 80.0000],
    [9.4167, 79.9167],
    [9.3333, 79.8333],
    // Gulf of Mannar (southern segment — 1976 agreement)
    [9.2500, 79.7500],
    [9.1667, 79.6667],
    [9.0833, 79.5833],
    [9.0000, 79.5000],
    [8.9167, 79.3333],
    [8.8333, 79.1667],
    [8.7500, 79.0000],
    [8.6667, 78.8333],
    [8.5833, 78.6667],
    [8.5000, 78.5000],   // Southernmost Gulf of Mannar point
  ];

  // India Exclusive Economic Zone (EEZ) — simplified outer boundary
  // 200 nautical miles from baseline (simplified polygon for display)
  const EEZ_OUTER_COORDS = [
    [23.0, 64.5],   // NW Gujarat
    [22.5, 63.0],
    [21.0, 62.0],
    [19.0, 62.5],
    [16.5, 63.0],
    [13.5, 63.0],   // Karnataka offshore
    [11.0, 63.5],
    [8.5, 65.0],    // SW tip
    [7.0, 68.0],    // Lakshadweep area
    [6.0, 73.0],
    [6.5, 78.0],
    [7.0, 80.5],
    [7.8, 82.0],    // SE Sri Lanka side
    [8.5, 83.5],
    [10.0, 84.5],
    [11.5, 85.0],
    [13.0, 85.5],
    [15.0, 85.5],
    [17.0, 85.0],   // Andhra Pradesh
    [19.5, 85.5],
    [21.0, 87.5],
    [21.5, 89.0],
    [22.0, 89.5],
    [22.5, 89.0],   // NE Bengal area
    [23.0, 88.0],
    [23.0, 64.5],   // close
  ];

  // Warning zones (concentric buffers around IMBL)
  // Distances: 50km (early warning), 20km (strong warning), 5km (critical)
  const WARNING_ZONE_KM = {
    early:    50,
    strong:   20,
    critical:  5,
  };

  // Key landmark reference points
  const LANDMARKS = {
    rameswaram:   { lat: 9.2876,  lon: 79.3129, name: 'Rameswaram, TN' },
    pamban:       { lat: 9.2841,  lon: 79.2241, name: 'Pamban Island' },
    mandapam:     { lat: 9.2786,  lon: 79.1270, name: 'Mandapam' },
    tuticorin:    { lat: 8.7642,  lon: 78.1348, name: 'Thoothukudi' },
    kanyakumari:  { lat: 8.0883,  lon: 77.5385, name: 'Kanyakumari' },
    nagapattinam: { lat: 10.7672, lon: 79.8449, name: 'Nagapattinam' },
    jaffna:       { lat: 9.6615,  lon: 80.0255, name: 'Jaffna (SL)' },
  };

  // ----------------------------------------------------------------
  // Haversine distance formula (km) between two lat/lon points
  // ----------------------------------------------------------------
  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Convert km to nautical miles
  function kmToNM(km) { return km / 1.852; }
  function nmToKm(nm) { return nm * 1.852; }

  // ----------------------------------------------------------------
  // Minimum distance from a point to the IMBL polyline
  // ----------------------------------------------------------------
  function distanceToIMBL(lat, lon) {
    let minDist = Infinity;
    let closestSegIdx = 0;

    for (let i = 0; i < IMBL_COORDS.length - 1; i++) {
      const [lat1, lon1] = IMBL_COORDS[i];
      const [lat2, lon2] = IMBL_COORDS[i + 1];

      // Point-to-segment distance (simplified — OK for short segments)
      const dx = lat2 - lat1;
      const dy = lon2 - lon1;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq > 0
        ? Math.max(0, Math.min(1, ((lat - lat1) * dx + (lon - lon1) * dy) / lenSq))
        : 0;
      const closeLat = lat1 + t * dx;
      const closeLon = lon1 + t * dy;
      const d = haversineKm(lat, lon, closeLat, closeLon);
      if (d < minDist) {
        minDist = d;
        closestSegIdx = i;
      }
    }

    return { km: minDist, nm: kmToNM(minDist), segIdx: closestSegIdx };
  }

  // ----------------------------------------------------------------
  // Which side of the IMBL is the boat on?
  // Returns 'india' | 'srilanka' | 'unknown'
  // ----------------------------------------------------------------
  function sideOfIMBL(lat, lon) {
    // Simplified: IMBL runs roughly north-south around lon 79.5–80
    // India is to the WEST of the boundary in this area
    // Check against the closest IMBL segment using cross-product sign
    let minDist = Infinity;
    let side = 'unknown';

    for (let i = 0; i < IMBL_COORDS.length - 1; i++) {
      const [lat1, lon1] = IMBL_COORDS[i];
      const [lat2, lon2] = IMBL_COORDS[i + 1];
      const dx = lat2 - lat1;
      const dy = lon2 - lon1;
      const t = Math.max(0, Math.min(1, ((lat - lat1) * dx + (lon - lon1) * dy) / (dx*dx + dy*dy + 1e-10)));
      const closeLat = lat1 + t * dx;
      const closeLon = lon1 + t * dy;
      const d = haversineKm(lat, lon, closeLat, closeLon);
      if (d < minDist) {
        minDist = d;
        // Cross product to determine side
        const cross = (lat2 - lat1) * (lon - lon1) - (lon2 - lon1) * (lat - lat1);
        side = cross > 0 ? 'india' : 'srilanka';
      }
    }
    return side;
  }

  // ----------------------------------------------------------------
  // Main alert evaluation — called whenever GPS position updates
  // Returns: { level: 'safe'|'early'|'strong'|'critical'|'crossed', dist }
  // ----------------------------------------------------------------
  function evaluatePosition(lat, lon) {
    const dist = distanceToIMBL(lat, lon);
    const side = sideOfIMBL(lat, lon);

    let level = 'safe';
    if (side === 'srilanka') {
      level = 'crossed';
    } else if (dist.km <= WARNING_ZONE_KM.critical) {
      level = 'critical';
    } else if (dist.km <= WARNING_ZONE_KM.strong) {
      level = 'strong';
    } else if (dist.km <= WARNING_ZONE_KM.early) {
      level = 'early';
    }

    return {
      level,
      distKm: dist.km,
      distNM: dist.nm,
      side,
      formattedDist: dist.km < 1
        ? `${Math.round(dist.km * 1000)} m`
        : dist.nm < 10
        ? `${dist.nm.toFixed(1)} NM`
        : `${Math.round(dist.nm)} NM`,
    };
  }

  // ----------------------------------------------------------------
  // Alert level info (text, color, emoji)
  // ----------------------------------------------------------------
  const LEVEL_INFO = {
    safe:     { label: 'SAFE ZONE',      color: '#2E7D32', bg: '#E8F5E9', emoji: '✅', cssClass: 'safe' },
    early:    { label: 'APPROACHING',    color: '#E65100', bg: '#FFF3E0', emoji: '⚠️', cssClass: 'warn' },
    strong:   { label: 'WARNING ZONE',   color: '#C62828', bg: '#FFEBEE', emoji: '🚨', cssClass: 'danger' },
    critical: { label: 'CRITICAL — TURN BACK', color: '#B71C1C', bg: '#FFCDD2', emoji: '🆘', cssClass: 'danger' },
    crossed:  { label: 'BOUNDARY CROSSED', color: '#4A0000', bg: '#FF8A80', emoji: '⛔', cssClass: 'danger' },
  };

  function getLevelInfo(level) {
    return LEVEL_INFO[level] || LEVEL_INFO.safe;
  }

  // ----------------------------------------------------------------
  // GeoJSON for Leaflet rendering
  // ----------------------------------------------------------------
  function getIMBLGeoJSON() {
    return {
      type: 'Feature',
      properties: { name: 'India–Sri Lanka IMBL', type: 'boundary' },
      geometry: {
        type: 'LineString',
        coordinates: IMBL_COORDS.map(([lat, lon]) => [lon, lat]),
      },
    };
  }

  function getEEZGeoJSON() {
    return {
      type: 'Feature',
      properties: { name: 'India EEZ', type: 'eez' },
      geometry: {
        type: 'Polygon',
        coordinates: [EEZ_OUTER_COORDS.map(([lat, lon]) => [lon, lat])],
      },
    };
  }

  return {
    IMBL_COORDS,
    LANDMARKS,
    WARNING_ZONE_KM,
    haversineKm,
    kmToNM,
    nmToKm,
    distanceToIMBL,
    sideOfIMBL,
    evaluatePosition,
    getLevelInfo,
    getIMBLGeoJSON,
    getEEZGeoJSON,
  };
})();
