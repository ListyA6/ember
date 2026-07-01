/* ============================================================
   Ember Pact · Settings — profile, identity, preferences, data, backup.
   ============================================================ */
(function (App) {
  'use strict';
  const { el, h, fmt, avatar, segmented, openSheet, confirm, toast, haptic, icon, pageTitle } = App.ui;
  const store = App.store, router = App.router, share = App.share;

  function section(label, children) {
    const card = el('div', { class: 'card mt-3' }, [ el('div', { class: 'label mb-3', text: label }) ]);
    (Array.isArray(children) ? children : [children]).forEach(c => c && card.appendChild(c));
    return card;
  }
  function settingRow(title, sub, control) {
    return el('div', { class: 'between', style: { padding: '10px 0', gap: 'var(--s-3)' } }, [
      el('div', { class: 'col', style: { minWidth: '0' } }, [
        el('div', { class: 'semi', text: title }),
        sub ? el('div', { class: 'muted t-xs', text: sub }) : null
      ]),
      control
    ]);
  }

  function profileCard() {
    const me = store.me();
    return el('button', {
      class: 'card', style: { display: 'flex', alignItems: 'center', gap: 'var(--s-3)', width: '100%', textAlign: 'left', cursor: 'pointer' },
      on: { click: () => { haptic(8); router.go('/profile'); } }
    }, [
      avatar(me, 'lg'),
      el('div', { class: 'col grow', style: { minWidth: '0' } }, [
        el('div', { class: 'bold t-lg truncate', text: (me && me.name) || 'Set up profile' }),
        el('div', { class: 'muted t-sm truncate', text: 'Tap to edit' })
      ]),
      h(icon('chevR', 20))
    ]);
  }

  /* ---- pact identity ---- */
  function pactSection() {
    const cur = store.currentUser() === 'gf' ? 'Yeti' : 'Listy';
    const switchBtn = el('button', { class: 'btn ghost', html: icon('sync', 16) + '<span>Switch</span>' });
    switchBtn.addEventListener('click', async () => {
      const other = store.currentUser() === 'gf' ? 'me' : 'gf';
      const ok = await confirm({ title: 'Switch to ' + (other === 'gf' ? 'Yeti' : 'Listy') + '?', message: 'This phone will act as the other person. Normally each phone stays one person.', confirmText: 'Switch' });
      if (!ok) return;
      store.setCurrentUser(other);
      if (App.seed) App.seed.ensurePactDefaults(other);
      App.router.buildNav();
      if (App.pactSync) App.pactSync.fetchDays(store.today().slice(0, 7)).catch(() => {});
      toast('Now ' + (other === 'gf' ? 'Yeti' : 'Listy'), { type: 'good', icon: 'check' });
      router.go('/dashboard');
    });
    const planBtn = el('button', { class: 'btn ghost', html: icon('calendar', 16) + '<span>Edit</span>' });
    planBtn.addEventListener('click', () => router.go('/schedule'));
    return section('Pact', [
      settingRow('You are', 'This device is signed in as ' + cur, switchBtn),
      el('div', { style: { borderTop: '1px solid var(--line)' } }),
      settingRow('Weekly plan', 'Your workout days', planBtn)
    ]);
  }

  function preferences() {
    const s = store.settings();
    const unitsCtl = segmented([{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }], s.units, (v) => { haptic(8); store.setUnits(v); });
    unitsCtl.style.width = '190px';
    const accentCtl = segmented([{ value: 'default', label: 'Default' }, { value: 'vivid', label: 'Vivid' }], s.accent, (v) => { haptic(8); store.setAccent(v); });
    accentCtl.style.width = '190px';
    const themeCtl = segmented([{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], s.theme, (v) => { haptic(8); store.setTheme(v); });
    themeCtl.style.width = '190px';
    return section('Preferences', [
      settingRow('Units', 'Weight & distance', unitsCtl),
      el('div', { style: { borderTop: '1px solid var(--line)' } }),
      settingRow('Accent', 'Orange intensity', accentCtl),
      el('div', { style: { borderTop: '1px solid var(--line)' } }),
      settingRow('Theme', 'Light or warm dark', themeCtl)
    ]);
  }

  function dataCard() {
    const card = el('div', { class: 'card mt-3' }, [ el('div', { class: 'label mb-3', text: 'Data' }) ]);
    const exportBtn = el('button', { class: 'btn block ghost', html: icon('download', 19) + '<span>Export backup</span>' });
    exportBtn.addEventListener('click', () => {
      haptic();
      try { share.downloadText(store.exportJSON(), 'ember-pact-backup.json', 'application/json'); toast('Backup downloaded', { type: 'good', icon: 'check' }); }
      catch (e) { toast('Export failed'); }
    });
    const importBtn = el('button', { class: 'btn block ghost mt-2', html: icon('upload', 19) + '<span>Restore backup</span>' });
    const importInput = el('input', { type: 'file', accept: '.json,application/json', hidden: 'hidden' });
    importInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const ok = await confirm({ title: 'Restore this backup?', message: 'It replaces your private data on this device.', confirmText: 'Restore', danger: true });
        if (!ok) return;
        try { store.importJSON(String(reader.result)); toast('Backup restored', { type: 'good', icon: 'check' }); router.go('/dashboard'); }
        catch (err) { toast('That file could not be read'); }
      };
      reader.readAsText(f);
    });
    importBtn.appendChild(importInput);
    importBtn.addEventListener('click', () => importInput.click());

    const resetBtn = el('button', { class: 'btn block danger mt-2', html: icon('trash', 19) + '<span>Reset this device</span>' });
    resetBtn.addEventListener('click', async () => {
      haptic([10, 40, 10]);
      const ok = await confirm({ title: 'Reset this device?', message: 'Clears your local profile and workouts on THIS device. The shared pact ledger on the server is untouched.', confirmText: 'Reset', danger: true });
      if (ok) { store.reset(); try { localStorage.removeItem('ember_pact_user'); } catch (e) {} location.reload(); }
    });
    [exportBtn, importBtn, resetBtn].forEach(b => card.appendChild(b));
    return card;
  }

  function syncCard() {
    const ss = store.syncState ? store.syncState() : { lastAt: (store.state.sync || {}).lastAt };
    function statusText(s) {
      if (s.lastError) return 'Last attempt failed — will retry automatically';
      if (s.lastAt) return 'Last backup ' + fmt.relative(s.lastAt);
      return 'Not backed up yet';
    }
    const card = el('div', { class: 'card mt-3' }, [
      el('div', { class: 'between mb-2' }, [ el('div', { class: 'label', text: 'Cloud backup' }), el('span', { class: 'pill good', text: 'Auto' }) ])
    ]);
    const status = el('div', { class: 'muted t-xs mb-3', style: { textAlign: 'center' }, text: statusText(ss) });
    card.appendChild(status);
    const syncBtn = el('button', { class: 'btn block dark', html: icon('sync', 19) + '<span>Back up now</span>' });
    syncBtn.addEventListener('click', async () => {
      haptic(); status.textContent = 'Backing up…';
      try { await store.syncNow(); status.textContent = 'Backed up just now'; toast('Backed up', { type: 'good', icon: 'check' }); }
      catch (e) { status.textContent = 'Failed: ' + e.message; toast('Backup failed'); }
    });
    card.appendChild(syncBtn);
    card.appendChild(el('div', { class: 'muted t-xs mt-3', text: 'Your private workout data backs up automatically to the shared server a few seconds after every change.' }));
    return card;
  }

  function aboutCard() {
    return el('div', { class: 'card mt-3 center col', style: { textAlign: 'center', gap: '4px', padding: 'var(--s-5)' } }, [
      el('div', { class: 'bold', style: { fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: 'var(--ls-wordmark)', textTransform: 'uppercase' }, text: 'ember pact' }),
      el('div', { class: 'flame semi t-sm', text: 'Two people. One pact.' }),
      el('div', { class: 'muted t-xs mt-1', text: 'Rp25.000 a day on the line · v1.0' })
    ]);
  }

  /* ---- app: install + partner notifications ---- */
  function partnerName() { return store.currentUser() === 'gf' ? 'Listy' : 'Yeti'; }

  function installControl() {
    const pwa = App.pwa;
    if (pwa && pwa.isStandalone && pwa.isStandalone()) {
      return h('<span class="good" style="display:inline-flex;align-items:center;gap:6px">' + icon('checkCircle', 18) + '<span class="t-sm semi">Installed</span></span>');
    }
    const btn = el('button', { class: 'btn ghost', html: icon('download', 16) + '<span>Install</span>' });
    btn.addEventListener('click', async () => {
      haptic(8);
      if (pwa && pwa.canPrompt && pwa.canPrompt()) { await pwa.promptInstall(); router.go('/settings'); return; }
      if (pwa && pwa.isIOS && pwa.isIOS()) {
        openSheet({ center: true, title: 'Add to Home Screen', hint: 'In Safari, tap the Share icon, then “Add to Home Screen”. Then open Ember Pact from your home screen.', actions: [{ label: 'Got it', class: 'flame' }] });
        return;
      }
      openSheet({ center: true, title: 'Install Ember Pact', hint: 'Open your browser menu (⋮) and choose “Install app” or “Add to Home screen”.', actions: [{ label: 'Got it', class: 'flame' }] });
    });
    return btn;
  }

  function notifControl() {
    const push = App.pactPush;
    const btn = el('button', { class: 'btn ghost', html: '<span>…</span>' });
    if (!push || !push.supported()) { btn.innerHTML = icon('info', 16) + '<span>Unsupported</span>'; btn.disabled = true; return btn; }
    const setLabel = (on) => { btn.innerHTML = icon(on ? 'checkCircle' : 'bell', 16) + '<span>' + (on ? 'On' : 'Turn on') + '</span>'; };
    push.isSubscribed().then(setLabel).catch(() => setLabel(false));
    btn.addEventListener('click', async () => {
      haptic(8);
      let on = false; try { on = await push.isSubscribed(); } catch (e) {}
      btn.disabled = true;
      try {
        if (on) { await push.disable(); setLabel(false); toast('Notifications off'); }
        else if (App.pwa && App.pwa.isIOS() && !App.pwa.isStandalone()) {
          openSheet({ center: true, title: 'Install first', hint: 'On iPhone, add Ember Pact to your Home Screen, open it from there, then turn on notifications.', actions: [{ label: 'OK', class: 'flame' }] });
        } else {
          await push.enable(store.currentUser() || 'me');
          setLabel(true); toast('Notifications on', { type: 'good', icon: 'check' });
        }
      } catch (e) {
        const m = e && e.message;
        toast(m === 'denied' ? 'Blocked — allow notifications in your browser settings'
          : m === 'unsupported' ? 'Not supported on this device' : 'Could not update notifications');
      } finally { btn.disabled = false; }
    });
    return btn;
  }

  function appSection() {
    return section('App', [
      settingRow('Install app', 'Add Ember Pact to your home screen', installControl()),
      el('div', { style: { borderTop: '1px solid var(--line)' } }),
      settingRow('Notifications', 'When ' + partnerName() + ' logs a walk or workout', notifControl())
    ]);
  }

  function render(root) {
    const page = el('div', { class: 'stagger' });
    page.appendChild(pageTitle('Settings'));
    page.appendChild(profileCard());
    page.appendChild(pactSection());
    page.appendChild(appSection());
    page.appendChild(preferences());
    page.appendChild(dataCard());
    page.appendChild(syncCard());
    page.appendChild(aboutCard());
    root.appendChild(page);
  }

  App.registerView('settings', { render, title: 'Settings' });
})(window.App);
