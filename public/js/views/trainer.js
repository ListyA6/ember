/* ============================================================
   EMBER · Trainer — the coach's side of the trainer↔client loop.
   Routes: /trainer (roster), /clientdetail/<id> (full drill-down).
   Composes existing CSS + charts only; no emoji, no new charting.
   Cards never add backdrop-filter — the .card class is solid by
   design (animated blurred bg already lives behind everything).
   ============================================================ */
(function (App) {
  'use strict';
  const {
    el, h, fmt, avatar, openSheet, toast, haptic, icon,
    countUp, empty, pageTitle
  } = App.ui;
  const store = App.store, charts = App.charts, router = App.router;
  const D = store.D;

  const ATTENTION_DAYS = 3;            // no activity within N days → needs attention

  /* ---------------- shared data helpers (graceful fallbacks) ---------------- */

  // The roster of coached clients. Prefer store.clients(); fall back to
  // "everyone who isn't me" so the view still works before the orchestrator
  // lands the dedicated helper.
  function clients() {
    if (typeof store.clients === 'function') {
      try { const c = store.clients(); if (Array.isArray(c)) return c; } catch (e) {}
    }
    const meId = store.meId();
    return store.allProfiles().filter(p => p && p.id !== meId);
  }

  // Last (most recent) activity for a profile. activitiesFor is ascending.
  function lastActivity(pid) {
    const acts = store.activitiesFor(pid);
    return acts.length ? acts[acts.length - 1] : null;
  }

  // Whole-day age, in days, of a profile's most recent activity (null = none ever).
  function daysSinceActive(pid) {
    const last = lastActivity(pid);
    if (!last) return null;
    const ts = last.startedAt || (last.date ? D.parse(last.date).getTime() : 0);
    if (!ts) return null;
    return Math.floor((Date.now() - ts) / 86400000);
  }

  // A client "needs attention" if their last activity is older than 3 days
  // (or they have never logged anything at all).
  function needsAttention(pid) {
    const d = daysSinceActive(pid);
    return d === null || d > ATTENTION_DAYS;
  }

  // Count of activities logged in the current calendar week.
  function thisWeekCount(pid) {
    const weekId = D.weekId(store.today());
    return store.activitiesFor(pid).filter(a => D.weekId(a.date) === weekId).length;
  }

  // Resolve the assigned program key for a client, with fallbacks.
  function programKeyFor(pid) {
    if (typeof store.assignedProgramKey === 'function') {
      try { const k = store.assignedProgramKey(pid); if (k && store.PROGRAMS[k]) return k; } catch (e) {}
    }
    const p = store.profile(pid);
    if (p && p.program && store.PROGRAMS[p.program]) return p.program;
    return null;
  }

  // A short label for the client's current focus (phase → programLabel → program name).
  function focusLabel(p) {
    if (!p) return '';
    if (p.phase) return p.phase;
    if (p.programLabel) return p.programLabel;
    const key = programKeyFor(p.id);
    if (key && store.PROGRAMS[key]) return store.PROGRAMS[key].name;
    if (p.goal) return p.goal;
    return 'No program set';
  }

  /* ============================================================
     VIEW 1 · TRAINER — the roster / home screen for a coach
     ============================================================ */

  // Compact summary strip: total / trained this week / need attention.
  function summaryStrip(list) {
    const total = list.length;
    const trained = list.filter(p => thisWeekCount(p.id) > 0).length;
    const flagged = list.filter(p => needsAttention(p.id)).length;

    function cell(label, value, opts) {
      opts = opts || {};
      const v = el('div', {
        class: 'tnum bold',
        style: { fontSize: '26px', letterSpacing: '-0.03em', lineHeight: '1.05', color: opts.color || 'var(--ink)' }
      });
      const head = el('div', { class: 'row center', style: { gap: '5px', justifyContent: 'center' } }, [
        opts.icon ? el('span', { class: 'row center', style: { color: opts.color || 'var(--flame)' }, html: icon(opts.icon, 17) }) : null,
        v
      ]);
      requestAnimationFrame(() => countUp(v, value, { dur: 820 }));
      return el('div', { class: 'col center', style: { gap: '4px', textAlign: 'center' } }, [
        head,
        el('div', { class: 'label', text: label })
      ]);
    }

    return el('div', { class: 'card flat grid-3', style: { alignItems: 'center' } }, [
      cell('Clients', total, { icon: 'users' }),
      cell('Trained this week', trained, { icon: 'flame' }),
      cell('Need attention', flagged, { icon: 'bell', color: flagged ? 'var(--coral)' : 'var(--ink)' })
    ]);
  }

  // A mini 7-day activity bar (Mon→Sun) built from store.weekBars(pid).
  // Solid CSS columns (styled in trainer.css) — no charting dep, no blur.
  function miniWeek(pid) {
    const bars = store.weekBars(pid);
    const max = Math.max(1, Math.max.apply(null, bars.map(b => b.count)));
    const wrap = el('div', { class: 'mini-week' });
    bars.forEach((b, i) => {
      const hpct = b.count ? Math.max(22, Math.round(b.count / max * 100)) : 0;
      const track = el('div', { class: 'col' + (b.isToday ? ' today' : '') });
      if (b.count) {
        track.appendChild(el('i', { style: { height: hpct + '%', minHeight: '4px', animationDelay: (i * 0.05) + 's' } }));
      }
      wrap.appendChild(track);
    });
    return wrap;
  }

  // One tappable client card.
  function clientCard(p) {
    const flagged = needsAttention(p.id);
    const last = lastActivity(p.id);
    const week = thisWeekCount(p.id);

    const card = el('button', {
      class: 'card client-card',
      style: { display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer' },
      'aria-label': 'Open ' + (p.name || 'client')
    });
    card.addEventListener('click', () => { haptic(8); router.go('/clientdetail/' + p.id); });

    /* --- identity row --- */
    const statusDot = el('span', { class: 'status-dot ' + (flagged ? 'alert' : 'ok') });

    const idRow = el('div', { class: 'row gap-3', style: { alignItems: 'center' } }, [
      avatar(p, 'lg'),
      el('div', { class: 'col grow', style: { minWidth: '0', gap: '3px' } }, [
        el('div', { class: 'row gap-2', style: { minWidth: '0' } }, [
          el('div', { class: 'bold truncate', style: { fontSize: '17px', letterSpacing: '-0.02em' }, text: p.name || 'Athlete' }),
          statusDot
        ]),
        el('div', { class: 'muted semi t-sm truncate', text: focusLabel(p) }),
        el('div', { class: 'row gap-2', style: { minWidth: '0', color: 'var(--muted)' } }, [
          h(icon('clock', 12)),
          el('span', { class: 't-sm', text: last ? fmt.relative(last.startedAt) : 'No activity yet' })
        ])
      ]),
      h(icon('chevR', 18))
    ]);
    card.appendChild(idRow);

    /* --- footer: status / week count + mini week bars --- */
    const footer = el('div', { class: 'between mt-3', style: { paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' } }, [
      el('div', { class: 'col', style: { gap: '4px' } }, [
        flagged
          ? el('span', { class: 'pill alert', html: icon('bell', 12) + '<span>Needs attention</span>' })
          : el('span', { class: 'pill good', html: icon('check', 12) + '<span>On track</span>' }),
        el('div', { class: 'muted t-xs', style: { paddingLeft: '2px' } }, [
          el('span', { class: 'tnum semi', style: { color: 'var(--ink-soft)' }, text: String(week) }),
          el('span', { text: ' logged this week' })
        ])
      ]),
      el('div', { class: 'col', style: { gap: '4px', width: '108px', flexShrink: '0' } }, [
        el('div', { class: 'label', style: { textAlign: 'right' }, text: 'Last 7 days' }),
        miniWeek(p.id)
      ])
    ]);
    card.appendChild(footer);

    return card;
  }

  function renderRoster(root) {
    const page = el('div', { class: 'stagger' });
    const list = clients();

    const activeCount = list.filter(p => !needsAttention(p.id)).length;
    page.appendChild(pageTitle('Clients', list.length
      ? (activeCount + ' active · ' + list.length + ' total')
      : 'Your coaching roster'));

    if (!list.length) {
      page.appendChild(el('div', { class: 'card' },
        empty('user', 'No clients yet', 'Clients you coach will show up here with their training at a glance.')));
      root.appendChild(page);
      return;
    }

    page.appendChild(summaryStrip(list));

    // Sort: needs-attention first, then most-recently active.
    const sorted = list.slice().sort((a, b) => {
      const fa = needsAttention(a.id) ? 0 : 1;
      const fb = needsAttention(b.id) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      const la = lastActivity(a.id), lb = lastActivity(b.id);
      return (lb ? lb.startedAt : 0) - (la ? la.startedAt : 0);
    });

    const listWrap = el('div', { class: 'col gap-3 mt-4' });
    sorted.forEach(p => listWrap.appendChild(clientCard(p)));
    page.appendChild(listWrap);

    root.appendChild(page);
  }

  /* ============================================================
     VIEW 2 · CLIENTDETAIL — full drill-down on one client
     ============================================================ */

  function backBtn() {
    const b = el('button', { class: 'iconbtn', 'aria-label': 'Back to clients', html: icon('chevL', 20) });
    b.addEventListener('click', () => { haptic(8); router.go('/trainer'); });
    return b;
  }

  function cardHead(title, sub, trailing) {
    return el('div', { class: 'between mb-3' }, [
      el('div', { class: 'col' }, [
        el('div', { class: 'label', text: title }),
        sub ? el('div', { class: 't-sm muted', style: { marginTop: '2px' }, text: sub }) : null
      ]),
      trailing || null
    ]);
  }

  /* ---- header: back + identity ---- */
  function clientHeader(p) {
    const flagged = needsAttention(p.id);
    const card = el('div', { class: 'card' }, [
      el('div', { class: 'row gap-3', style: { alignItems: 'center' } }, [
        avatar(p, 'lg'),
        el('div', { class: 'col grow', style: { minWidth: '0', gap: '3px' } }, [
          el('h1', { class: 't-xl truncate', text: p.name || 'Athlete' }),
          el('div', { class: 'muted semi truncate', text: p.handle || focusLabel(p) }),
          el('div', { class: 'mt-1' }, [
            flagged
              ? el('span', { class: 'pill alert', html: icon('bell', 12) + '<span>Needs attention</span>' })
              : el('span', { class: 'pill good', html: icon('check', 12) + '<span>On track</span>' })
          ])
        ])
      ])
    ]);
    if (p.goal) {
      card.appendChild(el('div', { class: 'row gap-2 mt-3', style: { paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)', color: 'var(--flame-deep)' } }, [
        h(icon('target', 15)),
        el('div', { class: 'semi t-sm truncate', text: p.goal })
      ]));
    }
    return card;
  }

  /* ---- assigned program ---- */
  function programCard(p) {
    const card = el('div', { class: 'card' });
    const key = programKeyFor(p.id);
    const prog = key ? store.PROGRAMS[key] : null;

    const changeBtn = el('button', { class: 'pill', html: icon('edit', 13) + '<span>Change</span>' });
    changeBtn.addEventListener('click', (e) => { e.stopPropagation(); haptic(8); openProgramSheet(p, key); });

    card.appendChild(cardHead('Assigned program', prog ? prog.name : 'Not assigned', changeBtn));

    if (!prog || !(prog.ex && prog.ex.length)) {
      card.appendChild(empty('dumbbell', 'No program assigned', 'Pick a split to give this client a plan to follow.'));
      return card;
    }

    const list = el('div', {});
    prog.ex.forEach(ex => {
      list.appendChild(el('div', { class: 'item' }, [
        el('div', {
          class: 'center', style: {
            width: '34px', height: '34px', borderRadius: 'var(--r-xs)', flexShrink: '0',
            background: 'rgba(255,158,44,0.14)', color: 'var(--flame-deep)'
          }, html: icon('dumbbell', 17)
        }),
        el('div', { class: 'body' }, [
          el('div', { class: 't truncate', text: ex.n })
        ]),
        el('div', { class: 'tail tnum', text: ex.sets + ' × ' + ex.reps })
      ]));
    });
    card.appendChild(list);
    return card;
  }

  function openProgramSheet(p, currentKey) {
    // Offer every concrete split (skip the empty "rest" placeholder).
    const keys = Object.keys(store.PROGRAMS).filter(k => (store.PROGRAMS[k].ex || []).length);
    openSheet({
      title: 'Assign program',
      hint: 'Pick the split ' + (p.name || 'this client') + ' should run.',
      content: (api) => {
        const wrap = el('div', { class: 'col gap-2' });
        keys.forEach(k => {
          const prog = store.PROGRAMS[k];
          const isCurrent = k === currentKey;
          const row = el('button', {
            class: 'card flat prog-pick' + (isCurrent ? ' selected' : ''),
            style: {
              display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center', gap: 'var(--s-3)',
              cursor: 'pointer'
            }
          }, [
            el('div', {
              class: 'center', style: {
                width: '38px', height: '38px', borderRadius: 'var(--r-xs)', flexShrink: '0',
                background: 'rgba(255,158,44,0.14)', color: 'var(--flame-deep)'
              }, html: icon('dumbbell', 18)
            }),
            el('div', { class: 'col grow', style: { minWidth: '0', gap: '1px' } }, [
              el('div', { class: 'semi truncate', text: prog.name }),
              el('div', { class: 'muted t-xs', text: (prog.ex || []).length + ' exercises' })
            ]),
            isCurrent ? el('span', { class: 'flame row center', html: icon('checkCircle', 18) }) : null
          ]);
          row.addEventListener('click', () => {
            haptic([10, 30, 10]);
            if (typeof store.setAssignedProgram === 'function') {
              store.setAssignedProgram(p.id, k);
            } else {
              store.updateProfile(p.id, { program: k, programLabel: prog.name });
            }
            toast('Program assigned', { type: 'good', icon: 'check' });
            api.close();
          });
          wrap.appendChild(row);
        });
        return wrap;
      }
    });
  }

  /* ---- trainer note ---- */
  function noteCard(p) {
    const card = el('div', { class: 'card' });
    const note = (p.trainerNote || '').trim();

    const editBtn = el('button', { class: 'pill', html: icon('edit', 13) + '<span>' + (note ? 'Edit' : 'Add') + '</span>' });
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); haptic(8); openNoteSheet(p); });

    card.appendChild(cardHead('Trainer note', null, editBtn));

    if (note) {
      card.appendChild(el('div', { style: { color: 'var(--ink-soft)', lineHeight: '1.55', whiteSpace: 'pre-wrap' }, text: note }));
    } else {
      card.appendChild(el('div', { class: 'dim', text: 'No note yet — jot down cues, injuries or what to push next session.' }));
    }
    return card;
  }

  function openNoteSheet(p) {
    openSheet({
      title: 'Trainer note',
      hint: 'Private coaching notes for ' + (p.name || 'this client') + '.',
      content: el('div', {}, [
        el('div', { class: 'field' }, [
          el('label', { text: 'Note' }),
          el('textarea', { class: 'input', id: 'trainer-note', placeholder: 'e.g. Cut, week 3. Watch left knee on squats — keep RPE under 8.', style: { minHeight: '120px' } }, p.trainerNote || '')
        ])
      ]),
      actions: [
        { label: 'Cancel', class: 'ghost' },
        { label: 'Save', class: 'flame', icon: 'check', onClick: () => {
          const elx = App.ui.$('#trainer-note');
          const text = elx ? elx.value : '';
          if (typeof store.setTrainerNote === 'function') {
            store.setTrainerNote(p.id, text);
          } else {
            store.updateProfile(p.id, { trainerNote: text });
          }
          haptic([10, 30, 10]);
          toast('Note saved', { type: 'good', icon: 'check' });
        } }
      ]
    });
  }

  /* ---- snapshot stats row ---- */
  function snapshotCard(p) {
    const streak = store.moveStreak(p.id);
    const sessions = store.totalSessions(p.id);
    const vol = store.totalVolume(p.id);
    const dist = store.totalDistance(p.id);

    function tile(label, valueText, animTo, opts) {
      opts = opts || {};
      const v = el('div', { class: 'v tnum', text: animTo != null ? '0' : valueText });
      const tileEl = el('div', { class: 'tile card nested' }, [
        el('div', { class: 'k row gap-1' }, [
          opts.icon ? el('span', { class: 'flame', style: { display: 'inline-flex' }, html: icon(opts.icon, 13) }) : null,
          el('span', { text: label })
        ]),
        v
      ]);
      if (animTo != null) requestAnimationFrame(() => countUp(v, animTo, { suffix: opts.suffix || '', dur: 820 }));
      return tileEl;
    }

    return el('div', { class: 'grid-2' }, [
      tile('Move streak', null, streak, { icon: 'flame', suffix: 'd' }),
      tile('Workouts', null, sessions, { icon: 'dumbbell' }),
      tile('Volume', fmt.volume(vol), null, { icon: 'bolt' }),
      tile('Distance', fmt.distance(dist), null, { icon: 'route' })
    ]);
  }

  /* ---- weight trend ---- */
  function weightCard(p) {
    const w = store.weightSeries(p.id);
    const card = el('div', { class: 'card' });
    if (w.length >= 2) {
      const first = w[0], last = w[w.length - 1];
      const delta = +(last.kg - first.kg).toFixed(1);
      const down = delta < 0;
      const flat = Math.abs(delta) < 0.05;
      card.appendChild(el('div', { class: 'between mb-3' }, [
        el('div', { class: 'col' }, [
          el('div', { class: 'label', text: 'Weight trend' }),
          el('div', { class: 't-sm muted', style: { marginTop: '2px' }, text: D.fmt(first.date, { day: 'numeric', month: 'short' }) + ' → now' })
        ]),
        el('div', { class: 'tile', style: { padding: '0', textAlign: 'right' } }, [
          el('div', { class: 'v tnum', style: { fontSize: '22px' }, text: fmt.weight(last.kg) }),
          el('div', {
            class: 'delta tnum ' + (flat ? '' : (down ? 'up' : 'down')),
            html: (flat ? '' : icon(down ? 'arrowD' : 'arrowU', 13) + ' ') + (delta > 0 ? '+' : '') + fmt.weight(delta)
          })
        ])
      ]));
      card.appendChild(charts.line(
        w.map(pt => ({ value: pt.kg, label: D.fmt(pt.date, { day: 'numeric', month: 'short' }) })),
        { area: true }
      ));
    } else {
      card.appendChild(cardHead('Weight trend'));
      card.appendChild(empty('scale', 'No weight logged', 'Needs at least two weigh-ins to chart a trend.'));
    }
    return card;
  }

  /* ---- weekly volume ---- */
  function volumeCard(p) {
    const vol = store.volumeSeries(p.id, 8);
    const hasData = vol.some(b => b.value > 0);
    const card = el('div', { class: 'card' }, cardHead('Weekly volume', 'Lift tonnage, last 8 weeks'));
    if (hasData) {
      card.appendChild(charts.bars(
        vol.map((b, i, arr) => ({ label: b.label, value: b.value, highlight: i === arr.length - 1 })),
        { valueFmt: v => fmt.volume(v) }
      ));
    } else {
      card.appendChild(empty('dumbbell', 'No volume yet', 'No lifts logged in this window.'));
    }
    return card;
  }

  /* ---- consistency heatmap ---- */
  const HEAT_STEPS = ['rgba(28,22,15,0.06)', 'rgba(255,106,19,0.28)', 'rgba(255,106,19,0.5)', 'rgba(255,106,19,0.72)', 'var(--flame)'];
  function heatmapCard(p) {
    const card = el('div', { class: 'card' }, cardHead('Consistency', 'Last 17 weeks'));
    card.appendChild(charts.heatmap(store.heatmap(p.id, 119)));
    card.appendChild(el('div', { class: 'row between mt-3', style: { gap: '8px' } }, [
      el('span', { class: 't-xs dim', text: 'Less' }),
      el('div', { class: 'row', style: { gap: '4px' } },
        HEAT_STEPS.map(c => el('i', { style: { width: '12px', height: '12px', borderRadius: '3px', display: 'block', background: c } }))
      ),
      el('span', { class: 't-xs dim', text: 'More' })
    ]));
    return card;
  }

  /* ---- personal records ---- */
  function recordsCard(p) {
    const prs = store.personalRecords(p.id).slice(0, 6);
    const card = el('div', { class: 'card' }, cardHead('Personal records', 'Heaviest set + estimated 1RM'));
    if (!prs.length) {
      card.appendChild(empty('trophy', 'No records yet', 'PRs appear once this client logs lifts.'));
      return card;
    }
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
            el('span', { class: 'dim', text: '  ·  ' + D.fmt(r.date, { day: 'numeric', month: 'short' }) })
          ])
        ]),
        el('div', { class: 'tail' }, [
          el('div', { class: 'flame semi tnum', text: fmt.weight(r.e1rm) }),
          el('div', { class: 't-xs dim upper', text: 'est 1RM' })
        ])
      ]));
    });
    card.appendChild(list);
    return card;
  }

  /* ---- recent activity feed (with progress photos) ----
     Mirrors feed.js's activity-card layout, but read-only for the coach:
     no share/edit, and the photo is given prominence (it's the progress
     pic the trainer reviews). */
  function liftVolume(sets) { return (sets || []).reduce((v, s) => v + (s.kg || 0) * (s.reps || 0), 0); }

  function feedStat(a) {
    if (a.type === 'lift') return { k: 'Volume', v: fmt.volume(liftVolume(a.sets)) };
    if (a.distanceKm) return { k: 'Distance', v: fmt.distance(a.distanceKm) };
    return { k: 'Time', v: fmt.duration(a.durationSec) };
  }

  function clientActivityCard(a) {
    const meta = store.ACT[a.type] || store.ACT.cardio;
    const card = el('div', { class: 'card flat' });

    // header: when + type chip
    card.appendChild(el('div', { class: 'row between' }, [
      el('div', { class: 'row gap-2', style: { minWidth: '0', color: 'var(--muted)' } }, [
        h(icon('clock', 13)),
        el('span', { class: 't-sm semi truncate', text: fmt.relative(a.startedAt) })
      ]),
      el('span', { class: 'chip', html: icon(meta.icon, 13) + '<span>' + meta.label + '</span>' })
    ]));

    // title + day label
    if (a.title) {
      card.appendChild(el('div', { class: 'bold mt-2', style: { fontSize: '16px', letterSpacing: '-0.02em' }, text: a.title }));
    }
    card.appendChild(el('div', { class: 'muted t-xs mt-1', text: fmt.dayLabel(a.date) }));

    // PR pill
    if (a.prs && a.prs.length) {
      card.appendChild(el('div', { class: 'mt-2' }, [
        el('span', { class: 'pill flame', html: icon('starFill', 13) + '<span>' + a.prs.length + ' PR' + (a.prs.length > 1 ? 's' : '') + '</span>' })
      ]));
    }

    // stat strip (volume/distance/time depending on type)
    const tiles = [];
    if (a.type === 'lift') {
      tiles.push({ k: 'Volume', v: fmt.volume(liftVolume(a.sets)) });
      tiles.push({ k: 'Sets', v: String((a.sets || []).length) });
      tiles.push({ k: 'Time', v: fmt.duration(a.durationSec) });
    } else if (a.distanceKm) {
      tiles.push({ k: 'Distance', v: fmt.distance(a.distanceKm) });
      tiles.push({ k: 'Time', v: fmt.duration(a.durationSec) });
    } else {
      tiles.push({ k: 'Time', v: fmt.duration(a.durationSec) });
    }
    card.appendChild(el('div', { class: 'row mt-3', style: { gap: 'var(--s-5)' } }, tiles.map(s =>
      el('div', { class: 'col', style: { minWidth: '0' } }, [
        el('div', { class: 'tnum bold', style: { fontSize: '18px', letterSpacing: '-0.02em' }, text: s.v }),
        el('div', { class: 'label', style: { marginTop: '1px' }, text: s.k })
      ])
    )));

    // progress photo — the whole point of the review
    if (a.photo) {
      card.appendChild(el('img', {
        class: 'mt-3', src: a.photo, alt: a.title || meta.label, loading: 'lazy',
        style: { width: '100%', borderRadius: 'var(--r-sm)', objectFit: 'cover', maxHeight: '300px' }
      }));
    }

    // note
    if (a.note) {
      card.appendChild(el('div', { class: 'muted mt-3', style: { lineHeight: '1.55' }, text: a.note }));
    }
    return card;
  }

  function feedCard(p) {
    const items = store.feed({ profileId: p.id, limit: 12 });
    const wrap = el('div', {});
    wrap.appendChild(el('div', { class: 'between mt-5 mb-3' }, [
      el('h2', { class: 't-lg', text: 'Recent activity' }),
      items.length ? el('span', { class: 'pill', html: '<span class="tnum">' + items.length + '</span><span class="muted"> logged</span>' }) : null
    ]));

    if (!items.length) {
      wrap.appendChild(el('div', { class: 'card' }, empty('feed', 'No activity yet', 'Workouts, walks and progress photos will appear here for review.')));
      return wrap;
    }
    const list = el('div', { class: 'col gap-3' });
    items.forEach(a => list.appendChild(clientActivityCard(a)));
    wrap.appendChild(list);
    return wrap;
  }

  /* ---- detail entry ---- */
  function renderDetail(root, id) {
    const page = el('div', { class: 'stagger' });
    const p = store.profile(id);

    if (!p) {
      page.appendChild(el('div', { class: 'between mb-4' }, [ backBtn(), el('span') ]));
      page.appendChild(empty('user', 'Client not found', 'They may have been removed from your roster.'));
      root.appendChild(page);
      return;
    }

    page.appendChild(el('div', { class: 'between mb-3' }, [
      backBtn(),
      el('span', { class: 'pill', html: icon('users', 13) + '<span>Client</span>' })
    ]));

    page.appendChild(clientHeader(p));
    page.appendChild(programCard(p));
    page.appendChild(noteCard(p));
    page.appendChild(snapshotCard(p));
    page.appendChild(weightCard(p));
    page.appendChild(volumeCard(p));
    page.appendChild(heatmapCard(p));
    page.appendChild(recordsCard(p));
    page.appendChild(feedCard(p));

    root.appendChild(page);
  }

  /* ---------------- registration ---------------- */
  App.registerView('trainer', {
    render: function (root) { renderRoster(root); },
    title: 'Clients'
  });
  App.registerView('clientdetail', {
    render: function (root, params) { renderDetail(root, params && params.id); },
    title: 'Client'
  });

})(window.App);
