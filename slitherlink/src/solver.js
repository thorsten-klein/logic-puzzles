// Slitherlink solver. Colours cells inside / outside the loop in row
// order with pruning:
//   - clue bounds: lines so far <= clue <= lines so far + open sides
//   - no 2x2 checkerboard (that would make the loop touch itself)
//   - after each row, a closed-off inside part must be the only one,
//     and an outside part must reach the border or the next row
// Exposes the global `Solver`.

const Solver = (() => {
  function solve(p, stopAt = 2, maxNodes = 300000) {
    const { R, C, clues } = p;
    const N = R * C;
    const color = new Int8Array(N).fill(-1);
    const solutions = [];
    let nodes = 0;
    const get = (r, c) => (r < 0 || c < 0 || r >= R || c >= C ? 0 : color[r * C + c]);

    function clueOk(r, c) {
      if (r < 0 || c < 0 || r >= R || c >= C) return true;
      const cl = clues[r * C + c];
      if (cl < 0) return true;
      const me = color[r * C + c];
      let diff = 0, open = 0;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const o = get(r + dr, c + dc);
        if (me < 0 || o < 0) open++;
        else if (o !== me) diff++;
      }
      return diff <= cl && diff + open >= cl;
    }

    // No 2x2 block where (r, c) is the bottom-right cell is a checkerboard.
    function noChecker(r, c) {
      if (r === 0 || c === 0) return true;
      const tl = get(r - 1, c - 1), tr = get(r - 1, c), bl = get(r, c - 1), br = get(r, c);
      return !(tl === br && tr === bl && tl !== tr);
    }

    // Checks parts after row r is complete.
    function rowCheck(r, last) {
      const seen = new Uint8Array(N);
      let insideParts = 0, closedInside = false;
      for (let k = 0; k < (r + 1) * C; k++) {
        if (seen[k]) continue;
        const col = color[k];
        const stack = [k];
        seen[k] = 1;
        let open = false;
        while (stack.length) {
          const j = stack.pop();
          const jr = Math.floor(j / C), jc = j % C;
          if (jr === r && !last) open = true;
          if (col === 0 && (jr === 0 || jc === 0 || jc === C - 1 || jr === R - 1)) open = true;
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = jr + dr, nc = jc + dc;
            if (nr < 0 || nc < 0 || nr > r || nc >= C) continue;
            const nk = nr * C + nc;
            if (!seen[nk] && color[nk] === col) { seen[nk] = 1; stack.push(nk); }
          }
        }
        if (col === 0 && !open) return false;
        if (col === 1) {
          insideParts++;
          if (!open) closedInside = true;
        }
      }
      if (closedInside) {
        if (insideParts > 1) return false;
        // No inside cells may appear later; caller enforces via flag.
        return 'closed';
      }
      return !last || insideParts === 1;
    }

    function rec(k, closed) {
      if (solutions.length >= stopAt || ++nodes > maxNodes) return;
      if (k === N) {
        solutions.push(Int8Array.from(color));
        return;
      }
      const r = Math.floor(k / C), c = k % C;
      for (const v of closed ? [0] : [0, 1]) {
        color[k] = v;
        if (clueOk(r - 1, c) && clueOk(r, c - 1) && clueOk(r, c) && noChecker(r, c)) {
          let nextClosed = closed;
          let ok = true;
          if (c === C - 1) {
            const res = rowCheck(r, r === R - 1);
            if (res === false) ok = false;
            else if (res === 'closed') nextClosed = true;
          }
          if (ok) rec(k + 1, nextClosed);
        }
        color[k] = -1;
      }
    }

    rec(0, false);
    return { solutions, capped: nodes > maxNodes };
  }

  return { solve };
})();
