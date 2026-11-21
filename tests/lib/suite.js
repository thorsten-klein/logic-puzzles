// The tests every puzzle gets. Each puzzle has its own spec file in
// tests/<slug>/, which calls `puzzleTests(slug, extra)`.
//
// Test names carry a tag: @logic (Node, no browser) or @ui (Chrome).
//
// extra.answer(p, cfg)  puzzle rules for a new board's answer; returns a
//                       list of problems (empty = fine)
// extra.skipKind        reason to skip the kind check (the answer has
//                       another form than its kind)
// extra.givenNotAnswer  reason why `given` is not part of the answer
// extra.workout(page)   more steps for the coverage workout (code that
//                       the general workout does not reach)

const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { root, loadGame, sizesOf, checkBoard, OWN_PAGE, isEmpty, ser, clone } = require('./games');
const { kindOf, CHECKS, SKIP, MARKS_STATE } = require('./kinds');
const { workout } = require('./coverage');

const full = !!process.env.FULL;
const only = (process.env.GAMES || '').split(',').filter(Boolean);
const MAX_CHANGES = 400;

// Change one cell of the solved state at a time, to another value the
// player uses. The board must not count as solved any more. (Else there
// is a second answer, or `check` is too loose.)
function oneChangeBreaks(cfg, q, end) {
  if (!Array.isArray(end) && !ArrayBuffer.isView(end)) return null;
  const vals = [...new Set(Array.from(end).filter((v) => typeof v === 'number' && !isEmpty(v)))];
  const pairs = [];
  end.forEach((v, i) => { if (!isEmpty(v)) for (const w of vals) if (w !== v) pairs.push([i, w]); });
  // Spread the sample over the whole board.
  const step = Math.max(1, pairs.length / MAX_CHANGES);
  const bad = [];
  for (let x = 0; x < pairs.length; x += step) {
    const [i, w] = pairs[Math.floor(x)];
    const old = end[i];
    end[i] = w;
    try { if (cfg.check(q, end)) bad.push(`cell ${i}: ${old} -> ${w}`); } finally { end[i] = old; }
  }
  return bad;
}

function logicTests(slug, cfg, extra) {
  const kind = kindOf(slug);
  const skipKind = extra.skipKind || SKIP[kind]?.[slug];
  for (const n of sizesOf(cfg, full)) {
    test(`size ${n} @logic`, async () => {
      for (let b = 0; b < (full ? 3 : 1); b++) {
        const r = await test.step('board, unique answer, hints', () => checkBoard(cfg, n, expect));
        for (const w of r.warnings) test.info().annotations.push({ type: 'warning', description: w });
        test.info().annotations.push({ type: 'hints', description: `${r.steps} hints, ${r.reveals} reveals, made in ${r.ms} ms` });
        expect(r.peeks, 'hints that use the hidden answer without saying so').toEqual([]);

        await test.step('share code is stable', () => {
          const code = ser(cfg.encode(r.q));
          expect(ser(cfg.encode(cfg.decode(clone(cfg.encode(r.q))))), 'encode(decode(code))').toBe(code);
        });

        if (CHECKS[kind] && !skipKind) {
          await test.step(`answer fits the ${kind} rules`, () => {
            expect(CHECKS[kind](r.q, cfg), `${kind} rules`).toEqual([]);
          });
        }

        const { given, solution } = r.q;
        if (!extra.givenNotAnswer && given && solution && given.length === solution.length && typeof given[0] === 'number') {
          await test.step('given cells match the answer', () => {
            const bad = [];
            for (let k = 0; k < given.length; k++) if (given[k] > 0 && given[k] !== solution[k]) bad.push(`cell ${k}: given ${given[k]}, answer ${solution[k]}`);
            expect(bad, 'givens that differ from the answer').toEqual([]);
          });
        }

        if (extra.answer) {
          await test.step('answer fits the puzzle rules', () => {
            expect(extra.answer(r.q, cfg), `${slug} rules`).toEqual([]);
          });
        }

        if (!MARKS_STATE.has(kind)) await test.step('one change breaks the answer', () => {
          const bad = oneChangeBreaks(cfg, r.q, r.end);
          if (bad) expect(bad, 'changes that still count as solved').toEqual([]);
        });
      }
    });
  }
}

