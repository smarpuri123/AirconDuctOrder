import { chromium } from 'playwright'
import { mkdir, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

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

  await shot('01-login', '/login', {
    caption: 'Login — click Enter Demo to access ECOVENT Operations',
    fullPage: false,
  })

  await page.goto(`${BASE_URL}/login`)
  await page.getByRole('button', { name: 'Enter Demo' }).click()
  await page.waitForURL('**/')
  await page.waitForTimeout(500)

  await shot('02-dashboard', '/', {
    caption: 'Dashboard — KPIs, workflow progress, and quick actions (New Enquiry, Create Dispatch)',
  })

  await shot('03-enquiries', '/enquiries', {
    caption: 'Enquiries list — Card / Grid / Kanban views with stage filters',
  })

  await shot('04-new-enquiry', '/enquiries/new', {
    caption: 'New Enquiry form — customer, project, assignment, and drawing upload',
  })

  await shot('05-enquiry-detail', '/enquiries/enq-001', {
    caption: 'Enquiry detail — workflow stepper, design review, production, and activity history',
  })

  await shot('06-enquiry-activity', '/enquiries/enq-001', {
    caption: 'Delivery & Activity History — phased audit trail with actor and revision numbers',
    before: async (p) => {
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await p.waitForTimeout(400)
    },
  })

  await shot('07-orders', '/orders', {
    caption: 'Orders list — status badges (Ready = blue, Fully Dispatched = green)',
  })

  await shot('08-order-detail', '/orders/ord-001', {
    caption: 'Order detail — manufacturing progress, production approval, and dispatch trips',
  })

  await shot('09-create-dispatch', '/orders/ord-001/dispatch', {
    caption: 'Create dispatch — select items with + / − quantity controls per tag',
  })

  await page.goto(`${BASE_URL}/orders/ord-001/dispatch`)
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

  await shot('13-dispatch-note', '/dispatch/disp-001', {
    caption: 'Dispatch note — printable document with item table and signatures',
  })

  await shot('14-settings', '/settings', {
    caption: 'Settings — demo reset and application information',
  })

  return shots
}

