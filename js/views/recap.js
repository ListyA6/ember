/* ============================================================
   Ember Pact — Weekly recap (both sides) + monthly settle.
   ============================================================ */
(function (App) {
  'use strict';
  const { el, icon, haptic, toast, confirm, pageTitle } = App.ui;
  const store = App.store, pact = App.pact, sync = App.pactSync;
  const D = store.D;
  const NAME = { me: 'Listy', gf: 'Yeti' };

  function weekStats(user, weekId) {
    const rows = sync.cache.filter(d => d.user === user && pact.isoWeekId(d.date) === weekId);
    let complete = 0, workouts = 0, walks = 0, swaps = 0;
    rows.forEach(d => {
      if (pact.isComplete(d)) complete++;
      if (d.workoutDone) workouts++;
      if ((d.stepCount || 0) >= pact.STEP_GOAL) walks++;
      if (d.swapUsed) swaps++;
    });
    return { complete, workouts, walks, swaps };
  }

  function statLine(label, a, b) {
    return el('div', { class: 'between', style: { padding: '8px 0', borderTop: '1px solid var(--line)' } }, [
      el('div', { class: 'tnum semi', style: { width: '48px', textAlign: 'left' }, text: String(a) }),
      el('div', { class: 'muted t-xs', style: { flex: '1', textAlign: 'center' }, text: label }),
      el('div', { class: 'tnum semi', style: { width: '48px', textAlign: 'right' }, text: String(b) })
    ]);
  }

  function render(root) {
    const me = store.currentUser() || 'me';
    const other = me === 'me' ? 'gf' : 'me';
    const today = store.today();
    const month = today.slice(0, 7);
    const weekId = pact.isoWeekId(today);

    const page = el('div', { class: 'stagger' });
    page.appendChild(pageTitle('Recap', 'This week & the month'));

    // ---- weekly side-by-side ----
    const sMe = weekStats(me, weekId), sOther = weekStats(other, weekId);
    page.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'between mb-2' }, [
        el('div', { class: 'semi', style: { width: '48px' }, text: NAME[me] }),
        el('div', { class: 'label', style: { flex: '1', textAlign: 'center' }, text: 'This week' }),
        el('div', { class: 'semi', style: { width: '48px', textAlign: 'right' }, text: NAME[other] })
      ]),
      statLine('days complete', sMe.complete, sOther.complete),
      statLine('workouts done', sMe.workouts, sOther.workouts),
      statLine('walk days (7k+)', sMe.walks, sOther.walks),
      statLine('recovery swaps', sMe.swaps, sOther.swaps)
    ]));

    // ---- monthly money ----
    const myMiss = pact.missedDays(sync.cache, me, month, today);
    const partnerMiss = pact.missedDays(sync.cache, other, month, today);
    const net = (partnerMiss - myMiss) * pact.STAKE;
    const label = net > 0 ? (NAME[other] + ' owes you') : net < 0 ? ('You owe ' + NAME[other]) : 'All square';

    page.appendChild(el('div', { class: 'card mt-3', style: { textAlign: 'center', padding: '20px' } }, [
      el('div', { class: 'label', text: month + ' · ' + label }),
      el('div', { class: 'bold', style: { fontFamily: 'var(--font-display)', fontSize: '36px', margin: '4px 0' }, text: pact.fmtRp(net) }),
      el('div', { class: 'muted t-xs', text: 'You missed ' + myMiss + ' · ' + NAME[other] + ' missed ' + partnerMiss + ' (Rp25.000/day)' })
    ]));

    const settleBtn = el('button', { class: 'btn block flame mt-3', html: icon('check', 19) + '<span>Settle up &amp; log</span>' });
    settleBtn.addEventListener('click', async () => {
      const ok = await confirm({ title: 'Settle ' + month + '?', message: 'Records this month’s net (' + pact.fmtRp(net) + ' ' + label.toLowerCase() + ') to history. Pay the cash in real life.', confirmText: 'Settle' });
      if (!ok) return;
      haptic([12, 30, 12]);
      try {
        // store from the canonical me-perspective so both phones agree
        const netToMeCanonical = (pact.missedDays(sync.cache, 'gf', month, today) - pact.missedDays(sync.cache, 'me', month, today)) * pact.STAKE;
        await sync.settle(month, netToMeCanonical, '');
        toast('Settled — recorded to history', { type: 'good', icon: 'check' });
        renderHistory();
      } catch (e) { toast('Settle failed: ' + e.message); }
    });
    page.appendChild(settleBtn);

    const historyWrap = el('div', { class: 'mt-3' });
    page.appendChild(historyWrap);
    async function renderHistory() {
      App.ui.clear(historyWrap);
      let list = [];
      try { list = await sync.settlements(); } catch (e) {}
      if (!list.length) return;
      const card = el('div', { class: 'card' }, [ el('div', { class: 'label mb-2', text: 'Settled months' }) ]);
      list.forEach(s => {
        const n = +s.net_to_me;
        const who = n > 0 ? 'Yeti paid Listy' : n < 0 ? 'Listy paid Yeti' : 'Even';
        card.appendChild(el('div', { class: 'between', style: { padding: '8px 0', borderTop: '1px solid var(--line)' } }, [
          el('div', { class: 'semi t-sm', text: s.month }),
          el('div', { class: 'muted t-xs', text: who }),
          el('div', { class: 'tnum semi', text: pact.fmtRp(n) })
        ]));
      });
      historyWrap.appendChild(card);
    }
    renderHistory();

    root.appendChild(page);
  }

  App.registerView('recap', { render, title: 'Recap' });
})(window.App);
