// Shared Latin square tools for number-grid games (Futoshiki,
// Skyscrapers, Calcudoku, ...). Exposes the global `Latin`.
//
// Candidates: one bitmask per cell, bit v set if value v (1..n) fits.

const Latin = (() => {
  const bitCount = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  const lowBit = (m) => 31 - Math.clz32(m & -m);
  const full = (n) => ((1 << (n + 1)) - 1) & ~1;

  function values(m) {
    const out = [];
    for (let v = 1; m >> v; v++) if (m & (1 << v)) out.push(v);
    return out;
  }

  // Random Latin square (row-major values 1..n).
  function randomSquare(n) {
    const g = new Int8Array(n * n);
    const row = new Int32Array(n), col = new Int32Array(n);
    const vals = Array.from({ length: n }, (_, i) => i + 1);
    (function rec(k) {
      if (k === n * n) return true;
      const r = Math.floor(k / n), c = k % n;
      for (const v of PuzzleShell.shuffle(vals.slice())) {
        const b = 1 << v;
        if ((row[r] & b) || (col[c] & b)) continue;
        g[k] = v; row[r] |= b; col[c] |= b;
        if (rec(k + 1)) return true;
        row[r] &= ~b; col[c] &= ~b;
      }
      return false;
    })(0);
    return g;
  }

  // Cells of line `line`: rows 0..n-1, then columns.
  const lineCells = (n, line) => Array.from({ length: n }, (_, i) => (line < n ? line * n + i : i * n + (line - n)));

  // A fixed digit leaves the other cells of its row and column.
  // Returns -1 on contradiction, else the number of cells changed.
  function eliminateFixed(n, cand) {
    let changed = 0;
    for (let k = 0; k < n * n; k++) {
      if (!cand[k]) return -1;
      if (bitCount(cand[k]) !== 1) continue;
      const r = removeFromLines(n, cand, k);
      if (r < 0) return -1;
      changed += r;
    }
    return changed;
  }

  // Removes the digit of fixed cell k from the rest of its row and column.
  // Returns -1 if a cell has nothing left, else the number of cells changed.
  function removeFromLines(n, cand, k) {
    const m = cand[k], r = Math.floor(k / n), c = k % n;
    let changed = 0;
    for (let i = 0; i < n; i++) {
      for (const j of [r * n + i, i * n + c]) {
        if (j === k || !(cand[j] & m)) continue;
        cand[j] &= ~m;
        if (!cand[j]) return -1;
        changed++;
      }
    }
    return changed;
  }

  // A digit with only one place left in a line goes there.
  // Returns -1 on contradiction, else the number of cells changed.
  function hiddenSingles(n, cand) {
    let changed = 0;
    for (let line = 0; line < 2 * n; line++) {
      const cells = lineCells(n, line);
      for (let v = 1; v <= n; v++) {
        const b = 1 << v;
        const where = cells.filter((j) => cand[j] & b);
        if (!where.length) return -1;
        if (where.length === 1 && cand[where[0]] !== b) { cand[where[0]] = b; changed++; }
      }
    }
    return changed;
  }

  // The game's own rule. Returns -1 on contradiction, 1 if it changed
  // something, else 0.
  function applyPrune(cand, prune) {
    if (!prune) return 0;
    const before = cand.join(',');
    if (prune(cand) === false) return -1;
    return cand.join(',') === before ? 0 : 1;
  }

  // Row and column eliminations plus hidden singles, then the game's
  // own `prune(cand)` (returns false on contradiction). Runs to a fixed
  // point. Returns false on contradiction.
  function propagate(n, cand, prune) {
    for (let guard = 0; guard < 500; guard++) {
      const fixed = eliminateFixed(n, cand);
      if (fixed < 0) return false;
      const single = hiddenSingles(n, cand);
      if (single < 0) return false;
      const pruned = applyPrune(cand, prune);
      if (pruned < 0) return false;
      if (!fixed && !single && !pruned) return true;
    }
    return true;
  }

  // Counts solutions up to stopAt. `start` is the first candidate array.
  function solve(n, start, prune, stopAt = 2, maxNodes = 20000) {
    const solutions = [];
    let nodes = 0;
    (function rec(cand) {
      if (solutions.length >= stopAt || ++nodes > maxNodes) return;
      if (!propagate(n, cand, prune)) return;
      let pick = -1, best = 99;
      for (let k = 0; k < n * n; k++) {
        const c = bitCount(cand[k]);
        if (c > 1 && c < best) { best = c; pick = k; }
      }
      if (pick < 0) { solutions.push(Int8Array.from(cand, lowBit)); return; }
      for (const v of values(cand[pick])) {
        const copy = Int32Array.from(cand);
        copy[pick] = 1 << v;
        rec(copy);
      }
    })(Int32Array.from(start));
    return { solutions, capped: nodes > maxNodes };
  }

  // Candidates from given values (0 = empty).
  function startCand(n, given) {
    const cand = new Int32Array(n * n).fill(full(n));
    for (let k = 0; k < n * n; k++) if (given?.[k]) cand[k] = 1 << given[k];
    return cand;
  }

  // Keeps only values that appear in some arrangement of `cells` that
  // fits the candidates, has no repeats (if distinct) and passes ok().
  function filterGroup(cells, cand, ok, distinct = true) {
    const keep = new Int32Array(cells.length);
    const vals = new Array(cells.length);
    let found = false, count = 0;
    (function rec(i, used) {
      if (++count > 200000) { found = true; keep.fill(-1); return; }
      if (i === cells.length) {
        if (!ok(vals)) return;
        found = true;
        for (let j = 0; j < cells.length; j++) keep[j] |= 1 << vals[j];
        return;
      }
      for (const v of values(cand[cells[i]])) {
        if (distinct && (used & (1 << v))) continue;
        vals[i] = v;
        if (ok.partial && !ok.partial(vals, i)) continue;
        rec(i + 1, used | (1 << v));
      }
    })(0, 0);
    if (!found) return false;
    for (let j = 0; j < cells.length; j++) cand[cells[j]] &= keep[j];
    return true;
  }

  // Generic hints for digit games. Each hint uses only what the player
  // can see on the board, one step at a time:
  // wrong entries, naked singles, hidden singles, then one pass of the
  // game rule (`prune`, e.g. one look at each cage), then a reveal.
  // `colName(c)` names a column like the board labels: A, B, C, ...
  function hints(n, entries, solution, prune, what, colName = (c) => PuzzleShell.colName(c)) {
    const wrong = wrongEntries(n, entries, solution);
    if (wrong.length) return wrong;
    const ctx = { n, entries, colName, cand: seenCandidates(n, entries) };
    const out = singleHints(ctx, ctx.cand, (k, v) => lineInfo(ctx, k, v));
    if (out.length) return out;
    if (prune) {
      const t = Int32Array.from(ctx.cand);
      // `what` may name the rule per cell (e.g. its cage).
      const whatOf = typeof what === 'function' ? what : () => what;
      const ruleReason = (k, v) => `Only ${v} fits here. Look at ${whatOf(k)}: with the numbers its row and column already hold, no other number works.`;
      if (prune(t) !== false) {
        const viaRule = singleHints(ctx, t, ruleReason, whatOf);
        if (viaRule.length) return viaRule;
      }
    }
    const k = entries.findIndex((v, i) => !v && solution[i]);
    if (k < 0) return [];
    return [{ cells: [k], v: solution[k], reason: `No one-step deduction is left from what is on the board; this needs a longer chain of steps. This cell is ${solution[k]}.` }];
  }

  // Entries that differ from the answer.
  function wrongEntries(n, entries, solution) {
    const out = [];
    for (let k = 0; k < n * n; k++) {
      if (entries[k] && entries[k] !== solution[k]) out.push({ cells: [k], v: 0, reason: 'This number is wrong.' });
    }
    return out;
  }

  // Candidates seen directly: drop the numbers already in the row and column.
  function seenCandidates(n, entries) {
    const cand = startCand(n, entries);
    for (let k = 0; k < n * n; k++) {
      if (entries[k]) continue;
      const r = Math.floor(k / n), c = k % n;
      for (let i = 0; i < n; i++) {
        if (entries[r * n + i]) cand[k] &= ~(1 << entries[r * n + i]);
        if (entries[i * n + c]) cand[k] &= ~(1 << entries[i * n + c]);
      }
    }
    return cand;
  }

  // Joins names: "1, 3 and 5".
  const joinNames = (a, word = 'and') => (a.length > 1 ? `${a.slice(0, -1).join(', ')} ${word} ${a.at(-1)}` : String(a[0]));

  // Naked singles, else hidden singles, from the candidates `cnd`.
  // `rule` names what removed the other spots (for the game-rule pass).
  function singleHints(ctx, cnd, reason, rule) {
    const { n, entries } = ctx;
    const out = [];
    for (let k = 0; k < n * n; k++) {
      if (entries[k] || bitCount(cnd[k]) !== 1) continue;
      out.push({ cells: [k], v: lowBit(cnd[k]), reason: reason(k, lowBit(cnd[k])) });
    }
    // Hidden singles: a number that fits only one cell of a row or column.
    for (let line = 0; line < 2 * n && !out.length; line++) out.push(...hiddenSingleHints(ctx, cnd, line, rule));
    return out;
  }

  // Hidden singles of one line.
  function hiddenSingleHints(ctx, cnd, line, rule) {
    const { n, entries } = ctx;
    const cells = lineCells(n, line);
    const out = [];
    for (let v = 1; v <= n; v++) {
      if (cells.some((k) => entries[k] === v)) continue;
      const where = cells.filter((k) => !entries[k] && cnd[k] & (1 << v));
      if (where.length === 1) out.push({ cells: where, v, reason: hiddenReason(ctx, line, v, where[0], rule) });
    }
    return out;
  }

  // Why number v must go in cell `at` of a line.
  function hiddenReason(ctx, line, v, at, rule) {
    const { n, entries, colName, cand } = ctx;
    const name = line < n ? `row ${line + 1}` : `column ${colName(line - n)}`;
    const head = `${name[0].toUpperCase() + name.slice(1)} still needs a ${v}`;
    // Spots left by the row and column alone; the rule removes the rest.
    const open = lineCells(n, line).filter((k) => !entries[k] && cand[k] & (1 << v));
    if (!rule || open.length === 1) return `${head}, and this is the only cell where it can go.`;
    // Name cells like "D1" when columns have letters, else by row or column.
    const lettered = typeof colName(0) === 'string';
    const spot = (k) => {
      if (lettered) return `${colName(k % n)}${Math.floor(k / n) + 1}`;
      if (line < n) return colName(k % n);
      return Math.floor(k / n) + 1;
    };
    let kind = 'rows';
    if (lettered) kind = 'cells';
    else if (line < n) kind = 'columns';
    return `${head}. By row and column alone it could go in ${kind} ${joinNames(open.map(spot), 'or')}. ` +
      `Using ${rule(at)}, ${kind} ` +
      `${joinNames(open.filter((k) => k !== at).map(spot))} drop out. So it must go here.`;
  }

  // "Row 2 has 1, 4. Column C has 3. Together …": why only v is left.
  function lineInfo(ctx, k, v) {
    const { n, entries, colName } = ctx;
    const r = Math.floor(k / n), c = k % n;
    const row = [], col = [];
    for (let i = 0; i < n; i++) {
      if (entries[r * n + i]) row.push(entries[r * n + i]);
      if (entries[i * n + c]) col.push(entries[i * n + c]);
    }
    const list = (a) => (a.length ? a.sort((x, y) => x - y).join(', ') : 'nothing yet');
    const used = [...new Set([...row, ...col])].sort((x, y) => x - y).join(', ');
    return `Row ${r + 1} has ${list(row)}. Column ${colName(c)} has ${list(col)}. ` +
      `Together that is ${used}, so only ${v} is left.`;
  }

  // Givens for a solution: add cells where another answer differs until
  // the puzzle is unique, then drop the ones that are not needed.
  // Returns the givens (0 = empty) or null if it stays ambiguous.
  function makeGivens(n, sol, prune, nodes = 5000) {
    const given = new Int8Array(n * n);
    const run = () => solve(n, startCand(n, given), prune, 2, nodes);
    for (let guard = 0; guard < n * n; guard++) {
      const res = run();
      if (res.solutions.length === 1 && !res.capped) break;
      const other = res.solutions.find((x) => x.some((v, k) => v !== sol[k]));
      const diff = [...sol.keys()].filter((k) => !given[k] && (!other || other[k] !== sol[k]));
      if (!diff.length) return null;
      const k = diff[Math.floor(Math.random() * diff.length)];
      given[k] = sol[k];
    }
    const unique = () => { const r = run(); return r.solutions.length === 1 && !r.capped; };
    if (!unique()) return null;
    for (const k of PuzzleShell.shuffle([...sol.keys()])) {
      if (!given[k]) continue;
      given[k] = 0;
      if (!unique()) given[k] = sol[k];
    }
    return given;
  }

  // Full game page for a Latin-square puzzle with givens. cfg:
  //   id, name, rules, size, solvedText, what (hint words)
  //   generate(n) -> { n, given, solution, ...extra }
  //   encode(p) -> extra share data (n and givens are added)
  //   decode(d, n) -> extra fields; prune(p) -> prune function
  //   decorate(p, k, el) -> optional extra drawing per cell
  function startGame(cfg) {
    const merged = (p, s) => Int8Array.from(s, (v, k) => p.given[k] || v);
    function render(p, entries, opts = {}) {
      const { n, given, solution } = p;
      const { readonly, result, hint, onChange } = opts;
      const hintCells = new Set(hint ? hint.cells : []);
      const board = PuzzleShell.gridBoard({
        rows: n, cols: n, cellPx: PuzzleShell.fitCell(n, cfg.cellMax || 50), className: `pz-board lt-board ${cfg.className || ''}`, readonly,
        renderCell(k, el) {
          if (cfg.decorate) cfg.decorate(p, k, el);
          if (hintCells.has(k)) el.classList.add('hint');
          if (given[k]) { el.classList.add('given'); el.append(String(given[k])); return; }
          if (result) {
            el.append(String(solution[k]));
            el.classList.add(PuzzleShell.resultClass(entries[k], solution[k]));
          } else if (readonly) {
            el.append(entries[k] ? String(entries[k]) : '');
            el.classList.add('entry');
          } else {
            el.appendChild(PuzzleShell.digitInput({ r: Math.floor(k / n), c: k % n, value: entries[k], max: n,
              onSet: (v) => { entries[k] = v; onChange(false); } }));
          }
        },
      });
      if (!cfg.overlay) return board;
      const wrap = document.createElement('div');
      wrap.className = 'lt-wrap';
      wrap.appendChild(board);
      cfg.overlay(p, wrap, PuzzleShell.fitCell(n, cfg.cellMax || 50));
      return wrap;
    }
    PuzzleShell.start({
      id: cfg.id, name: cfg.name, rules: cfg.rules, size: cfg.size, solvedText: cfg.solvedText,
      controls: 'Click a cell and type a number. Arrow keys move between cells.',
      generate: cfg.generate,
      encode: (p) => ({ n: p.n, g: Array.from(p.given).join(','), x: cfg.encode(p) }),
      decode(d) {
        const n = d?.n;
        if (!Number.isInteger(n) || n < 3 || n > 9) throw new Error('Invalid board size');
        const given = Int8Array.from(String(d.g).split(','), Number);
        if (given.length !== n * n || given.some((v) => !(v >= 0 && v <= n))) throw new Error('Invalid givens');
        const p = { n, given, ...cfg.decode(d.x, n) };
        const res = solve(n, startCand(n, given), cfg.prune(p), 2, 50000);
        if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
        p.solution = res.solutions[0];
        return p;
      },
      newState: (p) => new Int8Array(p.n * p.n),
      saveState: (s) => Array.from(s).join(','),
      loadState(p, val) {
        const s = new Int8Array(p.n * p.n);
        const parts = String(val).split(',');
        if (parts.length === s.length) parts.forEach((x, k) => { const v = Number(x); if (v >= 0 && v <= p.n) s[k] = v; });
        return s;
      },
      render,
      check: (p, s) => merged(p, s).every((v, k) => v === p.solution[k]),
      hints: (p, s) => hints(p.n, merged(p, s), p.solution, cfg.prune(p), cfg.what),
      applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
    });
  }

  // For Str8ts and Sutoreto: white cells in stretches split by black cells.
  function startStretchGame(cfg) {
    const one = (m) => m && !(m & (m - 1));
    const low = (m) => 31 - Math.clz32(m & -m);

    function prepare(p) {
      const { R, C, black } = p;
      p.runs = [];
      const scan = (cells) => {
        let cur = [];
        for (const k of [...cells, -1]) {
          if (k >= 0 && !black[k]) { cur.push(k); continue; }
          if (cur.length >= 1) p.runs.push(cur);
          cur = [];
        }
      };
      for (let r = 0; r < R; r++) scan(Array.from({ length: C }, (_, c) => r * C + c));
      for (let c = 0; c < C; c++) scan(Array.from({ length: R }, (_, r) => r * C + c));
      return p;
    }

    function eliminateLineDuplicates(R, C, black, cand) {
      for (let k = 0; k < R * C; k++) {
        if (black[k] || !one(cand[k])) continue;
        const r = Math.floor(k / C), c = k % C;
        for (let i = 0; i < C; i++) { const j = r * C + i; if (j !== k && !black[j]) cand[j] &= ~cand[k]; }
        for (let i = 0; i < R; i++) { const j = i * C + c; if (j !== k && !black[j]) cand[j] &= ~cand[k]; }
      }
    }

    function propagate(p, cand) {
      const { R, C, black } = p;
      for (let guard = 0; guard < 200; guard++) {
        const before = cand.join(',');
        if (cfg.uniqueLine) eliminateLineDuplicates(R, C, black, cand);
        for (const run of p.runs) {
          if (run.length < 2) continue;
          const ok = (vals) => Math.max(...vals) - Math.min(...vals) === vals.length - 1;
          if (!filterGroup(run, cand, ok, true)) return false;
        }
        if (cand.some((m, k) => !black[k] && !m)) return false;
        if (cand.join(',') === before) return true;
      }
      return true;
    }

    function solve(p, start, stopAt = 2, maxNodes = 20000, random = false) {
      const out = [];
      let nodes = 0;
      (function rec(cand) {
        if (out.length >= stopAt || ++nodes > maxNodes) return;
        if (!propagate(p, cand)) return;
        const k = cand.findIndex((m, i) => !p.black[i] && !one(m));
        if (k < 0) { out.push(Int8Array.from(cand, (m, i) => (p.black[i] ? 0 : low(m)))); return; }
        const vals = [];
        for (let v = 1; v < 31; v++) if (cand[k] & (1 << v)) vals.push(v);
        for (const v of random ? PuzzleShell.shuffle(vals) : vals) { const t = Int32Array.from(cand); t[k] = 1 << v; rec(t); }
      })(Int32Array.from(start));
      return { solutions: out, capped: nodes > maxNodes };
    }

    const startCand = (p, given) => Int32Array.from({ length: p.R * p.C }, (_, k) => {
      if (p.black[k]) return 0;
      if (given[k]) return 1 << given[k];
      return ((1 << (p.R + 1)) - 1) & ~1;
    });

    function reduceGivens(p, black, given) {
      const solved = () => { const c = startCand(p, given); return propagate(p, c) && c.every((m, k) => black[k] || one(m)); };
      for (const k of PuzzleShell.shuffle([...new Array(p.R * p.C).keys()])) {
        if (!given[k]) continue;
        const v = given[k];
        given[k] = 0;
        if (!solved()) given[k] = v;
      }
    }

    function generate(n) {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        const R = n, C = n, N = R * C;
        const black = Uint8Array.from({ length: N }, () => (Math.random() < 0.2 ? 1 : 0));
        const p = prepare({ R, C, black });
        const fill = solve(p, startCand(p, new Int8Array(N)), 1, 3000, true);
        if (!fill.solutions.length) continue;
        const sol = fill.solutions[0];
        const given = Int8Array.from(sol);
        reduceGivens(p, black, given);
        p.given = given;
        p.solution = sol;
        return p;
      }
      return null;
    }

    function hints(p, entries) {
      const val = Int8Array.from(entries, (v, k) => p.given[k] || v);
      for (let k = 0; k < val.length; k++) if (entries[k] && !p.given[k] && entries[k] !== p.solution[k]) return [{ cells: [k], v: 0, reason: 'This number is wrong.' }];
      const cand = startCand(p, val);
      propagate(p, cand);
      for (let k = 0; k < val.length; k++) {
        if (p.black[k] || val[k] || !one(cand[k])) continue;
        return [{ cells: [k], v: low(cand[k]), reason: cfg.hintReason(low(cand[k])) }];
      }
      const k = [...val.keys()].find((i) => !p.black[i] && !val[i]);
      return k === undefined ? [] : [{ cells: [k], v: p.solution[k], reason: `No simple step is left. This cell is ${p.solution[k]}.` }];
    }

    function render(p, entries, opts = {}) {
      const { R, C, black, given, solution } = p;
      const { readonly, result, hint, onChange } = opts;
      const hintCells = new Set(hint ? hint.cells : []);
      return PuzzleShell.gridBoard({
        rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 46), className: `pz-board ${cfg.boardClass}`, readonly,
        renderCell(k, el) {
          if (black[k]) { el.classList.add('blk'); return; }
          if (hintCells.has(k)) el.classList.add('hint');
          if (given[k]) { el.classList.add('given'); el.textContent = given[k]; return; }
          if (result) {
            el.textContent = solution[k];
            el.classList.add(PuzzleShell.resultClass(entries[k], solution[k]));
          } else if (readonly) el.textContent = entries[k] || '';
          else {
            el.appendChild(PuzzleShell.digitInput({ r: Math.floor(k / C), c: k % C, value: entries[k], max: p.R,
              onSet: (v) => { entries[k] = v; onChange(false); } }));
          }
        },
      });
    }

    PuzzleShell.start({
      id: cfg.id,
      name: cfg.name,
      rules: cfg.rules,
      controls: 'Click a cell and type a number. Arrow keys move between cells.',
      size: cfg.size,
      solvedText: cfg.solvedText,
      generate,
      encode: (p) => ({ n: p.R, b: Array.from(p.black).join(''), v: Array.from(p.given).join('') }),
      decode(d) {
        const n = d?.n;
        if (!Number.isInteger(n) || n < 3 || n > 15) throw new Error('Invalid size');
        if (typeof d.b !== 'string' || d.b.length !== n * n || typeof d.v !== 'string' || d.v.length !== n * n) throw new Error('Invalid grid');
        const p = prepare({ R: n, C: n, black: Uint8Array.from(d.b, Number) });
        p.given = Int8Array.from(d.v, Number);
        const res = solve(p, startCand(p, p.given), 2, 50000);
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
      check: (p, s) => s.every((v, k) => p.black[k] || (p.given[k] || v) === p.solution[k]),
      hints,
      applyHint(p, s, h) { for (const k of h.cells) if (!p.given[k]) s[k] = h.v; },
    });
  }

  return { bitCount, lowBit, full, values, randomSquare, propagate, solve, startCand, filterGroup, hints, makeGivens, startGame, startStretchGame };
})();
