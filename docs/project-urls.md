# ECOVENT project URLs

Reference for every app route, API path, and bundled doc in this repo.

**Placeholders**

| Symbol | Typical value |
|--------|----------------|
| `{app}` | Web app origin — dev: `http://localhost:5173` · prod: your deployed host |
| `{api}` | REST API — dev: `http://localhost:3001/api` (or `VITE_API_URL`) · prod: `{app}/api` when proxied |
| `{gh}` | GitHub Pages base — `https://<user>.github.io/AirconDuctOrder` when `GITHUB_PAGES=true` |
| `:id` | Resource UUID or slug from the app |

Paths below are **relative to `{app}`** unless marked `(API)`.

---

## Auth & fallbacks

| Path | Notes |
|------|--------|
| `/login` | Desktop portal login |
| `/m/login` | Mobile dispatch login |
| `*` (unknown) | Redirects to `/login` |

---

## Desktop portal (protected)

| Path | Screen |
|------|--------|
| `/` | Dashboard |
| `/clients` | Clients |
| `/enquiries` | Enquiries list |
| `/enquiries/new` | Create enquiry |
| `/enquiries/:id` | Enquiry detail |
| `/enquiries/:id/design/import` | Duct schedule Excel import |
| `/operations/flow` | Operations pipeline |
| `/orders` | Orders list |
| `/orders/:id` | Order detail |
| `/orders/:id/dispatch` | Create dispatch — select tags |
| `/orders/:id/dispatch/vehicle` | Vehicle details |
| `/orders/:id/dispatch/preview` | Dispatch preview |
| `/dispatch` | Dispatch list |
| `/dispatch/:id` | Dispatch detail |
| `/dispatch/:id/confirm` | Confirm dispatch |
| `/settings` | Settings |
| `/sys/debug` | Admin debug logs |

**Sidebar nav** (`src/lib/portalAccess.ts`): `/`, `/clients`, `/enquiries`, `/operations/flow`, `/orders`, `/dispatch`, `/settings`.

---

## Mobile dispatch PWA (protected, prefix `/m`)

| Path | Screen |
|------|--------|
| `/m` | Redirect → `/m/orders` |
| `/m/orders` | Orders list |
| `/m/orders/:id` | Order detail |
| `/m/orders/:id/dispatch` | Select tags for dispatch |
| `/m/orders/:id/vehicle` | Vehicle |
| `/m/orders/:id/preview` | Preview dispatch |
| `/m/dispatches` | Dispatches list |
| `/m/dispatches/:id` | Dispatch detail |
| `/m/dispatches/:id/confirm` | Confirm dispatch |

PWA manifest `start_url`: `/m` (`vite.config.ts`).

---

## REST API (prefix `{api}` = `/api` on server)

### Health

| Method | Path |
|--------|------|
| GET | `/api/health` |

### Auth

| Method | Path |
|--------|------|
| POST | `/api/auth/login` |
| GET | `/api/auth/me` |

### Customers

| Method | Path |
|--------|------|
| GET | `/api/customers` |
| GET | `/api/customers/:id` |
| POST | `/api/customers` |
| PATCH | `/api/customers/:id` |
| POST | `/api/customers/:id/contacts` |
| PATCH | `/api/customers/:customerId/contacts/:contactId` |

### Projects

| Method | Path |
|--------|------|
| GET | `/api/projects` |
| GET | `/api/projects/:id` |
| POST | `/api/projects` |
| PATCH | `/api/projects/:id` |
| POST | `/api/projects/:id/contacts` |
| DELETE | `/api/projects/:projectId/contacts/:projectContactId` |

### Masters

| Method | Path |
|--------|------|
| GET | `/api/masters` |
| POST | `/api/masters` |
| PATCH | `/api/masters/:id` |
| POST | `/api/masters/seed-defaults` |

### Organization

| Method | Path |
|--------|------|
| GET | `/api/org/departments` |
| POST | `/api/org/departments` |
| GET | `/api/org/job-roles` |
| POST | `/api/org/job-roles` |
| GET | `/api/org/employees` |
| GET | `/api/org/employees/for-stage/:stageCode` |
| POST | `/api/org/employees` |
| PATCH | `/api/org/employees/:id/roles` |
| GET | `/api/org/workflow-stage-roles` |

### Enquiries

| Method | Path |
|--------|------|
| GET | `/api/enquiries` |
| GET | `/api/enquiries/:id` |
| POST | `/api/enquiries` |
| POST | `/api/enquiries/:id/documents` |
| GET | `/api/enquiries/:enquiryId/documents/:documentId/download` |
| POST | `/api/enquiries/:id/intake/complete` |
| POST | `/api/enquiries/:id/design/start` |
| POST | `/api/enquiries/:id/design/begin-work` |
| PATCH | `/api/enquiries/:id/design/extraction` |
| POST | `/api/enquiries/:id/design/duct-import` |
| POST | `/api/enquiries/:id/design/submit-to-accounts` |
| POST | `/api/enquiries/:id/design/po-for-review` |
| POST | `/api/enquiries/:id/design/po-for-approval` |
| POST | `/api/enquiries/:id/design/approve` |
| POST | `/api/enquiries/:id/design/request-revision` |
| POST | `/api/enquiries/:id/design/resume-revision` |
| POST | `/api/enquiries/:id/design/return-to-design` |
| POST | `/api/enquiries/:id/design/revert-step` |
| POST | `/api/enquiries/:id/convert-to-order` |

### Customer orders (manufacturing)

