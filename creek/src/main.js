// Creek. Shade some cells. A number on a corner tells how many of the
// four cells around it are shaded. All white cells stay connected.
// Uses the shared Binary solver (YES = shaded).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function cornerCells(p, r, c) {
    const out = [];
    for (const [rr, cc] of [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c]]) {
      if (rr >= 0 && cc >= 0 && rr < p.R && cc < p.C) out.push(rr * p.C + cc);
    }
    return out;
  }

  function model(p) {
    const { R, C, clues } = p;
    const cons = [];
    for (let r = 0; r <= R; r++) for (let c = 0; c <= C; c++) {
      const v = clues[r * (C + 1) + c];
      if (v < 0) continue;
      cons.push({ cells: cornerCells(p, r, c), min: v, max: v, at: r * (C + 1) + c,
        why: (x) => (x === YES ? `This ${v} needs every open cell around it shaded.`
          : v === 0 ? 'A 0 means no shaded cells around this corner.' : `This ${v} already has ${v} shaded cell${v === 1 ? '' : 's'} around it.`) });
    }
    return { N: R * C, cons, check: (s) => Binary.canConnect(R, C, s, NO) };
  }

  function generate(n) {
    for (let t = 0; t < 60; t++) {
      const R = n, C = n;
      const p = { R, C, clues: new Int8Array((R + 1) * (C + 1)).fill(-1) };
      const sol = Binary.randomFill(model(p), 0.45, 5);
      if (!sol) continue;
      for (let r = 0; r <= R; r++) for (let c = 0; c <= C; c++) {
        p.clues[r * (C + 1) + c] = cornerCells(p, r, c).filter((k) => sol[k] === YES).length;
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
    const svg = el('svg', { width: C * s + 2 * m, height: R * s + 2 * m, class: 'ck-board' + (readonly ? ' readonly' : '') });
    const g = el('g', { transform: `translate(${m} ${m})` }, svg);
    const hintCells = new Set(hint ? hint.cells : []);
    for (let k = 0; k < R * C; k++) {
      const x = (k % C) * s, y = Math.floor(k / C) * s;
      const v = result ? solution[k] : state[k];
      let cls = 'ck-cell' + (v === YES ? ' shaded' : '');
      if (hintCells.has(k)) cls += ' hint';
      if (result && state[k]) cls += state[k] === solution[k] ? ' ok' : ' bad';
      else if (result && solution[k] === YES) cls += ' miss'; // not entered yet
      const cell = el('rect', { x, y, width: s, height: s, class: cls }, g);
      if (v === NO && !result) el('circle', { cx: x + s / 2, cy: y + s / 2, r: s * 0.08, class: 'ck-dot' }, g);
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
      el('circle', { cx: c * s, cy: r * s, r: s * 0.22, class: 'ck-clue' + (hint && hint.at === r * (C + 1) + c ? ' hint' : '') }, g);
      const t = el('text', { x: c * s, y: r * s, 'font-size': s * 0.3, class: 'ck-num' }, g);
      t.textContent = v;
    }
    return svg;
  }

  PuzzleShell.start({
    id: 'creek',
    name: 'Creek',
    rules: 'Shade some cells. A number on a corner tells how many of the (up to four) cells around it are shaded. ' +
      'All white cells must stay connected (by sides).',
    controls: 'Click a cell to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'The creek flows freely — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.clues, (v) => (v < 0 ? '.' : v)).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
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
    check: (p, s) => s.every((v, k) => (v === YES) === (p.solution[k] === YES)),
    hints: (p, s) => Binary.hints(model(p), s, p.solution, 'shaded cell', 'white cell'),
    applyHint(p, s, h) { for (const k of h.cells) s[k] = h.v; },
  });
})();
