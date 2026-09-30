import { chromium } from 'playwright'
import { mkdir, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { loginPortalRole, logoutPortal, guideDateLabel } from './pdf-auth.mjs'
import { pdfGuideStyles } from './pdf-theme.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SCREENSHOTS_DIR = join(ROOT, 'docs', 'screenshots')
const OUTPUT_PDF = join(ROOT, 'docs', 'ECOVENT-Admin-Portal-Guide.pdf')
const BASE_URL = process.env.PDF_BASE_URL || 'http://localhost:5173'

async function pickFirstDetail(page, listPath, urlRe) {
  await page.goto(`${BASE_URL}${listPath}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  const row = page.locator('main [class*="cursor-pointer"], main table tbody tr').first()
  if (await row.count()) {
    await row.click()
    await page.waitForURL(urlRe, { timeout: 15000 }).catch(() => {})
    const path = new URL(page.url()).pathname
    if (urlRe.test(path)) return path
  }
  return listPath
}

async function captureScreenshots(page) {
  const shots = []

  async function shot(name, path, options = {}) {
    const file = join(SCREENSHOTS_DIR, `${name}.png`)
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    if (options.before) await options.before(page)
    await page.screenshot({ path: file, fullPage: options.fullPage ?? true })
    shots.push({
      name,
      file: `screenshots/${name}.png`,
      caption: options.caption ?? name,
      role: options.role,
    })
    console.log(`  ✓ ${name}${options.role ? ` (${options.role})` : ''}`)
  }

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, '01-login.png'),
    fullPage: false,
  })
  shots.push({
    name: '01-login',
    file: 'screenshots/01-login.png',
    caption: 'Login — per-user username and password (issued by administrator)',
  })
  console.log('  ✓ 01-login')

  await loginPortalRole(page, BASE_URL, 'admin')

  await shot('02-admin-dashboard', '/', {
    role: 'Admin',
    caption: 'Dashboard — KPIs, work queue, and workflow audit (admin / supervisor)',
    fullPage: false,
  })

  await shot('03-admin-clients', '/clients', {
    role: 'Admin / Supervisor',
    caption: 'Clients — customers, projects, and contacts master data',
  })

  await shot('04-admin-enquiries', '/enquiries', {
    role: 'Admin / Supervisor',
    caption: 'Enquiries — all stages; card, grid, or kanban views',
  })

  await shot('05-new-enquiry', '/enquiries/new', {
    role: 'Supervisor',
    caption: 'New enquiry — client & project, file upload, person in charge',
  })

  let enquiryPath =
    process.env.PDF_ENQUIRY_PATH ||
    (await pickFirstDetail(page, '/enquiries', /\/enquiries\/(?!new)[^/]+$/))
  if (enquiryPath.includes('/new')) enquiryPath = '/enquiries'

  await shot('06-enquiry-detail', enquiryPath, {
    role: 'Admin / Supervisor',
    caption: 'Enquiry detail — workflow stepper, accept & assign design, files, actions',
  })

  await shot('07-enquiry-activity', enquiryPath, {
    role: 'All roles',
    caption: 'Activity history — logged-in user name on every handoff',
    before: async (p) => {
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await p.waitForTimeout(500)
    },
  })

  await logoutPortal(page, BASE_URL)
  await loginPortalRole(page, BASE_URL, 'designer')

  await shot('08-designer-enquiries', '/enquiries', {
    role: 'Designer',
    caption: 'Designer inbox — only enquiries assigned as design in-charge',
    fullPage: false,
  })

  await logoutPortal(page, BASE_URL)
  await loginPortalRole(page, BASE_URL, 'accounts')

  await shot('09-accounts-enquiries', '/enquiries', {
    role: 'Accounts',
    caption: 'Accounts view — approval processing and PO workflow stages',
    fullPage: false,
  })

  await logoutPortal(page, BASE_URL)
  await loginPortalRole(page, BASE_URL, 'production')

  await shot('10-production-orders', '/orders', {
    role: 'Production',
    caption: 'Orders — manufacturing status and production actions',
  })

  let orderPath =
    process.env.PDF_ORDER_PATH ||
    (await pickFirstDetail(page, '/orders', /\/orders\/[^/]+$/))
  if (orderPath === '/orders') orderPath = '/orders'

  await shot('11-order-detail', orderPath, {
    role: 'Production',
    caption: 'Order detail — production approval, progress, dispatch trips',
  })

  await logoutPortal(page, BASE_URL)
  await loginPortalRole(page, BASE_URL, 'admin')

  if (!orderPath.startsWith('/orders/') || orderPath === '/orders') {
    orderPath = await pickFirstDetail(page, '/orders', /\/orders\/[^/]+$/)
  }

  await shot('12-create-dispatch', `${orderPath}/dispatch`, {
    role: 'Admin',
    caption: 'Create dispatch — + / − quantity per duct tag',
  })

  try {
    await page.goto(`${BASE_URL}${orderPath}/dispatch`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    const plusButtons = page.locator('button[aria-label="Increase quantity"]')
    const count = await plusButtons.count()
    for (let i = 0; i < Math.min(count, 3); i++) {
      await plusButtons.nth(i).click()
      await page.waitForTimeout(150)
    }
    const continueBtn = page.getByRole('button', { name: 'Continue to Vehicle Details' })
    if (await continueBtn.isEnabled().catch(() => false)) {
      await continueBtn.click()
      await page.waitForURL('**/dispatch/vehicle', { timeout: 15000 })
      await page.waitForTimeout(500)

      await page.screenshot({
        path: join(SCREENSHOTS_DIR, '13-vehicle-details.png'),
        fullPage: true,
      })
      shots.push({
        name: '13-vehicle-details',
        file: 'screenshots/13-vehicle-details.png',
        caption: 'Vehicle details — driver, transporter, and loading information',
        role: 'Admin',
      })
      console.log('  ✓ 13-vehicle-details')

      await page.getByLabel(/Vehicle Number/i).fill('AP02AB1234')
      await page.getByLabel(/Driver Name/i).fill('Ramesh')
      await page.getByLabel(/Driver Mobile/i).fill('9876543210')
      await page.getByLabel(/Transporter/i).fill('ABC Transport')
      await page.getByRole('button', { name: 'Preview Dispatch' }).click()
      await page.waitForURL('**/dispatch/preview', { timeout: 15000 })
      await page.waitForTimeout(500)

      await page.screenshot({
        path: join(SCREENSHOTS_DIR, '14-dispatch-preview.png'),
        fullPage: true,
      })
      shots.push({
        name: '14-dispatch-preview',
        file: 'screenshots/14-dispatch-preview.png',
        caption: 'Dispatch preview — review quantities before confirming trip',
        role: 'Admin',
      })
      console.log('  ✓ 14-dispatch-preview')
    } else {
      console.warn('  ⚠ Dispatch wizard skipped (no qty selected — seed demo orders?)')
    }
  } catch (err) {
    console.warn('  ⚠ Dispatch wizard screenshots skipped:', err.message)
  }

  await shot('15-dispatch-list', '/dispatch', {
    role: 'Admin',
    caption: 'Dispatch history — all vehicle trips across orders',
  })

  let dispatchPath = process.env.PDF_DISPATCH_PATH || ''
  if (!dispatchPath) {
    dispatchPath = await pickFirstDetail(page, '/dispatch', /\/dispatch\/[^/]+$/)
  }
  if (dispatchPath === '/dispatch') dispatchPath = '/dispatch'

  if (dispatchPath.startsWith('/dispatch/')) {
    await shot('16-dispatch-note', dispatchPath, {
      role: 'Admin',
      caption: 'Dispatch note — printable document with item table and signatures',
    })
  }

  await shot('17-settings', '/settings', {
    role: 'Admin',
    caption: 'Settings — application information',
  })

  return shots
}

function buildHtml(shots) {
  const today = guideDateLabel()
  const shotBlocks = shots
    .map(
      (s) => `
    <section class="screen">
      ${s.role ? `<p class="role-label">${s.role}</p>` : ''}
      <h3>${s.caption}</h3>
      <img src="${s.file}" alt="${s.caption}" />
    </section>`,
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ECOVENT Operations — User Guide</title>
  <style>
    ${pdfGuideStyles()}
  </style>
</head>
<body>

  <div class="cover">
    <h1>ECOVENT Operations</h1>
    <p class="tagline">Enquiry to Dispatch — Admin Web Portal User Guide</p>
    <p class="meta">
      ECOVENT AIR SYSTEMS INDIA LLP<br/>
      Quality Ducts Is Our Business<br/><br/>
      Version 3.0 &nbsp;|&nbsp; ${today}
    </p>
    <span class="badge">Enquiry → Design → Order → Manufacture → Dispatch</span>
  </div>

  <div class="toc">
    <h2>Table of Contents</h2>
    <ol>
      <li>Overview &amp; Access</li>
      <li>User Roles</li>
      <li>End-to-End Workflow</li>
      <li>Navigation &amp; Display Views</li>
      <li>Creating a New Enquiry</li>
      <li>Design &amp; Accounts Workflow</li>
      <li>Production &amp; Activity Log</li>
      <li>Order &amp; Dispatch</li>
      <li>Screen Guide (with screenshots)</li>
      <li>Status Reference</li>
    </ol>
  </div>

  <div class="section">
    <h2>1. Overview &amp; Access</h2>
    <p>ECOVENT Operations is a browser-based portal for managing the full duct manufacturing lifecycle — from customer enquiry through design review, accounts approval, order confirmation, production, and multi-trip dispatch.</p>
    <div class="highlight">
      <strong>Key principle: Enquiry ≠ Order ≠ Dispatch</strong><br/>
      A customer enquiry captures intent and drawings. An order is created only after design approval. Each vehicle trip is a separate dispatch. One order can have many dispatch trips until fully delivered.
    </div>
    <p>Open the URL provided by your administrator (e.g. <em>https://your-server/login</em>). Enter your <strong>username</strong> and <strong>password</strong>. Credentials are issued per user; they are not displayed on the login page. Use <strong>Sign out</strong> in the header when finished.</p>
  </div>

  <div class="section">
    <h2>2. User Roles</h2>
    <p>Each login has one or more roles. Menus and records are filtered automatically.</p>
    <table>
      <tr><th>Role</th><th>Access</th><th>Typical tasks</th></tr>
      <tr><td>Admin</td><td>Full portal</td><td>All modules, clients, users, settings</td></tr>
      <tr><td>Supervisor</td><td>Full portal</td><td>Create enquiries, assign design, oversight</td></tr>
      <tr><td>Designer</td><td>Assigned enquiries</td><td>Design review, Excel import, submit to accounts</td></tr>
      <tr><td>Accounts</td><td>Enquiries (approval)</td><td>PO workflow, approve design, return to design</td></tr>
      <tr><td>Production</td><td>Orders</td><td>Production approval and progress</td></tr>
      <tr><td>Dispatcher</td><td>Mobile app only</td><td>Field dispatch (see Mobile Dispatch guide)</td></tr>
    </table>
    <p>Activity history records the <strong>signed-in user</strong> for every action (not a separate “acting as” selector).</p>
  </div>

  <div class="section">
    <h2>3. End-to-End Workflow</h2>
    <div class="flow-step"><span class="flow-num">1</span><div><strong>New Enquiry</strong> — supervisor/admin selects client &amp; project, uploads customer files.</div></div>
    <div class="flow-step"><span class="flow-num">2</span><div><strong>Accept &amp; assign design</strong> — intake completed; design engineer assigned (designer inbox).</div></div>
    <div class="flow-step"><span class="flow-num">3</span><div><strong>Design review</strong> — duct extraction, Excel import, revisions (Rev 01, 02…); submit to accounts.</div></div>
    <div class="flow-step"><span class="flow-num">4</span><div><strong>Accounts / PO</strong> — review and approve design for manufacturing.</div></div>
    <div class="flow-step"><span class="flow-num">5</span><div><strong>Convert to order</strong> — production order linked to the enquiry.</div></div>
    <div class="flow-step"><span class="flow-num">6</span><div><strong>Production &amp; dispatch</strong> — shop floor progress; one or more vehicle trips until balance is zero.</div></div>
    <p>Every step appears in <strong>Delivery &amp; Activity History</strong> with user name, role, timestamp, and revision/trip where applicable.</p>
  </div>

  <div class="section">
    <h2>4. Navigation &amp; Display Views</h2>
    <table>
      <tr><th>Menu</th><th>Who</th><th>Purpose</th></tr>
      <tr><td>Dashboard</td><td>Admin, Supervisor</td><td>KPIs, work queue, workflow audit</td></tr>
      <tr><td>Clients</td><td>Admin, Supervisor</td><td>Customers, projects, contacts</td></tr>
      <tr><td>Enquiries</td><td>Most office roles</td><td>Pipeline by stage; designers see assigned items</td></tr>
      <tr><td>Orders</td><td>Admin, Supervisor, Production</td><td>Manufacturing and dispatch readiness</td></tr>
      <tr><td>Dispatch</td><td>Admin, Supervisor</td><td>All vehicle trips (desktop)</td></tr>
      <tr><td>Settings</td><td>Admin</td><td>Application information</td></tr>
    </table>
    <h3>Toolbar Actions (per screen)</h3>
    <table>
      <tr><th>Screen</th><th>Actions</th></tr>
      <tr><td>Dashboard</td><td>All Enquiries · New Enquiry · Create Dispatch (when ready)</td></tr>
      <tr><td>Enquiries</td><td>New Enquiry</td></tr>
      <tr><td>Orders</td><td>Create Dispatch (first dispatchable order)</td></tr>
      <tr><td>Dispatch</td><td>New Dispatch Trip</td></tr>
    </table>
    <h3>Display Views</h3>
    <p>On Enquiries, Orders, and Dispatch lists, switch between <strong>Cards</strong>, <strong>Grid</strong>, and <strong>Kanban</strong>. Your preference is saved in the browser.</p>
    <h3>Header</h3>
    <p><strong>Notifications</strong> (bell) and <strong>user menu</strong> (name + sign out) are in the top bar on every screen.</p>
  </div>

  <div class="section">
    <h2>5. Creating a New Enquiry</h2>
    <p><strong>Admin / Supervisor:</strong> click <strong>New Enquiry</strong> from the Dashboard or Enquiries screen. Select an existing <strong>client</strong> and <strong>project</strong> from the directory (or add clients under <strong>Clients</strong> first).</p>
    <h3>Customer &amp; contact</h3>
    <table>
      <tr><th>Field</th><th>Required</th><th>Description</th></tr>
      <tr><td>Client / project</td><td>Yes</td><td>From client master data</td></tr>
      <tr><td>Contact</td><td>Optional</td><td>Site contact from client record</td></tr>
    </table>
    <h3>Project Details</h3>
    <table>
      <tr><th>Field</th><th>Required</th><th>Description</th></tr>
      <tr><td>Project Name / WO No</td><td>Yes</td><td>e.g. AIRMASTER-WO-900 — becomes order reference</td></tr>
      <tr><td>Project Location</td><td>Yes</td><td>Site or city</td></tr>
      <tr><td>Enquiry Date</td><td>Yes</td><td>Date enquiry received</td></tr>
      <tr><td>Expected Completion</td><td>No</td><td>Target delivery date</td></tr>
    </table>
    <h3>Assignment</h3>
    <table>
      <tr><th>Field</th><th>Required</th><th>Description</th></tr>
      <tr><td>Sales Person</td><td>Yes</td><td>Assigned sales representative</td></tr>
      <tr><td>Priority</td><td>Yes</td><td>Low / Normal / High / Urgent</td></tr>
      <tr><td>Source</td><td>No</td><td>Existing Customer, Referral, Website, etc.</td></tr>
      <tr><td>Remarks</td><td>No</td><td>Scope notes, urgency, site constraints</td></tr>
    </table>
    <h3>Client input files</h3>
    <p>Upload customer drawings (PDF, images, Excel, etc.) on the create form or on the enquiry detail page. On submit:</p>
    <ul>
      <li>Generates a structured enquiry number (client + project sequence)</li>
      <li>Logs <em>Enquiry created</em> and file upload in activity history</li>
      <li>Opens the enquiry detail page for intake and design handoff</li>
    </ul>
    <div class="highlight">
      <strong>Important:</strong> No manufacturing order is created when the enquiry is submitted. The order is created only after design approval and explicit conversion.
    </div>
  </div>

  <div class="section">
    <h2>6. Design &amp; Accounts Workflow</h2>
    <p>The workflow stepper shows Enquiry → Design Review → Order → Manufacturing → Dispatch.</p>
    <h3>Supervisor / intake</h3>
    <p><strong>Accept &amp; assign to design</strong> completes intake and assigns the design in-charge in one step.</p>
    <h3>Designer</h3>
    <ol>
      <li>Import duct schedule (Excel) or enter extraction totals</li>
      <li>Request revision (during in-review) if scope changes</li>
      <li><strong>Submit to accounts</strong> when engineering sign-off is ready</li>
    </ol>
    <h3>Accounts</h3>
    <ol>
      <li>PO for review → PO for approval</li>
      <li><strong>Approve design</strong> or <strong>Return to design</strong> (new revision)</li>
    </ol>
    <p>Then <strong>Convert to order</strong> when design is approved.</p>
  </div>

  <div class="section">
    <h2>7. Production &amp; Activity Log</h2>
    <h3>Production steps (on enquiry or order detail)</h3>
    <ol>
      <li><strong>Approve Production Start</strong> — production manager authorises shop floor to begin (logged with name and date)</li>
      <li><strong>Log Production Update</strong> — record produced quantity (e.g. 12 / 18 qty)</li>
      <li><strong>Mark Ready for Dispatch</strong> — all items moved to ready stock</li>
    </ol>
    <h3>Activity history</h3>
    <p>The <strong>Delivery &amp; Activity History</strong> section groups all events by phase:</p>
    <table>
      <tr><th>Phase</th><th>Example events</th></tr>
      <tr><td>Enquiry</td><td>Enquiry created</td></tr>
      <tr><td>Design</td><td>Design review started, design updated, revision requested, design approved</td></tr>
      <tr><td>Order</td><td>Converted to order</td></tr>
      <tr><td>Production</td><td>Production start approved, progress updated, marked ready for dispatch</td></tr>
      <tr><td>Dispatch</td><td>Dispatch Trip 1 created, Dispatch Trip 2 created, delivery completed</td></tr>
    </table>
    <p>Each entry shows: action title, detail, <strong>actor name</strong>, <strong>role</strong>, <strong>timestamp</strong>, and revision/trip number where applicable.</p>
    <p>The <strong>Workflow Progress</strong> summary strip shows the latest update per phase at a glance.</p>
  </div>

  <div class="section">
    <h2>8. Order &amp; Dispatch</h2>
    <h3>Quantity tracking</h3>
    <table>
      <tr><th>Metric</th><th>Meaning</th></tr>
      <tr><td>Ordered</td><td>Total on confirmed order</td></tr>
      <tr><td>Produced</td><td>Fabricated quantity</td></tr>
      <tr><td>Ready Stock</td><td>Available for dispatch</td></tr>
      <tr><td>Dispatched</td><td>Already sent on previous trips</td></tr>
      <tr><td>Balance</td><td>Remaining to dispatch</td></tr>
    </table>
    <h3>Dispatch workflow</h3>
    <ol>
      <li>Select order from Dashboard, Orders, or Enquiry detail</li>
      <li>Select items — use + / − per tag or Select All Available</li>
      <li>Enter vehicle details — vehicle number, driver, transporter, date/time</li>
      <li>Preview — verify quantities, area, and remaining balance</li>
      <li>Confirm — dispatch number assigned, balances updated, activity logged as Dispatch Trip N</li>
      <li>Share — WhatsApp, email, or PDF dispatch note</li>
    </ol>
    <p><strong>Rules:</strong> Cannot dispatch more than available per tag. Order becomes Fully Dispatched when balance reaches zero.</p>
  </div>

  <div class="screens-section">
    <h2>9. Screen Guide</h2>
    <p>Screenshots from the current teal-themed portal. Role badges show separate logins (admin, designer, accounts, production) — each user sees only permitted menus and data.</p>
    ${shotBlocks}
  </div>

  <div class="section">
    <h2>10. Status Reference</h2>
    <h3>Order Status Badges</h3>
    <table>
      <tr><th>Status</th><th>Colour</th><th>Meaning</th></tr>
      <tr><td>Production</td><td><span class="badge-orange">Orange</span></td><td>Manufacturing in progress</td></tr>
      <tr><td>Ready</td><td><span class="badge-blue">Blue</span></td><td>Stock ready — awaiting first dispatch</td></tr>
      <tr><td>Partially Dispatched</td><td><span class="badge-orange">Orange</span></td><td>Some qty sent, balance remains</td></tr>
      <tr><td>Fully Dispatched</td><td><span class="badge-green">Green</span></td><td>All qty dispatched — complete</td></tr>
    </table>
    <h3>Enquiry Stages</h3>
    <table>
      <tr><th>Stage</th><th>Meaning</th></tr>
      <tr><td>Enquiry</td><td>New — awaiting design review</td></tr>
      <tr><td>Design Review</td><td>Engineering extraction in progress or revision</td></tr>
      <tr><td>Order</td><td>Converted — production not yet started</td></tr>
      <tr><td>Manufacturing</td><td>Production in progress</td></tr>
      <tr><td>Dispatch</td><td>Ready or partially dispatched</td></tr>
      <tr><td>Completed</td><td>Fully dispatched</td></tr>
    </table>
  </div>

  <p class="footer-note">
    ECOVENT AIR SYSTEMS INDIA LLP — Quality Ducts Is Our Business<br/>
    Document generated ${today}. For access or training, contact your system administrator.
  </p>

</body>
</html>`
}

async function main() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true })
  await mkdir(join(ROOT, 'docs'), { recursive: true })

  console.log('Capturing screenshots from', BASE_URL)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()

  let shots
  try {
    shots = await captureScreenshots(page)
  } catch (err) {
    console.error('Screenshot capture failed:', err.message)
    console.error('Ensure API + web are running: npm run dev:all (and db:seed:demo for sample orders)')
    await browser.close()
    process.exit(1)
  }

  const html = buildHtml(shots)
  const htmlPath = join(ROOT, 'docs', 'portal-guide.html')
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
