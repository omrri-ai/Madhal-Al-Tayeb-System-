import React from 'react';
import { X, Printer, ArrowRight, Boxes, Download, FileText, CheckCircle2 } from 'lucide-react';
import { StockMovement, Item, Unit, Category } from '../../types/inventory';
import { useInventory } from '../../context/InventoryContext';

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
  const { movements, items, units, categories, companySettings } = useInventory();
  if (!isOpen || !movement || !item) return null;

  const isGenericTitle = (str?: string) => {
    if (!str) return true;
    const s = str.trim().toLowerCase();
    return (
      !s ||
      s === 'توريد مخزني' ||
      s === 'صرف مخزني' ||
      s === 'إذن صرف' ||
      s === 'إذن توريد' ||
      s === 'سند' ||
      s === 'فاتورة' ||
      s === '0' ||
      s === '1'
    );
  };

  const cleanRef = (movement.referenceNumber || '').trim().toLowerCase();
  const cleanBatch = (movement.batchId || '').trim().toLowerCase();

  const relatedMovements = movements.filter((m) => {
    if (m.type !== movement.type) return false;

    const mRef = (m.referenceNumber || '').trim().toLowerCase();
    const mBatch = (m.batchId || '').trim().toLowerCase();

    if (cleanBatch && mBatch === cleanBatch) return true;
    if (cleanRef && !isGenericTitle(movement.referenceNumber) && mRef === cleanRef) return true;

    return m.id === movement.id;
  });

  const voucherMovements = relatedMovements.length > 0 ? relatedMovements : [movement];

  const isEntry = movement.type === 'IN';
  const voucherTitle = isEntry ? 'سند توريد مخزني (إذن دخول رسمي)' : 'سند صرف مخزني (إذن خروج رسمي)';
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
    body { font-family: 'Tajawal', sans-serif; padding: 40px; color: #0f172a; margin: 0; background: #fff; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
    .company-title { font-size: 18px; font-weight: 900; margin: 0 0 4px 0; }
    .company-meta { font-size: 11px; color: #475569; line-height: 1.5; }
    .title { background: ${isEntry ? '#ecfdf5' : '#fff1f2'}; color: ${isEntry ? '#065f46' : '#9f1239'}; border: 1px solid ${isEntry ? '#a7f3d0' : '#fecdd3'}; text-align: center; padding: 12px; font-weight: bold; border-radius: 8px; font-size: 15px; margin-bottom: 20px; }
    .dest-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; text-align: right; }
    th { background: #f1f5f9; padding: 10px; font-size: 12px; border: 1px solid #cbd5e1; }
    td { padding: 10px; font-size: 12px; border: 1px solid #cbd5e1; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 24px; font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; margin-top: 40px; font-size: 12px; }
    .sig-line { border-top: 1px dashed #94a3b8; margin-top: 40px; padding-top: 6px; color: #64748b; font-size: 11px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h2 class="company-title">${companySettings.name}</h2>
      <div class="company-meta">
        ${[
          companySettings.commercialRegister ? `س.ت: ${companySettings.commercialRegister}` : '',
          companySettings.taxId ? `الرقم الضريبي: ${companySettings.taxId}` : ''
        ].filter(Boolean).join(' | ')}
        ${(companySettings.commercialRegister || companySettings.taxId) && (companySettings.address || companySettings.phone) ? '<br/>' : ''}
        ${[
          companySettings.address ? `العنوان: ${companySettings.address}` : '',
          companySettings.phone ? `الجوال: ${companySettings.phone}` : ''
        ].filter(Boolean).join(' | ')}
      </div>
    </div>
    <div style="text-align: left;">
      <div style="font-size: 11px; color: #64748b;">رقم السند</div>
      <div style="font-size: 18px; font-weight: 900;">#${invoiceNumber}</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${new Date(movement.date).toLocaleString('ar-SA')}</div>
    </div>
  </div>

  <div class="title">${voucherTitle}</div>

  ${
    isEntry
      ? `<div class="dest-card">
         <div><strong>المورد / الجهة الموردة:</strong> ${movement.supplierName || 'مورد عام'}</div>
         <div><strong>جوال المورد:</strong> ${movement.supplierPhone || 'غير متوفر'}</div>
         <div><strong>العنوان:</strong> ${movement.supplierAddress || 'غير متوفر'}</div>
         <div><strong>الرقم الضريبي:</strong> ${movement.supplierTaxId || 'غير متوفر'}</div>
       </div>`
      : movement.destinationType === 'BRANCH'
      ? `<div class="dest-card">
         <div><strong>نوع الوجهة:</strong> فرع تابع</div>
         <div><strong>اسم الفرع:</strong> ${movement.branchName || movement.destinationName || 'غير متوفر'}</div>
         <div><strong>اسم المسؤول / المستلم:</strong> ${movement.destinationContactName || movement.destinationName || 'غير متوفر'}</div>
         <div><strong>رقم جوال المسؤول:</strong> ${movement.destinationPhone || 'غير متوفر'}</div>
         <div><strong>المدينة:</strong> ${movement.destinationAddress || 'غير متوفر'}</div>
       </div>`
      : `<div class="dest-card">
         <div><strong>نوع الوجهة:</strong> شحن لعميل</div>
         <div><strong>اسم العميل:</strong> ${movement.customerName || movement.destinationName || 'غير متوفر'}</div>
         <div><strong>رقم الجوال:</strong> ${movement.destinationPhone || movement.customerPhone || 'غير متوفر'}</div>
         <div><strong>المدينة / العنوان:</strong> ${movement.destinationAddress || movement.customerCity || 'غير متوفر'}</div>
         <div><strong>شركة الشحن المحددة:</strong> ${
           movement.shippingCompany === 'SMSA'
             ? 'سمسا (SMSA)'
             : movement.shippingCompany === 'FASTLO'
             ? 'فاستلو (Fastlo)'
             : movement.shippingCompany === 'ARAMEX'
             ? 'أرامكس دولي (Aramex International)'
             : movement.customShippingCompany || movement.shippingCompany || 'أخرى'
         }</div>
       </div>`
  }

  <table>
    <thead>
      <tr>
        <th>م</th>
        <th>بيان الصنف</th>
        <th>الرمز (SKU)</th>
        <th>القسم</th>
        <th>الكمية المصروفة / الواردة</th>
        <th>المعادل بالوحدة الأساسية</th>
      </tr>
    </thead>
    <tbody>
      ${voucherMovements
        .map((m, idx) => {
          const itm = items.find((i) => i.id === m.itemId) || item;
          const itmName = itm?.name || m.itemName || (m.notes && m.notes.length < 30 ? m.notes : 'صنف مخزني');
          const itmCode = itm?.code || m.itemCode || '-';
          const unt = units.find((u) => u.id === m.unitId) || unit;
          const untName = unt?.name || m.unitName || 'وحدة';
          const bu = units.find((u) => u.id === itm?.baseUnitId) || baseUnit;
          const buName = bu?.name || 'وحدة';
          const cat = categories.find((c) => c.id === itm?.categoryId) || category;
          const catName = cat?.name || 'قسم عام';
          const qty = typeof m.quantity === 'number' && !isNaN(m.quantity) ? m.quantity : Number(m.quantity) || 0;
          const baseQty = typeof m.baseQuantity === 'number' && !isNaN(m.baseQuantity) ? m.baseQuantity : Number(m.baseQuantity) || qty;

          return `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>${itmName}</strong></td>
              <td>${itmCode}</td>
              <td>${catName}</td>
              <td><strong>${qty} ${untName}</strong></td>
              <td><strong>${baseQty} ${buName}</strong></td>
            </tr>
          `;
        })
        .join('')}
    </tbody>
  </table>

  <div class="info-box">
    <div><strong>حالة السند:</strong> <span style="color: #065f46; font-weight: bold;">معتمد ومرحل (${movement.status || 'APPROVED'})</span></div>
    <div><strong>أمين المستودع / المُصدر:</strong> ${movement.createdByName || companySettings.managerName || 'إدارة النظام'}</div>
    ${movement.referenceNumber ? `<div><strong>رقم المرجع الخارجي:</strong> #${movement.referenceNumber}</div>` : ''}
    ${movement.notes ? `<div style="grid-column: span 2;"><strong>ملاحظات:</strong> ${movement.notes}</div>` : ''}
  </div>

  <div class="signatures">
    <div>
      <div>أمين المستودع</div>
      <div class="sig-line">التوقيع: .....................</div>
    </div>
    <div>
      <div>المستلم / مسؤول الفرع</div>
      <div style="font-weight: bold; margin-top: 4px; color: #1e293b;">${isEntry ? (movement.supplierName || 'المورد') : (movement.destinationContactName || movement.destinationName || 'المستلم')}</div>
      <div class="sig-line">التوقيع والختم: .....................</div>
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
    link.download = `سند_${invoiceNumber}_${item.name}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 sm:p-8 my-8 text-right flex flex-col max-h-[95vh] overflow-y-auto">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 no-print">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع</span>
            </button>
            <span className="text-xs text-slate-500 font-medium">معاينة السند الرسمي المعتمد</span>
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
          {/* Company Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5 mb-6">
            <div>
              <h2 className="text-xl font-black text-slate-900 mb-1">{companySettings.name}</h2>
              <div className="text-xs text-slate-600 space-y-0.5">
                {(companySettings.commercialRegister || companySettings.taxId) && (
                  <p>
                    {companySettings.commercialRegister && <>سجل تجاري: <span className="font-mono">{companySettings.commercialRegister}</span></>}
                    {companySettings.commercialRegister && companySettings.taxId && ' | '}
                    {companySettings.taxId && <>الرقم الضريبي: <span className="font-mono">{companySettings.taxId}</span></>}
                  </p>
                )}
                {(companySettings.address || companySettings.phone) && (
                  <p>
                    {companySettings.address && <>العنوان: {companySettings.address}</>}
                    {companySettings.address && companySettings.phone && ' | '}
                    {companySettings.phone && <>الجوال: <span className="font-mono">{companySettings.phone}</span></>}
                  </p>
                )}
              </div>
            </div>

            <div className="text-left font-mono">
              <div className="text-xs text-slate-500">رقم السند</div>
              <div className="text-xl font-black text-slate-900">#{invoiceNumber}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {new Date(movement.date).toLocaleDateString('ar-SA')} ·{' '}
                {new Date(movement.date).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Voucher Title */}
          <div
            className={`p-3.5 rounded-xl mb-6 text-center font-bold text-sm flex items-center justify-center gap-2 ${
              isEntry
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{voucherTitle}</span>
          </div>

          {/* Destination / Supplier Details Card */}
          {isEntry ? (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500 block mb-0.5">المورد / الجهة الموردة:</span>
                <span className="font-bold text-slate-900 text-sm">{movement.supplierName || 'مورد عام'}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">رقم جوال المورد:</span>
                <span className="font-bold font-mono text-slate-900">{movement.supplierPhone || 'غير متوفر'}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">عنوان المورد:</span>
                <span className="font-medium text-slate-800">{movement.supplierAddress || 'غير متوفر'}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">الرقم الضريبي للمورد:</span>
                <span className="font-mono font-medium text-slate-800">{movement.supplierTaxId || 'غير متوفر'}</span>
              </div>
            </div>
          ) : movement.destinationType === 'BRANCH' ? (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block mb-0.5">نوع الوجهة:</span>
                <span className="font-bold text-slate-900">فرع تابع</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">اسم الفرع:</span>
                <span className="font-bold text-slate-900 text-sm">{movement.branchName || movement.destinationName || 'غير متوفر'}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">اسم المسؤول / المستلم:</span>
                <span className="font-bold text-slate-900">{movement.destinationContactName || movement.destinationName || 'غير متوفر'}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">رقم جوال المسؤول:</span>
                <span className="font-bold font-mono text-slate-900">{movement.destinationPhone || 'غير متوفر'}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">المدينة:</span>
                <span className="font-medium text-slate-800">{movement.destinationAddress || 'غير متوفر'}</span>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block mb-0.5">نوع الوجهة:</span>
                <span className="font-bold text-slate-900">شحن لعميل</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">اسم العميل:</span>
                <span className="font-bold text-slate-900 text-sm">{movement.customerName || movement.destinationName || 'غير متوفر'}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">رقم الجوال:</span>
                <span className="font-bold font-mono text-slate-900">{movement.destinationPhone || movement.customerPhone || 'غير متوفر'}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">المدينة / العنوان:</span>
                <span className="font-medium text-slate-800">{movement.destinationAddress || movement.customerCity || 'غير متوفر'}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">شركة الشحن المحددة:</span>
                <span className="font-bold text-emerald-800">
                  {movement.shippingCompany === 'SMSA'
                    ? 'سمسا (SMSA)'
                    : movement.shippingCompany === 'FASTLO'
                    ? 'فاستلو (Fastlo)'
                    : movement.shippingCompany === 'ARAMEX'
                    ? 'أرامكس دولي (Aramex International)'
                    : movement.customShippingCompany || movement.shippingCompany || 'أخرى'}
                </span>
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mb-6 text-xs">
            <table className="w-full text-right">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">م</th>
                  <th className="py-2.5 px-3">بيان الصنف</th>
                  <th className="py-2.5 px-3">الرمز (SKU)</th>
                  <th className="py-2.5 px-3">القسم</th>
                  <th className="py-2.5 px-3">الكمية</th>
                  <th className="py-2.5 px-3">المعادل بالأساسية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {voucherMovements.map((m, idx) => {
                  const itm = items.find((i) => i.id === m.itemId) || item;
                  const itmName = itm?.name || m.itemName || (m.notes && m.notes.length < 30 ? m.notes : 'صنف مخزني');
                  const itmCode = itm?.code || m.itemCode || '-';
                  const unt = units.find((u) => u.id === m.unitId) || unit;
                  const untName = unt?.name || m.unitName || 'وحدة';
                  const bu = units.find((u) => u.id === itm?.baseUnitId) || baseUnit;
                  const buName = bu?.name || 'وحدة';
                  const cat = categories.find((c) => c.id === itm?.categoryId) || category;
                  const catName = cat?.name || 'قسم عام';
                  const qty = typeof m.quantity === 'number' && !isNaN(m.quantity) ? m.quantity : Number(m.quantity) || 0;
                  const baseQty = typeof m.baseQuantity === 'number' && !isNaN(m.baseQuantity) ? m.baseQuantity : Number(m.baseQuantity) || qty;

                  return (
                    <tr key={m.id || idx}>
                      <td className="py-3 px-3 text-center font-mono">{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{itmName}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{itmCode}</td>
                      <td className="py-3 px-3 text-slate-600">{catName}</td>
                      <td className="py-3 px-3 font-bold text-slate-900 font-mono">
                        {qty} {untName}
                      </td>
                      <td className="py-3 px-3 font-bold font-mono text-slate-800">
                        {baseQty} {buName}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Additional Info Box */}
          <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">حالة السند:</span>
              <span className="font-bold text-emerald-700">معتمد ومرحل ({movement.status || 'APPROVED'})</span>
            </div>
            <div>
              <span className="text-slate-500 block">أمين المستودع / المُصدر:</span>
              <span className="font-bold text-slate-900">{movement.createdByName || companySettings.managerName || 'إدارة النظام'}</span>
            </div>
            {movement.referenceNumber && (
              <div>
                <span className="text-slate-500 block">المرجع الخارجي / رقم الإذن:</span>
                <span className="font-bold font-mono text-slate-900">{movement.referenceNumber}</span>
              </div>
            )}
            {movement.notes && (
              <div className="col-span-2 pt-2 border-t border-slate-200">
                <span className="text-slate-500 block mb-1">ملاحظات وبيان الحركة:</span>
                <span className="font-medium text-slate-800 leading-relaxed">{movement.notes}</span>
              </div>
            )}
          </div>

          {/* Signatures Section */}
          <div className="grid grid-cols-3 gap-4 pt-8 mt-6 border-t-2 border-slate-800 text-center text-xs">
            <div>
              <span className="text-slate-600 block mb-1 font-bold">أمين المستودع</span>
              <div className="text-slate-900 font-medium mb-8">{companySettings.managerName}</div>
              <div className="border-t border-dashed border-slate-400 pt-1 text-slate-400 text-[11px]">
                التوقيع: .....................
              </div>
            </div>
            <div>
              <span className="text-slate-600 block mb-1 font-bold">المستلم / مسؤول الفرع</span>
              <div className="text-slate-900 font-bold mb-8">
                {isEntry ? (movement.supplierName || 'المورد') : (movement.destinationContactName || movement.destinationName || 'المستلم')}
              </div>
              <div className="border-t border-dashed border-slate-400 pt-1 text-slate-400 text-[11px]">
                التوقيع والختم: .....................
              </div>
            </div>
            <div>
              <span className="text-slate-600 block mb-1 font-bold">اعتماد الإدارة</span>
              <div className="text-slate-900 font-medium mb-8">{companySettings.name}</div>
              <div className="border-t border-dashed border-slate-400 pt-1 text-slate-400 text-[11px]">
                الختم والاعتماد
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
