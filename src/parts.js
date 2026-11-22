// Shared engine for "divide the grid into regions" puzzles where regions
// are judged by game rules (Araf, Square Jam, Firumatto, ...). The player
// draws walls on grid lines, like in Galaxies. Exposes the global `Parts`.
//
// A puzzle is { R, C, clues } (clues: Int16Array per cell, 0 = none).
// Game config:
//   maxSize(p)               largest region size
//   grow(p, cells)           optional: false if a growing region can never
//                            become valid (pruning)
//   region(p, cells, id)     true if a finished region is fine; `id` holds
//                            the region number of every cell placed so far
//                            (-1 = open), for rules about neighbours
//   candidates(p, k, id)     optional: list the possible regions whose first
//                            cell is k (instead of growing them)
//   skip(p, k)               optional: cell k may stay outside all regions
//   outside(p, k, id)        optional: false if k may not stay outside now
//   blocked(p, k)            optional: cell k is always outside (black cell)
//   final(p, id)             optional whole-board check
//   split(R, C)              random answer: list of regions (cell lists);
//                            cells in no region stay outside
//   clues(p, regions)        fill p.clues for the answer
//   thin                     false: keep all clues
//   reroll(p, cells)         optional: new random clues for one region
//   moveClues                true: a clue may sit in any cell of its region
//                            (used to make a board unique)
//   cellText(p, k)           text for a clue cell
//   boardSize(n)             optional: board side for menu size n
//   encodeExtra / decodeExtra(p, x), decorate(p, k, g, x, y, s) optional
// Walls: edge e between cells like Loop.grid (horizontal edges first).

