// Fill-a-Pix solver. Each clue is a sum rule over its 3x3 block.
// Propagation: a full clue empties the rest, a clue that needs every
// open cell fills them all. Then it guesses a cell and recurses.
// Exposes the global `Solver`.

const Solver = (() => {
  const { UNKNOWN, FILLED, EMPTY, block } = Rules;

  function constraints(p) {
    const list = [];
    for (let k = 0; k < p.R * p.C; k++) if (p.clues[k] >= 0) list.push({ k, cells: block(k, p.R, p.C), sum: p.clues[k] });
    return list;
  }

  // One pass of propagation. Returns false on contradiction,
  // else the number of cells set. `log` collects steps for hints.
  function step(cons, s, log) {
    let set = 0;
    for (const con of cons) {
      let filled = 0;
      const open = [];
      for (const j of con.cells) {
        if (s[j] === FILLED) filled++;
        else if (s[j] === UNKNOWN) open.push(j);
      }
      if (filled > con.sum || filled + open.length < con.sum) return -1;
      if (!open.length) continue;
      const v = filled === con.sum ? EMPTY : filled + open.length === con.sum ? FILLED : 0;
      if (!v) continue;
      for (const j of open) s[j] = v;
      set += open.length;
      if (log) log.push({ con, cells: open, v });
    }
    return set;
  }

  // Pair rule for two overlapping clues A and B. Bounds the filled count
  // in the shared cells, which can settle the cells only B sees.
  function pairStep(cons, s, log) {
    const info = cons.map((con) => {
      let filled = 0;
      const open = [];
      for (const j of con.cells) {
        if (s[j] === FILLED) filled++;
        else if (s[j] === UNKNOWN) open.push(j);
      }
      return { con, need: con.sum - filled, open: new Set(open) };
    }).filter((x) => x.open.size);
    for (const a of info) for (const b of info) {
      if (a === b) continue;
      const shared = [...a.open].filter((j) => b.open.has(j));
      if (!shared.length) continue;
      const aOnly = a.open.size - shared.length;
      const bOnly = [...b.open].filter((j) => !a.open.has(j));
      if (!bOnly.length) continue;
      const xmin = Math.max(0, a.need - aOnly, b.need - bOnly.length);
      const xmax = Math.min(a.need, b.need, shared.length);
      let v = 0;
      if (b.need - xmax === bOnly.length) v = FILLED;
      else if (b.need - xmin === 0) v = EMPTY;
      if (!v) continue;
      for (const j of bOnly) s[j] = v;
      if (log) log.push({ con: b.con, other: a.con, cells: bOnly, v });
      return bOnly.length;
    }
    return 0;
  }

  // Solves by logic only. Returns the state reached.
  function logicSolve(p, start) {
    const cons = constraints(p);
    const s = start ? Uint8Array.from(start) : new Uint8Array(p.R * p.C);
    for (;;) {
      const r = step(cons, s);
      if (r < 0) return null;
      if (r > 0) continue;
      if (pairStep(cons, s) === 0) break;
    }
    return s;
  }

  function solve(p, stopAt = 2, maxNodes = 100000) {
    const cons = constraints(p);
    const N = p.R * p.C;
    const solutions = [];
    let nodes = 0;
    function rec(s) {
      if (solutions.length >= stopAt || ++nodes > maxNodes) return;
      for (;;) {
        const r = step(cons, s);
        if (r < 0) return;
        if (r === 0) break;
      }
      const pick = s.indexOf(UNKNOWN);
      if (pick < 0) { solutions.push(Uint8Array.from(s)); return; }
      for (const v of [FILLED, EMPTY]) {
        const copy = Uint8Array.from(s);
        copy[pick] = v;
        rec(copy);
      }
    }
    rec(new Uint8Array(N));
    return { solutions, capped: nodes > maxNodes };
  }

  return { solve, step, pairStep, logicSolve, constraints };
})();
