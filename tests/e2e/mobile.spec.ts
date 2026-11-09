import { expect, test } from '@playwright/test';
import { asUser, db, familyWithSample, makeUser, shot, signIn, today } from './helpers';

test('new user: onboarding, wizard, itinerary, travel link, packing', async ({ page, context }) => {
  const u = await makeUser('Maria Lopez'); await signIn(context, u);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Set up your family space' })).toBeVisible();
  await page.getByLabel('Family name').fill('The Lopez family');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Plan your first event' })).toBeVisible();
  await page.getByRole('link', { name: 'Create event' }).first().click();
  await shot(page, 'wizard-1');
  await page.getByRole('button', { name: /^Vacation/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Give your event a name')).toBeVisible();
  await page.getByLabel('Event name').fill('Beach week');
  await page.getByLabel('Start date').fill('2027-03-12'); await page.getByLabel('End date').fill('2027-03-15');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel(/without an account/).fill('Avery, Rowan');
  await page.getByRole('button', { name: 'Create event' }).click();
  await expect(page.getByRole('heading', { name: 'Beach week', level: 2 })).toBeVisible();
  await shot(page, 'overview-new');
  const ev = page.url().split('/').pop()!;
  expect((await db.query('select 1 from event_days where event_id=$1', [ev])).rowCount).toBe(4);

  await page.goto(`/events/${ev}/agenda`);
  await page.getByRole('button', { name: 'Add activity' }).click();
  await page.getByLabel('Title').fill('Lunch at the pier');
  await page.getByLabel('Start').fill('12:30');
  await page.getByRole('button', { name: 'Add activity' }).last().click();
  await expect(page.getByRole('button', { name: /Lunch at the pier/ })).toBeVisible();
  expect((await db.query(`select start_time::text t from itinerary_items where event_id=$1`, [ev])).rows[0].t).toBe('12:30:00');

  await page.goto(`/events/${ev}/travel`);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Airline or company').fill('Delta');
  await page.getByLabel('Flight or train number').fill('123');
  await page.getByLabel('From').fill('ATL'); await page.getByLabel('To', { exact: true }).fill('MCO');
  await page.getByLabel('Departs (local time)').fill('2027-03-12T08:30');
  await page.getByRole('button', { name: 'Add travel' }).click();
  await expect(page.getByText('ATL to MCO')).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Departs (local time)').fill('2027-03-12T09:45');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Fri, Mar 12, 9:45 AM')).toBeVisible();
  await page.goto(`/events/${ev}/agenda`);
  await expect(page.getByRole('button', { name: /Flight Delta 123: ATL → MCO/ })).toHaveCount(1);
  await expect(page.getByText('9:45').first()).toBeVisible();
  await shot(page, 'agenda-timeline');

  await page.goto(`/events/${ev}/packing`);
  await page.getByRole('button', { name: 'Add items' }).click();
  await page.getByLabel('One item per line').fill('Beach towels\nSocks x3\nGoggles');
  await page.getByRole('button', { name: 'Add 3 items' }).click();
  await expect(page.getByRole('checkbox', { name: 'Goggles' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Goggles' }).click();
  await expect.poll(async () => (await db.query(`select is_packed from packing_items where event_id=$1 and name='Goggles'`, [ev])).rows[0].is_packed).toBe(true);
  await shot(page, 'packing');
});

test('Go Mode, linked edit path, offline packing queue', async ({ page, context }) => {
  const { u, ev } = await familyWithSample(); await signIn(context, u);
  await page.goto(`/events/${ev}`);
  await expect(page.getByText("It's happening today")).toBeVisible();
  await shot(page, 'overview-active');
  await page.getByRole('tab', { name: 'Go' }).click();
  await expect(page).toHaveURL(/today$/);
  await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();
  await shot(page, 'today');
  await page.getByRole('button', { name: /Check in: Palm Court/ }).first().click();
  await expect(page.getByText('From stay')).toBeVisible();
  await shot(page, 'item-sheet');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('link', { name: 'Passes', exact: true }).click();
  await expect(page.getByText('HTL-00000')).toBeVisible();
  await shot(page, 'passes');

  // Offline
  await page.goto(`/events/${ev}/packing`);
  await expect(page.getByRole('checkbox', { name: 'Sunscreen' })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 }).catch(() => page.reload());
  await page.waitForTimeout(800);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Sunscreen' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('checkbox', { name: 'Sunscreen' }).click();
  await expect(page.getByText(/change waiting/)).toBeVisible();
  await shot(page, 'offline');
  expect((await db.query(`select is_packed from packing_items where event_id=$1 and name='Sunscreen'`, [ev])).rows[0].is_packed).toBe(false);
  // Survives a reload while offline
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Sunscreen' })).toHaveAttribute('aria-checked', 'true', { timeout: 15000 });
  await context.setOffline(false);
  await expect.poll(async () => (await db.query(`select is_packed from packing_items where event_id=$1 and name='Sunscreen'`, [ev])).rows[0].is_packed, { timeout: 15000 }).toBe(true);
  // Nothing private is in plain browser storage
  const leak = await page.evaluate(() => Object.keys(localStorage).filter((k) => localStorage[k].includes('HTL-00000')));
  expect(leak).toEqual([]);
});

test('invitation, viewer limits, conflict, documents, sign out wipes cache', async ({ page, context, browser }) => {
  const { u, ws, ev } = await familyWithSample(); await signIn(context, u);
  // Conflict: someone else saves after the form opened.
  await page.goto(`/events/${ev}/notes`);
  await page.getByRole('button', { name: /Arena tips/ }).click();
  await page.getByLabel('Note', { exact: true }).fill('Mine');
  await db.query(`update notes set body='Theirs' where event_id=$1 and title='Arena tips'`, [ev]);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Someone else just changed this')).toBeVisible();
  await shot(page, 'conflict');
  await page.getByRole('button', { name: 'Keep theirs' }).click();
  expect((await db.query(`select body from notes where event_id=$1 and title='Arena tips'`, [ev])).rows[0].body).toBe('Theirs');
  await page.reload();

  // Document upload with signed URL
  await page.goto(`/events/${ev}/documents`);
  await page.getByTestId('file-input').setInputFiles({ name: 'ticket.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
  await expect(page.getByRole('button', { name: 'ticket.pdf 1 KB' })).toBeVisible();
  await shot(page, 'documents');

  // Invite a viewer
  await page.goto(`/events/${ev}/participants`);
  await page.getByRole('button', { name: 'Invite' }).click();
  await page.getByLabel('Their email').fill('grandma@example.test');
  await page.getByLabel('What can they do?').selectOption('viewer');
  await page.getByRole('button', { name: 'Create invitation' }).click();
  const link = await page.getByLabel('Invitation link').inputValue();
  await shot(page, 'invite');
  const v = await makeUser('Grandma Jo');
  const vc = await browser.newContext({ viewport: { width: 390, height: 844 } }); await signIn(vc, v);
  const vp = await vc.newPage();
  await vp.goto(link.replace(/^https?:\/\/[^/]+/, 'http://localhost:4173'));
  await vp.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(vp.getByRole('heading', { name: /Orlando/, level: 2 })).toBeVisible();
  await expect(vp.getByRole('button', { name: 'Quick add' })).toHaveCount(0);
  await vp.goto(`http://localhost:4173/events/${ev}/packing`);
  await vp.getByRole('checkbox', { name: 'Snacks' }).click();
  await expect.poll(async () => (await db.query(`select is_packed from packing_items where event_id=$1 and name='Snacks'`, [ev])).rows[0].is_packed).toBe(true);
  expect((await asUser(v.id, `select workspace_role($1) r`, [ws]))[0].r).toBe('guest');

  // Sign out wipes the encrypted store
  await vp.goto('http://localhost:4173/profile');
  await vp.getByRole('button', { name: 'Sign out' }).click();
  await expect(vp.getByRole('button', { name: 'Continue with Apple' })).toBeVisible();
  const left = await vp.evaluate(() => new Promise<number>((ok) => { const r = indexedDB.open('compandra-secure', 1); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').count(); q.onsuccess = () => ok(q.result); }; }));
  expect(left).toBe(0);
  await expect(vp.getByRole('img', { name: 'Merch Labs' })).toBeVisible();
  await expect(vp.getByRole('heading', { name: 'compandra.' })).toBeVisible();
  await shot(vp, 'login'); await vc.close();
});
