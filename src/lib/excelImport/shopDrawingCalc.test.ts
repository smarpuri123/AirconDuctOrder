import { describe, expect, it } from 'vitest'
import {
  deriveShopDrawingRow,
  shopDrawingAreaSqFt,
  shopDrawingCleat,
  shopDrawingCorner,
  shopDrawingNBolt,
  summarizeDuctScheduleLines,
} from './shopDrawingCalc'
import { applyShopDrawingLayout, buildShopDrawingMappings } from './shopDrawingParse'
import { buildImportRows, normalizeRow } from './transform'

describe('shopDrawingAreaSqFt & hardware formulas', () => {
  it('matches SAGAR hospital row 7 formula', () => {
    const area = shopDrawingAreaSqFt(1150, 200, 1150, 200, 1125, 3)
    expect(area).toBeCloseTo(9.115811679578751, 8)
  })

  it('puts 1150mm face in 22G bucket (750–1500mm)', () => {
    const d = deriveShopDrawingRow(1150, 200, 1150, 200, 1125, 3)
    expect(d.sft22g).toBeCloseTo(d.areaSqFt, 6)
    expect(d.sft24g).toBe(0)
    expect(d.sft20g).toBe(0)
  })

  it('puts 450mm face in 24G bucket', () => {
    const d = deriveShopDrawingRow(450, 200, 450, 200, 1125, 3)
    expect(d.sft24g).toBeCloseTo(d.areaSqFt, 6)
  })

  it('computes CORNER = QTY*8, N/BOLT = CORNER/2, CLEAT = ((W1+H1+W2+H2)*350/100000)', () => {
    expect(shopDrawingCorner(4)).toBe(32)
    expect(shopDrawingNBolt(32)).toBe(16)
    expect(shopDrawingCleat(600, 350, 600, 350)).toBeCloseTo(6.65, 6)
    expect(shopDrawingCleat(500, 350, 300, 300)).toBeCloseTo(5.075, 6)
    expect(shopDrawingCleat(350, 0, 0, 0)).toBeCloseTo(1.225, 6)
  })

  it('matches IQ SKYLINE shop drawing totals (CORNNER 1032, N/BOLT 516, CLEAT 253, 24G TDF 113.65)', () => {
    const csv = `,,,,,,,,,,,,,,,,,
JOB NAME,,IQ SKYLINE,,,,,,PRODUCTION DATE,,,,,,,,,
PARTY,,,,,,,,INVOICE DATE,,,,,,,,,
AREA SUMMARY,,,,,,,,INVOICE DATE,,,,,,,,,
DUCT NO,DESCRIPTION,,,,,,,AREA     Sq.m,24G,22G,20G,,,,,,
,,W1,H1,W2,H2,L,QTY,,UPTO 750mm,750 - 1500mm,ABOVE 1500mm,,,,,,
,,,,,,,,,,,,,,,,,
1,OFLINE,600,350,600,350,400,1
2,Y-STR,600,350,600,350,100,1
2,Y-STR,500,350,500,350,450,1
2,Y-ELBOW,600,350,600,350,806.94999999999993,1
3,STR,500,350,500,350,1150,4
4,TAPER,500,350,300,300,400,1
5,Y-STR,500,350,500,350,90,1
5,Y-STR,300,300,300,300,655,1
5,Y-ELBOW,300,300,300,300,571.3,1
6,STR,300,300,300,300,1150,2
7,TAPER,300,300,250,250,845,1
8,STR,250,250,250,250,1150,2
9,ENDCAP,350,,,,350,1
10,OFLINE,300,300,300,300,600,1
11,STR,300,300,300,300,1150,4
12,ELBOW,300,300,300,300,806.94999999999993,1
13,STR,300,300,300,300,1150,2
14,TAPER,300,300,250,250,1045,1
15,STR,250,250,250,250,1150,2
16,ENDCAP,350,,,,350,1
17,Y-STR,450,300,450,300,55,1
17,Y-STR,450,300,450,300,875,1
17,Y-ELBOW,450,300,450,300,571.3,1
18,STR,450,300,450,300,1150,1
19,Y-STR,450,300,450,300,100,1
19,Y-STR,300,250,300,250,420,1
19,Y-ELBOW,300,300,300,300,571.3,1
20,OFLINE,300,300,300,300,655,1
21,STR,300,300,300,300,1150,3
22,ENDCAP,400,,,,400,1
23,STR,300,250,300,250,1150,4
24,ELBOW,300,250,300,250,571.3,1
25,STR,500,300,500,300,1150,2
26,Y-STR,500,300,500,300,480,1
26,Y-STR,300,300,300,300,1335,1
26,Y-ELBOW,300,300,300,300,571.3,1
27,OFLINE,300,300,300,300,425,1
28,STR,300,300,300,300,1150,3
29,ENDCAP,400,,,,400,1
30,STR,300,300,300,300,1150,3
31,OFLINE,300,300,300,300,445,1
32,STR,300,300,300,300,1150,1
33,ELBOW,300,300,300,250,571.3,1
34,OFLINE,300,250,300,250,625,1
35,STR,300,250,300,250,1150,3
36,ENDCAP,400,,,,350,1
37,COLLAR,500,150,500,150,240,20
38,OFLINE,300,300,300,300,1000,1
39,STR,300,300,300,300,1150,11
40,Y-STR,300,300,300,300,400,1
40,Y-STR,200,150,200,150,570,1
40,Y-ELBOW,250,200,250,200,532.025,1
41,OFLINE,250,200,250,200,400,1
42,STR,250,200,250,200,1150,1
43,TAPER,250,200,200,200,250,1
44,OFLINE,200,200,200,200,1005,1
45,STR,200,200,200,200,1150,2
46,ELBOW,200,200,200,200,492.75,1
47,OFLINE,200,200,200,200,670,1
48,ENDCAP,300,,,,300,1
49,COLLAR,250,200,250,200,250,1
50,OFLINE,250,200,250,200,575,1
51,ENDCAP,350,,,,300,1
52,STR,200,150,200,150,1150,9
53,OVAL ,200,150,200,150,1260,5
TOTAL,,,,,,,129,113.6464090584883`

    const rawRows = csv.split('\n').map((line) => line.split(','))
    const sheet = applyShopDrawingLayout({
      name: 'Sheet1',
      rowCount: rawRows.length,
      colCount: 18,
      headerRowIndex: 0,
      headers: [],
      rawRows,
      dataRowIndices: [],
      issues: [],
    })
    const mappings = buildShopDrawingMappings(sheet)
    const drafts = buildImportRows(sheet, mappings, sheet.dataRowIndices)
    const normalized = drafts.map((d) => normalizeRow(d)!).filter(Boolean)

    // Verify both direct NormalizedDuctRow and DB-roundtripped EnquiryDuctLine produce identical summary
    const dbRoundtripped = normalized.map((n) => ({
      tagNo: n.tagNo,
      description: n.description,
      width: n.width,
      height: n.height,
      length: n.length,
      quantity: n.quantity,
      area: n.area,
      gauge: n.gauge,
      dai: n.dai,
      rmt: n.rmt,
    }))

    const summary = summarizeDuctScheduleLines(dbRoundtripped)
    expect(summary.totalQty).toBe(129)
    expect(summary.corner).toBe(1032)
    expect(summary.nBolt).toBe(516)
    expect(summary.cleat).toBe(253)
    expect(summary.rows).toEqual([
      { label: 'CORNNER', qty: '1032', rawQty: 1032, units: 'NOS' },
      { label: 'N/BOLT', qty: '516', rawQty: 516, units: 'NOS' },
      { label: 'CLEAT', qty: '253', rawQty: 253, units: 'NOS' },
      { label: 'GASKET', qty: '', rawQty: 0, units: 'ROLLS' },
      { label: '24G TDF', qty: '113.65', rawQty: summary.tdf24g, units: 'SQ.MTR' },
      { label: '22G TDF', qty: '', rawQty: 0, units: 'SQ.MTR' },
      { label: '20G TDF', qty: '', rawQty: 0, units: 'SQ.MTR' },
    ])
  })

  it('matches R1-ELEVATION-CONVENCTION CENTRE sheet (TAPER row 1 as 22G, no 20G, CLEAT = 279, no error on unnamed TOTAL row)', () => {
    const csv = `,,,,,,,,,,,,,,,,,
JOB NAME,,R1-ELEVATION-CONVENCTION CENTRE,,,,,,PRODUCTION DATE,,,,,,,,,
PARTY,,,,,,,,INVOICE DATE,,,,,,,,,
AREA SUMMARY,,,,,,,,INVOICE DATE,,,,,,,,,
DUCT NO,DESCRIPTION,,,,,,,AREA     Sq.m,24G,22G,20G,,,,,,
,,W1,H1,W2,H2,L,QTY,,UPTO 750mm,750 - 1500mm,ABOVE 1500mm,,,,,,
,,,,,,,,,,,,,,,,,
1,TAPER,1950,680,1200,450,785,1,3.3610210239833953,,3.3610210239833953,,,,8,4,1.4385169982648931,14.98
2,STR,1200,450,1200,450,1125,9,33.424642825122085,,33.424642825122085,,,,72,36,11.030132132290287,11.55
3,OFLINE,1200,450,1200,450,900,2,5.9421587244661485,,5.9421587244661485,,,,16,8,1.960912379073829,11.55
4,TAPER,1200,450,650,450,795,1,2.1870445305326793,,2.1870445305326793,,,,8,4,0.60143724589648679,9.625
5,STR,650,450,650,450,1125,9,22.283095216748058,22.283095216748058,,,,,72,36,4.9022809476845735,7.7
6,OFLINE,650,450,650,450,1040,1,2.2888315102365903,2.2888315102365903,,,,,8,4,0.50354293225204992,7.7
7,ENDCAP,750,,,,550,1,0.41264991142126034,0.41264991142126034,,,,,8,4,0.030948743356594526,2.625
,,,,,,,279,69.899443742510217,24.984576638405909,44.914867104104308,,,,2232,1116,558,279
R1-ELEVATION-CONVENCTION CENTRE,,,,,,,,,,,,,,,,,
,,,QTY,UNITS,,,,,,,,,,,,,
CORNNER,,,2232,NOS,,,,,,,,,,,,,
N/BOLT,,,1116,NOS,,,,,,,,,,,,,
CLEAT,,,279,NOS,,,,,,,,,,,,,
GASKET,,,,ROLLS,,,,,,,,,,,,,
24G TDF,,,198.68918171334894,SQ.MTR,,,,,,,,,,,,,
22G TDF,,,259.57887730650509,SQ.MTR,,,,,,,,,,,,,
20G TDF,,,0,SQ.MTR,,,,,,,,,,,,,`

    const rawRows = csv.split('\n').map((line) => line.split(','))
    const sheet = applyShopDrawingLayout({
      name: 'Sheet2',
      rowCount: rawRows.length,
      colCount: 18,
      headerRowIndex: 0,
      headers: [],
      rawRows,
      dataRowIndices: [],
      issues: [],
    })
    const mappings = buildShopDrawingMappings(sheet)
    const drafts = buildImportRows(sheet, mappings, sheet.dataRowIndices)

    // Unnamed TOTAL row must not be included as a data row
    expect(drafts.length).toBe(7)
    expect(drafts.every((d) => d.errors.length === 0)).toBe(true)

    const normalized = drafts.map((d) => normalizeRow(d)!).filter(Boolean)
    // First row TAPER must be 22G (not 20G) and have 0 in sft20g
    expect(normalized[0].tagNo).toBe('1')
    expect(normalized[0].description).toBe('TAPER')
    expect(normalized[0].gauge).toBe(22)
    expect(normalized[0].sft22g).toBeCloseTo(3.3610210239833953, 8)
    expect(normalized[0].sft20g).toBe(0)
    expect(normalized[0].cleat).toBeCloseTo(14.98, 6)

    const summary = summarizeDuctScheduleLines(normalized)
    expect(summary.cleat).toBe(279)
    expect(summary.tdf20g).toBe(0)
    expect(summary.rows.find((r) => r.label === 'CLEAT')?.qty).toBe('279')
    expect(summary.rows.find((r) => r.label === '20G TDF')?.qty).toBe('')
  })
})
