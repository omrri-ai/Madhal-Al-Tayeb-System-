import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  MoreVertical,
  Archive,
  Trash2,
  Edit,
  Eye,
  AlertTriangle,
  Scale,
  LayoutGrid,
  List,
  RefreshCw,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { Item, ItemStockSummary } from '../../types/inventory';
import { ItemDetailModal } from './ItemDetailModal';

interface ItemsViewProps {
  onOpenAddItem: () => void;
  onEditItem: (item: Item) => void;
  onOpenMovementModal: (item: Item, type: 'IN' | 'OUT') => void;
  onRequestDelete: (item: Item) => void;
  onRequestArchive: (item: Item) => void;
}

export const ItemsView: React.FC<ItemsViewProps> = ({
  onOpenAddItem,
  onEditItem,
  onOpenMovementModal,
  onRequestDelete,
  onRequestArchive,
}) => {
  const { getAllItemsSummary, categories, units, recoverOrphanedLocalData, showToast } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [viewLayout, setViewLayout] = useState<'table' | 'grid'>('table');
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const itemsSummaries = useMemo(() => {
    return getAllItemsSummary(false, false);
  }, [getAllItemsSummary]);

  const filteredSummaries = useMemo(() => {
    return itemsSummaries.filter((s) => {
      // Search
      const matchesSearch =
        s.item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.item.notes && s.item.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      // Category
      const matchesCategory =
        selectedCategory === 'ALL' || s.item.categoryId === selectedCategory;

      // Status
      const matchesStatus =
        stockStatusFilter === 'ALL' || s.status === stockStatusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [itemsSummaries, searchQuery, selectedCategory, stockStatusFilter]);

  return (
    <div className="space-y-6">
      {/* Search & Filter Header Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، الرمز (SKU)، أو الملاحظات..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-colors"
            />
          </div>

          {/* Action & Layout Buttons */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setViewLayout('table')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewLayout === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="عرض جدول"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewLayout('grid')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewLayout === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="عرض بطاقات"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={onOpenAddItem}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة صنف</span>
            </button>
          </div>
        </div>

        {/* Filter Badges Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-medium">الأقسام:</span>
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الكل ({itemsSummaries.length})
          </button>
          {categories.map((c) => {
            const count = itemsSummaries.filter((s) => s.item.categoryId === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  selectedCategory === c.id
                    ? 'bg-slate-900 text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c.name} ({count})
              </button>
            );
          })}

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          <span className="text-slate-400 font-medium">حالة الرصيد:</span>
          <button
            onClick={() => setStockStatusFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg cursor-pointer ${
              stockStatusFilter === 'ALL' ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            الكل
          </button>
          <button
            onClick={() => setStockStatusFilter('IN_STOCK')}
            className={`px-2.5 py-1 rounded-lg cursor-pointer ${
              stockStatusFilter === 'IN_STOCK' ? 'bg-emerald-100 text-emerald-800 font-bold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            متوفر
          </button>
          <button
            onClick={() => setStockStatusFilter('LOW_STOCK')}
            className={`px-2.5 py-1 rounded-lg cursor-pointer ${
              stockStatusFilter === 'LOW_STOCK' ? 'bg-amber-100 text-amber-800 font-bold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            منخفض
          </button>
          <button
            onClick={() => setStockStatusFilter('OUT_OF_STOCK')}
            className={`px-2.5 py-1 rounded-lg cursor-pointer ${
              stockStatusFilter === 'OUT_OF_STOCK' ? 'bg-rose-100 text-rose-800 font-bold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            نافد (0)
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredSummaries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Boxes className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            {itemsSummaries.length === 0 ? 'لا توجد أصناف في المخزون حتى الآن' : 'لم يتم العثور على نتائج'}
          </h3>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            {itemsSummaries.length === 0
              ? 'ابدأ بإضافة أول صنف لمخزونك مع تحديد قسمه ووحدته الأساسية وتحويلاته الخاصة.'
              : 'جرب تعديل كلمات البحث أو تصفية الأقسام والحالات للعثور على الصنف.'}
          </p>
          {itemsSummaries.length === 0 ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={onOpenAddItem}
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة الصنف الأول الآن</span>
              </button>

              <button
                onClick={async () => {
                  setIsRecovering(true);
                  const res = await recoverOrphanedLocalData();
                  showToast(res.message, res.success ? 'success' : 'info');
                  setIsRecovering(false);
                }}
                disabled={isRecovering}
                className="w-full sm:w-auto px-5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-sm rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-2"
                title="فحص ذاكرة المتصفح لاسترجاع أي أصناف سُجلت أثناء انقطاع الإنترنت"
              >
                <RefreshCw className={`w-4 h-4 ${isRecovering ? 'animate-spin' : ''}`} />
                <span>{isRecovering ? 'جارٍ الفحص...' : 'فحص واسترجاع بيانات الأوفلاين'}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
                setStockStatusFilter('ALL');
              }}
              className="px-4 py-2 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              إلغاء التصفية
            </button>
          )}
        </div>
      ) : viewLayout === 'table' ? (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">الصنف والرمز</th>
                  <th className="py-3.5 px-4">القسم</th>
                  <th className="py-3.5 px-4">الوحدة الأساسية</th>
                  <th className="py-3.5 px-4">التحويلات المخصصة</th>
                  <th className="py-3.5 px-4">الرصيد الفعلي</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4 text-center">إجراءات سريعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredSummaries.map((s) => {
                  return (
                    <tr key={s.item.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Name & Code */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => setDetailItem(s.item)}
                          className="text-right hover:text-emerald-700 transition-colors cursor-pointer group-hover:underline font-bold text-slate-900 block"
                        >
                          {s.item.name}
                        </button>
                        <span className="text-[11px] font-mono text-slate-400 mt-0.5 block">
                          {s.item.code}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                        {s.categoryName}
                      </td>

                      {/* Base Unit */}
                      <td className="py-3.5 px-4 text-xs font-bold text-slate-700">
                        {s.baseUnitName}
                      </td>

                      {/* Conversions preview */}
                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        {s.item.conversions.length === 0 ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {s.item.conversions.map((conv) => {
                              const uName = units.find((u) => u.id === conv.unitId)?.name || 'وحدة';
                              return (
                                <span
                                  key={conv.unitId}
                                  className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
                                >
                                  1 {uName} = {conv.factorToBase} {s.baseUnitName}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Balance in Base Unit & Equivalent */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-baseline gap-1.5 font-bold font-mono text-base text-slate-900">
                          <span>{s.currentStock.toLocaleString('ar-SA')}</span>
                          <span className="text-xs text-slate-500 font-sans font-medium">
                            {s.baseUnitName}
                          </span>
                        </div>
                        {/* If compound units exist, preview first conversion */}
                        {s.formattedBalances.length > 1 && s.currentStock > 0 && (
                          <span className="text-[11px] text-slate-400 block font-mono">
                            ≈ {s.formattedBalances[1].equivalent} {s.formattedBalances[1].unitName}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {s.status === 'OUT_OF_STOCK' && (
                          <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full inline-block">
                            نفد المخزون
                          </span>
                        )}
                        {s.status === 'LOW_STOCK' && (
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full inline-block">
                            منخفض ({s.currentStock})
                          </span>
                        )}
                        {s.status === 'IN_STOCK' && (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full inline-block">
                            متوفر
                          </span>
                        )}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* In movement */}
                          <button
                            onClick={() => onOpenMovementModal(s.item, 'IN')}
                            title="تسجيل وارد"
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                          >
                            <ArrowDownLeft className="w-4 h-4" />
                          </button>

                          {/* Out movement */}
                          <button
                            onClick={() => onOpenMovementModal(s.item, 'OUT')}
                            title="تسجيل صادر"
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors cursor-pointer"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>

                          {/* Details */}
                          <button
                            onClick={() => setDetailItem(s.item)}
                            title="تفاصيل الصنف"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => onEditItem(s.item)}
                            title="تعديل الصنف"
                            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* Archive */}
                          <button
                            onClick={() => onRequestArchive(s.item)}
                            title="أرشفة الصنف"
                            className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Archive className="w-4 h-4" />
                          </button>

                          {/* Soft Delete */}
                          <button
                            onClick={() => onRequestDelete(s.item)}
                            title="نقل إلى سلة المحذوفات"
                            className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSummaries.map((s) => (
            <div
              key={s.item.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4
                      onClick={() => setDetailItem(s.item)}
                      className="font-bold text-slate-900 text-base hover:text-emerald-700 cursor-pointer"
                    >
                      {s.item.name}
                    </h4>
                    <span className="text-xs font-mono text-slate-400">{s.item.code}</span>
                  </div>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                    {s.categoryName}
                  </span>
                </div>

                {/* Stock Display */}
                <div className="my-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block">الرصيد الفعلي:</span>
                    <div className="flex items-baseline gap-1 font-bold font-mono text-lg text-slate-900">
                      <span>{s.currentStock.toLocaleString('ar-SA')}</span>
                      <span className="text-xs font-sans text-slate-500">{s.baseUnitName}</span>
                    </div>
                  </div>
                  <div>
                    {s.status === 'OUT_OF_STOCK' && (
                      <span className="text-xs font-bold text-rose-700 bg-rose-100/70 px-2.5 py-1 rounded-lg">
                        نفد المخزون
                      </span>
                    )}
                    {s.status === 'LOW_STOCK' && (
                      <span className="text-xs font-bold text-amber-700 bg-amber-100/70 px-2.5 py-1 rounded-lg">
                        منخفض
                      </span>
                    )}
                    {s.status === 'IN_STOCK' && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-lg">
                        متوفر
                      </span>
                    )}
                  </div>
                </div>

                {/* Conversions snippet */}
                {s.item.conversions.length > 0 && (
                  <div className="text-[11px] text-slate-500 mb-3 space-y-1">
                    <span className="font-semibold text-slate-600 block">التحويلات:</span>
                    <div className="flex flex-wrap gap-1">
                      {s.item.conversions.map((c) => {
                        const u = units.find((unit) => unit.id === c.unitId);
                        return (
                          <span
                            key={c.unitId}
                            className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]"
                          >
                            1 {u?.name} = {c.factorToBase} {s.baseUnitName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenMovementModal(s.item, 'IN')}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>وارد</span>
                  </button>
                  <button
                    onClick={() => onOpenMovementModal(s.item, 'OUT')}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>صادر</span>
                  </button>
                </div>

                <div className="flex items-center gap-1 text-slate-400">
                  <button
                    onClick={() => setDetailItem(s.item)}
                    className="p-1.5 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
                    title="تفاصيل"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onEditItem(s.item)}
                    className="p-1.5 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
                    title="تعديل"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onRequestArchive(s.item)}
                    className="p-1.5 hover:text-amber-700 rounded-lg hover:bg-amber-50 cursor-pointer"
                    title="أرشفة"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onRequestDelete(s.item)}
                    className="p-1.5 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Item Detail Modal */}
      <ItemDetailModal
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
        item={detailItem}
        onEdit={(item) => onEditItem(item)}
        onRecordMovement={(item, type) => onOpenMovementModal(item, type)}
      />
    </div>
  );
};
