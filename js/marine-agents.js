/* FisherSafe Marine Intelligence — local agentic decision-support layer.
 * This module is deliberately provider-neutral: live satellite/weather/ocean
 * connectors can be added later. Demo values are labelled as demo data.
 */
const MarineAgents = (() => {
  const DEMO_DATA = {
    weather: { windKn: 14, gustKn: 20, rainChance: 35, lightning: false, cyclone: false, source: 'Demo weather feed' },
    ocean: { waveM: 1.2, sstC: 28.4, chlorophyllMgM3: 0.42, tide: 'Rising', source: 'Demo ocean feed' },
    pfz: { available: true, distanceKm: 18, confidence: 0.72, source: 'Demo PFZ feed' }
  };

  const agents = [
    { id: 'planner', name: 'Planner Agent', role: 'Intent & task decomposition' },
    { id: 'weather', name: 'Weather Agent', role: 'Wind, rain, lightning & cyclone' },
    { id: 'ocean', name: 'Ocean Agent', role: 'Waves, SST, chlorophyll & tide' },
    { id: 'geo', name: 'Geo Agent', role: 'GPS, IMBL & restricted-zone reasoning' },
    { id: 'pfz', name: 'PFZ Agent', role: 'Potential Fishing Zone analysis' },
    { id: 'risk', name: 'Risk Agent', role: 'Multi-source risk synthesis' }
  ];

  function nearestIntent(text) {
    const q = String(text || '').toLowerCase();
    if (/safe|danger|weather|sea|tomorrow|morning|storm|cyclone|lightning/.test(q)) return 'safety';
    if (/fish|pfz|chlorophyll|sst|productivity/.test(q)) return 'fishing';
    if (/route|navigation|waypoint|boundary|border|restricted/.test(q)) return 'navigation';
    return 'marine-overview';
  }

  function assess({ gps, boundary, weather = DEMO_DATA.weather, ocean = DEMO_DATA.ocean, pfz = DEMO_DATA.pfz } = {}) {
    const reasons = [];
    let score = 0;
    if (weather.windKn >= 20) { score += 2; reasons.push('High wind'); }
    else if (weather.windKn >= 15) { score += 1; reasons.push('Moderate-to-high wind'); }
    if (weather.gustKn >= 28) { score += 2; reasons.push('Strong gusts'); }
    if (weather.lightning) { score += 3; reasons.push('Lightning risk'); }
    if (weather.cyclone) { score += 5; reasons.push('Cyclone alert'); }
    if (ocean.waveM >= 2.5) { score += 3; reasons.push('High waves'); }
    else if (ocean.waveM >= 1.8) { score += 1; reasons.push('Elevated waves'); }
    if (boundary && ['early', 'strong', 'critical', 'crossed'].includes(boundary.level)) {
      score += boundary.level === 'critical' || boundary.level === 'crossed' ? 4 : 2;
      reasons.push(`IMBL ${boundary.level} zone`);
    }
    const level = score >= 7 ? 'HIGH' : score >= 3 ? 'MODERATE' : 'LOW';
    return { level, score, reasons, evidence: { weather, ocean, pfz, boundary, gps } };
  }

  function answer(question, gps, boundary) {
    const intent = nearestIntent(question);
    const assessment = assess({ gps, boundary });
    const data = assessment.evidence;
    let summary;
    if (intent === 'safety') {
      summary = `${assessment.level} risk in this demo assessment. Wind ${data.weather.windKn} kn, waves ${data.ocean.waveM} m, and IMBL status is ${boundary?.level || 'unknown'}.`;
    } else if (intent === 'fishing') {
      summary = data.pfz.available
        ? `A demo PFZ is shown about ${data.pfz.distanceKm} km away with ${(data.pfz.confidence * 100).toFixed(0)}% demo confidence. SST is ${data.ocean.sstC}°C and chlorophyll is ${data.ocean.chlorophyllMgM3} mg/m³.`
        : 'No PFZ is available in the current dataset.';
    } else if (intent === 'navigation') {
      summary = `Navigation status: ${boundary?.level || 'unknown'} IMBL zone. Use the offline geofence as a safety aid; it is not a legal navigation boundary source.`;
    } else {
      summary = `Marine overview: ${assessment.level} demo risk, ${data.ocean.waveM} m waves, ${data.weather.windKn} kn wind, and ${data.ocean.tide} tide.`;
    }
    return { intent, summary, assessment, agents: agents.map(a => ({ ...a, status: 'completed' })) };
  }

  return { agents, DEMO_DATA, nearestIntent, assess, answer };
})();
