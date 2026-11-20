// Arrow Web. Every cell holds an arrow. Shade some arrows so that each
// arrow in the grid points at exactly one shaded arrow (somewhere along
// its line). Built on the shared Binary game page (YES = shaded).

(() => {
  const { UNKNOWN, YES, NO } = Binary;
  const DIRS = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];

  const ray = (R, C, k, d) => {
    const [dr, dc] = DIRS[d], out = [];
    let r = Math.floor(k / C) + dr, c = (k % C) + dc;
    while (r >= 0 && c >= 0 && r < R && c < C) { out.push(r * C + c); r += dr; c += dc; }
    return out;
  };

  function model(p) {
    const { R, C, dir } = p;
    const cons = [];
    for (let k = 0; k < R * C; k++) {
      cons.push({ cells: ray(R, C, k, dir[k]), min: 1, max: 1, at: k,
        why: (v) => (v === YES ? 'This arrow must point at one shaded arrow, and only this one is left on its line.'
          : 'This arrow already points at a shaded arrow. The rest of its line stays white.') });
    }
    return { N: R * C, cons };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const shade = Uint8Array.from({ length: N }, () => (Math.random() < 0.25 ? 1 : 0));
      const dir = new Int8Array(N);
      let ok = true;
      for (let k = 0; k < N && ok; k++) {
        const opts = [...Array(8).keys()].filter((d) => ray(R, C, k, d).filter((j) => shade[j]).length === 1);
        if (!opts.length) ok = false;
        else dir[k] = opts[Math.floor(Math.random() * opts.length)];
      }
      if (!ok) continue;
      const p = { R, C, dir };
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      p.solution = Uint8Array.from(shade, (x) => (x ? YES : NO));
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'arrow-web',
    name: 'Arrow Web',
    rules: 'Every cell holds an arrow. Shade some of the arrows so that each arrow in the grid points at exactly one ' +
      'shaded arrow somewhere along its line.',
    controls: 'Click an arrow to shade it, click again to mark it white. Right click cycles the other way.',
    size: { min: 4, max: 9, def: 6 },
    solvedText: 'The web holds — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, d: Array.from(p.dir).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.d !== 'string' || d.d.length !== R * C || !/^[0-7]+$/.test(d.d)) throw new Error('Invalid arrows');
      return { R, C, dir: Int8Array.from(d.d, Number) };
    },
    model,
    draw(p, k, el) { el.append(PuzzleShell.arrowIcon(p.dir[k])); },
    noun: 'shaded arrow', noNoun: 'white arrow',
    className: 'aw-board',
  });
})();
