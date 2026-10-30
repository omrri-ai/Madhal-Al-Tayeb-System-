import {
  Item,
  StockMovement,
  MovementType,
  ProductionOrder,
  ReturnRecord,
  DamagedRecord,
  Branch,
  Customer,
  Category,
  Unit,
  AuditLogEntry,
} from '../types/inventory';
import { DateRangeResult, isRecordInDateRange, formatArabicDate } from './reportDateFilters';
import { isIncomingMovement, isOutgoingMovement } from './arabicSearch';
import { isSilentMovement } from './stockRules';

export type ReportSectionKey =
  | 'items'
  | 'movements'
  | 'production'
  | 'returns'
  | 'damaged'
  | 'branches'
  | 'customers'
  | 'categories'
  | 'units'
  | 'archive'
  | 'audit_log';

export interface ReportSectionMeta {
  key: ReportSectionKey;
  label: string;
  description: string;
  iconName: string;
}

export const ALL_REPORT_SECTIONS: ReportSectionMeta[] = [
  {
    key: 'items',
    label: 'قسم الأصناف والمخزون',
    description: 'بيانات الأصناف، الأرصدة الحالية، حدود التنبيه، والأسعار',
    iconName: 'Boxes',
  },
  {
    key: 'movements',
    label: 'قسم حركات المخزون',
    description: 'سجل حركات الوارد والصادر والتحويل بين المستودعات',
    iconName: 'ArrowLeftRight',
  },
  {
    key: 'production',
    label: 'قسم الإنتاج والتصنيع',
    description: 'أوامر الإنتاج، نسب الإنجاز، وصرف واستلام المواد',
    iconName: 'Factory',
  },
  {
    key: 'returns',
    label: 'قسم المرتجعات',
    description: 'سندات إرجاع البضائع من الفروع والعملاء والموردين',
    iconName: 'RotateCcw',
  },
  {
    key: 'damaged',
    label: 'قسم التالف والمفقودات',
    description: 'سجلات التلف وحالات الهدر في المستودع وخطوط التصنيع',
    iconName: 'AlertTriangle',
  },
  {
    key: 'branches',
    label: 'قسم إدارة الفروع',
    description: 'قائمة الفروع، المشرفين، وحجم التوريدات لكل فرع',
    iconName: 'Building2',
  },
  {
    key: 'customers',
    label: 'قسم إدارة العملاء',
    description: 'بيانات العملاء، أنواعهم، وسجلات الشحنات والطلبات',
    iconName: 'Users',
  },
  {
    key: 'categories',
    label: 'أقسام وتصنيفات المنتجات',
    description: 'توزيع الأصناف والمخزون حسب الأقسام والتصنيفات',
    iconName: 'FolderTree',
  },
  {
    key: 'units',
    label: 'قسم الوحدات ومُعاملات التحويل',
    description: 'الوحدات العامة، رموزها، والأصناف المرتبطة بها أساسياً وتحويلياً',
    iconName: 'Scale',
  },
  {
    key: 'archive',
    label: 'قسم الأرشيف وسلة المحذوفات',
    description: 'الأصناف المؤرشفة والمحذوفة مع أسباب وتواريخ الحفظ',
    iconName: 'Archive',
  },
  {
    key: 'audit_log',
    label: 'قسم سجل الرقابة والتدقيق',
    description: 'سجل العمليات وحركات التعديل والحذف والأنشطة الإدارية',
    iconName: 'History',
  },
];

export interface GeneratedSectionData {
  key: ReportSectionKey;
  title: string;
  totalCount: number;
  kpis: { label: string; value: string | number }[];
  columns: string[];
  rows: (string | number)[][];
  totalsRow?: (string | number)[];
  toHtml: () => string;
}

export interface InventoryContextData {
  items: Item[];
  movements: StockMovement[];
  productionOrders: ProductionOrder[];
  returns: ReturnRecord[];
  damagedRecords: DamagedRecord[];
  branches: Branch[];
  customers: Customer[];
  categories: Category[];
  units: Unit[];
  auditLogs?: AuditLogEntry[];
  getItemStock: (itemId: string) => number;
}

