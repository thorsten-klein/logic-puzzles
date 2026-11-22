// Light Up solver: forced moves plus guessing.
// `step` makes one round of forced moves and can log them for hints.
// Exposes the global `Solver`.

const Solver = (() => {
  const { UNKNOWN, BULB, NONE, WHITE } = Rules;

  // Returns false on contradiction, else the number of cells set.
  function step(p, s, log) {
    const { R, C, walls, sight, nb } = p;
    const N = R * C;
    let set = 0;
    const put = (cells, v, why, at) => {
      const todo = cells.filter((j) => s[j] === UNKNOWN);
      if (!todo.length) return;
      for (const j of todo) s[j] = v;
      set += todo.length;
      if (log) log.push({ cells: todo, v, why, at });
    };
    for (let k = 0; k < N; k++) {
      if (walls[k] === WHITE && s[k] === BULB) {
        if (sight[k].some((j) => s[j] === BULB)) return -1;
        put(sight[k], NONE, 'seen', k);
      }
    }
    for (let k = 0; k < N; k++) {
      const w = walls[k];
      if (w < 0) continue;
      const cells = nb[k].filter((j) => walls[j] === WHITE);
      const bulbs = cells.filter((j) => s[j] === BULB).length;
      const open = cells.filter((j) => s[j] === UNKNOWN);
      if (bulbs > w || bulbs + open.length < w) return -1;
      if (!open.length) continue;
      if (bulbs === w) put(open, NONE, 'full', k);
      else if (bulbs + open.length === w) put(open, BULB, 'needs', k);
    }
    const lit = Rules.litMap(p, s);
    for (let k = 0; k < N; k++) {
      if (walls[k] !== WHITE || lit[k]) continue;
      const opts = [k, ...sight[k]].filter((j) => s[j] === UNKNOWN);
      if (!opts.length) return -1;
      if (opts.length === 1) { put(opts, BULB, 'only', k); return set; }
    }
    return set;
  }

  function solve(p, stopAt = 2, maxNodes = 50000) {
    const N = p.R * p.C;
    const solutions = [];
    let nodes = 0;
    function rec(s) {
      if (solutions.length >= stopAt || ++nodes > maxNodes) return;
      for (;;) {
        const r = step(p, s);
        if (r < 0) return;
        if (r === 0) break;
      }
      let pick = -1;
      for (let k = 0; k < N; k++) if (p.walls[k] === WHITE && s[k] === UNKNOWN) { pick = k; break; }
      if (pick < 0) {
        if (Rules.isSolved(p, s)) solutions.push(Uint8Array.from(s));
        return;
      }
      for (const v of [BULB, NONE]) {
        const copy = Uint8Array.from(s);
        copy[pick] = v;
        rec(copy);
      }
    }
    rec(new Uint8Array(N));
    return { solutions, capped: nodes > maxNodes };
  }

  // Runs forced moves to the end. Returns false on contradiction.
  function settle(p, s) {
    for (;;) {
      const r = step(p, s);
      if (r < 0) return false;
      if (r === 0) return true;
    }
  }

  // Look-ahead: if a bulb at an open cell leads to a contradiction,
  // that cell has no bulb. Sets one cell and returns it, else -1.
  function lookahead(p, s, log) {
    for (let k = 0; k < p.R * p.C; k++) {
      if (p.walls[k] !== WHITE || s[k] !== UNKNOWN) continue;
      const t = Uint8Array.from(s);
      t[k] = BULB;
      if (!settle(p, t)) {
        s[k] = NONE;
        if (log) log.push({ cells: [k], v: NONE, why: 'trial', at: k });
        return k;
      }
    }
    return -1;
  }

  // Logic only (no guessing). Returns the state reached or null.
  function logicSolve(p) {
    const s = new Uint8Array(p.R * p.C);
    for (;;) {
      if (!settle(p, s)) return null;
      if (lookahead(p, s) < 0) return s;
    }
  }

  return { step, lookahead, solve, logicSolve };
})();
