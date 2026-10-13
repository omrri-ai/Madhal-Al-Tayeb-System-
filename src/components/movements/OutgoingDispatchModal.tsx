import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Truck,
  Building2,
  Users,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Printer,
  Download,
  Package,
  Save,
  MapPin,
  Phone,
  User,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { ShippingCarrier, StockMovement } from '../../types/inventory';
import { playNotificationSound } from '../../services/sound';

interface OutgoingDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDispatchComplete?: (voucherNo: string, movements: StockMovement[]) => void;
}

interface DispatchRowItem {
  id: string;
  itemId: string;
  unitId: string;
  quantity: string;
  notes: string;
}

export const OutgoingDispatchModal: React.FC<OutgoingDispatchModalProps> = ({
  isOpen,
  onClose,
  onDispatchComplete,
}) => {
  const {
    items,
    units,
    categories,
    branches,
    companySettings,
    getItemStock,
    addMultiItemDispatch,
    showToast,
  } = useInventory();

  const activeItems = useMemo(
    () => items.filter((i) => !i.isDeleted && !i.isArchived),
    [items]
  );

  // Destination mode: 'BRANCH' | 'CUSTOMER'
  const [destinationType, setDestinationType] = useState<'BRANCH' | 'CUSTOMER'>('BRANCH');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Customer direct manual entry inside dispatch window (no pre-existing customer needed, no taxId)
  const [directCustomerName, setDirectCustomerName] = useState('');
  const [directCustomerPhone, setDirectCustomerPhone] = useState('');
  const [directCustomerCity, setDirectCustomerCity] = useState('');

  // Shipping company selection: SMSA, FASTLO, ARAMEX, OTHER
  const [shippingCompany, setShippingCompany] = useState<ShippingCarrier>('SMSA');
  const [customShippingCompany, setCustomShippingCompany] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  // Voucher metadata
  const [voucherDate, setVoucherDate] = useState<string>(new Date().toISOString().substring(0, 16));
  const [voucherReference, setVoucherReference] = useState<string>('');
  const [generalNotes, setGeneralNotes] = useState<string>('');

  // Multi-item rows
  const [rows, setRows] = useState<DispatchRowItem[]>([]);
  const [formError, setFormError] = useState<string>('');

  // Created voucher for instant print/download modal
  const [createdVoucherNo, setCreatedVoucherNo] = useState<string | null>(null);
  const [createdMovements, setCreatedMovements] = useState<StockMovement[] | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDestinationType('BRANCH');
      if (branches.length > 0) {
        setSelectedBranchId(branches[0].id);
      } else {
        setSelectedBranchId('');
      }
      setDirectCustomerName('');
      setDirectCustomerPhone('');
      setDirectCustomerCity('');
      setShippingCompany('SMSA');
      setCustomShippingCompany('');
      setTrackingNumber('');
      setVoucherDate(new Date().toISOString().substring(0, 16));
      setVoucherReference(`DSP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setGeneralNotes('');
      setFormError('');
      setCreatedVoucherNo(null);
      setCreatedMovements(null);

      if (activeItems.length > 0) {
        const firstItem = activeItems[0];
        setRows([
          {
            id: 'row_' + Date.now(),
            itemId: firstItem.id,
            unitId: firstItem.baseUnitId,
            quantity: '1',
            notes: '',
          },
        ]);
      } else {
        setRows([]);
      }
    }
  }, [isOpen, activeItems, branches]);

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId),
    [branches, selectedBranchId]
  );

  const getCarrierLabel = (carrier: ShippingCarrier, customName?: string) => {
    switch (carrier) {
      case 'SMSA':
        return 'سمسا (SMSA)';
      case 'FASTLO':
        return 'فاستلو (Fastlo)';
      case 'ARAMEX':
        return 'أرامكس دولي (Aramex International)';
      case 'OTHER':
        return customName?.trim() ? `أخرى (${customName.trim()})` : 'أخرى';
      default:
        return 'سمسا (SMSA)';
    }
  };

  const handleAddRow = () => {
    if (activeItems.length === 0) return;
    const defaultItem = activeItems[0];
    setRows((prev) => [
      ...prev,
      {
        id: 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        itemId: defaultItem.id,
        unitId: defaultItem.baseUnitId,
        quantity: '1',
        notes: '',
      },
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const handleItemChange = (rowId: string, newItemId: string) => {
    const item = activeItems.find((i) => i.id === newItemId);
    if (!item) return;
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              itemId: newItemId,
              unitId: item.baseUnitId,
            }
          : r
      )
    );
  };

  const itemTotalRequestedBase = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const r of rows) {
      const itm = activeItems.find((i) => i.id === r.itemId);
      if (!itm) continue;
      let factor = 1;
      if (r.unitId !== itm.baseUnitId) {
        const conv = itm.conversions.find((c) => c.unitId === r.unitId);
        factor = conv ? conv.factorToBase : 1;
      }
      const numQty = parseFloat(r.quantity) || 0;
      const baseQty = Math.round(numQty * factor * 1000) / 1000;
      totals[itm.id] = Math.round(((totals[itm.id] || 0) + baseQty) * 1000) / 1000;
    }
    return totals;
  }, [rows, activeItems]);

  const rowValidations = useMemo(() => {
    return rows.map((row) => {
      const item = activeItems.find((i) => i.id === row.itemId);
      if (!item) return { isValid: false, error: 'صنف غير معروف', factor: 1, baseQty: 0, currentStock: 0 };

      const baseUnit = units.find((u) => u.id === item.baseUnitId);
      const chosenUnit = units.find((u) => u.id === row.unitId) || baseUnit;
      const category = categories.find((c) => c.id === item.categoryId);

      let factor = 1;
      if (row.unitId !== item.baseUnitId) {
        const conv = item.conversions.find((c) => c.unitId === row.unitId);
        factor = conv ? conv.factorToBase : 1;
      }

      const numQty = parseFloat(row.quantity) || 0;
      const baseQty = Math.round(numQty * factor * 1000) / 1000;
      const currentStock = getItemStock(item.id);
      const totalRequestedForThisItem = itemTotalRequestedBase[item.id] || baseQty;
      const isExceeded = numQty > 0 && (totalRequestedForThisItem > currentStock || currentStock <= 0);

      return {
        item,
        category,
        baseUnit,
        chosenUnit,
        factor,
        numQty,
        baseQty,
        totalRequestedForThisItem,
        currentStock,
        isExceeded,
        isValid: numQty > 0 && !isExceeded,
      };
    });
  }, [rows, activeItems, units, categories, getItemStock, itemTotalRequestedBase]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (rows.length === 0) {
      const err = 'يرجى إضافة صنف واحد على الأقل في سند الصرف.';
      setFormError(err);
      showToast(err, 'error');
      playNotificationSound('alert');
      return;
    }

    if (destinationType === 'BRANCH') {
      if (!selectedBranchId) {
        const err = 'يرجى تحديد الفرع المستلم قبل الحفظ.';
        setFormError(err);
        showToast(err, 'error');
        playNotificationSound('alert');
        return;
      }
    } else {
      if (!directCustomerName.trim()) {
        const err = 'يرجى إدخال اسم العميل المستلم للشحنة.';
        setFormError(err);
        showToast(err, 'error');
        playNotificationSound('alert');
        return;
      }
      if (shippingCompany === 'OTHER' && !customShippingCompany.trim()) {
        const err = 'يرجى كتابة اسم شركة الشحن عند اختيار "أخرى".';
        setFormError(err);
        showToast(err, 'error');
        playNotificationSound('alert');
        return;
      }
    }

    for (let i = 0; i < rowValidations.length; i++) {
      const val = rowValidations[i];
      if (!val.numQty || val.numQty <= 0) {
        const err = `يرجى تحديد كمية صحيحة أكبر من الصفر للصنف رقم ${i + 1} (${val.item?.name}).`;
        setFormError(err);
        showToast(err, 'error');
        playNotificationSound('alert');
        return;
      }
      if (val.isExceeded) {
        const err = `الرصيد غير متوفر للصنف "${val.item?.name}": إجمالي الكمية المطلوبة (${val.totalRequestedForThisItem} ${val.baseUnit?.name}) تتجاوز الرصيد المتوفر (${val.currentStock} ${val.baseUnit?.name}).`;
        setFormError(err);
        showToast(err, 'error');
        playNotificationSound('alert');
        return;
      }
    }

    const branch = destinationType === 'BRANCH' ? branches.find((b) => b.id === selectedBranchId) : undefined;
    const branchManagerName = branch?.branchManagerName || branch?.managerName || branch?.name || '';
    const branchManagerPhone = branch?.branchManagerPhone || branch?.phone || '';
    const branchCity = branch?.city || branch?.address || '';

    const result = addMultiItemDispatch({
      destinationType,
      branchId: destinationType === 'BRANCH' ? selectedBranchId : undefined,
      branchName: destinationType === 'BRANCH' ? branch?.name : undefined,
      destinationContactName: destinationType === 'BRANCH' ? branchManagerName : directCustomerName.trim(),
      destinationPhone: destinationType === 'BRANCH' ? branchManagerPhone : directCustomerPhone.trim(),
      destinationAddress: destinationType === 'BRANCH' ? branchCity : directCustomerCity.trim(),
      customerName: destinationType === 'CUSTOMER' ? directCustomerName.trim() : undefined,
      customerPhone: destinationType === 'CUSTOMER' ? directCustomerPhone.trim() : undefined,
      customerCity: destinationType === 'CUSTOMER' ? directCustomerCity.trim() : undefined,
      shippingCompany: destinationType === 'CUSTOMER' ? shippingCompany : undefined,
      customShippingCompany: destinationType === 'CUSTOMER' && shippingCompany === 'OTHER' ? customShippingCompany.trim() : undefined,
      shippingTrackingNumber: destinationType === 'CUSTOMER' ? trackingNumber.trim() : undefined,
      referenceNumber: voucherReference.trim(),
      notes: generalNotes.trim(),
      date: voucherDate || new Date().toISOString(),
      items: rows
        .filter((r) => r.itemId && parseFloat(r.quantity) > 0)
        .map((r) => ({
          itemId: r.itemId,
          unitId: r.unitId,
          quantity: parseFloat(r.quantity) || 0,
          notes: r.notes.trim() || undefined,
        })),
    });

    if (result.success && result.voucherNumber) {
      playNotificationSound('success');
      setCreatedVoucherNo(result.voucherNumber);
      setCreatedMovements(result.movements || []);
      if (onDispatchComplete && result.movements) {
        onDispatchComplete(result.voucherNumber, result.movements);
      }
    } else {
      setFormError(result.error || 'حدث خطأ أثناء حفظ سند الصرف.');
    }
  };

  if (!isOpen) return null;

  // If voucher created, show printable modal view
  if (createdVoucherNo && createdMovements && createdMovements.length > 0) {
    const firstMov = createdMovements[0];
    const isBranch = firstMov.destinationType === 'BRANCH';
    const branchName = firstMov.branchName || firstMov.destinationName || selectedBranch?.name || '-';
    const branchManager = firstMov.destinationContactName || selectedBranch?.branchManagerName || selectedBranch?.managerName || selectedBranch?.name || '-';
    const branchPhone = firstMov.destinationPhone || selectedBranch?.branchManagerPhone || selectedBranch?.phone || 'غير متوفر';
    const branchCity = firstMov.destinationAddress || selectedBranch?.city || selectedBranch?.address || 'غير متوفر';

    const custName = firstMov.customerName || firstMov.destinationName || directCustomerName.trim() || '-';
    const custPhone = firstMov.customerPhone || firstMov.destinationPhone || directCustomerPhone.trim() || 'غير متوفر';
    const custCity = firstMov.customerCity || firstMov.destinationAddress || directCustomerCity.trim() || 'غير متوفر';
    const carrierName = getCarrierLabel(
      (firstMov.shippingCompany || shippingCompany) as ShippingCarrier,
      firstMov.customShippingCompany || customShippingCompany
    );

    const handlePrint = () => window.print();
    const handleDownloadHTML = () => {
      const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>سند صرف مخزني رسمي - #${createdVoucherNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
    body { font-family: 'Tajawal', sans-serif; padding: 40px; color: #0f172a; margin: 0; background: #fff; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
    .company-title { font-size: 18px; font-weight: 900; margin: 0 0 4px 0; }
    .company-meta { font-size: 11px; color: #475569; line-height: 1.5; }
    .title { background: #fff1f2; color: #9f1239; border: 1px solid #fecdd3; text-align: center; padding: 12px; font-weight: bold; border-radius: 8px; font-size: 15px; margin-bottom: 20px; }
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
        س.ت: ${companySettings.commercialRegister} | الرقم الضريبي: ${companySettings.taxId}<br/>
        العنوان: ${companySettings.address} | الجوال: ${companySettings.phone}
      </div>
    </div>
    <div style="text-align: left;">
      <div style="font-size: 11px; color: #64748b;">رقم السند</div>
      <div style="font-size: 18px; font-weight: 900;">#${createdVoucherNo}</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${new Date(firstMov.date).toLocaleString('ar-SA')}</div>
    </div>
  </div>

  <div class="title">سند صرف مخزني رسمي (إذن خروج متعدد الأصناف)</div>

  <div class="dest-card">
    ${
      isBranch
        ? `<div><strong>نوع الوجهة:</strong> فرع تابع</div>
           <div><strong>اسم الفرع:</strong> ${branchName}</div>
           <div><strong>اسم المسؤول / المستلم:</strong> ${branchManager}</div>
           <div><strong>رقم جوال المسؤول:</strong> ${branchPhone}</div>
           <div><strong>المدينة:</strong> ${branchCity}</div>`
        : `<div><strong>نوع الوجهة:</strong> شحن لعميل</div>
           <div><strong>اسم العميل:</strong> ${custName}</div>
           <div><strong>رقم الجوال:</strong> ${custPhone}</div>
           <div><strong>المدينة / العنوان:</strong> ${custCity}</div>
           <div><strong>شركة الشحن المحددة:</strong> ${carrierName}</div>`
    }
  </div>

  <table>
    <thead>
      <tr>
        <th>م</th>
        <th>بيان الصنف</th>
        <th>الرمز (SKU)</th>
        <th>الكمية المصروفة</th>
        <th>المعادل بالوحدة الأساسية</th>
      </tr>
    </thead>
    <tbody>
      ${createdMovements
        .map((m, idx) => {
          const itm = items.find((i) => i.id === m.itemId);
          const u = units.find((un) => un.id === m.unitId);
          const bu = units.find((un) => un.id === itm?.baseUnitId);
          return `<tr>
            <td>${idx + 1}</td>
            <td><strong>${itm?.name || ''}</strong></td>
            <td>${itm?.code || ''}</td>
            <td><strong>${m.quantity} ${u?.name || ''}</strong></td>
            <td><strong>${m.baseQuantity} ${bu?.name || ''}</strong></td>
          </tr>`;
        })
        .join('')}
    </tbody>
  </table>

  <div class="info-box">
    <div><strong>إجمالي عدد البنود:</strong> ${createdMovements.length} أصناف</div>
    <div><strong>حالة السند:</strong> معتمد ومرحل (APPROVED)</div>
    <div><strong>أمين المستودع:</strong> ${companySettings.managerName}</div>
    ${generalNotes ? `<div style="grid-column: span 2;"><strong>ملاحظات:</strong> ${generalNotes}</div>` : ''}
  </div>

  <div class="signatures">
    <div>
      <div>أمين المستودع</div>
      <div class="sig-line">التوقيع: .....................</div>
    </div>
    <div>
      <div>المستلم / مسؤول الفرع</div>
      <div style="font-weight: bold; margin-top: 4px; color: #1e293b;">
        ${isBranch ? branchManager : custName}
      </div>
      <div class="sig-line">التوقيع والختم: .....................</div>
    </div>
    <div>
      <div>اعتماد الإدارة</div>
      <div class="sig-line">الختم والاعتماد</div>
    </div>
  </div>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `سند_صرف_${createdVoucherNo}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 sm:p-8 text-right flex flex-col max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <h3 className="text-base font-black text-slate-900">
                تم إصدار وحفظ سند الصرف بنجاح (رقم: #{createdVoucherNo})
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadHTML}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>تنزيل السند</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>طباعة السند</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 border-2 border-slate-200 rounded-2xl bg-white space-y-4 text-xs">
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <h4 className="text-base font-black text-slate-900">{companySettings.name}</h4>
                <p className="text-slate-500">
                  س.ت: {companySettings.commercialRegister} | الرقم الضريبي: {companySettings.taxId}
                </p>
              </div>
              <div className="text-left font-mono">
                <div className="text-slate-500">رقم السند</div>
                <div className="text-lg font-black">#{createdVoucherNo}</div>
              </div>
            </div>

            {/* Destination Preview Card */}
            {isBranch ? (
              <div className="p-3.5 bg-slate-50 rounded-xl grid grid-cols-2 sm:grid-cols-3 gap-3 border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[11px]">نوع الوجهة:</span>
                  <span className="font-bold text-slate-900">فرع تابع</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">اسم الفرع:</span>
                  <span className="font-bold text-slate-900">{branchName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">اسم المسؤول / المستلم:</span>
                  <span className="font-bold text-slate-900">{branchManager}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">رقم جوال المسؤول:</span>
                  <span className="font-bold font-mono text-slate-900">{branchPhone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">المدينة:</span>
                  <span className="font-medium text-slate-800">{branchCity}</span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 rounded-xl grid grid-cols-2 sm:grid-cols-3 gap-3 border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[11px]">نوع الوجهة:</span>
                  <span className="font-bold text-slate-900">شحن لعميل</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">اسم العميل:</span>
                  <span className="font-bold text-slate-900">{custName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">رقم الجوال:</span>
                  <span className="font-bold font-mono text-slate-900">{custPhone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">المدينة / العنوان:</span>
                  <span className="font-medium text-slate-800">{custCity}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">شركة الشحن المحددة:</span>
                  <span className="font-bold text-emerald-800">{carrierName}</span>
                </div>
              </div>
            )}

            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-slate-100 font-bold border-b">
                  <tr>
                    <th className="p-2.5">م</th>
                    <th className="p-2.5">الصنف</th>
                    <th className="p-2.5">الكمية</th>
                    <th className="p-2.5">المعادل بالأساسية</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {createdMovements.map((m, idx) => {
                    const itm = items.find((i) => i.id === m.itemId);
                    const u = units.find((un) => un.id === m.unitId);
                    const bu = units.find((un) => un.id === itm?.baseUnitId);
                    return (
                      <tr key={m.id}>
                        <td className="p-2.5 font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-bold">{itm?.name}</td>
                        <td className="p-2.5 font-mono">{m.quantity} {u?.name}</td>
                        <td className="p-2.5 font-mono font-bold">{m.baseQuantity} {bu?.name}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer"
              >
                إتمام وإغلاق
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 my-8 text-right flex flex-col max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">سند صرف مخزني رسمي (إذن خروج متعدد الأصناف)</h3>
              <p className="text-xs text-slate-500">اختر وجهة الصرف (فرع أو عميل) وحدد الأصناف والكميات المطلوبة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          {/* Destination Selector Section */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-600" />
              <span>1. تحديد جهة الصرف المستلمة (إلزامي):</span>
            </h4>

            {/* Destination Type Toggle */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDestinationType('BRANCH')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                  destinationType === 'BRANCH'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>صرف إلى فرع تابع</span>
              </button>

              <button
                type="button"
                onClick={() => setDestinationType('CUSTOMER')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                  destinationType === 'CUSTOMER'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>صرف إلى عميل</span>
              </button>
            </div>

            {/* Branch Selection Details */}
            {destinationType === 'BRANCH' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">اختر الفرع المستلم *</label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-emerald-500"
                  >
                    {branches.length === 0 ? (
                      <option value="">لا توجد فروع مسجلة، يرجى إضافتها من شاشة إدارة الفروع</option>
                    ) : (
                      branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.city ? `(${b.city})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {selectedBranch ? (
                  <div className="p-4 bg-white rounded-xl border border-emerald-200 shadow-2xs space-y-2">
                    <div className="text-[11px] font-bold text-emerald-800 mb-1">
                      معاينة بيانات الفرع المسحوبة تلقائياً:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">اسم الفرع:</span>
                        <span className="font-bold text-slate-900">{selectedBranch.name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">اسم مسؤول الفرع:</span>
                        <span className="font-bold text-slate-800">
                          {selectedBranch.branchManagerName || selectedBranch.managerName || 'غير محدد'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">رقم جوال المسؤول:</span>
                        <span className="font-bold font-mono text-slate-800">
                          {selectedBranch.branchManagerPhone || selectedBranch.phone || 'غير محدد'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">المدينة:</span>
                        <span className="font-medium text-slate-800">
                          {selectedBranch.city || selectedBranch.address || 'غير محدد'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  branches.length === 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs">
                      لا يوجد فروع مضافة حالياً. يمكنك الذهاب إلى شاشة "إدارة الفروع" لإضافة فرع أولاً، أو التبديل إلى "صرف إلى عميل".
                    </div>
                  )
                )}
              </div>
            )}

            {/* Customer Direct Entry Details */}
            {destinationType === 'CUSTOMER' && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      اسم العميل <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="الاسم الكامل للعميل المستلم"
                      value={directCustomerName}
                      onChange={(e) => setDirectCustomerName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">رقم الجوال</label>
                    <input
                      type="text"
                      placeholder="05XXXXXXXX"
                      value={directCustomerPhone}
                      onChange={(e) => setDirectCustomerPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">المدينة / العنوان</label>
                    <input
                      type="text"
                      placeholder="مثال: الرياض / حي العليا"
                      value={directCustomerCity}
                      onChange={(e) => setDirectCustomerCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      شركة الشحن المعتمدة <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={shippingCompany}
                      onChange={(e) => setShippingCompany(e.target.value as ShippingCarrier)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="SMSA">سمسا (SMSA)</option>
                      <option value="FASTLO">فاستلو (Fastlo)</option>
                      <option value="ARAMEX">أرامكس دولي (Aramex International)</option>
                      <option value="OTHER">أخرى</option>
                    </select>
                  </div>

                  {shippingCompany === 'OTHER' ? (
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        اسم شركة الشحن <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="اكتب اسم شركة الشحن هنا..."
                        value={customShippingCompany}
                        onChange={(e) => setCustomShippingCompany(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        رقم البوليصة / الشحنة (اختياري)
                      </label>
                      <input
                        type="text"
                        placeholder="رقم البوليصة أو التتبع إن وجد..."
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>

                {shippingCompany === 'OTHER' && (
                  <div className="w-full sm:w-1/2">
                    <label className="block text-slate-700 font-bold mb-1">
                      رقم البوليصة / الشحنة (اختياري)
                    </label>
                    <input
                      type="text"
                      placeholder="رقم البوليصة أو التتبع إن وجد..."
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items Table Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-600" />
                <span>2. أصناف سند الصرف المخزني:</span>
              </h4>
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>إضافة صنف آخر</span>
              </button>
            </div>

            <div className="space-y-3">
              {rows.map((row, index) => {
                const val = rowValidations[index];
                return (
                  <div
                    key={row.id}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-700 text-xs bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-mono">
                        بند #{index + 1}
                      </span>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="حذف البند"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-5">
                        <label className="block text-slate-600 font-medium mb-1">الصنف:</label>
                        <select
                          value={row.itemId}
                          onChange={(e) => handleItemChange(row.id, e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium focus:border-emerald-500"
                        >
                          {activeItems.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} (رمز: {i.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-slate-600 font-medium mb-1">الوحدة:</label>
                        <select
                          value={row.unitId}
                          onChange={(e) => {
                            const valId = e.target.value;
                            setRows((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, unitId: valId } : r))
                            );
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium focus:border-emerald-500"
                        >
                          {val?.item && (
                            <>
                              <option value={val.item.baseUnitId}>
                                {units.find((u) => u.id === val.item.baseUnitId)?.name || 'وحدة أساسية'} (أساسية)
                              </option>
                              {val.item.conversions.map((conv) => {
                                const uName = units.find((u) => u.id === conv.unitId)?.name || conv.unitId;
                                return (
                                  <option key={conv.unitId} value={conv.unitId}>
                                    {uName} (معامل: {conv.factorToBase})
                                  </option>
                                );
                              })}
                            </>
                          )}
                        </select>
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-slate-600 font-medium mb-1">الكمية المطلوبة:</label>
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          value={row.quantity}
                          onChange={(e) => {
                            const valQty = e.target.value;
                            setRows((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, quantity: valQty } : r))
                            );
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold font-mono focus:border-emerald-500"
                          placeholder="الكمية..."
                        />
                      </div>
                    </div>

                    {val && (
                      <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                        <span>
                          الرصيد المتوفر: <strong className="font-mono text-slate-800">{val.currentStock} {val.baseUnit?.name}</strong>
                        </span>
                        {val.isExceeded ? (
                          <span className="text-rose-600 font-bold">عفواً، الكمية المطلوبة تتجاوز الرصيد المتوفر!</span>
                        ) : (
                          <span className="text-emerald-700 font-medium">الكمية معادلها: {val.baseQty} {val.baseUnit?.name}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reference & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-slate-700 font-bold mb-1">رقم المرجع / رقم الإذن (اختياري)</label>
              <input
                type="text"
                value={voucherReference}
                onChange={(e) => setVoucherReference(e.target.value)}
                placeholder="DSP-2026-XXXX"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">ملاحظات عامة على السند (اختياري)</label>
              <input
                type="text"
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="شروط التسليم، رقم وسيلة النقل..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors shadow-md cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>حفظ واعتماد سند الصرف</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
