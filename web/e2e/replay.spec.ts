import { expect, test } from '@playwright/test';

// The server computed this outcome in Node; the browser re-simulates it from chain data.
test('replay works logged out', async ({ browser }) => {
    const id = process.env.E2E_REPLAY_ID;
    test.skip(!id, 'set E2E_REPLAY_ID to a finalized battle id');
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/?replay=${id}`);
    await expect(page.getByText('Verified')).toBeVisible({ timeout: 20_000 });
    await context.close();
});
