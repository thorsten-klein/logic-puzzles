// Shared code for loop puzzles with white and black circles that judge
// the straight legs of the loop at each circle (Shingoki, Balance Loop).
// A number in a circle is the sum of both legs. Built on Loop.
// Exposes the global `LegLoop`.
//
// cfg: id, name, rules, size, solvedText
//   kindOf(turn, a, b)   'w' or 'b' for a loop cell (legs a, b), or ''
//   noNumbers            circles never get numbers (Masyu)
//   allowSearch          accept puzzles the full solver proves unique
//   step(p, g, s, log)   optional deductions: false, 0, or edges set
//   loopFill, thinLoop   shape of the random loop (see Loop.randomLoop)
//   fits(kind, info, k, g, s)  false if the circle can not be right.
//                        info = Loop.legs(g, s, k)

const LegLoop = (() => {
  const { LINE, CROSS } = Loop;

  function model(cfg, p) {
    const { R, C, kind, num } = p;
    const g = Loop.grid(R, C);
    const must = Uint8Array.from(kind, (x) => (x ? 1 : 0));
    // The game's own step, then every clue. Returns -1 when a clue is
    // broken, else what the game's step set (or 0).
    function rule(s, log) {
      if (cfg.step) {
        const r = cfg.step(p, g, s, log);
        if (r !== 0) return r;
      }
      for (let k = 0; k < R * C; k++) {
        if (kind[k] && !clueFits(cfg, kind[k], num[k], Loop.legs(g, s, k), k, g, s)) return -1;
      }
      return 0;
    }
    return { g, must, rule };
  }

  // A clue at cell k still fits: its kind, and its number against the
  // leg lengths so far (exact once both legs are final).
  function clueFits(cfg, kind, v, info, k, g, s) {
    if (!cfg.fits(kind, info, k, g, s)) return false;
    const { legs, dirs } = info;
    if (!(v > 0 && legs.length)) return true;
    const low = legs.reduce((t, l) => t + l.len, 0) + (2 - legs.length);
    if (low > v) return false;
    return !(dirs.length === 2 && legs.every((l) => l.final) && low !== v);
  }

  // Leg lengths at loop cell k of a full loop.
  function legsOf(g, s, k) {
    const info = Loop.legs(g, s, k);
    return info.dirs.length === 2 ? { turn: info.turn, a: info.legs[0].len, b: info.legs[1].len } : null;
  }

  function generate(cfg, n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const loop = Loop.randomLoop(n, n, cfg.loopFill || 0.5, !!cfg.thinLoop);
      if (!loop) continue;
      const p = { R: n, C: n, ...cluesOf(cfg, n, loop) };
      if (!solvedOnce(cfg, p)) continue;
      thinCircles(cfg, p, deadline);
      p.solution = loop;
      return p;
    }
    return null;
  }

  // Circles (kind) and numbers for every loop cell the game marks.
  function cluesOf(cfg, n, loop) {
    const g = Loop.grid(n, n);
    const kind = new Array(n * n).fill(''), num = new Int8Array(n * n);
    for (let k = 0; k < n * n; k++) {
      const L = legsOf(g, loop, k);
      if (!L) continue;
      kind[k] = cfg.kindOf(L.turn, L.a, L.b);
      if (kind[k] && !cfg.noNumbers) num[k] = Math.min(L.a + L.b, 35);
    }
    return { kind, num };
  }

  // Unique by logic; with cfg.allowSearch also when the full solver
  // proves it after logic gets stuck.
  function solvedOnce(cfg, p) {
    if (Loop.solvedBy(Loop.logicSolve(model(cfg, p)))) return true;
    if (!cfg.allowSearch) return false;
    const r = Loop.solve(model(cfg, p), 2, 3000);
    return r.solutions.length === 1 && !r.capped;
  }

  // Drop whole circles, then numbers, while the puzzle stays unique.
  function thinCircles(cfg, p, deadline) {
    const { kind, num } = p;
    for (const k of PuzzleShell.shuffle([...new Array(p.R * p.C).keys()])) {
      if (!kind[k]) continue;
      const keep = [kind[k], num[k]];
      kind[k] = ''; num[k] = 0;
      if (solvedOnce(cfg, p)) continue;
      kind[k] = keep[0];
      if (!solvedOnce(cfg, p)) num[k] = keep[1];
      if (Date.now() > deadline + 4000) break;
    }
  }

  function startGame(cfg) {
    Loop.startGame({
      id: cfg.id, name: cfg.name, rules: cfg.rules, size: cfg.size, solvedText: cfg.solvedText,
      generate: (n) => generate(cfg, n),
      encode: (p) => ({ r: p.R, c: p.C, k: p.kind.map((x) => x || '.').join(''), n: Array.from(p.num, (v) => v.toString(36)).join('') }),
      decode(d) {
        const R = d?.r, C = d?.c;
        if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
        if (typeof d.k !== 'string' || d.k.length !== R * C || !/^[.wb]+$/.test(d.k)) throw new Error('Invalid circles');
        if (typeof d.n !== 'string' || d.n.length !== R * C) throw new Error('Invalid numbers');
        return { R, C, kind: Array.from(d.k, (ch) => (ch === '.' ? '' : ch)), num: Int8Array.from(d.n, (ch) => Number.parseInt(ch, 36) || 0) };
      },
      model: (p) => model(cfg, p),
      drawOnTop: true,
      drawCell: (p) => (svg, k, x, y, s) => {
        if (!p.kind[k]) return;
        const NS = 'http://www.w3.org/2000/svg';
        const o = document.createElementNS(NS, 'circle');
        o.setAttribute('cx', x);
        o.setAttribute('cy', y);
        o.setAttribute('r', s * 0.3);
        o.setAttribute('class', p.kind[k] === 'b' ? 'll-black' : 'll-white');
        svg.appendChild(o);
        if (!p.num[k]) return;
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x);
        t.setAttribute('y', y);
        t.setAttribute('font-size', s * 0.32);
        t.setAttribute('class', p.kind[k] === 'b' ? 'll-num on-black' : 'll-num');
        t.textContent = p.num[k];
        svg.appendChild(t);
      },
    });
  }

  return { startGame, model, LINE, CROSS };
})();
