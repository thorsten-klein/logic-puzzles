// Bricks. A Latin square (1..N once per row and column) laid out in
// bricks of two cells side by side. Every brick holds one odd and one
// even number. Built on Latin.startGame.

(() => {
  const ODD = 0b1010101010, EVEN = 0b0101010100;

  function prune(p) {
    return (cand) => {
      for (let k = 0; k < p.n * p.n; k++) {
        const j = p.mate[k];
        if (j < k) continue;
        // If one side is surely odd (or even), the other is the opposite.
        if (!(cand[k] & EVEN)) cand[j] &= EVEN;
        if (!(cand[k] & ODD)) cand[j] &= ODD;
        if (!(cand[j] & EVEN)) cand[k] &= EVEN;
        if (!(cand[j] & ODD)) cand[k] &= ODD;
        if (!cand[k] || !cand[j]) return false;
      }
      return true;
    };
  }

  // Bricks: pairs of cells side by side in a row, one odd and one even
  // number. Rows are staggered like a wall. mate[k] = the other cell.
  function bricksOf(n, sol) {
    const mate = new Int32Array(n * n).fill(-1);
    for (let r = 0; r < n; r++) {
      let c = r % 2 && Math.random() < 0.7 ? 1 : 0;
      while (c < n - 1) {
        const a = r * n + c, b = a + 1;
        if ((sol[a] + sol[b]) % 2 === 1) { mate[a] = b; mate[b] = a; c += 2; } else c++;
      }
    }
    return mate;
  }

  function generate(n) {
    for (let t = 0; t < 30; t++) {
      const sol = Latin.randomSquare(n);
      const p = { n, mate: bricksOf(n, sol), solution: sol };
      const given = Latin.makeGivens(n, sol, prune(p));
      if (!given) continue;
      p.given = given;
      return p;
    }
    return null;
  }

  Latin.startGame({
    id: 'bricks',
    name: 'Bricks',
    rules: 'Fill the grid with 1 to N so each row and column holds every number once. ' +
      'Every brick (two cells side by side) holds one odd and one even number.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'A solid wall — nicely done.',
    what: 'the bricks',
    generate,
    encode: (p) => Array.from(p.mate, (j, k) => (j === k + 1 ? '1' : '0')).join(''),
    decode(x, n) {
      if (typeof x !== 'string' || x.length !== n * n || !/^[01]+$/.test(x)) throw new Error('Invalid bricks');
      const mate = new Int32Array(n * n).fill(-1);
      for (let k = 0; k < n * n; k++) if (x[k] === '1') {
        if ((k % n) === n - 1 || mate[k] >= 0) throw new Error('Invalid bricks');
        mate[k] = k + 1; mate[k + 1] = k;
      }
      return { mate };
    },
    prune,
    className: 'pz-regions',
    decorate(p, k, el) {
      if (!p.brickId) p.brickId = Int32Array.from(p.mate, (j, i) => (j >= 0 ? Math.min(i, j) : i));
      PuzzleShell.regionBorders(el, k, p.brickId, p.n, p.n);
    },
  });
})();
