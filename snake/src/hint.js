// Hint engine. Looks at the current board state from the perspective
// of the *player* — clues, head, tail, the player's own fills and X
// marks, the touch rule — and returns:
//
//   * forced deductions (cells the player can fill or mark for sure)
//   * conflicts (cells the player has filled or marked that already
//     violate the rules, with the reason they cannot be valid)
//
// The hint engine never consults the secret solution. Every claim it
// makes is something the player could derive themselves from what's
// already on the board.
//
// Hint shape: { r, c, action: 'fill' | 'mark' | 'conflict', reason }.

const Hint = (() => {
  // 'head' or 'tail' for an end cell.
  const endName = (p, r, c) => (r === p.head[0] && c === p.head[1] ? 'head' : 'tail');

  function isEndpoint(p, r, c) {
    return (r === p.head[0] && c === p.head[1])
        || (r === p.tail[0] && c === p.tail[1]);
  }

  function find(puzzle, userFilled, userMarked) {
    const all = findAll(puzzle, userFilled, userMarked);
    return all.length ? all[0] : null;
  }

  function findAll(puzzle, userFilled, userMarked) {
    const { size } = puzzle;

    // The player's hypothesis: every endpoint plus every cell they
    // have filled is treated as snake; every cell they have marked is
    // treated as empty; everything else is undecided.
    const snake = new Set();
    snake.add(puzzle.head[0] * size + puzzle.head[1]);
    snake.add(puzzle.tail[0] * size + puzzle.tail[1]);
    for (const k of userFilled) snake.add(k);

    const cellState = (r, c) => {
      const k = r * size + c;
      if (snake.has(k)) return 'fill';
      if (userMarked.has(k)) return 'mark';
      return 'open';
    };

    const out = [];
    const seen = new Set();
    const add = (h) => {
      if (!h) return;
      const key = `${h.r},${h.c},${h.action}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(h);
    };

    // Conflicts first — if the player has done something illegal we
    // surface that before suggesting more moves.
    for (const h of findConflicts(puzzle, snake, userMarked, cellState)) add(h);
    for (const h of scanLines(puzzle, cellState)) add(h);
    for (const h of scanCellsCantBeFilled(puzzle, snake, userMarked, cellState)) add(h);
    for (const h of scanForcedExtension(puzzle, snake, userMarked, cellState)) add(h);

    // Structural rules can't cover every state — when nothing simpler
    // fires, emit ONE last-resort hint sourced from the rules + the
    // touch rule together. The wording stays player-verifiable: "try
    // the opposite and you can't complete the snake", not "the unique
    // solution says so".
    if (out.length === 0) {
      const forced = findOneForcedByElimination(puzzle, snake, userMarked);
      if (forced) add(forced);
    }
    return out;
  }

  // --- forced deductions --------------------------------------------

  function scanLines(puzzle, cellState) {
    const { size, rowClues, colClues } = puzzle;
    const hints = [];

    function emitLine(cells, clue, axisLabel) {
      let filled = 0;
      const openCells = [];
      for (const [r, c] of cells) {
        const s = cellState(r, c);
        if (s === 'fill') filled++;
        else if (s === 'open') openCells.push([r, c]);
      }
      const open = openCells.length;
      const need = clue - filled;
      if (need < 0 || open === 0) return; // overfill is handled in findConflicts

      if (need === 0) {
        const reason = `${axisLabel} already contains ${PuzzleShell.plural(clue, 'filled cell')}, so no other cell in it can belong to the snake.`;
        for (const [r, c] of openCells) hints.push({ r, c, action: 'mark', reason });
      } else if (need === open) {
        const reason = `${axisLabel} needs ${PuzzleShell.plural(need, 'more filled cell')}, and exactly ${PuzzleShell.plural(open, 'cell')} ${open === 1 ? 'is' : 'are'} still undecided — so every undecided cell in it must be filled.`;
        for (const [r, c] of openCells) hints.push({ r, c, action: 'fill', reason });
      }
    }

    for (let r = 0; r < size; r++) {
      const cells = [];
      for (let c = 0; c < size; c++) cells.push([r, c]);
      emitLine(cells, rowClues[r], `Row ${r + 1}`);
    }
    for (let c = 0; c < size; c++) {
      const cells = [];
      for (let r = 0; r < size; r++) cells.push([r, c]);
      emitLine(cells, colClues[c], `Column ${c + 1}`);
    }
    return hints;
  }

  // For every open cell, see if filling it would immediately break the
  // rules given the player's current hypothesis. If so, emit an X hint
  // with a specific reason.
  function scanCellsCantBeFilled(puzzle, snake, userMarked, cellState) {
    const { size } = puzzle;
    const hints = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (cellState(r, c) !== 'open') continue;
        const reason = whyCantBeFilled(puzzle, snake, userMarked, r, c);
        if (reason) hints.push({ r, c, action: 'mark', reason });
      }
    }
    return hints;
  }

  function countNeighborDegrees(r, c, size, snake) {
    let deg = 0;
    for (const [dr, dc] of Rules.ORTHO) {
      const ar = r + dr, ac = c + dc;
      if (Rules.inBounds(ar, ac, size) && snake.has(ar * size + ac)) deg++;
    }
    return deg;
  }

  function checkOverConnection(puzzle, snake, r, c) {
    const { size } = puzzle;
    for (const [dr, dc] of Rules.ORTHO) {
      const nr = r + dr, nc = c + dc;
      if (!Rules.inBounds(nr, nc, size) || !snake.has(nr * size + nc)) continue;
      const maxDeg = isEndpoint(puzzle, nr, nc) ? 1 : 2;
      const deg = countNeighborDegrees(nr, nc, size, snake);
      if (deg >= maxDeg) {
        const which = isEndpoint(puzzle, nr, nc) ? `The ${endName(puzzle, nr, nc)}` : 'The adjacent filled cell';
        return `${which} already has its ${PuzzleShell.plural(maxDeg, 'allowed connection')} — filling this cell would over-connect it.`;
      }
    }
    return null;
  }

  function check2x2Block(size, snake, r, c) {
    const groups = [
      [[0, 1], [1, 0], [1, 1]],
      [[0, -1], [1, 0], [1, -1]],
      [[0, 1], [-1, 0], [-1, 1]],
      [[0, -1], [-1, 0], [-1, -1]],
    ];
    for (const g of groups) {
      const ok = g.every(([dr, dc]) => Rules.inBounds(r + dr, c + dc, size) && snake.has((r + dr) * size + (c + dc)));
      if (ok) return 'Filling this cell would create a 2×2 block of snake cells, which the no-touch rule forbids.';
    }
    return null;
  }

  function checkDiagonalTrap(puzzle, snake, userMarked, r, c) {
    const { size } = puzzle;
    for (const [dr, dc] of Rules.DIAG) {
      const nr = r + dr, nc = c + dc;
      if (!Rules.inBounds(nr, nc, size) || !snake.has(nr * size + nc)) continue;
      const c1Inside = Rules.inBounds(r, nc, size), c2Inside = Rules.inBounds(nr, c, size);
      if ((c1Inside && snake.has(r * size + nc)) || (c2Inside && snake.has(nr * size + c))) continue;
      const c1Confirmed = !c1Inside || userMarked.has(r * size + nc);
      const c2Confirmed = !c2Inside || userMarked.has(nr * size + c);
      if (c1Confirmed && c2Confirmed) {
        return 'A snake cell sits diagonally and both possible turn-corner cells are already marked empty — filling this cell would create an illegal diagonal contact.';
      }
    }
    return null;
  }

  function whyCantBeFilled(puzzle, snake, userMarked, r, c) {
    const connReason = checkOverConnection(puzzle, snake, r, c);
    if (connReason) return connReason;
    if (puzzle.noTouch === false) return null;
    return check2x2Block(puzzle.size, snake, r, c) || checkDiagonalTrap(puzzle, snake, userMarked, r, c);
  }

  // --- conflicts (impossible state) --------------------------------

  function checkLineOverfill(puzzle, cells, clue, axisLabel, snake, hints) {
    const { size } = puzzle;
    const filled = cells.filter(([r, c]) => snake.has(r * size + c));
    if (filled.length <= clue) return;
    const reason = `${axisLabel} already has ${filled.length} filled cells but the clue says only ${clue} can be filled — one of these is wrong.`;
    for (const [r, c] of filled) {
      if (!isEndpoint(puzzle, r, c)) hints.push({ r, c, action: 'conflict', reason });
    }
  }

  function checkLineOvermark(cells, clue, axisLabel, cellState, hints) {
    let filled = 0, open = 0;
    for (const [r, c] of cells) {
      const s = cellState(r, c);
      if (s === 'fill') filled++;
      else if (s === 'open') open++;
    }
    const need = clue - filled;
    if (need <= open) return;
    const reason = `${axisLabel} needs ${PuzzleShell.plural(need, 'more filled cell')} but only ${PuzzleShell.plural(open, 'cell')} ${open === 1 ? 'is' : 'are'} still undecided — you have marked too many cells in this line.`;
    for (const [r, c] of cells) {
      if (cellState(r, c) === 'mark') hints.push({ r, c, action: 'conflict', reason });
    }
  }

  function findLineConflicts(puzzle, snake, cellState) {
    const { size, rowClues, colClues } = puzzle;
    const hints = [];
    for (let r = 0; r < size; r++) {
      const cells = Array.from({ length: size }, (_, c) => [r, c]);
      checkLineOverfill(puzzle, cells, rowClues[r], `Row ${r + 1}`, snake, hints);
      checkLineOvermark(cells, rowClues[r], `Row ${r + 1}`, cellState, hints);
    }
    for (let c = 0; c < size; c++) {
      const cells = Array.from({ length: size }, (_, r) => [r, c]);
      checkLineOverfill(puzzle, cells, colClues[c], `Column ${c + 1}`, snake, hints);
      checkLineOvermark(cells, colClues[c], `Column ${c + 1}`, cellState, hints);
    }
    return hints;
  }

  function findDegreeConflicts(puzzle, snake) {
    const { size } = puzzle;
    const hints = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!snake.has(r * size + c)) continue;
        const ep = isEndpoint(puzzle, r, c);
        const max = ep ? 1 : 2;
        const n = countNeighborDegrees(r, c, size, snake);
        if (n > max) {
          const which = ep ? endName(puzzle, r, c) : 'body';
          const reason = ep
            ? `The ${which} can have at most 1 filled neighbour (it's an endpoint of the snake), but this cell has ${n}.`
            : `Each snake body cell can have at most 2 filled neighbours, but this cell has ${n}.`;
          hints.push({ r, c, action: 'conflict', reason });
        }
      }
    }
    return hints;
  }

  function findBlockConflicts(puzzle, snake) {
    const { size } = puzzle;
    const hints = [];
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const cells = [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]];
        if (cells.every(([rr, cc]) => snake.has(rr * size + cc))) {
          const reason = 'These four cells form a 2×2 block of snake cells. A snake never folds that tightly — at least one of them must not be part of the snake.';
          for (const [rr, cc] of cells) {
            if (!isEndpoint(puzzle, rr, cc)) hints.push({ r: rr, c: cc, action: 'conflict', reason });
          }
        }
      }
    }
    return hints;
  }

  function checkDiagPair(ctx, [r1, c1], [r2, c2], [sr1, sc1], [sr2, sc2]) {
    const { puzzle, snake, userMarked, hints } = ctx;
    const { size } = puzzle;
    const k1 = r1 * size + c1, k2 = r2 * size + c2;
    if (!snake.has(k1) || !snake.has(k2)) return;
    if (snake.has(sr1 * size + sc1) || snake.has(sr2 * size + sc2)) return;
    if (!userMarked.has(sr1 * size + sc1) || !userMarked.has(sr2 * size + sc2)) return;
    const reason = 'These two cells touch diagonally and both possible turn-corner cells between them are marked empty — so the snake would touch itself diagonally somewhere other than a turn corner, which the rules forbid.';
    if (!isEndpoint(puzzle, r1, c1)) hints.push({ r: r1, c: c1, action: 'conflict', reason });
    if (!isEndpoint(puzzle, r2, c2)) hints.push({ r: r2, c: c2, action: 'conflict', reason });
  }

  function findDiagConflicts(puzzle, snake, userMarked) {
    const { size } = puzzle;
    const hints = [];
    const ctx = { puzzle, snake, userMarked, hints };
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        checkDiagPair(ctx, [r, c], [r + 1, c + 1], [r, c + 1], [r + 1, c]);
        checkDiagPair(ctx, [r, c + 1], [r + 1, c], [r, c], [r + 1, c + 1]);
      }
    }
    return hints;
  }

  function findConflicts(puzzle, snake, userMarked, cellState) {
    const hints = [
      ...findLineConflicts(puzzle, snake, cellState),
      ...findDegreeConflicts(puzzle, snake),
    ];
    if (puzzle.noTouch !== false) {
      hints.push(...findBlockConflicts(puzzle, snake), ...findDiagConflicts(puzzle, snake, userMarked));
    }
    return hints;
  }

  // For each snake cell whose current degree is below its allowed max,
  // count the open neighbours that COULD still legally become snake.
  // If exactly (max - degree) such candidates remain, every one of them
  // must be filled — the snake has no other way to satisfy the cell.
  function checkCellForcedExtension(puzzle, snake, userMarked, cellState, r, c) {
    const { size } = puzzle;
    const ep = isEndpoint(puzzle, r, c);
    const maxDeg = ep ? 1 : 2;
    const deg = countNeighborDegrees(r, c, size, snake);
    const need = maxDeg - deg;
    if (need <= 0) return [];

    const candidates = [];
    for (const [dr, dc] of Rules.ORTHO) {
      const nr = r + dr, nc = c + dc;
      if (!Rules.inBounds(nr, nc, size) || cellState(nr, nc) !== 'open') continue;
      if (whyCantBeFilled(puzzle, snake, userMarked, nr, nc)) continue;
      candidates.push([nr, nc]);
    }
    if (candidates.length !== need) return [];
    const which = ep ? endName(puzzle, r, c) : `the filled cell at row ${r + 1}, column ${c + 1}`;
    const reason = `${ep ? 'The ' + which : which.charAt(0).toUpperCase() + which.slice(1)} needs ${PuzzleShell.plural(need, 'more snake connection')}, and only ${candidates.length} legal neighbour${candidates.length === 1 ? '' : 's'} remain${candidates.length === 1 ? 's' : ''} — so this cell must continue the snake.`;
    return candidates.map(([nr, nc]) => ({ r: nr, c: nc, action: 'fill', reason }));
  }

  function scanForcedExtension(puzzle, snake, userMarked, cellState) {
    const { size } = puzzle;
    const hints = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!snake.has(r * size + c)) continue;
        hints.push(...checkCellForcedExtension(puzzle, snake, userMarked, cellState, r, c));
      }
    }
    return hints;
  }

  function testCellElimination(puzzle, snake, userMarked, r, c, k) {
    // Hypothesis A: this cell is filled.
    const snakeA = new Set(snake); snakeA.add(k);
    const propA = propagateStructural(puzzle, snakeA, userMarked);
    if (propA.conflict) {
      return { r, c, action: 'mark', reason: describeTrace(puzzle, r, c, 'filled', propA, 'mark') };
    }
    // Hypothesis B: this cell is marked empty.
    const markedB = new Set(userMarked); markedB.add(k);
    const propB = propagateStructural(puzzle, snake, markedB);
    if (propB.conflict) {
      return { r, c, action: 'fill', reason: describeTrace(puzzle, r, c, 'empty', propB, 'fill') };
    }
    // Depth-2:
    const deepFilled = depth2Contradiction(puzzle, propA);
    if (deepFilled) {
      return { r, c, action: 'mark', reason: describeDepth2(puzzle, r, c, 'filled', propA, deepFilled, 'mark') };
    }
    const deepEmpty = depth2Contradiction(puzzle, propB);
    if (deepEmpty) {
      return { r, c, action: 'fill', reason: describeDepth2(puzzle, r, c, 'empty', propB, deepEmpty, 'fill') };
    }
    // Final fallback (rarely hit).
    const ifFilled = Solver.solve(puzzle, 1, { mustInclude: snakeA, mustExclude: userMarked });
    const ifEmpty = Solver.solve(puzzle, 1, { mustInclude: snake, mustExclude: markedB });
    if (ifFilled.length === 0 && ifEmpty.length > 0) {
      return { r, c, action: 'mark', reason: describeBestEffort(puzzle, r, c, 'filled', propA, 'mark') };
    }
    if (ifEmpty.length === 0 && ifFilled.length > 0) {
      return { r, c, action: 'fill', reason: describeBestEffort(puzzle, r, c, 'empty', propB, 'fill') };
    }
    return null;
  }

  function findOneForcedByElimination(puzzle, snake, userMarked) {
    const { size } = puzzle;
    const order = sweepOrder(puzzle);
    for (const [r, c] of order) {
      const k = r * size + c;
      if (isEndpoint(puzzle, r, c) || snake.has(k) || userMarked.has(k)) continue;
      const res = testCellElimination(puzzle, snake, userMarked, r, c, k);
      if (res) return res;
    }
    return null;
  }

  // Try to expose a contradiction at depth 2: take a rule-consistent
  // propagated state and look for any single undecided cell whose two
  // possible values both lead to a structural conflict. If such a cell
  // exists, the parent state itself is contradictory.
  function depth2Contradiction(puzzle, parentProp) {
    const { size } = puzzle;
    const candidates = pickDepth2BranchCells(puzzle, parentProp);
    for (const [r, c] of candidates) {
      const k = r * size + c;
      const sn = new Set(parentProp.snake); sn.add(k);
      const branchFill = propagateStructural(puzzle, sn, parentProp.marked);
      if (!branchFill.conflict) continue;
      const mk = new Set(parentProp.marked); mk.add(k);
      const branchEmpty = propagateStructural(puzzle, parentProp.snake, mk);
      if (!branchEmpty.conflict) continue;
      return { branchCell: [r, c], branchFill, branchEmpty };
    }
    return null;
  }

  function addCellNeighbors(puzzle, prop, r, c, seen, out) {
    const { size } = puzzle;
    for (const [dr, dc] of Rules.ORTHO) {
      const nr = r + dr, nc = c + dc;
      if (!Rules.inBounds(nr, nc, size)) continue;
      const nk = nr * size + nc;
      if (prop.snake.has(nk) || prop.marked.has(nk) || isEndpoint(puzzle, nr, nc) || seen.has(nk)) continue;
      seen.add(nk);
      out.push([nr, nc]);
    }
  }

  function collectAdjacentBranchCells(puzzle, prop, seen, out) {
    const { size } = puzzle;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (prop.snake.has(r * size + c)) addCellNeighbors(puzzle, prop, r, c, seen, out);
      }
    }
  }

  function countLineCells(prop, isRow, idx, size) {
    let filled = 0, open = 0;
    for (let i = 0; i < size; i++) {
      const k = isRow ? idx * size + i : i * size + idx;
      if (prop.snake.has(k)) filled++;
      else if (!prop.marked.has(k)) open++;
    }
    return { filled, open };
  }

  function collectTightLineBranchCells(puzzle, prop, isRow, seen, out) {
    const { size, rowClues, colClues } = puzzle;
    const clues = isRow ? rowClues : colClues;
    for (let idx = 0; idx < size; idx++) {
      const { filled, open } = countLineCells(prop, isRow, idx, size);
      if (open === 0) continue;
      const need = clues[idx] - filled;
      if (need <= 0 || open - need > 2) continue;
      for (let i = 0; i < size; i++) {
        const r = isRow ? idx : i, c = isRow ? i : idx;
        const k = r * size + c;
        if (prop.snake.has(k) || prop.marked.has(k) || isEndpoint(puzzle, r, c) || seen.has(k)) continue;
        seen.add(k);
        out.push([r, c]);
      }
    }
  }

  function pickDepth2BranchCells(puzzle, prop) {
    const seen = new Set();
    const out = [];
    collectAdjacentBranchCells(puzzle, prop, seen, out);
    collectTightLineBranchCells(puzzle, prop, true, seen, out);
    collectTightLineBranchCells(puzzle, prop, false, seen, out);
    return out.slice(0, 32);
  }

  function applyStructuralHint(h, size, snake, marked, trace) {
    const k = h.r * size + h.c;
    if (h.action === 'fill') {
      if (marked.has(k)) {
        return {
          conflict: { reason: `the rules try to fill (row ${h.r + 1}, col ${h.c + 1}) but it's already marked empty` },
        };
      }
      if (!snake.has(k)) {
        snake.add(k);
        trace.push({ r: h.r, c: h.c, action: 'fill', label: shortLabel(h) });
      }
    } else if (h.action === 'mark') {
      if (snake.has(k)) {
        return {
          conflict: { reason: `the rules try to mark (row ${h.r + 1}, col ${h.c + 1}) empty but it's already filled` },
        };
      }
      if (!marked.has(k)) {
        marked.add(k);
        trace.push({ r: h.r, c: h.c, action: 'mark', label: shortLabel(h) });
      }
    }
    return null;
  }

  function propagateStructural(puzzle, startSnake, startMarked) {
    const { size } = puzzle;
    const snake = new Set(startSnake);
    const marked = new Set(startMarked);
    const trace = [];

    for (let iter = 0; iter < 64; iter++) {
      const beforeSize = snake.size + marked.size;
      const cellState = (r, c) => {
        const k = r * size + c;
        if (snake.has(k)) return 'fill';
        if (marked.has(k)) return 'mark';
        return 'open';
      };

      const conflicts = findConflicts(puzzle, snake, marked, cellState);
      if (conflicts.length > 0) return { snake, marked, trace, conflict: conflicts[0] };

      const newHints = [
        ...scanLines(puzzle, cellState),
        ...scanCellsCantBeFilled(puzzle, snake, marked, cellState),
        ...scanForcedExtension(puzzle, snake, marked, cellState),
      ];

      for (const h of newHints) {
        const err = applyStructuralHint(h, size, snake, marked, trace);
        if (err) return { snake, marked, trace, ...err };
      }
      if (snake.size + marked.size === beforeSize) break;
    }
    return { snake, marked, trace, conflict: null };
  }

  // Compress a full reason string down to a brief clause we can chain
  // inside a multi-step narrative.
  function shortLabel(hint) {
    const r = hint.reason;
    if (/can't leave this row|can't leave this column/.test(r)) return 'the snake can\'t leave the line through this cell';
    if (/already contains its \d+ required/.test(r)) return 'its row or column is already saturated';
    if (/needs \d+ more filled/.test(r)) return 'every undecided cell in its row or column must be filled';
    if (/already has its \d+ allowed connection/.test(r)) return 'an adjacent snake cell is already at its max connections';
    if (/2×2 block/.test(r)) return 'filling it would close a 2×2 block';
    if (/diagonally and both possible turn-corner/.test(r)) return 'it would create a diagonal touch with no valid bend corner';
    if (/needs \d+ more snake connection/.test(r)) return 'the snake has only one legal way to extend here';
    return 'a structural rule forces it';
  }

  function describeDepth2(puzzle, r, c, assumed, parentProp, deep, conclusion) {
    const hypothesis = assumed === 'filled' ? 'filled' : 'marked empty';
    const ends = conclusion === 'mark' ? 'empty' : 'part of the snake';
    const [br, bc] = deep.branchCell;
    const parts = [];
    parts.push(`Suppose this cell were ${hypothesis}.`);
    const headSteps = parentProp.trace.slice(0, 3);
    if (headSteps.length) {
      parts.push('The obvious rules first force:');
      for (const s of headSteps) {
        const verb = s.action === 'fill' ? 'gets filled' : 'gets X-marked';
        parts.push(`(row ${s.r + 1}, col ${s.c + 1}) ${verb};`);
      }
      if (parentProp.trace.length > headSteps.length) parts.push('… plus a few more;');
    }
    parts.push(`Now look at cell (row ${br + 1}, col ${bc + 1}) — it's still undecided, but every choice breaks the rules:`, `• if you fill it, ${conflictPhrase(deep.branchFill.conflict)};`, `• if you mark it empty, ${conflictPhrase(deep.branchEmpty.conflict)}.`, `Both options for (${br + 1}, ${bc + 1}) fail — so the original assumption is wrong, and this cell must be ${ends}.`);
    return parts.join(' ');
  }

  function describeBestEffort(puzzle, r, c, assumed, prop, conclusion) {
    const hypothesis = assumed === 'filled' ? 'filled' : 'marked empty';
    const ends = conclusion === 'mark' ? 'empty' : 'part of the snake';
    const steps = prop.trace.slice(0, 6);
    const parts = [];
    parts.push(`Suppose this cell were ${hypothesis}.`);
    if (steps.length) {
      parts.push('The obvious rules force:');
      for (const s of steps) {
        const verb = s.action === 'fill' ? 'gets filled' : 'gets X-marked';
        parts.push(`(row ${s.r + 1}, col ${s.c + 1}) ${verb};`);
      }
      if (prop.trace.length > steps.length) parts.push(`… and ${prop.trace.length - steps.length} more.`);
    } else {
      parts.push('No single rule fires from this state immediately.');
    }
    parts.push(`From here no further single-step deduction settles every cell, but the global combination of clues and the touch rule has no completion that keeps this cell ${hypothesis}. So it must be ${ends}.`);
    return parts.join(' ');
  }

  function describeTrace(puzzle, r, c, assumed, prop, conclusion) {
    const hypothesis = assumed === 'filled' ? 'filled' : 'marked empty';
    const ends = conclusion === 'mark' ? 'empty' : 'part of the snake';
    const steps = prop.trace.slice(0, 6);
    const parts = [];
    parts.push(`Suppose this cell were ${hypothesis}.`);
    if (steps.length === 0) {
      // Conflict triggered immediately by the assumption itself.
      parts.push(`Right away ${conflictPhrase(prop.conflict)}, so this cell must be ${ends}.`);
      return parts.join(' ');
    }
    parts.push('Walking through the simple rules:');
    for (const s of steps) {
      const verb = s.action === 'fill' ? 'gets filled' : 'gets X-marked';
      parts.push(`(row ${s.r + 1}, col ${s.c + 1}) ${verb} because ${s.label};`);
    }
    if (prop.trace.length > steps.length) {
      parts.push(`… and a few more like that;`);
    }
    parts.push(`but then ${conflictPhrase(prop.conflict)}. So this cell must be ${ends}.`);
    return parts.join(' ');
  }

  function conflictPhrase(conflict) {
    const r = conflict.reason;
    const overfill = r.match(/(Row|Column) (\d+) already has (\d+) filled cells but the clue says only (\d+)/);
    if (overfill) {
      return `${overfill[1]} ${overfill[2]} ends up with ${overfill[3]} filled cells when its clue only allows ${overfill[4]}`;
    }
    const overmark = r.match(/(Row|Column) (\d+) needs (\d+) more filled cell.* but only (\d+)/);
    if (overmark) {
      return `${overmark[1]} ${overmark[2]} would need ${overmark[3]} more filled cells but only ${overmark[4]} would remain undecided`;
    }
    const degree = r.match(/cell can have at most (\d+) filled neighbours, but this cell has (\d+)/);
    if (degree) {
      return `a snake cell ends up with ${degree[2]} connected neighbours, when the maximum is ${degree[1]}`;
    }
    if (/head can have at most 1 filled neighbour/.test(r)) {
      return 'the head ends up with more than 1 connected neighbour';
    }
    if (/tail can have at most 1 filled neighbour/.test(r)) {
      return 'the tail ends up with more than 1 connected neighbour';
    }
    if (/2×2 block of snake cells/.test(r)) {
      return 'a 2×2 block of snake cells forms';
    }
    if (/diagonally and both possible turn-corner/.test(r)) {
      return 'two snake cells touch diagonally with both corner cells already known empty';
    }
    return 'a contradiction with one of the rules appears';
  }

  // Deterministic enumeration that prefers cells near either endpoint,
  // so the hint typically lands where the player can manually replay the
  // hypothesis test.
  function sweepOrder(puzzle) {
    const { size, head, tail } = puzzle;
    const cells = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) cells.push([r, c]);
    }
    function dist(rr, cc) {
      return Math.min(
        Math.abs(rr - head[0]) + Math.abs(cc - head[1]),
        Math.abs(rr - tail[0]) + Math.abs(cc - tail[1]),
      );
    }
    cells.sort((a, b) => dist(a[0], a[1]) - dist(b[0], b[1]));
    return cells;
  }

  return { find, findAll };
})();
