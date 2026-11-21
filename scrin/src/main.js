// Scrin (Screen). Shade some rectangles. Rectangles never share a side;
// each touches exactly two others at a corner, and together they form one
// ring. A rectangle holds at most one circle; a number in a circle is its
// size. Circles are always shaded.
// Built on the shared Binary game page (YES = shaded).
// p.ring: 0 none, 1 empty circle, v + 1 circle with size v.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  // Rectangles as { r0, c0, r1, c1 }. Relation: 0 apart, 1 corner touch, 2 clash.
  function relation(a, b) {
    const rows = !(a.r1 < b.r0 || b.r1 < a.r0), cols = !(a.c1 < b.c0 || b.c1 < a.c0);
    const rowNext = a.r1 + 1 === b.r0 || b.r1 + 1 === a.r0, colNext = a.c1 + 1 === b.c0 || b.c1 + 1 === a.c0;
    if (rows && cols) return 2;
    if ((rows && colNext) || (cols && rowNext)) return 2;
    if (rowNext && colNext) return 1;
    return 0;
  }

  function model(p) {
    const { R, C, ring } = p;
    const N = R * C;
    const cons = [];
    for (let k = 0; k < N; k++) if (ring[k]) cons.push({ cells: [k], min: 1, max: 1, why: () => 'Circles are inside rectangles.' });
    const nb = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    };
    function check(s, done) {
      const seen = new Uint8Array(N);
      const rects = [];
      for (let k = 0; k < N; k++) {
        if (seen[k] || s[k] !== YES) continue;
        const cells = [k];
        seen[k] = 1;
        for (let i = 0; i < cells.length; i++) for (const j of nb(cells[i])) if (!seen[j] && s[j] === YES) { seen[j] = 1; cells.push(j); }
        const rs = cells.map((x) => Math.floor(x / C)), cs = cells.map((x) => x % C);
        const box = { r0: Math.min(...rs), r1: Math.max(...rs), c0: Math.min(...cs), c1: Math.max(...cs) };
        const area = (box.r1 - box.r0 + 1) * (box.c1 - box.c0 + 1);
        // Holes inside the box can never be filled by this area if they are white.
        for (let r = box.r0; r <= box.r1; r++) for (let c = box.c0; c <= box.c1; c++) if (s[r * C + c] === NO) return false;
        const circ = cells.filter((x) => ring[x]);
        if (circ.length > 1) return false;
        const num = circ.length && ring[circ[0]] > 1 ? ring[circ[0]] - 1 : 0;
        if (num && area > num) return false;
        const closed = done || cells.every((x) => nb(x).every((j) => s[j] !== UNKNOWN));
        if (closed) {
          if (area !== cells.length) return false;
          if (num && cells.length !== num) return false;
          rects.push(box);
        }
      }
      // Corner contacts among finished rectangles.
      const deg = rects.map(() => 0);
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        if (relation(rects[i], rects[j]) === 1) { deg[i]++; deg[j]++; }
      }
      if (deg.some((d) => d > 2)) return false;
      if (done) {
        if (rects.length < 3 || deg.some((d) => d !== 2)) return false;
        // One ring: walk the contacts.
        const seenR = new Set([0]);
        const st = [0];
        while (st.length) { const i = st.pop(); for (let j = 0; j < rects.length; j++) if (!seenR.has(j) && relation(rects[i], rects[j]) === 1) { seenR.add(j); st.push(j); } }
        if (seenR.size !== rects.length) return false;
      }
      return true;
    }
    return { N, cons, check };
  }

  // A random ring of rectangles that touch at corners (or null).
  function randomRing(n) {
    const inGrid = (b) => b.r0 >= 0 && b.c0 >= 0 && b.r1 < n && b.c1 < n;
    const grow = (last) => {
      const corners = [[last.r0, last.c0, -1, -1], [last.r0, last.c1, -1, 1], [last.r1, last.c0, 1, -1], [last.r1, last.c1, 1, 1]];
      const [r, c, dr, dc] = corners[Math.floor(Math.random() * 4)];
      const h = 1 + Math.floor(Math.random() * 3), w = 1 + Math.floor(Math.random() * 3);
      const r0 = r + dr, c0 = c + dc, r1 = r + dr * h, c1 = c + dc * w;
      return { r0: Math.min(r0, r1), r1: Math.max(r0, r1), c0: Math.min(c0, c1), c1: Math.max(c0, c1) };
    };
    for (let t = 0; t < 300; t++) {
      const h = 1 + Math.floor(Math.random() * 3), w = 1 + Math.floor(Math.random() * 3);
      const r0 = Math.floor(Math.random() * (n - h + 1)), c0 = Math.floor(Math.random() * (n - w + 1));
      const list = [{ r0, c0, r1: r0 + h - 1, c1: c0 + w - 1 }];
      for (let step = 0; step < 60 && list.length < 16; step++) {
        const b = grow(list.at(-1));
        if (!inGrid(b)) continue;
        const rel = list.map((a) => relation(a, b));
        const last = list.length - 1;
        if (rel.some((v, i) => (i === last ? v !== 1 : i === 0 && list.length >= 3 ? v === 2 : v !== 0))) continue;
        list.push(b);
        if (list.length >= 4 && rel[0] === 1) return list;
      }
    }
    return null;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const rects = randomRing(n);
      if (!rects) continue;
      const sol = new Uint8Array(N).fill(NO);
      const ring = new Uint8Array(N);
      for (const b of rects) {
        const cells = [];
        for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) { sol[r * n + c] = YES; cells.push(r * n + c); }
        ring[cells[Math.floor(Math.random() * cells.length)]] = cells.length + 1;
      }
      const p = { R: n, C: n, ring };
      const unique = () => {
        const t = Binary.logicSolve(model(p));
        if (t && !t.includes(UNKNOWN)) return true;
        if (!t) return false;
        const r = Binary.solve(model(p), 2, 3000, t);
        return r.solutions.length === 1 && !r.capped;
      };
      if (!unique()) continue;
      // Drop numbers (keep circles), then whole circles where possible.
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (!ring[k]) continue;
        const keep = ring[k];
        ring[k] = 1;
        if (!unique()) { ring[k] = keep; continue; }
        ring[k] = 0;
        if (!unique()) ring[k] = 1;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'scrin',
    name: 'Scrin',
    rules: 'Shade some rectangles. Rectangles never share a side. Each rectangle touches exactly two others at a corner, ' +
      'and together they form one closed ring. A rectangle holds at most one circle, and a number in a circle is the ' +
      'rectangle\'s size. Circles are always inside rectangles.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 7, def: 6 },
    solvedText: 'A perfect ring of screens — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, o: Array.from(p.ring).join(',') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      const ring = Uint8Array.from(String(d.o).split(','), Number);
      if (ring.length !== R * C) throw new Error('Invalid circles');
      return { R, C, ring };
    },
    model,
    fixed: (p, k) => (p.ring[k] ? YES : 0),
    draw(p, k, el) {
      if (!p.ring[k]) return;
      const o = document.createElement('span');
      o.className = 'gg-ring';
      el.append(o);
      if (p.ring[k] > 1) el.append(String(p.ring[k] - 1));
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'nb-board gg-board',
  });
})();
