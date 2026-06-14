/* ============================================================
   EMBER · Icons — inline SVG set (no emoji, per design taste).
   Feather-style line icons, 24x24, stroke=currentColor.
   Usage:  App.icon('flame')           -> <svg> string
           App.icon('flame', 18)       -> sized
           App.iconEl('flame', 18)     -> DOM element
   ============================================================ */
window.App = window.App || {};
(function (App) {
  // raw inner markup per icon (paths use currentColor via stroke/fill on wrapper)
  const P = {
    home:      '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>',
    feed:      '<path d="M3 12h4l2 6 4-14 2 8h6"/>',          // activity pulse
    trophy:    '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M9 14h6"/><path d="M12 14v3"/><path d="M8 20h8"/><path d="M10 17h4v3h-4z"/>',
    chart:     '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M21 20H3"/>',
    user:      '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6"/>',
    users:     '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/><path d="M16 5.2A3 3 0 0 1 16 11"/><path d="M17 15c2.4.4 4 2.2 4 5"/>',
    plus:      '<path d="M12 5v14M5 12h14"/>',
    minus:     '<path d="M5 12h14"/>',
    plusCircle:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    flame:     '<path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 .3C16 8 13 6 12 3z" fill="currentColor" stroke="none"/><path d="M7 14a5 5 0 0 0 10 0c0-3-2-4-2.5-6 .2 2.5-2 3-2 5a2.2 2.2 0 0 1-4.3.6C7.2 12 7 13 7 14z" fill="currentColor" stroke="none" opacity=".55"/>',
    flameLine: '<path d="M12 3c1.5 3.5-2.5 4.5-2.5 8A4.5 4.5 0 0 0 16.5 14c0-4-3-5-4.5-11z"/><path d="M11 21h2"/>',
    settings:  '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.8-1.4-2-3.4-2.1.9a7.6 7.6 0 0 0-2.6-1.5L14 2h-4l-.5 2.6a7.6 7.6 0 0 0-2.6 1.5l-2.1-.9-2 3.4 1.8 1.4a7.6 7.6 0 0 0 0 3l-1.8 1.4 2 3.4 2.1-.9a7.6 7.6 0 0 0 2.6 1.5L10 22h4l.5-2.6a7.6 7.6 0 0 0 2.6-1.5l2.1.9 2-3.4z"/>',
    camera:    '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.4"/>',
    check:     '<path d="M5 12.5 10 17.5 19.5 7"/>',
    checkCircle:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5 11 15.5 16 9.5"/>',
    dumbbell:  '<path d="M4 9v6M7 7v10M17 7v10M20 9v6"/><path d="M7 12h10"/>',
    walk:      '<circle cx="13" cy="4.5" r="1.6"/><path d="M11 9l-2 4 2 1 1 5"/><path d="M13 8l3 2 2-1"/><path d="M11 13l-2 6"/>',
    run:       '<circle cx="14" cy="4.5" r="1.6"/><path d="M9 11l4-2 3 3 3 1"/><path d="M13 9l-1 5 3 3 1 4"/><path d="M12 14l-4 1-2 4"/>',
    heart:     '<path d="M12 20s-7-4.4-9.2-8.5C1 8 3 4.8 6.3 4.8c2 0 3.2 1.2 3.7 2 .5-.8 1.7-2 3.7-2C17 4.8 19 8 17.2 11.5 15 15.6 12 20 12 20z"/>',
    heartFill: '<path d="M12 20s-7-4.4-9.2-8.5C1 8 3 4.8 6.3 4.8c2 0 3.2 1.2 3.7 2 .5-.8 1.7-2 3.7-2C17 4.8 19 8 17.2 11.5 15 15.6 12 20 12 20z" fill="currentColor" stroke="none"/>',
    timer:     '<circle cx="12" cy="13" r="8"/><path d="M12 13V8.5"/><path d="M9 2h6"/><path d="M19 6l1.5-1.5"/>',
    clock:     '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    share:     '<circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8.1 11 15.9 7.1M8.1 13l7.8 3.9"/>',
    scale:     '<path d="M5 7h14l-2 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"/><path d="M9 7a3 3 0 0 1 6 0"/><path d="M12 11v5"/>',
    calendar:  '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    medal:     '<circle cx="12" cy="14" r="6"/><path d="M12 11v3l2 1"/><path d="M9 8 6 2h5l1.5 3M15 8l3-6h-5l-1.5 3"/>',
    lock:      '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    chevR:     '<path d="M9 5l7 7-7 7"/>',
    chevL:     '<path d="M15 5l-7 7 7 7"/>',
    chevD:     '<path d="M5 9l7 7 7-7"/>',
    chevU:     '<path d="M5 15l7-7 7 7"/>',
    x:         '<path d="M6 6l12 12M18 6 6 18"/>',
    edit:      '<path d="M5 19h3l9-9-3-3-9 9z"/><path d="M14 7l3 3"/>',
    trash:     '<path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13"/>',
    target:    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
    zap:       '<path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor" stroke="none"/>',
    zapLine:   '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    arrowU:    '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowD:    '<path d="M12 5v14M6 13l6 6 6-6"/>',
    play:      '<path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none"/>',
    pause:     '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
    stop:      '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
    route:     '<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M8 17h6a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h2"/>',
    pin:       '<path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    trend:     '<path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v5h-5"/>',
    bell:      '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    download:  '<path d="M12 4v11M7 11l5 5 5-5"/><path d="M5 20h14"/>',
    upload:    '<path d="M12 20V9M7 13l5-5 5 5"/><path d="M5 4h14"/>',
    sync:      '<path d="M20 11a8 8 0 0 0-14-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 16"/><path d="M20 20v-4h-4"/>',
    info:      '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    star:      '<path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 17l-5.3 2.6 1.1-6L3.4 9.4l6-.8z"/>',
    starFill:  '<path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 17l-5.3 2.6 1.1-6L3.4 9.4l6-.8z" fill="currentColor" stroke="none"/>',
    moon:      '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
    sun:       '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
    more:      '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    ruler:     '<rect x="3" y="8" width="18" height="8" rx="1.5" transform="rotate(-45 12 12)"/><path d="M8 8l1.5 1.5M11 11l1.5 1.5M14 6l1.5 1.5"/>',
    fork:      '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 10v11"/><path d="M16 3c-1.5 0-2 1.5-2 4s.5 4 2 4v10"/>',  // utensils (nutrition)
    bolt:      '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    crown:     '<path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 10h-13z"/>',
    add:       '<path d="M12 5v14M5 12h14"/>'
  };

  function svg(name, size, extra) {
    const inner = P[name] || P.info;
    const s = size || 24;
    return `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" `
      + `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" `
      + `${extra || ''}>${inner}</svg>`;
  }
  App.icon = svg;
  App.iconEl = function (name, size, extra) {
    const tpl = document.createElement('template');
    tpl.innerHTML = svg(name, size, extra).trim();
    return tpl.content.firstChild;
  };
  App.hasIcon = (name) => !!P[name];
})(window.App);
