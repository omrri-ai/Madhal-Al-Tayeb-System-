import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Calendar,
  Edit,
  Trash2,
  FileSpreadsheet,
  Printer,
  Download,
  AlertCircle,
  Plus,
  FileText,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { MovementType, StockMovement } from '../../types/inventory';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { StockMovementModal } from './StockMovementModal';
import { MovementVoucherModal } from './MovementVoucherModal';
import { Building2, Truck } from 'lucide-react';

interface MovementsViewProps {
  onOpenNewMovement: (type?: MovementType) => void;
  onOpenOutgoingDispatch?: () => void;
  initialType?: 'ALL' | 'IN' | 'OUT';
  initialBranchId?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialSearchQuery?: string;
  initialMovementId?: string;
  returnToReports?: () => void;
}

export const MovementsView: React.FC<MovementsViewProps> = ({
  onOpenNewMovement,
  onOpenOutgoingDispatch,
  initialType = 'ALL',
  initialBranchId = 'ALL',
  initialStartDate = '',
  initialEndDate = '',
  initialSearchQuery = '',
  initialMovementId,
  returnToReports,
}) => {
  const { movements, items, units, categories, branches, getItemStock, deleteMovement } = useInventory();

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>(initialType || 'ALL');
  const [branchFilter, setBranchFilter] = useState<string>(initialBranchId || 'ALL');
  const [itemFilter, setItemFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>(initialStartDate || '');
  const [endDate, setEndDate] = useState<string>(initialEndDate || '');

  const [editingMovement, setEditingMovement] = useState<StockMovement | null>(null);
  const [voucherMovement, setVoucherMovement] = useState<StockMovement | null>(null);

  React.useEffect(() => {
    if (initialMovementId) {
      const match = movements.find((m) => m.id === initialMovementId);
      if (match) setVoucherMovement(match);
    }
  }, [initialMovementId, movements]);

  const [deleteTarget, setDeleteTarget] = useState<StockMovement | null>(null);

  const filteredMovements = useMemo(() => {
    const list = movements.filter((m) => {
      const item = items.find((i) => i.id === m.itemId);
      const query = searchQuery.toLowerCase().trim();
      const destinationStr = `${m.destinationName || ''} ${m.branchName || ''} ${m.customerName || ''} ${m.destinationContactName || ''} ${m.supplierName || ''} ${m.shippingCompany || ''} ${m.customShippingCompany || ''}`.toLowerCase();
      const matchesSearch =
        !query ||
        (item?.name || '').toLowerCase().includes(query) ||
        (item?.code || '').toLowerCase().includes(query) ||
        (m.referenceNumber && m.referenceNumber.toLowerCase().includes(query)) ||
        destinationStr.includes(query) ||
        (m.notes && m.notes.toLowerCase().includes(query));

      return (
        matchesSearch &&
        (typeFilter === 'ALL' || m.type === typeFilter) &&
        (itemFilter === 'ALL' || m.itemId === itemFilter) &&
        (branchFilter === 'ALL' || m.branchId === branchFilter) &&
        (!startDate || m.date >= startDate) &&
        (!endDate || m.date <= `${endDate}T23:59:59`)
      );
    });

    // Sort descending by date & creation time (newest first)
    return list.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.date || 0).getTime();
      const timeB = new Date(b.createdAt || b.date || 0).getTime();
      return timeB - timeA;
    });
  }, [movements, items, branches, searchQuery, typeFilter, branchFilter, itemFilter, startDate, endDate]);

  const groupedMovements = useMemo(() => {
    const groups: Record<string, StockMovement[]> = {};
    filteredMovements.forEach((m) => {
      const key = m.referenceNumber || m.batchId || `ref-${m.id}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return Object.values(groups);
  }, [filteredMovements]);

  const [expandedVouchers, setExpandedVouchers] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpandedVouchers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMovement(deleteTarget.id, deleteTarget.notes || 'حذف الحركة المخزنية من سجل الحركات');
    setDeleteTarget(null);
  };

  const handleExportCSV = () => {
    if (filteredMovements.length === 0) return;
    const headers = ['التاريخ', 'نوع الحركة', 'رمز الصنف', 'اسم الصنف', 'الكمية', 'الوحدة', 'المعادل بالوحدة الأساسية', 'رقم المرجع', 'الوجهة / الجهة', 'الملاحظات'];
    const rows = filteredMovements.map((m) => {
      const item = items.find((i) => i.id === m.itemId);
      const unit = units.find((u) => u.id === m.unitId);
      const baseUnit = units.find((u) => u.id === item?.baseUnitId);
      const dest = m.destinationName || m.branchName || m.customerName || m.supplierName || '-';
      return [new Date(m.date).toLocaleString('ar-SA'), m.type === 'IN' ? 'دخول / وارد' : 'خروج / صادر', item?.code || '', item?.name || '', m.quantity, unit?.name || '', `${m.baseQuantity} ${baseUnit?.name || ''}`, m.referenceNumber || 'توريد مخزني', dest, m.notes || ''];
    });
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `سجل_حركات_المخزون_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      {/* Search & Filter Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 no-print">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الفاتورة، اسم الصنف، رمزه، أو الملاحظات..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>تصدير CSV</span>
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer">
              <Printer className="w-4 h-4 text-slate-600" />
              <span>طباعة السجل</span>
            </button>
          </div>
        </div>
      </div>

      {/* Movements Table */}
      {groupedMovements.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">لا توجد حركات مطابقة للبحث</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-4 w-10"></th>
                <th className="py-3.5 px-4">رقم السند / المرجع</th>
                <th className="py-3.5 px-4">التاريخ والوقت</th>
                <th className="py-3.5 px-4">عدد الأصناف</th>
                <th className="py-3.5 px-4">الجهة / الوجهة</th>
                <th className="py-3.5 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {groupedMovements.map((movementsGroup) => {
                const first = movementsGroup[0];
                const refKey = first.referenceNumber || first.batchId || `ref-${first.id}`;
                const isExpanded = expandedVouchers[refKey];
                const displayRef = first.referenceNumber || (first.type === 'IN' ? 'توريد مخزني' : 'صرف مخزني');
                const destinationDisplay = first.destinationName || first.branchName || first.customerName || first.supplierName || 'مستودع مدهال الطيب الرئيسي';

                return (
                  <React.Fragment key={refKey}>
                    <tr 
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => toggleExpand(refKey)}
                    >
                      <td className="py-3.5 px-4">
                        <button type="button" className="p-1 cursor-pointer text-slate-500 font-bold">
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 font-bold font-mono text-slate-900">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${first.type === 'IN' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {displayRef}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {new Date(first.createdAt || first.date).toLocaleString('ar-SA')}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-bold font-mono">
                        {movementsGroup.length} صنف
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                        {destinationDisplay}
                      </td>
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => setVoucherMovement(first)} 
                          className="p-1.5 text-slate-500 hover:text-emerald-700 cursor-pointer"
                          title="عرض وطباعة السند"
                        >
                          <Printer className="w-4 h-4 text-emerald-600" />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="p-4 bg-slate-50/80">
                          <div className="space-y-1.5">
                            <div className="text-xs font-bold text-slate-500 mb-2">تفاصيل الأصناف في هذا السند:</div>
                            {movementsGroup.map(m => {
                              const itm = items.find(i => i.id === m.itemId);
                              const unt = units.find(u => u.id === m.unitId);
                              return (
                                <div key={m.id} className="flex items-center justify-between border border-slate-200/80 p-2.5 bg-white rounded-xl shadow-2xs">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.type === 'IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                      {m.type === 'IN' ? 'وارد' : 'صادر'}
                                    </span>
                                    <span className="font-bold text-slate-900 text-xs">{itm?.name || 'صنف غير معروف'}</span>
                                    <span className="text-[11px] font-mono text-slate-400">({itm?.code || '-'})</span>
                                  </div>
                                  <div className="font-mono text-xs font-bold text-slate-800">
                                    {m.quantity} {unt?.name || 'وحدة'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Modals remain here */}
      {voucherMovement && (
        <MovementVoucherModal
            isOpen={!!voucherMovement}
            onClose={() => setVoucherMovement(null)}
            movement={voucherMovement}
            item={items.find(i => i.id === voucherMovement.itemId) || null}
            unit={units.find(u => u.id === voucherMovement.unitId) || null}
            baseUnit={units.find(u => u.id === items.find(i => i.id === voucherMovement.itemId)?.baseUnitId) || null}
            category={categories.find(c => c.id === items.find(i => i.id === voucherMovement.itemId)?.categoryId) || null}
            currentStock={getItemStock(voucherMovement.itemId)}
        />
      )}
    </div>
  );
};
