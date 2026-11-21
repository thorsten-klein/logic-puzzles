// Seethrough (Doors). Every cell is a room; between rooms are doors.
// Close some doors (draw walls). A number tells how many rooms it sees up,
// down, left and right through open doors (itself not counted). All rooms
// stay reachable from each other through open doors.
// The Binary solver runs on edges: YES = wall (closed door).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  // Edge numbering like Loop.grid: horizontal neighbours first.
  const hEdge = (C, r, c) => r * (C - 1) + c;
  const vEdge = (R, C, r, c) => R * (C - 1) + r * C + c;

  function model(p) {
    const { R, C, clues } = p;
    const E = R * (C - 1) + (R - 1) * C;
    // Edges along each of the four rays from cell k.
    const rays = (k) => {
      const r = Math.floor(k / C), c = k % C;
      return [
        Array.from({ length: r }, (_, i) => vEdge(R, C, r - 1 - i, c)),
        Array.from({ length: R - 1 - r }, (_, i) => vEdge(R, C, r + i, c)),
        Array.from({ length: c }, (_, i) => hEdge(C, r, c - 1 - i)),
        Array.from({ length: C - 1 - c }, (_, i) => hEdge(C, r, c + i)),
      ];
    };
    const all = Array.from({ length: R * C }, (_, k) => (clues[k] >= 0 ? rays(k) : null));
    const view = (s, k) => {
      let low = 0, high = 0;
      for (const ray of all[k]) {
        let sure = true;
        for (const e of ray) {
          if (s[e] === YES) break;
          if (s[e] === UNKNOWN) sure = false;
          high++;
          if (sure) low++;
        }
      }
      return [low, high];
    };
    function check(s) {
      for (let k = 0; k < R * C; k++) {
        if (clues[k] < 0) continue;
        const [low, high] = view(s, k);
        if (low > clues[k] || high < clues[k]) return false;
      }
      // Rooms connect through doors that may be open.
      const seen = new Uint8Array(R * C);
      seen[0] = 1;
      const stack = [0];
      let count = 1;
      while (stack.length) {
        const k = stack.pop(), r = Math.floor(k / C), c = k % C;
        const go = (j, e) => { if (!seen[j] && s[e] !== YES) { seen[j] = 1; count++; stack.push(j); } };
        if (c > 0) go(k - 1, hEdge(C, r, c - 1));
        if (c < C - 1) go(k + 1, hEdge(C, r, c));
        if (r > 0) go(k - C, vEdge(R, C, r - 1, c));
        if (r < R - 1) go(k + C, vEdge(R, C, r, c));
      }
      return count === R * C;
    }
    return { N: E, cons: [], check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n;
      const E = R * (C - 1) + (R - 1) * C;
      const sol = Uint8Array.from({ length: E }, () => (Math.random() < 0.35 ? YES : NO));
      const base = model({ R, C, clues: new Int8Array(R * C).fill(-1) });
      if (!base.check(sol)) continue;
      // Every cell gets its view count, then the numbers are thinned.
      const clues = new Int8Array(R * C);
      for (let k = 0; k < R * C; k++) {
        const r = Math.floor(k / C), c = k % C;
        const rays = [
          Array.from({ length: r }, (_, i) => vEdge(R, C, r - 1 - i, c)),
          Array.from({ length: R - 1 - r }, (_, i) => vEdge(R, C, r + i, c)),
          Array.from({ length: c }, (_, i) => hEdge(C, r, c - 1 - i)),
          Array.from({ length: C - 1 - c }, (_, i) => hEdge(C, r, c + i)),
        ];
        for (const ray of rays) for (const e of ray) { if (sol[e] === YES) break; clues[k]++; }
      }
      const p = { R, C, clues };
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.clues, -1, () => model(p));
      p.solution = sol;
      return p;
    }
    return null;
  }

  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (name, attrs, parent) => {
    const e = document.createElementNS(NS, name);
    for (const a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  };

  function render(p, state, opts = {}) {
    const { R, C, clues, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(26, Math.min(46, Math.floor((Math.min(window.innerWidth, 900) - 40) / C)));
    const svg = svgEl('svg', { width: C * s + 4, height: R * s + 4, class: 'gx-board pt-board' + (readonly ? ' readonly' : '') });
    const g = svgEl('g', { transform: 'translate(2 2)' }, svg);
    svgEl('rect', { x: 0, y: 0, width: C * s, height: R * s, class: 'gx-bg' }, g);
    const hintSet = new Set(hint ? hint.cells : []);
    const edges = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) edges.push([hEdge(C, r, c), (c + 1) * s, r * s, (c + 1) * s, (r + 1) * s]);
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C; c++) edges.push([vEdge(R, C, r, c), c * s, (r + 1) * s, (c + 1) * s, (r + 1) * s]);
    for (const [e, x1, y1, x2, y2] of edges) {
      const wall = result ? solution[e] === YES : state[e] === YES;
      let cls = wall ? 'gx-wall' : 'gx-grid';
      if (result && state[e] === YES) cls += solution[e] === YES ? ' ok' : ' bad';
      else if (result && state[e] === NO && solution[e] === YES) cls += ' bad'; // marked open, but a wall
      else if (result && solution[e] === YES) cls += ' miss'; // not entered yet
      if (!result && state[e] === NO) cls = 'gx-grid st-open';
      if (hintSet.has(e)) cls += ' hint';
      svgEl('line', { x1, y1, x2, y2, class: cls }, g);
      if (!readonly) {
        const hit = svgEl('line', { x1, y1, x2, y2, class: 'gx-hit', 'stroke-width': s * 0.35 }, g);
        const cycle = (back) => { const order = back ? [UNKNOWN, NO, YES] : [UNKNOWN, YES, NO]; state[e] = order[(order.indexOf(state[e]) + 1) % 3]; onChange(); };
        hit.addEventListener('click', () => cycle(false));
        hit.addEventListener('contextmenu', (ev) => { ev.preventDefault(); cycle(true); });
      }
    }
    svgEl('rect', { x: 0, y: 0, width: C * s, height: R * s, class: 'gx-frame' }, g);
    for (let k = 0; k < R * C; k++) {
      if (clues[k] < 0) continue;
      const t = svgEl('text', { x: (k % C) * s + s / 2, y: Math.floor(k / C) * s + s / 2, 'font-size': s * 0.42, class: 'pt-clue' }, g);
      t.textContent = clues[k];
    }
    return svg;
  }

  function hints(p, state) {
    for (let e = 0; e < state.length; e++) {
      if (state[e] !== UNKNOWN && state[e] !== p.solution[e]) return [{ cells: [e], v: UNKNOWN, reason: state[e] === YES ? 'This door is open.' : 'This door is closed.' }];
    }
    // A forced edge from the numbers, else one wall of the answer.
    const m = model(p);
    for (let e = 0; e < state.length; e++) {
      if (state[e] !== UNKNOWN) continue;
      // Try both values; if one breaks the rules at once, the other is forced.
      for (const v of [YES, NO]) {
        const t = Uint8Array.from(state);
        t[e] = v === YES ? NO : YES;
        if (!m.check(t)) return [{ cells: [e], v, reason: v === YES ? 'A wall goes here: an open door would let a number see too much.' : 'This door must stay open: a wall here would hide too much or cut off a room.' }];
      }
    }
    const e = p.solution.findIndex((v, i) => state[i] === UNKNOWN && v === YES);
    return e < 0 ? [] : [{ cells: [e], v: YES, reason: 'No simple step is left. A wall goes here.' }];
  }

  PuzzleShell.start({
    id: 'seethrough',
    name: 'Seethrough',
    rules: 'Every cell is a room, and between rooms are doors. Close some doors by drawing walls. A number tells how many ' +
      'rooms it sees up, down, left and right through open doors (its own room not counted). All rooms stay reachable ' +
      'from each other through open doors.',
    controls: 'Click a grid line to draw a wall, click again to mark the door open, again to clear. Right click cycles back.',
    size: { min: 4, max: 7, def: 5 },
    solvedText: 'Clear view everywhere — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v.toString(36))).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n) throw new Error('Invalid numbers');
      const p = { R: n, C: n, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number.parseInt(ch, 36))) };
      const m = model(p);
      const t = Binary.logicSolve(m);
      if (t && !t.includes(UNKNOWN)) { p.solution = t; return p; }
      const res = Binary.solve(m, 2, 50000, t || undefined);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Uint8Array(p.R * (p.C - 1) + (p.R - 1) * p.C),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Uint8Array(p.R * (p.C - 1) + (p.R - 1) * p.C);
      if (typeof v === 'string' && v.length === s.length) for (let i = 0; i < s.length; i++) s[i] = Number(v[i]) % 3;
      return s;
    },
    render,
    check: (p, s) => s.every((v, e) => (v === YES) === (p.solution[e] === YES)),
    hints,
    applyHint(p, s, h) { for (const e of h.cells) s[e] = h.v; },
  });
})();