const Parts = (() => {
  function nbs(R, C, k) {
    const r = Math.floor(k / C), c = k % C, out = [];
    if (r > 0) out.push(k - C);
    if (r < R - 1) out.push(k + C);
    if (c > 0) out.push(k - 1);
    if (c < C - 1) out.push(k + 1);
    return out;
  }

  // Region number per cell -> wall per edge (1 = wall).
  function wallsOf(R, C, id) {
    const E = R * (C - 1) + (R - 1) * C;
    const w = new Uint8Array(E);
    for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) {
      const a = id[r * C + c], b = id[r * C + c + 1];
      w[r * (C - 1) + c] = a !== b || a < 0 ? 1 : 0;
    }
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C; c++) {
      const a = id[r * C + c], b = id[(r + 1) * C + c];
      w[R * (C - 1) + r * C + c] = a !== b || a < 0 ? 1 : 0;
    }
    return w;
  }

  // Counts solutions (region number per cell, -2 = outside).
  function solve(cfg, p, stopAt = 2, maxNodes = 30000) {
    const N = p.R * p.C;
    const st = { cfg, p, N, id: new Int32Array(N).fill(-1), max: cfg.maxSize(p), out: [], nodes: 0, count: 0, stopAt, maxNodes };
    searchNext(st);
    return { solutions: st.out, capped: st.nodes > maxNodes };
  }

  const enough = (st) => st.out.length >= st.stopAt;

  // Fills the first free cell in every possible way (depth first).
  function searchNext(st) {
    if (enough(st) || ++st.nodes > st.maxNodes) return;
    const { cfg, p, id } = st;
    let k = 0;
    while (k < st.N && id[k] !== -1) k++;
    if (k === st.N) {
      if (!cfg.final || cfg.final(p, id)) st.out.push(Int32Array.from(id));
      return;
    }
    if (cfg.blocked?.(p, k)) { leaveOut(st, k); return; }
    if (cfg.skip?.(p, k) && (!cfg.outside || cfg.outside(p, k, id))) {
      leaveOut(st, k);
      if (enough(st)) return;
    }
    const me = st.count++;
    // A game may list whole regions with k as their first cell.
    if (cfg.candidates) tryCandidates(st, k, me);
    else growFrom(st, k, me);
    st.count--;
  }

  // Cell k belongs to no region (-2); search on.
  function leaveOut(st, k) {
    st.id[k] = -2;
    searchNext(st);
    st.id[k] = -1;
  }

  function tryCandidates(st, k, me) {
    const { cfg, p, id } = st;
    for (const cells of cfg.candidates(p, k, id)) {
      if (cells.some((x) => id[x] !== -1 || (cfg.blocked?.(p, x)))) continue;
      cells.forEach((x) => { id[x] = me; });
      if (cfg.region(p, cells, id)) searchNext(st);
      cells.forEach((x) => { id[x] = -1; });
      if (enough(st)) break;
    }
  }

  // Grow connected regions that contain k (k is their first cell).
  function growFrom(st, k, me) {
    st.id[k] = me;
    grow(st, k, me, [k], new Set());
    st.id[k] = -1;
  }

  function grow(st, k, me, cells, seen) {
    if (enough(st) || st.nodes > st.maxNodes) return;
    const { cfg, p, id } = st;
    const key = cells.slice().sort((a, b) => a - b).join(',');
    if (seen.has(key)) return;
    seen.add(key);
    if (cfg.grow && !cfg.grow(p, cells)) return;
    if (cfg.region(p, cells, id)) searchNext(st);
    if (cells.length >= st.max) return;
    for (const j of frontier(st, cells, k)) {
      cells.push(j); id[j] = me;
      grow(st, k, me, cells, seen);
      cells.pop(); id[j] = -1;
      if (enough(st)) return;
    }
  }

  // Free cells next to the region (after k, not blocked).
  function frontier(st, cells, k) {
    const { cfg, p, id } = st;
    const front = new Set();
    for (const x of cells) for (const j of nbs(p.R, p.C, x)) if (id[j] === -1 && j > k && !(cfg.blocked?.(p, j))) front.add(j);
    return front;
  }

  // Edges next to a blocked cell are walls from the start.
  function fixedEdges(cfg, p) {
    if (!cfg.blocked) return [];
    const { R, C } = p;
    const out = [];
    const either = (a, b) => cfg.blocked(p, a) || cfg.blocked(p, b);
    for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) if (either(r * C + c, r * C + c + 1)) out.push(r * (C - 1) + c);
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C; c++) if (either(r * C + c, (r + 1) * C + c)) out.push(R * (C - 1) + r * C + c);
    return out;
  }

  function unique(cfg, p, maxNodes = 30000) {
    const r = solve(cfg, p, 2, maxNodes);
    return r.solutions.length === 1 && !r.capped ? r.solutions[0] : null;
  }

  function generate(cfg, n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const p = generateOnce(cfg, n, deadline);
      if (p) return p;
    }
    return null;
  }

  // One try: regions, clues, a unique answer. Returns the puzzle or null.
  function generateOnce(cfg, n, deadline) {
    const R = n, C = n;
    const regions = cfg.split(R, C);
    if (!regions) return null;
    const p = { R, C, clues: new Int16Array(R * C) };
    if (cfg.clues(p, regions) === false) return null;
    let r = solve(cfg, p, 2, 30000);
    if (cfg.moveClues) r = fixByMovingClues(cfg, p, regions, r, deadline);
    if (cfg.reroll) r = fixByReroll(cfg, p, regions, r, deadline);
    let sol = r.solutions.length === 1 && !r.capped ? r.solutions[0] : null;
    if (!sol) return null;
    if (cfg.thin !== false) sol = thinClues(cfg, p, sol);
    p.solution = sol;
    p.walls = wallsOf(R, C, sol);
    return p;
  }

  // Region number of each cell in the generated answer (-2: none).
  function answerIds(p, regions) {
    const ans = new Int32Array(p.R * p.C).fill(-2);
    regions.forEach((cells, i) => cells.forEach((x) => { ans[x] = i; }));
    return ans;
  }

  const twoAnswers = (r) => !r.capped && r.solutions.length === 2;

  // A second answer: move a clue inside its region to a cell where the
  // other answer differs (only for games whose clue value does not
  // depend on its cell). Repeat while that helps.
  function fixByMovingClues(cfg, p, regions, r, deadline) {
    const ans = answerIds(p, regions);
    for (let fix = 0; fix < 40 && twoAnswers(r) && Date.now() < deadline; fix++) {
      const other = r.solutions.find((x) => x.some((v, k) => (v === -2) !== (ans[k] === -2) || (v >= 0 && ans[k] >= 0 && x[k] !== x[regions[ans[k]][0]])));
      if (!other || !moveOneClue(p, regions, other)) break;
      r = solve(cfg, p, 2, 30000);
    }
    return r;
  }

  // Moves one clue to a cell of its region where `other` differs.
  function moveOneClue(p, regions, other) {
    for (const cells of PuzzleShell.shuffle(regions.slice())) {
      const at = cells.find((x) => p.clues[x]);
      const to = cells.filter((x) => x !== at && other[x] !== other[at]);
      if (!to.length) continue;
      const x = to[Math.floor(Math.random() * to.length)];
      p.clues[x] = p.clues[at];
      p.clues[at] = 0;
      return true;
    }
    return false;
  }

  // Or re-roll the clues of one region that the other answer splits.
  function fixByReroll(cfg, p, regions, r, deadline) {
    const ans = answerIds(p, regions);
    for (let fix = 0; fix < 40 && twoAnswers(r) && Date.now() < deadline; fix++) {
      const other = r.solutions.find((x) => x.some((v, k) => ans[k] >= 0 && x[k] !== x[regions[ans[k]][0]]));
      if (!other) break;
      const bad = regions.filter((cells) => cells.some((x) => other[x] !== other[cells[0]]));
      cfg.reroll(p, bad[Math.floor(Math.random() * bad.length)]);
      r = solve(cfg, p, 2, 30000);
    }
    return r;
  }

  // Thin clues within a time budget; extra clues are fine. Returns the answer.
  function thinClues(cfg, p, sol) {
    const stop = Date.now() + 1500;
    for (const k of PuzzleShell.shuffle([...new Array(p.R * p.C).keys()])) {
      if (!p.clues[k]) continue;
      const keep = p.clues[k];
      p.clues[k] = 0;
      const s2 = unique(cfg, p);
      if (s2) sol = s2; else p.clues[k] = keep;
      if (Date.now() > stop) break;
    }
    return sol;
  }

  const NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // Result marks of a wall edge: right, wrong, or not drawn yet.
  function resultEdgeClass(cls, wall, mine, isFixed) {
    if (!wall && mine) return 'gx-wall bad';
    if (isFixed) return cls;
    if (mine) return cls + ' ok';
    return wall ? cls + ' miss' : cls;
  }

  function render(cfg, p, state, opts = {}) {
    const { R, C, walls } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(26, Math.min(46, Math.floor((Math.min(window.innerWidth, 900) - 40) / C)));
    const svg = el('svg', { width: C * s + 4, height: R * s + 4, class: 'gx-board pt-board' + (readonly ? ' readonly' : '') });
    const g = el('g', { transform: 'translate(2 2)' }, svg);
    el('rect', { x: 0, y: 0, width: C * s, height: R * s, class: 'gx-bg' }, g);
    // Cells outside all regions (in the solution view) are shaded.
    if (result) drawOutside(p, g, s);
    const hintSet = new Set(hint ? hint.edges : []);
    const fixed = new Set(fixedEdges(cfg, p));
    // Class of edge e: wall or grid, with the result marks.
    const edgeClass = (e) => {
      const wall = result ? walls[e] : state[e];
      let cls = wall ? 'gx-wall' : 'gx-grid';
      if (result) cls = resultEdgeClass(cls, walls[e], state[e], fixed.has(e));
      return hintSet.has(e) ? cls + ' hint' : cls;
    };
    for (const [e, x1, y1, x2, y2] of edgeLines(R, C, s)) {
      el('line', { x1, y1, x2, y2, class: edgeClass(e) }, g);
      if (!readonly && !fixed.has(e)) {
        const hit = el('line', { x1, y1, x2, y2, class: 'gx-hit', 'stroke-width': s * 0.35 }, g);
        hit.addEventListener('click', () => { state[e] = state[e] ? 0 : 1; onChange(); });
      }
    }
    el('rect', { x: 0, y: 0, width: C * s, height: R * s, class: 'gx-frame' }, g);
    drawClues(cfg, p, g, s);
    return svg;
  }

  // Every edge with its line: [e, x1, y1, x2, y2] for cell size s.
  function edgeLines(R, C, s) {
    const edges = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) edges.push([r * (C - 1) + c, (c + 1) * s, r * s, (c + 1) * s, (r + 1) * s]);
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C; c++) edges.push([R * (C - 1) + r * C + c, c * s, (r + 1) * s, (c + 1) * s, (r + 1) * s]);
    return edges;
  }

  // Shaded cells: outside all regions in the answer.
  function drawOutside(p, g, s) {
    for (let k = 0; k < p.R * p.C; k++) {
      if (p.solution[k] === -2) el('rect', { x: (k % p.C) * s, y: Math.floor(k / p.C) * s, width: s, height: s, class: 'pt-out' }, g);
    }
  }

  // Clue texts and the game's own marks in the cells.
  function drawClues(cfg, p, g, s) {
    for (let k = 0; k < p.R * p.C; k++) {
      const x = (k % p.C) * s + s / 2, y = Math.floor(k / p.C) * s + s / 2;
      if (cfg.decorate) cfg.decorate(p, k, g, x, y, s);
      const text = p.clues[k] ? cfg.cellText(p, k) : '';
      if (text !== '') el('text', { x, y, 'font-size': s * 0.42, class: 'pt-clue' }, g).textContent = text;
    }
  }

  function hints(p, state) {
    for (let e = 0; e < state.length; e++) if (state[e] && !p.walls[e]) return [{ edges: [e], v: 0, reason: 'This wall is wrong: the cells on both sides belong to the same region.' }];
    const e = p.walls.findIndex((v, i) => v && !state[i]);
    return e < 0 ? [] : [{ edges: [e], v: 1, reason: 'No simple step is shown here. A wall of the answer goes here.' }];
  }

  function startGame(cfg) {
    PuzzleShell.start({
      id: cfg.id, name: cfg.name, rules: cfg.rules, info: cfg.info, size: cfg.size, solvedText: cfg.solvedText,
      controls: 'Click a grid line between two cells to draw a wall, click again to remove it.',
      generate: (n) => generate(cfg, cfg.boardSize ? cfg.boardSize(n) : n),
      encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues).join(','), x: cfg.encodeExtra ? cfg.encodeExtra(p) : undefined }),
      decode(d) {
        const R = d?.r, C = d?.c;
        if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
        const clues = Int16Array.from(String(d.g).split(','), Number);
        if (clues.length !== R * C) throw new Error('Invalid clues');
        const p = { R, C, clues };
        if (cfg.decodeExtra) cfg.decodeExtra(p, d.x);
        const res = solve(cfg, p, 2, 80000);
        if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
        p.solution = res.solutions[0];
        p.walls = wallsOf(R, C, p.solution);
        return p;
      },
      newState(p) {
        const s = new Uint8Array(p.walls.length);
        for (const e of fixedEdges(cfg, p)) s[e] = 1;
        return s;
      },
      saveState: (s) => Array.from(s).join(''),
      loadState(p, v) {
        const s = new Uint8Array(p.walls.length);
        if (typeof v === 'string' && v.length === s.length) for (let i = 0; i < s.length; i++) s[i] = v[i] === '1' ? 1 : 0;
        for (const e of fixedEdges(cfg, p)) s[e] = 1;
        return s;
      },
      render: (p, s, opts) => render(cfg, p, s, opts),
      // Fixed walls (around black cells) can not be clicked: not checked.
      check: (p, s) => { const f = new Set(fixedEdges(cfg, p)); return s.every((v, e) => f.has(e) || v === p.walls[e]); },
      hints,
      applyHint(p, s, h) { for (const e of h.edges) s[e] = h.v; },
    });
  }

  // Helpers for games: random partition by growing regions to target sizes.
  function randomSplit(R, C, sizeFn) {
    const N = R * C;
    const id = new Int32Array(N).fill(-1);
    const regions = [];
    for (let k = 0; k < N; k++) {
      if (id[k] >= 0) continue;
      const want = sizeFn();
      const cells = [k];
      id[k] = regions.length;
      for (let g = 0; g < 40 && cells.length < want; g++) {
        const x = cells[Math.floor(Math.random() * cells.length)];
        const opts = nbs(R, C, x).filter((j) => id[j] < 0);
        if (!opts.length) continue;
        const j = opts[Math.floor(Math.random() * opts.length)];
        id[j] = regions.length;
        cells.push(j);
      }
      regions.push(cells);
    }
    return regions;
  }

  return { solve, unique, wallsOf, nbs, randomSplit, startGame };
})();
