// Code coverage. A "workout" drives one puzzle page in Chrome like a busy
// player (every size, clicks, drags, keys, all buttons and popups) and
// calls the game code with odd input. Chrome records which code ran.
// The raw data goes to coverage/raw/<slug>.json; tests/coverage-report.js
// turns it into a table.

const fs = require('node:fs');
const path = require('node:path');
const { root } = require('./games');
const { inOrder, times } = require('./steps');

const RAW = path.join(root, 'coverage', 'raw');
const url = (slug, q = '') => 'file://' + path.join(root, slug, 'index.html') + q;
const visible = (sel) => `(() => { const e = document.querySelector('${sel}'); return !!e && !e.hidden && !e.disabled && !e.closest('[hidden]'); })()`;

async function clickIf(page, sel) {
  if (await page.evaluate(visible(sel))) await page.evaluate((s) => document.querySelector(s).click(), sel);
}
// Clicks every element that matches sel, one after the other.
async function clickAll(page, sel) {
  await inOrder(await page.locator(sel).all(), (b) => b.click().catch(() => {}));
}
async function closeModals(page) {
  await page.evaluate(() => { for (const m of document.querySelectorAll('.modal:not([hidden])')) m.hidden = true; });
}
async function waitBoard(page) {
  await page.waitForFunction(() => !document.getElementById('game-screen').hidden && document.querySelector('#board-wrap > *'), null, { timeout: 60000 });
}

// Clicks (left and right) on a grid of points over the board: cell
// centres, cell sides and corners. Then drags from cells to neighbours,
// and keys on a selected cell.
async function fuzzBoard(page) {
  const box = await page.locator('#board-wrap > *').first().boundingBox();
  if (!box) return;
  const dims = await page.evaluate(() => {
    const t = window.__puzzleTest, p = t?.st.puzzle;
    const R = (p && (p.R || p.n)) || 6, C = (p && (p.C || p.n)) || R;
    return { R: Math.min(R, 12), C: Math.min(C, 12) };
  });
  const { R, C } = dims;
  const at = (i, j) => [box.x + (box.width * j) / (2 * C), box.y + (box.height * i) / (2 * R)];
  // Clicks on every cell, edge and corner: left, right, left again.
  const spots = [];
  for (let i = 0; i <= 2 * R; i++) for (let j = 0; j <= 2 * C; j++) spots.push(at(i, j));
  await inOrder(['left', 'right', 'left'], async (button) => {
    await inOrder(spots, ([x, y]) => page.mouse.click(Math.min(x, box.x + box.width - 2), Math.min(y, box.y + box.height - 2), { button }));
    await closeModals(page);
  });
  // Drags: from each cell centre to the right and down.
  const drags = [];
  for (let i = 1; i < 2 * R; i += 2) for (let j = 1; j < 2 * C; j += 2) {
    for (const [di, dj] of [[0, 2], [2, 0], [2, 2]]) drags.push([at(i, j), at(Math.min(i + di, 2 * R - 1), Math.min(j + dj, 2 * C - 1))]);
  }
  await inOrder(drags, async ([[x, y], [x2, y2]]) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 3 });
    await page.mouse.up();
  });
  // A long drag through the whole board.
  await page.mouse.move(...at(1, 1));
  await page.mouse.down();
  const longPath = [];
  for (let i = 1; i < 2 * R; i += 2) longPath.push(at(i, i % 4 === 1 ? 2 * C - 1 : 1));
  await inOrder(longPath, ([x, y]) => page.mouse.move(x, y, { steps: 4 }));
  await page.mouse.up();
  await closeModals(page);
  // Keys on a selected cell and in digit inputs.
  const keys = ['1', '2', '3', '5', '9', '0', 'a', 'x', ' ', 'Enter', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'];
  await inOrder([[1, 1], [3, 3], [2 * R - 1, 2 * C - 1]], async ([i, j]) => {
    await page.mouse.click(...at(i, j));
    await inOrder([...keys, 'Shift+ArrowUp', 'Control+ArrowRight'], (k) => page.keyboard.press(k));
  });
  // Keys on focusable cells (focus is lost when the board redraws, so
  // focus again before each key).
  const focusable = page.locator('#board-wrap [tabindex]');
  const nf = await focusable.count();
  const picked = [...new Set([0, 1, Math.floor(nf / 2), nf - 1])].filter((x) => x >= 0 && x < nf);
  const pressOn = async (i, k) => {
    await focusable.nth(i).focus().catch(() => {});
    await page.keyboard.press(k);
  };
  await inOrder(picked, (i) => inOrder(keys, (k) => pressOn(i, k)));
  const inputs = page.locator('#board-wrap input');
  const n = await inputs.count();
  await times(Math.min(n, 6), async (i) => {
    await inOrder(['1', '12', '99', 'a', 'a1', 'B2', 'z9', ''], (v) => inputs.nth(i).fill(v));
    await inputs.nth(i).press('ArrowRight');
    await inputs.nth(i).press('ArrowDown');
  });
  await closeModals(page);
}

