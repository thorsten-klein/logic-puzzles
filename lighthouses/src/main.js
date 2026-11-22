// Lighthouses. Place one-cell ships. A lighthouse number counts the
// ships in its row and column. Every ship is in line with at least one
// lighthouse. Ships never touch each other or a lighthouse, not even at
// a corner. Built on the shared Binary game page (YES = ship).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function model(p) {
    const { R, C, lights } = p;
    const N = R * C;
    const isLight = (k) => lights[k] >= 0;
    const cons = [];
    const seen = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      if (!isLight(k)) continue;
      const r = Math.floor(k / C), c = k % C;
      cons.push({ cells: [k], min: 0, max: 0, why: () => 'A lighthouse cell holds no ship.' });
      // Cells around a lighthouse stay empty.
      const ring = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if ((dr || dc) && nr >= 0 && nc >= 0 && nr < R && nc < C && !isLight(nr * C + nc)) ring.push(nr * C + nc);
      }
      if (ring.length) cons.push({ cells: ring, min: 0, max: 0, why: () => 'Ships never touch a lighthouse, not even at a corner.' });
      const line = [];
      for (let j = 0; j < C; j++) if (!isLight(r * C + j)) line.push(r * C + j);
      for (let i = 0; i < R; i++) if (!isLight(i * C + c)) line.push(i * C + c);
      line.forEach((j) => { seen[j] = 1; });
      const v = lights[k];
      cons.push({ cells: line, min: v, max: v, area: line, at: k,
        why: (x) => {
          if (x === YES) return `This lighthouse sees ${PuzzleShell.plural(v, 'ship')}, and only these cells are left.`;
          if (v === 0) return 'This lighthouse sees no ships. Its row and column are empty.';
          return `This lighthouse already sees its ${PuzzleShell.plural(v, 'ship')}. No more ships in its row and column.`;
        } });
    }
    const dark = [];
    for (let k = 0; k < N; k++) if (!seen[k] && !isLight(k)) dark.push(k);
    if (dark.length) cons.push({ cells: dark, min: 0, max: 0, why: () => 'No lighthouse shines here, so no ship can be here.' });
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      const k = r * C + c;
      cons.push({ cells: [k, k + 1, k + C, k + C + 1], min: 0, max: 1, why: () => 'Ships never touch, not even at a corner.' });
    }
    return { N, cons };
  }

  function tryOnce(n) {
    const R = n, C = n, N = R * C;
    const lights = new Int8Array(N).fill(-1);
    const ship = new Uint8Array(N);
    const near = (k, test) => {
      const r = Math.floor(k / C), c = k % C;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nc >= 0 && nr < R && nc < C && test(nr * C + nc)) return true;
      }
      return false;
    };
    const lightCount = Math.max(2, Math.round(N / 10));
    for (const k of PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, lightCount)) lights[k] = 0;
    for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
      if (lights[k] >= 0 || near(k, (j) => ship[j] || lights[j] >= 0)) continue;
      const r = Math.floor(k / C), c = k % C;
      let lit = false;
      for (let j = 0; j < N; j++) if (lights[j] >= 0 && (Math.floor(j / C) === r || j % C === c)) lit = true;
      if (lit && Math.random() < 0.6) ship[k] = 1;
    }
    for (let k = 0; k < N; k++) {
      if (lights[k] < 0) continue;
      const r = Math.floor(k / C), c = k % C;
      let v = 0;
      for (let j = 0; j < N; j++) if (ship[j] && (Math.floor(j / C) === r || j % C === c)) v++;
      lights[k] = v;
    }
    const p = { R, C, lights };
    const s = Binary.logicSolve(model(p));
    if (!s || s.includes(UNKNOWN)) return null;
    p.solution = Uint8Array.from(ship, (x) => (x ? YES : NO));
    if (!s.every((v, k) => v === p.solution[k] || lights[k] >= 0)) return null;
    return p;
  }

  Binary.startGame({
    id: 'lighthouses',
    name: 'Lighthouses',
    rules: 'Place ships (one cell each). A lighthouse number tells how many ships are in its row and column together. ' +
      'Every ship is in the row or column of at least one lighthouse. Ships never touch each other or a lighthouse, ' +
      'not even at a corner.',
    controls: 'Click a cell to place a ship, click again to mark water. Right click cycles the other way.',
    size: { min: 5, max: 10, def: 8 },
    solvedText: 'All ships in the light — nicely done.',
    generate(n) {
      const deadline = Date.now() + 8000;
      // A board without ships has nothing to do: try again.
      while (Date.now() < deadline) { const p = tryOnce(n); if (p?.solution.includes(YES)) return p; }
      return null;
    },
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.lights, (v) => (v < 0 ? '.' : v.toString(36))).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid grid');
      const lights = Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number.parseInt(ch, 36)));
      if (lights.some((v) => Number.isNaN(v))) throw new Error('Invalid grid');
      return { R, C, lights };
    },
    model,
    fixed: (p, k) => (p.lights[k] >= 0 ? NO : 0),
    draw(p, k, el) { if (p.lights[k] >= 0) { el.textContent = p.lights[k]; el.classList.add('light'); } },
    noun: 'ship', noNoun: 'water cell',
    className: 'lh-board', yesClass: 'ship', noClass: 'water',
  });
})();
