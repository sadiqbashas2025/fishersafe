/* ============================================================
   FisherSafe — App Router & State Manager
   Mobile App with Portrait Grid & Strictly Validated Registration
   ============================================================ */

const App = (() => {
  let currentPage = null;
  let pageHistory = [];
  let clockInterval = null;
  let headerUpdateInterval = null;
  let homeViewMode = 'grid'; // 'grid' (portrait dashboard) or 'map' (full map)

  // ----------------------------------------------------------------
  // Init
  // ----------------------------------------------------------------
  async function init() {
    AppStorage.initDB().catch(() => {});
    navigate('splash');
  }

  // ----------------------------------------------------------------
  // Router
  // ----------------------------------------------------------------
  async function navigate(page, params = {}) {
    const container = document.getElementById('page-container');
    if (!container) return;

    // Role-based Access Protection for Admin
    if (page === 'admin') {
      if (!AppAuth.isAuthenticated()) {
        AppAlerts.showToast('🔒 Admin Login Required', 'Please log in with administrator credentials.', 'warn', 3500);
        navigate('login');
        return;
      }
      if (!AppAuth.isAdmin()) {
        AppAlerts.showToast('⛔ Access Denied', 'You are not authorized to access the Admin Dashboard.', 'danger', 4000);
        if (currentPage && currentPage !== 'admin') return;
        navigate('home');
        return;
      }
    }

    // Teardown current page
    if (currentPage === 'home' && page !== 'home') {
      AppMap.destroy();
    }

    const prevPage = currentPage;
    currentPage = page;
    pageHistory.push(page);

    // Render new page HTML
    let html = '';
    switch (page) {
      case 'splash':      html = renderSplash(); break;
      case 'login':       html = renderLogin(); break;
      case 'register':    html = renderRegister(); break;
      case 'admin':       html = AppAdmin.renderAdminLayout(); break;
      case 'home':        html = renderHome(); break;
      case 'logbook':     html = AppLogbook.renderLogbookPage(); break;
      case 'utilities':   html = renderUtilities(); break;
      case 'sos':         html = renderSOS(); break;
      case 'navigation':  html = renderNavigation(); break;
      case 'marine-ai':   html = renderMarineAI(); break;
      case 'profile':     html = renderProfile(); break;
      default:            html = renderHome();
    }

    container.innerHTML = html;

    // Post-render setup
    switch (page) {
      case 'splash':
        setTimeout(() => {
          if (AppAuth.isAuthenticated()) {
            const u = AppAuth.getCurrentUser();
            if (u && u.role === 'admin') navigate('admin');
            else navigate('home');
          } else {
            const offlineProf = AppStorage.loadProfile();
            if (offlineProf) {
              navigate('home');
            } else {
              navigate('login');
            }
          }
        }, 2200);
        break;

      case 'login':
        setupLoginForm();
        break;

      case 'register':
        setupRegisterForm();
        break;

      case 'admin':
        AppAdmin.refreshCurrentTab();
        break;

      case 'home':
        setTimeout(() => {
          if (homeViewMode === 'map') {
            AppMap.init('leaflet-map');
          }
          AppGPS.init();
          startHeaderUpdates();
          AppAPI.syncQueue();
        }, 50);
        break;

      case 'logbook':
        AppLogbook.loadEntries();
        break;

      case 'utilities':
        startUtilityUpdates();
        break;

      case 'navigation':
        startNavigationUpdates();
        break;

      case 'marine-ai':
        setupMarineAI();
        break;

      case 'profile':
        loadProfileData();
        break;
    }
  }

  function goBack() {
    pageHistory.pop(); // remove current
    const prev = pageHistory.pop() || 'home';
    navigate(prev);
  }

  function setHomeViewMode(mode) {
    homeViewMode = mode;
    const gridContainer = document.getElementById('home-portrait-grid-view');
    const mapContainer = document.getElementById('map-container');
    const btnGrid = document.getElementById('btn-view-grid');
    const btnMap = document.getElementById('btn-view-map');

    if (mode === 'grid') {
      if (gridContainer) gridContainer.classList.remove('hidden');
      if (mapContainer) mapContainer.classList.add('hidden');
      if (btnGrid) btnGrid.classList.add('active');
      if (btnMap) btnMap.classList.remove('active');
    } else {
      if (gridContainer) gridContainer.classList.add('hidden');
      if (mapContainer) mapContainer.classList.remove('hidden');
      if (btnGrid) btnGrid.classList.remove('active');
      if (btnMap) btnMap.classList.add('active');
      setTimeout(() => {
        AppMap.init('leaflet-map');
      }, 50);
    }
    updateHeader();
  }

  // ----------------------------------------------------------------
  // Header live updates (GPS coords, time, satellite)
  // ----------------------------------------------------------------
  function startHeaderUpdates() {
    if (headerUpdateInterval) clearInterval(headerUpdateInterval);
    headerUpdateInterval = setInterval(updateHeader, 1000);
    updateHeader(); // immediate
  }

  function updateHeader() {
    const { lat, lon, accuracy, fixType, speed, heading } = AppGPS.state;

    // GPS coords display
    const coordEl = document.getElementById('header-gps-text');
    if (coordEl) {
      coordEl.textContent = lat
        ? AppGPS.formatCoords(lat, lon)
        : 'Locating GPS...';
    }

    // GPS dot color
    const dotEl = document.getElementById('header-gps-dot');
    if (dotEl) {
      dotEl.className = 'header-gps-dot' + (lat ? ' fixed' : '');
    }

    // Time
    const timeEl = document.getElementById('header-clock');
    if (timeEl) {
      timeEl.textContent = new Date().toTimeString().slice(0, 8);
    }

    // Boundary distance badge & Hero card
    if (lat && lon) {
      const eval_ = AppBoundary.evaluatePosition(lat, lon);
      const info = AppBoundary.getLevelInfo(eval_.level);

      // Hero card elements
      const heroDistEl = document.getElementById('hero-dist-val');
      const heroSubEl = document.getElementById('hero-dist-sub');
      const heroPillEl = document.getElementById('hero-status-pill');
      const heroSpeedEl = document.getElementById('hero-speed-val');
      const heroHeadEl = document.getElementById('hero-heading-val');

      if (heroDistEl) heroDistEl.textContent = eval_.formattedDist;
      if (heroSubEl) heroSubEl.textContent = eval_.level === 'safe'
        ? '⚓ Safe Waters — Distance to Sri Lanka IMBL'
        : `⚠️ ${info.label} — Distance to Sri Lanka IMBL`;
      if (heroPillEl) {
        heroPillEl.className = 'hero-status-pill ' + eval_.level;
        heroPillEl.textContent = info.emoji + ' ' + info.label;
      }
      if (heroSpeedEl) {
        const kn = AppGPS.getSpeedKnots();
        heroSpeedEl.textContent = (kn !== null ? kn.toFixed(1) : '0.0') + ' kn';
      }
      if (heroHeadEl) {
        heroHeadEl.textContent = AppGPS.getHeadingDisplay() + ' ' + AppGPS.getCardinalDirection(heading);
      }

      // Map View Badges
      const badgeEl = document.getElementById('boundary-dist-badge');
      if (badgeEl) {
        badgeEl.textContent = eval_.level === 'safe'
          ? `⚓ ${eval_.formattedDist} to IMBL`
          : `${info.emoji} ${eval_.formattedDist} to IMBL`;
        badgeEl.className = 'map-boundary-badge ' + info.cssClass;
      }

      // Nav overlay on map
      const speedEl = document.getElementById('nav-overlay-speed');
      const headEl  = document.getElementById('nav-overlay-heading');
      if (speedEl) {
        const kn = AppGPS.getSpeedKnots();
        speedEl.textContent = kn !== null ? kn.toFixed(1) : '—';
      }
      if (headEl) {
        headEl.textContent = AppGPS.getHeadingDisplay();
      }
    }
  }

  function startUtilityUpdates() {
    const update = () => {
      const { lat, lon, accuracy, speed, heading, fixType, isSimulated } = AppGPS.state;

      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

      setEl('util-lat', lat ? lat.toFixed(6) + '°N' : '—');
      setEl('util-lon', lon ? lon.toFixed(6) + '°E' : '—');
      setEl('util-accuracy', accuracy ? accuracy.toFixed(0) + ' m' : '—');
      setEl('util-fix', isSimulated ? 'SIMULATED' : (fixType || 'Searching'));
      const sat = Number.isFinite(AppGPS.state.satelliteCount)
        ? `${AppGPS.state.satelliteCount} used`
        : (isSimulated ? 'Demo mode' : 'GNSS metadata unavailable');
      setEl('util-satellites', sat);
      setEl('util-speed', AppGPS.getSpeedDisplay());
      setEl('util-heading', AppGPS.getHeadingDisplay() + ' ' + AppGPS.getCardinalDirection(heading));

      if (lat && lon) {
        const eval_ = AppBoundary.evaluatePosition(lat, lon);
        setEl('util-dist-imbl', eval_.formattedDist);
        setEl('util-zone-status', AppBoundary.getLevelInfo(eval_.level).label);
        const zoneEl = document.getElementById('util-zone-badge');
        if (zoneEl) {
          zoneEl.className = 'badge badge-' + (eval_.level === 'safe' ? 'safe' : eval_.level === 'early' ? 'warn' : 'danger');
          zoneEl.textContent = AppBoundary.getLevelInfo(eval_.level).label;
        }
      }
    };
    update();
    const iv = setInterval(update, 1500);
    window._utilInterval = iv;
  }

  function startNavigationUpdates() {
    const update = () => {
      const { lat, lon, heading, speed } = AppGPS.state;

      // Compass needle
      const needle = document.getElementById('compass-needle');
      if (needle && heading !== null) {
        needle.style.transform = `translateX(-50%) translateY(-50%) rotate(${heading}deg)`;
      }

      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setEl('nav-heading-deg', heading !== null ? Math.round(heading) + '°' : '—');
      setEl('nav-cardinal', AppGPS.getCardinalDirection(heading));
      setEl('nav-speed-kn', AppGPS.getSpeedDisplay());
      setEl('nav-coords', AppGPS.formatCoords(lat, lon));

      // Trip distance
      const hist = AppGPS.getHistory();
      if (hist.length > 1) {
        let totalKm = 0;
        for (let i = 1; i < hist.length; i++) {
          totalKm += AppBoundary.haversineKm(hist[i-1].lat, hist[i-1].lon, hist[i].lat, hist[i].lon);
        }
        setEl('nav-trip-dist', totalKm < 1 ? (totalKm*1000).toFixed(0)+'m' : totalKm.toFixed(2)+' km');
        setEl('nav-trip-nm', AppBoundary.kmToNM(totalKm).toFixed(2) + ' NM');
      }
    };
    update();
    const iv = setInterval(update, 500);
    window._navInterval = iv;
  }

  // ----------------------------------------------------------------
  // Real Credential Login Handler
  // ----------------------------------------------------------------
  function setupLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const fieldId = document.getElementById('login-identifier');
    const fieldPass = document.getElementById('login-password');
    const errBox = document.getElementById('login-error-box');
    const btnSubmit = document.getElementById('login-submit-btn');

    // Pre-fill existing fisherman ID if available
    const existing = AppStorage.loadProfile();
    if (existing && existing.fishermanId && fieldId && !fieldId.value) {
      fieldId.value = existing.fishermanId;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errBox) {
        errBox.classList.remove('visible');
        errBox.textContent = '';
      }

      const identifier = fieldId ? fieldId.value.trim() : '';
      const password = fieldPass ? fieldPass.value : '';

      if (!identifier || !password) {
        const msg = 'Please enter all required fields: User ID / Mobile and Password.';
        if (errBox) {
          errBox.textContent = msg;
          errBox.classList.add('visible');
        }
        AppAlerts.showToast('⚠️ Required Fields', msg, 'warn', 3500);
        if (!identifier && fieldId) fieldId.focus();
        else if (fieldPass) fieldPass.focus();
        return;
      }

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '⏳ Verifying Credentials...';
      }

      const res = await AppAuth.login(identifier, password);

      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '⚓ Sign In to Maritime Portal';
      }

      if (!res.success) {
        if (errBox) {
          errBox.textContent = res.error;
          errBox.classList.add('visible');
        }
        AppAlerts.showToast('Authentication Failed', res.error, 'danger', 4000);
        if (fieldPass) {
          fieldPass.value = '';
          fieldPass.focus();
        }
        return;
      }

      // Success
      AppAlerts.showToast('✅ Login Successful', `Welcome ${res.user.fullName}. Secure session active.`, 'safe', 3000);

      // Route based on verified role
      setTimeout(() => {
        if (res.user.role === 'admin') {
          navigate('admin');
        } else {
          navigate('home');
        }
      }, 500);
    });
  }

  // ----------------------------------------------------------------
  // Real Registration Handler with Comprehensive Validation
  // ----------------------------------------------------------------
  function setupRegisterForm() {
    const form = document.getElementById('register-form');
    if (!form) return;

    const fName = document.getElementById('reg-fullname');
    const fId = document.getElementById('reg-fishermanId');
    const fPhone = document.getElementById('reg-phone');
    const fEmail = document.getElementById('reg-email');
    const fPass = document.getElementById('reg-password');
    const fConfirm = document.getElementById('reg-confirm-password');
    const fBoat = document.getElementById('reg-boatId');
    const fPort = document.getElementById('reg-homePort');
    const fEmContact = document.getElementById('reg-emcontact');
    const fEmPhone = document.getElementById('reg-emphone');
    const errBox = document.getElementById('reg-error-box');
    const btnSubmit = document.getElementById('reg-submit-btn');

    function setFieldState(inputEl, errorId, isValid, msg = '') {
      const errEl = document.getElementById(errorId);
      if (!inputEl) return;
      if (isValid) {
        inputEl.classList.remove('input-error');
        inputEl.classList.add('input-valid');
        if (errEl) {
          errEl.classList.remove('visible');
          errEl.textContent = '';
        }
      } else {
        inputEl.classList.remove('input-valid');
        inputEl.classList.add('input-error');
        if (errEl) {
          errEl.classList.add('visible');
          errEl.textContent = msg;
        }
      }
    }

    // Real-time validations
    if (fName) {
      fName.addEventListener('input', () => {
        fName.value = fName.value.replace(/[^A-Za-z\s.]/g, '');
        const v = /^[A-Za-z\s.]{2,60}$/.test(fName.value.trim());
        setFieldState(fName, 'err-reg-name', v, v ? '' : '⚠️ Full Name must contain letters only (min 2 chars)');
      });
    }

    if (fId) {
      fId.addEventListener('input', () => {
        fId.value = fId.value.toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
        const v = /^[A-Z0-9\-_]{4,25}$/.test(fId.value.trim());
        setFieldState(fId, 'err-reg-id', v, v ? '' : '⚠️ Fisherman ID must be alphanumeric (e.g. IND-TN-9821, min 4 chars)');
      });
    }

    if (fPhone) {
      fPhone.addEventListener('input', () => {
        fPhone.value = fPhone.value.replace(/[^0-9]/g, '').slice(0, 10);
        const v = /^[6-9]\d{9}$/.test(fPhone.value.trim());
        setFieldState(fPhone, 'err-reg-phone', v, v ? '' : '⚠️ Enter valid 10-digit mobile number starting 6, 7, 8, 9');
      });
    }

    if (fPass) {
      fPass.addEventListener('input', () => {
        const val = fPass.value;
        const v = val.length >= 6 && /[A-Za-z]/.test(val) && /[0-9]/.test(val);
        setFieldState(fPass, 'err-reg-pass', v, v ? '' : '⚠️ Password must be at least 6 chars with letters and numbers');
        if (fConfirm && fConfirm.value) {
          const match = fConfirm.value === val;
          setFieldState(fConfirm, 'err-reg-confirm', match, match ? '' : '⚠️ Passwords do not match');
        }
      });
    }

    if (fConfirm) {
      fConfirm.addEventListener('input', () => {
        const match = fConfirm.value === (fPass ? fPass.value : '');
        setFieldState(fConfirm, 'err-reg-confirm', match, match ? '' : '⚠️ Passwords do not match');
      });
    }

    if (fBoat) {
      fBoat.addEventListener('input', () => {
        fBoat.value = fBoat.value.toUpperCase().replace(/[^A-Z0-9\- ]/g, '');
        const v = fBoat.value.trim().length >= 4;
        setFieldState(fBoat, 'err-reg-boat', v, v ? '' : '⚠️ Enter valid Boat Registration No. (e.g. TN-04-MM-1234)');
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errBox) {
        errBox.classList.remove('visible');
        errBox.textContent = '';
      }

      const fullName = fName ? fName.value.trim() : '';
      const fishermanId = fId ? fId.value.trim().toUpperCase() : '';
      const phone = fPhone ? fPhone.value.trim() : '';
      const email = fEmail ? fEmail.value.trim() : '';
      const password = fPass ? fPass.value : '';
      const confirmPassword = fConfirm ? fConfirm.value : '';
      const boatId = fBoat ? fBoat.value.trim().toUpperCase() : '';
      const homePort = fPort ? fPort.value.trim() : '';
      const emergencyContact = fEmContact ? fEmContact.value.trim() : '';
      const emergencyPhone = fEmPhone ? fEmPhone.value.trim() : '';

      // Validate all required fields
      if (!fullName || !fishermanId || !phone || !password || !confirmPassword || !boatId || !homePort) {
        const msg = 'Please complete all compulsory registration fields marked with *';
        if (errBox) {
          errBox.textContent = msg;
          errBox.classList.add('visible');
        }
        AppAlerts.showToast('Compulsory Fields Missing', msg, 'warn', 4000);
        return;
      }

      // Format validations
      if (!/^[A-Za-z\s.]{2,60}$/.test(fullName)) {
        setFieldState(fName, 'err-reg-name', false, 'Full name must contain alphabetic characters only');
        fName.focus();
        return;
      }

      if (!/^[A-Z0-9\-_]{4,25}$/.test(fishermanId)) {
        setFieldState(fId, 'err-reg-id', false, 'Fisherman ID must be alphanumeric (e.g. IND-TN-9821)');
        fId.focus();
        return;
      }

      if (!/^[6-9]\d{9}$/.test(phone)) {
        setFieldState(fPhone, 'err-reg-phone', false, 'Enter valid 10-digit mobile number (starting 6-9)');
        fPhone.focus();
        return;
      }

      if (password !== confirmPassword) {
        setFieldState(fConfirm, 'err-reg-confirm', false, 'Passwords do not match');
        fConfirm.focus();
        return;
      }

      if (password.length < 6 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        setFieldState(fPass, 'err-reg-pass', false, 'Password must be at least 6 characters with letters and numbers');
        fPass.focus();
        return;
      }

      if (boatId.length < 4) {
        setFieldState(fBoat, 'err-reg-boat', false, 'Enter valid Boat Registration No.');
        fBoat.focus();
        return;
      }

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '⏳ Submitting Vessel Registration...';
      }

      const formData = {
        fullName,
        fishermanId,
        phone,
        email,
        password,
        confirmPassword,
        boatId,
        homePort,
        emergencyContact,
        emergencyPhone
      };

      const res = await AppAuth.register(formData);

      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '⚓ Complete Registration & Launch';
      }

      if (!res.success) {
        if (errBox) {
          errBox.textContent = res.error;
          errBox.classList.add('visible');
        }
        AppAlerts.showToast('Registration Error', res.error, 'danger', 4500);
        return;
      }

      // Success
      AppAlerts.showToast('✅ Registration Successful', `Welcome Captain ${fullName}! Vessel account created.`, 'safe', 3500);

      setTimeout(() => {
        navigate('home');
      }, 600);
    });
  }

  // ----------------------------------------------------------------
  // Profile page data
  // ----------------------------------------------------------------
  function loadProfileData() {
    const authUser = AppAuth.getCurrentUser();
    const profile = authUser || AppStorage.loadProfile() || {};

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
    setEl('prof-boat-id', profile.boatId);
    setEl('prof-name', profile.fullName || profile.fishermanName);
    setEl('prof-id', profile.fishermanId);
    setEl('prof-role', (profile.role || 'fisherman').toUpperCase());
    setEl('prof-phone', profile.phone);
    setEl('prof-port', profile.homePort);
    setEl('prof-emname', profile.emergencyContact);
    setEl('prof-emphone', profile.emergencyPhone);
    setEl('prof-registered', (profile.createdAt || profile.registeredAt)
      ? new Date(profile.createdAt || profile.registeredAt).toLocaleDateString('en-IN')
      : '—');

    AppStorage.loadAlerts().then(alerts => {
      setEl('prof-alert-count', alerts.length + ' alerts');
    }).catch(() => {});

    AppStorage.loadWaypoints().then(wps => {
      setEl('prof-waypoint-count', wps.length + ' saved');
    }).catch(() => {});
  }

  // ----------------------------------------------------------------
  // Boundary test helper (for demo)
  // ----------------------------------------------------------------
  function testBoundaryAlert(distKm) {
    const targetLat = 9.3333 + (distKm / 111);
    const targetLon = 79.8333 - (distKm / 111);
    AppGPS.setSimPosition(targetLat, targetLon);
    AppAlerts.showToast('🧪 Simulation', `Simulated boat at ${distKm}km from IMBL`, 'safe', 3000);
    updateHeader();

    const alertType = distKm <= 5 ? 'critical_boundary' : distKm <= 20 ? 'warning_strong' : 'warning_early';
    if (typeof AppAuth !== 'undefined' && AppAuth.isAuthenticated()) {
      if (AppAuth.isOnline()) {
        AppAPI.fisherman.logAlert({
          alertType,
          distanceKm: distKm,
          lat: targetLat,
          lon: targetLon,
          notes: `Simulated boundary test at ${distKm}km from IMBL`
        }).catch(() => {});
      } else {
        AppAPI.queueOfflineAlert({
          alertType,
          distanceKm: distKm,
          location: { lat: targetLat, lon: targetLon },
          timestamp: Date.now(),
          alertStatus: distKm <= 5 ? 'Critical' : 'Warning',
          notes: `Offline boundary event at ${distKm}km from IMBL`
        });
      }
    }
  }

  // ----------------------------------------------------------------
  // Page renders
  // ----------------------------------------------------------------
  function renderSplash() {
    return `
      <div class="page active splash-page">
        <!-- Govt logos -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;padding:0 16px;z-index:1">
          <span class="splash-logo-badge">GOI • DOF</span>
          <span class="splash-logo-badge">ISRO</span>
          <span class="splash-logo-badge">NSIL</span>
          <span class="splash-logo-badge">ACCORD</span>
          <span class="splash-logo-badge">CMFRI</span>
        </div>

        <div style="z-index:1;text-align:center;padding:24px 20px 20px">
          <div class="splash-anchor" style="animation:slideUp 0.6s ease">⚓</div>
          <div class="splash-title" style="animation:slideUp 0.7s ease">FisherSafe</div>
          <div class="splash-subtitle" style="animation:slideUp 0.8s ease;margin-top:4px">Mobile Maritime Safety System</div>
          <div class="splash-tagline" style="animation:slideUp 0.9s ease;margin-top:6px">
            India–Sri Lanka Boundary Alert · Offline Navigation · Emergency SOS
          </div>

          <div class="splash-logos-wrap" style="animation:fadeIn 1.2s ease">
            <div style="font-size:0.65rem;color:rgba(255,255,255,.6);text-align:center">
              Government of India — Department of Fisheries
            </div>
          </div>

          <div class="splash-progress">
            <div class="splash-progress-bar"></div>
          </div>

          <div style="margin-top:12px;font-size:0.65rem;color:rgba(255,255,255,.5);animation:fadeIn 2s ease">
            Initializing offline nautical data...
          </div>
        </div>
      </div>
    `;
  }

  function renderLogin() {
    return `
      <div class="page active login-page">
        <!-- Navy top section -->
        <div class="login-header-art">
          <div style="font-size:0.58rem;opacity:0.8;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">
            Government of India · Department of Fisheries
          </div>
          <div class="login-boat-icon">⚓</div>
          <h1 style="font-size:1.5rem;color:white;margin-top:6px">FisherSafe Maritime</h1>
          <p style="color:rgba(255,255,255,.8);font-size:0.78rem;margin-top:2px">
            Vessel Captain & Port Authority Access
          </p>
        </div>

        <!-- Form card -->
        <div class="login-form-card">
          <!-- Auth mode switch tabs -->
          <div style="display:flex;gap:4px;background:#e2e8f0;padding:4px;border-radius:var(--r-md);margin-bottom:16px">
            <button class="btn btn-sm btn-primary" style="flex:1;font-size:0.78rem" onclick="App.navigate('login')">
              🔑 Sign In
            </button>
            <button class="btn btn-sm btn-outline" style="flex:1;font-size:0.78rem;background:transparent;border:none;color:var(--navy)" onclick="App.navigate('register')">
              📝 Register Vessel
            </button>
          </div>

          <div class="login-form-title">Portal Login</div>
          <div class="login-form-sub">Enter your Fisherman ID or Admin credentials to access safety systems</div>

          <!-- Error Alert Banner -->
          <div id="login-error-box" class="field-error-msg" style="padding:10px;background:#FFF3E0;border:1px solid #FFE0B2;border-radius:6px;margin-bottom:14px;color:#C62828;font-size:0.78rem;line-height:1.4">
          </div>

          <form id="login-form" autocomplete="off" novalidate>
            <!-- 1. Fisherman ID / User ID / Mobile -->
            <div class="form-group">
              <label class="form-label" for="login-identifier">
                <span>User ID / Fisherman ID / Mobile<span class="required-star">*</span></span>
                <span class="field-hint">e.g. IND-TN-9821</span>
              </label>
              <div class="form-input-wrap">
                <input class="form-input" id="login-identifier" type="text"
                  placeholder="Fisherman ID, Phone, or Admin ID" required />
              </div>
            </div>

            <!-- 2. Password with visibility toggle -->
            <div class="form-group">
              <label class="form-label" for="login-password">
                <span>Account Password<span class="required-star">*</span></span>
                <span class="field-hint">Encrypted</span>
              </label>
              <div class="form-input-wrap" style="position:relative">
                <input class="form-input" id="login-password" type="password"
                  placeholder="Enter your password" required style="padding-right:42px" />
                <button type="button" id="btn-toggle-password" onclick="togglePasswordVisibility('login-password', this)"
                  style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--grey-600)"
                  aria-label="Toggle password visibility">👁️</button>
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-full btn-lg" id="login-submit-btn" style="margin-top:10px">
              ⚓ Sign In to Maritime Portal
            </button>
          </form>

          <!-- Quick Test Credentials Preset Bar -->
          <div style="margin-top:16px;padding:12px;background:#F8FAFC;border-radius:8px;border:1px dashed #CBD5E1">
            <div style="font-size:0.7rem;font-weight:700;color:var(--navy);margin-bottom:6px">🧪 Quick Login for Testing:</div>
            <div style="display:flex;gap:6px">
              <button type="button" class="btn btn-sm btn-outline" style="flex:1;font-size:0.7rem;padding:6px 4px"
                onclick="quickFillLogin('fisherman')">
                🚢 Fisherman<br><small>IND-TN-9821</small>
              </button>
              <button type="button" class="btn btn-sm btn-outline" style="flex:1;font-size:0.7rem;padding:6px 4px"
                onclick="quickFillLogin('admin')">
                👑 Admin Authority<br><small>ADMIN001</small>
              </button>
            </div>
          </div>

          <div class="divider"></div>

          <div style="text-align:center">
            <div style="font-size:0.75rem;color:var(--grey-600);margin-bottom:8px">First time vessel captain?</div>
            <button class="btn btn-outline btn-full" onclick="App.navigate('register')" style="font-size:0.8rem">
              📝 Register New Vessel Account
            </button>
          </div>

          <div style="font-size:0.65rem;color:var(--grey-600);text-align:center;margin-top:14px;line-height:1.4">
            🔒 Bcrypt Password Hashing & Backend RBAC Protection Active.<br>
            Offline cached navigation available for verified captains.
          </div>
        </div>
      </div>
    `;
  }

  function renderRegister() {
    return `
      <div class="page active login-page">
        <!-- Navy top section -->
        <div class="login-header-art">
          <div style="font-size:0.58rem;opacity:0.8;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">
            Government of India · Department of Fisheries
          </div>
          <div class="login-boat-icon">⚓</div>
          <h1 style="font-size:1.4rem;color:white;margin-top:4px">Vessel Registration</h1>
          <p style="color:rgba(255,255,255,.8);font-size:0.75rem;margin-top:2px">
            Fisherman Identity & Maritime Safety Profile
          </p>
        </div>

        <div class="login-form-card">
          <!-- Auth mode switch tabs -->
          <div style="display:flex;gap:4px;background:#e2e8f0;padding:4px;border-radius:var(--r-md);margin-bottom:14px">
            <button class="btn btn-sm btn-outline" style="flex:1;font-size:0.78rem;background:transparent;border:none;color:var(--navy)" onclick="App.navigate('login')">
              🔑 Sign In
            </button>
            <button class="btn btn-sm btn-primary" style="flex:1;font-size:0.78rem" onclick="App.navigate('register')">
              📝 Register Vessel
            </button>
          </div>

          <div class="login-compulsory-badge">
            <span>*</span> All fields are compulsory. Public registration assigns Fisherman role only.
          </div>

          <!-- Error Alert Banner -->
          <div id="reg-error-box" class="field-error-msg" style="padding:10px;background:#FFF3E0;border:1px solid #FFE0B2;border-radius:6px;margin-bottom:14px;color:#C62828;font-size:0.78rem;line-height:1.4">
          </div>

          <form id="register-form" autocomplete="off" novalidate>
            <!-- 1. Full Name -->
            <div class="form-group">
              <label class="form-label" for="reg-fullname">
                <span>Full Name<span class="required-star">*</span></span>
                <span class="field-hint">Letters only</span>
              </label>
              <div class="form-input-wrap">
                <input class="form-input" id="reg-fullname" type="text"
                  placeholder="e.g. Murugan Selvam" required />
              </div>
              <div class="field-error-msg" id="err-reg-name"></div>
            </div>

            <!-- 2. Fisherman ID -->
            <div class="form-group">
              <label class="form-label" for="reg-fishermanId">
                <span>Fisherman ID / User ID<span class="required-star">*</span></span>
                <span class="field-hint">Alphanumeric</span>
              </label>
              <div class="form-input-wrap">
                <input class="form-input" id="reg-fishermanId" type="text"
                  placeholder="e.g. IND-TN-9821" required />
              </div>
              <div class="field-error-msg" id="err-reg-id"></div>
            </div>

            <!-- 3. Mobile Number -->
            <div class="form-group">
              <label class="form-label" for="reg-phone">
                <span>Mobile Number<span class="required-star">*</span></span>
                <span class="field-hint">10 Digits</span>
              </label>
              <div class="form-input-wrap">
                <input class="form-input" id="reg-phone" type="tel" inputmode="numeric" maxlength="10"
                  placeholder="e.g. 9876543210" required />
              </div>
              <div class="field-error-msg" id="err-reg-phone"></div>
            </div>

            <!-- 4. Email (optional) -->
            <div class="form-group">
              <label class="form-label" for="reg-email">
                <span>Email Address</span>
                <span class="field-hint">Optional</span>
              </label>
              <div class="form-input-wrap">
                <input class="form-input" id="reg-email" type="email"
                  placeholder="captain@example.com" />
              </div>
            </div>

            <!-- 5. Password -->
            <div class="form-group">
              <label class="form-label" for="reg-password">
                <span>Account Password<span class="required-star">*</span></span>
                <span class="field-hint">Min 6 chars</span>
              </label>
              <div class="form-input-wrap" style="position:relative">
                <input class="form-input" id="reg-password" type="password"
                  placeholder="Letters & numbers (min 6)" required style="padding-right:42px" />
                <button type="button" onclick="togglePasswordVisibility('reg-password', this)"
                  style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--grey-600)"
                  aria-label="Toggle password">👁️</button>
              </div>
              <div class="field-error-msg" id="err-reg-pass"></div>
            </div>

            <!-- 6. Confirm Password -->
            <div class="form-group">
              <label class="form-label" for="reg-confirm-password">
                <span>Confirm Password<span class="required-star">*</span></span>
                <span class="field-hint">Must match</span>
              </label>
              <div class="form-input-wrap" style="position:relative">
                <input class="form-input" id="reg-confirm-password" type="password"
                  placeholder="Re-type password" required style="padding-right:42px" />
                <button type="button" onclick="togglePasswordVisibility('reg-confirm-password', this)"
                  style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--grey-600)"
                  aria-label="Toggle password">👁️</button>
              </div>
              <div class="field-error-msg" id="err-reg-confirm"></div>
            </div>

            <div class="divider"></div>
            <div style="font-size:0.78rem;font-weight:700;color:var(--navy);margin-bottom:8px">
              🚢 Vessel & Port Specifications
            </div>

            <!-- 7. Boat Registration -->
            <div class="form-group">
              <label class="form-label" for="reg-boatId">
                <span>Boat Registration No.<span class="required-star">*</span></span>
                <span class="field-hint">e.g. TN-04-MM-1234</span>
              </label>
              <div class="form-input-wrap">
                <input class="form-input" id="reg-boatId" type="text"
                  placeholder="e.g. TN-04-MM-1234" required />
              </div>
              <div class="field-error-msg" id="err-reg-boat"></div>
            </div>

            <!-- 8. Home Port -->
            <div class="form-group">
              <label class="form-label" for="reg-homePort">
                <span>Home Port / District<span class="required-star">*</span></span>
                <span class="field-hint">Select</span>
              </label>
              <select class="form-select" id="reg-homePort" required>
                <option value="">-- Select Home Port District --</option>
                <option value="Rameswaram">Rameswaram, Ramanathapuram</option>
                <option value="Mandapam">Mandapam Harbor</option>
                <option value="Pamban">Pamban Island</option>
                <option value="Thoothukudi">Thoothukudi (Tuticorin)</option>
                <option value="Kanyakumari">Kanyakumari Harbor</option>
                <option value="Nagapattinam">Nagapattinam</option>
                <option value="Cuddalore">Cuddalore</option>
                <option value="Chennai">Chennai Fishing Harbor</option>
                <option value="Other">Other Coastal Port</option>
              </select>
            </div>

            <div class="divider"></div>
            <div style="font-size:0.78rem;font-weight:700;color:var(--navy);margin-bottom:8px">
              🆘 Emergency Shore Contact
            </div>

            <!-- 9. Emergency Contact Name -->
            <div class="form-group">
              <label class="form-label" for="reg-emcontact">
                <span>Emergency Contact Person</span>
                <span class="field-hint">Shore Kin</span>
              </label>
              <div class="form-input-wrap">
                <input class="form-input" id="reg-emcontact" type="text"
                  placeholder="e.g. Anjali Murugan" />
              </div>
            </div>

            <!-- 10. Emergency Contact Phone -->
            <div class="form-group">
              <label class="form-label" for="reg-emphone">
                <span>Emergency Contact Phone</span>
                <span class="field-hint">10 Digits</span>
              </label>
              <div class="form-input-wrap">
                <input class="form-input" id="reg-emphone" type="tel" inputmode="numeric" maxlength="10"
                  placeholder="e.g. 9841023456" />
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-full btn-lg" id="reg-submit-btn" style="margin-top:10px">
              ⚓ Complete Registration & Launch
            </button>

            <div style="text-align:center;margin-top:14px">
              <span style="font-size:0.75rem;color:var(--grey-600)">Already registered? </span>
              <a href="javascript:void(0)" onclick="App.navigate('login')" style="color:var(--navy);font-weight:700;font-size:0.78rem;text-decoration:none">
                Sign In Here
              </a>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function renderHome() {
    const profile = AppStorage.loadProfile();
    const boatId = profile ? profile.boatId : 'TN-04-MM-1234';
    const name = profile ? profile.fishermanName : 'Captain';

    return `
      <div class="page active" id="page-home" style="background:#f0f4f8">
        <!-- ===== APP HEADER ===== -->
        <div class="app-header">
          <!-- Logo row -->
          <div class="header-logo-row">
            <div class="header-logo-left">
              <div class="header-govt-emblem">🇮🇳</div>
              <div class="header-org-text">
                <span class="header-org-main">Government of India</span>
                <span class="header-org-sub">Department of Fisheries · Thoondil</span>
              </div>
            </div>
            <div class="header-partner-logos">
              <span class="partner-badge">ISRO</span>
              <span class="partner-badge">INCOIS</span>
              <span class="partner-badge">NSIL</span>
            </div>
            <button class="header-menu-btn" onclick="App.navigate('profile')" aria-label="Profile">⋮</button>
          </div>

          <!-- GPS coords row -->
          <div class="header-gps-row">
            <div class="header-gps-bar">
              <div class="header-gps-dot" id="header-gps-dot"></div>
              <span class="header-gps-text" id="header-gps-text">Locating GPS...</span>
            </div>
            <div class="header-id-box">
              <span id="header-clock">--:--:--</span>
            </div>
          </div>

          <!-- Status chips -->
          <div class="header-status-bar">
            <!-- Vessel ID -->
            <div class="status-chip">
              <span class="status-chip-icon">🚢</span>
              <span class="status-chip-label">${boatId}</span>
            </div>

            <!-- Satellite -->
            <div class="status-chip" style="flex:1">
              <span class="status-chip-icon">🛰️</span>
              <div class="sat-chip">
                <div class="signal-bars">
                  <div class="signal-bar active"></div>
                  <div class="signal-bar active"></div>
                  <div class="signal-bar active"></div>
                  <div class="signal-bar"></div>
                </div>
                <div class="sat-signal-row">
                  <span>NavIC</span><span>GPS</span>
                </div>
              </div>
            </div>

            <!-- Bluetooth / VHF -->
            <div class="status-chip">
              <span class="status-chip-icon">📡</span>
              <span class="status-chip-label">VHF 16</span>
            </div>
          </div>

          <!-- Segmented View Toggle: Grid Dashboard vs Live Map -->
          <div class="view-toggle-bar">
            <div class="view-segmented-wrap">
              <button class="view-segment-btn ${homeViewMode === 'grid' ? 'active' : ''}" id="btn-view-grid" onclick="App.setHomeViewMode('grid')">
                📱 Portrait Grid
              </button>
              <button class="view-segment-btn ${homeViewMode === 'map' ? 'active' : ''}" id="btn-view-map" onclick="App.setHomeViewMode('map')">
                🗺️ Live Map
              </button>
            </div>
          </div>
        </div>

        <!-- ===== VIEW 1: PORTRAIT GRID DASHBOARD ===== -->
        <div class="page-scroll ${homeViewMode === 'grid' ? '' : 'hidden'}" id="home-portrait-grid-view">
          <div class="portrait-dashboard-container">
            
            <!-- Hero Radar & Boundary Status Card -->
            <div class="portrait-hero-card">
              <div class="hero-top-row">
                <span class="hero-label">🚨 IMBL BOUNDARY RADAR</span>
                <span class="hero-status-pill safe" id="hero-status-pill">⚓ SAFE ZONE</span>
              </div>
              <div class="hero-dist-val" id="hero-dist-val">⚓ Calculating...</div>
              <div class="hero-dist-sub" id="hero-dist-sub">India–Sri Lanka Maritime Boundary Line</div>

              <div class="hero-footer-stats">
                <div class="hero-stat-item">
                  <span class="hero-stat-label">SPEED</span>
                  <span class="hero-stat-val" id="hero-speed-val">0.0 kn</span>
                </div>
                <div class="hero-stat-item">
                  <span class="hero-stat-label">HEADING</span>
                  <span class="hero-stat-val" id="hero-heading-val">090° E</span>
                </div>
                <div class="hero-stat-item" style="margin-left:auto">
                  <button class="btn btn-sm btn-outline" style="color:white;border-color:rgba(255,255,255,0.4);padding:4px 8px;font-size:0.68rem"
                    onclick="toggleLayersPanel()">🧪 Test Alerts</button>
                </div>
              </div>
            </div>

            <!-- 9-Tile Mobile Portrait Grid -->
            <div class="portrait-action-grid">
              
              <!-- 1. Boundary Radar -->
              <div class="portrait-tile tile-radar" onclick="App.setHomeViewMode('map')">
                <div class="portrait-tile-header">
                  <div class="portrait-tile-icon">🚨</div>
                  <span class="portrait-tile-tag badge-info">Live</span>
                </div>
                <div class="portrait-tile-body">
                  <div class="portrait-tile-title">Boundary Radar</div>
                  <div class="portrait-tile-subtitle">IMBL proximity & alerts</div>
                </div>
              </div>

              <!-- 2. SOS Emergency -->
              <div class="portrait-tile tile-sos" onclick="App.navigate('sos')">
                <div class="portrait-tile-header">
                  <div class="portrait-tile-icon">🆘</div>
                  <span class="portrait-tile-tag badge-danger">1554</span>
                </div>
                <div class="portrait-tile-body">
                  <div class="portrait-tile-title">Emergency SOS</div>
                  <div class="portrait-tile-subtitle">Distress beacon & Mayday</div>
                </div>
              </div>

              <!-- 3. Full Nautical Map -->
              <div class="portrait-tile tile-map" onclick="App.setHomeViewMode('map')">
                <div class="portrait-tile-header">
                  <div class="portrait-tile-icon">🗺️</div>
                  <span class="portrait-tile-tag badge-safe">Offline</span>
                </div>
                <div class="portrait-tile-body">
                  <div class="portrait-tile-title">Nautical Chart</div>
                  <div class="portrait-tile-subtitle">Palk Strait & EEZ Map</div>
                </div>
              </div>

              <!-- 4. Fish Finder (PFZ) -->
              <div class="portrait-tile tile-fish" onclick="showPFZModal()">
                <div class="portrait-tile-header">
                  <div class="portrait-tile-icon">🐟</div>
                  <span class="portrait-tile-tag badge-info">INCOIS</span>
                </div>
                <div class="portrait-tile-body">
                  <div class="portrait-tile-title">Fish Finder</div>
                  <div class="portrait-tile-subtitle">Potential Fishing Zones</div>
                </div>
              </div>

              <!-- 5. Compass & HUD -->
              <div class="portrait-tile tile-nav" onclick="App.navigate('navigation')">
                <div class="portrait-tile-header">
                  <div class="portrait-tile-icon">🧭</div>
                  <span class="portrait-tile-tag badge-info">HUD</span>
                </div>
                <div class="portrait-tile-body">
                  <div class="portrait-tile-title">Compass & HUD</div>
                  <div class="portrait-tile-subtitle">Bearing, knots & waypoints</div>
                </div>
              </div>

              <!-- 6. Marine Weather -->
              <div class="portrait-tile tile-weather" onclick="showWeatherModal()">
                <div class="portrait-tile-header">
                  <div class="portrait-tile-icon">🌊</div>
                  <span class="portrait-tile-tag badge-warn">Sea State</span>
                </div>
                <div class="portrait-tile-body">
                  <div class="portrait-tile-title">Marine Weather</div>
                  <div class="portrait-tile-subtitle">Waves, wind & cyclone</div>
                </div>
              </div>

              <!-- 7. Agentic Marine Intelligence -->
              <div class="portrait-tile tile-weather" onclick="App.navigate('marine-ai')">
                <div class="portrait-tile-header">
                  <div class="portrait-tile-icon">🤖</div>
                  <span class="portrait-tile-tag badge-info">Agents</span>
                </div>
                <div class="portrait-tile-body">
                  <div class="portrait-tile-title">Marine AI</div>
                  <div class="portrait-tile-subtitle">Weather, ocean, PFZ & risk reasoning</div>
                </div>
              </div>

              <!-- 8. Captain's Logbook -->
              <div class="portrait-tile tile-log" onclick="App.navigate('logbook')">
                <div class="portrait-tile-header">
                  <div class="portrait-tile-icon">📓</div>
                  <span class="portrait-tile-tag badge-info">Record</span>
                </div>
                <div class="portrait-tile-body">
                  <div class="portrait-tile-title">Voyage Logbook</div>
                  <div class="portrait-tile-subtitle">Catch logs & remarks</div>
                </div>
              </div>

              <!-- 8. Voice & Siren Alarm -->
              <div class="portrait-tile tile-siren" onclick="showSirenModal()">
                <div class="portrait-tile-header">
                  <div class="portrait-tile-icon">📢</div>
                  <span class="portrait-tile-tag badge-danger">Horn</span>
                </div>
                <div class="portrait-tile-body">
                  <div class="portrait-tile-title">Voice Siren</div>
                  <div class="portrait-tile-subtitle">Tamil & Eng alarm test</div>
                </div>
              </div>

            </div>

            <!-- Emergency Shore Line Strip -->
            <div class="portrait-emergency-strip">
              <div>
                <div class="strip-text">🇮🇳 Indian Coast Guard Helpline: 1554</div>
                <div style="font-size:0.68rem;color:var(--grey-600)">Toll-Free 24x7 Search & Rescue</div>
              </div>
              <a href="tel:1554" class="strip-btn">📞 Call 1554</a>
            </div>

          </div>
        </div>

        <!-- ===== VIEW 2: INTERACTIVE LEAFLET MAP ===== -->
        <div id="map-container" class="${homeViewMode === 'map' ? '' : 'hidden'}">
          <!-- Leaflet map -->
          <div id="leaflet-map"></div>

          <!-- Boundary distance badge -->
          <div class="map-boundary-badge safe" id="boundary-dist-badge">⚓ — to IMBL</div>

          <!-- Speed + heading overlay -->
          <div class="map-nav-overlay">
            <div class="nav-item">
              <span class="nav-value" id="nav-overlay-speed">—</span>
              <span class="nav-label">knots</span>
            </div>
            <div class="nav-item">
              <span class="nav-value" id="nav-overlay-heading">—</span>
              <span class="nav-label">heading</span>
            </div>
          </div>

          <!-- Left FABs -->
          <div class="map-fabs-left">
            <button class="fab fab-white" onclick="toggleLayersPanel()" data-tip="Layers" id="layers-fab" aria-label="Layers">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                <polyline points="2 17 12 22 22 17"/>
                <polyline points="2 12 12 17 22 12"/>
              </svg>
            </button>
            <button class="fab fab-white" onclick="showPFZModal()" data-tip="Fish Finder" aria-label="Fish Finder">🐟</button>
            <button class="fab fab-white" onclick="App.navigate('navigation')" data-tip="Compass" aria-label="Navigation">🧭</button>
          </div>

          <!-- Right FABs -->
          <div class="map-fabs-right">
            <button class="fab fab-sos" onclick="App.navigate('sos')" data-tip="SOS" aria-label="SOS">SOS</button>
            <button class="fab fab-ok" onclick="sendOKSignal()" data-tip="ALL OK" aria-label="All OK" style="font-size:0.75rem;font-weight:900">OK</button>
            <button class="fab fab-white" onclick="showWeatherModal()" data-tip="Weather" aria-label="Weather">🌊</button>
          </div>

          <!-- Center/locate button -->
          <div class="map-locate-btn">
            <button class="fab" onclick="AppMap.centerOnBoat()" style="background:white;color:var(--navy)" aria-label="Center on my location">🎯</button>
          </div>

          <!-- Layers panel (hidden by default) -->
          <div class="layers-panel" id="layers-panel">
            <div class="layers-panel-header">
              <span>Map Layers & Demo</span>
              <button onclick="toggleLayersPanel()" style="background:transparent;border:none;color:white;cursor:pointer;font-size:1.1rem">✕</button>
            </div>
            <div class="layer-toggle-row">
              <label><span>🔴</span> IMBL Boundary</label>
              <label class="toggle-switch">
                <input type="checkbox" checked onchange="AppMap.toggleLayer('imbl', this.checked)" id="layer-imbl">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="layer-toggle-row">
              <label><span>🔵</span> Indian EEZ</label>
              <label class="toggle-switch">
                <input type="checkbox" checked onchange="AppMap.toggleLayer('eez', this.checked)" id="layer-eez">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="layer-toggle-row">
              <label><span>🟠</span> Warning Zones</label>
              <label class="toggle-switch">
                <input type="checkbox" checked onchange="AppMap.toggleLayer('warnZone', this.checked)" id="layer-warn">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="layer-toggle-row">
              <label><span>🔵</span> Trip Route</label>
              <label class="toggle-switch">
                <input type="checkbox" checked onchange="AppMap.toggleLayer('trip', this.checked)" id="layer-trip">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div style="padding:12px 16px;border-top:1px solid var(--grey-200)">
              <div style="font-size:0.72rem;color:var(--grey-600);margin-bottom:8px;font-weight:700">🧪 DEMO — Test Boundary Alerts</div>
              <button class="btn btn-warn btn-full" style="font-size:0.78rem;padding:8px"
                onclick="App.testBoundaryAlert(40)">Simulate 40km from IMBL</button>
              <button class="btn btn-danger btn-full" style="font-size:0.78rem;padding:8px;margin-top:6px"
                onclick="App.testBoundaryAlert(3)">Simulate CRITICAL (3km)</button>
              <button class="btn btn-outline btn-full" style="font-size:0.78rem;padding:8px;margin-top:6px"
                onclick="AppGPS.resetSimPosition();toggleLayersPanel()">Reset to Rameswaram</button>
            </div>
          </div>
        </div>

        <!-- ===== BOTTOM NAV ===== -->
        <div class="bottom-nav">
          <button class="nav-tab active" onclick="App.navigate('home')" id="nav-home" aria-label="Home">
            <span class="nav-tab-icon">🏠</span>
            <span class="nav-tab-label">Home</span>
          </button>
          <button class="nav-tab" onclick="App.navigate('logbook')" id="nav-logbook" aria-label="Logbook">
            <span class="nav-tab-icon">📓</span>
            <span class="nav-tab-label">Logbook</span>
          </button>
          <button class="nav-tab" onclick="App.navigate('utilities')" id="nav-utils" aria-label="Utilities">
            <span class="nav-tab-icon">🔧</span>
            <span class="nav-tab-label">Utilities</span>
          </button>
        </div>

        <!-- Modal Container placeholder -->
        <div id="home-modal-container"></div>
      </div>
    `;
  }

  function renderMarineAI() {
    const gps = AppGPS.state;
    const boundary = gps.lat && gps.lon ? AppBoundary.evaluatePosition(gps.lat, gps.lon) : null;
    const result = MarineAgents.answer('What is the marine safety status near my fishing location?', gps, boundary);
    return `
      <div class="page active agentic-page" id="page-marine-ai">
        <div class="page-header">
          <button class="page-header-back" onclick="App.navigate('home')">←</button>
          <span class="page-header-title">🤖 Marine Intelligence</span>
          <span style="font-size:.7rem;color:#64748b">Offline engine</span>
        </div>
        <div class="marine-ai-card">
          <h3>Collaborative Marine Agents</h3>
          <p>Planner + weather + ocean + geospatial + PFZ + risk agents coordinate locally. Live providers can be connected later.</p>
          <div class="agent-pills">${MarineAgents.agents.map(a => `<span class="agent-pill">${a.name.replace(' Agent','')}</span>`).join('')}</div>
        </div>
        <div class="agent-input">
          <label style="font-size:.75rem;font-weight:800">Ask FisherSafe</label>
          <textarea id="marine-question" placeholder="Example: Is it safe to go fishing tomorrow morning?"></textarea>
          <button class="btn btn-primary agent-run" onclick="runMarineQuestion()">🤖 Analyze with Agents</button>
        </div>
        <div class="agent-result" id="marine-result">
          <div style="font-size:.72rem;color:#64748b;margin-bottom:6px">Current local assessment</div>
          <div id="marine-summary" style="font-weight:700;line-height:1.45">${result.summary}</div>
          <div id="marine-evidence"></div>
          <div class="agent-list" id="marine-agents-list">
            ${result.agents.map(a => `<div class="agent-row"><strong>✓ ${a.name}</strong><span>${a.role} · completed</span></div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  function setupMarineAI() {
    const q = document.getElementById('marine-question');
    if (q) q.focus();
  }

  function renderUtilities() {
    return `
      <div class="page active" id="page-utils">
        <!-- Header -->
        <div class="page-header">
          <button class="page-header-back" onclick="App.navigate('home')" aria-label="Back">←</button>
          <span class="page-header-title">🔧 Utilities & Safety Tools</span>
          <button class="page-header-action" onclick="App.navigate('profile')" aria-label="Profile">🚢</button>
        </div>

        <div class="page-scroll">
          <!-- GPS Status Grid -->
          <div class="section-header">📡 Satellite & NavIC Fix</div>
          <div class="utils-grid">
            <div class="utils-card">
              <div class="utils-card-icon">🌐</div>
              <div class="utils-card-label">Latitude</div>
              <div class="utils-card-value" id="util-lat">—</div>
            </div>
            <div class="utils-card">
              <div class="utils-card-icon">🌐</div>
              <div class="utils-card-label">Longitude</div>
              <div class="utils-card-value" id="util-lon">—</div>
            </div>
            <div class="utils-card">
              <div class="utils-card-icon">🎯</div>
              <div class="utils-card-label">Accuracy</div>
              <div class="utils-card-value" id="util-accuracy">—</div>
            </div>
            <div class="utils-card">
              <div class="utils-card-icon">🛰️</div>
              <div class="utils-card-label">Satellites</div>
              <div class="utils-card-value" id="util-satellites">—</div>
            </div>
            <div class="utils-card">
              <div class="utils-card-icon">🛰️</div>
              <div class="utils-card-label">GPS Fix</div>
              <div class="utils-card-value" id="util-fix" style="font-size:0.78rem">—</div>
            </div>
          </div>

          <!-- Navigation Grid -->
          <div class="section-header">🧭 Marine Navigation</div>
          <div class="utils-grid">
            <div class="utils-card" onclick="App.navigate('navigation')">
              <div class="utils-card-icon">⚡</div>
              <div class="utils-card-label">Vessel Speed</div>
              <div class="utils-card-value" id="util-speed">—</div>
            </div>
            <div class="utils-card" onclick="App.navigate('navigation')">
              <div class="utils-card-icon">🧭</div>
              <div class="utils-card-label">Compass Heading</div>
              <div class="utils-card-value" id="util-heading">—</div>
            </div>
          </div>

          <!-- Boundary Card -->
          <div class="section-header">⚠️ Boundary Proximity</div>
          <div class="card" style="margin:var(--sp-md)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <div style="font-weight:700;font-size:0.85rem;color:var(--navy)">Distance to Sri Lanka IMBL</div>
              <span class="badge badge-safe" id="util-zone-badge">SAFE</span>
            </div>
            <div style="font-size:1.8rem;font-weight:900;color:var(--navy);font-family:var(--font-condensed)" id="util-dist-imbl">—</div>
            <div style="font-size:0.75rem;color:var(--grey-600);margin-top:4px" id="util-zone-status">—</div>
            <div style="margin-top:12px">
              <button class="btn btn-danger btn-full" onclick="App.navigate('sos')">🆘 SOS Emergency</button>
            </div>
          </div>

          <!-- Quick actions -->
          <div class="section-header">⚡ Quick Tools</div>
          <div style="display:flex;flex-direction:column;gap:0">
            <div class="list-item" onclick="showPFZModal()">
              <div class="list-item-icon">🐟</div>
              <div class="list-item-body">
                <div class="list-item-title">Potential Fishing Zones (PFZ)</div>
                <div class="list-item-sub">INCOIS Sea Surface Temp & High Catch</div>
              </div>
              <div class="list-item-right">›</div>
            </div>
            <div class="list-item" onclick="showWeatherModal()">
              <div class="list-item-icon">🌊</div>
              <div class="list-item-body">
                <div class="list-item-title">Marine Weather & Waves</div>
                <div class="list-item-sub">Wave height, wind knots & cyclone advisory</div>
              </div>
              <div class="list-item-right">›</div>
            </div>
            <div class="list-item" onclick="showSirenModal()">
              <div class="list-item-icon">📢</div>
              <div class="list-item-body">
                <div class="list-item-title">Voice Alert & Siren Sounder</div>
                <div class="list-item-sub">Tamil / English audio announcements</div>
              </div>
              <div class="list-item-right">›</div>
            </div>
            <div class="list-item" onclick="App.navigate('navigation')">
              <div class="list-item-icon">🧭</div>
              <div class="list-item-body">
                <div class="list-item-title">Marine Compass & Odometer</div>
                <div class="list-item-sub">True heading, trip distance, saved waypoints</div>
              </div>
              <div class="list-item-right">›</div>
            </div>
            <div class="list-item" onclick="App.navigate('profile')">
              <div class="list-item-icon">🚢</div>
              <div class="list-item-body">
                <div class="list-item-title">Vessel Profile & Equipment</div>
                <div class="list-item-sub">Captain details, safety checklist</div>
              </div>
              <div class="list-item-right">›</div>
            </div>
          </div>
        </div>

        <!-- Bottom nav -->
        <div class="bottom-nav">
          <button class="nav-tab" onclick="App.navigate('home')"><span class="nav-tab-icon">🏠</span><span class="nav-tab-label">Home</span></button>
          <button class="nav-tab" onclick="App.navigate('logbook')"><span class="nav-tab-icon">📓</span><span class="nav-tab-label">Logbook</span></button>
          <button class="nav-tab active" onclick="App.navigate('utilities')"><span class="nav-tab-icon">🔧</span><span class="nav-tab-label">Utilities</span></button>
        </div>

        <div id="home-modal-container"></div>
      </div>
    `;
  }

  function renderSOS() {
    const profile = AppStorage.loadProfile();
    const emName = profile ? (profile.emergencyContact || '—') : '—';
    const emPhone = profile ? (profile.emergencyPhone || '—') : '—';
    const boatId = profile ? (profile.boatId || '—') : '—';
    const { lat, lon } = AppGPS.state;
    const coordStr = AppGPS.formatCoords(lat, lon);

    return `
      <div class="page active sos-page" id="page-sos">
        <!-- Back header -->
        <div class="page-header" style="background:rgba(0,0,0,.4)">
          <button class="page-header-back" onclick="App.goBack()">←</button>
          <span class="page-header-title">🆘 Emergency SOS Distress</span>
        </div>

        <div class="page-scroll" style="color:white">
          <!-- Big SOS button -->
          <div style="display:flex;flex-direction:column;align-items:center;padding:24px 20px 12px">
            <button class="sos-big-btn" onclick="triggerSOSSignal()" id="sos-main-btn" aria-label="Send SOS">
              SOS
            </button>
            <div style="margin-top:16px;font-size:0.85rem;font-weight:700;text-align:center">
              TAP TO ACTIVATE DISTRESS BEACON
            </div>
            <div style="margin-top:4px;font-size:0.72rem;opacity:0.8;text-align:center">
              Transmits location to VHF Channel 16 & records log
            </div>
          </div>

          <!-- Signal type selector -->
          <div style="padding:0 12px">
            <div style="font-size:0.75rem;font-weight:700;opacity:0.9;margin-bottom:6px;padding:0 4px">SELECT SIGNAL TYPE</div>
            <div class="sos-type-grid">
              <button class="sos-type-btn selected" onclick="selectSOSType(this,'MAYDAY')" id="sos-mayday">
                <span class="sos-type-icon">🆘</span>
                <span class="sos-type-label">MAYDAY</span>
              </button>
              <button class="sos-type-btn" onclick="selectSOSType(this,'PAN-PAN')" id="sos-panpan">
                <span class="sos-type-icon">⚠️</span>
                <span class="sos-type-label">PAN-PAN</span>
              </button>
              <button class="sos-type-btn" onclick="selectSOSType(this,'ALL OK')" id="sos-allok">
                <span class="sos-type-icon">✅</span>
                <span class="sos-type-label">ALL OK</span>
              </button>
            </div>
          </div>

          <!-- Status card -->
          <div class="sos-status-card">
            <div style="font-size:0.72rem;font-weight:700;opacity:0.85;margin-bottom:8px;letter-spacing:1px">📍 VESSEL DISTRESS POSITION</div>
            <div class="info-row" style="color:white;margin-bottom:6px;display:flex;justify-content:space-between">
              <span style="color:rgba(255,255,255,.7);font-size:0.78rem">GPS Position:</span>
              <span style="color:white;font-size:0.82rem;font-family:var(--font-condensed);font-weight:700">${coordStr}</span>
            </div>
            <div class="info-row" style="color:white;margin-bottom:6px;display:flex;justify-content:space-between">
              <span style="color:rgba(255,255,255,.7);font-size:0.78rem">Boat ID:</span>
              <span style="color:white;font-weight:700">${boatId}</span>
            </div>
            <div class="info-row" style="color:white;margin-bottom:6px;display:flex;justify-content:space-between">
              <span style="color:rgba(255,255,255,.7);font-size:0.78rem">Emergency Contact:</span>
              <span style="color:white;font-weight:700">${emName} (${emPhone})</span>
            </div>
            <div class="info-row" style="color:white;display:flex;justify-content:space-between">
              <span style="color:rgba(255,255,255,.7);font-size:0.78rem">National Helpline:</span>
              <span style="color:#81D4FA;font-weight:900">Coast Guard 1554</span>
            </div>
          </div>

          <!-- Emergency contacts -->
          <div style="padding:0 12px 12px">
            <div style="font-size:0.75rem;font-weight:700;opacity:0.9;margin-bottom:6px">📞 DIRECT HELPLINES</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <a href="tel:1554" class="btn btn-safe" style="font-size:0.8rem;padding:10px">📞 Coast Guard<br><small>1554</small></a>
              <a href="tel:100" class="btn btn-primary" style="font-size:0.8rem;padding:10px">👮 Marine Police<br><small>100</small></a>
              <a href="tel:108" class="btn btn-danger" style="font-size:0.8rem;padding:10px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3)">🚑 Ambulance<br><small>108</small></a>
              <button class="btn" onclick="showSirenModal()" style="font-size:0.8rem;padding:10px;background:rgba(255,255,255,.2);color:white;border:1px solid rgba(255,255,255,.3)">📢 Sound Siren<br><small>Audio Alarm</small></button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderNavigation() {
    return `
      <div class="page active" id="page-nav">
        <div class="page-header">
          <button class="page-header-back" onclick="App.goBack()">←</button>
          <span class="page-header-title">🧭 Compass & Waypoints</span>
          <button class="page-header-action" onclick="addWaypointManual()" title="Add Waypoint">➕</button>
        </div>

        <div class="page-scroll">
          <!-- Compass Display -->
          <div class="compass-container">
            <div class="compass-ring">
              <div class="compass-face">
                <div class="compass-dir-labels">
                  <span class="compass-dir-label n">N</span>
                  <span class="compass-dir-label s">S</span>
                  <span class="compass-dir-label e">E</span>
                  <span class="compass-dir-label w">W</span>
                </div>
                <div class="compass-needle-wrap" id="compass-needle">
                  <div class="compass-needle-n"></div>
                  <div class="compass-needle-s"></div>
                </div>
                <div class="compass-center-dot"></div>
              </div>
            </div>
            <div style="margin-top:14px;text-align:center">
              <div style="font-size:1.8rem;font-weight:900;color:var(--navy);font-family:var(--font-condensed)" id="nav-heading-deg">090°</div>
              <div style="font-size:0.85rem;font-weight:700;color:var(--navy-light)" id="nav-cardinal">EAST</div>
              <div style="font-size:0.75rem;color:var(--grey-600);margin-top:2px" id="nav-coords">—</div>
            </div>
          </div>

          <!-- Trip Stats Grid -->
          <div class="utils-grid" style="padding-top:0">
            <div class="utils-card">
              <div class="utils-card-icon">⚡</div>
              <div class="utils-card-label">Current Speed</div>
              <div class="utils-card-value" id="nav-speed-kn">0.0 kn</div>
            </div>
            <div class="utils-card">
              <div class="utils-card-icon">📏</div>
              <div class="utils-card-label">Trip Distance</div>
              <div class="utils-card-value" id="nav-trip-dist">0.0 km</div>
              <div class="utils-card-unit" id="nav-trip-nm">0.00 NM</div>
            </div>
          </div>

          <!-- Saved Waypoints -->
          <div class="section-header" style="display:flex;justify-content:space-between;align-items:center">
            <span>📍 Saved Waypoints</span>
            <button class="btn btn-sm btn-primary" onclick="addWaypointManual()" style="font-size:0.72rem;padding:4px 8px">➕ Add</button>
          </div>
          <div id="waypoints-list">
            <div style="padding:16px;text-align:center;color:var(--grey-600);font-size:0.8rem">Loading waypoints...</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderProfile() {
    const authUser = AppAuth.getCurrentUser();
    const profile = authUser || AppStorage.loadProfile() || {};
    const isAdmin = authUser && authUser.role === 'admin';

    return `
      <div class="page active" id="page-profile">
        <div class="page-header">
          <button class="page-header-back" onclick="App.goBack()">←</button>
          <span class="page-header-title">🚢 Captain & Vessel Profile</span>
          <button class="page-header-action" onclick="App.logout()" title="Logout">🚪</button>
        </div>

        <div class="page-scroll">
          <div style="background:linear-gradient(135deg,var(--navy-dark),var(--navy));padding:20px;text-align:center;color:white">
            <div style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 8px;border:2px solid rgba(255,255,255,0.4)">
              ${isAdmin ? '👮' : '🚢'}
            </div>
            <h2 style="color:white;font-size:1.2rem" id="prof-boat-id">${profile.boatId || 'TN-04-MM-1234'}</h2>
            <p style="color:rgba(255,255,255,.8);font-size:0.85rem" id="prof-name">${profile.fullName || profile.fishermanName || 'Captain'}</p>
            <div style="margin-top:6px">
              <span class="badge ${isAdmin ? 'badge-warn' : 'badge-safe'}" id="prof-role">${(profile.role || 'fisherman').toUpperCase()}</span>
            </div>
          </div>

          ${isAdmin ? `
            <div style="padding:var(--sp-md) var(--sp-md) 0">
              <button class="btn btn-primary btn-full" onclick="App.navigate('admin')">
                👑 Open Admin Surveillance Dashboard
              </button>
            </div>
          ` : ''}

          <div class="section-header">📋 Registered Details</div>
          <div class="card" style="margin:var(--sp-md)">
            <div class="info-row" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee">
              <span style="color:var(--grey-600);font-size:0.8rem">Fisherman / User ID:</span>
              <span style="font-weight:700;color:var(--navy)" id="prof-id">${profile.fishermanId || '—'}</span>
            </div>
            <div class="info-row" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee">
              <span style="color:var(--grey-600);font-size:0.8rem">Mobile Phone:</span>
              <span style="font-weight:700" id="prof-phone">${profile.phone || '—'}</span>
            </div>
            <div class="info-row" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee">
              <span style="color:var(--grey-600);font-size:0.8rem">Home Port:</span>
              <span style="font-weight:700" id="prof-port">${profile.homePort || '—'}</span>
            </div>
            <div class="info-row" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee">
              <span style="color:var(--grey-600);font-size:0.8rem">Emergency Contact:</span>
              <span style="font-weight:700" id="prof-emname">${profile.emergencyContact || '—'}</span>
            </div>
            <div class="info-row" style="display:flex;justify-content:space-between;padding:6px 0">
              <span style="color:var(--grey-600);font-size:0.8rem">Emergency Phone:</span>
              <span style="font-weight:700;color:var(--danger-red)" id="prof-emphone">${profile.emergencyPhone || '—'}</span>
            </div>
          </div>

          <div class="section-header">🦺 Pre-Sail Safety Gear Checklist</div>
          <div class="card" style="margin:var(--sp-md);padding:8px 12px">
            ${_renderChecklistItems()}
          </div>

          <div style="padding:0 var(--sp-md) var(--sp-xl)">
            <button class="btn btn-outline btn-full" onclick="App.logout()" style="margin-bottom:8px">
              🚪 Sign Out of FisherSafe
            </button>
            <button class="btn btn-danger btn-full" onclick="confirmClearProfile()">
              🗑️ Reset Local Cached Data
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function _renderChecklistItems() {
    const items = [
      'Life Jackets (1 per crew member)',
      'VHF Marine Radio set to Channel 16',
      'Distress Flares & Signal Mirror',
      'Navigation Anchor & Extra Fuel',
      'First Aid Kit & Emergency Fresh Water',
      'Mobile Phone Charged / NavIC Unit'
    ];
    const saved = AppStorage.loadChecklist() || {};
    return items.map((item, i) => `
      <div class="checklist-item ${saved[i] ? 'checked' : ''}" id="chk-wrap-${i}" style="padding:8px 0;border-bottom:1px solid #eee;display:flex;align-items:center;gap:10px">
        <input type="checkbox" id="chk-${i}" ${saved[i] ? 'checked' : ''}
          onchange="toggleChecklist(${i}, this.checked)" style="width:18px;height:18px" />
        <label for="chk-${i}" style="font-size:0.82rem;font-weight:500">${item}</label>
      </div>
    `).join('');
  }

  async function logout() {
    if (confirm('Log out from FisherSafe Maritime Safety System?')) {
      await AppAuth.logout();
      AppAlerts.showToast('🔒 Logged Out', 'You have been safely logged out.', 'safe', 3000);
      navigate('login');
    }
  }

  return {
    init,
    navigate,
    goBack,
    setHomeViewMode,
    testBoundaryAlert,
    logout
  };
})();

// ----------------------------------------------------------------
// Global modal & action helpers
// ----------------------------------------------------------------
function runMarineQuestion() {
  const input = document.getElementById('marine-question');
  const summary = document.getElementById('marine-summary');
  const evidence = document.getElementById('marine-evidence');
  const list = document.getElementById('marine-agents-list');
  if (!input || !summary) return;
  const gps = AppGPS.state;
  const boundary = gps.lat && gps.lon ? AppBoundary.evaluatePosition(gps.lat, gps.lon) : null;
  const result = MarineAgents.answer(input.value || 'What is the marine safety status near my fishing location?', gps, boundary);
  summary.textContent = result.summary;
  const a = result.assessment;
  evidence.innerHTML = `<div style="margin-top:12px"><span class="risk-badge risk-${a.level.toLowerCase()}">${a.level} RISK</span></div>
    <div class="evidence-grid">
      <div class="evidence-item"><b>🌬️ Wind</b><small>${a.evidence.weather.windKn} kn</small></div>
      <div class="evidence-item"><b>🌊 Waves</b><small>${a.evidence.ocean.waveM} m</small></div>
      <div class="evidence-item"><b>🌡️ SST</b><small>${a.evidence.ocean.sstC} °C</small></div>
      <div class="evidence-item"><b>🛰️ Data mode</b><small>Demo/local dataset</small></div>
    </div>
    <div style="margin-top:10px;font-size:.72rem;color:#64748b">Reasoning: ${a.reasons.length ? a.reasons.join(', ') : 'No elevated hazard detected in the demo dataset.'}</div>`;
  list.innerHTML = result.agents.map(x => `<div class="agent-row"><strong>✓ ${x.name}</strong><span>${x.role} · completed</span></div>`).join('');
}

function toggleLayersPanel() {
  const panel = document.getElementById('layers-panel');
  if (panel) panel.classList.toggle('open');
}

function sendOKSignal() {
  AppAlerts.resumeAudio();
  AppAlerts.playAlertSound('early');
  const { lat, lon } = AppGPS.state;
  const msg = `ALL OK — Position: ${AppGPS.formatCoords(lat, lon)}`;
  AppStorage.saveMessage({ type: 'own', text: msg, time: AppLogbook.getTimeStr(), isSOS: false });
  AppAlerts.showToast('✅ ALL OK Signal Saved', 'Status recorded locally.', 'safe', 3000);
}

function showPFZModal() {
  const container = document.getElementById('home-modal-container') || document.body;
  const modal = document.createElement('div');
  modal.className = 'app-modal-overlay';
  modal.id = 'pfz-modal';
  modal.innerHTML = `
    <div class="app-modal-sheet">
      <div class="modal-header-row">
        <div class="modal-title-wrap">
          <span style="font-size:1.4rem">🐟</span>
          <span class="modal-title">Potential Fishing Zones (PFZ)</span>
        </div>
        <button class="modal-close-btn" onclick="document.getElementById('pfz-modal').remove()">✕</button>
      </div>
      <div style="font-size:0.72rem;color:var(--grey-600);margin-bottom:10px">
        Source: INCOIS / ISRO / CMFRI Advisory for Tamil Nadu Fishermen
      </div>

      <div class="pfz-card">
        <div class="pfz-card-title">
          <span>🌊 Palk Bay North Zone</span>
          <span class="badge badge-safe">High Catch</span>
        </div>
        <div class="pfz-stats-row">
          <span>📍 9.4200°N, 79.4800°E</span>
          <span>🌡️ SST: 28.4°C</span>
          <span>📏 Depth: 12m</span>
        </div>
        <div style="font-size:0.75rem;color:#166534">Fish Varieties: Pelagic, Sardines, Mackerel</div>
        <button class="btn btn-sm btn-safe" style="margin-top:8px;font-size:0.72rem;padding:5px 10px"
          onclick="plotZoneWaypoint('Palk Bay PFZ', 9.42, 79.48)">📍 Plot on Map</button>
      </div>

      <div class="pfz-card">
        <div class="pfz-card-title">
          <span>🌊 Gulf of Mannar Shoals</span>
          <span class="badge badge-safe">Very High</span>
        </div>
        <div class="pfz-stats-row">
          <span>📍 8.8500°N, 78.6000°E</span>
          <span>🌡️ SST: 27.9°C</span>
          <span>📏 Depth: 24m</span>
        </div>
        <div style="font-size:0.75rem;color:#166534">Fish Varieties: Tuna, Seer Fish, Squid</div>
        <button class="btn btn-sm btn-safe" style="margin-top:8px;font-size:0.72rem;padding:5px 10px"
          onclick="plotZoneWaypoint('Mannar PFZ', 8.85, 78.60)">📍 Plot on Map</button>
      </div>

      <div style="margin-top:8px;font-size:0.7rem;color:var(--grey-600);text-align:center">
        ⚠️ Always stay at least 5 km away from Sri Lanka IMBL boundary.
      </div>
    </div>
  `;
  container.appendChild(modal);
}

function plotZoneWaypoint(name, lat, lon) {
  AppStorage.saveWaypoint({ lat, lon, name, label: '🐟' }).then(() => {
    AppAlerts.showToast('🐟 Zone Plotted!', `${name} added to waypoints.`, 'safe', 3000);
    const m = document.getElementById('pfz-modal');
    if (m) m.remove();
    App.setHomeViewMode('map');
  });
}

function showWeatherModal() {
  const container = document.getElementById('home-modal-container') || document.body;
  const modal = document.createElement('div');
  modal.className = 'app-modal-overlay';
  modal.id = 'weather-modal';
  modal.innerHTML = `
    <div class="app-modal-sheet">
      <div class="modal-header-row">
        <div class="modal-title-wrap">
          <span style="font-size:1.4rem">🌊</span>
          <span class="modal-title">Marine Weather & Waves</span>
        </div>
        <button class="modal-close-btn" onclick="document.getElementById('weather-modal').remove()">✕</button>
      </div>
      <div style="font-size:0.72rem;color:var(--grey-600);margin-bottom:12px">
        INCOIS Ocean State Forecast · Palk Strait & Gulf of Mannar
      </div>

      <div class="weather-metric-grid">
        <div class="weather-metric-box">
          <div class="weather-metric-val">1.4 m</div>
          <div class="weather-metric-lbl">Wave Height (Moderate)</div>
        </div>
        <div class="weather-metric-box">
          <div class="weather-metric-val">14 kn</div>
          <div class="weather-metric-lbl">Wind Speed (SW)</div>
        </div>
        <div class="weather-metric-box">
          <div class="weather-metric-val">8.5 NM</div>
          <div class="weather-metric-lbl">Sea Visibility</div>
        </div>
        <div class="weather-metric-box">
          <div class="weather-metric-val" style="color:var(--safe-green)">GREEN</div>
          <div class="weather-metric-lbl">Cyclone Warning Status</div>
        </div>
      </div>

      <div class="card" style="margin:0 0 10px;padding:10px;background:#F8FAFC">
        <div style="font-weight:700;font-size:0.8rem;color:var(--navy)">🕒 Tidal Forecast:</div>
        <div style="font-size:0.75rem;color:var(--grey-800);margin-top:4px">
          High Tide: 04:20 AM (0.9m) & 04:55 PM (0.85m)<br>
          Low Tide: 10:45 AM (0.3m) & 11:15 PM (0.28m)
        </div>
      </div>
    </div>
  `;
  container.appendChild(modal);
}

function showSirenModal() {
  const container = document.getElementById('home-modal-container') || document.body;
  const modal = document.createElement('div');
  modal.className = 'app-modal-overlay';
  modal.id = 'siren-modal';
  modal.innerHTML = `
    <div class="app-modal-sheet">
      <div class="modal-header-row">
        <div class="modal-title-wrap">
          <span style="font-size:1.4rem">📢</span>
          <span class="modal-title">Voice Alert & Siren Sounder</span>
        </div>
        <button class="modal-close-btn" onclick="document.getElementById('siren-modal').remove()">✕</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
        <button class="btn btn-danger btn-full" onclick="playHornSiren()">
          🚨 Play Critical Alarm Siren (Beep Test)
        </button>
        <button class="btn btn-primary btn-full" onclick="playVoiceWarning('tamil')">
          🗣️ தமிழ் குரல் எச்சரிக்கை (Tamil Voice Alert)
        </button>
        <button class="btn btn-outline btn-full" onclick="playVoiceWarning('english')">
          🗣️ English Voice Alert
        </button>
      </div>

      <div style="font-size:0.72rem;color:var(--grey-600);text-align:center;line-height:1.4">
        Synthesizes boundary proximity alerts directly through boat speaker system.
      </div>
    </div>
  `;
  container.appendChild(modal);
}

function playHornSiren() {
  AppAlerts.playAlertSound('critical');
  AppAlerts.showToast('🚨 Siren Active', 'Sounding high-intensity alarm...', 'danger', 3000);
}

function playVoiceWarning(lang) {
  if ('speechSynthesis' in window) {
    const text = lang === 'tamil'
      ? 'எச்சரிக்கை! சர்வதேச கடல் எல்லை அருகில் உள்ளது. படகை உடனடியாக திருப்பவும்.'
      : 'Warning! Approaching International Maritime Boundary Line. Turn back your vessel immediately.';
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'tamil' ? 'ta-IN' : 'en-IN';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
    AppAlerts.showToast('📢 Voice Alert', text, 'warn', 4000);
  } else {
    AppAlerts.playAlertSound('strong');
    AppAlerts.showToast('📢 Audio Alert', 'Sounding voice siren buzzer...', 'warn', 3000);
  }
}

function triggerSOSSignal() {
  const btn = document.getElementById('sos-main-btn');
  const selectedType = document.querySelector('.sos-type-btn.selected');
  const type = selectedType ? selectedType.id.replace('sos-', '').toUpperCase() : 'MAYDAY';
  if (btn) { btn.textContent = '✓ SENT'; btn.style.background = 'radial-gradient(circle,#4CAF50,#1B5E20)'; }
  AppAlerts.triggerSOS(type);

  // Send to backend if online or queue for sync
  const { lat, lon } = (typeof AppGPS !== 'undefined' && AppGPS.state) ? AppGPS.state : { lat: 0, lon: 0 };
  if (typeof AppAuth !== 'undefined' && AppAuth.isAuthenticated()) {
    if (AppAuth.isOnline()) {
      AppAPI.fisherman.triggerSOS({ emergencyType: type, lat, lon }).catch(() => {});
    } else {
      AppAPI.queueOfflineAlert({
        emergencyType: type,
        coords: { lat, lon },
        timestamp: Date.now(),
        status: 'Active',
        isSOS: true
      });
    }
  }

  App.navigate('logbook');
  setTimeout(() => {
    const list = document.getElementById('logbook-entries-list');
    if (list) AppLogbook.sendSOS();
  }, 500);
}

function selectSOSType(btn, type) {
  document.querySelectorAll('.sos-type-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function toggleChecklist(idx, checked) {
  const wrap = document.getElementById('chk-wrap-' + idx);
  if (wrap) {
    if (checked) wrap.classList.add('checked');
    else wrap.classList.remove('checked');
  }
  const saved = AppStorage.loadChecklist() || {};
  saved[idx] = checked;
  AppStorage.saveChecklist(saved);
}

function confirmClearProfile() {
  if (confirm('Clear all saved profile and trip data? This cannot be undone.')) {
    AppStorage.clearProfile();
    App.navigate('login');
  }
}

function addWaypointManual() {
  const name = prompt('Waypoint name:');
  if (!name) return;
  const { lat, lon } = AppGPS.state;
  if (!lat || !lon) {
    AppAlerts.showToast('⚠️ No GPS', 'Cannot save waypoint without GPS fix.', 'warn', 3000);
    return;
  }
  AppStorage.saveWaypoint({ lat, lon, name, label: '📍' }).then(() => {
    AppAlerts.showToast('📍 Saved!', name + ' — ' + AppGPS.formatCoords(lat, lon), 'safe', 3000);
    loadWaypointsList();
  });
}

function loadWaypointsList() {
  const list = document.getElementById('waypoints-list');
  if (!list) return;
  AppStorage.loadWaypoints().then(wps => {
    if (!wps.length) {
      list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--grey-600);font-size:0.8rem">No waypoints saved.<br><span style="font-size:0.7rem">Tap + above to add current location.</span></div>';
      return;
    }
    list.innerHTML = wps.map(wp => `
      <div class="waypoint-item">
        <div class="waypoint-icon">📍</div>
        <div class="waypoint-body">
          <div class="waypoint-name">${wp.name}</div>
          <div class="waypoint-coords">${AppGPS.formatCoords(wp.lat, wp.lon)}</div>
        </div>
        <div class="waypoint-dist">${_distToWp(wp.lat, wp.lon)}</div>
        <div class="waypoint-actions">
          <button class="waypoint-action-btn danger" onclick="deleteWaypoint(${wp.id})">🗑️</button>
        </div>
      </div>
    `).join('');
  });
}

function _distToWp(lat, lon) {
  const { lat: myLat, lon: myLon } = AppGPS.state;
  if (!myLat || !myLon) return '—';
  const km = AppBoundary.haversineKm(myLat, myLon, lat, lon);
  return km < 1 ? (km*1000).toFixed(0)+'m' : km.toFixed(1)+' km';
}

function deleteWaypoint(id) {
  if (!confirm('Delete this waypoint?')) return;
  AppStorage.deleteWaypoint(id).then(() => loadWaypointsList());
}

// ----------------------------------------------------------------
// Auth UI Helpers
// ----------------------------------------------------------------
function quickFillLogin(role) {
  const fId = document.getElementById('login-identifier');
  const fPass = document.getElementById('login-password');
  if (role === 'admin') {
    if (fId) fId.value = 'ADMIN001';
    if (fPass) fPass.value = 'Admin@FisherSafe2026!';
  } else {
    if (fId) fId.value = 'IND-TN-9821';
    if (fPass) fPass.value = 'Fisherman@123';
  }
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🔒';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}