const url = (slug) => 'file://' + path.join(root, slug, 'index.html');

// A short text that changes whenever the board changes.
// Grid labels (.gl) are layout, not game state: their place can move by
// a pixel when the zoom is not a whole number.
const boardSig = () => [...document.querySelectorAll('#board-wrap *:not(.gl)')].map((e) => {
  const cls = typeof e.className === 'string' ? e.className : (e.className?.baseVal) || '';
  const val = e.value !== undefined && e.tagName === 'INPUT' ? e.value : '';
  const style = e.getAttribute('style') || '';
  return cls + ':' + val + ':' + style + ':' + (e.childElementCount ? '' : e.textContent);
}).join('|');

async function play(page) {
  await page.click('#play-btn');
  await page.waitForFunction(() => !document.getElementById('game-screen').hidden && document.querySelector('#board-wrap > *'), null, { timeout: 30000 });
}

// One move: a hint for shell games, a typed digit or a click on own pages
// (they have no hint Apply button).
async function move(page, slug) {
  if (!OWN_PAGE.has(slug)) {
    await page.click('#btn-topbar-hint');
    await page.click('#btn-hint-apply');
    return;
  }
  const input = page.locator('#board-wrap input').first();
  if (await input.count()) { await input.fill('1'); await input.dispatchEvent('input'); return; }
  await page.locator('#board-wrap .cell').nth(1).click();
}