// 1. GENERATOR: Items & Stock
export function generateItemsReport(
  data: InventoryContextData,
  dateRange: DateRangeResult,
  extraFilter?: { categoryId?: string; statusFilter?: string; customData?: Item[] }
): GeneratedSectionData {
  let filtered = extraFilter?.customData && Array.isArray(extraFilter.customData)
    ? extraFilter.customData
    : data.items.filter((i) => !i.isDeleted);

  if (!extraFilter?.customData) {
    if (extraFilter?.categoryId && extraFilter.categoryId !== 'ALL' && extraFilter.categoryId !== 'all') {
      filtered = filtered.filter((i) => i.categoryId === extraFilter.categoryId);
    }

    // If date filter is not 'all', check createdAt or updatedAt
    if (dateRange.period !== 'all') {
      filtered = filtered.filter((i) =>
        isRecordInDateRange(i.createdAt || i.updatedAt, dateRange)
      );
    }
  }

  let totalStockCount = 0;
  let totalEstimatedValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  const rows = filtered.map((item, index) => {
    const stock = data.getItemStock(item.id);
    const cat = data.categories.find((c) => c.id === item.categoryId)?.name || 'عام';
    const unit = data.units.find((u) => u.id === item.baseUnitId)?.name || 'حبة';
    const alert = item.minStockAlert ?? 0;
    const cost = item.costPrice || 0;
    const value = stock * cost;

    totalStockCount += stock;
    totalEstimatedValue += value;

    let status = 'متوفر';
    if (stock <= 0) {
      status = 'نفد المخزون';
      outOfStockCount++;
    } else if (stock <= alert) {
      status = 'منخفض';
      lowStockCount++;
    }

    return [
      index + 1,
      item.code || '-',
      item.name,
      cat,
      unit,
      stock.toLocaleString('ar-SA'),
      alert.toLocaleString('ar-SA'),
      cost > 0 ? cost.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ر.س' : '-',
      value > 0 ? value.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ر.س' : '-',
      status,
    ];
  });

  const columns = [
    '#',
    'رمز الصنف',
    'اسم الصنف',
    'القسم',
    'الوحدة الأساسية',
    'الرصيد الفعلي',
    'حد التنبيه',
    'سعر التكلفة',
    'قيمة الرصيد',
    'الحالة',
  ];

  const kpis = [
    { label: 'عدد الأصناف المطابقة', value: filtered.length.toLocaleString('ar-SA') },
    { label: 'إجمالي كميات المخزون', value: totalStockCount.toLocaleString('ar-SA') },
    { label: 'القيمة التقديرية للمخزون', value: totalEstimatedValue.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ر.س' },
    { label: 'أصناف منخفضة أو نافدة', value: (lowStockCount + outOfStockCount).toLocaleString('ar-SA') },
  ];

  return {
    key: 'items',
    title: 'قسم الأصناف والمخزون',
    totalCount: filtered.length,
    kpis,
    columns,
    rows,
    toHtml: () => renderSectionHtml('قسم الأصناف والمخزون', filtered.length, kpis, columns, rows),
  };
}

// 2. GENERATOR: Stock Movements
export function generateMovementsReport(
  data: InventoryContextData,
  dateRange: DateRangeResult,
  extraFilter?: { branchId?: string; type?: string; searchQuery?: string; customData?: StockMovement[] }
): GeneratedSectionData {
  let filtered: StockMovement[] = [];

  if (extraFilter?.customData && Array.isArray(extraFilter.customData) && extraFilter.customData.length > 0) {
    filtered = extraFilter.customData;
  } else {
    filtered = data.movements.filter((m) => isRecordInDateRange(m.date, dateRange));
  }

  // Strictly exclude silent / hidden adjustments from report
  filtered = filtered.filter((m) => !isSilentMovement(m));

  if (extraFilter?.branchId && extraFilter.branchId !== 'all') {
    filtered = filtered.filter((m) => m.branchId === extraFilter.branchId);
  }

  if (extraFilter?.type && extraFilter.type !== 'all' && extraFilter.type !== 'ALL') {
    if (extraFilter.type === 'IN') {
      filtered = filtered.filter((m) => isIncomingMovement(m.type));
    } else if (extraFilter.type === 'OUT') {
      filtered = filtered.filter((m) => isOutgoingMovement(m.type));
    } else {
      filtered = filtered.filter((m) => m.type === extraFilter.type);
    }
  }

  if (extraFilter?.searchQuery?.trim()) {
    const q = extraFilter.searchQuery.trim().toLowerCase();
    filtered = filtered.filter((m) => {
      const itm = data.items.find((i) => i.id === m.itemId);
      return (
        m.referenceNumber?.toLowerCase().includes(q) ||
        m.notes?.toLowerCase().includes(q) ||
        itm?.name?.toLowerCase().includes(q) ||
        itm?.code?.toLowerCase().includes(q)
      );
    });
  }

  // Group filtered movements by invoice / reference / batch / time
  const groupMap: Record<string, StockMovement[]> = {};
  filtered.forEach((m) => {
    const cleanRef = (m.referenceNumber || '').trim().toLowerCase();
    const cleanBatch = (m.batchId || '').trim().toLowerCase();
    const cleanNotes = (m.notes || '').trim().toLowerCase();
    let key = `mov_${m.id}`;
    if (cleanRef) {
      key = `ref_${cleanRef}`;
    } else if (cleanBatch) {
      key = `batch_${cleanBatch}`;
    } else if (cleanNotes && cleanNotes.length < 40) {
      key = `notes_${cleanNotes}`;
    } else {
      const timeMin = new Date(m.createdAt || m.date).toISOString().substring(0, 16);
      const dest = (m.destinationName || m.branchName || m.customerName || m.supplierName || '').trim().toLowerCase();
      if (dest) {
        key = `time_${timeMin}_dest_${dest}`;
      }
    }

    if (!groupMap[key]) groupMap[key] = [];
    groupMap[key].push(m);
  });

  const allGroups = Object.values(groupMap);

  // Sort groups descending by date/time (newest first)
  allGroups.sort((a, b) => new Date(b[0].createdAt || b[0].date).getTime() - new Date(a[0].createdAt || a[0].date).getTime());

  // Classify and group into 7 categories in precise order
  const categoriesMap: {
    incoming: StockMovement[][];
    outgoing: StockMovement[][];
    factory_out: StockMovement[][];
    factory_in: StockMovement[][];
    returns: StockMovement[][];
    adjustments: StockMovement[][];
    transfers: StockMovement[][];
  } = {
    incoming: [],
    outgoing: [],
    factory_out: [],
    factory_in: [],
    returns: [],
    adjustments: [],
    transfers: [],
  };

  allGroups.forEach((grp) => {
    const first = grp[0];
    const cat = classifyMovementCategory(first);
    categoriesMap[cat].push(grp);
  });

  const counts = {
    incoming: categoriesMap.incoming.reduce((acc, g) => acc + g.length, 0),
    outgoing: categoriesMap.outgoing.reduce((acc, g) => acc + g.length, 0),
    factory_out: categoriesMap.factory_out.reduce((acc, g) => acc + g.length, 0),
    factory_in: categoriesMap.factory_in.reduce((acc, g) => acc + g.length, 0),
    returns: categoriesMap.returns.reduce((acc, g) => acc + g.length, 0),
    adjustments: categoriesMap.adjustments.reduce((acc, g) => acc + g.length, 0),
    transfers: categoriesMap.transfers.reduce((acc, g) => acc + g.length, 0),
  };

  const totalOutgoingDispatches = counts.outgoing + counts.factory_out + counts.transfers;
  const totalIncomingReceipts = counts.incoming + counts.factory_in;

  const kpis = [
    { label: 'إجمالي الحركات', value: filtered.length.toLocaleString('ar-SA') },
    { label: 'إجمالي الصادر / الصرف', value: totalOutgoingDispatches.toLocaleString('ar-SA') },
    { label: 'أوامر صرف للمصنع', value: counts.factory_out.toLocaleString('ar-SA') },
    { label: 'الوارد / التوريد', value: totalIncomingReceipts.toLocaleString('ar-SA') },
    { label: 'وارد من المصنع', value: counts.factory_in.toLocaleString('ar-SA') },
    { label: 'المرتجعات', value: counts.returns.toLocaleString('ar-SA') },
    { label: 'التسويات الجردية', value: counts.adjustments.toLocaleString('ar-SA') },
  ];

  const sectionConfigs = [
    { key: 'incoming', title: '1. الوارد / التوريد العام (سندات توريد)', color: '#059669', bg: '#ecfdf5', groups: categoriesMap.incoming },
    { key: 'outgoing', title: '2. الصادر / أوامر الصرف المباشر (سندات صرف)', color: '#e11d48', bg: '#fff1f2', groups: categoriesMap.outgoing },
    { key: 'factory_out', title: '3. أوامر صرف وخروج مواد للمصنع (إذن صرف وتشغيل)', color: '#be123c', bg: '#ffe4e6', groups: categoriesMap.factory_out },
    { key: 'factory_in', title: '4. وارد واستلام البضاعة من المصنع (إذن توريد إنتاج)', color: '#047857', bg: '#f0fdf4', groups: categoriesMap.factory_in },
    { key: 'returns', title: '5. المرتجعات', color: '#0284c7', bg: '#eff6ff', groups: categoriesMap.returns },
    { key: 'adjustments', title: '6. التسويات الجردية', color: '#d97706', bg: '#fffbeb', groups: categoriesMap.adjustments },
    { key: 'transfers', title: '7. التحويلات بين الفروع', color: '#4f46e5', bg: '#eef2ff', groups: categoriesMap.transfers },
  ].filter((sec) => {
    if (sec.groups.length === 0) return false;
    if (!extraFilter?.type || extraFilter.type === 'all' || extraFilter.type === 'ALL') return true;
    if (extraFilter.type === 'OUT') {
      return sec.key === 'outgoing' || sec.key === 'factory_out' || sec.key === 'transfers';
    }
    if (extraFilter.type === 'IN') {
      return sec.key === 'incoming' || sec.key === 'factory_in';
    }
    if (extraFilter.type === 'ADJUSTMENT') return sec.key === 'adjustments';
    if (extraFilter.type === 'RETURN_IN' || extraFilter.type === 'RETURN_OUT') return sec.key === 'returns';
    if (extraFilter.type.startsWith('MFG_') || extraFilter.type.startsWith('PRODUCTION_')) {
      return sec.key === 'factory_out' || sec.key === 'factory_in';
    }
    if (extraFilter.type === 'BRANCH') return sec.key === 'transfers';
    return true;
  });

  const activeSectionsHtml = sectionConfigs
    .filter((sec) => sec.groups.length > 0)
    .map((sec) => {
      const totalMovements = sec.groups.length;
      const unitTotals: Record<string, number> = {};
      sec.groups.forEach((grp) => {
        grp.forEach((m) => {
          const u = data.units.find((un) => un.id === m.unitId)?.name || 'وحدة';
          unitTotals[u] = (unitTotals[u] || 0) + m.quantity;
        });
      });
      const totalsStr = Object.entries(unitTotals)
        .map(([unitName, qty]) => `${qty.toLocaleString('ar-SA')} ${unitName}`)
        .join('، ');

      if (sec.key === 'adjustments') {
        let adjRowsHtml = '';
        sec.groups.forEach((grp) => {
          grp.forEach((m) => {
            const itm = data.items.find((i) => i.id === m.itemId);
            const refNo = m.referenceNumber || `ADJ-${m.id.substring(0, 6)}`;
            const notes = m.notes || '-';
            let prevStock = '-';
            let newStock = '-';
            let reason = notes;
            const matchPrev = notes.match(/الرصيد المسجل السابق\s*\(([^)]+)\)/);
            const matchNew = notes.match(/الرصيد الفعلي الجديد\s*\(([^)]+)\)/);
            const matchReason = notes.match(/السبب:\s*(.+)$/);
            if (matchPrev) prevStock = matchPrev[1];
            if (matchNew) newStock = matchNew[1];
            if (matchReason) reason = matchReason[1];

            const diff = m.baseQuantity;
            const diffClass = diff >= 0 ? 'color: #059669; font-weight: bold;' : 'color: #e11d48; font-weight: bold;';
            const diffSign = diff > 0 ? `+${diff}` : `${diff}`;

            adjRowsHtml += `
              <tr style="page-break-inside: avoid;">
                <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold;">${refNo}</td>
                <td style="padding: 8px 10px; border: 1px solid #cbd5e1;"><strong>${itm?.name || 'صنف'}</strong> <span style="font-size: 10px; color: #64748b;">(${itm?.code || '-'})</span></td>
                <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace;">${prevStock}</td>
                <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace;">${newStock}</td>
                <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; ${diffClass}">${diffSign}</td>
                <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">${reason}</td>
              </tr>
            `;
          });
        });

        return `
          <div class="section-block" style="margin-bottom: 24px; page-break-inside: avoid;">
            <div class="section-header" style="background: ${sec.bg}; border-right: 4px solid ${sec.color}; padding: 10px 14px; border-radius: 8px; margin-bottom: 12px;">
              <h3 class="section-title" style="color: ${sec.color}; margin: 0; font-size: 15px; font-weight: bold;">${sec.title}</h3>
              <span class="section-badge" style="background: ${sec.color}; color: white; padding: 2px 8px; border-radius: 6px; font-size: 11px;">${totalMovements} حركة</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
              <thead>
                <tr style="background: #f8fafc; font-size: 11px; color: #475569;">
                  <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">رقم السند</th>
                  <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">الصنف</th>
                  <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">الرصيد السابق</th>
                  <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">الرصيد الجديد</th>
                  <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">الفرق (+/−)</th>
                  <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">السبب</th>
                </tr>
              </thead>
              <tbody>
                ${adjRowsHtml}
              </tbody>
            </table>
            <div style="background: #f8fafc; padding: 8px 12px; border-radius: 8px; font-size: 12px; color: #334155; font-weight: bold; border: 1px solid #e2e8f0;">
              إجمالي التسويات: ${totalMovements} | إجمالي الكميات: ${totalsStr}
            </div>
          </div>
        `;
      } else {
        let cardsHtml = '';
        sec.groups.forEach((grp) => {
          const first = grp[0];
          const refNo = first.referenceNumber || (first.batchId ? `#${first.batchId}` : `MOV-${first.id.substring(0, 6)}`);
          const timeStr = new Date(first.createdAt || first.date).toLocaleString('ar-SA');
          const dest = first.destinationName || first.branchName || first.customerName || first.supplierName || 'المستودع الرئيسي';
          const notes = first.notes || '-';

          // Sort items alphabetically by item name
          const sortedGrp = [...grp].sort((a, b) => {
            const nameA = data.items.find((i) => i.id === a.itemId)?.name || a.itemName || '';
            const nameB = data.items.find((i) => i.id === b.itemId)?.name || b.itemName || '';
            return nameA.localeCompare(nameB);
          });

          const voucherUnitTotals: Record<string, number> = {};
          sortedGrp.forEach((m) => {
            const u = data.units.find((un) => un.id === m.unitId)?.name || 'وحدة';
            voucherUnitTotals[u] = (voucherUnitTotals[u] || 0) + m.quantity;
          });
          const voucherTotalsStr = Object.entries(voucherUnitTotals)
            .map(([unitName, qty]) => `${qty.toLocaleString('ar-SA')} ${unitName}`)
            .join('، ');

          let subRowsHtml = sortedGrp
            .map((m, idx) => {
              const itm = data.items.find((i) => i.id === m.itemId || i.code === m.itemCode);
              const itmName = itm?.name || m.itemName || 'صنف مخزني';
              const itmCode = itm?.code || m.itemCode || '---';
              const unt = data.units.find((u) => u.id === m.unitId)?.name || m.unitName || 'وحدة';
              const cat = data.categories.find((c) => c.id === itm?.categoryId)?.name || 'قسم عام';
              const baseUnit = data.units.find((u) => u.id === itm?.baseUnitId)?.name || 'وحدة';
              const qty = typeof m.quantity === 'number' && !isNaN(m.quantity) ? m.quantity : Number(m.quantity) || 0;
              const baseQty = typeof m.baseQuantity === 'number' && !isNaN(m.baseQuantity) ? m.baseQuantity : Number(m.baseQuantity) || qty;

              return `
                <tr style="page-break-inside: avoid; border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 6px 10px; text-align: center; color: #64748b; width: 35px;">${idx + 1}</td>
                  <td style="padding: 6px 10px;"><strong>${itmName}</strong> <span style="font-size: 10px; color: #64748b;">(${itmCode})</span></td>
                  <td style="padding: 6px 10px; color: #475569;">${cat}</td>
                  <td style="padding: 6px 10px; font-family: monospace; font-weight: bold; width: 80px;">${qty}</td>
                  <td style="padding: 6px 10px; width: 75px;">${unt}</td>
                  <td style="padding: 6px 10px; font-family: monospace; font-weight: bold; width: 100px; color: #1e293b;">${baseQty} ${baseUnit}</td>
                </tr>
              `;
            })
            .join('');

          const badge = getMovementVoucherBadge(first);

          cardsHtml += `
            <div style="border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 16px; background: #fff; page-break-inside: avoid; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              <div style="background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #cbd5e1; font-size: 13px; font-weight: 900; color: #0f172a; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; align-items: center;">
                <div>
                  <span style="font-size: 10px; color: #64748b; display: block; font-weight: normal;">رقم السند</span>
                  <span style="font-family: monospace; font-size: 14px;">#${refNo}</span>
                </div>
                <div>
                  <span style="font-size: 10px; color: #64748b; display: block; font-weight: normal;">التاريخ والوقت</span>
                  <span>${timeStr}</span>
                </div>
                <div>
                  <span style="font-size: 10px; color: #64748b; display: block; font-weight: normal;">نوع الحركة والسند</span>
                  <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; background: ${badge.bg}; color: ${badge.color}; border: 1px solid ${badge.border};">
                    ${badge.label}
                  </span>
                </div>
                <div>
                  <span style="font-size: 10px; color: #64748b; display: block; font-weight: normal;">الجهة / الوجهة</span>
                  <span>${dest}</span>
                </div>
              </div>
              ${notes && notes !== '-' ? `<div style="padding: 8px 16px; background: #fffbeb; font-size: 12px; color: #92400e; border-bottom: 1px solid #fef3c7;"><strong>ملاحظات:</strong> ${notes}</div>` : ''}
              <table style="width: 100%; border-collapse: collapse; margin: 0; font-size: 11px;">
                <thead>
                  <tr style="background: #f1f5f9; color: #475569; font-weight: bold;">
                    <th style="padding: 6px 10px; border-bottom: 1px solid #cbd5e1; text-align: center; width: 35px;">#</th>
                    <th style="padding: 6px 10px; border-bottom: 1px solid #cbd5e1; text-align: right;">الصنف</th>
                    <th style="padding: 6px 10px; border-bottom: 1px solid #cbd5e1; text-align: right;">القسم</th>
                    <th style="padding: 6px 10px; border-bottom: 1px solid #cbd5e1; text-align: right; width: 80px;">الكمية</th>
                    <th style="padding: 6px 10px; border-bottom: 1px solid #cbd5e1; text-align: right; width: 75px;">الوحدة</th>
                    <th style="padding: 6px 10px; border-bottom: 1px solid #cbd5e1; text-align: right; width: 100px;">المعادل بالأساسية</th>
                  </tr>
                </thead>
                <tbody>
                  ${subRowsHtml}
                </tbody>
              </table>
              <div style="background: #f8fafc; padding: 8px 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #334155; display: flex; justify-content: space-between; align-items: center;">
                <div><strong>عدد الأصناف:</strong> ${sortedGrp.length} صنف</div>
                <div><strong>إجمالي الكميات:</strong> ${voucherTotalsStr}</div>
              </div>
            </div>
          `;
        });

        return `
          <div class="section-block" style="margin-bottom: 24px;">
            <div class="section-header" style="background: ${sec.bg}; border-right: 4px solid ${sec.color}; padding: 10px 14px; border-radius: 8px; margin-bottom: 12px;">
              <h3 class="section-title" style="color: ${sec.color}; margin: 0; font-size: 15px; font-weight: bold;">${sec.title}</h3>
              <span class="section-badge" style="background: ${sec.color}; color: white; padding: 2px 8px; border-radius: 6px; font-size: 11px;">${totalMovements} حركة</span>
            </div>
            ${cardsHtml}
            <div style="background: #f8fafc; padding: 8px 12px; border-radius: 8px; font-size: 12px; color: #334155; font-weight: bold; border: 1px solid #e2e8f0;">
              إجمالي الحركات في القسم: ${totalMovements} | إجمالي الكميات: ${totalsStr}
            </div>
          </div>
        `;
      }
    })
    .join('');

  return {
    key: 'movements',
    title: 'تقرير حركات المخزون',
    totalCount: filtered.length,
    kpis,
    columns: ['رقم السند', 'الوقت', 'الجهة', 'تفاصيل الأصناف', 'الملاحظات'],
    rows: [],
    toHtml: () => `
      <div class="comprehensive-report" style="font-family: 'Tajawal', sans-serif;" dir="rtl">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 12px;">
          <h2 style="font-size: 18px; font-weight: 900; color: #0f172a; margin: 0 0 6px 0;">تقرير حركات المخزون الشامل</h2>
          <div style="font-size: 12px; color: #475569;">الفترة: ${dateRange.label} (${dateRange.inclusiveNote}) | تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh' })}</div>
        </div>

        <div class="kpi-strip" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px;">
          ${kpis.map((k) => `
            <div class="kpi-box" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: center;">
              <div style="font-size: 11px; color: #64748b;">${k.label}</div>
              <div style="font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 4px;">${k.value}</div>
            </div>
          `).join('')}
        </div>

        ${activeSectionsHtml || '<div style="text-align: center; padding: 30px; color: #64748b; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">لا توجد حركات مخزنية مطابقة للفترة أو الفلاتر المحددة</div>'}
      </div>
    `,
  };
}

