// Shirokuro. Join every white circle to one black circle with a straight
// line (across or down). Each circle has exactly one line. Lines never
// cross and never pass over another circle.
// p = { R, C, col } with col[k] = 0 empty, 1 white, 2 black.

(() => {
  // Candidate links: a white and a black circle that see each other.
  function prepare(p) {
    const { R, C, col } = p;
    p.links = [];
    for (let k = 0; k < R * C; k++) {
      if (!col[k]) continue;
      const r = Math.floor(k / C), c = k % C;
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const cells = [];
        let nr = r + dr, nc = c + dc;
        while (nr < R && nc < C && !col[nr * C + nc]) { cells.push(nr * C + nc); nr += dr; nc += dc; }
        if (nr < R && nc < C) {
          const j = nr * C + nc;
          if (col[j] !== col[k]) p.links.push({ a: k, b: j, cells, horiz: dr === 0 });
        }
      }
    }
    p.of = new Map();
    p.links.forEach((l, i) => {
      for (const x of [l.a, l.b]) { if (!p.of.has(x)) p.of.set(x, []); p.of.get(x).push(i); }
    });
    p.clash = p.links.map((l, i) => p.links.map((o, j) => j).filter((j) => j !== i && p.links[j].cells.some((x) => l.cells.includes(x))));
    return p;
  }

  // st[i]: 0 open, 1 used, 2 not used. Forced moves; false if broken.
  function settle(p, st, log) {
    for (let changed = true; changed;) {
      changed = false;
      for (const [k, ls] of p.of) {
        const used = ls.filter((i) => st[i] === 1), open = ls.filter((i) => st[i] === 0);
        if (used.length > 1 || (!used.length && !open.length)) return false;
        if (used.length === 1 && open.length) {
          for (const i of open) st[i] = 2;
          changed = true;
          if (log) { log.push({ links: open, v: 2, reason: 'This circle already has its line.' }); return true; }
        } else if (!used.length && open.length === 1) {
          st[open[0]] = 1;
          changed = true;
          if (log) { log.push({ links: open, v: 1, reason: 'This circle can only be joined one way.' }); return true; }
        }
      }
      for (let i = 0; i < p.links.length; i++) {
        if (st[i] !== 1) continue;
        for (const j of p.clash[i]) {
          if (st[j] === 1) return false;
          if (st[j] === 0) {
            st[j] = 2;
            changed = true;
            if (log) { log.push({ links: [j], v: 2, reason: 'Lines never cross. Another line already runs here.' }); return true; }
          }
        }
      }
    }
    // Circles with no possible link at all.
    for (let k = 0; k < p.R * p.C; k++) if (p.col[k] && !p.of.has(k)) return false;
    return true;
  }

  function solve(p, stopAt = 2) {
    const out = [];
    let nodes = 0;
    (function rec(st) {
      if (out.length >= stopAt || ++nodes > 50000) return;
      if (!settle(p, st)) return;
      const i = st.indexOf(0);
      if (i < 0) { out.push(Uint8Array.from(st, (v) => (v === 1 ? 1 : 0))); return; }
      for (const v of [1, 2]) { const t = Uint8Array.from(st); t[i] = v; rec(t); }
    })(new Uint8Array(p.links.length));
    return out;
  }

  function generate(n) {
    const R = n, C = n, N = R * C;
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const col = new Int8Array(N), used = new Uint8Array(N);
      for (let t = 0; t < N * 3; t++) {
        const k = Math.floor(Math.random() * N);
        if (used[k]) continue;
        const r = Math.floor(k / C), c = k % C;
        const [dr, dc] = Math.random() < 0.5 ? [0, 1] : [1, 0];
        const len = 1 + Math.floor(Math.random() * 4);
        const er = r + dr * len, ec = c + dc * len;
        if (er >= R || ec >= C) continue;
        const path = [];
        for (let i = 0; i <= len; i++) path.push((r + dr * i) * C + c + dc * i);
        if (path.some((x) => used[x])) continue;
        path.forEach((x) => { used[x] = 1; });
        const white = Math.random() < 0.5;
        col[path[0]] = white ? 1 : 2;
        col[path[path.length - 1]] = white ? 2 : 1;
      }
      const p = prepare({ R, C, col });
      const sols = solve(p);
      if (sols.length !== 1) continue;
      p.solution = sols[0];
      return p;
    }
    return null;
  }

  const NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function render(p, state, opts = {}) {
    const { R, C, col, links, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(28, Math.min(46, Math.floor((Math.min(window.innerWidth, 900) - 40) / C)));
    const svg = el('svg', { width: C * s, height: R * s, class: 'sk-board' + (readonly ? ' readonly' : '') });
    el('rect', { x: 0, y: 0, width: C * s, height: R * s, rx: 6, class: 'sk-bg' }, svg);
    for (let r = 1; r < R; r++) el('line', { x1: 0, y1: r * s, x2: C * s, y2: r * s, class: 'sk-grid' }, svg);
    for (let c = 1; c < C; c++) el('line', { x1: c * s, y1: 0, x2: c * s, y2: R * s, class: 'sk-grid' }, svg);
    const xy = (k) => [(k % C) * s + s / 2, Math.floor(k / C) * s + s / 2];
    const hintSet = new Set(hint ? hint.links : []);
    links.forEach((l, i) => {
      const [x1, y1] = xy(l.a), [x2, y2] = xy(l.b);
      const v = result ? solution[i] : state[i];
      let cls = 'sk-line';
      if (result && state[i]) cls += solution[i] ? ' ok' : ' bad';
      else if (result && solution[i]) cls += ' miss'; // not entered yet
      if (hintSet.has(i)) cls += ' hint';
      if (v) el('line', { x1, y1, x2, y2, class: cls }, svg);
      else if (hintSet.has(i) || (result && state[i])) el('line', { x1, y1, x2, y2, class: cls + ' ghost' }, svg);
      if (!readonly) {
        const hit = el('line', { x1, y1, x2, y2, class: 'sk-hit', 'stroke-width': s * 0.5 }, svg);
        hit.addEventListener('click', () => { state[i] = state[i] ? 0 : 1; onChange(); });
      }
    });
    for (let k = 0; k < R * C; k++) {
      if (!col[k]) continue;
      const [cx, cy] = xy(k);
      el('circle', { cx, cy, r: s * 0.3, class: col[k] === 1 ? 'sk-white' : 'sk-black' }, svg);
    }
    return svg;
  }

  function hints(p, state) {
    for (let i = 0; i < state.length; i++) if (state[i] && !p.solution[i]) return [{ links: [i], v: 0, reason: 'This line is wrong.' }];
    const st = Uint8Array.from(state, (v) => (v ? 1 : 0));
    const log = [];
    settle(p, st, log);
    const step = log.find((x) => x.v === 1);
    if (step) return [{ links: step.links, v: 1, reason: step.reason }];
    // Work through the "not used" steps until a line is forced.
    const t = Uint8Array.from(st);
    for (let guard = 0; guard < 200; guard++) {
      const l2 = [];
      if (!settle(p, t, l2) || !l2.length) break;
      const add = l2.find((x) => x.v === 1);
      if (add) return [{ links: add.links, v: 1, reason: add.reason }];
    }
    const i = p.solution.findIndex((v, j) => v && !state[j]);
    return i < 0 ? [] : [{ links: [i], v: 1, reason: 'No simple step is left. These circles are joined.' }];
  }

  PuzzleShell.start({
    id: 'shirokuro',
    name: 'Shirokuro',
    rules: 'Join every white circle to one black circle with a straight line, across or down. Every circle gets exactly ' +
      'one line. Lines never cross each other and never pass over another circle.',
    controls: 'Click between a white and a black circle to draw a line, click again to remove it.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'Black and white, all paired — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.col).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[012]+$/.test(d.g)) throw new Error('Invalid circles');
      const p = prepare({ R, C, col: Int8Array.from(d.g, Number) });
      const sols = solve(p);
      if (sols.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = sols[0];
      return p;
    },
    newState: (p) => new Uint8Array(p.links.length),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Uint8Array(p.links.length);
      if (typeof v === 'string' && v.length === s.length) for (let i = 0; i < s.length; i++) s[i] = v[i] === '1' ? 1 : 0;
      return s;
    },
    render,
    check: (p, s) => s.every((v, i) => v === p.solution[i]),
    hints,
    applyHint(p, s, h) { for (const i of h.links) s[i] = h.v === 1 ? 1 : 0; },
  });
})();
