// Shared engine for region-number puzzles (Suguru, Hakyuu, Kojun ...).
// Each region of size s holds the numbers 1..s once. A game adds its
// own rule as `rule(p, cand)` (returns false on contradiction).
// Candidates are bitmasks: bit v set if value v fits.
// Exposes the global `RegionNum`.

const RegionNum = (() => {
  const bitCount = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  const lowBit = (m) => 31 - Math.clz32(m & -m);
  const values = (m) => { const out = []; for (let v = 1; m >> v; v++) if (m & (1 << v)) out.push(v); return out; };

  // Adds region lists and sizes to a puzzle { R, C, region }.
  function prepare(p) {
    const count = Math.max(...p.region) + 1;
    p.groups = Array.from({ length: count }, () => []);
    p.region.forEach((g, k) => p.groups[g].push(k));
    return p;
  }

  function startCand(p, given) {
    return Int32Array.from({ length: p.R * p.C }, (_, k) => {
      if (given?.[k]) return 1 << given[k];
      return ((1 << (p.groups[p.region[k]].length + 1)) - 1) & ~1;
    });
  }

  // Region rules (naked and hidden singles) plus the game rule, to a
  // fixed point. Returns false on contradiction.
  function propagate(p, cand, rule) {
    for (let guard = 0; guard < 1000; guard++) {
      const before = cand.join(',');
      for (const cells of p.groups) {
        for (const k of cells) {
          if (!cand[k]) return false;
          if (bitCount(cand[k]) !== 1) continue;
          for (const j of cells) if (j !== k) cand[j] &= ~cand[k];
        }
        for (let v = 1; v <= cells.length; v++) {
          const where = cells.filter((k) => cand[k] & (1 << v));
          if (!where.length) return false;
          if (where.length === 1) cand[where[0]] = 1 << v;
        }
      }
      if (rule(p, cand) === false) return false;
      if (cand.some((m) => !m)) return false;
      if (cand.join(',') === before) return true;
    }
    return true;
  }

  function solve(p, start, rule, stopAt = 2, maxNodes = 20000, random = false) {
    const solutions = [];
    let nodes = 0;
    (function rec(cand) {
      if (solutions.length >= stopAt || ++nodes > maxNodes) return;
      if (!propagate(p, cand, rule)) return;
      let pick = -1, best = 99;
      for (let k = 0; k < cand.length; k++) {
        const c = bitCount(cand[k]);
        if (c > 1 && c < best) { best = c; pick = k; }
      }
      if (pick < 0) { solutions.push(Int8Array.from(cand, lowBit)); return; }
      const vals = values(cand[pick]);
      for (const v of random ? PuzzleShell.shuffle(vals) : vals) {
        const copy = Int32Array.from(cand);
        copy[pick] = 1 << v;
        rec(copy);
      }
    })(Int32Array.from(start));
    return { solutions, capped: nodes > maxNodes };
  }

  // Builds regions and numbers together. Takes the first open cell,
  // grows a region of random size from it, and gives its cells 1..size
  // in an order that `ok(val, region, k, R, C)` accepts. On a dead end
  // it undoes the last region and tries another (with a step budget).
  // Returns null if the budget runs out.
  function growFill(R, C, maxSize, ok, budget = 4000) {
    const N = R * C;
    const region = new Int32Array(N).fill(-1);
    const val = new Int8Array(N);
    let steps = 0;

    function tryRegion(start, id) {
      const size = 1 + Math.floor(Math.random() * maxSize);
      const cells = [start];
      region[start] = id;
      while (cells.length < size) {
        const opts = [];
        for (const k of cells) {
          const r = Math.floor(k / C), c = k % C;
          if (r < R - 1 && region[k + C] < 0) opts.push(k + C);
          if (c > 0 && region[k - 1] < 0) opts.push(k - 1);
          if (c < C - 1 && region[k + 1] < 0) opts.push(k + 1);
        }
        if (!opts.length) break;
        const k = opts[Math.floor(Math.random() * opts.length)];
        region[k] = id;
        cells.push(k);
      }
      const nums = PuzzleShell.shuffle(cells.map((_, i) => i + 1));
      const done = (function assign(i, used) {
        if (i === cells.length) return true;
        for (const v of nums) {
          if (used & (1 << v)) continue;
          val[cells[i]] = v;
          if (ok(val, region, cells[i], R, C) && assign(i + 1, used | (1 << v))) return true;
          val[cells[i]] = 0;
        }
        return false;
      })(0, 0);
      if (!done) for (const k of cells) { region[k] = -1; val[k] = 0; }
      return done ? cells : null;
    }

    function rec(from, id) {
      let start = from;
      while (start < N && region[start] >= 0) start++;
      if (start === N) return true;
      for (let attempt = 0; attempt < 6; attempt++) {
        if (++steps > budget) return false;
        const cells = tryRegion(start, id);
        if (!cells) continue;
        // Few single-cell regions.
        if (cells.length === 1 && Math.random() < 0.6) { region[start] = -1; val[start] = 0; continue; }
        if (rec(start + 1, id + 1)) return true;
        for (const k of cells) { region[k] = -1; val[k] = 0; }
      }
      return false;
    }

    return rec(0, 0) ? { region, val } : null;
  }

  // Grows regions with numbers, then removes givens while plain
  // propagation (no guessing) still solves it.
  function makePuzzle(R, C, maxSize, rule, ok, tries = 300, setup = null) {
    for (let t = 0; t < tries; t++) {
      const grown = growFill(R, C, maxSize, ok);
      if (!grown) continue;
      const p = prepare({ R, C, region: grown.region });
      const sol = grown.val;
      if (setup) setup(p, sol);
      const given = Int8Array.from(sol);
      const solved = () => {
        const cand = startCand(p, given);
        return propagate(p, cand, rule) && cand.every((m) => bitCount(m) === 1);
      };
      for (const k of PuzzleShell.shuffle([...new Array(R * C).keys()])) {
        given[k] = 0;
        if (!solved()) given[k] = sol[k];
      }
      p.given = given;
      p.solution = sol;
      return p;
    }
    return null;
  }

  function hints(p, entries, rule, what) {
    const N = p.R * p.C;
    const out = [];
    const val = Int8Array.from(entries, (v, k) => p.given[k] || v);
    for (let k = 0; k < N; k++) {
      if (entries[k] && !p.given[k] && entries[k] !== p.solution[k]) out.push({ cells: [k], v: 0, reason: 'This number is wrong.' });
    }
    if (out.length) return out;
    const cand = startCand(p, val);
    propagate(p, cand, rule);
    for (let k = 0; k < N; k++) {
      if (val[k] || bitCount(cand[k]) !== 1) continue;
      const v = lowBit(cand[k]);
      out.push({ cells: [k], v, reason: `Only ${v} fits here, because of its region and ${what}.` });
    }
    if (!out.length) {
      const k = [...val.keys()].find((i) => !val[i]);
      if (k !== undefined) out.push({ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell is ${p.solution[k]}.` });
    }
    return out;
  }

  // `edge` (optional) gives clue arrays { top, left } shown outside.
  function render(p, entries, opts = {}, edge = null) {
    const { R, C, region, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const hintCells = new Set(hint ? hint.cells : []);
    const off = edge ? 1 : 0;
    return PuzzleShell.gridBoard({
      rows: R + off, cols: C + off, cellPx: PuzzleShell.fitCell(C + off, 46), className: 'pz-board pz-regions rn-board', readonly,
      renderCell(K, el) {
        const rr = Math.floor(K / (C + off)) - off, cc = (K % (C + off)) - off;
        if (rr < 0 || cc < 0) {
          el.className = 'clue';
          if (rr < 0 && cc >= 0) el.textContent = edge.top[cc] ?? '';
          if (cc < 0 && rr >= 0) el.textContent = edge.left[rr] ?? '';
          return;
        }
        const k = rr * C + cc;
        PuzzleShell.regionBorders(el, k, region, R, C);
        if (hintCells.has(k)) el.classList.add('hint');
        if (given[k]) { el.classList.add('given'); el.textContent = given[k]; return; }
        if (result) {
          el.textContent = solution[k];
          el.classList.add(entries[k] === solution[k] ? 'ok' : entries[k] ? 'bad' : 'show');
        } else if (readonly) {
          el.textContent = entries[k] || '';
          el.classList.add('entry');
        } else {
          el.appendChild(PuzzleShell.digitInput({ r: Math.floor(k / C), c: k % C, value: entries[k],
            max: p.groups[region[k]].length, onSet: (v) => { entries[k] = v; onChange(false); } }));
        }
      },
    });
  }

  // Full game page. cfg: id, name, rules, size, maxSize, rule, ok, what, solvedText,
  // optional setup(p, sol) (extra clues), edge(p) ({ top, left } clues),
  // encodeExtra(p) / decodeExtra(p, x) (extra share data).
  // `ok(val, region, k, R, C)` checks cell k against its already placed
  // neighbours (used to build puzzles).
  function startGame(cfg) {
    const isSolved = (p, entries) => entries.every((v, k) => (p.given[k] || v) === p.solution[k]);
    PuzzleShell.start({
      id: cfg.id, name: cfg.name, rules: cfg.rules, size: cfg.size, solvedText: cfg.solvedText,
      controls: 'Click a cell and type a number. Arrow keys move between cells.',
      generate: (n) => makePuzzle(n, n, cfg.maxSize, cfg.rule, cfg.ok, 300, cfg.setup),
      encode: (p) => ({
        r: p.R, c: p.C,
        g: Array.from(p.region, (v) => v.toString(36).padStart(2, '0')).join(''),
        v: Array.from(p.given).join(''),
        x: cfg.encodeExtra ? cfg.encodeExtra(p) : undefined,
      }),
      decode(d) {
        const R = d?.r, C = d?.c;
        if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
        if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid regions');
        if (typeof d.v !== 'string' || d.v.length !== R * C || !/^\d+$/.test(d.v)) throw new Error('Invalid givens');
        const region = Int32Array.from({ length: R * C }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
        if (region.some((v) => !Number.isInteger(v) || v < 0)) throw new Error('Invalid regions');
        const p = prepare({ R, C, region, given: Int8Array.from(d.v, Number) });
        if (cfg.decodeExtra) cfg.decodeExtra(p, d.x);
        const res = solve(p, startCand(p, p.given), cfg.rule, 2, 50000);
        if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
        p.solution = res.solutions[0];
        return p;
      },
      newState: (p) => new Int8Array(p.R * p.C),
      saveState: (s) => Array.from(s).join(''),
      loadState(p, v) {
        const s = new Int8Array(p.R * p.C);
        if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) || 0;
        return s;
      },
      render: (p, e, o) => render(p, e, o, cfg.edge ? cfg.edge(p) : null),
      check: isSolved,
      hints: (p, s) => hints(p, s, cfg.rule, cfg.what),
      applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
    });
  }

  return { bitCount, lowBit, values, growFill, prepare, startCand, propagate, solve, makePuzzle, hints, render, startGame };
})();
