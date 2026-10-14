# Excel duct schedule import

Design review can import a duct schedule from Excel using a **fixed template** — no column mapping in the UI.

## Access

1. Open an enquiry in **Design Review** (`in_review` or `revision_needed`).
2. Choose **Import from Excel** (or `/enquiries/:id/design/import`).

## Workflow

1. **Download template** — `ECOVENT-duct-schedule-template.xlsx` with the exact column headers.
2. **Fill data** — one row per duct line; keep the header row unchanged.
3. **Browse and import** — select the file. If headers do not match the template, errors list missing or unrecognized columns. If row data is invalid, errors show by Excel row number; fix the file and upload again.
4. **Import** — confirms ready rows and updates design extraction totals.

## Template columns

| Column | Required |
|--------|----------|
| Tag No | Yes |
| Description | No |
| Diameter (DAI) | No |
| Width (mm) | Yes |
| Height (mm) | Yes |
| Length (mm) | Yes |
| Quantity | Yes |
| Gauge | No |
| Area (m²) | No |
| RMT | No |

Dimensions are in **millimetres**. Optional columns can be omitted from the sheet entirely.

## Persistence

- Line items are stored on the enquiry and used when converting to a customer order.
- The uploaded workbook is stored as an enquiry document (`duct_schedule`) and can be downloaded from Design Review.

## Libraries

- **xlsx** — parse and generate `.xlsx` in the browser.
