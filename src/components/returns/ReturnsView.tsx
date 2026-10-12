/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ReturnRecord, ReturnType, ReturnStatus } from '../../types/inventory';
import { ReturnFormModal } from './ReturnFormModal';
import { ReturnDetailsModal } from './ReturnDetailsModal';
import { Plus, Search, Filter, ArrowDownLeft, ArrowUpRight, CheckCircle, Clock, Ban, Eye, RotateCcw } from 'lucide-react';

export const ReturnsView: React.FC = () => {
  const { returns, items, units } = useInventory();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRecord | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | ReturnType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReturnStatus>('ALL');

  const filteredReturns = returns.filter((ret) => {
    if (typeFilter !== 'ALL' && ret.type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && ret.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = ret.returnNumber.toLowerCase().includes(q);
      const matchParty = (ret.partyName || '').toLowerCase().includes(q);
      const matchBranch = (ret.branchName || '').toLowerCase().includes(q);
      const matchRef = (ret.originalReferenceNumber || '').toLowerCase().includes(q);
      if (!matchNumber && !matchParty && !matchBranch && !matchRef) return false;
    }

    return true;
  });

  const totalInReturns = returns.filter((r) => r.type === 'RETURN_IN' && r.status === 'APPROVED').length;
  const totalOutReturns = returns.filter((r) => r.type === 'RETURN_OUT' && r.status === 'APPROVED').length;
  const draftReturns = returns.filter((r) => r.status === 'DRAFT').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs tracking-wider uppercase">
            <RotateCcw className="w-4 h-4" />
            <span>نظام إدارة المخزون والمستودعات</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">إدارة المرتجعات</h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-xl leading-relaxed">
            تسجيل ومتابعة مرتجعات العملاء والفروع (وارد) والمرتجعات إلى الموردين (صادر) مع الربط الفعلي بأرصدة المخزون والحركات.
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="relative z-10 px-6 py-3.5 bg-white text-slate-900 hover:bg-slate-100 rounded-2xl font-bold text-sm shadow-lg shadow-black/20 transition flex items-center gap-2 shrink-0"
        >
          <Plus className="w-5 h-5 text-emerald-600" />
          <span>تسجيل مرتجع جديد</span>
        </button>

        {/* Decorative background shapes */}
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-20 -top-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">مرتجعات واردة (معتمدة)</span>
            <span className="text-2xl font-black text-slate-900">{totalInReturns}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">مرتجعات صادرة (معتمدة)</span>
            <span className="text-2xl font-black text-slate-900">{totalOutReturns}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">مسودات بانتظار الاعتماد</span>
            <span className="text-2xl font-black text-slate-900">{draftReturns}</span>
          </div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم المرتجع، العميل، الفرع..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900 outline-none bg-slate-50/50"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                typeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setTypeFilter('RETURN_IN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                typeFilter === 'RETURN_IN' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              وارد
            </button>
            <button
              onClick={() => setTypeFilter('RETURN_OUT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                typeFilter === 'RETURN_OUT' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              صادر
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              جميع الحالات
            </button>
            <button
              onClick={() => setStatusFilter('APPROVED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === 'APPROVED' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              معتمد
            </button>
            <button
              onClick={() => setStatusFilter('DRAFT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === 'DRAFT' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              مسودة
            </button>
          </div>
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredReturns.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <RotateCcw className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-700">لا توجد سجلات مرتجعات مطابقة</h3>
            <p className="text-xs text-slate-500">جرب تغيير شروط البحث أو اضغط على تسجيل مرتجع جديد.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700 text-xs font-bold border-b border-slate-200">
                  <th className="p-4">رقم السند</th>
                  <th className="p-4">النوع</th>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4">الجهة / الفرع</th>
                  <th className="p-4">عدد الأصناف</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReturns.map((ret) => {
                  const firstItem = items.find((i) => i.id === ret.items[0]?.itemId);

                  return (
                    <tr key={ret.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 font-bold text-slate-900">#{ret.returnNumber}</td>
                      <td className="p-4">
                        {ret.type === 'RETURN_IN' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            وارد
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            صادر
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-slate-600">
                        {new Date(ret.date).toLocaleDateString('ar-SA')}
                      </td>
                      <td className="p-4 font-semibold text-slate-800">
                        {ret.destinationType === 'BRANCH'
                          ? `فرع: ${ret.branchName || 'فرع'}`
                          : ret.partyName || 'جهة غير محددة'}
                      </td>
                      <td className="p-4 text-slate-700 font-semibold">
                        {ret.items.length} أصناف
                        {firstItem && <span className="text-xs text-slate-400 block font-normal">({firstItem.name})</span>}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                            ret.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ret.status === 'DRAFT'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {ret.status === 'APPROVED' && <CheckCircle className="w-3 h-3" />}
                          {ret.status === 'DRAFT' && <Clock className="w-3 h-3" />}
                          {ret.status === 'CANCELLED' && <Ban className="w-3 h-3" />}
                          {ret.status === 'APPROVED'
                            ? 'معتمد'
                            : ret.status === 'DRAFT'
                            ? 'مسودة'
                            : 'ملغي'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedReturn(ret);
                            setIsDetailsOpen(true);
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض التفاصيل</span>
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

      {/* Modals */}
      <ReturnFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />
      <ReturnDetailsModal
        returnRecord={selectedReturn}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedReturn(null);
        }}
      />
    </div>
  );
};
