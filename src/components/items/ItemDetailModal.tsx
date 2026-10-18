import React from 'react';
import {
  X,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  Edit,
  Scale,
  Calendar,
  Tag,
  AlertTriangle,
  History,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { Item } from '../../types/inventory';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  onEdit: (item: Item) => void;
  onRecordMovement: (item: Item, type: 'IN' | 'OUT') => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  onEdit,
  onRecordMovement,
}) => {
  const { items, getItemStockSummary, movements, units, categories } = useInventory();
  const { isAdmin } = useAuth();

  if (!isOpen || !item) return null;

  const currentLiveItem = items.find((i) => i.id === item.id) || item;
  const summary = getItemStockSummary(currentLiveItem.id);
  const itemMovements = movements.filter((m) => m.itemId === currentLiveItem.id);

  const category = categories.find((c) => c.id === currentLiveItem.categoryId);
  const baseUnit = units.find((u) => u.id === currentLiveItem.baseUnitId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 my-8 text-right max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">{currentLiveItem.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-slate-100 text-slate-600">
                  {currentLiveItem.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                القسم: {category?.name || 'غير محدد'} · الوحدة الأساسية: {baseUnit?.name || 'وحدة'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(currentLiveItem);
                }}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="تعديل الصنف"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto pr-1 pl-1 py-4 space-y-6 flex-1">
          {/* Stock Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-slate-900 text-white">
              <span className="text-xs text-slate-400 block mb-1">الرصيد الفعلي الحالي</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black font-mono">
                  {summary ? summary.currentStock.toLocaleString('ar-SA') : 0}
                </span>
                <span className="text-xs text-emerald-400 font-bold">{baseUnit?.name}</span>
              </div>
              {summary?.status === 'OUT_OF_STOCK' && (
                <span className="inline-block mt-2 text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded">
                  نفد المخزون
                </span>
              )}
              {summary?.status === 'LOW_STOCK' && (
                <span className="inline-block mt-2 text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                  مخزون منخفض (أقل من {currentLiveItem.minStockAlert})
                </span>
              )}
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <span className="text-xs text-emerald-700 block mb-1">إجمالي الوارد (الدخول)</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold font-mono text-emerald-900">
                  {summary ? summary.totalIn.toLocaleString('ar-SA') : 0}
                </span>
                <span className="text-xs text-emerald-700 font-bold">{baseUnit?.name}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
              <span className="text-xs text-rose-700 block mb-1">إجمالي الصادر (الخروج)</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold font-mono text-rose-900">
                  {summary ? summary.totalOut.toLocaleString('ar-SA') : 0}
                </span>
                <span className="text-xs text-rose-700 font-bold">{baseUnit?.name}</span>
              </div>
            </div>
          </div>

          {/* Equivalents in Configured Units */}
          {summary && summary.formattedBalances.length > 1 && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-emerald-600" />
                معادل الرصيد الحالي بالوحدات المخصصة لهذا الصنف:
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {summary.formattedBalances.map((fb, idx) => (
                  <div key={idx} className="p-2.5 bg-white rounded-lg border border-slate-100 shadow-2xs">
                    <span className="text-[11px] text-slate-500 block">{fb.unitName}</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-base font-bold font-mono text-slate-900">
                        {fb.equivalent}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {fb.factor > 1 ? `(${fb.factor} ${baseUnit?.name})` : '(أساسية)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Movement Buttons */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onClose();
                  onRecordMovement(item, 'IN');
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>تسجيل دخول كميات لهذا الصنف</span>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onRecordMovement(item, 'OUT');
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>تسجيل خروج كميات لهذا الصنف</span>
              </button>
            </div>
          )}

          {/* Movement History for this Item */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-500" />
              سجل حركات هذا الصنف ({itemMovements.length})
            </h4>

            {itemMovements.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl">
                لا توجد حركات مسجلة لهذا الصنف بعد. يمكنك تسجيل أول حركة دخول عبر الزر أعلاه.
              </p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {itemMovements.map((m, idx) => {
                  const mUnit = units.find((u) => u.id === m.unitId)?.name || 'وحدة';
                  return (
                    <div key={m.id ? `${m.id}_${idx}` : idx} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50">

                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center ${
                            m.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {m.type === 'IN' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900">
                            {m.type === 'IN' ? 'دخول / توريد' : 'خروج / صرف'}: {m.quantity} {mUnit}
                            {m.factorApplied > 1 && (
                              <span className="text-slate-400 font-normal mr-1">
                                (= {m.baseQuantity} {baseUnit?.name})
                              </span>
                            )}
                          </div>
                          {m.notes && <p className="text-[11px] text-slate-500 mt-0.5">{m.notes}</p>}
                        </div>
                      </div>

                      <div className="text-left font-mono text-[11px] text-slate-400">
                        {new Date(m.date).toLocaleDateString('ar-SA')}
                        {m.referenceNumber && (
                          <div className="text-[10px] text-slate-500">#{m.referenceNumber}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
