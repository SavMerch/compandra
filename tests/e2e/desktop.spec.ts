import { expect, test } from '@playwright/test';
import { db, familyWithSample, shot, signIn } from './helpers';

test('desktop board drags, side panel, search', async ({ page, context }) => {
  const { u, ev } = await familyWithSample(); await signIn(context, u);
  await page.goto('/'); await expect(page.getByRole('navigation', { name: 'Main' }).first()).toBeVisible(); await page.waitForTimeout(400); await shot(page, 'desktop-home');
  await page.goto(`/events/${ev}`); await page.waitForTimeout(400); await shot(page, 'desktop-overview');
  await page.goto(`/events/${ev}/agenda`);
  const card = page.getByRole('button', { name: /Mini-golf/ });
  await expect(card).toBeVisible();
  const grip = card.locator('xpath=preceding-sibling::button');
  const firstCol = page.getByRole('region', { name: /Sun|Mon|Tue|Wed|Thu|Fri|Sat/ }).nth(3);
  await grip.scrollIntoViewIfNeeded();
  const g = (await grip.boundingBox());
  const t = (await firstCol.boundingBox());
  if (g && t) { await page.mouse.move(g.x + 8, g.y + 8); await page.mouse.down(); await page.mouse.move(g.x - 20, g.y + 8, { steps: 4 }); await page.mouse.move(Math.max(t.x + 100, 300), t.y + 150, { steps: 12 }); await page.waitForTimeout(150); await page.mouse.up(); }
  await expect.poll(async () => (await db.query(`select event_day_id from itinerary_items where event_id=$1 and title='Mini-golf'`, [ev])).rows[0].event_day_id, { timeout: 8000 }).not.toBeNull();
  await page.getByRole('button', { name: /Team pizza dinner/ }).click();
  await expect(page.getByRole('heading', { name: 'Team pizza dinner' })).toBeVisible();
  await page.waitForTimeout(500); await shot(page, 'desktop-agenda');
  await page.goto(`/search?event=${ev}`);
  await page.getByLabel('Search').fill('HTL-00');
  await expect(page.getByText('Palm Court Hotel (fictional)')).toBeVisible();
});
