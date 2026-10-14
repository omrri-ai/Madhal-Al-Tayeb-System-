import React from 'react';
import { X, Printer, Download, CheckCircle2, Factory, Calendar, UserCheck, ShieldCheck } from 'lucide-react';
import { ProductionOrder, Item, Unit } from '../../types/inventory';
import { useInventory } from '../../context/InventoryContext';

export type ProductionVoucherType = 'DISPATCH' | 'RECEIPT' | 'RETURN';

interface ProductionVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucherType: ProductionVoucherType;
  order: ProductionOrder;
  voucherRecord: any; // ProductionDispatchRecord | ProductionReceiptRecord | ProductionReturnRecord
}

export const ProductionVoucherModal: React.FC<ProductionVoucherModalProps> = ({
  isOpen,
  onClose,
  voucherType,
  order,
  voucherRecord,
}) => {
  const { items, units, companySettings } = useInventory();

  if (!isOpen || !order || !voucherRecord) return null;

  const voucherTitle =
    voucherType === 'DISPATCH'
      ? 'سند صرف مواد للإنتاج والتصنيع'
      : voucherType === 'RECEIPT'
      ? 'سند استلام منتج جاهز من الإنتاج'
      : 'سند مرتجع مواد من الإنتاج إلى المستودع';

  const voucherNumber = voucherRecord.voucherNumber || 'PRD-VOUCHER';
  const voucherDate = voucherRecord.date || new Date().toISOString();
  const warehouseManagerName = 'عمرو العواضي';
  const warehouseManagerPhone = '0558543794';

  // Items to display in the voucher table
  let displayRows: {
    index: number;
    itemName: string;
    itemCode: string;
    quantity: number;
    unitName: string;
    baseQuantity: number;
    baseUnitName: string;
    notes?: string;
  }[] = [];

  if (voucherType === 'RECEIPT') {
    const targetItem = items.find((i) => i.id === voucherRecord.itemId);
    const unit = units.find((u) => u.id === voucherRecord.unitId);
    const baseUnit = units.find((u) => u.id === targetItem?.baseUnitId);
    displayRows = [
      {
        index: 1,
        itemName: targetItem?.name || 'المنتج الجاهز',
        itemCode: targetItem?.code || '-',
        quantity: voucherRecord.quantity,
        unitName: unit?.name || 'وحدة',
        baseQuantity: voucherRecord.baseQuantity,
        baseUnitName: baseUnit?.name || 'وحدة',
        notes: voucherRecord.notes || '',
      },
    ];
  } else {
    // DISPATCH or RETURN (array of items)
    displayRows = (voucherRecord.items || []).map((entry: any, idx: number) => {
      const item = items.find((i) => i.id === entry.itemId);
      const unit = units.find((u) => u.id === entry.unitId);
      const baseUnit = units.find((u) => u.id === item?.baseUnitId);
      return {
        index: idx + 1,
        itemName: item?.name || 'صنف',
        itemCode: item?.code || '-',
        quantity: entry.quantity,
        unitName: unit?.name || 'وحدة',
        baseQuantity: entry.baseQuantity,
        baseUnitName: baseUnit?.name || 'وحدة',
        notes: entry.notes || '',
      };
    });
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHTML = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${voucherTitle} - #${voucherNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;900&display=swap');
    body { font-family: 'Tajawal', sans-serif; padding: 35px; color: #0f172a; margin: 0; background: #fff; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px; }
    .company-title { font-size: 18px; font-weight: 900; margin: 0 0 4px 0; color: #0f172a; }
    .company-meta { font-size: 12px; color: #475569; line-height: 1.6; }
    .title-banner { background: ${voucherType === 'RECEIPT' ? '#ecfdf5' : voucherType === 'DISPATCH' ? '#eff6ff' : '#fef3c7'}; color: ${voucherType === 'RECEIPT' ? '#065f46' : voucherType === 'DISPATCH' ? '#1e40af' : '#92400e'}; border: 1px solid ${voucherType === 'RECEIPT' ? '#a7f3d0' : voucherType === 'DISPATCH' ? '#bfdbfe' : '#fde68a'}; text-align: center; padding: 10px; font-weight: bold; border-radius: 8px; font-size: 15px; margin-bottom: 16px; }
    .order-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; text-align: right; }
    th { background: #f1f5f9; padding: 9px 12px; font-size: 12px; border: 1px solid #cbd5e1; color: #334155; }
    td { padding: 9px 12px; font-size: 12px; border: 1px solid #cbd5e1; }
    .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; margin-top: 35px; font-size: 12px; }
    .sig-line { border-top: 1px dashed #94a3b8; margin-top: 35px; padding-top: 6px; color: #64748b; font-size: 11px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h2 class="company-title">${companySettings.name || 'مصنع ومخزون مدهال الطيب'}</h2>
      <div class="company-meta">
        العنوان: ${companySettings.address || 'المملكة العربية السعودية'}<br/>
        أمين المستودع: ${warehouseManagerName} | الجوال: ${warehouseManagerPhone}
      </div>
    </div>
    <div style="text-align: left;">
      <div style="font-size: 11px; color: #64748b;">رقم السند</div>
      <div style="font-size: 18px; font-weight: 900; color: #0f172a;">#${voucherNumber}</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${new Date(voucherDate).toLocaleString('ar-SA')}</div>
    </div>
  </div>

  <div class="title-banner">${voucherTitle}</div>

  <div class="order-card">
    <div><strong>رقم أمر الإنتاج:</strong> <span style="font-family: monospace; font-weight: bold;">${order.orderNumber}</span></div>
    <div><strong>بيان العملية / العنوان:</strong> ${order.title}</div>
    <div><strong>حالة الأمر:</strong> ${order.status === 'COMPLETED' ? 'مكتمل' : order.status === 'PENDING_RECEIPT' ? 'بانتظار الاستلام' : 'مفتوح / جاري'}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px; text-align: center;">م</th>
        <th>البيان والصنف</th>
        <th style="width: 100px;">الرمز (SKU)</th>
        <th style="width: 110px;">الكمية بالوحدة</th>
        <th style="width: 130px;">المعادل بالوحدة الأساسية</th>
        <th>ملاحظات</th>
      </tr>
    </thead>
    <tbody>
      ${displayRows
        .map(
          (r) => `
        <tr>
          <td style="text-align: center;">${r.index}</td>
          <td><strong>${r.itemName}</strong></td>
          <td style="font-family: monospace;">${r.itemCode}</td>
          <td><strong>${r.quantity} ${r.unitName}</strong></td>
          <td>${r.baseQuantity} ${r.baseUnitName}</td>
          <td style="color: #64748b;">${r.notes || '-'}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="summary-box">
    <div><strong>إجمالي بنود السند:</strong> ${displayRows.length} صنف</div>
    <div><strong>أمين المستودع المعتمد:</strong> ${warehouseManagerName} (${warehouseManagerPhone})</div>
    ${voucherRecord.notes ? `<div style="grid-column: span 2;"><strong>ملاحظات عامة للسند:</strong> ${voucherRecord.notes}</div>` : ''}
  </div>

  <div class="signatures">
    <div>
      <div><strong>أمين المستودع</strong></div>
      <div style="margin-top: 4px; color: #475569;">${warehouseManagerName}</div>
      <div class="sig-line">التوقيع: .....................</div>
    </div>
    <div>
      <div><strong>مسؤول قسم الإنتاج والتصنيع</strong></div>
      <div style="margin-top: 4px; color: #475569;">المستلم / المسلّم للإنتاج</div>
      <div class="sig-line">التوقيع والختم: .....................</div>
    </div>
    <div>
      <div><strong>اعتماد إدارة المصنع</strong></div>
      <div style="margin-top: 4px; color: #475569;">إدارة مدهال الطيب</div>
      <div class="sig-line">الختم والاعتماد الرسمي</div>
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
    link.download = `سند_إنتاج_${voucherNumber}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 no-print">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                voucherType === 'RECEIPT'
                  ? 'bg-emerald-100 text-emerald-700'
                  : voucherType === 'DISPATCH'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">{voucherTitle}</h3>
              <p className="text-xs text-slate-500 font-mono">رقم السند: #{voucherNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة A4</span>
            </button>
            <button
              onClick={handleDownloadHTML}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              title="تحميل ملف السند"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">تحميل</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Printable A4 Preview */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-900 bg-white select-text">
          {/* Company & Document Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {companySettings.name || 'مصنع ومخزون مدهال الطيب'}
              </h2>
              <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                <div>العنوان: {companySettings.address || 'المملكة العربية السعودية'}</div>
                <div>
                  أمين المستودع: <strong>{warehouseManagerName}</strong> | الجوال:{' '}
                  <span className="font-mono">{warehouseManagerPhone}</span>
                </div>
              </div>
            </div>

            <div className="text-left">
              <span className="text-[11px] text-slate-500 block">رقم السند المعتمد</span>
              <span className="text-lg font-black font-mono text-slate-900">#{voucherNumber}</span>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-end gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(voucherDate).toLocaleDateString('ar-SA')}</span>
              </div>
            </div>
          </div>

          {/* Title Banner */}
          <div
            className={`p-3 rounded-xl text-center font-bold text-sm border ${
              voucherType === 'RECEIPT'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : voucherType === 'DISPATCH'
                ? 'bg-blue-50 text-blue-800 border-blue-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {voucherTitle}
          </div>

          {/* Linked Production Order Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">رقم أمر الإنتاج:</span>
              <span className="font-mono font-bold text-slate-900 text-sm">#{order.orderNumber}</span>
            </div>
            <div>
              <span className="text-slate-500 block">بيان العملية / الوصف:</span>
              <span className="font-bold text-slate-800">{order.title}</span>
            </div>
            <div>
              <span className="text-slate-500 block">حالة أمر الإنتاج:</span>
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                {order.status === 'COMPLETED'
                  ? 'مكتمل الاستلام'
                  : order.status === 'PENDING_RECEIPT'
                  ? 'بانتظار الاستلام'
                  : 'مفتوح'}
              </span>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">م</th>
                  <th className="py-2.5 px-3">البيان والصنف</th>
                  <th className="py-2.5 px-3 w-28">الرمز (SKU)</th>
                  <th className="py-2.5 px-3 w-32">الكمية المسجلة</th>
                  <th className="py-2.5 px-3 w-36">المعادل بالأساسية</th>
                  <th className="py-2.5 px-3">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {displayRows.map((r) => (
                  <tr key={r.index} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-center text-slate-500">{r.index}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{r.itemName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{r.itemCode}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 font-mono">
                      {r.quantity} {r.unitName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono">
                      {r.baseQuantity} {r.baseUnitName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">{r.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Details & Notes */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">أمين المستودع المسؤول: </span>
              <strong className="text-slate-900">
                {warehouseManagerName} ({warehouseManagerPhone})
              </strong>
            </div>
            <div>
              <span className="text-slate-500">إجمالي الأصناف بالسند: </span>
              <strong className="text-slate-900">{displayRows.length} صنف</strong>
            </div>
            {voucherRecord.notes && (
              <div className="sm:col-span-2 pt-1 text-slate-600">
                <strong>ملاحظات السند:</strong> {voucherRecord.notes}
              </div>
            )}
          </div>

          {/* Signatures section - 3 columns */}
          <div className="grid grid-cols-3 gap-6 text-center pt-6 text-xs text-slate-700">
            <div>
              <div className="font-bold flex items-center justify-center gap-1 text-slate-800">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>أمين المستودع</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">{warehouseManagerName}</div>
              <div className="mt-8 border-t border-dashed border-slate-300 pt-2 text-[11px] text-slate-400">
                التوقيع والختم
              </div>
            </div>

            <div>
              <div className="font-bold flex items-center justify-center gap-1 text-slate-800">
                <Factory className="w-4 h-4 text-indigo-600" />
                <span>مسؤول قسم الإنتاج</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">المستلم / المسلّم للإنتاج</div>
              <div className="mt-8 border-t border-dashed border-slate-300 pt-2 text-[11px] text-slate-400">
                التوقيع والختم
              </div>
            </div>

            <div>
              <div className="font-bold flex items-center justify-center gap-1 text-slate-800">
                <ShieldCheck className="w-4 h-4 text-slate-700" />
                <span>اعتماد إدارة المصنع</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">إدارة مدهال الطيب</div>
              <div className="mt-8 border-t border-dashed border-slate-300 pt-2 text-[11px] text-slate-400">
                الختم والاعتماد الرسمي
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between no-print">
          <div className="flex items-center gap-2 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            <span>سند رسمي معتمد ومرحل في قيود المخزون السحابية</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
