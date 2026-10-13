import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  Download,
  Boxes,
  TrendingUp,
  TrendingDown,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  AlertTriangle,
  RotateCcw,
  Building2,
  Filter,
  Search,
  CheckCircle2,
  Activity,
  ArrowRight,
  PieChart as PieChartIcon,
  HelpCircle,
  Eye,
  SlidersHorizontal,
  Minus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { StockMovement, Item } from '../../types/inventory';
import { playNotificationSound } from '../../services/sound';
import { AnalyticsCharts } from './AnalyticsCharts';

import { NavView } from '../common/Navigation';
import { MovementVoucherModal } from '../movements/MovementVoucherModal';

export type ExtendedPeriod =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'this_week'
  | 'last_week'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'this_year'
  | 'last_year'
  | 'custom';

export type ReportTab =
  | 'dashboard'
  | 'movements'
  | 'returns'
  | 'branches'
  | 'categories'
  | 'stagnant'
  | 'turnover'
  | 'alerts';

export interface ReportsFilterState {
  period: ExtendedPeriod;
  customStartDate?: string;
  customEndDate?: string;
  branchId: string;
  categoryId: string;
  selectedMovementType: string;
  searchQuery: string;
}

interface ReportsViewProps {
  onNavigateToView?: (view: NavView, params?: Record<string, any>) => void;
  savedFilters?: Partial<ReportsFilterState>;
  onSaveFilters?: (filters: ReportsFilterState) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  onNavigateToView,
  savedFilters,
  onSaveFilters,
}) => {
  const { movements, items, categories, units, branches, returns, getItemStock, getItemStockSummary } =
    useInventory();

  // Tab navigation
  const [activeTab, setActiveTab] = useState<ReportTab>('dashboard');

  // Filter States initialized from savedFilters if provided
  const [period, setPeriod] = useState<ExtendedPeriod>(savedFilters?.period || 'this_month');
  const [customStartDate, setCustomStartDate] = useState<string>(savedFilters?.customStartDate || '');
  const [customEndDate, setCustomEndDate] = useState<string>(savedFilters?.customEndDate || '');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(savedFilters?.branchId || 'all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(savedFilters?.categoryId || 'all');
  const [selectedMovementType, setSelectedMovementType] = useState<string>(savedFilters?.selectedMovementType || 'all');
  const [searchQuery, setSearchQuery] = useState<string>(savedFilters?.searchQuery || '');

  // Keep savedFilters synchronized in parent App.tsx
  React.useEffect(() => {
    onSaveFilters?.({
      period,
      customStartDate,
      customEndDate,
      branchId: selectedBranchId,
      categoryId: selectedCategoryId,
      selectedMovementType,
      searchQuery,
    });
  }, [period, customStartDate, customEndDate, selectedBranchId, selectedCategoryId, selectedMovementType, searchQuery, onSaveFilters]);

  // Selected movement voucher modal state
  const [voucherMovement, setVoucherMovement] = useState<StockMovement | null>(null);

  // Expand / collapse states
  const [showAllTopMoving, setShowAllTopMoving] = useState<boolean>(false);
  const [showAllStagnant, setShowAllStagnant] = useState<boolean>(false);

  // Full Printable Preview Modal state
  const [isReportPreviewOpen, setIsReportPreviewOpen] = useState<boolean>(false);

  // Manual refresh state for recalculating analytics
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshSeed, setRefreshSeed] = useState<number>(0);

  const handleRefresh = () => {
    playNotificationSound('bell');
    setIsRefreshing(true);
    setTimeout(() => {
      setRefreshSeed((prev) => prev + 1);
      setIsRefreshing(false);
    }, 450);
  };

  // Date Range calculation with exact boundaries (Start of day 00:00:00 to End of day 23:59:59)
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Helper for previous period
    let prevStart: Date;
    let prevEnd: Date;

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    switch (period) {
      case 'today': {
        start = startOfToday;
        prevStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
        prevEnd = new Date(startOfToday.getTime() - 1);
        break;
      }
      case 'yesterday': {
        start = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        end = new Date(startOfToday.getTime() - 1);
        prevStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
        prevEnd = new Date(start.getTime() - 1);
        break;
      }
      case 'last_7_days': {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const duration = end.getTime() - start.getTime();
        prevEnd = new Date(start.getTime() - 1);
        prevStart = new Date(prevEnd.getTime() - duration);
        break;
      }
      case 'this_week': {
        // Week starts on Saturday (common in KSA) or Sunday
        const dayOfWeek = now.getDay(); // 0 is Sunday, 6 is Saturday
        // Let's assume Saturday is 0 offset
        const diffToSaturday = (dayOfWeek + 1) % 7;
        start = new Date(startOfToday.getTime() - diffToSaturday * 24 * 60 * 60 * 1000);
        const duration = end.getTime() - start.getTime();
        prevEnd = new Date(start.getTime() - 1);
        prevStart = new Date(prevEnd.getTime() - duration);
        break;
      }
      case 'last_week': {
        const dayOfWeek = now.getDay();
        const diffToSaturday = (dayOfWeek + 1) % 7;
        const currentWeekStart = new Date(
          startOfToday.getTime() - diffToSaturday * 24 * 60 * 60 * 1000
        );
        end = new Date(currentWeekStart.getTime() - 1);
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);
        prevEnd = new Date(start.getTime() - 1);
        prevStart = new Date(prevEnd.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);
        break;
      }
      case 'last_30_days': {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const duration = end.getTime() - start.getTime();
        prevEnd = new Date(start.getTime() - 1);
        prevStart = new Date(prevEnd.getTime() - duration);
        break;
      }
      case 'this_month': {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0);
        prevEnd = new Date(start.getTime() - 1);
        prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        break;
      }
      case 'last_month': {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
        prevEnd = new Date(start.getTime() - 1);
        break;
      }
      case 'last_3_months': {
        start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate(), 0, 0, 0, 0);
        const duration = end.getTime() - start.getTime();
        prevEnd = new Date(start.getTime() - 1);
        prevStart = new Date(prevEnd.getTime() - duration);
        break;
      }
      case 'last_6_months': {
        start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate(), 0, 0, 0, 0);
        const duration = end.getTime() - start.getTime();
        prevEnd = new Date(start.getTime() - 1);
        prevStart = new Date(prevEnd.getTime() - duration);
        break;
      }
      case 'this_year': {
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
        prevEnd = new Date(start.getTime() - 1);
        break;
      }
      case 'last_year': {
        start = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        prevStart = new Date(now.getFullYear() - 2, 0, 1, 0, 0, 0, 0);
        prevEnd = new Date(start.getTime() - 1);
        break;
      }
      case 'custom': {
        start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : new Date(0);
        end = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : now;
        const duration = Math.max(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
        prevEnd = new Date(start.getTime() - 1);
        prevStart = new Date(prevEnd.getTime() - duration);
        break;
      }
      default: {
        start = new Date(0);
        prevStart = new Date(0);
        prevEnd = new Date(0);
      }
    }

    return {
      start,
      end,
      prevStart,
      prevEnd,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      prevStartIso: prevStart.toISOString(),
      prevEndIso: prevEnd.toISOString(),
      formattedStart: start.toLocaleDateString('ar-SA'),
      formattedEnd: end.toLocaleDateString('ar-SA'),
    };
  }, [period, customStartDate, customEndDate]);

  // Filter movements for Current and Previous Period
  const { currentMovements, prevMovements } = useMemo(() => {
    const cur = movements.filter((m) => {
      const d = m.date;
      if (d < dateRange.startIso || d > dateRange.endIso) return false;
      if (selectedBranchId !== 'all' && m.branchId !== selectedBranchId) return false;
      if (selectedMovementType !== 'all' && m.type !== selectedMovementType) return false;
      if (selectedCategoryId !== 'all') {
        const it = items.find((i) => i.id === m.itemId);
        if (!it || it.categoryId !== selectedCategoryId) return false;
      }
      return true;
    });

    const prev = movements.filter((m) => {
      const d = m.date;
      if (d < dateRange.prevStartIso || d > dateRange.prevEndIso) return false;
      if (selectedBranchId !== 'all' && m.branchId !== selectedBranchId) return false;
      if (selectedMovementType !== 'all' && m.type !== selectedMovementType) return false;
      if (selectedCategoryId !== 'all') {
        const it = items.find((i) => i.id === m.itemId);
        if (!it || it.categoryId !== selectedCategoryId) return false;
      }
      return true;
    });

    return { currentMovements: cur, prevMovements: prev };
  }, [
    movements,
    items,
    dateRange,
    selectedBranchId,
    selectedCategoryId,
    selectedMovementType,
  ]);

  // Aggregate Metrics & Comparisons
  const metrics = useMemo(() => {
    let inCount = 0;
    let outCount = 0;
    let inBaseQty = 0;
    let outBaseQty = 0;

    for (const m of currentMovements) {
      if (m.type === 'IN') {
        inCount++;
        inBaseQty += m.baseQuantity;
      } else if (m.type === 'OUT') {
        outCount++;
        outBaseQty += m.baseQuantity;
      }
    }

    // Previous period metrics
    let prevInBaseQty = 0;
    let prevOutBaseQty = 0;
    let prevInCount = 0;
    let prevOutCount = 0;

    for (const m of prevMovements) {
      if (m.type === 'IN') {
        prevInCount++;
        prevInBaseQty += m.baseQuantity;
      } else if (m.type === 'OUT') {
        prevOutCount++;
        prevOutBaseQty += m.baseQuantity;
      }
    }

    const netChange = inBaseQty - outBaseQty;
    const prevNetChange = prevInBaseQty - prevOutBaseQty;

    // Active items count
    const activeItems = items.filter((i) => !i.isDeleted && !i.isArchived);
    const archivedItems = items.filter((i) => i.isArchived && !i.isDeleted);

    // Reorder alert items (stock <= minStockAlert)
    const lowStockItems = activeItems.filter((i) => {
      const stock = getItemStock(i.id);
      return i.minStockAlert > 0 && stock <= i.minStockAlert;
    });

    // Out of stock items (stock === 0)
    const outOfStockItems = activeItems.filter((i) => getItemStock(i.id) === 0);

    // Stock value
    let totalStockValue = 0;
    for (const item of activeItems) {
      if (item.costPrice && item.costPrice > 0) {
        const stock = getItemStock(item.id);
        totalStockValue += stock * item.costPrice;
      }
    }

    // Breakdown of stock by units (avoids misleading sum of heterogeneous units)
    const stockByUnitMap: Record<string, { unitName: string; totalQty: number }> = {};
    for (const item of activeItems) {
      const stock = getItemStock(item.id);
      const unit = units.find((u) => u.id === item.baseUnitId);
      const uName = unit?.name || 'وحدة';
      if (!stockByUnitMap[uName]) {
        stockByUnitMap[uName] = { unitName: uName, totalQty: 0 };
      }
      stockByUnitMap[uName].totalQty += stock;
    }

    // Trend calculator
    const calcTrend = (cur: number, prev: number) => {
      if (prevMovements.length === 0 || prev === 0) {
        return {
          cur,
          prev,
          diff: cur,
          percent: null as number | null,
          text: 'لا توجد بيانات للفترة السابقة',
          status: 'neutral' as const,
          hasPrev: false,
        };
      }
      const diff = Math.round((cur - prev) * 100) / 100;
      const percent = Math.round((diff / prev) * 100);
      return {
        cur,
        prev,
        diff,
        percent,
        text: `${diff >= 0 ? '+' : ''}${diff.toLocaleString('ar-SA')} (${percent > 0 ? '+' : ''}${percent}%)`,
        status: diff > 0 ? ('up' as const) : diff < 0 ? ('down' as const) : ('neutral' as const),
        hasPrev: true,
      };
    };

    return {
      inCount,
      outCount,
      prevInCount,
      prevOutCount,
      totalMovementsCount: inCount + outCount,
      prevTotalMovementsCount: prevInCount + prevOutCount,
      inBaseQty: Math.round(inBaseQty * 100) / 100,
      outBaseQty: Math.round(outBaseQty * 100) / 100,
      prevInBaseQty: Math.round(prevInBaseQty * 100) / 100,
      prevOutBaseQty: Math.round(prevOutBaseQty * 100) / 100,
      netChange: Math.round(netChange * 100) / 100,
      prevNetChange: Math.round(prevNetChange * 100) / 100,
      inTrend: calcTrend(inBaseQty, prevInBaseQty),
      outTrend: calcTrend(outBaseQty, prevOutBaseQty),
      netTrend: calcTrend(netChange, prevNetChange),
      movementsTrend: calcTrend(inCount + outCount, prevInCount + prevOutCount),
      totalItemsCount: items.filter((i) => !i.isDeleted).length,
      activeItemsCount: activeItems.length,
      archivedItemsCount: archivedItems.length,
      lowStockCount: lowStockItems.length,
      lowStockItems,
      outOfStockCount: outOfStockItems.length,
      outOfStockItems,
      totalStockValue: Math.round(totalStockValue * 100) / 100,
      stockByUnitList: Object.values(stockByUnitMap).filter((s) => s.totalQty > 0),
    };
  }, [currentMovements, prevMovements, items, units, getItemStock, refreshSeed]);

  // Filter Returns for Selected Period and Branch/Search
  const periodReturns = useMemo(() => {
    return returns.filter((r) => {
      const d = r.date;
      if (d < dateRange.startIso || d > dateRange.endIso) return false;
      if (selectedBranchId !== 'all' && r.branchId !== selectedBranchId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = r.returnNumber.toLowerCase().includes(q);
        const matchParty = (r.partyName || '').toLowerCase().includes(q);
        const matchBranch = (r.branchName || '').toLowerCase().includes(q);
        const matchRef = (r.originalReferenceNumber || '').toLowerCase().includes(q);
        if (!matchNumber && !matchParty && !matchBranch && !matchRef) return false;
      }
      return true;
    });
  }, [returns, dateRange, selectedBranchId, searchQuery]);

  const returnsMetrics = useMemo(() => {
    const total = periodReturns.length;
    const inReturns = periodReturns.filter((r) => r.type === 'RETURN_IN' && r.status === 'APPROVED');
    const outReturns = periodReturns.filter((r) => r.type === 'RETURN_OUT' && r.status === 'APPROVED');
    const drafts = periodReturns.filter((r) => r.status === 'DRAFT');
    const cancelled = periodReturns.filter((r) => r.status === 'CANCELLED');

    let totalInQtyBase = 0;
    let totalOutQtyBase = 0;

    for (const r of inReturns) {
      for (const it of r.items) {
        totalInQtyBase += it.baseQuantity;
      }
    }
    for (const r of outReturns) {
      for (const it of r.items) {
        totalOutQtyBase += it.baseQuantity;
      }
    }

    // Reason frequency
    const reasonCounts: Record<string, number> = {};
    for (const r of periodReturns) {
      reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
    }

    // Top returned items
    const itemReturnCounts: Record<string, { count: number; totalBaseQty: number }> = {};
    for (const r of periodReturns) {
      for (const it of r.items) {
        if (!itemReturnCounts[it.itemId]) {
          itemReturnCounts[it.itemId] = { count: 0, totalBaseQty: 0 };
        }
        itemReturnCounts[it.itemId].count += 1;
        itemReturnCounts[it.itemId].totalBaseQty += it.baseQuantity;
      }
    }

    const topReturnedItems = Object.entries(itemReturnCounts)
      .map(([itemId, data]) => {
        const item = items.find((i) => i.id === itemId);
        const baseUnit = item ? units.find((u) => u.id === item.baseUnitId) : null;
        return {
          item,
          count: data.count,
          totalBaseQty: Math.round(data.totalBaseQty * 100) / 100,
          baseUnitName: baseUnit?.name || 'وحدة',
        };
      })
      .sort((a, b) => b.totalBaseQty - a.totalBaseQty)
      .slice(0, 10);

    return {
      total,
      inCount: inReturns.length,
      outCount: outReturns.length,
      draftCount: drafts.length,
      cancelledCount: cancelled.length,
      totalInQtyBase: Math.round(totalInQtyBase * 100) / 100,
      totalOutQtyBase: Math.round(totalOutQtyBase * 100) / 100,
      reasonCounts,
      topReturnedItems,
    };
  }, [periodReturns, items, units]);

  // Top In/Out Items & Fast/Slow Movers
  const itemActivityAnalysis = useMemo(() => {
    const map = new Map<
      string,
      {
        inQty: number;
        outQty: number;
        inCount: number;
        outCount: number;
        totalQty: number;
        movementsCount: number;
      }
    >();

    for (const m of currentMovements) {
      const prev = map.get(m.itemId) || {
        inQty: 0,
        outQty: 0,
        inCount: 0,
        outCount: 0,
        totalQty: 0,
        movementsCount: 0,
      };
      if (m.type === 'IN') {
        prev.inQty += m.baseQuantity;
        prev.inCount++;
      } else {
        prev.outQty += m.baseQuantity;
        prev.outCount++;
      }
      prev.totalQty += m.baseQuantity;
      prev.movementsCount++;
      map.set(m.itemId, prev);
    }

    const activeItems = items.filter((i) => !i.isDeleted && !i.isArchived);

    const detailedList = activeItems.map((item) => {
      const data = map.get(item.id) || {
        inQty: 0,
        outQty: 0,
        inCount: 0,
        outCount: 0,
        totalQty: 0,
        movementsCount: 0,
      };
      const cat = categories.find((c) => c.id === item.categoryId);
      const baseUnit = units.find((u) => u.id === item.baseUnitId);
      const stock = getItemStock(item.id);

      // Turnover rate / velocity (outQty / average stock or total)
      const turnoverRatio = stock > 0 ? Math.round((data.outQty / stock) * 100) / 100 : data.outQty > 0 ? 999 : 0;

      return {
        item,
        categoryName: cat?.name || 'غير محدد',
        baseUnitName: baseUnit?.name || 'وحدة',
        currentStock: stock,
        inQty: Math.round(data.inQty * 100) / 100,
        outQty: Math.round(data.outQty * 100) / 100,
        totalQty: Math.round(data.totalQty * 100) / 100,
        inCount: data.inCount,
        outCount: data.outCount,
        movementsCount: data.movementsCount,
        turnoverRatio,
        hasActivity: data.movementsCount > 0,
      };
    });

    // Top In
    const topInItems = [...detailedList].sort((a, b) => b.inQty - a.inQty).filter((x) => x.inQty > 0);
    // Top Out
    const topOutItems = [...detailedList].sort((a, b) => b.outQty - a.outQty).filter((x) => x.outQty > 0);
    // Most Active overall
    const mostActiveItems = [...detailedList].sort((a, b) => b.movementsCount - a.movementsCount).filter((x) => x.hasActivity);
    // Stagnant / Zero movement during this period
    const stagnantItems = detailedList.filter((x) => !x.hasActivity && x.currentStock > 0).sort((a, b) => b.currentStock - a.currentStock);

    return {
      all: detailedList,
      topInItems,
      topOutItems,
      mostActiveItems,
      stagnantItems,
    };
  }, [currentMovements, items, categories, units, getItemStock]);

  // Branch Performance Analysis
  const branchAnalysis = useMemo(() => {
    const branchMap: Record<
      string,
      {
        branchName: string;
        outCount: number;
        outBaseQty: number;
        itemMap: Record<string, number>;
      }
    > = {};

    for (const m of currentMovements) {
      if (m.type === 'OUT') {
        const bId = m.branchId || 'main';
        const bName =
          m.branchName ||
          branches.find((b) => b.id === m.branchId)?.name ||
          (bId === 'main' ? 'الصرف المباشر / غير محدد' : 'فرع غير مسجل');

        if (!branchMap[bId]) {
          branchMap[bId] = {
            branchName: bName,
            outCount: 0,
            outBaseQty: 0,
            itemMap: {},
          };
        }
        branchMap[bId].outCount++;
        branchMap[bId].outBaseQty += m.baseQuantity;
        branchMap[bId].itemMap[m.itemId] = (branchMap[bId].itemMap[m.itemId] || 0) + m.baseQuantity;
      }
    }

    return Object.entries(branchMap).map(([branchId, data]) => ({
      branchId,
      branchName: data.branchName,
      outCount: data.outCount,
      outBaseQty: Math.round(data.outBaseQty * 100) / 100,
      uniqueItemCount: Object.keys(data.itemMap).length,
    })).sort((a, b) => b.outBaseQty - a.outBaseQty);
  }, [currentMovements, branches]);

  // Category Distribution & Movement
  const categoryAnalysis = useMemo(() => {
    const catMap: Record<
      string,
      {
        name: string;
        itemsCount: number;
        inQty: number;
        outQty: number;
        currentStock: number;
      }
    > = {};

    for (const cat of categories) {
      catMap[cat.id] = {
        name: cat.name,
        itemsCount: 0,
        inQty: 0,
        outQty: 0,
        currentStock: 0,
      };
    }

    const activeItems = items.filter((i) => !i.isDeleted && !i.isArchived);
    for (const item of activeItems) {
      const cId = item.categoryId;
      if (catMap[cId]) {
        catMap[cId].itemsCount++;
        catMap[cId].currentStock += getItemStock(item.id);
      }
    }

    for (const m of currentMovements) {
      const it = items.find((i) => i.id === m.itemId);
      if (it && catMap[it.categoryId]) {
        if (m.type === 'IN') {
          catMap[it.categoryId].inQty += m.baseQuantity;
        } else {
          catMap[it.categoryId].outQty += m.baseQuantity;
        }
      }
    }

    return Object.values(catMap).map((c) => ({
      ...c,
      inQty: Math.round(c.inQty * 100) / 100,
      outQty: Math.round(c.outQty * 100) / 100,
      currentStock: Math.round(c.currentStock * 100) / 100,
    })).sort((a, b) => b.outQty + b.inQty - (a.outQty + a.inQty));
  }, [categories, items, currentMovements, getItemStock]);

  // Period Label mapping
  const periodLabel = useMemo(() => {
    switch (period) {
      case 'today':
        return 'اليوم';
      case 'yesterday':
        return 'أمس';
      case 'last_7_days':
        return 'آخر 7 أيام';
      case 'this_week':
        return 'الأسبوع الحالي';
      case 'last_week':
        return 'الأسبوع الماضي كاملًا';
      case 'last_30_days':
        return 'آخر 30 يومًا';
      case 'this_month':
        return 'الشهر الحالي';
      case 'last_month':
        return 'الشهر الماضي كاملًا';
      case 'last_3_months':
        return 'آخر 3 أشهر';
      case 'last_6_months':
        return 'آخر 6 أشهر';
      case 'this_year':
        return 'السنة الحالية';
      case 'last_year':
        return 'السنة الماضية';
      case 'custom':
        return `فترة مخصصة (${dateRange.formattedStart} إلى ${dateRange.formattedEnd})`;
      default:
        return 'كامل الفترة';
    }
  }, [period, dateRange]);

  // Standalone Clean Printable Document & Download
  const handleDownloadReportHTML = () => {
    playNotificationSound('bell');
    const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير تحليل المخزون الاحترافي - نظام مدهال الطيب</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;900&display=swap');
    body { font-family: 'Tajawal', sans-serif; padding: 32px; color: #0f172a; margin: 0; background: #fff; line-height: 1.5; }
    .header { border-bottom: 3px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand-title { font-size: 20px; font-weight: 900; color: #047857; margin: 0; }
    .meta-bar { font-size: 12px; color: #64748b; margin-top: 4px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
    .kpi-title { font-size: 11px; color: #64748b; margin-bottom: 4px; font-weight: 700; }
    .kpi-value { font-size: 18px; font-weight: 900; }
    .kpi-trend { font-size: 10px; margin-top: 4px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 11px; text-align: right; }
    th { background: #f1f5f9; padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 800; color: #334155; }
    td { padding: 8px 10px; border: 1px solid #cbd5e1; }
    h2 { font-size: 14px; margin: 24px 0 10px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; font-weight: 800; }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 900;">تقرير وتحليلات المخزون الاحترافي الشامل</h1>
      <div class="meta-bar">الفترة المحددة: <strong>${periodLabel}</strong> (${dateRange.formattedStart} إلى ${dateRange.formattedEnd})</div>
      <div class="meta-bar">تاريخ ووقت الإصدار: ${new Date().toLocaleString('ar-SA')}</div>
    </div>
    <div style="text-align: left;">
      <div class="brand-title">👑 نظام مخزون مدهال الطيب</div>
      <div style="font-size: 11px; color: #64748b;">مركز التقارير والرقابة المخزنية</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi-card">
      <div class="kpi-title">إجمالي الوارد (الدخول)</div>
      <div class="kpi-value" style="color: #059669;">+${metrics.inBaseQty.toLocaleString('ar-SA')}</div>
      <div class="kpi-trend">${metrics.inCount} حركة توريد · مقارنة: ${metrics.inTrend.text}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">إجمالي الصادر (الخروج)</div>
      <div class="kpi-value" style="color: #e11d48;">-${metrics.outBaseQty.toLocaleString('ar-SA')}</div>
      <div class="kpi-trend">${metrics.outCount} حركة صرف · مقارنة: ${metrics.outTrend.text}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">صافي تغير المخزون</div>
      <div class="kpi-value" style="color: ${metrics.netChange >= 0 ? '#0284c7' : '#e11d48'};">${metrics.netChange > 0 ? '+' : ''}${metrics.netChange.toLocaleString('ar-SA')}</div>
      <div class="kpi-trend">مقارنة بالفترة السابقة: ${metrics.netTrend.text}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">إجمالي الأصناف النشطة</div>
      <div class="kpi-value">${metrics.activeItemsCount} صنف</div>
      <div class="kpi-trend">${metrics.lowStockCount} تحتاج إعادة طلب · ${metrics.outOfStockCount} نفدت</div>
    </div>
  </div>

  <h2>1. الأصناف الأكثر خروجاً وصرفاً خلال الفترة</h2>
  <table>
    <thead>
      <tr>
        <th>الصنف والرمز</th>
        <th>القسم</th>
        <th>الوحدة الأساسية</th>
        <th>الكمية المنصرفة</th>
        <th>عدد الحركات</th>
        <th>الرصيد المتبقي</th>
      </tr>
    </thead>
    <tbody>
      ${itemActivityAnalysis.topOutItems.slice(0, 15).map((t) => `
        <tr>
          <td><strong>${t.item.name}</strong> (${t.item.code})</td>
          <td>${t.categoryName}</td>
          <td>${t.baseUnitName}</td>
          <td style="color: #e11d48; font-weight: bold;">-${t.outQty}</td>
          <td>${t.outCount}</td>
          <td><strong>${t.currentStock}</strong></td>
        </tr>
      `).join('') || '<tr><td colspan="6" style="text-align:center;">لا توجد حركات خروج خلال هذه الفترة</td></tr>'}
    </tbody>
  </table>

  <h2>2. الأصناف الأكثر توريداً ودخولاً خلال الفترة</h2>
  <table>
    <thead>
      <tr>
        <th>الصنف والرمز</th>
        <th>القسم</th>
        <th>الوحدة الأساسية</th>
        <th>الكمية الموردة</th>
        <th>عدد الحركات</th>
        <th>الرصيد الحالي</th>
      </tr>
    </thead>
    <tbody>
      ${itemActivityAnalysis.topInItems.slice(0, 15).map((t) => `
        <tr>
          <td><strong>${t.item.name}</strong> (${t.item.code})</td>
          <td>${t.categoryName}</td>
          <td>${t.baseUnitName}</td>
          <td style="color: #059669; font-weight: bold;">+${t.inQty}</td>
          <td>${t.inCount}</td>
          <td><strong>${t.currentStock}</strong></td>
        </tr>
      `).join('') || '<tr><td colspan="6" style="text-align:center;">لا توجد حركات توريد خلال هذه الفترة</td></tr>'}
    </tbody>
  </table>

  <h2>3. الأصناف الراكدة التي لم تسجل أي حركة خلال الفترة ولديها رصيد</h2>
  <table>
    <thead>
      <tr>
        <th>الصنف والرمز</th>
        <th>القسم</th>
        <th>الوحدة الأساسية</th>
        <th>الرصيد الراكد بالمستودع</th>
        <th>تاريخ تسجيل الصنف</th>
      </tr>
    </thead>
    <tbody>
      ${itemActivityAnalysis.stagnantItems.slice(0, 15).map((s) => `
        <tr>
          <td><strong>${s.item.name}</strong> (${s.item.code})</td>
          <td>${s.categoryName}</td>
          <td>${s.baseUnitName}</td>
          <td style="color: #b45309; font-weight: bold;">${s.currentStock}</td>
          <td>${new Date(s.item.createdAt).toLocaleDateString('ar-SA')}</td>
        </tr>
      `).join('') || '<tr><td colspan="5" style="text-align:center;">لا توجد أصناف راكدة لها رصيد</td></tr>'}
    </tbody>
  </table>

  <h2>4. توزيع حركة الصادر حسب الفروع والمواقع</h2>
  <table>
    <thead>
      <tr>
        <th>الفرع أو الوجهة</th>
        <th>عدد عمليات الصرف</th>
        <th>إجمالي الكمية المنصرفة</th>
        <th>عدد الأصناف المختلفة</th>
      </tr>
    </thead>
    <tbody>
      ${branchAnalysis.map((b) => `
        <tr>
          <td><strong>${b.branchName}</strong></td>
          <td>${b.outCount}</td>
          <td style="color: #e11d48; font-weight: bold;">-${b.outBaseQty}</td>
          <td>${b.uniqueItemCount} صنف</td>
        </tr>
      `).join('') || '<tr><td colspan="4" style="text-align:center;">لا توجد بيانات صرف لفروع</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    <div>مسؤول إدارة المستودع: _____________________</div>
    <div>توقيع المسؤول والاعتماد: _____________________</div>
    <div>ختم النظام المعتمد</div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_المخزون_${period}_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintClick = () => {
    playNotificationSound('bell');
    setIsReportPreviewOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900">
                مركز التقارير وتحليلات المخزون الاحترافي
              </h3>
              <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                ERP Analytics
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              تحليل دقيق لحركة الوارد والصادر ومعدلات الدوران والأصناف الراكدة والفروع للفترة المحددة
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              title="إعادة حساب وتحديث لوحة المؤشرات فورياً"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'جارٍ التحديث...' : 'تحديث المؤشرات'}</span>
            </button>

            <button
              onClick={handleDownloadReportHTML}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              title="تنزيل التقرير بتنسيق صفحة ويب رسمية قابلة للحفظ والطباعة"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>تصدير التقرير الفوري</span>
            </button>

            <button
              onClick={handlePrintClick}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              title="معاينة وطباعة التقرير الرسمي"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>معاينة وطباعة التقرير</span>
            </button>
          </div>
        </div>

        {/* PERIOD SELECTOR & ADVANCED FILTERS */}
        <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>اختيار الفترة الزمنية:</span>
            </div>
            <div className="text-xs font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              {dateRange.formattedStart} إلى {dateRange.formattedEnd}
            </div>
          </div>

          {/* Preset Buttons Grid */}
          <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            {[
              { id: 'today', label: 'اليوم' },
              { id: 'yesterday', label: 'أمس' },
              { id: 'last_7_days', label: 'آخر 7 أيام' },
              { id: 'this_week', label: 'الأسبوع الحالي' },
              { id: 'last_week', label: 'الأسبوع الماضي' },
              { id: 'last_30_days', label: 'آخر 30 يوم' },
              { id: 'this_month', label: 'الشهر الحالي' },
              { id: 'last_month', label: 'الشهر الماضي' },
              { id: 'last_3_months', label: 'آخر 3 أشهر' },
              { id: 'last_6_months', label: 'آخر 6 أشهر' },
              { id: 'this_year', label: 'السنة الحالية' },
              { id: 'last_year', label: 'السنة الماضية' },
              { id: 'custom', label: 'فترة مخصصة...' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as ExtendedPeriod)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  period === p.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs if custom is selected */}
          {period === 'custom' && (
            <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl flex flex-wrap items-center gap-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-700">من تاريخ:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-700">إلى تاريخ:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <span className="text-[11px] text-emerald-800">
                يتم تضمين الحركات بدقة من بداية يوم البداية حتى نهاية يوم النهاية
              </span>
            </div>
          )}

          {/* Additional Filter Row: Branch, Category, Movement Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                تصفية حسب الفرع / الوجهة:
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
              >
                <option value="all">جميع الفروع والمواقع</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                تصفية حسب القسم / التصنيف:
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
              >
                <option value="all">جميع الأقسام</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                نوع الحركة المخزنية:
              </label>
              <select
                value={selectedMovementType}
                onChange={(e) => setSelectedMovementType(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
              >
                <option value="all">الكل (وارد وصادر)</option>
                <option value="IN">وارد (دخول فقط)</option>
                <option value="OUT">صادر (خروج فقط)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 text-xs font-bold">
        {[
          { id: 'dashboard', label: 'لوحة المؤشرات العامة', icon: Activity },
          { id: 'movements', label: 'حركة الأصناف (الأكثر والأقل)', icon: TrendingUp },
          { id: 'returns', label: 'تقرير المرتجعات (وارد وصادر)', icon: RotateCcw },
          { id: 'stagnant', label: 'الأصناف الراكدة', icon: Clock },
          { id: 'branches', label: 'تحليل الفروع والمواقع', icon: Building2 },
          { id: 'categories', label: 'تحليل الأقسام والتصنيفات', icon: Layers },
          { id: 'alerts', label: 'تنبيهات حد الطلب والمراجعة', icon: AlertTriangle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ReportTab)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'border-emerald-600 text-emerald-800 bg-emerald-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD / KPIS (Inventory Analytics Dashboard) */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Zero-Stock & Initialization Explanatory Banner */}
          {movements.length === 0 && (
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs animate-in fade-in">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                  <span>نظام إدارة المخزون مهيأ رسميًا — الأرصدة والعمليات نظيفة ومصفّرة (0)</span>
                  <span className="text-[10px] bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                    جاهز للعمليات الفعلية
                  </span>
                </h4>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  تم الانتهاء بنجاح من تصفير كافة الأرصدة وإلغاء العمليات التجريبية. المؤشرات والرسوم البيانية أدناه تعرض القيم الصفرية الفعلية الحقيقية بدون أي بيانات وهمية (Mock Data). بمجرد إدخال الأصناف وتسجيل فواتير التوريد (+) وسندات الصرف (-)، ستتحرك المنحنيات والأسهم ونسب المقارنة تلقائيًا وبصورة دقيقة.
                </p>
              </div>
            </div>
          )}

          {/* 10 CORE METRIC KPI CARDS GRID */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>لوحة المؤشرات الإحصائية الرئيسية (10 بطاقات قياس):</span>
              </h4>
              <span className="text-[11px] font-mono text-slate-400">
                الفترة: {periodLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Card 1: Total Registered Items */}
              <div
                onClick={() => onNavigateToView?.('items', { viewMode: 'items' })}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer group"
                title="اضغط لعرض قائمة الأصناف"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-slate-500 font-bold group-hover:text-emerald-700 transition-colors">1. إجمالي الأصناف المسجلة</span>
                  <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
                    <Boxes className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-slate-900 group-hover:text-emerald-800 transition-colors">
                  {metrics.totalItemsCount.toLocaleString('ar-SA')}
                </div>
                <div className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between">
                  <span>منها {metrics.archivedItemsCount} مؤرشف</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-0.5">
                    فتح الأصناف ←
                  </span>
                </div>
              </div>

              {/* Card 2: Active Items */}
              <div
                onClick={() => onNavigateToView?.('items', { viewMode: 'items', statusFilter: 'IN_STOCK' })}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer group"
                title="اضغط لعرض الأصناف النشطة المتوفرة"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-slate-500 font-bold group-hover:text-emerald-700 transition-colors">2. عدد الأصناف النشطة</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-700">
                  {metrics.activeItemsCount.toLocaleString('ar-SA')}
                </div>
                <div className="text-[10px] text-emerald-700 mt-1.5 flex items-center justify-between font-bold">
                  <span>جاهزة للتداول</span>
                  <span>عرض المتوفر ←</span>
                </div>
              </div>

              {/* Card 3: Zero Stock Items (Clickable -> Inventory Audit with zero stock) */}
              <div
                onClick={() => onNavigateToView?.('items', { viewMode: 'audit', zeroStockOnly: true })}
                className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs hover:border-amber-500 hover:shadow-md transition-all cursor-pointer group bg-amber-50/20"
                title="اضغط للانتقال إلى صفحة الجرد مفلترة على الأصناف التي رصيدها صفر"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-amber-900 font-bold group-hover:text-amber-950 transition-colors">3. أصناف رصيدها صفر</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Minus className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-amber-900">
                  {metrics.outOfStockCount.toLocaleString('ar-SA')}
                </div>
                <div className="text-[10px] text-amber-800 mt-1.5 flex items-center justify-between font-bold">
                  <span>أرصدة فارغة أو مصفّرة</span>
                  <span className="underline font-black">فتح الجرد الصفري ←</span>
                </div>
              </div>

              {/* Card 4: Inward Quantity (Clickable -> Movements filtered on IN and period) */}
              <div
                onClick={() =>
                  onNavigateToView?.('movements', {
                    typeFilter: 'IN',
                    startDate: dateRange.startIso.split('T')[0],
                    endDate: dateRange.endIso.split('T')[0],
                    branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
                  })
                }
                className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group bg-emerald-50/20"
                title="اضغط للانتقال إلى سجل الحركات مفلتر على الوارد للفترة المحددة"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-emerald-800 font-bold">4. إجمالي الوارد (توريد)</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-800">
                  +{metrics.inBaseQty.toLocaleString('ar-SA')}
                </div>
                {/* Comparison Details */}
                <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[10px] text-slate-600 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">
                      السابقة: {metrics.inTrend.hasPrev ? metrics.prevInBaseQty : <span className="italic text-slate-400">لا توجد بيانات</span>}
                    </span>
                    <span className="font-bold font-mono">
                      {metrics.inTrend.hasPrev ? (
                        <>
                          {metrics.inTrend.status === 'up' && <span className="text-emerald-600 font-bold">↑ +{metrics.inTrend.diff}</span>}
                          {metrics.inTrend.status === 'down' && <span className="text-rose-600 font-bold">↓ {metrics.inTrend.diff}</span>}
                          {metrics.inTrend.status === 'neutral' && <span className="text-slate-500">مستقر</span>}
                        </>
                      ) : (
                        <span className="text-[9px] text-slate-400 font-normal">جديدة</span>
                      )}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-500 truncate flex items-center justify-between">
                    <span>{metrics.inTrend.hasPrev && metrics.inTrend.percent !== null ? `التغير: ${metrics.inTrend.percent}%` : 'لا توجد بيانات'}</span>
                    <span className="text-emerald-700 font-bold group-hover:underline">سجل الوارد ←</span>
                  </div>
                </div>
              </div>

              {/* Card 5: Outward Quantity (Clickable -> Movements filtered on OUT and period) */}
              <div
                onClick={() =>
                  onNavigateToView?.('movements', {
                    typeFilter: 'OUT',
                    startDate: dateRange.startIso.split('T')[0],
                    endDate: dateRange.endIso.split('T')[0],
                    branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
                  })
                }
                className="bg-white p-4 rounded-2xl border border-rose-200 shadow-2xs hover:border-rose-500 hover:shadow-md transition-all cursor-pointer group bg-rose-50/20"
                title="اضغط للانتقال إلى سجل الحركات مفلتر على الصادر للفترة المحددة"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-rose-800 font-bold">5. إجمالي الصادر (صرف)</span>
                  <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-rose-700">
                  -{metrics.outBaseQty.toLocaleString('ar-SA')}
                </div>
                {/* Comparison Details */}
                <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[10px] text-slate-600 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">
                      السابقة: {metrics.outTrend.hasPrev ? metrics.prevOutBaseQty : <span className="italic text-slate-400">لا توجد بيانات</span>}
                    </span>
                    <span className="font-bold font-mono">
                      {metrics.outTrend.hasPrev ? (
                        <>
                          {metrics.outTrend.status === 'up' && <span className="text-amber-700 font-bold">↑ +{metrics.outTrend.diff}</span>}
                          {metrics.outTrend.status === 'down' && <span className="text-blue-700 font-bold">↓ {metrics.outTrend.diff}</span>}
                          {metrics.outTrend.status === 'neutral' && <span className="text-slate-500">مستقر</span>}
                        </>
                      ) : (
                        <span className="text-[9px] text-slate-400 font-normal">جديدة</span>
                      )}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-500 truncate flex items-center justify-between">
                    <span>{metrics.outTrend.hasPrev && metrics.outTrend.percent !== null ? `التغير: ${metrics.outTrend.percent}%` : 'لا توجد بيانات'}</span>
                    <span className="text-rose-700 font-bold group-hover:underline">سجل الصادر ←</span>
                  </div>
                </div>
              </div>

              {/* Card 6: Net Stock Flow (Clickable -> Movements filtered) */}
              <div
                onClick={() =>
                  onNavigateToView?.('movements', {
                    typeFilter: 'ALL',
                    startDate: dateRange.startIso.split('T')[0],
                    endDate: dateRange.endIso.split('T')[0],
                    branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
                  })
                }
                className="bg-white p-4 rounded-2xl border border-blue-100 shadow-2xs hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer group"
                title="اضغط لعرض كافة الحركات"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-blue-800 font-bold">6. صافي حركة المخزون</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div
                  className={`text-2xl font-black font-mono ${
                    metrics.netChange >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {metrics.netChange > 0 ? `+${metrics.netChange.toLocaleString('ar-SA')}` : metrics.netChange.toLocaleString('ar-SA')}
                </div>
                {/* Comparison Details */}
                <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[10px] text-slate-600 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">
                      السابقة: {metrics.netTrend.hasPrev ? metrics.prevNetChange : <span className="italic text-slate-400">لا توجد بيانات</span>}
                    </span>
                    <span className="font-bold font-mono">
                      {metrics.netTrend.hasPrev ? (
                        <>
                          {metrics.netTrend.status === 'up' && <span className="text-emerald-700">↑ {metrics.netTrend.diff}</span>}
                          {metrics.netTrend.status === 'down' && <span className="text-rose-700">↓ {metrics.netTrend.diff}</span>}
                          {metrics.netTrend.status === 'neutral' && <span className="text-slate-500">مستقر</span>}
                        </>
                      ) : (
                        <span className="text-[9px] text-slate-400">جديدة</span>
                      )}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-500 truncate">
                    فارق الوارد والصادر
                  </div>
                </div>
              </div>

              {/* Card 7: Total Operations Count (Clickable -> Movements) */}
              <div
                onClick={() =>
                  onNavigateToView?.('movements', {
                    typeFilter: 'ALL',
                    startDate: dateRange.startIso.split('T')[0],
                    endDate: dateRange.endIso.split('T')[0],
                    branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
                  })
                }
                className="bg-white p-4 rounded-2xl border border-purple-100 shadow-2xs hover:border-purple-400 hover:shadow-xs transition-all cursor-pointer group"
                title="اضغط لعرض كافة الحركات"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-purple-900 font-bold">7. عدد عمليات الوارد والصادر</span>
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-purple-950">
                  {metrics.totalMovementsCount.toLocaleString('ar-SA')}
                </div>
                <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[10px] text-slate-600 flex items-center justify-between">
                  <span className="text-emerald-700 font-bold">{metrics.inCount} وارد</span>
                  <span className="text-rose-700 font-bold">{metrics.outCount} صادر</span>
                </div>
              </div>

              {/* Card 8: Stagnant Items Count */}
              <div
                onClick={() => setActiveTab('stagnant')}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-amber-400 hover:shadow-xs transition-all cursor-pointer group"
                title="اضغط لعرض تبويب الأصناف الراكدة"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-slate-500 font-bold">8. عدد الأصناف الراكدة</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-amber-800">
                  {itemActivityAnalysis.stagnantItems.length.toLocaleString('ar-SA')}
                </div>
                <div className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between">
                  <span>لم تتحرك بالفترة</span>
                  <span className="text-amber-800 font-bold">عرض الراكد ←</span>
                </div>
              </div>

              {/* Card 9: Reorder Alert Items (Clickable -> Items View with low stock) */}
              <div
                onClick={() => onNavigateToView?.('items', { viewMode: 'items', statusFilter: 'LOW_STOCK' })}
                className="bg-white p-4 rounded-2xl border border-rose-200 shadow-2xs hover:border-rose-400 hover:shadow-xs transition-all cursor-pointer group"
                title="اضغط لعرض الأصناف تحت حد إعادة الطلب"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-rose-800 font-bold">9. حد إعادة الطلب</span>
                  <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-rose-700">
                  {metrics.lowStockCount.toLocaleString('ar-SA')}
                </div>
                <div className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between">
                  <span>شارفت على النفاد</span>
                  <span className="text-rose-700 font-bold">معاينة الأصناف ←</span>
                </div>
              </div>

              {/* Card 10: Registered Branches & Warehouses (Clickable -> Branches View) */}
              <div
                onClick={() => onNavigateToView?.('branches')}
                className="bg-white p-4 rounded-2xl border border-teal-200 shadow-2xs hover:border-teal-400 hover:shadow-xs transition-all cursor-pointer group"
                title="اضغط للانتقال إلى إدارة الفروع والمواقع"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-teal-800 font-bold">10. المواقع والفروع المسجلة</span>
                  <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-teal-800">
                  {branches.length.toLocaleString('ar-SA')}
                </div>
                <div className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between">
                  <span>فروع ووجهات شحن</span>
                  <span className="text-teal-700 font-bold">إدارة الفروع ←</span>
                </div>
              </div>
            </div>
          </div>

          {/* STOCK BY DISTINCT UNITS BANNER (Homogeneous Unit Segregation) */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-600" />
                <span>تفصيل كميات المخزون المتوفرة حسب نوع الوحدة (تجنب الجمع المضلل لوحدات غير متجانسة):</span>
              </h4>
              <span className="text-[11px] text-slate-500">
                القيمة الإجمالية المقدرة: <strong className="font-mono text-slate-800">{metrics.totalStockValue > 0 ? `${metrics.totalStockValue.toLocaleString('ar-SA')} ر.س` : '0 ر.س'}</strong>
              </span>
            </div>

            {metrics.stockByUnitList.length === 0 ? (
              <div className="text-xs text-slate-400 font-mono py-1">
                الرصيد الإجمالي صفر لجميع الأصناف والوحدات حالياً (المخزون مصفّر وجاهز).
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {metrics.stockByUnitList.map((u, i) => (
                  <div
                    key={i}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-2"
                  >
                    <span className="text-slate-500">{u.unitName}:</span>
                    <span className="font-mono font-black text-slate-900">
                      {u.totalQty.toLocaleString('ar-SA')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. EXECUTIVE SUMMARY (الملخص التحليلي للأعمال) */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-md border border-slate-800">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-black text-white">الملخص التحليلي وأهم نتائج الفترة</h4>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                  ERP Intelligence Summary
                </span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                محسوبة مباشرة من البيانات الحقيقية
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs">
              {/* Insight 1: Top Out Item */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 block mb-1">أعلى الأصناف خروجاً (صرف):</span>
                {itemActivityAnalysis.topOutItems[0] ? (
                  <div>
                    <div className="font-bold text-white text-xs truncate" title={itemActivityAnalysis.topOutItems[0].item.name}>
                      {itemActivityAnalysis.topOutItems[0].item.name}
                    </div>
                    <div className="font-mono text-rose-400 font-black text-[11px] mt-0.5">
                      -{itemActivityAnalysis.topOutItems[0].outQty} {itemActivityAnalysis.topOutItems[0].baseUnitName}
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500 font-mono">لا توجد حركات خروج</span>
                )}
              </div>

              {/* Insight 2: Top In Item */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 block mb-1">أعلى الأصناف دخولاً (توريد):</span>
                {itemActivityAnalysis.topInItems[0] ? (
                  <div>
                    <div className="font-bold text-white text-xs truncate" title={itemActivityAnalysis.topInItems[0].item.name}>
                      {itemActivityAnalysis.topInItems[0].item.name}
                    </div>
                    <div className="font-mono text-emerald-400 font-black text-[11px] mt-0.5">
                      +{itemActivityAnalysis.topInItems[0].inQty} {itemActivityAnalysis.topInItems[0].baseUnitName}
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500 font-mono">لا توجد حركات دخول</span>
                )}
              </div>

              {/* Insight 3: Most Active Item */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 block mb-1">الصنف الأكثر حركة إجمالاً:</span>
                {itemActivityAnalysis.mostActiveItems[0] ? (
                  <div>
                    <div className="font-bold text-white text-xs truncate" title={itemActivityAnalysis.mostActiveItems[0].item.name}>
                      {itemActivityAnalysis.mostActiveItems[0].item.name}
                    </div>
                    <div className="font-mono text-blue-400 font-black text-[11px] mt-0.5">
                      {itemActivityAnalysis.mostActiveItems[0].movementsCount} حركة ({itemActivityAnalysis.mostActiveItems[0].totalQty} {itemActivityAnalysis.mostActiveItems[0].baseUnitName})
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500 font-mono">لا توجد حركات مسجلة</span>
                )}
              </div>

              {/* Insight 4: Stagnant Percentage */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 block mb-1">نسبة الأصناف الراكدة:</span>
                <div className="font-mono font-black text-amber-400 text-sm">
                  {metrics.activeItemsCount > 0
                    ? `${Math.round((itemActivityAnalysis.stagnantItems.length / metrics.activeItemsCount) * 100)}%`
                    : '0%'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  ({itemActivityAnalysis.stagnantItems.length} صنف من {metrics.activeItemsCount})
                </div>
              </div>

              {/* Insight 5: Reorder & Low Stock Alerts */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 block mb-1">تنبيه النفاد وحد الطلب:</span>
                <div className="font-mono font-black text-rose-400 text-sm">
                  {metrics.lowStockCount} أصناف
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {metrics.outOfStockCount} صنف نفد رصيده تماماً
                </div>
              </div>
            </div>
          </div>

          {/* 4. REAL INTERACTIVE VISUAL CHARTS SUITE (All 5 Visual Types) */}
          <AnalyticsCharts
            movements={currentMovements}
            dateRange={dateRange}
            period={period}
            items={items}
            categories={categories}
            branches={branches}
            units={units}
            getItemStock={getItemStock}
            topInItems={itemActivityAnalysis.topInItems}
            topOutItems={itemActivityAnalysis.topOutItems}
            mostActiveItems={itemActivityAnalysis.mostActiveItems}
            branchAnalysis={branchAnalysis}
            categoryAnalysis={categoryAnalysis}
          />

          {/* TOP 5 OUT & TOP 5 IN SUMMARY ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fast Movers (Top Out) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-rose-600" />
                  <span>الأصناف الأكثر صرفاً وخروجاً</span>
                </h4>
                <button
                  onClick={() => setActiveTab('movements')}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer"
                >
                  عرض السجل الكامل ←
                </button>
              </div>

              {itemActivityAnalysis.topOutItems.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  لا توجد حركات صرف مسجلة خلال الفترة
                </div>
              ) : (
                <div className="space-y-3">
                  {itemActivityAnalysis.topOutItems.slice(0, 5).map((t, idx) => (
                    <div
                      key={t.item.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 block">{t.item.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{t.item.code}</span>
                        </div>
                      </div>
                      <div className="text-left font-mono">
                        <div className="font-black text-rose-700">
                          -{t.outQty} {t.baseUnitName}
                        </div>
                        <div className="text-[10px] text-slate-400">{t.outCount} عمليات</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fast In (Top In) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                  <span>الأصناف الأكثر توريداً ودخولاً</span>
                </h4>
                <button
                  onClick={() => setActiveTab('movements')}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer"
                >
                  عرض السجل الكامل ←
                </button>
              </div>

              {itemActivityAnalysis.topInItems.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  لا توجد حركات توريد مسجلة خلال الفترة
                </div>
              ) : (
                <div className="space-y-3">
                  {itemActivityAnalysis.topInItems.slice(0, 5).map((t, idx) => (
                    <div
                      key={t.item.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 block">{t.item.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{t.item.code}</span>
                        </div>
                      </div>
                      <div className="text-left font-mono">
                        <div className="font-black text-emerald-700">
                          +{t.inQty} {t.baseUnitName}
                        </div>
                        <div className="text-[10px] text-slate-400">{t.inCount} عمليات</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DETAILED ITEM MOVEMENTS (Fast / Slow Movers) */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>حركة الأصناف التفصيلية (الأكثر حركة ونشاطاً)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                تتبع إجمالي الوارد والصادر ومعدل النشاط والرصيد المتوفر الحالي
              </p>
            </div>
            <div className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">
              إجمالي الأصناف المتحركة: {itemActivityAnalysis.mostActiveItems.length}
            </div>
          </div>

          {itemActivityAnalysis.mostActiveItems.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              لا توجد أي حركات مخزنية مسجلة خلال الفترة المحددة.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">الصنف والرمز</th>
                    <th className="py-3 px-4">القسم</th>
                    <th className="py-3 px-4">الوارد (دخول)</th>
                    <th className="py-3 px-4">الصادر (خروج)</th>
                    <th className="py-3 px-4">صافي التغير</th>
                    <th className="py-3 px-4">عدد العمليات</th>
                    <th className="py-3 px-4">الرصيد الفعلي الحالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {(showAllTopMoving
                    ? itemActivityAnalysis.mostActiveItems
                    : itemActivityAnalysis.mostActiveItems.slice(0, 10)
                  ).map((r) => {
                    const net = r.inQty - r.outQty;
                    return (
                      <tr key={r.item.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4">
                          <button
                            onClick={() =>
                              onNavigateToView?.('items', {
                                viewMode: 'audit',
                                searchQuery: r.item.name,
                                detailItemId: r.item.id,
                              })
                            }
                            className="font-bold text-slate-900 block hover:text-emerald-700 hover:underline text-right cursor-pointer"
                            title="اضغط لفتح بطاقة وفحص جرد هذا الصنف"
                          >
                            {r.item.name}
                          </button>
                          <span className="text-[10px] font-mono text-slate-400">{r.item.code}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <button
                            onClick={() =>
                              onNavigateToView?.('items', {
                                categoryId: r.item.categoryId,
                              })
                            }
                            className="hover:text-emerald-700 hover:underline cursor-pointer text-right"
                            title="اضغط لتصفية الأصناف حسب هذا القسم"
                          >
                            {r.categoryName}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                          +{r.inQty} {r.baseUnitName}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-rose-700">
                          -{r.outQty} {r.baseUnitName}
                        </td>
                        <td
                          className={`py-3 px-4 font-mono font-bold ${
                            net >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {net > 0 ? `+${net}` : net} {r.baseUnitName}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          <button
                            onClick={() =>
                              onNavigateToView?.('movements', {
                                searchQuery: r.item.name,
                              })
                            }
                            className="text-emerald-700 hover:underline font-bold cursor-pointer"
                            title="عرض حركات هذا الصنف في سجل الحركات"
                          >
                            {r.movementsCount} عملية ←
                          </button>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          <button
                            onClick={() =>
                              onNavigateToView?.('items', {
                                viewMode: 'audit',
                                detailItemId: r.item.id,
                              })
                            }
                            className="hover:text-teal-700 hover:underline cursor-pointer"
                            title="معاينة رصيد الجرد لهذا الصنف"
                          >
                            {r.currentStock} {r.baseUnitName}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {itemActivityAnalysis.mostActiveItems.length > 10 && (
                <div className="p-3 bg-slate-50/70 border-t border-slate-100 text-center">
                  <button
                    onClick={() => setShowAllTopMoving(!showAllTopMoving)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    {showAllTopMoving ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>عرض أول 10 فقط</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
                        <span>عرض جميع الأصناف ({itemActivityAnalysis.mostActiveItems.length})</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STAGNANT ITEMS (الراكدة) */}
      {activeTab === 'stagnant' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>الأصناف الراكدة (التي لم تسجل أي حركة خلال الفترة ولديها رصيد)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                تساعدك في معرفة البضاعة المعطلة ومواقع تجميد السيولة لاتخاذ قرارات الترويج أو التصريف
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200">
              {itemActivityAnalysis.stagnantItems.length} صنف راكد
            </span>
          </div>

          {itemActivityAnalysis.stagnantItems.length === 0 ? (
            <div className="p-12 text-center text-xs text-emerald-700 font-bold">
              لا توجد أصناف راكدة لها رصيد غير متحرك خلال هذه الفترة!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">الصنف والرمز</th>
                    <th className="py-3 px-4">القسم</th>
                    <th className="py-3 px-4">الوحدة الأساسية</th>
                    <th className="py-3 px-4">الرصيد الراكد بالمستودع</th>
                    <th className="py-3 px-4">قيمة الرصيد المعطل المقدرة</th>
                    <th className="py-3 px-4">تاريخ الإضافة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {(showAllStagnant
                    ? itemActivityAnalysis.stagnantItems
                    : itemActivityAnalysis.stagnantItems.slice(0, 10)
                  ).map((r) => {
                    const value = r.item.costPrice ? r.currentStock * r.item.costPrice : 0;
                    return (
                      <tr key={r.item.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4">
                          <button
                            onClick={() =>
                              onNavigateToView?.('items', {
                                viewMode: 'audit',
                                searchQuery: r.item.name,
                                detailItemId: r.item.id,
                              })
                            }
                            className="font-bold text-slate-900 block hover:text-emerald-700 hover:underline text-right cursor-pointer"
                            title="اضغط لفتح بطاقة وفحص جرد هذا الصنف"
                          >
                            {r.item.name}
                          </button>
                          <span className="text-[10px] font-mono text-slate-400">{r.item.code}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <button
                            onClick={() =>
                              onNavigateToView?.('items', {
                                categoryId: r.item.categoryId,
                              })
                            }
                            className="hover:text-emerald-700 hover:underline cursor-pointer text-right"
                            title="اضغط لتصفية الأصناف حسب هذا القسم"
                          >
                            {r.categoryName}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{r.baseUnitName}</td>
                        <td className="py-3 px-4 font-mono font-black text-amber-800">
                          {r.currentStock} {r.baseUnitName}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 font-bold">
                          {value > 0 ? `${value.toLocaleString('ar-SA')} ر.س` : 'غير محدد'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {new Date(r.item.createdAt).toLocaleDateString('ar-SA')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {itemActivityAnalysis.stagnantItems.length > 10 && (
                <div className="p-3 bg-slate-50/70 border-t border-slate-100 text-center">
                  <button
                    onClick={() => setShowAllStagnant(!showAllStagnant)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    {showAllStagnant ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>عرض أول 10 فقط</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5 text-amber-600" />
                        <span>عرض جميع الأصناف الراكدة ({itemActivityAnalysis.stagnantItems.length})</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BRANCH ANALYSIS (الفروع) */}
      {activeTab === 'branches' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>تحليل حركة الصادر والتوزيع حسب الفروع والمواقع</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                مقارنة الاستهلاك وسحب البضاعة بين فروع ومواقع الشركة خلال الفترة
              </p>
            </div>
          </div>

          {branchAnalysis.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              لا توجد عمليات صرف مسجلة لفروع خلال الفترة المحددة.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">اسم الفرع / الوجهة</th>
                    <th className="py-3 px-4">عدد عمليات الصرف</th>
                    <th className="py-3 px-4">إجمالي الكمية المنصرفة</th>
                    <th className="py-3 px-4">عدد الأصناف المتنوعة المنصرفة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {branchAnalysis.map((b) => (
                    <tr key={b.branchId} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <button
                          onClick={() => onNavigateToView?.('movements', { branchId: b.branchId })}
                          className="hover:text-emerald-700 hover:underline cursor-pointer text-right font-bold"
                          title="اضغط لتصفية سجل الحركات على هذا الفرع"
                        >
                          {b.branchName}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {b.outCount} شحنة / عملية
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-rose-700">
                        -{b.outBaseQty}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {b.uniqueItemCount} صنف
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CATEGORIES (الأقسام) */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>تحليل حركة وأرصدة الأقسام والتصنيفات</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              مقارنة النشاط والكميات بين تصنيفات المخزون المختلفة
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">القسم / التصنيف</th>
                  <th className="py-3 px-4">عدد الأصناف</th>
                  <th className="py-3 px-4">إجمالي الوارد</th>
                  <th className="py-3 px-4">إجمالي الصادر</th>
                  <th className="py-3 px-4">إجمالي الرصيد الحالي المتوفر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {categoryAnalysis.map((c, i) => {
                  const catObj = categories.find((cat) => cat.name === c.name);
                  return (
                    <tr key={i} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <button
                          onClick={() => onNavigateToView?.('items', { categoryId: catObj?.id })}
                          className="hover:text-emerald-700 hover:underline cursor-pointer text-right font-bold"
                          title="اضغط لتصفية الأصناف على هذا القسم"
                        >
                          {c.name}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{c.itemsCount} صنف</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">+{c.inQty}</td>
                      <td className="py-3 px-4 font-mono font-bold text-rose-700">-{c.outQty}</td>
                      <td className="py-3 px-4 font-mono font-black text-slate-900">
                        {c.currentStock}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: RETURNS REPORT (تقرير المرتجعات وارد وصادر) */}
      {activeTab === 'returns' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Info Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <RotateCcw className="w-4 h-4" />
                <span>تحليلات حركة المرتجعات للفترة: {periodLabel}</span>
              </div>
              <h3 className="text-lg font-black">تقرير المرتجعات المعتمدة والمسودات</h3>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                فصل دقيق للمرتجعات الواردة والصادرة عن حركات التوريد والصرف العادية، بما يضمن شفافية الأرصدة وتتبع أسباب الإرجاع.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-emerald-300">
                إجمالي السجلات: {returnsMetrics.total}
              </span>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Inbound Returns */}
            <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-emerald-700">مرتجعات واردة (معتمدة)</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-emerald-800">
                {returnsMetrics.inCount.toLocaleString('ar-SA')}
              </div>
              <div className="text-[11px] text-emerald-600 mt-1">
                إجمالي كمية الإرجاع: <strong>{returnsMetrics.totalInQtyBase.toLocaleString('ar-SA')}</strong> وحدة أساسية
              </div>
            </div>

            {/* Outbound Returns */}
            <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-amber-700">مرتجعات صادرة (معتمدة)</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-amber-800">
                {returnsMetrics.outCount.toLocaleString('ar-SA')}
              </div>
              <div className="text-[11px] text-amber-600 mt-1">
                إجمالي كمية الإرجاع: <strong>{returnsMetrics.totalOutQtyBase.toLocaleString('ar-SA')}</strong> وحدة أساسية
              </div>
            </div>

            {/* Drafts */}
            <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-blue-700">مسودات معلقة</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-blue-900">
                {returnsMetrics.draftCount.toLocaleString('ar-SA')}
              </div>
              <div className="text-[11px] text-blue-600 mt-1">
                لا تؤثر على رصيد المستودع حتى الاعتماد
              </div>
            </div>

            {/* Cancelled */}
            <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-rose-700">عمليات ملغاة</span>
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <X className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-rose-900">
                {returnsMetrics.cancelledCount.toLocaleString('ar-SA')}
              </div>
              <div className="text-[11px] text-rose-600 mt-1">
                تم عكس أثرها المخزني بحركات تصحيحية موثقة
              </div>
            </div>
          </div>

          {/* Two-Column: Top Returned Items & Reasons Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Returned Items */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
              <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-600" />
                <span>الأصناف الأكثر إرجاعاً خلال الفترة</span>
              </h4>
              {returnsMetrics.topReturnedItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  لا توجد مرتجعات مسجلة للأصناف خلال الفترة المحددة.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {returnsMetrics.topReturnedItems.map((entry, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl flex items-center justify-between gap-3 text-xs transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 block">{entry.item?.name || 'صنف غير محدد'}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{entry.item?.code}</span>
                        </div>
                      </div>
                      <div className="text-left font-mono">
                        <span className="font-bold text-slate-900">
                          {entry.totalBaseQty} {entry.baseUnitName}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-sans">
                          {entry.count} سندات إرجاع
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reasons Frequency */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
              <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <span>توزيع أسباب المرتجعات</span>
              </h4>
              <div className="space-y-3">
                {[
                  { key: 'DAMAGED', label: 'بضاعة تالفة / متضررة', color: 'bg-rose-500' },
                  { key: 'DEFECTIVE', label: 'عيب صناعي أو مصنعي', color: 'bg-amber-500' },
                  { key: 'EXPIRED', label: 'منتهي الصلاحية', color: 'bg-red-600' },
                  { key: 'WRONG_ITEM', label: 'صنف غير مطلوب / خطأ في الطلب', color: 'bg-indigo-500' },
                  { key: 'SURPLUS', label: 'فائض عن حاجة الفرع أو العميل', color: 'bg-blue-500' },
                  { key: 'CUSTOMER_REQUEST', label: 'رغبة العميل في الإرجاع', color: 'bg-emerald-500' },
                  { key: 'OTHER', label: 'أسباب أخرى', color: 'bg-slate-400' },
                ].map((reasonObj) => {
                  const count = returnsMetrics.reasonCounts[reasonObj.key] || 0;
                  const pct = returnsMetrics.total > 0 ? Math.round((count / returnsMetrics.total) * 100) : 0;
                  return (
                    <div key={reasonObj.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 font-medium">{reasonObj.label}</span>
                        <span className="font-mono text-slate-900 font-bold">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${reasonObj.color} transition-all duration-300`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Full Returns Table for Period */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">سجل عمليات المرتجعات للفترة المحددة</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  تفاصيل كل سند مرتجع وجهته ونوعه وحالته
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                {periodReturns.length} عملية
              </span>
            </div>

            {periodReturns.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400">
                لا توجد عمليات مرتجعات مسجلة في هذه الفترة المطابقة لمعايير الفلترة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">رقم السند</th>
                      <th className="py-3 px-4">النوع</th>
                      <th className="py-3 px-4">التاريخ</th>
                      <th className="py-3 px-4">الجهة / الفرع</th>
                      <th className="py-3 px-4">عدد الأصناف</th>
                      <th className="py-3 px-4">السبب</th>
                      <th className="py-3 px-4">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {periodReturns.map((ret) => (
                      <tr key={ret.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          #{ret.returnNumber}
                        </td>
                        <td className="py-3 px-4">
                          {ret.type === 'RETURN_IN' ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[10px]">
                              <ArrowDownLeft className="w-3 h-3" />
                              وارد
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md text-[10px]">
                              <ArrowUpRight className="w-3 h-3" />
                              صادر
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {new Date(ret.date).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {ret.destinationType === 'BRANCH'
                            ? `فرع: ${ret.branchName || 'فرع'}`
                            : ret.partyName || 'جهة غير محددة'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {ret.items.length} أصناف
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {ret.reason === 'DAMAGED'
                            ? 'بضاعة تالفة'
                            : ret.reason === 'DEFECTIVE'
                            ? 'عيب صناعي'
                            : ret.reason === 'EXPIRED'
                            ? 'منتهي الصلاحية'
                            : ret.reason === 'WRONG_ITEM'
                            ? 'طلب خاطئ'
                            : ret.reason === 'SURPLUS'
                            ? 'فائض'
                            : ret.reason === 'CUSTOMER_REQUEST'
                            ? 'رغبة العميل'
                            : 'آخر'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              ret.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : ret.status === 'DRAFT'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {ret.status === 'APPROVED' ? 'معتمد' : ret.status === 'DRAFT' ? 'مسودة' : 'ملغي'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: ALERTS & REORDER REVIEW */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* Low stock alerts */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>الأصناف التي وصلت أو تجاوزت حد إعادة الطلب الأدنى</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  أصناف تتطلب تدخلاً فورياً للشراء أو التوريد لتجنب نفاذ المخزون
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                {metrics.lowStockCount} صنف
              </span>
            </div>

            {metrics.lowStockItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-emerald-700 font-bold">
                جميع الأصناف فوق حد إعادة الطلب الأدنى، لا توجد تنبيهات عاجلة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">الصنف والرمز</th>
                      <th className="py-3 px-4">الرصيد الفعلي الحالي</th>
                      <th className="py-3 px-4">حد إعادة الطلب المحدد</th>
                      <th className="py-3 px-4">العجز / النقص</th>
                      <th className="py-3 px-4">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {metrics.lowStockItems.map((item) => {
                      const stock = getItemStock(item.id);
                      const unit = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';
                      const deficit = Math.max(0, item.minStockAlert - stock);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4">
                            <button
                              onClick={() =>
                                onNavigateToView?.('items', {
                                  viewMode: 'audit',
                                  searchQuery: item.name,
                                  detailItemId: item.id,
                                })
                              }
                              className="font-bold text-slate-900 block hover:text-emerald-700 hover:underline text-right cursor-pointer"
                              title="اضغط لمعاينة جرد وتفاصيل الصنف"
                            >
                              {item.name}
                            </button>
                            <span className="text-[10px] font-mono text-slate-400">{item.code}</span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-rose-700">
                            {stock} {unit}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">
                            {item.minStockAlert} {unit}
                          </td>
                          <td className="py-3 px-4 font-mono font-black text-rose-800">
                            {deficit} {unit} مطلوب شراؤها
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-[10px] font-bold">
                              {stock === 0 ? 'نفد تماماً' : 'منخفض جداً'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FULL PRINTABLE MODAL PREVIEW */}
      {isReportPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold">معاينة وطباعة تقرير المخزون الرسمي</h3>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                  {periodLabel}
                </span>
              </div>

              <button
                onClick={() => setIsReportPreviewOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Preview Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-900 font-sans">
              {/* Paper header */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900 m-0">
                    تقرير وتحليلات المخزون الاحترافي الشامل
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-1">
                    الفترة: {periodLabel} ({dateRange.formattedStart} إلى {dateRange.formattedEnd}) · تاريخ الإصدار: {new Date().toLocaleString('ar-SA')}
                  </p>
                </div>
                <div className="text-left">
                  <div className="font-black text-base text-emerald-800">👑 نظام مخزون مدهال الطيب</div>
                  <div className="text-[11px] text-slate-500">إدارة المستودعات وسلسلة الإمداد</div>
                </div>
              </div>

              {/* KPIs in Paper */}
              <div className="grid grid-cols-4 gap-3 text-center text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block mb-0.5 font-bold">إجمالي الوارد</span>
                  <span className="font-black text-emerald-700 font-mono text-base">+{metrics.inBaseQty}</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">{metrics.inCount} عملية</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block mb-0.5 font-bold">إجمالي الصادر</span>
                  <span className="font-black text-rose-700 font-mono text-base">-{metrics.outBaseQty}</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">{metrics.outCount} عملية</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block mb-0.5 font-bold">صافي حركة المخزون</span>
                  <span className="font-black text-blue-700 font-mono text-base">{metrics.netChange}</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">{metrics.netTrend.text}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block mb-0.5 font-bold">الأصناف النشطة</span>
                  <span className="font-black text-slate-900 font-mono text-base">{metrics.activeItemsCount}</span>
                  <span className="text-[9px] text-amber-700 block mt-0.5">{metrics.lowStockCount} تحت حد الطلب</span>
                </div>
              </div>

              {/* Fast Movers Table */}
              <div>
                <h4 className="text-xs font-black mb-2 pb-1 border-b border-slate-200">
                  الأصناف الأكثر صرفاً وخروجاً خلال الفترة:
                </h4>
                <table className="w-full text-right text-xs border border-slate-200">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 border border-slate-200">الصنف والرمز</th>
                      <th className="p-2 border border-slate-200">القسم</th>
                      <th className="p-2 border border-slate-200">الوحدة</th>
                      <th className="p-2 border border-slate-200">إجمالي الصادر</th>
                      <th className="p-2 border border-slate-200">الرصيد المتبقي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemActivityAnalysis.topOutItems.slice(0, 10).map((t) => (
                      <tr key={t.item.id}>
                        <td className="p-2 border border-slate-200 font-bold">{t.item.name} ({t.item.code})</td>
                        <td className="p-2 border border-slate-200">{t.categoryName}</td>
                        <td className="p-2 border border-slate-200">{t.baseUnitName}</td>
                        <td className="p-2 border border-slate-200 text-rose-700 font-mono font-bold">-{t.outQty}</td>
                        <td className="p-2 border border-slate-200 font-mono font-bold">{t.currentStock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Stagnant Items in paper */}
              <div>
                <h4 className="text-xs font-black mb-2 pb-1 border-b border-slate-200">
                  الأصناف الراكدة التي لم تتحرك ولديها رصيد ({itemActivityAnalysis.stagnantItems.length}):
                </h4>
                <table className="w-full text-right text-xs border border-slate-200">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 border border-slate-200">الصنف والرمز</th>
                      <th className="p-2 border border-slate-200">القسم</th>
                      <th className="p-2 border border-slate-200">الوحدة</th>
                      <th className="p-2 border border-slate-200">الرصيد الراكد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemActivityAnalysis.stagnantItems.slice(0, 10).map((s) => (
                      <tr key={s.item.id}>
                        <td className="p-2 border border-slate-200 font-bold">{s.item.name} ({s.item.code})</td>
                        <td className="p-2 border border-slate-200">{s.categoryName}</td>
                        <td className="p-2 border border-slate-200">{s.baseUnitName}</td>
                        <td className="p-2 border border-slate-200 font-mono font-black text-amber-800">{s.currentStock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Returns Summary in Printable Paper */}
              {periodReturns.length > 0 && (
                <div>
                  <h4 className="text-xs font-black mb-2 pb-1 border-b border-slate-200">
                    ملخص حركة المرتجعات خلال الفترة ({periodReturns.length} عملية):
                  </h4>
                  <table className="w-full text-right text-xs border border-slate-200">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="p-2 border border-slate-200">رقم السند</th>
                        <th className="p-2 border border-slate-200">النوع</th>
                        <th className="p-2 border border-slate-200">التاريخ</th>
                        <th className="p-2 border border-slate-200">الجهة / الفرع</th>
                        <th className="p-2 border border-slate-200">الأصناف</th>
                        <th className="p-2 border border-slate-200">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodReturns.slice(0, 10).map((ret) => (
                        <tr key={ret.id}>
                          <td className="p-2 border border-slate-200 font-bold font-mono">#{ret.returnNumber}</td>
                          <td className="p-2 border border-slate-200 font-bold">
                            {ret.type === 'RETURN_IN' ? 'وارد' : 'صادر'}
                          </td>
                          <td className="p-2 border border-slate-200 font-mono">
                            {new Date(ret.date).toLocaleDateString('ar-SA')}
                          </td>
                          <td className="p-2 border border-slate-200">
                            {ret.destinationType === 'BRANCH' ? `فرع: ${ret.branchName || 'فرع'}` : ret.partyName || '-'}
                          </td>
                          <td className="p-2 border border-slate-200">{ret.items.length} أصناف</td>
                          <td className="p-2 border border-slate-200 font-bold">
                            {ret.status === 'APPROVED' ? 'معتمد' : ret.status === 'DRAFT' ? 'مسودة' : 'ملغي'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setIsReportPreviewOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                إغلاق
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadReportHTML}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل التقرير الرسمي HTML/PDF</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <span>طباعة المستند</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Movement Voucher Modal */}
      {voucherMovement && (
        <MovementVoucherModal
          isOpen={Boolean(voucherMovement)}
          onClose={() => setVoucherMovement(null)}
          movement={voucherMovement}
          item={items.find((i) => i.id === voucherMovement.itemId) || null}
          unit={units.find((u) => u.id === voucherMovement.unitId) || null}
          baseUnit={
            units.find(
              (u) =>
                u.id ===
                items.find((i) => i.id === voucherMovement.itemId)?.baseUnitId
            ) || null
          }
          category={
            categories.find(
              (c) =>
                c.id ===
                items.find((i) => i.id === voucherMovement.itemId)?.categoryId
            ) || null
          }
          currentStock={getItemStock(voucherMovement.itemId)}
        />
      )}
    </div>
  );
};
