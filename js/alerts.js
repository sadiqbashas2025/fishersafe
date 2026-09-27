/* ============================================================
   FisherSafe — Alert System
   Audio (Web Audio API), visual toasts, vibration, history
   ============================================================ */

const AppAlerts = (() => {
  let audioCtx = null;
  let lastLevel = 'safe';
  let alertActive = false;
  let toastTimer = null;

  // --- Audio context (lazy init for browser autoplay policy) ---
  function getAudioCtx() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio not supported');
      }
    }
    return audioCtx;
  }

  // Resume audio context (required after user gesture)
  function resumeAudio() {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // --- Beep generator ---
  function playBeep(freq = 880, dur = 0.2, vol = 0.6, type = 'sine') {
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = type;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur);
    } catch (e) {}
  }

  // Alert sound patterns
  function playAlertSound(level) {
    resumeAudio();
    switch (level) {
      case 'early':
        // Two gentle beeps
        playBeep(660, 0.15, 0.4);
        setTimeout(() => playBeep(660, 0.15, 0.4), 300);
        break;
      case 'strong':
        // Three urgent beeps
        playBeep(880, 0.15, 0.6);
        setTimeout(() => playBeep(880, 0.15, 0.6), 250);
        setTimeout(() => playBeep(880, 0.15, 0.6), 500);
        break;
      case 'critical':
        // Rapid alarm pattern
        for (let i = 0; i < 5; i++) {
          setTimeout(() => playBeep(1100, 0.12, 0.8, 'square'), i * 180);
        }
        break;
      case 'crossed':
        // SOS-like (3 short, 3 long, 3 short)
        const shorts = [0, 200, 400];
        const longs  = [700, 1000, 1300];
        const shorts2 = [1700, 1900, 2100];
        [...shorts].forEach(t => setTimeout(() => playBeep(1200, 0.1, 0.9, 'sawtooth'), t));
        [...longs].forEach(t  => setTimeout(() => playBeep(1200, 0.35, 0.9, 'sawtooth'), t));
        [...shorts2].forEach(t => setTimeout(() => playBeep(1200, 0.1, 0.9, 'sawtooth'), t));
        break;
      case 'sos':
        // Loud wailing siren pattern (High-Low)
        for (let i = 0; i < 15; i++) { // Repeat for a longer alarm
          setTimeout(() => playBeep(1200, 0.4, 1.0, 'square'), i * 800);
          setTimeout(() => playBeep(800, 0.4, 1.0, 'square'), i * 800 + 400);
        }
        // Also trigger visual flash
        document.body.classList.add('sos-active');
        setTimeout(() => document.body.classList.remove('sos-active'), 15 * 800);
        break;
    }
  }

  // --- Vibration ---
  function vibrate(pattern) {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  const VIBRATE_PATTERNS = {
    early:    [100, 100, 100],
    strong:   [200, 100, 200, 100, 200],
    critical: [300, 100, 300, 100, 300, 100, 300],
    crossed:  [500, 200, 500, 200, 500],
    sos:      [1000, 500, 1000, 500, 1000],
  };

  // --- Toast notification ---
  function showToast(title, msg, type = 'warn', durationMs = 5000) {
    const toast = document.getElementById('alert-toast');
    const titleEl = document.getElementById('alert-title');
    const msgEl = document.getElementById('alert-msg');
    if (!toast) return;

    titleEl.textContent = title;
    msgEl.textContent = msg;
    toast.className = 'alert-toast ' + type;
    toast.classList.remove('hidden');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dismissToast(), durationMs);
  }

  function dismissToast() {
    const toast = document.getElementById('alert-toast');
    if (toast) toast.classList.add('hidden');
  }

  // --- Boundary banner ---
  function showBoundaryBanner(text, type = 'danger') {
    const banner = document.getElementById('boundary-banner');
    const bannerText = document.getElementById('boundary-banner-text');
    if (!banner) return;
    bannerText.textContent = text;
    banner.className = 'boundary-banner ' + type;
    banner.classList.remove('hidden');
  }

  function hideBoundaryBanner() {
    const banner = document.getElementById('boundary-banner');
    if (banner) banner.classList.add('hidden');
  }

  // --- Main alert trigger (called on GPS update) ---
  let lastAlertLevel = 'safe';
  let alertCooldown = false;

  function triggerBoundaryAlert(evaluation) {
    const { level, distKm, distNM, formattedDist } = evaluation;
    const info = AppBoundary.getLevelInfo(level);

    // Update boundary banner for active warnings
    if (level !== 'safe') {
      const bannerMsg = level === 'crossed'
        ? `⛔ BOUNDARY CROSSED — Return to Indian waters immediately!`
        : `${info.emoji} ${info.label} — ${formattedDist} to boundary`;
      showBoundaryBanner(bannerMsg, info.cssClass);
    } else {
      hideBoundaryBanner();
    }

    // Only fire sound/toast when level changes or escalates
    if (level !== lastAlertLevel || (level !== 'safe' && !alertCooldown)) {

      if (level !== 'safe') {
        // Play sound
        playAlertSound(level);

        // Vibrate
        if (VIBRATE_PATTERNS[level]) vibrate(VIBRATE_PATTERNS[level]);

        // Show toast
        const toastMsg = level === 'crossed'
          ? 'You have crossed into Sri Lankan waters. Return immediately!'
          : `Distance to IMBL: ${formattedDist}`;
        showToast(info.emoji + ' ' + info.label, toastMsg, 'danger',
          level === 'crossed' ? 10000 : 6000);

        // Save to alert history
        AppStorage.saveAlert({
          level,
          label: info.label,
          distKm: Math.round(distKm * 10) / 10,
          distNM: Math.round(distNM * 10) / 10,
          formattedDist,
        }).catch(() => {});

        // Cooldown to avoid spam
        alertCooldown = true;
        setTimeout(() => { alertCooldown = false; }, 30000);
      }

      lastAlertLevel = level;
    }

    // Dispatch event for UI components to react
    window.dispatchEvent(new CustomEvent('boundaryAlert', { detail: evaluation }));
  }

  // --- SOS Alert ---
  function triggerSOS(type = 'ALL OK') {
    resumeAudio();
    playAlertSound('sos');
    vibrate(VIBRATE_PATTERNS.sos);
    showToast('🆘 SOS SENT', `Signal type: ${type} — Saved locally.`, 'danger', 8000);
    AppStorage.saveAlert({
      level: 'sos',
      label: 'SOS: ' + type,
      distKm: 0,
      distNM: 0,
      formattedDist: 'N/A',
    }).catch(() => {});
  }

  return {
    resumeAudio,
    playAlertSound,
    vibrate,
    showToast,
    dismissToast,
    showBoundaryBanner,
    hideBoundaryBanner,
    triggerBoundaryAlert,
    triggerSOS,
  };
})();
