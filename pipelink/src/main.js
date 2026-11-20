// Pipelink. Draw one closed loop that passes through every cell. The
// loop may cross itself: a crossing cell has four lines, and the loop goes
// straight through it. All given line pieces are part of the loop.
// Uses Loop.grid and Loop.render; edge states 0 unknown, 1 line, 2 cross.

(() => {
  const { UNKNOWN, LINE, CROSS } = Loop;

  // Degree rules: every cell has two lines, or four (a crossing).
  function settle(p, g, s) {
    for (const e of p.given) { if (s[e] === CROSS) return false; s[e] = LINE; }
    for (let changed = true; changed;) {
      changed = false;
      for (let k = 0; k < g.R * g.C; k++) {
        const es = g.cellEdges[k].filter((e) => e >= 0);
        const lines = es.filter((e) => s[e] === LINE).length;
        const open = es.filter((e) => s[e] === UNKNOWN);
        const total = lines + open.length;
        if (total < 2 || lines > 4 || (lines === 3 && !open.length)) return false;
        if (!open.length) continue;
        let v = 0;
        if (total === 2) v = LINE;
        else if (total === 3 && lines === 2) v = CROSS;
        else if (total === 3 && lines === 3) return false;
        else if (total === 4 && lines === 3) v = LINE;
        if (!v) continue;
        open.forEach((e) => { s[e] = v; });
        changed = true;
      }
    }
    return true;
  }

  // One loop: follow the lines (straight through crossings) once around.
  function oneLoop(g, s) {
    const total = s.reduce((a, v) => a + (v === LINE ? 1 : 0), 0);
    const e0 = s.indexOf(LINE);
    if (e0 < 0) return false;
    const step = [-g.C, g.C, -1, 1];
    let [x] = g.ends[e0];
    let d = g.cellEdges[x].indexOf(e0);
    const used = new Set();
    for (let guard = 0; guard <= total; guard++) {
      const e = g.cellEdges[x][d];
      if (used.has(e)) return used.size === total;
      used.add(e);
      x += step[d];
      const lines = [0, 1, 2, 3].filter((q) => g.cellEdges[x][q] >= 0 && s[g.cellEdges[x][q]] === LINE);
      const back = d ^ 1;
      d = lines.length === 4 ? d : lines.find((q) => q !== back);
    }
    return false;
  }

  function solve(p, stopAt = 2, maxNodes = 20000) {
    const g = Loop.grid(p.R, p.C);
    const out = [];
    let nodes = 0;
    (function rec(s) {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      if (!settle(p, g, s)) return;
      const e = s.indexOf(UNKNOWN);
      if (e < 0) { if (oneLoop(g, s)) out.push(Uint8Array.from(s)); return; }
      for (const v of [LINE, CROSS]) { const t = Uint8Array.from(s); t[e] = v; rec(t); }
    })(new Uint8Array(g.E));
    return { solutions: out, capped: nodes > maxNodes };
  }

  // The menu size is half the board side (random tours need an even side).
  function generate(half) {
    const n = 2 * half;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      // A random tour as the answer (it does not cross itself, but the
      // player has to rule crossings out). Pieces are given until unique.
      const loop = Loop.randomTour(n);
      const p = { R: n, C: n, given: [] };
      const lines = [...loop.keys()].filter((e) => loop[e] === LINE);
      for (let guard = 0; guard < lines.length; guard++) {
        const res = solve(p, 2, 20000);
        if (res.solutions.length === 1 && !res.capped) break;
        const other = res.solutions.find((x) => x.some((v, e) => v !== loop[e]));
        const opts = lines.filter((e) => !p.given.includes(e) && (!other || other[e] !== LINE));
        if (!opts.length) break;
        p.given.push(opts[Math.floor(Math.random() * opts.length)]);
      }
      const res = solve(p, 2, 20000);
      if (res.solutions.length !== 1 || res.capped) continue;
      for (const e of PuzzleShell.shuffle(p.given.slice())) {
        p.given = p.given.filter((x) => x !== e);
        const r = solve(p, 2, 20000);
        if (r.solutions.length !== 1 || r.capped) p.given.push(e);
        if (Date.now() > deadline + 3000) break;
      }
      p.given.sort((a, b) => a - b);
      p.solution = loop;
      return p;
    }
    return null;
  }

  function hints(p, state) {
    for (let e = 0; e < state.length; e++) {
      if (state[e] === LINE && p.solution[e] !== LINE) return [{ edges: [e], v: CROSS, reason: 'This line is wrong.' }];
      if (state[e] === CROSS && p.solution[e] === LINE) return [{ edges: [e], v: LINE, reason: 'This cross is wrong. A line goes here.' }];
    }
    // A forced step from the cell rules, else the next line of the answer.
    const g = Loop.grid(p.R, p.C);
    const s = Uint8Array.from(state);
    for (const e of p.given) s[e] = LINE;
    const t = Uint8Array.from(s);
    if (settle(p, g, t)) {
      const e = [...t.keys()].find((i) => t[i] !== s[i] && state[i] === UNKNOWN && !p.given.includes(i));
      if (e !== undefined) return [{ edges: [e], v: t[e], reason: t[e] === LINE ? 'Every cell needs two lines (or four at a crossing), and this side is needed.' : 'This cell already has its two lines.' }];
    }
    const e = p.solution.findIndex((v, i) => v === LINE && state[i] !== LINE && !p.given.includes(i));
    return e < 0 ? [] : [{ edges: [e], v: LINE, reason: 'No simple step is left. Here is one line of the loop.' }];
  }

  PuzzleShell.start({
    id: 'pipelink',
    name: 'Pipelink',
    rules: 'Draw one closed loop that passes through every cell, moving up, down, left and right. The loop may cross ' +
      'itself: then it goes straight through that cell in both directions. All dark line pieces are given and belong to the loop.',
    controls: 'Click between two cells to draw a line, click again for a cross, again to clear. Right click cycles the other way.',
    size: { min: 2, max: 4, def: 3, text: (h) => `${2 * h}×${2 * h}` },
    solvedText: 'Pipes all linked — nicely done.',
    generate,
    encode: (p) => ({ n: p.R, e: p.given.join(',') }),
    decode(d) {
      const n = d && d.n;
      if (!Number.isInteger(n) || n < 2 || n > 16) throw new Error('Invalid board size');
      const E = Loop.grid(n, n).E;
      const given = String(d.e || '').split(',').filter((t) => t !== '').map(Number);
      if (given.some((e) => !(e >= 0 && e < E))) throw new Error('Invalid pieces');
      const p = { R: n, C: n, given };
      const res = solve(p, 2, 50000);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => {
      const s = new Uint8Array(Loop.grid(p.R, p.C).E);
      for (const e of p.given) s[e] = LINE;
      return s;
    },
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Uint8Array(Loop.grid(p.R, p.C).E);
      if (typeof v === 'string' && v.length === s.length) for (let i = 0; i < s.length; i++) s[i] = Number(v[i]) % 3;
      for (const e of p.given) s[e] = LINE;
      return s;
    },
    render: (p, s, opts) => Loop.render({ g: Loop.grid(p.R, p.C) }, s, { ...opts, solution: p.solution, fixed: p.given }),
    check(p, s) {
      const g = Loop.grid(p.R, p.C);
      const t = Uint8Array.from(s, (v) => (v === LINE ? LINE : CROSS));
      return settle(p, g, Uint8Array.from(t)) && oneLoop(g, t) &&
        [...Array(g.R * g.C).keys()].every((k) => [2, 4].includes(g.cellEdges[k].filter((e) => e >= 0 && t[e] === LINE).length));
    },
    hints,
    applyHint(p, s, h) { for (const e of h.edges) s[e] = h.v; for (const e of p.given) s[e] = LINE; },
  });
})();
