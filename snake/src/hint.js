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
        const reason = `${axisLabel} already contains ${clue} filled cell${clue === 1 ? '' : 's'}, so no other cell in it can belong to the snake.`;
        for (const [r, c] of openCells) hints.push({ r, c, action: 'mark', reason });
      } else if (need === open) {
        const reason = `${axisLabel} needs ${need} more filled cell${need === 1 ? '' : 's'}, and exactly ${open} cell${open === 1 ? '' : 's'} ${open === 1 ? 'is' : 'are'} still undecided — so every undecided cell in it must be filled.`;
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

  function whyCantBeFilled(puzzle, snake, userMarked, r, c) {
    const { size, noTouch } = puzzle;

    // Over-connection: a snake cell adjacent to (r, c) already has its
    // maximum number of snake neighbours.
    for (const [dr, dc] of Rules.ORTHO) {
      const nr = r + dr, nc = c + dc;
      if (!Rules.inBounds(nr, nc, size)) continue;
      if (!snake.has(nr * size + nc)) continue;
      const maxDeg = isEndpoint(puzzle, nr, nc) ? 1 : 2;
      let deg = 0;
      for (const [dr2, dc2] of Rules.ORTHO) {
        const ar = nr + dr2, ac = nc + dc2;
        if (!Rules.inBounds(ar, ac, size)) continue;
        if (snake.has(ar * size + ac)) deg++;
      }
      if (deg >= maxDeg) {
        const which = isEndpoint(puzzle, nr, nc)
          ? (nr === puzzle.head[0] && nc === puzzle.head[1] ? 'The head' : 'The tail')
          : 'The adjacent filled cell';
        return `${which} already has its ${maxDeg} allowed connection${maxDeg === 1 ? '' : 's'} — filling this cell would over-connect it.`;
      }
    }

    if (noTouch === false) return null;

    // 2×2 block: three of the other corners of some surrounding 2×2
    // are already snake; filling this cell closes a forbidden block.
    const groups = [
      [[0, 1], [1, 0], [1, 1]],
      [[0, -1], [1, 0], [1, -1]],
      [[0, 1], [-1, 0], [-1, 1]],
      [[0, -1], [-1, 0], [-1, -1]],
    ];
    for (const g of groups) {
      let ok = true;
      for (const [dr, dc] of g) {
        if (!Rules.inBounds(r + dr, c + dc, size) || !snake.has((r + dr) * size + (c + dc))) { ok = false; break; }
      }
      if (ok) return 'Filling this cell would create a 2×2 block of snake cells, which the no-touch rule forbids.';
    }

    // Diagonal-touch trap: a snake cell sits diagonally and both shared
    // corner cells are confirmed empty (player-marked or out of bounds),
    // so no turn corner can ever form between them.
    for (const [dr, dc] of Rules.DIAG) {
      const nr = r + dr, nc = c + dc;
      if (!Rules.inBounds(nr, nc, size)) continue;
      if (!snake.has(nr * size + nc)) continue;
      const corner1Inside = Rules.inBounds(r, nc, size);
      const corner2Inside = Rules.inBounds(nr, c, size);
      const corner1Snake = corner1Inside && snake.has(r * size + nc);
      const corner2Snake = corner2Inside && snake.has(nr * size + c);
      if (corner1Snake || corner2Snake) continue; // a valid bend corner already exists
      const corner1Confirmed = !corner1Inside || userMarked.has(r * size + nc);
      const corner2Confirmed = !corner2Inside || userMarked.has(nr * size + c);
      if (corner1Confirmed && corner2Confirmed) {
        return 'A snake cell sits diagonally and both possible turn-corner cells are already marked empty — filling this cell would create an illegal diagonal contact.';
      }
    }

    return null;
  }

  // --- conflicts (impossible state) --------------------------------

  function findConflicts(puzzle, snake, userMarked, cellState) {
    const { size, rowClues, colClues, noTouch } = puzzle;
    const hints = [];

    // Row / column overfills: filled cells in a row exceed its clue.
    function overfillLine(cells, clue, axisLabel) {
      const filled = cells.filter(([r, c]) => snake.has(r * size + c));
      if (filled.length <= clue) return;
      const reason = `${axisLabel} already has ${filled.length} filled cells but the clue says only ${clue} can be filled — one of these is wrong.`;
      for (const [r, c] of filled) {
        // Don't flag endpoints; the player can't unfill those.
        if (isEndpoint(puzzle, r, c)) continue;
        hints.push({ r, c, action: 'conflict', reason });
      }
    }

    // Row / column over-marks: the player has ruled out too many cells.
    function overmarkLine(cells, clue, axisLabel) {
      let filled = 0, open = 0;
      for (const [r, c] of cells) {
        const s = cellState(r, c);
        if (s === 'fill') filled++;
        else if (s === 'open') open++;
      }
      const need = clue - filled;
      if (need <= open) return;
      const reason = `${axisLabel} needs ${need} more filled cell${need === 1 ? '' : 's'} but only ${open} cell${open === 1 ? '' : 's'} ${open === 1 ? 'is' : 'are'} still undecided — you have marked too many cells in this line.`;
      for (const [r, c] of cells) {
        if (cellState(r, c) === 'mark') {
          hints.push({ r, c, action: 'conflict', reason });
        }
      }
    }

    for (let r = 0; r < size; r++) {
      const cells = [];
      for (let c = 0; c < size; c++) cells.push([r, c]);
      overfillLine(cells, rowClues[r], `Row ${r + 1}`);
      overmarkLine(cells, rowClues[r], `Row ${r + 1}`);
    }
    for (let c = 0; c < size; c++) {
      const cells = [];
      for (let r = 0; r < size; r++) cells.push([r, c]);
      overfillLine(cells, colClues[c], `Column ${c + 1}`);
      overmarkLine(cells, colClues[c], `Column ${c + 1}`);
    }

    // Degree conflicts: a snake-body cell has at most 2 orthogonal
    // snake neighbours; head and tail at most 1.
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!snake.has(r * size + c)) continue;
        let n = 0;
        for (const [dr, dc] of Rules.ORTHO) {
          const nr = r + dr, nc = c + dc;
          if (!Rules.inBounds(nr, nc, size)) continue;
          if (snake.has(nr * size + nc)) n++;
        }
        const ep = isEndpoint(puzzle, r, c);
        const max = ep ? 1 : 2;
        if (n > max) {
          const which = ep ? (r === puzzle.head[0] && c === puzzle.head[1] ? 'head' : 'tail') : 'body';
          const reason = ep
            ? `The ${which} can have at most 1 filled neighbour (it's an endpoint of the snake), but this cell has ${n}.`
            : `Each snake body cell can have at most 2 filled neighbours, but this cell has ${n}.`;
          hints.push({ r, c, action: 'conflict', reason });
        }
      }
    }

    // No 2x2 block of snake cells.
    if (noTouch !== false) {
      for (let r = 0; r < size - 1; r++) {
        for (let c = 0; c < size - 1; c++) {
          const cells = [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]];
          if (cells.every(([rr, cc]) => snake.has(rr * size + cc))) {
            const reason = 'These four cells form a 2×2 block of snake cells. A snake never folds that tightly — at least one of them must not be part of the snake.';
            for (const [rr, cc] of cells) {
              if (!isEndpoint(puzzle, rr, cc)) {
                hints.push({ r: rr, c: cc, action: 'conflict', reason });
              }
            }
          }
        }
      }

      // Diagonal pair of snake cells whose two shared orth neighbours
      // are both empty/marked. Such a pair can only be legal if it's
      // the two ends of a single bend (the bend cell would be one of
      // the shared neighbours and itself a snake cell); here neither is,
      // so the diagonal contact is illegal.
      for (let r = 0; r < size - 1; r++) {
        for (let c = 0; c < size - 1; c++) {
          checkDiagPair(r, c, r + 1, c + 1, r, c + 1, r + 1, c);
          checkDiagPair(r, c + 1, r + 1, c, r, c, r + 1, c + 1);
        }
      }

      function checkDiagPair(r1, c1, r2, c2, sr1, sc1, sr2, sc2) {
        const k1 = r1 * size + c1, k2 = r2 * size + c2;
        if (!snake.has(k1) || !snake.has(k2)) return;
        const s1 = snake.has(sr1 * size + sc1);
        const s2 = snake.has(sr2 * size + sc2);
        // Bend case: one of the shared orth neighbours is also snake,
        // forming the corner of a 90° turn. That's legal.
        if (s1 || s2) return;
        // Only a conflict if both corner cells are CONFIRMED empty
        // (marked by the player). If they're still undecided the bend
        // could yet be filled.
        const c1Marked = userMarked.has(sr1 * size + sc1);
        const c2Marked = userMarked.has(sr2 * size + sc2);
        if (!c1Marked || !c2Marked) return;
        const reason = 'These two cells touch diagonally and both possible turn-corner cells between them are marked empty — so the snake would touch itself diagonally somewhere other than a turn corner, which the rules forbid.';
        if (!isEndpoint(puzzle, r1, c1)) hints.push({ r: r1, c: c1, action: 'conflict', reason });
        if (!isEndpoint(puzzle, r2, c2)) hints.push({ r: r2, c: c2, action: 'conflict', reason });
      }
    }

    return hints;
  }

  // For each snake cell whose current degree is below its allowed max,
  // count the open neighbours that COULD still legally become snake.
  // If exactly (max - degree) such candidates remain, every one of them
  // must be filled — the snake has no other way to satisfy the cell.
  function scanForcedExtension(puzzle, snake, userMarked, cellState) {
    const { size } = puzzle;
    const hints = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!snake.has(r * size + c)) continue;
        const ep = isEndpoint(puzzle, r, c);
        const maxDeg = ep ? 1 : 2;

        let deg = 0;
        for (const [dr, dc] of Rules.ORTHO) {
          const nr = r + dr, nc = c + dc;
          if (!Rules.inBounds(nr, nc, size)) continue;
          if (snake.has(nr * size + nc)) deg++;
        }
        const need = maxDeg - deg;
        if (need <= 0) continue;

        const candidates = [];
        for (const [dr, dc] of Rules.ORTHO) {
          const nr = r + dr, nc = c + dc;
          if (!Rules.inBounds(nr, nc, size)) continue;
          if (cellState(nr, nc) !== 'open') continue;
          if (whyCantBeFilled(puzzle, snake, userMarked, nr, nc)) continue;
          candidates.push([nr, nc]);
        }
        if (candidates.length !== need) continue;
        const which = ep
          ? (r === puzzle.head[0] && c === puzzle.head[1] ? 'head' : 'tail')
          : `the filled cell at row ${r + 1}, column ${c + 1}`;
        const reason = `${ep ? 'The ' + which : which.charAt(0).toUpperCase() + which.slice(1)} needs ${need} more snake connection${need === 1 ? '' : 's'}, and only ${candidates.length} legal neighbour${candidates.length === 1 ? '' : 's'} remain${candidates.length === 1 ? 's' : ''} — so this cell must continue the snake.`;
        for (const [nr, nc] of candidates) {
          hints.push({ r: nr, c: nc, action: 'fill', reason });
        }
      }
    }
    return hints;
  }

  // Last-resort: when no structural rule fires on the current board,
  // walk open cells in a deterministic order. For each, try the two
  // hypotheses (fill / mark empty), propagate using the SAME structural
  // rules to a fixpoint, and check whether the propagation hits a
  // contradiction. If it does, the opposite action is forced — and we
  // can hand the player the chain of intermediate deductions that led
  // to the contradiction. That's the concrete explanation.
  function findOneForcedByElimination(puzzle, snake, userMarked) {
    const { size } = puzzle;
    const order = sweepOrder(puzzle);

    for (const [r, c] of order) {
      const k = r * size + c;
      if (isEndpoint(puzzle, r, c)) continue;
      if (snake.has(k) || userMarked.has(k)) continue;

      // Hypothesis A: this cell is filled.
      const snakeA = new Set(snake); snakeA.add(k);
      const propA = propagateStructural(puzzle, snakeA, userMarked);
      if (propA.conflict) {
        return { r, c, action: 'mark',
          reason: describeTrace(puzzle, r, c, 'filled', propA, 'mark') };
      }

      // Hypothesis B: this cell is marked empty.
      const markedB = new Set(userMarked); markedB.add(k);
      const propB = propagateStructural(puzzle, snake, markedB);
      if (propB.conflict) {
        return { r, c, action: 'fill',
          reason: describeTrace(puzzle, r, c, 'empty', propB, 'fill') };
      }

      // Depth-2: each hypothesis is rule-consistent on its own, but
      // maybe one of them collapses when we tentatively try the two
      // possible values of an *adjacent* still-undecided cell.
      const deepFilled = depth2Contradiction(puzzle, propA);
      if (deepFilled) {
        return { r, c, action: 'mark',
          reason: describeDepth2(puzzle, r, c, 'filled', propA, deepFilled, 'mark') };
      }
      const deepEmpty = depth2Contradiction(puzzle, propB);
      if (deepEmpty) {
        return { r, c, action: 'fill',
          reason: describeDepth2(puzzle, r, c, 'empty', propB, deepEmpty, 'fill') };
      }

      // Final fallback (rarely hit). Use the solver to confirm the cell
      // is forced; if so, give the best concrete explanation we have:
      // the propagation chain we managed to derive so far.
      const ifFilled = Solver.solve(puzzle, 1, { mustInclude: snakeA, mustExclude: userMarked });
      const ifEmpty = Solver.solve(puzzle, 1, { mustInclude: snake, mustExclude: markedB });
      if (ifFilled.length === 0 && ifEmpty.length > 0) {
        return { r, c, action: 'mark',
          reason: describeBestEffort(puzzle, r, c, 'filled', propA, 'mark') };
      }
      if (ifEmpty.length === 0 && ifFilled.length > 0) {
        return { r, c, action: 'fill',
          reason: describeBestEffort(puzzle, r, c, 'empty', propB, 'fill') };
      }
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

  // Pick the open cells most likely to crack the puzzle when branched.
  // Heuristic: adjacent to a snake cell with degree < max (so each
  // value materially changes the situation), capped to keep this fast.
  function pickDepth2BranchCells(puzzle, prop) {
    const { size, rowClues, colClues } = puzzle;
    const seen = new Set();
    const out = [];

    // Tier 1: open cells orthogonally adjacent to a snake cell — these
    // directly extend or block the snake's path.
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const k = r * size + c;
        if (!prop.snake.has(k)) continue;
        for (const [dr, dc] of Rules.ORTHO) {
          const nr = r + dr, nc = c + dc;
          if (!Rules.inBounds(nr, nc, size)) continue;
          const nk = nr * size + nc;
          if (prop.snake.has(nk) || prop.marked.has(nk)) continue;
          if (isEndpoint(puzzle, nr, nc)) continue;
          if (seen.has(nk)) continue;
          seen.add(nk);
          out.push([nr, nc]);
        }
      }
    }

    // Tier 2: open cells in tight rows or columns (clue ≤ 2 or where
    // only a few cells remain undecided). Picking these tends to
    // collapse the puzzle quickly when branched.
    function lineHas(idx, isRow) {
      let filled = 0, open = 0;
      for (let i = 0; i < size; i++) {
        const k = isRow ? idx * size + i : i * size + idx;
        if (prop.snake.has(k)) filled++;
        else if (!prop.marked.has(k)) open++;
      }
      return { filled, open };
    }
    for (let r = 0; r < size; r++) {
      const info = lineHas(r, true);
      if (info.open === 0) continue;
      const need = rowClues[r] - info.filled;
      if (need > 0 && info.open - need <= 2) {
        for (let c = 0; c < size; c++) {
          const k = r * size + c;
          if (prop.snake.has(k) || prop.marked.has(k)) continue;
          if (isEndpoint(puzzle, r, c)) continue;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push([r, c]);
        }
      }
    }
    for (let c = 0; c < size; c++) {
      const info = lineHas(c, false);
      if (info.open === 0) continue;
      const need = colClues[c] - info.filled;
      if (need > 0 && info.open - need <= 2) {
        for (let r = 0; r < size; r++) {
          const k = r * size + c;
          if (prop.snake.has(k) || prop.marked.has(k)) continue;
          if (isEndpoint(puzzle, r, c)) continue;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push([r, c]);
        }
      }
    }
    return out.slice(0, 32);
  }

  // Apply every structural rule in a loop until either nothing new can
  // be deduced or a conflict shows up. Returns the final state plus a
  // trace of the (cell, action, short label) deductions that fired and
  // the first conflict, if any.
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
      if (conflicts.length > 0) {
        return { snake, marked, trace, conflict: conflicts[0] };
      }

      const newHints = [
        ...scanLines(puzzle, cellState),
        ...scanCellsCantBeFilled(puzzle, snake, marked, cellState),
        ...scanForcedExtension(puzzle, snake, marked, cellState),
      ];

      for (const h of newHints) {
        const k = h.r * size + h.c;
        if (h.action === 'fill') {
          if (marked.has(k)) {
            // Implicit contradiction: a rule wants to fill a cell the
            // player has already marked empty.
            return { snake, marked, trace, conflict: {
              reason: `the rules try to fill (row ${h.r + 1}, col ${h.c + 1}) but it's already marked empty`,
            }};
          }
          if (snake.has(k)) continue;
          snake.add(k);
          trace.push({ r: h.r, c: h.c, action: 'fill', label: shortLabel(h) });
        } else if (h.action === 'mark') {
          if (snake.has(k)) {
            return { snake, marked, trace, conflict: {
              reason: `the rules try to mark (row ${h.r + 1}, col ${h.c + 1}) empty but it's already filled`,
            }};
          }
          if (marked.has(k)) continue;
          marked.add(k);
          trace.push({ r: h.r, c: h.c, action: 'mark', label: shortLabel(h) });
        }
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
    parts.push(`Now look at cell (row ${br + 1}, col ${bc + 1}) — it's still undecided, but every choice breaks the rules:`);
    parts.push(`• if you fill it, ${conflictPhrase(deep.branchFill.conflict)};`);
    parts.push(`• if you mark it empty, ${conflictPhrase(deep.branchEmpty.conflict)}.`);
    parts.push(`Both options for (${br + 1}, ${bc + 1}) fail — so the original assumption is wrong, and this cell must be ${ends}.`);
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
