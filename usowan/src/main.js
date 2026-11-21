// Usowan (One Liar). Shade some cells. Numbered cells stay white. A
// number tells how many shaded cells touch it by a side — but in every
// region exactly one number is wrong. Shaded cells never touch by a side,
// and all white cells connect. Built on the shared Binary game page.

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function groups(region) {
    const out = [];
    region.forEach((g, k) => { (out[g] = out[g] || []).push(k); });
    return out;
  }

  function model(p) {
    const { R, C, region, clues } = p;
    const N = R * C;
    const nb = (k) => {
      const r = Math.floor(k / C), c = k % C, out = [];
      if (r > 0) out.push(k - C);
      if (r < R - 1) out.push(k + C);
      if (c > 0) out.push(k - 1);
      if (c < C - 1) out.push(k + 1);
      return out;
    };
    const cons = [];
    for (let k = 0; k < N; k++) {
      if (clues[k] >= 0) cons.push({ cells: [k], min: 0, max: 0, why: () => 'Numbered cells stay white.' });
      const r = Math.floor(k / C), c = k % C;
      const why = () => 'Shaded cells must never touch by a side.';
      if (c < C - 1) cons.push({ cells: [k, k + 1], min: 0, max: 1, why });
      if (r < R - 1) cons.push({ cells: [k, k + C], min: 0, max: 1, why });
    }
    const clueCells = groups(region).map((cells) => cells.filter((k) => clues[k] >= 0));
    // Status of a clue: 1 surely right, 0 surely wrong, -1 not known.
    const status = (s, k) => {
      const v = clues[k], cells = nb(k);
      const yes = cells.filter((j) => s[j] === YES).length, open = cells.filter((j) => s[j] === UNKNOWN).length;
      if (yes > v || yes + open < v) return 0;
      if (!open) return 1;
      return -1;
    };
    function check(s, done) {
      if (!Binary.canConnect(R, C, s, NO)) return false;
      for (const list of clueCells) {
        const st = list.map((k) => status(s, k));
        const wrong = st.filter((x) => x === 0).length, right = st.filter((x) => x === 1).length;
        if (wrong > 1 || right > list.length - 1) return false;
        if (done && wrong !== 1) return false;
      }
      return true;
    }
    return { N, cons, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const sol = Binary.randomFill({ N, cons: model({ R, C, region: new Int32Array(N), clues: new Int8Array(N).fill(-1) }).cons,
        check: (s) => Binary.canConnect(R, C, s, NO) }, 0.3, 3);
      if (!sol) continue;
      // Rectangular regions, each with at least two white cells.
      const rects = [];
      const id = new Int32Array(N).fill(-1);
      for (let k = 0; k < N; k++) {
        if (id[k] >= 0) continue;
        const r = Math.floor(k / C), c = k % C;
        let w = 1 + Math.floor(Math.random() * 3), h = 1 + Math.floor(Math.random() * 3);
        while (c + w > C || [...new Array(w).keys()].some((i) => id[r * C + c + i] >= 0)) w--;
        while (r + h > R) h--;
        for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) id[(r + i) * C + c + j] = rects.length;
        rects.push(true);
      }
      const clues = new Int8Array(N).fill(-1);
      let ok = true;
      for (const cells of groups(id)) {
        const white = cells.filter((k) => sol[k] === NO);
        if (white.length < 2) { ok = false; break; }
        const picks = PuzzleShell.shuffle(white.slice()).slice(0, Math.min(white.length, 1 + Math.floor(Math.random() * 3)));
        if (picks.length < 2) picks.push(...white.filter((k) => !picks.includes(k)).slice(0, 1));
        const liar = picks[Math.floor(Math.random() * picks.length)];
        for (const k of picks) {
          const r = Math.floor(k / C), c = k % C;
          const truth = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
            .filter(([a, b]) => a >= 0 && b >= 0 && a < R && b < C && sol[a * C + b] === YES).length;
          if (k === liar) {
            const lies = [0, 1, 2, 3, 4].filter((v) => v !== truth);
            clues[k] = lies[Math.floor(Math.random() * lies.length)];
          } else clues[k] = truth;
        }
      }
      if (!ok) continue;
      const p = { R, C, region: id, clues };
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) {
        const res = Binary.solve(model(p), 2, 20000);
        if (res.solutions.length !== 1 || res.capped) continue;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'usowan',
    name: 'Usowan',
    rules: 'Shade some cells. Numbered cells stay white. A number tells how many shaded cells touch it by a side — ' +
      'but in every outlined region exactly one number is wrong. Shaded cells never touch by a side, and all white cells connect.',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 4, max: 6, def: 6 },
    solvedText: 'Every liar caught — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.region, (v) => v.toString(36).padStart(2, '0')).join(''), n: Array.from(p.clues, (v) => (v < 0 ? '.' : v)).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid regions');
      if (typeof d.n !== 'string' || d.n.length !== R * C || !/^[.0-4]+$/.test(d.n)) throw new Error('Invalid clues');
      return { R, C, region: Int32Array.from({ length: R * C }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36)),
        clues: Int8Array.from(d.n, (ch) => (ch === '.' ? -1 : Number(ch))) };
    },
    model,
    fixed: (p, k) => (p.clues[k] >= 0 ? NO : 0),
    draw(p, k, el) {
      PuzzleShell.regionBorders(el, k, p.region, p.R, p.C);
      if (p.clues[k] >= 0) el.textContent = p.clues[k];
    },
    noun: 'shaded cell', noNoun: 'white cell',
    className: 'pz-regions uw-board',
  });
})();
