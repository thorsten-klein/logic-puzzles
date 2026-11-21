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
//   propagate  optional (state, log) -> false on contradiction, else the
//          number of cells it set. For game rules that are not counts.
//          Log entries are { cells, v, reason }.
// Cell states: 0 = unknown, 1 = yes, 2 = no.

const Binary = (() => {
  const UNKNOWN = 0, YES = 1, NO = 2;

  // One pass over the count rules. Returns false on contradiction,
  // else the number of cells set. `log` gets { con, cells, v }, and
  // { con, fail: true } for the broken rule.
  function step(model, s, log) {
    let set = 0;
    for (const con of model.cons) {
      if (con.w) {
        const r = weightedStep(con, s, log);
        if (r === false) { if (log) log.push({ con, fail: true }); return false; }
        set += r;
        continue;
      }
      let yes = 0;
      const open = [];
      for (const k of con.cells) {
        if (s[k] === YES) yes++;
        else if (s[k] === UNKNOWN) open.push(k);
      }
      if (yes > con.max || yes + open.length < con.min) { if (log) log.push({ con, fail: true }); return false; }
      if (!open.length) continue;
      let v = 0;
      if (yes === con.max) v = NO;
      else if (yes + open.length === con.min) v = YES;
      if (!v) continue;
      for (const k of open) s[k] = v;
      set += open.length;
      if (log) log.push({ con, cells: open, v });
    }
    return set;
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
    if (lo > con.max || hi < con.min) return false;
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
    if (yes.includes(-1)) return false;
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
      if (r === false) return false;
      if (r > 0) continue;
      if (!model.propagate) break;
      const q = model.propagate(s);
      if (q === false) return false;
      if (q === 0) break;
    }
    return !model.check || model.check(s, !s.includes(UNKNOWN)) !== false;
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
        const t = Uint8Array.from(s);
        t[k] = v;
        if (settle(model, t)) continue;
        const area = [];
        for (let j = 0; j < model.N; j++) if (j !== k && t[j] !== s[j]) area.push(j);
        if (!best || area.length < best.area.length) best = { k, v: v === YES ? NO : YES, tried: v, area };
      }
      if (best && !best.area.length) break;
    }
    return best;
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
    const a = (w) => (/^[aeiou8]/i.test(w) ? `an ${w}` : `a ${w}`);
    const names = (ks) => ks.length > 1 ? `${ks.slice(0, -1).map(name).join(', ')} and ${name(ks.at(-1))}` : name(ks[0]);
    // "F2 is a white cell" / "E1 and G1 are white cells".
    const becomes = (ks, v) => {
      const w = v === YES ? noun : noNoun || 'empty cell';
      return ks.length > 1 ? `${names(ks)} are ${w}s` : `${name(ks[0])} is ${a(w)}`;
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
    // Replays a try step by step: what it forces, then the broken rule.
    function chain(k, v) {
      const t = Uint8Array.from(state);
      t[k] = v;
      const lines = [`Suppose ${becomes([k], v)}.`];
      let last = null;  // last step, to merge steps with the same reason
      for (let i = 0; i < 200; i++) {
        const log = [];
        let r = step(model, t, log);
        if (r === 0 && model.propagate) r = model.propagate(t, log);
        for (const st of log) {
          // The clue cell behind this step, if there is one.
          const at = st.at != null ? st.at : st.con?.at != null ? st.con.at : null;
          const text = why(st);
          if (st.fail) {
            const where = at != null ? ` at ${name(at)}` : st.con ? ` at ${names(st.con.cells)}` : '';
            lines.push(`Now a rule is broken${where}${text ? `: ${text}` : '.'}`);
          } else if (last && at == null && last.at == null && last.v === st.v && last.text === text) {
            last.cells.push(...st.cells);
            lines[lines.length - 1] = `Then ${becomes(last.cells, st.v)}${since(text, null)}.`;
            continue;
          } else lines.push(`Then ${becomes(st.cells, st.v)}${since(text, at)}.`);
          last = st.fail ? null : { at, v: st.v, text, cells: [...st.cells] };
        }
        if (r === false) {
          if (!log.some((st) => st.fail)) lines.push('Now a rule is broken.');
          return lines;
        }
        if (r === 0) break;
      }
      if (model.check && model.check(t, !t.includes(UNKNOWN)) === false) lines.push('Now the rules can no longer all be met (for example, the cells can no longer connect).');
      return lines;
    }
    const out = [];
    for (let k = 0; k < model.N; k++) {
      if (state[k] === UNKNOWN || state[k] === solution[k]) continue;
      out.push({ cells: [k], v: solution[k],
        reason: state[k] === YES ? `This ${noun} is wrong.`
          : noNoun ? `This ${noNoun} is wrong.` : `This cell is marked empty, but it needs ${a(noun)}.` });
    }
    if (out.length) return out;
    const s = Uint8Array.from(state);
    const log = [];
    step(model, s, log);
    if (!log.length && model.propagate) model.propagate(s, log);
    for (const st of log) {
      if (st.reason) { out.push(st); continue; }
      const why = st.con.why ? st.con.why(st.v) : (st.v === YES ? `These cells need ${a(noun)}.` : `No ${noun} can go here.`);
      out.push({ cells: st.cells, v: st.v, area: st.con.area, at: st.con.at, reason: why });
    }
    if (!out.length) {
      const la = easiestDeadEnd(model, state);
      if (la) {
        if (!name) {
          const ifNo = noNoun ? `${a(noNoun)} here` : 'Leaving this cell empty';
          out.push({ cells: [la.k], v: la.v, area: la.area, reason: la.tried === YES
            ? `${a(noun)} here leads to a dead end, so this cell ${noNoun ? `is ${a(noNoun)}` : 'stays empty'}.`.replace(/^a/, 'A')
            : `${ifNo} leads to a dead end, so it needs ${a(noun)}.`.replace(/^a/, 'A') });
          return out;
        }
        const end = la.tried === YES
          ? `That is not possible, so ${name(la.k)} must ${noNoun ? `be ${a(noNoun)}` : 'stay empty'}.`
          : `That is not possible, so ${name(la.k)} must be ${a(noun)}.`;
        out.push({ cells: [la.k], v: la.v, area: la.area, reason: [...chain(la.k, la.tried), end].join('\n') });
      }
    }
    if (!out.length) {
      const k = solution.findIndex((v, i) => state[i] === UNKNOWN && v === YES);
      if (k >= 0) out.push({ cells: [k], v: YES, reason: `No simple step is left. ${a(noun)} goes here.`.replace('. a', '. A') });
    }
    return out;
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
      const board = PuzzleShell.gridBoard({
        rows: R + offR, cols: C + offC, cellPx: PuzzleShell.fitCell(C + offC, cfg.cellMax || 42),
        className: `pz-board ${cfg.className || ''}`, readonly,
        renderCell(K, el) {
          const r = Math.floor(K / (C + offC)) - offR, c = (K % (C + offC)) - offC;
          if (r < 0 || c < 0) {
            el.className = 'clue' + (r < 0 ? ' clue-top' : ' clue-left');
            const item = r < 0 && c >= 0 ? top[c] : c < 0 && r >= 0 ? left[r] : null;
            if (item != null) {
              const [text, done] = Array.isArray(item) ? item : [item, false];
              el.textContent = text;
              if (done) el.classList.add('done');
            }
            return;
          }
          const k = r * C + c;
          el.dataset.cell = k;
          const f = fixed(p, k);
          const v = result ? solution[k] : f || state[k];
          if (v === YES) el.classList.add(yesClass);
          if (v === NO && (cfg.showFixedNo || (!f && !result))) el.classList.add(noClass);
          if (f) el.classList.add('fixed');
          if (cfg.draw) cfg.draw(p, k, el, v, shown);
          if (result && !f && state[k] !== UNKNOWN) el.classList.add(state[k] === solution[k] ? 'ok' : 'bad');
          else if (result && !f && solution[k] === YES) el.classList.add('miss'); // not shaded yet
          if (area.has(k)) el.classList.add('area');
          if (hintCells.has(k)) el.classList.add('hint');
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
        const y = con.cells.reduce((a, k, i) => a + (s[k] === YES ? (con.w ? con.w[i] : 1) : 0), 0);
        if (y < con.min || y > con.max) return false;
      }
      if (m.propagate && m.propagate(Uint8Array.from(s)) === false) return false;
      return !m.check || m.check(s, true) !== false;
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
        if (!byLogic.includes(UNKNOWN) && (!m.check || m.check(byLogic, true) !== false)) { p.solution = byLogic; return p; }
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

  // True if all non-YES cells of an R x C grid are connected.
  function openConnected(R, C, s) {
    const N = R * C;
    let start = -1, count = 0;
    for (let k = 0; k < N; k++) if (s[k] !== YES) { count++; if (start < 0) start = k; }
    if (start < 0) return true;
    const seen = new Uint8Array(N);
    const stack = [start];
    seen[start] = 1;
    let got = 1;
    while (stack.length) {
      const k = stack.pop();
      const r = Math.floor(k / C), c = k % C;
      const nb = [r > 0 ? k - C : -1, r < R - 1 ? k + C : -1, c > 0 ? k - 1 : -1, c < C - 1 ? k + 1 : -1];
      for (const j of nb) if (j >= 0 && !seen[j] && s[j] !== YES) { seen[j] = 1; got++; stack.push(j); }
    }
    return got === count;
  }

  // True if all cells with value v can still join into one area,
  // moving through cells that are v or unknown.
  function canConnect(R, C, s, v) {
    const N = R * C;
    const start = s.indexOf(v);
    if (start < 0) return true;
    const seen = new Uint8Array(N);
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const k = stack.pop();
      const r = Math.floor(k / C), c = k % C;
      const nb = [r > 0 ? k - C : -1, r < R - 1 ? k + C : -1, c > 0 ? k - 1 : -1, c < C - 1 ? k + 1 : -1];
      for (const j of nb) if (j >= 0 && !seen[j] && (s[j] === v || s[j] === UNKNOWN)) { seen[j] = 1; stack.push(j); }
    }
    for (let k = 0; k < N; k++) if (s[k] === v && !seen[k]) return false;
    return true;
  }

  // Generator helper: a random full state that the model accepts.
  // `yesRate` biases the random choice. Returns null after many tries.
  function randomFill(model, yesRate = 0.5, tries = 30) {
    for (let t = 0; t < tries; t++) {
      const s = new Uint8Array(model.N);
      let ok = settle(model, s);
      while (ok && s.includes(UNKNOWN)) {
        const open = [];
        for (let k = 0; k < model.N; k++) if (s[k] === UNKNOWN) open.push(k);
        const k = open[Math.floor(Math.random() * open.length)];
        const v = Math.random() < yesRate ? YES : NO;
        const trial = Uint8Array.from(s);
        trial[k] = v;
        if (settle(model, trial)) { s.set(trial); continue; }
        s[k] = v === YES ? NO : YES;
        ok = settle(model, s);
      }
      if (ok && (!model.check || model.check(s, true) !== false)) return s;
    }
    return null;
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
