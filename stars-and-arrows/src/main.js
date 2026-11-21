// Stars and Arrows. Place stars in empty cells. Each arrow points at
// exactly one star (somewhere along its line), and each star is pointed
// at by exactly one arrow. Numbers outside count the stars per row and
// column. Built on the shared Binary game page (YES = star).

(() => {
  const { UNKNOWN, YES, NO } = Binary;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
  const TURN = [0, 4, 6, 2, 7, 1, 5, 3]; // DIRS index -> 45-degree steps

  function rays(p) {
    const { R, C, arrows } = p;
    const out = [];
    for (let k = 0; k < R * C; k++) {
      const a = arrows[k];
      if (a < 0) continue;
      const [dr, dc] = DIRS[a], cells = [];
      let r = Math.floor(k / C) + dr, c = (k % C) + dc;
      while (r >= 0 && c >= 0 && r < R && c < C) { if (arrows[r * C + c] < 0) cells.push(r * C + c); r += dr; c += dc; }
      out.push([k, cells]);
    }
    return out;
  }

  function model(p) {
    const { R, C, arrows, rows, cols } = p;
    const cons = [];
    const hits = new Int32Array(R * C);
    for (const [k, cells] of rays(p)) {
      for (const j of cells) hits[j]++;
      cons.push({ cells, min: 1, max: 1, at: k, area: cells,
        why: (v) => (v === YES ? 'This arrow needs a star, and only this cell is left on its line.' : 'This arrow already points at its star.') });
    }
    for (let k = 0; k < R * C; k++) {
      if (arrows[k] >= 0) cons.push({ cells: [k], min: 0, max: 0 });
      else if (hits[k] !== 1) cons.push({ cells: [k], min: 0, max: 0, why: () => (hits[k] ? 'Two arrows point at this cell, so it can not hold a star.' : 'No arrow points at this cell, so it can not hold a star.') });
    }
    for (let r = 0; r < R; r++) {
      const cells = Array.from({ length: C }, (_, c) => r * C + c);
      cons.push({ cells, min: rows[r], max: rows[r], area: cells, why: (v) => (v === YES ? `Row ${r + 1} needs more stars, and only these cells are left.` : `Row ${r + 1} already has its stars.`) });
    }
    for (let c = 0; c < C; c++) {
      const cells = Array.from({ length: R }, (_, r) => r * C + c);
      cons.push({ cells, min: cols[c], max: cols[c], area: cells, why: (v) => (v === YES ? `Column ${c + 1} needs more stars, and only these cells are left.` : `Column ${c + 1} already has its stars.`) });
    }
    return { N: R * C, cons };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const arrows = new Int8Array(N).fill(-1);
      const star = new Uint8Array(N);
      // Place arrow-star pairs; each new arrow's line holds only its star.
      for (let t = 0; t < N * 3; t++) {
        const k = Math.floor(Math.random() * N);
        if (arrows[k] >= 0 || star[k]) continue;
        const d = Math.floor(Math.random() * 8);
        const [dr, dc] = DIRS[d], line = [];
        let r = Math.floor(k / C) + dr, c = (k % C) + dc;
        while (r >= 0 && c >= 0 && r < R && c < C) { line.push(r * C + c); r += dr; c += dc; }
        const free = line.filter((j) => arrows[j] < 0 && !star[j]);
        if (!free.length || line.some((j) => star[j])) continue;
        const s = free[Math.floor(Math.random() * free.length)];
        // The star may not already be on another arrow's line.
        const p0 = { R, C, arrows };
        if (rays(p0).some(([, cells]) => cells.includes(s) || cells.includes(k))) continue;
        arrows[k] = d;
        star[s] = 1;
      }
      const rows = [], cols = [];
      for (let i = 0; i < n; i++) {
        let a = 0, b = 0;
        for (let j = 0; j < n; j++) { a += star[i * n + j]; b += star[j * n + i]; }
        rows.push(a); cols.push(b);
      }
      const p = { R, C, arrows, rows, cols };
      const sol = Uint8Array.from(star, (x) => (x ? YES : NO));
      // The construction must satisfy the rules (each star on one line).
      if (!model(p).cons.every((con) => { const y = con.cells.filter((j) => sol[j] === YES).length; return y >= con.min && y <= con.max; })) continue;
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      p.solution = sol;
      return p;
    }
    return null;
  }

  const count = (s, cells) => cells.filter((k) => s[k] === YES).length;

  Binary.startGame({
    id: 'stars-and-arrows',
    name: 'Stars and Arrows',
    rules: 'Place stars in empty cells. Each arrow points at exactly one star somewhere along its line, and every star ' +
      'is pointed at by exactly one arrow. The numbers outside tell how many stars each row and column holds.',
    controls: 'Click a cell to place a star, click again to mark it empty. Right click cycles the other way.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'Every arrow hit its star — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, a: Array.from(p.arrows, (v) => (v < 0 ? '.' : v)).join(''), r: p.rows.join(','), c: p.cols.join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 15) throw new Error('Invalid board size');
      if (typeof d.a !== 'string' || d.a.length !== n * n || !/^[.0-7]+$/.test(d.a)) throw new Error('Invalid arrows');
      const nums = (x) => String(x).split(',').map(Number);
      return { R: n, C: n, arrows: Int8Array.from(d.a, (ch) => (ch === '.' ? -1 : Number(ch))), rows: nums(d.r), cols: nums(d.c) };
    },
    model,
    fixed: (p, k) => (p.arrows[k] >= 0 ? NO : 0),
    draw(p, k, el) { if (p.arrows[k] >= 0) { el.append(PuzzleShell.arrowIcon(TURN[p.arrows[k]])); el.classList.add('arrow'); } },
    top: (p, s) => p.cols.map((v, c) => [v, count(s, Array.from({ length: p.R }, (_, r) => r * p.C + c)) === v]),
    left: (p, s) => p.rows.map((v, r) => [v, count(s, Array.from({ length: p.C }, (_, c) => r * p.C + c)) === v]),
    noun: 'star', noNoun: 'empty cell',
    className: 'sa-board', yesClass: 'star', noClass: 'dot',
  });
})();
