import { chromium } from 'playwright'
import { mkdir, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { loginMobile, guideDateLabel } from './pdf-auth.mjs'
import { pdfGuideStyles, pdfMobileExtraStyles } from './pdf-theme.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SCREENSHOTS_DIR = join(ROOT, 'docs', 'mobile-screenshots')
const OUTPUT_PDF = join(ROOT, 'docs', 'ECOVENT-Mobile-Dispatch-Guide.pdf')
const BASE_URL = process.env.PDF_BASE_URL || 'http://localhost:5173'
const MOBILE_VIEWPORT = { width: 390, height: 844 }

async function resolveOrderId(page) {
  if (process.env.PDF_ORDER_ID) return process.env.PDF_ORDER_ID
  await page.goto(`${BASE_URL}/m/orders`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const first = page.locator('ul li button').first()
  if (await first.count() === 0) return 'ord-001'
  await first.click()
  await page.waitForURL(/\/m\/orders\/[^/]+$/)
  return page.url().split('/').pop()
}

async function resolveDispatchId(page) {
  if (process.env.PDF_DISPATCH_ID) return process.env.PDF_DISPATCH_ID
  await page.goto(`${BASE_URL}/m/dispatches`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const first = page.locator('ul li button').first()
  if (await first.count() === 0) return 'disp-001'
  await first.click()
  await page.waitForURL(/\/m\/dispatches\/[^/]+$/)
  const id = page.url().split('/').pop()
  return id === 'confirm' ? 'disp-001' : id
}

async function captureScreenshots(page) {
  const shots = []

  async function shot(name, path, options = {}) {
    const file = join(SCREENSHOTS_DIR, `${name}.png`)
    if (path) {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(600)
    }
    if (options.before) await options.before(page)
    await page.screenshot({ path: file, fullPage: options.fullPage ?? true })
    shots.push({ name, file: `mobile-screenshots/${name}.png`, caption: options.caption ?? name })
    console.log(`  ✓ ${name}`)
  }

  await page.goto(`${BASE_URL}/m/login`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, '01-login.png'),
    fullPage: false,
  })
  shots.push({
    name: '01-login',
    file: 'mobile-screenshots/01-login.png',
    caption: 'Login — username and password from your administrator',
  })
  console.log('  ✓ 01-login')

  await loginMobile(page, BASE_URL)

  const orderId = await resolveOrderId(page)
  const dispatchId = await resolveDispatchId(page)
  console.log(`  Using order ${orderId}, dispatch ${dispatchId}`)

  await shot('02-orders', '/m/orders', {
    caption: 'Orders — list of orders with balance ready to dispatch',
    fullPage: false,
  })

  await shot('03-order-detail', `/m/orders/${orderId}`, {
    caption: 'Order detail — totals, balance, and New Dispatch Trip button',
    fullPage: false,
  })

  await page.goto(`${BASE_URL}/m/orders/${orderId}/dispatch`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const plusButtons = page.locator('button[aria-label="Increase quantity"]')
  const count = await plusButtons.count()
  if (count > 0) await plusButtons.first().click()
  if (count > 2) await plusButtons.nth(2).click()
  await page.waitForTimeout(300)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  // Viewport-only capture — shows header, sample tags, and sticky Continue bar on one page
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, '04-select-tags.png'),
    fullPage: false,
  })
  shots.push({
    name: '04-select-tags',
    file: 'mobile-screenshots/04-select-tags.png',
    caption: 'Select tags — large 56px + / − buttons with sticky Continue bar',
    compact: true,
  })
  console.log('  ✓ 04-select-tags')

  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL(`**/m/orders/${orderId}/vehicle`)
  await page.waitForTimeout(500)

  await page.getByPlaceholder('AP02AB1234').fill('KA01AB1234')
  await page.locator('label:has-text("Driver Name") input').fill('Ramesh Kumar')
  await page.locator('label:has-text("Driver Mobile") input').fill('9876543210')
  await page.locator('label:has-text("Transporter") input').fill('ABC Transport')
  await page.waitForTimeout(300)

  await page.screenshot({
    path: join(SCREENSHOTS_DIR, '05-vehicle.png'),
    fullPage: false,
  })
  shots.push({
    name: '05-vehicle',
    file: 'mobile-screenshots/05-vehicle.png',
    caption: 'Vehicle details — driver, transporter, loading date and time',
  })
  console.log('  ✓ 05-vehicle')

  await page.getByRole('button', { name: 'Preview Dispatch' }).click()
  await page.waitForURL(`**/m/orders/${orderId}/preview`)
  await page.waitForTimeout(500)
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, '06-preview.png'),
    fullPage: false,
  })
  shots.push({
    name: '06-preview',
    file: 'mobile-screenshots/06-preview.png',
    caption: 'Confirm dispatch — review trip quantity and remaining balance',
  })
  console.log('  ✓ 06-preview')

  await shot('07-dispatch-list', '/m/dispatches', {
    caption: 'Dispatches — all vehicle trips with status and quantities',
    fullPage: false,
  })

  await shot('08-dispatch-detail', `/m/dispatches/${dispatchId}`, {
    caption: 'Dispatch detail — trip info, items, status update, and share actions',
    fullPage: false,
  })

  await shot('09-share-section', `/m/dispatches/${dispatchId}`, {
    caption: 'Share — WhatsApp message, email, and downloadable PDF dispatch note',
    fullPage: false,
    before: async (p) => {
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await p.waitForTimeout(400)
    },
  })

  await shot('10-bottom-nav', '/m/orders', {
    caption: 'Bottom navigation — Orders and Dispatches tabs for one-thumb access',
    fullPage: false,
  })

  return shots
}

