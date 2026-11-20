// Hitori hints. Looks at the player's marks and lists simple forced
// moves, each with a short reason. Wrong marks come first.
// Exposes the global `Hint`.

const Hint = (() => {
  const { UNKNOWN, BLACK, WHITE, neighbours, peers, openConnected } = Rules;

  function cellName(k, n) {
    return `row ${Math.floor(k / n) + 1}, column ${(k % n) + 1}`;
  }

  function findAll(p, state) {
    const { n, nums, solution } = p;
    const total = n * n;
    const out = [];
    const seen = new Set();
    const add = (k, v, reason) => {
      if (seen.has(k) || state[k] !== UNKNOWN) return;
      seen.add(k);
      out.push({ k, v, reason });
    };

    // 1. Mistakes.
    for (let k = 0; k < total; k++) {
      const s = state[k];
      if (s === UNKNOWN) continue;
      if ((s === BLACK) !== (solution[k] === BLACK)) {
        out.push({ k, v: solution[k] === BLACK ? BLACK : WHITE, wrong: true,
          reason: `The cell at ${cellName(k, n)} is marked wrong.` });
        seen.add(k);
      }
    }
    if (out.length) return out;

    // 2. Next to a shaded cell.
    for (let k = 0; k < total; k++) {
      if (state[k] !== BLACK) continue;
      for (const j of neighbours(k, n)) {
        add(j, WHITE, 'Shaded cells may not touch. This cell is next to a shaded cell, so it is white.');
      }
    }
    // 3. Twin of a white cell.
    for (let k = 0; k < total; k++) {
      if (state[k] !== WHITE) continue;
      for (const j of peers(k, n)) {
        if (nums[j] === nums[k]) {
          add(j, BLACK, `A white ${nums[k]} is already in this line. This ${nums[k]} must be shaded.`);
        }
      }
    }
    // 4. Sandwich: a X a in a line makes X white.
    // 5. Pair: a a in a line shades every other a in that line.
    for (let k = 0; k < total; k++) {
      const r = Math.floor(k / n), c = k % n;
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + 2 * dr, c2 = c + 2 * dc;
        if (r2 < n && c2 < n && nums[k] === nums[r2 * n + c2]) {
          add((r + dr) * n + c + dc, WHITE,
            `This cell sits between two ${nums[k]}s. One of them is shaded, so this cell can not be shaded too.`);
        }
        const r1 = r + dr, c1 = c + dc;
        if (r1 < n && c1 < n && nums[k] === nums[r1 * n + c1]) {
          for (let i = 0; i < n; i++) {
            const j = dr ? i * n + c : r * n + i;
            if (j !== k && j !== r1 * n + c1 && nums[j] === nums[k]) {
              add(j, BLACK, `Two ${nums[k]}s sit side by side here. One of them stays white, so this other ${nums[k]} must be shaded.`);
            }
          }
        }
      }
    }
    // 6. Unique number.
    for (let k = 0; k < total; k++) {
      if (!peers(k, n).some((j) => state[j] !== BLACK && nums[j] === nums[k])) {
        add(k, WHITE, `This ${nums[k]} has no twin left in its row or column, so it stays white.`);
      }
    }
    // 7. Shading this cell would cut the white area.
    for (let k = 0; k < total; k++) {
      if (state[k] === UNKNOWN && !openConnected(state, n, k)) {
        add(k, WHITE, 'Shading this cell would cut the white cells in two. So it stays white.');
      }
    }
    if (out.length) return out;
    // 8. Look-ahead: if one choice runs into a contradiction, the other is forced.
    const nb = [], pr = [];
    for (let k = 0; k < total; k++) { nb.push(neighbours(k, n)); pr.push(peers(k, n)); }
    for (let k = 0; k < total; k++) {
      if (state[k] !== UNKNOWN) continue;
      for (const v of [BLACK, WHITE]) {
        const t = Uint8Array.from(state);
        t[k] = v;
        if (!Solver.propagate(nums, n, t, nb, pr)) {
          add(k, v === BLACK ? WHITE : BLACK, v === BLACK
            ? 'Shading this cell leads to a dead end a few steps later. So it stays white.'
            : 'Leaving this cell white leads to a dead end a few steps later. So it is shaded.');
          return out;
        }
      }
    }
    // 9. Last resort: show one shaded cell of the answer.
    for (let k = 0; k < total; k++) {
      if (state[k] === UNKNOWN && solution[k] === BLACK) { add(k, BLACK, 'No simple step is left. This cell is shaded.'); break; }
    }
    return out;
  }

  return { findAll };
})();
