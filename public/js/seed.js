/* ============================================================
   EMBER · Seed — first-run demo dataset.
   Not a view. Exposes App.seed = { ensure(), demoReset() }.
   Idempotent: ensure() bails if any profile already exists.
   Uses ONLY store APIs. Runs in the browser (new Date/Math OK).
   Demo "today" is 2026-06-01.
   ============================================================ */
window.App = window.App || {};
(function (App) {
  'use strict';

  const store = App.store;

  // 18:00 local on a given YYYY-MM-DD, in ms epoch.
  function eveningOf(date) {
    return store.D.parse(date).getTime() + 18 * 3600 * 1000;
  }
  /* Build a lift session's flat sets[] from a compact spec:
     spec = [{ ex, sets:[[kg,reps], ...] }, ...]
     idx = per-exercise set index from 0; t = startedAt + i*180000 (3 min apart). */
  function buildSets(spec, startedAt) {
    const out = [];
    let i = 0;
    spec.forEach(group => {
      group.sets.forEach((pair, perEx) => {
        out.push({
          ex: group.ex,
          idx: perEx,
          kg: pair[0],
          reps: pair[1],
          t: startedAt + i * 180000
        });
        i++;
      });
    });
    return out;
  }

  // Add a lift session from a program key + compact spec. `extra` may carry {note, photo}.
  function addLift(meId, date, programKey, spec, durationSec, prs, extra) {
    const startedAt = eveningOf(date);
    const endedAt = startedAt + durationSec * 1000;
    const prog = store.PROGRAMS[programKey];
    return store.addActivity({
      type: 'lift',
      profileId: meId,
      date: date,
      program: programKey,
      title: prog ? prog.name : programKey,
      startedAt: startedAt,
      endedAt: endedAt,
      durationSec: durationSec,
      sets: buildSets(spec, startedAt),
      prs: prs || [],
      note: (extra && extra.note) || '',
      photo: (extra && extra.photo) || null
    });
  }
  // stable demo "progress photo" (real JPEG, consistent per seed, no broken images)
  function photo(seed) { return 'https://picsum.photos/seed/' + encodeURIComponent(seed) + '/640/520'; }

  // n identical [kg,reps] sets.
  function reps(kg, count, n) {
    const a = [];
    for (let i = 0; i < n; i++) a.push([kg, count]);
    return a;
  }

  function ensure() {
    // Idempotent guard — bail if any profile already exists.
    if (store.allProfiles().length > 0) return;
    // Only auto-seed on the very first launch. After a "Reset all data" the
    // marker persists, so a reset gives a clean onboarding instead of re-seeding.
    try { if (localStorage.getItem('ember_seeded')) return; } catch (e) {}

    /* ---------------- profiles ---------------- */
    const meId = store.addProfile({
      name: 'Listy', handle: '@listy',
      goal: 'Look good in clothes by Dec 31', heightCm: 170, isMe: true, color: '#ff6a13'
    });
    store.completeOnboarding();

    /* ---------------- Listy lift sessions ---------------- */
    addLift(meId, '2026-05-21', 'upperA', [
      { ex: 'Barbell Bench Press', sets: reps(15, 8, 4) },
      { ex: 'Seated Cable Row', sets: [[25, 12], [25, 12], [25, 11]] },
      { ex: 'Shoulder Press Machine', sets: [[5, 10], [5, 9], [5, 7]] },
      { ex: 'Cable Lateral Raise', sets: [[5, 12], [5, 12], [5, 9]] },
      { ex: 'Standing Face Pull', sets: reps(20, 12, 3) }
    ], 2940);

    addLift(meId, '2026-05-22', 'lowerB', [
      { ex: 'Barbell Deadlift', sets: [[40, 8], [40, 8], [40, 6]] },
      { ex: 'Front Foot Elevated Reverse Lunge', sets: reps(10, 10, 2) },
      { ex: 'Seated Leg Curl', sets: reps(20, 12, 2) },
      { ex: 'Seated Calf Raise', sets: reps(30, 15, 2) }
    ], 2760);

    addLift(meId, '2026-05-24', 'upperB', [
      { ex: 'Incline Machine Press', sets: reps(20, 10, 2) },
      { ex: 'Lat Pulldown', sets: [[35, 10], [35, 10], [35, 8]] },
      { ex: 'Cable Lateral Raise', sets: reps(5, 15, 2) },
      { ex: 'Chest-Supported Row Machine', sets: reps(25, 12, 2) }
    ], 2820);

    addLift(meId, '2026-05-25', 'lowerA', [
      { ex: 'Barbell Back Squat', sets: reps(30, 8, 3) },
      { ex: 'Romanian Deadlift', sets: reps(40, 12, 2) },
      { ex: 'Seated Leg Extension', sets: reps(30, 12, 2) },
      { ex: 'Standing Calf Raise', sets: reps(30, 15, 1) }
    ], 3000);

    addLift(meId, '2026-05-28', 'upperA', [
      { ex: 'Barbell Bench Press', sets: [[17.5, 8], [17.5, 8], [17.5, 7], [15, 9]] },
      { ex: 'Seated Cable Row', sets: reps(27.5, 12, 3) },
      { ex: 'Shoulder Press Machine', sets: reps(5, 10, 3) },
      { ex: 'Cable Lateral Raise', sets: reps(5, 12, 3) },
      { ex: 'Standing Face Pull', sets: reps(22.5, 12, 3) }
    ], 3120);

    addLift(meId, '2026-05-31', 'lowerB', [
      { ex: 'Barbell Deadlift', sets: [[45, 8], [45, 6], [45, 6]] },
      { ex: 'Front Foot Elevated Reverse Lunge', sets: reps(12, 10, 2) },
      { ex: 'Seated Leg Curl', sets: reps(22.5, 12, 1) },
      { ex: 'Seated Calf Raise', sets: reps(32.5, 15, 1) }
    ], 2880, [{ ex: 'Barbell Deadlift', kind: 'weight', value: 45, reps: 8 }]);

    /* ---------------- Listy walks ----------------
       2026-05-21 .. 2026-05-31, skipping 26 & 27. Leave today (06-01) unwalked. */
    const listyWalkDays = [
      '2026-05-21', '2026-05-22', '2026-05-23', '2026-05-24', '2026-05-25',
      '2026-05-28', '2026-05-29', '2026-05-30', '2026-05-31'
    ];
    listyWalkDays.forEach(d => store.toggleWalk(d, meId));

    /* ---------------- Listy weight (historical, written directly) ---------------- */
    store.state.weight[meId] = [
      { date: '2026-05-21', kg: 75.5 },
      { date: '2026-05-25', kg: 77 },
      { date: '2026-05-28', kg: 78.5 },
      { date: '2026-05-31', kg: 77.6 }
    ];
    store.save();

    /* ---------------- personal goals (challenges) ---------------- */
    store.createChallenge({
      name: 'June Step Streak', desc: 'Hit your steps every day this month',
      metric: 'walkDays', goal: 30, unit: 'days',
      startDate: '2026-06-01', endDate: '2026-06-30',
      icon: 'walk', color: '#1bbf74', members: [meId]
    });
    store.createChallenge({
      name: 'Lift Month', desc: '12 workouts this month',
      metric: 'workouts', goal: 12, unit: 'workouts',
      startDate: '2026-06-01', endDate: '2026-06-30',
      icon: 'dumbbell', color: '#ff6a13', members: [meId]
    });
    store.createChallenge({
      name: 'June Distance', desc: 'Cover 30 km on foot or wheels',
      metric: 'distance', goal: 30, unit: 'km',
      startDate: '2026-06-01', endDate: '2026-06-30',
      icon: 'route', color: '#2f8bff', members: [meId]
    });
    // A completed past goal → earns the Champion badge on first run.
    store.createChallenge({
      name: 'May Kickoff', desc: 'Move 8 days to restart',
      metric: 'walkDays', goal: 8,
      startDate: '2026-05-21', endDate: '2026-05-31',
      icon: 'flame', color: '#ff9e2c', members: [meId]
    });

    /* ---------------- badges ---------------- */
    store.checkBadges(meId);

    try { localStorage.setItem('ember_seeded', '1'); } catch (e) {}
  }

  // Generic non-lift activity (run/walk/cycle/cardio) for a profile.
  function addCardio(cid, date, type, distanceKm, durationMin, extra) {
    const startedAt = store.D.parse(date).getTime() + 7 * 3600 * 1000; // ~07:00
    return store.addActivity({
      type: type, profileId: cid, date: date,
      distanceKm: distanceKm || 0, durationSec: Math.round((durationMin || 0) * 60),
      startedAt: startedAt, endedAt: startedAt + (durationMin || 0) * 60000,
      title: (store.ACT[type] ? store.ACT[type].label : 'Activity') + (distanceKm ? ' · ' + distanceKm.toFixed(1) + ' km' : ''),
      note: (extra && extra.note) || '', photo: (extra && extra.photo) || null
    });
  }

  /* ---------------- demo clients (trainer side) ----------------
     Idempotent. Adds a roster only if none exists. Runs even on an
     existing install so the trainer dashboard is alive immediately. */
  function ensureClients() {
    if (store.clients().length > 0) return;
    try { if (localStorage.getItem('ember_clients_seeded')) return; } catch (e) {}

    const me = store.me();
    const trainerId = me ? me.id : null;

    // give the trainer a coach-side identity on their own profile, so flipping
    // to CLIENT view also looks populated (assigned plan + coach note).
    if (me && !me.program) {
      store.updateProfile(me.id, {
        coachName: 'Coach Ardi', program: 'upperA', programLabel: store.PROGRAMS.upperA.name,
        phase: 'Recomp · Week 4',
        trainerNote: 'Push bench toward bodyweight, protect the lower back on pulls. 4 sessions + 9k steps daily.'
      });
    }

    /* ---- Dewi — consistent, trained TODAY (green) ---- */
    const dewi = store.addProfile({
      name: 'Dewi Larasati', role: 'client', color: '#ff4d5e', heightCm: 162,
      phase: 'Cut · Week 4', goal: 'Reach 58 kg, hold strength',
      program: 'lowerA', programLabel: store.PROGRAMS.lowerA.name, trainerId: trainerId,
      trainerNote: 'Knees feel better — add squat depth this week, keep steps at 9k. Strong adherence.'
    });
    addLift(dewi, '2026-06-06', 'lowerB', [
      { ex: 'Barbell Deadlift', sets: reps(55, 8, 3) },
      { ex: 'Front Foot Elevated Reverse Lunge', sets: reps(12, 10, 2) },
      { ex: 'Seated Leg Curl', sets: reps(25, 12, 3) },
      { ex: 'Seated Calf Raise', sets: reps(35, 15, 2) }
    ], 2700);
    addLift(dewi, '2026-06-10', 'upperA', [
      { ex: 'Barbell Bench Press', sets: reps(22.5, 10, 3) },
      { ex: 'Seated Cable Row', sets: reps(32.5, 12, 3) },
      { ex: 'Shoulder Press Machine', sets: reps(12.5, 10, 3) },
      { ex: 'Chest Fly Machine', sets: reps(25, 12, 3) }
    ], 2640, [], { photo: photo('ember-dewi-1'), note: 'Upper day — felt light, good pump' });
    addLift(dewi, '2026-06-13', 'lowerA', [
      { ex: 'Barbell Back Squat', sets: [[40, 8], [42.5, 8], [45, 7]] },
      { ex: 'Romanian Deadlift', sets: reps(40, 12, 3) },
      { ex: 'Seated Leg Extension', sets: reps(35, 12, 3) },
      { ex: 'Standing Calf Raise', sets: reps(40, 15, 3) }
    ], 2820, [{ ex: 'Barbell Back Squat', kind: 'weight', value: 45, reps: 7 }]);
    addCardio(dewi, '2026-06-14', 'run', 5.2, 31, { note: 'Easy morning 5k before work' });
    ['2026-06-06', '2026-06-08', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13', '2026-06-14'].forEach(d => store.toggleWalk(d, dewi));
    store.state.weight[dewi] = [
      { date: '2026-05-24', kg: 61.2 }, { date: '2026-05-31', kg: 60.5 },
      { date: '2026-06-07', kg: 59.8 }, { date: '2026-06-13', kg: 59.1 }
    ];

    /* ---- Rama — lean bulk, last trained 2 days ago ---- */
    const rama = store.addProfile({
      name: 'Rama Aditya', role: 'client', color: '#2f8bff', heightCm: 178,
      phase: 'Lean bulk · Week 2', goal: 'Add 4 kg lean mass',
      program: 'upperB', programLabel: store.PROGRAMS.upperB.name, trainerId: trainerId,
      trainerNote: 'Bench moving well — try 60 kg next week. Sleep is the lever, aim 7.5h.'
    });
    addLift(rama, '2026-06-05', 'upperA', [
      { ex: 'Barbell Bench Press', sets: reps(55, 8, 3) },
      { ex: 'Seated Cable Row', sets: reps(50, 10, 3) },
      { ex: 'Shoulder Press Machine', sets: reps(25, 10, 3) }
    ], 3000);
    addLift(rama, '2026-06-09', 'lowerB', [
      { ex: 'Barbell Deadlift', sets: [[90, 6], [95, 5], [100, 4]] },
      { ex: 'Front Foot Elevated Reverse Lunge', sets: reps(20, 10, 2) },
      { ex: 'Seated Leg Curl', sets: reps(35, 12, 3) }
    ], 2880, [{ ex: 'Barbell Deadlift', kind: 'weight', value: 100, reps: 4 }]);
    addLift(rama, '2026-06-12', 'upperB', [
      { ex: 'Incline Machine Press', sets: reps(40, 10, 3) },
      { ex: 'Lat Pulldown', sets: [[50, 10], [52.5, 9], [52.5, 8]] },
      { ex: 'Cable Lateral Raise', sets: reps(7.5, 15, 3) },
      { ex: 'Chest-Supported Row Machine', sets: reps(40, 12, 3) }
    ], 3120, [], { photo: photo('ember-rama-1'), note: 'Strong session, paused bench reps' });
    addCardio(rama, '2026-06-11', 'cycle', 18, 55, {});
    ['2026-06-05', '2026-06-08', '2026-06-09', '2026-06-11', '2026-06-12'].forEach(d => store.toggleWalk(d, rama));
    store.state.weight[rama] = [
      { date: '2026-05-28', kg: 72.0 }, { date: '2026-06-04', kg: 72.8 }, { date: '2026-06-11', kg: 73.6 }
    ];

    /* ---- Bagus — NEEDS ATTENTION, quiet for a week ---- */
    const bagus = store.addProfile({
      name: 'Bagus Saputra', role: 'client', color: '#9b59ff', heightCm: 171,
      phase: 'Recomp', goal: 'Build a base habit',
      program: 'upperA', programLabel: store.PROGRAMS.upperA.name, trainerId: trainerId,
      trainerNote: 'Went quiet after a strong start. Nudge him — 2 sessions/week minimum, keep it simple.'
    });
    addLift(bagus, '2026-06-07', 'upperA', [
      { ex: 'Barbell Bench Press', sets: reps(40, 10, 3) },
      { ex: 'Lat Pulldown', sets: reps(40, 10, 3) },
      { ex: 'Shoulder Press Machine', sets: reps(15, 10, 3) }
    ], 2400);
    ['2026-06-05', '2026-06-07'].forEach(d => store.toggleWalk(d, bagus));
    store.state.weight[bagus] = [{ date: '2026-05-30', kg: 84.2 }, { date: '2026-06-06', kg: 83.6 }];

    /* ---- Sari — brand new, no data yet (empty-state test) ---- */
    store.addProfile({
      name: 'Sari Wulandari', role: 'client', color: '#1bbf74', heightCm: 165,
      phase: 'Onboarding', goal: 'Get started, learn the lifts',
      program: 'upperA', programLabel: store.PROGRAMS.upperA.name, trainerId: trainerId,
      joinedAt: store.today(),
      trainerNote: 'Just signed up — book the intake call and film a baseline.'
    });

    [dewi, rama, bagus].forEach(id => store.checkBadges(id));
    store.save();
    try { localStorage.setItem('ember_clients_seeded', '1'); } catch (e) {}
  }

  // Wipe everything and rebuild the demo dataset (used by Settings).
  function demoReset() {
    try { localStorage.removeItem('ember_seeded'); localStorage.removeItem('ember_clients_seeded'); } catch (e) {}
    store.reset();
    ensure();
    ensureClients();
  }

  App.seed = { ensure: ensure, demoReset: demoReset, ensureClients: ensureClients };
})(window.App);
