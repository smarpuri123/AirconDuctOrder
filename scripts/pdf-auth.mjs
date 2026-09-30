/** Shared login helpers for PDF screenshot capture (demo or API mode). */

const PORTAL_USERS = {
  admin: { user: 'admin', pass: 'admin@123' },
  supervisor: { user: 'supervisor', pass: 'supervisor@123' },
  designer: { user: 'designer', pass: 'designer@123' },
  accounts: { user: 'accounts', pass: 'accounts@123' },
  production: { user: 'production', pass: 'production@123' },
  dispatch: { user: 'dispatch', pass: 'dispatch@123' },
}

export async function loginPortalAs(page, baseUrl, username, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  const demoBtn = page.getByRole('button', { name: 'Enter Demo' })
  if (await demoBtn.isVisible().catch(() => false)) {
    await demoBtn.click()
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 })
    await page.waitForTimeout(600)
    return 'demo'
  }

  await page.getByLabel(/^Username/i).fill(username)
  await page.locator('input[type="password"]').first().fill(password)
  await page.getByRole('button', { name: /Sign In/i }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 45000 })
  await page.waitForTimeout(900)
  return 'api'
}

export async function loginPortal(page, baseUrl) {
  const u = process.env.PDF_LOGIN_USER || 'admin'
  const p = process.env.PDF_LOGIN_PASSWORD || PORTAL_USERS.admin.pass
  return loginPortalAs(page, baseUrl, u, p)
}

export async function loginPortalRole(page, baseUrl, role) {
  const creds = PORTAL_USERS[role]
  if (!creds) throw new Error(`Unknown PDF role: ${role}`)
  return loginPortalAs(page, baseUrl, creds.user, creds.pass)
}

export async function logoutPortal(page, baseUrl) {
  const demo = page.getByRole('button', { name: 'Enter Demo' })
  if (await demo.isVisible().catch(() => false)) {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
    return
  }

  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(400)
  const menuBtn = page.locator('header button[aria-haspopup="menu"]')
  if (await menuBtn.count()) {
    await menuBtn.click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await page.waitForURL((url) => url.pathname.endsWith('/login'), { timeout: 15000 })
    await page.waitForTimeout(400)
    return
  }
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.removeItem('ecovent_auth_token')
  })
}

export async function loginMobile(page, baseUrl) {
  const role = process.env.PDF_MOBILE_ROLE || 'dispatch'
  const creds = PORTAL_USERS[role] || PORTAL_USERS.dispatch
  await loginMobileAs(page, baseUrl, creds.user, creds.pass)
}

export async function loginMobileAs(page, baseUrl, username, password) {
  await page.goto(`${baseUrl}/m/login`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  const demoBtn = page.getByRole('button', { name: 'Enter Dispatch Demo' })
  if (await demoBtn.isVisible().catch(() => false)) {
    await demoBtn.click()
    await page.waitForURL('**/m/orders', { timeout: 15000 })
    await page.waitForTimeout(600)
    return
  }

  await page.locator('input[autocomplete="username"], input[type="text"]').first().fill(username)
  await page.locator('input[type="password"]').first().fill(password)
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
