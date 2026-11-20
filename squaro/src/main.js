// SquarO. Colour some dots on the grid corners black. A number in a cell
// tells how many of its four corner dots are black.
// Uses the shared Binary solver on the dots (YES = black dot).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  // Dot (r, c) has index r * (C + 1) + c.
  const corners = (p, k) => {
    const r = Math.floor(k / p.C), c = k % p.C, W = p.C + 1;
    return [r * W + c, r * W + c + 1, (r + 1) * W + c, (r + 1) * W + c + 1];
  };

  function model(p) {
    const cons = [];
    for (let k = 0; k < p.R * p.C; k++) {
      const v = p.clues[k];
      if (v < 0) continue;
      cons.push({ cells: corners(p, k), min: v, max: v, at: k,
        why: (x) => (x === YES ? `This ${v} needs every open corner dot black.`
          : v === 0 ? 'A 0 means all four corner dots are white.' : `This ${v} already has ${v} black dot${v === 1 ? '' : 's'}. The other corners are white.`) });
    }
    return { N: (p.R + 1) * (p.C + 1), cons };
  }

  function generate(n) {
    for (let t = 0; t < 100; t++) {
      const R = n, C = n;
      const dots = Uint8Array.from({ length: (R + 1) * (C + 1) }, () => (Math.random() < 0.45 ? YES : NO));
      const p = { R, C, clues: new Int8Array(R * C) };
      for (let k = 0; k < R * C; k++) p.clues[k] = corners(p, k).filter((d) => dots[d] === YES).length;
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.clues, -1, () => model(p));
      p.solution = dots;
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
    const { R, C, clues, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(30, Math.min(50, Math.floor((Math.min(window.innerWidth, 900) - 60) / C)));
    const m = 16;
    const svg = el('svg', { width: C * s + 2 * m, height: R * s + 2 * m, class: 'sq-board' + (readonly ? ' readonly' : '') });
    const g = el('g', { transform: `translate(${m} ${m})` }, svg);
    el('rect', { x: 0, y: 0, width: C * s, height: R * s, class: 'sq-bg' }, g);
    for (let r = 1; r < R; r++) el('line', { x1: 0, y1: r * s, x2: C * s, y2: r * s, class: 'sq-grid' }, g);
    for (let c = 1; c < C; c++) el('line', { x1: c * s, y1: 0, x2: c * s, y2: R * s, class: 'sq-grid' }, g);
    for (let k = 0; k < R * C; k++) {
      if (clues[k] < 0) continue;
      const x = (k % C) * s + s / 2, y = Math.floor(k / C) * s + s / 2;
      if (hint && hint.at === k) el('rect', { x: x - s / 2 + 2, y: y - s / 2 + 2, width: s - 4, height: s - 4, class: 'sq-hint-cell' }, g);
      const t = el('text', { x, y, 'font-size': s * 0.42, class: 'sq-num' }, g);
      t.textContent = clues[k];
    }
    const hintSet = new Set(hint ? hint.cells : []);
    for (let r = 0; r <= R; r++) for (let c = 0; c <= C; c++) {
      const d = r * (C + 1) + c;
      const v = result ? solution[d] : state[d];
      let cls = 'sq-dot' + (v === YES ? ' black' : v === NO ? ' white' : '');
      if (hintSet.has(d)) cls += ' hint';
      if (result && state[d]) cls += state[d] === solution[d] ? ' ok' : ' bad';
      else if (result && solution[d] === YES) cls += ' miss'; // not entered yet
      el('circle', { cx: c * s, cy: r * s, r: s * 0.17, class: cls }, g);
      if (!readonly) {
        const hit = el('circle', { cx: c * s, cy: r * s, r: s * 0.32, class: 'sq-hit' }, g);
        const cycle = (back) => {
          const order = back ? [UNKNOWN, NO, YES] : [UNKNOWN, YES, NO];
          state[d] = order[(order.indexOf(state[d]) + 1) % 3];
          onChange();
        };
        hit.addEventListener('click', () => cycle(false));
        hit.addEventListener('contextmenu', (ev) => { ev.preventDefault(); cycle(true); });
      }
    }
    return svg;
  }

  PuzzleShell.start({
    id: 'squaro',
    name: 'SquarO',
    rules: 'Colour some dots black. The dots sit on the corners of the cells. A number in a cell tells how many of its four corner dots are black.',
    controls: 'Click a dot to make it black, again to mark it white, again to clear. Right click cycles the other way.',
    size: { min: 4, max: 10, def: 6 },
    solvedText: 'Every square counts right — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v)).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C || !/^[.0-4]+$/.test(d.g)) throw new Error('Invalid clues');
      const p = { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number(ch))) };
      const res = Binary.solveFull(model(p));
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Uint8Array((p.R + 1) * (p.C + 1)),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Uint8Array((p.R + 1) * (p.C + 1));
      if (typeof v === 'string' && v.length === s.length) for (let i = 0; i < s.length; i++) s[i] = Number(v[i]) % 3;
      return s;
    },
    render,
    check: (p, s) => s.every((v, d) => (v === YES) === (p.solution[d] === YES)),
    hints: (p, s) => Binary.hints(model(p), s, p.solution, 'black dot', 'white dot'),
    applyHint(p, s, h) { for (const d of h.cells) s[d] = h.v; },
  });
})();
