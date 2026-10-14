import React, { useState } from 'react';
import { X, Factory, Plus, Search, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';

interface NewProductionOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddItem: () => void;
}

export const NewProductionOrderModal: React.FC<NewProductionOrderModalProps> = ({
  isOpen,
  onClose,
  onOpenAddItem,
}) => {
  const { items, units, createProductionOrder, showToast } = useInventory();

  const [title, setTitle] = useState('');
  const [targetItemId, setTargetItemId] = useState('');
  const [targetUnitId, setTargetUnitId] = useState('');
  const [plannedQuantity, setPlannedQuantity] = useState<number | ''>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Item search query
  const [itemSearch, setItemSearch] = useState('');

  if (!isOpen) return null;

  const activeItems = items.filter((i) => !i.isDeleted && !i.isArchived);
  const filteredTargetItems = activeItems.filter(
    (i) =>
      i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      i.code.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const selectedItem = items.find((i) => i.id === targetItemId);

  // Available units for the selected target item
  const availableUnits = selectedItem
    ? [
        units.find((u) => u.id === selectedItem.baseUnitId),
        ...selectedItem.conversions.map((c) => units.find((u) => u.id === c.unitId)),
      ].filter(Boolean)
    : [];

  const handleItemSelect = (itemId: string) => {
    setTargetItemId(itemId);
    const itm = items.find((i) => i.id === itemId);
    if (itm) {
      setTargetUnitId(itm.baseUnitId);
      if (!title) {
        setTitle(`تصنيع صنف (${itm.name})`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      showToast('يرجى كتابة عنوان أو وصف أمر الإنتاج', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createProductionOrder({
        title: cleanTitle,
        targetItemId: targetItemId || null,
        targetUnitId: targetUnitId || null,
        plannedQuantity: plannedQuantity ? Number(plannedQuantity) : 0,
        date: date ? `${date}T${new Date().toTimeString().split(' ')[0]}` : new Date().toISOString(),
        notes: notes.trim() || null,
      });

      if (res.success) {
        // Reset form
        setTitle('');
        setTargetItemId('');
        setTargetUnitId('');
        setPlannedQuantity('');
        setNotes('');
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">إنشاء أمر إنتاج وتشغيل جديد</h3>
              <p className="text-xs text-slate-500">بدء دورة تشغيل لربط الصرف والاستهلاك واستلام المنتج الجاهز</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* Order Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              عنوان أو بيان أمر الإنتاج <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: تصنيع 100 شنطة كتف جلد طبيعي - دفعة رمضان"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
              required
            />
          </div>

          {/* Target Finished Good Item (Optional or Primary) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                المنتج الجاهز المستهدف (الصنف النهائي)
              </label>
              <button
                type="button"
                onClick={onOpenAddItem}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة صنف جديد بالمخزون</span>
              </button>
            </div>

            {/* Quick search input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="ابحث بالاسم أو الرمز لاختيار المنتج..."
                className="w-full pr-9 pl-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100"
              />
            </div>

            <select
              value={targetItemId}
              onChange={(e) => handleItemSelect(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
            >
              <option value="">-- اختياري: حدد الصنف الجاهز المستهدف إن وجد --</option>
              {filteredTargetItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.code})
                </option>
              ))}
            </select>
          </div>

          {/* Target Quantity & Unit if item selected */}
          {selectedItem && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">
                  الكمية المخطط إنتاجها
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={plannedQuantity}
                  onChange={(e) => setPlannedQuantity(e.target.value ? Number(e.target.value) : '')}
                  placeholder="مثال: 100"
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm text-slate-900 font-mono focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">
                  الوحدة
                </label>
                <select
                  value={targetUnitId}
                  onChange={(e) => setTargetUnitId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm text-slate-900 focus:border-indigo-500"
                >
                  {availableUnits.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Date & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>تاريخ أمر الإنتاج</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ملاحظات أو توجيهات تشغيل
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي ملاحظات خاصة بأمر الإنتاج..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'جارٍ الحفظ...' : 'إنشاء أمر الإنتاج'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
