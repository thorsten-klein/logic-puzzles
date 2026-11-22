// Island. Shade some cells so the white cells form one island. Numbered
// cells are white. A number counts the unnumbered white cells it can
// reach by moving up, down, left and right; numbered cells block the
// way. Built on the shared Binary game page (YES = shaded).

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
    const { R, C, nums } = p;
    const nb = nbsOf(R, C);
    const cons = [];
    const numbered = [];
    for (let k = 0; k < R * C; k++) {
      if (nums[k] === -1) continue;
      cons.push({ cells: [k], min: 0, max: 0, why: () => 'Circled cells stay white.' });
      if (nums[k] >= 0) numbered.push(k);
    }
    // Bounds: reachable unnumbered white cells, using only white cells
    // (low) or white and open cells (high), must allow the number.
    function check(s) {
      if (!Binary.canConnect(R, C, s, NO)) return false;
      for (const k of numbered) {
        const v = nums[k];
        const low = flood(nb, nb[k], (j) => s[j] === NO && nums[j] === -1).size;
        const high = flood(nb, nb[k], (j) => s[j] !== YES && nums[j] === -1).size;
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
      const blank = { R, C, nums: new Int8Array(N).fill(-1) };
      const fill = Binary.randomFill(model(blank), 0.35, 5);
      if (!fill) continue;
      const shade = Uint8Array.from(fill, (v) => (v === YES ? 1 : 0));
      const nums = new Int16Array(N).fill(-1);
      for (let k = 0; k < N; k++) if (!shade[k] && Math.random() < 0.5) nums[k] = 0;
      for (let k = 0; k < N; k++) {
        if (nums[k] < 0) continue;
        nums[k] = flood(nb, nb[k], (j) => !shade[j] && nums[j] === -1).size;
      }
      const p = { R, C, nums };
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      p.solution = Uint8Array.from(shade, (x) => (x ? YES : NO));
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'island',
    name: 'Island',
    rules: 'Shade some cells so that all white cells form one island (joined by sides). Numbered cells are white. ' +
      'A number tells how many unnumbered white cells can be reached from it, moving up, down, left and right. ' +
      'Numbered cells block the way.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 9, def: 7 },
    solvedText: 'One island, every count right — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.nums, (v) => (v < 0 ? '..' : v.toString(36).padStart(2, '0'))).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 15)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid numbers');
      return { R, C, nums: Int16Array.from({ length: R * C }, (_, k) => (d.g[2 * k] === '.' ? -1 : Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36))) };
    },
    model,
    fixed: (p, k) => (p.nums[k] >= 0 ? NO : 0),
    draw(p, k, el) { if (p.nums[k] >= 0) { el.textContent = p.nums[k]; el.classList.add('numbered'); } },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'is-board', yesClass: 'sea',
  });
})();