export function getMovementVoucherBadge(m: StockMovement): {
  label: string;
  subLabel?: string;
  color: string;
  bg: string;
  border: string;
} {
  const t = (m.type as string) || '';
  const notes = (m.notes || '').toLowerCase();
  const destName = (m.destinationName || '').toLowerCase();
  const refNo = (m.referenceNumber || '').toLowerCase();

  // 1. Factory Out / Production Dispatch (أمر صرف مواد للمصنع)
  if (
    t === 'MFG_OUT' ||
    t === 'PRODUCTION_DISPATCH' ||
    t === 'خروج للمصنع' ||
    refNo.startsWith('mfg-out') ||
    ((destName.includes('مصنع') || notes.includes('صرف لمصنع') || notes.includes('خروج لمصنع') || notes.includes('للمصنع')) && isOutgoingMovement(t))
  ) {
    return {
      label: 'أمر صرف مواد للمصنع',
      subLabel: 'إذن صرف وتشغيل رسمي',
      color: '#be123c',
      bg: '#ffe4e6',
      border: '#fecdd3',
    };
  }

  // 2. Factory In / Production Receipt (وارد من المصنع)
  if (
    t === 'MFG_IN' ||
    t === 'PRODUCTION_RECEIPT' ||
    t === 'وارد من المصنع' ||
    refNo.startsWith('mfg-in') ||
    ((destName.includes('مصنع') || notes.includes('استلام من مصنع') || notes.includes('وارد من مصنع')) && isIncomingMovement(t))
  ) {
    return {
      label: 'سند استلام من المصنع',
      subLabel: 'إذن توريد منتج مصنّع',
      color: '#047857',
      bg: '#d1fae5',
      border: '#a7f3d0',
    };
  }

  // 3. Adjustments (تسوية جردية)
  if (t === 'ADJUSTMENT' || notes.includes('تسوية') || refNo.startsWith('adj-')) {
    return {
      label: 'تسوية جردية',
      subLabel: 'تعديل رصيد مخزني',
      color: '#b45309',
      bg: '#fef3c7',
      border: '#fde68a',
    };
  }

  // 4. Returns (مرتجعات)
  if (t === 'RETURN_IN' || t === 'RETURN_OUT' || notes.includes('مرتجع') || refNo.startsWith('ret-')) {
    const isRetIn = t === 'RETURN_IN' || isIncomingMovement(t);
    return {
      label: isRetIn ? 'سند مرتجع وارد' : 'سند مرتجع صادر',
      subLabel: 'إرجاع بضاعة',
      color: '#0369a1',
      bg: '#e0f2fe',
      border: '#bae6fd',
    };
  }

  // 5. Branch Transfers (تحويل فرع)
  if (m.destinationType === 'BRANCH' || t === 'BRANCH' || notes.includes('تحويل فرع') || notes.includes('إلى فرع')) {
    return {
      label: 'أمر صرف وتحويل فرع',
      subLabel: 'نقل بين المستودعات',
      color: '#4338ca',
      bg: '#e0e7ff',
      border: '#c7d2fe',
    };
  }

  // 6. Regular Outgoing / Customer Dispatch (أمر صرف مخزني)
  if (t === 'OUT' || isOutgoingMovement(t)) {
    return {
      label: 'أمر صرف مخزني',
      subLabel: 'إذن خروج وتصدير',
      color: '#be123c',
      bg: '#ffe4e6',
      border: '#fecdd3',
    };
  }

  // 7. Regular Incoming (سند توريد مخزني)
  return {
    label: 'سند توريد مخزني',
    subLabel: 'إذن دخول بضاعة',
    color: '#047857',
    bg: '#d1fae5',
    border: '#a7f3d0',
  };
}

