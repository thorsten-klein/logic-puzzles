// Shared solver for yes/no cell puzzles (Tents, Star Battle, ...).
// Exposes the global `Binary`.
//
// A model is { N, cons, check }:
//   N      number of cells
//   cons   count rules: { cells, min, max, why } — between min and max
//          of `cells` are YES. `why` is a hint text (optional).
//          With `w` (weights per cell) the YES weights are summed instead.
//   check  optional (state, done) -> false if the state is broken.
//          `done` is true when no cell is unknown.
//   propagate  optional (state, log) -> -1 on contradiction, else the
//          number of cells it set. For game rules that are not counts.
//          Log entries are { cells, v, reason }.
// Cell states: 0 = unknown, 1 = yes, 2 = no.

const Binary = (() => {
  const UNKNOWN = 0, YES = 1, NO = 2;
  // A step result that means "contradiction": -1 (or false, the old form).
  const failed = (r) => r === false || r < 0;

  // One pass over the count rules. Returns -1 on contradiction,
  // else the number of cells set. `log` gets { con, cells, v }, and
  // { con, fail: true } for the broken rule.
  function step(model, s, log) {
    let set = 0;
    for (const con of model.cons) {
      const r = con.w ? weightedStep(con, s, log) : countStep(con, s, log);
      if (failed(r)) { if (log) { log.push({ con, fail: true }); } return -1; }
      set += r;
    }
    return set;
  }

  // Count rule: between con.min and con.max of con.cells are YES.
  // Returns -1 if broken, else the number of cells set.
  function countStep(con, s, log) {
    let yes = 0;
    const open = [];
    for (const k of con.cells) {
      if (s[k] === YES) yes++;
      else if (s[k] === UNKNOWN) open.push(k);
    }
    if (yes > con.max || yes + open.length < con.min) return -1;
    if (!open.length) return 0;
    let v = 0;
    if (yes === con.max) v = NO;
    else if (yes + open.length === con.min) v = YES;
    if (!v) return 0;
    for (const k of open) s[k] = v;
    if (log) log.push({ con, cells: open, v });
    return open.length;
  }

  // Weighted rule: the YES cells' weights (con.w[i] for con.cells[i],
  // may be negative) sum to between min and max. `lo` / `hi` are the
  // smallest and largest sums still possible; a cell whose choice would
  // push them past the limits is forced the other way.
  function weightedStep(con, s, log) {
    let lo = 0, hi = 0;
    con.cells.forEach((k, i) => {
      const w = con.w[i];
      if (s[k] === YES) { lo += w; hi += w; } else if (s[k] === UNKNOWN) { if (w > 0) hi += w; else lo += w; }
    });
    if (lo > con.max || hi < con.min) return -1;
    const yes = [], no = [];
    con.cells.forEach((k, i) => {
      if (s[k] !== UNKNOWN) return;
      const w = con.w[i];
      // Range if this cell is YES / NO.
      const yesLo = w > 0 ? lo + w : lo, yesHi = w > 0 ? hi : hi + w;
      const noLo = w > 0 ? lo : lo - w, noHi = w > 0 ? hi - w : hi;
      const yesOk = yesLo <= con.max && yesHi >= con.min;
      const noOk = noLo <= con.max && noHi >= con.min;
      if (!yesOk && !noOk) yes.push(-1);
      else if (!yesOk) no.push(k);
      else if (!noOk) yes.push(k);
    });
    if (yes.includes(-1)) return -1;
    for (const k of no) s[k] = NO;
    for (const k of yes) s[k] = YES;
    if (log && no.length) log.push({ con, cells: no, v: NO });
    if (log && yes.length) log.push({ con, cells: yes, v: YES });
    return no.length + yes.length;
  }

  // Count rules to a fixed point, then the global check.
  function settle(model, s) {
    for (;;) {
      const r = step(model, s);
      if (failed(r)) return false;
      if (r > 0) continue;
      if (!model.propagate) break;
      const q = model.propagate(s);
      if (failed(q)) return false;
      if (q === 0) break;
    }
    return model.check?.(s, !s.includes(UNKNOWN)) !== false;
  }

  // Tries both values of each open cell. If one fails, the other is
  // forced. Sets the first such cell and returns { k, v }, else null.
  function lookahead(model, s) {
    for (let k = 0; k < model.N; k++) {
      if (s[k] !== UNKNOWN) continue;
      for (const v of [YES, NO]) {
        const t = Uint8Array.from(s);
        t[k] = v;
        if (!settle(model, t)) {
          s[k] = v === YES ? NO : YES;
          return { k, v: s[k], tried: v };
        }
      }
    }
    return null;
  }

  // Like lookahead, but for hints: finds the try that fails after the
  // fewest forced cells, so the player can follow it. `area` holds the
  // cells the try forced before it failed.
  function easiestDeadEnd(model, s) {
    let best = null;
    for (let k = 0; k < model.N; k++) {
      if (s[k] !== UNKNOWN) continue;
      for (const v of [YES, NO]) {
        const d = deadEndAt(model, s, k, v);
        if (d && (!best || d.area.length < best.area.length)) best = d;
      }
      if (best && !best.area.length) break;
    }
    return best;
  }

  // Trying value v in cell k: a dead end { k, v (the other value),
  // tried, area } if the rules break, else null.
  function deadEndAt(model, s, k, v) {
    const t = Uint8Array.from(s);
    t[k] = v;
    if (settle(model, t)) return null;
    const area = [];
    for (let j = 0; j < model.N; j++) if (j !== k && t[j] !== s[j]) area.push(j);
    return { k, v: v === YES ? NO : YES, tried: v, area };
  }

  function solve(model, stopAt = 2, maxNodes = 50000, start = null) {
    const solutions = [];
    let nodes = 0;
    (function rec(s) {
      if (solutions.length >= stopAt || ++nodes > maxNodes) return;
      if (!settle(model, s)) return;
      const pick = s.indexOf(UNKNOWN);
      if (pick < 0) { solutions.push(Uint8Array.from(s)); return; }
      for (const v of [YES, NO]) {
        const t = Uint8Array.from(s);
        t[pick] = v;
        rec(t);
      }
    })(start ? Uint8Array.from(start) : new Uint8Array(model.N));
    return { solutions, capped: nodes > maxNodes };
  }

  // Logic only: count rules plus look-ahead. Returns the state reached
  // (may hold unknowns) or null on contradiction.
  function logicSolve(model, start = null) {
    const s = start ? Uint8Array.from(start) : new Uint8Array(model.N);
    for (;;) {
      if (!settle(model, s)) return null;
      if (!lookahead(model, s)) return s;
    }
  }

  // Hints: wrong marks, then count-rule steps, then look-ahead steps.
  // `noun` names a YES cell, like "tent" or "star". `noNoun` names a NO
  // cell when it is a real value (like "0"); by default NO means empty.
  // `name(k)` names a cell like the board labels ("D2"). Without it, a
  // dead-end hint is one short line instead of the step-by-step list.
  function hints(model, state, solution, noun, noNoun = null, name = null) {
    const w = hintWords(noun, noNoun, name);
    const wrong = wrongMarks(model, state, solution, w);
    if (wrong.length) return wrong;
    const steps = ruleStepHints(model, state, w);
    if (steps.length) return steps;
    const dead = deadEndHint(model, state, w);
    if (dead) return [dead];
    const k = solution.findIndex((v, i) => state[i] === UNKNOWN && v === YES);
    if (k < 0) return [];
    return [{ cells: [k], v: YES, reason: `No simple step is left. ${w.a(noun)} goes here.`.replace('. a', '. A') }];
  }

  // Words for hint texts.
  function hintWords(noun, noNoun, name) {
    const a = (x) => (/^[aeiou8]/i.test(x) ? `an ${x}` : `a ${x}`);
    const names = (ks) => (ks.length > 1 ? `${ks.slice(0, -1).map(name).join(', ')} and ${name(ks.at(-1))}` : name(ks[0]));
    // "F2 is a white cell" / "E1 and G1 are white cells".
    const becomes = (ks, v) => {
      const x = v === YES ? noun : noNoun || 'empty cell';
      return ks.length > 1 ? `${names(ks)} are ${x}s` : `${name(ks[0])} is ${a(x)}`;
    };
    const why = (st) => st.reason || (st.con.why ? st.con.why(st.v) : '');
    // Reason as the end of a sentence: ", since the white clue at G1 …".
    const since = (text, at) => {
      if (!text) return '';
      let t = text.replace(/\.$/, '');
      t = t[0].toLowerCase() + t.slice(1);
      if (at != null) t = t.replace(/^this ((?:[a-z]+ )?(?:clue|room|number|cell|arrow))/, `the $1 at ${name(at)}`);
      return `, since ${t}`;
    };
    return { noun, noNoun, name, a, names, becomes, why, since };
  }

  // Marks that differ from the answer.
  function wrongMarks(model, state, solution, w) {
    const out = [];
    for (let k = 0; k < model.N; k++) {
      if (state[k] === UNKNOWN || state[k] === solution[k]) continue;
      let reason = `This cell is marked empty, but it needs ${w.a(w.noun)}.`;
      if (state[k] === YES) reason = `This ${w.noun} is wrong.`;
      else if (w.noNoun) reason = `This ${w.noNoun} is wrong.`;
      out.push({ cells: [k], v: solution[k], reason });
    }
    return out;
  }

  // One pass of the count rules, else of the game's own rule.
  function ruleStepHints(model, state, w) {
    const s = Uint8Array.from(state);
    const log = [];
    step(model, s, log);
    if (!log.length && model.propagate) model.propagate(s, log);
    return log.map((st) => {
      if (st.reason) return st;
      let why = `No ${w.noun} can go here.`;
      if (st.con.why) why = st.con.why(st.v);
      else if (st.v === YES) why = `These cells need ${w.a(w.noun)}.`;
      return { cells: st.cells, v: st.v, area: st.con.area, at: st.con.at, reason: why };
    });
  }

  // The easiest "try it and it fails" step, or null.
  function deadEndHint(model, state, w) {
    const la = easiestDeadEnd(model, state);
    if (!la) return null;
    const { a, noun, noNoun, name } = w;
    if (!name) {
      const ifNo = noNoun ? `${a(noNoun)} here` : 'Leaving this cell empty';
      const stays = noNoun ? `is ${a(noNoun)}` : 'stays empty';
      const reason = la.tried === YES
        ? `${a(noun)} here leads to a dead end, so this cell ${stays}.`
        : `${ifNo} leads to a dead end, so it needs ${a(noun)}.`;
      return { cells: [la.k], v: la.v, area: la.area, reason: reason.replace(/^a/, 'A') };
    }
    const beNo = noNoun ? `be ${a(noNoun)}` : 'stay empty';
    const end = la.tried === YES
      ? `That is not possible, so ${name(la.k)} must ${beNo}.`
      : `That is not possible, so ${name(la.k)} must be ${a(noun)}.`;
    return { cells: [la.k], v: la.v, area: la.area, reason: [...chainLines(model, state, w, la.k, la.tried), end].join('\n') };
  }

  // Replays a try step by step: what it forces, then the broken rule.
  function chainLines(model, state, w, k, v) {
    const t = Uint8Array.from(state);
    t[k] = v;
    const lines = [`Suppose ${w.becomes([k], v)}.`];
    const merge = { last: null };  // last step, to merge steps with the same reason
    for (let i = 0; i < 200; i++) {
      const log = [];
      let r = step(model, t, log);
      if (r === 0 && model.propagate) r = model.propagate(t, log);
      for (const st of log) chainStepLines(st, lines, merge, w);
      if (failed(r)) {
        if (!log.some((st) => st.fail)) lines.push('Now a rule is broken.');
        return lines;
      }
      if (r === 0) break;
    }
    if (model.check?.(t, !t.includes(UNKNOWN)) === false) lines.push('Now the rules can no longer all be met (for example, the cells can no longer connect).');
    return lines;
  }

  // The clue cell behind a step, if there is one.
  const clueAt = (st) => {
    if (st.at != null) return st.at;
    return st.con?.at ?? null;
  };

  // " at G1", " at E1 and F1", or nothing.
  function brokenWhere(st, at, w) {
    if (at != null) return ` at ${w.name(at)}`;
    return st.con ? ` at ${w.names(st.con.cells)}` : '';
  }

  // Adds the text line for one step of a try; merges steps that share
  // their reason into one line.
  function chainStepLines(st, lines, merge, w) {
    const at = clueAt(st);
    const text = w.why(st);
    if (st.fail) {
      const tail = text ? `: ${text}` : '.';
      lines.push(`Now a rule is broken${brokenWhere(st, at, w)}${tail}`);
      merge.last = null;
      return;
    }
    const last = merge.last;
    if (last && at == null && last.at == null && last.v === st.v && last.text === text) {
      last.cells.push(...st.cells);
      lines[lines.length - 1] = `Then ${w.becomes(last.cells, st.v)}${w.since(text, null)}.`;
      return;
    }
    lines.push(`Then ${w.becomes(st.cells, st.v)}${w.since(text, at)}.`);
    merge.last = { at, v: st.v, text, cells: [...st.cells] };
  }

  // Full game page for a yes/no puzzle on a grid. Config:
  //   id, name, rules, controls, size, solvedText   (see PuzzleShell)
  //   generate(n) -> puzzle with R, C, solution
  //   encode(p) / decode(d)   share data; decode returns p without solution
  //   model(p)                Binary model
  //   fixed(p, k)             0, or YES / NO for cells that are part of the puzzle
  //   draw(p, k, el, v, shown) optional: adds clue text etc. to a cell
  //                           (`shown` is the full state on screen)
  //   top(p) / left(p)        optional: clue arrays shown above / left
  //   noun, noNoun            hint words (see hints)
  //   className, cellMax      board CSS class and largest cell size
  //   yesClass, noClass       CSS classes for YES / NO cells
  //   below(p)                optional text shown under the board
  //   showFixedNo             also draw noClass on fixed NO cells
  function startGame(cfg) {
    const yesClass = cfg.yesClass || 'shaded', noClass = cfg.noClass || 'dot';
    const fixed = (p, k) => (cfg.fixed ? cfg.fixed(p, k) : 0);
    const full = (p, s) => Uint8Array.from(s, (v, k) => fixed(p, k) || v);

    function render(p, state, opts = {}) {
      const { R, C, solution } = p;
      const { readonly, result, hint, onChange } = opts;
      // Edge counts see given cells too.
      const withFixed = full(p, state);
      const top = cfg.top ? cfg.top(p, withFixed) : null, left = cfg.left ? cfg.left(p, withFixed) : null;
      const offR = top ? 1 : 0, offC = left ? 1 : 0;
      const hintCells = new Set(hint ? hint.cells : []);
      const area = new Set(hint?.area ? hint.area : []);
      const shown = result ? solution : full(p, state);
      // A count above or left of the board ([text, done] or text).
      const edgeClue = (el, r, c) => {
        el.className = 'clue' + (r < 0 ? ' clue-top' : ' clue-left');
        let item = null;
        if (r < 0 && c >= 0) item = top[c];
        else if (c < 0 && r >= 0) item = left[r];
        if (item == null) return;
        const [text, done] = Array.isArray(item) ? item : [item, false];
        el.textContent = text;
        if (done) el.classList.add('done');
      };
      // Marks of the result view: right, wrong, or not shaded yet.
      const resultMark = (el, k) => {
        if (state[k] !== UNKNOWN) el.classList.add(state[k] === solution[k] ? 'ok' : 'bad');
        else if (solution[k] === YES) el.classList.add('miss');
      };
      const gameCell = (el, k) => {
        el.dataset.cell = k;
        const f = fixed(p, k);
        const v = result ? solution[k] : f || state[k];
        if (v === YES) el.classList.add(yesClass);
        if (v === NO && (cfg.showFixedNo || (!f && !result))) el.classList.add(noClass);
        if (f) el.classList.add('fixed');
        if (cfg.draw) cfg.draw(p, k, el, v, shown);
        if (result && !f) resultMark(el, k);
        if (area.has(k)) el.classList.add('area');
        if (hintCells.has(k)) el.classList.add('hint');
      };
      const board = PuzzleShell.gridBoard({
        rows: R + offR, cols: C + offC, cellPx: PuzzleShell.fitCell(C + offC, cfg.cellMax || 42),
        className: `pz-board ${cfg.className || ''}`, readonly,
        renderCell(K, el) {
          const r = Math.floor(K / (C + offC)) - offR, c = (K % (C + offC)) - offC;
          if (r < 0 || c < 0) edgeClue(el, r, c);
          else gameCell(el, r * C + c);
        },
        onCell(K, ev) {
          const r = Math.floor(K / (C + offC)) - offR, c = (K % (C + offC)) - offC;
          if (r < 0 || c < 0) return;
          const k = r * C + c;
          if (fixed(p, k)) return;
          const order = ev.button === 2 ? [UNKNOWN, NO, YES] : [UNKNOWN, YES, NO];
          state[k] = order[(order.indexOf(state[k]) + 1) % 3];
          onChange();
        },
      });
      if (!cfg.below) return board;
      const wrap = document.createElement('div');
      wrap.className = 'board-with-note';
      const note = document.createElement('p');
      note.className = 'rules board-note';
      note.textContent = cfg.below(p);
      wrap.append(board, note);
      return wrap;
    }

    function isSolved(p, state) {
      const s = Uint8Array.from(full(p, state), (v) => (v === YES ? YES : NO));
      const m = cfg.model(p);
      for (const con of m.cons) {
        const weight = (i) => (con.w ? con.w[i] : 1);
        const y = con.cells.reduce((a, k, i) => a + (s[k] === YES ? weight(i) : 0), 0);
        if (y < con.min || y > con.max) return false;
      }
      if (failed(m.propagate?.(Uint8Array.from(s)))) return false;
      return m.check?.(s, true) !== false;
    }

    PuzzleShell.start({
      id: cfg.id, name: cfg.name, rules: cfg.rules, info: cfg.info, controls: cfg.controls, size: cfg.size,
      solvedText: cfg.solvedText,
      generate: cfg.generate,
      encode: cfg.encode,
      decode(d) {
        const p = cfg.decode(d);
        // Logic first; the full solver goes on from where logic stops.
        const m = cfg.model(p);
        const byLogic = logicSolve(m);
        if (!byLogic) throw new Error('Puzzle has no solution');
        if (!byLogic.includes(UNKNOWN) && (m.check?.(byLogic, true) !== false)) { p.solution = byLogic; return p; }
        const res = solve(m, 2, 50000, byLogic);
        if (res.solutions.length !== 1) throw new Error('Puzzle has no unique solution');
        p.solution = res.solutions[0];
        return p;
      },
      newState: (p) => new Uint8Array(p.R * p.C),
      saveState: (s) => Array.from(s).join(''),
      loadState: (p, v) => (typeof v === 'string' && v.length === p.R * p.C ? Uint8Array.from(v, (x) => Number(x) % 3) : new Uint8Array(p.R * p.C)),
      render,
      check: isSolved,
      hints: (p, s) => hints(cfg.model(p), full(p, s), p.solution, cfg.noun, cfg.noNoun, (k) => PuzzleShell.cellName(k, p.C)),
      applyHint(p, s, h) { for (const k of h.cells) if (!fixed(p, k)) s[k] = h.v; },
    });
  }

  // Cells next to k (by a side) in an R x C grid.
  function sideNeighbours(R, C, k) {
    const r = Math.floor(k / C), c = k % C, out = [];
    if (r > 0) out.push(k - C);
    if (r < R - 1) out.push(k + C);
    if (c > 0) out.push(k - 1);
    if (c < C - 1) out.push(k + 1);
    return out;
  }

  // Neighbour lists of every cell, built once per grid size (floods run
  // very often in solvers and generators).
  const neighbourCache = new Map();
  function neighbourLists(R, C) {
    const key = `${R}x${C}`;
    if (!neighbourCache.has(key)) neighbourCache.set(key, Array.from({ length: R * C }, (_, k) => sideNeighbours(R, C, k)));
    return neighbourCache.get(key);
  }

  // Cells reached from `start` through cells where ok(j) holds (1 = seen).
  function flood(R, C, start, ok) {
    const nb = neighbourLists(R, C);
    const seen = new Uint8Array(R * C);
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      for (const j of nb[stack.pop()]) {
        if (!seen[j] && ok(j)) { seen[j] = 1; stack.push(j); }
      }
    }
    return seen;
  }

  // For Heyawake and Heyablock: straight segments spanning two room borders.
  function whiteBorders(lines, room) {
    const borders = [];
    for (const line of lines) {
      const parts = [];
      for (const k of line) {
        if (parts.length && room[parts.at(-1)[0]] === room[k]) parts.at(-1).push(k);
        else parts.push([k]);
      }
      for (let i = 1; i + 1 < parts.length; i++) {
        borders.push([parts[i - 1][parts[i - 1].length - 1], ...parts[i], parts[i + 1][0]]);
      }
    }
    return borders;
  }

  function buildRoomsMap(R, C, room) {
    const rooms = new Map();
    for (let k = 0; k < R * C; k++) {
      if (!rooms.has(room[k])) rooms.set(room[k], []);
      rooms.get(room[k]).push(k);
    }
    return rooms;
  }

  function noTouchConstraints(R, C, why = () => 'Shaded cells may not touch by a side.') {
    const cons = [];
    for (let k = 0; k < R * C; k++) {
      const r = Math.floor(k / C), c = k % C;
      if (c < C - 1) cons.push({ cells: [k, k + 1], min: 0, max: 1, why });
      if (r < R - 1) cons.push({ cells: [k, k + C], min: 0, max: 1, why });
    }
    return cons;
  }

  // Room clue constraints for Binary puzzles (Heyawake, Heyablock)
  function roomClueConstraints(rooms, clues) {
    const cons = [];
    for (const [id, cells] of rooms) {
      const v = clues[id];
      if (v < 0) continue;
      cons.push({
        cells, min: v, max: v, area: cells,
        why: (x) => {
          if (x === YES) return `This room needs ${PuzzleShell.plural(v, 'shaded cell')}, and only these cells are left.`;
          if (v === 0) return 'This room has a 0. All its cells stay white.';
          return `This room already has its ${PuzzleShell.plural(v, 'shaded cell')}. The rest stay white.`;
        },
      });
    }
    return cons;
  }

  // Straight white segments spanning two room borders
  function whiteBorderConstraints(R, C, room) {
    const lines = [];
    for (let r = 0; r < R; r++) lines.push(Array.from({ length: C }, (_, c) => r * C + c));
    for (let c = 0; c < C; c++) lines.push(Array.from({ length: R }, (_, r) => r * C + c));
    return whiteBorders(lines, room).map((cells) => ({
      cells, min: 1, max: cells.length,
      why: () => 'A straight white line may not cross two room borders. This cell must be shaded to break it.',
    }));
  }

  // Cells at the four corners of k.
  function cornerNeighbours(R, C, k) {
    const r = Math.floor(k / C), c = k % C, out = [];
    for (const [a, b] of [[r - 1, c - 1], [r - 1, c + 1], [r + 1, c - 1], [r + 1, c + 1]]) {
      if (a >= 0 && b >= 0 && a < R && b < C) out.push(a * C + b);
    }
    return out;
  }

  // Shaded areas: YES cells joined by sides. id[k] = area of cell k (-1
  // if not shaded); list = cells of each area.
  function areas(R, C, s) {
    const nb = neighbourLists(R, C);
    const id = new Int32Array(R * C).fill(-1), list = [];
    for (let k = 0; k < R * C; k++) {
      if (id[k] >= 0 || s[k] !== YES) continue;
      const cells = [k];
      id[k] = list.length;
      for (const cur of cells) for (const j of nb[cur]) if (id[j] < 0 && s[j] === YES) { id[j] = list.length; cells.push(j); }
      list.push(cells);
    }
    return { id, list };
  }

  // Areas that touch at corners, joined into groups (lists of area ids).
  function cornerGroups(R, C, s, { id, list }) {
    const seen = new Uint8Array(list.length), out = [];
    for (let a = 0; a < list.length; a++) {
      if (seen[a]) continue;
      const group = [a];
      seen[a] = 1;
      for (const cur of group) {
        for (const j of list[cur].flatMap((k) => cornerNeighbours(R, C, k))) {
          if (s[j] === YES && !seen[id[j]]) { seen[id[j]] = 1; group.push(id[j]); }
        }
      }
      out.push(group);
    }
    return out;
  }

  // Generator helper for answers made of blocks on an n x n grid. Blocks
  // never touch by a side. Blocks of one group may touch at corners;
  // blocks of different groups never touch at all.
  function cornerBuilder(n) {
    const N = n * n;
    const id = new Int32Array(N).fill(-1), groupOf = new Int32Array(N).fill(-1);
    const blocks = [];
    const around = (k, corners) => {
      const side = sideNeighbours(n, n, k);
      return corners ? side.concat(cornerNeighbours(n, n, k)) : side;
    };
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const canUse = (k, b, g) => id[k] < 0 &&
      around(k, false).every((j) => id[j] < 0 || id[j] === b) &&
      around(k, true).every((j) => groupOf[j] < 0 || groupOf[j] === g);
    const remove = (cells) => cells.forEach((k) => { id[k] = -1; groupOf[k] = -1; });
    return {
      id, blocks, pick,
      // Grows block number `blocks.length` of group g from seed, up to
      // `want` cells. Returns its cells; `keep` adds it to the blocks.
      grow(seed, g, want) {
        const b = blocks.length, cells = [seed];
        id[seed] = b; groupOf[seed] = g;
        for (let t = 0; t < 30 && cells.length < want; t++) {
          const opts = around(pick(cells), false).filter((j) => canUse(j, b, g));
          if (!opts.length) continue;
          const j = pick(opts);
          id[j] = b; groupOf[j] = g;
          cells.push(j);
        }
        return cells;
      },
      keep: (cells) => blocks.push(cells),
      remove,
      // Drops the blocks from index `first` on.
      undo: (first) => blocks.splice(first).forEach(remove),
      // Free cells with nothing around them: starts for a new group.
      starts: () => [...new Array(N).keys()].filter((k) => id[k] < 0 && around(k, true).every((j) => id[j] < 0)),
      // Cells at a corner of group g (blocks from `first` on) where a new block can start.
      seeds: (first, g) => [...new Set(blocks.slice(first).flat().flatMap((k) => around(k, true)))].filter((k) => canUse(k, blocks.length, g)),
    };
  }

  // True if all non-YES cells of an R x C grid are connected.
  function openConnected(R, C, s) {
    const start = s.findIndex((x) => x !== YES);
    if (start < 0) return true;
    const seen = flood(R, C, start, (j) => s[j] !== YES);
    return s.every((x, k) => x === YES || seen[k]);
  }

  // True if all cells with value v can still join into one area,
  // moving through cells that are v or unknown.
  function canConnect(R, C, s, v) {
    const start = s.indexOf(v);
    if (start < 0) return true;
    const seen = flood(R, C, start, (j) => s[j] === v || s[j] === UNKNOWN);
    return s.every((x, k) => x !== v || seen[k]);
  }

  // Generator helper: a random full state that the model accepts.
  // `yesRate` biases the random choice. Returns null after many tries.
  function randomFill(model, yesRate = 0.5, tries = 30) {
    for (let t = 0; t < tries; t++) {
      const s = fillOnce(model, yesRate);
      if (s && model.check?.(s, true) !== false) return s;
    }
    return null;
  }

  // One try of randomFill: random values cell by cell, with the rules
  // after each one. Returns the full state, or null on a dead end.
  function fillOnce(model, yesRate) {
    const s = new Uint8Array(model.N);
    if (!settle(model, s)) return null;
    while (s.includes(UNKNOWN)) {
      const open = [];
      for (let k = 0; k < model.N; k++) if (s[k] === UNKNOWN) open.push(k);
      const k = open[Math.floor(Math.random() * open.length)];
      const v = Math.random() < yesRate ? YES : NO;
      const trial = Uint8Array.from(s);
      trial[k] = v;
      if (settle(model, trial)) { s.set(trial); continue; }
      s[k] = v === YES ? NO : YES;
      if (!settle(model, s)) return null;
    }
    return s;
  }

  // Generator helper: removes clues (clues[k] = empty) in random order
  // while logic alone still solves the model. Returns the final state.
  function thinClues(clues, empty, makeModel, cells) {
    const solvedBy = () => {
      const s = logicSolve(makeModel());
      return s && !s.includes(UNKNOWN);
    };
    for (const k of PuzzleShell.shuffle(cells || [...clues.keys()])) {
      if (clues[k] === empty) continue;
      const keep = clues[k];
      clues[k] = empty;
      if (!solvedBy()) clues[k] = keep;
    }
  }

  // Generator helper: true if the model has exactly one answer. Logic
  // first (its answer must pass the full check), then a short search
  // (at most maxNodes) from where it stops.
  function isUnique(model, maxNodes = 3000) {
    const t = logicSolve(model);
    if (!t) return false;
    if (!t.includes(UNKNOWN)) return model.check?.(t, true) !== false;
    const r = solve(model, 2, maxNodes, t);
    return r.solutions.length === 1 && !r.capped;
  }

  // For share links: logic first (generated boards need no more), then a
  // search from where logic stops. Same result shape as solve().
  function solveFull(model, maxNodes = 200000) {
    const t = logicSolve(model);
    if (t && !t.includes(UNKNOWN)) return { solutions: [t], capped: false };
    return solve(model, 2, maxNodes, t || undefined);
  }

  function encodeRoomClues(p) {
    return {
      r: p.R,
      c: p.C,
      g: Array.from(p.room, (v) => v.toString(36).padStart(2, '0')).join(''),
      n: Array.from(p.clues).join(','),
    };
  }

  function decodeRoomClues(d) {
    const R = d?.r, C = d?.c;
    if (![R, C].every((x) => Number.isInteger(x) && x >= 2 && x <= 20)) throw new Error('Invalid board size');
    if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid rooms');
    const room = Int32Array.from({ length: R * C }, (_, k) => Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36));
    const clues = Int8Array.from(String(d.n).split(','), Number);
    if (room.some((v) => !(v >= 0 && v < clues.length))) throw new Error('Invalid rooms');
    return { R, C, room, clues };
  }

  function drawRoomClues(p, k, el) {
    PuzzleShell.regionBorders(el, k, p.room, p.R, p.C);
    if (p.room.indexOf(p.room[k]) === k && p.clues[p.room[k]] >= 0) {
      const lab = document.createElement('span');
      lab.className = 'room-clue';
      lab.textContent = p.clues[p.room[k]];
      el.appendChild(lab);
    }
  }

  function encodeDotClues(p) {
    return {
      r: p.R,
      c: p.C,
      g: Array.from(p.clues, (v) => {
        if (v < 0) return '.';
        if (v === 0) return '?';
        return v.toString(36);
      }).join(''),
    };
  }

  function decodeDotClues(d) {
    const R = d?.r, C = d?.c;
    if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
    if (typeof d.g !== 'string' || d.g.length !== R * C) throw new Error('Invalid clues');
    return {
      R,
      C,
      clues: Int8Array.from(d.g, (ch) => {
        if (ch === '.') return -1;
        if (ch === '?') return 0;
        return Number.parseInt(ch, 36);
      }),
    };
  }

  function measureRoomDim(R, C, id, r, c) {
    let maxW = 0;
    while (c + maxW < C && id[r * C + c + maxW] < 0 && maxW < 4) maxW++;
    const w = 1 + Math.floor(Math.random() * maxW);
    let maxH = 0;
    while (r + maxH < R && maxH < 4 && [...new Array(w).keys()].every((i) => id[(r + maxH) * C + c + i] < 0)) maxH++;
    let h = 1 + Math.floor(Math.random() * maxH);
    if (w * h === 1 && maxH > 1) h = 2;
    return { w, h };
  }

  // Random split into rectangles of side 1..4 (no 1x1 rooms).
  function splitRooms(R, C) {
    const id = new Int32Array(R * C).fill(-1);
    let count = 0;
    for (let k = 0; k < R * C; k++) {
      if (id[k] >= 0) continue;
      const r = Math.floor(k / C), c = k % C;
      const { w, h } = measureRoomDim(R, C, id, r, c);
      for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) id[(r + i) * C + c + j] = count;
      count++;
    }
    return id;
  }

  function generateRoomClues(n, modelFn, fillRate = 0.3) {
    const R = n, C = n;
    const room = splitRooms(R, C);
    const count = Math.max(...room) + 1;
    const p = { R, C, room, clues: new Int8Array(count).fill(-1) };
    const sol = randomFill(modelFn(p), fillRate, 5);
    if (!sol) return null;
    for (let k = 0; k < R * C; k++) if (p.clues[room[k]] < 0) p.clues[room[k]] = 0;
    for (let k = 0; k < R * C; k++) if (sol[k] === YES) p.clues[room[k]]++;
    const s = logicSolve(modelFn(p));
    if (!s || s.includes(0)) return null;
    thinClues(p.clues, -1, () => modelFn(p));
    p.solution = sol;
    return p;
  }

  const WALL_DIRS = [[0, -1, YES], [0, 1, YES], [-1, 0, NO], [1, 0, NO]];

  function checkArmDir(d, arm, state) {
    const { dirs, v, can, got, max, min } = arm;
    const { k, s, log } = state;
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
    return 0;
  }

  function stepArm(dirs, v, k, s, log) {
    const got = dirs.map(([cells, want]) => { let i = 0; while (i < cells.length && s[cells[i]] === want) { i++; } return i; });
    const can = dirs.map(([cells, want]) => { let i = 0; while (i < cells.length && s[cells[i]] !== (want === YES ? NO : YES)) { i++; } return i; });
    const min = got.reduce((a, b) => a + b, 0), max = can.reduce((a, b) => a + b, 0);
    if (min > v || max < v) return -1;
    const arm = { dirs, v, can, got, max, min };
    const state = { k, s, log };
    for (let d = 0; d < 4; d++) {
      const res = checkArmDir(d, arm, state);
      if (res !== 0) return res;
    }
    return 0;
  }

  function reachesBlack(x, k, R, C, black) {
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
  }

  function orientLines(s, m, N, black, C, R) {
    for (let it = 0; it < 50 && !m.check(s, true); it++) {
      for (let k = 0; k < N; k++) {
        if (black[k] >= 0) continue;
        const t = Uint8Array.from(s);
        t[k] = s[k] === YES ? NO : YES;
        if (!reachesBlack(s, k, R, C, black) && reachesBlack(t, k, R, C, black)) s[k] = t[k];
      }
    }
  }

  function wallsModel(p) {
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
      arms.push([k, WALL_DIRS.map((d) => [ray(k, d), d[2]])]);
    }
    function propagate(s, log) {
      for (const [k, dirs] of arms) {
        const res = stepArm(dirs, black[k], k, s, log);
        if (res !== 0) return res;
      }
      return 0;
    }
    function check(s, done) {
      if (!done) return true;
      for (let k = 0; k < N; k++) {
        if (isBlack(k)) continue;
        if (!reachesBlack(s, k, R, C, black)) return false;
      }
      return true;
    }
    return { N, cons, propagate, check };
  }

  function countArm(k, R, C, black, s, [dr, dc, want]) {
    let count = 0;
    let r = Math.floor(k / C) + dr, c = (k % C) + dc;
    while (r >= 0 && c >= 0 && r < R && c < C && black[r * C + c] < 0 && s[r * C + c] === want) {
      count++;
      r += dr;
      c += dc;
    }
    return count;
  }

  function initWallGrid(N) {
    const black = new Int8Array(N).fill(-1);
    const s = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      if (Math.random() < 0.18) {
        black[k] = 0;
        s[k] = NO;
      } else {
        s[k] = Math.random() < 0.5 ? YES : NO;
      }
    }
    return { black, s };
  }

  function numberWallClues(p, s) {
    for (let k = 0; k < p.black.length; k++) {
      if (p.black[k] >= 0) p.black[k] = WALL_DIRS.reduce((sum, d) => sum + countArm(k, p.R, p.C, p.black, s, d), 0);
    }
  }

  function tryBuildWallCandidate(n) {
    const R = n, C = n, N = R * C;
    const { black, s } = initWallGrid(N);
    const p = { R, C, black };
    const m = wallsModel(p);
    orientLines(s, m, N, black, C, R);
    if (!m.check(s, true)) return null;
    if (!s.some((v, k) => black[k] < 0 && v === YES)) return null;
    numberWallClues(p, s);
    const t = logicSolve(wallsModel(p));
    if (!t || t.includes(UNKNOWN)) return null;
    p.solution = Uint8Array.from(s, (v, k) => (black[k] >= 0 ? NO : v));
    return p;
  }

  function generateWalls(n) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const p = tryBuildWallCandidate(n);
      if (p) return p;
    }
    return null;
  }

  function encodeWalls(p) {
    return { r: p.R, c: p.C, g: Array.from(p.black, (v) => (v < 0 ? '..' : v.toString(36).padStart(2, '0'))).join('') };
  }

  function decodeWalls(d) {
    const R = d?.r, C = d?.c;
    if (![R, C].every((x) => Number.isInteger(x) && x >= 3 && x <= 20)) throw new Error('Invalid board size');
    if (typeof d.g !== 'string' || d.g.length !== 2 * R * C) throw new Error('Invalid grid');
    return { R, C, black: Int8Array.from({ length: R * C }, (_, k) => (d.g[2 * k] === '.' ? -1 : Number.parseInt(d.g.slice(2 * k, 2 * k + 2), 36))) };
  }

  function drawWalls(p, k, el, v) {
    if (p.black[k] >= 0) { el.textContent = p.black[k]; el.classList.add('wall-num'); return; }
    if (v === YES) el.classList.add('h-line');
    if (v === NO) el.classList.add('v-line');
  }

  function startWallsGame(cfg) {
    startGame({
      id: cfg.id,
      name: cfg.name,
      rules: cfg.rules,
      controls: 'Click a cell for a horizontal line, again for a vertical line, again to clear. Right click cycles the other way.',
      size: { min: 4, max: 8, def: 6 },
      solvedText: cfg.solvedText,
      generate: generateWalls,
      encode: encodeWalls,
      decode: decodeWalls,
      model: wallsModel,
      fixed: (p, k) => (p.black[k] >= 0 ? NO : 0),
      draw: drawWalls,
      noun: 'horizontal line',
      noNoun: 'vertical line',
      className: 'wl-board',
      yesClass: 'hl',
      noClass: 'vl',
    });
  }

  return {
    UNKNOWN, YES, NO, step, settle, lookahead, solve, solveFull, logicSolve, isUnique,
    hints, startGame, thinClues, randomFill, openConnected, canConnect, sideNeighbours,
    cornerNeighbours, whiteBorders, areas, cornerGroups, cornerBuilder,
    encodeRoomClues, decodeRoomClues, drawRoomClues, generateRoomClues,
    encodeDotClues, decodeDotClues, splitRooms,
    roomClueConstraints, whiteBorderConstraints, buildRoomsMap, noTouchConstraints,
    startWallsGame, generateWalls, wallsModel, encodeWalls, decodeWalls, drawWalls
  };
})();
