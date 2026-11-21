// Shared engine for "split the grid into pieces" puzzles where every
// piece holds exactly one clue cell (Yonmasu, Neighbours, ...). A piece
// is a sorted list of connected cells. Exposes the global `Pieces`.
//
// Game config:
//   sizeOf(p, k)       piece size for the clue at k
//   shapes(p, k)       optional instead of sizeOf: all allowed pieces (sorted cell lists) for the clue at k
//   fits(p, k, cells)  optional extra test for a piece of the clue at k
//   final(p, pieces)   optional whole-board check of a full solution
//   split(R, C)        random partition: list of pieces (generator)
//   clueFor(p, cells)  -> [k, code] clue to place for a piece
//   clueText(code)     text drawn in a clue cell
//   partial            cells may stay outside all pieces
//   blocked(p, k)      optional: cell k can never be in a piece
//   moveClue(p, from, to) optional: move a clue (generator uniqueness fix)
//   encodeExtra / decodeExtra(p, x) optional extra share data
//   cellText(p, k)     optional text for non-clue cells

const Pieces = (() => {
  const key = (cells) => cells.join(',');

  function neighbours(R, C, k) {
    const r = Math.floor(k / C), c = k % C, out = [];
    if (r > 0) out.push(k - C);
    if (r < R - 1) out.push(k + C);
    if (c > 0) out.push(k - 1);
    if (c < C - 1) out.push(k + 1);
    return out;
  }

  function options(cfg, p, k) {
    if (cfg.shapes) {
      const ok = (j) => j === k || (!p.clues[j] && !(cfg.blocked?.(p, j)));
      return cfg.shapes(p, k).filter((cells) => cells.every(ok));
    }
    const size = cfg.sizeOf(p, k);
    const list = enumerate(p.R, p.C, k, size, (j) => j === k || (!p.clues[j] && !(cfg.blocked?.(p, j))));
    return cfg.fits ? list.filter((cells) => cfg.fits(p, k, cells)) : list;
  }

  // Connected sets of `size` containing k (deduplicated).
  function enumerate(R, C, k, size, ok) {
    const out = new Map();
    const seen = new Set();
    const rec = (set) => {
      const sk = key(set.slice().sort((a, b) => a - b));
      if (seen.has(sk)) return;
      seen.add(sk);
      if (set.length === size) { out.set(sk, set.slice().sort((a, b) => a - b)); return; }
      const front = new Set();
      for (const x of set) for (const j of neighbours(R, C, x)) if (!set.includes(j) && ok(j)) front.add(j);
      for (const j of front) { set.push(j); rec(set); set.pop(); }
    };
    rec([k]);
    return [...out.values()];
  }

  function init(cfg, p) {
    const clueCells = [];
    for (let k = 0; k < p.R * p.C; k++) if (p.clues[k]) clueCells.push(k);
    return { clueCells, opts: clueCells.map((k) => options(cfg, p, k)), chosen: clueCells.map(() => null) };
  }

  const clash = (a, b) => a.some((x) => b.includes(x));

  function choose(st, i, cells) {
    st.chosen[i] = cells;
    st.opts[i] = [cells];
    for (let j = 0; j < st.opts.length; j++) if (j !== i) st.opts[j] = st.opts[j].filter((o) => !clash(o, cells));
  }

  // One logic step (see Rects): a clue with one piece left, or a cell
  // only one clue can cover. Returns a move, null, or false.
  function step(p, st) {
    for (let i = 0; i < st.opts.length; i++) {
      if (!st.opts[i].length) return false;
      if (!st.chosen[i] && st.opts[i].length === 1) return { i, cells: st.opts[i][0], why: 'one' };
    }
    const N = p.R * p.C;
    const who = Array.from({ length: N }, () => new Set());
    st.opts.forEach((list, i) => list.forEach((cells) => { for (const j of cells) who[j].add(i); }));
    for (let j = 0; j < N; j++) {
      if (!who[j].size) { if (p.partial) { continue; } return false; }
      // In partial games a cell may stay empty, so no "only cover" step.
      if (who[j].size !== 1 || p.partial) continue;
      const i = [...who[j]][0];
      if (st.chosen[i]) continue;
      const keep = st.opts[i].filter((cells) => cells.includes(j));
      if (keep.length < st.opts[i].length) {
        if (keep.length === 1) return { i, cells: keep[0], why: 'cell', cell: j };
        st.opts[i] = keep;
        return { i, narrowed: true };
      }
    }
    return null;
  }

  function settle(p, st) {
    for (;;) {
      const m = step(p, st);
      if (m === false) return false;
      if (!m) return true;
      if (m.cells) choose(st, m.i, m.cells);
    }
  }

  function count(cfg, p, stopAt = 2, maxNodes = 20000) {
    let found = 0, first = null, nodes = 0;
    const all = [];
    (function rec(st) {
      if (found >= stopAt || ++nodes > maxNodes) return;
      if (!settle(p, st)) return;
      let i = -1, best = 1e9;
      st.chosen.forEach((x, j) => { if (!x && st.opts[j].length < best) { best = st.opts[j].length; i = j; } });
      if (i < 0) {
        if (cfg.final && !cfg.final(p, st.chosen)) return;
        if (!found) first = st.chosen.slice();
        all.push(st.chosen.slice());
        found++;
        return;
      }
      for (const cells of st.opts[i]) {
        const copy = { clueCells: st.clueCells, opts: st.opts.map((o) => o.slice()), chosen: st.chosen.slice() };
        choose(copy, i, cells);
        rec(copy);
      }
    })(init(cfg, p));
    return { count: found, first, all, capped: nodes > maxNodes };
  }

  // Random partition into pieces of the given size (backtracking).
  function randomTiling(R, C, sizeFn) {
    const N = R * C;
    const owner = new Int32Array(N).fill(-1);
    const pieces = [];
    let nodes = 0;
    const rec = (k) => {
      while (k < N && owner[k] >= 0) k++;
      if (k === N) return true;
      if (++nodes > 3000) return false;
      const size = sizeFn();
      const opts = PuzzleShell.shuffle(enumerate(R, C, k, size, (j) => owner[j] < 0 && j >= k)).slice(0, 6);
      for (const cells of opts) {
        for (const j of cells) owner[j] = pieces.length;
        pieces.push(cells);
        if (rec(k + 1)) return true;
        pieces.pop();
        for (const j of cells) owner[j] = -1;
      }
      return false;
    };
    return rec(0) ? pieces : null;
  }

  function isSolved(cfg, p, pieces) {
    const cnt = new Int32Array(p.R * p.C);
    for (const cells of pieces) for (const k of cells) cnt[k]++;
    if (cnt.some((x) => x > 1 || (x === 0 && !cfg.partial))) return false;
    for (const cells of pieces) {
      const cl = cells.filter((k) => p.clues[k]);
      if (cl.length !== 1) return false;
      if (cfg.shapes ? !cfg.shapes(p, cl[0]).some((sh) => key(sh) === key(cells)) : cells.length !== cfg.sizeOf(p, cl[0])) return false;
      if (cfg.fits && !cfg.fits(p, cl[0], cells)) return false;
      if (!connected(p, cells)) return false;
    }
    return !cfg.final || cfg.final(p, pieces);
  }

  function connected(p, cells) {
    const set = new Set(cells);
    const seen = new Set([cells[0]]);
    const stack = [cells[0]];
    while (stack.length) {
      const k = stack.pop();
      for (const j of neighbours(p.R, p.C, k)) if (set.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
    return seen.size === cells.length;
  }

  function hints(cfg, p, pieces) {
    const good = new Set(p.solution.map(key));
    for (let i = 0; i < pieces.length; i++) {
      if (!good.has(key(pieces[i]))) return [{ remove: i, cells: pieces[i], reason: 'This piece is wrong.' }];
    }
    const st = init(cfg, p);
    const placed = new Set(pieces.map(key));
    p.solution.forEach((cells, i) => { if (placed.has(key(cells))) choose(st, i, cells); });
    for (let guard = 0; guard < 500; guard++) {
      const m = step(p, st);
      if (!m) break;
      if (!m.cells) continue;
      return [{ add: m.cells, cells: m.cells, mark: m.cell,
        reason: m.why === 'one' ? 'This clue fits in only one piece.' : 'Only one clue can reach the marked cell, and only with this piece.' }];
    }
    const missing = p.solution.find((c) => !placed.has(key(c)));
    return missing ? [{ add: missing, cells: missing, reason: 'No simple step is left. Here is one piece.' }] : [];
  }

  // Board: drag across cells to paint a piece; click a piece to remove it.
  function render(cfg, p, pieces, opts = {}) {
    const { R, C, clues, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const shown = result ? solution : pieces;
    const id = new Int32Array(R * C).fill(-1);
    shown.forEach((cells, i) => { for (const k of cells) id[k] = i; });
    const good = new Set(solution.map(key));
    const hintCells = new Set(hint ? hint.cells : []);
    const borderIds = Int32Array.from(id, (v, j) => (v < 0 ? -2 - j : v));
    const board = PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 40), className: `pz-board pz-regions pc-board ${cfg.className || ''}`, readonly,
      renderCell(k, el) {
        if (clues[k]) el.textContent = cfg.clueText(clues[k], p, k);
        else if (cfg.cellText) el.textContent = cfg.cellText(p, k);
        if (cfg.decorate) cfg.decorate(p, k, el);
        if (id[k] >= 0) {
          el.style.background = PuzzleShell.TINTS[id[k] % PuzzleShell.TINTS.length];
          PuzzleShell.regionBorders(el, k, borderIds, R, C);
          if (result && pieces.some((c) => good.has(key(c)) && c.includes(k))) el.classList.add('ok');
        }
        // An answer cell the player has not put in any piece yet.
        if (result && id[k] >= 0 && !pieces.some((c) => c.includes(k))) el.classList.add('miss');
        // A piece of the player that is not in the answer.
        if (result && pieces.some((c) => !good.has(key(c)) && c.includes(k))) el.classList.add('bad');
        if (hintCells.has(k)) el.classList.add('hint');
        if (hint && hint.mark === k) el.classList.add('hint-clue');
      },
    });
    if (readonly) return board;
    let path = null;
    const cellAt = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      return el?.closest('.pc-board') === board && el.dataset.k !== undefined ? Number(el.dataset.k) : null;
    };
    board.addEventListener('pointerdown', (ev) => {
      const k = cellAt(ev);
      if (k === null) return;
      ev.preventDefault();
      path = [k];
      board.setPointerCapture(ev.pointerId);
      board.children[k].classList.add('drag');
    });
    board.addEventListener('pointermove', (ev) => {
      if (!path) return;
      const k = cellAt(ev);
      if (k === null || path.includes(k)) return;
      if (!path.some((x) => neighbours(R, C, x).includes(k))) return;
      path.push(k);
      board.children[k].classList.add('drag');
    });
    board.addEventListener('pointerup', () => {
      if (!path) return;
      const cells = path.slice().sort((a, b) => a - b);
      path = null;
      if (cells.length === 1 && id[cells[0]] >= 0) {
        pieces.splice(id[cells[0]], 1);
      } else {
        for (let i = pieces.length - 1; i >= 0; i--) if (clash(pieces[i], cells)) pieces.splice(i, 1);
        pieces.push(cells);
      }
      onChange();
    });
    board.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      const k = cellAt(ev);
      if (k !== null && id[k] >= 0) { pieces.splice(id[k], 1); onChange(); }
    });
    return board;
  }

  function generate(cfg, n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n;
      const pieces = cfg.split(R, C);
      if (!pieces) continue;
      const p = { R, C, clues: new Int8Array(R * C), partial: !!cfg.partial };
      for (const cells of pieces) {
        const [k, code] = cfg.clueFor(p, cells, pieces);
        p.clues[k] = code;
      }
      if (cfg.prepare) cfg.prepare(p, pieces);
      if (cfg.final && !cfg.final(p, pieces)) continue;
      let res = count(cfg, p, 2, 20000);
      // Another answer: move a clue inside its true piece to a cell the
      // wrong piece does not cover. The wrong piece then loses its clue.
      const truth = new Set(pieces.map(key));
      for (let tries = 0; res.count > 1 && !res.capped && tries < 300 && Date.now() < deadline; tries++) {
        const other = res.all.find((sol) => sol.some((c) => !truth.has(key(c))));
        const moves = [];
        for (const wrong of other.filter((c) => !truth.has(key(c)))) {
          for (const k of wrong.filter((j) => p.clues[j])) {
            const mine = pieces.find((c) => c.includes(k));
            for (const j of mine) if (!wrong.includes(j) && !p.clues[j]) moves.push([k, j]);
          }
        }
        if (!moves.length) break;
        const [from, to] = moves[Math.floor(Math.random() * moves.length)];
        if (cfg.moveClue) cfg.moveClue(p, from, to);
        else { p.clues[to] = p.clues[from]; p.clues[from] = 0; }
        res = count(cfg, p, 2, 20000);
      }
      if (res.count !== 1 || res.capped) continue;
      p.solution = res.first;
      return p;
    }
    return null;
  }

  function startGame(cfg) {
    PuzzleShell.start({
      id: cfg.id, name: cfg.name, rules: cfg.rules, size: cfg.size, solvedText: cfg.solvedText,
      controls: 'Drag across cells to draw a piece. Click or right click a piece to remove it.',
      generate: (n) => generate(cfg, cfg.generateSize ? cfg.generateSize(n) : n),
      encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => v.toString(36)).join(''), x: cfg.encodeExtra ? cfg.encodeExtra(p) : undefined }),
      decode(d) {
        const R = d?.r, C = d?.c;
        if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
        if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid clues');
        const p = { R, C, clues: Int8Array.from(d.g, (ch) => Number.parseInt(ch, 36)), partial: !!cfg.partial };
        if (cfg.decodeExtra) cfg.decodeExtra(p, d.x);
        if (cfg.prepare) cfg.prepare(p);
        const res = count(cfg, p, 2, 50000);
        if (res.count !== 1) throw new Error('Puzzle has no unique solution');
        p.solution = res.first;
        return p;
      },
      newState: () => [],
      saveState: (s) => s,
      loadState: (p, v) => (Array.isArray(v) ? v.filter((c) => Array.isArray(c) && c.length) : []),
      render: (p, s, opts) => render(cfg, p, s, opts),
      check: (p, s) => isSolved(cfg, p, s),
      hints: (p, s) => hints(cfg, p, s),
      applyHint(p, s, h) {
        if (h.remove !== undefined) s.splice(h.remove, 1);
        if (h.add) s.push(h.add);
      },
    });
  }

  return { enumerate, neighbours, randomTiling, count, generate, startGame };
})();
