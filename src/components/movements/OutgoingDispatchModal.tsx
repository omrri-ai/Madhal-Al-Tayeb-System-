import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Truck,
  Building2,
  User,
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
  ArrowUpRight,
  ChevronDown,
  Edit2,
  Save,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { Branch, Item, ShippingCarrier, StockMovement } from '../../types/inventory';
import { playNotificationSound } from '../../services/sound';

interface OutgoingDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDispatchComplete?: (voucherNo: string, movements: StockMovement[]) => void;
}

interface DispatchRowItem {
  id: string; // Row unique ID
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
    addBranch,
    updateBranch,
    deleteBranch,
    clearAllBranches,
    getItemStock,
    addMultiItemDispatch,
    showToast,
  } = useInventory();

  const activeItems = useMemo(
    () => items.filter((i) => !i.isDeleted && !i.isArchived),
    [items]
  );

  // Destination mode
  const [destinationType, setDestinationType] = useState<'BRANCH' | 'CUSTOMER'>('BRANCH');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Quick Add Branch modal/inline form
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCity, setNewBranchCity] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');

  // Branch editing state
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editBranchName, setEditBranchName] = useState('');
  const [editBranchCity, setEditBranchCity] = useState('');
  const [editBranchPhone, setEditBranchPhone] = useState('');

  // Customer shipping details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] = useState('');
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

  // Initialize form state
  useEffect(() => {
    if (isOpen) {
      setDestinationType('BRANCH');
      if (branches.length > 0) {
        setSelectedBranchId(branches[0].id);
      }
      setShowAddBranch(false);
      setNewBranchName('');
      setNewBranchCity('');
      setNewBranchPhone('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerCity('');
      setShippingCompany('SMSA');
      setTrackingNumber('');
      setVoucherDate(new Date().toISOString().substring(0, 16));
      setVoucherReference(`DSP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setGeneralNotes('');
      setFormError('');
      setCreatedVoucherNo(null);
      setCreatedMovements(null);

      // Initialize first item row
      if (activeItems.length > 0) {
        const firstItem = activeItems[0];
        setRows([
          {
            id: 'row_' + Date.now(),
            itemId: firstItem.id,
            unitId: firstItem.baseUnitId, // Automatically default to the item's specific unit!
            quantity: '1',
            notes: '',
          },
        ]);
      } else {
        setRows([]);
      }
    }
  }, [isOpen, activeItems, branches]);

  // When user selects a branch or default changes
  useEffect(() => {
    if (branches && branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    } else if (branches && branches.length > 0 && !branches.some(b => b.id === selectedBranchId)) {
        // If current selection is deleted, reset to first
        setSelectedBranchId(branches[0].id);
    }
  }, [branches]); // Removed selectedBranchId to prevent loop

  // Add a new row to multi-item dispatch
  const handleAddRow = () => {
    if (activeItems.length === 0) return;
    const defaultItem = activeItems[0];
    setRows((prev) => [
      ...prev,
      {
        id: 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        itemId: defaultItem.id,
        unitId: defaultItem.baseUnitId, // Item's specific unit automatically!
        quantity: '1',
        notes: '',
      },
    ]);
  };

  // Remove a row
  const handleRemoveRow = (rowId: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Change selected item in a row -> automatically assigns the item's base unit!
  const handleItemChange = (rowId: string, newItemId: string) => {
    const item = activeItems.find((i) => i.id === newItemId);
    if (!item) return;

    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              itemId: newItemId,
              unitId: item.baseUnitId, // Auto-selects this item's specific base unit!
            }
          : r
      )
    );
  };

  // Change unit in a row
  const handleUnitChange = (rowId: string, newUnitId: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, unitId: newUnitId } : r))
    );
  };

  // Change quantity in a row
  const handleQuantityChange = (rowId: string, newQty: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, quantity: newQty } : r))
    );
  };

  // Change notes in a row
  const handleRowNotesChange = (rowId: string, newNotes: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, notes: newNotes } : r))
    );
  };

  // Branch editing handlers
  const startEditBranch = (b: Branch) => {
    setEditingBranchId(b.id);
    setEditBranchName(b.name);
    setEditBranchCity(b.city || '');
    setEditBranchPhone(b.phone || '');
  };

  const saveEditBranch = (id: string) => {
    updateBranch(id, editBranchName, editBranchCity, editBranchPhone);
    setEditingBranchId(null);
  };

  // Quick add new branch handler
  const handleQuickAddBranch = () => {
    if (!newBranchName.trim()) {
      showToast('يرجى إدخال اسم الفرع', 'error');
      return;
    }

    const res = addBranch(newBranchName, newBranchCity, newBranchPhone);
    if (res.success && res.branch) {
      setSelectedBranchId(res.branch.id);
      setShowAddBranch(false);
      setNewBranchName('');
      setNewBranchCity('');
      setNewBranchPhone('');
      showToast(`تمت إضافة الفرع بنجاح: ${res.branch.name}`, 'success');
    } else {
      showToast(res.error || 'حدث خطأ أثناء إضافة الفرع', 'error');
    }
  };

  // Cumulative requested base qty per item across all rows
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

  // Calculations & Validations per row
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

  const hasAnyStockError = rowValidations.some((v) => v.isExceeded);
  const totalBaseQtyDispatched = rowValidations.reduce((sum, v) => sum + (v.baseQty || 0), 0);

  // Submit Multi-Item Dispatch
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (rows.length === 0) {
      const err = 'يرجى إضافة صنف واحد على الأقل في أمر التصدير.';
      setFormError(err);
      showToast(err, 'error');
      playNotificationSound('alert');
      return;
    }

    if (destinationType === 'BRANCH' && !selectedBranchId) {
      const err = 'يرجى اختيار الفرع المستلم أو إضافة فرع جديد.';
      setFormError(err);
      showToast(err, 'error');
      playNotificationSound('alert');
      return;
    }

    if (destinationType === 'CUSTOMER' && !customerName.trim()) {
      const err = 'يرجى كتابة اسم العميل المستلم للشحنة.';
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
        const err = `الرصيد غير متوفر للصنف "${val.item?.name}": إجمالي الكمية المطلوبة للتصدير (${val.totalRequestedForThisItem} ${val.baseUnit?.name}) تتجاوز الرصيد المتوفر بالمخزن (${val.currentStock} ${val.baseUnit?.name}). نظام مدهال الطيب يمنع الرصيد السالب نهائياً!`;
        setFormError(err);
        showToast(err, 'error');
        playNotificationSound('alert');
        return;
      }
    }

    const branch = branches.find((b) => b.id === selectedBranchId);

    const result = addMultiItemDispatch({
      destinationType,
      branchId: destinationType === 'BRANCH' ? selectedBranchId : undefined,
      branchName: destinationType === 'BRANCH' ? branch?.name : undefined,
      customerName: destinationType === 'CUSTOMER' ? customerName.trim() : undefined,
      customerPhone: destinationType === 'CUSTOMER' ? customerPhone.trim() : undefined,
      customerCity: destinationType === 'CUSTOMER' ? customerCity.trim() : undefined,
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
      setFormError(result.error || 'حدث خطأ أثناء حفظ أمر التصدير.');
    }
  };

  // Printable Dispatch HTML generator
  const handlePrintOrDownloadVoucher = () => {
    if (!createdVoucherNo || !createdMovements) return;

    const branch = branches.find((b) => b.id === selectedBranchId);
    const destTitle = destinationType === 'BRANCH' ? `فرع: ${branch?.name || ''}` : `عميل: ${customerName}`;
    const carrierName =
      shippingCompany === 'SMSA'
        ? 'شركة سمسا إكسبريس (SMSA)'
        : shippingCompany === 'FASTLO'
        ? 'شركة فاستيلو (Fastlo)'
        : shippingCompany === 'ARAMEX'
        ? 'شركة أرامكس الدولي (Aramex)'
        : 'شركة شحن معتمدة';

    const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>سند تصدير وشحنة - ${createdVoucherNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;900&display=swap');
    body { font-family: 'Tajawal', sans-serif; padding: 40px; color: #0f172a; margin: 0; background: #fff; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .badge { display: inline-block; padding: 4px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold; font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; font-size: 13px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; text-align: right; }
    th { background: #f1f5f9; padding: 10px; border: 1px solid #cbd5e1; font-weight: bold; }
    td { padding: 10px; border: 1px solid #cbd5e1; }
    .total-row { background: #f8fafc; font-weight: bold; font-size: 14px; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 50px; text-align: center; font-size: 13px; }
    .sig-line { border-top: 1px dashed #94a3b8; margin-top: 40px; padding-top: 8px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin: 0 0 6px 0; font-size: 22px;">سند تصدير وبوليصة خروج مخزني</h1>
      <div style="font-size: 13px; color: #64748b;">رقم السند: <strong>${createdVoucherNo}</strong> · التاريخ: ${new Date(voucherDate).toLocaleString('ar-SA')}</div>
    </div>
    <div style="text-align: left;">
      <div style="font-size: 18px; font-weight: 900; color: #047857;">نظام مدهال الطيب</div>
      <div style="font-size: 12px; color: #64748b;">إدارة المستودعات والشحنات</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div style="color: #64748b; margin-bottom: 4px;">جهة الصادر (المستلم):</div>
      <div style="font-size: 15px; font-weight: bold;">${destTitle}</div>
      ${destinationType === 'CUSTOMER' && customerCity ? `<div style="margin-top: 4px;">المدينة: ${customerCity}</div>` : ''}
      ${destinationType === 'CUSTOMER' && customerPhone ? `<div>الجوال: ${customerPhone}</div>` : ''}
      ${destinationType === 'BRANCH' && branch?.city ? `<div>المدينة: ${branch.city} · الهاتف: ${branch.phone || '-'}</div>` : ''}
    </div>
    <div class="card">
      <div style="color: #64748b; margin-bottom: 4px;">طريقة النقل / الشحن:</div>
      <div style="font-size: 15px; font-weight: bold;">${destinationType === 'CUSTOMER' ? carrierName : 'نقل داخلي بين الفروع'}</div>
      ${trackingNumber ? `<div style="margin-top: 4px;">رقم البوليصة / التتبع: <strong>${trackingNumber}</strong></div>` : ''}
      ${generalNotes ? `<div style="margin-top: 4px; color: #64748b;">ملاحظات: ${generalNotes}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 40px;">#</th>
        <th>اسم الصنف والرمز</th>
        <th>الكمية المنصرفة</th>
        <th>الوحدة المعتمدة</th>
        <th>المعادل بالأساسي</th>
        <th>ملاحظات الصنف</th>
      </tr>
    </thead>
    <tbody>
      ${createdMovements.map((m, idx) => {
        const it = items.find((i) => i.id === m.itemId);
        const u = units.find((un) => un.id === m.unitId);
        const bu = units.find((un) => un.id === it?.baseUnitId);
        return `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${it?.name}</strong> <span style="color:#64748b; font-size:11px;">(${it?.code})</span></td>
            <td style="font-weight:bold; font-size:14px; color:#b91c1c;">-${m.quantity}</td>
            <td>${u?.name}</td>
            <td>${m.baseQuantity} ${bu?.name}</td>
            <td>${m.notes || '-'}</td>
          </tr>
        `;
      }).join('')}
      <tr class="total-row">
        <td colspan="2">إجمالي الأصناف: ${createdMovements.length} صنف</td>
        <td colspan="4">إجمالي الكميات المنصرفة: ${createdMovements.reduce((sum, m) => sum + m.quantity, 0)} وحدة</td>
      </tr>
    </tbody>
  </table>

  <div class="signatures">
    <div>
      <div>مسؤول المستودع والصرف</div>
      <div class="sig-line">التوقيع / الختم</div>
    </div>
    <div>
      <div>مندوب الشحن / السائق</div>
      <div class="sig-line">التوقيع / الهوية</div>
    </div>
    <div>
      <div>المستلم / الفرع</div>
      <div class="sig-line">تأكيد الاستلام</div>
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
    link.download = `سند_تصدير_${createdVoucherNo}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-xs">
              <Truck className="w-5 h-5 text-rose-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  قسم صادر (خرجيات وتصدير متعدد الأصناف)
                </h3>
              </div>
              <p className="text-xs text-rose-200/80 mt-0.5">
                تصدير شحنات للفروع أو للعملاء عبر شركات الشحن مع التعيين التلقائي للوحدات
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Successful Created Voucher Modal View */}
        {createdVoucherNo ? (
          <div className="p-6 sm:p-8 text-center flex-1 overflow-y-auto space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-900 mb-1">
                تم تسجيل أمر التصدير والصرف بنجاح!
              </h4>
              <p className="text-xs text-slate-500 font-mono">
                رقم السند: <strong className="text-slate-800 text-sm font-bold">{createdVoucherNo}</strong> · تم خصم الأرصدة وتوثيق خروج {createdMovements?.length} أصناف
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-w-lg mx-auto text-xs space-y-2 text-right">
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">الوجهة / المستلم:</span>
                <span className="font-bold text-slate-900">
                  {destinationType === 'BRANCH'
                    ? `فرع: ${branches.find((b) => b.id === selectedBranchId)?.name}`
                    : `العميل: ${customerName} (${shippingCompany})`}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">عدد الأصناف في الشحنة:</span>
                <span className="font-bold text-slate-900">{createdMovements?.length} أصناف</span>
              </div>
              {trackingNumber && (
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">رقم بوليصة التتبع:</span>
                  <span className="font-mono font-bold text-slate-900">{trackingNumber}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              <button
                onClick={handlePrintOrDownloadVoucher}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>طباعة سند التصدير والبوليصة (PDF)</span>
              </button>
              <button
                onClick={handlePrintOrDownloadVoucher}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تنزيل مستند السند</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إغلاق والعودة
              </button>
            </div>
          </div>
        ) : (
          /* Form Content */
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Form Error Banner */}
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">{formError}</span>
                </div>
              )}

              {/* Step 1: Destination Selection (تصدير لفرع أو لعميل) */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-rose-600" />
                    <span>1. تحديد وجهة التصدير والخروج</span>
                  </span>

                  {/* Destination Segmented Toggle */}
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setDestinationType('BRANCH')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        destinationType === 'BRANCH'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>تصدير إلى فرع</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDestinationType('CUSTOMER')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        destinationType === 'CUSTOMER'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>تصدير وشحن لعميل</span>
                    </button>
                  </div>
                </div>

                {/* Option A: Branch Selection */}
                {destinationType === 'BRANCH' && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                      <div className="flex-1 w-full">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          اختر الفرع المستلم:
                        </label>
                        {branches.length === 0 ? (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between gap-2">
                            <span>لا توجد فروع مسجلة. يرجى إضافة فرع جديد:</span>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                                className="flex-1 flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-rose-500 shadow-2xs"
                              >
                                {branches.find((b) => b.id === selectedBranchId)?.name || 'اختر الفرع المستلم'}
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              </button>
                            </div>

                            {isBranchDropdownOpen && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                                { (branches || []).map((b) => (
                                  <div key={b?.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors">
                                    {editingBranchId === b?.id ? (
                                      <div className="flex-1 flex gap-1">
                                        <input value={editBranchName} onChange={(e) => setEditBranchName(e.target.value)} className="flex-1 px-2 py-1 border rounded text-xs" />
                                        <button type="button" onClick={() => saveEditBranch(b?.id)} className="p-1.5 text-emerald-600"><Save className="w-4 h-4" /></button>
                                      </div>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedBranchId(b?.id || '');
                                            setIsBranchDropdownOpen(false);
                                          }}
                                          className="flex-1 text-right"
                                        >
                                          <div className="text-xs font-bold text-slate-900">{b?.name || 'فرع بدون اسم'}</div>
                                          {b?.phone && <div className="text-[10px] text-slate-500 font-mono mt-0.5">هاتف: {b?.phone}</div>}
                                        </button>
                                        <div className="flex items-center gap-1">
                                          <button type="button" onClick={() => startEditBranch(b)} className="p-1.5 text-slate-400 hover:text-emerald-600"><Edit2 className="w-3.5 h-3.5" /></button>
                                          <button type="button" onClick={() => deleteBranch(b?.id || '')} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowAddBranch(!showAddBranch)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5 text-rose-600" />
                          <span>{showAddBranch ? 'إلغاء' : '+ إضافة فرع جديد'}</span>
                        </button>

                        {branches.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('هل تريد حذف وتصفير جميع الفروع للبدء من الصفر؟')) {
                                clearAllBranches();
                                setSelectedBranchId('');
                              }
                            }}
                            className="flex items-center gap-1 px-2.5 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                            title="تصفير وحذف كل الفروع"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">تصفير الفروع</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Add Branch Form */}
                    {showAddBranch && (
                      <div className="p-3 bg-white rounded-xl border border-rose-200/80 shadow-2xs space-y-3">
                        <span className="text-xs font-bold text-rose-900 block">
                          إضافة فرع جديد إلى قائمة الفروع المعتمدة:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="اسم الفرع (مثلاً: فرع الأحساء)"
                            value={newBranchName}
                            onChange={(e) => setNewBranchName(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          />
                          <input
                            type="text"
                            placeholder="المدينة"
                            value={newBranchCity}
                            onChange={(e) => setNewBranchCity(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          />
                          <input
                            type="text"
                            placeholder="رقم الهاتف / الجوال"
                            value={newBranchPhone}
                            onChange={(e) => setNewBranchPhone(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAddBranch(false)}
                            className="px-3 py-1 text-slate-600 text-xs font-medium"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            onClick={handleQuickAddBranch}
                            disabled={!newBranchName.trim()}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
                          >
                            حفظ الفرع واختياره
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Option B: Customer Shipping Details */}
                {destinationType === 'CUSTOMER' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        اسم العميل <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="اسم العميل المستلم"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-rose-500 shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        شركة الشحن المعتمدة
                      </label>
                      <select
                        value={shippingCompany}
                        onChange={(e) => setShippingCompany(e.target.value as ShippingCarrier)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:border-rose-500 shadow-2xs"
                      >
                        <option value="SMSA">🚚 شركة سمسا إكسبريس (SMSA)</option>
                        <option value="FASTLO">📦 شركة فاستيلو (Fastlo)</option>
                        <option value="ARAMEX">✈️ شركة أرامكس الدولي (Aramex)</option>
                        <option value="OTHER">🚛 شركة شحن أخرى</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        مدينة الوجهة
                      </label>
                      <input
                        type="text"
                        placeholder="الرياض، جدة، الدمام..."
                        value={customerCity}
                        onChange={(e) => setCustomerCity(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-rose-500 shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        رقم البوليصة / التتبع
                      </label>
                      <input
                        type="text"
                        placeholder="رقم بوليصة الشحن"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-medium focus:border-rose-500 shadow-2xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Multi-Item Table (الأصناف المتعددة للشحنة مع الوحدة التلقائية) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <span>2. جدول أصناف الشحنة (متعدد الأصناف بالوحدات المخصصة)</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>+ إضافة صنف آخر للشحنة</span>
                  </button>
                </div>

                {/* Mobile Cards View (Below sm) & Desktop/Tablet Table (sm and up) */}
                
                {/* 1. Mobile Cards Layout */}
                <div className="md:hidden space-y-3">
                  {rows.map((row, idx) => {
                    const val = rowValidations[idx];
                    const currentItem = val.item;

                    // Build available units for this row's item
                    const itemUnits: { id: string; name: string; factor: number; isBase: boolean }[] = [];
                    if (currentItem) {
                      const bu = units.find((u) => u.id === currentItem.baseUnitId);
                      if (bu) itemUnits.push({ id: bu.id, name: `${bu.name} (أساسية)`, factor: 1, isBase: true });
                      for (const c of currentItem.conversions) {
                        const cu = units.find((u) => u.id === c.unitId);
                        if (cu) itemUnits.push({ id: cu.id, name: `${cu.name} (×${c.factorToBase})`, factor: c.factorToBase, isBase: false });
                      }
                    }

                    return (
                      <div
                        key={row.id}
                        className={`p-3.5 bg-white rounded-xl border ${
                          val.isExceeded ? 'border-rose-400 bg-rose-50/20 ring-1 ring-rose-300' : 'border-slate-200'
                        } shadow-xs space-y-2.5`}
                      >
                        {/* Header: Row #, Selected Item Name badge & Delete Button */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black bg-rose-100 text-rose-900 px-2.5 py-0.5 rounded-md">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-black text-slate-900">
                              {currentItem ? currentItem.name : 'اختر صنفاً للتصدير'}
                            </span>
                          </div>
                          {rows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.id)}
                              className="text-rose-600 hover:text-rose-800 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف الصنف</span>
                            </button>
                          )}
                        </div>

                        {/* Item Picker */}
                        <div>
                          <label className="block text-xs font-black text-rose-950 mb-1">
                            📦 اسم الصنف للتصدير:
                          </label>
                          <select
                            value={row.itemId}
                            onChange={(e) => handleItemChange(row.id, e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:border-rose-500 shadow-2xs"
                          >
                            {activeItems.map((i) => {
                              const stock = getItemStock(i.id);
                              return (
                                <option key={i.id} value={i.id}>
                                  {i.name} (المتوفر: {stock})
                                </option>
                              );
                            })}
                          </select>

                          {/* Prominently Highlighted Selected Item Name Box */}
                          {currentItem && (
                            <div className="mt-2 p-2 bg-rose-50/90 border border-rose-200 rounded-lg flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-rose-600 shrink-0" />
                                <div>
                                  <span className="text-xs font-black text-rose-950 block">
                                    اسم الصنف: <span className="text-rose-700 text-sm font-black">{currentItem.name}</span>
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    كود: {currentItem.code} {val.category ? `· ${val.category.name}` : ''}
                                  </span>
                                </div>
                              </div>
                              <div className="text-left bg-white px-2 py-0.5 rounded border border-rose-200">
                                <span className="text-[9px] text-slate-500 block">المتاح بالمستودع</span>
                                <span className={`text-xs font-black font-mono ${val.currentStock <= 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                  {val.currentStock} {val.baseUnit?.name}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Unit and Quantity Row */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              الوحدة المخصصة:
                            </label>
                            <select
                              value={row.unitId}
                              onChange={(e) => handleUnitChange(row.id, e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-rose-500"
                            >
                              {itemUnits.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              الكمية المطلوبة:
                            </label>
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              required
                              value={row.quantity}
                              onChange={(e) => handleQuantityChange(row.id, e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-black font-mono text-center focus:bg-white focus:border-rose-500"
                            />
                          </div>
                        </div>

                        {/* Stock Balance & Notes */}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <div className="text-[11px]">
                            <span className="text-slate-500 font-medium">الرصيد المتاح: </span>
                            <span className="font-black font-mono text-slate-900">
                              {val.currentStock} {val.baseUnit?.name}
                            </span>
                          </div>

                          <div className="flex-1 max-w-[50%] mr-2">
                            <input
                              type="text"
                              placeholder="ملاحظة..."
                              value={row.notes}
                              onChange={(e) => handleRowNotesChange(row.id, e.target.value)}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-700"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. Desktop/Tablet Table Layout */}
                <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-8">#</th>
                        <th className="py-2.5 px-3 min-w-[260px]">📦 اسم الصنف للتصدير</th>
                        <th className="py-2.5 px-3 w-40">الوحدة المخصصة للصنف</th>
                        <th className="py-2.5 px-3 w-32">الكمية</th>
                        <th className="py-2.5 px-3 w-36">الرصيد المتاح</th>
                        <th className="py-2.5 px-3">ملاحظة</th>
                        <th className="py-2.5 px-3 w-10 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row, idx) => {
                        const val = rowValidations[idx];
                        const currentItem = val.item;

                        // Build available units for this row's item
                        const itemUnits: { id: string; name: string; factor: number; isBase: boolean }[] = [];
                        if (currentItem) {
                          const bu = units.find((u) => u.id === currentItem.baseUnitId);
                          if (bu) itemUnits.push({ id: bu.id, name: `${bu.name} (أساسية)`, factor: 1, isBase: true });
                          for (const c of currentItem.conversions) {
                            const cu = units.find((u) => u.id === c.unitId);
                            if (cu) itemUnits.push({ id: cu.id, name: `${cu.name} (×${c.factorToBase})`, factor: c.factorToBase, isBase: false });
                          }
                        }

                        return (
                          <tr key={row.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-mono text-slate-400 font-bold">{idx + 1}</td>

                            {/* Item Selector & Explicit Prominent Item Name Display */}
                            <td className="py-2.5 px-3">
                              <div className="space-y-1.5">
                                <select
                                  value={row.itemId}
                                  onChange={(e) => handleItemChange(row.id, e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-black text-slate-900 focus:border-rose-500 shadow-2xs cursor-pointer"
                                >
                                  {activeItems.map((i) => (
                                    <option key={i.id} value={i.id} className="text-slate-900 font-bold py-1">
                                      {i.name} (كود: {i.code})
                                    </option>
                                  ))}
                                </select>

                                {/* Prominent Chosen Item Name Badge */}
                                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs font-bold">
                                  <Package className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span className="text-slate-600 text-[11px]">الصنف المختار:</span>
                                  <span className="text-xs sm:text-sm font-extrabold text-emerald-900 truncate">
                                    {currentItem?.name || activeItems.find((i) => i.id === row.itemId)?.name || 'اختر صنفاً'}
                                  </span>
                                  {currentItem && (
                                    <span className="text-slate-400 font-mono text-[10px] mr-auto">({currentItem.code})</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Unit Selector (Defaults automatically to item's own base unit!) */}
                            <td className="py-2 px-3">
                              <select
                                value={row.unitId}
                                onChange={(e) => handleUnitChange(row.id, e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:border-rose-500"
                              >
                                {itemUnits.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Quantity Input */}
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                required
                                value={row.quantity}
                                onChange={(e) => handleQuantityChange(row.id, e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold font-mono text-center focus:border-rose-500"
                              />
                            </td>

                            {/* Available Stock Indicator */}
                            <td className="py-2 px-3">
                              <span className="font-bold text-slate-800 font-mono">
                                {val.currentStock} {val.baseUnit?.name}
                              </span>
                            </td>

                            {/* Note */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                placeholder="ملاحظة خاصة بالصنف"
                                value={row.notes}
                                onChange={(e) => handleRowNotesChange(row.id, e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-600"
                              />
                            </td>

                            {/* Remove Row Button */}
                            <td className="py-2 px-3 text-center">
                              {rows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRow(row.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                                  title="حذف هذا الصنف"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Stock Warning Box */}
                {hasAnyStockError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>تنبيه: الكميات المطلوبة لبعض الأصناف تتجاوز الرصيد المتوفر في المستودع؛ يرجى تعديل الكميات للمتابعة.</span>
                  </div>
                )}
              </div>

              {/* Step 3: Date, Reference & General Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    رقم السند / الإشارة
                  </label>
                  <input
                    type="text"
                    value={voucherReference}
                    onChange={(e) => setVoucherReference(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    تاريخ ووقت الخروج
                  </label>
                  <input
                    type="datetime-local"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ملاحظات عامة على السند
                  </label>
                  <input
                    type="text"
                    placeholder="ملاحظات التسليم أو السائق..."
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  <span className="font-bold text-slate-900">{rows.length} أصناف</span> في أمر التصدير · الإجمالي: <span className="font-mono font-bold text-rose-700">{totalBaseQtyDispatched}</span> وحدة أساسية
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-200/60 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={hasAnyStockError || rows.length === 0}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                      hasAnyStockError || rows.length === 0
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>تأكيد التصدير وإصدار السند</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
