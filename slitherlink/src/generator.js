// Slitherlink generator. Grows a random blob of "inside" cells with no
// holes, takes its border as the loop, writes every clue, then removes
// clues one by one while the solver still finds a unique solution.
// Exposes the global `Generator`.

const Generator = (() => {
  const shuffle = PuzzleShell.shuffle;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  // Outside cells must all reach the border (no holes).
  function outsideOk(R, C, color) {
    const seen = new Uint8Array(R * C);
    const stack = [];
    for (let k = 0; k < R * C; k++) {
      const r = Math.floor(k / C), c = k % C;
      if (!color[k] && (r === 0 || c === 0 || r === R - 1 || c === C - 1)) { seen[k] = 1; stack.push(k); }
    }
    while (stack.length) {
      const k = stack.pop();
      const r = Math.floor(k / C), c = k % C;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= R || nc >= C) continue;
        const nk = nr * C + nc;
        if (!seen[nk] && !color[nk]) { seen[nk] = 1; stack.push(nk); }
      }
    }
    for (let k = 0; k < R * C; k++) if (!color[k] && !seen[k]) return false;
    return true;
  }

  function hasChecker(R, C, color) {
    const get = (r, c) => (r < 0 || c < 0 || r >= R || c >= C ? 0 : color[r * C + c]);
    for (let r = 0; r <= R; r++) for (let c = 0; c <= C; c++) {
      const tl = get(r - 1, c - 1), tr = get(r - 1, c), bl = get(r, c - 1), br = get(r, c);
      if (tl === br && tr === bl && tl !== tr) return true;
    }
    return false;
  }

  function growBlob(R, C) {
    const N = R * C;
    const color = new Int8Array(N);
    const target = Math.round(N * (0.45 + Math.random() * 0.15));
    color[Math.floor(Math.random() * N)] = 1;
    let size = 1, fails = 0;
    while (size < target && fails < N * 20) {
      const cand = [];
      for (let k = 0; k < N; k++) {
        if (color[k]) continue;
        const r = Math.floor(k / C), c = k % C;
        if (DIRS.some(([dr, dc]) => {
          const nr = r + dr, nc = c + dc;
          return nr >= 0 && nc >= 0 && nr < R && nc < C && color[nr * C + nc];
        })) cand.push(k);
      }
      const k = cand[Math.floor(Math.random() * cand.length)];
      color[k] = 1;
      if (!outsideOk(R, C, color) || hasChecker(R, C, color)) { color[k] = 0; fails++; continue; }
      size++;
    }
    return color;
  }

  function generate(n) {
    const R = n, C = n;
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const color = growBlob(R, C);
      const lines = Rules.edgesFromColors(R, C, color);
      const clues = new Int8Array(R * C);
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        clues[r * C + c] = Rules.cellEdges(R, C, r, c).filter((e) => lines[e]).length;
      }
      const p = { R, C, clues, solution: lines };
      const first = Solver.solve(p, 2);
      if (first.solutions.length !== 1) continue;
      for (const k of shuffle([...Array(R * C).keys()])) {
        const keep = clues[k];
        clues[k] = -1;
        const res = Solver.solve(p, 2, 60000);
        if (res.solutions.length !== 1 || res.capped) clues[k] = keep;
      }
      return p;
    }
    return null;
  }

  return { generate };
})();
