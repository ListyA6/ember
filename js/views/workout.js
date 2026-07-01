/* ============================================================
   EMBER · Workout — the lifting logger.
   Picks today's program, runs a live session, logs/edits sets,
   tracks session + rest timers, captures an optional gym photo.
   ============================================================ */
(function (App) {
  'use strict';

  const ui = App.ui;
  const { el, h, $, fmt, segmented, openSheet, confirm, toast, haptic, icon, pageTitle, empty, countUp } = ui;
  const store = App.store, charts = App.charts, router = App.router;

  /* ---- timer state lives on window so re-renders don't multiply intervals ---- */
  function clearTickers() {
    if (window._emberSess) { clearInterval(window._emberSess); window._emberSess = null; }
    if (window._emberRest) { clearInterval(window._emberRest); window._emberRest = null; }
  }

  /* ---------------- program picker ---------------- */
  function openProgramPicker() {
    const keys = store.programKeys ? store.programKeys() : ['upperA', 'upperB', 'lowerA', 'lowerB', 'rest'];
    const todayKey = store.programFor().key;
    openSheet({
      title: 'Change program', hint: 'Override today’s plan',
      content: (api) => {
        const list = el('div', { class: 'col gap-2' });
        keys.forEach(k => {
          const p = store.PROGRAMS[k];
          const active = k === todayKey;
          const row = el('button', {
            class: 'card nested between',
            style: { textAlign: 'left', width: '100%', padding: '14px 16px',
              border: active ? '1px solid var(--flame)' : null }
          }, [
            el('div', { class: 'row gap-3' }, [
              el('div', { class: 'iconbtn plain', style: { color: 'var(--flame)' },
                html: icon(k === 'rest' ? 'walk' : 'dumbbell', 20) }),
              el('div', { class: 'col' }, [
                el('div', { class: 'semi', text: p.name }),
                el('div', { class: 'muted t-xs', text: k === 'rest' ? 'Recover & walk' : (p.ex.length + ' exercises') })
              ])
            ]),
            active ? h(icon('check', 20)) : null
          ]);
          row.addEventListener('click', () => { haptic(); store.setTodayProgram(k); api.close(); });
          list.appendChild(row);
        });
        return list;
      }
    });
  }

  function changePill() {
    const pill = el('button', { class: 'pill flame', html: icon('edit', 14) + '<span>Change</span>' });
    pill.addEventListener('click', () => { haptic(8); openProgramPicker(); });
    return pill;
  }

  /* ---------------- A) rest day, no active session ---------------- */
  function renderRest(page) {
    const card = el('div', { class: 'card tint' }, [
      el('div', { class: 'row gap-3 mb-3' }, [
        el('div', { class: 'iconbtn', style: { background: 'var(--grad-flame)', color: 'var(--on-flame)', border: '0' }, html: icon('walk', 22) }),
        el('div', { class: 'col' }, [
          el('div', { class: 'bold t-lg', text: 'Rest day' }),
          el('div', { class: 'muted t-sm', text: 'Recover hard so tomorrow hits.' })
        ])
      ]),
      el('div', { class: 'col gap-2' }, [
        restLine('heart', 'Recover — let the muscle rebuild'),
        restLine('walk', 'Get your 10k walk in'),
        restLine('fork', 'Eat protein, hydrate, sleep early')
      ])
    ]);
    page.appendChild(card);

    const walkBtn = el('button', { class: 'btn block mt-3', html: icon('walk', 19) + '<span>Log your 7k walk</span>' });
    walkBtn.addEventListener('click', () => { haptic(12); router.go('/walk'); });
    page.appendChild(walkBtn);

    const lift = el('button', { class: 'btn block ghost mt-2', html: icon('dumbbell', 19) + '<span>Lift anyway</span>' });
    lift.addEventListener('click', () => { haptic(8); openProgramPicker(); });
    page.appendChild(lift);
  }
  function restLine(ic, txt) {
    return el('div', { class: 'row gap-2' }, [
      el('span', { class: 'flame', style: { display: 'inline-flex' }, html: icon(ic, 16) }),
      el('span', { class: 'muted t-sm', text: txt })
    ]);
  }

  /* ---------------- B) workout day, not started ---------------- */
  function renderPreview(page, program) {
    const list = el('div', {});
    program.ex.forEach(ex => {
      const last = store.lastSetFor(ex.n);
      list.appendChild(el('div', { class: 'card nested between mb-2' }, [
        el('div', { class: 'col grow', style: { minWidth: '0' } }, [
          el('div', { class: 'semi truncate', text: ex.n }),
          el('div', { class: 'muted t-xs', text: ex.sets + 'x' + ex.reps })
        ]),
        el('div', { class: 'col', style: { textAlign: 'right' } }, [
          el('div', { class: 'label', text: 'Last' }),
          el('div', { class: 'semi t-sm tnum', text: last ? (fmt.weight(last.kg) + ' x ' + last.reps) : 'first time' })
        ])
      ]));
    });
    page.appendChild(list);

    const start = el('button', { class: 'btn block lg mt-3', html: icon('play', 22) + '<span>Start workout</span>' });
    start.addEventListener('click', () => { haptic([12, 20, 12]); store.startSession(); });
    page.appendChild(start);
  }

  /* ---------------- C) active session ---------------- */
  function renderActive(page, program, sess) {
    if (sess.date !== store.today()) {
      page.appendChild(el('div', { class: 'card tint mb-2', style: { borderColor: 'var(--flame)' } }, [
        el('div', { class: 'row gap-2' }, [
          el('span', { class: 'flame', style: { display: 'inline-flex' }, html: icon('info', 16) }),
          el('div', { class: 'muted t-sm', text: 'Unfinished session from ' + fmt.dayLabel(sess.date) + '. Finish or cancel it to start a new one.' })
        ])
      ]));
    }
    /* --- timer bar --- */
    const elapsedNode = el('div', { class: 'tnum bold', style: { fontSize: '34px', letterSpacing: '-0.03em' } }, '0:00');
    const restNode = el('div', { class: 'tnum bold flame', style: { fontSize: '22px' } }, 'GO');

    function paintElapsed() {
      const sec = Math.max(0, Math.round((Date.now() - sess.startedAt) / 1000));
      const m = Math.floor(sec / 60), s = sec % 60;
      elapsedNode.textContent = m + ':' + String(s).padStart(2, '0');
    }
    paintElapsed();
    window._emberSess = setInterval(paintElapsed, 1000);

    const timerCard = el('div', { class: 'card' }, [
      el('div', { class: 'between' }, [
        el('div', { class: 'col' }, [
          el('div', { class: 'label', text: 'Session' }),
          elapsedNode
        ]),
        el('div', { class: 'col', style: { textAlign: 'right' } }, [
          el('div', { class: 'label row gap-1', style: { justifyContent: 'flex-end' }, html: icon('timer', 12) + '<span>Rest</span>' }),
          restNode
        ])
      ])
    ]);
    page.appendChild(timerCard);

    // make rest controls reachable across cells
    const restApi = makeRestController(restNode);

    /* --- photo row --- */
    page.appendChild(renderPhotoRow(sess));

    /* --- exercise cards --- */
    program.ex.forEach(ex => {
      page.appendChild(renderExerciseCard(ex, sess, restApi));
    });

    /* --- bottom actions --- */
    const finish = el('button', { class: 'btn block lg mt-4', html: icon('check', 22) + '<span>Finish workout</span>' });
    finish.addEventListener('click', async () => {
      haptic([12, 30, 12]);
      const c = store.currentSession();
      if (!c) return;
      if (!c.photo) {
        toast('Add a session photo — it’s your proof for the pact');
        return;
      }
      finish.disabled = true; toast('Saving session…');
      const photoData = c.photo;
      const act = store.finishSession({ photo: photoData });
      clearTickers();
      try {
        const url = await App.pactSync.upload(photoData);
        await App.pactSync.putDay({ date: store.today(), isWorkoutDay: true, workoutDone: true, workoutPhotoUrl: url });
      } catch (e) { toast('Saved locally — proof upload failed: ' + e.message); }
      App.celebratePRs(act);
      toast('Workout logged', { type: 'good', icon: 'check' });
      router.go('/dashboard');
    });
    page.appendChild(finish);

    const cancel = el('button', { class: 'btn block ghost mt-2', html: icon('x', 19) + '<span>Cancel</span>' });
    cancel.addEventListener('click', async () => {
      const ok = await confirm({ title: 'Cancel this workout?', message: 'Logged sets will be discarded.', confirmText: 'Discard', danger: true });
      if (!ok) return;
      clearTickers();
      store.cancelSession();
    });
    page.appendChild(cancel);
  }

  /* --- rest countdown controller (one node, swappable timer) --- */
  function makeRestController(restNode) {
    function tick() {
      if (!window._emberRestEnd) return;
      const left = Math.round((window._emberRestEnd - Date.now()) / 1000);
      if (left <= 0) {
        restNode.textContent = 'GO';
        restNode.classList.add('flame');
        if (window._emberRest) { clearInterval(window._emberRest); window._emberRest = null; }
        window._emberRestEnd = null;
        haptic([30, 60, 30]);
        restNode.classList.add('pulse');
        return;
      }
      const m = Math.floor(left / 60), s = left % 60;
      restNode.textContent = m + ':' + String(s).padStart(2, '0');
    }
    function startRest(seconds) {
      if (window._emberRest) { clearInterval(window._emberRest); window._emberRest = null; }
      window._emberRestEnd = Date.now() + seconds * 1000;
      restNode.classList.remove('pulse');
      tick();
      window._emberRest = setInterval(tick, 250);
    }
    // resume an in-flight rest across the re-render the store triggers on logSet
    if (window._emberRestEnd && window._emberRestEnd > Date.now()) {
      tick();
      window._emberRest = setInterval(tick, 250);
    } else {
      restNode.textContent = 'GO';
    }
    return { startRest };
  }

  /* --- photo capture row --- */
  function renderPhotoRow(sess) {
    const card = el('div', { class: 'card flat' });
    const inp = el('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: 'hidden' });
    inp.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const dataUrl = await ui.resizeImage(f, 900);
      const c = store.currentSession();
      if (!c) return;
      c.photo = dataUrl;
      store.save();
      haptic();
    });

    const label = el('label', { class: 'item', style: { cursor: 'pointer', borderBottom: '0', padding: '0' } });
    if (sess.photo) {
      label.appendChild(el('div', {
        style: { width: '52px', height: '52px', borderRadius: 'var(--r-sm)', backgroundImage: 'url(\'' + sess.photo + '\')', backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: '0' }
      }));
      label.appendChild(el('div', { class: 'body' }, [
        el('div', { class: 't', text: 'Photo added' }),
        el('div', { class: 's', text: 'Tap to retake' })
      ]));
      label.appendChild(el('span', { class: 'good', style: { display: 'inline-flex' }, html: icon('checkCircle', 22) }));
    } else {
      label.appendChild(el('div', { class: 'iconbtn', html: icon('camera', 20) }));
      label.appendChild(el('div', { class: 'body' }, [
        el('div', { class: 't', text: 'Add a gym photo' }),
        el('div', { class: 's', text: 'Optional, but encouraged' })
      ]));
      label.appendChild(h(icon('chevR', 18)));
    }
    label.appendChild(inp);
    card.appendChild(label);
    return card;
  }

  /* --- one exercise card with per-set cells --- */
  function renderExerciseCard(ex, sess, restApi) {
    const logged = sess.sets.filter(s => s.ex === ex.n);
    const card = el('div', { class: 'card mb-2' }, [
      el('div', { class: 'between mb-3' }, [
        el('div', { class: 'col grow', style: { minWidth: '0' } }, [
          el('div', { class: 'semi truncate', text: ex.n }),
          el('div', { class: 'muted t-xs', text: 'Target ' + ex.sets + 'x' + ex.reps })
        ]),
        el('div', { class: 'pill' + (logged.length >= ex.sets ? ' good' : ''), html: (logged.length >= ex.sets ? icon('check', 14) : '') + '<span class="tnum">' + logged.length + '/' + ex.sets + '</span>' })
      ])
    ]);

    const cells = el('div', { class: 'col gap-2' });
    for (let i = 0; i < ex.sets; i++) {
      const set = logged[i];
      cells.appendChild(set ? loggedCell(ex, set, sess, i) : emptyCell(ex, i, sess, restApi));
    }
    card.appendChild(cells);
    return card;
  }

  function setNumberTag(i) {
    return el('div', { class: 'tnum semi muted', style: { width: '20px', flexShrink: '0' }, text: String(i + 1) });
  }

  function loggedCell(ex, set, sess, displayIdx) {
    const cell = el('button', {
      class: 'row between',
      style: { width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'var(--good-soft)', border: '1px solid rgba(27,191,116,0.28)' }
    }, [
      el('div', { class: 'row gap-2' }, [
        setNumberTag(displayIdx),
        el('div', { class: 'semi tnum', text: fmt.weight(set.kg) + ' x ' + set.reps })
      ]),
      el('span', { class: 'good', style: { display: 'inline-flex' }, html: icon('edit', 16) })
    ]);
    cell.addEventListener('click', () => {
      haptic(8);
      const arrIndex = store.currentSession().sets.indexOf(set);
      openSetSheet(ex, displayIdx, { kg: set.kg, reps: set.reps }, {
        mode: 'edit', arrIndex
      });
    });
    return cell;
  }

  function emptyCell(ex, idx, sess, restApi) {
    const cell = el('button', {
      class: 'row gap-2',
      style: { width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'var(--glass-fill-2)', border: '1px dashed var(--line-strong)', color: 'var(--muted)' }
    }, [
      setNumberTag(idx),
      el('span', { class: 'flame row gap-1', style: { fontWeight: 'var(--w-semi)' }, html: icon('plus', 16) + '<span>log</span>' })
    ]);
    cell.addEventListener('click', () => {
      haptic(8);
      const last = store.lastSetFor(ex.n);
      openSetSheet(ex, idx, last, { mode: 'log', restApi });
    });
    return cell;
  }

  /* --- the set sheet: stepper weight + reps input --- */
  function openSetSheet(ex, idx, prefill, opts) {
    opts = opts || {};
    let kg = prefill && prefill.kg != null ? +prefill.kg : 20;
    const repsDefault = prefill && prefill.reps != null ? prefill.reps : 8;

    const big = el('input', { class: 'input big tnum', id: 'set-kg', type: 'number', inputmode: 'decimal', step: '2.5', value: kg });
    const minus = el('button', { html: icon('minus', 20), 'aria-label': 'Decrease' });
    const plus = el('button', { html: icon('plus', 20), 'aria-label': 'Increase' });
    minus.addEventListener('click', () => { kg = Math.max(0, (parseFloat(big.value) || 0) - 2.5); big.value = kg; haptic(6); });
    plus.addEventListener('click', () => { kg = (parseFloat(big.value) || 0) + 2.5; big.value = kg; haptic(6); });

    const repsInp = el('input', { class: 'input tnum', id: 'set-reps', type: 'number', inputmode: 'numeric', step: '1', value: repsDefault });

    const content = el('div', {}, [
      el('div', { class: 'field' }, [
        el('label', { text: 'Weight (' + fmt.rawWeightUnit() + ')' }),
        el('div', { class: 'stepper' }, [ minus, big, plus ])
      ]),
      el('div', { class: 'field' }, [
        el('label', { text: 'Reps' }),
        repsInp
      ])
    ]);

    const actions = [];
    if (opts.mode === 'edit') {
      actions.push({ label: 'Delete', class: 'danger', icon: 'trash', onClick: () => {
        store.deleteSet(opts.arrIndex); haptic([10, 30]); toast('Set removed');
      } });
    }
    actions.push({ label: opts.mode === 'edit' ? 'Save set' : 'Log & rest', class: 'flame', onClick: () => {
      const wv = parseFloat(big.value);
      const rv = parseInt(repsInp.value, 10);
      if (isNaN(wv) || isNaN(rv) || rv <= 0) { big.classList.add('shake'); return false; }
      if (opts.mode === 'edit') {
        store.editSet(opts.arrIndex, wv, rv);
        haptic(10);
      } else {
        store.logSet(ex.n, idx, wv, rv);
        haptic([12, 20]);
        if (opts.restApi) opts.restApi.startRest(90);
      }
    } });

    openSheet({
      title: ex.n,
      hint: 'Set ' + (idx + 1) + ' · target ' + ex.reps + ' reps',
      content,
      actions
    });
  }

  /* ---------------- pact: recovery swap ---------------- */
  function swapCard(today) {
    const user = store.currentUser() || 'me';
    const can = App.pact.canSwap(App.pactSync.cache, user, today);
    const card = el('div', { class: 'card tint mb-2' }, [
      el('div', { class: 'row gap-3 mb-2' }, [
        el('div', { class: 'iconbtn', style: { background: 'var(--grad-flame)', color: 'var(--on-flame)', border: '0' }, html: icon('walk', 20) }),
        el('div', { class: 'col' }, [
          el('div', { class: 'semi', text: 'Too sore to lift?' }),
          el('div', { class: 'muted t-xs', text: can
            ? 'Swap this workout for a 14k recovery walk — the day still counts.'
            : 'No swaps left this week (max 2).' })
        ])
      ])
    ]);
    if (can) {
      const b = el('button', { class: 'btn block ghost', html: icon('walk', 18) + '<span>Use recovery walk</span>' });
      b.addEventListener('click', async () => {
        const ok = await confirm({ title: 'Use a recovery walk?', message: 'Counts as 1 of your 2 weekly swaps. Today’s target becomes 14,000 steps.', confirmText: 'Swap' });
        if (!ok) return;
        try {
          await App.pactSync.putDay({ date: today, isWorkoutDay: true, swapUsed: true });
          toast('Recovery walk set — target 14k', { type: 'good', icon: 'check' });
          router.go('/walk');
        } catch (e) { toast('Swap failed: ' + e.message); }
      });
      card.appendChild(b);
    }
    return card;
  }

  /* ---------------- render ---------------- */
  function render(root, params) {
    // timer hygiene: kill any interval from a previous render first.
    clearTickers();

    const page = el('div', { class: 'stagger' });
    const sess = store.currentSession();
    const active = !!sess;   // any in-progress session is resumable (prevents cross-day data loss)
    const program = active
      ? Object.assign({ key: sess.type }, store.PROGRAMS[sess.type] || store.programFor())
      : store.programFor();

    // header
    const title = pageTitle((program && program.name) || 'Workout', 'Today’s session');
    const head = title.querySelector('h1');
    if (head) {
      const wrap = el('div', { class: 'between' });
      head.parentNode.insertBefore(wrap, head);
      wrap.appendChild(head);
      wrap.appendChild(changePill());
    }
    page.appendChild(title);

    if (!store.me()) {
      page.appendChild(empty('user', 'No athlete yet', 'Finish onboarding to start logging.'));
      root.appendChild(page);
      return;
    }

    const today = store.today();
    const todayRow = (App.pactSync && App.pactSync.cachedDay(store.currentUser() || 'me', today)) || {};
    if (!active && store.isPactWorkoutDay(today) && !todayRow.workoutDone && !todayRow.swapUsed) {
      page.appendChild(swapCard(today));
    }

    if (active) {
      renderActive(page, program, sess);
    } else if (program && program.key === 'rest') {
      renderRest(page);
    } else {
      renderPreview(page, program);
    }

    root.appendChild(page);
  }

  App.registerView('workout', { render, title: 'Workout' });
})(window.App);
