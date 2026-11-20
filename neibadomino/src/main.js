// Neibadomino (Neighbour Domino). Place dominoes (blocks of two cells);
// some cells stay empty. Every number lies in a domino and tells how many
// dominoes touch that domino by a side. Dominoes with the same count never
// touch, and no 2×2 square is fully covered by dominoes.
// Built on the Parts engine: draw the dominoes, wall in empty cells alone.
// Clues hold count + 1 (0 = none).

(() => {
  function info(p, id) {
    const doms = new Map();
    id.forEach((g, k) => { if (g >= 0) { if (!doms.has(g)) doms.set(g, []); doms.get(g).push(k); } });
    const touch = new Map();
    for (const [g, cells] of doms) {
      const set = new Set();
      for (const k of cells) for (const j of Parts.nbs(p.R, p.C, k)) if (id[j] >= 0 && id[j] !== g) set.add(id[j]);
      touch.set(g, set);
    }
    return { doms, touch };
  }

  Parts.startGame({
    id: 'neibadomino',
    name: 'Neibadomino',
    rules: 'Place dominoes (blocks of two cells) by drawing walls; wall in each empty cell on its own. Every number lies ' +
      'in a domino and tells how many dominoes touch that domino by a side. Dominoes with the same count never touch, and ' +
      'no 2×2 square is fully covered by dominoes.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'Good neighbours all around — nicely done.',
    maxSize: () => 2,
    skip: (p, k) => !p.clues[k],
    candidates: (p, k) => [k % p.C < p.C - 1 ? [k, k + 1] : null, k + p.C < p.R * p.C ? [k, k + p.C] : null].filter(Boolean),
    // Prune: no full 2×2 square; each numbered domino's count must stay
    // between the touching dominoes so far and those still possible.
    region(p, cells, id) {
      const { R, C } = p;
      for (const x of cells) {
        const r = Math.floor(x / C), c = x % C;
        for (const [a, b] of [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c]]) {
          if (a < 0 || b < 0 || a + 1 >= R || b + 1 >= C) continue;
          if ([a * C + b, a * C + b + 1, (a + 1) * C + b, (a + 1) * C + b + 1].every((y) => id[y] >= 0)) return false;
        }
      }
      const doms = new Map();
      id.forEach((g, k) => { if (g >= 0) { if (!doms.has(g)) doms.set(g, []); doms.get(g).push(k); } });
      for (const [g, dc] of doms) {
        const num = dc.map((x) => p.clues[x]).find(Boolean);
        if (!num) continue;
        const sure = new Set();
        let open = 0;
        for (const x of dc) for (const j of Parts.nbs(R, C, x)) {
          if (id[j] >= 0 && id[j] !== g) sure.add(id[j]);
          else if (id[j] === -1) open++;
        }
        if (sure.size > num - 1 || sure.size + open < num - 1) return false;
      }
      return true;
    },
    final(p, id) {
      const { R, C } = p;
      for (let r = 0; r + 1 < R; r++) for (let c = 0; c + 1 < C; c++) {
        const k = r * C + c;
        if (id[k] >= 0 && id[k + 1] >= 0 && id[k + C] >= 0 && id[k + C + 1] >= 0) return false;
      }
      const { doms, touch } = info(p, id);
      for (const [g, cells] of doms) {
        const n = touch.get(g).size;
        if (cells.some((k) => p.clues[k] && p.clues[k] - 1 !== n)) return false;
        for (const h of touch.get(g)) if (touch.get(h).size === n) return false;
      }
      return true;
    },
    // Place dominoes one by one (never filling a 2×2 square), then drop
    // dominoes until no two touching ones have the same count.
    split(R, C) {
      const N = R * C;
      const id = new Int32Array(N).fill(-2);
      let doms = [];
      const full = (k) => {
        const r = Math.floor(k / C), c = k % C;
        for (const [a, b] of [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c]]) {
          if (a < 0 || b < 0 || a + 1 >= R || b + 1 >= C) continue;
          if ([a * C + b, a * C + b + 1, (a + 1) * C + b, (a + 1) * C + b + 1].every((x) => id[x] >= 0)) return true;
        }
        return false;
      };
      for (const k of PuzzleShell.shuffle([...Array(N).keys()])) {
        if (id[k] >= 0) continue;
        const opts = PuzzleShell.shuffle(Parts.nbs(R, C, k).filter((j) => id[j] < 0));
        for (const j of opts) {
          id[k] = id[j] = doms.length;
          if (full(k) || full(j)) { id[k] = id[j] = -2; continue; }
          doms.push([k, j]);
          break;
        }
      }
      for (let guard = 0; guard < 200; guard++) {
        const p = { R, C, clues: new Int16Array(N) };
        const { touch } = info(p, id);
        let bad = -1;
        for (const [g, set] of touch) for (const h of set) if (touch.get(h).size === set.size) bad = Math.random() < 0.5 ? g : h;
        if (bad < 0) break;
        doms[bad].forEach((x) => { id[x] = -2; });
        doms[bad] = null;
      }
      doms = doms.filter(Boolean);
      const id2 = new Int32Array(N).fill(-2);
      doms.forEach((cells, i) => cells.forEach((x) => { id2[x] = i; }));
      const p = { R, C, clues: new Int16Array(N) };
      return doms.length >= N / 6 && this.final(p, id2) ? doms : null;
    },
    clues(p, regions) {
      const id = new Int32Array(p.R * p.C).fill(-2);
      regions.forEach((cells, i) => cells.forEach((k) => { id[k] = i; }));
      const { touch } = info(p, id);
      regions.forEach((cells, i) => cells.forEach((k) => { p.clues[k] = touch.get(i).size + 1; }));
    },
    cellText: (p, k) => String(p.clues[k] - 1),
  });
})();
