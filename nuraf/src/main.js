// Nuraf. Shade some cells. The white cells form islands; each island
// holds exactly two numbers, and its size lies strictly between them.
// Numbered cells stay white. All shaded cells connect, and no 2×2 block
// is all shaded. Built on the shared Binary game page (YES = shaded).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { R, C, clues } = p;
    const N = R * C;
    const nb = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    };
    const cons = [];
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      cons.push({ cells: [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1], min: 0, max: 3, why: () => 'No 2×2 block may be all shaded.' });
    }
    for (let k = 0; k < N; k++) if (clues[k] > 0) cons.push({ cells: [k], min: 0, max: 0, why: () => 'Numbered cells stay white.' });
    const comps = (s, ok) => {
      const id = new Int32Array(N).fill(-1), list = [];
      for (let k = 0; k < N; k++) {
        if (id[k] >= 0 || !ok(k)) continue;
        const cells = [k];
        id[k] = list.length;
        for (const cur of cells) for (const j of nb(cur)) if (id[j] < 0 && ok(j)) { id[j] = list.length; cells.push(j); }
        list.push(cells);
      }
      return { id, list };
    };
    function check(s, done) {
      const white = comps(s, (k) => s[k] === NO);
      for (const cells of white.list) {
        const nums = cells.filter((k) => clues[k] > 0).map((k) => clues[k]);
        if (nums.length > 2) return false;
        const closed = done || cells.every((k) => nb(k).every((j) => s[j] !== UNKNOWN));
        if (nums.length === 2 && cells.length >= Math.max(...nums)) return false;
        if (closed) {
          if (nums.length !== 2) return false;
          nums.sort((x, y) => x - y);
          const [a, b] = nums;
          if (!(cells.length > a && cells.length < b)) return false;
        }
      }
      return Binary.canConnect(R, C, s, YES);
    }
    return { N, cons, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const base = { R, C, clues: new Int8Array(N) };
      const fill = Binary.randomFill({ ...model(base), check: (s) => Binary.canConnect(R, C, s, YES) }, 0.55, 10);
      if (!fill) continue;
      // Islands of 2..8 cells; two numbers each around its size.
      const nb = (k) => { const r = Math.floor(k / C), c = k % C; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < R && b < C).map(([a, b]) => a * C + b); };
      const seen = new Uint8Array(N);
      const clues = new Int8Array(N);
      let ok = true;
      for (let k = 0; k < N && ok; k++) {
        if (fill[k] !== NO || seen[k]) continue;
        const cells = [k];
        seen[k] = 1;
        for (const cur of cells) for (const j of nb(cur)) if (fill[j] === NO && !seen[j]) { seen[j] = 1; cells.push(j); }
        if (cells.length < 2 || cells.length > 8) { ok = false; break; }
        const [x, y] = PuzzleShell.shuffle(cells.slice()).slice(0, 2);
        clues[x] = Math.max(1, cells.length - 1 - Math.floor(Math.random() * 2));
        clues[y] = cells.length + 1 + Math.floor(Math.random() * 2);
      }
      if (!ok) continue;
      const p = { R, C, clues };
      if (!Binary.isUnique(model(p))) continue;
      p.solution = fill;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'nuraf',
    name: 'Nuraf',
    rules: 'Shade some cells. The white cells form islands. Each island holds exactly two numbers, and its size lies ' +
      'strictly between them (with 2 and 5, the island has 3 or 4 cells). Numbered cells stay white. All shaded cells ' +
      'connect by their sides, and no 2×2 block is all shaded.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 6, def: 6 },
    solvedText: 'Every island between its numbers — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v > 0 ? v.toString(36) : '.')).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? 0 : Number.parseInt(ch, 36))) };
    },
    model,
    fixed: (p, k) => (p.clues[k] > 0 ? NO : 0),
    draw(p, k, el) { if (p.clues[k] > 0) el.textContent = p.clues[k]; },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'nb-board',
  });
})();
