// Shared engine for Fillomino-like puzzles: every cell gets the size of
// its region; regions of the same size never touch by a side. Some
// numbers are given. Exposes the global `Fillo`.
//
// cfg: id, name, rules, size, solvedText, maxSize (largest region built),
//      solveMax (largest region the rules allow; default maxSize),
//      sizes (optional list of allowed sizes).

const Fillo = (() => {
  function nbs(R, C, k) {
    const r = Math.floor(k / C), c = k % C, out = [];
    if (r > 0) out.push(k - C);
    if (r < R - 1) out.push(k + C);
    if (c > 0) out.push(k - 1);
    if (c < C - 1) out.push(k + 1);
    return out;
  }

  // Connected sets of `size` cells containing k, made of open cells
  // with index >= k (so k is the smallest cell; no repeats).
  function shapes(R, C, k, size, open) {
    const out = [];
    const seen = new Set();
    const rec = (set) => {
      const key = set.slice().sort((a, b) => a - b).join(',');
      if (seen.has(key)) return;
      seen.add(key);
      if (set.length === size) { out.push(set.slice()); return; }
      const front = new Set();
      for (const x of set) for (const j of nbs(R, C, x)) if (j > k && open(j) && !set.includes(j)) front.add(j);
      for (const j of front) { set.push(j); rec(set); set.pop(); }
    };
    rec([k]);
    return out;
  }

  // Counts solutions (value per cell). `given` holds sizes (0 = none).
  function solve(p, stopAt = 2, maxNodes = 20000, random = false) {
    const { R, C, given } = p;
    const N = R * C;
    const val = new Int8Array(N);
    const solutions = [];
    let nodes = 0;
    const sizes = p.sizes;
    // Regions of size s through cell k over free cells (shuffled if random).
    const shapesFor = (k, s) => {
      const list = shapes(R, C, k, s, (j) => !val[j] && (!given[j] || given[j] === s));
      return random ? PuzzleShell.shuffle(list) : list;
    };
    // No same-size neighbour region, and no same-size given touching
    // from outside (it would form a second touching region).
    const clear = (cells, s) => {
      const inside = new Set(cells);
      return cells.every((x) => nbs(R, C, x).every((j) => inside.has(j) || (val[j] !== s && given[j] !== s)));
    };
    // Region sizes to try at cell k.
    const sizesAt = (k) => {
      const options = given[k] ? [given[k]] : sizes;
      return random ? PuzzleShell.shuffle(options.slice()) : options;
    };
    const rec = () => {
      if (solutions.length >= stopAt || ++nodes > maxNodes) return;
      const k = val.indexOf(0);
      if (k < 0) { solutions.push(Int8Array.from(val)); return; }
      for (const s of sizesAt(k)) {
        for (const cells of shapesFor(k, s)) {
          tryShape(cells, s);
          if (solutions.length >= stopAt) return;
        }
      }
    };
    // Place a region of size s on `cells`, search on, take it back.
    const tryShape = (cells, s) => {
      if (!clear(cells, s)) return;
      for (const x of cells) val[x] = s;
      rec();
      for (const x of cells) val[x] = 0;
    };
    rec();
    return { solutions, capped: nodes > maxNodes };
  }

  function generate(cfg, n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const p = { R: n, C: n, given: new Int8Array(n * n), sizes: cfg.sizes || Array.from({ length: cfg.maxSize }, (_, i) => i + 1) };
      const fill = solve(p, 1, 3000, true);
      if (!fill.solutions.length) continue;
      const sol = fill.solutions[0];
      // Uniqueness is checked against every region size the rules allow.
      if (cfg.solveMax) p.sizes = Array.from({ length: cfg.solveMax }, (_, i) => i + 1);
      p.given = Int8Array.from(sol);
      const unique = () => { const r = solve(p, 2, 4000); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      for (const k of PuzzleShell.shuffle([...sol.keys()])) {
        const keep = p.given[k];
        p.given[k] = 0;
        if (!unique()) p.given[k] = keep;
        if (Date.now() > deadline + 4000) break;
      }
      p.solution = sol;
      return p;
    }
    return null;
  }

  function hints(p, entries) {
    const val = Int8Array.from(entries, (v, k) => p.given[k] || v);
    for (let k = 0; k < val.length; k++) {
      if (entries[k] && !p.given[k] && entries[k] !== p.solution[k]) return [{ cells: [k], v: 0, reason: 'This number is wrong.' }];
    }
    // A cell whose neighbour region is complete-size and only one value fits is hard
    // to explain in general; reveal the first open cell next to a known number.
    for (let k = 0; k < val.length; k++) {
      if (val[k]) continue;
      if (nbs(p.R, p.C, k).some((j) => val[j])) {
        return [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell belongs to a region of ${p.solution[k]}.` }];
      }
    }
    const k = val.findIndex((v) => !v);
    return k >= 0 ? [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell belongs to a region of ${p.solution[k]}.` }] : [];
  }

  function render(p, entries, opts = {}) {
    const { R, C, given, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const val = result ? solution : Int8Array.from(entries, (v, k) => given[k] || v);
    // Borders between different values (or unknown cells).
    const ids = Int32Array.from(val, (v, k) => (v || -1 - k));
    const hintCells = new Set(hint ? hint.cells : []);
    const max = Math.max(...(p.sizes || [9]));
    return PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 44), className: 'pz-board pz-regions fl-board', readonly,
      renderCell(k, el) {
        PuzzleShell.regionBorders(el, k, ids, R, C);
        if (hintCells.has(k)) el.classList.add('hint');
        if (val[k]) el.style.background = PuzzleShell.TINTS[val[k] % PuzzleShell.TINTS.length];
        if (given[k]) { el.classList.add('given'); el.append(String(given[k])); return; }
        if (result) {
          el.append(String(solution[k]));
          el.classList.add(PuzzleShell.resultClass(entries[k], solution[k]));
        } else if (readonly) {
          el.append(entries[k] ? String(entries[k]) : '');
          el.classList.add('entry');
        } else {
          el.appendChild(PuzzleShell.digitInput({ r: Math.floor(k / C), c: k % C, value: entries[k], max,
            onSet: (v) => {
              entries[k] = v;
              onChange();
              // Redraw borders, then keep typing in the same cell.
              const again = document.querySelector(`#board-wrap input[data-r="${Math.floor(k / C)}"][data-c="${k % C}"]`);
              if (again) { again.focus(); again.setSelectionRange(1, 1); }
            } }));
        }
      },
    });
  }

  function startGame(cfg) {
    const sizesOf = () => cfg.sizes || Array.from({ length: cfg.solveMax || cfg.maxSize }, (_, i) => i + 1);
    PuzzleShell.start({
      id: cfg.id, name: cfg.name, rules: cfg.rules, size: cfg.size, solvedText: cfg.solvedText,
      controls: 'Click a cell and type a number. Arrow keys move between cells. Borders appear between different numbers.',
      generate: (n) => generate(cfg, n),
      encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.given).join('') }),
      decode(d) {
        const R = d?.r, C = d?.c;
        if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 15)) throw new Error('Invalid board size');
        if (typeof d.g !== 'string' || d.g.length !== R * C || !/^\d+$/.test(d.g)) throw new Error('Invalid givens');
        const p = { R, C, given: Int8Array.from(d.g, Number), sizes: sizesOf() };
        const res = solve(p, 2, 50000);
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
      render,
      check: (p, s) => s.every((v, k) => (p.given[k] || v) === p.solution[k]),
      hints,
      applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
    });
  }

  return { solve, generate, startGame };
})();
