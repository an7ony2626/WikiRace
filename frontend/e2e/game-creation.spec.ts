import { test, expect } from '@playwright/test';
import { registerAndLandOnHome, startRandomGame, startCustomGame } from './helpers';

test.beforeEach(async ({ page }) => {
  await registerAndLandOnHome(page);
});

test('avviare una sfida casuale porta alla pagina di gioco', async ({ page }) => {
  await startRandomGame(page);

  await expect(page.locator('app-wiki-article')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Arrenditi' })).toBeVisible();
});

test('avviare una sfida personalizzata con pagine scelte tramite ricerca', async ({ page }) => {
  await startCustomGame(page, 'Napoli', 'Italia');

  await expect(page.locator('.topbar .route-labels')).toContainText('Napoli');
  await expect(page.locator('.topbar .route-labels')).toContainText('Italia');
});

test('non è possibile creare una sfida con la stessa pagina di partenza e di arrivo', async ({ page }) => {
  const picker = (label: string) => page.locator('app-page-search').filter({ hasText: label });

  await picker('Pagina di partenza').getByPlaceholder('Cerca una pagina Wikipedia…').fill('Napoli');
  await picker('Pagina di partenza')
    .locator('.result-title')
    .filter({ hasText: /^Napoli$/ })
    .first()
    .click();

  await picker('Pagina di arrivo').getByPlaceholder('Cerca una pagina Wikipedia…').fill('Napoli');
  await picker('Pagina di arrivo')
    .locator('.result-title')
    .filter({ hasText: /^Napoli$/ })
    .first()
    .click();

  await page.getByRole('button', { name: 'Inizia una nuova sfida' }).click();

  await expect(page.getByText('La pagina di partenza e quella di arrivo devono essere diverse')).toBeVisible();
  await expect(page).toHaveURL('/');
});