function classifyMovementCategory(
  m: StockMovement
): 'incoming' | 'outgoing' | 'factory_out' | 'factory_in' | 'returns' | 'adjustments' | 'transfers' {
  const t = m.type as string;
  const notes = (m.notes || '').toLowerCase();
  const destName = (m.destinationName || '').toLowerCase();
  const refNo = (m.referenceNumber || '').toLowerCase();

  if (t === 'ADJUSTMENT' || notes.includes('تسوية') || refNo.startsWith('adj-')) return 'adjustments';
  if (t === 'RETURN_IN' || t === 'RETURN_OUT' || notes.includes('مرتجع') || refNo.startsWith('ret-')) return 'returns';

  // Factory Out: أمر صرف مواد للمصنع
  if (
    t === 'MFG_OUT' ||
    t === 'PRODUCTION_DISPATCH' ||
    t === 'خروج للمصنع' ||
    refNo.startsWith('mfg-out') ||
    ((destName.includes('مصنع') || notes.includes('صرف لمصنع') || notes.includes('خروج لمصنع') || notes.includes('للمصنع')) && isOutgoingMovement(t))
  ) {
    return 'factory_out';
  }

  // Factory In: وارد من المصنع
  if (
    t === 'MFG_IN' ||
    t === 'PRODUCTION_RECEIPT' ||
    t === 'وارد من المصنع' ||
    refNo.startsWith('mfg-in') ||
    ((destName.includes('مصنع') || notes.includes('استلام من مصنع') || notes.includes('وارد من مصنع')) && isIncomingMovement(t))
  ) {
    return 'factory_in';
  }

  if (m.destinationType === 'BRANCH' || t === 'BRANCH' || notes.includes('تحويل فرع') || notes.includes('إلى فرع')) return 'transfers';
  if (t === 'IN' || isIncomingMovement(t as MovementType)) return 'incoming';
  if (t === 'OUT' || isOutgoingMovement(t as MovementType)) return 'outgoing';
  return 'incoming';
}

