// Sashikabe. Shade some cells. All shaded cells connect, and no 2×2 block
// is all shaded. The white cells form islands that never touch; every
// island is an L shape with legs one cell wide. A circle marks the bend of
// its L; a number in it is the island's size. An arrow sits at the end of
// a leg and points toward the bend. Clue cells stay white.
// Built on the shared Binary game page (YES = shaded).
// Clues: 1 = circle, v + 1 = circle with size v, 40 + d = arrow (0 up,
// 1 down, 2 left, 3 right).

(() => {
  const { UNKNOWN, YES, NO } = Binary;
  const STEP = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const ARROW = ['↑︎', '↓︎', '←︎', '→︎'];

  function shape(C, cells) {
    const set = new Set(cells);
    for (const k of cells) {
      const r = Math.floor(k / C), c = k % C;
      const legs = [];
      for (let d = 0; d < 4; d++) {
        const leg = [];
        for (let i = 1; ; i++) {
          const a = r + STEP[d][0] * i, b = c + STEP[d][1] * i;
          if (a < 0 || b < 0 || b >= C || !set.has(a * C + b)) break;
          leg.push(a * C + b);
        }
        if (leg.length) legs.push({ d, leg });
      }
      if (legs.length === 2 && (legs[0].d >> 1) !== (legs[1].d >> 1) && 1 + legs[0].leg.length + legs[1].leg.length === cells.length) return { bend: k, legs };
    }
    return null;
  }
  const cluesFit = (clues, cells, L) => cells.every((k) => {
    const v = clues[k];
    if (!v) return true;
    if (v < 40) return k === L.bend && (v === 1 || v - 1 === cells.length);
    return L.legs.some(({ d, leg }) => leg.at(-1) === k && v - 40 === (d ^ 1));
  });

  function model(p) {
    const { R, C, clues } = p;
    const N = R * C;
    const cons = [];
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      cons.push({ cells: [r * C + c, r * C + c + 1, (r + 1) * C + c, (r + 1) * C + c + 1], min: 0, max: 3, why: () => 'No 2×2 block may be all shaded.' });
    }
    for (let k = 0; k < N; k++) if (clues[k]) cons.push({ cells: [k], min: 0, max: 0, why: () => 'Clue cells stay white.' });
    const nb = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    };
    function check(s, done) {
      const id = new Int32Array(N).fill(-1);
      for (let k = 0; k < N; k++) {
        if (id[k] >= 0 || s[k] !== NO) continue;
        const cells = [k];
        id[k] = k;
        for (let i = 0; i < cells.length; i++) for (const j of nb(cells[i])) if (id[j] < 0 && s[j] === NO) { id[j] = k; cells.push(j); }
        // Must fit one row plus one column through a common cell.
        const fits = cells.some((x) => { const r = Math.floor(x / C), c = x % C; return cells.every((y) => Math.floor(y / C) === r || y % C === c); });
        if (!fits) return false;
        if (cells.filter((x) => clues[x] && clues[x] < 40).length > 1) return false;
        const closed = done || cells.every((x) => nb(x).every((j) => s[j] !== UNKNOWN));
        if (closed) {
          const L = shape(C, cells);
          if (!L || !cluesFit(clues, cells, L)) return false;
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
      const base = { R, C, clues: new Int16Array(N) };
      const fill = Binary.randomFill(model(base), 0.5, 10);
      if (!fill) continue;
      // Clues: a circle (often with the size) and the arrows of each island.
      const clues = new Int16Array(N);
      const seen = new Uint8Array(N);
      let ok = true;
      for (let k = 0; k < N && ok; k++) {
        if (fill[k] !== NO || seen[k]) continue;
        const cells = [k];
        seen[k] = 1;
        for (let i = 0; i < cells.length; i++) {
          const x = cells[i], r = Math.floor(x / C), c = x % C;
          for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
            const j = a * C + b;
            if (a >= 0 && b >= 0 && a < R && b < C && !seen[j] && fill[j] === NO) { seen[j] = 1; cells.push(j); }
          }
        }
        const L = shape(C, cells);
        if (!L) { ok = false; break; }
        clues[L.bend] = Math.random() < 0.6 ? cells.length + 1 : 1;
        for (const { d, leg } of L.legs) clues[leg.at(-1)] = 40 + (d ^ 1);
      }
      if (!ok) continue;
      const p = { R, C, clues };
      const unique = () => {
        const t = Binary.logicSolve(model(p));
        if (t && !t.includes(UNKNOWN)) return true;
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
    id: 'sashikabe',
    name: 'Sashikabe',
    rules: 'Shade some cells. All shaded cells connect, and no 2×2 block is all shaded. The white cells form islands ' +
      'that never touch; every island is an L shape with legs one cell wide. A circle marks the bend of its L, and a ' +
      'number in it is the island\'s size. An arrow sits at the end of a leg and points toward the bend.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 7, def: 6 },
    solvedText: 'Every island bent just right — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues).join(',') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      const clues = Int16Array.from(String(d.g).split(','), Number);
      if (clues.length !== R * C) throw new Error('Invalid clues');
      return { R, C, clues };
    },
    model,
    fixed: (p, k) => (p.clues[k] ? NO : 0),
    draw(p, k, el) {
      const v = p.clues[k];
      if (!v) return;
      if (v >= 40) { el.textContent = ARROW[v - 40]; return; }
      const o = document.createElement('span');
      o.className = 'nm-circle';
      o.textContent = v > 1 ? v - 1 : '';
      el.append(o);
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'nm-board sk-board',
  });
})();
