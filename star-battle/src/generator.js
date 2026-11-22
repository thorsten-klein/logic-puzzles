// Star Battle generator. Places stars first (k per row and column,
// never touching), then grows one region around each group of k
// stars. Keeps boards that logic alone solves.
// Exposes the global `Generator`.

const Generator = (() => {
  const { YES, NO } = Binary;
  const shuffle = PuzzleShell.shuffle;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function placeStars(n, k) {
    const star = new Uint8Array(n * n);
    const colCount = new Int8Array(n);
    const combos = [];
    (function build(start, pick) {
      if (pick.length === k) { combos.push(pick.slice()); return; }
      for (let c = start; c < n; c++) {
        if (pick.length && c - pick.at(-1) < 2) continue;
        pick.push(c); build(c + 1, pick); pick.pop();
      }
    })(0, []);
    let nodes = 0;
    function rec(r, prev) {
      if (r === n) return colCount.every((x) => x === k);
      if (++nodes > 20000) return false;
      for (const cols of shuffle(combos.slice())) {
        if (cols.some((c) => colCount[c] >= k || prev.some((q) => Math.abs(q - c) <= 1))) continue;
        for (const c of cols) { colCount[c]++; star[r * n + c] = 1; }
        if (rec(r + 1, cols)) return true;
        for (const c of cols) { colCount[c]--; star[r * n + c] = 0; }
      }
      return false;
    }
    return rec(0, []) ? star : null;
  }

  // Joins stars into groups of k, then grows the groups to fill the grid.
  function makeRegions(n, k, star) {
    const N = n * n;
    const region = new Int8Array(N).fill(-1);
    const list = shuffle([...new Array(N).keys()].filter((j) => star[j]));
    const dist = (a, b) => Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs((a % n) - (b % n));
    let id = 0;
    while (list.length) {
      const group = [list.shift()];
      while (group.length < k) {
        list.sort((a, b) => dist(a, group[0]) - dist(b, group[0]));
        group.push(list.shift());
      }
      // Connect the group with straight L-shaped paths.
      region[group[0]] = id;
      for (const j of group.slice(1)) {
        let r = Math.floor(group[0] / n), c = group[0] % n;
        const tr = Math.floor(j / n), tc = j % n;
        while (r !== tr || c !== tc) {
          if (c !== tc && (r === tr || Math.random() < 0.5)) c += Math.sign(tc - c);
          else r += Math.sign(tr - r);
          const cell = r * n + c;
          if (region[cell] >= 0 && region[cell] !== id) return null;
          if (star[cell] && cell !== j) return null;
          region[cell] = id;
        }
      }
      id++;
    }
    let open = N - region.filter((x) => x >= 0).length;
    while (open > 0) {
      const front = [];
      for (let j = 0; j < N; j++) {
        if (region[j] < 0) continue;
        const r = Math.floor(j / n), c = j % n;
        for (const [dr, dc] of DIRS) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nc >= 0 && nr < n && nc < n && region[nr * n + nc] < 0) front.push([nr * n + nc, region[j]]);
        }
      }
      const [cell, g] = front[Math.floor(Math.random() * front.length)];
      region[cell] = g;
      open--;
    }
    return region;
  }

  function generate(n) {
    const k = n >= 8 ? 2 : 1;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const star = placeStars(n, k);
      if (!star) continue;
      const region = makeRegions(n, k, star);
      if (!region) continue;
      const p = { n, k, region };
      const s = Binary.logicSolve(Rules.model(p));
      if (!s || s.includes(0)) continue;
      p.solution = Uint8Array.from(star, (x) => (x ? YES : NO));
      return p;
    }
    return null;
  }

  return { generate };
})();
