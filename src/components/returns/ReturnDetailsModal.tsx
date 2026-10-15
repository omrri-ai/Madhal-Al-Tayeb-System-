/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { ReturnRecord } from '../../types/inventory';
import { X, Printer, CheckCircle, Ban, ArrowDownLeft, ArrowUpRight, Building2, User, Phone, FileText, Calendar, ShieldCheck } from 'lucide-react';

interface ReturnDetailsModalProps {
  returnRecord: ReturnRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReturnDetailsModal: React.FC<ReturnDetailsModalProps> = ({ returnRecord, isOpen, onClose }) => {
  const { items, units, approveReturn, cancelReturn, showToast } = useInventory();
  const { isAdmin } = useAuth();
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);

  if (!isOpen || !returnRecord) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleApprove = () => {
    const res = approveReturn(returnRecord.id);
    if (res.success) {
      showToast('تم اعتماد المرتجع وتحديث المخزون بنجاح', 'success');
    }
  };

  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReasonInput.trim()) {
      showToast('يرجى إدخال سبب الإلغاء', 'error');
      return;
    }
    const res = cancelReturn(returnRecord.id, cancelReasonInput.trim());
    if (res.success) {
      setShowCancelPrompt(false);
      setCancelReasonInput('');
      showToast('تم إلغاء المرتجع وتطبيق الحركة العكسية على المخزون بنجاح', 'success');
    }
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'DAMAGED':
        return 'بضاعة تالفة / متضررة';
      case 'DEFECTIVE':
        return 'عيب صناعي';
      case 'EXPIRED':
        return 'منتهي الصلاحية';
      case 'WRONG_ITEM':
        return 'صنف غير مطلوب / خطأ في الطلب';
      case 'SURPLUS':
        return 'فائض عن الحاجة';
      case 'CUSTOMER_REQUEST':
        return 'رغبة العميل في الإرجاع';
      default:
        return 'سبب آخر';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl">
              {returnRecord.type === 'RETURN_IN' ? (
                <ArrowDownLeft className="w-6 h-6 text-emerald-400" />
              ) : (
                <ArrowUpRight className="w-6 h-6 text-amber-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold">سند مرتجع #{returnRecord.returnNumber}</h2>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    returnRecord.status === 'APPROVED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : returnRecord.status === 'DRAFT'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {returnRecord.status === 'APPROVED'
                    ? 'معتمد'
                    : returnRecord.status === 'DRAFT'
                    ? 'مسودة'
                    : 'ملغي'}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {returnRecord.type === 'RETURN_IN' ? 'مرتجع وارد إلى المستودع' : 'مرتجع صادر من المستودع'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold"
              title="طباعة"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">طباعة</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 print:p-0">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-xs text-slate-500 block mb-1">نوع وجهة المرتجع</span>
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>
                  {returnRecord.destinationType === 'BRANCH'
                    ? `فرع: ${returnRecord.branchName || 'فرع داخلي'}`
                    : returnRecord.destinationType === 'CUSTOMER'
                    ? `عميل: ${returnRecord.partyName || 'غير متوفر'}`
                    : `مورد: ${returnRecord.partyName || 'غير متوفر'}`}
                </span>
              </div>
              {returnRecord.partyPhone && (
                <div className="flex items-center gap-1 text-xs text-slate-600 mt-1">
                  <Phone className="w-3 h-3" />
                  <span>{returnRecord.partyPhone}</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-xs text-slate-500 block mb-1">معلومات العملية</span>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>{new Date(returnRecord.date).toLocaleString('ar-SA')}</span>
              </div>
              {returnRecord.originalReferenceNumber && (
                <div className="text-xs text-slate-600 mt-1">
                  المرجع الأصلي: <strong>{returnRecord.originalReferenceNumber}</strong>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-xs text-slate-500 block mb-1">سبب المرتجع</span>
              <div className="text-sm font-bold text-slate-900">{getReasonLabel(returnRecord.reason)}</div>
              {returnRecord.reasonDescription && (
                <div className="text-xs text-slate-600 mt-1">{returnRecord.reasonDescription}</div>
              )}
            </div>
          </div>

          {/* Notes if any */}
          {returnRecord.notes && (
            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <span className="text-xs font-bold text-blue-900 block mb-0.5">ملاحظات إضافية</span>
                <p className="text-sm text-blue-800">{returnRecord.notes}</p>
              </div>
            </div>
          )}

          {/* Items Table */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">الأصناف في السند</h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-right border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-xs font-bold border-b border-slate-200">
                    <th className="p-3.5">الصنف</th>
                    <th className="p-3.5">الكمية</th>
                    <th className="p-3.5">الوحدة</th>
                    <th className="p-3.5">الكمية الأساسية</th>
                    <th className="p-3.5">ملاحظات الصنف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnRecord.items.map((row, idx) => {
                    const item = items.find((i) => i.id === row.itemId);
                    const unit = units.find((u) => u.id === row.unitId);
                    const baseUnit = item ? units.find((u) => u.id === item.baseUnitId) : null;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 font-semibold text-slate-900">
                          {item ? `${item.code} - ${item.name}` : 'صنف غير محدد'}
                        </td>
                        <td className="p-3.5 font-bold text-blue-600">{row.quantity}</td>
                        <td className="p-3.5 text-slate-700">{unit?.name || 'وحدة'}</td>
                        <td className="p-3.5 text-slate-600">
                          {row.baseQuantity} {baseUnit?.name || ''}
                        </td>
                        <td className="p-3.5 text-slate-500 text-xs">{row.notes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cancellation warning if cancelled */}
          {returnRecord.status === 'CANCELLED' && returnRecord.cancellationReason && (
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-rose-900 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-700">
                <Ban className="w-4 h-4" />
                <span>تم إلغاء هذه العملية</span>
              </div>
              <p>سبب الإلغاء: {returnRecord.cancellationReason}</p>
            </div>
          )}

          {/* Cancel prompt modal inside */}
          {showCancelPrompt && (
            <form onSubmit={handleCancelSubmit} className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3">
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>تأكيد إلغاء المرتجع (سيتم تطبيق حركة عكسية لاستعادة الرصيد الأصلي تلقائياً)</span>
              </div>
              <input
                type="text"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="أدخل سبب إلغاء السند إجبارياً..."
                className="w-full px-3 py-2 rounded-xl border border-amber-300 text-sm bg-white outline-none focus:ring-2 focus:ring-amber-600"
                required
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCancelPrompt(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300"
                >
                  تراجع
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700"
                >
                  تأكيد الإلغاء النهائي
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Action Buttons */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between no-print">
          <div className="text-xs text-slate-500">
            تم الإنشاء بواسطة: <strong>{returnRecord.createdByName || 'مدير النظام'}</strong>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && returnRecord.status === 'DRAFT' && (
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                اعتماد المرتجع الآن
              </button>
            )}
            {isAdmin && returnRecord.status === 'APPROVED' && !showCancelPrompt && (
              <button
                onClick={() => setShowCancelPrompt(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-600/20 cursor-pointer"
              >
                <Ban className="w-4 h-4" />
                إلغاء المرتجع
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
