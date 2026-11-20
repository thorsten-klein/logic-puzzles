// No Four in a Row. Fill X and O so no four equal symbols line up in a
// row, column or diagonal. Built on the shared Binary game page.

(() => {
  const { YES, NO } = Binary;

  function model(p) {
    const { R, C, given } = p;
    const cons = [];
    for (let k = 0; k < R * C; k++) {
      if (given[k]) cons.push({ cells: [k], min: given[k] === YES ? 1 : 0, max: given[k] === YES ? 1 : 0 });
    }
    const why = (v) => `Four ${v === YES ? 'Os' : 'Xs'} may not line up. This cell must be ${v === YES ? 'X' : 'O'}.`;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const er = r + 3 * dr, ec = c + 3 * dc;
        if (er >= R || ec < 0 || ec >= C) continue;
        const cells = [0, 1, 2, 3].map((i) => (r + i * dr) * C + c + i * dc);
        cons.push({ cells, min: 1, max: 3, area: cells, why });
      }
    }
    return { N: R * C, cons };
  }

  function generate(n) {
    const p = { R: n, C: n, given: new Uint8Array(n * n) };
    const sol = Binary.randomFill(model(p));
    if (!sol) return null;
    p.given = Uint8Array.from(sol);
    Binary.thinClues(p.given, 0, () => model(p));
    p.solution = sol;
    return p;
  }

  Binary.startGame({
    id: 'no-four-in-a-row',
    name: 'No Four in a Row',
    rules: 'Fill every cell with X or O. Four equal symbols may never line up next to each other in a row, column or diagonal.',
    controls: 'Click a cell for X, again for O, again to clear. Right click cycles the other way.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'No four in a row anywhere — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.given).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 4 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[012]+$/.test(d.g)) throw new Error('Invalid givens');
      return { R, C, given: Uint8Array.from(d.g, Number) };
    },
    model,
    fixed: (p, k) => p.given[k],
    draw(p, k, el, v) { if (v) el.textContent = v === YES ? 'X' : 'O'; },
    noun: 'X', noNoun: 'O',
    className: 'nf-board', yesClass: 'x', noClass: 'o',
  });
})();
