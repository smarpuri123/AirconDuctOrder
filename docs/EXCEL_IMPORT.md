# Excel duct schedule import

Design review can import finalized BOQ/schedule spreadsheets (e.g. `JEF-OVAL DUCT.xlsx`) without editing the source file.

## Access

1. Open an enquiry in **Design Review** (`in_review` or `revision_needed`).
2. Choose **Import from Excel** (or navigate to `/enquiries/:id/design/import`).

## Workflow

| Step | Purpose |
|------|---------|
| Upload | Parse workbook with SheetJS (`xlsx`); original file is never modified. |
| Structure | Review detected sheet, header row, data rows, and warnings (merged cells, duplicate headers, etc.). |
| Mapping | Auto-map columns via aliases, normalization, fuzzy match, and saved templates; drag Excel columns onto application fields. |
| Rows | Reorder rows, exclude invalid lines (in-memory only). |
| Validate | Row-level errors (missing dimensions, duplicate tag numbers, invalid quantity). |
| Preview | Normalized data (dimensions in mm, quantities) with ready / attention / excluded counts. |
| Import | Updates design extraction totals on the enquiry; saves mapping template and a local audit entry. |

## Mapping templates

Confirmed mappings are stored in the browser (`localStorage`) keyed by a header fingerprint. When a matching format is detected, the UI shows **Known Excel format detected**.

## Persistence

- Line items are stored on the enquiry (`enquiry_duct_lines`) and used when converting to a customer order.
- The uploaded workbook is stored as an enquiry document (`category: duct_schedule`) and can be downloaded from Design Review.
- Enquiry number format: `{Customer Code}-{Project Code}-{####}` (4-digit sequence per client + project), e.g. `AIRMASTER-PRJ-PROGRESS-0002`.
- Customer order number format: `{Project Name} ({Enquiry No})`, e.g. `Progress City India (AIRMASTER-PRJ-PROGRESS-0002)`.

## Current limitations

- Import audit is client-side until server import transactions exist.
- Undo/redo for row edits is not implemented yet.

## Libraries

- **xlsx** — parse `.xlsx` / `.xls` in the browser.
- Native HTML drag-and-drop for column mapping (no spreadsheet UI framework).

## Field aliases

See `src/lib/excelImport/fields.ts` for application fields and header aliases (`Tag. No`, `W(mm)`, `Gauge`, etc.).
