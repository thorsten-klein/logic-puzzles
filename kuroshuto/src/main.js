// Kuroshuto. Shade some cells. A number N means exactly one of the cells
// N steps away (up, down, left or right) is shaded. Shaded cells never
// touch by a side, and all white cells stay connected. Numbered cells
// are white. Built on the shared Binary game page (YES = shaded).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function atDistance(R, C, k, d) {
    const r = Math.floor(k / C), c = k % C, out = [];
    for (const [nr, nc] of [[r - d, c], [r + d, c], [r, c - d], [r, c + d]]) {
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
      const v = clues[k];
      if (v <= 0) continue;
      cons.push({ cells: [k], min: 0, max: 0, why: () => 'Numbered cells stay white.' });
      cons.push({ cells: atDistance(R, C, k, v), min: 1, max: 1, at: k,
        why: (x) => (x === YES ? `Exactly one cell ${v} steps from this ${v} is shaded, and only this one is left.`
          : `One cell ${v} steps from this ${v} is already shaded. The others stay white.`) });
    }
    return { N: R * C, cons, check: (s) => Binary.canConnect(R, C, s, NO) };
  }

  function generate(n) {
    for (let t = 0; t < 60; t++) {
      const R = n, C = n;
      const p = { R, C, clues: new Int8Array(R * C) };
      const sol = Binary.randomFill(model(p), 0.3, 5);
      if (!sol) continue;
      for (let k = 0; k < R * C; k++) {
        if (sol[k] === YES) continue;
        const opts = [];
        for (let d = 1; d < n; d++) if (atDistance(R, C, k, d).filter((j) => sol[j] === YES).length === 1) opts.push(d);
        if (opts.length) p.clues[k] = opts[Math.floor(Math.random() * opts.length)];
      }
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.clues, 0, () => model(p));
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'kuroshuto',
    name: 'Kuroshuto',
    rules: 'Shade some cells. A number N means exactly one of the cells exactly N steps away (straight up, down, left or right) ' +
      'is shaded. Numbered cells stay white. Shaded cells never touch by a side, and all white cells are connected.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'Every shot hits — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v ? v.toString(36) : '.')).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? 0 : parseInt(ch, 36))) };
    },
    model,
    fixed: (p, k) => (p.clues[k] > 0 ? NO : 0),
    draw(p, k, el) { if (p.clues[k] > 0) el.textContent = p.clues[k]; },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'ks-board',
  });
})();
