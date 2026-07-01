/* ============================================================
   Ember Pact · App bootstrap + shared flows, celebrations,
   service worker, reactive refresh, pact ledger load + backfill.
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

  /* ---------------- PWA install ---------------- */
  // stash the browser's install prompt so Settings can fire it on a user tap
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); App.installPrompt = e; });
  window.addEventListener('appinstalled', () => { App.installPrompt = null; });
  App.pwa = {
    isStandalone() {
      try { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }
      catch (e) { return false; }
    },
    isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent || '') && !window.MSStream; },
    canPrompt() { return !!App.installPrompt; },
    async promptInstall() {
      const p = App.installPrompt; if (!p) return { outcome: 'unavailable' };
      p.prompt(); let choice; try { choice = await p.userChoice; } catch (e) { choice = { outcome: 'dismissed' }; }
      App.installPrompt = null; return choice;
    }
  };

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

  /* ---------------- quick add (FAB) ---------------- */
  function quickAdd() {
    const opt = (icon, label, sub, fn, accent) => {
      const b = el('button', { class: 'card nested', style: { display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', padding: '16px', textAlign: 'left' } }, [
        el('div', { class: 'iconbtn', style: accent ? { background: 'var(--grad-flame)', color: 'var(--on-flame)', border: '0' } : {}, html: ui.icon(icon, 22) }),
        el('div', {}, [ el('div', { class: 'semi', text: label }), el('div', { class: 'muted t-xs', text: sub }) ])
      ]);
      b.addEventListener('click', () => { api.close(); ui.haptic(); fn(); });
      return b;
    };
    const grid = el('div', { class: 'grid-2', style: { marginTop: '4px' } });
    const api = ui.openSheet({ title: 'Log something', hint: 'What did you do?', content: grid });
    grid.appendChild(opt('walk', 'Walk', '7k steps + watch photo', () => App.router.go('/walk'), true));
    grid.appendChild(opt('dumbbell', 'Workout', 'Lift & log sets', () => App.router.go('/workout'), true));
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

  App.flows = { logWeight: logWeight, quickAdd: quickAdd };
  App.quickAdd = quickAdd;

  /* ---------------- reactive refresh ---------------- */
  let raf = 0;
  function onChange() {
    applySettings();
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; App.router.refresh(); });
  }

  /* ---------------- service worker ---------------- */
  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  /* ---------------- pact: backfill past days of the current month ----------------
     So an untouched scheduled day still counts as a miss. Current user only;
     each phone backfills its own rows. First run does the work; later boots skip. */
  async function backfillMonth() {
    const user = store.currentUser(); if (!user || !App.pactSync) return;
    const today = store.today(), month = today.slice(0, 7);
    const start = App.pact.PACT_START;
    let d = store.D.parse(month + '-01');
    while (store.D.key(d) < today) {
      const dk = store.D.key(d);
      if (dk.slice(0, 7) === month && dk >= start && !App.pactSync.cachedDay(user, dk)) {
        try { await App.pactSync.putDay({ date: dk, isWorkoutDay: store.isPactWorkoutDay(dk) }); } catch (e) { break; }
      }
      d = store.D.add(d, 1);
    }
  }

  /* ---------------- boot ---------------- */
  function boot() {
    store.on('change', onChange);
    store.on('pactdays', onChange);
    store.on('quota', () => ui.toast('Storage full — export a backup in Settings', { type: 'flame', icon: 'info', duration: 4000 }));
    applySettings();
    App.router.buildNav();
    if (!store.currentUser()) { App.router.replace('/account'); }
    App.router.start();
    registerSW();

    // load shared ledger, backfill, then repaint
    if (store.currentUser() && App.pactSync) {
      App.pactSync.fetchDays(store.today().slice(0, 7))
        .then(() => backfillMonth())
        .then(() => App.router.refresh())
        .catch(() => {});
    }

    // midnight rollover → re-render so "Today" stays correct
    let lastDay = store.today();
    setInterval(() => { const t = store.today(); if (t !== lastDay) { lastDay = t; App.router.refresh(); } }, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.App);
