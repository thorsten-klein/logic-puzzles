// Shared parts of every page: a fullscreen button at the right end of
// the topbar (hidden where the browser has no fullscreen support), zoom
// buttons for the game board, and the author footer with the license link.

(() => {
  const ENTER = '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>';
  const EXIT = '<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/>';
  const doc = document;
  // The license sits next to the src folder this script comes from.
  const licenseUrl = new URL('../LICENSE', doc.currentScript.src).href;
  const current = () => doc.fullscreenElement || doc.webkitFullscreenElement;
  const supported = doc.fullscreenEnabled || doc.webkitFullscreenEnabled;

  function add() {
    const actions = doc.getElementById('topbar-actions');
    if (!actions || doc.getElementById('btn-topbar-fullscreen')) return;
    const btn = doc.createElement('button');
    btn.id = 'btn-topbar-fullscreen';
    btn.className = 'topbar-btn';
    btn.type = 'button';
    btn.hidden = !supported;
    const show = () => {
      const on = !!current();
      btn.title = on ? 'Leave fullscreen' : 'Fullscreen';
      btn.setAttribute('aria-label', btn.title);
      btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${on ? EXIT : ENTER}</svg>`;
    };
    btn.addEventListener('click', () => {
      const el = doc.documentElement;
      if (current()) (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    });
    doc.addEventListener('fullscreenchange', show);
    doc.addEventListener('webkitfullscreenchange', show);
    show();
    actions.appendChild(btn);
  }

  // GitHub mark (Octicons "mark-github").
  const GITHUB = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z';

  function addFooter() {
    if (doc.getElementById('site-footer')) return;
    const foot = doc.createElement('footer');
    foot.id = 'site-footer';
    foot.innerHTML =
      '<a href="https://buymeacoffee.com/thorsten.klein" target="_blank" rel="noopener">Created and designed by Thorsten Klein</a>' +
      '<a class="gh" href="https://github.com/thorsten-klein" target="_blank" rel="noopener" title="Thorsten Klein on GitHub" aria-label="GitHub profile">' +
      `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${GITHUB}"/></svg></a>` +
      `<span aria-hidden="true">·</span><a href="${licenseUrl}">MIT License</a>`;
    (doc.getElementById('app') || doc.body).appendChild(foot);
  }

  // Zoom buttons (magnifier − and +) in the bottom left corner of the game
  // screen. They scale the board; phones often can not pinch-zoom here.
  // By default the board's longer side is 60% of the smaller of the app
  // width and height (height without the top bar). The buttons step from
  // there. The board never grows wider than its space. The step is kept
  // per puzzle.
  const STEPS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.5, 3];
  const LENS = '<circle cx="10" cy="10" r="6.5"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="7" y1="10" x2="13" y2="10"/>';
  function addZoom() {
    const wrap = doc.getElementById('board-wrap');
    if (!wrap || doc.getElementById('zoom-box')) return;
    const key = 'zoomstep:' + location.pathname.split('/').slice(-2, -1)[0];
    let i = STEPS.indexOf(1);
    try { const z = Number(localStorage.getItem(key)); if (STEPS.includes(z)) i = STEPS.indexOf(z); } catch { /* no storage */ }
    const box = doc.createElement('div');
    box.id = 'zoom-box';
    const button = (id, title, plus) => {
      const b = doc.createElement('button');
      b.id = id;
      b.type = 'button';
      b.title = title;
      b.setAttribute('aria-label', title);
      b.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${LENS}${plus ? '<line x1="10" y1="7" x2="10" y2="13"/>' : ''}</svg>`;
      return b;
    };
    const out = button('btn-zoom-out', 'Smaller board', false);
    const inn = button('btn-zoom-in', 'Bigger board', true);
    // Board size without zoom, or null while it is not shown.
    const natural = () => {
      const board = wrap.firstElementChild;
      const now = Number(wrap.style.getPropertyValue('--board-zoom')) || 1;
      const r = board ? board.getBoundingClientRect() : null;
      return r && r.width && wrap.clientWidth ? { w: r.width / now, h: r.height / now } : null;
    };
    // Zoom at step 1: the longer side is 60% of the smaller app side.
    const base = (n) => {
      const bar = doc.getElementById('topbar');
      const room = Math.min(window.innerWidth, window.innerHeight - (bar ? bar.offsetHeight : 0));
      return (0.6 * room) / Math.max(n.w, n.h);
    };
    // Largest step at which the board still fits the width.
    const maxStep = (n) => {
      let j = 0;
      // 1px slack for sub-pixel sizes.
      while (j < STEPS.length - 1 && base(n) * STEPS[j + 1] * n.w <= wrap.clientWidth + 1) j++;
      return j;
    };
    const apply = (save) => {
      const n = natural();
      if (!n) return;
      const top = maxStep(n);
      if (i > top) i = top;  // shrink when it does not fit (new board, smaller window)
      // Never wider than the space, even at the first step.
      const z = Math.min(base(n) * STEPS[i], (wrap.clientWidth + 1) / n.w);
      wrap.style.setProperty('--board-zoom', z.toFixed(4));
      out.disabled = i === 0;
      inn.disabled = i >= top;
      if (save) try { if (STEPS[i] === 1) localStorage.removeItem(key); else localStorage.setItem(key, STEPS[i]); } catch { /* no storage */ }
    };
    out.addEventListener('click', () => { i = Math.max(0, i - 1); apply(true); });
    inn.addEventListener('click', () => { i += 1; apply(true); });
    box.append(out, inn);
    // Inside the game screen, so it hides with it.
    (doc.getElementById('game-screen') || wrap.parentElement).appendChild(box);
    new MutationObserver(() => apply(false)).observe(wrap, { childList: true });
    window.addEventListener('resize', () => apply(false));
    apply(false);
  }

  // Favourite games: a list of game slugs, the same on every page.
  const FAV_KEY = 'logic-puzzles:favourites';
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 3 14.8 8.9 21.2 9.6 16.4 14 17.8 20.4 12 17.1 6.2 20.4 7.6 14 2.8 9.6 9.2 8.9"/></svg>';
  const Favs = {
    list() { try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } },
    has(slug) { return Favs.list().includes(slug); },
    toggle(slug) {
      const now = Favs.list();
      const next = now.includes(slug) ? now.filter((x) => x !== slug) : [...now, slug];
      try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch { /* no storage */ }
      // Every star for this game shows the new state.
      for (const b of doc.querySelectorAll(`.fav-star[data-slug="${slug}"]`)) Favs.paint(b);
      doc.dispatchEvent(new CustomEvent('favs-change'));
    },
    paint(b) {
      const on = Favs.has(b.dataset.slug);
      b.setAttribute('aria-pressed', String(on));
      b.title = on ? 'Remove from favourites' : 'Add to favourites';
      b.setAttribute('aria-label', b.title);
    },
    // Star button HTML (for pages that build HTML strings).
    html(slug) {
      const on = Favs.has(slug);
      const t = on ? 'Remove from favourites' : 'Add to favourites';
      return `<button type="button" class="fav-star" data-slug="${slug}" aria-pressed="${on}" title="${t}" aria-label="${t}">${STAR}</button>`;
    },
    button(slug) {
      const tmp = doc.createElement('div');
      tmp.innerHTML = Favs.html(slug);
      const b = tmp.firstChild;
      b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); Favs.toggle(slug); });
      return b;
    },
  };
  window.Favs = Favs;

  // Games with at least one submitted puzzle (the shell adds them on Submit).
  const Played = {
    list() { try { const v = JSON.parse(localStorage.getItem('logic-puzzles:played') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } },
    has(slug) { return Played.list().includes(slug); },
  };
  window.Played = Played;

  // Game pages: a star next to the name in the top bar and on the setup screen.
  function addFavs() {
    const slug = location.pathname.split('/').slice(-2, -1)[0];
    const name = doc.getElementById('topbar-name');
    if (name && !name.querySelector('.fav-star')) name.appendChild(Favs.button(slug));
    const h1 = doc.querySelector('#menu-screen h1');
    if (h1 && !h1.querySelector('.fav-star')) h1.appendChild(Favs.button(slug));
  }

  const init = () => { add(); addZoom(); addFooter(); addFavs(); };
  // Loaded at the end of <body>, before the page is done.
  doc.addEventListener('DOMContentLoaded', init);
})();
