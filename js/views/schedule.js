/* ============================================================
   Ember Pact — Weekly schedule editor (per user). Each weekday is
   Workout / Stretch / Rest. Workout+Stretch both count as sessions.
   ============================================================ */
(function (App) {
  'use strict';
  const { el, icon, haptic, toast, segmented, pageTitle } = App.ui;
  const store = App.store;

  const DAYS = [ [1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [0, 'Sunday'] ];
  const OPTS = [ { value: 'workout', label: 'Workout' }, { value: 'stretch', label: 'Stretch' }, { value: 'rest', label: 'Rest' } ];

  function sessionCount(sched) {
    return Object.values(sched).filter(t => t === 'workout' || t === 'stretch').length;
  }

  function render(root) {
    const me = store.currentUser() || 'me';
    const sched = Object.assign({}, store.pactSchedule());

    const page = el('div', { class: 'stagger' });
    page.appendChild(pageTitle('Weekly plan', (me === 'gf' ? 'Yeti' : 'Listy') + "'s schedule"));

    const summary = el('div', { class: 'card', style: { textAlign: 'center', padding: '16px' } }, [
      el('div', { class: 'bold', style: { fontFamily: 'var(--font-display)', fontSize: '30px' }, text: sessionCount(sched) + ' / week' }),
      el('div', { class: 'muted t-xs', text: 'workout sessions · plus 7k steps every day' })
    ]);
    page.appendChild(summary);

    const list = el('div', { class: 'card mt-3' });
    DAYS.forEach(([wd, name], idx) => {
      const ctl = segmented(OPTS, sched[wd] || 'rest', (v) => {
        sched[wd] = v; store.setPactSchedule(sched);
        summary.querySelector('.bold').textContent = sessionCount(sched) + ' / week';
        haptic(8); toast('Schedule updated', { type: 'good', icon: 'check' });
      });
      ctl.style.width = '210px';
      list.appendChild(el('div', { class: 'between', style: { padding: '12px 0', gap: 'var(--s-3)',
        borderTop: idx ? '1px solid var(--line)' : null } }, [
        el('div', { class: 'semi', text: name }), ctl
      ]));
    });
    page.appendChild(list);

    page.appendChild(el('div', { class: 'muted t-xs mt-3', style: { lineHeight: '1.5' },
      text: 'Workout days need a logged session + photo. Too sore? On a workout day you can swap it for a 14k recovery walk (max 2/week).' }));

    root.appendChild(page);
  }

  App.registerView('schedule', { render, title: 'Plan' });
})(window.App);
