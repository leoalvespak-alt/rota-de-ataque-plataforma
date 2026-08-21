import { expect, test } from '@playwright/test'

test('abre a criação e filtra templates do formato escolhido', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('header').getByRole('img', { name: 'Ataque' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Gerador de Criativos' })).toBeVisible()

  await page.getByRole('button', { name: 'Story Formato vertical 9:16' }).click()
  await expect(page.getByRole('heading', { name: 'Escolha o Formato' })).toBeVisible()

  await page.getByRole('button', { name: 'Avançar' }).click()
  await expect(page.getByRole('heading', { name: 'Escolha o Modelo' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Story Capa/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Story CTA \/ Link/ })).toBeVisible()
})

test('as abas principais continuam navegáveis', async ({ page }) => {
  await page.goto('/')
  // Abas são NavLinks (<a>) desde a migração para React Router
  await page.getByRole('link', { name: 'Marca', exact: true }).click()
  await expect(page.getByText('Guia de Identidade Visual')).toBeVisible()
  await page.getByRole('link', { name: 'Início', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Gerador de Criativos' })).toBeVisible()
})
