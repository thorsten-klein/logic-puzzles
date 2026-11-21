// Kuromasu generator. Shades random cells (not touching, white area
// connected), writes the view count in every white cell, then removes
// numbers while logic alone still solves the board.
// Exposes the global `Generator`.

const Generator = (() => {
  const { UNKNOWN, YES, NO } = Binary;

  function generate(n) {
    const N = n * n;
    const s = new Uint8Array(N).fill(NO);
    const target = Math.round(N * (0.2 + Math.random() * 0.06));
    let count = 0;
    for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
      if (count >= target) break;
      const r = Math.floor(k / n), c = k % n;
      if ((r > 0 && s[k - n] === YES) || (r < n - 1 && s[k + n] === YES) ||
          (c > 0 && s[k - 1] === YES) || (c < n - 1 && s[k + 1] === YES)) continue;
      s[k] = YES;
      if (!Rules.openConnected(n, s)) { s[k] = NO; continue; }
      count++;
    }
    const clues = new Int8Array(N);
    for (let k = 0; k < N; k++) {
      if (s[k] === YES) continue;
      let seen = 1;
      for (const d of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        for (const j of Rules.ray(n, k, d)) { if (s[j] === YES) break; seen++; }
      }
      clues[k] = seen;
    }
    const p = { n, clues };
    const solved = () => { const t = Binary.logicSolve(Rules.model(p)); return t && !t.includes(UNKNOWN); };
    for (const k of PuzzleShell.shuffle([...new Array(N).keys()])) {
      if (!clues[k]) continue;
      const keep = clues[k];
      clues[k] = 0;
      if (!solved()) clues[k] = keep;
    }
    p.solution = s;
    return p;
  }

  return { generate };
})();
