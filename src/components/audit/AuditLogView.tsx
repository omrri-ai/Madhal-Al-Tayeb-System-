import React, { useState, useMemo, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  Calendar,
  Eye,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  FileText,
  User,
  Clock,
  Boxes,
  FolderTree,
  Scale,
  Building2,
  Users,
  ArrowLeftRight,
  RotateCcw,
  Settings,
  X,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { AuditLogEntry } from '../../types/inventory';
import { FirestoreStorage } from '../../services/firestoreStorage';

export const AuditLogView: React.FC = () => {
  const { auditLogs, refreshAuditLogs } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [operationFilter, setOperationFilter] = useState<'ALL' | 'UPDATE' | 'DELETE'>('ALL');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshAuditLogs();
    setIsRefreshing(false);
  };

  useEffect(() => {
    refreshAuditLogs();
  }, [refreshAuditLogs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const monthStart = todayStart - 30 * 24 * 60 * 60 * 1000;

    return auditLogs.filter((log) => {
      // Operation filter
      if (operationFilter === 'UPDATE') {
        const isUp = log.operationType === 'تعديل' || log.operationType === 'UPDATE' || log.action?.includes('UPDATE') || log.action?.includes('تعديل');
        if (!isUp) return false;
      } else if (operationFilter === 'DELETE') {
        const isDel = log.operationType === 'حذف' || log.operationType === 'DELETE' || log.action?.includes('DELETE') || log.action?.includes('حذف');
        if (!isDel) return false;
      }

      // Entity filter
      if (entityFilter !== 'ALL') {
        const ent = (log.entityType || '').toLowerCase();
        if (entityFilter === 'item' && !ent.includes('صنف') && !ent.includes('item')) return false;
        if (entityFilter === 'category' && !ent.includes('قسم') && !ent.includes('category')) return false;
        if (entityFilter === 'unit' && !ent.includes('وحدة') && !ent.includes('unit')) return false;
        if (entityFilter === 'branch' && !ent.includes('فرع') && !ent.includes('branch')) return false;
        if (entityFilter === 'customer' && !ent.includes('عميل') && !ent.includes('customer')) return false;
        if (entityFilter === 'movement' && !ent.includes('حركة') && !ent.includes('movement')) return false;
        if (entityFilter === 'return' && !ent.includes('مرتجع') && !ent.includes('return')) return false;
        if (entityFilter === 'settings' && !ent.includes('إعداد') && !ent.includes('setting')) return false;
      }

      // Date filter
      if (dateFilter !== 'ALL') {
        const t = new Date(log.timestamp).getTime();
        if (dateFilter === 'TODAY' && t < todayStart) return false;
        if (dateFilter === 'WEEK' && t < weekStart) return false;
        if (dateFilter === 'MONTH' && t < monthStart) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (log.entityName || '').toLowerCase().includes(q);
        const matchId = (log.entityId || '').toLowerCase().includes(q);
        const matchReason = (log.reason || '').toLowerCase().includes(q);
        const matchUser = (log.userName || log.performedBy || '').toLowerCase().includes(q);
        const matchType = (log.entityType || '').toLowerCase().includes(q);
        const matchAction = (log.action || '').toLowerCase().includes(q);
        const matchDetails = (log.details || '').toLowerCase().includes(q);
        if (!matchName && !matchId && !matchReason && !matchUser && !matchType && !matchAction && !matchDetails) {
          return false;
        }
      }

      return true;
    });
  }, [auditLogs, operationFilter, entityFilter, dateFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    let updateCount = 0;
    let deleteCount = 0;
    for (const log of auditLogs) {
      const isDel = log.operationType === 'حذف' || log.operationType === 'DELETE' || log.action?.includes('DELETE') || log.action?.includes('حذف');
      if (isDel) {
        deleteCount++;
      } else {
        updateCount++;
      }
    }
    return {
      total: auditLogs.length,
      updates: updateCount,
      deletes: deleteCount,
    };
  }, [auditLogs]);

  // Helper icon for entity
  const getEntityIcon = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('صنف') || t.includes('item')) return <Boxes className="w-4 h-4 text-emerald-600" />;
    if (t.includes('قسم') || t.includes('category')) return <FolderTree className="w-4 h-4 text-blue-600" />;
    if (t.includes('وحدة') || t.includes('unit')) return <Scale className="w-4 h-4 text-purple-600" />;
    if (t.includes('فرع') || t.includes('branch')) return <Building2 className="w-4 h-4 text-amber-600" />;
    if (t.includes('عميل') || t.includes('customer')) return <Users className="w-4 h-4 text-indigo-600" />;
    if (t.includes('حركة') || t.includes('movement')) return <ArrowLeftRight className="w-4 h-4 text-cyan-600" />;
    if (t.includes('مرتجع') || t.includes('return')) return <RotateCcw className="w-4 h-4 text-rose-600" />;
    return <FileText className="w-4 h-4 text-slate-600" />;
  };

  // Compare diff for edit modal
  const renderDataDiff = (before: any, after: any) => {
    if (!before && !after) {
      return (
        <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 font-mono">
          لا توجد لقطة بيانات مسجلة لهذا التعديل.
        </div>
      );
    }

    if (!after) {
      // Deleted entity view
      return (
        <div className="space-y-2">
          <div className="text-xs font-bold text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
            بيانات العنصر المحذوف بالكامل قبل حذفه من النظام:
          </div>
          <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs overflow-x-auto font-mono max-h-72">
            {JSON.stringify(before, null, 2)}
          </pre>
        </div>
      );
    }

    // Comparison of fields
    const allKeys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));
    const diffKeys = allKeys.filter((k) => {
      if (k === 'updatedAt' || k === 'id') return false;
      const bVal = JSON.stringify(before?.[k]);
      const aVal = JSON.stringify(after?.[k]);
      return bVal !== aVal;
    });

    if (diffKeys.length === 0) {
      return (
        <div className="space-y-3">
          <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
            تم تسجيل التعديل بنجاح. فيما يلي لقطة البيانات الحالية:
          </div>
          <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs overflow-x-auto font-mono max-h-60">
            {JSON.stringify(after, null, 2)}
          </pre>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="text-xs font-bold text-slate-700 mb-2">
          مقارنة الحقول التي تم تعديلها:
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 text-slate-700 font-bold">
              <tr>
                <th className="p-2.5">الحقل</th>
                <th className="p-2.5 bg-rose-50 text-rose-800">القيمة السابقة (قبل التعديل)</th>
                <th className="p-2.5 bg-emerald-50 text-emerald-800">القيمة الجديدة (بعد التعديل)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {diffKeys.map((k) => {
                const bVal = before?.[k];
                const aVal = after?.[k];
                return (
                  <tr key={k} className="hover:bg-slate-50">
                    <td className="p-2.5 font-sans font-bold text-slate-800 bg-slate-50/50">{k}</td>
                    <td className="p-2.5 text-rose-700 bg-rose-50/30">
                      {typeof bVal === 'object' ? JSON.stringify(bVal) : String(bVal ?? 'فارغ')}
                    </td>
                    <td className="p-2.5 text-emerald-700 bg-emerald-50/30 font-bold">
                      {typeof aVal === 'object' ? JSON.stringify(aVal) : String(aVal ?? 'فارغ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">سجل التعديل والحذف</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  غير قابل للتعديل (للقراءة فقط)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                سجل تدقيق ومراقبة دائم وموثق في السحابة لجميع عمليات التعديل والحذف وأسبابها في النظام
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer w-full sm:w-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>تحديث السجل السحابي</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5 pt-5 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 font-bold block">إجمالي السجلات المسجلة</span>
              <span className="text-xl font-black text-slate-900 font-mono">{stats.total}</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-blue-50/70 border border-blue-200/60 p-3.5 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] text-blue-700 font-bold block">عمليات التعديل</span>
              <span className="text-xl font-black text-blue-900 font-mono">{stats.updates}</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-rose-50/70 border border-rose-200/60 p-3.5 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] text-rose-700 font-bold block">عمليات الحذف</span>
              <span className="text-xl font-black text-rose-900 font-mono">{stats.deletes}</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالعنصر، السبب، المستخدم..."
              className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 transition-colors"
            />
          </div>

          {/* Operation Filter */}
          <div>
            <select
              value={operationFilter}
              onChange={(e) => setOperationFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:bg-white focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">كل العمليات (تعديل وحذف)</option>
              <option value="UPDATE">عمليات التعديل فقط</option>
              <option value="DELETE">عمليات الحذف فقط</option>
            </select>
          </div>

          {/* Entity Filter */}
          <div>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:bg-white focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">كل أنواع العناصر</option>
              <option value="item">الأصناف والمخزون</option>
              <option value="category">الأقسام</option>
              <option value="unit">الوحدات</option>
              <option value="branch">الفروع</option>
              <option value="customer">العملاء</option>
              <option value="movement">الحركات المخزنية</option>
              <option value="return">المرتجعات</option>
              <option value="settings">إعدادات المنشأة</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:bg-white focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">كل التواريخ</option>
              <option value="TODAY">اليوم فقط</option>
              <option value="WEEK">آخر 7 أيام</option>
              <option value="MONTH">آخر 30 يوماً</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-3">
              <History className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-black text-slate-800">لا توجد سجلات مطابقة</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              لم يتم العثور على أي عمليات تعديل أو حذف تطابق معايير البحث والفلترة المحددة.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3.5">نوع العملية</th>
                  <th className="p-3.5">نوع العنصر</th>
                  <th className="p-3.5">اسم ومعرّف العنصر</th>
                  <th className="p-3.5">سبب التعديل / الحذف</th>
                  <th className="p-3.5">اسم المستخدم</th>
                  <th className="p-3.5">التاريخ والوقت</th>
                  <th className="p-3.5 text-center">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const isDel =
                    log.operationType === 'حذف' ||
                    log.operationType === 'DELETE' ||
                    log.action?.includes('DELETE') ||
                    log.action?.includes('حذف');

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Operation Type */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-black text-[11px] ${
                            isDel
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isDel ? 'bg-rose-600' : 'bg-blue-600'}`} />
                          {isDel ? 'حذف' : 'تعديل'}
                        </span>
                      </td>

                      {/* Entity Type */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-slate-800 font-bold">
                          {getEntityIcon(log.entityType)}
                          <span>{log.entityType || 'عام'}</span>
                        </div>
                      </td>

                      {/* Entity Name & ID */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 line-clamp-1">
                          {log.entityName || log.details || 'عنصر في النظام'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 line-clamp-1">
                          {log.entityId}
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="p-3.5 max-w-xs">
                        <div className="p-2 bg-amber-50/70 border border-amber-200/50 rounded-lg text-[11px] font-bold text-amber-950 line-clamp-2">
                          {log.reason || log.details || 'لم يُحدد سبب مفصل'}
                        </div>
                      </td>

                      {/* User */}
                      <td className="p-3.5 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{log.userName || log.performedBy || 'المسؤول المعتمد'}</span>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="p-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {new Date(log.timestamp).toLocaleString('ar-SA', {
                              year: 'numeric',
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                        >
                          <Eye className="w-3 h-3" />
                          <span>عرض</span>
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

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    selectedLog.operationType === 'حذف' ||
                    selectedLog.operationType === 'DELETE' ||
                    selectedLog.action?.includes('DELETE')
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    تفاصيل عملية {selectedLog.operationType || 'التعديل/الحذف'}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-mono">
                    <span>رقم القيد: {selectedLog.id}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Reason Highlight Card */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <span className="text-[11px] font-bold text-amber-800 block mb-1">
                  سبب العملية المسجل:
                </span>
                <p className="text-sm font-black text-amber-950 leading-relaxed">
                  {selectedLog.reason || selectedLog.details || 'لا يوجد سبب مفصل مسجل لهذا القيد.'}
                </p>
              </div>

              {/* Meta Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">نوع العملية</span>
                  <span
                    className={`font-black ${
                      selectedLog.operationType === 'حذف' || selectedLog.operationType === 'DELETE'
                        ? 'text-rose-700'
                        : 'text-blue-700'
                    }`}
                  >
                    {selectedLog.operationType || 'تعديل'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">نوع العنصر</span>
                  <span className="font-bold text-slate-800">{selectedLog.entityType || 'عام'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">اسم العنصر</span>
                  <span className="font-bold text-slate-900">{selectedLog.entityName || selectedLog.details}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">معرّف العنصر (ID)</span>
                  <span className="font-mono text-slate-600 text-[11px]">{selectedLog.entityId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">المستخدم المنفذ</span>
                  <span className="font-mono text-slate-800 text-[11px]">{selectedLog.userName || selectedLog.performedBy}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">التوقيت الدقيق</span>
                  <span className="font-mono text-slate-700 text-[11px]">
                    {new Date(selectedLog.timestamp).toLocaleString('ar-SA')}
                  </span>
                </div>
              </div>

              {/* Diff / Payload View */}
              <div className="pt-2">
                {renderDataDiff(selectedLog.dataBefore, selectedLog.dataAfter)}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                السجل سحابي مشفر ودائم في Firestore
              </span>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
