// Shared engine for arrow-flow puzzles (Roma, Arofuro). Every empty cell
// gets an arrow (1 up, 2 down, 3 left, 4 right). Following the arrows from
// any cell always ends at a goal cell (p.circle). Candidates are bitmasks
// (bit v). Exposes the global `Flow`.
//
// A game passes a cfg with its own parts:
//   rule(p, cand)       its own rule on the candidates; false = broken
//   accept(p, val)      optional: a full answer also fits this
//   prepare(p)          sets p.circle (and game data) from the board
//   why                 text: why a single arrow fits (for hints)
//   goalCell(p, k, el)  draws a goal cell
//   className           board class

const Flow = (() => {
  const GLYPH = ['', '↑', '↓', '←', '→'];
  const STEP = [null, [-1, 0], [1, 0], [0, -1], [0, 1]];
  // Icon turn per arrow value (see PuzzleShell.arrowIcon).
  const TURN = [0, 0, 4, 6, 2];
  const ALL = 0b11110;
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);
  const has = (m, v) => m & (1 << v);

  // The cell arrow v at k points to, or -1 off the grid.
  const target = (p, k, v) => {
    const r = Math.floor(k / p.C) + STEP[v][0], c = (k % p.C) + STEP[v][1];
    return r >= 0 && c >= 0 && r < p.R && c < p.C ? r * p.C + c : -1;
  };

  // Cells next to k (up, down, left, right).
  function sides(p, k) {
    const r = Math.floor(k / p.C), c = k % p.C, out = [];
    for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      if (a >= 0 && b >= 0 && a < p.R && b < p.C) out.push(a * p.C + b);
    }
    return out;
  }

  // Arrows may not leave the grid, and two cells may not point at each other.
  function pointRule(p, cand) {
    for (let k = 0; k < cand.length; k++) {
      if (p.circle[k]) continue;
      for (let v = 1; v <= 4; v++) {
        if (!has(cand[k], v)) continue;
        const t = target(p, k, v);
        if (t < 0 || (!p.circle[t] && one(cand[t]) && target(p, t, low(cand[t])) === k)) cand[k] &= ~(1 << v);
      }
      if (!cand[k]) return false;
    }
    return true;
  }

  // Cells that can still reach a goal.
  function reachable(p, cand) {
    const good = Uint8Array.from(p.circle);
    const leadsOn = (k) => [1, 2, 3, 4].some((v) => has(cand[k], v) && good[target(p, k, v)]);
    for (let changed = true; changed;) {
      changed = false;
      for (let k = 0; k < cand.length; k++) {
        if (!good[k] && leadsOn(k)) { good[k] = 1; changed = true; }
      }
    }
    return good;
  }

  // An arrow may only point at a cell that can still reach a goal.
  function reachRule(p, cand) {
    const good = reachable(p, cand);
    for (let k = 0; k < cand.length; k++) {
      if (p.circle[k]) continue;
      for (let v = 1; v <= 4; v++) {
        const t = target(p, k, v);
        if (has(cand[k], v) && (t < 0 || !good[t])) cand[k] &= ~(1 << v);
      }
      if (!cand[k]) return false;
    }
    return true;
  }

  // No loops among fixed arrows.
  function loopFree(p, cand) {
    const N = cand.length;
    for (let k = 0; k < N; k++) {
      if (p.circle[k] || !one(cand[k])) continue;
      let x = k;
      for (let step = 0; step <= N && !p.circle[x] && one(cand[x]); step++) {
        x = target(p, x, low(cand[x]));
        if (x === k) return false;
      }
    }
    return true;
  }

  // All rules until nothing changes. False on a contradiction.
  function propagate(cfg, p, cand) {
    for (let guard = 0; guard < 200; guard++) {
      const before = cand.join(',');
      if (!pointRule(p, cand) || cfg.rule(p, cand) === false) return false;
      if (cand.some((m, k) => !p.circle[k] && !m)) return false;
      if (!reachRule(p, cand) || !loopFree(p, cand)) return false;
      if (cand.join(',') === before) return true;
    }
    return true;
  }

  function solve(cfg, p, start, stopAt = 2, maxNodes = 20000) {
    const out = [];
    let nodes = 0;
    (function rec(cand) {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      if (!propagate(cfg, p, cand)) return;
      const k = cand.findIndex((m, i) => !p.circle[i] && !one(m));
      if (k < 0) {
        const val = Int8Array.from(cand, (m, i) => (p.circle[i] ? 0 : low(m)));
        if (!cfg.accept || cfg.accept(p, val)) out.push(val);
        return;
      }
      for (let v = 1; v <= 4; v++) {
        if (!has(cand[k], v)) continue;
        const t = Int32Array.from(cand); t[k] = 1 << v; rec(t);
      }
    })(Int32Array.from(start));
    return { solutions: out, capped: nodes > maxNodes };
  }

  const startCand = (p, given) => Int32Array.from({ length: p.R * p.C }, (_, k) => {
    if (p.circle[k]) return 0;
    if (given[k]) return 1 << given[k];
    return ALL;
  });

  // Unique answer for the givens, within maxNodes.
  function unique(cfg, p, maxNodes) {
    const r = solve(cfg, p, startCand(p, p.given), 2, maxNodes);
    return r.solutions.length === 1 && !r.capped;
  }

  // Generator helper: n goal cells at random.
  function randomGoals(R, C, count) {
    const circle = new Uint8Array(R * C);
    for (const k of PuzzleShell.shuffle([...circle.keys()]).slice(0, count)) circle[k] = 1;
    return circle;
  }

  // Generator helper: a random arrow forest grown out from the goals.
  // `ok(k, v, arrow)` can forbid arrow v at cell k. Returns the arrows, or null if some
  // cell stays empty.
  function arrowForest(R, C, circle, ok = () => true, steps = Infinity) {
    const N = R * C;
    const p = { R, C };
    const arrow = new Int8Array(N);
    const done = Uint8Array.from(circle);
    let front = [...circle.keys()].filter((k) => circle[k]);
    // Arrow that points from cell j back to k.
    const back = (j, k) => [1, 2, 3, 4].find((v) => target(p, j, v) === k);
    for (let guard = 0; front.length && guard < steps; guard++) {
      const k = front[Math.floor(Math.random() * front.length)];
      const opts = sides(p, k).filter((j) => !done[j] && ok(j, back(j, k), arrow));
      if (!opts.length) { front = front.filter((x) => x !== k); continue; }
      const j = opts[Math.floor(Math.random() * opts.length)];
      arrow[j] = back(j, k);
      done[j] = 1;
      front.push(j);
    }
    return done.every(Boolean) ? arrow : null;
  }

  // Generator helper: givens where another answer differs, then drop
  // the ones not needed. Returns false if it stays not unique.
  function setGivens(cfg, p, arrow, { fixNodes, nodes, until = Infinity }) {
    p.given = new Int8Array(p.R * p.C);
    PuzzleShell.addGivens(p.given, arrow, () => solve(cfg, p, startCand(p, p.given), 2, fixNodes), { skip: (k) => p.circle[k], until });
    const isUnique = () => unique(cfg, p, nodes);
    if (!isUnique()) return false;
    PuzzleShell.dropGivens(p.given, isUnique, { until: until + 3000 });
    return true;
  }

  // Hints: a wrong arrow, then a cell where only one arrow fits, then
  // the answer at the first empty cell.
  function hints(cfg, p, entries) {
    const val = Int8Array.from(entries, (v, k) => p.given[k] || v);
    for (let k = 0; k < val.length; k++) if (entries[k] && !p.given[k] && entries[k] !== p.solution[k]) return [{ cells: [k], v: 0, reason: 'This arrow is wrong.' }];
    const cand = startCand(p, val);
    propagate(cfg, p, cand);
    for (let k = 0; k < val.length; k++) {
      if (p.circle[k] || val[k] || !one(cand[k])) continue;
      return [{ cells: [k], v: low(cand[k]), reason: `Only ${GLYPH[low(cand[k])]} fits here: ${cfg.why}, and arrows may not leave the grid or run in a loop.` }];
    }
    const k = [...val.keys()].find((i) => !p.circle[i] && !val[i]);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This arrow is ${GLYPH[p.solution[k]]}.` }];
  }

  function render(cfg, p, entries, opts = {}) {
    const { R, C, circle, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 44), className: cfg.className, readonly,
      renderCell(k, el) {
        if (cfg.cellStyle) cfg.cellStyle(p, k, el);
        if (hintCells.has(k)) el.classList.add('hint');
        if (circle[k]) { cfg.goalCell(p, k, el); return; }
        if (given[k]) { el.classList.add('given'); el.append(PuzzleShell.arrowIcon(TURN[given[k]])); return; }
        const v = result ? solution[k] : entries[k];
        if (v) el.append(PuzzleShell.arrowIcon(TURN[v]));
        if (result) el.classList.add(PuzzleShell.resultClass(entries[k], solution[k]));
      },
      onCell(k, ev) {
        if (circle[k] || given[k]) return;
        entries[k] = (entries[k] + (ev.button === 2 ? 4 : 1)) % 5;
        onChange();
      },
    });
  }

  // Shared page. cfg.decodeBoard(d) reads the board (with p.given); the
  // answer comes from the solver.
  function startGame(cfg) {
    PuzzleShell.start({
      id: cfg.id, name: cfg.name, rules: cfg.rules, size: cfg.size, solvedText: cfg.solvedText,
      controls: 'Click a cell to cycle ↑, ↓, ←, →, empty. Right click cycles back.',
      generate: cfg.generate,
      encode: cfg.encode,
      decode(d) {
        const p = cfg.decodeBoard(d);
        const res = solve(cfg, p, startCand(p, p.given), 2, 50000);
        if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
        p.solution = res.solutions[0];
        return p;
      },
      newState: (p) => new Int8Array(p.R * p.C),
      saveState: (s) => Array.from(s).join(''),
      loadState(p, v) {
        const s = new Int8Array(p.R * p.C);
        if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % 5;
        return s;
      },
      render: (p, s, opts) => render(cfg, p, s, opts),
      check: (p, s) => s.every((v, k) => p.circle[k] || (p.given[k] || v) === p.solution[k]),
      hints: (p, s) => hints(cfg, p, s),
      applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
    });
  }

  return { one, low, target, sides, solve, startCand, randomGoals, arrowForest, setGivens, startGame };
})();
