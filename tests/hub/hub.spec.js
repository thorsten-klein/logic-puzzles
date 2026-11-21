// Tests for the main page (all puzzles): search, tags, sort, views, the
// random button and the shaking logo.

const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { root } = require('../lib/games');
const { collect } = require('../lib/coverage');

const url = 'file://' + path.join(root, 'index.html');

async function steps(page) {
  await page.goto(url);
  const cards = page.locator('#game-grid .game-card');
  const all = await cards.count();
  expect(all).toBeGreaterThan(200);

  // Views: Details is the default, then Icons and List.
  await expect(page.locator('[data-view="details"]')).toHaveAttribute('aria-pressed', 'true');
  for (const v of ['icons', 'list', 'details']) {
    await page.click(`[data-view="${v}"]`);
    await expect(page.locator(`[data-view="${v}"]`)).toHaveAttribute('aria-pressed', 'true');
  }

  // Search narrows the list and says how many match.
  await page.fill('#game-search', 'masyu');
  await expect(page.locator('#hub-stats')).toContainText('match');
  expect(await cards.count()).toBeLessThan(all);
  await page.fill('#game-search', 'no such puzzle xyz');
  await expect(page.locator('.hub-empty')).toBeVisible();
  await page.fill('#game-search', '');

  // Tags: pick one, pick it again to drop it, then "All".
  const chip = page.locator('#tag-filter .chip[data-tag]:not([data-tag=""])').first();
  await chip.click();
  expect(await cards.count()).toBeLessThan(all);
  await page.locator('#tag-filter .chip[data-tag]:not([data-tag=""])').first().click();
  await page.locator('#tag-filter .chip[data-tag]:not([data-tag=""])').nth(1).click();
  await page.locator('#tag-filter .chip[data-tag=""]').click();
  await page.locator('#tag-filter').click({ position: { x: 1, y: 1 } });
  expect(await cards.count()).toBe(all);

  // Sort orders.
  for (const v of ['name-desc', 'playable', 'original', 'name']) await page.selectOption('#game-sort', v);

  // The logo shakes now and then.
  await page.waitForFunction(() => document.querySelector('.hero-logo').classList.contains('is-shaking'), null, { timeout: 8000 });
  await page.waitForFunction(() => !document.querySelector('.hero-logo').classList.contains('is-shaking'), null, { timeout: 4000 });

  // Settings are kept after a reload.
  await page.click('[data-view="list"]');
  await page.reload();
  await expect(page.locator('[data-view="list"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('[data-view="details"]');

  // "Play random puzzle" opens a playable game.
  await page.click('#random-btn');
  await page.waitForURL(/\/[a-z0-9-]+\/index\.html/);
  // The game starts a board at once, without its setup screen.
  await page.waitForSelector("#board-wrap > *", { timeout: 30000 });
  await expect(page.locator("#menu-screen")).toBeHidden();
  expect(page.url()).not.toContain("start=");
  expect(page.url()).not.toBe(url);
}

test('main page: search, tags, sort, views, random @ui @coverage', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (process.env.COVERAGE) await collect(page, 'hub', steps);
  else await steps(page);
  expect(errors).toEqual([]);
});
