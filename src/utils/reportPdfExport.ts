// Professional Arabic PDF & Print Generator for Makhzouni Inventory
import html2pdf from 'html2pdf.js';

export interface ReportPrintOptions {
  title: string;
  subtitle?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  commercialRegister?: string;
  taxId?: string;
  managerName?: string;
  periodLabel: string;
  inclusiveNote: string;
  generatedDate?: string;
  generatedBy?: string;
  sectionsHtml: string;
}

// Build standard, high-fidelity Arabic print document HTML
export function buildReportHtmlDocument(opts: ReportPrintOptions): string {
  const company = opts.companyName || 'مخزون مدهال الطيب';
  const genDate = opts.generatedDate || new Date().toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const refNum = 'REP-' + Date.now().toString(36).toUpperCase();

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${opts.title} - ${company}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800;900&display=swap');

    @page {
      size: A4 portrait;
      margin: 12mm 10mm 15mm 10mm;
      @bottom-center {
        content: "صفحة " counter(page) " من " counter(pages);
        font-family: 'Tajawal', sans-serif;
        font-size: 9pt;
        color: #64748b;
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Tajawal', -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
      margin: 0;
      padding: 16px;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
      font-size: 11pt;
      direction: rtl;
    }

    .report-container {
      width: 100%;
      max-width: 100%;
    }

    /* Header styling */
    .report-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .brand-title {
      font-size: 18pt;
      font-weight: 900;
      color: #047857;
      margin: 0;
    }

    .brand-subtitle {
      font-size: 10pt;
      color: #475569;
      margin-top: 2px;
      font-weight: 600;
    }

    .report-title-box {
      text-align: left;
    }

    .report-main-title {
      font-size: 15pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }

    .report-ref-badge {
      font-size: 8.5pt;
      color: #64748b;
      font-family: monospace;
      margin-top: 2px;
    }

    /* Meta bar */
    .report-meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 18px;
      font-size: 9pt;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
    }

    .meta-label {
      color: #64748b;
      font-size: 8pt;
      font-weight: 700;
      margin-bottom: 2px;
    }

    .meta-val {
      color: #0f172a;
      font-weight: 700;
    }

    /* Section block */
    .section-block {
      margin-bottom: 22px;
      page-break-inside: auto;
    }

    .section-header {
      background: #0f172a;
      color: #ffffff;
      padding: 6px 12px;
      border-radius: 4px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-after: avoid;
    }

    .section-title {
      font-size: 11pt;
      font-weight: 800;
      margin: 0;
    }

    .section-badge {
      font-size: 8.5pt;
      background: rgba(255, 255, 255, 0.18);
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 700;
    }

    /* KPI Summary strip */
    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }

    .kpi-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 6px 10px;
      text-align: right;
    }

    .kpi-box-label {
      font-size: 7.5pt;
      color: #64748b;
      font-weight: 700;
    }

    .kpi-box-value {
      font-size: 12pt;
      font-weight: 900;
      color: #0f172a;
      margin-top: 2px;
      font-family: 'Tajawal', sans-serif;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 9pt;
      text-align: right;
    }

    thead {
      display: table-header-group;
    }

    tr {
      page-break-inside: avoid;
    }

    th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 800;
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      font-size: 8.5pt;
      white-space: nowrap;
    }

    td {
      border: 1px solid #e2e8f0;
      padding: 5px 8px;
      font-size: 8.5pt;
      color: #1e293b;
      vertical-align: middle;
    }

    tr:nth-child(even) td {
      background: #fcfdfe;
    }

    .num-cell {
      font-family: 'Tajawal', sans-serif;
      font-weight: 700;
      text-align: center;
    }

    .text-cell {
      text-align: right;
    }

    .badge-in {
      color: #065f46;
      font-weight: 700;
    }

    .badge-out {
      color: #991b1b;
      font-weight: 700;
    }

    .badge-neutral {
      color: #1e40af;
      font-weight: 700;
    }

    /* Signatures block */
    .signatures-block {
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px solid #cbd5e1;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      text-align: center;
      page-break-inside: avoid;
    }

    .sig-role {
      font-size: 9pt;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 24px;
    }

    .sig-line {
      border-bottom: 1px dashed #94a3b8;
      width: 70%;
      margin: 0 auto;
    }

    .sig-sub {
      font-size: 7.5pt;
      color: #64748b;
      margin-top: 4px;
    }

    /* Footer */
    .report-footer {
      margin-top: 14px;
      text-align: center;
      font-size: 8pt;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 8px;
      page-break-inside: avoid;
    }

    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- Official Header -->
    <div class="report-header">
      <div>
        <h1 class="brand-title">${company}</h1>
        <div class="brand-subtitle">
          ${opts.companyAddress ? opts.companyAddress + ' · ' : ''}
          ${opts.companyPhone ? 'هاتف: ' + opts.companyPhone : 'إدارة المخزون والعمليات'}
          ${opts.commercialRegister ? ' · س.ت: ' + opts.commercialRegister : ''}
          ${opts.taxId ? ' · الرقم الضريبي: ' + opts.taxId : ''}
        </div>
      </div>
      <div class="report-title-box">
        <h2 class="report-main-title">${opts.title}</h2>
        ${opts.subtitle ? `<div style="font-size: 9.5pt; color: #475569; font-weight: 600;">${opts.subtitle}</div>` : ''}
        <div class="report-ref-badge">رقم التقرير: ${refNum}</div>
      </div>
    </div>

    <!-- Metadata Bar -->
    <div class="report-meta-grid">
      <div class="meta-item">
        <span class="meta-label">الفترة الزمنية:</span>
        <span class="meta-val">${opts.periodLabel}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">تاريخ ووقت الاستخراج:</span>
        <span class="meta-val">${genDate}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">نطاق السجلات والشمولية:</span>
        <span class="meta-val">${opts.inclusiveNote}</span>
      </div>
    </div>

    <!-- Dynamic Sections -->
    <div class="report-sections">
      ${opts.sectionsHtml}
    </div>

    <!-- Official Validation & Signatures Block -->
    <div class="signatures-block">
      <div>
        <div class="sig-role">أمين المستودع المختص</div>
        <div class="sig-line"></div>
        <div class="sig-sub">التوقيع والتاريخ</div>
      </div>
      <div>
        <div class="sig-role">مشرف إدارة المخزون</div>
        <div class="sig-line"></div>
        <div class="sig-sub">التوقيع والمراجعة</div>
      </div>
      <div>
        <div class="sig-role">الاعتماد الرسمي للإدارة</div>
        <div class="sig-line"></div>
        <div class="sig-sub">${opts.managerName || 'إدارة مدهال الطيب'}</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="report-footer">
      نظام مخزون مدهال الطيب — تقرير موثق مستخرج تلقائيًا من قاعدة البيانات السحابية المعتمدة
    </div>
  </div>
