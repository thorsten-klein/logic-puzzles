// Gappy. Shade two cells in every row and column. Shaded cells never
// touch, not even at a corner. A number outside tells how many white
// cells lie between the two shaded cells of that line.
// Built on the shared Binary game page.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function lineCells(n) {
    const out = [];
    for (let c = 0; c < n; c++) out.push(Array.from({ length: n }, (_, i) => i * n + c));
    for (let r = 0; r < n; r++) out.push(Array.from({ length: n }, (_, i) => r * n + i));
    return out;
  }

  function findGapFits(cells, gap, n, s) {
    const fits = [];
    for (let a = 0; a + gap + 1 < n; a++) {
      const b = a + gap + 1;
      if (cells.every((k, j) => (j === a || j === b ? s[k] !== NO : s[k] !== YES))) fits.push([a, b]);
    }
    return fits;
  }

  function model(p) {
    const { n, clues } = p;
    const lines = lineCells(n);
    const cons = [];
    lines.forEach((cells, i) => {
      const name = i < n ? `Column ${i + 1}` : `Row ${i - n + 1}`;
      cons.push({ cells, min: 2, max: 2, area: cells,
        why: (v) => (v === YES ? `${name} needs two shaded cells, and only these are left.` : `${name} already has its two shaded cells.`) });
    });
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const k = r * n + c;
      cons.push({ cells: [k, k + 1, k + n, k + n + 1], min: 0, max: 1, why: () => 'Shaded cells never touch, not even at a corner.' });
    }

    function stepLine(cells, gap, n, s, name, log) {
      const fits = findGapFits(cells, gap, n, s);
      if (!fits.length) return -1;
      const yes = [], no = [];
      cells.forEach((k, j) => {
        if (s[k] !== UNKNOWN) return;
        const inAll = fits.every(([a, b]) => j === a || j === b);
        const inAny = fits.some(([a, b]) => j === a || j === b);
        if (inAll) yes.push(k); else if (!inAny) no.push(k);
      });
      if (!yes.length && !no.length) return 0;
      for (const k of yes) s[k] = YES;
      for (const k of no) s[k] = NO;
      if (log) {
        if (yes.length) log.push({ cells: yes, v: YES, area: cells, reason: `The gap of ${gap} in ${name} only fits with these cells shaded.` });
        if (no.length) log.push({ cells: no, v: NO, area: cells, reason: `The gap of ${gap} in ${name} can not use these cells.` });
      }
      return yes.length + no.length;
    }

    // Gap clue: the shaded pair is (i, i + gap + 1) for some i.
    function propagate(s, log) {
      for (let i = 0; i < lines.length; i++) {
        const gap = clues[i];
        if (gap < 0) continue;
        const name = i < n ? `column ${i + 1}` : `row ${i - n + 1}`;
        const res = stepLine(lines[i], gap, n, s, name, log);
        if (res !== 0) return res;
      }
      return 0;
    }
    return { N: n * n, cons, propagate };
  }

  // Two shaded cells per row and column, never touching (backtracking).
  function place(n) {
    const sol = new Uint8Array(n * n).fill(NO);
    const col = new Int8Array(n);
    const pairs = [];
    for (let a = 0; a < n; a++) for (let b = a + 2; b < n; b++) pairs.push([a, b]);
    let nodes = 0;
    const rec = (r, prev) => {
      if (r === n) return col.every((x) => x === 2);
      if (++nodes > 20000) return false;
      for (const pr of PuzzleShell.shuffle(pairs.slice())) {
        if (pr.some((c) => col[c] >= 2 || prev.some((q) => Math.abs(q - c) <= 1))) continue;
        for (const c of pr) { col[c]++; sol[r * n + c] = YES; }
        if (rec(r + 1, pr)) return true;
        for (const c of pr) { col[c]--; sol[r * n + c] = NO; }
      }
      return false;
    };
    return rec(0, []) ? sol : null;
  }

  function generate(n) {
    for (let t = 0; t < 100; t++) {
      const p = { R: n, C: n, n, clues: new Array(2 * n).fill(-1) };
      const sol = place(n);
      if (!sol) continue;
      lineCells(n).forEach((cells, i) => {
        const at = cells.map((k, j) => (sol[k] === YES ? j : -1)).filter((j) => j >= 0);
        p.clues[i] = at[1] - at[0] - 1;
      });
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.clues, -1, () => model(p));
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'gappy',
    name: 'Gappy',
    rules: 'Shade exactly two cells in every row and every column. Shaded cells never touch, not even at a corner. ' +
      'A number outside the grid tells how many white cells lie between the two shaded cells of that row or column.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 9, max: 11, def: 9 },
    solvedText: 'Every gap measured — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, c: p.clues.join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 5 || n > 15) throw new Error('Invalid board size');
      const clues = String(d.c).split(',').map(Number);
      if (clues.length !== 2 * n || clues.some((x) => !(x >= -1 && x < n))) throw new Error('Invalid clues');
      return { R: n, C: n, n, clues };
    },
    model,
    top: (p) => p.clues.slice(0, p.n).map((v) => (v < 0 ? '' : v)),
    left: (p) => p.clues.slice(p.n).map((v) => (v < 0 ? '' : v)),
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'gp-board',
  });
})();
