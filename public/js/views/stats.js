/* ============================================================
   EMBER · Stats — data-visualization showcase for the active profile.
   Totals → weight trend → weekly volume → consistency heatmap →
   this week → personal records. All numbers tabular (tnum).
   ============================================================ */
(function (App) {
  'use strict';

  const { el, fmt, countUp, haptic, icon, pageTitle, empty } = App.ui;
  const store = App.store, charts = App.charts;

  // heatmap level color ramp — kept in lock-step with charts.heatmap()
  const HEAT_STEPS = ['rgba(28,22,15,0.06)', 'rgba(255,106,19,0.28)', 'rgba(255,106,19,0.5)', 'rgba(255,106,19,0.72)', 'var(--flame)'];

  // a stat tile whose headline number animates up from 0
  function statTile(label, to, opts) {
    opts = opts || {};
    const v = el('div', { class: 'v tnum', text: opts.prefix ? opts.prefix : '0' });
    const tile = el('div', { class: 'tile card nested' }, [
      el('div', { class: 'k row gap-1' }, [
        opts.icon ? el('span', { class: 'flame', style: { display: 'inline-flex' }, html: icon(opts.icon, 13) }) : null,
        el('span', { text: label })
      ]),
      v
    ]);
    // animate after mount
    requestAnimationFrame(() => countUp(v, to, {
      decimals: opts.decimals || 0, prefix: opts.prefix || '', suffix: opts.suffix || '', dur: 820
    }));
    return tile;
  }

  // a static tile whose value is a preformatted string (units, etc.)
  function valueTile(label, valueText, opts) {
    opts = opts || {};
    return el('div', { class: 'tile card nested' }, [
      el('div', { class: 'k row gap-1' }, [
        opts.icon ? el('span', { class: 'flame', style: { display: 'inline-flex' }, html: icon(opts.icon, 13) }) : null,
        el('span', { text: label })
      ]),
      el('div', { class: 'v tnum', text: valueText })
    ]);
  }

  function cardHead(title, sub) {
    return el('div', { class: 'between mb-3' }, [
      el('div', { class: 'col' }, [
        el('div', { class: 'label', text: title }),
        sub ? el('div', { class: 't-sm muted', style: { marginTop: '2px' }, text: sub }) : null
      ])
    ]);
  }

  function render(root, params) {
    const page = el('div', { class: 'stagger' });
    page.appendChild(pageTitle('Stats'));

    const me = store.me();
    if (!me) {
      page.appendChild(el('div', { class: 'card' }, empty('chart', 'No profile yet', 'Set up Ember to start tracking your stats.')));
      root.appendChild(page);
      return;
    }

    /* ---------------- 1) TOTALS ---------------- */
    const totals = el('div', { class: 'grid-3' }, [
      statTile('Workouts', store.totalSessions(), { icon: 'dumbbell' }),
      valueTile('Volume', fmt.volume(store.totalVolume()), { icon: 'bolt' }),
      valueTile('Distance', fmt.distance(store.totalDistance()), { icon: 'route' }),
      valueTile('Time', fmt.duration(store.totalDuration()), { icon: 'timer' }),
      statTile('Move streak', store.moveStreak(), { icon: 'flame', suffix: 'd' }),
      statTile('PRs', store.totalPRs(), { icon: 'trend' })
    ]);
    page.appendChild(totals);

    /* ---------------- 2) WEIGHT TREND ---------------- */
    const w = store.weightSeries();
    const weightCard = el('div', { class: 'card' });
    if (w.length >= 2) {
      const first = w[0], last = w[w.length - 1];
      const delta = +(last.kg - first.kg).toFixed(1);
      const down = delta < 0;            // losing weight reads as "up" / positive in this app's framing
      const flat = Math.abs(delta) < 0.05;
      weightCard.appendChild(el('div', { class: 'between mb-3' }, [
        el('div', { class: 'col' }, [
          el('div', { class: 'label', text: 'Weight trend' }),
          el('div', { class: 't-sm muted', style: { marginTop: '2px' }, text: store.D.fmt(first.date, { day: 'numeric', month: 'short' }) + ' → now' })
        ]),
        el('div', { class: 'tile', style: { padding: '0', textAlign: 'right' } }, [
          el('div', { class: 'v tnum', style: { fontSize: '22px' }, text: fmt.weight(last.kg) }),
          el('div', {
            class: 'delta tnum ' + (flat ? '' : (down ? 'up' : 'down')),
            html: (flat ? '' : icon(down ? 'arrowD' : 'arrowU', 13) + ' ') +
              (delta > 0 ? '+' : '') + fmt.weight(delta)
          })
        ])
      ]));
      weightCard.appendChild(charts.line(
        w.map(p => ({ value: p.kg, label: store.D.fmt(p.date, { day: 'numeric', month: 'short' }) })),
        { area: true }
      ));
    } else {
      weightCard.appendChild(cardHead('Weight trend'));
      weightCard.appendChild(empty('scale', 'No weight logged yet', 'Log at least two entries to see your trend.'));
      const btn = el('button', { class: 'btn block mt-3', html: icon('scale', 18) + '<span>Log weight</span>' });
      btn.addEventListener('click', () => { haptic(); App.flows && App.flows.logWeight && App.flows.logWeight(); });
      weightCard.appendChild(btn);
    }
    page.appendChild(weightCard);

    /* ---------------- 3) WEEKLY VOLUME ---------------- */
    const vol = store.volumeSeries(null, 8);
    const volHasData = vol.some(b => b.value > 0);
    const volCard = el('div', { class: 'card' }, cardHead('Weekly volume', 'Lift tonnage, last 8 weeks'));
    if (volHasData) {
      volCard.appendChild(charts.bars(
        vol.map((b, i, arr) => ({ label: b.label, value: b.value, highlight: i === arr.length - 1 })),
        { valueFmt: v => fmt.volume(v) }
      ));
    } else {
      volCard.appendChild(empty('dumbbell', 'No volume yet', 'Finish a workout to start the chart.'));
    }
    page.appendChild(volCard);

    /* ---------------- 4) CONSISTENCY HEATMAP ---------------- */
    const heatCard = el('div', { class: 'card' }, cardHead('Consistency', 'Last 17 weeks'));
    heatCard.appendChild(charts.heatmap(store.heatmap(null, 119)));
    heatCard.appendChild(el('div', { class: 'row between mt-3', style: { gap: '8px' } }, [
      el('span', { class: 't-xs dim', text: 'Less' }),
      el('div', { class: 'row', style: { gap: '4px' } },
        HEAT_STEPS.map(c => el('i', {
          style: { width: '12px', height: '12px', borderRadius: '3px', display: 'block', background: c }
        }))
      ),
      el('span', { class: 't-xs dim', text: 'More' })
    ]));
    page.appendChild(heatCard);

    /* ---------------- 5) THIS WEEK ---------------- */
    const week = store.weekBars();
    const weekCard = el('div', { class: 'card' }, cardHead('This week', 'Activities logged per day'));
    weekCard.appendChild(charts.bars(
      week.map(d => ({ label: d.day, value: d.count, highlight: d.isToday })),
      { showValues: true }
    ));
    page.appendChild(weekCard);

    /* ---------------- 6) PERSONAL RECORDS ---------------- */
    const prs = store.personalRecords().slice(0, 8);
    const prCard = el('div', { class: 'card' }, cardHead('Personal records', 'Heaviest set + estimated 1RM'));
    if (!prs.length) {
      prCard.appendChild(empty('trophy', 'No records yet', 'Log a workout to set your first PR.'));
    } else {
      const list = el('div', {});
      prs.forEach(r => {
        list.appendChild(el('div', { class: 'item' }, [
          el('div', {
            class: 'center', style: {
              width: '38px', height: '38px', borderRadius: 'var(--r-xs)', flexShrink: '0',
              background: 'rgba(255,158,44,0.14)', color: 'var(--flame-deep)'
            }, html: icon('starFill', 18)
          }),
          el('div', { class: 'body' }, [
            el('div', { class: 't truncate', text: r.ex }),
            el('div', { class: 's tnum' }, [
              el('span', { text: fmt.weight(r.weight) + ' × ' + r.reps }),
              el('span', { class: 'dim', text: '  ·  ' + store.D.fmt(r.date, { day: 'numeric', month: 'short' }) })
            ])
          ]),
          el('div', { class: 'tail' }, [
            el('div', { class: 'flame semi tnum', text: fmt.weight(r.e1rm) }),
            el('div', { class: 't-xs dim upper', text: 'est 1RM' })
          ])
        ]));
      });
      prCard.appendChild(list);
    }
    page.appendChild(prCard);

    root.appendChild(page);
  }

  App.registerView('stats', { render, title: 'Stats' });
})(window.App);
