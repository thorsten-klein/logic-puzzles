// Gokigen Naname (Slant). Draw one diagonal in every cell. A number on
// a corner tells how many diagonals touch it. The diagonals may never
// form a closed loop. Uses the shared Binary solver:
// YES = "\" (top-left to bottom-right), NO = "/".

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  // Corner (r, c) has index r * (C + 1) + c, r in 0..R, c in 0..C.
  function model(p) {
    const { R, C, clues } = p;
    const W = C + 1;
    const cons = [];
    for (let r = 0; r <= R; r++) for (let c = 0; c <= C; c++) {
      const v = clues[r * W + c];
      if (v < 0) continue;
      const cells = [], w = [];
      let m = 0;
      const add = (rr, cc, weight) => {
        if (rr < 0 || cc < 0 || rr >= R || cc >= C) return;
        cells.push(rr * C + cc);
        w.push(weight);
        if (weight < 0) m++;
      };
      add(r - 1, c - 1, 1); add(r, c, 1); add(r - 1, c, -1); add(r, c - 1, -1);
      cons.push({ cells, w, min: v - m, max: v - m, at: r * W + c,
        why: () => `This ${v} needs exactly ${PuzzleShell.plural(v, 'line')} touching it. That settles these cells.` });
    }
    // Ends of the diagonal in cell k for value v.
    const ends = (k, v) => {
      const r = Math.floor(k / C), c = k % C;
      return v === YES ? [r * W + c, (r + 1) * W + c + 1] : [r * W + c + 1, (r + 1) * W + c];
    };
    function roots(s) {
      const parent = Int32Array.from({ length: (R + 1) * W }, (_, i) => i);
      const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      for (let k = 0; k < R * C; k++) {
        if (s[k] === UNKNOWN) continue;
        const [a, b] = ends(k, s[k]);
        const ra = find(a), rb = find(b);
        if (ra === rb) return null;
        parent[ra] = rb;
      }
      return find;
    }
    function propagate(s, log) {
      const find = roots(s);
      if (!find) return -1;
      for (let k = 0; k < R * C; k++) {
        if (s[k] !== UNKNOWN) continue;
        const loopYes = (() => { const [a, b] = ends(k, YES); return find(a) === find(b); })();
        const loopNo = (() => { const [a, b] = ends(k, NO); return find(a) === find(b); })();
        if (loopYes && loopNo) return -1;
        if (loopYes || loopNo) {
          s[k] = loopYes ? NO : YES;
          if (log) log.push({ cells: [k], v: s[k], reason: 'The other diagonal would close a loop, so this one goes here.' });
          return 1;
        }
      }
      return 0;
    }
    return { N: R * C, cons, propagate };
  }

  function generate(n) {
    for (let t = 0; t < 30; t++) {
      const R = n, C = n, W = C + 1;
      const p = { R, C, clues: new Int8Array((R + 1) * W).fill(-1) };
      const sol = Binary.randomFill(model(p), 0.5, 10);
      if (!sol) continue;
      for (let r = 0; r <= R; r++) for (let c = 0; c <= C; c++) {
        let v = 0;
        const at = (rr, cc) => (rr < 0 || cc < 0 || rr >= R || cc >= C ? 0 : sol[rr * C + cc]);
        if (at(r - 1, c - 1) === YES) v++;
        if (at(r, c) === YES) v++;
        if (at(r - 1, c) === NO) v++;
        if (at(r, c - 1) === NO) v++;
        p.clues[r * W + c] = v;
      }
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      Binary.thinClues(p.clues, -1, () => model(p));
      p.solution = sol;
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
    const s = Math.max(28, Math.min(46, Math.floor((Math.min(window.innerWidth, 900) - 60) / C)));
    const m = 14;
    const svg = el('svg', { width: C * s + 2 * m, height: R * s + 2 * m, class: 'gn-board' + (readonly ? ' readonly' : '') });
    const g = el('g', { transform: `translate(${m} ${m})` }, svg);
    const hintCells = new Set(hint ? hint.cells : []);
    for (let k = 0; k < R * C; k++) {
      const r = Math.floor(k / C), c = k % C;
      const x = c * s, y = r * s;
      const v = result ? solution[k] : state[k];
      let cls = 'gn-cell';
      if (hintCells.has(k)) cls += ' hint';
      if (result && state[k]) cls += state[k] === solution[k] ? ' ok' : ' bad';
      else if (result) cls += ' miss'; // not entered yet
      const cell = el('rect', { x, y, width: s, height: s, class: cls }, g);
      if (v === YES) el('line', { x1: x + 4, y1: y + 4, x2: x + s - 4, y2: y + s - 4, class: 'gn-line' }, g);
      if (v === NO) el('line', { x1: x + s - 4, y1: y + 4, x2: x + 4, y2: y + s - 4, class: 'gn-line' }, g);
      if (!readonly) {
        const cycle = (back) => {
          const order = back ? [UNKNOWN, NO, YES] : [UNKNOWN, YES, NO];
          state[k] = order[(order.indexOf(state[k]) + 1) % 3];
          onChange();
        };
        cell.addEventListener('click', () => cycle(false));
        cell.addEventListener('contextmenu', (ev) => { ev.preventDefault(); cycle(true); });
      }
    }
    for (let r = 0; r <= R; r++) for (let c = 0; c <= C; c++) {
      const v = clues[r * (C + 1) + c];
      if (v < 0) continue;
      const cx = c * s, cy = r * s;
      el('circle', { cx, cy, r: s * 0.22, class: 'gn-clue' + (hint?.at === r * (C + 1) + c ? ' hint' : '') }, g);
      const t = el('text', { x: cx, y: cy, 'font-size': s * 0.3, class: 'gn-num' }, g);
      t.textContent = v;
    }
    return svg;
  }

  const hints = (p, state) => Binary.hints(model(p), state, p.solution, String.raw`"\" line`, '"/" line');

  PuzzleShell.start({
    id: 'gokigen-naname',
    name: 'Gokigen Naname',
    rules: 'Draw one diagonal line in every cell. A number on a corner tells how many lines touch that corner. ' +
      'The lines may never form a closed loop.',
    controls: String.raw`Click a cell to draw "\", again for "/", again to clear. Right click cycles the other way.`,
    size: { min: 4, max: 10, def: 6 },
    solvedText: 'No loops anywhere — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v)).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== (R + 1) * (C + 1) || !/^[.0-4]+$/.test(d.g)) throw new Error('Invalid clues');
      const p = { R, C, clues: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number(ch))) };
      const res = Binary.solveFull(model(p));
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Uint8Array(p.R * p.C),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Uint8Array(p.R * p.C);
      if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % 3;
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => v === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) s[k] = h.v; },
  });
})();
