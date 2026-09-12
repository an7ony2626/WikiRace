import { test, expect } from '@playwright/test';
import { registerAndLandOnHome, startCustomGame } from './helpers';

test('una partita completata compare sia in "Partite concluse" che in classifica', async ({ page }) => {
  const user = await registerAndLandOnHome(page);

  await startCustomGame(page, 'Napoli', 'Italia');
  await page
    .locator('app-wiki-article a')
    .filter({ hasText: /^Italia$/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Traguardo raggiunto' })).toBeVisible();
  await page.getByRole('button', { name: 'Torna alla home' }).click();

  // Partite concluse
  await page.goto('/completed');
  const completedRow = page.locator('.completed-row').filter({ hasText: user.username });
  await expect(completedRow).toBeVisible();
  await expect(completedRow).toContainText('Napoli');
  await expect(completedRow).toContainText('Italia');

  await completedRow.click();
  await expect(page).toHaveURL(/\/completed\/\d+/);
  await expect(page.locator('.summary-card')).toContainText(user.username);
  await expect(page.locator('.summary-card')).toContainText('Sfida personalizzata');

  // Classifica
  await page.goto('/leaderboard');
  const leaderboardRow = page.locator('.leaderboard li').filter({ hasText: user.username });
  await expect(leaderboardRow).toBeVisible();
  await expect(leaderboardRow).toContainText('1 partita');

  await page.getByRole('button', { name: 'Per partite' }).click();
  await expect(leaderboardRow).toBeVisible();
});