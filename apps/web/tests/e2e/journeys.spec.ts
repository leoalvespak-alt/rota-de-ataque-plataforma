import { test, expect } from '@playwright/test'

test('Login + navegao', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('navigation')).toBeVisible()
  await page.click('text=Leads')
  await expect(page).toHaveURL(/\/leads/)
  await page.click('text=Contas')
  await expect(page).toHaveURL(/\/accounts/)
  await page.click('text=Notificaes')
  await expect(page).toHaveURL(/\/notifications/)
})

  test('Lead operacional', async ({ page }) => {
    await page.goto('/leads')
    
    const grid = page.getByRole('grid')
    await expect(grid).toBeVisible()

    const firstRow = page.getByRole('row').nth(1)
    await firstRow.click()
    
    await expect(page.getByRole('heading', { level: 2, name: /^@/ })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Identidades' })).toBeVisible()
  })

  test('Content end-to-end', async ({ page }) => {
    await page.goto('/content-opportunity')
    
    const approveButton = page.getByRole('button', { name: 'Aprovar e criar conteúdo' })
    await expect(approveButton).toBeVisible()
    await approveButton.click()
    
    await expect(page.getByRole('status')).toContainText('Aprovada')
    
    await page.goto('/content-items')
    
    const contentLink = page.getByRole('link', { name: /variantes/i }).first()
    await expect(contentLink).toBeVisible()
  })