// 3. GENERATOR: Production & Manufacturing
export function generateProductionReport(
  data: InventoryContextData,
  dateRange: DateRangeResult,
  extraFilter?: { customData?: ProductionOrder[] }
): GeneratedSectionData {
  let filtered = extraFilter?.customData && Array.isArray(extraFilter.customData) && extraFilter.customData.length > 0
    ? extraFilter.customData
    : data.productionOrders.filter((p) =>
        isRecordInDateRange(p.date || p.createdAt, dateRange)
      );

  let prodMovements: StockMovement[] = [];
  if (filtered.length === 0 && data.movements) {
    prodMovements = data.movements.filter((m) => {
      if (!m || !isRecordInDateRange(m.date || m.createdAt, dateRange)) return false;
      const item = data.items.find((i) => i.id === m.itemId);
      return (
        m.type === 'MFG_OUT' ||
        m.type === 'MFG_IN' ||
        (m.type as string) === 'خروج للمصنع' ||
        (m.type as string) === 'وارد من المصنع' ||
        (m.referenceNumber && (m.referenceNumber.startsWith('MFG-OUT-') || m.referenceNumber.startsWith('MFG-IN-'))) ||
        (m.destinationType as string) === 'PRODUCTION' ||
        (m.destinationType as string) === 'FACTORY' ||
        (m.notes || '').toLowerCase().includes('إنتاج') ||
        (m.notes || '').toLowerCase().includes('مصنع')
      );
    });
  }

  if (filtered.length === 0 && prodMovements.length > 0) {
    const rows = prodMovements.map((m, index) => {
      const item = data.items.find((i) => i.id === m.itemId);
      const unit = data.units.find((u) => u.id === m.unitId)?.name || 'وحدة';
      const baseUnit = data.units.find((u) => u.id === item?.baseUnitId)?.name || 'وحدة';
      const isOut = m.type === 'MFG_OUT' || (m.type as string) === 'خروج للمصنع';

      return [
        index + 1,
        m.referenceNumber || `MFG-${m.id.substring(0, 6)}`,
        formatArabicDate(m.date || m.createdAt),
        isOut ? 'أمر صرف مواد للمصنع (إذن صرف وتشغيل)' : 'وارد من المصنع / استلام إنتاج',
        item ? `${item.name} (${item.code || '-'})` : (m.itemName || 'صنف تصنيع'),
        `${(m.quantity || 0).toLocaleString('ar-SA')} ${unit}`,
        `${(m.baseQuantity || m.quantity || 0).toLocaleString('ar-SA')} ${baseUnit}`,
        m.notes || '-',
      ];
    });

    const columns = [
      '#',
      'رقم السند / المرجع',
      'التاريخ والوقت',
      'نوع الحركة',
      'الصنف',
      'الكمية والوحدة',
      'المعادل بالأساسية',
      'الملاحظات',
    ];

    const kpis = [
      { label: 'إجمالي حركات الإنتاج والمصنع', value: prodMovements.length.toLocaleString('ar-SA') },
      { label: 'الوارد والصادر للإنتاج', value: prodMovements.length.toLocaleString('ar-SA') },
    ];

    return {
      key: 'production',
      title: 'قسم الإنتاج والتصنيع',
      totalCount: prodMovements.length,
      kpis,
      columns,
      rows,
      toHtml: () => renderSectionHtml('قسم الإنتاج والتصنيع', prodMovements.length, kpis, columns, rows),
    };
  }

  filtered.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());

  let inProgressCount = 0;
  let completedCount = 0;
  let totalPlanned = 0;
  let totalProduced = 0;

  const rows = filtered.map((p, index) => {
    const targetItem = data.items.find((i) => i.id === p.targetItemId);
    const unit = data.units.find((u) => u.id === p.targetUnitId)?.name || 'حبة';

    const planned = p.plannedQuantity || 0;
    const produced = p.finishedGood?.completedQuantity || 0;

    totalPlanned += planned;
    totalProduced += produced;

    if (p.status === 'COMPLETED') completedCount++;
    if (p.status === 'OPEN' || p.status === 'PENDING_RECEIPT') inProgressCount++;

    let statusLabel = 'أمر إنتاج مفتوح';
    if (p.status === 'OPEN') statusLabel = 'قيد التشغيل والتصنيع';
    else if (p.status === 'PENDING_RECEIPT') statusLabel = 'بانتظار استلام المنتج';
    else if (p.status === 'COMPLETED') statusLabel = 'مكتمل الإنتاج';
    else if (p.status === 'CANCELLED') statusLabel = 'ملغى';

    const pct = planned > 0 ? Math.round((produced / planned) * 100) : 0;

    return [
      index + 1,
      p.orderNumber,
      formatArabicDate(p.date || p.createdAt),
      p.title,
      targetItem ? `${targetItem.name} (${targetItem.code || '-'})` : '-',
      `${planned.toLocaleString('ar-SA')} ${unit}`,
      `${produced.toLocaleString('ar-SA')} ${unit}`,
      `${pct}%`,
      statusLabel,
      `${(p.materials?.length || 0).toLocaleString('ar-SA')} مواد خامة`,
    ];
  });

  const columns = [
    '#',
    'رقم أمر الإنتاج',
    'التاريخ',
    'عنوان الأمر',
    'المنتج النهائي',
    'الكمية المخططة',
    'الكمية المنتجة',
    'نسبة الإنجاز',
    'الحالة',
    'المواد المصروفة',
  ];

  const kpis = [
    { label: 'إجمالي أوامر الإنتاج', value: filtered.length.toLocaleString('ar-SA') },
    { label: 'أوامر قيد التصنيع', value: inProgressCount.toLocaleString('ar-SA') },
    { label: 'أوامر مكتملة', value: completedCount.toLocaleString('ar-SA') },
    { label: 'إجمالي الوحدات المنتجة', value: totalProduced.toLocaleString('ar-SA') },
  ];

  return {
    key: 'production',
    title: 'قسم الإنتاج والتصنيع',
    totalCount: filtered.length,
    kpis,
    columns,
    rows,
    toHtml: () => renderSectionHtml('قسم الإنتاج والتصنيع', filtered.length, kpis, columns, rows),
  };
}

