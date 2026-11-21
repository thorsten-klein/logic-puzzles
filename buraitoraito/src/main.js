// Buraitoraito. Place stars in white cells. A number in a black cell
// counts the stars it sees in its row and column; black cells block the
// view. Built on the shared Binary game page (YES = star).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function seen(p, k) {
    const { R, C, black } = p;
    const r = Math.floor(k / C), c = k % C, out = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      let nr = r + dr, nc = c + dc;
      while (nr >= 0 && nc >= 0 && nr < R && nc < C && black[nr * C + nc] < 0) {
        out.push(nr * C + nc);
        nr += dr; nc += dc;
      }
    }
    return out;
  }

  function model(p) {
    const { R, C, black } = p;
    const cons = [];
    for (let k = 0; k < R * C; k++) {
      const v = black[k];
      if (v < 0) continue;
      cons.push({ cells: [k], min: 0, max: 0 }, { cells: seen(p, k), min: v, max: v, at: k,
        why: (x) => (x === YES ? `This ${v} needs a star in every open cell it sees.`
          : v === 0 ? 'This 0 sees no stars. Every cell it sees is empty.'
            : `This ${v} already sees ${v} star${v === 1 ? '' : 's'}. The other cells it sees are empty.`) });
    }
    return { N: R * C, cons };
  }

  function tryOnce(n) {
    const R = n, C = n, N = R * C;
    const black = new Int8Array(N).fill(-1);
    const count = Math.round(N * (0.24 + Math.random() * 0.06));
    for (const k of PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, count)) black[k] = 0;
    const p = { R, C, black };
    // Every white cell must be seen by some black cell.
    const lit = new Uint8Array(N);
    for (let k = 0; k < N; k++) if (black[k] >= 0) for (const j of seen(p, k)) lit[j] = 1;
    if ([...lit].some((v, k) => !v && black[k] < 0)) return null;
    const star = Uint8Array.from({ length: N }, (_, k) => (black[k] < 0 && Math.random() < 0.3 ? 1 : 0));
    for (let k = 0; k < N; k++) if (black[k] >= 0) black[k] = seen(p, k).filter((j) => star[j]).length;
    const s = Binary.logicSolve(model(p));
    if (!s || s.includes(UNKNOWN)) return null;
    p.solution = Uint8Array.from(star, (x) => (x ? YES : NO));
    return p;
  }

  Binary.startGame({
    id: 'buraitoraito',
    name: 'Buraitoraito',
    rules: 'Place stars in white cells. A number in a black cell tells how many stars it sees in its row and column. ' +
      'Black cells block the view.',
    controls: 'Click a cell to place a star, click again to mark it empty. Right click cycles the other way.',
    size: { min: 5, max: 10, def: 7 },
    solvedText: 'Bright lights everywhere — nicely done.',
    generate(n) {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) { const p = tryOnce(n); if (p) return p; }
      return null;
    },
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.black, (v) => (v < 0 ? '.' : v.toString(36))).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid grid');
      return { R, C, black: Int8Array.from(d.g, (ch) => (ch === '.' ? -1 : Number.parseInt(ch, 36))) };
    },
    model,
    fixed: (p, k) => (p.black[k] >= 0 ? NO : 0),
    draw(p, k, el) { if (p.black[k] >= 0) { el.textContent = p.black[k]; el.classList.add('wall'); } },
    noun: 'star', noNoun: 'empty cell',
    className: 'br-board', yesClass: 'star', noClass: 'dot',
  });
})();
