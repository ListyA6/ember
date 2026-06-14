/* ============================================================
   EMBER · Goals view — personal targets (no leaderboards).
   Routes: /challenges (list) and /challenges/<id> (detail).
   A "goal" is a metric + target + deadline you set for yourself.
   ============================================================ */
(function (App) {
  'use strict';

  const { el, h, fmt, segmented, openSheet, confirm, toast, haptic, icon, pageTitle, empty } = App.ui;
  const store = App.store, charts = App.charts, router = App.router, D = App.store.D;

  /* metric label → store metric key */
  const METRICS = [
    { value: 'workouts', label: 'Workouts', unit: '' },
    { value: 'distance', label: 'Distance', unit: store.ACT.run ? fmt.distUnit() : 'km' },
    { value: 'walkDays', label: 'Steps',    unit: 'days' },
    { value: 'minutes',  label: 'Minutes',  unit: 'min' },
    { value: 'volume',   label: 'Volume',   unit: 'kg' }
  ];

  function metricLabel(key) {
    const m = METRICS.find(x => x.value === key);
    return m ? m.label : key;
  }
  function daysLeft(endDate) { return D.diffDays(endDate, store.today()); }
  function daysLeftLabel(endDate) {
    const n = daysLeft(endDate);
    if (n < 0) return 'Ended';
    if (n === 0) return 'Last day';
    if (n === 1) return '1 day left';
    return n + ' days left';
  }

  /* =======================================================
     CREATE SHEET
     ======================================================= */
  function openCreateSheet() {
    haptic();
    let metric = 'workouts';

    openSheet({
      title: 'New goal',
      hint: 'Set a personal target and a deadline',
      content: () => {
        const wrap = el('div', {});

        wrap.appendChild(el('div', { class: 'field' }, [
          el('label', { text: 'Name' }),
          el('input', { class: 'input', id: 'ch-name', type: 'text', placeholder: 'June Volume Push' })
        ]));

        wrap.appendChild(el('div', { class: 'field' }, [
          el('label', { text: 'Description' }),
          el('textarea', { id: 'ch-desc', placeholder: 'What are you chasing?' })
        ]));

        wrap.appendChild(el('div', { class: 'field' }, [
          el('label', { text: 'Metric' }),
          segmented(METRICS.map(m => ({ value: m.value, label: m.label })), metric, (v) => { metric = v; })
        ]));

        wrap.appendChild(el('div', { class: 'field' }, [
          el('label', { text: 'Target' }),
          el('input', { class: 'input', id: 'ch-goal', type: 'number', inputmode: 'numeric', step: '1', placeholder: '12' })
        ]));

        const today = store.today();
        const in30 = D.key(D.add(new Date(), 30));
        wrap.appendChild(el('div', { class: 'grid-2' }, [
          el('div', { class: 'field' }, [
            el('label', { text: 'Start' }),
            el('input', { class: 'input', id: 'ch-start', type: 'date', value: today })
          ]),
          el('div', { class: 'field' }, [
            el('label', { text: 'End' }),
            el('input', { class: 'input', id: 'ch-end', type: 'date', value: in30 })
          ])
        ]));

        return wrap;
      },
      actions: [
        { label: 'Cancel', class: 'ghost' },
        { label: 'Create', class: 'flame', icon: 'plus', onClick: () => {
          const nameEl = App.ui.$('#ch-name');
          const name = (nameEl && nameEl.value || '').trim();
          if (!name) { if (nameEl) nameEl.classList.add('shake'); toast('Name your goal'); return false; }
          const desc = (App.ui.$('#ch-desc') && App.ui.$('#ch-desc').value || '').trim();
          const goal = parseFloat(App.ui.$('#ch-goal') && App.ui.$('#ch-goal').value) || 0;
          if (!goal || goal <= 0) { App.ui.$('#ch-goal').classList.add('shake'); toast('Set a target greater than zero'); return false; }
          const startDate = (App.ui.$('#ch-start') && App.ui.$('#ch-start').value) || store.today();
          const endDate = (App.ui.$('#ch-end') && App.ui.$('#ch-end').value) || D.key(D.add(new Date(), 30));
          if (endDate < startDate) { App.ui.$('#ch-end').classList.add('shake'); toast('End must be after start'); return false; }

          const m = METRICS.find(x => x.value === metric) || METRICS[0];
          const id = store.createChallenge({ name, desc, metric, goal, unit: m.unit, startDate, endDate });
          toast('Goal created', { type: 'good', icon: 'check' });
          haptic([10, 30, 10]);
          router.go('/challenges/' + id);
        } }
      ]
    });
  }

  /* =======================================================
     GOAL CARD (active)
     ======================================================= */
  function goalCard(c) {
    const prog = store.challengeProgress(c.id);

    const card = el('div', { class: 'card', style: { cursor: 'pointer' } });
    card.addEventListener('click', () => { haptic(8); router.go('/challenges/' + c.id); });

    const ringEl = charts.ring(prog.pct, { size: 60, stroke: 8, centerBig: prog.pct + '%' });

    card.appendChild(el('div', { class: 'row', style: { alignItems: 'flex-start', gap: 'var(--s-3)' } }, [
      el('div', { class: 'medal sm', html: icon(c.icon || 'target', 22) }),
      el('div', { class: 'grow', style: { minWidth: '0' } }, [
        el('div', { class: 'semi truncate', text: c.name }),
        el('div', { class: 'muted t-sm truncate', text: metricLabel(c.metric) + ' goal' })
      ]),
      ringEl
    ]));

    const valueStr = fmt.num(prog.value) + ' / ' + fmt.num(c.goal) + (c.unit ? ' ' + c.unit : '');
    const dl = daysLeft(c.endDate);
    card.appendChild(el('div', { class: 'between mt-3' }, [
      el('span', { class: 'tnum semi t-sm', text: valueStr }),
      el('span', { class: 't-xs semi ' + (dl <= 3 ? 'flame' : 'muted'), text: daysLeftLabel(c.endDate) })
    ]));
    card.appendChild(el('div', { class: 'bar mt-2' + (prog.done ? ' good' : '') }, [
      el('i', { style: { width: Math.min(100, prog.pct) + '%' } })
    ]));

    if (prog.done) {
      card.appendChild(el('div', { class: 'pill good mt-3', html: icon('checkCircle', 13) + '<span>Target reached</span>' }));
    }

    return card;
  }

  /* small row for a finished goal */
  function pastRow(c) {
    const prog = store.challengeProgress(c.id);
    const row = el('div', { class: 'item', style: { cursor: 'pointer' } }, [
      el('div', { class: 'medal sm' + (prog.done ? '' : ' locked'), style: { width: '34px', height: '34px' }, html: icon(prog.done ? 'crown' : c.icon || 'target', 18) }),
      el('div', { class: 'body' }, [
        el('div', { class: 't truncate', text: c.name }),
        el('div', { class: 's tnum', text: fmt.num(prog.value) + ' / ' + fmt.num(c.goal) + (c.unit ? ' ' + c.unit : '') })
      ]),
      el('div', { class: 'tail' }, [
        el('span', { class: 'semi t-xs ' + (prog.done ? 'good' : 'muted'), text: prog.done ? 'Smashed' : 'Missed' })
      ])
    ]);
    row.addEventListener('click', () => { haptic(8); router.go('/challenges/' + c.id); });
    return row;
  }

  /* =======================================================
     LIST VIEW
     ======================================================= */
  function renderList(root) {
    const page = el('div', { class: 'stagger' });

    page.appendChild(el('div', { class: 'between' }, [
      pageTitle('Goals', 'Your personal targets'),
      (() => {
        const b = el('button', { class: 'iconbtn', 'aria-label': 'New goal', html: icon('plus', 20) });
        b.addEventListener('click', openCreateSheet);
        return b;
      })()
    ]));

    const today = store.today();
    const active = store.activeChallenges();

    page.appendChild(el('div', { class: 'label mt-2 mb-3', text: 'Active' }));
    if (active.length) {
      active.slice()
        .sort((a, b) => store.challengeProgress(b.id).pct - store.challengeProgress(a.id).pct)
        .forEach(c => page.appendChild(goalCard(c)));
    } else {
      const e = el('div', { class: 'card' });
      e.appendChild(empty('trophy', 'No active goals', 'Set a target and a deadline to chase'));
      const cta = el('button', { class: 'btn block mt-3', html: icon('plus', 18) + '<span>New goal</span>' });
      cta.addEventListener('click', openCreateSheet);
      e.appendChild(cta);
      page.appendChild(e);
    }

    // ---- Completed / past ----
    const past = store.allChallenges().filter(c => c.endDate < today)
      .sort((a, b) => (b.endDate < a.endDate ? -1 : 1));
    if (past.length) {
      page.appendChild(el('div', { class: 'label mt-5 mb-3', text: 'Finished' }));
      const card = el('div', { class: 'card flat' });
      past.forEach(c => card.appendChild(pastRow(c)));
      page.appendChild(card);
    }

    root.appendChild(page);
  }

  /* =======================================================
     DETAIL VIEW
     ======================================================= */
  function renderDetail(root, id) {
    const c = store.challenge(id);
    const page = el('div', { class: 'stagger' });

    const back = el('button', { class: 'iconbtn plain', 'aria-label': 'Back', html: icon('chevL', 22) });
    back.addEventListener('click', () => { haptic(8); router.go('/challenges'); });
    page.appendChild(el('div', { class: 'row mt-2 mb-3' }, [ back ]));

    if (!c) {
      page.appendChild(empty('trophy', 'Goal not found', 'It may have been deleted'));
      const b = el('button', { class: 'btn block mt-3', html: icon('chevL', 18) + '<span>Back to goals</span>' });
      b.addEventListener('click', () => router.go('/challenges'));
      page.appendChild(b);
      root.appendChild(page);
      return;
    }

    const prog = store.challengeProgress(c.id);
    const ended = c.endDate < store.today();

    // ---- ended banner ----
    if (ended) {
      page.appendChild(el('div', { class: 'hero', style: { marginBottom: 'var(--s-3)' } }, [
        el('div', { class: 'row gap-3' }, [
          el('div', { class: 'medal', html: icon(prog.done ? 'crown' : 'target', 28) }),
          el('div', {}, [
            el('div', { class: 'label', text: 'Goal ended' }),
            el('div', { class: 't-lg bold', text: prog.done ? 'Target smashed' : 'Came up short' }),
            el('div', { class: 'tnum t-sm', style: { opacity: '0.9' },
              text: fmt.num(prog.value) + (c.unit ? ' ' + c.unit : '') + ' of ' + fmt.num(c.goal) })
          ])
        ])
      ]));
    }

    // ---- hero ring ----
    const ringCard = el('div', { class: 'card center col', style: { gap: 'var(--s-2)' } });
    ringCard.appendChild(el('div', { class: 'medal', html: icon(c.icon || 'target', 26) }));
    ringCard.appendChild(el('h1', { style: { fontSize: 'var(--t-2xl)', textAlign: 'center' }, text: c.name }));
    if (c.desc) ringCard.appendChild(el('div', { class: 'muted t-sm', style: { textAlign: 'center' }, text: c.desc }));
    ringCard.appendChild(el('div', { class: 'mt-3' },
      charts.ring(prog.pct, { size: 150, centerBig: fmt.num(prog.value), centerSub: 'of ' + fmt.num(c.goal) })
    ));
    ringCard.appendChild(el('div', { class: 'row wrap center gap-2 mt-3' }, [
      el('span', { class: 'pill flame', html: icon('target', 14) + '<span>' + metricLabel(c.metric) + (c.unit ? ' · ' + c.unit : '') + '</span>' }),
      el('span', { class: 'pill', html: icon('calendar', 14) + '<span>' + D.fmt(c.startDate, { day: 'numeric', month: 'short' }) + ' – ' + D.fmt(c.endDate, { day: 'numeric', month: 'short' }) + '</span>' }),
      el('span', { class: 'pill' + (ended ? '' : ' good'), html: icon('clock', 14) + '<span>' + daysLeftLabel(c.endDate) + '</span>' })
    ]));
    page.appendChild(ringCard);

    // ---- progress detail ----
    const detail = el('div', { class: 'card' });
    detail.appendChild(el('div', { class: 'between mb-3' }, [
      el('div', { class: 'label', text: 'Progress' }),
      el('div', { class: 'pill' + (prog.done ? ' good' : ' flame'), html: '<span class="tnum">' + prog.pct + '%</span>' })
    ]));
    detail.appendChild(el('div', { class: 'bar' + (prog.done ? ' good' : '') }, [
      el('i', { style: { width: Math.min(100, prog.pct) + '%' } })
    ]));
    detail.appendChild(el('div', { class: 'between mt-2' }, [
      el('span', { class: 'tnum semi t-sm', text: fmt.num(prog.value) + (c.unit ? ' ' + c.unit : '') }),
      el('span', { class: 'muted tnum t-sm', text: 'target ' + fmt.num(c.goal) + (c.unit ? ' ' + c.unit : '') })
    ]));
    page.appendChild(detail);

    // ---- delete ----
    const del = el('button', { class: 'btn ghost block mt-3', style: { color: 'var(--bad)' }, html: icon('trash', 18) + '<span>Delete goal</span>' });
    del.addEventListener('click', async () => {
      haptic();
      const ok = await confirm({ title: 'Delete goal?', message: 'This removes "' + c.name + '" permanently.', confirmText: 'Delete', danger: true });
      if (ok) { store.deleteChallenge(c.id); toast('Goal deleted'); router.go('/challenges'); }
    });
    page.appendChild(del);

    root.appendChild(page);
  }

  /* =======================================================
     ROUTER ENTRY
     ======================================================= */
  function render(root, params) {
    if (params && params.id) renderDetail(root, params.id);
    else renderList(root);
  }

  App.registerView('challenges', { render, title: 'Goals' });
})(window.App);
