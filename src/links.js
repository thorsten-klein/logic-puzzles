// Shared engine for "connect pairs with lines" puzzles (Arukone,
// Mintonette, ...). Lines run between cell centres like in Loop, but
// they form open paths: each path joins two end cells. Uses Loop.grid
// and Loop.render for the board. Exposes the global `Links`.
//
// A model is { g, label, fill, rule }:
//   label[k]  -1 plain cell, 0 end cell that may pair with any end,
//             v > 0 end cell that pairs with the other end labelled v
//   fill      every cell must be on a path
//   rule(s, log)  optional game rule: false, 0, or number of edges set
// Edge states: 0 unknown, 1 line, 2 cross.

const Links = (() => {
  const { UNKNOWN, LINE, CROSS } = Loop;

  // Degree rules per cell: end cells have one line, others 0 or 2.
  function cellStep(m, s, log) {
    const { g, label, fill } = m;
    let set = 0;
    for (let k = 0; k < g.R * g.C; k++) {
      const es = g.cellEdges[k].filter((e) => e >= 0);
      const lines = es.filter((e) => s[e] === LINE).length;
      const open = es.filter((e) => s[e] === UNKNOWN);
      const isEnd = label[k] >= 0;
      let v = 0, why = '';
      if (isEnd) {
        if (lines > 1 || (!lines && !open.length)) return false;
        if (!open.length) continue;
        if (lines === 1) { v = CROSS; why = 'An end cell has exactly one line, and it has it.'; }
        else if (open.length === 1) { v = LINE; why = 'An end cell needs one line, and only this side is open.'; }
      } else {
        if (lines > 2 || (lines === 1 && !open.length)) return false;
        if (fill && lines + open.length < 2) return false;
        if (!open.length) continue;
        if (lines === 2) { v = CROSS; why = 'This cell already has two lines.'; }
        else if (lines === 1 && open.length === 1) { v = LINE; why = 'The line must go on, and this is its only way out.'; }
        else if (lines === 0 && open.length === 1) { v = CROSS; why = 'A line can not end here, and this cell has only one open side.'; }
        else if (fill && lines + open.length === 2) { v = LINE; why = 'Every cell is used, and this cell has only these two sides open.'; }
      }
      if (!v) continue;
      for (const e of open) s[e] = v;
      set += open.length;
      if (log) { log.push({ edges: open, v, reason: why, at: k }); return set; }
    }
    return set;
  }

  // Path pieces: cells joined by lines. For each piece its end labels.
  function pieces(m, s) {
    const { g, label } = m;
    const N = g.R * g.C;
    const id = new Int32Array(N).fill(-1);
    const list = [];
    for (let k = 0; k < N; k++) {
      if (id[k] >= 0) continue;
      const cells = [k];
      id[k] = list.length;
      let edges = 0;
      for (let i = 0; i < cells.length; i++) {
        for (const e of g.cellEdges[cells[i]]) {
          if (e < 0 || s[e] !== LINE) continue;
          edges++;
          const [a, b] = g.ends[e];
          const j = a === cells[i] ? b : a;
          if (id[j] < 0) { id[j] = list.length; cells.push(j); }
        }
      }
      const ends = cells.filter((x) => label[x] >= 0);
      list.push({ cells, ends, loop: edges / 2 >= cells.length });
    }
    return { id, list };
  }

  // Labels of the ends of a piece must allow one pairing.
  function labelsFit(m, ends) {
    if (ends.length > 2) return false;
    if (ends.length < 2) return true;
    const [a, b] = ends.map((k) => m.label[k]);
    return !a || !b || a === b;
  }

  function pathStep(m, s, log) {
    const { g } = m;
    const { id, list } = pieces(m, s);
    for (const pc of list) {
      if (pc.loop) return false;
      if (!labelsFit(m, pc.ends)) return false;
    }
    for (let e = 0; e < g.E; e++) {
      if (s[e] !== UNKNOWN) continue;
      const [a, b] = g.ends[e];
      let why = '';
      if (id[a] === id[b]) why = 'A line here would close a loop. Lines run from end to end.';
      else {
        const ends = [...list[id[a]].ends, ...list[id[b]].ends];
        if (!labelsFit(m, ends)) why = ends.length > 2 ? 'A line here would join more than two ends.' : 'A line here would join two different numbers.';
        // A finished path (two ends) can not grow.
        else if (list[id[a]].ends.length === 2 && list[id[a]].cells.length > 1) why = 'That path is already finished.';
        else if (list[id[b]].ends.length === 2 && list[id[b]].cells.length > 1) why = 'That path is already finished.';
      }
      if (!why) continue;
      s[e] = CROSS;
      if (log) { log.push({ edges: [e], v: CROSS, reason: why }); return 1; }
      return 1;
    }
    return 0;
  }

  function settle(m, s, log) {
    for (let guard = 0; guard < 10000; guard++) {
      let r = cellStep(m, s, log);
      if (r === false) return false;
      if (r) { if (log) return true; continue; }
      if (m.rule) {
        r = m.rule(s, log);
        if (r === false) return false;
        if (r) { if (log) return true; continue; }
      }
      r = pathStep(m, s, log);
      if (r === false) return false;
      if (r) { if (log) return true; continue; }
      return true;
    }
    return true; // safety limit reached
  }

  // Full answer check: every piece with lines is a path between two ends.
  function complete(m, s) {
    const { list } = pieces(m, s);
    for (const pc of list) {
      if (pc.loop) return false;
      if (pc.cells.length === 1) {
        if (m.label[pc.cells[0]] >= 0) return false;
        if (m.fill) return false;
        continue;
      }
      if (pc.ends.length !== 2 || !labelsFit(m, pc.ends)) return false;
    }
    return true;
  }

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
      let pick = -1;
      for (let e = 0; e < m.g.E && pick < 0; e++) {
        if (s[e] !== UNKNOWN) continue;
        const [a, b] = m.g.ends[e];
        const touches = (k) => m.label[k] >= 0 || m.g.cellEdges[k].some((x) => x >= 0 && s[x] === LINE);
        if (touches(a) || touches(b)) pick = e;
      }
      if (pick < 0) pick = s.indexOf(UNKNOWN);
      if (pick < 0) {
        const t = Uint8Array.from(s, (v) => (v === LINE ? LINE : CROSS));
        if (complete(m, t) && (m.rule?.(t) !== false)) solutions.push(t);
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

  function logicSolve(m) {
    const s = new Uint8Array(m.g.E);
    for (;;) {
      if (!settle(m, s)) return null;
      if (!lookahead(m, s)) return s;
    }
  }

  const solvedBy = (s) => s && !s.includes(UNKNOWN);

  // Unique by logic, else proven by the full solver.
  function unique(m, maxNodes = 4000) {
    const t = logicSolve(m);
    if (!t) return false;
    if (solvedBy(t)) return complete(m, t);
    const r = solve(m, 2, maxNodes, t);
    return r.solutions.length === 1 && !r.capped;
  }

  // Random paths covering the grid: a random tour cut into pieces of
  // `minLen`..`maxLen` cells. Returns { state, paths } (paths: cell lists).
  function randomPaths(n, minLen = 3, maxLen = 8) {
    const tour = Loop.randomTour(n);
    const g = Loop.grid(n, n);
    const step = [-n, n, -1, 1];
    const order = [];
    let x = 0, from = -1;
    do {
      order.push(x);
      const d = [0, 1, 2, 3].find((q) => q !== from && g.cellEdges[x][q] >= 0 && tour[g.cellEdges[x][q]] === LINE);
      x += step[d];
      from = d ^ 1;
    } while (x !== 0);
    // Start the cut at a random point of the tour.
    const shift = Math.floor(Math.random() * order.length);
    const ring = order.slice(shift).concat(order.slice(0, shift));
    const paths = [];
    for (let i = 0; i < ring.length;) {
      let len = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
      if (ring.length - (i + len) < minLen) len = ring.length - i;
      paths.push(ring.slice(i, i + len));
      i += len;
    }
    const state = new Uint8Array(g.E).fill(CROSS);
    const edgeOf = new Map();
    for (let e = 0; e < g.E; e++) edgeOf.set(g.ends[e].join(','), e);
    for (const path of paths) {
      for (let i = 0; i + 1 < path.length; i++) {
        const [a, b] = [path[i], path[i + 1]].sort((u, v) => u - v);
        state[edgeOf.get(a + ',' + b)] = LINE;
      }
    }
    return { state, paths };
  }

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
    if (e >= 0) out.push({ edges: [e], v: LINE, reason: 'No simple step is left. Here is one line.' });
    return out;
  }

  // cfg: id, name, rules, size, solvedText, generate, encode, decode,
  //      model(p), drawCell(p) like in Loop.
  function startGame(cfg) {
    PuzzleShell.start({
      id: cfg.id, name: cfg.name, rules: cfg.rules, size: cfg.size, solvedText: cfg.solvedText,
      controls: 'Click between two cells to draw a line, click again for a cross, again to clear. Right click cycles the other way.',
      generate: cfg.generate,
      encode: cfg.encode,
      decode(d) {
        const p = cfg.decode(d);
        const m = cfg.model(p);
        const t = logicSolve(m);
        if (t && solvedBy(t) && complete(m, t)) { p.solution = Uint8Array.from(t); return p; }
        const res = solve(m, 2, 50000, t);
        if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
        p.solution = res.solutions[0];
        return p;
      },
      newState: (p) => new Uint8Array(Loop.grid(p.R, p.C).E),
      saveState: (s) => Array.from(s).join(''),
      loadState(p, v) {
        const s = new Uint8Array(Loop.grid(p.R, p.C).E);
        if (typeof v === 'string' && v.length === s.length) for (let i = 0; i < s.length; i++) s[i] = Number(v[i]) % 3;
        return s;
      },
      render: (p, s, opts) => Loop.render(cfg.model(p), s, { ...opts, solution: p.solution, fixed: [] },
        cfg.drawCell ? cfg.drawCell(p) : null, true),
      check(p, s) {
        const m = cfg.model(p);
        const t = Uint8Array.from(s, (v) => (v === LINE ? LINE : CROSS));
        return complete(m, t) && settle(m, t);
      },
      hints: (p, s) => hints(cfg.model(p), s, p.solution),
      applyHint(p, s, h) { for (const e of h.edges) s[e] = h.v; },
    });
  }

  return { settle, solve, logicSolve, solvedBy, unique, complete, randomPaths, startGame, pieces };
})();
