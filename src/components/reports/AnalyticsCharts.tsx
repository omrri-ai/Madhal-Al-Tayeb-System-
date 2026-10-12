import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Building2,
  Layers,
  HelpCircle,
  Calendar,
  Activity,
  BarChart3,
  Info,
} from 'lucide-react';
import { StockMovement, Item, Category, Branch, Unit } from '../../types/inventory';

interface AnalyticsChartsProps {
  movements: StockMovement[];
  dateRange: {
    start: Date;
    end: Date;
    formattedStart: string;
    formattedEnd: string;
  };
  period: string;
  items: Item[];
  categories: Category[];
  branches: Branch[];
  units: Unit[];
  getItemStock: (itemId: string) => number;
  topInItems: Array<{
    item: Item;
    categoryName: string;
    baseUnitName: string;
    inQty: number;
    inCount: number;
    currentStock: number;
  }>;
  topOutItems: Array<{
    item: Item;
    categoryName: string;
    baseUnitName: string;
    outQty: number;
    outCount: number;
    currentStock: number;
  }>;
  mostActiveItems: Array<{
    item: Item;
    categoryName: string;
    baseUnitName: string;
    inQty: number;
    outQty: number;
    totalQty: number;
    movementsCount: number;
    currentStock: number;
  }>;
  branchAnalysis: Array<{
    branchId: string;
    branchName: string;
    outCount: number;
    outBaseQty: number;
    uniqueItemCount: number;
  }>;
  categoryAnalysis: Array<{
    name: string;
    itemsCount: number;
    inQty: number;
    outQty: number;
    currentStock: number;
  }>;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  movements,
  dateRange,
  period,
  items,
  categories,
  branches,
  units,
  getItemStock,
  topInItems,
  topOutItems,
  mostActiveItems,
  branchAnalysis,
  categoryAnalysis,
}) => {
  const [activeChartTab, setActiveChartTab] = useState<'timeline' | 'comparison' | 'items' | 'categories' | 'branches'>('timeline');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // 1. Time-bucket generator for Timeline Chart (Hourly, Daily, or Weekly based on span)
  const timelineData = useMemo(() => {
    const startMs = dateRange.start.getTime();
    const endMs = dateRange.end.getTime();
    const spanDays = Math.max(1, Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)));

    interface Bucket {
      label: string;
      dateKey: string;
      inQty: number;
      outQty: number;
      inCount: number;
      outCount: number;
    }

    const buckets: Bucket[] = [];

    if (spanDays <= 1) {
      // Single day: 6-hour interval buckets (4 points: 00-06, 06-12, 12-18, 18-24)
      const hours = ['00:00 - 06:00', '06:00 - 12:00', '12:00 - 18:00', '18:00 - 24:00'];
      hours.forEach((h, idx) => {
        buckets.push({
          label: h,
          dateKey: `h-${idx}`,
          inQty: 0,
          outQty: 0,
          inCount: 0,
          outCount: 0,
        });
      });

      movements.forEach((m) => {
        const d = new Date(m.date);
        const hour = d.getHours();
        const bIdx = Math.min(3, Math.floor(hour / 6));
        if (m.type === 'IN') {
          buckets[bIdx].inQty += m.baseQuantity;
          buckets[bIdx].inCount++;
        } else {
          buckets[bIdx].outQty += m.baseQuantity;
          buckets[bIdx].outCount++;
        }
      });
    } else if (spanDays <= 14) {
      // 2 to 14 days: 1 bucket per day
      const cur = new Date(dateRange.start);
      while (cur.getTime() <= endMs) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${d}`;
        const dayName = cur.toLocaleDateString('ar-SA', { weekday: 'short', month: 'numeric', day: 'numeric' });

        buckets.push({
          label: dayName,
          dateKey: key,
          inQty: 0,
          outQty: 0,
          inCount: 0,
          outCount: 0,
        });

        cur.setDate(cur.getDate() + 1);
      }

      movements.forEach((m) => {
        const key = m.date.slice(0, 10);
        const b = buckets.find((item) => item.dateKey === key);
        if (b) {
          if (m.type === 'IN') {
            b.inQty += m.baseQuantity;
            b.inCount++;
          } else {
            b.outQty += m.baseQuantity;
            b.outCount++;
          }
        }
      });
    } else if (spanDays <= 45) {
      // 15 to 45 days: 1 bucket per 3 days or weekly
      const cur = new Date(dateRange.start);
      let step = 3;
      while (cur.getTime() <= endMs) {
        const nextCur = new Date(cur.getTime() + step * 24 * 60 * 60 * 1000);
        const label = `${cur.getDate()}/${cur.getMonth() + 1}`;
        const key = cur.toISOString().slice(0, 10);

        buckets.push({
          label,
          dateKey: key,
          inQty: 0,
          outQty: 0,
          inCount: 0,
          outCount: 0,
        });

        cur.setDate(cur.getDate() + step);
      }

      movements.forEach((m) => {
        const mTime = new Date(m.date).getTime();
        // find appropriate bucket
        const b = buckets.find((item, idx) => {
          const bTime = new Date(item.dateKey).getTime();
          const nextTime = buckets[idx + 1] ? new Date(buckets[idx + 1].dateKey).getTime() : Infinity;
          return mTime >= bTime && mTime < nextTime;
        });
        if (b) {
          if (m.type === 'IN') {
            b.inQty += m.baseQuantity;
            b.inCount++;
          } else {
            b.outQty += m.baseQuantity;
            b.outCount++;
          }
        }
      });
    } else {
      // More than 45 days: monthly or bi-weekly buckets
      const cur = new Date(dateRange.start);
      while (cur.getTime() <= endMs) {
        const label = cur.toLocaleDateString('ar-SA', { month: 'short', year: '2-digit' });
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
        if (!buckets.some((b) => b.dateKey === key)) {
          buckets.push({
            label,
            dateKey: key,
            inQty: 0,
            outQty: 0,
            inCount: 0,
            outCount: 0,
          });
        }
        cur.setMonth(cur.getMonth() + 1);
      }

      movements.forEach((m) => {
        const key = m.date.slice(0, 7);
        const b = buckets.find((item) => item.dateKey === key);
        if (b) {
          if (m.type === 'IN') {
            b.inQty += m.baseQuantity;
            b.inCount++;
          } else {
            b.outQty += m.baseQuantity;
            b.outCount++;
          }
        }
      });
    }

    return buckets;
  }, [dateRange, movements]);

  // Max value for scaling
  const maxTimelineQty = useMemo(() => {
    let max = 0;
    timelineData.forEach((b) => {
      if (b.inQty > max) max = b.inQty;
      if (b.outQty > max) max = b.outQty;
    });
    return max > 0 ? max : 10;
  }, [timelineData]);

  // Aggregate totals
  const totalInQty = useMemo(() => movements.filter((m) => m.type === 'IN').reduce((acc, m) => acc + m.baseQuantity, 0), [movements]);
  const totalOutQty = useMemo(() => movements.filter((m) => m.type === 'OUT').reduce((acc, m) => acc + m.baseQuantity, 0), [movements]);
  const hasAnyActivity = movements.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Chart Header & Navigation */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-black text-slate-900">
                الرسوم البيانية والتحليل البصري لحركة المخزون
              </h4>
              <p className="text-xs text-slate-500">
                رسوم بيانية حقيقية ومباشرة تعكس حركة المستودع خلال: <span className="font-bold text-slate-700">{dateRange.formattedStart} إلى {dateRange.formattedEnd}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold self-start md:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveChartTab('timeline')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeChartTab === 'timeline'
                ? 'bg-white text-slate-900 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            المخطط الزمني (خطي)
          </button>
          <button
            onClick={() => setActiveChartTab('comparison')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeChartTab === 'comparison'
                ? 'bg-white text-slate-900 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            مقارنة الوارد بالصادر (أعمدة)
          </button>
          <button
            onClick={() => setActiveChartTab('items')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeChartTab === 'items'
                ? 'bg-white text-slate-900 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الأصناف الأكثر حركة
          </button>
          <button
            onClick={() => setActiveChartTab('categories')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeChartTab === 'categories'
                ? 'bg-white text-slate-900 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            توزيع الأقسام
          </button>
          <button
            onClick={() => setActiveChartTab('branches')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeChartTab === 'branches'
                ? 'bg-white text-slate-900 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الفروع والمواقع
          </button>
        </div>
      </div>

      {/* Chart Body */}
      <div className="p-4 sm:p-6">
        {/* TAB 1: TIMELINE LINE CHART */}
        {activeChartTab === 'timeline' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" />
                  <span className="font-bold text-slate-700">الوارد والتوريد (دخول)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-600 inline-block" />
                  <span className="font-bold text-slate-700">الصادر والشحن (خروج)</span>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {timelineData.length} نقطة زمنية للفترة المحددة
              </div>
            </div>

            {/* SVG Canvas Container */}
            <div className="relative w-full overflow-hidden bg-slate-50/50 rounded-2xl border border-slate-100 p-2 sm:p-4">
              {!hasAnyActivity && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/75 backdrop-blur-2xs p-4 text-center">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-2">
                    <Activity className="w-5 h-5" />
                  </div>
                  <h5 className="text-xs sm:text-sm font-bold text-slate-800">
                    لا توجد حركات مسجلة خلال هذه الفترة (الأرصدة مستقرة عند الصفر)
                  </h5>
                  <p className="text-[11px] text-slate-500 max-w-md mt-1">
                    النظام جاهز ونظيف تماماً. عند تسجيل أي فاتورة توريد (+) أو سند صرف (-)، سيظهر المنحنى التفاعلي صعوداً وهبوطاً تلقائياً.
                  </p>
                </div>
              )}

              {/* Responsive SVG Line Chart */}
              <div className="w-full h-64 sm:h-72">
                <svg
                  viewBox="0 0 800 280"
                  className="w-full h-full overflow-visible select-none"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="inLineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="outLineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#e11d48" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#e11d48" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                    const y = 30 + pct * 190;
                    const val = Math.round(maxTimelineQty * (1 - pct));
                    return (
                      <g key={idx}>
                        <line
                          x1="50"
                          y1={y}
                          x2="780"
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray={pct === 1 ? 'none' : '3 3'}
                          strokeWidth="1"
                        />
                        <text
                          x="40"
                          y={y + 4}
                          textAnchor="end"
                          fontSize="10"
                          fill="#94a3b8"
                          fontFamily="monospace"
                        >
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Dynamic Points Calculation */}
                  {(() => {
                    const count = timelineData.length;
                    const getX = (idx: number) => {
                      if (count <= 1) return 400;
                      return 60 + (idx / (count - 1)) * 710;
                    };
                    const getY = (qty: number) => {
                      const ratio = maxTimelineQty > 0 ? qty / maxTimelineQty : 0;
                      return 220 - ratio * 190;
                    };

                    // Path strings
                    const inPoints = timelineData.map((d, i) => `${getX(i)},${getY(d.inQty)}`);
                    const outPoints = timelineData.map((d, i) => `${getX(i)},${getY(d.outQty)}`);

                    const inPath = `M ${inPoints.join(' L ')}`;
                    const outPath = `M ${outPoints.join(' L ')}`;

                    const inAreaPath = `M ${getX(0)},220 L ${inPoints.join(' L ')} L ${getX(count - 1)},220 Z`;
                    const outAreaPath = `M ${getX(0)},220 L ${outPoints.join(' L ')} L ${getX(count - 1)},220 Z`;

                    return (
                      <>
                        {/* Area fills */}
                        <path d={inAreaPath} fill="url(#inLineGrad)" />
                        <path d={outAreaPath} fill="url(#outLineGrad)" />

                        {/* Strokes */}
                        <path
                          d={inPath}
                          fill="none"
                          stroke="#059669"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d={outPath}
                          fill="none"
                          stroke="#e11d48"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Circles & interactive hover areas */}
                        {timelineData.map((d, i) => {
                          const x = getX(i);
                          const yIn = getY(d.inQty);
                          const yOut = getY(d.outQty);
                          const isHovered = hoveredPointIndex === i;

                          return (
                            <g key={i}>
                              {/* Hover guide line */}
                              {isHovered && (
                                <line
                                  x1={x}
                                  y1="25"
                                  x2={x}
                                  y2="220"
                                  stroke="#64748b"
                                  strokeWidth="1"
                                  strokeDasharray="2 2"
                                />
                              )}

                              {/* IN Circle */}
                              <circle
                                cx={x}
                                cy={yIn}
                                r={isHovered ? '5' : '3.5'}
                                fill="#059669"
                                stroke="#ffffff"
                                strokeWidth="2"
                              />

                              {/* OUT Circle */}
                              <circle
                                cx={x}
                                cy={yOut}
                                r={isHovered ? '5' : '3.5'}
                                fill="#e11d48"
                                stroke="#ffffff"
                                strokeWidth="2"
                              />

                              {/* X Axis Label */}
                              {(count <= 10 || i % Math.ceil(count / 7) === 0 || i === count - 1) && (
                                <text
                                  x={x}
                                  y="245"
                                  textAnchor="middle"
                                  fontSize="10"
                                  fill="#64748b"
                                  fontFamily="sans-serif"
                                >
                                  {d.label}
                                </text>
                              )}

                              {/* Invisible full-height bar for mouseover */}
                              <rect
                                x={x - 20}
                                y="20"
                                width="40"
                                height="220"
                                fill="transparent"
                                className="cursor-pointer"
                                onMouseEnter={() => setHoveredPointIndex(i)}
                                onMouseLeave={() => setHoveredPointIndex(null)}
                              />
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>

              {/* Hover Tooltip display below SVG if a point is hovered */}
              {hoveredPointIndex !== null && timelineData[hoveredPointIndex] && (
                <div className="mt-2 p-3 bg-white border border-slate-200 rounded-xl shadow-md flex items-center justify-between text-xs animate-in fade-in duration-100">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>الفترة: {timelineData[hoveredPointIndex].label}</span>
                  </div>
                  <div className="flex items-center gap-4 font-mono font-bold">
                    <span className="text-emerald-700">
                      وارد: +{timelineData[hoveredPointIndex].inQty} ({timelineData[hoveredPointIndex].inCount} عمليات)
                    </span>
                    <span className="text-rose-700">
                      صادر: -{timelineData[hoveredPointIndex].outQty} ({timelineData[hoveredPointIndex].outCount} عمليات)
                    </span>
                    <span className="text-slate-600">
                      الصافي: {timelineData[hoveredPointIndex].inQty - timelineData[hoveredPointIndex].outQty}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: IN VS OUT COMPARISON (BAR CHART) */}
        {activeChartTab === 'comparison' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Inward Summary Card */}
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-800">إجمالي كميات الوارد (توريد)</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-700">
                  +{totalInQty.toLocaleString('ar-SA')}
                </div>
                <p className="text-[11px] text-emerald-600 mt-1">
                  شحنات وبضائع دخلت المستودع خلال الفترة
                </p>
              </div>

              {/* Outward Summary Card */}
              <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-800">إجمالي كميات الصادر (صرف وتصدير)</span>
                  <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-rose-700">
                  -{totalOutQty.toLocaleString('ar-SA')}
                </div>
                <p className="text-[11px] text-rose-600 mt-1">
                  شحنات صرفت للعملاء والفروع خلال الفترة
                </p>
              </div>
            </div>

            {/* Visual Comparative Bars */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h5 className="text-xs font-bold text-slate-800">
                مقارنة الحجم الإجمالي النسبي (وارد مقابل صادر):
              </h5>

              {totalInQty === 0 && totalOutQty === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  لا توجد حركات وارد أو صادر مسجلة خلال الفترة (كلاهما = 0)
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Inward Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-emerald-700 flex items-center gap-1">
                        <ArrowDownLeft className="w-3.5 h-3.5" /> الوارد (+):
                      </span>
                      <span className="font-mono text-emerald-800">
                        {totalInQty.toLocaleString('ar-SA')}{' '}
                        {totalInQty + totalOutQty > 0
                          ? `(${Math.round((totalInQty / (totalInQty + totalOutQty)) * 100)}%)`
                          : ''}
                      </span>
                    </div>
                    <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${
                            totalInQty + totalOutQty > 0
                              ? Math.max(2, (totalInQty / (totalInQty + totalOutQty)) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Outward Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-rose-700 flex items-center gap-1">
                        <ArrowUpRight className="w-3.5 h-3.5" /> الصادر (-):
                      </span>
                      <span className="font-mono text-rose-800">
                        {totalOutQty.toLocaleString('ar-SA')}{' '}
                        {totalInQty + totalOutQty > 0
                          ? `(${Math.round((totalOutQty / (totalInQty + totalOutQty)) * 100)}%)`
                          : ''}
                      </span>
                    </div>
                    <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${
                            totalInQty + totalOutQty > 0
                              ? Math.max(2, (totalOutQty / (totalInQty + totalOutQty)) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Net difference indication */}
                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-bold">صافي حركة المستودع:</span>
                    <span
                      className={`font-mono font-black ${
                        totalInQty - totalOutQty >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {totalInQty - totalOutQty > 0 ? '+' : ''}
                      {(totalInQty - totalOutQty).toLocaleString('ar-SA')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TOP MOVED ITEMS */}
        {activeChartTab === 'items' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">ترتيب الأصناف بحسب إجمالي حجم الحركة:</span>
              <span className="text-slate-400 font-mono text-[11px]">
                الأصناف المتصدرة خلال الفترة
              </span>
            </div>

            {mostActiveItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                لا توجد حركات مسجلة لأي صنف خلال هذه الفترة.
              </div>
            ) : (
              <div className="space-y-3">
                {mostActiveItems.slice(0, 7).map((item, idx) => {
                  const maxQty = mostActiveItems[0]?.totalQty || 1;
                  const ratio = Math.max(5, (item.totalQty / maxQty) * 100);

                  return (
                    <div
                      key={item.item.id}
                      className="p-3 bg-slate-50/80 hover:bg-slate-50 rounded-xl border border-slate-200/80 transition-all text-xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono text-[10px] flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-bold text-slate-900">{item.item.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono mr-1.5">
                              ({item.item.code})
                            </span>
                          </div>
                        </div>
                        <div className="text-left font-mono">
                          <span className="font-black text-slate-900">
                            {item.totalQty.toLocaleString('ar-SA')} {item.baseUnitName}
                          </span>
                          <span className="text-[10px] text-slate-400 mr-1.5">
                            ({item.movementsCount} حركة)
                          </span>
                        </div>
                      </div>

                      {/* Visual proportion bar */}
                      <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                        {item.inQty > 0 && (
                          <div
                            className="bg-emerald-500 h-full"
                            style={{ width: `${(item.inQty / item.totalQty) * ratio}%` }}
                            title={`وارد: ${item.inQty}`}
                          />
                        )}
                        {item.outQty > 0 && (
                          <div
                            className="bg-rose-500 h-full"
                            style={{ width: `${(item.outQty / item.totalQty) * ratio}%` }}
                            title={`صادر: ${item.outQty}`}
                          />
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                        <span className="text-emerald-700 font-bold">وارد: +{item.inQty}</span>
                        <span className="text-rose-700 font-bold">صادر: -{item.outQty}</span>
                        <span>الرصيد الفعلي الحالي: <strong className="text-slate-900">{item.currentStock}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CATEGORY DISTRIBUTION */}
        {activeChartTab === 'categories' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">توزيع المخزون والحركة حسب الأقسام:</span>
              <span className="text-slate-400 font-mono text-[11px]">
                {categoryAnalysis.length} أقسام مسجلة
              </span>
            </div>

            {categoryAnalysis.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                لا توجد أقسام مسجلة حتى الآن.
              </div>
            ) : (
              <div className="space-y-3">
                {categoryAnalysis.map((cat, idx) => {
                  const maxStock = Math.max(1, ...categoryAnalysis.map((c) => c.currentStock + c.inQty + c.outQty));
                  const totalActivity = cat.inQty + cat.outQty;
                  const ratio = Math.max(4, ((cat.currentStock + totalActivity) / maxStock) * 100);

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-purple-600" />
                          <span className="font-bold text-slate-900">{cat.name}</span>
                          <span className="text-[10px] text-slate-400">({cat.itemsCount} أصناف)</span>
                        </div>
                        <div className="text-left font-mono">
                          <span className="text-slate-600 text-[11px]">الرصيد الحالي: </span>
                          <span className="font-black text-slate-900">{cat.currentStock}</span>
                        </div>
                      </div>

                      <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all duration-300"
                          style={{ width: `${ratio}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                        <span className="text-emerald-700 font-bold">وارد القسم: +{cat.inQty}</span>
                        <span className="text-rose-700 font-bold">صادر القسم: -{cat.outQty}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: BRANCHES */}
        {activeChartTab === 'branches' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">توزيع حركة التصدير والشحن على الفروع:</span>
              <span className="text-slate-400 font-mono text-[11px]">
                {branchAnalysis.length} فروع مستلمة
              </span>
            </div>

            {branchAnalysis.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                لا توجد عمليات صرف أو شحن لفروع خلال هذه الفترة.
              </div>
            ) : (
              <div className="space-y-3">
                {branchAnalysis.map((b) => {
                  const maxOut = Math.max(1, ...branchAnalysis.map((x) => x.outBaseQty));
                  const ratio = Math.max(5, (b.outBaseQty / maxOut) * 100);

                  return (
                    <div
                      key={b.branchId}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-600" />
                          <span className="font-bold text-slate-900">{b.branchName}</span>
                          <span className="text-[10px] text-slate-400">({b.uniqueItemCount} أصناف مختلفة)</span>
                        </div>
                        <div className="text-left font-mono">
                          <span className="font-black text-rose-700">-{b.outBaseQty}</span>
                          <span className="text-[10px] text-slate-400 mr-1.5">({b.outCount} شحنات)</span>
                        </div>
                      </div>

                      <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
