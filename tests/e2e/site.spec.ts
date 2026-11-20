import { test, expect, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';

const EMPTY = 'http://localhost:4317/cut/';
const FX = 'http://localhost:4318/cut/';
const ROUTES = ['', 'cut', 'post', 'radar', 'streamers', 'feed', 'earn', 'pay'];

async function prep(page: Page, fixtures = false) {
  await page.addInitScript(() => { try { sessionStorage.setItem('cut:loaded', '1'); } catch {} });
  if (fixtures) await page.route('https://fixture.test/**', (r) => {
    const f = 'tests/fixtures' + new URL(r.request().url()).pathname;
    if (!existsSync(f)) return r.fulfill({ status: 404, body: '', headers: { 'access-control-allow-origin': '*' } });
    r.fulfill({ body: readFileSync(f), contentType: f.endsWith('.png') ? 'image/png' : 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  // keep tests independent of third-party uptime: market and SOL price fail fast
  await page.route(/dexscreener|jup\.ag|tiktok\.com/, (r) => r.abort());
}

for (const width of [1440, 320]) {
  for (const base of [EMPTY, FX]) {
    test(`no horizontal scroll at ${width}px (${base === FX ? 'with data' : 'empty config'})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await prep(page, base === FX);
      for (const r of ROUTES) {
        await page.goto(`${base}#/${r}`);
        await page.waitForLoadState('networkidle');
        const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
        expect(sw, `#/${r} at ${width}`).toBeLessThanOrEqual(iw);
      }
    });
  }
}

test('empty config renders the designed empty states', async ({ page }) => {
  await prep(page);
  await page.goto(EMPTY);
  await expect(page.locator('[data-wall] .empty')).toContainText('Nothing in this list yet. Check back after the next refresh.');
  await expect(page.locator('[data-clips] .empty')).toBeVisible();
  await expect(page.locator('[data-money] .empty')).toContainText('Payments open when CUT is configured.');
  // the curated feed.json ships with real TikTok links, so this row is filled even with empty config
  await expect(page.locator('[data-tiktok] .vcard').first()).toBeVisible();
  await expect(page.locator('[data-market] .empty')).toContainText("Couldn't load the market. Try again in a minute.");
  await expect(page.locator('.band li').first()).toContainText('0');
  // hidden while config is empty: no Buy $CUT, no TikTok login, no token strip, no footer links
  await expect(page.getByText('Buy $CUT', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Log in with TikTok', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-token]')).toHaveCount(0);
  await expect(page.locator('.foot__nav h2', { hasText: 'Community' })).toHaveCount(0);
  for (const [r, text] of [['radar', 'Nothing in this list yet.'], ['streamers', 'Nothing in this list yet.'], ['post', 'Nothing queued. Export a clip in Cut first.'], ['feed', 'Nothing in this list yet.']]) {
    await page.goto(`${EMPTY}#/${r}`);
    await expect(page.locator('.empty', { hasText: text }).first()).toBeVisible();
  }
  await page.goto(`${EMPTY}#/earn?tab=receipts`);
  await expect(page.locator('.empty', { hasText: 'Payments open when CUT is configured.' })).toBeVisible();
});

test('pay form is disabled without REFERENCE_KEY, and shows what will be sent', async ({ page }) => {
  await prep(page);
  await page.goto(`${EMPTY}#/pay?to=MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr&clip=${encodeURIComponent('https://www.tiktok.com/@a/video/1234567890')}&price=0.25`);
  await expect(page.getByRole('button', { name: 'Sign and pay' })).toBeDisabled();
  await expect(page.locator('[data-why]')).toHaveText('Payments open when CUT is configured.');
  await expect(page.locator('[data-t-price]')).toHaveText('0.25');
  await expect(page.locator('[data-t-memo]')).toHaveText(/cut:v1:[0-9a-f]{12}/);
  await expect(page.locator('[data-t-cb]')).toHaveText('0.00875');
});

test('invalid pay link parameters are flagged', async ({ page }) => {
  await prep(page);
  await page.goto(`${EMPTY}#/pay?to=nope&clip=http://x.com&price=-1`);
  for (const n of ['to', 'clip', 'price']) await expect(page.locator(`[name=${n}]`)).toHaveAttribute('aria-invalid', 'true');
});

test('charts toggle to a table view and back', async ({ page }) => {
  await prep(page, true);
  await page.goto(FX);
  const fig = page.locator('[data-chart="viewers"]');
  await expect(fig.locator('.chart__plot svg')).toBeVisible();
  await fig.getByRole('button', { name: 'Table' }).click();
  await expect(fig.locator('.chart__table table')).toBeVisible();
  await expect(fig.locator('.chart__plot')).toBeHidden();
  await fig.getByRole('button', { name: 'Chart' }).click();
  await expect(fig.locator('.chart__plot')).toBeVisible();
  for (const id of ['by-platform', 'by-lang']) {
    const f = page.locator(`[data-chart="${id}"]`);
    await f.getByRole('button', { name: 'Table' }).click();
    await expect(f.locator('.chart__table tbody tr').first()).toBeVisible();
  }
  await expect(page.locator('#viewers-summary')).toContainText('Peak');
});

test('filters change panels without repainting colours', async ({ page }) => {
  await prep(page, true);
  await page.goto(FX);
  const kickFill = () => page.locator('[data-chart="viewers"] path[fill="var(--kick)"]').count();
  expect(await kickFill()).toBe(1);
  await page.locator('[data-f="p"] button', { hasText: 'Kick' }).click();
  await expect(page.locator('[data-chart="viewers"] .chart__title')).toHaveText('Kick viewers over time');
  expect(await kickFill()).toBe(1);
  expect(await page.locator('[data-chart="viewers"] path[fill="var(--twitch)"]').count()).toBe(0);
});

test('keyboard reaches every control on the desk', async ({ page }) => {
  await prep(page, true);
  await page.goto(FX);
  await page.waitForLoadState('networkidle');
  const ids = await page.evaluate(() => {
    const els = [...document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea')]
      .filter((e) => e.offsetParent !== null && !e.closest('[hidden],[inert]'));
    els.forEach((e, i) => e.setAttribute('data-kb', String(i)));
    return els.length;
  });
  const seen = new Set<string>();
  for (let i = 0; i < ids + 10; i++) {
    await page.keyboard.press('Tab');
    const k = await page.evaluate(() => document.activeElement?.getAttribute('data-kb'));
    if (k) seen.add(k);
  }
  // tile overlay buttons become visible on focus-within, so they count too
  expect(seen.size).toBeGreaterThanOrEqual(ids);
});

test('works under a subpath with hash routes', async ({ page }) => {
  await prep(page);
  const bad: string[] = [];
  page.on('response', (r) => { if (r.url().startsWith('http://localhost:4317') && r.status() >= 400) bad.push(r.url()); });
  for (const r of ROUTES) { await page.goto(`${EMPTY}#/${r}`); await page.waitForLoadState('networkidle'); }
  expect(bad).toEqual([]);
  await expect(page.locator('.brand img')).toHaveJSProperty('naturalWidth', 96);
});