// 4. GENERATOR: Returns
export function generateReturnsReport(
  data: InventoryContextData,
  dateRange: DateRangeResult,
  extraFilter?: { customData?: ReturnRecord[] }
): GeneratedSectionData {
  let filtered = extraFilter?.customData && Array.isArray(extraFilter.customData) && extraFilter.customData.length > 0
    ? extraFilter.customData
    : data.returns.filter((r) => isRecordInDateRange(r.date, dateRange));
  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let totalItemsReturned = 0;
  let approvedCount = 0;

  const rows = filtered.map((r, index) => {
    let sourceName = r.partyName || r.branchName || '-';
    if (!sourceName || sourceName === '-') {
      if (r.branchId) {
        sourceName = data.branches.find((b) => b.id === r.branchId)?.name || 'فرع';
      }
    }

    const itemsDetailStr = (r.items || [])
      .map((it) => {
        const itm = data.items.find((i) => i.id === it.itemId);
        const cat = data.categories.find((c) => c.id === itm?.categoryId)?.name || 'عام';
        const unit = data.units.find((u) => u.id === it.unitId)?.name || 'وحدة';
        return `• ${itm?.name || 'صنف'} (${cat}): ${it.quantity} ${unit}`;
      })
      .join('<br>');

    const qtySum = (r.items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
    totalItemsReturned += qtySum;

    if (r.status === 'APPROVED') approvedCount++;

    let statusLabel = 'مسودة';
    if (r.status === 'APPROVED') statusLabel = 'معتمد ومُستلم';
    else if (r.status === 'CANCELLED') statusLabel = 'ملغى';

    let typeLabel = r.type === 'RETURN_IN' ? 'مرتجع وارد' : 'مرتجع صادر';
    if (r.destinationType === 'BRANCH') typeLabel += ' (فرع)';
    else if (r.destinationType === 'CUSTOMER') typeLabel += ' (عميل)';
    else if (r.destinationType === 'SUPPLIER') typeLabel += ' (مورد)';

    return [
      index + 1,
      r.returnNumber,
      formatArabicDate(r.date),
      typeLabel,
      sourceName,
      itemsDetailStr || 'لا توجد أصناف',
      r.reason || '-',
      statusLabel,
      r.notes || '-',
    ];
  });

  const columns = [
    '#',
    'رقم سند المرتجع',
    'التاريخ',
    'نوع المصدر',
    'الجهة / العميل',
    'تفاصيل الأصناف والكميات الكاملة',
    'سبب الإرجاع',
    'حالة السند',
    'الملاحظات',
  ];

  const kpis = [
    { label: 'إجمالي سندات المرتجع', value: filtered.length.toLocaleString('ar-SA') },
    { label: 'إجمالي القطع المرتجعة', value: totalItemsReturned.toLocaleString('ar-SA') },
    { label: 'سندات معتمدة بالمستودع', value: approvedCount.toLocaleString('ar-SA') },
  ];

  return {
    key: 'returns',
    title: 'قسم المرتجعات',
    totalCount: filtered.length,
    kpis,
    columns,
    rows,
    toHtml: () => renderSectionHtml('قسم المرتجعات', filtered.length, kpis, columns, rows),
  };
}

// 5. GENERATOR: Damaged Records
export function generateDamagedReport(
  data: InventoryContextData,
  dateRange: DateRangeResult,
  extraFilter?: { customData?: DamagedRecord[] }
): GeneratedSectionData {
  let filtered = extraFilter?.customData && Array.isArray(extraFilter.customData) && extraFilter.customData.length > 0
    ? extraFilter.customData
    : data.damagedRecords.filter((d) =>
        isRecordInDateRange(d.date || d.createdAt, dateRange)
      );

  filtered.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());

  let totalDamagedQty = 0;

  const rows = filtered.map((d, index) => {
    const item = data.items.find((i) => i.id === d.itemId);
    const unit = data.units.find((u) => u.id === d.unitId)?.name || 'وحدة';

    totalDamagedQty += d.quantity || 0;

    const sectionLabel: string = d.section === 'PRODUCTION' ? 'قسم الإنتاج والمصنع' : 'المستودع العام';

    return [
      index + 1,
      formatArabicDate(d.date || d.createdAt),
      item ? `${item.name} (${item.code || '-'})` : 'صنف غير معرف',
      sectionLabel,
      `${(d.quantity || 0).toLocaleString('ar-SA')} ${unit}`,
      d.reason || '-',
      d.notes || '-',
    ];
  });

  const columns = [
    '#',
    'التاريخ',
    'الصنف المتضرر',
    'القسم الواقع به التلف',
    'الكمية التالفة',
    'سبب التلف / الهدر',
    'الملاحظات',
  ];

  const kpis = [
    { label: 'إجمالي حالات التلف', value: filtered.length.toLocaleString('ar-SA') },
    { label: 'إجمالي الكميات التالفة', value: totalDamagedQty.toLocaleString('ar-SA') },
  ];

  return {
    key: 'damaged',
    title: 'قسم التالف والمفقودات',
    totalCount: filtered.length,
    kpis,
    columns,
    rows,
    toHtml: () => renderSectionHtml('قسم التالف والمفقودات', filtered.length, kpis, columns, rows),
  };
}

