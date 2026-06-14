/* ============================================================
   EMBER · Feed view — Strava-style social feed.
   Routes: /feed (list), /feed/<id> (detail).
   Also exposes App.components.activityCard(a, opts) — reused by
   dashboard/profile. Composes existing CSS only; no emoji.
   ============================================================ */
(function (App) {
  'use strict';
  const {
    el, h, fmt, avatar, segmented, openSheet, confirm, toast,
    haptic, icon, pageTitle, empty
  } = App.ui;
  const store = App.store, charts = App.charts, router = App.router;
  const share = App.share;

  /* ---------------- helpers ---------------- */

  // Sum lift volume (kg * reps) over a set array.
  function liftVolume(sets) {
    return (sets || []).reduce((v, s) => v + (s.kg || 0) * (s.reps || 0), 0);
  }

  // Build the primary stat strip for an activity.
  // Returns array of {k, v} tiles.
  function statStrip(a) {
    const out = [];
    if (a.type === 'lift') {
      out.push({ k: 'Volume', v: fmt.volume(liftVolume(a.sets)) });
      out.push({ k: 'Sets', v: String((a.sets || []).length) });
      out.push({ k: 'Time', v: fmt.duration(a.durationSec) });
      return out;
    }
    if (a.type === 'walk' || a.type === 'run' || a.type === 'cycle') {
      out.push({ k: 'Distance', v: fmt.distance(a.distanceKm || 0) });
      out.push({ k: 'Time', v: fmt.duration(a.durationSec) });
      if (a.durationSec && a.distanceKm) {
        const pace = (a.durationSec / 60) / a.distanceKm;
        out.push({ k: 'Pace', v: fmt.num(pace, 1) + '/' + fmt.distUnit() });
      }
      return out;
    }
    // cardio / fallback
    out.push({ k: 'Time', v: fmt.duration(a.durationSec) });
    if (a.calories) out.push({ k: 'Calories', v: fmt.num(a.calories) });
    return out;
  }

  // A single stat tile for the strip.
  function statTile(s) {
    return el('div', { class: 'col', style: { minWidth: '0' } }, [
      el('div', { class: 'tnum bold', style: { fontSize: '18px', letterSpacing: '-0.02em' }, text: s.v }),
      el('div', { class: 'label', style: { marginTop: '1px' }, text: s.k })
    ]);
  }

  /* ---------------- activityCard factory ---------------- */
  // activityCard(a, {compact}) -> <a class="card"> element.
  function activityCard(a, opts) {
    opts = opts || {};
    const compact = !!opts.compact;
    const meta = store.ACT[a.type] || store.ACT.cardio;
    const p = store.profile(a.profileId);

    const card = el('a', {
      class: 'card' + (compact ? ' flat pad-sm' : ''),
      href: '#/feed/' + a.id,
      style: { display: 'block', cursor: 'pointer' }
    });

    // --- header row: when + type chip (personal log; the athlete is always you) ---
    const header = el('div', { class: 'row between' }, [
      el('div', { class: 'row gap-2', style: { minWidth: '0', color: 'var(--muted)' } }, [
        h(icon('clock', 13)),
        el('span', { class: 't-sm semi truncate', text: fmt.relative(a.startedAt) })
      ]),
      el('span', { class: 'chip', html: icon(meta.icon, 13) + '<span>' + meta.label + '</span>' })
    ]);
    card.appendChild(header);

    // --- title ---
    if (a.title) {
      card.appendChild(el('div', { class: 'bold mt-2', style: { fontSize: '16px', letterSpacing: '-0.02em' }, text: a.title }));
    }

    // --- PR flame pill ---
    if (a.prs && a.prs.length) {
      card.appendChild(el('div', { class: 'mt-2' }, [
        el('span', { class: 'pill flame', html: icon('starFill', 13) + '<span>' + a.prs.length + ' PR' + (a.prs.length > 1 ? 's' : '') + '</span>' })
      ]));
    }

    // --- stat strip ---
    const strip = statStrip(a);
    if (strip.length) {
      card.appendChild(el('div', { class: 'row mt-3', style: { gap: 'var(--s-5)' } }, strip.map(statTile)));
    }

    // --- photo ---
    if (a.photo) {
      card.appendChild(el('img', {
        class: 'mt-3',
        src: a.photo, alt: a.title || meta.label, loading: 'lazy',
        style: { width: '100%', borderRadius: 'var(--r-sm)', objectFit: 'cover', maxHeight: compact ? '180px' : '300px' }
      }));
    }

    // --- footer: share (skipped in compact) ---
    if (!compact) {
      const footer = el('div', { class: 'row mt-3', style: { justifyContent: 'flex-end', paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' } });
      const shareBtn = el('button', { class: 'row gap-2 muted', 'aria-label': 'Share activity' }, [
        el('span', { class: 'row center', html: icon('share', 18) }),
        el('span', { class: 'semi t-sm', text: 'Share' })
      ]);
      shareBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        haptic(); share.shareActivity(a);
      });
      footer.appendChild(shareBtn);
      card.appendChild(footer);
    }

    return card;
  }

  // Expose the reusable factory.
  App.components = App.components || {};
  App.components.activityCard = activityCard;

  /* ---------------- LIST view ---------------- */
  function renderList(page) {
    page.appendChild(pageTitle('Activity', 'Your training log'));

    const items = store.feed({});
    if (!items.length) {
      page.appendChild(el('div', { class: 'mt-3' }, empty('feed', 'Nothing logged yet', 'Tap + to log your first one')));
      return;
    }

    const listWrap = el('div', { class: 'col gap-3 mt-3' });
    items.forEach(a => listWrap.appendChild(activityCard(a, { compact: false })));
    page.appendChild(listWrap);
  }

  /* ---------------- DETAIL view ---------------- */
  function backBtn() {
    const b = el('button', { class: 'iconbtn', 'aria-label': 'Back to feed', html: icon('chevL', 20) });
    b.addEventListener('click', () => { haptic(8); router.go('/feed'); });
    return b;
  }

  function renderDetail(page, id) {
    const a = store.getActivity(id);
    if (!a) {
      const wrap = el('div', {}, [
        el('div', { class: 'row mb-4' }, backBtn()),
        empty('feed', 'Activity not found', 'It may have been deleted')
      ]);
      page.appendChild(wrap);
      return;
    }

    const meta = store.ACT[a.type] || store.ACT.cardio;
    const p = store.profile(a.profileId);
    const isMine = a.profileId === store.meId();

    // --- top bar: back + (edit/delete if mine) ---
    const topActions = el('div', { class: 'row gap-2' });
    if (isMine) {
      const editBtn = el('button', { class: 'iconbtn', 'aria-label': 'Edit activity', html: icon('edit', 18) });
      editBtn.addEventListener('click', () => { haptic(); openEditSheet(a); });
      const delBtn = el('button', { class: 'iconbtn', 'aria-label': 'Delete activity', html: icon('trash', 18) });
      delBtn.addEventListener('click', async () => {
        haptic();
        const ok = await confirm({
          title: 'Delete activity?',
          message: 'This removes it from your feed permanently.',
          confirmText: 'Delete', danger: true
        });
        if (ok) { store.deleteActivity(a.id); toast('Activity deleted', { type: 'good', icon: 'check' }); router.go('/feed'); }
      });
      topActions.appendChild(editBtn);
      topActions.appendChild(delBtn);
    }
    page.appendChild(el('div', { class: 'between mb-4' }, [ backBtn(), topActions ]));

    // --- big header card ---
    const headStrip = statStrip(a);
    const headTile = headStrip[0];
    const head = el('div', { class: 'card' }, [
      el('div', { class: 'row' }, [
        avatar(p, 'lg'),
        el('div', { class: 'col grow', style: { minWidth: '0' } }, [
          el('div', { class: 'bold', style: { fontSize: '18px' }, text: (p && p.name) || 'Athlete' }),
          el('div', { class: 'muted t-sm', text: fmt.dayLabel(a.date) }),
          el('div', { class: 'mt-2' }, [
            el('span', { class: 'chip', html: icon(meta.icon, 13) + '<span>' + meta.label + '</span>' })
          ])
        ])
      ]),
      a.title ? el('h2', { class: 'mt-3', style: { fontSize: '22px' }, text: a.title }) : null,
      a.note ? el('div', { class: 'muted mt-2', text: a.note }) : null,
      // headline stat
      headTile ? el('div', { class: 'mt-4' }, [
        el('div', { class: 'label', text: headTile.k }),
        el('div', { class: 'tnum bold flame', style: { fontSize: '40px', letterSpacing: '-0.04em', lineHeight: '1.05' }, text: headTile.v })
      ]) : null,
      a.prs && a.prs.length ? el('div', { class: 'mt-3' }, [
        el('span', { class: 'pill flame', html: icon('starFill', 13) + '<span>' + a.prs.length + ' new PR' + (a.prs.length > 1 ? 's' : '') + '</span>' })
      ]) : null
    ]);
    page.appendChild(head);

    // --- type-specific body ---
    if (a.type === 'lift') {
      page.appendChild(renderLiftBody(a));
    } else if (a.type === 'walk' || a.type === 'run' || a.type === 'cycle') {
      page.appendChild(renderDistanceBody(a, headStrip));
    } else if (headStrip.length > 1) {
      // cardio extra tiles
      page.appendChild(el('div', { class: 'grid-2 mt-3' }, headStrip.map(s =>
        el('div', { class: 'card flat tile' }, [
          el('div', { class: 'k', text: s.k }),
          el('div', { class: 'v tnum', text: s.v })
        ])
      )));
    }

    // --- photo ---
    if (a.photo) {
      page.appendChild(el('div', { class: 'card mt-3', style: { padding: '0' } }, [
        el('img', { src: a.photo, alt: a.title || meta.label, style: { width: '100%', display: 'block', borderRadius: 'var(--r)' } })
      ]));
    }

    // --- share button ---
    const shareBtn = el('button', { class: 'btn block mt-3', html: icon('share', 19) + '<span>Share activity</span>' });
    shareBtn.addEventListener('click', () => { haptic(); share.shareActivity(a); });
    page.appendChild(shareBtn);
  }

  // Lift detail: sets grouped by exercise + per-exercise volume bars.
  function renderLiftBody(a) {
    const sets = a.sets || [];
    const wrap = el('div', { class: 'col gap-3 mt-3' });

    if (!sets.length) {
      wrap.appendChild(el('div', { class: 'card flat' }, empty('dumbbell', 'No sets logged', null)));
      return wrap;
    }

    // group sets by exercise, preserving first-seen order.
    const order = [];
    const groups = {};
    sets.forEach(s => {
      if (!groups[s.ex]) { groups[s.ex] = []; order.push(s.ex); }
      groups[s.ex].push(s);
    });
    // PR exercises (weight PRs) for star marking.
    const prEx = {};
    (a.prs || []).forEach(pr => { prEx[pr.ex] = true; });

    // sets list card
    const listCard = el('div', { class: 'card' }, [ el('div', { class: 'label mb-3', text: 'Sets' }) ]);
    order.forEach(ex => {
      const exRow = el('div', { class: 'item' }, [
        el('div', { class: 'body' }, [
          el('div', { class: 't row gap-2' }, [
            el('span', { text: ex }),
            prEx[ex] ? el('span', { class: 'flame row center', html: icon('starFill', 14) }) : null
          ]),
          el('div', { class: 's tnum', text: groups[ex].map(s => fmt.weight(s.kg, false) + ' x ' + s.reps).join('   ·   ') })
        ]),
        el('div', { class: 'tail tnum', text: groups[ex].length + ' sets' })
      ]);
      listCard.appendChild(exRow);
    });
    wrap.appendChild(listCard);

    // per-exercise volume bars
    const barData = order.map(ex => ({
      label: ex.split(/\s+/).slice(0, 1).join(' ').slice(0, 6),
      value: Math.round(liftVolume(groups[ex])),
      highlight: !!prEx[ex],
      sub: ex
    }));
    if (barData.length) {
      wrap.appendChild(el('div', { class: 'card' }, [
        el('div', { class: 'label mb-3', text: 'Volume by exercise' }),
        charts.bars(barData, { height: 140, valueFmt: (v) => fmt.volume(v) })
      ]));
    }
    return wrap;
  }

  // Distance detail: distance/time/pace tiles + sparkline if a series exists.
  function renderDistanceBody(a, strip) {
    const wrap = el('div', { class: 'col gap-3 mt-3' });
    const tiles = el('div', { class: 'grid-3' }, strip.map(s =>
      el('div', { class: 'card flat tile' }, [
        el('div', { class: 'k', text: s.k }),
        el('div', { class: 'v tnum', text: s.v })
      ])
    ));
    wrap.appendChild(tiles);

    // sparkline of this profile's recent same-type distances (trend context).
    const sameType = store.activitiesFor(a.profileId)
      .filter(x => x.type === a.type && (x.distanceKm || 0) > 0)
      .slice(-8)
      .map(x => x.distanceKm);
    if (sameType.length >= 3) {
      wrap.appendChild(el('div', { class: 'card' }, [
        el('div', { class: 'between mb-2' }, [
          el('div', { class: 'label', text: 'Recent ' + (store.ACT[a.type] || {}).label + ' distance' }),
          el('div', { class: 'muted t-xs', text: 'last ' + sameType.length })
        ]),
        charts.sparkline(sameType, { width: 280, height: 40 })
      ]));
    }
    return wrap;
  }

  // Edit sheet: change title + note.
  function openEditSheet(a) {
    openSheet({
      title: 'Edit activity', hint: 'Update the title or note',
      content: el('div', {}, [
        el('div', { class: 'field' }, [
          el('label', { text: 'Title' }),
          el('input', { class: 'input', id: 'edit-title', type: 'text', value: a.title || '', placeholder: 'Activity title' })
        ]),
        el('div', { class: 'field' }, [
          el('label', { text: 'Note' }),
          el('textarea', { class: 'input', id: 'edit-note', placeholder: 'How did it feel?' }, a.note || '')
        ])
      ]),
      actions: [
        { label: 'Cancel', class: 'ghost' },
        { label: 'Save', class: 'flame', onClick: () => {
          const titleEl = App.ui.$('#edit-title');
          const noteEl = App.ui.$('#edit-note');
          const title = (titleEl && titleEl.value.trim()) || a.title;
          const note = (noteEl && noteEl.value) || '';
          store.updateActivity(a.id, { title, note });
          toast('Activity updated', { type: 'good', icon: 'check' });
        } }
      ]
    });
  }

  /* ---------------- entry ---------------- */
  function render(root, params) {
    const page = el('div', { class: 'stagger' });
    if (params && params.id) renderDetail(page, params.id);
    else renderList(page);
    root.appendChild(page);
  }

  App.registerView('feed', { render, title: 'Feed' });
})(window.App);
