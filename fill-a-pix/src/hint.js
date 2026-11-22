// Fill-a-Pix hints: wrong marks first, then single-clue steps,
// then steps that combine two overlapping clues.
// Exposes the global `Hint`.

const Hint = (() => {
  const { UNKNOWN, FILLED } = Rules;

  function where(k, C) {
    return `row ${Math.floor(k / C) + 1}, column ${(k % C) + 1}`;
  }

  function findAll(p, state) {
    const { R, C, clues, solution } = p;
    const out = [];
    for (let k = 0; k < R * C; k++) {
      if (state[k] !== UNKNOWN && state[k] !== solution[k]) {
        out.push({ cells: [k], v: solution[k], reason: `The cell at ${where(k, C)} is marked wrong.` });
      }
    }
    if (out.length) return out;

    const cons = Solver.constraints(p);
    const log = [];
    const s = Uint8Array.from(state);
    if (Solver.step(cons, s, log) === 0) Solver.pairStep(cons, s, log);
    for (const st of log) {
      const n = clues[st.con.k];
      let reason;
      if (st.other) {
        const m = clues[st.other.k];
        reason = `Compare the ${m} and the ${n}. Their shared cells settle the cells only the ${n} sees: ` +
          (st.v === FILLED ? 'they must all be filled.' : 'they must all stay empty.');
      } else if (st.v === FILLED) {
        reason = `This ${n} needs every open cell around it to be filled.`;
      } else {
        reason = `This ${n} already has ${PuzzleShell.plural(n, 'filled cell')}. The rest stay empty.`;
      }
      out.push({ cells: st.cells, clue: st.con.k, other: st.other?.k, v: st.v, reason });
    }
    return out;
  }

  return { findAll };
})();
