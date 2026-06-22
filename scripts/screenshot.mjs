import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = process.env.APP_URL || 'http://localhost:5176/';

await mkdir('screenshots', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('text=OOO Maximizer', { timeout: 15000 });
await page.waitForSelector('text=days off', { timeout: 30000 });

for (const width of [1440, 375]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `screenshots/mui-${width}px.png`, fullPage: true });
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  console.log(`${width}px: overflow=${metrics.scrollWidth > metrics.clientWidth}, scrollWidth=${metrics.scrollWidth}`);
}

await browser.close();
console.log('Screenshots saved to screenshots/');
