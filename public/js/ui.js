/* ============================================================
   EMBER · UI — DOM builder, sheets, toasts, formatters, FX.
   Views build their markup with el()/h() and these helpers.
   ============================================================ */
window.App = window.App || {};
(function (App) {
  'use strict';
  const store = App.store;

  /* ---------------- DOM builder ---------------- */
  // el('div', {class, id, html, text, style:{}, on:{click:fn}, ...attrs}, children)
  function el(tag, props, children) {
    const node = document.createElement(tag);
    props = props || {};
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'on' && typeof v === 'object') for (const ev in v) node.addEventListener(ev, v[ev]);
      else if (k === 'dataset' && typeof v === 'object') for (const d in v) node.dataset[d] = v[d];
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, v);
    }
    appendChildren(node, children);
    return node;
  }
  function appendChildren(node, children) {
    if (children == null) return;
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
  }
  // parse an HTML string to a single element (or fragment if multiple)
  function h(htmlStr) {
    const t = document.createElement('template');
    t.innerHTML = String(htmlStr).trim();
    return t.content.childNodes.length === 1 ? t.content.firstChild : t.content;
  }
  function frag() { const f = document.createDocumentFragment(); for (let i = 0; i < arguments.length; i++) appendChildren(f, arguments[i]); return f; }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  function mount(container) { clear(container); for (let i = 1; i < arguments.length; i++) appendChildren(container, arguments[i]); return container; }
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  /* ---------------- formatters (unit-aware) ---------------- */
  const fmt = {
    num(n, d) { const v = (+n || 0).toFixed(d || 0); return v.replace(/\B(?=(\d{3})+(?!\d))/g, ','); },
    weight(kg, withUnit) {
      const imp = store.settings().units === 'imperial';
      const v = imp ? (kg * 2.20462) : kg;
      const s = fmt.num(v, v % 1 === 0 ? 0 : 1);
      return withUnit === false ? s : s + (imp ? ' lb' : ' kg');
    },
    rawWeightUnit() { return store.settings().units === 'imperial' ? 'lb' : 'kg'; },
    distance(km, withUnit) {
      const imp = store.settings().units === 'imperial';
      const v = imp ? km * 0.621371 : km;
      const s = fmt.num(v, v >= 100 ? 0 : 1);
      return withUnit === false ? s : s + (imp ? ' mi' : ' km');
    },
    distUnit() { return store.settings().units === 'imperial' ? 'mi' : 'km'; },
    duration(sec) {
      sec = Math.max(0, Math.round(sec || 0));
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
      return `${m}:${String(s).padStart(2, '0')}`;
    },
    clock(sec) { sec = Math.max(0, Math.round(sec || 0)); const m = Math.floor(sec / 60), s = sec % 60; return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; },
    volume(kg) { const t = kg / 1000; return t >= 1 ? fmt.num(t, t >= 10 ? 0 : 1) + 't' : fmt.num(kg) + 'kg'; },
    relative(ts) {
      const diff = Date.now() - ts;
      const m = Math.floor(diff / 60000), hr = Math.floor(m / 60), d = Math.floor(hr / 24);
      if (m < 1) return 'just now';
      if (m < 60) return m + 'm ago';
      if (hr < 24) return hr + 'h ago';
      if (d < 7) return d + 'd ago';
      return store.D.fmt(store.D.key(new Date(ts)), { day: 'numeric', month: 'short' });
    },
    dayLabel(dk) {
      const today = store.today();
      if (dk === today) return 'Today';
      if (dk === store.D.key(store.D.add(new Date(), -1))) return 'Yesterday';
      return store.D.fmt(dk, { weekday: 'long', day: 'numeric', month: 'short' });
    }
  };

  /* ---------------- avatar ---------------- */
  function avatar(profile, size) {
    const cls = 'avatar' + (size === 'sm' ? ' sm' : size === 'lg' ? ' lg' : '');
    const p = profile || {};
    const node = el('div', { class: cls, style: p.avatar
      ? { backgroundImage: `url('${p.avatar}')` }
      : { background: `linear-gradient(135deg, ${p.color || '#ff8a1e'}, ${shade(p.color || '#ff6a13', -18)})` } });
    if (!p.avatar) node.textContent = store.initials(p.name);
    return node;
  }
  function shade(hex, pct) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + pct, g = ((n >> 8) & 255) + pct, b = (n & 255) + pct;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
  }

  /* ---------------- segmented control ---------------- */
  // options: [{value,label}], onChange(value). Returns element; slides thumb.
  function segmented(options, active, onChange) {
    const wrap = el('div', { class: 'seg' });
    const thumb = el('div', { class: 'thumb' });
    wrap.appendChild(thumb);
    const btns = options.map(o => {
      const b = el('button', { class: o.value === active ? 'active' : '', text: o.label });
      b.addEventListener('click', () => {
        if (o.value === active) return;
        active = o.value;
        wrap.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active'); positionThumb(); haptic(8);
        onChange && onChange(o.value);
      });
      wrap.appendChild(b); return b;
    });
    function positionThumb() {
      const i = options.findIndex(o => o.value === active);
      const b = btns[i]; if (!b) return;
      thumb.style.width = b.offsetWidth + 'px';
      thumb.style.transform = `translateX(${b.offsetLeft - 4}px)`;
    }
    requestAnimationFrame(positionThumb);
    setTimeout(positionThumb, 60);
    wrap._reflow = positionThumb;
    return wrap;
  }

  /* ---------------- sheets / modals ---------------- */
  let sheetRoot;
  const sheetStack = [];
  function ensureRoots() {
    if (!sheetRoot) { sheetRoot = el('div', { id: 'sheet-root' }); document.body.appendChild(sheetRoot); }
  }
  // openSheet({title, hint, content (node|html|fn(api)), actions:[{label,class,onClick,close}], center, onClose})
  function openSheet(opts) {
    ensureRoots(); opts = opts || {};
    const scrim = el('div', { class: 'scrim' + (opts.center ? ' center' : '') });
    const sheet = el('div', { class: 'sheet' });
    const api = { close, scrim, sheet };

    if (!opts.center) sheet.appendChild(el('div', { class: 'grip' }));
    if (opts.title) sheet.appendChild(el('h3', { text: opts.title }));
    if (opts.hint) sheet.appendChild(el('div', { class: 'hint', text: opts.hint }));

    const bodyWrap = el('div', { class: 'sheet-body' });
    let content = typeof opts.content === 'function' ? opts.content(api) : opts.content;
    if (typeof content === 'string') content = h(content);
    if (content) bodyWrap.appendChild(content);
    sheet.appendChild(bodyWrap);

    if (opts.actions && opts.actions.length) {
      const acts = el('div', { class: 'acts' });
      opts.actions.forEach(a => {
        const b = el('button', { class: 'btn ' + (a.class || 'ghost'), html: a.icon ? App.icon(a.icon, 18) + (a.label ? '<span>' + a.label + '</span>' : '') : null, text: a.icon ? null : a.label });
        b.addEventListener('click', () => { const r = a.onClick && a.onClick(api); if (a.close !== false && r !== false) close(); });
        acts.appendChild(b);
      });
      sheet.appendChild(acts);
    }

    scrim.appendChild(sheet);
    scrim.addEventListener('click', e => { if (e.target === scrim && opts.dismissible !== false) close(); });
    sheetRoot.appendChild(scrim);
    sheetStack.push(api);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => { scrim.classList.add('on'); if (wrap = sheet.querySelector('.seg')) wrap._reflow && wrap._reflow(); });
    let wrap;
    // autofocus first input
    setTimeout(() => { const inp = sheet.querySelector('input,textarea'); if (inp && opts.autofocus !== false) inp.focus(); }, 220);

    function close() {
      scrim.classList.remove('on');
      const i = sheetStack.indexOf(api); if (i >= 0) sheetStack.splice(i, 1);
      if (!sheetStack.length) document.body.style.overflow = '';
      setTimeout(() => { scrim.remove(); opts.onClose && opts.onClose(); }, 300);
    }
    return api;
  }
  function closeAllSheets() { sheetStack.slice().forEach(a => a.close()); }

  function confirm(opts) {
    return new Promise(resolve => {
      let done = false;
      openSheet({
        center: true, title: opts.title, hint: opts.message,
        actions: [
          { label: opts.cancelText || 'Cancel', class: 'ghost', onClick: () => { done = true; resolve(false); } },
          { label: opts.confirmText || 'Confirm', class: opts.danger ? 'danger' : 'flame', onClick: () => { done = true; resolve(true); } }
        ],
        onClose: () => { if (!done) resolve(false); }
      });
    });
  }

  /* ---------------- toast ---------------- */
  let toastHost;
  function toast(msg, opts) {
    opts = opts || {};
    if (!toastHost) { toastHost = el('div', { class: 'toast-host' }); document.body.appendChild(toastHost); }
    const t = el('div', { class: 'toast ' + (opts.type || ''), html: (opts.icon ? App.icon(opts.icon, 18) : '') + '<span>' + msg + '</span>' });
    toastHost.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, opts.duration || 2200);
  }

  /* ---------------- haptics ---------------- */
  function haptic(pattern) { if (navigator.vibrate) try { navigator.vibrate(pattern || 12); } catch (e) {} }

  /* ---------------- count-up ---------------- */
  function countUp(node, to, opts) {
    opts = opts || {}; const dur = opts.dur || 750; const dec = opts.decimals || 0;
    const from = opts.from != null ? opts.from : 0; const t0 = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      const val = from + (to - from) * ease(p);
      node.textContent = (opts.prefix || '') + fmt.num(val, dec) + (opts.suffix || '');
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------------- celebration burst ---------------- */
  function burst(colors) {
    colors = colors || ['#ff6a13', '#ff9e2c', '#ffc14d', '#ff4d5e', '#1bbf74'];
    const b = el('div', { class: 'burst' });
    for (let i = 0; i < 48; i++) {
      const ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 220;
      const piece = el('i', { style: {
        background: colors[i % colors.length],
        '--dx': Math.cos(ang) * dist + 'px',
        '--dy': (Math.sin(ang) * dist - 80) + 'px',
        '--dr': (Math.random() * 720 - 360) + 'deg',
        animationDelay: (Math.random() * 0.1) + 's'
      } });
      b.appendChild(piece);
    }
    document.body.appendChild(b);
    haptic([20, 40, 20]);
    setTimeout(() => b.remove(), 1400);
  }

  /* ---------------- image resize (photos) ---------------- */
  function resizeImage(file, max, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          max = max || 900; const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale), hh = Math.round(img.height * scale);
          const c = document.createElement('canvas'); c.width = w; c.height = hh;
          c.getContext('2d').drawImage(img, 0, 0, w, hh);
          resolve(c.toDataURL('image/jpeg', quality || 0.72));
        };
        img.onerror = reject; img.src = e.target.result;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }

  /* ---------------- small builders ---------------- */
  function pageTitle(title, sub) {
    return el('div', { class: 'page-title' }, [
      el('h1', { text: title }),
      sub ? el('div', { class: 'sub', text: sub }) : null
    ]);
  }
  function empty(icon, title, sub) {
    return el('div', { class: 'empty' }, [ h(App.icon(icon || 'info', 40)), el('div', { class: 't', text: title }), sub ? el('div', { class: 's', text: sub }) : null ]);
  }
  function medal(def, earned) {
    const m = el('div', { class: 'medal' + (earned ? '' : ' locked'), html: App.icon(earned ? def.icon : 'lock', 26) });
    return m;
  }

  App.ui = {
    el, h, frag, clear, mount, $, $$, fmt, avatar, shade, segmented,
    openSheet, closeAllSheets, confirm, toast, haptic, countUp, burst, resizeImage,
    pageTitle, empty, medal, icon: App.icon, iconEl: App.iconEl
  };
})(window.App);
