/* ============================================================
   EMBER · Run — live GPS run / ride / walk tracker.
   Full-bleed Leaflet map (CartoDB Positron), glass stats panel,
   an eased ember marker that GLIDES between GPS fixes via rAF,
   a smoothly-growing route polyline, and a soft map follow.
   Two sources: real geolocation, or a baked Kediri loop (Simulate)
   so the whole thing demos beautifully standing still.

   Self-contained full-screen overlay: it escapes the padded .app
   shell with a position:fixed container and tears everything down
   (intervals, rAF, geo watch, map.remove) on route change so
   re-entering never double-inits Leaflet.
   ============================================================ */
(function (App) {
  'use strict';

  const ui = App.ui;
  const { el, h, fmt, toast, haptic, icon, openSheet } = ui;
  const store = App.store, router = App.router;

  /* ---- module-level live session: survives across renders so we can
          always tear the previous one down before building a new one. ---- */
  let SESSION = null;

  /* ============================================================
     Geo math
     ============================================================ */
  const R = 6371000; // earth radius, metres
  const rad = (d) => d * Math.PI / 180;
  function haversine(a, b) {
    // a,b = [lat,lng]; returns metres
    const dLat = rad(b[0] - a[0]);
    const dLng = rad(b[1] - a[1]);
    const lat1 = rad(a[0]), lat2 = rad(b[0]);
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  /* ============================================================
     A baked ~3.5 km running loop through Kediri, East Java.
     Centre ~ (-7.8166, 112.0117). Hand-traced to feel like it
     follows streets — a believable out-and-back loop. Densified
     at runtime so playback glides instead of stepping.
     ============================================================ */
  const KEDIRI_LOOP = [
    [-7.81660, 112.01170], [-7.81600, 112.01210], [-7.81540, 112.01250],
    [-7.81470, 112.01300], [-7.81400, 112.01345], [-7.81330, 112.01380],
    [-7.81270, 112.01430], [-7.81230, 112.01510], [-7.81210, 112.01600],
    [-7.81230, 112.01690], [-7.81290, 112.01740], [-7.81360, 112.01770],
    [-7.81440, 112.01790], [-7.81520, 112.01820], [-7.81600, 112.01860],
    [-7.81680, 112.01880], [-7.81760, 112.01870], [-7.81830, 112.01830],
    [-7.81880, 112.01760], [-7.81910, 112.01680], [-7.81950, 112.01610],
    [-7.82010, 112.01560], [-7.82080, 112.01540], [-7.82160, 112.01530],
    [-7.82240, 112.01510], [-7.82300, 112.01460], [-7.82330, 112.01380],
    [-7.82330, 112.01300], [-7.82300, 112.01220], [-7.82250, 112.01160],
    [-7.82180, 112.01120], [-7.82100, 112.01100], [-7.82020, 112.01090],
    [-7.81940, 112.01080], [-7.81860, 112.01070], [-7.81790, 112.01050],
    [-7.81730, 112.01010], [-7.81700, 112.00940], [-7.81710, 112.00860],
    [-7.81760, 112.00810], [-7.81830, 112.00790], [-7.81910, 112.00800],
    [-7.81970, 112.00850], [-7.81990, 112.00930], [-7.81960, 112.01010],
    [-7.81900, 112.01060], [-7.81830, 112.01090], [-7.81760, 112.01110],
    [-7.81700, 112.01140], [-7.81660, 112.01170]
  ];

  // densify the loop so each segment is short and playback glides
  function densify(pts, step) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const d = haversine(a, b);
      const n = Math.max(1, Math.round(d / step));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  /* ============================================================
     Pace formatting (min/km, unit-aware) — derived from speed.
     speed in m/s. Returns "m:ss" or "--:--".
     ============================================================ */
  function paceFromSpeed(mps) {
    if (!mps || mps < 0.18) return '--:--'; // basically stopped
    const imp = store.settings().units === 'imperial';
    const perUnit = imp ? 1609.34 : 1000;       // metres per mi/km
    const secPerUnit = perUnit / mps;
    if (secPerUnit > 35 * 60) return '--:--';   // absurdly slow → hide
    const m = Math.floor(secPerUnit / 60);
    const s = Math.round(secPerUnit % 60);
    return m + ':' + String(s).padStart(2, '0');
  }
  function paceUnitLabel() {
    return '/' + (store.settings().units === 'imperial' ? 'mi' : 'km');
  }

  /* ============================================================
     The live session object — owns map, marker, polyline, timers,
     rAF glide, and all derived stats. One per render.
     ============================================================ */
  function createSession(opts) {
    const s = {
      type: opts.type || 'run',
      map: opts.map,
      // raw geo path (the truth) and the displayed (eased) latlng
      pts: [],                 // [[lat,lng,t], ...] recorded fixes
      distanceM: 0,
      startedAt: null,
      endedAt: null,
      elapsedBase: 0,          // accumulated ms across pause cycles
      runningSince: 0,         // ts of current running segment start
      paused: false,
      running: false,
      finished: false,
      // smoothing
      glideRAF: 0,
      displayLatLng: null,
      lastSpeed: 0,
      recentSpeeds: [],
      follow: true,
      // sources
      mode: null,              // 'gps' | 'sim'
      geoWatch: null,
      simRAF: 0,
      simPath: null,
      simIndex: 0,
      // leaflet objects
      marker: null,
      polyline: null,
      // dom stat nodes (wired by buildUI)
      nodes: {},
      tickInt: 0
    };

    /* ---- elapsed time (ms) accounting for pauses ---- */
    s.elapsedMs = function () {
      let ms = s.elapsedBase;
      if (s.running && !s.paused && s.runningSince) ms += (Date.now() - s.runningSince);
      return ms;
    };

    /* ---- push a new geographic point; updates distance + speed ---- */
    s.pushPoint = function (latlng, ts, speedHint) {
      ts = ts || Date.now();
      const p = [latlng[0], latlng[1], ts];
      if (s.pts.length) {
        const prev = s.pts[s.pts.length - 1];
        const d = haversine([prev[0], prev[1]], [p[0], p[1]]);
        // ignore GPS jitter < 1.2m (keeps distance honest, line clean)
        if (d < 1.2 && speedHint == null) return;
        s.distanceM += d;
        const dt = (ts - prev[2]) / 1000;
        let spd = speedHint != null ? speedHint : (dt > 0 ? d / dt : 0);
        // smooth speed across last few samples
        s.recentSpeeds.push(spd);
        if (s.recentSpeeds.length > 5) s.recentSpeeds.shift();
        s.lastSpeed = s.recentSpeeds.reduce((a, b) => a + b, 0) / s.recentSpeeds.length;
        // extend the polyline truth
        if (s.polyline) s.polyline.addLatLng(latlng);
        s.glideTo(latlng);
      } else {
        // first fix: seed everything, no glide
        s.displayLatLng = latlng.slice();
        if (s.marker) s.marker.setLatLng(latlng);
        if (s.polyline) s.polyline.setLatLngs([latlng]);
        if (s.map && s.follow) s.map.setView(latlng, 16, { animate: false });
        if (speedHint != null) s.lastSpeed = speedHint;
      }
      s.pts.push(p);
    };

    /* ---- glide the marker from its current display pos to target ---- */
    s.glideTo = function (target) {
      if (!s.marker) return;
      if (s.glideRAF) cancelAnimationFrame(s.glideRAF);
      const from = s.displayLatLng ? s.displayLatLng.slice() : target.slice();
      const dur = 850; // a touch longer than the sim step → continuous motion
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const e = easeInOut(p);
        const lat = lerp(from[0], target[0], e);
        const lng = lerp(from[1], target[1], e);
        s.displayLatLng = [lat, lng];
        s.marker.setLatLng([lat, lng]);
        // soft follow: pan only while running and follow is on
        if (s.map && s.follow && s.running && !s.paused) {
          s.map.panTo([lat, lng], { animate: true, duration: 0.55, easeLinearity: 0.22, noMoveStart: true });
        }
        if (p < 1) s.glideRAF = requestAnimationFrame(step);
        else s.glideRAF = 0;
      };
      s.glideRAF = requestAnimationFrame(step);
    };

    /* ---- start / pause / resume ---- */
    s.start = function () {
      if (s.running) return;
      s.running = true; s.paused = false;
      s.startedAt = s.startedAt || Date.now();
      s.runningSince = Date.now();
      s.startTick();
    };
    s.pause = function () {
      if (!s.running || s.paused) return;
      s.paused = true;
      s.elapsedBase += (Date.now() - s.runningSince);
      s.runningSince = 0;
      s.stopSource(false); // hold the source paused (sim freezes, gps keeps watch but ignored)
    };
    s.resume = function () {
      if (!s.running || !s.paused) return;
      s.paused = false;
      s.runningSince = Date.now();
      s.resumeSource();
    };

    /* ---- the 1-per-second-ish stat painter (driven faster for smooth time) ---- */
    s.startTick = function () {
      if (s.tickInt) clearInterval(s.tickInt);
      s.paint();
      s.tickInt = setInterval(s.paint, 250);
    };

    s.distanceKm = function () { return s.distanceM / 1000; };

    s.avgSpeed = function () {
      const sec = s.elapsedMs() / 1000;
      if (sec < 3) return 0;
      return s.distanceM / sec;
    };

    s.paint = function () {
      const n = s.nodes;
      if (!n.dist) return;
      // distance — primary, big
      n.dist.textContent = fmt.distance(s.distanceKm(), false);
      // clock
      const sec = Math.round(s.elapsedMs() / 1000);
      n.time.textContent = fmt.duration(sec);
      // current + avg pace
      if (n.pace) n.pace.textContent = (s.paused ? '--:--' : paceFromSpeed(s.lastSpeed));
      if (n.avg) n.avg.textContent = paceFromSpeed(s.avgSpeed());
    };

    /* ---- GPS source ---- */
    s.startGPS = function () {
      s.mode = 'gps';
      if (!navigator.geolocation) {
        toast('No GPS on this device — simulating', { icon: 'info' });
        return s.startSim();
      }
      let gotFirst = false;
      const onPos = (pos) => {
        if (s.paused || !s.running) return;
        const c = pos.coords;
        gotFirst = true;
        s.pushPoint([c.latitude, c.longitude], pos.timestamp, (c.speed != null && c.speed >= 0) ? c.speed : null);
      };
      const onErr = (err) => {
        if (gotFirst) return; // a later transient error: ignore
        toast(err && err.code === 1 ? 'Location denied — simulating run' : 'GPS unavailable — simulating', { icon: 'info' });
        s.mode = null;
        s.startSim();
      };
      try {
        s.geoWatch = navigator.geolocation.watchPosition(onPos, onErr, {
          enableHighAccuracy: true, maximumAge: 1000, timeout: 12000
        });
      } catch (e) {
        toast('GPS error — simulating', { icon: 'info' });
        s.startSim();
      }
    };

    /* ---- Simulate source: play the baked Kediri loop ---- */
    s.startSim = function () {
      s.mode = 'sim';
      s.simPath = densify(KEDIRI_LOOP, 8); // ~8m steps
      s.simIndex = 0;
      // realistic running pace ~ 3.1 m/s (5:22/km) with gentle variance
      s.simSpeedMps = 3.0 + (s.type === 'cycle' ? 3.4 : s.type === 'walk' ? -1.4 : 0);
      s.simAccum = 0;
      s.simLastFrame = performance.now();
      const tick = (now) => {
        if (!s.running) { s.simRAF = requestAnimationFrame(tick); return; }
        if (s.paused) { s.simLastFrame = now; s.simRAF = requestAnimationFrame(tick); return; }
        const dt = Math.min(0.1, (now - s.simLastFrame) / 1000);
        s.simLastFrame = now;
        // jitter the speed a little so pace numbers feel alive
        const jitter = 1 + Math.sin(now / 1400) * 0.12;
        const advance = s.simSpeedMps * jitter * dt; // metres this frame
        s.simAccum += advance;
        // emit a point whenever we've covered ~ one sim step worth of metres
        while (s.simAccum >= 8 && s.simIndex < s.simPath.length - 1) {
          s.simAccum -= 8;
          s.simIndex++;
          const ll = s.simPath[s.simIndex];
          s.pushPoint(ll, Date.now(), s.simSpeedMps * jitter);
          if (s.simIndex >= s.simPath.length - 1) {
            // loop finished — gently auto-finish for the demo
            haptic([12, 30, 12]);
            setTimeout(() => { if (!s.finished) openFinish(s); }, 400);
          }
        }
        s.simRAF = requestAnimationFrame(tick);
      };
      // seed the first point immediately so the map jumps to Kediri
      s.pushPoint(s.simPath[0], Date.now(), 0);
      s.simRAF = requestAnimationFrame(tick);
    };

    s.stopSource = function (hard) {
      if (s.mode === 'gps' && hard && s.geoWatch != null) {
        try { navigator.geolocation.clearWatch(s.geoWatch); } catch (e) {}
        s.geoWatch = null;
      }
      // sim respects s.paused inside its own loop; nothing to clear on soft pause
    };
    s.resumeSource = function () {
      if (s.mode === 'sim') s.simLastFrame = performance.now();
    };

    /* ---- full teardown ---- */
    s.destroy = function () {
      s.running = false; s.finished = true;
      if (s.tickInt) { clearInterval(s.tickInt); s.tickInt = 0; }
      if (s.glideRAF) { cancelAnimationFrame(s.glideRAF); s.glideRAF = 0; }
      if (s.simRAF) { cancelAnimationFrame(s.simRAF); s.simRAF = 0; }
      if (s.geoWatch != null) { try { navigator.geolocation.clearWatch(s.geoWatch); } catch (e) {} s.geoWatch = null; }
      if (s.map) { try { s.map.remove(); } catch (e) {} s.map = null; }
    };

    return s;
  }

  /* ============================================================
     The glowing ember marker (divIcon + CSS pulse, no image)
     ============================================================ */
  function emberDivIcon(L) {
    return L.divIcon({
      className: 'ember-marker-wrap',
      html: '<div class="ember-marker"><span class="halo"></span><span class="halo halo2"></span><span class="dot"></span></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  /* ============================================================
     Finish → summary sheet → save
     ============================================================ */
  function openFinish(s) {
    if (s.finished) return;
    s.finished = true;
    // freeze timing
    if (s.running && !s.paused && s.runningSince) { s.elapsedBase += (Date.now() - s.runningSince); s.runningSince = 0; }
    s.running = false;
    s.endedAt = Date.now();
    if (s.tickInt) { clearInterval(s.tickInt); s.tickInt = 0; }
    haptic([12, 30, 12]);

    const km = s.distanceKm();
    const sec = Math.round(s.elapsedMs() / 1000);
    const avgPace = paceFromSpeed(s.avgSpeed());
    const meta = store.ACT[s.type] || store.ACT.run;

    const statBlock = (label, value, sub) => el('div', { class: 'run-sum-tile' }, [
      el('div', { class: 'label', text: label }),
      el('div', { class: 'tnum run-sum-v', text: value }),
      sub ? el('div', { class: 'muted t-xs', text: sub }) : null
    ]);

    openSheet({
      title: 'Finish ' + meta.label.toLowerCase() + '?',
      hint: 'Looking good. Save it to your feed.',
      content: el('div', {}, [
        el('div', { class: 'run-sum-grid' }, [
          statBlock('Distance', fmt.distance(km, false), fmt.distUnit()),
          statBlock('Time', fmt.duration(sec), null),
          statBlock('Avg pace', avgPace, paceUnitLabel())
        ]),
        el('div', { class: 'field mt-4' }, [
          el('label', { text: 'Note (optional)' }),
          el('input', { class: 'input', id: 'run-note', type: 'text', placeholder: 'How did it feel?' })
        ])
      ]),
      actions: [
        { label: 'Keep going', class: 'ghost', onClick: () => {
          // resume the session
          s.finished = false;
          if (!s.paused) { s.runningSince = Date.now(); }
          s.running = true; s.startTick();
        } },
        { label: 'Save ' + meta.label, class: 'flame', onClick: () => {
          const note = (ui.$('#run-note') || {}).value || '';
          const startedAt = s.startedAt || (s.endedAt - sec * 1000);
          store.addActivity({
            type: s.type,
            date: store.today(),
            distanceKm: +km.toFixed(3),
            durationSec: sec,
            startedAt: startedAt,
            endedAt: s.endedAt,
            title: meta.label + ' · ' + fmt.distance(km),
            note: note
          });
          teardown();
          ui.burst(['#ff6a13', '#ff9e2c', '#ffc14d']);
          toast(meta.label + ' saved', { type: 'good', icon: 'check' });
          haptic([10, 30, 10]);
          router.go('/feed');
        } }
      ]
    });
  }

  /* ============================================================
     The full-screen overlay container lives OUTSIDE the padded
     .app shell (position:fixed). We create it fresh each render
     and remove it on teardown so Leaflet never reuses a container.
     ============================================================ */
  let OVERLAY = null;
  let UNSUB = null;

  function teardown() {
    if (SESSION) { try { SESSION.destroy(); } catch (e) {} SESSION = null; }
    if (OVERLAY && OVERLAY.parentNode) OVERLAY.parentNode.removeChild(OVERLAY);
    OVERLAY = null;
    if (UNSUB) { try { UNSUB(); } catch (e) {} UNSUB = null; }
    document.documentElement.classList.remove('run-active');
  }

  /* ============================================================
     Render
     ============================================================ */
  function render(root, params) {
    // Always tear any previous instance down first (route re-entry safe).
    teardown();

    const L = window.L;

    // A placeholder inside the normal outlet (keeps router happy / nav working).
    const placeholder = el('div', { class: 'run-placeholder' }, [
      ui.empty('route', 'Live tracking', 'Map session is open.')
    ]);
    root.appendChild(placeholder);

    if (!L) {
      ui.clear(root);
      root.appendChild(ui.empty('info', 'Map unavailable', 'Leaflet failed to load. Check your connection and reload.'));
      return;
    }

    // Build the fixed overlay (escapes .app padding → true full-bleed).
    OVERLAY = el('div', { class: 'run-screen' });
    document.body.appendChild(OVERLAY);
    document.documentElement.classList.add('run-active');

    // Fresh map container element every time.
    const mapEl = el('div', { class: 'run-map', id: 'run-map' });
    OVERLAY.appendChild(mapEl);

    // ---- Leaflet map ----
    const map = L.map(mapEl, {
      zoomControl: false,
      attributionControl: true,
      zoomSnap: 0.25,
      preferCanvas: false,
      fadeAnimation: true,
      zoomAnimation: true,
      inertia: true,
      tap: true
    }).setView([-7.8166, 112.0117], 15);

    map.attributionControl.setPrefix(''); // drop the "Leaflet" flag
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      crossOrigin: true
    }).addTo(map);

    // ---- session ----
    const startType = (params && params.type) || 'run';
    const s = createSession({ type: startType, map: map });
    SESSION = s;

    // marker + polyline (added once)
    s.marker = L.marker([-7.8166, 112.0117], { icon: emberDivIcon(L), interactive: false, keyboard: false });
    s.marker.addTo(map);
    s.polyline = L.polyline([], {
      color: '#ff6a13', weight: 5, opacity: 0.95,
      lineCap: 'round', lineJoin: 'round', smoothFactor: 1
    }).addTo(map);

    // If user manually pans/zooms, stop fighting them; expose recenter.
    map.on('dragstart', () => { s.follow = false; refreshRecenter(); });
    map.on('zoomstart', (e) => { /* programmatic zoom won't set this flag the same way */ });

    // ---- build the UI chrome over the map ----
    buildUI(OVERLAY, s, L);

    // keep recenter button state synced
    function refreshRecenter() {
      const btn = OVERLAY.querySelector('.run-recenter');
      if (btn) btn.classList.toggle('show', !s.follow);
    }
    s._refreshRecenter = refreshRecenter;

    // Leaflet needs a size kick once it's in the DOM & laid out.
    requestAnimationFrame(() => { map.invalidateSize(); });
    setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 250);

    // ---- teardown when the route changes away from #/run ----
    const onHash = () => {
      const name = (location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[0]) || 'dashboard';
      if (name !== 'run') {
        window.removeEventListener('hashchange', onHash);
        teardown();
      }
    };
    window.addEventListener('hashchange', onHash);
    UNSUB = () => window.removeEventListener('hashchange', onHash);
  }

  /* ============================================================
     UI chrome: top stats panel, segmented type, bottom controls
     ============================================================ */
  function buildUI(overlay, s, L) {
    /* ---- top bar: back + recenter ---- */
    const back = el('button', { class: 'run-iconbtn', 'aria-label': 'Back', html: icon('chevL', 22) });
    back.addEventListener('click', () => { haptic(8); confirmLeave(s); });

    const recenter = el('button', { class: 'run-iconbtn run-recenter', 'aria-label': 'Recenter', html: icon('pin', 20) });
    recenter.addEventListener('click', () => {
      haptic(8); s.follow = true;
      if (s.displayLatLng) s.map.panTo(s.displayLatLng, { animate: true, duration: 0.5 });
      if (s._refreshRecenter) s._refreshRecenter();
    });

    const topRow = el('div', { class: 'run-top' }, [ back, recenter ]);
    overlay.appendChild(topRow);

    /* ---- stats glass panel (top, below the bar) ---- */
    const distNode = el('div', { class: 'tnum run-dist', text: '0.0' });
    const distUnit = el('span', { class: 'run-dist-unit', text: fmt.distUnit() });
    const timeNode = el('div', { class: 'tnum run-sub-v', text: '0:00' });
    const paceNode = el('div', { class: 'tnum run-sub-v', text: '--:--' });
    const avgNode = el('div', { class: 'tnum run-sub-v', text: '--:--' });

    s.nodes = { dist: distNode, time: timeNode, pace: paceNode, avg: avgNode };

    const subStat = (label, node, unit) => el('div', { class: 'run-sub' }, [
      el('div', { class: 'label', text: label }),
      el('div', { class: 'run-sub-line' }, [ node, unit ? el('span', { class: 'run-sub-u', text: unit }) : null ])
    ]);

    const panel = el('div', { class: 'run-panel' }, [
      el('div', { class: 'run-dist-wrap' }, [
        el('div', { class: 'label', text: 'Distance' }),
        el('div', { class: 'run-dist-line' }, [ distNode, distUnit ])
      ]),
      el('div', { class: 'run-sub-grid' }, [
        subStat('Time', timeNode, null),
        subStat('Pace', paceNode, paceUnitLabel()),
        subStat('Avg', avgNode, paceUnitLabel())
      ])
    ]);
    overlay.appendChild(panel);

    /* ---- bottom controls dock ---- */
    const dock = el('div', { class: 'run-dock' });
    overlay.appendChild(dock);

    // type segmented (Run / Walk / Cycle)
    const seg = ui.segmented(
      [ { value: 'run', label: 'Run' }, { value: 'walk', label: 'Walk' }, { value: 'cycle', label: 'Cycle' } ],
      s.type,
      (v) => { s.type = v; }
    );
    const segWrap = el('div', { class: 'run-seg' }, seg);

    // primary + secondary buttons
    const startBtn = el('button', { class: 'btn block lg run-start', html: icon('play', 24) + '<span>Start ' + (store.ACT[s.type] ? store.ACT[s.type].label.toLowerCase() : 'run') + '</span>' });
    const liveRow = el('div', { class: 'run-live-row hide' });
    const pauseBtn = el('button', { class: 'btn block glass run-pause', html: icon('pause', 22) + '<span>Pause</span>' });
    const finishBtn = el('button', { class: 'btn block run-finish', html: icon('check', 22) + '<span>Finish</span>' });
    liveRow.appendChild(pauseBtn);
    liveRow.appendChild(finishBtn);

    dock.appendChild(segWrap);
    dock.appendChild(startBtn);
    dock.appendChild(liveRow);

    // simulate hint / toggle (only matters before start)
    const simNote = el('button', { class: 'run-sim-hint', html: icon('zapLine', 14) + '<span>Standing still? Tap Start, then Simulate</span>' });
    let useSim = false;
    const simBtn = el('button', { class: 'run-sim-btn', html: icon('zapLine', 16) + '<span>Simulate run</span>' });
    simBtn.addEventListener('click', () => {
      haptic(10);
      useSim = true;
      simBtn.classList.add('on');
      simBtn.querySelector('span').textContent = 'Simulating';
      // if already started in GPS mode, switch to sim
      if (s.running && s.mode !== 'sim') {
        if (s.geoWatch != null) { try { navigator.geolocation.clearWatch(s.geoWatch); } catch (e) {} s.geoWatch = null; }
        s.startSim();
      }
    });
    const simRow = el('div', { class: 'run-sim-row' }, [ simBtn ]);
    dock.appendChild(simRow);

    /* ---- wire the controls ---- */
    function enterLive() {
      startBtn.classList.add('hide');
      segWrap.classList.add('locked');
      simRow.classList.add('hide');
      liveRow.classList.remove('hide');
    }

    startBtn.addEventListener('click', () => {
      haptic([12, 24, 12]);
      s.start();
      if (useSim) s.startSim();
      else s.startGPS();
      enterLive();
    });

    pauseBtn.addEventListener('click', () => {
      haptic(10);
      if (s.paused) {
        s.resume();
        pauseBtn.innerHTML = icon('pause', 22) + '<span>Pause</span>';
        pauseBtn.classList.remove('resumed');
      } else {
        s.pause();
        pauseBtn.innerHTML = icon('play', 22) + '<span>Resume</span>';
        pauseBtn.classList.add('resumed');
      }
      s.paint();
    });

    finishBtn.addEventListener('click', () => {
      haptic([12, 30, 12]);
      const km = s.distanceKm();
      if (km < 0.01 && s.elapsedMs() < 2000) {
        toast('Nothing to save yet', { icon: 'info' });
        return;
      }
      openFinish(s);
    });

    // update start label when type changes
    seg.addEventListener('click', () => {
      const lbl = store.ACT[s.type] ? store.ACT[s.type].label.toLowerCase() : 'run';
      const span = startBtn.querySelector('span');
      if (span) span.textContent = 'Start ' + lbl;
    });
  }

  function confirmLeave(s) {
    if (!s.running || s.finished) { router.go('/dashboard'); return; }
    ui.confirm({
      title: 'Discard this ' + (store.ACT[s.type] ? store.ACT[s.type].label.toLowerCase() : 'run') + '?',
      message: 'Your live tracking will be lost.',
      confirmText: 'Discard', danger: true
    }).then(ok => { if (ok) router.go('/dashboard'); });
  }

  App.registerView('run', { render, title: 'Run' });
})(window.App);
