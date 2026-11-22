// Sukoro. Some cells hold numbers. A number tells how many of its side
// neighbours hold numbers. Neighbouring numbers differ, and all numbered
// cells are connected. A few numbers are given.
// Built on the shared Binary solver: YES = the cell holds a number.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function nbsOf(R, C) {
    return Array.from({ length: R * C }, (_, k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    });
  }

  function model(p) {
    const { R, C, clues } = p;
    const nb = nbsOf(R, C);
    const cons = [];
    for (let k = 0; k < R * C; k++) {
      const v = clues[k];
      if (v < 0) continue;
      cons.push({ cells: [k], min: 1, max: 1, why: () => 'A given number is part of the picture.' }, { cells: nb[k], min: v, max: v, area: [k],
        why: (x) => (x === YES ? `This ${v} needs a number in every open cell next to it.`
          : `This ${v} already has ${PuzzleShell.plural(v, 'numbered neighbour')}. The other neighbours stay empty.`) });
    }
    // A number may not equal a neighbouring number. Once a cell and all
    // its neighbours are known, its value is fixed.
    const known = (s, k) => nb[k].every((j) => s[j] !== UNKNOWN);
    const value = (s, k) => nb[k].filter((j) => s[j] === YES).length;
    function check(s) {
      if (!Binary.canConnect(R, C, s, YES)) return false;
      for (let k = 0; k < R * C; k++) {
        if (s[k] !== YES || !known(s, k)) continue;
        const v = value(s, k);
        if (v === 0 && s.some((x, j) => j !== k && x === YES)) return false;
        for (const j of nb[k]) if (s[j] === YES && known(s, j) && value(s, j) === v) return false;
      }
      return true;
    }
    return { N: R * C, cons, check };
  }

  // Values of all numbered cells in a full state.
  const values = (p, s) => Int8Array.from(s, (v, k) => (v === YES ? nbsOf(p.R, p.C)[k].filter((j) => s[j] === YES).length : 0));

  // Grows a random connected set of numbered cells, then repairs it by
  // local search: toggle cells while the number of equal neighbouring
  // numbers does not grow (connected sets only).
  function grow(n) {
    const N = n * n;
    const nb = nbsOf(n, n);
    const s = new Uint8Array(N).fill(NO);
    s[Math.floor(Math.random() * N)] = YES;
    const target = Math.round(N * (0.4 + Math.random() * 0.1));
    for (let size = 1; size < target; size++) {
      const front = [];
      for (let k = 0; k < N; k++) if (s[k] === NO && nb[k].some((j) => s[j] === YES)) front.push(k);
      s[front[Math.floor(Math.random() * front.length)]] = YES;
    }
    const cost = () => {
      let bad = 0;
      const val = Int8Array.from(s, (v, k) => (v === YES ? nb[k].filter((j) => s[j] === YES).length : -1));
      for (let k = 0; k < N; k++) {
        if (s[k] !== YES) continue;
        for (const j of nb[k]) if (j > k && s[j] === YES && val[j] === val[k]) bad++;
      }
      return bad;
    };
    let c = cost();
    for (let it = 0; it < 3000 && c > 0; it++) {
      const k = Math.floor(Math.random() * N);
      s[k] = s[k] === YES ? NO : YES;
      if (!s.includes(YES) || !Binary.openConnected(n, n, Uint8Array.from(s, (v) => (v === YES ? NO : YES)))) {
        s[k] = s[k] === YES ? NO : YES;
        continue;
      }
      const c2 = cost();
      if (c2 <= c || Math.random() < 0.02) c = c2;
      else s[k] = s[k] === YES ? NO : YES;
    }
    const count = s.filter((v) => v === YES).length;
    return c === 0 && count >= N * 0.3 ? s : null;
  }

  function generate(n) {
    for (let t = 0; t < 400; t++) {
      const sol = grow(n);
      if (!sol) continue;
      const p = { R: n, C: n, clues: new Int8Array(n * n).fill(-1) };
      const vals = values(p, sol);
      for (let k = 0; k < n * n; k++) if (sol[k] === YES) p.clues[k] = vals[k];
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.clues, -1, () => model(p));
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'sukoro',
    name: 'Sukoro',
    rules: 'Find the cells that hold numbers. A number tells how many of its side neighbours hold numbers. ' +
      'Two numbers next to each other are never equal. All numbered cells form one connected group.',
    controls: 'Click a cell to mark it as numbered, again to mark it empty. Right click cycles the other way. Numbers appear by themselves.',
    size: { min: 5, max: 9, def: 6 },
    solvedText: 'Every number counts right — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v)).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 15)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[.0-4]+$/.test(d.g)) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number(ch))) };
    },
    model,
    fixed: (p, k) => (p.clues[k] >= 0 ? YES : 0),
    draw(p, k, el, v, shown) {
      if (p.clues[k] >= 0) { el.textContent = p.clues[k]; return; }
      if (v === YES) el.textContent = nbsOf(p.R, p.C)[k].filter((j) => shown[j] === YES).length;
    },
    noun: 'number', noNoun: 'empty cell',
    className: 'sk2-board', yesClass: 'num', noClass: 'dot',
  });
})();
