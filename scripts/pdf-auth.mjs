/** Shared login helpers for PDF screenshot capture. */

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

  await page.getByLabel(/^Username/i).fill(username)
  await page.locator('input[type="password"]').first().fill(password)
  await page.getByRole('button', { name: /Sign In/i }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 45000 })
  await page.waitForTimeout(900)
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
}
