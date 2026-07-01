/* ============================================================
   Ember Pact — shared days sync client.
   Reads the WHOLE pact_days ledger (both users); writes only the
   current user's rows. The money net is derived client-side from
   this cache by App.pact. Token is baked here (2-person private app).
   ============================================================ */
window.App = window.App || {};
(function (App) {
  'use strict';

  // MUST equal the `token` in public/config.php (local) and the server config.php.
  const TOKEN = 'd81c3b70208130fcc0693ddde0b740cb1ff91cb5cb9252519fb5bcdd0e34ba6a';
  window.PACT_TOKEN = TOKEN;   // store.js reads this for its per-user blob backup

  const URL = location.pathname.replace(/\/[^/]*$/, '') + '/api.php';
  const H = () => ({ 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' });

  const toCamel = r => ({
    user: r.user, date: r.date,
    isWorkoutDay: !!+r.is_workout_day, swapUsed: !!+r.swap_used,
    stepCount: +r.step_count, stepPhotoUrl: r.step_photo_url,
    workoutDone: !!+r.workout_done, workoutPhotoUrl: r.workout_photo_url,
    complete: !!+r.complete
  });

  const sync = {
    cache: [],
    cachedDay(user, date) { return sync.cache.find(d => d.user === user && d.date === date) || null; },

    async fetchDays(month) {
      const r = await fetch(URL + '?action=days' + (month ? ('&month=' + month) : ''), { headers: H() });
      const j = await r.json(); if (!j.ok) throw new Error(j.error || 'days_failed');
      sync.cache = (j.days || []).map(toCamel);
      App.store.emit('pactdays', sync.cache);
      return sync.cache;
    },

    // upsert one day for the current user. Sends ONLY the fields in `partial`
    // (plus user/date) so the server preserves everything else — never clobbers
    // a logged step count when we only meant to flag the workout day, etc.
    async putDay(partial) {
      const user = App.store.currentUser() || 'me';
      const date = partial.date || App.store.today();
      const payload = { user, date };
      if ('isWorkoutDay' in partial) payload.is_workout_day = partial.isWorkoutDay ? 1 : 0;
      if ('swapUsed' in partial) payload.swap_used = partial.swapUsed ? 1 : 0;
      if ('stepCount' in partial) payload.step_count = partial.stepCount;
      if ('stepPhotoUrl' in partial) payload.step_photo_url = partial.stepPhotoUrl;
      if ('workoutDone' in partial) payload.workout_done = partial.workoutDone ? 1 : 0;
      if ('workoutPhotoUrl' in partial) payload.workout_photo_url = partial.workoutPhotoUrl;
      const r = await fetch(URL + '?action=putday', { method: 'POST', headers: H(), body: JSON.stringify(payload) });
      const j = await r.json(); if (!j.ok) throw new Error(j.error || 'putday_failed');
      await sync.fetchDays(date.slice(0, 7));
      return toCamel(j.day);
    },

    async settle(month, netToMe, note) {
      const r = await fetch(URL + '?action=settle', {
        method: 'POST', headers: H(), body: JSON.stringify({ month, net_to_me: netToMe, note: note || '' })
      });
      return r.json();
    },
    async settlements() {
      const r = await fetch(URL + '?action=settlements', { headers: H() });
      return (await r.json()).settlements || [];
    },
    async upload(dataUrl) {
      const r = await fetch(URL + '?action=upload', { method: 'POST', headers: H(), body: JSON.stringify({ data: dataUrl }) });
      const j = await r.json(); if (!j.ok) throw new Error(j.error || 'upload_failed');
      return j.url;
    }
  };

  App.pactSync = sync;
  // keep both phones roughly in sync: refresh the current month when the app regains focus
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', () => {
      if (App.store && App.store.currentUser()) sync.fetchDays(App.store.today().slice(0, 7)).catch(() => {});
    });
  }
})(window.App);