// All buttons and popups of the game screen.
async function buttons(page) {
  await clickIf(page, '#btn-topbar-hint');
  await times(3, () => clickIf(page, '#btn-hint-next'));
  await clickIf(page, '#btn-hint-prev');
  await clickIf(page, '#btn-hint-apply');
  await closeModals(page);
  await clickIf(page, '#submit-btn');
  await clickIf(page, '#modal-continue');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+y');
  await page.keyboard.press('Control+Shift+Z');
  await clickIf(page, '#btn-topbar-undo');
  await clickIf(page, '#btn-topbar-redo');
  await clickIf(page, '#btn-topbar-info');
  await page.waitForTimeout(50);
  await clickIf(page, '#btn-info-close');
  await clickIf(page, '#btn-topbar-share');
  await clickAll(page, '.modal:not([hidden]) [data-copy]');
  await clickIf(page, '#btn-share-close');
  await times(14, () => clickIf(page, '#btn-zoom-in'));
  await times(14, () => clickIf(page, '#btn-zoom-out'));
  await times(5, () => clickIf(page, '#btn-zoom-in'));
  await clickIf(page, '#giveup-btn');
  await clickIf(page, '#solution-x');
  await clickIf(page, '#giveup-btn');
  await clickIf(page, '#solution-continue');
  await clickIf(page, '#reset-btn');
  await closeModals(page);
}

// Hints, one after another, until the board is solved; then Submit.
async function solveByHints(page) {
  await page.evaluate(async () => {
    const $ = (s) => document.querySelector(s);
    if (!$('#btn-hint-apply')) return;
    // Open the hint, apply it, again: until no hint is left.
    const next = async (n) => {
      if (n >= 1500) return;
      $('#btn-topbar-hint').click();
      await new Promise((r) => setTimeout(r, 0));
      if ($('#btn-hint-apply').hidden) return;
      $('#btn-hint-apply').click();
      await next(n + 1);
    };
    await next(0);
    $('#btn-hint-close').click();
  });
  await clickIf(page, '#submit-btn');
  await clickIf(page, '#modal-replay');
  await closeModals(page);
}

