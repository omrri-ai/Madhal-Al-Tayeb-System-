import React, { useState } from 'react';
import {
  X,
  Factory,
  Boxes,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Printer,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  FileText,
  Trash2,
} from 'lucide-react';
import { ProductionOrder } from '../../types/inventory';
import { useInventory } from '../../context/InventoryContext';
import { ProductionVoucherModal, ProductionVoucherType } from './ProductionVoucherModal';

interface ProductionOrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  onOpenDispatchForOrder?: (orderId: string) => void;
  onOpenConsumptionForOrder?: (orderId: string) => void;
  onOpenReceiptForOrder?: (orderId: string) => void;
  onOpenReturnForOrder?: (orderId: string) => void;
}

export const ProductionOrderDetailModal: React.FC<ProductionOrderDetailModalProps> = ({
  isOpen,
  onClose,
  orderId,
  onOpenDispatchForOrder,
  onOpenConsumptionForOrder,
  onOpenReceiptForOrder,
  onOpenReturnForOrder,
}) => {
  const { productionOrders, items, units, cancelProductionOrder, deleteProductionOrder, showToast } =
    useInventory();

  const [activeSubTab, setActiveSubTab] = useState<'materials' | 'dispatches' | 'consumptions' | 'receipts' | 'returns'>('materials');

  // Voucher preview modal state
  const [voucherModalState, setVoucherModalState] = useState<{
    isOpen: boolean;
    type: ProductionVoucherType;
    record: any;
  }>({
    isOpen: false,
    type: 'DISPATCH',
    record: null,
  });

  // Cancel order modal / confirm
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  if (!isOpen) return null;

  const order = productionOrders.find((p) => p.id === orderId);
  if (!order) return null;

  const targetItem = items.find((i) => i.id === order.targetItemId);
  const targetUnit = units.find((u) => u.id === order.targetUnitId) || units.find((u) => u.id === targetItem?.baseUnitId);

  // Status badge config
  const statusConfig = {
    OPEN: { label: 'مفتوح / جاري التشغيل', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    PENDING_RECEIPT: { label: 'بانتظار استلام المنتج بالمخزن', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    COMPLETED: { label: 'مكتمل ومستلم بالكامل', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    CANCELLED: { label: 'ملغي', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  }[order.status];

  // Calculate totals
  const totalCustodyItems = (order.materials || []).filter((m) => m.currentCustodyBaseQuantity > 0.0001).length;
  const pendingReceiptCount = order.finishedGood?.pendingReceiptQuantity || 0;
  const receivedCount = order.finishedGood?.receivedQuantity || 0;
  const completedCount = order.finishedGood?.completedQuantity || 0;

  const handleOpenVoucher = (type: ProductionVoucherType, record: any) => {
    setVoucherModalState({
      isOpen: true,
      type,
      record,
    });
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      showToast('يرجى إدخال سبب الإلغاء للمتابعة', 'error');
      return;
    }
    setIsSubmittingAction(true);
    try {
      const res = await cancelProductionOrder(order.id, cancelReason);
      if (res.success) {
        setIsCancelConfirmOpen(false);
        setCancelReason('');
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Factory className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">{order.title}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusConfig.color}`}>
                    {statusConfig.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                  <span className="font-mono font-bold text-slate-700">#{order.orderNumber}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(order.date).toLocaleDateString('ar-SA')}</span>
                  </span>
                  {targetItem && (
                    <>
                      <span>•</span>
                      <span>
                        المنتج المستهدف:{' '}
                        <strong className="text-slate-800">{targetItem.name}</strong> ({targetItem.code})
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block">المواد المصروفة للتشغيل</span>
              <div className="text-xl font-black font-mono text-slate-900 mt-0.5">
                {(order.materials || []).length} صنف
              </div>
              <span className="text-[10px] text-indigo-600 font-bold">
                {totalCustodyItems} أصناف بالعهدة حالياً
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block">إجمالي الإنتاج المصنوع</span>
              <div className="text-xl font-black font-mono text-slate-900 mt-0.5">
                {completedCount.toLocaleString('ar-SA')}{' '}
                <span className="text-xs font-normal text-slate-500">{targetUnit?.name || 'وحدة'}</span>
              </div>
              <span className="text-[10px] text-slate-500">
                المخطط: {order.plannedQuantity || 0}
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/40 shadow-2xs">
              <span className="text-[11px] text-amber-700 block">بانتظار الاستلام بالمستودع</span>
              <div className="text-xl font-black font-mono text-amber-800 mt-0.5">
                {pendingReceiptCount.toLocaleString('ar-SA')}{' '}
                <span className="text-xs font-normal text-amber-700">{targetUnit?.name || 'وحدة'}</span>
              </div>
              <span className="text-[10px] text-amber-600 font-bold">جاهزة للتوريد للمخزن</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-2xs">
              <span className="text-[11px] text-emerald-700 block">تم استلامه بالمستودع</span>
              <div className="text-xl font-black font-mono text-emerald-800 mt-0.5">
                {receivedCount.toLocaleString('ar-SA')}{' '}
                <span className="text-xs font-normal text-emerald-700">{targetUnit?.name || 'وحدة'}</span>
              </div>
              <span className="text-[10px] text-emerald-600 font-bold">مضاف للرصيد المتاح</span>
            </div>
          </div>

          {/* Action Toolbar */}
          {order.status !== 'CANCELLED' && (
            <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {onOpenDispatchForOrder && order.status !== 'COMPLETED' && (
                  <button
                    onClick={() => {
                      onOpenDispatchForOrder(order.id);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-indigo-600" />
                    <span>صرف مواد للأمر</span>
                  </button>
                )}

                {onOpenConsumptionForOrder && order.status !== 'COMPLETED' && (
                  <button
                    onClick={() => {
                      onOpenConsumptionForOrder(order.id);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Factory className="w-3.5 h-3.5 text-blue-600" />
                    <span>تسجيل استهلاك / إنتاج</span>
                  </button>
                )}

                {onOpenReceiptForOrder && pendingReceiptCount > 0 && (
                  <button
                    onClick={() => {
                      onOpenReceiptForOrder(order.id);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5 text-white" />
                    <span>استلام المنتج للمستودع ({pendingReceiptCount})</span>
                  </button>
                )}

                {onOpenReturnForOrder && totalCustodyItems > 0 && (
                  <button
                    onClick={() => {
                      onOpenReturnForOrder(order.id);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    <span>مرتجع مواد للمستودع</span>
                  </button>
                )}
              </div>

              {order.status !== 'COMPLETED' && (
                <button
                  onClick={() => setIsCancelConfirmOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>إلغاء الأمر</span>
                </button>
              )}
            </div>
          )}

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-1 px-4 pt-3 border-b border-slate-200 bg-slate-50/50">
            <button
              onClick={() => setActiveSubTab('materials')}
              className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                activeSubTab === 'materials'
                  ? 'bg-white text-indigo-700 border-indigo-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 border-transparent'
              }`}
            >
              عهدة المواد ومتابعة الاستهلاك ({(order.materials || []).length})
            </button>
            <button
              onClick={() => setActiveSubTab('dispatches')}
              className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                activeSubTab === 'dispatches'
                  ? 'bg-white text-indigo-700 border-indigo-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 border-transparent'
              }`}
            >
              سندات الصرف ({(order.dispatches || []).length})
            </button>
            <button
              onClick={() => setActiveSubTab('consumptions')}
              className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                activeSubTab === 'consumptions'
                  ? 'bg-white text-indigo-700 border-indigo-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 border-transparent'
              }`}
            >
              سجل الاستهلاك والهالك ({(order.consumptions || []).length})
            </button>
            <button
              onClick={() => setActiveSubTab('receipts')}
              className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                activeSubTab === 'receipts'
                  ? 'bg-white text-indigo-700 border-indigo-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 border-transparent'
              }`}
            >
              سندات استلام المنتج ({(order.receipts || []).length})
            </button>
            <button
              onClick={() => setActiveSubTab('returns')}
              className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                activeSubTab === 'returns'
                  ? 'bg-white text-indigo-700 border-indigo-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 border-transparent'
              }`}
            >
              سندات المرتجع للمستودع ({(order.returns || []).length})
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {/* SUB-TAB 1: Materials Custody Tracking */}
            {activeSubTab === 'materials' && (
              <div className="space-y-3">
                <div className="text-xs text-slate-500">
                  متابعة دقيقة لكل مادة مصروفة لأمر الإنتاج: الكمية المصروفة، المستهلكة، الهالكة، المرتجعة، و<strong>العهدة المتبقية الحالية</strong>.
                </div>

                {(order.materials || []).length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                    لم يتم صرف أي مواد لهذا الأمر بعد. استخدم زر &quot;صرف مواد للأمر&quot; للبدء.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">المادة / الصنف</th>
                          <th className="py-2.5 px-3">الرمز</th>
                          <th className="py-2.5 px-3">المصروف (أساسية)</th>
                          <th className="py-2.5 px-3">المستهلك</th>
                          <th className="py-2.5 px-3">الهالك / التالف</th>
                          <th className="py-2.5 px-3">المرتجع</th>
                          <th className="py-2.5 px-3 bg-indigo-50/70 text-indigo-900">العهدة المتبقية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {order.materials.map((m) => {
                          const item = items.find((i) => i.id === m.itemId);
                          const baseUnit = units.find((u) => u.id === item?.baseUnitId);
                          return (
                            <tr key={m.itemId} className="hover:bg-slate-50/60">
                              <td className="py-2.5 px-3 font-bold text-slate-900">{item?.name || m.itemId}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-500">{item?.code || '-'}</td>
                              <td className="py-2.5 px-3 font-mono">
                                {m.dispatchedBaseQuantity} {baseUnit?.name || ''}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">
                                {m.consumedBaseQuantity} {baseUnit?.name || ''}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-rose-600">
                                {m.scrapBaseQuantity > 0 ? (
                                  <span title={m.scrapReason || 'هالك إنتاج'}>
                                    {m.scrapBaseQuantity} {baseUnit?.name || ''}
                                    {m.scrapReason && ` (${m.scrapReason})`}
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-amber-700">
                                {m.returnedBaseQuantity > 0 ? `${m.returnedBaseQuantity} ${baseUnit?.name || ''}` : '-'}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold bg-indigo-50/50 text-indigo-900">
                                {m.currentCustodyBaseQuantity} {baseUnit?.name || ''}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 2: Dispatches Log */}
            {activeSubTab === 'dispatches' && (
              <div className="space-y-3">
                {(order.dispatches || []).length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                    لا توجد سندات صرف مواد مسجلة لهذا الأمر بعد.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {order.dispatches.map((disp) => (
                      <div
                        key={disp.id}
                        className="p-3.5 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200 flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-xs">#{disp.voucherNumber}</span>
                            <span className="text-[11px] text-slate-500">
                              {new Date(disp.date).toLocaleString('ar-SA')}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            عدد الأصناف المصروفة: <strong>{disp.items.length} صنف</strong>
                            {disp.notes && <span className="mr-2 text-slate-500">({disp.notes})</span>}
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenVoucher('DISPATCH', disp)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                        >
                          <Printer className="w-3.5 h-3.5 text-indigo-600" />
                          <span>عرض وطباعة السند</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 3: Consumptions Log */}
            {activeSubTab === 'consumptions' && (
              <div className="space-y-3">
                {(order.consumptions || []).length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                    لا يوجد استهلاك أو هالك مسجل لهذا الأمر بعد.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {order.consumptions.map((cons) => (
                      <div
                        key={cons.id}
                        className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">
                            تسجيل استهلاك بتاريخ: {new Date(cons.date).toLocaleString('ar-SA')}
                          </span>
                          {cons.completedGoodsQuantity && cons.completedGoodsQuantity > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                              إنتاج مكتمل: {cons.completedGoodsQuantity} {targetUnit?.name || 'وحدة'}
                            </span>
                          ) : null}
                        </div>

                        <div className="text-xs text-slate-600">
                          <ul className="list-disc list-inside space-y-1">
                            {cons.items.map((it, idx) => {
                              const itm = items.find((i) => i.id === it.itemId);
                              const u = units.find((un) => un.id === it.unitId);
                              return (
                                <li key={idx}>
                                  <strong>{itm?.name || it.itemId}</strong>: استهلاك {it.quantity} {u?.name}
                                  {it.scrapQuantity && it.scrapQuantity > 0 ? (
                                    <span className="text-rose-600 font-bold mr-2">
                                      + هالك: {it.scrapQuantity} {u?.name} (السبب: {it.scrapReason || 'غير محدد'})
                                    </span>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 4: Receipts Log */}
            {activeSubTab === 'receipts' && (
              <div className="space-y-3">
                {(order.receipts || []).length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                    لم يتم استلام أي كميات من المنتج الجاهز بالمستودع حتى الآن.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {order.receipts.map((rec) => {
                      const itm = items.find((i) => i.id === rec.itemId);
                      const u = units.find((un) => un.id === rec.unitId);
                      return (
                        <div
                          key={rec.id}
                          className="p-3.5 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between transition-colors"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-emerald-900 text-xs">
                                #{rec.voucherNumber}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {new Date(rec.date).toLocaleString('ar-SA')}
                              </span>
                            </div>
                            <div className="text-xs text-slate-700 mt-1">
                              تم استلام: <strong>{rec.quantity} {u?.name}</strong> من ({itm?.name}) وإضافتها للمخزون
                            </div>
                          </div>

                          <button
                            onClick={() => handleOpenVoucher('RECEIPT', rec)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-600" />
                            <span>عرض وطباعة السند</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 5: Returns Log */}
            {activeSubTab === 'returns' && (
              <div className="space-y-3">
                {(order.returns || []).length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                    لا توجد سندات مرتجع مواد مسجلة لهذا الأمر.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {order.returns.map((ret) => (
                      <div
                        key={ret.id}
                        className="p-3.5 bg-amber-50/50 hover:bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-900 text-xs">
                              #{ret.voucherNumber}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {new Date(ret.date).toLocaleString('ar-SA')}
                            </span>
                          </div>
                          <div className="text-xs text-slate-700 mt-1">
                            عدد المواد المرتجعة للمستودع: <strong>{ret.items.length} مادة</strong>
                            {ret.notes && <span className="mr-2 text-slate-500">({ret.notes})</span>}
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenVoucher('RETURN', ret)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-600" />
                          <span>عرض وطباعة السند</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              أمر الإنتاج #{order.orderNumber} - متصل سحابياً بقاعدة بيانات مدهال الطيب
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Voucher Print Modal */}
      {voucherModalState.isOpen && (
        <ProductionVoucherModal
          isOpen={voucherModalState.isOpen}
          onClose={() => setVoucherModalState({ ...voucherModalState, isOpen: false })}
          voucherType={voucherModalState.type}
          order={order}
          voucherRecord={voucherModalState.record}
        />
      )}

      {/* Cancel Order Confirm Modal */}
      {isCancelConfirmOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>تأكيد إلغاء أمر الإنتاج (#{order.orderNumber})</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              الإلغاء سيوقف العمل على هذا الأمر ويوثقه في سجل التدقيق. يشترط النظام ألا تكون هناك عهدة مواد متبقية لم تُرجع للمستودع.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                سبب الإلغاء (إلزامي للتدقيق):
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="اكتب سبب إلغاء أمر الإنتاج بالتفصيل..."
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCancelConfirmOpen(false)}
                disabled={isSubmittingAction}
                className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl"
              >
                رجوع
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isSubmittingAction}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
              >
                {isSubmittingAction ? 'جارٍ الإلغاء...' : 'تأكيد الإلغاء'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
