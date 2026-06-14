/* ============================================================
   EMBER · Share — render an activity/profile to a canvas card,
   then native-share (Web Share API) or download as PNG.
   ============================================================ */
window.App = window.App || {};
(function (App) {
  'use strict';
  const store = App.store, ui = App.ui;

  function loadImg(src) { return new Promise(res => { if (!src) return res(null); const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function metricsFor(a) {
    const out = [];
    if (a.type === 'lift') {
      const vol = (a.sets || []).reduce((v, s) => v + s.kg * s.reps, 0);
      out.push({ k: 'Volume', v: ui.fmt.volume(vol) });
      out.push({ k: 'Sets', v: String((a.sets || []).length) });
      out.push({ k: 'Time', v: ui.fmt.duration(a.durationSec) });
      return { headK: 'Total volume', headV: ui.fmt.volume(vol), sub: out };
    }
    if (a.distanceKm) {
      out.push({ k: 'Distance', v: ui.fmt.distance(a.distanceKm) });
      out.push({ k: 'Time', v: ui.fmt.duration(a.durationSec) });
      if (a.durationSec && a.distanceKm) { const pace = (a.durationSec / 60) / a.distanceKm; out.push({ k: 'Pace', v: ui.fmt.num(pace, 1) + '/' + ui.fmt.distUnit() }); }
      return { headK: 'Distance', headV: ui.fmt.distance(a.distanceKm, false), headUnit: ui.fmt.distUnit(), sub: out };
    }
    out.push({ k: 'Time', v: ui.fmt.duration(a.durationSec) });
    if (a.calories) out.push({ k: 'Calories', v: ui.fmt.num(a.calories) });
    return { headK: 'Duration', headV: ui.fmt.duration(a.durationSec), sub: out };
  }

  // brand faces for the canvas card — match the app's type system
  const DISP = '"Space Grotesk", system-ui, sans-serif';   // wordmark + numerals
  const BODY = '"Plus Jakarta Sans", system-ui, sans-serif'; // titles + names

  async function renderCard(activity, profile) {
    // make sure the brand fonts are loaded before we paint, else canvas falls back
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
    const W = 1080, H = 1350, S = 2; // S = supersample-ish (we draw at full res already)
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const meta = store.ACT[activity.type] || store.ACT.cardio;

    // background gradient
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#ff9e2c'); g.addColorStop(0.5, '#ff6a13'); g.addColorStop(1, '#ff3d54');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // optional activity photo as faded backdrop
    const photo = await loadImg(activity.photo);
    if (photo) {
      ctx.save(); ctx.globalAlpha = 0.32;
      const scale = Math.max(W / photo.width, H / photo.height);
      const pw = photo.width * scale, ph = photo.height * scale;
      ctx.drawImage(photo, (W - pw) / 2, (H - ph) / 2, pw, ph);
      ctx.restore();
      const ov = ctx.createLinearGradient(0, 0, 0, H);
      ov.addColorStop(0, 'rgba(255,106,19,0.55)'); ov.addColorStop(1, 'rgba(255,61,84,0.8)');
      ctx.fillStyle = ov; ctx.fillRect(0, 0, W, H);
    }
    // soft highlight
    const hi = ctx.createRadialGradient(W * 0.85, -100, 50, W * 0.85, -100, 700);
    hi.addColorStop(0, 'rgba(255,255,255,0.35)'); hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi; ctx.fillRect(0, 0, W, H);

    ctx.textBaseline = 'alphabetic';
    // brand wordmark (wide tracking, like the in-app lockup)
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '600 44px ' + DISP;
    try { ctx.letterSpacing = '7px'; } catch (e) {}
    ctx.fillText('EMBER', 80, 130);
    try { ctx.letterSpacing = '0px'; } catch (e) {}
    ctx.font = '500 28px ' + DISP; ctx.fillStyle = 'rgba(255,255,255,0.7)';
    try { ctx.letterSpacing = '2px'; } catch (e) {}
    ctx.fillText(meta.label.toUpperCase(), 80, 175);
    try { ctx.letterSpacing = '0px'; } catch (e) {}

    // glass panel
    ctx.save();
    rr(ctx, 80, 250, W - 160, 760, 48);
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
    ctx.restore();

    const m = metricsFor(activity);
    // headline metric
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '500 30px ' + DISP;
    ctx.fillText((m.headK || '').toUpperCase(), 130, 360);
    ctx.fillStyle = '#fff'; ctx.font = '700 170px ' + DISP;
    let hv = String(m.headV);
    ctx.fillText(hv, 124, 520);
    if (m.headUnit) { const wv = ctx.measureText(hv).width; ctx.font = '600 56px ' + DISP; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(m.headUnit, 124 + wv + 18, 520); }

    // title + date
    ctx.fillStyle = '#fff'; ctx.font = '700 52px ' + BODY;
    ctx.fillText(truncate(ctx, activity.title || meta.label, W - 320), 130, 610);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '500 30px ' + BODY;
    ctx.fillText(ui.fmt.dayLabel(activity.date), 130, 658);

    // divider
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(130, 720); ctx.lineTo(W - 130, 720); ctx.stroke();

    // sub stats row
    const sub = m.sub.slice(0, 3); const colW = (W - 260) / sub.length;
    sub.forEach((st, i) => {
      const x = 130 + colW * i;
      ctx.fillStyle = '#fff'; ctx.font = '700 56px ' + DISP;
      ctx.fillText(String(st.v), x, 810);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '500 26px ' + DISP;
      ctx.fillText(st.k.toUpperCase(), x, 850);
    });

    // PR badge
    if (activity.prs && activity.prs.length) {
      rr(ctx, 130, 890, 360, 70, 35); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
      ctx.fillStyle = '#ff5a00'; ctx.font = '700 32px ' + DISP;
      ctx.fillText('★ ' + activity.prs.length + ' NEW PR' + (activity.prs.length > 1 ? 'S' : ''), 160, 935);
    }

    // profile footer
    const p = profile || store.profile(activity.profileId) || {};
    const av = await loadImg(p.avatar);
    const ax = 130, ay = 1050, ar = 44;
    ctx.save(); ctx.beginPath(); ctx.arc(ax + ar, ay + ar, ar, 0, 7); ctx.closePath(); ctx.clip();
    if (av) { ctx.drawImage(av, ax, ay, ar * 2, ar * 2); }
    else { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(ax, ay, ar * 2, ar * 2); ctx.fillStyle = '#fff'; ctx.font = '700 40px ' + DISP; ctx.textAlign = 'center'; ctx.fillText(store.initials(p.name), ax + ar, ay + ar + 14); ctx.textAlign = 'left'; }
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = '700 40px ' + BODY;
    ctx.fillText(p.name || 'Athlete', ax + ar * 2 + 28, ay + 44);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '500 28px ' + BODY;
    ctx.fillText(p.handle || '', ax + ar * 2 + 28, ay + 82);

    // tagline
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '600 26px ' + BODY;
    ctx.fillText('Train. Track. Burn.', 80, 1280);

    return cv;
  }

  function truncate(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text; while (t.length > 4 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  function canvasToBlob(cv) { return new Promise(res => cv.toBlob(res, 'image/png', 0.95)); }

  async function shareActivity(activity, profile) {
    ui.toast('Building share card…');
    try {
      const cv = await renderCard(activity, profile);
      const blob = await canvasToBlob(cv);
      const file = new File([blob], 'ember-' + activity.date + '.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Ember', text: (activity.title || 'My workout') + ' · Ember' });
      } else {
        downloadBlob(blob, file.name);
        ui.toast('Saved card to downloads', { type: 'good', icon: 'download' });
      }
    } catch (e) { if (e.name !== 'AbortError') ui.toast('Share failed', { type: 'flame' }); }
  }

  // returns dataURL preview (for in-app preview before share)
  async function previewActivity(activity, profile) { const cv = await renderCard(activity, profile); return cv.toDataURL('image/png'); }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadText(text, name, type) {
    downloadBlob(new Blob([text], { type: type || 'application/json' }), name);
  }

  /* Share a data file (e.g. the full training export) via the OS share sheet —
     on a phone this surfaces WhatsApp, Files, etc.; on desktop (no file-share
     support) it falls back to a plain download. Returns how it was handled. */
  async function shareData(text, name, type) {
    type = type || 'application/json';
    const blob = new Blob([text], { type });
    const file = new File([blob], name, { type });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Ember training data',
          text: 'My Ember training export — open with Ember or hand it to Claude.'
        });
        return { shared: true };
      }
    } catch (e) {
      if (e.name === 'AbortError') return { cancelled: true };
      /* any other share failure → fall through to download */
    }
    downloadBlob(blob, name);
    return { downloaded: true };
  }

  App.share = { renderCard, shareActivity, previewActivity, shareData, downloadText, downloadBlob };
})(window.App);
