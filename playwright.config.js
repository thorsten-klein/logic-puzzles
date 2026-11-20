// Playwright test setup. Uses the installed Google Chrome, so no browser
// download is needed. Pages are opened as local files.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  // Few browsers at once, so the computer stays usable (coverage runs
  // are heavy). WORKERS=8 npm test runs more.
  workers: Number(process.env.WORKERS) || (process.env.COVERAGE ? 3 : 4),
  // CI machines are slower, and generators stop at a time limit: one
  // more try there before a test counts as failed.
  retries: process.env.CI ? 1 : 0,
  timeout: 120000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    channel: 'chrome',
    // A click or fill that waits longer has gone wrong.
    actionTimeout: 15000,
    headless: true,
    viewport: { width: 900, height: 900 },
  },
});