// 6. GENERATOR: Branches
export function generateBranchesReport(
  data: InventoryContextData
): GeneratedSectionData {
  const branches = data.branches;

  let activeBranches = 0;

  const rows = branches.map((b, index) => {
    if (!b.isArchived) activeBranches++;

    const branchMovements = data.movements.filter((m) => m.branchId === b.id);
    const totalOutToBranch = branchMovements
      .filter((m) => isOutgoingMovement(m.type))
      .reduce((acc, m) => acc + (m.baseQuantity || m.quantity || 0), 0);

    return [
      index + 1,
      b.name,
      b.city || '-',
      b.branchManagerName || b.managerName || '-',
      b.branchManagerPhone || b.phone || '-',
      branchMovements.length.toLocaleString('ar-SA') + ' حركة',
      totalOutToBranch.toLocaleString('ar-SA') + ' قطعة',
      b.isArchived ? 'مؤرشف' : 'نشط',
    ];
  });

  const columns = [
    '#',
    'اسم الفرع',
    'المدينة / العنوان',
    'مشرف الفرع',
    'رقم التواصل',
    'عدد الحركات المرتبطة',
    'إجمالي الكميات الموردة للفرع',
    'الحالة',
  ];

  const kpis = [
    { label: 'إجمالي الفروع المسجلة', value: branches.length.toLocaleString('ar-SA') },
    { label: 'الفروع النشطة', value: activeBranches.toLocaleString('ar-SA') },
  ];

  return {
    key: 'branches',
    title: 'قسم إدارة الفروع',
    totalCount: branches.length,
    kpis,
    columns,
    rows,
    toHtml: () => renderSectionHtml('قسم إدارة الفروع', branches.length, kpis, columns, rows),
  };
}

