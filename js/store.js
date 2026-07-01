/* ============================================================
   EMBER · Store — single source of truth.
   localStorage-backed, event-driven. All views read & mutate here.
   Mutators call save() which emits 'change'; app re-renders active view.
   ============================================================ */
window.App = window.App || {};
(function (App) {
  'use strict';

  const KEY_BASE = 'ember_pact';      // per-user localStorage namespace: ember_pact_<user>
  const START = '2026-07-01';   // goal window opens with the pact (see pact.js PACT_START)
  const GOAL_END = '2026-12-31';
  // which of the two pact users this device is ('me' | 'gf' | null until picked)
  let CURRENT = null;
  try { CURRENT = localStorage.getItem('ember_pact_user') || null; } catch (e) {}
  function keyFor(u) { return KEY_BASE + '_' + (u || 'me'); }
  // shared pact backend lives in the same folder as index.html
  const SYNC_URL = (typeof location !== 'undefined' ? location.pathname.replace(/\/[^/]*$/, '') : '') + '/api.php';
  // token is baked into pact-sync.js (2-person private app); read it at call time
  function syncToken() { return (typeof window !== 'undefined' && window.PACT_TOKEN) || ''; }

  /* ---------------- date helpers ---------------- */
  const D = {
    key(d = new Date()) {
      // day key in Asia/Jakarta (UTC+7, no DST) regardless of device locale
      const j = new Date(d.getTime() + (7 * 60 + d.getTimezoneOffset()) * 60000);
      const y = j.getFullYear(), m = String(j.getMonth() + 1).padStart(2, '0'), dd = String(j.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    },
    parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
    add(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
    startOfWeek(d = new Date()) { const x = new Date(d); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); x.setHours(0, 0, 0, 0); return x; },
    diffDays(a, b) { return Math.round((D.parse(a) - D.parse(b)) / 86400000); },
    inRange(dk, start, end) { return dk >= start && dk <= end; },
    weekId(dk) { const d = D.parse(dk); const s = D.startOfWeek(d); return D.key(s); },
    fmt(d, opts) { return (typeof d === 'string' ? D.parse(d) : d).toLocaleDateString(undefined, opts || { weekday: 'short', day: 'numeric', month: 'short' }); }
  };

  /* ---------------- programs (carried from old tracker) ---------------- */
  const PROGRAMS = {
    upperA: { name: 'Push · Chest, Shoulders', color: 'upper', ex: [
      { n: 'Barbell Bench Press', sets: 3, reps: '8-10' },
      { n: 'Incline Machine Press', sets: 3, reps: '8-10' },
      { n: 'Chest Fly Machine', sets: 3, reps: '10-15' },
      { n: 'Shoulder Press Machine', sets: 3, reps: '6-8' },
      { n: 'Cable Lateral Raise', sets: 3, reps: '15-20' },
      { n: 'Machine Chest Press · to failure', sets: 3, reps: '10+' } ] },
    upperB: { name: 'Pull · Back, Biceps', color: 'upper', ex: [
      { n: 'Lat Pulldown', sets: 3, reps: '6-12' },
      { n: 'Seated Cable Row', sets: 3, reps: '8-10' },
      { n: 'Chest-Supported Row Machine', sets: 3, reps: '10-12' },
      { n: 'Standing Face Pull', sets: 3, reps: '10' },
      { n: 'Behind Body Cable Curl', sets: 3, reps: '10-12' } ] },
    lowerA: { name: 'Lower A · Squat', color: 'lower', ex: [
      { n: 'Barbell Back Squat', sets: 3, reps: '8-10' },
      { n: 'Romanian Deadlift', sets: 3, reps: '10-12' },
      { n: 'Seated Leg Extension', sets: 3, reps: '10-15' },
      { n: 'Standing Calf Raise', sets: 3, reps: '10-15' },
      { n: 'Pallof Press', sets: 2, reps: '5/side' } ] },
    lowerB: { name: 'Lower B · Deadlift', color: 'lower', ex: [
      { n: 'Barbell Deadlift', sets: 3, reps: '6-8' },
      { n: 'Front Foot Elevated Reverse Lunge', sets: 3, reps: '8-10/leg' },
      { n: 'Seated Leg Curl', sets: 3, reps: '10-15' },
      { n: 'Seated Calf Raise', sets: 3, reps: '10-15' },
      { n: 'Bird Dog', sets: 2, reps: '5/side' } ] },
    rest: { name: 'Rest · walk only', color: 'rest', ex: [] }
  };
  const DAY_PLAN = { 1: 'upperA', 2: 'lowerA', 4: 'upperB', 5: 'lowerB' }; // Mon Tue Thu Fri

  /* ---------------- Yeti's program (full-body / lower-focus + Pilates) ---------------- */
  const PROGRAMS_GF = {
    day1: { name: 'Day 1 · Lower + Push', color: 'lower', ex: [
      { n: 'Goblet Squat', sets: 3, reps: '15' },
      { n: 'DB Romanian Deadlift', sets: 3, reps: '15' },
      { n: 'Reverse Lunge', sets: 3, reps: '12/leg' },
      { n: 'DB Shoulder Press', sets: 3, reps: '12' },
      { n: 'Floor DB Chest Press / Push-ups', sets: 3, reps: '12' },
      { n: 'Plank', sets: 3, reps: '40 sec' },
      { n: 'Finisher · 8-min circuit (squats / mtn climbers / jacks)', sets: 4, reps: 'rounds' } ] },
    day2: { name: 'Day 2 · Upper + Core', color: 'upper', ex: [
      { n: 'DB Bent-over Row', sets: 3, reps: '12' },
      { n: 'DB Lateral Raise', sets: 3, reps: '15' },
      { n: 'DB Glute Bridge', sets: 3, reps: '20' },
      { n: 'Bicep Curl', sets: 3, reps: '12' },
      { n: 'Triceps Overhead Extension', sets: 3, reps: '12' },
      { n: 'Dead Bug', sets: 3, reps: '10/side' },
      { n: 'Finisher · 10-min brisk/incline walk', sets: 1, reps: '10 min' } ] },
    day3: { name: 'Day 3 · Lower + Burn', color: 'lower', ex: [
      { n: 'Sumo Goblet Squat', sets: 3, reps: '15' },
      { n: 'DB Step-up (stairs)', sets: 3, reps: '12/leg' },
      { n: 'Single-leg RDL', sets: 3, reps: '10/leg' },
      { n: 'Curtsy Lunge', sets: 3, reps: '12/leg' },
      { n: 'Side Plank', sets: 3, reps: '25 sec/side' },
      { n: 'Finisher · 12-min circuit (squat pulses / high knees / glute bridge / jacks)', sets: 1, reps: 'till time' } ] },
    day4: { name: 'Day 4 · Pilates + Stretch', color: 'rest', ex: [
      { n: 'Clamshells', sets: 2, reps: '15/side' },
      { n: 'Side-lying Leg Lifts', sets: 2, reps: '15/side' },
      { n: 'Leg Circles', sets: 2, reps: '10/side' },
      { n: 'Glute Bridge Marches', sets: 2, reps: '20' },
      { n: 'The Hundred', sets: 1, reps: '100 beats' },
      { n: 'Roll-ups', sets: 2, reps: '10' },
      { n: 'Bird-dog', sets: 2, reps: '10/side' },
      { n: 'Stretch · hamstring, hip-flexor, quad, glute', sets: 1, reps: '30s each' } ] },
    rest: { name: 'Rest · walk only', color: 'rest', ex: [] }
  };
  const DAY_PLAN_GF = { 1: 'day1', 3: 'day2', 5: 'day3', 6: 'day4' }; // Mon Wed Fri + Sat Pilates

  // pick the program set / weekday plan for whoever this device is
  function progSet() { return CURRENT === 'gf' ? PROGRAMS_GF : PROGRAMS; }
  function dayPlan() { return CURRENT === 'gf' ? DAY_PLAN_GF : DAY_PLAN; }

  /* ---------------- activity type meta ---------------- */
  const ACT = {
    lift:  { label: 'Workout', icon: 'dumbbell', color: '#ff6a13', metric: 'volume' },
    walk:  { label: 'Walk',    icon: 'walk',     color: '#1bbf74', metric: 'distance' },
    run:   { label: 'Run',     icon: 'run',      color: '#ff4d5e', metric: 'distance' },
    cycle: { label: 'Cycle',   icon: 'route',    color: '#2f8bff', metric: 'distance' },
    cardio:{ label: 'Cardio',  icon: 'zapLine',  color: '#ff9e2c', metric: 'minutes' },
    meal:  { label: 'Meal',    icon: 'fork',     color: '#c98a2b', metric: null }
  };

  /* ---------------- badge catalog ----------------
     each: { id, name, desc, icon, test(s, pid) -> bool }  */
  const BADGES = [
    { id: 'first',     name: 'First Spark',   desc: 'Log your first activity',         icon: 'flameLine',
      test: (s, p) => s.activitiesFor(p).length >= 1 },
    { id: 'streak3',   name: 'Warming Up',    desc: '3-day move streak',               icon: 'flame',
      test: (s, p) => s.moveStreak(p) >= 3 },
    { id: 'streak7',   name: 'On Fire',       desc: '7-day move streak',               icon: 'flame',
      test: (s, p) => s.moveStreak(p) >= 7 },
    { id: 'streak30',  name: 'Inferno',       desc: '30-day move streak',              icon: 'flame',
      test: (s, p) => s.moveStreak(p) >= 30 },
    { id: 'lift10',    name: 'Iron Habit',    desc: '10 workouts logged',              icon: 'dumbbell',
      test: (s, p) => s.activitiesFor(p).filter(a => a.type === 'lift').length >= 10 },
    { id: 'lift50',    name: 'Forged',        desc: '50 workouts logged',              icon: 'dumbbell',
      test: (s, p) => s.activitiesFor(p).filter(a => a.type === 'lift').length >= 50 },
    { id: 'vol10k',    name: 'Ten Tonne',     desc: 'Lift 10,000 kg of volume',        icon: 'bolt',
      test: (s, p) => s.totalVolume(p) >= 10000 },
    { id: 'dist10',    name: 'Pavement',      desc: '10 km on foot or wheels',         icon: 'route',
      test: (s, p) => s.totalDistance(p) >= 10 },
    { id: 'pr5',       name: 'Record Breaker',desc: 'Set 5 personal records',          icon: 'trend',
      test: (s, p) => s.totalPRs(p) >= 5 },
    { id: 'earlybird', name: 'Dawn Patrol',   desc: 'Train before 7 AM',               icon: 'sun',
      test: (s, p) => s.activitiesFor(p).some(a => a.startedAt && new Date(a.startedAt).getHours() < 7) },
    { id: 'week4',     name: 'Full Week',     desc: '4 workouts in one week',          icon: 'calendar',
      test: (s, p) => s.maxWorkoutsInAWeek(p) >= 4 },
    { id: 'champ',     name: 'Champion',      desc: 'Win a challenge',                 icon: 'crown',
      test: (s, p) => s.wonAnyChallenge(p) }
  ];

  /* ---------------- default state ---------------- */
  function freshState() {
    return {
      version: 1,
      meta: { createdAt: D.key(), onboarded: false, units: 'metric', accent: 'default', theme: 'light', role: null },
      me: null,
      profiles: {},
      activities: {},
      walks: {},          // { [pid]: { 'YYYY-MM-DD': true } }
      weight: {},         // { [pid]: [{date,kg}] }
      challenges: {},
      badges: {},         // { [pid]: [{id, earnedAt}] }
      current: null,      // active lift session
      overrides: {},      // { 'YYYY-MM-DD': programKey } today-program override
      pactSchedule: {},   // { weekday(0=Sun..6=Sat): 'workout'|'stretch'|'rest' }
      goals: { stepsPerDay: 7000, workoutsPerWeek: 4, startDate: START, endDate: GOAL_END },
      sync: { enabled: true, lastAt: null, lastError: null }
    };
  }

  /* ================= STORE ================= */
  const listeners = {};
  let S = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(keyFor(CURRENT)) || 'null');
      if (!raw) return freshState();
      const st = Object.assign(freshState(), raw, { meta: Object.assign(freshState().meta, raw.meta) });
      st.sync = Object.assign({}, freshState().sync, st.sync, { enabled: true });
      // migrate persisted goal window to start with the pact (1 July). The old
      // default (21 May) is never user-set, so bump it to the current START.
      if (st.goals && st.goals.startDate === '2026-05-21') st.goals.startDate = START;
      return st;
    } catch (e) { return freshState(); }
  }
  let saveQueued = false;
  function save() {
    try { localStorage.setItem(keyFor(CURRENT), JSON.stringify(S)); }
    catch (e) { emit('quota', e); }   // storage full — surface it (data still lives in memory + cloud backup)
    if (!saveQueued) { saveQueued = true; Promise.resolve().then(() => { saveQueued = false; emit('change'); }); }
    scheduleSync();
  }
  function emit(evt, data) { (listeners[evt] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); }

  /* ---------------- cloud auto-backup (full-state, debounced) ----------------
     Every mutation calls save() → schedules a debounced full-state push to the
     server. Lossless, future-proof, offline-safe (retries on reconnect). */
  let syncTimer = null, syncing = false, syncPending = false;
  function syncReady() { return !!(S.sync && S.sync.enabled && CURRENT && syncToken()); }
  function scheduleSync(delay) {
    if (!syncReady()) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(pushState, delay == null ? 2500 : delay);
  }
  async function pushState() {
    syncTimer = null;
    if (!syncReady()) return { skipped: true };
    if (syncing) { syncPending = true; return { queued: true }; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { syncPending = true; return { offline: true }; }
    syncing = true;
    try {
      const r = await fetch(SYNC_URL + '?action=putstate&user=' + CURRENT, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + syncToken(), 'Content-Type': 'application/json' },
        body: JSON.stringify(S)
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status));
      S.sync.lastAt = Date.now(); S.sync.lastError = null;
      try { localStorage.setItem(keyFor(CURRENT), JSON.stringify(S)); } catch (e) { /* quota */ }
      emit('sync', { ok: true, at: S.sync.lastAt, bytes: j.bytes });
      return j;
    } catch (e) {
      S.sync.lastError = e.message; syncPending = true;
      emit('sync', { ok: false, error: e.message });
      return { error: e.message };
    } finally {
      syncing = false;
      if (syncPending) { syncPending = false; scheduleSync(4000); }
    }
  }

  const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const COLORS = ['#ff6a13', '#1bbf74', '#2f8bff', '#ff4d5e', '#9b59ff', '#ff9e2c'];
  const initials = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const store = {
    D, ACT, BADGES, START, GOAL_END,
    get PROGRAMS() { return progSet(); },
    get DAY_PLAN() { return dayPlan(); },
    programKeys() { return Object.keys(progSet()); },
    get state() { return S; },

    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return () => store.off(evt, fn); },
    off(evt, fn) { listeners[evt] = (listeners[evt] || []).filter(f => f !== fn); },
    emit, save, uid,
    today: () => D.key(),

    reset() { S = freshState(); save(); },

    /* ---- pact identity (which of the two users this device is) ---- */
    currentUser() { return CURRENT; },
    setCurrentUser(u) {
      u = (u === 'gf' ? 'gf' : 'me'); CURRENT = u;
      try { localStorage.setItem('ember_pact_user', u); } catch (e) {}
      S = load();                 // swap to that user's private blob namespace
      emit('change');
      if (syncReady()) scheduleSync(800);
    },
    /* ---- pact weekly schedule (weekday -> 'workout'|'stretch'|'rest') ---- */
    pactSchedule() { return S.pactSchedule || {}; },
    setPactSchedule(map) { S.pactSchedule = Object.assign({}, map); save(); },
    // is `date` (or today) a session day per this user's schedule?
    isPactWorkoutDay(date) {
      const dk = date || D.key();
      const wd = D.parse(dk).getDay();
      const t = (S.pactSchedule || {})[wd];
      return t === 'workout' || t === 'stretch';
    },

    /* ---- profiles ---- */
    meId() { return S.me; },
    me() { return S.profiles[S.me] || null; },
    profile(id) { return S.profiles[id] || null; },
    allProfiles() { return Object.values(S.profiles); },
    addProfile(data) {
      const id = data.id || uid();
      const n = data.name || 'Athlete';
      S.profiles[id] = {
        id, name: n, handle: data.handle || ('@' + n.toLowerCase().replace(/\s+/g, '')),
        avatar: data.avatar || null, color: data.color || COLORS[Object.keys(S.profiles).length % COLORS.length],
        goal: data.goal || '', heightCm: data.heightCm || null,
        isMe: !!data.isMe, joinedAt: data.joinedAt || D.key(),
        // ecosystem fields
        role: data.role || null,            // 'client' for athletes a trainer coaches
        program: data.program || null,      // assigned PROGRAMS key
        programLabel: data.programLabel || null,
        trainerNote: data.trainerNote || '',
        phase: data.phase || '',            // e.g. 'Cut · Week 3'
        coachName: data.coachName || null,  // (client side) who coaches them
        trainerId: data.trainerId || null
      };
      if (data.isMe || !S.me) S.me = id;
      save(); return id;
    },
    updateProfile(id, patch) { if (S.profiles[id]) { Object.assign(S.profiles[id], patch); save(); } },
    removeProfile(id) {
      if (id === S.me) return;
      delete S.profiles[id];
      Object.keys(S.activities).forEach(k => { if (S.activities[k].profileId === id) delete S.activities[k]; });
      delete S.walks[id]; delete S.weight[id]; delete S.badges[id];
      Object.values(S.challenges).forEach(c => { c.members = (c.members || []).filter(m => m !== id); });
      save();
    },
    initials,

    /* ---- roles / trainer↔client ecosystem ---- */
    role() { return S.meta.role; },
    setRole(r) { S.meta.role = r; save(); },
    isTrainer() { return S.meta.role === 'trainer'; },  // only an explicit trainer; default = personal
    isClient() { return S.meta.role !== 'trainer'; },   // null / 'client' => personal (own training)
    // every athlete a trainer coaches = profiles flagged role:'client'
    clients() { return Object.values(S.profiles).filter(p => p.role === 'client'); },
    assignedProgramKey(pid) { const p = S.profiles[pid]; return (p && p.program) || null; },
    assignedProgram(pid) { const k = store.assignedProgramKey(pid); return k && PROGRAMS[k] ? Object.assign({ key: k }, PROGRAMS[k]) : null; },
    setAssignedProgram(pid, key) {
      const p = S.profiles[pid]; if (!p) return;
      p.program = key; p.programLabel = (PROGRAMS[key] && PROGRAMS[key].name) || key; save();
    },
    setTrainerNote(pid, text) { const p = S.profiles[pid]; if (p) { p.trainerNote = text || ''; save(); } },
    // last activity timestamp for a client (ms) or 0
    lastActiveAt(pid) { const a = store.activitiesFor(pid); return a.length ? (a[a.length - 1].startedAt || 0) : 0; },
    // a client "needs attention" if they haven't trained in >3 days
    needsAttention(pid) {
      const t = store.lastActiveAt(pid);
      if (!t) return true;
      return (Date.now() - t) > 3 * 86400000;
    },

    /* ---- settings ---- */
    settings() { return S.meta; },
    completeOnboarding() { S.meta.onboarded = true; save(); },
    setUnits(u) { S.meta.units = u; save(); },
    setAccent(a) { S.meta.accent = a; save(); },
    setTheme(t) { S.meta.theme = t; save(); },
    goals() { return S.goals; },
    setGoals(patch) { Object.assign(S.goals, patch); save(); },

    /* ---- weight ---- */
    logWeight(kg, pid) { pid = pid || S.me; (S.weight[pid] = S.weight[pid] || []).push({ date: D.key(), kg: +kg }); save(); },
    weightSeries(pid) { return (S.weight[pid || S.me] || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); },
    latestWeight(pid) { const a = store.weightSeries(pid); return a.length ? a[a.length - 1] : null; },

    /* ---- walks (daily steps checkbox) ---- */
    isWalked(date, pid) { date = date || D.key(); pid = pid || S.me; return !!(S.walks[pid] && S.walks[pid][date]); },
    toggleWalk(date, pid) {
      date = date || D.key(); pid = pid || S.me;
      S.walks[pid] = S.walks[pid] || {};
      if (S.walks[pid][date]) delete S.walks[pid][date]; else S.walks[pid][date] = true;
      save();
    },
    walkDates(pid) { return Object.keys(S.walks[pid || S.me] || {}); },
    walkStreak(pid) {
      pid = pid || S.me; let n = 0, d = new Date();
      const w = S.walks[pid] || {};
      while (w[D.key(d)]) { n++; d = D.add(d, -1); }
      return n;
    },

    /* ---- lift program ---- */
    programFor(date) {
      date = date || new Date();
      const dk = D.key(date);
      const P = progSet(), DP = dayPlan();
      if (S.overrides[dk] && P[S.overrides[dk]]) return Object.assign({ key: S.overrides[dk] }, P[S.overrides[dk]]);
      const k = DP[date.getDay()] || 'rest';
      return Object.assign({ key: k }, P[k]);
    },
    setTodayProgram(key) { S.overrides[D.key()] = key; save(); },

    /* ---- live lift session ---- */
    currentSession() { return S.current; },
    startSession(programKey) {
      const p = programKey ? Object.assign({ key: programKey }, progSet()[programKey]) : store.programFor(new Date());
      S.current = { id: uid(), profileId: S.me, date: D.key(), type: p.key, program: p.name, startedAt: Date.now(), sets: [], photo: null };
      save(); return S.current;
    },
    logSet(ex, idx, kg, reps) {
      if (!S.current) store.startSession();
      S.current.sets.push({ ex, idx, kg: +kg, reps: +reps, t: Date.now() });
      save();
    },
    editSet(arrIndex, kg, reps) { if (S.current && S.current.sets[arrIndex]) { S.current.sets[arrIndex].kg = +kg; S.current.sets[arrIndex].reps = +reps; save(); } },
    deleteSet(arrIndex) { if (S.current && S.current.sets[arrIndex]) { S.current.sets.splice(arrIndex, 1); save(); } },
    cancelSession() { S.current = null; save(); },
    finishSession(extra) {
      if (!S.current) return null;
      const c = S.current;
      const prs = store.detectPRs({ profileId: c.profileId, sets: c.sets, id: c.id });
      const act = {
        id: c.id, profileId: c.profileId, type: 'lift', date: c.date,
        startedAt: c.startedAt, endedAt: Date.now(),
        durationSec: Math.round((Date.now() - c.startedAt) / 1000),
        title: c.program, program: c.type, note: (extra && extra.note) || '',
        photo: (extra && extra.photo) || c.photo || null,
        sets: c.sets.slice(), prs
      };
      S.activities[act.id] = act;
      S.current = null;
      save();
      store.checkBadges(act.profileId);
      return act;
    },
    lastSetFor(ex, pid) {
      pid = pid || S.me;
      const acts = store.activitiesFor(pid).filter(a => a.type === 'lift');
      for (let i = acts.length - 1; i >= 0; i--) {
        const hits = (acts[i].sets || []).filter(x => x.ex === ex);
        if (hits.length) return hits[hits.length - 1];
      }
      // also check live session
      if (S.current) { const h = S.current.sets.filter(x => x.ex === ex); if (h.length) return h[h.length - 1]; }
      return null;
    },

    /* ---- generic activities (walk/run/cardio/manual) ---- */
    addActivity(data) {
      const id = data.id || uid();
      const a = Object.assign({
        id, profileId: data.profileId || S.me, type: data.type || 'cardio',
        date: data.date || D.key(), startedAt: data.startedAt || Date.now(), endedAt: data.endedAt || Date.now(),
        durationSec: data.durationSec || 0, title: data.title || (ACT[data.type] ? ACT[data.type].label : 'Activity'),
        note: data.note || '', photo: data.photo || null,
        distanceKm: data.distanceKm || 0, steps: data.steps || 0, calories: data.calories || 0,
        sets: data.sets || null, prs: data.prs || []
      }, {});
      S.activities[id] = a;
      // a walk activity also marks the day's step checkbox
      if (a.type === 'walk' && a.profileId === S.me) { S.walks[S.me] = S.walks[S.me] || {}; S.walks[S.me][a.date] = true; }
      save();
      store.checkBadges(a.profileId);
      return a;
    },
    updateActivity(id, patch) { if (S.activities[id]) { Object.assign(S.activities[id], patch); save(); } },
    deleteActivity(id) { delete S.activities[id]; save(); },
    getActivity(id) { return S.activities[id] || null; },
    activitiesFor(pid) {
      pid = pid || S.me;
      return Object.values(S.activities).filter(a => a.profileId === pid)
        .sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
    },
    feed(opts) {
      opts = opts || {};
      let list = Object.values(S.activities);
      if (opts.profileId) list = list.filter(a => a.profileId === opts.profileId);
      if (opts.onlyMine) list = list.filter(a => a.profileId === S.me);
      list.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
      return opts.limit ? list.slice(0, opts.limit) : list;
    },

    /* ---- meals (food photo log) ---- */
    mealsFor(pid) { return store.activitiesFor(pid).filter(a => a.type === 'meal'); },
    // grouped by day, newest day first, items newest-first within a day
    mealsByDay(pid) {
      const map = {}, order = [];
      store.mealsFor(pid).forEach(m => { if (!map[m.date]) { map[m.date] = []; order.push(m.date); } map[m.date].push(m); });
      order.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
      return order.map(d => ({ date: d, items: map[d].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0)) }));
    },

    /* ---- PRs / records ---- */
    epley(kg, reps) { return kg * (1 + reps / 30); },
    detectPRs(activity) {
      const pid = activity.profileId || S.me;
      const prior = store.activitiesFor(pid).filter(a => a.type === 'lift' && a.id !== activity.id);
      const bestBefore = {}; // ex -> {weight, e1rm}
      prior.forEach(a => (a.sets || []).forEach(s => {
        const b = bestBefore[s.ex] = bestBefore[s.ex] || { weight: 0, e1rm: 0 };
        b.weight = Math.max(b.weight, s.kg);
        b.e1rm = Math.max(b.e1rm, store.epley(s.kg, s.reps));
      }));
      const prs = [];
      const seen = {};
      (activity.sets || []).forEach(s => {
        const b = bestBefore[s.ex] || { weight: 0, e1rm: 0 };
        const e = store.epley(s.kg, s.reps);
        const cur = seen[s.ex] = seen[s.ex] || { weight: 0, e1rm: 0 };
        if (s.kg > b.weight && s.kg > cur.weight) { prs.push({ ex: s.ex, kind: 'weight', value: s.kg, reps: s.reps }); }
        cur.weight = Math.max(cur.weight, s.kg); cur.e1rm = Math.max(cur.e1rm, e);
      });
      return prs;
    },
    personalRecords(pid) {
      pid = pid || S.me;
      const best = {};
      store.activitiesFor(pid).filter(a => a.type === 'lift').forEach(a => (a.sets || []).forEach(s => {
        const b = best[s.ex] = best[s.ex] || { ex: s.ex, weight: 0, reps: 0, e1rm: 0, date: a.date };
        if (s.kg > b.weight || (s.kg === b.weight && s.reps > b.reps)) { b.weight = s.kg; b.reps = s.reps; b.date = a.date; }
        b.e1rm = Math.max(b.e1rm, store.epley(s.kg, s.reps));
      }));
      return Object.values(best).sort((a, b) => b.e1rm - a.e1rm);
    },
    totalPRs(pid) { return store.activitiesFor(pid).reduce((n, a) => n + ((a.prs && a.prs.length) || 0), 0); },

    /* ---- derived stats ---- */
    totalVolume(pid) {
      return store.activitiesFor(pid).filter(a => a.type === 'lift')
        .reduce((sum, a) => sum + (a.sets || []).reduce((v, s) => v + s.kg * s.reps, 0), 0);
    },
    totalDistance(pid) { return store.activitiesFor(pid).reduce((s, a) => s + (a.distanceKm || 0), 0); },
    totalSessions(pid) { return store.activitiesFor(pid).filter(a => a.type === 'lift').length; },
    totalActivities(pid) { return store.activitiesFor(pid).length; },
    totalDuration(pid) { return store.activitiesFor(pid).reduce((s, a) => s + (a.durationSec || 0), 0); },

    // unique active days descending streak (any activity OR walk)
    activeDays(pid) {
      pid = pid || S.me;
      const set = {};
      store.activitiesFor(pid).forEach(a => { if (a.type !== 'meal') set[a.date] = true; }); // meals aren't training days
      Object.keys(S.walks[pid] || {}).forEach(d => set[d] = true);
      return set;
    },
    moveStreak(pid) {
      // grace: if today isn't logged yet, count the streak ending yesterday
      // (the streak you're still protecting) rather than dropping to 0 mid-morning.
      const set = store.activeDays(pid); let d = new Date();
      if (!set[D.key(d)]) d = D.add(d, -1);
      let n = 0;
      while (set[D.key(d)]) { n++; d = D.add(d, -1); }
      return n;
    },
    // weekly lift volume for last `weeks` weeks -> [{label, value, week}]
    volumeSeries(pid, weeks) {
      weeks = weeks || 8; pid = pid || S.me;
      const buckets = [];
      const monday = D.startOfWeek();
      for (let i = weeks - 1; i >= 0; i--) {
        const wkStart = D.add(monday, -7 * i);
        buckets.push({ week: D.key(wkStart), label: D.fmt(wkStart, { day: 'numeric', month: 'short' }), value: 0 });
      }
      const byWeek = {}; buckets.forEach(b => byWeek[b.week] = b);
      store.activitiesFor(pid).filter(a => a.type === 'lift').forEach(a => {
        const w = D.weekId(a.date); if (byWeek[w]) byWeek[w].value += (a.sets || []).reduce((v, s) => v + s.kg * s.reps, 0);
      });
      return buckets;
    },
    // last 7 days activity counts -> [{day:'M', date, count, walked}]
    weekBars(pid) {
      pid = pid || S.me; const out = []; const mon = D.startOfWeek();
      const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      for (let i = 0; i < 7; i++) {
        const d = D.add(mon, i), dk = D.key(d);
        const count = store.activitiesFor(pid).filter(a => a.date === dk && a.type !== 'meal').length;
        out.push({ day: labels[i], date: dk, count, walked: store.isWalked(dk, pid), isToday: dk === D.key() });
      }
      return out;
    },
    // heatmap of last N days -> [{date, level 0..4}]
    heatmap(pid, days) {
      pid = pid || S.me; days = days || 119; const out = []; const today = new Date();
      const acts = {}; store.activitiesFor(pid).forEach(a => { if (a.type !== 'meal') acts[a.date] = (acts[a.date] || 0) + 1; });
      const walks = S.walks[pid] || {};
      for (let i = days - 1; i >= 0; i--) {
        const dk = D.key(D.add(today, -i));
        let level = 0;
        if (acts[dk]) level = Math.min(4, 1 + acts[dk]);
        else if (walks[dk]) level = 1;
        out.push({ date: dk, level });
      }
      return out;
    },
    maxWorkoutsInAWeek(pid) {
      const byWeek = {};
      store.activitiesFor(pid).filter(a => a.type === 'lift').forEach(a => { const w = D.weekId(a.date); byWeek[w] = (byWeek[w] || 0) + 1; });
      return Object.values(byWeek).reduce((m, v) => Math.max(m, v), 0);
    },

    /* ---- challenges ---- */
    allChallenges() { return Object.values(S.challenges); },
    activeChallenges(pid) { pid = pid || S.me; const t = D.key(); return Object.values(S.challenges).filter(c => (c.members || []).indexOf(pid) >= 0 && c.endDate >= t); },
    challenge(id) { return S.challenges[id] || null; },
    createChallenge(data) {
      const id = data.id || uid();
      S.challenges[id] = {
        id, name: data.name || 'Challenge', desc: data.desc || '',
        metric: data.metric || 'workouts', goal: +data.goal || 10, unit: data.unit || '',
        startDate: data.startDate || D.key(), endDate: data.endDate || D.key(D.add(new Date(), 30)),
        createdBy: data.createdBy || S.me, members: data.members || [S.me],
        icon: data.icon || 'target', color: data.color || '#ff6a13'
      };
      save(); return id;
    },
    joinChallenge(id) { const c = S.challenges[id]; if (c && c.members.indexOf(S.me) < 0) { c.members.push(S.me); save(); } },
    leaveChallenge(id) { const c = S.challenges[id]; if (c) { c.members = c.members.filter(m => m !== S.me); save(); } },
    deleteChallenge(id) { delete S.challenges[id]; save(); },
    isJoined(id) { const c = S.challenges[id]; return !!(c && c.members.indexOf(S.me) >= 0); },
    // raw progress value for a profile within challenge window
    challengeValue(c, pid) {
      pid = pid || S.me;
      const acts = store.activitiesFor(pid).filter(a => D.inRange(a.date, c.startDate, c.endDate));
      switch (c.metric) {
        case 'workouts': return acts.filter(a => a.type === 'lift').length;
        case 'distance': return +acts.reduce((s, a) => s + (a.distanceKm || 0), 0).toFixed(1);
        case 'minutes':  return Math.round(acts.reduce((s, a) => s + (a.durationSec || 0), 0) / 60);
        case 'volume':   return Math.round(acts.filter(a => a.type === 'lift').reduce((v, a) => v + (a.sets || []).reduce((x, s) => x + s.kg * s.reps, 0), 0));
        case 'walkDays': { const w = S.walks[pid] || {}; return Object.keys(w).filter(d => D.inRange(d, c.startDate, c.endDate)).length; }
        case 'streak':   return store.moveStreak(pid);
        default: return acts.length;
      }
    },
    challengeProgress(id, pid) {
      const c = S.challenges[id]; if (!c) return { value: 0, goal: 1, pct: 0 };
      const value = store.challengeValue(c, pid);
      return { value, goal: c.goal, pct: Math.min(100, Math.round(value / c.goal * 100)), done: value >= c.goal };
    },
    // a personal goal counts as "won" once it has ended having hit its target
    wonAnyChallenge(pid) {
      pid = pid || S.me; const t = D.key();
      return Object.values(S.challenges).some(c => c.endDate < t
        && (c.members || []).indexOf(pid) >= 0
        && store.challengeValue(c, pid) >= c.goal);
    },

    /* ---- badges ---- */
    earnedBadges(pid) { pid = pid || S.me; return (S.badges[pid] || []).slice(); },
    hasBadge(id, pid) { pid = pid || S.me; return (S.badges[pid] || []).some(b => b.id === id); },
    checkBadges(pid) {
      pid = pid || S.me;
      S.badges[pid] = S.badges[pid] || [];
      const earned = S.badges[pid];
      const newly = [];
      BADGES.forEach(def => {
        if (earned.some(b => b.id === def.id)) return;
        try { if (def.test(store, pid)) { earned.push({ id: def.id, earnedAt: Date.now() }); newly.push(def); } } catch (e) {}
      });
      if (newly.length) { save(); emit('badges', { profileId: pid, badges: newly }); }
      return newly;
    },
    badgeDef(id) { return BADGES.find(b => b.id === id); },

    /* ---- import / export / sync ---- */
    exportJSON() { return JSON.stringify(S, null, 2); },
    exportProfile(pid) {
      pid = pid || S.me;
      return JSON.stringify({
        kind: 'ember-profile', profile: store.profile(pid),
        activities: store.activitiesFor(pid), walks: S.walks[pid] || {}, weight: S.weight[pid] || [],
        badges: S.badges[pid] || []
      }, null, 2);
    },
    importJSON(str) {
      const obj = JSON.parse(str);
      if (obj && obj.kind === 'ember-profile') return store.importProfile(obj);
      if (!obj || typeof obj !== 'object' || (!obj.profiles && !obj.meta && !obj.activities)) {
        throw new Error('Not an Ember backup file');
      }
      // full backup restore
      S = Object.assign(freshState(), obj);
      S.sync = Object.assign({}, freshState().sync, S.sync, { enabled: true });
      save(); return { restored: true };
    },
    importProfile(obj) {
      const p = obj.profile; if (!p) throw new Error('No profile in file');
      p.isMe = false; S.profiles[p.id] = p;
      (obj.activities || []).forEach(a => { a.profileId = p.id; S.activities[a.id] = a; });
      S.walks[p.id] = obj.walks || {}; S.weight[p.id] = obj.weight || []; S.badges[p.id] = obj.badges || [];
      save(); return { imported: p.name };
    },
    async syncNow() { const j = await pushState(); if (j && j.error) throw new Error(j.error); return j; },
    // upload a dataURL image to the server, return its public URL (meal/progress photos)
    async uploadPhoto(dataUrl) {
      if (!dataUrl) return null;
      if (!syncReady()) throw new Error('Backup not configured');
      const r = await fetch(SYNC_URL + '?action=upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + syncToken(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataUrl })
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status));
      return j.url;
    },
    async pullState() {
      if (!syncReady()) throw new Error('Backup not configured');
      const r = await fetch(SYNC_URL + '?action=getstate&user=' + CURRENT, { headers: { 'Authorization': 'Bearer ' + syncToken() } });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status));
      if (!j.state) return { empty: true };
      S = Object.assign(freshState(), j.state);
      S.sync = Object.assign({}, freshState().sync, S.sync, { enabled: true, lastAt: Date.now(), lastError: null });
      save(); emit('change');
      return { restored: true, at: j.updated_at };
    },
    syncState() { return { enabled: syncReady(), lastAt: S.sync && S.sync.lastAt, lastError: S.sync && S.sync.lastError, syncing }; },
    setSync(patch) { Object.assign(S.sync, patch); save(); }
  };

  // initial backlog flush (token is set by pact-sync.js after this file; pushState re-checks readiness at fire time)
  if (CURRENT) scheduleSync(2500);
  if (typeof window !== 'undefined') window.addEventListener('online', () => { if (syncReady()) scheduleSync(500); });

  App.store = store;
})(window.App);
