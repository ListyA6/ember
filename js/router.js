/* ============================================================
   EMBER · Router — hash routes, animated transitions, bottom nav.
   Views self-register via App.registerView(name, def).
   def: { render(root, params), title, nav, navIcon, navLabel }
   ============================================================ */
window.App = window.App || {};
(function (App) {
  'use strict';

  App.views = App.views || {};
  App.registerView = function (name, def) { App.views[name] = def; };

  // order of bottom-nav tabs; FAB sits in the middle
  const PACT_NAV = [
    { name: 'dashboard', icon: 'home',     label: 'Home' },
    { name: 'feed',      icon: 'feed',     label: 'Feed' },
    { fab: true,         icon: 'plus',     label: 'Log' },
    { name: 'schedule',  icon: 'calendar', label: 'Plan' },
    { name: 'profile',   icon: 'user',     label: 'You' }
  ];
  function navSet() { return PACT_NAV; }

  const router = {
    current: null,
    params: null,

    parse() {
      const hash = location.hash.replace(/^#\/?/, '') || 'dashboard';
      const [path, query] = hash.split('?');
      const parts = path.split('/');
      const name = parts[0] || 'dashboard';
      const params = { id: parts[1] || null };
      if (query) query.split('&').forEach(kv => { const [k, v] = kv.split('='); params[k] = decodeURIComponent(v || ''); });
      return { name, params };
    },

    go(path) { location.hash = path.replace(/^#/, ''); },
    replace(path) { location.replace('#' + path.replace(/^#/, '')); },

    start() {
      window.addEventListener('hashchange', () => router.render(true));
      router.render(false);
    },

    // animate=true cross-fades; refresh() re-renders in place with no animation
    render(animate) {
      const { name, params } = router.parse();
      const def = App.views[name];
      const root = App.ui.$('#view');
      if (!def) { router.replace('/dashboard'); return; }
      App.ui.closeAllSheets();
      router.current = name; router.params = params;
      router.syncNav(name);
      // account picker is a full-screen first-run flow — hide the app chrome
      const onb = name === 'account' || name === 'onboarding';
      const navBar = App.ui.$('.navbar'); if (navBar) navBar.style.display = onb ? 'none' : '';
      const topBar = App.ui.$('.topbar'); if (topBar) topBar.style.display = onb ? 'none' : '';

      const draw = () => {
        App.ui.clear(root);
        root.classList.remove('view-enter');
        // force reflow so the class re-applies
        void root.offsetWidth;
        try { def.render(root, params); } catch (e) { console.error('view error', name, e); root.appendChild(App.ui.empty('info', 'Something broke', e.message)); }
        if (animate) { root.classList.add('view-enter'); }
        window.scrollTo(0, 0);
      };
      draw();
    },

    // re-render current view without transition (used on store 'change')
    refresh() {
      const def = App.views[router.current]; if (!def) return;
      // entry forms opt out of in-place refresh so a background sync (e.g. fetch-on-focus
      // when returning from the camera) can't wipe in-progress input; cache still updates.
      if (def.noRefresh) return;
      const root = App.ui.$('#view');
      const scrollY = window.scrollY;
      root.classList.remove('view-enter'); // suppress entrance stagger on data refresh
      App.ui.clear(root);
      try { def.render(root, router.params); } catch (e) { console.error(e); }
      window.scrollTo(0, scrollY);
    },

    buildNav() {
      const nav = App.ui.$('#nav'); if (!nav) return;
      App.ui.clear(nav);
      navSet().forEach(item => {
        if (item.fab) {
          const fab = App.ui.el('button', { class: 'fab', 'aria-label': 'Log activity', html: App.icon(item.icon, 26) });
          fab.addEventListener('click', () => { App.ui.haptic(15); (App.quickAdd ? App.quickAdd() : router.go('/workout')); });
          nav.appendChild(fab);
          return;
        }
        const b = App.ui.el('button', { dataset: { nav: item.name }, html: App.icon(item.icon, 23) + `<span class="lbl">${item.label}</span>` });
        b.addEventListener('click', () => { App.ui.haptic(8); router.go('/' + item.name); });
        nav.appendChild(b);
      });
    },

    syncNav(name) {
      App.ui.$$('#nav [data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === name));
    }
  };

  App.router = router;
})(window.App);
