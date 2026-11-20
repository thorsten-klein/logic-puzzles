// Number Chain. Every cell holds a number from 1 to N. Draw one line
// through cell centres from the top left corner to the bottom right
// corner. The cells on the line hold each number from 1 to N exactly once.
// Built on the shared Links engine.

(() => {
  const { LINE } = Loop;

  function model(p) {
    const { R, C, num, top } = p;
    const g = Loop.grid(R, C);
    const label = new Int8Array(R * C).fill(-1);
    label[0] = 1;
    label[R * C - 1] = 1;
    const step = [-C, C, -1, 1];
    function rule(s) {
      // Every piece of line: its numbers differ. All line cells: at most N.
      const seenCell = new Uint8Array(R * C);
      let used = 0;
      for (let k = 0; k < R * C; k++) {
        if (seenCell[k] || !g.cellEdges[k].some((e) => e >= 0 && s[e] === LINE)) continue;
        const nums = new Set(), st = [k];
        seenCell[k] = 1;
        while (st.length) {
          const x = st.pop();
          used++;
          if (nums.has(num[x])) return false;
          nums.add(num[x]);
          g.cellEdges[x].forEach((e, d) => { if (e >= 0 && s[e] === LINE && !seenCell[x + step[d]]) { seenCell[x + step[d]] = 1; st.push(x + step[d]); } });
        }
      }
      if (used > top) return false;
      // Walk from the start: numbers met must all differ.
      const seen = new Set([num[0]]);
      let x = 0, from = -1;
      for (let guard = 0; guard < R * C; guard++) {
        const d = [0, 1, 2, 3].find((q) => q !== from && g.cellEdges[x][q] >= 0 && s[g.cellEdges[x][q]] === LINE);
        if (d === undefined) break;
        x += step[d];
        from = d ^ 1;
        if (seen.has(num[x])) return false;
        seen.add(num[x]);
      }
      if (seen.size > top) return false;
      if (x === R * C - 1 && seen.size !== top) return false;
      return 0;
    }
    return { g, label, fill: false, rule };
  }

  // Random path from the top left to the bottom right corner.
  function randomPath(n, len) {
    const N = n * n, goal = N - 1;
    for (let t = 0; t < 200; t++) {
      const path = [0];
      const used = new Uint8Array(N);
      used[0] = 1;
      let ok = false;
      const dist = (k) => (n - 1 - Math.floor(k / n)) + (n - 1 - (k % n));
      for (let guard = 0; guard < N * 4; guard++) {
        const k = path[path.length - 1];
        if (k === goal) { ok = path.length === len; break; }
        const left = len - path.length;
        const r = Math.floor(k / n), c = k % n;
        const opts = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
          .filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && !used[a * n + b])
          .map(([a, b]) => a * n + b)
          .filter((j) => dist(j) <= left - 1 && (j !== goal || left === 1));
        if (!opts.length) break;
        const j = opts[Math.floor(Math.random() * opts.length)];
        used[j] = 1;
        path.push(j);
      }
      if (ok) return path;
    }
    return null;
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const len = 2 * n - 1 + 2 * Math.floor(Math.random() * (n - 1));
      const path = randomPath(n, len);
      if (!path) continue;
      const num = new Int8Array(N);
      const vals = PuzzleShell.shuffle(Array.from({ length: len }, (_, i) => i + 1));
      path.forEach((k, i) => { num[k] = vals[i]; });
      for (let k = 0; k < N; k++) if (!num[k]) num[k] = 1 + Math.floor(Math.random() * len);
      const p = { R: n, C: n, num, top: len };
      // Repair: while another path works, give one of its cells (off our
      // path) a number that path already has.
      const g = Loop.grid(n, n);
      const onPath = new Set(path);
      let unique = false;
      for (let fix = 0; fix < 60 && Date.now() < deadline; fix++) {
        if (Links.unique(model(p), 8000)) { unique = true; break; }
        const r = Links.solve(model(p), 2, 8000);
        if (r.capped && !r.solutions.length) break;
        const cellsOf = (st) => { const set = new Set(); g.ends.forEach(([a, b], e) => { if (st[e] === LINE) { set.add(a); set.add(b); } }); return [...set]; };
        const alt = r.solutions.map(cellsOf).find((cs) => cs.some((x) => !onPath.has(x)));
        if (!alt) break;
        const free = alt.filter((x) => !onPath.has(x));
        const x = free[Math.floor(Math.random() * free.length)];
        const others = alt.filter((y) => y !== x);
        num[x] = num[others[Math.floor(Math.random() * others.length)]];
      }
      if (!unique) continue;
      const state = new Uint8Array(g.E).fill(2);
      for (let i = 0; i + 1 < path.length; i++) {
        const [a, b] = [path[i], path[i + 1]].sort((x, y) => x - y);
        const e = b - a === 1 ? Math.floor(a / n) * (n - 1) + (a % n) : n * (n - 1) + a;
        state[e] = LINE;
      }
      p.solution = state;
      return p;
    }
    return null;
  }

  Links.startGame({
    id: 'number-chain',
    name: 'Number Chain',
    rules: 'Every cell holds a number from 1 to N, where N is the largest number in the grid. Draw one line through the centres of ' +
      'cells from the top left corner to the bottom right corner. The cells on the line hold every number from 1 to N ' +
      'exactly once.',
    size: { min: 4, max: 7, def: 6 },
    solvedText: 'An unbroken chain — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, t: p.top, g: Array.from(p.num, (v) => v.toString(36)).join('') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 2 || n > 12) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== n * n || !Number.isInteger(d.t)) throw new Error('Invalid numbers');
      return { R: n, C: n, top: d.t, num: Int8Array.from(d.g, (ch) => parseInt(ch, 36)) };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s) => {
      const NS = 'http://www.w3.org/2000/svg';
      if (k === 0 || k === p.R * p.C - 1) {
        const o = document.createElementNS(NS, 'circle');
        o.setAttribute('cx', x); o.setAttribute('cy', y); o.setAttribute('r', s * 0.34);
        o.setAttribute('class', 'll-white');
        svg.appendChild(o);
      }
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('font-size', s * 0.36);
      t.setAttribute('class', 'll-num');
      t.textContent = p.num[k];
      svg.appendChild(t);
    },
  });
})();
