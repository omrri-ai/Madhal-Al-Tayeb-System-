import React from 'react';
import {
  X,
  Archive,
  Trash2,
  RotateCcw,
  Tag,
  Scale,
  Boxes,
  Calendar,
  AlertCircle,
  FileText,
  Clock,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import { Item } from '../../types/inventory';
import { useInventory } from '../../context/InventoryContext';
import { isIncomingMovement, isOutgoingMovement } from '../../utils/arabicSearch';

interface ItemArchiveDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  mode: 'archive' | 'trash';
  onRestore: (item: Item) => void;
  onMoveToTrash?: (item: Item) => void;
  onPermanentDelete?: (item: Item) => void;
}

export const ItemArchiveDetailModal: React.FC<ItemArchiveDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  mode,
  onRestore,
  onMoveToTrash,
  onPermanentDelete,
}) => {
  const { categories, units, getItemStock, movements } = useInventory();

  if (!isOpen || !item) return null;

  const category = categories.find((c) => c.id === item.categoryId);
  const baseUnit = units.find((u) => u.id === item.baseUnitId);
  const stock = getItemStock(item.id);

  // Movements associated with this item
  const itemMovements = movements.filter((m) => m.itemId === item.id);
  const totalInQty = itemMovements
    .filter((m) => isIncomingMovement(m.type) || (m.type === 'ADJUSTMENT' && (m.baseQuantity ?? m.quantity) > 0))
    .reduce((sum, m) => sum + m.baseQuantity, 0);
  const totalOutQty = itemMovements
    .filter((m) => isOutgoingMovement(m.type) || (m.type === 'ADJUSTMENT' && (m.baseQuantity ?? m.quantity) < 0))
    .reduce((sum, m) => sum + Math.abs(m.baseQuantity), 0);

  const isTrash = mode === 'trash' || item.isDeleted;
  const reasonText = isTrash ? item.deleteReason : item.archiveReason;
  const actionDate = item.updatedAt || item.createdAt;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className={`p-5 border-b flex items-center justify-between ${
          isTrash ? 'bg-rose-50/70 border-rose-100' : 'bg-amber-50/70 border-amber-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-xs ${
              isTrash ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
            }`}>
              {isTrash ? <Trash2 className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">{item.name}</h3>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isTrash ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isTrash ? 'في سلة المحذوفات' : 'صنف مؤرشف'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                رمز الصنف: {item.code}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-xl transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Reason Banner (Prominently Highlighted) */}
          <div className={`p-4 rounded-xl border ${
            isTrash
              ? 'bg-rose-50/90 border-rose-200 text-rose-950'
              : 'bg-amber-50/90 border-amber-200 text-amber-950'
          }`}>
            <div className="flex items-center gap-2 font-bold text-sm mb-1.5">
              <ShieldAlert className={`w-4 h-4 ${isTrash ? 'text-rose-600' : 'text-amber-600'}`} />
              <span>{isTrash ? 'سبب الحذف والنقل للمحذوفات:' : 'سبب الأرشفة:'}</span>
            </div>
            <p className="text-sm font-semibold leading-relaxed pr-6 bg-white/70 p-3 rounded-lg border border-slate-200/60 shadow-2xs">
              {reasonText ? (
                reasonText
              ) : (
                <span className="italic text-slate-400 font-normal">لم يتم تدوين سبب مخصص عند تنفيذ العملية</span>
              )}
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pr-1 font-mono">
              <span>تاريخ تنفيذ الإجراء: {new Date(actionDate).toLocaleString('ar-SA')}</span>
              {item.editReason && (
                <span>آخر تعديل سابق: {item.editReason}</span>
              )}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">الرصيد المحفوظ</span>
              <span className="text-base font-black font-mono text-slate-900 block">
                {stock} {baseUnit?.name || 'وحدة'}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">القسم / التصنيف</span>
              <span className="text-xs font-bold text-slate-800 block truncate">
                {category?.name || 'غير محدد'}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">الوحدة الأساسية</span>
              <span className="text-xs font-bold text-slate-800 block">
                {baseUnit?.name || 'وحدة'}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">حد التنبيه الأدنى</span>
              <span className="text-base font-black font-mono text-amber-700 block">
                {item.minStockAlert} {baseUnit?.name || 'وحدة'}
              </span>
            </div>
          </div>

          {/* Detailed Item Specifications */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>المواصفات والتحويلات المخصصة للصنف</span>
            </h4>

            {/* Custom Conversions */}
            <div>
              <span className="text-xs font-semibold text-slate-600 block mb-1.5">معاملات تحويل الوحدات:</span>
              {item.conversions && item.conversions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {item.conversions.map((conv, idx) => {
                    const convUnit = units.find((u) => u.id === conv.unitId);
                    return (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-mono border border-slate-200"
                      >
                        <Scale className="w-3 h-3 text-slate-500" />
                        <span>1 {convUnit?.name || 'وحدة'}</span>
                        <span className="text-slate-400">=</span>
                        <span className="font-bold text-emerald-700">{conv.factorToBase} {baseUnit?.name || 'وحدة'}</span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">لا توجد وحدات تحويل إضافية (يعتمد على الوحدة الأساسية فقط)</span>
              )}
            </div>

            {/* Pricing if available */}
            {(item.costPrice !== undefined || item.salePrice !== undefined) && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                {item.costPrice !== undefined && (
                  <div className="text-xs">
                    <span className="text-slate-500">سعر التكلفة للوحدة:</span>{' '}
                    <span className="font-bold font-mono text-slate-900">{item.costPrice} ر.س</span>
                  </div>
                )}
                {item.salePrice !== undefined && (
                  <div className="text-xs">
                    <span className="text-slate-500">سعر البيع للوحدة:</span>{' '}
                    <span className="font-bold font-mono text-emerald-700">{item.salePrice} ر.س</span>
                  </div>
                )}
              </div>
            )}

            {/* Item Notes */}
            {item.notes && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-600 block mb-1">ملاحظات الصنف:</span>
                <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
                  {item.notes}
                </p>
              </div>
            )}
          </div>

          {/* Historical Movement Summary */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/60 pb-2 mb-3">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>سجل الحركات السابقة المحفوظة ({itemMovements.length} حركة)</span>
            </h4>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-[10px] text-slate-500 block mb-0.5">إجمالي الوارد</span>
                <span className="font-bold font-mono text-emerald-700">+{totalInQty} {baseUnit?.name}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-[10px] text-slate-500 block mb-0.5">إجمالي الصادر</span>
                <span className="font-bold font-mono text-rose-700">-{totalOutQty} {baseUnit?.name}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-[10px] text-slate-500 block mb-0.5">الرصيد المتبقي</span>
                <span className="font-black font-mono text-slate-900">{stock} {baseUnit?.name}</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              جميع الحركات المسجلة سابقاً لهذا الصنف محفوظة في سجل الحركات العام ولن تتأثر.
            </p>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Restore action */}
            <button
              onClick={() => {
                onClose();
                onRestore(item);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>استعادة الصنف للنشاط</span>
            </button>

            {/* Move to trash if archived */}
            {!isTrash && onMoveToTrash && (
              <button
                onClick={() => {
                  onClose();
                  onMoveToTrash(item);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>نقل لسلة المحذوفات</span>
              </button>
            )}

            {/* Permanent delete if already in trash */}
            {isTrash && onPermanentDelete && (
              <button
                onClick={() => {
                  onClose();
                  onPermanentDelete(item);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>حذف نهائي</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-200/60 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
