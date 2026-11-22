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
    const { R, C } = p;
    const N = R * C;
    const id = new Int32Array(N).fill(-1);
    const max = cfg.maxSize(p);
    const out = [];
    let nodes = 0, count = 0;
    (function rec() {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      let k = 0;
      while (k < N && id[k] !== -1) k++;
      if (k === N) {
        if (!cfg.final || cfg.final(p, id)) out.push(Int32Array.from(id));
        return;
      }
      if (cfg.blocked?.(p, k)) {
        id[k] = -2;
        rec();
        id[k] = -1;
        return;
      }
      if (cfg.skip?.(p, k) && (!cfg.outside || cfg.outside(p, k, id))) {
        id[k] = -2;
        rec();
        id[k] = -1;
        if (out.length >= stopAt) return;
      }
      const me = count++;
      // A game may list whole regions with k as their first cell.
      if (cfg.candidates) {
        for (const cells of cfg.candidates(p, k, id)) {
          if (cells.some((x) => id[x] !== -1 || (cfg.blocked?.(p, x)))) continue;
          cells.forEach((x) => { id[x] = me; });
          if (cfg.region(p, cells, id)) rec();
          cells.forEach((x) => { id[x] = -1; });
          if (out.length >= stopAt) break;
        }
        count--;
        return;
      }
      // Grow connected regions that contain k (k is their first cell).
      const cells = [k];
      id[k] = me;
      const seen = new Set();
      (function grow() {
        if (out.length >= stopAt || nodes > maxNodes) return;
        const key = cells.slice().sort((a, b) => a - b).join(',');
        if (seen.has(key)) return;
        seen.add(key);
        if (cfg.grow && !cfg.grow(p, cells)) return;
        if (cfg.region(p, cells, id)) rec();
        if (cells.length >= max) return;
        const front = new Set();
        for (const x of cells) for (const j of nbs(R, C, x)) if (id[j] === -1 && j > k && !(cfg.blocked?.(p, j))) front.add(j);
        for (const j of front) {
          cells.push(j); id[j] = me;
          grow();
          cells.pop(); id[j] = -1;
          if (out.length >= stopAt) return;
        }
      })();
      id[k] = -1;
      count--;
    })();
    return { solutions: out, capped: nodes > maxNodes };
  }

  // Edges next to a blocked cell are walls from the start.
  function fixedEdges(cfg, p) {
    if (!cfg.blocked) return [];
    const { R, C } = p;
    const out = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) if (cfg.blocked(p, r * C + c) || cfg.blocked(p, r * C + c + 1)) out.push(r * (C - 1) + c);
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C; c++) if (cfg.blocked(p, r * C + c) || cfg.blocked(p, (r + 1) * C + c)) out.push(R * (C - 1) + r * C + c);
    return out;
  }

  function unique(cfg, p, maxNodes = 30000) {
    const r = solve(cfg, p, 2, maxNodes);
    return r.solutions.length === 1 && !r.capped ? r.solutions[0] : null;
  }

  function generate(cfg, n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n;
      const regions = cfg.split(R, C);
      if (!regions) continue;
      const p = { R, C, clues: new Int16Array(R * C) };
      if (cfg.clues(p, regions) === false) continue;
      let r = solve(cfg, p, 2, 30000);
      // A second answer: move a clue inside its region to a cell where the
      // other answer differs (only for games whose clue value does not
      // depend on its cell). Repeat while that helps.
      if (cfg.moveClues && !r.capped && r.solutions.length === 2) {
        const ans = new Int32Array(R * C).fill(-2);
        regions.forEach((cells, i) => cells.forEach((x) => { ans[x] = i; }));
        for (let fix = 0; fix < 40 && !r.capped && r.solutions.length === 2 && Date.now() < deadline; fix++) {
          const other = r.solutions.find((x) => x.some((v, k) => (v === -2) !== (ans[k] === -2) || (v >= 0 && ans[k] >= 0 && x[k] !== x[regions[ans[k]][0]])));
          if (!other) break;
          let moved = false;
          for (const cells of PuzzleShell.shuffle(regions.slice())) {
            const at = cells.find((x) => p.clues[x]);
            const to = cells.filter((x) => x !== at && other[x] !== other[at]);
            if (!to.length) continue;
            const x = to[Math.floor(Math.random() * to.length)];
            p.clues[x] = p.clues[at];
            p.clues[at] = 0;
            moved = true;
            break;
          }
          if (!moved) break;
          r = solve(cfg, p, 2, 30000);
        }
      }
      // Or re-roll the clues of one region that the other answer splits.
      if (cfg.reroll && !r.capped && r.solutions.length === 2) {
        const ans = new Int32Array(R * C).fill(-2);
        regions.forEach((cells, i) => cells.forEach((x) => { ans[x] = i; }));
        for (let fix = 0; fix < 40 && !r.capped && r.solutions.length === 2 && Date.now() < deadline; fix++) {
          const other = r.solutions.find((x) => x.some((v, k) => ans[k] >= 0 && x[k] !== x[regions[ans[k]][0]]));
          if (!other) break;
          const bad = regions.filter((cells) => cells.some((x) => other[x] !== other[cells[0]]));
          cfg.reroll(p, bad[Math.floor(Math.random() * bad.length)]);
          r = solve(cfg, p, 2, 30000);
        }
      }
      let sol = r.solutions.length === 1 && !r.capped ? r.solutions[0] : null;
      if (!sol) continue;
      if (cfg.thin !== false) {
        // Thin clues within a time budget; extra clues are fine.
        const stop = Date.now() + 1500;
        for (const k of PuzzleShell.shuffle([...new Array(R * C).keys()])) {
          if (!p.clues[k]) continue;
          const keep = p.clues[k];
          p.clues[k] = 0;
          const s2 = unique(cfg, p);
          if (s2) sol = s2; else p.clues[k] = keep;
          if (Date.now() > stop) break;
        }
      }
      p.solution = sol;
      p.walls = wallsOf(R, C, sol);
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

  function render(cfg, p, state, opts = {}) {
    const { R, C, walls } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(26, Math.min(46, Math.floor((Math.min(window.innerWidth, 900) - 40) / C)));
    const svg = el('svg', { width: C * s + 4, height: R * s + 4, class: 'gx-board pt-board' + (readonly ? ' readonly' : '') });
    const g = el('g', { transform: 'translate(2 2)' }, svg);
    el('rect', { x: 0, y: 0, width: C * s, height: R * s, class: 'gx-bg' }, g);
    // Cells outside all regions (in the solution view) are shaded.
    if (result) for (let k = 0; k < R * C; k++) if (p.solution[k] === -2) el('rect', { x: (k % C) * s, y: Math.floor(k / C) * s, width: s, height: s, class: 'pt-out' }, g);
    const hintSet = new Set(hint ? hint.edges : []);
    const fixed = new Set(fixedEdges(cfg, p));
    const edges = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) edges.push([r * (C - 1) + c, (c + 1) * s, r * s, (c + 1) * s, (r + 1) * s]);
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C; c++) edges.push([R * (C - 1) + r * C + c, c * s, (r + 1) * s, (c + 1) * s, (r + 1) * s]);
    for (const [e, x1, y1, x2, y2] of edges) {
      const v = result ? walls[e] : state[e];
      let cls = v ? 'gx-wall' : 'gx-grid';
      if (result && state[e] && !fixed.has(e)) cls += walls[e] ? ' ok' : ' bad';
      if (result && !walls[e] && state[e]) cls = 'gx-wall bad';
      if (result && walls[e] && !state[e] && !fixed.has(e)) cls += ' miss'; // not drawn yet
      if (hintSet.has(e)) cls += ' hint';
      el('line', { x1, y1, x2, y2, class: cls }, g);
      if (!readonly && !fixed.has(e)) {
        const hit = el('line', { x1, y1, x2, y2, class: 'gx-hit', 'stroke-width': s * 0.35 }, g);
        hit.addEventListener('click', () => { state[e] = state[e] ? 0 : 1; onChange(); });
      }
    }
    el('rect', { x: 0, y: 0, width: C * s, height: R * s, class: 'gx-frame' }, g);
    for (let k = 0; k < R * C; k++) {
      const x = (k % C) * s + s / 2, y = Math.floor(k / C) * s + s / 2;
      if (cfg.decorate) cfg.decorate(p, k, g, x, y, s);
      const text = p.clues[k] ? cfg.cellText(p, k) : '';
      if (text === '') continue;
      const t = el('text', { x, y, 'font-size': s * 0.42, class: 'pt-clue' }, g);
      t.textContent = text;
    }
    return svg;
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
