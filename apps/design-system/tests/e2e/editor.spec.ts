import { expect, test } from '@playwright/test'

test('abre o editor e filtra templates sem interromper a criação', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('header').getByRole('img', { name: 'Ataque' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Biblioteca de modelos' })).toBeVisible()

  await page.getByRole('button', { name: 'Abrir biblioteca de modelos em tela cheia' }).click()
  await expect(page.locator('aside').first().getByRole('group', { name: 'Formato' })).toBeVisible()
  await expect(page.locator('aside').first().getByRole('group', { name: 'Segmento' })).toBeVisible()

  await page.getByRole('radio', { name: 'Story', exact: true }).click()
  await expect(page.getByText('6 modelos encontrados')).toBeVisible()
  await expect(page.getByRole('button', { name: /Story Capa Story/ })).toBeVisible()
})

test('as abas existentes continuam navegáveis', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Marca', exact: true }).click()
  await expect(page.getByText('Guia de Identidade Visual')).toBeVisible()
  await page.getByRole('button', { name: 'Criar Arte', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Biblioteca de modelos' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole('combobox', { name: 'Filtrar por formato' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Segmentos', exact: true })).toBeVisible()
})
