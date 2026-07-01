/* ============================================================
   EMBER · Onboarding — first-run setup (also after a data reset).
   Flame hero welcome → glass setup form → ignite into the app.
   ============================================================ */
(function (App) {
  'use strict';

  const { el, fmt, segmented, toast, haptic, icon, burst } = App.ui;
  const store = App.store, charts = App.charts, router = App.router;

  function render(root, params) {
    // Already set up? Skip straight to the app.
    if (store.me() && store.settings().onboarded) { router.replace('/dashboard'); return; }

    let units = (store.settings() && store.settings().units) || 'metric';
    let role = store.role() || 'client';

    const page = el('div', { class: 'stagger', style: { paddingTop: '8px' } });

    /* ---------- Flame brand hero ---------- */
    const hero = el('div', { class: 'hero', style: { textAlign: 'center', paddingTop: '34px', paddingBottom: '32px' } }, [
      // glowing flame mark
      el('div', { class: 'flicker', style: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '84px', height: '84px', borderRadius: '50%', marginBottom: '18px',
        background: 'rgba(255,255,255,0.16)',
        border: '1px solid rgba(255,255,255,0.4)',
        boxShadow: 'inset 0 2px 10px rgba(255,255,255,0.35), 0 10px 30px rgba(255,77,46,0.35)'
      }, html: icon('flame', 44) }),
      el('div', { class: 'label', style: { marginBottom: '6px' }, text: 'Welcome to' }),
      el('h1', { style: { fontSize: '40px', letterSpacing: '-0.04em', lineHeight: '1' }, text: 'Ember' }),
      el('div', { class: 'mt-2', style: { fontSize: 'var(--t-lg)', fontWeight: 'var(--w-semi)', opacity: '0.92' }, text: 'Train. Track. Burn.' })
    ]);
    page.appendChild(hero);

    /* ---------- Role chooser ---------- */
    const roleWrap = el('div', { class: 'mt-2' }, [ el('div', { class: 'label mb-3', text: 'How will you use Ember?' }) ]);
    const roleGrid = el('div', { class: 'grid-2' });
    const roleCards = {};
    function roleCard(value, ic, title, sub) {
      const sel0 = role === value;
      const card = el('button', { class: 'card nested role-card' + (sel0 ? ' on' : ''), style: {
        display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', padding: '16px', textAlign: 'left',
        borderColor: sel0 ? 'var(--flame)' : '', boxShadow: sel0 ? 'var(--sh-flame)' : '', transition: 'border-color .2s, box-shadow .2s'
      } }, [
        el('div', { class: 'iconbtn', style: role === value ? { background: 'var(--grad-flame)', color: 'var(--on-flame)', border: '0' } : {}, html: icon(ic, 22) }),
        el('div', {}, [ el('div', { class: 'semi', text: title }), el('div', { class: 'muted t-xs', text: sub }) ])
      ]);
      card.addEventListener('click', () => {
        role = value; haptic(8);
        Object.keys(roleCards).forEach(k => {
          const c = roleCards[k]; const sel = k === value;
          c.classList.toggle('on', sel);
          c.style.borderColor = sel ? 'var(--flame)' : '';
          c.style.boxShadow = sel ? 'var(--sh-flame)' : '';
          const ib = c.querySelector('.iconbtn');
          if (sel) { ib.style.background = 'var(--grad-flame)'; ib.style.color = 'var(--on-flame)'; ib.style.border = '0'; }
          else { ib.style.background = ''; ib.style.color = ''; ib.style.border = ''; }
        });
      });
      roleCards[value] = card;
      return card;
    }
    roleGrid.appendChild(roleCard('client', 'user', 'Train myself', 'Log workouts, track weight, build streaks'));
    roleGrid.appendChild(roleCard('trainer', 'users', 'Coach others', 'Preview — assign plans & review clients'));
    roleWrap.appendChild(roleGrid);
    page.appendChild(roleWrap);

    /* ---------- Setup form (glass card) ---------- */
    const nameField = el('div', { class: 'field' });
    const nameInput = el('input', { type: 'text', placeholder: 'Your name', autocomplete: 'name',
      maxlength: '40', 'aria-label': 'Your name' });
    nameField.appendChild(el('label', { text: 'Name' }));
    nameField.appendChild(nameInput);

    const goalField = el('div', { class: 'field' });
    const goalInput = el('input', { type: 'text', placeholder: 'Look good in clothes by Dec 31',
      maxlength: '80', 'aria-label': 'Goal' });
    goalField.appendChild(el('label', { text: 'Goal' }));
    goalField.appendChild(goalInput);

    const heightField = el('div', { class: 'field' });
    const heightInput = el('input', { type: 'number', inputmode: 'numeric', placeholder: 'e.g. 175',
      min: '90', max: '250', step: '1', 'aria-label': 'Height in centimetres' });
    heightField.appendChild(el('label', { text: 'Height · cm (optional)' }));
    heightField.appendChild(heightInput);

    const unitsField = el('div', { class: 'field', style: { marginBottom: '0' } });
    const unitsSeg = segmented(
      [{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }],
      units,
      v => { units = v; }
    );
    unitsField.appendChild(el('label', { text: 'Units' }));
    unitsField.appendChild(unitsSeg);

    const form = el('div', { class: 'card pad-lg mt-4' }, [
      el('div', { class: 'label mb-3', text: 'Set up your profile' }),
      nameField, goalField, heightField, unitsField
    ]);
    page.appendChild(form);

    /* ---------- Start button ---------- */
    const startBtn = el('button', { class: 'btn block lg mt-4',
      html: icon('flame', 20) + '<span>Start training</span>' });
    page.appendChild(startBtn);

    page.appendChild(el('div', { class: 'muted t-xs center mt-3',
      style: { textAlign: 'center', lineHeight: '1.5' },
      text: 'Saved on this device and backed up to your private server. Build the streak, log every set, watch the ring close.' }));

    function shake(node) {
      node.classList.remove('shake');
      void node.offsetWidth; // reflow so the animation re-triggers
      node.classList.add('shake');
    }

    let igniting = false;
    function start() {
      if (igniting) return;
      const name = (nameInput.value || '').trim();
      if (!name) {
        haptic([14, 30, 14]);
        shake(nameField);
        nameInput.focus();
        toast('Add your name to begin', { type: 'flame', icon: 'info' });
        return;
      }
      igniting = true;
      haptic([18, 40, 18]);

      const heightCm = parseInt(heightInput.value, 10);
      store.addProfile({
        name,
        goal: (goalInput.value || '').trim(),
        heightCm: Number.isFinite(heightCm) && heightCm > 0 ? heightCm : null,
        isMe: true
      });
      store.setUnits(units === 'imperial' ? 'imperial' : 'metric');
      store.setRole(role);
      store.completeOnboarding();
      // trainers get a live demo roster to coach immediately
      if (role !== 'client' && App.seed && App.seed.ensureClients) App.seed.ensureClients();
      App.router.buildNav();

      burst();
      // let the celebration breathe before the view swap
      setTimeout(() => router.go(role === 'client' ? '/dashboard' : '/trainer'), 360);
    }

    startBtn.addEventListener('click', start);
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); goalInput.focus(); } });
    goalInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); start(); } });

    root.appendChild(page);

    // autofocus the first input after the entrance settles
    setTimeout(() => { try { nameInput.focus(); } catch (e) {} }, 300);
  }

  App.registerView('onboarding', { render, title: 'Welcome' });
})(window.App);
