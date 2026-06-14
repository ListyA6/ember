/* ============================================================
   EMBER · App bootstrap + shared flows (quick-add, log weight,
   log activity), celebrations, service worker, reactive refresh.
   Loaded LAST, after all views have self-registered.
   ============================================================ */
window.App = window.App || {};
(function (App) {
  'use strict';
  const store = App.store, ui = App.ui, el = ui.el;

  /* ---------------- settings → DOM ---------------- */
  function applySettings() {
    const m = store.settings();
    document.documentElement.dataset.accent = m.accent || 'default';
    document.documentElement.dataset.theme = m.theme || 'light';
    const tc = document.querySelector('meta[name=theme-color]');
    if (tc) tc.setAttribute('content', m.theme === 'dark' ? '#14110d' : '#f6f4f1');
  }
  App.applySettings = applySettings;

  /* ---------------- role: switch + go home ----------------
     Lets the owner flip trainer↔client live when demoing the ecosystem. */
  function goHome() { App.router.go(store.isTrainer() ? '/trainer' : '/dashboard'); }
  App.goHome = goHome;
  function switchRole(r) {
    store.setRole(r);
    App.router.buildNav();
    goHome();
    ui.toast(r === 'client' ? 'Client view' : 'Trainer view', { type: 'flame', icon: r === 'client' ? 'user' : 'users' });
  }
  App.switchRole = switchRole;

  /* ---------------- shared: log body weight ---------------- */
  function logWeight() {
    const last = store.latestWeight();
    ui.openSheet({
      center: true, title: 'Log weight', hint: 'Body weight, ideally morning & fasted',
      content: el('div', {}, [
        el('div', { class: 'field' }, [
          el('input', { class: 'input big', id: 'w-in', type: 'number', inputmode: 'decimal', step: '0.1', placeholder: last ? String(last.kg) : '75.0', value: last ? last.kg : '' })
        ])
      ]),
      actions: [
        { label: 'Cancel', class: 'ghost' },
        { label: 'Save', class: 'flame', onClick: () => {
          const v = parseFloat(ui.$('#w-in').value);
          if (isNaN(v)) { ui.$('#w-in').classList.add('shake'); return false; }
          store.logWeight(v); ui.toast('Weight logged', { type: 'good', icon: 'check' });
        } }
      ]
    });
  }

  /* ---------------- shared: log a cardio/walk/run/cycle ---------------- */
  function logActivity(type) {
    type = type || 'walk';
    const meta = store.ACT[type];
    const hasDistance = type === 'walk' || type === 'run' || type === 'cycle';
    let photo = null;
    ui.openSheet({
      title: 'Log ' + meta.label.toLowerCase(),
      hint: 'Add it to your feed',
      content: (api) => {
        const wrap = el('div', { class: 'stagger' });
        // type switcher
        const types = ['walk', 'run', 'cycle', 'cardio'];
        const seg = ui.segmented(types.map(t => ({ value: t, label: store.ACT[t].label })), type, (v) => { api.close(); logActivity(v); });
        wrap.appendChild(el('div', { class: 'mb-4' }, seg));
        if (hasDistance) wrap.appendChild(field('Distance (' + ui.fmt.distUnit() + ')', 'a-dist', { type: 'number', inputmode: 'decimal', step: '0.1', placeholder: '3.0' }));
        wrap.appendChild(field('Duration (min)', 'a-dur', { type: 'number', inputmode: 'numeric', placeholder: '30' }));
        wrap.appendChild(field('Date', 'a-date', { type: 'date', value: store.today() }));
        wrap.appendChild(field('Note (optional)', 'a-note', { type: 'text', placeholder: 'How did it feel?' }));
        // photo
        const photoRow = el('label', { class: 'item', style: { cursor: 'pointer', borderBottom: '0' } }, [
          el('div', { class: 'iconbtn', html: ui.icon('camera', 20) }),
          el('div', { class: 'body' }, [ el('div', { class: 't', text: 'Add photo' }), el('div', { class: 's', text: 'Optional' }) ]),
          (() => { const inp = el('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } });
            inp.addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; photo = await ui.resizeImage(f, 900); photoRow.querySelector('.t').textContent = 'Photo added'; photoRow.querySelector('.iconbtn').classList.add('pulse'); ui.haptic(); }); return inp; })()
        ]);
        wrap.appendChild(photoRow);
        return wrap;
      },
      actions: [
        { label: 'Cancel', class: 'ghost' },
        { label: 'Save ' + meta.label, class: 'flame', onClick: () => {
          const dur = parseFloat((ui.$('#a-dur') || {}).value) || 0;
          const dist = hasDistance ? (parseFloat((ui.$('#a-dist') || {}).value) || 0) : 0;
          if (!dur && !dist) { ui.toast('Add a distance or duration'); return false; }
          const date = (ui.$('#a-date') || {}).value || store.today();
          const note = (ui.$('#a-note') || {}).value || '';
          const a = store.addActivity({ type, date, durationSec: Math.round(dur * 60), distanceKm: dist, note, photo,
            startedAt: store.D.parse(date).getTime(), endedAt: store.D.parse(date).getTime() + dur * 60000,
            title: meta.label + (dist ? ' · ' + ui.fmt.distance(dist) : '') });
          ui.toast(meta.label + ' logged', { type: 'good', icon: 'check' });
          ui.haptic([10, 30, 10]);
        } }
      ]
    });
  }
  function field(label, id, attrs) {
    return el('div', { class: 'field' }, [ el('label', { text: label }), el('input', Object.assign({ class: 'input', id }, attrs || {})) ]);
  }

  /* ---------------- trainer: add a client ---------------- */
  function addClient() {
    const progKeys = Object.keys(store.PROGRAMS).filter(k => k !== 'rest');
    let program = progKeys[0];
    ui.openSheet({
      title: 'Add a client', hint: 'Set them up — assign a plan now or later',
      content: (api) => {
        const wrap = el('div', { class: 'stagger' });
        wrap.appendChild(App.flows.field('Name', 'c-name', { type: 'text', placeholder: 'Client name', autocomplete: 'name' }));
        wrap.appendChild(App.flows.field('Phase (optional)', 'c-phase', { type: 'text', placeholder: 'e.g. Cut · Week 1' }));
        wrap.appendChild(App.flows.field('Goal (optional)', 'c-goal', { type: 'text', placeholder: 'What are they chasing?' }));
        const pf = el('div', { class: 'field', style: { marginBottom: '0' } }, [ el('label', { text: 'Assigned program' }) ]);
        pf.appendChild(ui.segmented(progKeys.map(k => ({ value: k, label: store.PROGRAMS[k].name.split(' · ')[0] })), program, v => { program = v; }));
        wrap.appendChild(pf);
        return wrap;
      },
      actions: [
        { label: 'Cancel', class: 'ghost' },
        { label: 'Add client', class: 'flame', onClick: () => {
          const name = ((ui.$('#c-name') || {}).value || '').trim();
          if (!name) { (ui.$('#c-name') || {}).classList && ui.$('#c-name').classList.add('shake'); return false; }
          const id = store.addProfile({
            name, role: 'client',
            phase: ((ui.$('#c-phase') || {}).value || '').trim(),
            goal: ((ui.$('#c-goal') || {}).value || '').trim(),
            program, programLabel: store.PROGRAMS[program].name
          });
          ui.toast('Client added', { type: 'good', icon: 'check' });
          ui.haptic([10, 30, 10]);
          setTimeout(() => App.router.go('/clientdetail/' + id), 120);
        } }
      ]
    });
  }
  App.addClient = addClient;

  /* ---------------- quick add (FAB) ---------------- */
  function quickAdd() {
    if (store.isTrainer()) return addClient();   // trainers add clients, not log workouts
    const opt = (icon, label, sub, fn, accent) => {
      const b = el('button', { class: 'card nested', style: { display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', padding: '16px', textAlign: 'left' } }, [
        el('div', { class: 'iconbtn', style: accent ? { background: 'var(--grad-flame)', color: 'var(--on-flame)', border: '0' } : {}, html: ui.icon(icon, 22) }),
        el('div', {}, [ el('div', { class: 'semi', text: label }), el('div', { class: 'muted t-xs', text: sub }) ])
      ]);
      b.addEventListener('click', () => { api.close(); ui.haptic(); fn(); });
      return b;
    };
    const grid = el('div', { class: 'grid-2', style: { marginTop: '4px' } });
    const api = ui.openSheet({
      title: 'Log something', hint: 'What did you do?',
      content: grid
    });
    grid.appendChild(opt('dumbbell', 'Workout', 'Lift & log sets', () => App.router.go('/workout'), true));
    grid.appendChild(opt('run', 'Track run', 'Live GPS map', () => App.router.go('/run'), true));
    grid.appendChild(opt('walk', 'Walk', 'Steps & distance', () => logActivity('walk')));
    grid.appendChild(opt('route', 'Cycle', 'Ride distance', () => logActivity('cycle')));
    grid.appendChild(opt('zapLine', 'Cardio', 'Any session', () => logActivity('cardio')));
    grid.appendChild(opt('scale', 'Weight', 'Track bodyweight', () => logWeight()));
  }

  /* ---------------- celebrations ---------------- */
  function celebrate(title, sub) {
    ui.burst();
    ui.openSheet({
      center: true,
      content: el('div', { class: 'center col', style: { textAlign: 'center', gap: '6px', padding: '8px 0' } }, [
        el('div', { class: 'medal', style: { width: '84px', height: '84px', marginBottom: '8px' }, html: ui.icon('trophy', 40) }),
        el('h3', { text: title }),
        sub ? el('div', { class: 'muted', text: sub }) : null
      ]),
      actions: [{ label: 'Nice', class: 'flame' }]
    });
  }
  App.celebrate = celebrate;
  App.celebratePRs = function (activity) {
    if (!activity || !activity.prs || !activity.prs.length) return;
    ui.burst(['#ffc14d', '#ff9e2c', '#ff6a13']);
    ui.toast(activity.prs.length + ' new personal record' + (activity.prs.length > 1 ? 's' : '') + '!', { type: 'flame', icon: 'star', duration: 3000 });
  };

  App.flows = { logWeight, logActivity, quickAdd, field };
  App.quickAdd = quickAdd;

  /* ---------------- reactive refresh ----------------
     Listeners are attached in boot(), AFTER seeding, so first-run
     seed data doesn't fire a barrage of refreshes / celebrations. */
  let raf = 0;
  function onChange() {
    applySettings();
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; App.router.refresh(); });
  }
  function onBadges(e) {
    if (e.profileId !== store.meId()) return;
    const b = e.badges[0];
    setTimeout(() => celebrate('Badge unlocked: ' + b.name, b.desc), 400);
  }

  /* ---------------- service worker ---------------- */
  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  /* ---------------- boot ---------------- */
  function boot() {
    if (App.seed) App.seed.ensure();          // populate first-run data (before listeners)
    if (App.seed && App.seed.ensureClients) App.seed.ensureClients(); // demo roster for trainer side
    store.on('change', onChange);             // attach AFTER seed
    store.on('badges', onBadges);
    applySettings();
    App.router.buildNav();
    if (!store.settings().onboarded && App.views.onboarding) {
      App.router.replace('/onboarding');
    } else if (store.isTrainer() && (!location.hash || location.hash === '#/' || location.hash === '#/dashboard')) {
      App.router.replace('/trainer');         // trainers land on the client roster
    }
    App.router.start();
    registerSW();
    // midnight rollover → re-render so "Today" stays correct
    let lastDay = store.today();
    setInterval(() => { const t = store.today(); if (t !== lastDay) { lastDay = t; App.router.refresh(); } }, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.App);
