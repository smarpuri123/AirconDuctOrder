# ECOVENT Operations — Client user guide (summary)

This document summarises the **production** portal (September 2026). Share the PDF versions with your team:

| Document | Generate command | Output |
|----------|------------------|--------|
| Admin web portal | `npm run docs:pdf` | `docs/ECOVENT-Admin-Portal-Guide.pdf` |
| Mobile dispatch | `npm run docs:mobile-pdf` | `docs/ECOVENT-Mobile-Dispatch-Guide.pdf` |
| Both | `npm run docs:all` | Both PDFs |

### Generating PDFs (internal)

1. Start the app against data you want in screenshots:
   - **Local:** `npm run dev:all` (demo) or API + `PDF_BASE_URL=http://localhost:5173`
   - **Production screenshots:** `PDF_BASE_URL=http://YOUR_SERVER PDF_LOGIN_USER=admin PDF_LOGIN_PASSWORD=... npm run docs:all`
2. Run the command above from the project root.

---

## 1. Access

- **Admin / office:** open your server URL (e.g. `http://your-server/login`) in a desktop browser.
- **Dispatch (mobile):** `http://your-server/m/login` or the ECOVENT Dispatch APK (if provided).
- **Sign-in:** username and password are issued by your administrator. Credentials are **not** shown on the login screen.

---

## 2. Roles (who sees what)

| Role | Portal | Typical tasks |
|------|--------|----------------|
| **Admin** | Full desktop | Users, clients, all enquiries, orders, dispatch, settings |
| **Supervisor** | Full desktop | Same as admin for operations; oversight and assignment |
| **Designer** | Desktop — assigned enquiries | Design review, duct schedule / Excel import, submit to accounts |
| **Accounts** | Desktop — enquiries | PO workflow, approve design, return to design |
| **Production** | Desktop — orders | Production approval, progress, ready for dispatch |
| **Dispatcher** | Mobile (`/m`) only | Create trips, update trip status, share dispatch note |

After login, each user only sees menus and records allowed for their role.

---

## 3. Workflow (enquiry → dispatch)

1. **Enquiry** — supervisor/admin creates enquiry, selects client & project, uploads customer drawings.
2. **Accept & assign** — intake completed; design engineer assigned (designer sees enquiry in their list).
3. **Design review** — extraction, Excel import, revisions; submit to accounts when ready.
4. **Accounts** — PO review / approval; design approved for manufacturing.
5. **Order** — convert enquiry to production order.
6. **Manufacturing** — production steps on the order.
7. **Dispatch** — one or more vehicle trips until balance is zero.

Every action is stored in **Delivery & Activity History** with the **logged-in user**, role, and timestamp.

---

## 4. Key screens

- **Dashboard** — KPIs and work queue (admin/supervisor).
- **Clients** — customer and project master data (admin/supervisor).
- **Enquiries** — list with card/grid/kanban; filters by stage.
- **Orders** — manufacturing and dispatch readiness.
- **Dispatch** — all trips; printable dispatch notes.

---

## 5. Mobile dispatch (summary)

1. Sign in → **Orders** with balance to dispatch.
2. **New Dispatch Trip** → select tags (+ / − quantities).
3. **Vehicle** details → **Preview** → **Confirm**.
4. Update trip status on the trip detail screen; share via WhatsApp / email / PDF.

---

## 6. Support

For access issues or new users, contact your ECOVENT system administrator. Passwords should be changed after first login in production.

*ECOVENT AIR SYSTEMS INDIA LLP — Quality Ducts Is Our Business*
