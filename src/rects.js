// Shared engine for "split the grid into rectangles" puzzles (Meadows,
// Rekuto, Tatamibari, Usotatami, Nawabari, ...). Each rectangle holds
// exactly one clue cell. Exposes the global `Rects`.
//
// A rectangle is [r1, c1, r2, c2] (inclusive). A puzzle is
// { R, C, clues } where clues[k] is 0 (none) or a game-specific code.
// Game config:
//   fits(p, k, rect)   may the clue at k own this rectangle?
//   final(p, rects)    optional whole-board check of a full solution
//   split(R, C)        random list of rectangles (generator)
//   clueFor(p, rect, cells) -> [k, code] clue to place for a rectangle
//   clueText(code)     text drawn in a clue cell
//   movable            clue codes may move inside their rectangle
//   prepare(p, rects)  optional: add extra data (false = retry)
//   encodeExtra(p) / decodeExtra(p, x), decorate(p, k, el) optional
//   improve(p, rects, sols) optional: change clues so another answer
//                      fails; returns false if it can not

const Rects = (() => {
  function cellsOf([r1, c1, r2, c2], C) {
    const out = [];
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push(r * C + c);
    return out;
  }
  const overlaps = (a, b) => !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
  const key = (r) => r.join(',');

  // Every rectangle the clue at k may own (no other clue inside).
  function options(cfg, p, k) {
    const { R, C, clues } = p;
    const r0 = Math.floor(k / C), c0 = k % C, out = [];
    for (let r1 = 0; r1 <= r0; r1++) for (let r2 = r0; r2 < R; r2++) {
      for (let c1 = 0; c1 <= c0; c1++) for (let c2 = c0; c2 < C; c2++) {
        const rect = [r1, c1, r2, c2];
        if (p.maxArea && (r2 - r1 + 1) * (c2 - c1 + 1) > p.maxArea) continue;
        if (!cfg.fits(p, k, rect)) continue;
        if (cellsOf(rect, C).every((j) => j === k || !clues[j])) out.push(rect);
      }
    }
    return out;
  }

  function init(cfg, p) {
    const clueCells = [];
    for (let k = 0; k < p.R * p.C; k++) if (p.clues[k]) clueCells.push(k);
    return { clueCells, opts: clueCells.map((k) => options(cfg, p, k)), chosen: clueCells.map(() => null) };
  }

  function choose(st, i, rect) {
    st.chosen[i] = rect;
    st.opts[i] = [rect];
    for (let j = 0; j < st.opts.length; j++) if (j !== i) st.opts[j] = st.opts[j].filter((o) => !overlaps(o, rect));
  }

  // One logic step: a clue with one rectangle left, or a cell that only
  // one clue can cover. Returns a move, null, or false (broken).
  function step(p, st) {
    for (let i = 0; i < st.opts.length; i++) {
      if (!st.opts[i].length) return false;
      if (!st.chosen[i] && st.opts[i].length === 1) return { i, rect: st.opts[i][0], why: 'one' };
    }
    const N = p.R * p.C;
    const who = Array.from({ length: N }, () => new Set());
    st.opts.forEach((list, i) => list.forEach((rect) => { for (const j of cellsOf(rect, p.C)) who[j].add(i); }));
    for (let j = 0; j < N; j++) {
      if (!who[j].size) return false;
      if (who[j].size !== 1) continue;
      const i = [...who[j]][0];
      if (st.chosen[i]) continue;
      const keep = st.opts[i].filter((rect) => cellsOf(rect, p.C).includes(j));
      if (keep.length < st.opts[i].length) {
        if (keep.length === 1) return { i, rect: keep[0], why: 'cell', cell: j };
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
      if (m.rect) choose(st, m.i, m.rect);
    }
  }

  // Counts full solutions (up to stopAt) that pass cfg.final.
  function count(cfg, p, stopAt = 2, maxNodes = 20000) {
    let found = 0, first = null, nodes = 0;
    const all = [];
    (function rec(st) {
      if (found >= stopAt || ++nodes > maxNodes) return;
      if (!settle(p, st)) return;
      const i = st.chosen.findIndex((x) => !x);
      if (i < 0) {
        if (cfg.final && !cfg.final(p, st.chosen)) return;
        if (!found) first = st.chosen.slice();
        all.push(st.chosen.slice());
        found++;
        return;
      }
      for (const rect of st.opts[i]) {
        const copy = { clueCells: st.clueCells, opts: st.opts.map((o) => o.slice()), chosen: st.chosen.slice() };
        choose(copy, i, rect);
        rec(copy);
      }
    })(init(cfg, p));
    return { count: found, first, all, capped: nodes > maxNodes };
  }

  // Shared check: no grid dot is a corner of four rectangles.
  function noFourCorners(p, rects) {
    const id = new Int32Array(p.R * p.C).fill(-1);
    rects.forEach((r, i) => { for (const k of cellsOf(r, p.C)) id[k] = i; });
    for (let r = 0; r < p.R - 1; r++) for (let c = 0; c < p.C - 1; c++) {
      const a = id[r * p.C + c], b = id[r * p.C + c + 1], d = id[(r + 1) * p.C + c], e = id[(r + 1) * p.C + c + 1];
      if (a !== b && a !== d && b !== e && d !== e) return false;
    }
    return true;
  }

  // Random split into rectangles with sides up to maxSide.
  function randomSplit(R, C, maxSide = 4, shape = null) {
    const id = new Int32Array(R * C).fill(-1);
    const rects = [];
    for (let k = 0; k < R * C; k++) {
      if (id[k] >= 0) continue;
      const r = Math.floor(k / C), c = k % C;
      let maxW = 0;
      while (c + maxW < C && id[r * C + c + maxW] < 0 && maxW < maxSide) maxW++;
      let w = 1 + Math.floor(Math.random() * maxW);
      let maxH = 0;
      while (r + maxH < R && maxH < maxSide && [...Array(w).keys()].every((i) => id[(r + maxH) * C + c + i] < 0)) maxH++;
      let h = 1 + Math.floor(Math.random() * maxH);
      if (shape) [h, w] = shape(h, w, maxH, maxW);
      const rect = [r, c, r + h - 1, c + w - 1];
      for (const j of cellsOf(rect, C)) id[j] = rects.length;
      rects.push(rect);
    }
    return rects;
  }

  function isSolved(cfg, p, rects) {
    const cnt = new Int32Array(p.R * p.C);
    for (const r of rects) for (const k of cellsOf(r, p.C)) cnt[k]++;
    if (cnt.some((x) => x !== 1)) return false;
    for (const r of rects) {
      const cl = cellsOf(r, p.C).filter((k) => p.clues[k]);
      if (cl.length !== 1 || !cfg.fits(p, cl[0], r)) return false;
    }
    return !cfg.final || cfg.final(p, rects);
  }

  function hints(cfg, p, rects) {
    const good = new Set(p.solution.map(key));
    const out = [];
    rects.forEach((rect, i) => { if (!good.has(key(rect))) out.push({ remove: i, cells: cellsOf(rect, p.C), reason: 'This rectangle is wrong.' }); });
    if (out.length) return out.slice(0, 1);
    const st = init(cfg, p);
    const placed = new Set(rects.map(key));
    p.solution.forEach((rect, i) => { if (placed.has(key(rect))) choose(st, i, rect); });
    for (let guard = 0; guard < 500; guard++) {
      const m = step(p, st);
      if (!m) break;
      if (!m.rect) continue;
      return [{ add: m.rect, cells: cellsOf(m.rect, p.C), mark: m.cell,
        reason: m.why === 'one' ? 'This clue fits in only one rectangle.' : 'Only one clue can cover the marked cell, and only with this rectangle.' }];
    }
    const missing = p.solution.find((r) => !placed.has(key(r)));
    if (missing) out.push({ add: missing, cells: cellsOf(missing, p.C), reason: 'No simple step is left. Here is one rectangle.' });
    return out;
  }

  // Drag-to-draw board.
  function render(cfg, p, rects, opts = {}) {
    const { R, C, clues, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const shown = result ? solution : rects;
    const id = new Int32Array(R * C).fill(-1);
    shown.forEach((r, i) => { for (const k of cellsOf(r, C)) id[k] = i; });
    const good = new Set(solution.map(key));
    const hintCells = new Set(hint ? hint.cells : []);
    const borderIds = Int32Array.from(id, (v, j) => (v < 0 ? -2 - j : v));
    const board = PuzzleShell.gridBoard({
      rows: R, cols: C, cellPx: PuzzleShell.fitCell(C, 40), className: `pz-board pz-regions rc-board ${cfg.className || ''}`, readonly,
      renderCell(k, el) {
        if (cfg.decorate) cfg.decorate(p, k, el);
        if (clues[k]) el.append(String(cfg.clueText(clues[k])));
        if (id[k] >= 0) {
          el.style.background = PuzzleShell.TINTS[id[k] % PuzzleShell.TINTS.length];
          PuzzleShell.regionBorders(el, k, borderIds, R, C);
          if (result && rects.some((r) => good.has(key(r)) && cellsOf(r, C).includes(k))) el.classList.add('ok');
        }
        // An answer cell the player has not put in any rectangle yet.
        if (result && id[k] >= 0 && !rects.some((r) => cellsOf(r, C).includes(k))) el.classList.add('miss');
        // A rectangle of the player that is not in the answer.
        if (result && rects.some((r) => !good.has(key(r)) && cellsOf(r, C).includes(k))) el.classList.add('bad');
        if (hintCells.has(k)) el.classList.add('hint');
        if (hint && hint.mark === k) el.classList.add('hint-clue');
      },
    });
    if (readonly) return board;
    let start = null, preview = [];
    const cellAt = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      return el && el.closest('.rc-board') === board && el.dataset.k !== undefined ? Number(el.dataset.k) : null;
    };
    const rectOf = (a, b) => [Math.min(Math.floor(a / C), Math.floor(b / C)), Math.min(a % C, b % C),
      Math.max(Math.floor(a / C), Math.floor(b / C)), Math.max(a % C, b % C)];
    const showPreview = (rect) => {
      for (const el of preview) el.classList.remove('drag');
      preview = cellsOf(rect, C).map((j) => board.children[j]);
      for (const el of preview) el.classList.add('drag');
    };
    board.addEventListener('pointerdown', (ev) => {
      const k = cellAt(ev);
      if (k === null) return;
      ev.preventDefault();
      start = k;
      board.setPointerCapture(ev.pointerId);
      showPreview(rectOf(k, k));
    });
    board.addEventListener('pointermove', (ev) => {
      if (start === null) return;
      const k = cellAt(ev);
      if (k !== null) showPreview(rectOf(start, k));
    });
    board.addEventListener('pointerup', (ev) => {
      if (start === null) return;
      const k = cellAt(ev);
      const end = k === null ? start : k;
      const rect = rectOf(start, end);
      start = null;
      if (end === rect[0] * C + rect[1] && rect[0] === rect[2] && rect[1] === rect[3] && id[end] >= 0 &&
          cellsOf(rects[id[end]], C).length > 1) {
        rects.splice(id[end], 1);
      } else {
        for (let i = rects.length - 1; i >= 0; i--) if (overlaps(rects[i], rect)) rects.splice(i, 1);
        rects.push(rect);
      }
      onChange();
    });
    board.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      const k = cellAt(ev);
      if (k !== null && id[k] >= 0) { rects.splice(id[k], 1); onChange(); }
    });
    return board;
  }

  function generate(cfg, n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n;
      const rects = cfg.split(R, C);
      if (!rects) continue;
      const p = { R, C, clues: new Int8Array(R * C), maxArea: cfg.maxArea };
      if (cfg.prepare && cfg.prepare(p, rects) === false) continue;
      if (cfg.final && !cfg.final(p, rects)) continue;
      let ok = true;
      for (const rect of rects) {
        const res = cfg.clueFor(p, rect, cellsOf(rect, C));
        if (!res) { ok = false; break; }
        p.clues[res[0]] = res[1];
      }
      if (!ok) continue;
      let res = count(cfg, p, 2, 20000);
      // Optional: let the game change clues to rule out other answers.
      for (let tries = 0; cfg.improve && res.count > 1 && !res.capped && tries < 40; tries++) {
        if (!cfg.improve(p, rects, res.all)) break;
        res = count(cfg, p, 2, 20000);
      }
      // Optional: move a clue inside its true rectangle to a cell the
      // wrong rectangle does not cover (clue codes that do not depend
      // on the position).
      for (let tries = 0; cfg.movable && res.count > 1 && !res.capped && tries < 200 && Date.now() < deadline; tries++) {
        const truth = new Set(rects.map(key));
        const other = res.all.find((sol) => sol.some((r) => !truth.has(key(r))));
        const moves = [];
        for (const wrong of other.filter((r) => !truth.has(key(r)))) {
          const wc = cellsOf(wrong, C);
          for (const k of wc.filter((j) => p.clues[j])) {
            const mine = rects.find((r) => cellsOf(r, C).includes(k));
            for (const j of cellsOf(mine, C)) if (!wc.includes(j) && !p.clues[j]) moves.push([k, j]);
          }
        }
        if (!moves.length) break;
        const [from, to] = moves[Math.floor(Math.random() * moves.length)];
        p.clues[to] = p.clues[from];
        p.clues[from] = 0;
        res = count(cfg, p, 2, 20000);
      }
      if (res.count !== 1 || res.capped) continue;
      p.solution = res.first;
      return p;
    }
    return null;
  }

  // Full game page. cfg also has id, name, rules, size, solvedText.
  function startGame(cfg) {
    PuzzleShell.start({
      id: cfg.id, name: cfg.name, rules: cfg.rules, size: cfg.size, solvedText: cfg.solvedText,
      controls: 'Drag from corner to corner to draw a rectangle. Click or right click a rectangle to remove it.',
      generate: (n) => generate(cfg, n),
      encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => v.toString(36)).join(''), x: cfg.encodeExtra ? cfg.encodeExtra(p) : undefined }),
      decode(d) {
        const R = d && d.r, C = d && d.c;
        if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 25)) throw new Error('Invalid board size');
        if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid clues');
        const p = { R, C, clues: Int8Array.from(d.g, (ch) => parseInt(ch, 36)), maxArea: cfg.maxArea };
        if (cfg.decodeExtra) cfg.decodeExtra(p, d.x);
        const res = count(cfg, p, 2, 50000);
        if (res.count !== 1) throw new Error('Puzzle has no unique solution');
        p.solution = res.first;
        return p;
      },
      newState: () => [],
      saveState: (s) => s,
      loadState: (p, v) => (Array.isArray(v) ? v.filter((r) => Array.isArray(r) && r.length === 4) : []),
      render: (p, s, opts) => render(cfg, p, s, opts),
      check: (p, s) => isSolved(cfg, p, s),
      hints: (p, s) => hints(cfg, p, s),
      applyHint(p, s, h) {
        if (h.remove !== undefined) s.splice(h.remove, 1);
        if (h.add) s.push(h.add);
      },
    });
  }

  return { cellsOf, options, count, noFourCorners, randomSplit, startGame, generate };
})();
