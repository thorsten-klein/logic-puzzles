// Shared engine for loop puzzles through cell centres (Masyu, ...).
// Exposes the global `Loop`.
//
// Edges join neighbouring cells:
//   horizontal (r, c)-(r, c+1):  r * (C-1) + c
//   vertical   (r, c)-(r+1, c):  R * (C-1) + r * C + c
// Edge states: 0 = unknown, 1 = line, 2 = cross (no line).
// A solution is one closed loop; each cell has 0 or 2 lines.

const Loop = (() => {
  const UNKNOWN = 0, LINE = 1, CROSS = 2;
  // A step result that means "contradiction": -1 (or false, the old form).
  const failed = (r) => r === false || r < 0;

  // Precomputed grid data: edge ends and the edges of each cell
  // (as [up, down, left, right], -1 at the border).
  function grid(R, C) {
    const E = R * (C - 1) + (R - 1) * C;
    const ends = new Array(E);
    const cellEdges = Array.from({ length: R * C }, () => [-1, -1, -1, -1]);
    for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) {
      const e = r * (C - 1) + c, a = r * C + c;
      ends[e] = [a, a + 1];
      cellEdges[a][3] = e;
      cellEdges[a + 1][2] = e;
    }
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C; c++) {
      const e = R * (C - 1) + r * C + c, a = r * C + c;
      ends[e] = [a, a + C];
      cellEdges[a][1] = e;
      cellEdges[a + C][0] = e;
    }
    return { R, C, E, ends, cellEdges };
  }

  // Basic rules for one cell: at most 2 lines, never exactly 1 at the end.
  // `must` marks cells the loop has to visit. Returns -1, or cells set.
  function cellStep(g, s, must, log) {
    let set = 0;
    for (let k = 0; k < g.R * g.C; k++) {
      const r = cellStepAt(g, s, Boolean(must?.[k]), k, log);
      if (r < 0) return -1;
      set += r;
    }
    return set;
  }

  // cellStep for cell k. Returns -1, or the number of edges set.
  function cellStepAt(g, s, mustK, k, log) {
    const es = g.cellEdges[k].filter((e) => e >= 0);
    const lines = es.filter((e) => s[e] === LINE).length;
    const open = es.filter((e) => s[e] === UNKNOWN);
    if (lines > 2) return -1;
    if (lines + open.length < (mustK || lines ? 2 : 0)) return -1;
    if (!open.length) return 0;
    const f = forcedSides(lines, open.length, mustK);
    if (!f) return 0;
    for (const e of open) s[e] = f.v;
    if (log) log.push({ edges: open, v: f.v, reason: f.why, at: k });
    return open.length;
  }

  // What the open sides of a cell must be, or null if not forced yet.
  function forcedSides(lines, nOpen, mustK) {
    if (lines === 2) return { v: CROSS, why: 'This cell already has two lines. No more lines can touch it.' };
    if (lines === 1 && nOpen === 1) return { v: LINE, why: 'The line must go on, and this is its only way out.' };
    if (lines === 0 && nOpen === 1) return { v: CROSS, why: 'The loop can not pass through this cell: it has only one open side.' };
    if (mustK && lines + nOpen === 2) return { v: LINE, why: 'The loop must pass through this cell, and only these sides are open.' };
    return null;
  }

  // Follows line edges into paths. Returns { loops, loopCells, open,
  // lineCells }: closed loops, and the two end cells of each open path.
  function paths(g, s) {
    const adj = Array.from({ length: g.R * g.C }, () => []);
    for (let e = 0; e < g.E; e++) {
      if (s[e] !== LINE) continue;
      const [a, b] = g.ends[e];
      adj[a].push(b);
      adj[b].push(a);
    }
    const seen = new Uint8Array(g.R * g.C);
    const out = { loops: 0, loopCells: 0, open: [], lineCells: 0 };
    for (let k = 0; k < g.R * g.C; k++) {
      if (seen[k] || !adj[k].length) continue;
      const comp = component(adj, seen, k);
      out.lineCells += comp.length;
      const ends = comp.filter((x) => adj[x].length === 1);
      if (ends.length) out.open.push(ends);
      else { out.loops++; out.loopCells += comp.length; }
    }
    return out;
  }

  // Cells joined to k by lines (marks them in `seen`).
  function component(adj, seen, k) {
    const stack = [k], comp = [];
    seen[k] = 1;
    while (stack.length) {
      const x = stack.pop();
      comp.push(x);
      for (const y of adj[x]) if (!seen[y]) { seen[y] = 1; stack.push(y); }
    }
    return comp;
  }

  // No early small loop: an open edge that joins the two ends of one
  // path is crossed, unless that would finish the whole puzzle.
  function loopStep(g, s, must, log) {
    const info = paths(g, s);
    if (info.loops > 1) return -1;
    if (info.loops === 1) return closedLoopOk(g, s, must, info) ? 0 : -1;
    if (info.open.length < 2) return 0;
    return crossEarlyLoop(g, s, info, log);
  }

  // A closed loop must be everything: no open paths, every must-cell on it.
  function closedLoopOk(g, s, must, info) {
    if (info.open.length) return false;
    if (!must) return true;
    return must.every((m, k) => !m || g.cellEdges[k].some((e) => e >= 0 && s[e] === LINE));
  }

  // Crosses the first open edge that would close one path into a loop.
  function crossEarlyLoop(g, s, info, log) {
    const endOf = new Map();
    info.open.forEach(([a, b], i) => { endOf.set(a, i); endOf.set(b, i); });
    for (let e = 0; e < g.E; e++) {
      if (s[e] !== UNKNOWN) continue;
      const [a, b] = g.ends[e];
      if (!endOf.has(a) || endOf.get(a) !== endOf.get(b)) continue;
      s[e] = CROSS;
      if (log) log.push({ edges: [e], v: CROSS, reason: 'A line here would close a small loop too early. The loop must be one single ring.' });
      return 1;
    }
    return 0;
  }

  // A model: { g, must, rule(s, log) } — rule is the game's own step.
  // The steps run in order; after any change it starts again from the
  // first. With a log it stops after the first change.
  function settle(m, s, log) {
    const steps = [(t, l) => cellStep(m.g, t, m.must, l), m.rule && ((t, l) => m.rule(t, l)), (t, l) => loopStep(m.g, t, m.must, l)].filter(Boolean);
    for (let guard = 0; guard < 10000; guard++) {
      const r = firstChange(steps, s, log);
      if (r < 0) return false;
      if (!r || log) return true;
    }
    return true; // safety limit reached
  }

  // Runs the steps until one changes something. Returns -1, 0, or 1.
  function firstChange(steps, s, log) {
    for (const f of steps) {
      const r = f(s, log);
      if (failed(r)) return -1;
      if (r) return 1;
    }
    return 0;
  }

  function complete(m, s) {
    const info = paths(m.g, s);
    return info.loops === 1 && !info.open.length;
  }

  // Look-ahead: an edge whose line (or cross) leads to a contradiction.
  function lookahead(m, s) {
    for (let e = 0; e < m.g.E; e++) {
      if (s[e] !== UNKNOWN) continue;
      for (const v of [LINE, CROSS]) {
        const t = Uint8Array.from(s);
        t[e] = v;
        if (!settle(m, t)) {
          s[e] = v === LINE ? CROSS : LINE;
          return { e, v: s[e], tried: v };
        }
      }
    }
    return null;
  }

  function solve(m, stopAt = 2, maxNodes = 20000, start = null) {
    const solutions = [];
    let nodes = 0;
    (function rec(s) {
      if (solutions.length >= stopAt || ++nodes > maxNodes) return;
      if (!settle(m, s)) return;
      // Unknown edges left: guess one next to a line end if possible.
      let pick = -1;
      for (let e = 0; e < m.g.E && pick < 0; e++) {
        if (s[e] !== UNKNOWN) continue;
        const [a, b] = m.g.ends[e];
        const touches = (k) => m.g.cellEdges[k].some((x) => x >= 0 && s[x] === LINE);
        if (touches(a) || touches(b)) pick = e;
      }
      if (pick < 0) pick = s.indexOf(UNKNOWN);
      if (pick < 0) {
        // Leftover unknowns are none: done if it is one loop.
        if (complete(m, s)) solutions.push(Uint8Array.from(s, (v) => (v === LINE ? LINE : CROSS)));
        return;
      }
      for (const v of [LINE, CROSS]) {
        const t = Uint8Array.from(s);
        t[pick] = v;
        rec(t);
      }
    })(start ? Uint8Array.from(start) : new Uint8Array(m.g.E));
    return { solutions, capped: nodes > maxNodes };
  }

  // Logic only (forced steps plus look-ahead). Returns the state.
  function logicSolve(m) {
    const s = new Uint8Array(m.g.E);
    for (;;) {
      if (!settle(m, s)) return null;
      if (!lookahead(m, s)) return s;
    }
  }

  const solvedBy = (s) => s && !s.includes(UNKNOWN);

  // Random loop: the border of a random blob on an (R-1) x (C-1) grid
  // of squares. With `thin`, the blob grows like a tree (new squares
  // touch only one old square), so the loop winds through most cells.
  // Returns an edge state.
  function randomLoop(R, C, fill = 0.5, thin = false) {
    const g = grid(R, C);
    for (let tries = 0; tries < 50; tries++) {
      const at = growBlob(R - 1, C - 1, fill, thin);
      const s = blobBorder(g, R, C, at);
      if (complete({ g }, s)) return s;
    }
    return null;
  }

  // A random blob of squares on an H x W grid, without holes and without
  // two squares that touch only at a corner. Returns at(r, c): 1 inside.
  function growBlob(H, W, fill, thin) {
    const inside = new Uint8Array(H * W);
    const at = (r, c) => (r < 0 || c < 0 || r >= H || c >= W ? 0 : inside[r * W + c]);
    inside[Math.floor(Math.random() * H * W)] = 1;
    let size = 1;
    const target = Math.round(H * W * fill);
    for (let fails = 0; size < target && fails < H * W * 10;) {
      const cand = blobCandidates(inside, at, H, W, thin);
      if (!cand.length) break;
      const k = cand[Math.floor(Math.random() * cand.length)];
      inside[k] = 1;
      if (!holeFree(inside, H, W) || hasChecker(at, H, W)) { inside[k] = 0; fails++; continue; }
      size++;
    }
    return at;
  }

  // Squares next to the blob (with `thin`: next to exactly one square).
  function blobCandidates(inside, at, H, W, thin) {
    const cand = [];
    for (let k = 0; k < H * W; k++) {
      if (inside[k]) continue;
      const r = Math.floor(k / W), c = k % W;
      const touch = at(r - 1, c) + at(r + 1, c) + at(r, c - 1) + at(r, c + 1);
      if (touch && (!thin || touch === 1)) cand.push(k);
    }
    return cand;
  }

  // True if every outside square reaches the grid border.
  function holeFree(inside, H, W) {
    const seen = new Uint8Array(H * W);
    const stack = [];
    for (let k = 0; k < H * W; k++) {
      const r = Math.floor(k / W), c = k % W;
      if (!inside[k] && (r === 0 || c === 0 || r === H - 1 || c === W - 1)) { seen[k] = 1; stack.push(k); }
    }
    while (stack.length) {
      const k = stack.pop(), r = Math.floor(k / W), c = k % W;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        const j = nr * W + nc;
        if (nr >= 0 && nc >= 0 && nr < H && nc < W && !seen[j] && !inside[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    return inside.every((v, k) => v || seen[k]);
  }

  // True if two inside squares touch only at a corner somewhere.
  function hasChecker(at, H, W) {
    for (let r = 0; r <= H; r++) for (let c = 0; c <= W; c++) {
      const tl = at(r - 1, c - 1), tr = at(r - 1, c), bl = at(r, c - 1), br = at(r, c);
      if (tl === br && tr === bl && tl !== tr) return true;
    }
    return false;
  }

  // The blob's outline as an edge state on the R x C point grid.
  // Square (r, c) has corners at cells (r, c), (r, c+1), (r+1, c), (r+1, c+1).
  function blobBorder(g, R, C, at) {
    const s = new Uint8Array(g.E).fill(CROSS);
    for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) {
      if (at(r - 1, c) !== at(r, c)) s[r * (C - 1) + c] = LINE;
    }
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C; c++) {
      if (at(r, c - 1) !== at(r, c)) s[R * (C - 1) + r * C + c] = LINE;
    }
    return s;
  }

  // A tour through every point: walk around a random spanning tree of
  // the half-size grid. Each tree square becomes a 2x2 block of points.
  function randomTour(n) {
    const h = n / 2;
    const g = grid(n, n);
    const H = (r, c) => r * (n - 1) + c; // (r, c)-(r, c+1)
    const V = (r, c) => n * (n - 1) + r * n + c; // (r, c)-(r+1, c)
    const s = new Uint8Array(g.E).fill(CROSS);
    for (let i = 0; i < h; i++) for (let j = 0; j < h; j++) {
      s[H(2 * i, 2 * j)] = LINE; s[H(2 * i + 1, 2 * j)] = LINE;
      s[V(2 * i, 2 * j)] = LINE; s[V(2 * i, 2 * j + 1)] = LINE;
    }
    // Random spanning tree (randomized depth-first search).
    const seen = new Uint8Array(h * h);
    const stack = [Math.floor(Math.random() * h * h)];
    seen[stack[0]] = 1;
    while (stack.length) {
      const k = stack.at(-1);
      const i = Math.floor(k / h), j = k % h;
      const opts = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]
        .filter(([a, b]) => a >= 0 && b >= 0 && a < h && b < h && !seen[a * h + b]);
      if (!opts.length) { stack.pop(); continue; }
      const [a, b] = opts[Math.floor(Math.random() * opts.length)];
      seen[a * h + b] = 1;
      stack.push(a * h + b);
      if (a === i) {
        const jj = Math.min(j, b);
        s[V(2 * i, 2 * jj + 1)] = CROSS; s[V(2 * i, 2 * jj + 2)] = CROSS;
        s[H(2 * i, 2 * jj + 1)] = LINE; s[H(2 * i + 1, 2 * jj + 1)] = LINE;
      } else {
        const ii = Math.min(i, a);
        s[H(2 * ii + 1, 2 * j)] = CROSS; s[H(2 * ii + 2, 2 * j)] = CROSS;
        s[V(2 * ii + 1, 2 * j)] = LINE; s[V(2 * ii + 1, 2 * j + 1)] = LINE;
      }
    }
    return s;
  }

  // Hints: wrong marks, forced steps, look-ahead, then a reveal.
  function hints(m, state, solution) {
    const out = [];
    for (let e = 0; e < m.g.E; e++) {
      if (state[e] === LINE && solution[e] !== LINE) out.push({ edges: [e], v: CROSS, reason: 'This line is wrong.' });
      if (state[e] === CROSS && solution[e] === LINE) out.push({ edges: [e], v: LINE, reason: 'This cross is wrong. A line goes here.' });
    }
    if (out.length) return out;
    const s = Uint8Array.from(state);
    const log = [];
    settle(m, s, log);
    if (log.length) return log.slice(0, 1);
    const t = Uint8Array.from(state);
    const la = lookahead(m, t);
    if (la) {
      return [{ edges: [la.e], v: la.v, reason: la.tried === LINE
        ? 'A line here leads to a dead end, so this edge gets a cross.'
        : 'Leaving this edge empty leads to a dead end, so a line goes here.' }];
    }
    const e = solution.findIndex((v, i) => v === LINE && state[i] !== LINE);
    if (e >= 0) out.push({ edges: [e], v: LINE, reason: 'No simple step is left. Here is one line of the loop.' });
    return out;
  }

  const NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // SVG board. `drawCell(svg, k, x, y, size, state)` adds cell content
  // (pearls...); `state` is the edge state shown (the solution on result).
  // drawOnTop: draw the cell marks above the loop (for numbers in circles).
  function render(m, state, opts = {}, drawCell = null, drawOnTop = false) {
    const { R, C, E, ends } = m.g;
    const { readonly, result, hint, onChange, solution, fixed } = opts;
    const fixedSet = new Set(fixed || []);
    const s = Math.max(26, Math.min(46, Math.floor((Math.min(window.innerWidth, 900) - 40) / C)));
    const svg = el('svg', { width: C * s + 4, height: R * s + 4, class: 'loop-board' + (readonly ? ' readonly' : '') });
    const g0 = el('g', { transform: 'translate(2 2)' }, svg);
    el('rect', { x: 0, y: 0, width: C * s, height: R * s, class: 'lp-bg' }, g0);
    for (let r = 1; r < R; r++) el('line', { x1: 0, y1: r * s, x2: C * s, y2: r * s, class: 'lp-grid' }, g0);
    for (let c = 1; c < C; c++) el('line', { x1: c * s, y1: 0, x2: c * s, y2: R * s, class: 'lp-grid' }, g0);
    const center = (k) => [(k % C) * s + s / 2, Math.floor(k / C) * s + s / 2];
    const shownState = result ? solution : state;
    // Layers: marks below, lines, marks above, click targets.
    const gBelow = el('g', {}, g0), gLines = el('g', {}, g0), gAbove = el('g', { 'pointer-events': 'none' }, g0), gHits = el('g', {}, g0);
    const gMarks = drawOnTop ? gAbove : gBelow;
    if (drawCell) for (let k = 0; k < R * C; k++) { const [x, y] = center(k); drawCell(gMarks, k, x, y, s, shownState); }
    const hintSet = new Set(hint ? hint.edges : []);
    // Result view: right, wrong (also a cross on a line), or not drawn yet.
    const resultMark = (e) => {
      if (state[e] === LINE) return solution[e] === LINE ? ' ok' : ' bad';
      if (solution[e] !== LINE) return '';
      return state[e] === CROSS ? ' bad' : ' miss';
    };
    const drawEdge = (e, [x1, y1], [x2, y2]) => {
      let v = state[e], cls = '';
      if (result) {
        cls = resultMark(e);
        v = solution[e] === LINE ? LINE : UNKNOWN;
      }
      if (hintSet.has(e)) cls += ' hint';
      if (fixedSet.has(e)) cls = ' given';
      if (v === LINE) el('line', { x1, y1, x2, y2, class: 'lp-line' + cls }, gLines);
      else if (v === CROSS) {
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, d = s * 0.09;
        el('path', { d: `M${cx - d} ${cy - d}L${cx + d} ${cy + d}M${cx + d} ${cy - d}L${cx - d} ${cy + d}`, class: 'lp-cross' + cls }, gLines);
      } else if (hintSet.has(e) || cls.includes('bad')) {
        el('line', { x1, y1, x2, y2, class: 'lp-ghost' + cls }, gLines);
      }
    };
    // Click target: left click cycles open, line, cross; right click back.
    const addHit = (e, [x1, y1], [x2, y2]) => {
      const hit = el('line', { x1, y1, x2, y2, class: 'lp-hit', 'stroke-width': s * 0.45 }, gHits);
      const cycle = (back) => {
        const order = back ? [UNKNOWN, CROSS, LINE] : [UNKNOWN, LINE, CROSS];
        state[e] = order[(order.indexOf(state[e]) + 1) % 3];
        onChange();
      };
      hit.addEventListener('click', () => cycle(false));
      hit.addEventListener('contextmenu', (ev) => { ev.preventDefault(); cycle(true); });
    };
    for (let e = 0; e < E; e++) {
      const p1 = center(ends[e][0]), p2 = center(ends[e][1]);
      drawEdge(e, p1, p2);
      if (!readonly && !fixedSet.has(e)) addHit(e, p1, p2);
    }
    return svg;
  }

  // Full game page. cfg: id, name, rules, size, solvedText,
  //   generate(n) -> p (with R, C, solution), encode, decode (no solution),
  //   model(p) -> { g, must, rule }, drawCell(p) -> fn for render,
  //   fixed(p) -> optional list of edges given as lines.
  function startGame(cfg) {
    const fixed = (p) => (cfg.fixed ? cfg.fixed(p) : []);
    const withFixed = (p, s) => { for (const e of fixed(p)) { s[e] = LINE; } return s; };
    PuzzleShell.start({
      id: cfg.id, name: cfg.name, rules: cfg.rules, size: cfg.size, solvedText: cfg.solvedText,
      controls: 'Click between two cells to draw a line, click again for a cross, again to clear. Right click cycles the other way.',
      generate: cfg.generate,
      encode: cfg.encode,
      decode(d) {
        const p = cfg.decode(d);
        // Logic alone gives the unique answer when it finishes.
        const byLogic = logicSolve(cfg.model(p));
        if (solvedBy(byLogic)) {
          p.solution = Uint8Array.from(byLogic, (v) => (v === LINE ? LINE : CROSS));
          if (complete(cfg.model(p), p.solution)) return p;
        }
        const res = solve(cfg.model(p), 2, 50000);
        if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
        p.solution = res.solutions[0];
        return p;
      },
      newState: (p) => withFixed(p, new Uint8Array(grid(p.R, p.C).E)),
      saveState: (s) => Array.from(s).join(''),
      loadState(p, v) {
        const s = new Uint8Array(grid(p.R, p.C).E);
        if (typeof v === 'string' && v.length === s.length) for (let i = 0; i < s.length; i++) s[i] = Number(v[i]) % 3;
        return withFixed(p, s);
      },
      render: (p, s, opts) => render(cfg.model(p), s, { ...opts, solution: p.solution, fixed: fixed(p) },
        cfg.drawCell ? cfg.drawCell(p) : null, cfg.drawOnTop),
      check(p, s) {
        const m = cfg.model(p);
        const t = Uint8Array.from(s, (v) => (v === LINE ? LINE : CROSS));
        return complete(m, t) && settle(m, t);
      },
      hints: (p, s) => hints(cfg.model(p), s, p.solution),
      applyHint(p, s, h) { for (const e of h.edges) { s[e] = h.v; } withFixed(p, s); },
    });
  }

  // Straight legs out of cell k: for each side with a line, how far the
  // line runs straight from k, and whether it surely stops there.
  // Returns { dirs, legs: [{ len, final }], turn } (turn: null if unknown).
  function legs(g, s, k) {
    const step = [-g.C, g.C, -1, 1];
    const dirs = [0, 1, 2, 3].filter((d) => g.cellEdges[k][d] >= 0 && s[g.cellEdges[k][d]] === LINE);
    const out = dirs.map((d) => {
      let x = k, len = 0;
      while (true) {
        const e = g.cellEdges[x][d];
        if (e < 0 || s[e] === CROSS) return { len, final: true };
        if (s[e] === UNKNOWN) return { len, final: false };
        x += step[d];
        len++;
      }
    });
    const turn = dirs.length === 2 ? (dirs[0] >> 1) !== (dirs[1] >> 1) : null;
    return { dirs, legs: out, turn };
  }

  return { UNKNOWN, LINE, CROSS, grid, randomTour, legs, settle, lookahead, solve, logicSolve, solvedBy, randomLoop, paths, complete, hints, render, startGame };
})();