// Game code called directly with odd input (shell games only): broken
// share data, broken saved states, random boards for hints and check.
async function fuzzCode(page) {
  await page.evaluate(() => {
    // Shared engines by name: globals of the page, or null when the game
    // does not load them.
    const ENGINES = {
      Binary: typeof Binary === 'undefined' ? null : Binary,
      Latin: typeof Latin === 'undefined' ? null : Latin,
      Loop: typeof Loop === 'undefined' ? null : Loop,
      Links: typeof Links === 'undefined' ? null : Links,
      Parts: typeof Parts === 'undefined' ? null : Parts,
      Pieces: typeof Pieces === 'undefined' ? null : Pieces,
      Rects: typeof Rects === 'undefined' ? null : Rects,
      RegionNum: typeof RegionNum === 'undefined' ? null : RegionNum,
      NumberPath: typeof NumberPath === 'undefined' ? null : NumberPath,
      Fillo: typeof Fillo === 'undefined' ? null : Fillo,
      Moves: typeof Moves === 'undefined' ? null : Moves,
      LegLoop: typeof LegLoop === 'undefined' ? null : LegLoop,
      Flow: typeof Flow === 'undefined' ? null : Flow,
    };
    const engine = (name) => ENGINES[name] || null;
    // Blank mark of a share string: '.', '-', or else '0'.
    const blankOf = (v) => ['.', '-'].find((ch) => v.includes(ch)) ?? '0';
    const t = window.__puzzleTest;
    if (!t) return;
    const { cfg } = t;
    const stop = Date.now() + 8000;
    const tryIt = (f) => { try { return f(); } catch { return undefined; } };
    const p = t.st.puzzle || tryIt(() => cfg.generate(cfg.size.min));
    if (!p) return;
    // A JSON round trip on purpose: share data travels as JSON.
    const clone = (x) => JSON.parse(JSON.stringify(x)); // NOSONAR
    const ctx = { t, cfg, p, stop, tryIt, clone, engine, blankOf, d0: clone(cfg.encode(p)) };
    tryDecoders(ctx);
    outOfTime(ctx);
    engineEdges(ctx);
    moreHintWalks(ctx);
    fuzzStates(ctx);

    // Broken share data (one part changed at a time), stuck logic, bad IDs.
    function tryDecoders({ t, cfg, d0, stop, tryIt, clone, engine }) {
      for (const v of brokenData(ctx)) {
        if (Date.now() > stop) break;
        tryIt(() => cfg.decode(v));
      }
      // Decoders try logic first and search when it stalls: with the engines'
      // logicSolve "stuck", the search must find the answer on its own.
      for (const name of ['Binary', 'Loop', 'Links', 'Latin']) {
        const eng = engine(name);
        if (!eng || typeof eng.logicSolve !== 'function') continue;
        const real = eng.logicSolve;
        eng.logicSolve = () => null;
        try { tryIt(() => cfg.decode(clone(d0))); } finally { eng.logicSolve = real; }
      }
      for (const id of ['', 'x', '!!!', btoa('{}'), btoa('{"v":1}'), btoa('{"v":1,"g":"' + cfg.id + '"}'), btoa('{"v":2,"g":"other","d":1}'), btoa('[]'), btoa('null')]) {
        tryIt(() => t.decodeId(id));
      }
    }

    // Share data variants: fewer clues first, then odd values everywhere.
    function brokenData({ d0, clone }) {
      const variants = [null, 'x', 7, [], {}, true];
      const setter = (base) => (k, w) => {
        const c = clone(base);
        if (w === undefined) delete c[k]; else c[k] = w;
        return c;
      };
      if (d0 && typeof d0 === 'object') walkData(d0, setter(d0), 0, variants);
      return [...fewerClues(ctx), ...variants];
    }

    // Every field (two levels deep) set to odd values.
    function walkData(obj, set, depth, variants) {
      if (!obj || typeof obj !== 'object' || depth > 2) return;
      const odd = [undefined, null, '', 'x', 'a,b', -1, 0, 1, 2.5, 99, 1e9, true, [], {}, [1, 2], '0'.repeat(400), 'z'.repeat(9)];
      const keys = Array.isArray(obj) ? [...new Set([0, 1, obj.length - 1].filter((i) => i >= 0 && i < obj.length))] : Object.keys(obj);
      for (const k of keys) {
        const v = obj[k];
        for (const w of odd.concat(oddFor(v))) variants.push(set(k, w));
        walkData(v, (k2, w) => set(k, (() => { const c = clone(v); c[k2] = w; return c; })()), depth + 1, variants);
      }
      if (!Array.isArray(obj)) variants.push(set('__extra', 1));
    }

    // Odd values that fit the type of v.
    function oddFor(v) {
      // Thinned clues (every 2nd or 3rd clue gone) make solvers search.
      const thin = (str, m, blank) => str.replaceAll(/[^,]/g, (ch, i) => (i % m === 0 && /[1-9a-z]/i.test(ch) ? blank : ch));
      if (typeof v === 'string') {
        return [v.slice(0, Math.floor(v.length / 2)), v + ',1', v.replace(/^./, '#'), v.replace(/\d/, '9'),
          thin(v, 2, '0'), thin(v, 3, '0'), thin(v, 2, '.'), thin(v, 3, '.'), thin(v, 2, '-')];
      }
      if (Array.isArray(v)) return [v.slice(1), v.concat(v), v.map(() => -1), v.map((x, i) => (i % 2 ? 0 : x)), v.filter((_, i) => i % 2)];
      if (typeof v === 'number') return [v + 1, -v, v * 100];
      return [];
    }

    // One clue less at a time (string fields): often still one answer, but
    // logic alone stalls, so the decoders' search paths run.
    function fewerClues({ d0, blankOf }) {
      const early = [];
      for (const [key, v] of Object.entries(d0 && typeof d0 === 'object' ? d0 : {})) {
        if (typeof v !== 'string') continue;
        if (v.includes(',')) { // a list of numbers: one item becomes "none" (-1)
          const parts = v.split(',');
          parts.slice(0, 20).forEach((_, i) => { const q = parts.slice(); q[i] = '-1'; early.push({ ...d0, [key]: q.join(',') }); });
          continue;
        }
        // All clues blank, too.
        const blank = blankOf(v);
        early.push({ ...d0, [key]: v.replaceAll(/[1-9a-z]/gi, blank) });
        let made = 0;
        for (let i = 0; i < v.length && made < 40; i++) {
          if (!/[1-9a-z]/i.test(v[i])) continue;
          early.push({ ...d0, [key]: v.slice(0, i) + blank + v.slice(i + 1) });
          made++;
        }
      }
      return early;
    }

    // Out of time: the clock jumps ahead, so generators give up (null)
    // and solvers stop at their time limits.
    function outOfTime({ cfg, tryIt, engine }) {
      const realNow = Date.now;
      let fake = realNow();
      Date.now = () => (fake += 60000);
      try {
        for (let n = cfg.size.min; n <= Math.min(cfg.size.max, cfg.size.min + 1); n++) tryIt(() => cfg.generate(n));
        for (const name of ['Binary', 'Latin', 'Loop', 'Links', 'Parts', 'Pieces', 'Rects', 'RegionNum', 'NumberPath', 'Fillo', 'Moves', 'LegLoop', 'Flow']) {
          const eng = engine(name);
          if (eng) failingHelpers(eng);
        }
      } finally { Date.now = realNow; }
    }

    // Shared engine helpers that fail (no answer, no givens, two
    // answers): the generator must give up cleanly ("give up" paths).
    // All helpers fail, or only the solvers (so random boards still come).
    function failingHelpers(eng) {
      const FAILS = [() => null, () => false, () => ({ solutions: [], capped: false, all: [] }), () => ({ solutions: [[], []], capped: true, all: [[], []] })];
      for (const only of [null, /solve|count|unique/i]) {
        for (const f of FAILS) {
          const saved = {};
          for (const k of Object.keys(eng)) {
            if (typeof eng[k] !== 'function' || k === 'startGame' || (only && !only.test(k))) continue;
            saved[k] = eng[k];
            eng[k] = f;
          }
          try { tryIt(() => cfg.generate(cfg.size.min)); } finally { Object.assign(eng, saved); }
        }
      }
    }

    // Engine edge cases: safety limits and "no loop possible".
    function engineEdges({ tryIt, engine }) {
      const LoopE = engine('Loop'), LinksE = engine('Links');
      if (!LoopE) return;
      const g = LoopE.grid(2, 2);
      tryIt(() => LoopE.settle({ g, must: new Uint8Array(4), rule: () => 1 }, new Uint8Array(g.E)));
      tryIt(() => LoopE.randomLoop(1, 4));
      if (LinksE) tryIt(() => LinksE.settle({ g, label: new Int8Array(4).fill(-1), fill: false, rule: () => 1 }, new Uint8Array(g.E)));
    }

    // Hint walks on more fresh boards, for rare deductions.
    function moreHintWalks({ cfg, tryIt }) {
      const more = Date.now() + 5000;
      for (let b = 0; b < 30 && Date.now() < more; b++) {
        const q = tryIt(() => cfg.generate(cfg.size.min + (b % 2 && cfg.size.def > cfg.size.min ? 1 : 0)));
        if (q) hintWalk(q, cfg.newState(q), more + 3000);
      }
    }

    // Applies hints until solved, no hint, or the time `until`.
    function hintWalk(q, x, until, each = null) {
      for (let i = 0; i < 2000 && !cfg.check(q, x) && Date.now() < until; i++) {
        const hs = tryIt(() => cfg.hints(q, x));
        if (!hs?.length) break;
        if (each) each(hs);
        cfg.applyHint(q, x, hs[0]);
      }
      return x;
    }

    // States along the hint walk; then broken and random states.
    function fuzzStates({ cfg, p, stop, tryIt, clone }) {
      const end = cfg.newState(p); // the walk changes it in place
      hintWalk(p, end, stop, (hs) => {
        tryIt(() => cfg.saveState(end)); // run the save code on every step
        for (const h of hs.slice(0, 3)) tryIt(() => cfg.render(p, end, { readonly: true, hint: h }));
      });
      for (const v of [null, 'x', 5, [], {}, [1, 2, 3], 'zzz'.repeat(50), clone(cfg.saveState(end)).toString().slice(1)]) {
        tryIt(() => cfg.render(p, cfg.loadState(p, v), {}));
      }
      tryIt(() => cfg.render(p, end, { result: true }));
      tryIt(() => cfg.render(p, cfg.newState(p), { result: true }));
      if (!Array.isArray(end) && !ArrayBuffer.isView(end)) return;
      for (const raw of randomStates(end)) {
        if (Date.now() > stop + 6000) break;
        const st = tryIt(() => { const x = cfg.newState(p); raw.forEach((v, i) => { x[i] = v; }); return x; });
        if (st) tryState(st);
      }
    }

    // Random, part solved, a few wrong, and mostly empty states.
    function randomStates(end) {
      const vals = [...new Set([0, ...Array.from(end).filter((v) => typeof v === 'number')])];
      const pick = (a) => a[Math.floor(Math.random() * a.length)];
      const states = [];
      for (let i = 0; i < 25; i++) states.push(Array.from(end, () => pick(vals))); // random
      for (let i = 0; i < 25; i++) states.push(Array.from(end, (v) => (Math.random() < 0.5 ? v : 0))); // part solved
      for (let i = 0; i < 25; i++) states.push(Array.from(end, (v) => (Math.random() < 0.15 ? pick(vals) : v))); // a few wrong
      for (let i = 0; i < 25; i++) states.push(Array.from(end, (v) => {
        if (Math.random() < 0.6) return 0;
        if (Math.random() < 0.2) return pick(vals);
        return v;
      }));
      return states;
    }

    // Check, hint, render and save one state.
    function tryState(st) {
      tryIt(() => cfg.check(p, st));
      const hs = tryIt(() => cfg.hints(p, st)) || [];
      tryIt(() => cfg.render(p, st, {}));
      tryIt(() => cfg.render(p, st, { readonly: true, result: true }));
      if (hs[0]) {
        tryIt(() => cfg.render(p, st, { readonly: true, hint: hs[0] }));
        tryIt(() => cfg.applyHint(p, st, hs[0]));
      }
      tryIt(() => cfg.loadState(p, clone(cfg.saveState(st))));
    }
  });
}

