/* ============================================================
   EMBER · Dashboard — the home tab.
   Time-aware greeting hero, daily steps check, weekly activity,
   active challenges rail, and recent personal feed.
   ============================================================ */
(function (App) {
  'use strict';
  const { el, h, fmt, avatar, icon, pageTitle, empty, countUp, haptic } = App.ui;
  const store = App.store, charts = App.charts, router = App.router;
  const D = store.D;

  /* small helper: a heading row with a "See all" affordance */
  function sectionHead(title, toPath) {
    return el('div', { class: 'between mt-5 mb-3' }, [
      el('h2', { class: 't-lg', text: title }),
      toPath ? el('button', {
        class: 'pill', html: '<span>See all</span>' + icon('chevR', 14),
        on: { click: () => { haptic(8); router.go(toPath); } }
      }) : null
    ]);
  }

  /* ---------- 1 · greeting hero ---------- */
  function heroCard(me) {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    const first = (me && me.name ? me.name.trim().split(/\s+/)[0] : 'there');
    const dateStr = D.fmt(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });
    const streak = store.moveStreak();

    const hero = el('div', { class: 'card hero' });

    // top row: greeting + date · streak pill
    hero.appendChild(el('div', { class: 'between', style: { alignItems: 'flex-start' } }, [
      el('div', {}, [
        el('div', { class: 'label', text: dateStr }),
        el('h1', { class: 'mt-1', style: { fontSize: 'var(--t-2xl)', lineHeight: '1.05' }, text: 'Good ' + part + ',' }),
        el('h1', { style: { fontSize: 'var(--t-2xl)', lineHeight: '1.05' }, text: first })
      ]),
      el('div', {
        class: 'pill',
        style: { background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.35)', color: 'var(--on-flame)' },
        html: icon('flame', 15) + '<span class="tnum semi">' + streak + 'd</span>'
      })
    ]));

    // today plan
    const plan = store.programFor();
    const session = store.currentSession();
    const planRow = el('div', { class: 'mt-4' });

    if (session) {
      planRow.appendChild(el('div', { class: 'label mb-2', text: 'In progress · ' + (session.program || plan.name) }));
      planRow.appendChild(el('button', {
        class: 'btn glass block',
        html: icon('play', 19) + '<span>Resume workout</span>',
        on: { click: () => { haptic(15); router.go('/workout'); } }
      }));
    } else if (plan.key !== 'rest') {
      planRow.appendChild(el('div', { class: 'label mb-2', text: "Today's session" }));
      planRow.appendChild(el('div', { class: 'semi t-lg mb-3', text: plan.name }));
      planRow.appendChild(el('button', {
        class: 'btn glass block',
        html: icon('dumbbell', 19) + '<span>Start workout</span>',
        on: { click: () => { haptic(15); router.go('/workout'); } }
      }));
    } else {
      planRow.appendChild(el('div', { class: 'row gap-2 mt-2', style: { color: 'var(--on-flame)' } }, [
        h(icon('walk', 18)),
        el('div', { class: 'semi', text: 'Rest day — walk only' })
      ]));
    }
    hero.appendChild(planRow);
    return hero;
  }

  /* ---------- 1b · your coach (client view only) ---------- */
  function coachCard() {
    const me = store.me();
    if (!me) return null;
    const progKey = me.program;
    const prog = progKey && store.PROGRAMS[progKey];
    const coach = me.coachName || 'Your coach';

    const card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'between', style: { alignItems: 'center' } }, [
      el('div', { class: 'row gap-2', style: { alignItems: 'center' } }, [
        el('div', { class: 'iconbtn', style: { background: 'var(--grad-flame)', color: 'var(--on-flame)', border: '0', flexShrink: '0' }, html: icon('users', 20) }),
        el('div', {}, [
          el('div', { class: 'label', text: 'From your coach' }),
          el('div', { class: 'semi', text: coach })
        ])
      ]),
      me.phase ? el('span', { class: 'pill', text: me.phase }) : null
    ]));

    if (prog) {
      card.appendChild(el('div', { class: 'mt-3' }, [
        el('div', { class: 'label mb-1', text: 'Assigned plan' }),
        el('div', { class: 'semi t-lg', text: prog.name })
      ]));
      const list = el('div', { class: 'mt-2' });
      (prog.ex || []).slice(0, 4).forEach(x => {
        list.appendChild(el('div', { class: 'between', style: { padding: '7px 0', borderTop: '1px solid var(--line)' } }, [
          el('div', { class: 't-sm', text: x.n }),
          el('div', { class: 'muted t-xs tnum', text: x.sets + '×' + x.reps })
        ]));
      });
      card.appendChild(list);
    }

    if (me.trainerNote) {
      card.appendChild(el('div', { class: 'card nested mt-3', style: { borderLeft: '3px solid var(--flame)' } }, [
        el('div', { class: 'muted t-xs mb-1', text: 'Coach note' }),
        el('div', { class: 't-sm', style: { fontStyle: 'italic' }, text: '“' + me.trainerNote + '”' })
      ]));
    }
    return card;
  }

  /* ---------- 2 · daily steps ---------- */
  function stepsCard() {
    const goalSteps = (store.goals() && store.goals().stepsPerDay) || 10000;
    const on = store.isWalked();
    const streak = store.walkStreak();

    const check = el('button', {
      class: 'walk-check center',
      style: {
        width: '64px', height: '64px', borderRadius: '50%', flexShrink: '0',
        border: on ? '0' : '2px solid var(--line-strong)',
        background: on ? 'linear-gradient(135deg, #34d98a, #1bbf74)' : 'var(--glass-fill-2)',
        color: on ? '#fff' : 'var(--dim)',
        boxShadow: on ? '0 8px 22px rgba(27,191,116,0.4)' : 'none',
        transition: 'transform var(--d-fast) var(--e-spring), background var(--d), box-shadow var(--d)'
      },
      html: icon('check', 28)
    });
    check.addEventListener('click', () => {
      haptic([10, 30, 10]);
      check.classList.add('pop');
      store.toggleWalk();
    });

    const card = el('div', { class: 'card' }, [
      el('div', { class: 'between' }, [
        el('div', {}, [
          el('div', { class: 'label', text: 'Daily steps' }),
          el('div', { class: 'bold mt-1', style: { fontSize: '22px', letterSpacing: '-0.03em' } }, [
            el('span', { class: 'tnum', text: fmt.num(goalSteps) }),
            el('span', { class: 'muted t-md semi', text: ' steps today' })
          ]),
          el('div', {
            class: 't-sm mt-1 ' + (on ? 'good semi' : 'muted'),
            text: on
              ? (streak > 1 ? 'Done · ' + streak + '-day streak' : 'Done for today')
              : 'Tap to mark complete'
          })
        ]),
        check
      ])
    ]);
    return card;
  }

  /* ---------- 3 · this week ---------- */
  function weekCard(me) {
    const bars = store.weekBars();
    const goals = store.goals() || {};
    const workoutGoal = goals.workoutsPerWeek || 4;

    // current-week derived stats
    const weekId = D.weekId(store.today());
    const weekActs = store.activitiesFor().filter(a => D.weekId(a.date) === weekId);
    const liftCount = weekActs.filter(a => a.type === 'lift').length;
    const weekVolume = weekActs.filter(a => a.type === 'lift')
      .reduce((v, a) => v + (a.sets || []).reduce((x, s) => x + s.kg * s.reps, 0), 0);
    const moveStreak = store.moveStreak();

    // weight + delta vs first logged weight
    const series = store.weightSeries();
    const latest = store.latestWeight();
    let weightDelta = null;
    if (latest && series.length > 1) weightDelta = +(latest.kg - series[0].kg).toFixed(1);

    const card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'label mb-3', text: 'This week' }));
    card.appendChild(charts.bars(
      bars.map(b => ({ label: b.day, value: b.count, highlight: b.isToday })),
      { height: 120, showValues: true }
    ));

    // stat tiles
    const grid = el('div', { class: 'grid-2 mt-4' });

    grid.appendChild(statTile('Workouts', () => {
      const v = el('div', { class: 'v tnum' });
      countUp(v, liftCount, { suffix: ' / ' + workoutGoal });
      return v;
    }, liftCount >= workoutGoal ? { txt: 'Goal hit', dir: 'up' } : null));

    grid.appendChild(statTile('Volume', () => {
      const v = el('div', { class: 'v tnum', text: fmt.volume(weekVolume) });
      return v;
    }, null));

    grid.appendChild(statTile('Move streak', () => {
      const v = el('div', { class: 'v tnum' });
      countUp(v, moveStreak, { suffix: 'd' });
      return v;
    }, null));

    grid.appendChild(statTile('Weight', () => {
      if (!latest) return el('div', { class: 'v muted', style: { fontSize: '18px' }, text: '—' });
      return el('div', { class: 'v tnum', text: fmt.weight(latest.kg) });
    }, latest && weightDelta != null && weightDelta !== 0
      ? { txt: (weightDelta > 0 ? '+' : '') + fmt.weight(Math.abs(weightDelta), false) + ' ' + fmt.rawWeightUnit(), dir: weightDelta < 0 ? 'up' : 'down' }
      : null));

    card.appendChild(grid);
    return card;
  }

  function statTile(label, valueFn, delta) {
    return el('div', { class: 'card nested tile' }, [
      el('div', { class: 'k', text: label }),
      valueFn(),
      delta ? el('div', { class: 'delta ' + (delta.dir === 'up' ? 'up' : 'down'), text: delta.txt }) : null
    ]);
  }

  /* ---------- 4 · active challenges rail ---------- */
  function challengesRail() {
    const active = store.activeChallenges();
    if (!active.length) return null;

    const wrap = el('div', {});
    wrap.appendChild(sectionHead('Your goals', '/challenges'));

    const rail = el('div', { class: 'rail' });
    active.forEach(c => {
      const p = store.challengeProgress(c.id);
      const card = el('button', {
        class: 'card nested col center',
        style: { width: '150px', textAlign: 'center', gap: '6px', padding: '16px' },
        on: { click: () => { haptic(8); router.go('/challenges/' + c.id); } }
      }, [
        charts.ring(p.pct, { size: 64, stroke: 8, centerBig: p.pct + '%' }),
        el('div', { class: 'semi truncate mt-2', style: { width: '100%' }, text: c.name }),
        el('div', { class: 'muted t-xs tnum', text: fmt.num(p.value) + ' / ' + fmt.num(p.goal) + (c.unit ? ' ' + c.unit : '') })
      ]);
      rail.appendChild(card);
    });
    wrap.appendChild(rail);
    return wrap;
  }

  /* ---------- 5 · recent ---------- */
  function recentSection() {
    const wrap = el('div', {});
    wrap.appendChild(sectionHead('Recent', '/feed'));

    const items = store.feed({ onlyMine: true, limit: 3 });
    if (!items.length) {
      wrap.appendChild(el('div', { class: 'card' }, empty('feed', 'No activity yet', 'Tap + to log your first one')));
      return wrap;
    }

    if (App.components && App.components.activityCard) {
      items.forEach(a => wrap.appendChild(App.components.activityCard(a, { compact: true })));
    } else {
      const card = el('div', { class: 'card' });
      items.forEach(a => card.appendChild(simpleRow(a)));
      wrap.appendChild(card);
    }
    return wrap;
  }

  function simpleRow(a) {
    const meta = store.ACT[a.type] || store.ACT.cardio;
    const me = store.profile(a.profileId) || store.me();
    // primary stat by activity type
    let stat = '';
    if (a.type === 'lift') {
      const vol = (a.sets || []).reduce((v, s) => v + s.kg * s.reps, 0);
      stat = vol ? fmt.volume(vol) : fmt.duration(a.durationSec);
    } else if (a.distanceKm) {
      stat = fmt.distance(a.distanceKm);
    } else if (a.durationSec) {
      stat = fmt.duration(a.durationSec);
    }

    const row = el('div', { class: 'item' }, [
      el('div', {
        class: 'iconbtn',
        style: { color: meta.color, flexShrink: '0' },
        html: icon(meta.icon, 20)
      }),
      el('div', { class: 'body' }, [
        el('div', { class: 't truncate', text: a.title || meta.label }),
        el('div', { class: 's' }, [
          h(icon('clock', 12)),
          el('span', { text: ' ' + fmt.relative(a.startedAt || Date.now()) })
        ])
      ]),
      stat ? el('div', { class: 'tail tnum semi', style: { color: 'var(--ink)' }, text: stat }) : null
    ]);
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => { haptic(8); router.go('/feed/' + a.id); });
    return row;
  }

  /* ---------- render ---------- */
  function render(root, params) {
    const me = store.me(); // may be null on an empty store
    const page = el('div', { class: 'stagger' });

    page.appendChild(heroCard(me));
    if (store.isClient()) { const cc = coachCard(); if (cc) page.appendChild(el('div', { class: 'mt-3' }, cc)); }
    page.appendChild(el('div', { class: 'mt-3' }, stepsCard()));
    page.appendChild(el('div', { class: 'mt-3' }, weekCard(me)));

    const rail = challengesRail();
    if (rail) page.appendChild(rail);

    page.appendChild(recentSection());

    root.appendChild(page);
  }

  App.registerView('dashboard', { render, title: 'Home' });
})(window.App);
