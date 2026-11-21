// Arrows. Every cell around the grid gets one arrow (straight or
// diagonal) that points into the grid. A number counts the arrows that
// point at its cell (anywhere along the arrow's line).
// Slots go clockwise around the n x n grid: top, right, bottom, left.

(() => {
  const DIRS = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];

  // Outer positions (row, col) in board coordinates (-1 .. n).
  function slots(n) {
    const out = [];
    for (let c = 0; c < n; c++) out.push([-1, c]);
    for (let r = 0; r < n; r++) out.push([r, n]);
    for (let c = n - 1; c >= 0; c--) out.push([n, c]);
    for (let r = n - 1; r >= 0; r--) out.push([r, -1]);
    return out;
  }

  // For each slot: the directions that hit the grid, with the cells hit.
  function prepare(p) {
    const n = p.n;
    p.slots = slots(n).map(([r, c]) => {
      const opts = [];
      DIRS.forEach(([dr, dc], d) => {
        const cells = [];
        let y = r + dr, x = c + dc;
        while (y >= 0 && x >= 0 && y < n && x < n) { cells.push(y * n + x); y += dr; x += dc; }
        if (cells.length) opts.push({ d, cells });
      });
      return { r, c, opts };
    });
    return p;
  }

  // Counts arrow choices that match the numbers (up to stopAt).
  function solve(p, stopAt = 2) {
    const { n, nums, slots: S } = p;
    const got = new Int32Array(n * n);
    // How many slots could still add to each cell.
    const maybe = new Int32Array(n * n);
    S.forEach((s) => { const seen = new Set(); s.opts.forEach((o) => o.cells.forEach((k) => seen.add(k))); seen.forEach((k) => { maybe[k]++; }); });
    const pick = new Int8Array(S.length);
    const out = [];
    let nodes = 0;
    (function rec(i) {
      if (out.length >= stopAt || ++nodes > 200000) return;
      if (i === S.length) {
        if (nums.every((v, k) => got[k] === v)) out.push(Int8Array.from(pick));
        return;
      }
      const seen = new Set();
      S[i].opts.forEach((o) => o.cells.forEach((k) => seen.add(k)));
      for (const k of seen) maybe[k]--;
      for (const o of S[i].opts) {
        let ok = true;
        for (const k of o.cells) got[k]++;
        for (const k of seen) if (got[k] > nums[k] || got[k] + maybe[k] < nums[k]) { ok = false; break; }
        if (ok) { pick[i] = o.d; rec(i + 1); }
        for (const k of o.cells) got[k]--;
      }
      for (const k of seen) maybe[k]++;
    })(0);
    return out;
  }

  function generate(n) {
    for (let t = 0; t < 200; t++) {
      const p = prepare({ n, nums: new Int32Array(n * n) });
      const pick = p.slots.map((s) => s.opts[Math.floor(Math.random() * s.opts.length)]);
      for (const o of pick) for (const k of o.cells) p.nums[k]++;
      const sols = solve(p);
      if (sols.length !== 1) continue;
      p.solution = sols[0];
      return p;
    }
    return null;
  }

  function hints(p, s) {
    for (let i = 0; i < s.length; i++) if (s[i] >= 0 && s[i] !== p.solution[i]) return [{ slot: i, v: -1, reason: 'This arrow points the wrong way.' }];
    // A slot with only one direction that still fits the numbers.
    const got = new Int32Array(p.n * p.n);
    p.slots.forEach((sl, i) => { if (s[i] >= 0) sl.opts.find((o) => o.d === s[i]).cells.forEach((k) => { got[k]++; }); });
    for (let i = 0; i < s.length; i++) {
      if (s[i] >= 0) continue;
      const fit = p.slots[i].opts.filter((o) => o.cells.every((k) => got[k] < p.nums[k]));
      if (fit.length === 1) return [{ slot: i, v: fit[0].d, reason: 'Every other direction would hit a number that already has all its arrows.' }];
    }
    const i = [...s.keys()].find((j) => s[j] < 0);
    return i === undefined ? [] : [{ slot: i, v: p.solution[i], reason: 'No simple step is left. This arrow points here.' }];
  }

  function render(p, s, opts = {}) {
    const { n, nums, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const slotAt = new Map(p.slots.map((sl, i) => [`${sl.r},${sl.c}`, i]));
    return PuzzleShell.gridBoard({
      rows: n + 2, cols: n + 2, cellPx: PuzzleShell.fitCell(n + 2, 44), className: 'pz-board ar-board', readonly,
      renderCell(K, el) {
        const r = Math.floor(K / (n + 2)) - 1, c = (K % (n + 2)) - 1;
        if (r >= 0 && c >= 0 && r < n && c < n) { el.className = 'cell num'; el.textContent = nums[r * n + c]; return; }
        const i = slotAt.get(`${r},${c}`);
        if (i === undefined) { el.className = 'corner'; return; }
        el.classList.add('slot');
        if (hint && hint.slot === i) el.classList.add('hint');
        const v = result ? solution[i] : s[i];
        if (v >= 0) el.append(PuzzleShell.arrowIcon(v));
        if (result) el.classList.add(s[i] === solution[i] ? 'ok' : s[i] >= 0 ? 'bad' : 'show');
      },
      onCell(K, ev) {
        const r = Math.floor(K / (n + 2)) - 1, c = (K % (n + 2)) - 1;
        const i = slotAt.get(`${r},${c}`);
        if (i === undefined) return;
        // Cycle through the directions that hit the grid, then empty.
        const ds = [...p.slots[i].opts.map((o) => o.d), -1];
        const at = ds.indexOf(s[i]);
        s[i] = ds[(at + (ev.button === 2 ? ds.length - 1 : 1)) % ds.length];
        onChange();
      },
    });
  }

  PuzzleShell.start({
    id: 'arrows',
    name: 'Arrows',
    rules: 'Put one arrow in every cell around the grid. An arrow points straight or diagonally into the grid. ' +
      'A number tells how many arrows point at its cell (anywhere along their line).',
    controls: 'Click a cell around the grid to turn its arrow. Right click turns it back.',
    size: { min: 3, max: 8, def: 5 },
    solvedText: 'Every arrow on target — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, g: Array.from(p.nums).join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 2 || n > 10) throw new Error('Invalid size');
      const nums = Int32Array.from(String(d.g).split(','), Number);
      if (nums.length !== n * n) throw new Error('Invalid numbers');
      const p = prepare({ n, nums });
      const sols = solve(p);
      if (sols.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = sols[0];
      return p;
    },
    newState: (p) => new Int8Array(p.slots.length).fill(-1),
    saveState: (s) => Array.from(s).join(','),
    loadState(p, v) {
      const s = new Int8Array(p.slots.length).fill(-1);
      const parts = String(v).split(',');
      if (parts.length === s.length) parts.forEach((x, i) => { const y = Number(x); if (y >= -1 && y < 8) s[i] = y; });
      return s;
    },
    render,
    check: (p, s) => s.every((v, i) => v === p.solution[i]),
    hints,
    applyHint(p, s, h) { s[h.slot] = h.v; },
  });
})();
