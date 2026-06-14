/* ============================================================
   EMBER · Settings — profile, preferences, friends, data, sync.
   Composes existing CSS only; no emoji.
   ============================================================ */
(function (App) {
  'use strict';
  const { el, h, fmt, avatar, segmented, openSheet, confirm, toast, haptic, icon, pageTitle } = App.ui;
  const store = App.store, router = App.router, share = App.share;

  /* small section card with a label heading */
  function section(label, children) {
    const card = el('div', { class: 'card mt-3' }, [ el('div', { class: 'label mb-3', text: label }) ]);
    (Array.isArray(children) ? children : [children]).forEach(c => c && card.appendChild(c));
    return card;
  }

  /* a labeled row that holds a control on the right */
  function settingRow(title, sub, control) {
    return el('div', { class: 'between', style: { padding: '10px 0', gap: 'var(--s-3)' } }, [
      el('div', { class: 'col', style: { minWidth: '0' } }, [
        el('div', { class: 'semi', text: title }),
        sub ? el('div', { class: 'muted t-xs', text: sub }) : null
      ]),
      control
    ]);
  }

  /* ---------------- 1 · profile ---------------- */
  function profileCard() {
    const me = store.me();
    const row = el('button', {
      class: 'card', style: { display: 'flex', alignItems: 'center', gap: 'var(--s-3)', width: '100%', textAlign: 'left', cursor: 'pointer' },
      on: { click: () => { haptic(8); router.go('/profile'); } }
    }, [
      avatar(me, 'lg'),
      el('div', { class: 'col grow', style: { minWidth: '0' } }, [
        el('div', { class: 'bold t-lg truncate', text: (me && me.name) || 'Set up profile' }),
        el('div', { class: 'muted t-sm truncate', text: (me && me.handle) || 'Tap to edit' })
      ]),
      h(icon('chevR', 20))
    ]);
    return row;
  }

  /* ---------------- 1b · mode (role) ---------------- */
  function roleSection() {
    const ctl = segmented(
      [{ value: 'trainer', label: 'Trainer' }, { value: 'client', label: 'Client' }],
      store.isClient() ? 'client' : 'trainer',
      (v) => { haptic(8); App.switchRole(v); }
    );
    ctl.style.width = '190px';
    return section('Mode', [
      settingRow('Your role', 'Coach clients, or train your own plan', ctl)
    ]);
  }

  /* ---------------- 2 · preferences ---------------- */
  function preferences() {
    const s = store.settings();
    const g = store.goals();

    const unitsCtl = segmented(
      [{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }],
      s.units, (v) => { haptic(8); store.setUnits(v); }
    );
    unitsCtl.style.width = '190px';

    const accentCtl = segmented(
      [{ value: 'default', label: 'Default' }, { value: 'vivid', label: 'Vivid' }],
      s.accent, (v) => { haptic(8); store.setAccent(v); }
    );
    accentCtl.style.width = '190px';

    const themeCtl = segmented(
      [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }],
      s.theme, (v) => { haptic(8); store.setTheme(v); }
    );
    themeCtl.style.width = '190px';

    const steps = el('input', { class: 'input tnum', type: 'number', inputmode: 'numeric', step: '500', value: g.stepsPerDay, style: { width: '110px', height: '44px', textAlign: 'center' } });
    steps.addEventListener('change', () => { const v = parseInt(steps.value, 10); if (v > 0) { store.setGoals({ stepsPerDay: v }); toast('Goal updated', { type: 'good', icon: 'check' }); } });

    const wpw = el('input', { class: 'input tnum', type: 'number', inputmode: 'numeric', step: '1', min: '1', max: '7', value: g.workoutsPerWeek, style: { width: '110px', height: '44px', textAlign: 'center' } });
    wpw.addEventListener('change', () => { const v = parseInt(wpw.value, 10); if (v > 0) { store.setGoals({ workoutsPerWeek: v }); toast('Goal updated', { type: 'good', icon: 'check' }); } });

    return section('Preferences', [
      settingRow('Units', 'Weight & distance', unitsCtl),
      el('div', { style: { borderTop: '1px solid var(--line)' } }),
      settingRow('Accent', 'Orange intensity', accentCtl),
      el('div', { style: { borderTop: '1px solid var(--line)' } }),
      settingRow('Theme', 'Light or warm dark', themeCtl),
      el('div', { style: { borderTop: '1px solid var(--line)' } }),
      settingRow('Daily steps goal', null, steps),
      el('div', { style: { borderTop: '1px solid var(--line)' } }),
      settingRow('Workouts / week', null, wpw)
    ]);
  }

  /* ---------------- 3 · data ---------------- */
  function dataCard() {
    const card = el('div', { class: 'card mt-3' }, [ el('div', { class: 'label mb-3', text: 'Data' }) ]);

    /* primary: one tap → all training data in a single file, into the share sheet (WhatsApp, etc.) */
    const shareDataBtn = el('button', { class: 'btn block', html: icon('share', 19) + '<span>Share training data</span>' });
    shareDataBtn.addEventListener('click', async () => {
      haptic();
      try {
        const name = 'ember-training-' + store.today() + '.json';
        const res = await share.shareData(store.exportJSON(), name);
        if (res && res.downloaded) toast('Saved ' + name + ' — attach it in WhatsApp', { type: 'good', icon: 'download' });
        else if (res && res.shared) toast('Sent to share sheet', { type: 'good', icon: 'check' });
      } catch (e) { toast('Could not share data'); }
    });
    const shareHint = el('div', { class: 'muted t-xs mb-3 mt-2', text: 'One file with all your training data. On your phone it opens the share sheet (send it via WhatsApp); on desktop it downloads so you can attach it. Hand that file to Claude — no account or server needed.' });

    const exportBtn = el('button', { class: 'btn block ghost', html: icon('download', 19) + '<span>Export backup</span>' });
    exportBtn.addEventListener('click', () => {
      haptic();
      try { share.downloadText(store.exportJSON(), 'ember-backup.json', 'application/json'); toast('Backup downloaded', { type: 'good', icon: 'check' }); }
      catch (e) { toast('Export failed'); }
    });

    const importBtn = el('button', { class: 'btn block ghost mt-2', html: icon('upload', 19) + '<span>Restore backup</span>' });
    const importInput = el('input', { type: 'file', accept: '.json,application/json', hidden: 'hidden' });
    importInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const ok = await confirm({ title: 'Restore this backup?', message: 'It replaces all current data on this device.', confirmText: 'Restore', danger: true });
        if (!ok) return;
        try { store.importJSON(String(reader.result)); toast('Backup restored', { type: 'good', icon: 'check' }); router.go('/dashboard'); }
        catch (err) { toast('That file could not be read'); }
      };
      reader.readAsText(f);
    });
    importBtn.appendChild(importInput);
    importBtn.addEventListener('click', () => importInput.click());

    const demoBtn = el('button', { class: 'btn block ghost mt-2', html: icon('sync', 19) + '<span>Reload demo data</span>' });
    demoBtn.addEventListener('click', async () => {
      const ok = await confirm({ title: 'Reload demo data?', message: 'Replaces current data with the sample dataset.', confirmText: 'Reload' });
      if (ok && App.seed) { App.seed.demoReset(); toast('Demo data loaded', { type: 'good', icon: 'check' }); router.go('/dashboard'); }
    });

    const resetBtn = el('button', { class: 'btn block danger mt-2', html: icon('trash', 19) + '<span>Reset all data</span>' });
    resetBtn.addEventListener('click', async () => {
      haptic([10, 40, 10]);
      const ok = await confirm({ title: 'Reset all data?', message: 'This permanently erases every profile, workout, and challenge on this device.', confirmText: 'Erase everything', danger: true });
      if (ok) { store.reset(); location.reload(); }
    });

    [shareDataBtn, shareHint, exportBtn, importBtn, demoBtn, resetBtn].forEach(b => card.appendChild(b));
    return card;
  }

  /* ---------------- 5 · sync (advanced) ---------------- */
  function syncCard() {
    const sync = store.state.sync || {};
    const details = el('details', { class: 'card mt-3' });
    const summary = el('summary', { style: { cursor: 'pointer', listStyle: 'none' } }, [
      el('div', { class: 'between' }, [
        el('div', { class: 'col' }, [
          el('div', { class: 'semi', text: 'Cloud sync' }),
          el('div', { class: 'muted t-xs', text: 'Experimental · off by default' })
        ]),
        el('span', { class: 'pill' + (sync.enabled ? ' good' : ''), text: sync.enabled ? 'On' : 'Off' })
      ])
    ]);
    details.appendChild(summary);

    const body = el('div', { class: 'mt-4' });

    const enableCtl = segmented(
      [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }],
      sync.enabled ? 'on' : 'off', (v) => { haptic(8); store.setSync({ enabled: v === 'on' }); }
    );
    enableCtl.style.width = '160px';
    body.appendChild(settingRow('Enable sync', null, enableCtl));

    const url = el('input', { class: 'input mt-2', type: 'text', value: sync.url || '', placeholder: 'https://…/api.php' });
    url.addEventListener('change', () => store.setSync({ url: url.value.trim() }));
    const token = el('input', { class: 'input mt-2', type: 'text', value: sync.token || '', placeholder: 'Bearer token' });
    token.addEventListener('change', () => store.setSync({ token: token.value.trim() }));
    body.appendChild(el('div', { class: 'field mt-2' }, [ el('label', { text: 'Endpoint URL' }), url ]));
    body.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Token' }), token ]));

    const syncBtn = el('button', { class: 'btn block dark mt-2', html: icon('sync', 19) + '<span>Sync now</span>' });
    const status = el('div', { class: 'muted t-xs mt-2', style: { textAlign: 'center' },
      text: sync.lastAt ? 'Last sync: ' + fmt.relative(sync.lastAt) : 'Never synced' });
    syncBtn.addEventListener('click', async () => {
      haptic();
      status.textContent = 'Syncing…';
      try { const j = await store.syncNow(); status.textContent = 'Synced just now'; toast('Synced', { type: 'good', icon: 'check' }); }
      catch (e) { status.textContent = 'Failed: ' + e.message; toast('Sync failed'); }
    });
    body.appendChild(syncBtn);
    body.appendChild(status);
    body.appendChild(el('div', { class: 'muted t-xs mt-3', text: 'Sync mirrors your data to your own server (the fit.sidestudio.id pattern). Leave off until the endpoint is confirmed for this app.' }));

    details.appendChild(body);
    return details;
  }

  /* ---------------- 6 · about ---------------- */
  function aboutCard() {
    return el('div', { class: 'card mt-3 center col', style: { textAlign: 'center', gap: '4px', padding: 'var(--s-5)' } }, [
      el('div', { class: 'bold', style: { fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: 'var(--ls-wordmark)', textTransform: 'uppercase' }, text: 'ember' }),
      el('div', { class: 'flame semi t-sm', text: 'Train. Track. Burn.' }),
      el('div', { class: 'muted t-xs mt-1', text: 'Personal fitness command center · v1.0' })
    ]);
  }

  /* ---------------- render ---------------- */
  function render(root) {
    const page = el('div', { class: 'stagger' });
    page.appendChild(pageTitle('Settings'));
    page.appendChild(profileCard());
    page.appendChild(roleSection());
    page.appendChild(preferences());
    page.appendChild(dataCard());
    page.appendChild(syncCard());
    page.appendChild(aboutCard());
    root.appendChild(page);
  }

  App.registerView('settings', { render, title: 'Settings' });
})(window.App);