function uiTests(slug) {
  test('setup screen shows the example @ui', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url(slug));
    await expect(page.locator('#menu-example figure')).toHaveCount(2, { timeout: 30000 });
    expect(errors).toEqual([]);
  });

  if (!OWN_PAGE.has(slug)) {
    test('hints solve the board and Submit says Correct @ui', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url(slug));
      await play(page);
      const applied = await page.evaluate(async () => {
        const $ = (s) => document.querySelector(s);
        let n = 0;
        for (; n < 1000; n++) {
          $('#btn-topbar-hint').click();
          await new Promise((r) => setTimeout(r, 0));
          if ($('#btn-hint-apply').hidden) break;
          $('#btn-hint-apply').click();
        }
        $('#btn-hint-close').click();
        return n;
      });
      expect(applied).toBeGreaterThan(0);
      await page.click('#submit-btn');
      await expect(page.locator('#modal-title')).toContainText('Correct');
      expect(errors).toEqual([]);
    });
  }

  if (!OWN_PAGE.has(slug)) {
    // "Show solution" and Submit: the red/green view must mark a wrong
    // cell red, mark nothing on a correct part, and mark the missing part
    // of a half filled board yellow.
    test('red/green view marks mistakes and missing parts @ui', async ({ page }) => {
      await page.goto(url(slug));
      await page.waitForFunction(() => window.__puzzleTest);
      const r = await page.evaluate(() => {
        const { cfg } = window.__puzzleTest;
        let p = null;
        for (let t = 0; t < 2 && !p; t++) p = cfg.generate(cfg.size.min);
        const s = cfg.newState(p);
        for (let i = 0; i < 3000 && !cfg.check(p, s); i++) { const h = cfg.hints(p, s); if (!h.length) break; cfg.applyHint(p, s, h[0]); }
        const view = (st) => cfg.render(p, st, { readonly: true, result: true });
        const bad = (st) => (cfg.mistakes ? cfg.mistakes(p, st) : view(st).querySelectorAll('.bad, .wrong, [class*="-bad"]').length);
        const miss = (st) => view(st).querySelectorAll('.show, .miss, [class*="-miss"]').length;
        if (!Array.isArray(s) && !ArrayBuffer.isView(s)) return { skip: true };
        const copy = (x) => (typeof x[0] === 'object' ? x.map((y) => y.slice()) : x.slice ? x.slice() : Array.from(x));
        const empty = cfg.newState(p);
        let half;
        if (typeof s[0] === 'object') half = s.filter((_, j) => j % 2);
        else { half = copy(s); half.forEach((v, i) => { if (i % 2) half[i] = empty[i]; }); }
        const out = { solvedState: bad(s) ? JSON.stringify(Array.from(s)) + ' answer ' + JSON.stringify(p.solution) : '', solved: bad(s), half: bad(half), missing: miss(half), halfDone: !!cfg.check(p, half), wrongAt: -1, wrong: 0 };
        if (typeof s[0] === 'object') { // a list of pieces: shrink one
          const w = copy(s);
          const i = w.findIndex((x) => x.length > 1 && (x.length !== 4 || x[0] !== x[2] || x[1] !== x[3]));
          if (i >= 0) {
            if (w[i].length === 4 && p.R && w[i].every((v) => typeof v === 'number' && v < Math.max(p.R, p.C))) {
              w[i] = w[i][0] < w[i][2] ? [w[i][0], w[i][1], w[i][2] - 1, w[i][3]] : [w[i][0], w[i][1], w[i][2], w[i][3] - 1];
            } else w[i] = w[i].slice(0, -1);
            Object.assign(out, { wrongAt: i, wrong: bad(w) });
          }
          return out;
        }
        // Wrong: a cell gets a non-empty value the answer does not have there.
        const vals = [...new Set([...Array.from(s), ...Array.from(empty)])];
        for (let i = 0; i < s.length && out.wrongAt < 0; i++) {
          for (const v of vals) {
            if (v === s[i] || v === empty[i]) continue; // a change, not an emptied cell
            const w = copy(s);
            w[i] = v;
            if (!cfg.check(p, w)) { out.wrongAt = i; out.wrong = bad(w); out.change = `${s[i]} -> ${v}`; break; }
          }
        }
        return out;
      });
      if (r.skip) return;
      expect(r.solved, `red marks on the solved board ${r.solvedState || ''}`).toBe(0);
      expect(r.half, 'red marks on a half filled correct board').toBe(0);
      if (!r.halfDone) expect(r.missing, 'yellow marks on a half filled board').toBeGreaterThan(0);
      if (r.wrongAt >= 0) expect(r.wrong, `red marks when cell ${r.wrongAt} is wrong (${r.change || 'piece'})`).toBeGreaterThan(0);
    });
  }

  test('undo and redo @ui', async ({ page }) => {
    await page.goto(url(slug));
    await play(page);
    const s0 = await page.evaluate(boardSig);
    await expect(page.locator('#btn-topbar-undo')).toBeDisabled();
    await move(page, slug);
    const s1 = await page.evaluate(boardSig);
    expect(s1).not.toBe(s0);
    await page.click('#btn-topbar-undo');
    expect(await page.evaluate(boardSig)).toBe(s0);
    await page.click('#btn-topbar-redo');
    expect(await page.evaluate(boardSig)).toBe(s1);
    await expect(page.locator('#btn-topbar-redo')).toBeDisabled();
  });

  test('"Current state" share link restores the board @ui', async ({ page }) => {
    await page.goto(url(slug));
    await play(page);
    await move(page, slug);
    const before = await page.evaluate(boardSig);
    await page.click('#btn-topbar-share');
    const link = await page.locator('#share-state-url').inputValue();
    expect(link).toContain('game-id=');
    // Open the link in a fresh page (no saved game there).
    const other = await page.context().newPage();
    await other.goto(link);
    await other.waitForFunction(() => document.querySelector('#board-wrap > *'), null, { timeout: 30000 });
    expect(await other.evaluate(boardSig)).toBe(before);
  });
}

function puzzleTests(slug, extra = {}) {
  if (only.length && !only.includes(slug)) return;
  test.describe(`${slug} (${kindOf(slug)})`, () => {
    const cfg = loadGame(slug);
    if (cfg) logicTests(slug, cfg, extra); // own pages: browser tests only
    uiTests(slug);
    // Code coverage: only with COVERAGE=1 (npm run test:coverage).
    if (process.env.COVERAGE) {
      test('coverage workout @coverage', async ({ page }) => {
        test.setTimeout(600000);
        const errors = await workout(page, slug, extra.workout);
        test.info().annotations.push({ type: 'page errors', description: String(errors.length) });
      });
    }
  });
}

module.exports = { puzzleTests, test, expect };
