/** Brand colours aligned with src/index.css (@theme). */
export const PDF_BRAND = {
  primary: '#009888',
  primaryDark: '#007a6d',
  secondary: '#186898',
  secondaryDark: '#145578',
  text: '#1a2830',
  textMuted: '#5a6d72',
  border: '#c5d6d6',
  background: '#f2f8f7',
  success: '#306830',
  successBg: '#e8f5ef',
  warningBg: '#e8f2f8',
}

export function pdfGuideStyles() {
  const b = PDF_BRAND
  return `
    @page { margin: 20mm 15mm; size: A4; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Inter, Arial, sans-serif;
      color: ${b.text};
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
      background: linear-gradient(180deg, ${b.primary} 0%, ${b.primaryDark} 100%);
      color: white;
      padding: 40px;
    }
    .cover h1 { font-size: 32pt; margin: 0 0 8px; letter-spacing: -0.02em; }
    .cover .tagline { font-size: 14pt; opacity: 0.95; margin-bottom: 40px; }
    .cover .meta { font-size: 11pt; opacity: 0.85; line-height: 1.8; }
    .cover .badge {
      display: inline-block;
      background: #f5ba2e;
      color: ${b.text};
      padding: 8px 20px;
      border-radius: 20px;
      font-weight: 600;
      margin-top: 32px;
      font-size: 10pt;
    }
    h2 {
      color: ${b.primary};
      font-size: 18pt;
      border-bottom: 2px solid ${b.primary};
      padding-bottom: 6px;
      margin-top: 28px;
      page-break-after: avoid;
    }
    h3 { color: ${b.secondary}; font-size: 12pt; margin-top: 20px; page-break-after: avoid; }
    h4 { color: ${b.textMuted}; font-size: 11pt; margin-top: 16px; }
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
      background: ${b.primary};
      color: white;
      text-align: left;
      padding: 8px 10px;
    }
    td {
      border-bottom: 1px solid ${b.border};
      padding: 8px 10px;
      vertical-align: top;
    }
    .highlight {
      background: ${b.background};
      border-left: 4px solid ${b.primary};
      padding: 12px 16px;
      margin: 16px 0;
      border-radius: 0 8px 8px 0;
    }
    .badge-blue {
      display: inline-block;
      background: ${b.warningBg};
      color: ${b.secondary};
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 9pt;
      font-weight: 600;
    }
    .badge-green {
      display: inline-block;
      background: ${b.successBg};
      color: ${b.success};
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
    .screen { page-break-inside: avoid; margin: 24px 0 32px; }
    .screen img {
      width: 100%;
      border: 1px solid ${b.border};
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 152, 136, 0.12);
      margin-top: 8px;
    }
    .screen h3 {
      font-size: 11pt;
      color: ${b.textMuted};
      font-weight: 600;
      margin-bottom: 4px;
    }
    .role-label {
      display: inline-block;
      background: ${b.primary};
      color: white;
      font-size: 9pt;
      font-weight: 600;
      padding: 2px 10px;
      border-radius: 12px;
      margin-bottom: 6px;
    }
    .toc { page-break-after: always; }
    .toc li { margin: 6px 0; }
    .footer-note {
      font-size: 9pt;
      color: ${b.textMuted};
      text-align: center;
      margin-top: 40px;
      border-top: 1px solid ${b.border};
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
      background: ${b.primary};
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
  `
}

export function pdfMobileExtraStyles() {
  return `
    .phone-frame {
      max-width: 240px;
      margin: 12px auto 0;
      border: 10px solid #1a2830;
      border-radius: 28px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0, 152, 136, 0.15);
    }
    .phone-frame img {
      width: 100%;
      display: block;
      vertical-align: top;
      max-height: 58vh;
      object-fit: cover;
      object-position: top center;
    }
    .phone-frame.compact img { max-height: 52vh; }
    .screen h3 { text-align: center; }
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
  `
}