</body>
</html>`;
}

// Print report via hidden iframe to protect application UI state and ensure clean print dialog
export function printReportHtml(htmlContent: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.zIndex = '-999';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    console.error('Cannot access print iframe document');
    window.print();
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  // Wait for fonts & styles to settle, then print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.warn('Iframe print error, falling back to window.print:', err);
      window.print();
    } finally {
      // Clean up after print dialog finishes
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }, 5000);
    }
  }, 400);
}

// Converts any CSS color string (including oklch, oklab, hex, named, etc.) to rgb()/rgba()
function parseColorToRgb(colorStr: string): string | null {
  if (!colorStr || typeof colorStr !== 'string') return null;
  const trimmed = colorStr.trim();
  if (!trimmed || trimmed === 'transparent' || trimmed === 'inherit') return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.fillStyle = '#000000';
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = trimmed;
    ctx.fillRect(0, 0, 1, 1);

    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a === 0 && trimmed !== 'black' && trimmed !== '#000' && trimmed !== '#000000') {
      return 'transparent';
    }
    const alpha = (a / 255).toFixed(3);
    return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch {
    return null;
  }
}

// Replaces any oklch(...) or oklab(...) in strings (like box-shadow) with standard rgb/rgba
function replaceOklchInString(str: string): string {
  if (!str || (!str.includes('oklch') && !str.includes('oklab'))) return str;
  return str.replace(/oklch\([^)]+\)|oklab\([^)]+\)/gi, (match) => {
    return parseColorToRgb(match) || 'rgba(0, 0, 0, 0.1)';
  });
}

// Sanitizes all CSS color properties in a cloned document to guarantee zero oklch/oklab functions reach html2canvas
function sanitizeOklchInDocument(clonedDoc: Document): void {
  const colorProps = [
    'color',
    'background-color',
    'border-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline-color',
    'fill',
    'stroke',
  ] as const;

  const elements = [
    clonedDoc.body,
    ...Array.from(clonedDoc.querySelectorAll<HTMLElement>('*')),
  ];

  const view = clonedDoc.defaultView || window;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!el) continue;

    const computed = view.getComputedStyle(el);
    if (!computed) continue;

    for (let j = 0; j < colorProps.length; j++) {
      const prop = colorProps[j];
      const val = computed.getPropertyValue(prop);
      if (val && (val.includes('oklch') || val.includes('oklab'))) {
        const rgb = parseColorToRgb(val);
        if (rgb) {
          el.style.setProperty(prop, rgb, 'important');
        }
      }
    }

    const boxShadow = computed.getPropertyValue('box-shadow');
    if (boxShadow && (boxShadow.includes('oklch') || boxShadow.includes('oklab'))) {
      const sanitizedShadow = replaceOklchInString(boxShadow);
      el.style.setProperty('box-shadow', sanitizedShadow, 'important');
    }
  }
}

// Export DOM element directly to a downloaded PDF file using html2pdf.js
export async function exportElementToPdfFile(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const opt = {
    margin: [10, 8, 12, 8] as [number, number, number, number],
    filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    enableLinks: false,
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      logging: false,
      onclone: (clonedDoc: Document) => {
        sanitizeOklchInDocument(clonedDoc);
      },
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait' as const,
      compress: true,
    },
    pagebreak: {
      mode: ['avoid-all', 'css', 'legacy'],
      avoid: ['tr', '.kpi-box', '.kpi-strip', '.signatures-block'],
      before: ['.page-break'],
    },
  };

  try {
    await html2pdf().set(opt).from(element).save();
  } catch (err) {
    console.error('html2pdf export error:', err);
    throw err;
  }
}
