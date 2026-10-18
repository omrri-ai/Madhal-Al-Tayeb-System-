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
  Search,
  ChevronDown,
  Eye,
  FileText,
  RotateCcw,
  Calendar,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { ShippingCarrier, StockMovement } from '../../types/inventory';
import { playNotificationSound } from '../../services/sound';
import { ItemPickerBottomSheet } from '../common/ItemPickerBottomSheet';

export interface OutgoingDispatchDraft {
  id: string;
  referenceNumber: string;
  destinationType: 'BRANCH' | 'CUSTOMER';
  branchId?: string;
  customerName?: string;
  customerPhone?: string;
  customerCity?: string;
  shippingCompany?: ShippingCarrier;
  customShippingCompany?: string;
  shippingTrackingNumber?: string;
  date: string;
  generalNotes: string;
  rows: DispatchRowItem[];
  savedAt: string;
}

interface OutgoingDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  editVoucherNoOrBatch?: string | null; // Pass voucherRef or batchId when editing an approved dispatch
  onDispatchComplete?: (voucherNo: string, movements: StockMovement[]) => void;
  onNavigateToMovements?: () => void;
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
  editVoucherNoOrBatch,
  onDispatchComplete,
  onNavigateToMovements,
}) => {
  const {
    items,
    units,
    categories,
    branches,
    movements,
    companySettings,
    getItemStock,
    addMultiItemDispatch,
    updateMultiItemDispatch,
    showToast,
  } = useInventory();

  const DRAFTS_KEY = 'makhzouni_dispatch_drafts';

  const isEditMode = Boolean(editVoucherNoOrBatch?.trim());

  const loadStoredDrafts = (): OutgoingDispatchDraft[] => {
    try {
      const raw = localStorage.getItem(DRAFTS_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  };

  const saveStoredDrafts = (drafts: OutgoingDispatchDraft[]): void => {
    try {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    } catch (err) {
      console.warn('Failed to save drafts:', err);
    }
  };

  const activeItems = useMemo(
    () => items.filter((i) => !i.isDeleted && !i.isArchived),
    [items]
  );

  // Workflow state: 'FORM' (input) -> 'REVIEW' (review & confirm)
  const [step, setStep] = useState<'FORM' | 'REVIEW'>('FORM');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState<OutgoingDispatchDraft[]>([]);
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Destination mode: 'BRANCH' | 'CUSTOMER'
  const [destinationType, setDestinationType] = useState<'BRANCH' | 'CUSTOMER'>('BRANCH');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Customer direct manual entry
  const [directCustomerName, setDirectCustomerName] = useState('');
  const [directCustomerPhone, setDirectCustomerPhone] = useState('');
  const [directCustomerCity, setDirectCustomerCity] = useState('');

  // Shipping company selection
  const [shippingCompany, setShippingCompany] = useState<ShippingCarrier>('SMSA');
  const [customShippingCompany, setCustomShippingCompany] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  // Voucher metadata & Obligatory edit reason
  const [voucherDate, setVoucherDate] = useState<string>(new Date().toISOString().substring(0, 16));
  const [voucherReference, setVoucherReference] = useState<string>('');
  const [generalNotes, setGeneralNotes] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');

  // Multi-item rows
  const [rows, setRows] = useState<DispatchRowItem[]>([]);
  const [formError, setFormError] = useState<string>('');
  const [pickingRowId, setPickingRowId] = useState<string | null>(null);

  // Created/Saved voucher result
  const [createdVoucherNo, setCreatedVoucherNo] = useState<string | null>(null);
  const [createdMovements, setCreatedMovements] = useState<StockMovement[] | null>(null);

  // Set of selected item IDs to strictly prevent duplication
  const selectedItemIds = useMemo(() => {
    return new Set(rows.map((r) => r.itemId).filter(Boolean));
  }, [rows]);

  useEffect(() => {
    if (isOpen) {
      setStep('FORM');
      setIsSubmitting(false);
      setIsDraftsModalOpen(false);
      setIsPreviewModalOpen(false);
      setSavedDrafts(loadStoredDrafts());
      setFormError('');
      setCreatedVoucherNo(null);
      setCreatedMovements(null);
      setEditReason('');

      // If EDIT MODE: Load existing movements belonging to editVoucherNoOrBatch
      if (editVoucherNoOrBatch?.trim()) {
        const searchKey = editVoucherNoOrBatch.trim().toLowerCase();
        const existing = movements.filter((m) => {
          const mRef = (m.referenceNumber || '').trim().toLowerCase();
          const mBatch = (m.batchId || '').trim().toLowerCase();
          return m.id === editVoucherNoOrBatch || (mBatch && mBatch === searchKey) || (mRef && mRef === searchKey);
        });

        if (existing.length > 0) {
          const first = existing[0];
          const isBranch = first.destinationType === 'BRANCH' || Boolean(first.branchId);
          setDestinationType(isBranch ? 'BRANCH' : 'CUSTOMER');
          if (first.branchId) setSelectedBranchId(first.branchId);
          else if (branches.length > 0) setSelectedBranchId(branches[0].id);

          setDirectCustomerName(first.customerName || first.destinationName || '');
          setDirectCustomerPhone(first.customerPhone || first.destinationPhone || '');
          setDirectCustomerCity(first.customerCity || first.destinationAddress || '');
          setShippingCompany(first.shippingCompany || 'SMSA');
          setCustomShippingCompany(first.customShippingCompany || '');
          setTrackingNumber(first.shippingTrackingNumber || '');
          setVoucherDate(first.date ? new Date(first.date).toISOString().substring(0, 16) : new Date().toISOString().substring(0, 16));
          setVoucherReference(first.referenceNumber || editVoucherNoOrBatch);
          setGeneralNotes(first.notes || '');

          // Map existing movements to dispatch row items
          const loadedRows: DispatchRowItem[] = existing.map((m, idx) => ({
            id: 'row_' + Date.now() + '_' + idx,
            itemId: m.itemId,
            unitId: m.unitId,
            quantity: String(m.quantity || 1),
            notes: m.notes || '',
          }));
          setRows(loadedRows);
          return;
        }
      }

      // Default CREATE Mode:
      setDestinationType('BRANCH');
      setSelectedBranchId(branches.length > 0 ? branches[0].id : '');
      setDirectCustomerName('');
      setDirectCustomerPhone('');
      setDirectCustomerCity('');
      setShippingCompany('SMSA');
      setCustomShippingCompany('');
      setTrackingNumber('');
      setVoucherDate(new Date().toISOString().substring(0, 16));
      setVoucherReference(`DSP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setGeneralNotes('');

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
  }, [isOpen, editVoucherNoOrBatch, items, activeItems, branches, movements]);

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

  // Add row ensuring NO duplicate item is picked
  const handleAddRow = () => {
    if (activeItems.length === 0) return;
    const availableItem = activeItems.find((i) => !selectedItemIds.has(i.id));

    if (!availableItem) {
      const msg = 'جميع الأصناف المتاحة أضيفت بالفعل إلى هذا السند! يمنع تكرار الصنف نفسه.';
      showToast(msg, 'info');
      playNotificationSound('alert');
      return;
    }

    setRows((prev) => [
      ...prev,
      {
        id: 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        itemId: availableItem.id,
        unitId: availableItem.baseUnitId,
        quantity: '1',
        notes: '',
      },
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (rows.length <= 1) {
      showToast('يجب بقاء صنف واحد على الأقل داخل السند', 'info');
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Prevent changing row to an item already selected in another row
  const handleItemChange = (rowId: string, newItemId: string) => {
    const item = activeItems.find((i) => i.id === newItemId);
    if (!item) return;

    // Check if item is used by ANOTHER row
    const isAlreadySelected = rows.some((r) => r.id !== rowId && r.itemId === newItemId);
    if (isAlreadySelected) {
      const msg = `الصنف "${item.name}" مضاف بالفعل في هذا السند. يمنع تكرار الصنف نفسه!`;
      showToast(msg, 'error');
      playNotificationSound('alert');
      return;
    }

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
      
      // In Edit mode, virtual stock accounts for restored previous dispatch qty
      const isExceeded = numQty > 0 && !isEditMode && (totalRequestedForThisItem > currentStock || currentStock <= 0);

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
        isValid: numQty > 0 && (!isExceeded || isEditMode),
      };
    });
  }, [rows, activeItems, units, categories, getItemStock, itemTotalRequestedBase, isEditMode]);

  const validateForm = (): boolean => {
    setFormError('');

    if (isEditMode && !editReason.trim()) {
      const err = 'يرجى كتابة سبب التعديل بشكل إلزامي لضمان التوثيق والرقابة.';
      setFormError(err);
      showToast(err, 'error');
      playNotificationSound('alert');
      return false;
    }

    if (rows.length === 0) {
      const err = 'يرجى إضافة صنف واحد على الأقل في سند الخروج.';
      setFormError(err);
      showToast(err, 'error');
      playNotificationSound('alert');
      return false;
    }

    // Strict item duplication check
    const itemIds = rows.map((r) => r.itemId).filter(Boolean);
    if (new Set(itemIds).size !== itemIds.length) {
      const err = 'عفواً، يتضمن السند أصناف مكررة! يمنع تكرار الصنف نفسه داخل السند.';
      setFormError(err);
      showToast(err, 'error');
      playNotificationSound('alert');
      return false;
    }

    if (destinationType === 'BRANCH') {
      if (!selectedBranchId) {
        const err = 'يرجى تحديد الفرع المستلم قبل المتابعة.';
        setFormError(err);
        showToast(err, 'error');
        playNotificationSound('alert');
        return false;
      }
    } else {
      if (!directCustomerName.trim()) {
        const err = 'يرجى إدخال اسم العميل المستلم للشحنة.';
        setFormError(err);
        showToast(err, 'error');
        playNotificationSound('alert');
        return false;
      }
      if (shippingCompany === 'OTHER' && !customShippingCompany.trim()) {
        const err = 'يرجى كتابة اسم شركة الشحن عند اختيار "أخرى".';
        setFormError(err);
        showToast(err, 'error');
        playNotificationSound('alert');
        return false;
      }
    }

    for (let i = 0; i < rowValidations.length; i++) {
      const val = rowValidations[i];
      if (!val.numQty || val.numQty <= 0) {
        const err = `يرجى تحديد كمية صحيحة أكبر من الصفر للصنف رقم ${i + 1} (${val.item?.name}).`;
        setFormError(err);
        showToast(err, 'error');
        playNotificationSound('alert');
        return false;
      }
      if (!isEditMode && val.isExceeded) {
        const err = `الرصيد غير متوفر للصنف "${val.item?.name}": إجمالي الكمية المطلوبة (${val.totalRequestedForThisItem} ${val.baseUnit?.name}) تتجاوز الرصيد المتوفر (${val.currentStock} ${val.baseUnit?.name}).`;
        setFormError(err);
        showToast(err, 'error');
        playNotificationSound('alert');
        return false;
      }
    }

    return true;
  };

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    playNotificationSound('bell');
    setStep('REVIEW');
  };

  const handleSaveDraft = () => {
    if (rows.length === 0) {
      showToast('لا يمكن حفظ مسودة فارغة بدون أي أصناف', 'error');
      return;
    }

    const draftRef = voucherReference.trim() || `DRAFT-${Date.now().toString(36).toUpperCase()}`;
    const draft: OutgoingDispatchDraft = {
      id: 'draft_' + Date.now(),
      referenceNumber: draftRef,
      destinationType,
      branchId: destinationType === 'BRANCH' ? selectedBranchId : undefined,
      customerName: destinationType === 'CUSTOMER' ? directCustomerName.trim() : undefined,
      customerPhone: destinationType === 'CUSTOMER' ? directCustomerPhone.trim() : undefined,
      customerCity: destinationType === 'CUSTOMER' ? directCustomerCity.trim() : undefined,
      shippingCompany: destinationType === 'CUSTOMER' ? shippingCompany : undefined,
      customShippingCompany: destinationType === 'CUSTOMER' && shippingCompany === 'OTHER' ? customShippingCompany.trim() : undefined,
      shippingTrackingNumber: destinationType === 'CUSTOMER' ? trackingNumber.trim() : undefined,
      date: voucherDate || new Date().toISOString(),
      generalNotes: generalNotes.trim(),
      rows,
      savedAt: new Date().toISOString(),
    };

    const currentDrafts = loadStoredDrafts();
    const updated = [draft, ...currentDrafts.filter((d) => d.referenceNumber !== draft.referenceNumber)];
    saveStoredDrafts(updated);
    setSavedDrafts(updated);
    playNotificationSound('success');
    showToast(`تم حفظ طلب الصادر كمسودة بنجاح (#${draft.referenceNumber}) دون خصم أي رصيد من المخزون`, 'success');
    onClose();
  };

  const handleResumeDraft = (draft: OutgoingDispatchDraft) => {
    setDestinationType(draft.destinationType);
    if (draft.branchId) setSelectedBranchId(draft.branchId);
    if (draft.customerName) setDirectCustomerName(draft.customerName);
    if (draft.customerPhone) setDirectCustomerPhone(draft.customerPhone);
    if (draft.customerCity) setDirectCustomerCity(draft.customerCity);
    if (draft.shippingCompany) setShippingCompany(draft.shippingCompany);
    if (draft.customShippingCompany) setCustomShippingCompany(draft.customShippingCompany);
    if (draft.shippingTrackingNumber) setTrackingNumber(draft.shippingTrackingNumber);
    if (draft.date) setVoucherDate(draft.date);
    if (draft.referenceNumber) setVoucherReference(draft.referenceNumber);
    if (draft.generalNotes) setGeneralNotes(draft.generalNotes);
    if (draft.rows && draft.rows.length > 0) setRows(draft.rows);
    setIsDraftsModalOpen(false);
    setStep('FORM');
    showToast(`تم استئناف المسودة #${draft.referenceNumber}`, 'info');
  };

  const handleDeleteDraft = (draftId: string) => {
    const currentDrafts = loadStoredDrafts();
    const updated = currentDrafts.filter((d) => d.id !== draftId);
    saveStoredDrafts(updated);
    setSavedDrafts(updated);
    showToast('تم حذف المسودة من القائمة', 'info');
  };

  const handleApproveDispatch = () => {
    if (isSubmitting) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    setFormError('');

    const branch = destinationType === 'BRANCH' ? branches.find((b) => b.id === selectedBranchId) : undefined;
    const branchManagerName = branch?.branchManagerName || branch?.managerName || branch?.name || '';
    const branchManagerPhone = branch?.branchManagerPhone || branch?.phone || '';
    const branchCity = branch?.city || branch?.address || '';

    const payload = {
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
    };

    let result;
    if (isEditMode && editVoucherNoOrBatch) {
      result = updateMultiItemDispatch(editVoucherNoOrBatch, {
        ...payload,
        editReason: editReason.trim(),
      });
    } else {
      result = addMultiItemDispatch(payload);
    }

    if (result.success && result.voucherNumber) {
      playNotificationSound('success');
      const currentDrafts = loadStoredDrafts();
      const updatedDrafts = currentDrafts.filter((d) => d.referenceNumber !== voucherReference.trim());
      saveStoredDrafts(updatedDrafts);
      setSavedDrafts(updatedDrafts);

      setCreatedVoucherNo(result.voucherNumber);
      setCreatedMovements(result.movements || []);
      if (onDispatchComplete && result.movements) {
        onDispatchComplete(result.voucherNumber, result.movements);
      }
    } else {
      setFormError(result.error || 'حدث خطأ أثناء حفظ واعتماد سند الصرف.');
      playNotificationSound('alert');
    }
    setIsSubmitting(false);
  };

  const handlePrintPreviewModal = () => {
    if (!validateForm()) return;
    setIsPreviewModalOpen(true);
  };

  if (!isOpen) return null;

  // Print Preview Modal
  if (isPreviewModalOpen) {
    const isBranch = destinationType === 'BRANCH';
    const recipientName = isBranch ? selectedBranch?.name || 'فرع محدد' : directCustomerName.trim();
    const recipientContact = isBranch
      ? selectedBranch?.branchManagerName || selectedBranch?.managerName || '-'
      : directCustomerPhone.trim() || '-';
    const recipientLocation = isBranch ? selectedBranch?.city || '-' : directCustomerCity.trim() || '-';
    const carrierName = isBranch ? '-' : getCarrierLabel(shippingCompany, customShippingCompany);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-8 my-8 text-right flex flex-col max-h-[92vh] overflow-y-auto">
          {/* Toolbar */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 no-print">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                معاينة رسمية قبل الطباعة - سند خروج مخزني
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>طباعة / حفظ PDF</span>
              </button>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable A4 Voucher View */}
          <div className="p-6 sm:p-8 border-2 border-slate-900 rounded-2xl bg-white text-slate-900 space-y-5 text-xs printable-voucher">
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
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
                <div className="text-xl font-black text-slate-900">#{voucherReference || 'DSP-DRAFT'}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{new Date(voucherDate).toLocaleString('ar-SA')}</div>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center font-black text-rose-900 text-sm">
              سند خروج مخزني رسمي (إذن صرف وتصدير)
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block mb-0.5">نوع الوجهة:</span>
                <span className="font-bold text-slate-900">{isBranch ? 'فرع تابع' : 'شحن لعميل'}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">الجهة المستلمة:</span>
                <span className="font-bold text-slate-900 text-sm">{recipientName}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">المسؤول / الجوال:</span>
                <span className="font-bold text-slate-900">{recipientContact}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">المدينة / العنوان:</span>
                <span className="font-medium text-slate-800">{recipientLocation}</span>
              </div>
              {!isBranch && (
                <div>
                  <span className="text-slate-500 block mb-0.5">شركة الشحن / التتبع:</span>
                  <span className="font-bold text-emerald-800">{carrierName} {trackingNumber ? `(#${trackingNumber})` : ''}</span>
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3">بيان الصنف</th>
                    <th className="py-2.5 px-3">الرمز (SKU)</th>
                    <th className="py-2.5 px-3">القسم</th>
                    <th className="py-2.5 px-3">الكمية المصروفة</th>
                    <th className="py-2.5 px-3">المعادل بالأساسية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, idx) => {
                    const itm = items.find((i) => i.id === row.itemId);
                    const chosenUnit = units.find((u) => u.id === row.unitId);
                    const baseUnit = units.find((u) => u.id === itm?.baseUnitId);
                    const cat = categories.find((c) => c.id === itm?.categoryId);
                    const val = rowValidations[idx];

                    return (
                      <tr key={row.id}>
                        <td className="py-3 px-3 text-center font-mono">{idx + 1}</td>
                        <td className="py-3 px-3 font-bold text-slate-900">{itm?.name || 'صنف'}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{itm?.code || '-'}</td>
                        <td className="py-3 px-3 text-slate-600">{cat?.name || '-'}</td>
                        <td className="py-3 px-3 font-bold text-slate-900 font-mono">
                          {row.quantity} {chosenUnit?.name || 'وحدة'}
                        </td>
                        <td className="py-3 px-3 font-bold font-mono text-slate-800">
                          {val?.baseQty || row.quantity} {baseUnit?.name || 'وحدة'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 block">إجمالي الأصناف:</span>
                <span className="font-bold text-slate-900">{rows.length} أصناف</span>
              </div>
              <div>
                <span className="text-slate-500 block">المُصدر / أمين المستودع:</span>
                <span className="font-bold text-slate-900">{companySettings.managerName}</span>
              </div>
              {generalNotes && (
                <div className="col-span-2 pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-0.5">ملاحظات عامة:</span>
                  <span className="font-medium text-slate-800">{generalNotes}</span>
                </div>
              )}
              {isEditMode && editReason && (
                <div className="col-span-2 pt-2 border-t border-slate-200 text-rose-800 font-bold">
                  <span>سبب التعديل المسجل: </span>
                  <span className="font-medium text-slate-900">{editReason}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 pt-8 border-t-2 border-slate-800 text-center">
              <div>
                <span className="text-slate-600 block mb-1 font-bold">أمين المستودع</span>
                <div className="text-slate-900 font-medium mb-8">{companySettings.managerName}</div>
                <div className="border-t border-dashed border-slate-400 pt-1 text-slate-400 text-[11px]">التوقيع</div>
              </div>
              <div>
                <span className="text-slate-600 block mb-1 font-bold">المستلم / مسؤول الفرع</span>
                <div className="text-slate-900 font-bold mb-8">{recipientName}</div>
                <div className="border-t border-dashed border-slate-400 pt-1 text-slate-400 text-[11px]">التوقيع والختم</div>
              </div>
              <div>
                <span className="text-slate-600 block mb-1 font-bold">اعتماد الإدارة</span>
                <div className="text-slate-900 font-medium mb-8">{companySettings.name}</div>
                <div className="border-t border-dashed border-slate-400 pt-1 text-slate-400 text-[11px]">الختم والاعتماد</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Final Saved Result View
  if (createdVoucherNo && createdMovements && createdMovements.length > 0) {
    const firstMov = createdMovements[0];
    const isBranch = firstMov.destinationType === 'BRANCH';
    const branchName = firstMov.branchName || firstMov.destinationName || selectedBranch?.name || '-';
    const branchManager = firstMov.destinationContactName || selectedBranch?.branchManagerName || selectedBranch?.managerName || selectedBranch?.name || '-';
    const custName = firstMov.customerName || firstMov.destinationName || directCustomerName.trim() || '-';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 sm:p-8 text-right flex flex-col max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <h3 className="text-base font-black text-slate-900">
                {isEditMode ? 'تم تعديل سند الخروج وإعادة احتساب المخزون بنجاح' : 'تم إصدار وحفظ سند الخروج بنجاح'} (#{createdVoucherNo})
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
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
                <div className="text-xs text-slate-600 space-y-0.5">
                  {(companySettings.commercialRegister || companySettings.taxId) && (
                    <p>
                      {companySettings.commercialRegister && <>سجل تجاري: <span className="font-mono">{companySettings.commercialRegister}</span></>}
                      {companySettings.commercialRegister && companySettings.taxId && ' | '}
                      {companySettings.taxId && <>الرقم الضريبي: <span className="font-mono">{companySettings.taxId}</span></>}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-left font-mono">
                <div className="text-slate-500">رقم السند</div>
                <div className="text-lg font-black">#{createdVoucherNo}</div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl grid grid-cols-2 sm:grid-cols-3 gap-3 border border-slate-200">
              <div>
                <span className="text-slate-500 block text-[11px]">الجهة المستلمة:</span>
                <span className="font-bold text-slate-900">{isBranch ? `فرع (${branchName})` : `عميل (${custName})`}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">المسؤول:</span>
                <span className="font-bold text-slate-900">{branchManager}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">التاريخ والوقت:</span>
                <span className="font-mono font-bold text-slate-800">{new Date(firstMov.date).toLocaleString('ar-SA')}</span>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-slate-100 font-bold border-b">
                  <tr>
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">الصنف والرمز</th>
                    <th className="p-2.5">القسم</th>
                    <th className="p-2.5">الكمية المصروفة</th>
                    <th className="p-2.5">المعادل بالأساسية</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {createdMovements.map((m, idx) => {
                    const itm = items.find((i) => i.id === m.itemId);
                    const u = units.find((un) => un.id === m.unitId);
                    const bu = units.find((un) => un.id === itm?.baseUnitId);
                    const cat = categories.find((c) => c.id === itm?.categoryId);
                    return (
                      <tr key={m.id}>
                        <td className="p-2.5 font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-bold">{itm?.name || m.itemName} <span className="text-[10px] text-slate-400 font-mono">({itm?.code || m.itemCode || '-'})</span></td>
                        <td className="p-2.5 text-slate-600">{cat?.name || '-'}</td>
                        <td className="p-2.5 font-mono font-bold">{m.quantity} {u?.name || m.unitName}</td>
                        <td className="p-2.5 font-mono font-bold text-slate-800">{m.baseQuantity} {bu?.name || 'وحدة'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer"
              >
                إتمام وإغلاق
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN FORM LAYOUT: 5 Organized RTL Sections
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-7 my-6 text-right flex flex-col max-h-[94vh] overflow-y-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-2xs ${isEditMode ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-rose-100 text-rose-800 border border-rose-200'}`}>
              {isEditMode ? <RotateCcw className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">
                  {isEditMode ? `تعديل سند خروج معتمد (#${voucherReference})` : 'سند خروج مخزني وتصدير جديد'}
                </h3>
                {isEditMode && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
                    إعادة احتساب المخزون بالأرصدة
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEditMode
                  ? 'تعديل أصناف وسند خروج سابق وإلغاء الكمية القديمة بأمان تام'
                  : 'إعادة تنظيم بيانات الصرف المخزني وإصدار إذن التصدير المعتمد'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {savedDrafts.length > 0 && !isEditMode && (
              <button
                type="button"
                onClick={() => setIsDraftsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200 transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4 text-amber-600" />
                <span>المسودات ({savedDrafts.length})</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {formError && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleProceedToReview} className="space-y-5 text-xs">
          {/* SECTION 1: Voucher Meta Information */}
          <div className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-black text-slate-900 text-xs sm:text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-600" />
                <span>1. بيانات سند الخروج المرجعية:</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 font-medium">مدهال الطيب · إدارة المخزون</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">رقم السند المرجعي *</label>
                <input
                  type="text"
                  value={voucherReference}
                  onChange={(e) => setVoucherReference(e.target.value)}
                  placeholder="DSP-2026-XXXX"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">التاريخ والوقت *</label>
                <input
                  type="datetime-local"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">المُصدر / أمين المستودع</label>
                <input
                  type="text"
                  readOnly
                  value={companySettings.managerName}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Recipient Selection (Branch vs Customer) */}
          <div className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
            <h4 className="font-black text-slate-900 text-xs sm:text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-600" />
              <span>2. تحديد الجهة المستلمة للشحنة:</span>
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDestinationType('BRANCH')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                  destinationType === 'BRANCH'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>صرف إلى فرع تابع</span>
              </button>

              <button
                type="button"
                onClick={() => setDestinationType('CUSTOMER')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                  destinationType === 'CUSTOMER'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>صرف إلى عميل مباشرة</span>
              </button>
            </div>

            {destinationType === 'BRANCH' ? (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">اختر الفرع المستلم *</label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
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

                {selectedBranch && (
                  <div className="p-3.5 bg-white rounded-xl border border-emerald-200 shadow-2xs grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">اسم الفرع:</span>
                      <span className="font-bold text-slate-900">{selectedBranch.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">اسم مسؤول الفرع:</span>
                      <span className="font-bold text-slate-800">
                        {selectedBranch.branchManagerName || selectedBranch.managerName || 'غير محدد'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">الجوال:</span>
                      <span className="font-bold font-mono text-slate-800">
                        {selectedBranch.branchManagerPhone || selectedBranch.phone || 'غير محدد'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">المدينة:</span>
                      <span className="font-medium text-slate-800">
                        {selectedBranch.city || selectedBranch.address || 'غير محدد'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      اسم العميل <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="اسم العميل المستلم..."
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
                      placeholder="مثال: الرياض"
                      value={directCustomerCity}
                      onChange={(e) => setDirectCustomerCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">شركة الشحن *</label>
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
                      <label className="block text-slate-700 font-bold mb-1">اسم شركة الشحن *</label>
                      <input
                        type="text"
                        placeholder="اكتب اسم الشركة..."
                        value={customShippingCompany}
                        onChange={(e) => setCustomShippingCompany(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">رقم البوليصة / التتبع</label>
                      <input
                        type="text"
                        placeholder="رقم التتبع إن وجد..."
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: Outgoing Items Table (with Strict Duplication Guard) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-600" />
                <span>3. جدول أصناف الخروج المسجلة بالسند:</span>
              </h4>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {rows.length} أصناف مضافة
              </span>
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
                          title="حذف البند من السند"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      {/* Item Selector / Search */}
                      <div className="sm:col-span-5">
                        <label className="block text-slate-600 font-medium text-xs mb-1 flex items-center justify-between">
                          <span>الصنف <span className="text-rose-500">*</span></span>
                          <span className="text-[10px] text-emerald-700 font-bold">يمنع التكرار</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={row.itemId}
                            onChange={(e) => handleItemChange(row.id, e.target.value)}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                          >
                            {activeItems.map((itm) => {
                              const isUsed = selectedItemIds.has(itm.id) && itm.id !== row.itemId;
                              return (
                                <option key={itm.id} value={itm.id} disabled={isUsed}>
                                  {itm.name} ({itm.code || '-'}) {isUsed ? ' - [مضاف بالسند]' : ''}
                                </option>
                              );
                            })}
                          </select>

                          <button
                            type="button"
                            onClick={() => setPickingRowId(row.id)}
                            className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl cursor-pointer shrink-0"
                            title="فتح بحث الأصناف الشامل"
                          >
                            <Search className="w-4 h-4 text-emerald-400" />
                          </button>
                        </div>
                      </div>

                      {/* Unit Selector */}
                      <div className="sm:col-span-3">
                        <label className="block text-slate-600 font-medium mb-1">وحدة القياس:</label>
                        <select
                          value={row.unitId}
                          onChange={(e) => {
                            const valId = e.target.value;
                            setRows((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, unitId: valId } : r))
                            );
                          }}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:border-emerald-500"
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

                      {/* Quantity Input */}
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
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold font-mono text-slate-900 text-xs focus:border-emerald-500"
                          placeholder="الكمية..."
                        />
                      </div>
                    </div>

                    {/* Stock Status Bar */}
                    {val && (
                      <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500 border-t border-slate-100">
                        <span>
                          الرصيد المتوفر المخزني: <strong className="font-mono text-slate-900 font-bold">{val.currentStock} {val.baseUnit?.name}</strong>
                        </span>
                        {val.isExceeded ? (
                          <span className="text-rose-600 font-bold">عفواً، الكمية المطلوبة تتجاوز الرصيد المتاح!</span>
                        ) : (
                          <span className="text-emerald-700 font-bold">المعادل بالأساسية: {val.baseQty} {val.baseUnit?.name}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add row buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>إضافة صنف جديد للسند</span>
              </button>

              <div className="text-slate-500 text-[11px] font-medium">
                * يمنع النظام تماماً تكرار نفس الصنف داخل السند الواحدة
              </div>
            </div>
          </div>

          {/* SECTION 4: General Notes & Obligatory Edit Reason */}
          <div className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-black text-slate-900 text-xs sm:text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600" />
              <span>4. الملاحظات والبيانات الاختيارية:</span>
            </h4>

            {isEditMode && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1.5">
                <label className="block text-amber-900 font-black text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>سبب التعديل الإلزامي (مطلوب للتوثيق والرقابة): *</span>
                </label>
                <input
                  type="text"
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="اكتب سبب تعديل الكمية أو السند المعتمد..."
                  className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-bold mb-1">ملاحظات عامة على سند الصرف (اختياري)</label>
              <input
                type="text"
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="شروط التسليم، رقم السائق أو وسيلة النقل..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium"
              />
            </div>
          </div>

          {/* SECTION 5: Quantities Summary & Action Toolbar */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-b border-slate-800 pb-3">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-slate-400 block text-[10px]">عدد أصناف السند:</span>
                  <span className="font-bold text-emerald-400 text-sm">{rows.length} صنف</span>
                </div>
                <div className="border-r border-slate-800 pr-4">
                  <span className="text-slate-400 block text-[10px]">إجمالي الكميات المعادلة:</span>
                  <span className="font-bold text-white text-sm font-mono">
                    {rowValidations.reduce((sum, v) => sum + (v.baseQty || 0), 0)} وحدة أساسية
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400">
                مدهال الطيب · اعتماد الصرف الفوري المباشر
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handlePrintPreviewModal}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-slate-700"
              >
                <Eye className="w-4 h-4 text-emerald-400" />
                <span>معاينة قبل الطباعة</span>
              </button>

              {!isEditMode && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-slate-700"
                >
                  <Save className="w-4 h-4 text-amber-400" />
                  <span>حفظ كمسودة</span>
                </button>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md cursor-pointer disabled:bg-rose-800 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4 text-rose-200" />
                <span>{isEditMode ? 'حفظ وتعديل السند المعتمد' : 'حفظ واعتماد سند الخروج'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Quick Search Item Bottom Sheet */}
      <ItemPickerBottomSheet
        isOpen={Boolean(pickingRowId)}
        onClose={() => setPickingRowId(null)}
        selectedItemId={rows.find((r) => r.id === pickingRowId)?.itemId || ''}
        onSelectItem={(itemId) => {
          if (pickingRowId) {
            handleItemChange(pickingRowId, itemId);
            setPickingRowId(null);
          }
        }}
        movementType="OUT"
        items={rows as any}
        allowZeroStockSelection={true}
      />
    </div>
  );
};
