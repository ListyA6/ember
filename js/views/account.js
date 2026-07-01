/* ============================================================
   Ember Pact — account gate. Pick "Listy" or "Yeti" once per device.
   No PIN: the device remembers, her phone is her, yours is you.
   ============================================================ */
(function (App) {
  'use strict';
  const { el, icon, haptic, burst, toast } = App.ui;
  const store = App.store, router = App.router;

  function pick(user, name) {
    haptic([18, 40, 18]);
    store.setCurrentUser(user);
    if (App.seed && App.seed.ensurePactDefaults) App.seed.ensurePactDefaults(user, name);
    App.router.buildNav();
    if (App.pactSync) App.pactSync.fetchDays(store.today().slice(0, 7)).catch(() => {});
    burst();
    setTimeout(() => router.go('/dashboard'), 320);
  }

  function card(user, name, sub) {
    const c = el('button', {
      class: 'card nested',
      style: { display: 'flex', gap: '14px', alignItems: 'center', padding: '20px', width: '100%', textAlign: 'left' }
    }, [
      el('div', { class: 'iconbtn', style: { background: 'var(--grad-flame)', color: 'var(--on-flame)', border: '0' }, html: icon('user', 24) }),
      el('div', {}, [
        el('div', { class: 'semi t-lg', text: name }),
        el('div', { class: 'muted t-xs', text: sub })
      ])
    ]);
    c.addEventListener('click', () => pick(user, name));
    return c;
  }

  function render(root) {
    const page = el('div', { class: 'stagger', style: { paddingTop: '44px' } });
    page.appendChild(el('div', {
      class: 'flicker', style: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '76px', height: '76px', borderRadius: '50%', margin: '0 auto 18px',
        background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.4)',
        boxShadow: '0 10px 30px rgba(255,77,46,0.35)'
      }, html: icon('flame', 40)
    }));
    page.appendChild(el('h1', { style: { textAlign: 'center', fontSize: '34px', letterSpacing: '-0.03em' }, text: 'Ember Pact' }));
    page.appendChild(el('div', { class: 'muted', style: { textAlign: 'center', marginBottom: '28px' }, text: 'Who are you on this phone?' }));
    page.appendChild(el('div', { class: 'col', style: { gap: '12px' } }, [
      card('me', 'Listy', 'Your side of the pact'),
      card('gf', 'Yeti', 'Her side of the pact')
    ]));
    page.appendChild(el('div', { class: 'muted t-xs', style: { textAlign: 'center', marginTop: '22px', lineHeight: '1.5' },
      text: 'Walk 7k daily, hit your workouts, snap the proof. Miss a day and your Rp25.000 goes to your partner.' }));
    root.appendChild(page);
  }

  App.registerView('account', { render, title: 'Who are you?' });
})(window.App);
