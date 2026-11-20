// Yin-Yang. Fill every cell black or white so each colour forms one
// connected area and no 2x2 block is one colour.
// Built on the shared Binary game page.

(() => {
  const { YES, NO } = Binary;

  function model(p) {
    const { R, C, given } = p;
    const cons = [];
    for (let k = 0; k < R * C; k++) {
      if (given[k]) cons.push({ cells: [k], min: given[k] === YES ? 1 : 0, max: given[k] === YES ? 1 : 0 });
    }
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      const k = r * C + c;
      const cells = [k, k + 1, k + C, k + C + 1];
      cons.push({ cells, min: 1, max: 3, area: cells,
        why: (v) => `A 2×2 block may not be all ${v === YES ? 'white' : 'black'}. This cell must be ${v === YES ? 'black' : 'white'}.` });
    }
    return {
      N: R * C, cons,
      check: (s) => Binary.canConnect(R, C, s, YES) && Binary.canConnect(R, C, s, NO),
    };
  }

  // Grows the black area from a border cell. A cell turns black only if
  // the white area stays connected and no 2x2 block becomes all black.
  function grow(n) {
    const N = n * n;
    const s = new Uint8Array(N).fill(NO);
    const block = (k, v) => {
      const r = Math.floor(k / n), c = k % n;
      for (const [dr, dc] of [[-1, -1], [-1, 0], [0, -1], [0, 0]]) {
        const r0 = r + dr, c0 = c + dc;
        if (r0 < 0 || c0 < 0 || r0 >= n - 1 || c0 >= n - 1) continue;
        const t = r0 * n + c0;
        if ([t, t + 1, t + n, t + n + 1].every((j) => s[j] === v)) return true;
      }
      return false;
    };
    const edge = [...Array(N).keys()].filter((k) => k < n || k % n === 0);
    s[edge[Math.floor(Math.random() * edge.length)]] = YES;
    for (let changed = true; changed;) {
      changed = false;
      const front = [];
      for (let k = 0; k < N; k++) {
        if (s[k] !== NO) continue;
        const r = Math.floor(k / n), c = k % n;
        if ((r > 0 && s[k - n] === YES) || (r < n - 1 && s[k + n] === YES) ||
            (c > 0 && s[k - 1] === YES) || (c < n - 1 && s[k + 1] === YES)) front.push(k);
      }
      for (const k of PuzzleShell.shuffle(front)) {
        s[k] = YES;
        if (block(k, YES) || !Binary.canConnect(n, n, s, NO)) { s[k] = NO; continue; }
        changed = true;
        break;
      }
    }
    for (let k = 0; k < N; k++) if (s[k] === NO && block(k, NO)) return null;
    return s;
  }

  function generate(n) {
    for (let t = 0; t < 200; t++) {
      const sol = grow(n);
      if (!sol) continue;
      const p = { R: n, C: n, given: Uint8Array.from(sol) };
      Binary.thinClues(p.given, 0, () => model(p));
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'yin-yang',
    name: 'Yin-Yang',
    rules: 'Fill every cell with a black or white circle. All black circles form one connected group, and so do all white ones ' +
      '(by sides, not corners). No 2×2 block may hold four circles of one colour.',
    controls: 'Click a cell for black, again for white, again to clear. Right click cycles the other way.',
    size: { min: 5, max: 10, def: 6 },
    solvedText: 'Balance restored — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.given).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[012]+$/.test(d.g)) throw new Error('Invalid givens');
      return { R, C, given: Uint8Array.from(d.g, Number) };
    },
    model,
    fixed: (p, k) => p.given[k],
    noun: 'black circle', noNoun: 'white circle',
    className: 'yy-board', yesClass: 'black', noClass: 'white', showFixedNo: true,
  });
})();