// Start a board of size n. Under load a board may not be made in time
// ("Try again"): then try again, up to three times. Returns false if no
// board came.
async function playSize(page, n) {
  await clickIf(page, '#size-dec');
  await clickIf(page, '#size-inc');
  if (n !== null) await page.evaluate((n) => { window.__puzzleTest.st.size = n; }, n);
  const tryPlay = async (t) => {
    if (t >= 3) return false;
    await clickIf(page, '#play-btn');
    const ok = await page.waitForFunction(() => {
      if (!document.getElementById('game-screen').hidden && document.querySelector('#board-wrap > *')) return 'board';
      return /Could not/.test(document.getElementById('menu-status').textContent) && 'failed';
    }, null, { timeout: 90000 }).then((h) => h.jsonValue()).catch(() => 'timeout');
    return ok === 'board' || tryPlay(t + 1);
  };
  return tryPlay(0);
}

async function workout(page, slug, more) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.coverage.startJSCoverage({ resetOnNavigation: false });

  // A broken link, then the menu.
  await page.goto(url(slug, '?game-id=broken'));
  await page.goto(url(slug));
  await page.waitForSelector('#menu-example figure', { timeout: 60000 });
  await times(30, () => clickIf(page, '#size-dec'));
  await times(30, () => clickIf(page, '#size-inc'));
  await clickIf(page, '#btn-topbar-info');
  await page.waitForTimeout(100);
  await clickIf(page, '#btn-info-close');

  // Paste: junk, then a real game ID.
  await clickIf(page, '#play-shared-btn');
  await page.fill('#paste-input', 'no id here').catch(() => {});
  await clickIf(page, '#btn-paste-start');
  await page.fill('#paste-input', 'game-id=eyJ2IjoxfQ').catch(() => {});
  await clickIf(page, '#btn-paste-start');
  await clickIf(page, '#btn-paste-cancel');

  const sizes = await page.evaluate(() => {
    const t = window.__puzzleTest;
    if (!t) return [null];
    const { min, max } = t.cfg.size;
    // At most five sizes: both ends, their neighbours, and the default.
    const all = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return all.length <= 5 ? all : [...new Set([min, min + 1, t.cfg.size.def, max - 1, max])].sort((a, b) => a - b);
  });
  let fuzzed = false;
  await inOrder(sizes, async (n, i) => {
    if (!(await playSize(page, n))) return;
    if (!fuzzed) {
      fuzzed = true;
      await fuzzBoard(page);
      await buttons(page);
      await fuzzCode(page);
      await closeModals(page);
    }
    if (i === 0 || i === sizes.length - 1) await solveByHints(page);
    // Back to the menu (with the confirm popup).
    await clickIf(page, '#btn-topbar-back');
    await clickIf(page, i % 2 ? '#btn-back-cancel' : '#btn-back-confirm');
    await closeModals(page);
    if (await page.evaluate(() => document.getElementById('menu-screen').hidden)) {
      await clickIf(page, '#btn-topbar-back');
      await clickIf(page, '#btn-back-confirm');
    }
  });

  // Paste a real game ID (as a link) and a broken one.
  const ids = await page.evaluate(() => {
    const t = window.__puzzleTest;
    if (!t) return null;
    const p = t.cfg.generate(t.cfg.size.min);
    const good = t.encodeId(p);
    return { link: location.href.split('?')[0] + '?game-id=' + good, broken: good.slice(0, -6) + 'AAAAAA' };
  });
  if (ids) {
    await inOrder([ids.broken, ids.link], async (text) => {
      await clickIf(page, '#play-shared-btn');
      await page.fill('#paste-input', text);
      await clickIf(page, '#btn-paste-start');
    });
    await waitBoard(page).catch(() => {});
    // Copy with a clipboard API that works, then with one that fails.
    await inOrder([true, false], async (ok) => {
      await page.evaluate((ok) => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => (ok ? Promise.resolve() : Promise.reject(new Error('no'))) }, configurable: true }); }, ok);
      await clickIf(page, '#btn-topbar-share');
      await clickAll(page, '.modal:not([hidden]) [data-copy], .modal:not([hidden]) .copy-btn');
      await page.waitForTimeout(50);
      await closeModals(page);
    });
    // Copy without the clipboard API: the page falls back to a hidden text box.
    await page.evaluate(() => { try { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); } catch {} });
    await clickIf(page, '#btn-topbar-share');
    await clickAll(page, '.modal:not([hidden]) [data-copy]');
    await page.evaluate(() => { document.execCommand = () => { throw new Error('no copy'); }; });
    await clickAll(page, '.modal:not([hidden]) [data-copy]');
    await closeModals(page);
    await clickIf(page, '#btn-topbar-back');
    await clickIf(page, '#btn-back-confirm');
  }
  // Fullscreen button (site.js), twice.
  await times(2, () => page.locator('#topbar-actions button[title*="ullscreen"]').first().click({ timeout: 2000 }).catch(() => {}));

  // Play when no board can be made in time: the page says so.
  await page.evaluate(() => {
    const realNow = Date.now;
    let fake = realNow();
    Date.now = () => (fake += 60000);
    setTimeout(() => { Date.now = realNow; }, 3000);
  });
  await clickIf(page, '#play-btn');
  await page.waitForTimeout(3100);
  await closeModals(page);
  if (await page.evaluate(() => !document.getElementById('game-screen').hidden)) {
    await clickIf(page, '#btn-topbar-back');
    await clickIf(page, '#btn-back-confirm');
  }

  // A saved game is resumed after a reload; a state link restores a board.
  await playSize(page, null);
  await page.mouse.click(10, 10);
  await page.reload();
  await page.waitForTimeout(300);
  const link = await page.evaluate(() => {
    const t = window.__puzzleTest;
    return t?.st.puzzle ? location.href.split('?')[0] + '?game-id=' + t.encodeId(t.st.puzzle, t.st.state) : null;
  });
  if (link) await page.goto(link);
  await page.waitForTimeout(100);
  // Logo during a game asks first; Leave goes to all puzzles.
  if (await page.evaluate(() => !document.getElementById('game-screen').hidden)) {
    await clickIf(page, '#topbar-game');
    await closeModals(page);
    await page.click('#topbar .brand', { timeout: 3000 }).catch(() => {});
    await clickIf(page, '#btn-back-cancel');
  }
  // Back from the setup screen leaves for all puzzles.
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(url(slug));
  await page.waitForTimeout(100);
  await clickIf(page, '#btn-topbar-back');
  await page.waitForTimeout(100);
  return finish(page, slug, errors, more);
}

