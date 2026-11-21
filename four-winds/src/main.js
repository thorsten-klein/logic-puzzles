// Four Winds (Line Game). Same rules as Walls: every white cell gets a
// horizontal or vertical line that runs out from a numbered black cell.
// A number counts the white cells its lines cover.
// Built on the shared Binary page: YES = horizontal, NO = vertical.

(() => {
  const { UNKNOWN, YES, NO } = Binary;
  const DIRS = [[0, -1, YES], [0, 1, YES], [-1, 0, NO], [1, 0, NO]];

  function model(p) {
    const { R, C, black } = p;
    const N = R * C;
    const isBlack = (k) => black[k] >= 0;
    const ray = (k, [dr, dc]) => {
      const out = [];
      let r = Math.floor(k / C) + dr, c = (k % C) + dc;
      while (r >= 0 && c >= 0 && r < R && c < C && !isBlack(r * C + c)) { out.push(r * C + c); r += dr; c += dc; }
      return out;
    };
    const cons = [];
    const arms = [];
    for (let k = 0; k < N; k++) {
      if (!isBlack(k)) continue;
      cons.push({ cells: [k], min: 0, max: 0 });
      arms.push([k, DIRS.map((d) => [ray(k, d), d[2]])]);
    }
    function propagate(s, log) {
      for (const [k, dirs] of arms) {
        const v = black[k];
        const got = dirs.map(([cells, want]) => { let i = 0; while (i < cells.length && s[cells[i]] === want) { i++; } return i; });
        const can = dirs.map(([cells, want]) => { let i = 0; while (i < cells.length && s[cells[i]] !== (want === YES ? NO : YES)) { i++; } return i; });
        const min = got.reduce((a, b) => a + b, 0), max = can.reduce((a, b) => a + b, 0);
        if (min > v || max < v) return false;
        for (let d = 0; d < 4; d++) {
          const [cells, want] = dirs[d];
          const need = v - (max - can[d]);
          const forced = cells.slice(0, Math.max(0, need)).filter((j) => s[j] === UNKNOWN);
          if (forced.length) {
            for (const j of forced) s[j] = want;
            if (log) log.push({ cells: forced, v: want, at: k, reason: `This ${v} can not reach its total in the other directions. These lines must run out from it.` });
            return forced.length;
          }
          const most = v - (min - got[d]);
          const next = cells[got[d]];
          if (got[d] === most && next !== undefined && s[next] === UNKNOWN) {
            s[next] = want === YES ? NO : YES;
            if (log) log.push({ cells: [next], v: s[next], at: k, reason: `This ${v} already has enough length this way. The next cell turns the other way.` });
            return 1;
          }
        }
      }
      return 0;
    }
    // Every line must reach a black cell (through lines of its own kind).
    function check(s, done) {
      if (!done) return true;
      for (let k = 0; k < N; k++) {
        if (isBlack(k)) continue;
        const [d1, d2] = s[k] === YES ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
        const reaches = [d1, d2].some(([dr, dc]) => {
          let r = Math.floor(k / C) + dr, c = (k % C) + dc;
          while (r >= 0 && c >= 0 && r < R && c < C) {
            const j = r * C + c;
            if (isBlack(j)) return true;
            if (s[j] !== s[k]) return false;
            r += dr; c += dc;
          }
          return false;
        });
        if (!reaches) return false;
      }
      return true;
    }
    return { N, cons, propagate, check };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const R = n, C = n, N = R * C;
      const black = new Int8Array(N).fill(-1);
      for (let k = 0; k < N; k++) if (Math.random() < 0.18) black[k] = 0;
      const s = Uint8Array.from({ length: N }, (_, k) => (black[k] >= 0 ? NO : Math.random() < 0.5 ? YES : NO));
      const p = { R, C, black };
      // Flip unattached lines until all reach a black cell (or give up).
      const m = model(p);
      for (let it = 0; it < 50 && !m.check(s, true); it++) {
        for (let k = 0; k < N; k++) {
          if (black[k] >= 0) continue;
          const t = Uint8Array.from(s); t[k] = s[k] === YES ? NO : YES;
          const ok = (x) => {
            const [d1, d2] = x[k] === YES ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
            return [d1, d2].some(([dr, dc]) => {
              let r = Math.floor(k / C) + dr, c = (k % C) + dc;
              while (r >= 0 && c >= 0 && r < R && c < C) {
                const j = r * C + c;
                if (black[j] >= 0) return true;
                if (x[j] !== x[k]) return false;
                r += dr; c += dc;
              }
              return false;
            });
          };
          if (!ok(s) && ok(t)) s[k] = t[k];
        }
      }
      if (!m.check(s, true)) continue;
      // An answer with no across line would count as solved on an empty board.
      if (!s.some((v, k) => black[k] < 0 && v === YES)) continue;
      // Numbers: total attached length.
      for (let k = 0; k < N; k++) {
        if (black[k] < 0) continue;
        let v = 0;
        for (const [dr, dc, want] of DIRS) {
          let r = Math.floor(k / C) + dr, c = (k % C) + dc;
          while (r >= 0 && c >= 0 && r < R && c < C && black[r * C + c] < 0 && s[r * C + c] === want) { v++; r += dr; c += dc; }
        }
        black[k] = v;
      }
      const t = Binary.logicSolve(model(p));
      if (!t || t.includes(UNKNOWN)) continue;
      p.solution = Uint8Array.from(s, (v, k) => (black[k] >= 0 ? NO : v));
      return p;
    }
    return null;
  }

  Binary.startGame({
    id: 'four-winds',
    name: 'Four Winds',
    rules: 'Draw a horizontal or a vertical line in every white cell. Lines run straight out from the numbered black cells, ' +
      'like winds blowing in four directions. A number tells how many white cells its lines cover in total. Lines never ' +
      'pass through another black cell, and every line comes from a number.',
    controls: 'Click a cell for a horizontal line, again for a vertical line, again to clear. Right click cycles the other way.',
    size: { min: 4, max: 8, def: 6 },
    solvedText: 'The winds have settled — nicely done.',
    generate,
    encode: (p) => ({ r: p.R, c: p.C, g: Array.from(p.black, (v) => (v < 0 ? '..' : v.toString(36).padStart(2, '0'))).join('') }),
    decode(d) {
      const R = d?.r, C = d?.c;
      if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid grid');
      return { R, C, black: Int16Array.from({ length: R * C }, (_, k) => (d.g[2 * k] === '.' ? -1 : Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36))) };
    },
    model,
    fixed: (p, k) => (p.black[k] >= 0 ? NO : 0),
    draw(p, k, el, v) {
      if (p.black[k] >= 0) { el.textContent = p.black[k]; el.classList.add('wall-num'); return; }
      if (v === YES) el.classList.add('h-line');
      if (v === NO) el.classList.add('v-line');
    },
    noun: 'horizontal line', noNoun: 'vertical line',
    className: 'wl-board', yesClass: 'hl', noClass: 'vl',
  });
})();
