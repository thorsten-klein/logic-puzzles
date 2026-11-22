// Shared engine for puzzles where pieces slide in straight lines
// (Satogaeri, Rectslider, Kaero). Exposes the global `Moves`.
//
// A puzzle p has { R, C, pieces: [{ k, num, label }], room? } where k is
// the start cell, num the exact distance (-1 = any, 0 = stays) and label
// an optional letter. A move is the end cell. The track of a move is
// every cell from start to end. Tracks of different pieces never share a
// cell (so pieces never cross, pass or land on each other).
//
// cfg for startGame:
//   id, name, rules, size, solvedText, generate(n) -> p (with solution:
//   end cell per piece), encodeExtra / decodeExtra, partial(p, ends, done)
//   -> false if broken (ends: end cell or -1 per piece), pieceText(p, i),
//   cellClass(p, k) / cellText(p, k) optional, dark: true for black pieces.

const Moves = (() => {
  // All tracks for piece i: [{ end, cells }].
  function options(p, i) {
    const { R, C, pieces } = p;
    const { k, num } = pieces[i];
    const r0 = Math.floor(k / C), c0 = k % C;
    const out = [];
    if (num <= 0) out.push({ end: k, cells: [k] });
    if (num === 0) return out;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const cells = [k];
      for (let d = 1; ; d++) {
        const r = r0 + dr * d, c = c0 + dc * d;
        if (r < 0 || c < 0 || r >= R || c >= C) break;
        cells.push(r * C + c);
        if (num < 0 || d === num) out.push({ end: r * C + c, cells: cells.slice() });
        if (num > 0 && d >= num) break;
      }
    }
    return out;
  }

  // Search: end cell per piece. partial(p, ends, done) prunes.
  function solve(p, partial, stopAt = 2, maxNodes = 100000, random = false) {
    const P = p.pieces.length;
    const used = new Int32Array(p.R * p.C).fill(-1);
    p.pieces.forEach((q, i) => { used[q.k] = i; });
    const opts = p.pieces.map((_, i) => options(p, i));
    const order = [...new Array(P).keys()].sort((a, b) => opts[a].length - opts[b].length);
    const ends = new Int32Array(P).fill(-1);
    const out = [];
    let nodes = 0;
    (function rec(t) {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      if (t === P) { if (partial(p, ends, true) !== false) { out.push(Int32Array.from(ends)); } return; }
      const i = order[t];
      for (const o of random ? PuzzleShell.shuffle(opts[i].slice()) : opts[i]) {
        if (o.cells.some((x) => used[x] >= 0 && used[x] !== i)) continue;
        o.cells.forEach((x) => { used[x] = i; });
        ends[i] = o.end;
        if (partial(p, ends, false) !== false) rec(t + 1);
        ends[i] = -1;
        o.cells.forEach((x) => { if (x !== p.pieces[i].k) used[x] = -1; });
        used[p.pieces[i].k] = i;
      }
    })(0);
    return { solutions: out, capped: nodes > maxNodes };
  }

  // Track cells of piece i when it ends at `end` (or null if not in line).
  function track(p, i, end) {
    const { C } = p;
    const k = p.pieces[i].k;
    const r0 = Math.floor(k / C), c0 = k % C, r1 = Math.floor(end / C), c1 = end % C;
    if (r0 !== r1 && c0 !== c1) return null;
    const cells = [];
    const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0);
    for (let r = r0, c = c0; ; r += dr, c += dc) { cells.push(r * C + c); if (r === r1 && c === c1) break; }
    return cells;
  }

  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, parent) => {
    const e = document.createElementNS(NS, name);
    for (const a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  };

  let selected = -1;
  function render(cfg, p, ends, opts = {}) {
    const { R, C, pieces, room, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(28, Math.min(48, Math.floor((Math.min(window.innerWidth, 900) - 40) / C)));
    const svg = el('svg', { width: C * s + 4, height: R * s + 4, class: 'gx-board pt-board mv-board' + (readonly ? ' readonly' : '') });
    const g = el('g', { transform: 'translate(2 2)' }, svg);
    el('rect', { x: 0, y: 0, width: C * s, height: R * s, class: 'gx-bg' }, g);
    for (let k = 0; k < R * C; k++) {
      const cls = cfg.cellClass ? cfg.cellClass(p, k) : '';
      if (cls) el('rect', { x: (k % C) * s, y: Math.floor(k / C) * s, width: s, height: s, class: cls }, g);
    }
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const k = r * C + c;
      if (c < C - 1) el('line', { x1: (c + 1) * s, y1: r * s, x2: (c + 1) * s, y2: (r + 1) * s, class: room && room[k] !== room[k + 1] ? 'gx-wall' : 'gx-grid' }, g);
      if (r < R - 1) el('line', { x1: c * s, y1: (r + 1) * s, x2: (c + 1) * s, y2: (r + 1) * s, class: room && room[k] !== room[k + C] ? 'gx-wall' : 'gx-grid' }, g);
    }
    el('rect', { x: 0, y: 0, width: C * s, height: R * s, class: 'gx-frame', fill: 'none' }, g);
    const xy = (k) => [(k % C) * s + s / 2, Math.floor(k / C) * s + s / 2];
    if (cfg.cellText) for (let k = 0; k < R * C; k++) {
      const t = cfg.cellText(p, k);
      if (t) { const [x, y] = xy(k); el('text', { x, y, 'font-size': s * 0.36, class: 'pt-clue mv-cell-text' }, g).textContent = t; }
    }
    const shown = result ? solution : ends;
    const hintSet = new Set(hint ? hint.cells : []);
    pieces.forEach((q, i) => {
      const end = shown[i];
      const [x0, y0] = xy(q.k), [x1, y1] = xy(end);
      if (end !== q.k) {
        el('line', { x1: x0, y1: y0, x2: x1, y2: y1, class: 'mv-track' }, g);
        el('circle', { cx: x0, cy: y0, r: s * 0.12, class: 'mv-start' }, g);
      }
      let cls = cfg.dark ? 'mv-piece dark' : 'mv-piece';
      if (result) cls += ' ' + PuzzleShell.resultClass(ends[i], solution[i], ends[i] !== q.k);
      if (!result && i === selected && !readonly) cls += ' sel';
      if (hintSet.has(i)) cls += ' hint';
      if (cfg.dark) el('rect', { x: x1 - s * 0.4, y: y1 - s * 0.4, width: s * 0.8, height: s * 0.8, rx: s * 0.08, class: cls }, g);
      else el('circle', { cx: x1, cy: y1, r: s * 0.34, class: cls }, g);
      const t = cfg.pieceText(p, i);
      if (t) el('text', { x: x1, y: y1, 'font-size': s * 0.4, class: cfg.dark ? 'pt-clue mv-text light' : 'pt-clue mv-text' }, g).textContent = t;
    });
    if (!readonly && !result) {
      for (let k = 0; k < R * C; k++) {
        const hit = el('rect', { x: (k % C) * s, y: Math.floor(k / C) * s, width: s, height: s, fill: 'transparent' }, g);
        hit.style.cursor = 'pointer';
        hit.addEventListener('click', () => {
          // Click a piece (at its start or its end) to pick it; then click a cell in line to move it there.
          const at = pieces.findIndex((q, i) => ends[i] === k);
          const from = pieces.findIndex((q) => q.k === k);
          if (selected >= 0 && track(p, selected, k) && (at < 0 || at === selected)) {
            ends[selected] = k;
            selected = -1;
            onChange();
            return;
          }
          if (at >= 0) selected = at;
          else selected = from >= 0 ? from : -1;
          onChange();
        });
        hit.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
          const at = pieces.findIndex((q, i) => ends[i] === k);
          if (at >= 0) { ends[at] = pieces[at].k; selected = -1; onChange(); }
        });
      }
    }
    return svg;
  }

  function startGame(cfg) {
    const partial = (p, ends, done) => cfg.partial(p, ends, done);
    PuzzleShell.start({
      id: cfg.id, name: cfg.name, rules: cfg.rules, size: cfg.size, solvedText: cfg.solvedText,
      controls: 'Click a piece, then click a cell in the same row or column to move it there. Right click a moved piece to send it back.',
      generate: cfg.generate,
      encode: (p) => ({ r: p.R, c: p.C, p: p.pieces.map((q) => [q.k, q.num, q.label || 0]), x: cfg.encodeExtra ? cfg.encodeExtra(p) : undefined }),
      decode(d) {
        const R = d?.r, C = d?.c;
        if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 16)) throw new Error('Invalid board size');
        if (!Array.isArray(d.p)) throw new Error('Invalid pieces');
        const pieces = d.p.map((q) => {
          if (!Array.isArray(q) || !Number.isInteger(q[0]) || q[0] < 0 || q[0] >= R * C) throw new Error('Invalid piece');
          return { k: q[0], num: Number(q[1]), label: Number(q[2]) || 0 };
        });
        const p = { R, C, pieces };
        if (cfg.decodeExtra) cfg.decodeExtra(p, d.x);
        const res = solve(p, partial, 2, 400000);
        if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
        p.solution = res.solutions[0];
        return p;
      },
      newState: (p) => Int32Array.from(p.pieces, (q) => q.k),
      saveState: (s) => Array.from(s).join(','),
      loadState(p, v) {
        const s = Int32Array.from(p.pieces, (q) => q.k);
        const parts = typeof v === 'string' ? v.split(',') : [];
        if (parts.length === s.length) parts.forEach((x, i) => { const e = Number(x); if (e >= 0 && e < p.R * p.C && track(p, i, e)) s[i] = e; });
        return s;
      },
      render: (p, s, opts) => render(cfg, p, s, opts),
      check: (p, s) => s.every((e, i) => e === p.solution[i]),
      hints(p, s) {
        const i = s.findIndex((e, j) => e !== p.solution[j]);
        if (i < 0) return [];
        const moved = s[i] !== p.pieces[i].k;
        return [{ cells: [i], v: p.solution[i], reason: moved && s[i] !== p.solution[i] ? 'This piece is in the wrong place.' : 'No simple step is shown here. This piece goes to the marked place.' }];
      },
      applyHint(p, s, h) { for (const i of h.cells) s[i] = h.v; },
    });
  }

  return { options, solve, track, startGame };
})();
