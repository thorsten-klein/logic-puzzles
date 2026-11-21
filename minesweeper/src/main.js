// Minesweeper puzzle. Find every mine; numbers count the mines in the
// eight cells around them. Built on the shared Binary game page.

(() => {
  const { YES, NO } = Binary;

  function around(k, R, C) {
    const r = Math.floor(k / C), c = k % C, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if ((dr || dc) && nr >= 0 && nc >= 0 && nr < R && nc < C) out.push(nr * C + nc);
    }
    return out;
  }

  function model(p) {
    const { R, C, clues } = p;
    const cons = [];
    for (let k = 0; k < R * C; k++) {
      const v = clues[k];
      if (v < 0) continue;
      const mines = v === 1 ? 'its mine' : `its ${v} mines`;
      const why = (x) => {
        if (x === YES) return `This ${v} needs a mine in every open cell around it.`;
        if (v === 0) return 'A 0 has no mines around it. All cells around it are safe.';
        return `This ${v} already has ${mines}. The other cells around it are safe.`;
      };
      cons.push({ cells: [k], min: 0, max: 0 }, { cells: around(k, R, C), min: v, max: v, area: [k], why });
    }
    return { N: R * C, cons };
  }

  function generate(n) {
    const R = n, C = n, N = R * C;
    const mine = Uint8Array.from({ length: N }, () => (Math.random() < 0.2 ? 1 : 0));
    const clues = Int8Array.from({ length: N }, (_, k) => (mine[k] ? -1 : around(k, R, C).filter((j) => mine[j]).length));
    const p = { R, C, clues };
    const s = Binary.logicSolve(model(p));
    if (!s || s.includes(0)) return null;
    Binary.thinClues(clues, -1, () => model(p));
    p.solution = Uint8Array.from(mine, (m) => (m ? YES : NO));
    return p;
  }

  Binary.startGame({
    id: 'minesweeper',
    name: 'Minesweeper',
    rules: 'Find all the mines. A number tells how many of the eight cells around it hold a mine. Numbered cells are safe.',
    controls: 'Click a cell to place a mine flag, click again to mark it safe. Right click cycles the other way.',
    size: { min: 5, max: 14, def: 9 },
    solvedText: 'All mines found — nicely done.',
    generate(n) { for (let i = 0; i < 50; i++) { const p = generate(n); if (p) return p; } return null; },
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v)).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 30)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[.0-8]+$/.test(d.g)) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number(ch))) };
    },
    model,
    fixed: (p, k) => (p.clues[k] >= 0 ? NO : 0),
    draw(p, k, el) { if (p.clues[k] >= 0) el.textContent = p.clues[k] || ''; },
    noun: 'mine', noNoun: 'safe cell',
    className: 'ms-board', yesClass: 'mine', noClass: 'safe',
  });
})();
