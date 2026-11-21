// Maze. Find the way from the start (top left) to the goal (bottom
// right). The maze is "perfect": there is exactly one path. Mark the
// cells of that path. walls: for each cell, bits 1 = right wall, 2 =
// bottom wall (outer walls are always there).

(() => {
  const RIGHT = 1, DOWN = 2;

  function carve(n) {
    const N = n * n;
    const walls = new Uint8Array(N).fill(RIGHT | DOWN);
    const seen = new Uint8Array(N);
    const stack = [0];
    seen[0] = 1;
    while (stack.length) {
      const k = stack.at(-1);
      const r = Math.floor(k / n), c = k % n;
      const opts = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && !seen[a * n + b]);
      if (!opts.length) { stack.pop(); continue; }
      const [a, b] = opts[Math.floor(Math.random() * opts.length)];
      const j = a * n + b;
      if (a === r) walls[Math.min(k, j)] &= ~RIGHT; else walls[Math.min(k, j)] &= ~DOWN;
      seen[j] = 1;
      stack.push(j);
    }
    return walls;
  }

  const open = (n, walls, a, b) => {
    if (b === a + 1 && a % n !== n - 1) return !(walls[a] & RIGHT);
    if (b === a - 1 && b % n !== n - 1) return !(walls[b] & RIGHT);
    if (b === a + n) return !(walls[a] & DOWN);
    if (b === a - n) return !(walls[b] & DOWN);
    return false;
  };

  function pathOf(n, walls) {
    const N = n * n, prev = new Int32Array(N).fill(-1);
    const queue = [0];
    prev[0] = 0;
    for (let i = 0; i < queue.length; i++) {
      const k = queue[i];
      for (const j of [k - n, k + n, k - 1, k + 1]) {
        if (j < 0 || j >= N || prev[j] >= 0 || !open(n, walls, k, j)) continue;
        prev[j] = k;
        queue.push(j);
      }
    }
    const path = [];
    for (let k = N - 1; ; k = prev[k]) { path.push(k); if (k === 0) break; }
    return path.reverse();
  }

  const NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function render(p, state, opts = {}) {
    const { n, walls, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(16, Math.min(36, Math.floor((Math.min(window.innerWidth, 900) - 40) / n)));
    const svg = el('svg', { width: n * s + 4, height: n * s + 4, class: 'mz-board' + (readonly ? ' readonly' : '') });
    const g = el('g', { transform: 'translate(2 2)' }, svg);
    const onPath = new Set(solution);
    for (let k = 0; k < n * n; k++) {
      const x = (k % n) * s, y = Math.floor(k / n) * s;
      let cls = 'mz-cell';
      const marked = result ? onPath.has(k) : state[k];
      if (marked) cls += ' marked';
      if (result && state[k]) cls += onPath.has(k) ? ' ok' : ' bad';
      else if (result && onPath.has(k) && k !== 0 && k !== n * n - 1) cls += ' miss'; // not entered yet
      if (hint?.k === k) cls += ' hint';
      if (k === 0) cls += ' start';
      if (k === n * n - 1) cls += ' goal';
      const cell = el('rect', { x, y, width: s, height: s, class: cls }, g);
      if (!readonly) cell.addEventListener('click', () => { state[k] = state[k] ? 0 : 1; onChange(); });
    }
    for (let k = 0; k < n * n; k++) {
      const x = (k % n) * s, y = Math.floor(k / n) * s;
      if ((walls[k] & RIGHT) && k % n !== n - 1) el('line', { x1: x + s, y1: y, x2: x + s, y2: y + s, class: 'mz-wall' }, g);
      if ((walls[k] & DOWN) && Math.floor(k / n) !== n - 1) el('line', { x1: x, y1: y + s, x2: x + s, y2: y + s, class: 'mz-wall' }, g);
    }
    el('rect', { x: 0, y: 0, width: n * s, height: n * s, class: 'mz-frame' }, g);
    return svg;
  }

  // Start and goal are always on the path; marking them is optional.
  const isEnd = (p, k) => k === 0 || k === p.n * p.n - 1;

  function hints(p, state) {
    const onPath = new Set(p.solution);
    for (let k = 0; k < state.length; k++) if (state[k] && !onPath.has(k)) return [{ k, v: 0, reason: 'This cell is not on the way to the goal.' }];
    const k = p.solution.find((x) => !state[x] && !isEnd(p, x));
    return k === undefined ? [] : [{ k, v: 1, reason: 'No simple step is left. The path goes through this cell.' }];
  }

  PuzzleShell.start({
    id: 'maze',
    name: 'Maze',
    rules: 'Find the way from the green start (top left) to the red goal (bottom right). There is exactly one way. ' +
      'Mark every cell on that path. Start and goal need no mark.',
    controls: 'Click a cell to mark it as part of the path, click again to unmark it.',
    size: { min: 5, max: 25, def: 12 },
    solvedText: 'You found the way out — nicely done.',
    generate(n) {
      const walls = carve(n);
      return { n, walls, solution: pathOf(n, walls) };
    },
    encode: (p) => ({ n: p.n, w: Array.from(p.walls).join('') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 2 || n > 40) throw new Error('Invalid size');
      if (typeof d.w !== 'string' || d.w.length !== n * n || !/^[0-3]+$/.test(d.w)) throw new Error('Invalid walls');
      const walls = Uint8Array.from(d.w, Number);
      return { n, walls, solution: pathOf(n, walls) };
    },
    newState: (p) => new Uint8Array(p.n * p.n),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Uint8Array(p.n * p.n);
      if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = v[k] === '1' ? 1 : 0;
      return s;
    },
    render,
    check(p, s) {
      const onPath = new Set(p.solution);
      return s.every((v, k) => isEnd(p, k) || !!v === onPath.has(k));
    },
    hints,
    applyHint(p, s, h) { s[h.k] = h.v; },
  });
})();
