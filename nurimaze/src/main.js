// Nurimaze. Shade whole rooms. Cells with S, G, circles or triangles stay
// white. All white cells connect and never form a loop, so there is one
// way from S to G. That way passes every circle and no triangle. No 2×2
// block is all one colour. Built on the shared Binary game page.
// p.room per cell; p.mark: 0 none, 1 S, 2 G, 3 circle, 4 triangle.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { R, C, room, mark } = p;
    const N = R * C;
    const rooms = [];
    room.forEach((g, k) => { rooms[g] ??= []; rooms[g].push(k); });
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
      cons.push({ cells: [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1], min: 1, max: 3,
        why: (v) => (v === YES ? 'No 2×2 block may be all white.' : 'No 2×2 block may be all shaded.') });
    }
    for (let k = 0; k < N; k++) if (mark[k]) cons.push({ cells: [k], min: 0, max: 0, why: () => 'Marked cells stay white.' });
    const start = mark.indexOf(1), goal = mark.indexOf(2);
    function propagate(s, log) {
      for (const cells of rooms) {
        const known = cells.find((k) => s[k] !== UNKNOWN);
        if (known === undefined) continue;
        const v = s[known];
        if (cells.some((k) => s[k] !== UNKNOWN && s[k] !== v)) return false;
        const open = cells.filter((k) => s[k] === UNKNOWN);
        if (!open.length) continue;
        open.forEach((k) => { s[k] = v; });
        if (log) log.push({ cells: open, v, reason: 'A room is shaded or white as a whole.' });
        return open.length;
      }
      return 0;
    }
    function check(s, done) {
      // White cells never form a loop.
      const parent = Int32Array.from({ length: N }, (_, i) => i);
      const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      for (let k = 0; k < N; k++) {
        if (s[k] !== NO) continue;
        for (const j of nb(k)) {
          if (j < k || s[j] !== NO) continue;
          const a = find(k), b = find(j);
          if (a === b) return false;
          parent[a] = b;
        }
      }
      if (!Binary.canConnect(R, C, s, NO)) return false;
      if (!done) return true;
      // The way from S to G: every circle on it, no triangle.
      const prev = new Int32Array(N).fill(-2);
      prev[start] = -1;
      const queue = [start];
      for (const cur of queue) for (const j of nb(cur)) if (s[j] === NO && prev[j] === -2) { prev[j] = cur; queue.push(j); }
      if (prev[goal] === -2) return false;
      const onWay = new Set();
      for (let x = goal; x !== -1; x = prev[x]) onWay.add(x);
      for (let k = 0; k < N; k++) {
        if (mark[k] === 3 && !onWay.has(k)) return false;
        if (mark[k] === 4 && onWay.has(k)) return false;
      }
      return true;
    }
    return { N, cons, propagate, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 3));
      const room = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      const base = { R, C, room, mark: new Uint8Array(N) };
      const fill = Binary.randomFill({ ...model(base), check: (s, done) => model(base).check(s, false) }, 0.4, 10);
      if (!fill) continue;
      const whites = [...new Array(N).keys()].filter((k) => fill[k] === NO);
      if (whites.length < 6) continue;
      const start = whites[Math.floor(Math.random() * whites.length)];
      // Farthest white cell from S becomes G.
      const nb = (k) => { const r = Math.floor(k / C), c = k % C; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < R && b < C).map(([a, b]) => a * C + b); };
      const prev = new Int32Array(N).fill(-2);
      prev[start] = -1;
      const queue = [start];
      for (const cur of queue) for (const j of nb(cur)) if (fill[j] === NO && prev[j] === -2) { prev[j] = cur; queue.push(j); }
      const goal = queue.at(-1);
      const way = [];
      for (let x = goal; x !== -1; x = prev[x]) way.push(x);
      if (way.length < 4) continue;
      const mark = new Uint8Array(N);
      mark[start] = 1;
      mark[goal] = 2;
      for (const k of way) if (!mark[k]) mark[k] = 3;
      for (const k of whites) if (!mark[k]) mark[k] = 4;
      const p = { R, C, room, mark };
      const unique = () => {
        const t = Binary.logicSolve(model(p));
        if (t && !t.includes(UNKNOWN)) return true;
        if (!t) return false;
        const r = Binary.solve(model(p), 2, 3000, t);
        return r.solutions.length === 1 && !r.capped;
      };
      if (!unique()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (mark[k] !== 3 && mark[k] !== 4) continue;
        const keep = mark[k];
        mark[k] = 0;
        if (!unique()) mark[k] = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = fill;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'nurimaze',
    name: 'Nurimaze',
    rules: 'Shade whole rooms: each outlined room is either all shaded or all white. Cells with S, G, circles or ' +
      'triangles stay white. All white cells connect and never form a loop, so there is exactly one way from S to G. ' +
      'That way passes every circle and no triangle. No 2×2 block is all one colour.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 7, def: 6 },
    solvedText: 'Out of the maze — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''), m: Array.from(p.mark).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid rooms');
      if (typeof d.m !== 'string' || d.m.length !== R * C || !/^[0-4]+$/.test(d.m)) throw new Error('Invalid marks');
      const room = Int32Array.from({ length: R * C }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      return { R, C, room, mark: Uint8Array.from(d.m, Number) };
    },
    model,
    fixed: (p, k) => (p.mark[k] ? NO : 0),
    draw(p, k, el) {
      PuzzleShell.regionBorders(el, k, p.room, p.R, p.C);
      const m = p.mark[k];
      if (m === 1 || m === 2) { el.classList.add('nm2-letter'); el.textContent = m === 1 ? 'S' : 'G'; }
      if (m === 3) el.append(PuzzleShell.figure(2));
      if (m === 4) el.append(PuzzleShell.figure(3));
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'pz-regions nz-board',
  });
})();
