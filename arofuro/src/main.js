// Arofuro (Arrow Flow). Put an arrow (up, down, left or right) into every
// empty cell. Equal arrows never touch by a side. Following the arrows
// from any cell always ends at a number. A number tells how many arrows
// lead to it in the end. Some arrows may be given. Built on the shared
// Flow engine (p.circle marks number cells).

(() => {
  const { one, target } = Flow;

  function prepare(p) {
    p.circle = Uint8Array.from(p.num, (v) => (v >= 0 ? 1 : 0));
    return p;
  }

  // Arrows that end at each number cell (for a full answer).
  function counts(p, val) {
    const N = p.R * p.C;
    const out = new Int32Array(N);
    for (let k = 0; k < N; k++) {
      if (p.circle[k]) continue;
      let x = k;
      for (let s = 0; s <= N && !p.circle[x]; s++) { x = target(p, x, val[x]); if (x < 0) return null; }
      if (!p.circle[x]) return null;
      out[x]++;
    }
    return out;
  }

  // Equal arrows never touch by a side.
  function rule(p, cand) {
    for (let k = 0; k < cand.length; k++) {
      if (p.circle[k] || !one(cand[k])) continue;
      for (const j of Flow.sides(p, k)) if (!p.circle[j]) cand[j] &= ~cand[k];
    }
    return true;
  }

  // Every number counts the arrows that end there.
  function accept(p, val) {
    const cnt = counts(p, val);
    return !!cnt?.every((v, i) => !p.circle[i] || v === p.num[i]);
  }

  // Random answer: numbers, then an arrow forest with equal arrows apart.
  function randomBoard(n) {
    const circle = Flow.randomGoals(n, n, Math.max(2, Math.round(n * n / 7)));
    const clash = (k, v, arrow) => Flow.sides({ R: n, C: n }, k).some((j) => arrow[j] === v);
    const arrow = Flow.arrowForest(n, n, circle, (k, v, a) => !clash(k, v, a), n * n * 20);
    return arrow ? { circle, arrow } : null;
  }

  const cfg = {
    id: 'arofuro',
    name: 'Arofuro',
    rules: 'Put an arrow (up, down, left or right) into every empty cell. Equal arrows never touch by a side. Following ' +
      'the arrows from any cell always ends at a number. A number tells how many arrows lead to it in the end. Some ' +
      'arrows may be given.',
    size: { min: 4, max: 5, def: 5 },
    solvedText: 'Everything flows home — nicely done.',
    rule,
    accept,
    why: 'equal arrows may not touch',
    className: 'pz-board af-board',
    goalCell: (p, k, el) => { el.classList.add('af-num'); el.textContent = p.num[k]; },
    generate(n) {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        const b = randomBoard(n);
        if (!b) continue;
        const cnt = counts(prepare({ R: n, C: n, num: Int8Array.from(b.circle, (x) => (x ? 0 : -1)) }), b.arrow);
        if (!cnt) continue;
        const p = prepare({ R: n, C: n, num: Int8Array.from(b.circle, (x, k) => (x ? cnt[k] : -1)) });
        // Give arrows where another answer differs, then drop extras.
        if (!Flow.setGivens(cfg, p, b.arrow, { fixNodes: 8000, nodes: 8000, until: deadline })) continue;
        p.solution = b.arrow;
        return p;
      }
      return null;
    },
    encode: (p) => ({ n: p.R, g: Array.from(p.num, (v) => (v < 0 ? '.' : v.toString(36))).join(''), v: Array.from(p.given).join('') }),
    decodeBoard(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 15) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n) throw new Error('Invalid numbers');
      const p = prepare({ R: n, C: n, num: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number.parseInt(ch, 36))) });
      p.given = typeof d.v === 'string' && d.v.length === n * n && /^[0-4]+$/.test(d.v) ? Int8Array.from(d.v, Number) : new Int8Array(n * n);
      return p;
    },
  };
  Flow.startGame(cfg);
})();