function buildHtml(shots) {
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
      Version 2.0 Demo &nbsp;|&nbsp; 19 September 2026
    </p>
    <span class="badge">Enquiry → Design → Order → Manufacture → Dispatch</span>
  </div>

  <div class="toc">
    <h2>Table of Contents</h2>
    <ol>
      <li>Overview</li>
      <li>End-to-End Workflow</li>
      <li>Navigation &amp; Display Views</li>
      <li>Creating a New Enquiry</li>
      <li>Design Review &amp; Revision Phases</li>
      <li>Production Tracking &amp; Activity Log</li>
      <li>Order &amp; Dispatch</li>
      <li>Screen Guide (with screenshots)</li>
      <li>Sample Enquiry Activity Log</li>
      <li>Status Reference</li>
    </ol>
  </div>

  <div class="section">
    <h2>1. Overview</h2>
    <p>ECOVENT Operations is a browser-based portal for managing the full duct manufacturing lifecycle — from customer enquiry through design review, order confirmation, production, and multi-trip dispatch.</p>
    <div class="highlight">
      <strong>Key principle: Enquiry ≠ Order ≠ Dispatch</strong><br/>
      A customer enquiry captures intent and drawings. An order is created only after design approval. Each vehicle trip is a separate dispatch. One order can have many dispatch trips until fully delivered.
    </div>
    <table>
      <tr><th>Role</th><th>Primary Use</th></tr>
      <tr><td>Sales</td><td>Create enquiries, upload drawings, track customer projects</td></tr>
      <tr><td>Design Engineer</td><td>Extract duct schedule, manage revision phases, approve design</td></tr>
      <tr><td>Production Manager</td><td>Approve production start, log progress, mark ready for dispatch</td></tr>
      <tr><td>Dispatch Coordinator</td><td>Create dispatch trips, vehicle details, share dispatch notes</td></tr>
    </table>
    <p>To access the portal, open the login screen and click <strong>Enter Demo</strong>. Use the <strong>Acting as</strong> selector in the header to record who performs each action.</p>
  </div>

  <div class="section">
    <h2>2. End-to-End Workflow</h2>
    <div class="flow-step"><span class="flow-num">1</span><div><strong>New Enquiry</strong> — capture customer, project, and drawing details. No order is created at this stage.</div></div>
    <div class="flow-step"><span class="flow-num">2</span><div><strong>Design Review</strong> — engineer extracts duct tags, quantity, and area. Multiple revision phases supported (Rev 01, Rev 02…).</div></div>
    <div class="flow-step"><span class="flow-num">3</span><div><strong>Approve Design</strong> — design must be saved and approved before order conversion.</div></div>
    <div class="flow-step"><span class="flow-num">4</span><div><strong>Convert to Order</strong> — creates a production order linked to the enquiry.</div></div>
    <div class="flow-step"><span class="flow-num">5</span><div><strong>Production</strong> — production manager approves start, logs progress updates, marks ready for dispatch.</div></div>
    <div class="flow-step"><span class="flow-num">6</span><div><strong>Dispatch Trips</strong> — create one or more vehicle dispatches until balance reaches zero.</div></div>
    <p>Every step is recorded in the <strong>Delivery &amp; Activity History</strong> with the person name, role, timestamp, and phase.</p>
  </div>

  <div class="section">
    <h2>3. Navigation &amp; Display Views</h2>
    <table>
      <tr><th>Menu</th><th>Purpose</th></tr>
      <tr><td>Dashboard</td><td>KPIs, featured enquiry workflow, recent enquiries and dispatches</td></tr>
      <tr><td>Enquiries</td><td>All customer enquiries with stage filters and view modes</td></tr>
      <tr><td>Orders</td><td>Manufacturing orders ready for or in dispatch</td></tr>
      <tr><td>Dispatch</td><td>All vehicle trips across orders</td></tr>
      <tr><td>Settings</td><td>Demo reset and application information</td></tr>
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
    <h3>Acting as</h3>
    <p>The header dropdown lets you select the current user: Karthik S (Sales), Priya N (Design Engineer), Ravi M (Production Manager), or Suresh K (Dispatch Coordinator). All logged actions use this identity.</p>
  </div>

  <div class="section">
    <h2>4. Creating a New Enquiry</h2>
    <p>Click <strong>New Enquiry</strong> from the Dashboard or Enquiries screen. This opens the enquiry form at <em>/enquiries/new</em> — not an existing record.</p>
    <h3>Customer Details</h3>
    <table>
      <tr><th>Field</th><th>Required</th><th>Description</th></tr>
      <tr><td>Customer Name</td><td>Yes</td><td>Company or client name</td></tr>
      <tr><td>Contact Person</td><td>Yes</td><td>Primary site contact</td></tr>
      <tr><td>Phone</td><td>Yes</td><td>Contact number</td></tr>
      <tr><td>Email</td><td>No</td><td>Contact email</td></tr>
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
    <h3>Drawing Attachment</h3>
    <p>Upload customer drawing (PDF, DWG, DXF, Excel, or image). In demo mode the filename is stored. On submit, the system:</p>
    <ul>
      <li>Generates a unique enquiry number (e.g. ENQ-2026-0006)</li>
      <li>Logs <em>Enquiry created</em> and <em>Drawing uploaded</em> in activity history</li>
      <li>Navigates to the enquiry detail page for design review</li>
    </ul>
    <div class="highlight">
      <strong>Important:</strong> No manufacturing order is created when the enquiry is submitted. The order is created only after design approval and explicit conversion.
    </div>
  </div>

  <div class="section">
    <h2>5. Design Review &amp; Revision Phases</h2>
    <p>On the enquiry detail page, the workflow stepper shows progress through Enquiry → Design Review → Order → Manufacturing → Dispatch.</p>
    <h3>Design workflow</h3>
    <ol>
      <li><strong>Start Design Review</strong> — begins Rev 01 extraction phase</li>
      <li><strong>Save Duct Extraction</strong> — enter duct tags, total quantity, total area (m²), and notes</li>
      <li><strong>Approve Design</strong> — locks extraction; logs approver name and date</li>
      <li><strong>Request Revision</strong> (optional) — sales or engineer requests changes with a reason; status becomes Revision Needed</li>
      <li><strong>Start Next Revision Phase</strong> — increments to Rev 02, Rev 03, etc.</li>
      <li><strong>Convert to Order</strong> — available only when design is approved</li>
    </ol>
    <p>Each design action is logged with the revision number (e.g. <em>Design updated — Rev 02</em>) and the acting user's name.</p>
  </div>

  <div class="section">
    <h2>6. Production Tracking &amp; Activity Log</h2>
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
    <h2>7. Order &amp; Dispatch</h2>
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
    <h2>8. Screen Guide</h2>
    <p>Screenshots captured from the live demo application.</p>
    ${shotBlocks}
  </div>

  <div class="section">
    <h2>9. Sample Enquiry Activity Log</h2>
    <p>Full audit trail for demo enquiry <strong>ENQ-2026-0001</strong> (AIRMASTER-WO-845 / NEW KC) showing design revisions, production approval, and dispatch trip:</p>
    <table>
      <tr><th>Phase</th><th>Action</th><th>Detail</th><th>Actor</th><th>Rev/Trip</th></tr>
      <tr><td>Enquiry</td><td>Enquiry created</td><td>ENQ-2026-0001 — AIRMASTER-WO-845</td><td>Karthik S (Sales)</td><td>—</td></tr>
      <tr><td>Design</td><td>Design review started</td><td>Rev 01</td><td>Priya N (Design Engineer)</td><td>1</td></tr>
      <tr><td>Design</td><td>Revision requested</td><td>Client changed AHU room layout</td><td>Karthik S (Sales)</td><td>1</td></tr>
      <tr><td>Design</td><td>Design revision started</td><td>Rev 02</td><td>Priya N (Design Engineer)</td><td>2</td></tr>
      <tr><td>Design</td><td>Design approved</td><td>Ready for order conversion</td><td>Priya N (Design Engineer)</td><td>2</td></tr>
      <tr><td>Order</td><td>Converted to order</td><td>AIRMASTER-WO-845</td><td>Karthik S (Sales)</td><td>—</td></tr>
      <tr><td>Production</td><td>Production start approved</td><td>Shop floor authorised</td><td>Ravi M (Production Manager)</td><td>—</td></tr>
      <tr><td>Production</td><td>Production progress updated</td><td>12 / 18 qty produced</td><td>Ravi M (Production Manager)</td><td>—</td></tr>
      <tr><td>Production</td><td>Marked ready for dispatch</td><td>18 qty ready in stock</td><td>Ravi M (Production Manager)</td><td>—</td></tr>
      <tr><td>Dispatch</td><td>Dispatch Trip 1 created</td><td>D-2026-0100 · 7 qty · KA-01-AB-1234</td><td>Suresh K (Dispatch Coordinator)</td><td>1</td></tr>
    </table>
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
    <h3>Demo Order: AIRMASTER-WO-845</h3>
    <table>
      <tr><th>Field</th><th>Value</th></tr>
      <tr><td>Enquiry</td><td>ENQ-2026-0001</td></tr>
      <tr><td>Customer</td><td>NEW KC</td></tr>
      <tr><td>Design Revision</td><td>Rev 02 (approved by Priya N)</td></tr>
      <tr><td>Total Qty</td><td>18 ducts · 12 tags</td></tr>
      <tr><td>Total Area</td><td>55.01 m²</td></tr>
      <tr><td>Dispatched</td><td>7 qty (Dispatch Trip 1)</td></tr>
      <tr><td>Balance</td><td>11 qty</td></tr>
    </table>
  </div>

  <p class="footer-note">
    ECOVENT AIR SYSTEMS INDIA LLP — Quality Ducts Is Our Business<br/>
    Generated automatically from the live demo application.
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
