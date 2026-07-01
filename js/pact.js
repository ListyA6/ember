/* ============================================================
   Ember Pact — pure engine. No DOM, no storage, no fetch.
   Browser: App.pact ; Node: module.exports. Fully unit-testable.
   Day shape (camelCase): { user, date, isWorkoutDay, swapUsed,
     stepCount, stepPhotoUrl, workoutDone, workoutPhotoUrl, complete }
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.App = root.App || {}; root.App.pact = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const STAKE = 25000;          // rupiah per day at stake
  const STEP_GOAL = 7000;       // normal day
  const SWAP_STEP_GOAL = 14000; // recovery-swap day
  const SWAP_CAP = 2;           // max recovery swaps per ISO week per user
  const PACT_START = '2026-07-01'; // nothing counts (no misses / no money) before this

  function walkTarget(d) { return (d && d.swapUsed) ? SWAP_STEP_GOAL : STEP_GOAL; }

  // A day is complete when the walk goal is met AND (it's not a workout day,
  // OR the workout was swapped for a recovery walk, OR the workout is done).
  function isComplete(d) {
    if (!d) return false;
    const walkOk = (d.stepCount || 0) >= walkTarget(d);
    const sessionOk = !d.isWorkoutDay || d.swapUsed || d.workoutDone;
    return !!(walkOk && sessionOk);
  }

  // ISO week id 'YYYY-Www' (Monday-start). Computed in UTC to stay locale-free.
  function isoWeekId(key) {
    const [y, m, dd] = key.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, dd));
    const day = (dt.getUTCDay() + 6) % 7;        // Mon=0..Sun=6
    dt.setUTCDate(dt.getUTCDate() - day + 3);     // shift to the Thursday of this week
    const firstThu = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
    const ftDay = (firstThu.getUTCDay() + 6) % 7;
    const week = 1 + Math.round(((dt - firstThu) / 86400000 - 3 + ftDay) / 7);
    return dt.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
  }

  function swapsUsedInWeek(days, user, weekId) {
    return days.filter(d => d.user === user && d.swapUsed && isoWeekId(d.date) === weekId).length;
  }
  // Can `user` start a swap on `dateKey`? (excludes any existing swap on that same date)
  function canSwap(days, user, dateKey) {
    const others = days.filter(d => d.date !== dateKey);
    return swapsUsedInWeek(others, user, isoWeekId(dateKey)) < SWAP_CAP;
  }

  // Past, incomplete days in `month` for `user`. Today never counts (in play until
  // rollover); nothing before PACT_START counts either (pact begins 1 July).
  function missedDays(days, user, month, todayKey) {
    return days.filter(d =>
      d.user === user && d.date.slice(0, 7) === month &&
      d.date >= PACT_START && d.date < todayKey && !isComplete(d)
    ).length;
  }

  // Net rupiah TO ME for the month. Yeti's misses come to me (+); my misses go to Yeti (-).
  function moneyNet(days, month, todayKey) {
    return (missedDays(days, 'gf', month, todayKey) - missedDays(days, 'me', month, todayKey)) * STAKE;
  }

  // 'Rp25.000' (Indonesian grouping, absolute value, no decimals)
  function fmtRp(n) { return 'Rp' + Math.abs(Math.round(n)).toLocaleString('id-ID'); }

  return {
    STAKE, STEP_GOAL, SWAP_STEP_GOAL, SWAP_CAP, PACT_START,
    walkTarget, isComplete, isoWeekId, swapsUsedInWeek, canSwap, missedDays, moneyNet, fmtRp
  };
});
