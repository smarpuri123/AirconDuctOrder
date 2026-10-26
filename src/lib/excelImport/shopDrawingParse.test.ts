import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { applyShopDrawingLayout, buildShopDrawingMappings, detectShopDrawingLayout } from './shopDrawingParse'

const SAMPLE_PATH =
  'c:/Users/Sharath/Downloads/SAGAR HOSPITAL 4TH FLOOR  SHOP DRAWING R1 .bak (1).xlsx'

describe('shopDrawingParse', () => {
  it('detects SAGAR hospital layout when file is present', () => {
    let rawRows: string[][] = []
    try {
      const wb = XLSX.readFile(SAMPLE_PATH)
      rawRows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], {
        header: 1,
        defval: '',
      }) as string[][]
    } catch {
      return
    }

    const layout = detectShopDrawingLayout(rawRows.map((r) => r.map(String)))
    expect(layout).not.toBeNull()
    expect(layout?.dataStartRow).toBe(6)

    const sheet = applyShopDrawingLayout({
      name: 'Sheet1',
      rowCount: rawRows.length,
      colCount: 20,
      headerRowIndex: 0,
      headers: [],
      rawRows: rawRows.map((r) => r.map(String)),
      dataRowIndices: [],
      issues: [],
    })
    expect(sheet.dataRowIndices.length).toBeGreaterThan(50)

    const mappings = buildShopDrawingMappings(sheet)
    expect(mappings.find((m) => m.fieldKey === 'tagNo')).toBeTruthy()
    expect(mappings.find((m) => m.fieldKey === 'w1')).toBeTruthy()
    expect(mappings.find((m) => m.fieldKey === 'quantity')).toBeTruthy()
  })
})
