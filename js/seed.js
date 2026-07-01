/* ============================================================
   Ember Pact — defaults. Not a view. App.seed = { ensurePactDefaults }.
   Seeds a profile + a sensible weekly schedule the first time a user
   picks their identity. Idempotent. Uses only store APIs.
   ============================================================ */
window.App = window.App || {};
(function (App) {
  'use strict';
  const store = App.store;

  // Listy: 4 workout days (Mon/Tue/Thu/Fri). Yeti: 3 workouts + 1 stretch (Mon/Wed/Fri + Sat).
  // weekday: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  const SCHEDULES = {
    me: { 1: 'workout', 2: 'workout', 3: 'rest', 4: 'workout', 5: 'workout', 6: 'rest', 0: 'rest' },
    gf: { 1: 'workout', 2: 'rest', 3: 'workout', 4: 'rest', 5: 'workout', 6: 'stretch', 0: 'rest' }
  };

  function ensurePactDefaults(user, name) {
    user = (user === 'gf' ? 'gf' : 'me');
    if (!store.me()) {
      store.addProfile({
        name: name || (user === 'gf' ? 'Yeti' : 'Listy'),
        color: user === 'gf' ? '#ff4d5e' : '#ff6a13',
        isMe: true
      });
    }
    const sched = store.pactSchedule();
    if (!sched || !Object.keys(sched).length) store.setPactSchedule(SCHEDULES[user]);
    store.completeOnboarding();
  }

  App.seed = { ensurePactDefaults: ensurePactDefaults, SCHEDULES: SCHEDULES };
})(window.App);
