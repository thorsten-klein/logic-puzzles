// Different Neighbours. Put a number 1-4 in every region so that regions
// that touch (even at a corner) hold different numbers. Some regions are
// given. State and solution hold one number per region.

(() => {
  function groups(region) {
    const out = [];
    region.forEach((g, k) => { out[g] ??= []; out[g].push(k); });
    return out;
  }

  // Region adjacency, corners included.
  function prepare(p) {
    const { R, C, region } = p;
    p.groups = groups(region);
    p.adj = p.groups.map(() => new Set());
    for (let k = 0; k < R * C; k++) {
      const r = Math.floor(k / C), c = k % C;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= R || nc >= C) continue;
        const a = region[k], b = region[nr * C + nc];
        if (a !== b) { p.adj[a].add(b); p.adj[b].add(a); }
      }
    }
    p.adj = p.adj.map((s) => [...s]);
    return p;
  }

  const ALL = 0b11110;
  const one = (m) => m && !(m & (m - 1));
  const low = (m) => 31 - Math.clz32(m & -m);

  function propagate(p, cand) {
    for (let changed = true; changed;) {
      changed = false;
      for (let g = 0; g < cand.length; g++) {
        if (!cand[g]) return false;
        if (!one(cand[g])) continue;
        for (const h of p.adj[g]) {
          if (cand[h] & cand[g]) { cand[h] &= ~cand[g]; changed = true; if (!cand[h]) return false; }
        }
      }
    }
    return true;
  }

  function solve(p, start, stopAt = 2, maxNodes = 20000, random = false) {
    const solutions = [];
    let nodes = 0;
    (function rec(cand) {
      if (solutions.length >= stopAt || ++nodes > maxNodes) return;
      if (!propagate(p, cand)) return;
      let pick = -1, best = 9;
      cand.forEach((m, g) => {
        let c = 0; for (let x = m; x; x &= x - 1) c++;
        if (c > 1 && c < best) { best = c; pick = g; }
      });
      if (pick < 0) { solutions.push(Int8Array.from(cand, low)); return; }
      const vals = [1, 2, 3, 4].filter((v) => cand[pick] & (1 << v));
      for (const v of random ? PuzzleShell.shuffle(vals) : vals) {
        const t = Int32Array.from(cand);
        t[pick] = 1 << v;
        rec(t);
      }
    })(Int32Array.from(start));
    return { solutions, capped: nodes > maxNodes };
  }

  const startCand = (p) => Int32Array.from(p.groups, (_, g) => (p.given[g] ? 1 << p.given[g] : ALL));

  function generate(n) {
    for (let t = 0; t < 50; t++) {
      const R = n, C = n, N = R * C;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 4));
      const region = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      const p = prepare({ R, C, region });
      p.given = new Int8Array(p.groups.length);
      const fill = solve(p, startCand(p), 1, 5000, true);
      if (!fill.solutions.length) continue;
      const sol = fill.solutions[0];
      // At most one round per entry.
      const rounds = p.groups.length;
      for (let guard = 0; guard < rounds; guard++) {
        const res = solve(p, startCand(p), 2);
        if (res.solutions.length === 1 && !res.capped) break;
        const other = res.solutions.find((x) => x.some((v, g) => v !== sol[g]));
        const diff = [...sol.keys()].filter((g) => !p.given[g] && (other?.[g] !== sol[g]));
        const g = diff[Math.floor(Math.random() * diff.length)];
        p.given[g] = sol[g];
      }
      for (const g of PuzzleShell.shuffle([...sol.keys()])) {
        if (!p.given[g]) continue;
        p.given[g] = 0;
        const res = solve(p, startCand(p), 2);
        if (res.solutions.length !== 1 || res.capped) p.given[g] = sol[g];
      }
      // Every region given: nothing is left to do. Try again.
      if (Array.from(p.given).every((v) => v > 0)) continue;
      p.solution = sol;
      return p;
    }
    return null;
  }

  const COLORS = ['', '#ffcdd2', '#c8e6c9', '#bbdefb', '#fff9c4'];

  function render(p, state, opts = {}) {
    const { R, C, region, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintG = hint ? hint.region : -1;
    return PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 44), className: 'pz-board pz-regions dn-board', readonly,
      renderCell(k, el) {
        const g = region[k];
        PuzzleShell.regionBorders(el, k, region, R, C);
        const v = given[g] || (result ? solution[g] : state[g]);
        if (v) el.style.background = COLORS[v];
        if (p.groups[g][0] === k && v) {
          el.textContent = v;
          if (given[g]) el.classList.add('given');
        }
        if (result && !given[g] && state[g] && p.groups[g][0] === k) el.classList.add(state[g] === solution[g] ? 'ok' : 'bad');
        else if (result && !given[g] && !state[g] && p.groups[g][0] === k) el.classList.add('miss'); // not entered yet
        if (g === hintG) el.classList.add('hint');
      },
      onCell(k, ev) {
        const g = region[k];
        if (given[g]) return;
        state[g] = (state[g] + (ev.button === 2 ? 4 : 1)) % 5;
        onChange();
      },
    });
  }

  function hints(p, state) {
    for (let g = 0; g < p.groups.length; g++) {
      if (state[g] && !p.given[g] && state[g] !== p.solution[g]) return [{ region: g, v: 0, reason: 'This region has the wrong number.' }];
    }
    const cand = Int32Array.from(p.groups, (_, g) => {
      const v = p.given[g] || state[g];
      return v ? 1 << v : ALL;
    });
    propagate(p, cand);
    const out = [];
    cand.forEach((m, g) => {
      if (!p.given[g] && !state[g] && one(m)) {
        out.push({ region: g, v: low(m), reason: `Only ${low(m)} is left for this region. Its neighbours use the other numbers.` });
      }
    });
    if (!out.length) {
      const g = [...p.solution.keys()].find((x) => !p.given[x] && !state[x]);
      if (g !== undefined) out.push({ region: g, v: p.solution[g], reason: `No simple step is left. This region is ${p.solution[g]}.` });
    }
    return out;
  }

  PuzzleShell.start({
    id: 'different-neighbours',
    name: 'Different Neighbours',
    rules: 'Put a number from 1 to 4 in every region. Regions that touch — even only at a corner — must hold different numbers.',
    controls: 'Click a region to cycle its number 1 to 4. Right click cycles back.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'No neighbours alike — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.region, (v) => v.toString(36).padStart(2, '0')).join(''), v: Array.from(p.given).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid regions');
      const region = Int32Array.from({ length: R * C }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      const p = prepare({ R, C, region });
      if (typeof d.v !== 'string' || d.v.length !== p.groups.length) throw new Error('Invalid givens');
      p.given = Int8Array.from(d.v, Number);
      const res = solve(p, startCand(p), 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Int8Array(p.groups.length),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Int8Array(p.groups.length);
      if (typeof v === 'string' && v.length === s.length) for (let g = 0; g < s.length; g++) s[g] = Number(v[g]) % 5;
      return s;
    },
    render,
    check: (p, s) => s.every((v, g) => (p.given[g] || v) === p.solution[g]),
    hints,
    applyHint(p, s, h) { if (!p.given[h.region]) s[h.region] = h.v; },
  });
})();
