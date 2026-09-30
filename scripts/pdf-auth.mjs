/** Shared login helpers for PDF screenshot capture (demo or API mode). */

export async function loginPortal(page, baseUrl) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  const demoBtn = page.getByRole('button', { name: 'Enter Demo' })
  if (await demoBtn.isVisible().catch(() => false)) {
    await demoBtn.click()
    await page.waitForURL('**/', { timeout: 15000 })
    await page.waitForTimeout(500)
    return
  }

  const user = process.env.PDF_LOGIN_USER || 'admin'
  const pass = process.env.PDF_LOGIN_PASSWORD || 'admin@123'
  await page.getByLabel(/^Username/i).fill(user)
  await page.locator('input[type="password"]').first().fill(pass)
  await page.getByRole('button', { name: /Sign In/i }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 45000 })
  await page.waitForTimeout(800)
}

export async function loginMobile(page, baseUrl) {
  await page.goto(`${baseUrl}/m/login`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  const demoBtn = page.getByRole('button', { name: 'Enter Dispatch Demo' })
  if (await demoBtn.isVisible().catch(() => false)) {
    await demoBtn.click()
    await page.waitForURL('**/m/orders', { timeout: 15000 })
    await page.waitForTimeout(600)
    return
  }

  const user = process.env.PDF_LOGIN_USER || 'dispatch'
  const pass = process.env.PDF_LOGIN_PASSWORD || 'dispatch@123'
  await page.locator('input[autocomplete="username"], input[type="text"]').first().fill(user)
  await page.locator('input[type="password"]').first().fill(pass)
  await page.getByRole('button', { name: /Sign In/i }).click()
  await page.waitForURL('**/m/orders', { timeout: 45000 })
  await page.waitForTimeout(800)
}

export function guideDateLabel() {
  return new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
