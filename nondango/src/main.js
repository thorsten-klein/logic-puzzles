// Nondango. Colour every circle black or white. Each region has exactly
// one black circle. Three circles in a row (across, down or diagonal)
// never all have the same colour. Built on the shared Binary page
// (YES = black circle; cells without a circle are fixed).

(() => {
  const { UNKNOWN, YES, NO } = Binary;

  function groups(region) {
    const out = [];
    region.forEach((g, k) => { (out[g] = out[g] || []).push(k); });
    return out;
  }

  function model(p) {
    const { R, C, region, circle } = p;
    const cons = [];
    for (let k = 0; k < R * C; k++) if (!circle[k]) cons.push({ cells: [k], min: 0, max: 0 });
    groups(region).forEach((cells) => {
      const circles = cells.filter((k) => circle[k]);
      cons.push({ cells: circles, min: 1, max: 1, area: cells,
        why: (v) => (v === YES ? 'This region needs one black circle, and only this circle is left.' : 'This region already has its black circle.') });
    });
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const cells = [0, 1, 2].map((i) => [r + dr * i, c + dc * i]);
        if (cells.some(([a, b]) => a < 0 || b < 0 || a >= R || b >= C)) continue;
        const ks = cells.map(([a, b]) => a * C + b);
        if (!ks.every((k) => circle[k])) continue;
        cons.push({ cells: ks, min: 1, max: 2, area: ks,
          why: (v) => `Three ${v === YES ? 'white' : 'black'} circles in a row are not allowed. This one is ${v === YES ? 'black' : 'white'}.` });
      }
    }
    return { N: R * C, cons };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const seeds = PuzzleShell.shuffle([...Array(N).keys()]).slice(0, Math.round(N / 3.5));
      const region = PuzzleShell.growRegions(R, C, seeds.map((k) => [k]));
      const circle = Uint8Array.from({ length: N }, () => (Math.random() < 0.65 ? 1 : 0));
      if (groups(region).some((cells) => !cells.some((k) => circle[k]))) continue;
      const p = { R, C, region, circle };
      const sol = Binary.randomFill(model(p), 0.3, 3);
      if (!sol) continue;
      const s = Binary.logicSolve(model(p));
      if (!s || s.includes(UNKNOWN)) continue;
      p.solution = sol;
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'nondango',
    name: 'Nondango',
    rules: 'Colour every circle black or white. Each outlined region holds exactly one black circle. ' +
      'Three circles next to each other in a line (across, down or diagonal) never all have the same colour.',
    controls: 'Click a circle to make it black, click again for white. Right click cycles the other way.',
    size: { min: 5, max: 7, def: 6 },
    solvedText: 'Dango on every stick — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.region, (v) => v.toString(36).padStart(2, '0')).join(''), o: Array.from(p.circle).join('') }),
    decode(d) {
      const R = d && d.r, C = d && d.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid regions');
      if (typeof d.o !== 'string' || d.o.length !== R * C || !/^[01]+$/.test(d.o)) throw new Error('Invalid circles');
      return { R, C, region: Int32Array.from({ length: R * C }, (_, k) => parseInt(d.g.slice(2 * k, 2 * k + 2), 36)), circle: Uint8Array.from(d.o, Number) };
    },
    model,
    fixed: (p, k) => (p.circle[k] ? 0 : NO),
    draw(p, k, el) {
      PuzzleShell.regionBorders(el, k, p.region, p.R, p.C);
      if (p.circle[k]) el.classList.add('circ');
    },
    noun: 'black circle', noNoun: 'white circle',
    className: 'pz-regions nd-board', yesClass: 'black', noClass: 'white',
  });
})();
