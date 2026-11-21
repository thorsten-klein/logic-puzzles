// Mirukuti (Milk Tea). Join each black circle with two white circles by
// a T-shaped line: the two whites are joined by a straight bar, and the
// black's straight stem meets the bar between them. Lines never cross or
// touch other circles. p = { R, C, col } (0 empty, 1 white, 2 black).

(() => {
  // All T shapes for each black circle.
  function prepare(p) {
    const { R, C, col } = p;
    const at = (r, c) => (r >= 0 && c >= 0 && r < R && c < C ? r * C + c : -1);
    p.opts = [];
    for (let k = 0; k < R * C; k++) {
      if (col[k] !== 2) continue;
      const r0 = Math.floor(k / C), c0 = k % C;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const stem = [];
        for (let i = 1; ; i++) {
          const j = at(r0 + dr * i, c0 + dc * i);
          if (j < 0 || col[j]) break;
          stem.push(j);
          // Bar through j, perpendicular to the stem.
          const [br, bc] = [dc, dr];
          const arm = (sign) => {
            const cells = [];
            for (let t = 1; ; t++) {
              const x = at(Math.floor(j / C) + br * t * sign, (j % C) + bc * t * sign);
              if (x < 0) return null;
              if (col[x] === 1) return { cells, end: x };
              if (col[x]) return null;
              cells.push(x);
            }
          };
          const a = arm(1), b = arm(-1);
          if (!a || !b) continue;
          p.opts.push({ black: k, whites: [a.end, b.end], cells: [...stem, ...a.cells, ...b.cells], stem: stem.slice(), joint: j });
        }
      }
    }
    p.by = new Map();
    p.opts.forEach((o, i) => {
      for (const x of [o.black, ...o.whites]) { if (!p.by.has(x)) p.by.set(x, []); p.by.get(x).push(i); }
    });
    return p;
  }

  const clash = (a, b) => a.black === b.black || a.whites.some((w) => b.whites.includes(w)) || a.cells.some((x) => b.cells.includes(x));

  function settle(p, st, log) {
    for (let changed = true; changed;) {
      changed = false;
      for (const [x, list] of p.by) {
        const used = list.filter((i) => st[i] === 1), open = list.filter((i) => st[i] === 0);
        if (used.length > 1 || (!used.length && !open.length)) return false;
        if (!used.length && open.length === 1) {
          st[open[0]] = 1;
          changed = true;
          if (log) { log.push({ opts: open, v: 1, reason: 'This circle can only be joined in one way.' }); return true; }
        }
      }
      for (let i = 0; i < st.length; i++) {
        if (st[i] !== 1) continue;
        for (let j = 0; j < st.length; j++) {
          if (j === i || st[j] === 2 || !clash(p.opts[i], p.opts[j])) continue;
          if (st[j] === 1) return false;
          st[j] = 2;
          changed = true;
        }
      }
    }
    for (let k = 0; k < p.R * p.C; k++) if (p.col[k] && !p.by.has(k)) return false;
    return true;
  }

  function solve(p, stopAt = 2) {
    const out = [];
    let nodes = 0;
    (function rec(st) {
      if (out.length >= stopAt || ++nodes > 50000) return;
      if (!settle(p, st)) return;
      const i = st.indexOf(0);
      if (i < 0) { out.push(Uint8Array.from(st, (v) => (v === 1 ? 1 : 0))); return; }
      for (const v of [1, 2]) { const t = Uint8Array.from(st); t[i] = v; rec(t); }
    })(new Uint8Array(p.opts.length));
    return out;
  }

  function generate(n) {
    const R = n, C = n, N = R * C;
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const col = new Int8Array(N), used = new Uint8Array(N);
      for (let t = 0; t < N * 4; t++) {
        const horiz = Math.random() < 0.5;
        const len = 2 + Math.floor(Math.random() * 4);
        const stemLen = 1 + Math.floor(Math.random() * 3);
        const r = Math.floor(Math.random() * R), c = Math.floor(Math.random() * C);
        const bar = [];
        for (let i = 0; i <= len; i++) bar.push(horiz ? [r, c + i] : [r + i, c]);
        const mid = 1 + Math.floor(Math.random() * (len - 1));
        const side = Math.random() < 0.5 ? -1 : 1;
        const stem = [];
        for (let i = 1; i <= stemLen; i++) stem.push(horiz ? [r + side * i, c + mid] : [r + mid, c + side * i]);
        const all = [...bar, ...stem];
        if (all.some(([a, b]) => a < 0 || b < 0 || a >= R || b >= C || used[a * C + b])) continue;
        all.forEach(([a, b]) => { used[a * C + b] = 1; });
        col[bar[0][0] * C + bar[0][1]] = 1;
        col[bar[len][0] * C + bar[len][1]] = 1;
        const tip = stem.at(-1);
        col[tip[0] * C + tip[1]] = 2;
      }
      const p = prepare({ R, C, col });
      if (!p.opts.length) continue;
      const sols = solve(p);
      if (sols.length !== 1) continue;
      p.solution = sols[0];
      return p;
    }
    return null;
  }

  const NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function render(p, state, opts = {}) {
    const { R, C, col, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(28, Math.min(46, Math.floor((Math.min(window.innerWidth, 900) - 40) / C)));
    const svg = el('svg', { width: C * s, height: R * s, class: 'sk-board' + (readonly ? ' readonly' : '') });
    el('rect', { x: 0, y: 0, width: C * s, height: R * s, rx: 6, class: 'sk-bg' }, svg);
    for (let r = 1; r < R; r++) el('line', { x1: 0, y1: r * s, x2: C * s, y2: r * s, class: 'sk-grid' }, svg);
    for (let c = 1; c < C; c++) el('line', { x1: c * s, y1: 0, x2: c * s, y2: R * s, class: 'sk-grid' }, svg);
    const xy = (k) => [(k % C) * s + s / 2, Math.floor(k / C) * s + s / 2];
    const hintSet = new Set(hint ? hint.opts : []);
    const drawT = (o, cls) => {
      const [a1, b1] = xy(o.whites[0]), [a2, b2] = xy(o.whites[1]);
      const [x0, y0] = xy(o.black), [xj, yj] = xy(o.joint);
      el('line', { x1: a1, y1: b1, x2: a2, y2: b2, class: cls }, svg);
      el('line', { x1: x0, y1: y0, x2: xj, y2: yj, class: cls }, svg);
    };
    p.opts.forEach((o, i) => {
      const v = result ? solution[i] : state[i];
      let cls = 'sk-line';
      if (result && state[i]) cls += solution[i] ? ' ok' : ' bad';
      else if (result && solution[i]) cls += ' miss'; // not entered yet
      if (hintSet.has(i)) cls += ' hint';
      if (v) drawT(o, cls);
      else if (hintSet.has(i) || cls.includes('bad')) drawT(o, cls + ' ghost'); // hint, or a wrong T
    });
    // Clicking a black circle cycles through its T shapes.
    for (let k = 0; k < R * C; k++) {
      if (!col[k]) continue;
      const [cx, cy] = xy(k);
      const c = el('circle', { cx, cy, r: s * 0.3, class: col[k] === 1 ? 'sk-white' : 'sk-black mk-pick' }, svg);
      if (!readonly && col[k] === 2) {
        c.addEventListener('click', () => {
          const mine = p.by.get(k) || [];
          const cur = mine.findIndex((i) => state[i]);
          for (const i of mine) state[i] = 0;
          if (cur + 1 < mine.length) state[mine[cur + 1]] = 1;
          onChange();
        });
      }
    }
    return svg;
  }

  function hints(p, state) {
    for (let i = 0; i < state.length; i++) if (state[i] && !p.solution[i]) return [{ opts: [i], v: 0, reason: 'This T is wrong.' }];
    const st = Uint8Array.from(state, (v) => (v ? 1 : 0));
    for (let guard = 0; guard < 100; guard++) {
      const log = [];
      if (!settle(p, st, log) || !log.length) break;
      const add = log.find((x) => x.v === 1 && !state[x.opts[0]]);
      if (add) return [{ opts: add.opts, v: 1, reason: add.reason }];
    }
    const i = p.solution.findIndex((v, j) => v && !state[j]);
    return i < 0 ? [] : [{ opts: [i], v: 1, reason: 'No simple step is left. Here is one T.' }];
  }

  PuzzleShell.start({
    id: 'mirukuti',
    name: 'Mirukuti',
    rules: 'Join each black circle with two white circles by a T-shaped line. The two white circles are joined by the ' +
      'straight bar of the T; the black circle\'s straight stem meets the bar between them. Lines never cross, ' +
      'and every circle belongs to exactly one T.',
    controls: 'Click a black circle to cycle through the T shapes it can make (and back to none).',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'Milk tea served — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.col).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[012]+$/.test(d.g)) throw new Error('Invalid circles');
      const p = prepare({ R, C, col: Int8Array.from(d.g, Number) });
      const sols = solve(p);
      if (sols.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = sols[0];
      return p;
    },
    newState: (p) => new Uint8Array(p.opts.length),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Uint8Array(p.opts.length);
      if (typeof v === 'string' && v.length === s.length) for (let i = 0; i < s.length; i++) s[i] = v[i] === '1' ? 1 : 0;
      return s;
    },
    render,
    check: (p, s) => s.every((v, i) => v === p.solution[i]),
    hints,
    applyHint(p, s, h) {
      for (const i of h.opts) {
        if (h.v === 1) for (const j of p.by.get(p.opts[i].black)) s[j] = 0;
        s[i] = h.v === 1 ? 1 : 0;
      }
    },
  });
})();
