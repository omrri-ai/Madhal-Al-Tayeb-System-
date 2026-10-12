import React from 'react';
import { X, Printer, ArrowDownLeft, ArrowUpRight, ArrowRight, Boxes, FileText, Download } from 'lucide-react';
import { StockMovement, Item, Unit, Category } from '../../types/inventory';

interface MovementVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  movement: StockMovement | null;
  item: Item | null;
  unit: Unit | null;
  baseUnit: Unit | null;
  category: Category | null;
  currentStock: number;
}

export const MovementVoucherModal: React.FC<MovementVoucherModalProps> = ({
  isOpen,
  onClose,
  movement,
  item,
  unit,
  baseUnit,
  category,
  currentStock,
}) => {
  if (!isOpen || !movement || !item) return null;

  const isEntry = movement.type === 'IN';
  const voucherTitle = isEntry ? 'سند توريد مخزني (إذن دخول)' : 'سند صرف مخزني (إذن خروج)';
  const invoiceNumber = movement.referenceNumber || movement.id.replace('mov_', 'INV-');

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHTML = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${voucherTitle} - #${invoiceNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
    body { font-family: 'Tajawal', sans-serif; padding: 40px; color: #0f172a; margin: 0; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
    .title { background: ${isEntry ? '#ecfdf5' : '#fff1f2'}; color: ${isEntry ? '#065f46' : '#9f1239'}; border: 1px solid ${isEntry ? '#a7f3d0' : '#fecdd3'}; text-align: center; padding: 12px; font-weight: bold; border-radius: 8px; font-size: 16px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; text-align: right; }
    th { background: #f1f5f9; padding: 10px; font-size: 13px; border: 1px solid #cbd5e1; }
    td { padding: 12px 10px; font-size: 13px; border: 1px solid #cbd5e1; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 30px; font-size: 13px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; margin-top: 50px; font-size: 13px; }
    .sig-line { border-top: 1px dashed #94a3b8; margin-top: 50px; padding-top: 6px; color: #64748b; font-size: 12px; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h2 style="margin: 0 0 6px 0;">نظام مدهال الطيب لإدارة المخزون</h2>
      <div style="color: #64748b; font-size: 13px;">سند حركة مخزنية معتمد وقابل للأرشفة والطباعة</div>
    </div>
    <div style="text-align: left;">
      <div style="font-size: 12px; color: #64748b;">رقم السند / الفاتورة</div>
      <div style="font-size: 20px; font-weight: 900;">#${invoiceNumber}</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${new Date(movement.date).toLocaleString('ar-SA')}</div>
    </div>
  </div>

  <div class="title">${voucherTitle}</div>

  <table>
    <thead>
      <tr>
        <th>بيان الصنف</th>
        <th>الرمز (SKU)</th>
        <th>القسم</th>
        <th>الكمية المسجلة</th>
        <th>المعادل بالوحدة الأساسية</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>${item.name}</strong></td>
        <td>${item.code}</td>
        <td>${category?.name || '-'}</td>
        <td><strong>${movement.quantity} ${unit?.name || 'وحدة'}</strong></td>
        <td><strong>${movement.baseQuantity} ${baseUnit?.name || 'وحدة'}</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="info-box">
    <div><strong>نوع العملية:</strong> ${isEntry ? 'توريد كميات جديدة إلى المستودع (+)' : 'صرف كميات وتخفيض من الرصيد (-)'}</div>
    <div><strong>رصيد الصنف الحالي:</strong> ${currentStock} ${baseUnit?.name || 'وحدة'}</div>
    ${movement.referenceNumber ? `<div><strong>رقم المرجع الخارجي:</strong> #${movement.referenceNumber}</div>` : ''}
    ${movement.notes ? `<div style="grid-column: span 2;"><strong>ملاحظات:</strong> ${movement.notes}</div>` : ''}
  </div>

  <div class="signatures">
    <div>
      <div>أمين المستودع</div>
      <div class="sig-line">التوقيع: .....................</div>
    </div>
    <div>
      <div>المستلم / المورد</div>
      <div class="sig-line">التوقيع: .....................</div>
    </div>
    <div>
      <div>اعتماد الإدارة</div>
      <div class="sig-line">الختم والاعتماد</div>
    </div>
  </div>

  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `فاتورة_${invoiceNumber}_${item.name}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 sm:p-8 my-8 text-right flex flex-col max-h-[95vh] overflow-y-auto">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 no-print">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع</span>
            </button>
            <span className="text-xs text-slate-500 font-medium">معاينة الفاتورة قبل الطباعة</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadHTML}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              title="تنزيل ملف الفاتورة"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">تنزيل ملف السند</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>طباعة / حفظ كـ PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE VOUCHER CONTENT AREA */}
        <div className="p-6 sm:p-8 border-2 border-slate-200 rounded-2xl bg-white text-slate-900 printable-voucher">
          {/* Voucher Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-800 pb-5 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
                  <Boxes className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black text-slate-900">نظام مدهال الطيب لإدارة المخزون</h2>
              </div>
              <p className="text-xs text-slate-500">سند حركة مخزنية معتمد وقابل للأرشفة</p>
            </div>

            <div className="text-left font-mono">
              <div className="text-xs text-slate-500">رقم السند / الفاتورة</div>
              <div className="text-lg font-black text-slate-900">#{invoiceNumber}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {new Date(movement.date).toLocaleDateString('ar-SA')} ·{' '}
                {new Date(movement.date).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Title Banner */}
          <div
            className={`p-3 rounded-xl mb-6 text-center font-bold text-sm ${
              isEntry
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}
          >
            {voucherTitle}
          </div>

          {/* Details Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mb-6 text-xs">
            <table className="w-full text-right">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">بيان الصنف</th>
                  <th className="py-2.5 px-3">الرمز (SKU)</th>
                  <th className="py-2.5 px-3">القسم</th>
                  <th className="py-2.5 px-3">الكمية المسجلة</th>
                  <th className="py-2.5 px-3">المعادل بالوحدة الأساسية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 px-3 font-bold text-slate-900">{item.name}</td>
                  <td className="py-3 px-3 font-mono text-slate-600">{item.code}</td>
                  <td className="py-3 px-3 text-slate-600">{category?.name || '-'}</td>
                  <td className="py-3 px-3 font-bold text-slate-900 font-mono">
                    {movement.quantity} {unit?.name || 'وحدة'}
                  </td>
                  <td className="py-3 px-3 font-bold font-mono text-slate-800">
                    {movement.baseQuantity} {baseUnit?.name || 'وحدة'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Additional Info Box */}
          <div className="grid grid-cols-2 gap-4 mb-6 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">نوع العملية:</span>
              <span className="font-bold text-slate-900">
                {isEntry ? 'توريد كميات جديدة إلى المستودع' : 'صرف كميات وتخفيض من الرصيد'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">رصيد الصنف المتوفر حالياً:</span>
              <span className="font-bold font-mono text-slate-900">
                {currentStock} {baseUnit?.name || 'وحدة'}
              </span>
            </div>
            {movement.referenceNumber && (
              <div>
                <span className="text-slate-500 block">المرجع الخارجي / رقم الإذن:</span>
                <span className="font-bold font-mono text-slate-900">
                  {movement.referenceNumber}
                </span>
              </div>
            )}
            {movement.notes && (
              <div className="col-span-2">
                <span className="text-slate-500 block">ملاحظات وبيان الحركة:</span>
                <span className="font-medium text-slate-800 leading-relaxed">
                  {movement.notes}
                </span>
              </div>
            )}
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-4 pt-8 mt-6 border-t border-slate-200 text-center text-xs">
            <div>
              <span className="text-slate-500 block mb-8 font-medium">أمين المستودع</span>
              <div className="border-t border-dashed border-slate-400 pt-1 text-slate-400 text-[11px]">
                التوقيع: .....................
              </div>
            </div>
            <div>
              <span className="text-slate-500 block mb-8 font-medium">المستلم / المورد</span>
              <div className="border-t border-dashed border-slate-400 pt-1 text-slate-400 text-[11px]">
                التوقيع: .....................
              </div>
            </div>
            <div>
              <span className="text-slate-500 block mb-8 font-medium">اعتماد الإدارة</span>
              <div className="border-t border-dashed border-slate-400 pt-1 text-slate-400 text-[11px]">
                الختم والتوقيع
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