// 7. GENERATOR: Customers
export function generateCustomersReport(
  data: InventoryContextData
): GeneratedSectionData {
  const customers = data.customers;

  const rows = customers.map((c, index) => {
    return [
      index + 1,
      c.name,
      c.address || '-',
      c.phone || '-',
      c.taxId || '-',
      formatArabicDate(c.createdAt),
      c.notes || '-',
    ];
  });

  const columns = [
    '#',
    'اسم العميل',
    'العنوان / المدينة',
    'رقم الجوال',
    'الرقم الضريبي',
    'تاريخ التسجيل',
    'الملاحظات',
  ];

  const kpis = [
    { label: 'إجمالي العملاء المسجلين', value: customers.length.toLocaleString('ar-SA') },
    {
      label: 'عملاء برقم جوال',
      value: customers.filter((c) => !!c.phone).length.toLocaleString('ar-SA'),
    },
    {
      label: 'عملاء برقم ضريبي',
      value: customers.filter((c) => !!c.taxId).length.toLocaleString('ar-SA'),
    },
  ];

  return {
    key: 'customers',
    title: 'قسم إدارة العملاء',
    totalCount: customers.length,
    kpis,
    columns,
    rows,
    toHtml: () => renderSectionHtml('قسم إدارة العملاء', customers.length, kpis, columns, rows),
  };
}

// 8. GENERATOR: Product Categories
export function generateCategoriesReport(
  data: InventoryContextData
): GeneratedSectionData {
  const cats = data.categories;

  const rows = cats.map((c, index) => {
    const catItems = data.items.filter((i) => i.categoryId === c.id && !i.isDeleted);
    const catStock = catItems.reduce((acc, itm) => acc + data.getItemStock(itm.id), 0);

    return [
      index + 1,
      c.name,
      c.description || '-',
      catItems.length.toLocaleString('ar-SA') + ' صنف',
      catStock.toLocaleString('ar-SA') + ' وحدة',
    ];
  });

  const columns = [
    '#',
    'اسم القسم',
    'الوصف',
    'عدد الأصناف التابعة',
    'إجمالي رصيد المخزون الفعلي',
  ];

  const kpis = [
    { label: 'إجمالي الأقسام', value: cats.length.toLocaleString('ar-SA') },
    { label: 'إجمالي الأصناف الموزعة', value: data.items.filter((i) => !i.isDeleted).length.toLocaleString('ar-SA') },
  ];

  return {
    key: 'categories',
    title: 'أقسام وتصنيفات المنتجات',
    totalCount: cats.length,
    kpis,
    columns,
    rows,
    toHtml: () => renderSectionHtml('أقسام وتصنيفات المنتجات', cats.length, kpis, columns, rows),
  };
}

// 9. GENERATOR: Audit Log
export function generateAuditLogReport(
  data: InventoryContextData,
  dateRange: DateRangeResult
): GeneratedSectionData {
  let logs = (data.auditLogs || []).filter((a) => isRecordInDateRange(a.timestamp, dateRange));
  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const rows = logs.map((l, index) => {
    return [
      index + 1,
      formatArabicDate(l.timestamp),
      l.operationType || 'تعديل',
      l.entityType || 'عام',
      l.entityName || '-',
      l.reason || '-',
      l.userName || '-',
    ];
  });

  const columns = [
    '#',
    'التاريخ والوقت',
    'نوع العملية',
    'الكيان المتأثر',
    'اسم العنصر',
    'السبب الموثق',
    'المنفذ',
  ];

  const kpis = [
    { label: 'إجمالي الأنشطة المسجلة', value: logs.length.toLocaleString('ar-SA') },
  ];

  return {
    key: 'audit_log',
    title: 'قسم سجل الرقابة والتدقيق',
    totalCount: logs.length,
    kpis,
    columns,
    rows,
    toHtml: () => renderSectionHtml('قسم سجل الرقابة والتدقيق', logs.length, kpis, columns, rows),
  };
}

// Helper: render clean HTML for any section
function renderSectionHtml(
  title: string,
  count: number,
  kpis: { label: string; value: string | number }[],
  columns: string[],
  rows: (string | number)[][]
): string {
  const kpiCardsHtml = kpis
    .map(
      (k) => `
    <div class="kpi-box">
      <div class="kpi-box-label">${k.label}</div>
      <div class="kpi-box-value">${k.value}</div>
    </div>`
    )
    .join('');

  const theadHtml = `
    <thead>
      <tr>
        ${columns.map((col) => `<th>${col}</th>`).join('')}
      </tr>
    </thead>`;

  const tbodyHtml = `
    <tbody>
      ${
        rows.length === 0
          ? `<tr><td colspan="${columns.length}" style="text-align: center; padding: 18px; color: #64748b;">لا توجد سجلات مطابقة في هذا القسم للفترة المحددة</td></tr>`
          : rows
              .map(
                (r) => `
          <tr>
            ${r.map((cell, idx) => `<td class="${idx === 0 ? 'num-cell' : 'text-cell'}">${cell}</td>`).join('')}
          </tr>`
              )
              .join('')
      }
    </tbody>`;

  return `
    <div class="section-block">
      <div class="section-header">
        <h3 class="section-title">${title}</h3>
        <span class="section-badge">${count} سجل</span>
      </div>

      <div class="kpi-strip">
        ${kpiCardsHtml}
      </div>

      <table>
        ${theadHtml}
        ${tbodyHtml}
      </table>
    </div>`;
}

// MASTER DISPATCHER: Builds data for any single section or multi-section comprehensive report
export function generateReportsForSelection(
  sectionKeys: ReportSectionKey[],
  data: InventoryContextData,
  dateRange: DateRangeResult,
  extraParams?: Record<string, any>
): GeneratedSectionData[] {
  const results: GeneratedSectionData[] = [];

  for (const key of sectionKeys) {
    switch (key) {
      case 'items':
        results.push(generateItemsReport(data, dateRange, extraParams));
        break;
      case 'movements':
        results.push(generateMovementsReport(data, dateRange, extraParams));
        break;
      case 'production':
        results.push(generateProductionReport(data, dateRange, extraParams));
        break;
      case 'returns':
        results.push(generateReturnsReport(data, dateRange, extraParams));
        break;
      case 'damaged':
        results.push(generateDamagedReport(data, dateRange, extraParams));
        break;
      case 'branches':
        results.push(generateBranchesReport(data));
        break;
      case 'customers':
        results.push(generateCustomersReport(data));
        break;
      case 'categories':
        results.push(generateCategoriesReport(data));
        break;
      case 'audit_log':
        results.push(generateAuditLogReport(data, dateRange));
        break;
    }
  }

  return results;
}