function buildHtml(shots) {
  const shotBlocks = shots
    .map(
      (s) => `
    <section class="screen">
      <h3>${s.caption}</h3>
      <div class="phone-frame${s.compact ? ' compact' : ''}">
        <img src="${s.file}" alt="${s.caption}" />
      </div>
    </section>`,
    )
    .join('\n')

  const today = guideDateLabel()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ECOVENT Mobile Dispatch — User Guide</title>
  <style>
    ${pdfGuideStyles()}
    ${pdfMobileExtraStyles()}
  </style>
</head>
<body>

  <div class="cover">
    <h1>ECOVENT Dispatch</h1>
    <p class="tagline">Mobile App — Warehouse &amp; Field Dispatch User Guide</p>
    <p class="meta">
      ECOVENT AIR SYSTEMS INDIA LLP<br/>
      Quality Ducts Is Our Business<br/><br/>
      Version 2.0 &nbsp;|&nbsp; ${today}
    </p>
    <span class="badge">Orders → Select Tags → Vehicle → Confirm → Share</span>
  </div>

  <div class="toc">
    <h2>Table of Contents</h2>
    <ol>
      <li>Overview</li>
      <li>Install on Mobile (APK)</li>
      <li>Login &amp; User Access</li>
      <li>Navigation</li>
      <li>Create a Dispatch Trip</li>
      <li>Update Dispatch Status</li>
      <li>Share Dispatch Note</li>
      <li>Mobile UI Design</li>
      <li>Screen Guide (with screenshots)</li>
      <li>Status Reference</li>
    </ol>
  </div>

  <div class="section">
    <h2>1. Overview</h2>
    <p>ECOVENT Mobile Dispatch is a <strong>mobile app</strong> built for warehouse staff and dispatch coordinators working on phones or tablets. It focuses on the core task: loading the right duct tags onto the right vehicle and sharing the dispatch note — without the full admin portal.</p>
    <div class="highlight">
      <strong>Same data as the web portal</strong><br/>
      Orders, balances, and dispatch trips are shared with the admin portal. Each user signs in with their own account. All authorised users can create dispatches and update trip status.
    </div>
    <table>
      <tr><th>Capability</th><th>Mobile App</th><th>Admin Web Portal</th></tr>
      <tr><td>Create dispatch trips</td><td>Yes</td><td>Yes</td></tr>
      <tr><td>Update dispatch status</td><td>Yes</td><td>View only</td></tr>
      <tr><td>Share WhatsApp / Email / PDF</td><td>Yes</td><td>Yes</td></tr>
      <tr><td>Create enquiries &amp; design</td><td>—</td><td>Yes</td></tr>
      <tr><td>Production tracking</td><td>—</td><td>Yes</td></tr>
    </table>
    <p>Use the <strong>mobile web app</strong> at <em>/m/login</em> on your server URL, or the <strong>ECOVENT Dispatch APK</strong> if your administrator provides one. Both use the same login and data as the admin portal.</p>
  </div>

  <div class="section">
    <h2>2. Install on Mobile</h2>
    <h3>Option A — Browser (recommended for HTTP / IP servers)</h3>
    <ol>
      <li>Open Chrome on the phone</li>
      <li>Go to <strong>your-server/m/login</strong> (URL from administrator)</li>
      <li>Sign in — optional: Add to Home screen for a shortcut icon</li>
    </ol>
    <h3>Option B — Android APK</h3>
    <p>If provided, install the APK as below. It loads the same dispatch UI from your server.</p>
    <h3>Android</h3>
    <ol>
      <li>Transfer the <strong>ECOVENT Dispatch APK</strong> file to the phone (email, WhatsApp, or USB)</li>
      <li>Open the APK file and tap <strong>Install</strong></li>
      <li>If prompted, allow installation from unknown sources for your file manager</li>
      <li>Launch <strong>ECOVENT Dispatch</strong> from the home screen</li>
    </ol>
    <h3>First launch</h3>
    <ol>
      <li>Open the app — the login screen appears</li>
      <li>Sign in with the <strong>username</strong> and <strong>password</strong> provided by your administrator</li>
      <li>You are taken directly to the Orders screen</li>
    </ol>
    <div class="highlight">
      <strong>Tip:</strong> Each dispatch operator should have their own login so actions are recorded against the correct user.
    </div>
  </div>

  <div class="section">
    <h2>3. Login &amp; User Access</h2>
    <p>Dispatch users sign in with a <strong>dispatcher</strong> account (username + password). The signed-in name appears in the header. Credentials are not shown on the login screen — request them from your administrator.</p>
    <p>Dispatcher accounts can list orders with balance, create trips, update trip status, and share dispatch notes. Admin and supervisor accounts use the desktop portal for enquiries and production.</p>
    <p>Tap the <strong>logout</strong> icon in the header to sign out.</p>
  </div>

  <div class="section">
    <h2>4. Navigation</h2>
    <table>
      <tr><th>Tab / Screen</th><th>Purpose</th></tr>
      <tr><td>Orders</td><td>Orders with balance remaining — search by order no. or customer</td></tr>
      <tr><td>Dispatches</td><td>All vehicle trips — tap to view detail and share</td></tr>
      <tr><td>Order detail</td><td>Qty summary, previous trips, <strong>New Dispatch Trip</strong></td></tr>
    </table>
    <p>During the dispatch wizard (select tags → vehicle → preview → confirm), the bottom navigation is hidden so the user stays focused on the current step.</p>
  </div>

  <div class="section">
    <h2>5. Create a Dispatch Trip</h2>
    <div class="flow-step"><span class="flow-num">1</span><div><strong>Orders</strong> — pick an order with balance &gt; 0</div></div>
    <div class="flow-step"><span class="flow-num">2</span><div><strong>Select Tags</strong> — use large + / − buttons per duct tag; tap <em>All</em> to select full available stock; sticky bar shows selected qty</div></div>
    <div class="flow-step"><span class="flow-num">3</span><div><strong>Vehicle Details</strong> — vehicle number, driver, mobile, transporter, loading date/time</div></div>
    <div class="flow-step"><span class="flow-num">4</span><div><strong>Confirm</strong> — review trip qty and remaining balance; tap Confirm Dispatch</div></div>
    <div class="flow-step"><span class="flow-num">5</span><div><strong>Success</strong> — dispatch number assigned; share or view dispatch note</div></div>
    <div class="highlight">
      <strong>Rules:</strong> Cannot dispatch more than available per tag. Tags are sorted numerically (Tag 1, 2, 3… not 1, 10, 11). Order balance updates after each trip.
    </div>
  </div>

  <div class="section">
    <h2>6. Update Dispatch Status</h2>
    <p>On the dispatch detail screen, tap status buttons to progress the trip through the loading yard workflow:</p>
    <table>
      <tr><th>Status</th><th>When to use</th></tr>
      <tr><td>Loading</td><td>Vehicle at bay, loading started</td></tr>
      <tr><td>Loaded</td><td>All items on vehicle, paperwork done</td></tr>
      <tr><td>Dispatched</td><td>Vehicle left the factory</td></tr>
      <tr><td>Delivered</td><td>Goods received at site</td></tr>
    </table>
    <p>The current status is highlighted. Updates are saved immediately and visible to all users.</p>
  </div>

  <div class="section">
    <h2>7. Share Dispatch Note</h2>
    <p>After creating a dispatch or from the dispatch detail screen, use the share panel:</p>
    <table>
      <tr><th>Action</th><th>Result</th></tr>
      <tr><td>WhatsApp</td><td>Opens WhatsApp with a pre-filled message: dispatch no., order, vehicle, driver, item summary</td></tr>
      <tr><td>Email</td><td>Opens email client with subject and body</td></tr>
      <tr><td>Download PDF</td><td>Generates a printable dispatch note PDF (same format as web portal)</td></tr>
    </table>
    <p>Ideal for sending loading instructions to the driver or confirmation to the customer site contact.</p>
  </div>

  <div class="section">
    <h2>8. Mobile UI Design</h2>
    <p>The interface is optimised for gloved hands, bright warehouses, and one-handed phone use:</p>
    <ul>
      <li><strong>56px touch targets</strong> on + and − quantity buttons</li>
      <li><strong>Sticky action bars</strong> — Continue and Confirm always visible at the bottom</li>
      <li><strong>Large typography</strong> — tag numbers and quantities at 2xl–3xl size</li>
      <li><strong>Safe area support</strong> — respects notches and home indicators on modern phones</li>
      <li><strong>Minimal chrome</strong> — bottom nav only on list screens; wizard steps are distraction-free</li>
    </ul>
  </div>

  <div class="screens-section">
    <h2>9. Screen Guide</h2>
    <p>Screenshots from the ECOVENT Dispatch mobile app.</p>
    ${shotBlocks}
  </div>

  <div class="section">
    <h2>10. Status Reference</h2>
    <h3>Dispatch Trip Status</h3>
    <table>
      <tr><th>Status</th><th>Colour</th><th>Meaning</th></tr>
      <tr><td>Loading</td><td><span class="badge-orange">Orange</span></td><td>Vehicle being loaded</td></tr>
      <tr><td>Loaded</td><td><span class="badge-blue">Blue</span></td><td>Loading complete</td></tr>
      <tr><td>Dispatched</td><td><span class="badge-blue">Blue</span></td><td>In transit</td></tr>
      <tr><td>Delivered</td><td><span class="badge-green">Green</span></td><td>Received at site</td></tr>
    </table>
    <h3>Order Balance (on Orders list)</h3>
    <table>
      <tr><th>Field</th><th>Meaning</th></tr>
      <tr><td>Balance</td><td>Quantity still to dispatch (orange)</td></tr>
      <tr><td>Dispatched</td><td>Already sent on previous trips (green)</td></tr>
      <tr><td>Total</td><td>Full order quantity</td></tr>
    </table>
    <h3>Relationship to Admin Portal</h3>
    <p>Dispatches created on mobile appear instantly in the web portal under <strong>Dispatch</strong>. Production and enquiry workflows remain on the admin portal only.</p>
  </div>

  <p class="footer-note">
    ECOVENT AIR SYSTEMS INDIA LLP — Quality Ducts Is Our Business<br/>
    ECOVENT Dispatch — User Guide · Generated ${today}
  </p>

</body>
</html>`
}

async function main() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true })
  await mkdir(join(ROOT, 'docs'), { recursive: true })

  console.log('Capturing mobile screenshots from', BASE_URL)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()

  let shots
  try {
    shots = await captureScreenshots(page)
  } catch (err) {
    console.error('Screenshot capture failed:', err.message)
    console.error('Ensure the dev server is running: npm run dev:all')
    await browser.close()
    process.exit(1)
  }

  const html = buildHtml(shots)
  const htmlPath = join(ROOT, 'docs', 'mobile-dispatch-guide.html')
  await writeFile(htmlPath, html, 'utf-8')
  console.log('HTML written:', htmlPath)

  const pdfPage = await context.newPage()
  await pdfPage.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' })
  await pdfPage.waitForTimeout(1000)

  await pdfPage.pdf({
    path: OUTPUT_PDF,
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' },
  })

  console.log('PDF generated:', OUTPUT_PDF)
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