| Method | Path |
|--------|------|
| GET | `/api/orders` |
| GET | `/api/orders/:id` |
| POST | `/api/orders/:id/approve-production` |
| POST | `/api/orders/:id/production-track` |
| POST | `/api/orders/:id/production-process` |
| POST | `/api/orders/:id/mark-ready` |
| POST | `/api/orders/:id/revert-step` |

### Dispatches

| Method | Path |
|--------|------|
| GET | `/api/dispatches` |
| GET | `/api/dispatches/:id` |
| POST | `/api/dispatches` |
| PATCH | `/api/dispatches/:id` |

### Notifications

| Method | Path |
|--------|------|
| GET | `/api/notifications/vapid-public-key` |
| GET | `/api/notifications` |
| GET | `/api/notifications/unread-count` |
| PATCH | `/api/notifications/:id/read` |
| PATCH | `/api/notifications/read-all` |
| GET | `/api/notifications/preferences` |
| PATCH | `/api/notifications/preferences` |
| POST | `/api/notifications/push/subscribe` |
| DELETE | `/api/notifications/push/subscribe` |
| POST | `/api/notifications/test` |

### Portal users

| Method | Path |
|--------|------|
| GET | `/api/users/assignable` |
| GET | `/api/users` |
| POST | `/api/users` |
| PATCH | `/api/users/:id` |
| POST | `/api/users/:id/reset-password` |

### Debug

| Method | Path |
|--------|------|
| GET | `/api/debug/logs` |
| POST | `/api/debug/logs/clear` |
| GET | `/api/debug/client-logs` |
| POST | `/api/debug/client-logs` |
| POST | `/api/debug/client-logs/clear` |
| GET | `/api/debug/info` |

---

## Static assets (app)

| Path | File |
|------|------|
| `/favicon.svg` | `public/favicon.svg` |

---

## Documentation (repo files, open locally or via static host)

| File | Description |
|------|-------------|
| `docs/portal-guide.html` | Admin portal guide (HTML) |
| `docs/mobile-dispatch-guide.html` | Mobile dispatch guide (HTML) |
| `docs/ECOVENT-Admin-Portal-Guide.pdf` | Admin portal PDF |
| `docs/ECOVENT-Mobile-Dispatch-Guide.pdf` | Mobile dispatch PDF |
| `docs/CLIENT_USER_GUIDE.md` | Client user guide |
| `docs/EXCEL_IMPORT.md` | Excel import notes |
| `docs/DEPLOYMENT_VPS.md` | VPS deployment |
| `docs/DOCKER_VPS.md` | Docker on VPS |
| `docs/INSTALL_VPS.md` | VPS install |
| `docs/GITHUB_ACTIONS_VPS.md` | GitHub Actions deploy |
| `docs/PRODUCTION_DOCKER_DEPLOY.md` | Production Docker |
| `MOBILE_DISPATCH.md` | Mobile dispatch overview |
| `FEATURES.md` | Feature list |

---

## Plain list (copy-paste)

```
/login
/m/login
/
/clients
/enquiries
/enquiries/new
/enquiries/:id
/enquiries/:id/design/import
/operations/flow
/orders
/orders/:id
/orders/:id/dispatch
/orders/:id/dispatch/vehicle
/orders/:id/dispatch/preview
/dispatch
/dispatch/:id
/dispatch/:id/confirm
/settings
/sys/debug
/m
/m/orders
/m/orders/:id
/m/orders/:id/dispatch
/m/orders/:id/vehicle
/m/orders/:id/preview
/m/dispatches
/m/dispatches/:id
/m/dispatches/:id/confirm
/api/health
/api/auth/login
/api/auth/me
/api/customers
/api/customers/:id
/api/customers/:id/contacts
/api/customers/:customerId/contacts/:contactId
/api/projects
/api/projects/:id
/api/projects/:id/contacts
/api/projects/:projectId/contacts/:projectContactId
/api/masters
/api/masters/:id
/api/masters/seed-defaults
/api/org/departments
/api/org/job-roles
/api/org/employees
/api/org/employees/for-stage/:stageCode
/api/org/employees/:id/roles
/api/org/workflow-stage-roles
/api/enquiries
/api/enquiries/:id
/api/enquiries/:id/documents
/api/enquiries/:enquiryId/documents/:documentId/download
/api/enquiries/:id/intake/complete
/api/enquiries/:id/design/start
/api/enquiries/:id/design/begin-work
/api/enquiries/:id/design/extraction
/api/enquiries/:id/design/duct-import
/api/enquiries/:id/design/submit-to-accounts
/api/enquiries/:id/design/po-for-review
/api/enquiries/:id/design/po-for-approval
/api/enquiries/:id/design/approve
/api/enquiries/:id/design/request-revision
/api/enquiries/:id/design/resume-revision
/api/enquiries/:id/design/return-to-design
/api/enquiries/:id/design/revert-step
/api/enquiries/:id/convert-to-order
/api/orders
/api/orders/:id
/api/orders/:id/approve-production
/api/orders/:id/production-track
/api/orders/:id/production-process
/api/orders/:id/mark-ready
/api/orders/:id/revert-step
/api/dispatches
/api/dispatches/:id
/api/notifications/vapid-public-key
/api/notifications
/api/notifications/unread-count
/api/notifications/:id/read
/api/notifications/read-all
/api/notifications/preferences
/api/notifications/push/subscribe
/api/notifications/test
/api/users/assignable
/api/users
/api/users/:id
/api/users/:id/reset-password
/api/debug/logs
/api/debug/logs/clear
/api/debug/client-logs
/api/debug/client-logs/clear
/api/debug/info
/favicon.svg
```

*Source of truth for routes: `src/App.tsx`, `server/src/app.ts`, `server/src/routes/*.ts`. Regenerate this file when routes change.*
