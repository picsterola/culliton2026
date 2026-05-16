#!/usr/bin/env node
// Regenerate images/og-card.png from og-source.html.
// Run this whenever data/candidates.json changes, or any time the OG card
// design changes. Requires a local dev server running on :8765 so the
// page's fetch('data/candidates.json') works.
//
//   python3 -m http.server 8765   # in another terminal
//   node scripts/regen-og.js

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8765/og-source.html', { waitUntil: 'networkidle' });
  // Give the inline fetch a moment to swap the count in.
  await page.waitForTimeout(500);
  await page.screenshot({
    path: 'images/og-card.png',
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  });
  await browser.close();
  console.log('Wrote images/og-card.png (1200x630)');
})();
