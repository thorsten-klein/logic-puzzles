// Light Up hints: wrong marks first, then forced moves,
// then look-ahead steps. Exposes the global `Hint`.

const Hint = (() => {
  const { UNKNOWN, BULB, NONE, WHITE } = Rules;

  const REASONS = {
    seen: () => 'This bulb lights these cells. No other bulb may go where it shines.',
    full: (n) => `This ${n} already has ${PuzzleShell.plural(n, 'bulb')} next to it. The other sides get no bulb.`,
    needs: (n) => `This ${n} needs a bulb on every open side.`,
    only: () => 'This dark cell can only be lit from one place. A bulb goes there.',
    trial: () => 'A bulb here would lead to a dead end (a dark cell or a broken number). So no bulb here.',
  };

  function findAll(p, state) {
    const { R, C, walls, solution } = p;
    const out = [];
    for (let k = 0; k < R * C; k++) {
      if (walls[k] !== WHITE || state[k] === UNKNOWN) continue;
      if (state[k] === BULB && solution[k] !== BULB) out.push({ cells: [k], v: NONE, reason: 'This bulb is wrong.' });
      if (state[k] === NONE && solution[k] === BULB) out.push({ cells: [k], v: BULB, reason: 'This cell needs a bulb.' });
    }
    if (out.length) return out;

    const log = [];
    const s = Uint8Array.from(state);
    const r = Solver.step(p, s, log);
    if (r === 0) Solver.lookahead(p, s, log);
    for (const st of log) {
      out.push({ cells: st.cells, at: st.at, v: st.v, reason: REASONS[st.why](walls[st.at]) });
    }
    return out;
  }

  return { findAll };
})();
