/* ============================================================
   EMBER · Profile — your athlete page (and friends').
   Routes: /profile (me), /profile/<id> (a friend).
   Header + stat strip + goal progress (mine) + badges + recent
   + share/export (mine). Composes existing CSS only; no emoji.
   ============================================================ */
(function (App) {
  'use strict';
  const {
    el, h, fmt, avatar, openSheet, toast, haptic, icon,
    countUp, empty, resizeImage
  } = App.ui;
  const store = App.store, charts = App.charts, router = App.router;
  const share = App.share;
  const D = store.D;

  /* ---------------- small helpers ---------------- */

  // A headline number that counts up on entrance. Returns the <div> node.
  function statValue(to, opts) {
    opts = opts || {};
    const node = el('div', {
      class: 'tnum bold',
      style: { fontSize: '24px', letterSpacing: '-0.03em', lineHeight: '1.05' }
    });
    if (typeof to === 'number') countUp(node, to, opts);
    else node.textContent = (opts.prefix || '') + to + (opts.suffix || '');
    return node;
  }

  // One cell of the stat strip.
  function statCell(label, valueNode) {
    return el('div', { class: 'col center', style: { gap: '4px', textAlign: 'center' } }, [
      valueNode,
      el('div', { class: 'label', text: label })
    ]);
  }

  // A simple recent-activity row (fallback when activityCard is unavailable).
  function simpleRow(a) {
    const meta = store.ACT[a.type] || store.ACT.cardio;
    let detail;
    if (a.type === 'lift') {
      const vol = (a.sets || []).reduce((v, s) => v + (s.kg || 0) * (s.reps || 0), 0);
      detail = fmt.volume(vol) + ' · ' + fmt.duration(a.durationSec);
    } else if (a.distanceKm) {
      detail = fmt.distance(a.distanceKm) + ' · ' + fmt.duration(a.durationSec);
    } else {
      detail = fmt.duration(a.durationSec);
    }
    const row = el('a', { class: 'item', href: '#/feed/' + a.id, style: { display: 'flex', cursor: 'pointer' } }, [
      el('div', { class: 'medal sm', style: { background: 'var(--glass-fill-2)', color: meta.color, boxShadow: 'none', borderColor: 'var(--line)', filter: 'none' }, html: icon(meta.icon, 22) }),
      el('div', { class: 'body' }, [
        el('div', { class: 't truncate', text: a.title || meta.label }),
        el('div', { class: 's tnum', text: detail })
      ]),
      el('div', { class: 'tail' }, [
        el('div', { text: fmt.dayLabel(a.date) }),
        (a.prs && a.prs.length) ? el('div', { class: 'flame semi t-xs row center', style: { justifyContent: 'flex-end', gap: '3px', marginTop: '2px' }, html: icon('starFill', 12) + '<span>' + a.prs.length + ' PR' + (a.prs.length > 1 ? 's' : '') + '</span>' }) : null
      ])
    ]);
    return row;
  }

  /* ---------------- 1 · header card ---------------- */
  function headerCard(p, pid) {
    const card = el('div', { class: 'card' });

    // top action row: athlete badge + edit
    const actionRow = el('div', { class: 'between mb-3' }, [
      el('div', { class: 'pill flame', html: icon('flameLine', 13) + '<span>Athlete</span>' }),
      (() => {
        const edit = el('button', { class: 'iconbtn', 'aria-label': 'Edit profile', html: icon('edit', 18) });
        edit.addEventListener('click', () => { haptic(); openEditSheet(p, pid); });
        return edit;
      })()
    ]);
    card.appendChild(actionRow);

    // identity block
    card.appendChild(el('div', { class: 'row gap-4', style: { alignItems: 'center' } }, [
      avatar(p, 'lg'),
      el('div', { class: 'col grow', style: { minWidth: '0', gap: '2px' } }, [
        el('h1', { class: 't-xl truncate', text: p.name || 'Athlete' }),
        el('div', { class: 'muted semi truncate', text: p.handle || '' }),
        p.goal
          ? el('div', { class: 'row gap-2 mt-2', style: { color: 'var(--flame-deep, var(--flame))' } }, [
              h(icon('target', 15)),
              el('div', { class: 'semi t-sm truncate', text: p.goal })
            ])
          : el('div', { class: 'dim t-sm mt-2', text: 'No goal set' })
      ])
    ]));

    return card;
  }

  /* ---------------- edit sheet (mine only) ---------------- */
  function openEditSheet(p, pid) {
    let pendingAvatar = null;

    openSheet({
      title: 'Edit profile',
      hint: 'Update your name, handle and goal',
      content: (api) => {
        const wrap = el('div', {});

        // avatar changer
        const preview = avatar(p, 'lg');
        const fileInput = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, id: 'pf-avatar-file' });
        fileInput.addEventListener('change', async (e) => {
          const f = e.target.files && e.target.files[0];
          if (!f) return;
          try {
            const dataUrl = await resizeImage(f, 360, 0.8);
            pendingAvatar = dataUrl;
            preview.style.backgroundImage = "url('" + dataUrl + "')";
            preview.textContent = '';
          } catch (err) { toast('Could not load image', { type: 'flame' }); }
        });
        const changeBtn = el('button', { class: 'btn ghost sm', type: 'button', html: icon('camera', 16) + '<span>Change photo</span>' });
        changeBtn.addEventListener('click', () => { haptic(8); fileInput.click(); });

        wrap.appendChild(el('div', { class: 'row gap-3 mb-4', style: { alignItems: 'center' } }, [
          preview, changeBtn, fileInput
        ]));

        wrap.appendChild(el('div', { class: 'field' }, [
          el('label', { text: 'Name' }),
          el('input', { class: 'input', id: 'pf-name', type: 'text', value: p.name || '', placeholder: 'Your name' })
        ]));
        wrap.appendChild(el('div', { class: 'field' }, [
          el('label', { text: 'Handle' }),
          el('input', { class: 'input', id: 'pf-handle', type: 'text', value: p.handle || '', placeholder: '@handle' })
        ]));
        wrap.appendChild(el('div', { class: 'field' }, [
          el('label', { text: 'Goal' }),
          el('input', { class: 'input', id: 'pf-goal', type: 'text', value: p.goal || '', placeholder: 'e.g. Look good in clothes by Dec' })
        ]));
        wrap.appendChild(el('div', { class: 'field' }, [
          el('label', { text: 'Height (cm)' }),
          el('input', { class: 'input', id: 'pf-height', type: 'number', value: p.heightCm != null ? p.heightCm : '', placeholder: '175' })
        ]));
        return wrap;
      },
      actions: [
        { label: 'Cancel', class: 'ghost' },
        {
          label: 'Save', class: 'flame', icon: 'check', onClick: () => {
            const nameEl = App.ui.$('#pf-name');
            const handleEl = App.ui.$('#pf-handle');
            const goalEl = App.ui.$('#pf-goal');
            const heightEl = App.ui.$('#pf-height');
            const patch = {
              name: (nameEl && nameEl.value.trim()) || p.name || 'Athlete',
              handle: (handleEl && handleEl.value.trim()) || p.handle || '',
              goal: (goalEl && goalEl.value.trim()) || ''
            };
            let hc = heightEl ? parseFloat(heightEl.value) : NaN;
            patch.heightCm = isFinite(hc) && hc > 0 ? hc : null;
            if (pendingAvatar) patch.avatar = pendingAvatar;
            // ensure handle keeps its @ prefix
            if (patch.handle && patch.handle[0] !== '@') patch.handle = '@' + patch.handle;
            store.updateProfile(pid, patch);
            haptic([10, 30, 10]);
            toast('Profile updated', { type: 'good', icon: 'check' });
          }
        }
      ]
    });
  }

  /* ---------------- 2 · stat strip ---------------- */
  function statStrip(pid) {
    const streak = store.moveStreak(pid);
    const sessions = store.totalSessions(pid);
    const vol = store.totalVolume(pid);

    return el('div', { class: 'card flat grid-3', style: { alignItems: 'center' } }, [
      statCell('Move streak', (function () {
        const n = el('div', { class: 'row center', style: { gap: '4px' } }, [
          el('span', { class: 'flame row center', html: icon('flame', 20) }),
          statValue(streak)
        ]);
        return n;
      })()),
      statCell('Workouts', statValue(sessions)),
      statCell('Volume', statValue(fmt.volume(vol)))
    ]);
  }

  /* ---------------- 3 · goal progress (mine only) ---------------- */
  function goalCard(pid) {
    const goals = store.goals();
    if (!goals || !goals.startDate || !goals.endDate) return null;

    const start = D.parse(goals.startDate);
    const end = D.parse(goals.endDate);
    const weeksIn = Math.max(0, Math.floor((Date.now() - start) / (7 * 86400000)));
    const totalWeeks = Math.max(1, Math.floor((end - start) / (7 * 86400000)));
    const cappedWeek = Math.min(weeksIn, totalWeeks);
    const pct = Math.max(0, Math.min(100, Math.round(cappedWeek / totalWeeks * 100)));
    const endLabel = D.fmt(end, { day: 'numeric', month: 'short' });

    const card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'between mb-3' }, [
      el('div', { class: 'label', text: 'Goal progress' }),
      el('div', { class: 'pill flame', html: icon('calendar', 13) + '<span class="tnum">' + pct + '%</span>' })
    ]));

    // progress bar
    const bar = el('div', { class: 'bar' }, [ el('i', { style: { width: '0%' } }) ]);
    card.appendChild(bar);
    requestAnimationFrame(() => { bar.firstChild.style.width = pct + '%'; });
    card.appendChild(el('div', { class: 'between mt-2' }, [
      el('div', { class: 'muted t-sm tnum', text: 'Week ' + cappedWeek + ' of ' + totalWeeks },),
      el('div', { class: 'muted t-sm', text: endLabel })
    ]));

    // weight block
    const latest = store.latestWeight(pid);
    const series = store.weightSeries(pid);
    const weightRow = el('div', { class: 'between mt-4', style: { paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' } });
    if (latest) {
      weightRow.appendChild(el('div', { class: 'col', style: { gap: '2px' } }, [
        el('div', { class: 'label', text: 'Current weight' }),
        el('div', { class: 'tnum bold flame', style: { fontSize: '24px', letterSpacing: '-0.03em' }, text: fmt.weight(latest.kg) })
      ]));
    } else {
      weightRow.appendChild(el('div', { class: 'col', style: { gap: '2px' } }, [
        el('div', { class: 'label', text: 'Current weight' }),
        el('div', { class: 'dim semi', text: 'Not logged' })
      ]));
    }
    if (series.length >= 2) {
      const trendDown = series[series.length - 1].kg <= series[0].kg;
      weightRow.appendChild(charts.sparkline(series.map(w => w.kg), {
        width: 96, height: 32, color: trendDown ? 'var(--good)' : 'var(--flame)'
      }));
    }
    card.appendChild(weightRow);

    return card;
  }

  /* ---------------- 4 · badges ---------------- */
  function badgesCard(pid, isMe) {
    const earnedList = store.earnedBadges(pid);
    const earnedIds = earnedList.map(b => b.id);
    const earnedMap = {};
    earnedList.forEach(b => { earnedMap[b.id] = b.earnedAt; });
    const total = store.BADGES.length;

    const card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'between mb-3' }, [
      el('div', { class: 'label', text: 'Badges' }),
      el('div', { class: 'pill', html: '<span class="tnum semi">' + earnedIds.length + '</span><span class="muted">/ ' + total + '</span>' })
    ]));

    const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s-3)', justifyItems: 'center' } });
    store.BADGES.forEach(def => {
      const isEarned = earnedIds.indexOf(def.id) >= 0;
      const cell = el('button', { class: 'col center', style: { gap: '6px', minWidth: '0', width: '100%' }, 'aria-label': def.name });
      cell.appendChild(App.ui.medal(def, isEarned));
      cell.appendChild(el('div', { class: 't-xs semi truncate ' + (isEarned ? '' : 'dim'), style: { maxWidth: '100%', textAlign: 'center' }, text: def.name }));
      cell.addEventListener('click', () => { haptic(8); openBadgeSheet(def, isEarned, earnedMap[def.id], isMe); });
      grid.appendChild(cell);
    });
    card.appendChild(grid);

    return card;
  }

  function openBadgeSheet(def, isEarned, earnedAt, isMe) {
    const body = el('div', { class: 'col center', style: { gap: 'var(--s-3)', textAlign: 'center', paddingBottom: 'var(--s-2)' } });
    body.appendChild(App.ui.medal(def, isEarned));
    body.appendChild(el('div', { class: 'bold t-lg', text: def.name }));
    body.appendChild(el('div', { class: 'muted', text: def.desc }));
    if (isEarned && earnedAt) {
      body.appendChild(el('div', { class: 'pill good mt-2', html: icon('checkCircle', 13) + '<span>Earned ' + fmt.dayLabel(D.key(new Date(earnedAt))) + '</span>' }));
    } else if (!isEarned) {
      body.appendChild(el('div', { class: 'pill mt-2', html: icon('lock', 13) + '<span>' + (isMe ? 'Not earned yet' : 'Locked') + '</span>' }));
    }
    openSheet({ center: true, content: body });
  }

  /* ---------------- 5 · recent activity ---------------- */
  function recentCard(pid) {
    const recent = store.activitiesFor(pid).slice().reverse().slice(0, 6);
    const card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'between mb-3' }, [
      el('div', { class: 'label', text: 'Recent activity' }),
      recent.length ? el('button', {
        class: 'pill', html: '<span>See feed</span>' + icon('chevR', 14),
        on: { click: () => { haptic(8); router.go('/feed'); } }
      }) : null
    ]));

    if (!recent.length) {
      card.appendChild(empty('feed', 'No activity yet', 'Logged workouts and walks land here'));
      return card;
    }

    const hasCard = App.components && typeof App.components.activityCard === 'function';
    if (hasCard) {
      const list = el('div', { class: 'col gap-3' });
      recent.forEach(a => list.appendChild(App.components.activityCard(a, { compact: true })));
      card.appendChild(list);
    } else {
      const list = el('div', {});
      recent.forEach(a => list.appendChild(simpleRow(a)));
      card.appendChild(list);
    }
    return card;
  }

  /* ---------------- entry ---------------- */
  function render(root, params) {
    const page = el('div', { class: 'stagger' });

    const pid = store.meId();
    const p = store.profile(pid);

    if (!p) {
      page.appendChild(empty('user', 'No profile yet', 'Finish setup to see your stats'));
      root.appendChild(page);
      return;
    }

    page.appendChild(headerCard(p, pid));
    page.appendChild(statStrip(pid));

    const goal = goalCard(pid);
    if (goal) page.appendChild(goal);

    page.appendChild(badgesCard(pid, true));
    page.appendChild(recentCard(pid));

    root.appendChild(page);
  }

  App.registerView('profile', { render, title: 'Profile' });
})(window.App);
