// Kurotto. Shade some cells. Circled cells stay white. A number in a
// circle is the total size of all shaded areas that touch the circle by
// a side. Built on the shared Binary game page (YES = shaded).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function nbsOf(R, C) {
    return Array.from({ length: R * C }, (_, k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    });
  }

  // Cells reached from `starts` through cells that pass `ok`.
  function flood(nb, starts, ok) {
    const seen = new Set(starts.filter(ok));
    const stack = [...seen];
    while (stack.length) {
      const k = stack.pop();
      for (const j of nb[k]) if (!seen.has(j) && ok(j)) { seen.add(j); stack.push(j); }
    }
    return seen;
  }

  function model(p) {
    const { R, C, circles } = p;
    const nb = nbsOf(R, C);
    const cons = [];
    const numbered = [];
    for (let k = 0; k < R * C; k++) {
      if (circles[k] === -1) continue;
      cons.push({ cells: [k], min: 0, max: 0, why: () => 'Circled cells stay white.' });
      if (circles[k] >= 0) numbered.push(k);
    }
    // Bounds: the touching shaded areas, using only shaded cells (low)
    // or shaded and open cells (high), must allow the number.
    function check(s) {
      for (const k of numbered) {
        const v = circles[k];
        const low = flood(nb, nb[k], (j) => s[j] === YES).size;
        const high = flood(nb, nb[k], (j) => s[j] !== NO && circles[j] === -1).size;
        if (low > v || high < v) return false;
      }
      return true;
    }
    return { N: R * C, cons, check };
  }

  function generate(n) {
    for (let t = 0; t < 100; t++) {
      const R = n, C = n, N = R * C;
      const nb = nbsOf(R, C);
      const shade = Uint8Array.from({ length: N }, () => (Math.random() < 0.4 ? 1 : 0));
      const circles = new Int16Array(N).fill(-1);
      for (let k = 0; k < N; k++) {
        if (shade[k] || Math.random() < 0.45) continue;
        circles[k] = flood(nb, nb[k], (j) => shade[j] === 1).size;
      }
      const p = { R, C, circles };
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      // Drop circles that are not needed (cells become free).
      Binary.thinClues(circles, -1, () => model(p));
      p.solution = Uint8Array.from(shade, (x) => (x ? YES : NO));
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'kurotto',
    name: 'Kurotto',
    rules: 'Shade some cells. Circled cells stay white. The number in a circle is the total number of shaded cells ' +
      'in all shaded areas that touch the circle by a side.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 8, def: 6 },
    solvedText: 'Every circle counts right — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.circles, (v) => (v < 0 ? '..' : v.toString(36).padStart(2, '0'))).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 15)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid circles');
      return { R, C, circles: Int16Array.from({ length: R * C }, (_, k) => (d.g[2 * k] === '.' ? -1 : parseInt(d.g.slice(2 * k, 2 * k + 2), 36))) };
    },
    model,
    fixed: (p, k) => (p.circles[k] >= 0 ? NO : 0),
    draw(p, k, el) { if (p.circles[k] >= 0) { el.textContent = p.circles[k]; el.classList.add('ring'); } },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'ku-board',
  });
})();
