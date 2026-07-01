/* ============================================================
   EMBER · Charts — dependency-free animated SVG/CSS charts.
   ring · line · bars · heatmap · sparkline. All return elements.
   ============================================================ */
window.App = window.App || {};
(function (App) {
  'use strict';
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) { const n = document.createElementNS(SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; }
  const el = (t, p, c) => App.ui.el(t, p, c);
  const raf = (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); }).bind(window);
  const reduceMotion = () => { try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  /* Catmull-Rom → cubic Bézier: a smooth, premium curve through the points.
     tension ~0.85 keeps it lively without overshooting spiky data. */
  function smoothPath(pts, tension) {
    if (!pts.length) return '';
    if (pts.length < 3) return 'M ' + pts.map(p => p.x + ' ' + p.y).join(' L ');
    tension = tension == null ? 0.85 : tension;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6 * tension, c1y = p1.y + (p2.y - p0.y) / 6 * tension;
      const c2x = p2.x - (p3.x - p1.x) / 6 * tension, c2y = p2.y - (p3.y - p1.y) / 6 * tension;
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
  }
  const chordLen = pts => pts.reduce((s, p, i) => i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0, 0);

  /* Draw an SVG <path> like a pen stroke. Hides it synchronously (no flash),
     then measures the true length and transitions the dash offset to 0. */
  function animateDraw(path, fallbackLen, dur) {
    dur = dur || 1.05;
    if (reduceMotion()) return;
    path.style.opacity = '0';
    raf(function () {
      let L = fallbackLen || 1000;
      try { if (path.getTotalLength) { const g = path.getTotalLength(); if (g > 1) L = g; } } catch (e) {}
      path.style.strokeDasharray = L;
      path.style.strokeDashoffset = L;
      path.style.opacity = '1';
      if (path.getBoundingClientRect) path.getBoundingClientRect(); // reflow so the transition takes
      path.style.transition = 'stroke-dashoffset ' + dur + 's var(--e-out)';
      raf(function () { path.style.strokeDashoffset = '0'; });
    });
  }

  /* ---- progress ring ---- */
  // ring(pct, {size, stroke, color, track, gradient, centerTop, centerBig, centerSub})
  function ring(pct, opts) {
    opts = opts || {}; const size = opts.size || 120; const sw = opts.stroke || 11;
    pct = Math.max(0, Math.min(100, pct));
    const r = (size - sw) / 2; const c = 2 * Math.PI * r; const cx = size / 2;
    const wrap = el('div', { class: 'chart-ring', style: { position: 'relative', width: size + 'px', height: size + 'px' } });
    const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size });
    const gid = 'rg' + Math.round(pct * 1000) + size;
    if (opts.gradient !== false) {
      const defs = svgEl('defs');
      const grad = svgEl('linearGradient', { id: gid, x1: '0', y1: '0', x2: '1', y2: '1' });
      grad.appendChild(svgEl('stop', { offset: '0', 'stop-color': '#ff9e2c' }));
      grad.appendChild(svgEl('stop', { offset: '1', 'stop-color': opts.color || '#ff4d5e' }));
      defs.appendChild(grad); svg.appendChild(defs);
    }
    svg.appendChild(svgEl('circle', { cx, cy: cx, r, fill: 'none', stroke: opts.track || 'rgba(28,22,15,0.08)', 'stroke-width': sw }));
    const fg = svgEl('circle', { cx, cy: cx, r, fill: 'none',
      stroke: opts.gradient !== false ? `url(#${gid})` : (opts.color || '#ff6a13'),
      'stroke-width': sw, 'stroke-linecap': 'round',
      'stroke-dasharray': c, 'stroke-dashoffset': c * (1 - pct / 100),
      transform: `rotate(-90 ${cx} ${cx})` });
    fg.style.setProperty('--len', c);
    fg.classList.add('ring-draw');
    svg.appendChild(fg);
    wrap.appendChild(svg);
    if (opts.centerBig != null || opts.centerSub || opts.centerTop) {
      const ctr = el('div', { class: 'ring-center', style: { position: 'absolute', inset: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' } }, [
        opts.centerTop ? el('div', { class: 'label', style: { marginBottom: '2px' }, text: opts.centerTop }) : null,
        opts.centerBig != null ? el('div', { style: { fontSize: (size > 110 ? 28 : 20) + 'px', fontWeight: '700', letterSpacing: '-0.03em' }, class: 'tnum', text: opts.centerBig }) : null,
        opts.centerSub ? el('div', { class: 'muted t-sm', text: opts.centerSub }) : null
      ]);
      wrap.appendChild(ctr);
    }
    return wrap;
  }

  /* ---- line chart ---- */
  // line(series, {height, color, area, dots, labels, valueFmt, goal, grid})
  // series: [{value, label}] or [number]
  function line(series, opts) {
    opts = opts || {};
    const data = series.map((d) => typeof d === 'number' ? { value: d, label: '' } : d);
    const W = 320, H = opts.height || 140, padX = 10, padY = 16;
    const wrap = el('div', { class: 'chart-line' });
    if (!data.length) return wrap;
    const vals = data.map(d => d.value);
    let min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (opts.goal != null) { min = Math.min(min, opts.goal); max = Math.max(max, opts.goal); }
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.18; min -= pad; max += pad;
    const x = i => padX + (data.length === 1 ? (W - 2 * padX) / 2 : i * (W - 2 * padX) / (data.length - 1));
    const y = v => H - padY - (v - min) / (max - min) * (H - 2 * padY);
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, preserveAspectRatio: 'none', style: 'overflow:visible' });
    const color = opts.color || '#ff6a13';
    const uid = Math.round(Math.random() * 1e6);
    const gradId = 'lg' + uid, clipId = 'lc' + uid, glowId = 'lf' + uid;

    const defs = svgEl('defs');
    const grad = svgEl('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.appendChild(svgEl('stop', { offset: '0', 'stop-color': color, 'stop-opacity': '0.30' }));
    grad.appendChild(svgEl('stop', { offset: '0.7', 'stop-color': color, 'stop-opacity': '0.07' }));
    grad.appendChild(svgEl('stop', { offset: '1', 'stop-color': color, 'stop-opacity': '0' }));
    defs.appendChild(grad);
    // soft glow under the stroke for depth
    const filter = svgEl('filter', { id: glowId, x: '-20%', y: '-50%', width: '140%', height: '200%' });
    filter.appendChild(svgEl('feDropShadow', { dx: '0', dy: '2.5', stdDeviation: '3.5', 'flood-color': color, 'flood-opacity': '0.30' }));
    defs.appendChild(filter);
    // left→right reveal mask shared by the area (and synced to the stroke draw)
    const clip = svgEl('clipPath', { id: clipId });
    const wipe = svgEl('rect', { x: '0', y: '-12', width: W, height: H + 24 });
    wipe.classList.add('chart-wipe');
    clip.appendChild(wipe); defs.appendChild(clip);
    svg.appendChild(defs);

    // faint horizontal gridlines for structure (no longer floating)
    if (opts.grid !== false) {
      [0.25, 0.5, 0.75].forEach(f => {
        const gy = padY + f * (H - 2 * padY);
        svg.appendChild(svgEl('line', { x1: padX, x2: W - padX, y1: gy, y2: gy, stroke: 'var(--line)', 'stroke-width': 1 }));
      });
    }
    // goal line
    if (opts.goal != null) {
      svg.appendChild(svgEl('line', { x1: padX, x2: W - padX, y1: y(opts.goal), y2: y(opts.goal), stroke: 'rgba(28,22,15,0.18)', 'stroke-width': 1, 'stroke-dasharray': '4 4' }));
    }

    const pts = data.map((pt, i) => ({ x: x(i), y: y(pt.value) }));
    const lineD = smoothPath(pts, 0.85);

    // area (revealed by the wipe clip)
    if (opts.area !== false && pts.length > 1) {
      const area = svgEl('path', {
        d: lineD + ` L ${pts[pts.length - 1].x} ${H - padY} L ${pts[0].x} ${H - padY} Z`,
        fill: `url(#${gradId})`, 'clip-path': `url(#${clipId})`
      });
      svg.appendChild(area);
    }
    // the stroke itself, drawn pen-style
    if (pts.length > 1) {
      const path = svgEl('path', { d: lineD, fill: 'none', stroke: color, 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: `url(#${glowId})` });
      svg.appendChild(path);
      animateDraw(path, chordLen(pts) * 1.05, 1.05);
    }
    // dots pop in as the stroke passes each one
    if (opts.dots !== false) {
      const n = data.length;
      data.forEach((pt, i) => {
        const isLast = i === n - 1;
        const frac = n > 1 ? i / (n - 1) : 0;
        if (isLast) {
          const halo = svgEl('circle', { cx: x(i), cy: y(pt.value), r: 5, fill: color });
          halo.classList.add('chart-pulse'); halo.style.animationDelay = '1.05s';
          svg.appendChild(halo);
        }
        const dot = svgEl('circle', { cx: x(i), cy: y(pt.value), r: isLast ? 4.5 : 3, fill: isLast ? color : '#fff', stroke: color, 'stroke-width': 2 });
        dot.classList.add('chart-dot'); dot.style.animationDelay = (0.15 + frac * 0.9) + 's';
        svg.appendChild(dot);
      });
    }
    wrap.appendChild(svg);
    if (opts.labels !== false) {
      const lab = el('div', { class: 'between', style: { marginTop: '8px' } });
      lab.appendChild(el('span', { class: 'dim t-xs', text: data[0].label || '' }));
      lab.appendChild(el('span', { class: 'dim t-xs', text: data[data.length - 1].label || '' }));
      wrap.appendChild(lab);
    }
    return wrap;
  }

  /* ---- bar chart ---- */
  // bars(data, {height, color, valueFmt, showValues}) data:[{label,value,highlight,sub}]
  function bars(data, opts) {
    opts = opts || {}; const H = opts.height || 130;
    const max = Math.max(1, Math.max.apply(null, data.map(d => d.value)));
    const wrap = el('div', { class: 'chart-bars', style: { display: 'flex', alignItems: 'flex-end', gap: '9px', height: H + 'px' } });
    data.forEach((d, i) => {
      const hpct = Math.round(d.value / max * 100);
      const col = el('div', { class: 'col', style: { flex: '1', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: '7px' } });
      if (opts.showValues !== false) col.appendChild(el('div', {
        class: 'tnum t-xs semi fade-in',
        style: { color: d.highlight ? 'var(--flame)' : 'var(--muted)', animationDelay: (i * 0.06 + 0.44) + 's' },
        text: d.value ? (opts.valueFmt ? opts.valueFmt(d.value) : d.value) : ''
      }));
      // ghost track so the column reads as a slot even when empty/short
      const track = el('div', { class: 'bar-track', style: { width: '100%', flex: '1', display: 'flex', alignItems: 'flex-end', borderRadius: '11px', background: 'var(--line)' } });
      const bar = el('div', { class: 'bar-grow', style: {
        width: '100%', height: Math.max(d.value ? 7 : 0, hpct) + '%', minHeight: d.value ? '7px' : '0',
        borderRadius: '11px 11px 5px 5px',
        background: d.highlight ? 'var(--grad-flame)' : 'linear-gradient(180deg, rgba(255,142,32,0.72), rgba(255,106,19,0.34))',
        boxShadow: d.highlight ? 'var(--sh-flame)' : '0 2px 9px rgba(255,106,19,0.13)',
        animationDelay: (i * 0.06) + 's'
      } });
      track.appendChild(bar); col.appendChild(track);
      col.appendChild(el('div', { class: 't-xs ' + (d.highlight ? 'flame semi' : 'dim'), text: d.label }));
      wrap.appendChild(col);
    });
    return wrap;
  }

  /* ---- contribution heatmap ---- */
  // heatmap(cells, {cols}) cells:[{date, level 0..4}]
  function heatmap(cells, opts) {
    opts = opts || {}; const cols = opts.cols || Math.ceil(cells.length / 7);
    const wrap = el('div', { class: 'chart-heatmap', style: {
      display: 'grid', gridTemplateRows: 'repeat(7,1fr)', gridAutoFlow: 'column', gridAutoColumns: '1fr',
      gap: '4px', width: '100%'
    } });
    const colorFor = lvl => ['rgba(28,22,15,0.06)', 'rgba(255,106,19,0.28)', 'rgba(255,106,19,0.5)', 'rgba(255,106,19,0.72)', 'var(--flame)'][lvl] || 'rgba(28,22,15,0.06)';
    cells.forEach((c, i) => {
      const cell = el('div', { class: 'fade-in', title: c.date, style: {
        aspectRatio: '1', borderRadius: '3px', background: colorFor(c.level), animationDelay: (i * 0.004) + 's'
      } });
      wrap.appendChild(cell);
    });
    return wrap;
  }

  /* ---- sparkline (inline mini line) ---- */
  function sparkline(values, opts) {
    opts = opts || {}; const W = opts.width || 80, H = opts.height || 28;
    if (!values.length) return el('span');
    const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    const rng = (max - min) || 1;
    const color = opts.color || '#ff6a13';
    const pts = values.map((v, i) => ({ x: values.length === 1 ? W / 2 : (i / (values.length - 1)) * W, y: H - ((v - min) / rng) * (H - 5) - 2.5 }));
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, style: 'overflow:visible' });
    const path = svgEl('path', { d: smoothPath(pts, 0.85), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    svg.appendChild(path);
    const last = pts[pts.length - 1];
    svg.appendChild(svgEl('circle', { cx: last.x, cy: last.y, r: 2.4, fill: color }));
    return svg;
  }

  App.charts = { ring, line, bars, heatmap, sparkline };
})(window.App);
