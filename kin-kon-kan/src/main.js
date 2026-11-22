// Kin-Kon-Kan. Put exactly one mirror (/ or \) in each room. A beam sent
// in at a lettered edge spot comes out at the spot with the same letter,
// and the number tells how many mirrors it bounces off on the way. Every
// mirror bounces at least one of these beams.
// p.clues: per edge spot (top 0..n-1, bottom n.., left 2n.., right 3n..)
// null or [letter index, bounces]. Cells: 0 none, 1 '/', 2 '\'.

(() => {
  const LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function entry(n, pos) {
    const side = Math.floor(pos / n), i = pos % n;
    if (side === 0) return [0, i, 1, 0];
    if (side === 1) return [n - 1, i, -1, 0];
    if (side === 2) return [i, 0, 0, 1];
    return [i, n - 1, 0, -1];
  }
  // Follow a beam. known(k) false: stop with null. Returns { exit, bounces, hit }.
  function trace(n, mir, known, pos) {
    let [r, c, dr, dc] = entry(n, pos);
    let bounces = 0;
    const hit = [];
    // A beam from the edge always leaves again (its path can be walked
    // back), so this loop ends.
    for (;;) {
      if (r < 0) return { exit: c, bounces, hit };
      if (r >= n) return { exit: n + c, bounces, hit };
      if (c < 0) return { exit: 2 * n + r, bounces, hit };
      if (c >= n) return { exit: 3 * n + r, bounces, hit };
      const k = r * n + c;
      if (!known(k)) return null;
      if (mir[k] === 1) { [dr, dc] = [-dc, -dr]; bounces++; hit.push(k); }
      else if (mir[k] === 2) { [dr, dc] = [dc, dr]; bounces++; hit.push(k); }
      r += dr; c += dc;
    }
  }

  function prepare(p) {
    p.rooms = [];
    p.room.forEach((g, k) => { p.rooms[g] ??= []; p.rooms[g].push(k); });
    p.partner = new Int32Array(4 * p.n).fill(-1);
    p.clues.forEach((x, i) => {
      if (!x) return;
      p.clues.forEach((y, j) => { if (j !== i && y && y[0] === x[0]) p.partner[i] = j; });
    });
    return p;
  }

  function solve(p, stopAt = 2, maxNodes = 200000) {
    const { n, room, rooms, clues, partner } = p;
    const mir = new Uint8Array(n * n);
    const done = new Uint8Array(rooms.length);
    const out = [];
    let nodes = 0;
    const ok = (all) => {
      const known = (k) => done[room[k]];
      const hits = new Set();
      for (let i = 0; i < 4 * n; i++) {
        if (!clues[i] || partner[i] < i) continue;
        const t = trace(n, mir, known, i);
        if (!t) continue;
        if (t.exit !== partner[i] || t.bounces !== clues[i][1]) return false;
        t.hit.forEach((k) => hits.add(k));
      }
      if (all) for (let k = 0; k < n * n; k++) if (mir[k] && !hits.has(k)) return false;
      return true;
    };
    (function rec(g) {
      if (out.length >= stopAt || ++nodes > maxNodes) return;
      if (g === rooms.length) { if (ok(true)) { out.push(Uint8Array.from(mir)); } return; }
      for (const k of rooms[g]) for (const v of [1, 2]) {
        mir[k] = v;
        done[g] = 1;
        if (ok(false)) rec(g + 1);
        done[g] = 0;
        mir[k] = 0;
      }
    })(0);
    return { solutions: out, capped: nodes > maxNodes };
  }

  function generate(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const N = n * n;
      const seeds = PuzzleShell.shuffle([...new Array(N).keys()]).slice(0, Math.round(N / 5));
      const room = PuzzleShell.growRegions(n, n, seeds.map((k) => [k]));
      const rooms = [];
      room.forEach((g, k) => { rooms[g] ??= []; rooms[g].push(k); });
      const mir = new Uint8Array(N);
      for (const cells of rooms) mir[cells[Math.floor(Math.random() * cells.length)]] = 1 + Math.floor(Math.random() * 2);
      // All beams with at least one bounce, each pair once.
      const pairs = [];
      const hits = new Set();
      for (let i = 0; i < 4 * n; i++) {
        const t = trace(n, mir, () => true, i);
        if (!t || t.exit < i || !t.bounces) continue;
        pairs.push([i, t.exit, t.bounces]);
        t.hit.forEach((k) => hits.add(k));
      }
      if (rooms.some((cells) => !cells.some((k) => mir[k] && hits.has(k)))) continue;
      const make = (list) => {
        const clues = new Array(4 * n).fill(null);
        list.forEach(([a, b, m], i) => { clues[a] = [i, m]; clues[b] = [i, m]; });
        return prepare({ n, room, clues });
      };
      let list = pairs;
      const unique = (l) => { const r = solve(make(l), 2, 20000); return r.solutions.length === 1 && !r.capped; };
      if (!unique(list)) continue;
      // Every mirror must stay hit by a kept beam.
      const allHit = (l) => {
        const h = new Set();
        for (const [a] of l) trace(n, mir, () => true, a).hit.forEach((k) => h.add(k));
        return rooms.every((cells) => cells.some((k) => mir[k] && h.has(k)));
      };
      for (const pr of PuzzleShell.shuffle(pairs.slice())) {
        const t = list.filter((x) => x !== pr);
        if (allHit(t) && unique(t)) list = t;
        if (Date.now() > deadline + 3000) break;
      }
      // Letters in reading order around the board.
      list.sort((a, b) => a[0] - b[0]);
      const p = make(list);
      p.solution = mir;
      return p;
    }
    return null;
  }

  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, parent) => {
    const e = document.createElementNS(NS, name);
    for (const a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  };

  function render(p, state, opts = {}) {
    const { n, room, clues, solution } = p;
    const { readonly, result, hint, onChange } = opts;
    const s = Math.max(28, Math.min(46, Math.floor((Math.min(window.innerWidth, 900) - 40) / (n + 2))));
    const W = (n + 2) * s;
    const svg = el('svg', { width: W, height: W, class: 'gx-board pt-board' + (readonly ? ' readonly' : '') });
    const g = el('g', {}, svg);
    const o = s;
    const hintSet = new Set(hint ? hint.cells : []);
    for (let k = 0; k < n * n; k++) {
      const x = o + (k % n) * s, y = o + Math.floor(k / n) * s;
      el('rect', { x, y, width: s, height: s, class: 'gx-bg kk-cell' + (hintSet.has(k) ? ' hint' : '') }, g);
    }
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const k = r * n + c;
      if (c < n - 1) el('line', { x1: o + (c + 1) * s, y1: o + r * s, x2: o + (c + 1) * s, y2: o + (r + 1) * s, class: room[k] !== room[k + 1] ? 'gx-wall' : 'gx-grid' }, g);
      if (r < n - 1) el('line', { x1: o + c * s, y1: o + (r + 1) * s, x2: o + (c + 1) * s, y2: o + (r + 1) * s, class: room[k] !== room[k + n] ? 'gx-wall' : 'gx-grid' }, g);
    }
    el('rect', { x: o, y: o, width: n * s, height: n * s, class: 'gx-frame', fill: 'none' }, g);
    // Edge labels.
    clues.forEach((x, i) => {
      if (!x) return;
      const side = Math.floor(i / n), j = i % n;
      // Label spot by side: top, bottom, left, right.
      const [cx, cy] = [
        [o + j * s + s / 2, s / 2],
        [o + j * s + s / 2, o + n * s + s / 2],
        [s / 2, o + j * s + s / 2],
        [o + n * s + s / 2, o + j * s + s / 2],
      ][side];
      el('text', { x: cx, y: cy, 'font-size': s * 0.38, class: 'pt-clue kk-label' }, g).textContent = LET[x[0]] + x[1];
    });
    for (let k = 0; k < n * n; k++) {
      const x = o + (k % n) * s, y = o + Math.floor(k / n) * s, d = s * 0.18;
      const v = result ? solution[k] : state[k];
      if (v) {
        let cls = '';
        if (result) cls = ' ' + PuzzleShell.resultClass(state[k], solution[k]);
        const [a, b] = v === 1 ? [[x + d, y + s - d], [x + s - d, y + d]] : [[x + d, y + d], [x + s - d, y + s - d]];
        el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'kk-mirror' + cls }, g);
      } else if (result && state[k]) {
        el('circle', { cx: x + s / 2, cy: y + s / 2, r: s * 0.1, class: 'kk-dot bad' }, g); // a mirror where none is
      }
      if (!readonly) {
        const hit = el('rect', { x, y, width: s, height: s, fill: 'transparent' }, g);
        hit.style.cursor = 'pointer';
        const cycle = (step) => { state[k] = (state[k] + step) % 3; onChange(); };
        hit.addEventListener('click', () => cycle(1));
        hit.addEventListener('contextmenu', (ev) => { ev.preventDefault(); cycle(2); });
      }
    }
    return svg;
  }

  function hints(p, state) {
    for (let k = 0; k < state.length; k++) {
      if (state[k] && state[k] !== p.solution[k]) return [{ cells: [k], v: 0, reason: 'This mirror is wrong.' }];
    }
    const k = p.solution.findIndex((v, i) => v && !state[i]);
    return k < 0 ? [] : [{ cells: [k], v: p.solution[k], reason: 'No simple step is left. This room\'s mirror is here.' }];
  }

  PuzzleShell.start({
    id: 'kin-kon-kan',
    name: 'Kin-Kon-Kan',
    rules: 'Put exactly one mirror (/ or \\) in each outlined room. A beam sent in at a lettered spot on the edge comes out ' +
      'at the other spot with the same letter, and the number tells how many mirrors it bounces off on the way. Every ' +
      'mirror bounces at least one of these beams.',
    controls: 'Click a cell to cycle: /, \\, empty. Right click cycles back.',
    size: { min: 4, max: 6, def: 5 },
    solvedText: 'Every beam on target — nicely done.',
    generate,
    encode: (p) => ({ n: p.n, g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''),
      c: p.clues.map((x) => (x ? LET[x[0]] + x[1] : '')).join(',') }),
    decode(d) {
      const n = d?.n;
      if (!Number.isInteger(n) || n < 3 || n > 12) throw new Error('Invalid board size');
      if (typeof d.g !== 'string' || d.g.length !== 2 * n * n) throw new Error('Invalid rooms');
      const room = Int32Array.from({ length: n * n }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
      const parts = String(d.c).split(',');
      if (parts.length !== 4 * n) throw new Error('Invalid clues');
      const clues = parts.map((t) => (t ? [LET.indexOf(t[0]), Number(t.slice(1))] : null));
      const p = prepare({ n, room, clues });
      const res = solve(p, 2);
      if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
      p.solution = res.solutions[0];
      return p;
    },
    newState: (p) => new Uint8Array(p.n * p.n),
    saveState: (s) => Array.from(s).join(''),
    loadState(p, v) {
      const s = new Uint8Array(p.n * p.n);
      if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % 3;
      return s;
    },
    render,
    check: (p, s) => s.every((v, k) => v === p.solution[k]),
    hints,
    applyHint(p, s, h) { for (const k of h.cells) s[k] = h.v; },
  });
})();
