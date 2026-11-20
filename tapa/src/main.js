// Tapa. Shade some cells. A clue lists the lengths of the shaded blocks
// in the eight cells around it (in any order). Clue cells stay white.
// All shaded cells connect, and no 2×2 block is all shaded.
// Built on the shared Binary game page (YES = shaded).
// p.clues[k]: null or a sorted list of block lengths ([0] = none).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  // The 8 cells around k in ring order (null outside the grid).
  const ring = (R, C, k) => {
    const r = Math.floor(k / C), c = k % C;
    return [[-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1]].map(([dr, dc]) => {
      const a = r + dr, b = c + dc;
      return a >= 0 && b >= 0 && a < R && b < C ? a * C + b : null;
    });
  };

  // Block lengths of a ring pattern (8 bits), sorted; [0] if empty.
  const blocks = (bits) => {
    if (bits === 255) return [8];
    if (!bits) return [0];
    let start = 0;
    while (bits & (1 << start)) start++;
    const out = [];
    let run = 0;
    for (let i = 1; i <= 8; i++) {
      if (bits & (1 << ((start + i) % 8))) run++;
      else if (run) { out.push(run); run = 0; }
    }
    if (run) out.push(run);
    return out.sort((a, b) => a - b);
  };
  const KEY = Array.from({ length: 256 }, (_, b) => blocks(b).join(''));

  function model(p) {
    const { R, C, clues } = p;
    const N = R * C;
    const rings = clues.map((cl, k) => (cl ? ring(R, C, k) : null));
    const cons = [];
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      cons.push({ cells: [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1], min: 0, max: 3, why: () => 'No 2×2 block may be all shaded.' });
    }
    for (let k = 0; k < N; k++) if (clues[k]) cons.push({ cells: [k], min: 0, max: 0, why: () => 'Clue cells stay white.' });
    // Patterns of each ring that fit its clue and the cells known now.
    function fitsOf(s, k) {
      const want = clues[k].join(''), cells = rings[k];
      const out = [];
      for (let b = 0; b < 256; b++) {
        if (KEY[b] !== want) continue;
        let ok = true;
        for (let i = 0; i < 8 && ok; i++) {
          const j = cells[i], on = (b >> i) & 1;
          if (j === null) ok = !on;
          else if (s[j] === YES) ok = on === 1;
          else if (s[j] === NO) ok = on === 0;
        }
        if (ok) out.push(b);
      }
      return out;
    }
    function propagate(s, log) {
      let set = 0;
      for (let k = 0; k < N; k++) {
        if (!clues[k]) continue;
        const fits = fitsOf(s, k);
        if (!fits.length) return false;
        const all = fits.reduce((a, b) => a & b, 255), any = fits.reduce((a, b) => a | b, 0);
        const yes = [], no = [];
        rings[k].forEach((j, i) => {
          if (j === null || s[j] !== UNKNOWN) return;
          if (all & (1 << i)) yes.push(j);
          else if (!(any & (1 << i))) no.push(j);
        });
        if (!yes.length && !no.length) continue;
        yes.forEach((j) => { s[j] = YES; });
        no.forEach((j) => { s[j] = NO; });
        set += yes.length + no.length;
        if (log) {
          const t = clues[k].join(' ');
          if (yes.length) log.push({ cells: yes, v: YES, reason: `Every way to fit the blocks "${t}" around this clue shades these cells.` });
          else log.push({ cells: no, v: NO, reason: `No way to fit the blocks "${t}" around this clue shades these cells.` });
          return set;
        }
      }
      return set;
    }
    const check = (s) => Binary.canConnect(R, C, s, YES);
    return { N, cons, propagate, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const base = { R, C, clues: new Array(N).fill(null) };
      const fill = Binary.randomFill(model(base), 0.55, 10);
      if (!fill) continue;
      const yes = fill.filter((v) => v === YES).length;
      if (yes < N * 0.35 || yes > N * 0.65) continue;
      const p = { R, C, clues: new Array(N).fill(null) };
      for (let k = 0; k < N; k++) {
        if (fill[k] !== NO) continue;
        let bits = 0;
        ring(R, C, k).forEach((j, i) => { if (j !== null && fill[j] === YES) bits |= 1 << i; });
        p.clues[k] = blocks(bits);
      }
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.clues, null, () => model(p));
      p.solution = fill;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'tapa',
    name: 'Tapa',
    rules: 'Shade some cells. Clue cells stay white. A clue lists the lengths of the shaded blocks among the eight ' +
      'cells around it; several numbers mean separate blocks, with white cells between them. All shaded cells connect ' +
      'by their sides, and no 2×2 block is all shaded.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 9, def: 7 },
    solvedText: 'Tap tap, all done — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: p.clues.map((cl) => (cl ? cl.join('') : '.')).join(',') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      const parts = String(d.g).split(',');
      if (parts.length !== R * C || parts.some((t) => t !== '.' && !/^[0-8]{1,4}$/.test(t))) throw new Error('Invalid clues');
      return { R, C, clues: parts.map((t) => (t === '.' ? null : Array.from(t, Number).sort((a, b) => a - b))) };
    },
    model,
    fixed: (p, k) => (p.clues[k] ? NO : 0),
    draw(p, k, el) {
      const cl = p.clues[k];
      if (!cl) return;
      el.textContent = cl.join(' ');
      if (cl.length > 2) el.classList.add('tp-small');
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'tp-board',
  });
})();
