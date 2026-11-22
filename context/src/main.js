// Context. Shade some cells. Shaded cells never touch by a side, and all
// white cells stay connected. A number in a white cell counts the shaded
// cells next to it by a side; a number in a shaded cell counts the
// shaded cells touching it at a corner. Numbered cells may be shaded.
// Built on the shared Binary game page (YES = shaded).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function around(R, C, k, diag) {
    const r = Math.floor(k / C), c = k % C, out = [];
    const steps = diag ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of steps) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nc >= 0 && nr < R && nc < C) out.push(nr * C + nc);
    }
    return out;
  }

  function model(p) {
    const { R, C, clues } = p;
    const cons = [];
    for (let k = 0; k < R * C; k++) {
      const r = Math.floor(k / C), c = k % C;
      const why = () => 'Shaded cells must never touch by a side.';
      if (c < C - 1) cons.push({ cells: [k, k + 1], min: 0, max: 1, why });
      if (r < R - 1) cons.push({ cells: [k, k + C], min: 0, max: 1, why });
    }
    const numbered = [];
    for (let k = 0; k < R * C; k++) if (clues[k] >= 0) numbered.push([k, around(R, C, k, false), around(R, C, k, true)]);
    // How a count rule stands: BROKEN, nothing to do (null), or cells to set.
    const BROKEN = { broken: true };
    const fit = (s, cells, v) => {
      const yes = cells.filter((j) => s[j] === YES).length;
      const open = cells.filter((j) => s[j] === UNKNOWN);
      if (yes > v || yes + open.length < v) return BROKEN;
      if (!open.length) return null;
      if (yes === v) return { cells: open, v: NO };
      if (yes + open.length === v) return { cells: open, v: YES };
      return null;
    };
    function propagate(s, log) {
      for (const [k, orth, diag] of numbered) {
        const v = clues[k];
        if (s[k] === NO || s[k] === YES) {
          const f = fit(s, s[k] === NO ? orth : diag, v);
          if (f === BROKEN) return -1;
          if (f) {
            const { cells, v: val } = f;
            for (const j of cells) s[j] = val;
            if (log) log.push({ cells, v: val, at: k, reason: s[k] === NO
              ? `This white ${v} needs exactly ${PuzzleShell.plural(v, 'shaded side neighbour')}.`
              : `This shaded ${v} needs exactly ${PuzzleShell.plural(v, 'shaded corner neighbour')}.` });
            return cells.length;
          }
        } else {
          // Colour unknown: if one reading is impossible, it is the other.
          const asWhite = fit(s, orth, v), asBlack = fit(s, diag, v);
          if (asWhite === BROKEN && asBlack === BROKEN) return -1;
          if (asWhite === BROKEN || asBlack === BROKEN) {
            s[k] = asWhite === BROKEN ? YES : NO;
            if (log) log.push({ cells: [k], v: s[k], at: k, reason: asWhite === BROKEN
              ? `As a white cell this ${v} could not be right, so it is shaded.`
              : `As a shaded cell this ${v} could not be right, so it is white.` });
            return 1;
          }
        }
      }
      return 0;
    }
    return { N: R * C, cons, propagate, check: (s) => Binary.canConnect(R, C, s, NO) };
  }

  function generate(n) {
    for (let t = 0; t < 60; t++) {
      const R = n, C = n;
      const blank = { R, C, clues: new Int8Array(R * C).fill(-1) };
      const sol = Binary.randomFill(model(blank), 0.35, 5);
      if (!sol) continue;
      const clues = new Int8Array(R * C).fill(-1);
      for (let k = 0; k < R * C; k++) {
        if (Math.random() < 0.4) continue;
        clues[k] = around(R, C, k, sol[k] === YES).filter((j) => sol[j] === YES).length;
      }
      const p = { R, C, clues };
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(clues, -1, () => model(p));
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'context',
    name: 'Context',
    rules: 'Shade some cells. Shaded cells never touch by a side, and all white cells stay connected. ' +
      'A number in a white cell counts the shaded cells next to it by a side. A number in a shaded cell counts ' +
      'the shaded cells touching it at a corner. Numbered cells may be shaded.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'Everything in context — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v)).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[.0-4]+$/.test(d.g)) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number(ch))) };
    },
    model,
    draw(p, k, el) { if (p.clues[k] >= 0) { el.textContent = p.clues[k]; el.classList.add('numbered'); } },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'cx-board',
  });
})();
