/* ============================================================
   Ember Pact — Home. Money balance in your face, today's two
   requirements, and a both-sides week strip.
   ============================================================ */
(function (App) {
  'use strict';
  const { el, h, icon, haptic, pageTitle, fmt } = App.ui;
  const store = App.store, router = App.router, pact = App.pact, sync = App.pactSync;

  const NAME = { me: 'Listy', gf: 'Yeti' };
  const D = store.D;

  function ensureTodayRow(me, today) {
    // snapshot today's is_workout_day so an untouched scheduled day still counts
    const row = sync.cachedDay(me, today);
    const isW = store.isPactWorkoutDay(today);
    if (isW && (!row || !row.isWorkoutDay) && window._pactEnsured !== today) {
      window._pactEnsured = today;
      sync.putDay({ date: today, isWorkoutDay: true }).catch(() => {});
    }
  }

  function moneyHero(me, other, month, today) {
    // Before the pact starts, nothing counts — show a calm pre-start hero.
    if (today < pact.PACT_START) {
      return el('div', { class: 'card', style: { textAlign: 'center', padding: '24px 18px' } }, [
        el('div', { class: 'label', text: 'Pact starts 1 July' }),
        el('div', { class: 'bold', style: { fontFamily: 'var(--font-display)', fontSize: '40px', letterSpacing: '-0.03em', lineHeight: '1.1', margin: '4px 0' }, text: pact.fmtRp(0) }),
        el('div', { class: 't-xs muted', text: 'No money on the line yet — get set up and warm up' })
      ]);
    }
    const myMiss = pact.missedDays(sync.cache, me, month, today);
    const partnerMiss = pact.missedDays(sync.cache, other, month, today);
    const net = (partnerMiss - myMiss) * pact.STAKE;     // +ve: partner owes me
    const owesYou = net > 0, youOwe = net < 0;
    const label = owesYou ? (NAME[other] + ' owes you') : youOwe ? ('You owe ' + NAME[other]) : 'All square this month';

    return el('div', { class: 'card', style: {
      background: net === 0 ? null : 'var(--grad-flame)',
      color: net === 0 ? null : 'var(--on-flame)',
      textAlign: 'center', padding: '24px 18px'
    } }, [
      el('div', { class: 'label', style: { opacity: '0.9', color: net === 0 ? null : 'var(--on-flame)' }, text: label }),
      el('div', { class: 'bold', style: { fontFamily: 'var(--font-display)', fontSize: '44px', letterSpacing: '-0.03em', lineHeight: '1.1', margin: '4px 0' },
        text: pact.fmtRp(net) }),
      el('div', { class: 't-xs', style: { opacity: '0.85' }, text: 'This month · settles & resets on the 1st' })
    ]);
  }

  function reqTile(opts) {
    const tile = el('button', { class: 'card nested between', style: { width: '100%', textAlign: 'left', padding: '16px', marginTop: '10px',
      borderColor: opts.done ? 'rgba(27,191,116,0.5)' : null } }, [
      el('div', { class: 'row gap-3', style: { minWidth: '0' } }, [
        el('div', { class: 'iconbtn', style: opts.done
          ? { background: 'var(--good-soft)', color: 'var(--good)', border: '0' }
          : { background: 'var(--grad-flame)', color: 'var(--on-flame)', border: '0' }, html: icon(opts.icon, 22) }),
        el('div', { class: 'col', style: { minWidth: '0' } }, [
          el('div', { class: 'semi', text: opts.title }),
          el('div', { class: 'muted t-xs', text: opts.sub })
        ])
      ]),
      opts.done ? el('span', { class: 'good', style: { display: 'inline-flex' }, html: icon('checkCircle', 24) })
                : h(icon('chevR', 20))
    ]);
    tile.addEventListener('click', () => { haptic(10); opts.onClick(); });
    return tile;
  }

  function weekStrip(me, other, today) {
    const mon = D.startOfWeek();
    const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    function weekCount(user) {
      let n = 0;
      for (let i = 0; i < 7; i++) { const dk = D.key(D.add(mon, i)); if (pact.isComplete(sync.cachedDay(user, dk))) n++; }
      return n;
    }
    function rowFor(user) {
      const dots = el('div', { class: 'row', style: { gap: '6px' } });
      for (let i = 0; i < 7; i++) {
        const dk = D.key(D.add(mon, i));
        const done = pact.isComplete(sync.cachedDay(user, dk));
        const isToday = dk === today;
        dots.appendChild(el('div', { style: {
          flex: '1', height: '30px', borderRadius: '8px',
          background: done ? 'var(--good)' : 'var(--glass-fill-2)',
          border: isToday ? '2px solid var(--flame)' : '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }, html: done ? '<span style="color:#fff;display:inline-flex">' + icon('check', 13) + '</span>' : '' }));
      }
      return el('div', { class: 'mb-2' }, [
        el('div', { class: 'between mb-1' }, [
          el('div', { class: 'semi t-sm', text: NAME[user] + (user === me ? ' (you)' : '') }),
          el('div', { class: 'muted t-xs', text: weekCount(user) + '/7 days' })
        ]),
        dots
      ]);
    }
    const head = el('div', { class: 'row', style: { gap: '6px', marginBottom: '8px', paddingLeft: '2px' } });
    labels.forEach(l => head.appendChild(el('div', { class: 'muted t-xs', style: { flex: '1', textAlign: 'center' }, text: l })));
    return el('div', { class: 'card mt-3' }, [
      el('div', { class: 'label mb-3', text: 'This week' }),
      head, rowFor(me), rowFor(other)
    ]);
  }

  function render(root) {
    const me = store.currentUser() || 'me';
    const other = me === 'me' ? 'gf' : 'me';
    const today = store.today();
    const month = today.slice(0, 7);
    ensureTodayRow(me, today);

    const page = el('div', { class: 'stagger' });
    page.appendChild(pageTitle('Today', fmt.dayLabel(today)));
    page.appendChild(moneyHero(me, other, month, today));

    const row = sync.cachedDay(me, today) || {};
    const walkTarget = pact.walkTarget(row);
    const walkDone = (row.stepCount || 0) >= walkTarget;
    page.appendChild(reqTile({
      icon: 'walk', title: 'Walk ' + walkTarget.toLocaleString('id-ID') + ' steps',
      sub: walkDone ? ('Done · ' + (row.stepCount || 0).toLocaleString('id-ID') + ' steps')
                    : (row.stepCount ? ((row.stepCount).toLocaleString('id-ID') + ' so far — add your watch photo') : 'Log steps + smartwatch photo'),
      done: walkDone, onClick: () => router.go('/walk')
    }));

    if (store.isPactWorkoutDay(today)) {
      if (row.swapUsed) {
        page.appendChild(reqTile({ icon: 'walk', title: 'Recovery walk', sub: 'Swapped the workout for a 14k walk today', done: walkDone, onClick: () => router.go('/walk') }));
      } else {
        page.appendChild(reqTile({
          icon: 'dumbbell', title: 'Workout', sub: row.workoutDone ? 'Done · logged with photo' : 'Log your session + a photo',
          done: !!row.workoutDone, onClick: () => router.go('/workout')
        }));
      }
    }

    page.appendChild(weekStrip(me, other, today));
    page.appendChild(el('button', { class: 'btn block ghost mt-3', html: icon('trophy', 19) + '<span>Weekly recap &amp; settle</span>',
      onClick: () => router.go('/recap') }));
    root.appendChild(page);
  }

  App.registerView('dashboard', { render, title: 'Today' });
})(window.App);
