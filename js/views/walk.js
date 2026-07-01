/* ============================================================
   Ember Pact — Walk logger. Enter step count + smartwatch photo.
   Auto-completes the day's walk requirement on save.
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

    let photo = row.stepPhotoUrl || null;     // existing server URL or new dataURL
    let photoIsNew = false;

    const page = el('div', { class: 'stagger' });
    page.appendChild(pageTitle('Log your walk', 'Target ' + target.toLocaleString('id-ID') + ' steps today'));

    // step count
    const stepInput = el('input', { class: 'input big tnum', id: 'walk-steps', type: 'number', inputmode: 'numeric',
      step: '100', placeholder: String(target), value: row.stepCount ? String(row.stepCount) : '' });
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
      photo = await ui.resizeImage(f, 1000); photoIsNew = true; haptic(); paintPhoto();
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
        toast('Walk logged', { type: 'good', icon: 'check' });
        router.go('/dashboard');
      } catch (err) { save.disabled = false; toast('Save failed: ' + err.message); }
    });
    page.appendChild(save);

    root.appendChild(page);
  }

  App.registerView('walk', { render, title: 'Walk' });
})(window.App);
