// Arofuro (Arrow Flow). Put an arrow (up, down, left or right) into every
// empty cell. Equal arrows never touch by a side. Following the arrows
// from any cell always ends at a number. A number tells how many arrows
// lead to it in the end. Some arrows may be given. Adapted from Roma
// (p.circle marks number cells).
// Values: 1 up, 2 down, 3 left, 4 right; candidates are bitmasks (bit v).

(() => {
  const GLYPH = ['', '↑', '↓', '←', '→'];
  const STEP = [null, [-1, 0], [1, 0], [0, -1], [0, 1]];
  const ALL = 0b11110;
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);

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

  const target = (p, k, v) => {
    const r = Math.floor(k / p.C) + STEP[v][0], c = (k % p.C) + STEP[v][1];
    return r >= 0 && c >= 0 && r < p.R && c < p.C ? r * p.C + c : -1;
  };

  function propagate(p, cand) {
    const N = p.R * p.C;
    for (let guard = 0; guard < 200; guard++) {
      const before = cand.join(',');
      for (let k = 0; k < N; k++) {
        if (p.circle[k]) continue;
        for (let v = 1; v <= 4; v++) if ((cand[k] & (1 << v)) && target(p, k, v) < 0) cand[k] &= ~(1 << v);
        // Two cells may not point at each other.
        for (let v = 1; v <= 4; v++) {
          if (!(cand[k] & (1 << v))) continue;
          const t = target(p, k, v);
          if (!p.circle[t] && one(cand[t]) && target(p, t, low(cand[t])) === k) cand[k] &= ~(1 << v);
        }
        if (!cand[k]) return false;
      }
      // Equal arrows never touch by a side.
      for (let k = 0; k < N; k++) {
        if (p.circle[k] || !one(cand[k])) continue;
        const r = Math.floor(k / p.C), c = k % p.C;
        for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
          if (a >= 0 && b >= 0 && a < p.R && b < p.C && !p.circle[a * p.C + b]) cand[a * p.C + b] &= ~cand[k];
        }
      }
      if (cand.some((m, k) => !p.circle[k] && !m)) return false;
      // An arrow may only point at a cell that can still reach a circle.
      const good = Uint8Array.from(p.circle);
      for (let changed = true; changed;) {
        changed = false;
        for (let k = 0; k < N; k++) {
          if (good[k]) continue;
          for (let v = 1; v <= 4; v++) {
            if (!(cand[k] & (1 << v))) continue;
            const t = target(p, k, v);
            if (t >= 0 && good[t]) { good[k] = 1; changed = true; break; }
          }
        }
      }
      for (let k = 0; k < N; k++) {
        if (p.circle[k]) continue;
        for (let v = 1; v <= 4; v++) {
          if (!(cand[k] & (1 << v))) continue;
          const t = target(p, k, v);
          if (t < 0 || !good[t]) cand[k] &= ~(1 << v);
        }
        if (!cand[k]) return false;
      }
      // No loops among fixed arrows.
      for (let k = 0; k < N; k++) {
        if (p.circle[k] || !one(cand[k])) continue;
        let x = k;
        for (let step = 0; step <= N; step++) {
          if (p.circle[x]) break;
          if (!one(cand[x])) break;
          x = target(p, x, low(cand[x]));
          if (x === k) return false;
        }
      }
      if (cand.join(',') === before) return true;
    }
    return true;
  }

  function solve(p, start, stopAt = 2, maxNodes = 20000) {
    const out = [];
    let nodes = 0;
    (function rec(cand) {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      if (!propagate(p, cand)) return;
      const k = cand.findIndex((m, i) => !p.circle[i] && !one(m));
      if (k < 0) {
        const val = Int8Array.from(cand, (m, i) => (p.circle[i] ? 0 : low(m)));
        const cnt = counts(p, val);
        if (cnt?.every((v, i) => !p.circle[i] || v === p.num[i])) out.push(val);
        return;
      }
      for (let v = 1; v <= 4; v++) {
        if (!(cand[k] & (1 << v))) continue;
        const t = Int32Array.from(cand); t[k] = 1 << v; rec(t);
      }
    })(Int32Array.from(start));
    return { solutions: out, capped: nodes > maxNodes };
  }

  const startCand = (p, given) => Int32Array.from({ length: p.R * p.C }, (_, k) => (p.circle[k] ? 0 : given[k] ? 1 << given[k] : ALL));

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const circle = new Uint8Array(N);
      const count = Math.max(2, Math.round(N / 7));
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, count)) circle[k] = 1;
      // Random arrow forest grown from the numbers; equal arrows apart.
      const arrow = new Int8Array(N);
      const done = Uint8Array.from(circle);
      let front = [...new Array(N).keys()].filter((k) => circle[k]);
      const clash = (k, v) => {
        const r = Math.floor(k / C), c = k % C;
        return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([a, b]) => a >= 0 && b >= 0 && a < R && b < C && arrow[a * C + b] === v);
      };
      for (let guard = 0; front.length && guard < N * 20; guard++) {
        const k = front[Math.floor(Math.random() * front.length)];
        const r = Math.floor(k / C), c = k % C;
        const opts = [[r - 1, c, 2], [r + 1, c, 1], [r, c - 1, 4], [r, c + 1, 3]]
          .filter(([a, b, v]) => a >= 0 && b >= 0 && a < R && b < C && !done[a * C + b] && !clash(a * C + b, v));
        if (!opts.length) { front = front.filter((x) => x !== k); continue; }
        const [a, b, v] = opts[Math.floor(Math.random() * opts.length)];
        arrow[a * C + b] = v;
        done[a * C + b] = 1;
        front.push(a * C + b);
      }
      if (!done.every(Boolean)) continue;
      const p0 = prepare({ R, C, num: Int8Array.from(circle, (x) => (x ? 0 : -1)) });
      const cnt = counts(p0, arrow);
      if (!cnt) continue;
      const p = prepare({ R, C, num: Int8Array.from(circle, (x, k) => (x ? cnt[k] : -1)) });
      // Give arrows where another answer differs, then drop extras.
      p.given = new Int8Array(N);
      for (let guard = 0; guard < N && Date.now() < deadline; guard++) {
        const res = solve(p, startCand(p, p.given), 2, 8000);
        if (res.solutions.length === 1 && !res.capped) break;
        const other = res.solutions.find((x) => x.some((v, k) => !circle[k] && v !== arrow[k]));
        const diff = [...new Array(N).keys()].filter((k) => !circle[k] && !p.given[k] && (other?.[k] !== arrow[k]));
        if (!diff.length) break;
        const k = diff[Math.floor(Math.random() * diff.length)];
        p.given[k] = arrow[k];
      }
      const unique = () => { const r = solve(p, startCand(p, p.given), 2, 8000); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
        if (!p.given[k]) continue;
        const keep = p.given[k];
        p.given[k] = 0;
        if (!unique()) p.given[k] = keep;
        if (Date.now() > deadline + 3000) break;
      }
      p.solution = arrow;
      return p;
    }
    return null;
  }

  function hints(p, entries) {
    const val = Int8Array.from(entries, (v, k) => p.given[k] || v);
    for (let k = 0; k < val.length; k++) if (entries[k] && !p.given[k] && entries[k] !== p.solution[k]) return [{ cells: [k], v: 0, reason: 'This arrow is wrong.' }];
    const cand = startCand(p, val);
    propagate(p, cand);
    for (let k = 0; k < val.length; k++) {
      if (p.circle[k] || val[k] || !one(cand[k])) continue;
      return [{ cells: [k], v: low(cand[k]), reason: `Only ${GLYPH[low(cand[k])]} fits here: equal arrows may not touch, and arrows may not leave the grid or run in a loop.` }];
    }
    const k = [...val.keys()].find((i) => !p.circle[i] && !val[i]);
    return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This arrow is ${GLYPH[p.solution[k]]}.` }];
  }

  function render(p, entries, opts = {}) {
    const { R, C, circle, num, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    return PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 44), className: 'pz-board af-board', readonly,
      renderCell(k, el) {
        if (hintCells.has(k)) el.classList.add('hint');
        if (circle[k]) { el.classList.add('af-num'); el.textContent = num[k]; return; }
        const TURN = [0, 0, 4, 6, 2];
        if (given[k]) { el.classList.add('given'); el.append(PuzzleShell.arrowIcon(TURN[given[k]])); return; }
        const v = result ? solution[k] : entries[k];
        if (v) el.append(PuzzleShell.arrowIcon(TURN[v]));
        if (result) el.classList.add(entries[k] === solution[k] ? 'ok' : entries[k] ? 'bad' : 'show');
      },
      onCell(k, ev) {
        if (circle[k] || given[k]) return;
        entries[k] = (entries[k] + (ev.button === 2 ? 4 : 1)) % 5;
        onChange();
      },
    });
  }

  PuzzleShell.start({
    id: 'arofuro',
    name: 'Arofuro',
    rules: 'Put an arrow (up, down, left or right) into every empty cell. Equal arrows never touch by a side. Following ' +
      'the arrows from any cell always ends at a number. A number tells how many arrows lead to it in the end. Some ' +
      'arrows may be given.',
    controls: 'Click a cell to cycle ↑, ↓, ←, →, empty. Right click cycles back.',
    size: { min: 4, max: 5, def: 5 },
    solvedText: 'Everything flows home — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, g: Array.from(p.num, (v) => (v < 0 ? '.' : v.toString(36))).join(''), v: Array.from(p.given).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 15) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n) throw new Error('Invalid numbers');
      const p = prepare({ R: n, C: n, num: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number.parseInt(ch, 36))) });
      p.given = typeof d.v === 'string' && d.v.length === n * n && /^[0-4]+$/.test(d.v) ? Int8Array.from(d.v, Number) : new Int8Array(n * n);
      const res = solve(p, startCand(p, p.given), 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.R * p.C),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Int8Array(p.R * p.C);
      if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % 5;
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => p.circle[k] || (p.given[k] || v) === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
  });
})();
