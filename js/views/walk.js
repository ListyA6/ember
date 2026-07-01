/* ============================================================
   Ember Pact — Walk logger. Enter step count + smartwatch photo.
   Auto-completes the day's walk requirement on save.

   Draft persistence: on mobile, opening the camera (file input with
   capture) can make the OS evict/reload the whole WebView to free
   memory — which wipes the typed step count and the picked photo.
   So we persist an in-progress draft (steps + photo) to localStorage
   on every change and restore it on render. Survives reload, a
   background refresh, and navigating away and back. Cleared on save.
   ============================================================ */
(function (App) {
  'use strict';
  const ui = App.ui;
  const { el, h, icon, haptic, toast, pageTitle } = ui;
  const store = App.store, router = App.router, pact = App.pact, sync = App.pactSync;

  function render(root) {
    const me = store.currentUser() || 'me';
    const today = store.today();
    const row = sync.cachedDay(me, today) || {};
    const target = pact.walkTarget(row);

    const DRAFT_KEY = 'pact_walk_draft_' + me;
    const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; } };
    const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} };
    const d = loadDraft();
    const draft = (d && d.date === today) ? d : null;   // only today's draft applies

    // restore photo/steps from draft, else from the saved server row
    let photo = (draft && draft.photo) ? draft.photo : (row.stepPhotoUrl || null); // server URL or new dataURL
    let photoIsNew = !!(draft && draft.photo);

    const saveDraft = () => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ date: today, steps: stepInput.value, photo: photoIsNew ? photo : null })); }
      catch (e) { /* quota / private mode — draft is best-effort */ }
    };

    const page = el('div', { class: 'stagger' });
    page.appendChild(pageTitle('Log your walk', 'Target ' + target.toLocaleString('id-ID') + ' steps today'));

    // step count
    const initialSteps = (draft && draft.steps) ? String(draft.steps) : (row.stepCount ? String(row.stepCount) : '');
    const stepInput = el('input', { class: 'input big tnum', id: 'walk-steps', type: 'number', inputmode: 'numeric',
      step: '100', placeholder: String(target), value: initialSteps });
    stepInput.addEventListener('input', saveDraft);   // persist as they type
    page.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'field', style: { marginBottom: '0' } }, [ el('label', { text: 'Step count' }), stepInput ])
    ]));

    // smartwatch photo
    const photoInput = el('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: 'hidden' });
    const photoLabel = el('label', { class: 'item', style: { cursor: 'pointer', borderBottom: '0', padding: '0' } });
    function paintPhoto() {
      ui.clear(photoLabel);
      if (photo) {
        photoLabel.appendChild(el('div', { style: { width: '52px', height: '52px', borderRadius: 'var(--r-sm)',
          backgroundImage: "url('" + photo + "')", backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: '0' } }));
        photoLabel.appendChild(el('div', { class: 'body' }, [ el('div', { class: 't', text: 'Watch photo added' }), el('div', { class: 's', text: 'Tap to retake' }) ]));
        photoLabel.appendChild(el('span', { class: 'good', style: { display: 'inline-flex' }, html: icon('checkCircle', 22) }));
      } else {
        photoLabel.appendChild(el('div', { class: 'iconbtn', html: icon('camera', 20) }));
        photoLabel.appendChild(el('div', { class: 'body' }, [ el('div', { class: 't', text: 'Smartwatch photo' }), el('div', { class: 's', text: 'Snap your watch step count' }) ]));
        photoLabel.appendChild(h(icon('chevR', 18)));
      }
      photoLabel.appendChild(photoInput);
    }
    photoInput.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try {
        photo = await ui.resizeImage(f, 1000); photoIsNew = true; haptic(); paintPhoto(); saveDraft();
      } catch (err) { toast('Could not read that photo — try again'); }
    });
    paintPhoto();
    page.appendChild(el('div', { class: 'card flat mt-2' }, [photoLabel]));

    const save = el('button', { class: 'btn block lg flame mt-4', html: icon('check', 22) + '<span>Save walk</span>' });
    save.addEventListener('click', async () => {
      const steps = parseInt(stepInput.value, 10);
      if (!steps || steps <= 0) { stepInput.classList.add('shake'); toast('Enter your step count'); return; }
      if (!photo) { toast('Add a smartwatch photo as proof'); return; }
      haptic([12, 30, 12]); save.disabled = true; toast('Saving walk…');
      try {
        let url = photo;
        if (photoIsNew) url = await sync.upload(photo);
        await sync.putDay({ date: today, stepCount: steps, stepPhotoUrl: url });
        clearDraft();
        toast('Walk logged', { type: 'good', icon: 'check' });
        router.go('/dashboard');
      } catch (err) { save.disabled = false; toast('Save failed: ' + err.message); }
    });
    page.appendChild(save);

    root.appendChild(page);
  }

  App.registerView('walk', { render, title: 'Walk', noRefresh: true });
})(window.App);
