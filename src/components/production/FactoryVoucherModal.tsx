import React from 'react';
import { X, Printer, Download, Factory, ArrowUpRight, ArrowDownLeft, FileText, CheckCircle2 } from 'lucide-react';
import { StockMovement, Item, Unit, Category } from '../../types/inventory';
import { useInventory } from '../../context/InventoryContext';

interface FactoryVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  movement: StockMovement | null;
}

export const FactoryVoucherModal: React.FC<FactoryVoucherModalProps> = ({
  isOpen,
  onClose,
  movement,
}) => {
  const { companySettings, items, units, categories, getItemStock } = useInventory();

  if (!isOpen || !movement) return null;

  const item = items.find((i) => i.id === movement.itemId);
  const unit = units.find((u) => u.id === movement.unitId);
  const baseUnit = units.find((u) => u.id === item?.baseUnitId);
  const category = categories.find((c) => c.id === item?.categoryId);
  const currentStock = item ? getItemStock(item.id) : 0;

  const isOut =
    movement.type === 'MFG_OUT' ||
    movement.type === 'OUT' ||
    movement.type === 'PRODUCTION_DISPATCH' ||
    (movement.type as string) === 'خروج للمصنع';

  const voucherTitle = isOut
    ? 'سند خروج مواد للمصنع (إذن صرف وتشغيل)'
    : 'سند استلام بضاعة من المصنع (إذن توريد إنتاج)';

  const voucherNumber = movement.referenceNumber || movement.id;
  const formattedDate = new Date(movement.date).toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHTML = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${voucherTitle} - ${voucherNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
    * { box-sizing: border-box; }
    body {
      font-family: 'Tajawal', sans-serif;
      padding: 30px;
      color: #0f172a;
      background: #fff;
      margin: 0;
      direction: rtl;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .company-name {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      margin: 0 0 6px 0;
    }
    .company-details {
      font-size: 11px;
      color: #475569;
      line-height: 1.6;
    }
    .meta-box {
      text-align: left;
    }
    .ref-label {
      font-size: 11px;
      color: #64748b;
    }
    .ref-number {
      font-size: 18px;
      font-weight: 900;
      font-family: monospace;
      color: #0f172a;
    }
    .date-text {
      font-size: 11px;
      color: #64748b;
      margin-top: 3px;
    }
    .voucher-banner {
      background: ${isOut ? '#fff1f2' : '#ecfdf5'};
      color: ${isOut ? '#9f1239' : '#065f46'};
      border: 1px solid ${isOut ? '#fecdd3' : '#a7f3d0'};
      text-align: center;
      padding: 12px;
      font-weight: 900;
      border-radius: 8px;
      font-size: 16px;
      margin-bottom: 24px;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      font-size: 13px;
    }
    .info-item strong {
      color: #1e293b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      text-align: right;
    }
    th {
      background: #f1f5f9;
      color: #1e293b;
      font-size: 12px;
      padding: 10px 12px;
      border: 1px solid #cbd5e1;
      font-weight: 700;
    }
    td {
      padding: 10px 12px;
      font-size: 13px;
      border: 1px solid #cbd5e1;
    }
    .notes-box {
      background: #fafafa;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 30px;
      font-size: 13px;
      color: #334155;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 40px;
      text-align: center;
    }
    .sig-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 16px;
      background: #ffffff;
    }
    .sig-title {
      font-weight: 700;
      font-size: 14px;
      color: #0f172a;
      margin-bottom: 40px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
    }
    .sig-line {
      border-top: 1px dashed #94a3b8;
      padding-top: 8px;
      color: #64748b;
      font-size: 12px;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${companySettings.name || 'مدهال الطيب'}</div>
      <div class="company-details">
        ${companySettings.commercialRegister ? `س.ت: ${companySettings.commercialRegister} | ` : ''}
        ${companySettings.taxId ? `الرقم الضريبي: ${companySettings.taxId}` : ''}<br/>
        ${companySettings.address ? `العنوان: ${companySettings.address} | ` : ''}
        ${companySettings.phone ? `الجوال: ${companySettings.phone}` : ''}
      </div>
    </div>
    <div class="meta-box">
      <div class="ref-label">رقم السند الرسمي</div>
      <div class="ref-number">${voucherNumber}</div>
      <div class="date-text">${formattedDate}</div>
    </div>
  </div>

  <div class="voucher-banner">${voucherTitle}</div>

  <div class="info-card">
    <div class="info-item"><strong>أمين المستودع:</strong> عمرو العواضي (0558543794)</div>
    <div class="info-item"><strong>جهة المصنع:</strong> قسم المصنع والتصنيع</div>
    <div class="info-item"><strong>نوع العملية:</strong> ${isOut ? 'خروج مواد خام وتصنيع للمصنع' : 'استلام وتوريد منتجات من المصنع'}</div>
    <div class="info-item"><strong>حالة الحركة:</strong> معتمدة ومؤكدة في المخزون</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 50px; text-align: center;">#</th>
        <th>رمز الصنف (SKU)</th>
        <th>اسم الصنف</th>
        <th>القسم / التصنيف</th>
        <th style="text-align: center;">الكمية المسجلة</th>
        <th>الوحدة</th>
        <th style="text-align: center;">المعادل بالوحدة الأساسية</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="text-align: center; font-weight: bold;">1</td>
        <td style="font-family: monospace; font-weight: bold;">${item?.code || '-'}</td>
        <td style="font-weight: 700;">${item?.name || 'صنف غير معروف'}</td>
        <td>${category?.name || '-'}</td>
        <td style="text-align: center; font-weight: 900; font-size: 15px; color: ${isOut ? '#b91c1c' : '#047857'};">
          ${isOut ? '-' : '+'}${movement.quantity}
        </td>
        <td>${unit?.name || 'وحدة'}</td>
        <td style="text-align: center; font-weight: bold;">
          ${movement.baseQuantity} ${baseUnit?.name || ''}
        </td>
      </tr>
    </tbody>
  </table>

  ${
    movement.notes
      ? `<div class="notes-box">
          <strong>ملاحظات العملية:</strong> ${movement.notes}
        </div>`
      : ''
  }

  <div class="signatures-grid">
    <div class="sig-card">
      <div class="sig-title">المسلّم (${isOut ? 'أمين المستودع' : 'مسؤول المصنع'})</div>
      <div style="font-size: 12px; color: #475569; margin-bottom: 25px;">الاسم: ....................................................</div>
      <div class="sig-line">التوقيع والاعتماد</div>
    </div>
    <div class="sig-card">
      <div class="sig-title">المستلم (${isOut ? 'مسؤول المصنع' : 'أمين المستودع'})</div>
      <div style="font-size: 12px; color: #475569; margin-bottom: 25px;">الاسم: ....................................................</div>
      <div class="sig-line">التوقيع والاعتماد</div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${voucherNumber}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Bar (Hidden during window.print) */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 no-print">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isOut ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {isOut ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>سند حركة المصنع</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                  {voucherNumber}
                </span>
              </h2>
              <p className="text-xs text-slate-500">جاهز للطباعة والتوثيق الرسمي</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة A4</span>
            </button>
            <button
              onClick={handleDownloadHTML}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold transition"
              title="تحميل ملف HTML"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Content Area */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 bg-white text-slate-900">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b-2 border-slate-900 gap-4">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {companySettings.name || 'مدهال الطيب'}
              </h1>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {companySettings.commercialRegister && `س.ت: ${companySettings.commercialRegister} | `}
                {companySettings.taxId && `الرقم الضريبي: ${companySettings.taxId}`}
                <br />
                {companySettings.address && `${companySettings.address} `}
                {companySettings.phone && `| هاتف: ${companySettings.phone}`}
              </p>
            </div>

            <div className="text-left bg-slate-50 p-2.5 rounded-xl border border-slate-200 min-w-[180px]">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">رقم السند</div>
              <div className="font-mono text-base font-black text-slate-900">{voucherNumber}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{formattedDate}</div>
            </div>
          </div>

          {/* Banner */}
          <div
            className={`p-3 rounded-xl border text-center font-black text-sm sm:text-base flex items-center justify-center gap-2 ${
              isOut
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {isOut ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
            <span>{voucherTitle}</span>
          </div>

          {/* Parties Meta */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <span className="text-slate-400">أمين المستودع: </span>
              <strong className="text-slate-800">عمرو العواضي (0558543794)</strong>
            </div>
            <div>
              <span className="text-slate-400">جهة المصنع: </span>
              <strong className="text-slate-800">قسم المصنع والتصنيع</strong>
            </div>
            <div>
              <span className="text-slate-400">نوع العملية: </span>
              <strong className={isOut ? 'text-rose-700' : 'text-emerald-700'}>
                {isOut ? 'خروج مواد للمصنع' : 'وارد منتجات من المصنع'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400">التوثيق: </span>
              <span className="inline-flex items-center gap-1 font-bold text-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                معتمد ومؤكد في النظام
              </span>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5 text-center w-10">#</th>
                  <th className="p-2.5">رمز الصنف</th>
                  <th className="p-2.5">اسم الصنف</th>
                  <th className="p-2.5">التصنيف</th>
                  <th className="p-2.5 text-center">الكمية</th>
                  <th className="p-2.5">الوحدة</th>
                  <th className="p-2.5 text-center">المعادل بالوحدة الأساسية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2.5 text-center font-bold text-slate-400">1</td>
                  <td className="p-2.5 font-mono font-bold text-slate-700">{item?.code || '-'}</td>
                  <td className="p-2.5 font-black text-slate-900">{item?.name || 'صنف غير معروف'}</td>
                  <td className="p-2.5 text-slate-600">{category?.name || '-'}</td>
                  <td className="p-2.5 text-center font-black text-sm">
                    <span className={isOut ? 'text-rose-700' : 'text-emerald-700'}>
                      {isOut ? '-' : '+'}
                      {movement.quantity}
                    </span>
                  </td>
                  <td className="p-2.5 font-bold text-slate-700">{unit?.name || 'وحدة'}</td>
                  <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                    {movement.baseQuantity} {baseUnit?.name || ''}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {movement.notes && (
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-slate-700">
              <strong className="text-amber-900 ml-1">ملاحظات:</strong>
              <span>{movement.notes}</span>
            </div>
          )}

          {/* Signatures Section */}
          <div className="pt-4 grid grid-cols-2 gap-6 text-center">
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
              <div className="font-bold text-xs text-slate-800 mb-4 pb-2 border-b border-slate-200">
                المسلّم ({isOut ? 'أمين المستودع' : 'مسؤول المصنع'})
              </div>
              <div className="text-[11px] text-slate-700 mb-6 text-right font-medium">
                الاسم: {isOut ? 'عمرو العواضي (0558543794)' : '........................................'}
              </div>
              <div className="border-t border-dashed border-slate-300 pt-2 text-[11px] text-slate-400">
                التوقيع والاعتماد
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
              <div className="font-bold text-xs text-slate-800 mb-4 pb-2 border-b border-slate-200">
                المستلم ({isOut ? 'مسؤول المصنع' : 'أمين المستودع'})
              </div>
              <div className="text-[11px] text-slate-700 mb-6 text-right font-medium">
                الاسم: {!isOut ? 'عمرو العواضي (0558543794)' : '........................................'}
              </div>
              <div className="border-t border-dashed border-slate-300 pt-2 text-[11px] text-slate-400">
                التوقيع والاعتماد
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
