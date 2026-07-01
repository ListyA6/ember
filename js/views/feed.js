/* ============================================================
   Ember Pact — Feed. Shared proof feed: both users' step + session
   photos, newest first. Honor system, but everything is visible.
   ============================================================ */
(function (App) {
  'use strict';
  const { el, icon, pageTitle, empty, fmt } = App.ui;
  const store = App.store, sync = App.pactSync;
  const NAME = { me: 'Listy', gf: 'Yeti' };

  // flatten the days ledger into individual photo entries
  function entries() {
    const out = [];
    sync.cache.forEach(d => {
      if (d.stepPhotoUrl) out.push({ user: d.user, date: d.date, kind: 'walk', url: d.stepPhotoUrl,
        caption: (d.stepCount || 0).toLocaleString('id-ID') + ' steps', done: (d.stepCount || 0) >= 7000 });
      if (d.workoutPhotoUrl) out.push({ user: d.user, date: d.date, kind: 'workout', url: d.workoutPhotoUrl,
        caption: 'Workout session', done: !!d.workoutDone });
    });
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.user < b.user ? 1 : -1)));
    return out;
  }

  function card(e) {
    return el('div', { class: 'card mb-2' }, [
      el('div', { class: 'between mb-2' }, [
        el('div', { class: 'row gap-2' }, [
          el('div', { class: 'iconbtn plain', style: { color: e.kind === 'workout' ? 'var(--flame)' : 'var(--good)' },
            html: icon(e.kind === 'workout' ? 'dumbbell' : 'walk', 20) }),
          el('div', { class: 'col' }, [
            el('div', { class: 'semi', text: NAME[e.user] + (e.user === store.currentUser() ? ' (you)' : '') }),
            el('div', { class: 'muted t-xs', text: fmt.dayLabel(e.date) + ' · ' + e.caption })
          ])
        ]),
        e.done ? el('span', { class: 'good', style: { display: 'inline-flex' }, html: icon('checkCircle', 20) }) : null
      ]),
      el('div', { style: { borderRadius: 'var(--r-sm)', overflow: 'hidden', aspectRatio: '4 / 3',
        backgroundImage: "url('" + e.url + "')", backgroundSize: 'cover', backgroundPosition: 'center' } })
    ]);
  }

  function render(root) {
    const page = el('div', { class: 'stagger' });
    page.appendChild(pageTitle('Feed', 'Both sides of the pact'));
    const list = entries();
    if (!list.length) {
      page.appendChild(empty('camera', 'No proof yet', 'Log your walk or workout to start the feed.'));
    } else {
      list.forEach(e => page.appendChild(card(e)));
    }
    root.appendChild(page);
    // refresh shared ledger when the feed opens
    if (sync && store.currentUser()) sync.fetchDays(store.today().slice(0, 7)).catch(() => {});
  }

  App.registerView('feed', { render, title: 'Feed' });
})(window.App);
