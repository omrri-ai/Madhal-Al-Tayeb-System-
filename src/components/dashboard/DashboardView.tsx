import React, { useMemo, useState } from 'react';
import {
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  FolderTree,
  Plus,
  Clock,
  Truck,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Printer,
  FileText,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { NavView } from '../common/Navigation';
import { StockMovement } from '../../types/inventory';
import { MovementVoucherModal } from '../movements/MovementVoucherModal';

interface DashboardViewProps {
  onNavigate: (view: NavView) => void;
  onOpenQuickMovement: (type?: 'IN' | 'OUT') => void;
  onOpenOutgoingDispatch?: () => void;
  onOpenAddItem: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenQuickMovement,
  onOpenOutgoingDispatch,
  onOpenAddItem,
}) => {
  const { stats, items, movements, units, categories, getItemStock } = useInventory();
  const [voucherMovement, setVoucherMovement] = useState<StockMovement | null>(null);
  const [movementFilter, setMovementFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  // Filtered movements for the invoice table
  const filteredMovements = useMemo(() => {
    let list = movements;
    if (movementFilter === 'IN') list = list.filter((m) => m.type === 'IN');
    if (movementFilter === 'OUT') list = list.filter((m) => m.type === 'OUT');
    return list.slice(0, 15);
  }, [movements, movementFilter]);

  return (
    <div className="space-y-6">
      {/* Welcome & Brand Banner: نظام مخزون مدهال الطيب */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 sm:p-7 text-white shadow-md relative overflow-hidden border border-emerald-900/30">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="text-[11px] bg-white/10 text-emerald-200 px-3 py-1 rounded-full font-bold">
              إدارة المخزون والفواتير وسندات الشحن
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black mb-2 text-white leading-tight">
            لوحة التحكم الرئيسية وسجل الفواتير
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6">
            متابعة حركة المستودع اللحظية، وإصدار وطباعة فواتير وسندات الصادر والوارد، وتصدير الشحنات للفروع والعملاء عبر سمسا وفاستيلو وأرامكس بدون رصيد سالب نهائياً.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onOpenQuickMovement('IN')}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>تسجيل وارد وفاتورة توريد (+)</span>
            </button>

            <button
              onClick={() => {
                if (onOpenOutgoingDispatch) {
                  onOpenOutgoingDispatch();
                } else {
                  onOpenQuickMovement('OUT');
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/30 transition-all cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span>قسم صادر وفواتير التصدير للشحن (-)</span>
            </button>

            <button
              onClick={() => onNavigate('movements')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-white/10"
            >
              <FileText className="w-4 h-4" />
              <span>عرض سجل الفواتير الشامل</span>
            </button>

            <button
              onClick={() => onNavigate('returns')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-white/10"
            >
              <RotateCcw className="w-4 h-4 text-emerald-400" />
              <span>قسم المرتجعات ({stats.totalReturnsCount || 0})</span>
            </button>

            <button
              onClick={onOpenAddItem}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-white/10"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة صنف جديد</span>
            </button>
          </div>
        </div>

        {/* Decorative background shape */}
        <div className="absolute left-[-5%] bottom-[-20%] w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Primary Clean Corner Stats (Corner layout without repeated metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Active Items */}
        <div
          onClick={() => onNavigate('items')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">الأصناف بالمستودع</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-700 flex items-center justify-center transition-colors">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
            {stats.activeItemsCount.toLocaleString('ar-SA')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>من إجمالي {stats.totalItemsCount} مسجل</span>
            <span className="text-emerald-600 group-hover:translate-x-[-3px] transition-transform font-bold">الأصناف ←</span>
          </div>
        </div>

        {/* Categories */}
        <div
          onClick={() => onNavigate('categories')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">الأقسام والتصنيفات</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-700 flex items-center justify-center transition-colors">
              <FolderTree className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
            {stats.categoriesCount.toLocaleString('ar-SA')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>أقسام المستودع</span>
            <span className="text-emerald-600 group-hover:translate-x-[-3px] transition-transform font-bold">الأقسام ←</span>
          </div>
        </div>

        {/* Today's Inward */}
        <div
          onClick={() => onNavigate('movements')}
          className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-emerald-700">وارد اليوم (توريد)</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-800">
            {stats.todayInQuantityBase.toLocaleString('ar-SA')}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">
            {stats.todayInMovementsCount} حركة واردة مسجلة
          </div>
        </div>

        {/* Today's Outward */}
        <div
          onClick={() => onNavigate('movements')}
          className="bg-white p-5 rounded-2xl border border-rose-100 shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-rose-700">صادر اليوم (خرجيات)</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-rose-800">
            {stats.todayOutQuantityBase.toLocaleString('ar-SA')}
          </div>
          <div className="text-[11px] text-rose-600 mt-1">
            {stats.todayOutMovementsCount} حركة صادرة مسجلة
          </div>
        </div>

        {/* Returns Stat Card */}
        <div
          onClick={() => onNavigate('returns')}
          className="bg-white p-5 rounded-2xl border border-blue-100 shadow-2xs hover:shadow-md transition-all cursor-pointer group col-span-2 sm:col-span-1 lg:col-span-1"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-blue-700">سجل المرتجعات</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <RotateCcw className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-blue-900">
            {stats.totalReturnsCount.toLocaleString('ar-SA')}
          </div>
          <div className="text-[11px] text-blue-600 mt-1 flex items-center justify-between">
            <span>{stats.inReturnsCount} وارد · {stats.outReturnsCount} صادر</span>
            <span className="font-bold group-hover:translate-x-[-3px] transition-transform">المرتجعات ←</span>
          </div>
        </div>
      </div>

      {/* FULL-WIDTH RECENT INVOICES & OPERATIONS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-2xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                سجل الفواتير وسندات العمليات (صادر ووارد)
              </h3>
              <p className="text-xs text-slate-500">
                عرض مباشر لفواتير التوريد، وسندات التصدير والشحن، مع إمكانية المعاينة والطباعة الفورية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setMovementFilter('ALL')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  movementFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل ({movements.length})
              </button>
              <button
                onClick={() => setMovementFilter('OUT')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  movementFilter === 'OUT'
                    ? 'bg-rose-600 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-rose-700'
                }`}
              >
                فواتير الصادر والشحن (-)
              </button>
              <button
                onClick={() => setMovementFilter('IN')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  movementFilter === 'IN'
                    ? 'bg-emerald-600 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                فواتير الوارد والتوريد (+)
              </button>
            </div>

            <button
              onClick={() => onNavigate('movements')}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              عرض السجل الكامل ←
            </button>
          </div>
        </div>

        {filteredMovements.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-3">
            <p>لا توجد أي فواتير أو حركات مخزنية مسجلة حتى الآن في هذا التصنيف.</p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => onOpenQuickMovement('IN')}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-xs"
              >
                + تسجيل وارد
              </button>
              <button
                onClick={() => {
                  if (onOpenOutgoingDispatch) onOpenOutgoingDispatch();
                  else onOpenQuickMovement('OUT');
                }}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-lg font-bold text-xs"
              >
                - تسجيل صادر
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs min-w-[700px]">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap">نوع الفاتورة / الحركة</th>
                  <th className="py-3 px-4 whitespace-nowrap">الصنف والرمز</th>
                  <th className="py-3 px-4 whitespace-nowrap">الكمية والوحدة</th>
                  <th className="py-3 px-4 whitespace-nowrap">الوجهة / المستند</th>
                  <th className="py-3 px-4 whitespace-nowrap">التاريخ والوقت</th>
                  <th className="py-3 px-4 whitespace-nowrap">ملاحظات</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">الفاتورة والسند</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredMovements.map((m) => {
                  const item = items.find((i) => i.id === m.itemId);
                  const unit = units.find((u) => u.id === m.unitId);
                  const baseUnit = units.find((u) => u.id === item?.baseUnitId);

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Type Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                            m.type === 'IN'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {m.type === 'IN' ? (
                            <>
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              <span>فاتورة توريد (وارد)</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              <span>سند تصدير (صادر)</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Item */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900 block text-xs">
                          {item?.name || 'صنف محذوف'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item?.code || '-'}
                        </span>
                      </td>

                      {/* Quantity & Unit */}
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        <div
                          className={`font-black text-sm ${
                            m.type === 'IN' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {m.type === 'IN' ? '+' : '-'}
                          {m.quantity} {unit?.name || 'وحدة'}
                        </div>
                        {m.factorApplied > 1 && (
                          <div className="text-[10px] text-slate-400">
                            (= {m.baseQuantity} {baseUnit?.name})
                          </div>
                        )}
                      </td>

                      {/* Destination / Ref */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {m.destinationType === 'BRANCH' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            <Building2 className="w-3 h-3 text-blue-600" />
                            <span>{m.branchName || 'تصدير لفرع'}</span>
                          </span>
                        ) : m.destinationType === 'CUSTOMER' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            <Truck className="w-3 h-3 text-purple-600" />
                            <span>
                              {m.customerName} ({m.shippingCompany || 'شحن'})
                            </span>
                          </span>
                        ) : m.referenceNumber ? (
                          <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            #{m.referenceNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        <div>{new Date(m.date).toLocaleDateString('ar-SA')}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(m.date).toLocaleTimeString('ar-SA', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Notes */}
                      <td className="py-3 px-4 text-slate-500 text-[11px] max-w-[200px] truncate">
                        {m.notes || '-'}
                      </td>

                      {/* Print Invoice Action Button */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setVoucherMovement(m)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                          title="عرض وطباعة الفاتورة والسند (PDF)"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-600" />
                          <span>طباعة الفاتورة</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice & Voucher Printable Modal */}
      {voucherMovement && (
        <MovementVoucherModal
          isOpen={!!voucherMovement}
          onClose={() => setVoucherMovement(null)}
          movement={voucherMovement}
          item={items.find((i) => i.id === voucherMovement.itemId) || null}
          unit={units.find((u) => u.id === voucherMovement.unitId) || null}
          baseUnit={
            units.find(
              (u) =>
                u.id ===
                (items.find((i) => i.id === voucherMovement.itemId)?.baseUnitId)
            ) || null
          }
          category={
            categories.find(
              (c) =>
                c.id ===
                (items.find((i) => i.id === voucherMovement.itemId)?.categoryId)
            ) || null
          }
          currentStock={getItemStock(voucherMovement.itemId)}
        />
      )}
    </div>
  );
};
