// Golem Grad. Shade some cells. The white cells form islands; an island
// holds at most one number, and a number is its island's size. All shaded
// cells connect, and no 2×2 block is all shaded. The shaded cells split
// into snakes: paths one cell wide whose two ends are circles. Every
// circle is a snake's end and is shaded.
// Built on the shared Binary game page (YES = shaded).
// p.clues: island sizes (0 = none); p.ring: circles.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function neighbours(R, C) {
    return Array.from({ length: R * C }, (_, k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    });
  }

  // Can the shaded cells split into paths that start and end on circles?
  function snakesFit(nb, black, ring, budget = 20000) {
    const N = black.length;
    const used = new Uint8Array(N);
    let left = 0;
    for (let k = 0; k < N; k++) if (black[k]) left++;
    let nodes = 0;
    const rec = () => {
      if (++nodes > budget) return false;
      if (!left) return true;
      const start = ring.findIndex((v, k) => v && black[k] && !used[k]);
      if (start < 0) return false;
      used[start] = 1; left--;
      const walk = (x, len) => {
        for (const j of nb[x]) {
          if (!black[j] || used[j]) continue;
          used[j] = 1; left--;
          if (ring[j]) { if (rec()) return true; }
          else if (walk(j, len + 1)) return true;
          used[j] = 0; left++;
        }
        return false;
      };
      if (walk(start, 1)) return true;
      used[start] = 0; left++;
      return false;
    };
    return rec();
  }

  function model(p) {
    const { R, C, clues, ring } = p;
    const N = R * C;
    const nb = neighbours(R, C);
    const cons = [];
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      cons.push({ cells: [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1], min: 0, max: 3, why: () => 'No 2×2 block may be all shaded.' });
    }
    for (let k = 0; k < N; k++) {
      if (clues[k]) cons.push({ cells: [k], min: 0, max: 0, why: () => 'Numbered cells stay white.' });
      if (ring[k]) {
        cons.push({ cells: [k], min: 1, max: 1, why: () => 'Circles are snake ends, so they are shaded.' }, { cells: nb[k], min: 1, max: nb[k].length, why: () => 'A snake end needs a shaded neighbour.' });
      }
    }
    function check(s, done) {
      // Islands: at most one number; size fits.
      const seen = new Uint8Array(N);
      for (let k = 0; k < N; k++) {
        if (seen[k] || s[k] !== NO) continue;
        const cells = [k];
        seen[k] = 1;
        for (let i = 0; i < cells.length; i++) for (const j of nb[cells[i]]) if (!seen[j] && s[j] === NO) { seen[j] = 1; cells.push(j); }
        const nums = cells.filter((x) => clues[x]);
        if (nums.length > 1) return false;
        const closed = done || cells.every((x) => nb[x].every((j) => s[j] !== UNKNOWN));
        if (nums.length && (cells.length > clues[nums[0]] || (closed && cells.length !== clues[nums[0]]))) return false;
      }
      // Snake body cells need two shaded neighbours.
      for (let k = 0; k < N; k++) {
        if (s[k] !== YES || ring[k]) continue;
        if (nb[k].filter((j) => s[j] !== NO).length < 2) return false;
      }
      if (!Binary.canConnect(R, C, s, YES)) return false;
      if (done) return snakesFit(nb, Uint8Array.from(s, (v) => (v === YES ? 1 : 0)), ring);
      return true;
    }
    return { N, cons, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const nb = neighbours(R, C);
      const base = { R, C, clues: new Int8Array(N), ring: new Uint8Array(N) };
      const fill = Binary.randomFill({ ...model(base), cons: model(base).cons.filter((c) => c.cells.length === 4), check: (s) => Binary.canConnect(R, C, s, YES) }, 0.55, 10);
      if (!fill) continue;
      const black = Uint8Array.from(fill, (v) => (v === YES ? 1 : 0));
      // Random snakes: walk from cells with few free neighbours.
      const used = new Uint8Array(N);
      const ring = new Uint8Array(N);
      let ok = true;
      for (;;) {
        const free = [...new Array(N).keys()].filter((k) => black[k] && !used[k]);
        if (!free.length) break;
        const deg = (k) => nb[k].filter((j) => black[j] && !used[j]).length;
        const start = free.reduce((a, b) => (deg(b) < deg(a) || (deg(b) === deg(a) && Math.random() < 0.3) ? b : a), free[0]);
        const path = [start];
        used[start] = 1;
        const want = 2 + Math.floor(Math.random() * 6);
        while (path.length < want) {
          const x = path.at(-1);
          const opts = nb[x].filter((j) => black[j] && !used[j]);
          if (!opts.length) break;
          const j = opts.reduce((a, b) => (deg(b) < deg(a) ? b : a), opts[0]);
          used[j] = 1;
          path.push(j);
        }
        if (path.length < 2) { ok = false; break; }
        ring[path[0]] = 1;
        ring[path.at(-1)] = 1;
      }
      if (!ok) continue;
      // Every island gets its size; then drop sizes that are not needed.
      const clues = new Int8Array(N);
      const seen = new Uint8Array(N);
      for (let k = 0; k < N; k++) {
        if (black[k] || seen[k]) continue;
        const cells = [k];
        seen[k] = 1;
        for (let i = 0; i < cells.length; i++) for (const j of nb[cells[i]]) if (!seen[j] && !black[j]) { seen[j] = 1; cells.push(j); }
        if (cells.length > 35) { ok = false; break; }
        clues[cells[Math.floor(Math.random() * cells.length)]] = cells.length;
      }
      if (!ok) continue;
      const p = { R, C, clues, ring };
      const unique = () => {
        const t = Binary.logicSolve(model(p));
        if (t && !t.includes(UNKNOWN)) return Binary.solve(model(p), 2, 2000, t).solutions.length === 1;
        if (!t) return false;
        const r = Binary.solve(model(p), 2, 3000, t);
        return r.solutions.length === 1 && !r.capped;
      };
      if (!unique()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (!clues[k]) continue;
        const keep = clues[k];
        clues[k] = 0;
        if (!unique()) clues[k] = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = fill;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'golem-grad',
    name: 'Golem Grad',
    rules: 'Shade some cells. The white cells form islands; an island holds at most one number, and a number is the size ' +
      'of its island. All shaded cells connect, and no 2×2 block is all shaded. The shaded cells split into snakes: paths ' +
      'one cell wide whose two ends are circles. Every circle is the end of a snake.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 9, def: 7 },
    solvedText: 'Snakes and islands in order — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v > 0 ? v.toString(36) : '.')).join(''), o: Array.from(p.ring).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C || typeof d.o !== 'string' || d.o.length !== R * C) throw new Error('Invalid clues');
      return { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? 0 : Number.parseInt(ch, 36))), ring: Uint8Array.from(d.o, Number) };
    },
    model,
    fixed: (p, k) => (p.clues[k] > 0 ? NO : p.ring[k] ? YES : 0),
    draw(p, k, el) {
      if (p.clues[k] > 0) el.textContent = p.clues[k];
      if (p.ring[k]) { const o = document.createElement('span'); o.className = 'gg-ring'; el.append(o); }
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'nb-board gg-board',
  });
})();
