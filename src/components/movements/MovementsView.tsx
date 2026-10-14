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
    return movements.filter((m) => {
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
  }, [movements, items, branches, searchQuery, typeFilter, branchFilter, itemFilter, startDate, endDate]);

  const groupedMovements = useMemo(() => {
    const groups: Record<string, StockMovement[]> = {};
    filteredMovements.forEach((m) => {
      const key = m.referenceNumber || m.batchId || `no-ref-${m.id}`;
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
    const headers = ['التاريخ', 'نوع الحركة', 'رمز الصنف', 'اسم الصنف', 'الكمية', 'الوحدة', 'المعادل بالوحدة الأساسية', 'رقم المرجع', 'الملاحظات'];
    const rows = filteredMovements.map((m) => {
      const item = items.find((i) => i.id === m.itemId);
      const unit = units.find((u) => u.id === m.unitId);
      const baseUnit = units.find((u) => u.id === item?.baseUnitId);
      return [new Date(m.date).toLocaleString('ar-SA'), m.type === 'IN' ? 'دخول / وارد' : 'خروج / صادر', item?.code || '', item?.name || '', m.quantity, unit?.name || '', `${m.baseQuantity} ${baseUnit?.name || ''}`, m.referenceNumber || '', m.notes || ''];
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
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">لا توجد حركات</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-4 w-10"></th>
                <th className="py-3.5 px-4">رقم السند / المرجع</th>
                <th className="py-3.5 px-4">التاريخ</th>
                <th className="py-3.5 px-4">عدد الأصناف</th>
                <th className="py-3.5 px-4">الجهة / الوجهة</th>
                <th className="py-3.5 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {groupedMovements.map((movementsGroup) => {
                const refKey = movementsGroup[0].referenceNumber || movementsGroup[0].batchId || `no-ref-${movementsGroup[0].id}`;
                const isExpanded = expandedVouchers[refKey];
                return (
                  <React.Fragment key={refKey}>
                    <tr className="hover:bg-slate-50">
                      <td className="py-3.5 px-4">
                        <button onClick={() => toggleExpand(refKey)} className="p-1 cursor-pointer">
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 font-bold font-mono text-slate-900">{refKey}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">{new Date(movementsGroup[0].date).toLocaleDateString('ar-SA')}</td>
                      <td className="py-3.5 px-4 text-xs font-bold">{movementsGroup.length}</td>
                      <td className="py-3.5 px-4 text-xs">{movementsGroup[0].destinationName || movementsGroup[0].branchName || '-'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <button onClick={() => setVoucherMovement(movementsGroup[0])} className="p-1.5 text-slate-500 hover:text-emerald-700">
                          <Printer className="w-4 h-4 text-emerald-600" />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="p-4 bg-slate-50">
                          {movementsGroup.map(m => (
                            <div key={m.id} className="flex justify-between border-b p-2 bg-white rounded shadow-sm mb-1">
                              <span>{items.find(i => i.id === m.itemId)?.name}</span>
                              <span className="font-mono">{m.quantity} {units.find(u => u.id === m.unitId)?.name}</span>
                            </div>
                          ))}
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
