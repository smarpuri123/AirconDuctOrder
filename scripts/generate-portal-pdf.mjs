import { chromium } from 'playwright'
import { mkdir, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { loginPortal, guideDateLabel } from './pdf-auth.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SCREENSHOTS_DIR = join(ROOT, 'docs', 'screenshots')
const OUTPUT_PDF = join(ROOT, 'docs', 'ECOVENT-Admin-Portal-Guide.pdf')
const BASE_URL = process.env.PDF_BASE_URL || 'http://localhost:5173'

async function captureScreenshots(page) {
  const shots = []

  async function shot(name, path, options = {}) {
    const file = join(SCREENSHOTS_DIR, `${name}.png`)
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    if (options.before) await options.before(page)
    await page.screenshot({ path: file, fullPage: options.fullPage ?? true })
    shots.push({ name, file: `screenshots/${name}.png`, caption: options.caption ?? name })
    console.log(`  ✓ ${name}`)
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
    caption: 'Login — sign in with username and password provided by your administrator',
  })
  console.log('  ✓ 01-login')

  await loginPortal(page, BASE_URL)

  await shot('02-dashboard', '/', {
    caption: 'Dashboard — KPIs, workflow progress, and quick actions (New Enquiry, Create Dispatch)',
  })

  await shot('03-enquiries', '/enquiries', {
    caption: 'Enquiries list — Card / Grid / Kanban views with stage filters',
  })

  await shot('04-new-enquiry', '/enquiries/new', {
    caption: 'New Enquiry form — customer, project, assignment, and drawing upload',
  })

  let enquiryPath = process.env.PDF_ENQUIRY_PATH || ''
  if (!enquiryPath) {
    await page.goto(`${BASE_URL}/enquiries`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    const row = page.locator('main table tbody tr, main [class*="grid"] > div').first()
    if (await row.count()) {
      await row.click()
      await page.waitForURL(/\/enquiries\/[^/]+$/, { timeout: 10000 }).catch(() => {})
      enquiryPath = new URL(page.url()).pathname
    }
  }
  if (!enquiryPath || enquiryPath.includes('/new')) enquiryPath = '/enquiries'

  await shot('05-enquiry-detail', enquiryPath, {
    caption: 'Enquiry detail — workflow stepper, design actions, files, and activity history',
  })

  await shot('06-enquiry-activity', enquiryPath, {
    caption: 'Delivery & Activity History — phased audit trail with actor and revision numbers',
    before: async (p) => {
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await p.waitForTimeout(400)
    },
  })

  await shot('07-orders', '/orders', {
    caption: 'Orders list — status badges (Ready = blue, Fully Dispatched = green)',
  })

  let orderPath = process.env.PDF_ORDER_PATH || ''
  if (!orderPath) {
    await page.goto(`${BASE_URL}/orders`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    const row = page.locator('main table tbody tr, main [class*="grid"] > div').first()
    if (await row.count()) {
      await row.click()
      await page.waitForURL(/\/orders\/[^/]+$/, { timeout: 10000 }).catch(() => {})
      orderPath = new URL(page.url()).pathname
    }
  }
  if (!orderPath) orderPath = '/orders'

  await shot('08-order-detail', orderPath, {
    caption: 'Order detail — manufacturing progress, production approval, and dispatch trips',
  })

  await shot('09-create-dispatch', `${orderPath}/dispatch`, {
    caption: 'Create dispatch — select items with + / − quantity controls per tag',
  })

  await page.goto(`${BASE_URL}${orderPath}/dispatch`)
  await page.waitForTimeout(400)
  const plusButtons = page.locator('button[aria-label="Increase quantity"]')
  const count = await plusButtons.count()
  if (count > 0) await plusButtons.first().click()
  if (count > 2) await plusButtons.nth(2).click()
  await page.getByRole('button', { name: 'Continue to Vehicle Details' }).click()
  await page.waitForURL('**/dispatch/vehicle')
  await page.waitForTimeout(500)

  await page.screenshot({
    path: join(SCREENSHOTS_DIR, '10-vehicle-details.png'),
    fullPage: true,
  })
  shots.push({
    name: '10-vehicle-details',
    file: 'screenshots/10-vehicle-details.png',
    caption: 'Vehicle details — driver, transporter, and loading information',
  })
  console.log('  ✓ 10-vehicle-details')

  await page.getByLabel(/Vehicle Number/i).fill('AP02AB1234')
  await page.getByLabel(/Driver Name/i).fill('Ramesh')
  await page.getByLabel(/Driver Mobile/i).fill('9876543210')
  await page.getByLabel(/Transporter/i).fill('ABC Transport')
  await page.getByRole('button', { name: 'Preview Dispatch' }).click()
  await page.waitForURL('**/dispatch/preview')
  await page.waitForTimeout(500)

  await page.screenshot({
    path: join(SCREENSHOTS_DIR, '11-dispatch-preview.png'),
    fullPage: true,
  })
  shots.push({
    name: '11-dispatch-preview',
    file: 'screenshots/11-dispatch-preview.png',
    caption: 'Dispatch preview — review quantities before confirming trip',
  })
  console.log('  ✓ 11-dispatch-preview')

  await shot('12-dispatch-list', '/dispatch', {
    caption: 'Dispatch history — all vehicle trips across orders',
  })

  let dispatchPath = process.env.PDF_DISPATCH_PATH || ''
  if (!dispatchPath) {
    await page.goto(`${BASE_URL}/dispatch`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    const row = page.locator('main table tbody tr, main [class*="grid"] > div').first()
    if (await row.count()) {
      await row.click()
      await page.waitForURL(/\/dispatch\/[^/]+$/, { timeout: 10000 }).catch(() => {})
      dispatchPath = new URL(page.url()).pathname
    }
  }
  if (!dispatchPath) dispatchPath = '/dispatch'

  await shot('13-dispatch-note', dispatchPath, {
    caption: 'Dispatch note — printable document with item table and signatures',
  })

  await shot('14-settings', '/settings', {
    caption: 'Settings — demo reset and application information',
  })

  return shots
}

function buildHtml(shots) {
  const today = guideDateLabel()
  const shotBlocks = shots
    .map(
      (s) => `
    <section class="screen">
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
    @page { margin: 20mm 15mm; size: A4; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Inter, Arial, sans-serif;
      color: #1a1a2e;
      line-height: 1.55;
      font-size: 11pt;
      margin: 0;
      padding: 0;
    }
    .cover {
      page-break-after: always;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      background: linear-gradient(180deg, #003087 0%, #00246b 100%);
      color: white;
      padding: 40px;
    }
    .cover h1 { font-size: 32pt; margin: 0 0 8px; letter-spacing: -0.02em; }
    .cover .tagline { font-size: 14pt; opacity: 0.9; margin-bottom: 40px; }
    .cover .meta { font-size: 11pt; opacity: 0.75; line-height: 1.8; }
    .cover .badge {
      display: inline-block;
      background: #f5ba2e;
      color: #1a1a2e;
      padding: 8px 20px;
      border-radius: 20px;
      font-weight: 600;
      margin-top: 32px;
      font-size: 10pt;
    }
    h2 {
      color: #003087;
      font-size: 18pt;
      border-bottom: 2px solid #003087;
      padding-bottom: 6px;
      margin-top: 28px;
      page-break-after: avoid;
    }
    h3 { color: #003087; font-size: 12pt; margin-top: 20px; page-break-after: avoid; }
    h4 { color: #687173; font-size: 11pt; margin-top: 16px; }
    p { margin: 8px 0; }
    ul, ol { margin: 8px 0; padding-left: 22px; }
    li { margin: 4px 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 9.5pt;
    }
    th {
      background: #003087;
      color: white;
      text-align: left;
      padding: 8px 10px;
    }
    td {
      border-bottom: 1px solid #cbd2d6;
      padding: 8px 10px;
      vertical-align: top;
    }
    .highlight {
      background: #f5f7fa;
      border-left: 4px solid #003087;
      padding: 12px 16px;
      margin: 16px 0;
      border-radius: 0 8px 8px 0;
    }
    .badge-blue {
      display: inline-block;
      background: rgba(0,48,135,0.1);
      color: #003087;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 9pt;
      font-weight: 600;
    }
    .badge-green {
      display: inline-block;
      background: #e6f4ea;
      color: #019c34;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 9pt;
      font-weight: 600;
    }
    .badge-orange {
      display: inline-block;
      background: #fff8e1;
      color: #c49000;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 9pt;
      font-weight: 600;
    }
    .screen {
      page-break-inside: avoid;
      margin: 24px 0 32px;
    }
    .screen img {
      width: 100%;
      border: 1px solid #cbd2d6;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,48,135,0.1);
      margin-top: 8px;
    }
    .screen h3 {
      font-size: 11pt;
      color: #687173;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .toc { page-break-after: always; }
    .toc li { margin: 6px 0; }
    .footer-note {
      font-size: 9pt;
      color: #687173;
      text-align: center;
      margin-top: 40px;
      border-top: 1px solid #cbd2d6;
      padding-top: 12px;
    }
    .section { page-break-before: auto; }
    .screens-section { page-break-before: always; }
    .flow-step {
      display: flex;
      gap: 12px;
      margin: 8px 0;
      align-items: flex-start;
    }
    .flow-num {
      background: #003087;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9pt;
      font-weight: 700;
      flex-shrink: 0;
    }
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
    <p>Screenshots captured from the live application at generation time.</p>
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
    console.error('Ensure the dev server is running: npm run dev')
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
