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
  const CLIENT_NAV = [
    { name: 'dashboard', icon: 'home',   label: 'Home' },
    { name: 'feed',      icon: 'feed',   label: 'Feed' },
    { fab: true,         icon: 'plus',   label: 'Log' },
    { name: 'challenges',icon: 'trophy', label: 'Goals' },
    { name: 'profile',   icon: 'user',   label: 'You' }
  ];
  // trainer: roster-first; the FAB adds a client instead of logging
  const TRAINER_NAV = [
    { name: 'trainer',   icon: 'users',  label: 'Clients' },
    { name: 'feed',      icon: 'feed',   label: 'Activity' },
    { fab: true,         icon: 'plus',   label: 'Add' },
    { name: 'challenges',icon: 'trophy', label: 'Goals' },
    { name: 'profile',   icon: 'user',   label: 'You' }
  ];
  function navSet() { return (App.store.isClient() ? CLIENT_NAV : TRAINER_NAV); }

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
