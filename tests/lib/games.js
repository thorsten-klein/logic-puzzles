// Shared helpers for the tests: the list of games, loading a game's code
// in Node, and the logic checks for one board.

const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const GEN_LIMIT_MS = 30000;
// A hint that reads the hidden answer must say so openly with these words.
const HONEST = /no (simple|single|one-step) (step|deduction)/i;

function playableGames() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'games-manifest.json'), 'utf8'));
  const only = (process.env.GAMES || '').split(',').filter(Boolean);
  return manifest.filter((g) => g.status === 'available' && (!only.length || only.includes(g.slug))).map((g) => g.slug);
}

// Load a game's scripts in a sandbox and catch its PuzzleShell config
// (null for pages with their own code, like Kakuro and Snake).
// Pages with their own code (no PuzzleShell config): tested in the browser
// only. None left: Kakuro and Snake use the shell too now.
const OWN_PAGE = new Set();

function loadGame(slug) {
  if (OWN_PAGE.has(slug)) return null;
  const html = fs.readFileSync(path.join(root, slug, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => path.join(root, slug, m[1])).filter((f) => !f.endsWith('site.js'));
  const ctx = { console, window: { innerWidth: 900 }, Date, Math, document: undefined };
  vm.createContext(ctx);
  let code = '';
  for (const f of scripts) {
    code += '\n' + fs.readFileSync(f, 'utf8');
    // Like the page: start() prepares the cfg (see PuzzleShell.prepare).
    if (f.endsWith('/shell.js')) code += '\n;var __cfg = null; PuzzleShell.start = (c) => { __cfg = PuzzleShell.prepare(c); };\n';
  }
  code += '\n;this.__cfg = typeof __cfg === "undefined" ? null : __cfg; this.__words = typeof Words === "undefined" ? null : Words;';
  vm.runInContext(code, ctx, { filename: slug }); // NOSONAR: loads the game's own scripts into Node for the logic tests
  const cfg = ctx.__cfg;
  // Hidden answer fields. In the Parts engine `walls` is the answer too;
  // elsewhere `walls` can be part of the puzzle (Light Up).
  if (cfg) { cfg.__words = ctx.__words; Object.defineProperty(cfg, "__ctx", { value: ctx }); }
  if (cfg) cfg.__answerKeys = scripts.some((f) => f.endsWith('/parts.js')) ? ['solution', 'walls'] : ['solution'];
  return cfg;
}

const ser = (x) => JSON.stringify(x, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v));
// A JSON round trip on purpose: share data travels as JSON.
const clone = (x) => JSON.parse(JSON.stringify(x)); // NOSONAR
const isEmpty = (v) => v === 0 || v === -1 || v === null || v === undefined || v === '';

// Sizes to test: smallest and largest (plus middle and default in full mode).
function sizesOf(cfg, full) {
  const { min, max, def } = cfg.size;
  const list = full ? [min, def, max, Math.round((min + max) / 2)] : [min, max];
  return [...new Set(list)].sort((a, b) => a - b);
}

// Wrap the hidden answer so reads can be seen; returns an undo function.
function watch(p, reads, answerKeys) {
  const keys = answerKeys.filter((k) => p[k] && (ArrayBuffer.isView(p[k]) || Array.isArray(p[k])));
  const raw = {};
  for (const key of keys) {
    raw[key] = p[key];
    p[key] = new Proxy(Array.from(p[key]), {
      get(t, prop, r) {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) reads.add(Number(prop));
        return Reflect.get(t, prop, r);
      },
    });
  }
  return () => { for (const key of keys) p[key] = raw[key]; };
}

// All logic checks for one new board. Returns { ms, steps, reveals, peeks,
// warnings, q (the decoded board), end (the solved state) }; throws (via
// `expect`) on a failure.
function checkBoard(cfg, n, expect) {
  // Like the page: one more try if the first one runs out of time.
  const t0 = Date.now();
  let p = null;
  for (let t = 0; t < 2 && !p; t++) p = cfg.generate(n);
  const ms = Date.now() - t0;
  expect(p, `generate(${n}) gave a board`).toBeTruthy();
  expect(ms, `generate(${n}) time in ms`).toBeLessThan(GEN_LIMIT_MS);
  const warnings = [];

  // Unique answer: decoding the share data solves the board from scratch
  // and demands exactly one answer.
  const q = cfg.decode(clone(cfg.encode(p)));
  if (ser(q.solution) !== ser(p.solution)) warnings.push('decoded answer has a different form than the generated one');

  // Save / load keeps the board; an empty board is not solved.
  const fresh = cfg.newState(q);
  const saved = cfg.saveState(fresh);
  expect(ser(cfg.saveState(cfg.loadState(q, clone(saved)))), 'save/load round trip').toBe(ser(saved));
  expect(cfg.check(q, fresh), 'empty board counts as solved').toBeFalsy();

  // Hint walk with a watched answer.
  const walk = watchedHintWalk(cfg, q, expect);
  expect(cfg.check(q, walk.s), `hints solve the board within ${walk.limit} steps`).toBeTruthy();
  const peeks = peeksOf(walk.seen, walk.s);
  return { ms, steps: walk.steps, reveals: walk.reveals, peeks, warnings, q, end: walk.s };
}

// Applies hints until solved (or a step limit). Notes which answer cells
// each hint read (`seen`), except for honest reveals.
function watchedHintWalk(cfg, q, expect) {
  let s = cfg.newState(q);
  const limit = 4 * (ser(s).length + 20);
  let steps = 0, reveals = 0;
  const seen = []; // per step: { reads, flat, reason }
  for (; steps < limit && !cfg.check(q, s); steps++) {
    const reads = new Set();
    const unwatch = watch(q, reads, cfg.__answerKeys);
    let hs;
    try { hs = cfg.hints(q, s); } finally { unwatch(); }
    const h = hs?.[0];
    expect(h, `a hint exists on an unsolved board (step ${steps})`).toBeTruthy();
    expect(typeof h.reason === 'string' && h.reason.length > 0, 'hint has a reason').toBeTruthy();
    const flat = Array.isArray(s) || ArrayBuffer.isView(s) ? Array.from(s) : null;
    if (HONEST.test(h.reason)) reveals++;
    else seen.push({ reads, flat, reason: h.reason });
    cfg.applyHint(q, s, h);
    // Keep the board in its saved form, as the page does.
    s = cfg.loadState(q, clone(cfg.saveState(s)));
  }
  return { s, limit, steps, reveals, seen };
}

// A peek: the hint read the answer at a cell that was still open but
// that the player has to fill in the end. (Given cells stay empty in the
// player's state, so reading them is fine.)
function peeksOf(seen, s) {
  const end = Array.isArray(s) || ArrayBuffer.isView(s) ? Array.from(s) : null;
  const peeks = new Set();
  for (const { reads, flat, reason } of seen) {
    // (States that are not cell lists can not be mapped; they are skipped.)
    const bad = flat && end ? [...reads].filter((i) => i < flat.length && isEmpty(flat[i]) && !isEmpty(end[i])) : [];
    if (bad.length) peeks.add(reason.replaceAll(/\d+/g, '#').slice(0, 90));
  }
  return [...peeks];
}

module.exports = { root, playableGames, loadGame, sizesOf, checkBoard, HONEST, OWN_PAGE, isEmpty, ser, clone };
