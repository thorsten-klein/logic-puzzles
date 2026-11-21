// Country Road. Draw one loop through cell centres. It visits every
// region exactly once (crossing its border exactly twice). A number
// tells how many cells of its region the loop visits. Two cells the loop
// skips may not touch across a region border. Built on the Loop engine.

(() => {
  const { UNKNOWN, LINE, CROSS } = Loop;

  function groups(region) {
    const out = [];
    region.forEach((g, k) => { out[g] ??= []; out[g].push(k); });
    return out;
  }

  function model(p) {
    const { R, C, region, clues } = p;
    const g = Loop.grid(R, C);
    const list = groups(region);
    const edges = (k) => g.cellEdges[k].filter((e) => e >= 0);
    const visited = (s, k) => edges(k).some((e) => s[e] === LINE);
    const skipped = (s, k) => edges(k).every((e) => s[e] === CROSS);
    const border = list.map(() => []);
    const crossPairs = [];
    for (let e = 0; e < g.E; e++) {
      const [a, b] = g.ends[e];
      if (region[a] === region[b]) continue;
      border[region[a]].push(e);
      border[region[b]].push(e);
      crossPairs.push([a, b]);
    }
    function rule(s, log) {
      for (let i = 0; i < list.length; i++) {
        const lines = border[i].filter((e) => s[e] === LINE).length;
        const open = border[i].filter((e) => s[e] === UNKNOWN);
        if (lines > 2 || lines + open.length < 2) return false;
        if (open.length && lines === 2) {
          for (const e of open) s[e] = CROSS;
          if (log) log.push({ edges: open, v: CROSS, reason: 'The loop already enters and leaves this region. It crosses no more of its border.' });
          return open.length;
        }
        if (open.length && lines + open.length === 2) {
          for (const e of open) s[e] = LINE;
          if (log) log.push({ edges: open, v: LINE, reason: 'The loop must visit this region, and only these border crossings are left.' });
          return open.length;
        }
        const v = clues[i];
        if (v < 0) continue;
        const yes = list[i].filter((k) => visited(s, k)).length;
        const no = list[i].filter((k) => skipped(s, k)).length;
        if (yes > v || list[i].length - no < v) return false;
      }
      // Skipped cells may not touch across a border.
      for (const [a, b] of crossPairs) {
        if (skipped(s, a) && skipped(s, b)) return false;
        for (const [x, y] of [[a, b], [b, a]]) {
          if (!skipped(s, x) || visited(s, y)) continue;
          const es = edges(y), lines = es.filter((e) => s[e] === LINE).length, open = es.filter((e) => s[e] === UNKNOWN);
          if (lines + open.length < 2) return false;
          if (lines + open.length === 2) {
            for (const e of open) s[e] = LINE;
            if (log) log.push({ edges: open, v: LINE, reason: 'Skipped cells may not touch across a region border, so the loop visits this cell.' });
            return open.length;
          }
        }
      }
      return 0;
    }
    return { g, must: null, rule };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const loop = Loop.randomLoop(n, n, 0.5, false);
      if (!loop) continue;
      const g = Loop.grid(n, n);
      const next = Array.from({ length: n * n }, () => []);
      for (let e = 0; e < g.E; e++) if (loop[e] === LINE) { const [a, b] = g.ends[e]; next[a].push(b); next[b].push(a); }
      const start = next.findIndex((x) => x.length);
      const order = [start];
      for (let prev = -1, cur = start; ;) {
        const nx = next[cur].find((x) => x !== prev);
        if (nx === start) break;
        prev = cur; cur = nx;
        order.push(cur);
      }
      const shift = Math.floor(Math.random() * order.length);
      const rot = order.slice(shift).concat(order.slice(0, shift));
      const region = new Int32Array(n * n).fill(-1);
      let id = 0;
      for (let i = 0; i < rot.length;) {
        const len = Math.min(rot.length - i, 2 + Math.floor(Math.random() * 4));
        for (let j = 0; j < len; j++) region[rot[i + j]] = id;
        i += len;
        id++;
      }
      // Each patch of skipped cells joins one neighbouring region.
      const nbs = (k) => {
        const r = Math.floor(k / n), c = k % n, out = [];
        if (r > 0) out.push(k - n);
        if (r < n - 1) out.push(k + n);
        if (c > 0) out.push(k - 1);
        if (c < n - 1) out.push(k + 1);
        return out;
      };
      for (let k = 0; k < n * n; k++) {
        if (region[k] >= 0) continue;
        const patch = [k];
        const seen = new Set([k]);
        for (const cur of patch) for (const j of nbs(cur)) if (!seen.has(j) && region[j] < 0) { seen.add(j); patch.push(j); }
        const opts = [...new Set(patch.flatMap(nbs).filter((j) => region[j] >= 0).map((j) => region[j]))];
        const to = opts[Math.floor(Math.random() * opts.length)];
        for (const x of patch) region[x] = to;
      }
      const list = groups(region);
      const on = (k) => next[k].length > 0;
      const p = { R: n, C: n, region, clues: list.map((cells) => cells.filter(on).length) };
      const unique = () => { const r = Loop.solve(model(p), 2, 20000); return r.solutions.length === 1 && !r.capped; };
      if (!unique()) continue;
      for (const i of PuzzleShell.shuffle([...p.clues.keys()])) {
        const keep = p.clues[i];
        p.clues[i] = -1;
        if (!unique()) p.clues[i] = keep;
      }
      p.solution = loop;
      return p;
    }
    return null;
  }

  Loop.startGame({
    id: 'country-road',
    name: 'Country Road',
    rules: 'Draw one closed loop through the centres of cells. It visits every outlined region exactly once. ' +
      'A number tells how many cells of its region the loop passes through. ' +
      'Two cells the loop skips may not touch across a region border.',
    size: { min: 5, max: 9, def: 7 },
    solvedText: 'A fine country road — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.region, (v) => v.toString(36).padStart(2, '0')).join(''), n: p.clues.join(',') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid regions');
      const region = Int32Array.from({ length: R * C }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      const clues = String(d.n).split(',').map(Number);
      if (Math.max(...region) >= clues.length) throw new Error('Invalid clues');
      return { R, C, region, clues };
    },
    model,
    drawCell: (p) => (svg, k, x, y, s) => {
      const NS = 'http://www.w3.org/2000/svg';
      const { R, C, region } = p;
      const r = Math.floor(k / C), c = k % C;
      const x0 = x - s / 2, y0 = y - s / 2;
      const wall = (x1, y1, x2, y2) => {
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('class', 'lp-wall');
        svg.appendChild(l);
      };
      if (c < C - 1 && region[k + 1] !== region[k]) wall(x0 + s, y0, x0 + s, y0 + s);
      if (r < R - 1 && region[k + C] !== region[k]) wall(x0, y0 + s, x0 + s, y0 + s);
      const id = region[k];
      if (region.indexOf(id) === k && p.clues[id] >= 0) {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x0 + 4); t.setAttribute('y', y0 + s * 0.3);
        t.setAttribute('font-size', s * 0.3);
        t.setAttribute('class', 'lp-num');
        t.textContent = p.clues[id];
        svg.appendChild(t);
      }
    },
  });
})();
