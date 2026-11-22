// Thermometers. Fill thermometers from the bulb up. Numbers outside
// tell how many cells are filled per row and column.
// Built on the shared Binary game page.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { R, C, rows, cols, thermos } = p;
    const cons = [];
    const lineWhy = (name, n) => (v) => {
      if (v === YES) return `${name} needs ${PuzzleShell.plural(n, 'filled cell')}. The open cells must all be filled.`;
      if (n === 0) return `${name} has no filled cells. All its cells stay empty.`;
      return `${name} already has its ${PuzzleShell.plural(n, 'filled cell')}. The rest stay empty.`;
    };
    for (let r = 0; r < R; r++) {
      const cells = Array.from({ length: C }, (_, c) => r * C + c);
      cons.push({ cells, min: rows[r], max: rows[r], area: cells, why: lineWhy(`Row ${r + 1}`, rows[r]) });
    }
    for (let c = 0; c < C; c++) {
      const cells = Array.from({ length: R }, (_, r) => r * C + c);
      cons.push({ cells, min: cols[c], max: cols[c], area: cells, why: lineWhy(`Column ${c + 1}`, cols[c]) });
    }
    function propagate(s, log) {
      for (const t of thermos) {
        // Highest filled cell and lowest empty cell.
        let top = -1, low = t.length;
        t.forEach((k, i) => {
          if (s[k] === YES) { top = i; }
          if (s[k] === NO && low === t.length) { low = i; }
        });
        if (top >= low) return false;
        const fill = t.slice(0, Math.max(0, top)).filter((k) => s[k] === UNKNOWN);
        if (fill.length) {
          for (const k of fill) s[k] = YES;
          if (log) log.push({ cells: fill, v: YES, reason: 'A thermometer fills from its bulb. Everything below a filled cell is filled too.' });
          return fill.length;
        }
        const empty = t.slice(low + 1).filter((k) => s[k] === UNKNOWN);
        if (empty.length) {
          for (const k of empty) s[k] = NO;
          if (log) log.push({ cells: empty, v: NO, reason: 'A thermometer fills from its bulb. Everything above an empty cell is empty too.' });
          return empty.length;
        }
      }
      return 0;
    }
    return { N: R * C, cons, propagate };
  }

  // Tiles the grid with straight thermometers of 1..5 cells.
  function tile(n) {
    const used = new Int32Array(n * n).fill(-1);
    const thermos = [];
    for (let k = 0; k < n * n; k++) {
      if (used[k] >= 0) continue;
      const r = Math.floor(k / n), c = k % n;
      let maxW = 0, maxH = 0;
      while (c + maxW < n && used[k + maxW] < 0 && maxW < 5) maxW++;
      while (r + maxH < n && used[k + maxH * n] < 0 && maxH < 5) maxH++;
      const horiz = maxW > 1 && (maxH < 2 || Math.random() < 0.5);
      const max = horiz ? maxW : maxH;
      const len = max < 2 ? 1 : 2 + Math.floor(Math.random() * (max - 1));
      const cells = Array.from({ length: len }, (_, i) => (horiz ? k + i : k + i * n));
      if (Math.random() < 0.5) cells.reverse();
      cells.forEach((j) => { used[j] = thermos.length; });
      thermos.push(cells);
    }
    return thermos;
  }

  function tryOnce(n) {
    const thermos = tile(n);
    if (thermos.filter((t) => t.length === 1).length > n / 2) return null;
    const sol = new Uint8Array(n * n).fill(NO);
    for (const t of thermos) {
      const level = Math.floor(Math.random() * (t.length + 1));
      t.slice(0, level).forEach((k) => { sol[k] = YES; });
    }
    const rows = [], cols = [];
    for (let i = 0; i < n; i++) {
      let a = 0, b = 0;
      for (let j = 0; j < n; j++) { a += sol[i * n + j] === YES; b += sol[j * n + i] === YES; }
      rows.push(a); cols.push(b);
    }
    const p = { R: n, C: n, rows, cols, thermos };
    const s = Binary.logicSolve(model(p));
    if (!s || s.includes(UNKNOWN)) return null;
    p.solution = sol;
    return p;
  }

  const NS = 'http://www.w3.org/2000/svg';
  // Draws the bulb and tube part of a cell as a small SVG.
  function draw(p, k, el, v) {
    if (!p.info) {
      p.info = [];
      p.thermos.forEach((t) => t.forEach((j, i) => { p.info[j] = { prev: t[i - 1], next: t[i + 1], base: i === 0 }; }));
    }
    const info = p.info[k];
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 10 10');
    svg.setAttribute('class', 'thermo');
    const color = v === YES ? '#e53935' : '#e0e0e0';
    const add = (name, attrs) => {
      const e = document.createElementNS(NS, name);
      for (const a in attrs) e.setAttribute(a, attrs[a]);
      e.setAttribute('fill', color);
      svg.appendChild(e);
    };
    const C = p.C;
    for (const j of [info.prev, info.next]) {
      if (j === undefined) continue;
      if (j === k - 1) add('rect', { x: 0, y: 3.2, width: 5, height: 3.6 });
      if (j === k + 1) add('rect', { x: 5, y: 3.2, width: 5, height: 3.6 });
      if (j === k - C) add('rect', { x: 3.2, y: 0, width: 3.6, height: 5 });
      if (j === k + C) add('rect', { x: 3.2, y: 5, width: 3.6, height: 5 });
    }
    if (info.base) add('circle', { cx: 5, cy: 5, r: 3.6 });
    else add('circle', { cx: 5, cy: 5, r: 1.8 });
    el.appendChild(svg);
  }

  const filled = (s, cells) => cells.filter((k) => s[k] === YES).length;

  Binary.startGame({
    id: 'thermometers',
    name: 'Thermometers',
    rules: 'Fill some thermometers. Each one fills from its round bulb up, with no gaps — it may be empty, part full or full. ' +
      'The numbers tell how many filled cells each row and column has.',
    controls: 'Click a cell to fill it, click again to mark it empty. Right click cycles the other way.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'All thermometers read right — nicely done.',
    generate(n) {
      const deadline = Date.now() + 6000;
      while (Date.now() < deadline) { const p = tryOnce(n); if (p) return p; }
      return null;
    },
    encode: (p) => ({ n: p.R, r: p.rows.join(','), c: p.cols.join(','), t: p.thermos.map((t) => t.join('.')).join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 15) throw new Error('Invalid board size');
      const nums = (x) => String(x).split(',').map(Number);
      const rows = nums(d.r), cols = nums(d.c);
      if (rows.length !== n || cols.length !== n || [...rows, ...cols].some((x) => !(x >= 0 && x <= n))) throw new Error('Invalid counts');
      const thermos = String(d.t).split(',').map((t) => t.split('.').map(Number));
      const seen = new Set();
      for (const t of thermos) for (const k of t) {
        if (!(k >= 0 && k < n * n) || seen.has(k)) throw new Error('Invalid thermometers');
        seen.add(k);
      }
      return { R: n, C: n, rows, cols, thermos };
    },
    model,
    draw,
    top: (p, s) => p.cols.map((v, c) => [v, filled(s, Array.from({ length: p.R }, (_, r) => r * p.C + c)) === v]),
    left: (p, s) => p.rows.map((v, r) => [v, filled(s, Array.from({ length: p.C }, (_, c) => r * p.C + c)) === v]),
    noun: 'filled cell', noNoun: 'empty cell',
    className: 'th-board', yesClass: 'full', noClass: 'empty',
  });
})();
