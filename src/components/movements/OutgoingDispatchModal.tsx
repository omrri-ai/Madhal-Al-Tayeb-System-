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
  Calendar,
  FileText,
  Package,
  Layers,
  ArrowRight,
  Edit2,
  Save,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { Branch, Customer, Item, ShippingCarrier, StockMovement } from '../../types/inventory';
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
    customers,
    companySettings,
    addBranch,
    updateBranch,
    addCustomer,
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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Quick Add Customer Modal inside Dispatch
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustTaxId, setNewCustTaxId] = useState('');

  // Shipping details for customer
  const [shippingCompany, setShippingCompany] = useState<ShippingCarrier>('SMSA');
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
      }
      if (customers.length > 0) {
        setSelectedCustomerId(customers[0].id);
      } else {
        setSelectedCustomerId('');
      }
      setShowAddCustomerModal(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
      setNewCustTaxId('');
      setShippingCompany('SMSA');
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
  }, [isOpen, activeItems, branches, customers]);

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

  const handleQuickAddCustomer = () => {
    if (!newCustName.trim()) {
      showToast('يرجى إدخال اسم العميل', 'error');
      return;
    }
    const res = addCustomer({
      name: newCustName.trim(),
      phone: newCustPhone.trim() || undefined,
      address: newCustAddress.trim() || undefined,
      taxId: newCustTaxId.trim() || undefined,
    });
    if (res.success && res.customer) {
      setSelectedCustomerId(res.customer.id);
      setShowAddCustomerModal(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
      setNewCustTaxId('');
      showToast(`تمت إضافة العميل بنجاح: ${res.customer.name}`, 'success');
    } else {
      showToast(res.error || 'خطأ أثناء إضافة العميل', 'error');
    }
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

    if (destinationType === 'BRANCH' && !selectedBranchId) {
      const err = 'يرجى تحديد الفرع المستلم قبل الحفظ.';
      setFormError(err);
      showToast(err, 'error');
      playNotificationSound('alert');
      return;
    }

    if (destinationType === 'CUSTOMER' && !selectedCustomerId) {
      const err = 'يرجى تحديد العميل المستلم للشحنة قبل الحفظ أو إضافة عميل جديد.';
      setFormError(err);
      showToast(err, 'error');
      playNotificationSound('alert');
      return;
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

    const branch = branches.find((b) => b.id === selectedBranchId);
    const customer = customers.find((c) => c.id === selectedCustomerId);

    const result = addMultiItemDispatch({
      destinationType,
      branchId: destinationType === 'BRANCH' ? selectedBranchId : undefined,
      branchName: destinationType === 'BRANCH' ? branch?.name : undefined,
      customerName: destinationType === 'CUSTOMER' ? customer?.name : undefined,
      customerPhone: destinationType === 'CUSTOMER' ? customer?.phone : undefined,
      customerCity: destinationType === 'CUSTOMER' ? customer?.address : undefined,
      shippingCompany: destinationType === 'CUSTOMER' ? shippingCompany : undefined,
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

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // If voucher created, show printable modal view
  if (createdVoucherNo && createdMovements && createdMovements.length > 0) {
    const firstMov = createdMovements[0];
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
    <div><strong>نوع الوجهة:</strong> ${destinationType === 'BRANCH' ? 'فرع تابع' : 'عميل'}</div>
    <div><strong>اسم الجهة المستلمة:</strong> ${destinationType === 'BRANCH' ? selectedBranch?.name : selectedCustomer?.name}</div>
    <div><strong>اسم المسؤول / المستلم:</strong> ${destinationType === 'BRANCH' ? (selectedBranch?.managerName || selectedBranch?.name) : selectedCustomer?.name}</div>
    <div><strong>رقم الجوال:</strong> ${destinationType === 'BRANCH' ? (selectedBranch?.phone || 'غير متوفر') : (selectedCustomer?.phone || 'غير متوفر')}</div>
    <div><strong>العنوان / المدينة:</strong> ${destinationType === 'BRANCH' ? (selectedBranch?.address || selectedBranch?.city) : selectedCustomer?.address}</div>
    <div><strong>الرقم الضريبي:</strong> ${destinationType === 'BRANCH' ? 'غير متوفر' : (selectedCustomer?.taxId || 'غير متوفر')}</div>
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
        ${destinationType === 'BRANCH' ? (selectedBranch?.managerName || selectedBranch?.name) : selectedCustomer?.name}
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
              <h3 className="text-base font-black text-slate-900">تم إصدار وحفظ سند الصرف بنجاح (رقم: #{createdVoucherNo})</h3>
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
                <p className="text-slate-500">س.ت: {companySettings.commercialRegister} | الرقم الضريبي: {companySettings.taxId}</p>
              </div>
              <div className="text-left font-mono">
                <div className="text-slate-500">رقم السند</div>
                <div className="text-lg font-black">#{createdVoucherNo}</div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500 block">الجهة المستلمة:</span>
                <span className="font-bold text-slate-900">
                  {destinationType === 'BRANCH' ? selectedBranch?.name : selectedCustomer?.name}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">رقم الجوال:</span>
                <span className="font-bold font-mono">
                  {destinationType === 'BRANCH' ? selectedBranch?.phone : selectedCustomer?.phone}
                </span>
              </div>
            </div>

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
                <div className="flex items-center justify-between">
                  <label className="block text-slate-700 font-bold">اختر الفرع المستلم *</label>
                </div>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-emerald-500"
                >
                  {branches.length === 0 ? (
                    <option value="">لا توجد فروع مسجلة، يرجى إضافتها من إدارة الفروع</option>
                  ) : (
                    branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.city ? `(${b.city})` : ''}
                      </option>
                    ))
                  )}
                </select>

                {selectedBranch && (
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 text-slate-700 space-y-1">
                    <p><strong>اسم الفرع:</strong> {selectedBranch.name}</p>
                    <p><strong>مسؤول الفرع:</strong> {selectedBranch.managerName || 'غير متوفر'}</p>
                    <p><strong>الجوال:</strong> <span className="font-mono">{selectedBranch.phone || 'غير متوفر'}</span></p>
                    <p><strong>العنوان:</strong> {selectedBranch.address || selectedBranch.city || 'غير متوفر'}</p>
                  </div>
                )}
              </div>
            )}

            {/* Customer Selection Details */}
            {destinationType === 'CUSTOMER' && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-700 font-bold">اختر العميل المستلم *</label>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomerModal(true)}
                    className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة عميل سريع</span>
                  </button>
                </div>

                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-emerald-500"
                >
                  {customers.length === 0 ? (
                    <option value="">لا توجد عملاء مسجلون، انقر "إضافة عميل سريع" أعلاه</option>
                  ) : (
                    customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `- ${c.phone}` : ''}
                      </option>
                    ))
                  )}
                </select>

                {selectedCustomer && (
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 text-slate-700 space-y-1">
                    <p><strong>اسم العميل:</strong> {selectedCustomer.name}</p>
                    <p><strong>الجوال:</strong> <span className="font-mono">{selectedCustomer.phone || 'غير متوفر'}</span></p>
                    <p><strong>العنوان:</strong> {selectedCustomer.address || 'غير متوفر'}</p>
                    <p><strong>الرقم الضريبي:</strong> <span className="font-mono">{selectedCustomer.taxId || 'غير متوفر'}</span></p>
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

        {/* Quick Add Customer Modal */}
        {showAddCustomerModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 text-right space-y-4">
              <div className="flex items-center justify-between pb-3 border-b">
                <h4 className="font-black text-slate-900 text-sm">إضافة عميل جديد سريعاً</h4>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">اسم العميل *</label>
                  <input
                    type="text"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="اسم العميل أو الجهة..."
                    className="w-full px-3.5 py-2 bg-slate-50 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">رقم الجوال</label>
                  <input
                    type="text"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    className="w-full px-3.5 py-2 bg-slate-50 border rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">العنوان / المدينة</label>
                  <input
                    type="text"
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    placeholder="المدينة، الحي..."
                    className="w-full px-3.5 py-2 bg-slate-50 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">الرقم الضريبي (اختياري)</label>
                  <input
                    type="text"
                    value={newCustTaxId}
                    onChange={(e) => setNewCustTaxId(e.target.value)}
                    placeholder="300xxxxxxxxxxxx"
                    className="w-full px-3.5 py-2 bg-slate-50 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleQuickAddCustomer}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                >
                  حفظ وإضافة
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