// "Play random puzzle" opens a game with ?start=new: a board at once.
// Once normally, once with a clock that runs out (no board in time).
async function startNew(page, slug) {
  await page.addInitScript(() => {
    if (!location.search.includes('fakeclock')) return;
    const realNow = Date.now;
    let fake = realNow();
    Date.now = () => (fake += 60000);
    setTimeout(() => { Date.now = realNow; }, 3000);
  });
  await inOrder(['?start=new', '?start=new&fakeclock=1'], async (q) => {
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });
    await page.goto(url(slug, q));
    await page.waitForTimeout(3200);
  });
}

async function finish(page, slug, errors, more) {
  if (fs.existsSync(path.join(root, slug, 'index.html'))) await startNew(page, slug); // game pages only
  if (more) {
    await page.goto(url(slug));
    await page.waitForSelector('#menu-example figure', { timeout: 60000 }).catch(() => {});
    await more(page);
  }
  const cov = await page.coverage.stopJSCoverage();
  const mine = cov.filter((e) => e.url.startsWith('file://') && e.url.endsWith('.js'))
    .map((e) => ({ url: e.url.replace('file://' + root + '/', ''), source: e.source, functions: e.functions }));
  fs.mkdirSync(RAW, { recursive: true });
  fs.writeFileSync(path.join(RAW, `${slug}.json`), JSON.stringify(mine));
  return errors;
}

// Coverage for any page steps (used by the hub test): run `steps(page)`
// and save what ran as coverage/raw/<name>.json.
async function collect(page, name, steps) {
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  await steps(page);
  return finish(page, name, [], null);
}

module.exports = { workout, collect, RAW };
