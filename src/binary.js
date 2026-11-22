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
    let v = 0;
    if (!open.length) v = 0;
    else if (yes === con.max) v = NO;
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
      loadState(p, v) {
        const s = new Uint8Array(p.R * p.C);
        if (typeof v === 'string' && v.length === s.length) for (let k = 0; k < s.length; k++) s[k] = Number(v[k]) % 3;
        return s;
      },
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

  // For share links: logic first (generated boards need no more), then a
  // search from where logic stops. Same result shape as solve().
  function solveFull(model, maxNodes = 200000) {
    const t = logicSolve(model);
    if (t && !t.includes(UNKNOWN)) return { solutions: [t], capped: false };
    return solve(model, 2, maxNodes, t || undefined);
  }

  return { UNKNOWN, YES, NO, step, settle, lookahead, solve, solveFull, logicSolve, hints, startGame, thinClues, randomFill, openConnected, canConnect };
})();
