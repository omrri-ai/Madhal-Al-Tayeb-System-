import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  Download,
  Calendar,
  CheckCircle2,
  FileText,
  Boxes,
  ArrowLeftRight,
  Factory,
  RotateCcw,
  AlertTriangle,
  Building2,
  Users,
  FolderTree,
  History,
  Layers,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import {
  ReportPeriod,
  computeReportDateRange,
  formatArabicDate,
} from '../../utils/reportDateFilters';
import { isSilentMovement } from '../../utils/stockRules';
import {
  ReportSectionKey,
  ALL_REPORT_SECTIONS,
  generateReportsForSelection,
  GeneratedSectionData,
} from '../../utils/reportSectionGenerators';
import {
  buildReportHtmlDocument,
  printReportHtml,
  exportElementToPdfFile,
  exportReportHtmlToPdf,
} from '../../utils/reportPdfExport';

interface UniversalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSections?: ReportSectionKey[];
  reportTitle?: string;
  initialPeriod?: ReportPeriod;
  customStartDate?: string;
  customEndDate?: string;
  extraParams?: Record<string, any>;
}

export const UniversalReportModal: React.FC<UniversalReportModalProps> = ({
  isOpen,
  onClose,
  initialSections = ['items'],
  reportTitle,
  initialPeriod = 'all',
  customStartDate = '',
  customEndDate = '',
  extraParams,
}) => {
  const {
    items,
    movements,
    productionOrders,
    returns,
    damagedRecords,
    branches,
    customers,
    categories,
    units,
    auditLogs,
    companySettings,
    getItemStock,
    showToast,
  } = useInventory();

  // Selected sections
  const [selectedSections, setSelectedSections] = useState<ReportSectionKey[]>(initialSections);

  // Date Filter State
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [customStart, setCustomStart] = useState<string>(customStartDate);
  const [customEnd, setCustomEnd] = useState<string>(customEndDate);

  // Export loading state
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Hidden print element ref for html2pdf
  const printContentRef = useRef<HTMLDivElement>(null);

  // Sync state when props change
  React.useEffect(() => {
    if (isOpen) {
      setSelectedSections(initialSections);
      setPeriod(initialPeriod);
      if (customStartDate) setCustomStart(customStartDate);
      if (customEndDate) setCustomEnd(customEndDate);
    }
  }, [isOpen, initialSections, initialPeriod, customStartDate, customEndDate]);

  // Compute Active Date Range
  const dateRange = useMemo(() => {
    return computeReportDateRange(period, customStart, customEnd);
  }, [period, customStart, customEnd]);

  const visibleMovements = useMemo(() => {
    return movements.filter((m) => !isSilentMovement(m));
  }, [movements]);

  // Context Data Bundle
  const inventoryContextData = useMemo(() => {
    return {
      items,
      movements: visibleMovements,
      productionOrders,
      returns,
      damagedRecords,
      branches,
      customers,
      categories,
      units,
      auditLogs,
      getItemStock,
    };
  }, [
    items,
    visibleMovements,
    productionOrders,
    returns,
    damagedRecords,
    branches,
    customers,
    categories,
    units,
    auditLogs,
    getItemStock,
  ]);

  // Generate Report Data for Selected Sections
  const generatedSections: GeneratedSectionData[] = useMemo(() => {
    if (!isOpen || selectedSections.length === 0) return [];
    return generateReportsForSelection(
      selectedSections,
      inventoryContextData,
      dateRange,
      extraParams
    );
  }, [isOpen, selectedSections, inventoryContextData, dateRange, extraParams]);

  // Total matching records across all chosen sections
  const totalRecordsCount = useMemo(() => {
    return generatedSections.reduce((acc, s) => acc + s.totalCount, 0);
  }, [generatedSections]);

  // Computed Title
  const displayTitle = useMemo(() => {
    if (reportTitle) return reportTitle;
    if (selectedSections.length === 1) {
      const meta = ALL_REPORT_SECTIONS.find((s) => s.key === selectedSections[0]);
      return `تقرير ${meta?.label || 'القسم'}`;
    }
    if (selectedSections.length === ALL_REPORT_SECTIONS.length) {
      return 'التقرير الشامل لجميع أقسام ومستودعات النظام';
    }
    return `تقرير متعدد الأقسام (${selectedSections.length} أقسام)`;
  }, [reportTitle, selectedSections]);

  // Toggle section selection
  const handleToggleSection = (key: ReportSectionKey) => {
    if (selectedSections.includes(key)) {
      if (selectedSections.length === 1) {
        showToast('يجب إبقاء قسم واحد على الأقل في التقرير', 'info');
        return;
      }
      setSelectedSections(selectedSections.filter((k) => k !== key));
    } else {
      setSelectedSections([...selectedSections, key]);
    }
  };

  const handleSelectAllSections = () => {
    setSelectedSections(ALL_REPORT_SECTIONS.map((s) => s.key));
  };

  // Trigger Print (Iframe with official styling)
  const handlePrint = () => {
    setIsPrinting(true);
    try {
      const sectionsHtml = generatedSections.map((s) => s.toHtml()).join('');
      const fullDoc = buildReportHtmlDocument({
        title: displayTitle,
        subtitle: `يشمل (${selectedSections.length}) أقسام بعدد (${totalRecordsCount.toLocaleString('ar-SA')}) سجلاً مطابقاً`,
        companyName: companySettings?.name || 'مخزون مدهال الطيب',
        companyAddress: companySettings?.address,
        companyPhone: companySettings?.phone,
        commercialRegister: companySettings?.commercialRegister,
        taxId: companySettings?.taxId,
        managerName: companySettings?.managerName,
        periodLabel: dateRange.label,
        inclusiveNote: dateRange.inclusiveNote,
        sectionsHtml,
      });

      printReportHtml(fullDoc);
    } catch (err) {
      console.error('Print trigger error:', err);
      window.print();
    } finally {
      setTimeout(() => setIsPrinting(false), 800);
    }
  };

  // Trigger PDF Export (Download .pdf file matching preview/print layout)
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    showToast('جارٍ إنشاء ملف PDF وتنسيق الصفحات...', 'info');

    try {
      const cleanFileName = `${displayTitle.replace(/[\s/\\:]+/g, '_')}_${dateRange.startDateStr || 'كامل'}`;
      const sectionsHtml = generatedSections.map((s) => s.toHtml()).join('');
      const fullDoc = buildReportHtmlDocument({
        title: displayTitle,
        subtitle: `يشمل (${selectedSections.length}) أقسام بعدد (${totalRecordsCount.toLocaleString('ar-SA')}) سجلاً مطابقاً`,
        companyName: companySettings?.name || 'مخزون مدهال الطيب',
        companyAddress: companySettings?.address,
        companyPhone: companySettings?.phone,
        commercialRegister: companySettings?.commercialRegister,
        taxId: companySettings?.taxId,
        managerName: companySettings?.managerName,
        periodLabel: dateRange.label,
        inclusiveNote: dateRange.inclusiveNote,
        sectionsHtml,
      });

      await exportReportHtmlToPdf(fullDoc, cleanFileName);
      showToast('تم تصدير وتنزيل ملف PDF بنجاح!', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('تعذر تصدير PDF التلقائي، يمكنك اختيار (طباعة التقرير) ثم حفظه كـ PDF', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-4 text-right max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Control Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                <FileText className="w-5 h-5" />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {displayTitle}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              معاينة مسبقة شاملة للمحتوى قبل الطباعة والتصدير · {totalRecordsCount.toLocaleString('ar-SA')} سجل مطابق
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrint}
              disabled={isPrinting || totalRecordsCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>{isPrinting ? 'جارٍ تحضير الطباعة...' : 'طباعة التقرير'}</span>
            </button>

            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf || totalRecordsCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isExportingPdf ? 'جارٍ المعالجة...' : 'تصدير PDF (تحميل)'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Options Toolbar */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-200 shrink-0 space-y-3">
          {/* Section Selector Pills */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-700">
                الأقسام المتضمنة في هذا التقرير ({selectedSections.length} من {ALL_REPORT_SECTIONS.length}):
              </span>
              <button
                type="button"
                onClick={handleSelectAllSections}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer"
              >
                تحديد جميع الأقسام (تقرير شامل)
              </button>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-wrap">
              {ALL_REPORT_SECTIONS.map((sec) => {
                const isSelected = selectedSections.includes(sec.key);
                return (
                  <button
                    key={sec.key}
                    type="button"
                    onClick={() => handleToggleSection(sec.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <span>{sec.label}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none flex-wrap">
              <span className="text-xs font-bold text-slate-700 ml-1">الفترة الزمنية:</span>
              {(
                [
                  { key: 'today', label: 'اليوم' },
                  { key: 'yesterday', label: 'أمس' },
                  { key: 'this_week', label: 'هذا الأسبوع' },
                  { key: 'last_7_days', label: 'آخر 7 أيام' },
                  { key: 'this_month', label: 'هذا الشهر' },
                  { key: 'last_30_days', label: 'آخر 30 يومًا' },
                  { key: 'custom', label: 'فترة مخصصة' },
                  { key: 'all', label: 'جميع السجلات' },
                ] as { key: ReportPeriod; label: string }[]
              ).map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer ${
                    period === p.key
                      ? 'bg-slate-900 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Range Inputs */}
            {period === 'custom' && (
              <div className="flex items-center gap-2 text-xs bg-emerald-50/80 p-1.5 rounded-lg border border-emerald-200">
                <span className="font-bold text-emerald-900">من:</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2 py-1 bg-white border border-emerald-300 rounded text-xs"
                />
                <span className="font-bold text-emerald-900">إلى:</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2 py-1 bg-white border border-emerald-300 rounded text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* Live Document Preview Scroll Area */}
        <div className="overflow-y-auto p-4 sm:p-6 bg-slate-100/80 flex-1">
          {/* Printable Document Box */}
          <div
            ref={printContentRef}
            className="max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200 text-slate-900"
            dir="rtl"
          >
            {/* Document Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-emerald-700 m-0">
                  {companySettings?.name || 'مخزون مدهال الطيب'}
                </h1>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  {companySettings?.address || 'المملكة العربية السعودية'} ·{' '}
                  {companySettings?.phone ? `هاتف: ${companySettings.phone} · ` : ''}
                  إدارة المستودع والعمليات المخزنية
                </p>
              </div>

              <div className="text-right sm:text-left">
                <h2 className="text-lg font-bold text-slate-900 m-0">{displayTitle}</h2>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  تاريخ التقرير: {new Date().toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh' })}
                </div>
              </div>
            </div>

            {/* Meta Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">الفترة الزمنية:</span>
                <span className="font-bold text-slate-800">{dateRange.label}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">نطاق الفحص والشمول:</span>
                <span className="font-medium text-slate-700">{dateRange.inclusiveNote}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">إجمالي السجلات:</span>
                <span className="font-bold text-emerald-700">
                  {totalRecordsCount.toLocaleString('ar-SA')} سجل
                </span>
              </div>
            </div>

            {/* Report Sections Content */}
            {generatedSections.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                لم يتم اختيار أي قسم لعرضه في التقرير
              </div>
            ) : (
              <div className="space-y-8">
                {generatedSections.map((sec) => (
                  <div key={sec.key} className="space-y-3">
                    {/* Section Header */}
                    <div className="flex items-center justify-between bg-slate-900 text-white px-3 py-2 rounded-lg">
                      <h3 className="text-sm font-bold m-0">{sec.title}</h3>
                      <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">
                        {sec.totalCount.toLocaleString('ar-SA')} سجل
                      </span>
                    </div>

                    {/* KPI Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {sec.kpis.map((k, i) => (
                        <div key={i} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <span className="text-[11px] text-slate-500 block">{k.label}</span>
                          <span className="text-sm font-black text-slate-900 mt-0.5 block">
                            {k.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Content / Table */}
                    {sec.key === 'movements' ? (
                      <div className="report-root bg-white p-2 rounded-lg border border-slate-200 overflow-x-auto" dangerouslySetInnerHTML={{ __html: sec.toHtml() }} />
                    ) : (
                      <div className="border border-slate-200 rounded-lg overflow-x-auto">
                        <table className="w-full text-xs text-right border-collapse">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                              {sec.columns.map((col, cIdx) => (
                                <th key={cIdx} className="p-2 font-bold whitespace-normal break-words">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sec.rows.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={sec.columns.length}
                                  className="p-4 text-center text-slate-400"
                                >
                                  لا توجد سجلات مطابقة في هذا القسم للفترة المحددة
                                </td>
                              </tr>
                            ) : (
                              sec.rows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                                  {row.map((cell, cellIdx) => (
                                    <td
                                      key={cellIdx}
                                      className={`p-2 text-slate-800 whitespace-normal break-words ${
                                        cellIdx === 0 ? 'text-center font-bold font-mono text-slate-400' : ''
                                      }`}
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Document Signatures Block */}
            <div className="mt-10 pt-6 border-t border-slate-200 grid grid-cols-3 gap-4 text-center text-xs">
              <div>
                <span className="font-bold text-slate-700 block mb-6">أمين المستودع</span>
                <div className="border-b border-dashed border-slate-300 w-3/4 mx-auto" />
                <span className="text-[10px] text-slate-400 mt-1 block">التوقيع والتاريخ</span>
              </div>
              <div>
                <span className="font-bold text-slate-700 block mb-6">مشرف إدارة المخزون</span>
                <div className="border-b border-dashed border-slate-300 w-3/4 mx-auto" />
                <span className="text-[10px] text-slate-400 mt-1 block">التوقيع والمراجعة</span>
              </div>
              <div>
                <span className="font-bold text-slate-700 block mb-6">
                  {companySettings?.managerName || 'الاعتماد الرسمي'}
                </span>
                <div className="border-b border-dashed border-slate-300 w-3/4 mx-auto" />
                <span className="text-[10px] text-slate-400 mt-1 block">الختم والاعتماد</span>
              </div>
            </div>

            {/* Document Footer */}
            <div className="mt-6 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-3">
              نظام مخزون مدهال الطيب — وثيقة رسمية معتمدة مستخرجة آلياً
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            إغلاق المعاينة
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isPrinting || totalRecordsCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>طباعة التقرير</span>
            </button>
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf || totalRecordsCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تصدير ملف PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
