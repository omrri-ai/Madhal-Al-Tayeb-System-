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

// CSS الخاص بالتقرير، كل القواعد مقيّدة بـ .report-root عشان ما تتعارض مع تنسيق التطبيق
// ويُستخدم بنفس الشكل في: المعاينة، الطباعة، وتصدير PDF (فتطلع النتيجة متطابقة)
export const REPORT_CSS = `.report-root, .report-root * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
.report-root {
      font-family: 'Tajawal', -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
      margin: 0;
      padding: 16px;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
      font-size: 11pt;
      direction: rtl;
    }
.report-root .report-container {
      width: 100%;
      max-width: 100%;
    }

    /* Header styling */
.report-root .report-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
.report-root .brand-title {
      font-size: 18pt;
      font-weight: 900;
      color: #047857;
      margin: 0;
    }
.report-root .brand-subtitle {
      font-size: 10pt;
      color: #475569;
      margin-top: 2px;
      font-weight: 600;
    }
.report-root .report-title-box {
      text-align: left;
    }
.report-root .report-main-title {
      font-size: 15pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }
.report-root .report-ref-badge {
      font-size: 8.5pt;
      color: #64748b;
      font-family: monospace;
      margin-top: 2px;
    }

    /* Meta bar */
.report-root .report-meta-grid {
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
.report-root .meta-item {
      display: flex;
      flex-direction: column;
    }
.report-root .meta-label {
      color: #64748b;
      font-size: 8pt;
      font-weight: 700;
      margin-bottom: 2px;
    }
.report-root .meta-val {
      color: #0f172a;
      font-weight: 700;
    }

    /* Section block */
.report-root .section-block {
      margin-bottom: 22px;
      page-break-inside: auto;
    }
.report-root .section-header {
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
.report-root .section-title {
      font-size: 11pt;
      font-weight: 800;
      margin: 0;
    }
.report-root .section-badge {
      font-size: 8.5pt;
      background: rgba(255, 255, 255, 0.18);
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 700;
    }

    /* KPI Summary strip */
.report-root .kpi-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
.report-root .kpi-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 6px 10px;
      text-align: right;
    }
.report-root .kpi-box-label {
      font-size: 7.5pt;
      color: #64748b;
      font-weight: 700;
    }
.report-root .kpi-box-value {
      font-size: 12pt;
      font-weight: 900;
      color: #0f172a;
      margin-top: 2px;
      font-family: 'Tajawal', sans-serif;
    }

    /* Tables */
.report-root table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 9pt;
      text-align: right;
    }
.report-root thead {
      display: table-header-group;
    }
.report-root tr {
      page-break-inside: avoid;
    }
.report-root th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 800;
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      font-size: 8.5pt;
      white-space: normal !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
.report-root td {
      border: 1px solid #e2e8f0;
      padding: 5px 8px;
      font-size: 8.5pt;
      color: #1e293b;
      vertical-align: middle;
      white-space: normal !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
.report-root tr:nth-child(even) td {
      background: #fcfdfe;
    }
.report-root .num-cell {
      font-family: 'Tajawal', sans-serif;
      font-weight: 700;
      text-align: center;
    }
.report-root .text-cell {
      text-align: right;
    }
.report-root .badge-in {
      color: #065f46;
      font-weight: 700;
    }
.report-root .badge-out {
      color: #991b1b;
      font-weight: 700;
    }
.report-root .badge-neutral {
      color: #1e40af;
      font-weight: 700;
    }

    /* Signatures block */
.report-root .signatures-block {
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px solid #cbd5e1;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      text-align: center;
      page-break-inside: avoid;
    }
.report-root .sig-role {
      font-size: 9pt;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 24px;
    }
.report-root .sig-line {
      border-bottom: 1px dashed #94a3b8;
      width: 70%;
      margin: 0 auto;
    }
.report-root .sig-sub {
      font-size: 7.5pt;
      color: #64748b;
      margin-top: 4px;
    }

    /* Footer */
.report-root .report-footer {
      margin-top: 14px;
      text-align: center;
      font-size: 8pt;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 8px;
      page-break-inside: avoid;
    }

    @media print {
      .report-root { padding: 0; }
      .report-root .no-print { display: none !important; }
    }

    /* أسماء الأصناف تظهر كاملة بدون قص */
    .report-root table { table-layout: auto; }
    .report-root td, .report-root th, .report-root strong {
      white-space: normal !important;
      overflow: visible !important;
      text-overflow: clip !important;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
`;

// محتوى التقرير (الترويسة + الأقسام + التواقيع) بدون وسوم html/head
export function buildReportBodyHtml(opts: ReportPrintOptions): string {
  const company = opts.companyName || 'مخزون مدهال الطيب';
  const genDate = opts.generatedDate || new Date().toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const refNum = 'REP-' + Date.now().toString(36).toUpperCase();

  return `
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
    </div>`;
}

// وثيقة الطباعة الكاملة
export function buildReportHtmlDocument(opts: ReportPrintOptions): string {
  const company = opts.companyName || 'مخزون مدهال الطيب';
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
    }
    body { margin: 0; background: #ffffff; }
    ${REPORT_CSS}
  </style>
</head>
<body>
  <div class="report-root" dir="rtl">
    ${buildReportBodyHtml(opts)}
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


// تصدير التقرير إلى PDF من نسخة مستقلة بعرض ثابت خارج الشاشة.
// هذا يمنع القص الناتج من التمرير داخل نافذة المعاينة أو من overflow الجداول،
// ويضمن إن أسماء الأصناف والجداول تطلع كاملة ونفس شكل الطباعة.
export async function exportReportHtmlToPdf(bodyHtml: string, filename: string): Promise<void> {
  const style = document.createElement('style');
  style.setAttribute('data-report-pdf-style', '1');
  style.textContent = REPORT_CSS;
  document.head.appendChild(style);

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;background:#fff;z-index:-1;';

  const root = document.createElement('div');
  root.className = 'report-root';
  root.setAttribute('dir', 'rtl');
  root.style.width = '760px';
  root.style.padding = '0';
  root.innerHTML = bodyHtml;

  host.appendChild(root);
  document.body.appendChild(host);

  try {
    try {
      await Promise.race([
        (document as any).fonts?.ready,
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch {
      /* تجاهل */
    }
    await exportElementToPdfFile(root, filename);
  } finally {
    document.body.removeChild(host);
    document.head.removeChild(style);
  }
}
