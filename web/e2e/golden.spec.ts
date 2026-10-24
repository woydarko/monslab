import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/${name}.png` });

test('new player reaches verified replay', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^play$/i }).click();

    // Dev login signs in automatically; the register dialog asks for a name.
    await page.getByLabel(/username/i).fill(`e2e_${Date.now() % 1e6}`);
    await page.getByRole('button', { name: /create lab/i }).click();
    await expect(page.getByText(/@e2e_/)).toBeVisible({ timeout: 30_000 });
    await shot(page, 'lab-1280');

    await page.getByRole('button', { name: /egg/i }).first().click();
    const egg = page.getByRole('button', { name: /egg|tap/i }).last();
    for (let i = 0; i < 3; i++) await egg.click();
    await expect(page.getByText(/COMMON|RARE|EPIC/)).toBeVisible({ timeout: 20_000 });
    await shot(page, 'egg-1280');
    await page.getByRole('button', { name: /^equip$/i }).click();

    await page.getByRole('button', { name: /levels|battle/i }).first().click();
    await page.getByRole('button', { name: /^fight$/i }).first().click();
    await expect(page.getByText(/VICTORY|DEFEAT/)).toBeVisible({ timeout: 15_000 });
    await shot(page, 'result-1280');

    await page.getByRole('button', { name: /^replay$/i }).first().click();
    await expect(page.getByText('Verified')).toBeVisible({ timeout: 20_000 });
    await shot(page, 'replay-1280');
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, 'replay-390');
});
