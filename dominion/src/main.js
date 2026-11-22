// Dominion. Shade some cells. Shaded cells form dominoes (pairs joined by
// a side; dominoes may touch only at corners). Lettered cells stay white.
// The shading splits the white cells into areas: cells with the same
// letter share an area, each area holds exactly one kind of letter, and
// every area has a letter. Built on the shared Binary game page.

(() => {
  const { UNKNOWN, YES, NO } = Binary;
  const nbsOf = (R, C) => Array.from({ length: R * C }, (_, k) => {
    const r = Math.floor(k / C), c = k % C, out = [];
    if (r > 0) out.push(k - C);
    if (r < R - 1) out.push(k + C);
    if (c > 0) out.push(k - 1);
    if (c < C - 1) out.push(k + 1);
    return out;
  });

  function stepDomino(s, nbK, log) {
    const shaded = nbK.filter((j) => s[j] === YES);
    const open = nbK.filter((j) => s[j] === UNKNOWN);
    if (shaded.length > 1) return -1;
    if (shaded.length === 1 && open.length) {
      for (const j of open) s[j] = NO;
      if (log) log.push({ cells: open, v: NO, reason: 'This domino is complete. Cells next to it stay white.' });
      return open.length;
    }
    if (!shaded.length) {
      if (!open.length) return -1;
      if (open.length === 1) {
        s[open[0]] = YES;
        if (log) log.push({ cells: open, v: YES, reason: 'This shaded cell needs a partner, and only one neighbour is left.' });
        return 1;
      }
    }
    return 0;
  }

  function findComponents(N, nb, ok) {
    const comp = new Int32Array(N).fill(-1);
    let id = 0;
    for (let k = 0; k < N; k++) {
      if (comp[k] >= 0 || !ok(k)) continue;
      const stack = [k];
      comp[k] = id;
      while (stack.length) {
        const cur = stack.pop();
        for (const j of nb[cur]) {
          if (comp[j] < 0 && ok(j)) { comp[j] = id; stack.push(j); }
        }
      }
      id++;
    }
    return { comp, count: id };
  }

  function checkJoinable(N, letters, comp) {
    const seen = new Map();
    for (let k = 0; k < N; k++) {
      if (!letters[k]) continue;
      if (seen.has(letters[k]) && seen.get(letters[k]) !== comp[k]) return false;
      seen.set(letters[k], comp[k]);
    }
    return true;
  }

  function checkWhite(N, letters, comp, id, done) {
    const kind = new Map();
    for (let k = 0; k < N; k++) {
      if (!letters[k] || comp[k] < 0) continue;
      if (kind.has(comp[k]) && kind.get(comp[k]) !== letters[k]) return false;
      kind.set(comp[k], letters[k]);
    }
    if (done) {
      for (let c = 0; c < id; c++) if (!kind.has(c)) return false;
    }
    return true;
  }

  function model(p) {
    const { R, C, letters } = p;
    const nb = nbsOf(R, C);
    const cons = [];
    for (let k = 0; k < R * C; k++) if (letters[k]) cons.push({ cells: [k], min: 0, max: 0, why: () => 'Lettered cells stay white.' });
    function propagate(s, log) {
      // Dominoes: a shaded cell has exactly one shaded side neighbour.
      for (let k = 0; k < R * C; k++) {
        if (s[k] !== YES) continue;
        const res = stepDomino(s, nb[k], log);
        if (res !== 0) return res;
      }
      return 0;
    }
    // Areas through non-shaded cells: same letters must stay joinable,
    // different letters may not be joined by white cells.
    function check(s, done) {
      const N = R * C;
      const { comp: openComp } = findComponents(N, nb, (j) => s[j] !== YES);
      if (!checkJoinable(N, letters, openComp)) return false;
      const { comp: whiteComp, count } = findComponents(N, nb, (j) => s[j] === NO);
      return checkWhite(N, letters, whiteComp, count, done);
    }
    return { N: R * C, cons, propagate, check };
  }

  function placeDominoes(N, nb) {
    const shade = new Uint8Array(N);
    for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
      const j = nb[k][Math.floor(Math.random() * nb[k].length)];
      if ([k, j].some((x) => shade[x] || nb[x].some((y) => shade[y]))) continue;
      if (Math.random() < 0.6) { shade[k] = 1; shade[j] = 1; }
    }
    return shade;
  }

  function floodWhiteComponent(k, id, nb, shade, comp) {
    const cells = [k];
    comp[k] = id;
    for (const cur of cells) {
      for (const j of nb[cur]) {
        if (!shade[j] && comp[j] < 0) { comp[j] = id; cells.push(j); }
      }
    }
    return cells;
  }

  function placeLetters(N, nb, shade) {
    const letters = new Int8Array(N);
    const comp = new Int32Array(N).fill(-1);
    let id = 0;
    for (let k = 0; k < N; k++) {
      if (shade[k] || comp[k] >= 0) continue;
      const cells = floodWhiteComponent(k, id, nb, shade, comp);
      if (id >= 26) return null;
      for (const x of cells) if (Math.random() < 0.5) letters[x] = id + 1;
      letters[cells[Math.floor(Math.random() * cells.length)]] = id + 1;
      id++;
    }
    return id >= 2 ? letters : null;
  }

  function thinLetters(p, N) {
    const { letters } = p;
    for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
      if (!letters[k]) continue;
      const keep = letters[k];
      if (letters.filter((v) => v === keep).length === 1) continue;
      letters[k] = 0;
      const t = Binary.logicSolve(model(p));
      if (!t || t.includes(UNKNOWN)) letters[k] = keep;
    }
  }

  function tryOnce(n) {
    const R = n, C = n, N = R * C;
    const nb = nbsOf(R, C);
    const shade = placeDominoes(N, nb);
    const letters = placeLetters(N, nb, shade);
    if (!letters) return null;
    const p = { R, C, letters };
    const s = Binary.logicSolve(model(p));
    if (!s || s.includes(UNKNOWN)) return null;
    thinLetters(p, N);
    p.solution = Uint8Array.from(shade, (x) => (x ? YES : NO));
    return p;
  }

  Binary.startGame({
    id: 'dominion',
    name: 'Dominion',
    rules: 'Shade some cells. Shaded cells form dominoes: each shaded cell touches exactly one other shaded cell by a side. ' +
      'Lettered cells stay white. The dominoes split the white cells into areas: cells with the same letter are in the ' +
      'same area, an area never holds two different letters, and every area holds a letter.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 7, def: 6 },
    solvedText: 'Every domain in order — nicely done.',
    generate(n) {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) { const p = tryOnce(n); if (p) return p; }
      return null;
    },
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.letters, (v) => (v ? String.fromCodePoint(64 + v) : '.')).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[.A-Z]+$/.test(d.g)) throw new Error('Invalid letters');
      return { R, C, letters: Int8Array.from(d.g, (ch) => (ch === '.' ? 0 : ch.codePointAt(0) - 64)) };
    },
    model,
    fixed: (p, k) => (p.letters[k] ? NO : 0),
    draw(p, k, el) { if (p.letters[k]) el.textContent = String.fromCodePoint(64 + p.letters[k]); },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'dm2-board',
  });
})();
