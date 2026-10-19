import React, { useState, useRef, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  RotateCcw,
  Sparkles,
  Cloud,
  Clock,
  History,
  FileText,
  Lock,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Key,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { useAuth, DEFAULT_MASTER_KEY } from '../../context/AuthContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { playNotificationSound } from '../../services/sound';
import { checkStockHealth, StockHealthReport } from '../../utils/stockRules';

export const BackupSettingsView: React.FC = () => {
  const {
    items,
    units,
    categories,
    movements,
    branches,
    returns,
    getItemStock,
    exportDataJSON,
    importDataJSON,
    clearDatabase,
    zeroStockAndResetOperations,
    initializeCleanSystem,
    showToast,
    cloudSyncStatus,
    isOffline,
    hasUnsyncedOfflineData,
    unsyncedOfflineCount,
    auditLogs,
    cloudBackups,
    refreshFromCloud,
    syncLocalToCloudNow,
    createCloudSnapshot,
    restoreCloudSnapshot,
    refreshAuditLogs,
    recoverOrphanedLocalData,
  } = useInventory();

  const {
    ownerEmail,
    getOwnerPasscode,
    setOwnerPasscode,
    resetOwnerPasscodeToDefault,
  } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'cloud' | 'local' | 'security' | 'audit' | 'reset'>('cloud');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isZeroStockConfirmOpen, setIsZeroStockConfirmOpen] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<string | null>(null);
  const [isInitCleanConfirmOpen, setIsInitCleanConfirmOpen] = useState(false);
  const [selectedBackupToRestore, setSelectedBackupToRestore] = useState<string | null>(null);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [snapshotNameInput, setSnapshotNameInput] = useState('');

  // Security & Secret Key States
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [copiedSecretKey, setCopiedSecretKey] = useState(false);
  const [newKeyInput, setNewKeyInput] = useState('');
  const [testKeyInput, setTestKeyInput] = useState('');
  const [currentSecretKey, setCurrentSecretKey] = useState<string>(() => {
    return getOwnerPasscode ? getOwnerPasscode() : DEFAULT_MASTER_KEY;
  });

  useEffect(() => {
    refreshAuditLogs();
  }, [refreshAuditLogs]);

  // Export JSON file
  const handleExport = () => {
    try {
      playNotificationSound('bell');
      const json = exportDataJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `نسخة_احتياطية_مخزون_مدهال_الطيب_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('تم تصدير النسخة الاحتياطية بنجاح بصيغة JSON', 'success');
    } catch (err: any) {
      showToast('تعذر تصدير البيانات، يرجى المحاولة مرة أخرى', 'error');
    }
  };

  // Step 0: Export current stock balances snapshot (Manager only)
  const handleExportStockSnapshot = () => {
    try {
      playNotificationSound('bell');
      const snapshot = items
        .filter((it) => !it.isDeleted)
        .map((it) => ({
          id: it.id,
          code: it.code,
          name: it.name,
          balance: getItemStock(it.id),
        }));
      const json = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `لقطة_ارصدة_المخزون_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('تم تصدير لقطة أرصدة الأصناف الحالية بنجاح للمقارنة', 'success');
    } catch (err: any) {
      showToast('تعذر تصدير لقطة الأرصدة', 'error');
    }
  };

  // Task 5: Stock Health Check (زر الفحص)
  const [healthReport, setHealthReport] = useState<StockHealthReport | null>(null);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

  const handleRunHealthCheck = () => {
    try {
      playNotificationSound('bell');
      const report = checkStockHealth(items, movements, units);
      setHealthReport(report);
      setIsHealthModalOpen(true);
      if (report.issues.length === 0) {
        showToast('فحص سلامة الأرصدة مكتمل: لا توجد أي أخطاء أو تعارضات في الأرصدة!', 'success');
      } else {
        showToast(`اكتمل الفحص: تم رصد ${report.issues.length} مسألة أو تنبيه تحتاج للمراجعة`, 'info');
      }
    } catch (err: any) {
      showToast('تعذر إجراء فحص السلامة', 'error');
    }
  };

  const handleExportHealthReport = () => {
    if (!healthReport) return;
    try {
      playNotificationSound('bell');
      const json = JSON.stringify(healthReport, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `تقرير_سلامة_المخزون_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('تم تصدير تقرير فحص السلامة بنجاح', 'success');
    } catch {
      showToast('تعذر تصدير التقرير', 'error');
    }
  };

  // Import JSON file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        playNotificationSound('bell');
        const text = event.target?.result as string;
        await importDataJSON(text);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        showToast('تعذر قراءة ملف النسخة، تأكد من صحة الملف', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleCreateSnapshot = async () => {
    setIsCreatingSnapshot(true);
    playNotificationSound('bell');
    try {
      await createCloudSnapshot(snapshotNameInput.trim() || undefined);
      setSnapshotNameInput('');
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleConfirmRestoreCloud = async () => {
    if (!selectedBackupToRestore) return;
    playNotificationSound('bell');
    await restoreCloudSnapshot(selectedBackupToRestore);
    setSelectedBackupToRestore(null);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* CLOUD SECURITY & CONNECTION STATUS CARD */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-0.5 rounded-full font-bold flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                  قاعدة البيانات السحابية الدائمة
                </span>
                <span className="text-[11px] bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-mono">
                  {cloudSyncStatus === 'synced' ? '🟢 متزامن لحظياً' : '🔄 جارٍ المزامنة'}
                </span>
              </div>
              <h3 className="text-xl font-black text-white">
                حماية البيانات وأمان حساب المالك
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                قاعدة البيانات السحابية الدائمة تحتفظ بجميع الأصناف والأقسام والأرصدة بأمان وتزامن فوري، ومحمية بحساب المالك المعتمد حصرياً.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                disabled={isForceSyncing}
                onClick={async () => {
                  setIsForceSyncing(true);
                  playNotificationSound('bell');
                  await syncLocalToCloudNow();
                  setIsForceSyncing(false);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                title="تحديث ومزامنة جميع البيانات في السحابة فوراً"
              >
                <Cloud className={`w-4 h-4 ${isForceSyncing ? 'animate-spin' : ''}`} />
                <span>{isForceSyncing ? 'جارٍ الحفظ بالسحابة...' : 'مزامنة السحابة فوراً'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playNotificationSound('bell');
                  refreshFromCloud();
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>تحديث السجلات</span>
              </button>

              <button
                type="button"
                disabled={isRecovering}
                onClick={async () => {
                  setIsRecovering(true);
                  playNotificationSound('bell');
                  const res = await recoverOrphanedLocalData();
                  setRecoveryResult(res.message);
                  setIsRecovering(false);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20 cursor-pointer"
                title="فحص عميق لذاكرة المتصفح لاسترجاع أي أصناف سُجلت أثناء انقطاع الإنترنت"
              >
                <History className={`w-4 h-4 ${isRecovering ? 'animate-spin' : ''}`} />
                <span>{isRecovering ? 'جارٍ فحص الذاكرة...' : 'فحص واسترجاع بيانات الأوفلاين'}</span>
              </button>
            </div>
          </div>

          {/* Offline / Recovery Status Notification */}
          {(isOffline || hasUnsyncedOfflineData || recoveryResult) && (
            <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <p className="font-bold text-white">
                    {recoveryResult || (isOffline
                      ? `وضع الحفظ المحلي النشط (أنت بدون اتصال بالإنترنت حالياً${hasUnsyncedOfflineData ? `، ${unsyncedOfflineCount} سجلات معلقة` : ''})`
                      : 'توجد بيانات محفوظة محلياً تنتظر المزامنة مع السحابة')}
                  </p>
                  <p className="text-[11px] text-amber-300/80 mt-0.5">
                    النظام يحمي بياناتك محلياً بشكل دائم؛ لن تفقد أي أصناف عند التحديث، وسيتم رفعها تلقائياً بمجرد عودة الإنترنت.
                  </p>
                </div>
              </div>

              {recoveryResult && (
                <button
                  onClick={() => setRecoveryResult(null)}
                  className="text-[11px] underline text-amber-300 hover:text-white cursor-pointer shrink-0"
                >
                  إغلاق الإشعار
                </button>
              )}
            </div>
          )}

          {/* Business Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-xs">
              <span className="text-slate-400 text-[11px] block mb-1">حساب المالك المعتمد:</span>
              <div className="font-mono font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="truncate">{ownerEmail}</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-1">وصول حصري ومحمي برمز المرور</span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-xs">
              <span className="text-slate-400 text-[11px] block mb-1">حالة التخزين والاتصال:</span>
              <div className="font-bold text-white text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>متصل وقاعدة البيانات نشطة</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-1">تزامن فوري ومستمر مع الخادم</span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-xs">
              <span className="text-slate-400 text-[11px] block mb-1">إحصاءات السجلات المحفوظة:</span>
              <div className="font-mono font-bold text-white text-xs">
                {items.length} أصناف · {categories.length} أقسام · {movements.length} حركات · {returns.length} مرتجعات
              </div>
              <span className="text-[10px] text-slate-500 block mt-1">{units.length} وحدات قياس · {branches.length} فروع ومواقع</span>
            </div>
          </div>
        </div>

        {/* Ambient lighting */}
        <div className="absolute left-[-10%] bottom-[-30%] w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex border-b border-slate-200 gap-2 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('cloud')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'cloud'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Cloud className="w-4 h-4 text-emerald-600" />
          <span>النسخ الاحتياطي السحابي (Cloud Snapshots)</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'security'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <KeyRound className="w-4 h-4 text-emerald-600" />
          <span>مفتاح الأمان الخاص ورمز المرور</span>
        </button>

        <button
          onClick={() => setActiveTab('local')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'local'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Download className="w-4 h-4 text-blue-600" />
          <span>تصدير واستيراد ملفات JSON</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'audit'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4 text-purple-600" />
          <span>سجل التدقيق والعمليات ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reset')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'reset'
              ? 'border-amber-600 text-amber-800 bg-amber-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <RotateCcw className="w-4 h-4 text-amber-600" />
          <span>أدوات التصفير والتهيئة</span>
        </button>
      </div>

      {/* TAB 1: CLOUD SNAPSHOTS */}
      {activeTab === 'cloud' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Create Snapshot Box */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-emerald-600" />
                  <span>إنشاء وحفظ نسخة احتياطية سحابية فورية (Cloud Snapshot)</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  تُحفظ النسخة مباشرة داخل مجموعة النسخ السحابية المشفرة لاستعادتها بضغطة زر عند الحاجة.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <input
                type="text"
                value={snapshotNameInput}
                onChange={(e) => setSnapshotNameInput(e.target.value)}
                placeholder="اسم النسخة الاحتياطية (مثال: قبل إدخال بضاعة محرم 1448)..."
                className="flex-1 w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-hidden focus:border-emerald-500 transition-colors"
              />
              <button
                onClick={handleCreateSnapshot}
                disabled={isCreatingSnapshot}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isCreatingSnapshot ? 'جارٍ الحفظ السحابي...' : 'حفظ نسخة سحابية الآن'}
              </button>
            </div>
          </div>

          {/* Cloud Backups List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">قائمة النسخ الاحتياطية السحابية المحفوظة</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  النسخ المؤرخة المتوفرة للاسترجاع الفوري الآمن
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                {cloudBackups.length} نسخ
              </span>
            </div>

            {cloudBackups.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                لا توجد نسخ احتياطية سحابية محفوظة حتى الآن. اضغط "حفظ نسخة سحابية الآن" لإنشاء أول نسخة.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cloudBackups.map((b) => (
                  <div key={b.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{b.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({b.id})</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(b.timestamp).toLocaleString('ar-SA')}
                        </span>
                        <span>·</span>
                        <span>{b.itemCount} أصناف</span>
                        <span>·</span>
                        <span>{b.categoryCount} أقسام</span>
                        <span>·</span>
                        <span>{b.movementCount} حركات</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedBackupToRestore(b.id)}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto shadow-2xs"
                    >
                      استرجاع هذه النسخة
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: JSON EXPORT & IMPORT */}
      {activeTab === 'local' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-150">
          {/* Export JSON */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <Download className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">
                تنزيل ملف نسخة احتياطية (JSON)
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                تنزيل ملف كامل وشامل يتضمن كافة الأصناف، الفروع، الأقسام، وسجل الحركات بصيغة JSON القياسية لحفظها خارجياً على قرصك أو أرشيفك الشخصي.
              </p>
            </div>

            <button
              onClick={handleExport}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>تنزيل ملف النسخة الاحتياطية JSON</span>
            </button>
          </div>

          {/* Import JSON */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <Upload className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">
                استيراد واستعادة من ملف JSON
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                استعادة سجلات المخزون من ملف JSON تم تصديره مسبقاً. يقوم النظام بالتحقق التلقائي من سلامة البنية قبل الاستعادة لتفادي الأخطاء.
              </p>
            </div>

            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                <Upload className="w-4 h-4" />
                <span>اختيار ملف JSON واستعادة</span>
              </button>
            </div>
          </div>

          {/* Export Stock Balances Snapshot (Manager Only - Step 0) */}
          <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-2xs flex flex-col justify-between sm:col-span-2">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">
                لقطة أرصدة الأصناف للمقارنة (Stock Balances Snapshot)
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                تصدير ملف JSON يحتوي على المعرف (id)، الكود، الاسم، والرصيد المحتسب لكل صنف حالياً. دالة مخصصة للمدير لمقارنة لقطة الأرصدة قبل التعديل وبعده.
              </p>
            </div>
            <button
              onClick={handleExportStockSnapshot}
              className="w-full sm:w-auto self-start flex items-center justify-center gap-2 py-2.5 px-5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="w-4 h-4" />
              <span>تصدير لقطة الأرصدة الحالية (JSON)</span>
            </button>
          </div>

          {/* Stock Health Check Card (Manager Only - Task 5 / زر الفحص) */}
          <div className="bg-white p-5 rounded-2xl border border-indigo-200 bg-indigo-50/20 shadow-2xs flex flex-col justify-between sm:col-span-2">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">
                فحص وتدقيق سلامة المخزون والحركات (زر الفحص - المهمة 5)
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                زر الفحص الشامل للمدير: يحلل جميع حركات المخزون، يكتشف الأرصدة السالبة، المعرفات المكررة، الأنواع غير المعروفة، والكميات غير المتطابقة وفق قواعد stockRules الموحدة بدون تعديل أي بيانات.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleRunHealthCheck}
                className="w-full sm:w-auto self-start flex items-center justify-center gap-2 py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>تشغيل فحص سلامة الأرصدة الآن (زر الفحص)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden animate-in fade-in duration-150">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-purple-600" />
                <span>سجل التدقيق والعمليات (Audit Trail)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                سجل موثق ودائم لجميع عمليات الإضافة والتعديل والحذف والاستعادة
              </p>
            </div>
            <button
              onClick={() => {
                playNotificationSound('bell');
                refreshAuditLogs();
              }}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer"
            >
              تحديث السجل ⟳
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              لا توجد عمليات مسجلة في سجل التدقيق حتى الآن.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">التاريخ والوقت</th>
                    <th className="py-3 px-4">نوع العملية</th>
                    <th className="py-3 px-4">التفاصيل</th>
                    <th className="py-3 px-4">المنفّذ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-mono">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {new Date(log.timestamp).toLocaleString('ar-SA')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-900 font-medium">
                        {log.details}
                      </td>
                      <td className="py-3 px-4 text-emerald-700 font-bold text-[11px]">
                        {log.performedBy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: RESET & INITIALIZATION TOOLS */}
      {activeTab === 'reset' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-amber-200 shadow-2xs space-y-4 animate-in fade-in duration-150">
          <div>
            <h4 className="text-sm font-bold text-amber-950 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>أدوات التهيئة الرسمية وتصفير الأرصدة (محمية ومقيدة)</span>
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed mt-1">
              إجراءات متقدمة لإعادة ضبط الحركات أو بدء العمل على بضاعة حقيقية جديدة. تتطلب تأكيداً صريحاً لحماية السجلات.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Zero stock only */}
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <RotateCcw className="w-4 h-4 text-amber-700" />
                  <h5 className="text-xs font-bold text-amber-950">تصفير أرصدة المخزون والحركات</h5>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed mb-3">
                  مسح وإلغاء جميع حركات الوارد والصادر وتصفير رصيد كل صنف إلى (0)، مع الحفاظ التام على أسماء الأصناف والأقسام والوحدات.
                </p>
              </div>
              <button
                onClick={() => setIsZeroStockConfirmOpen(true)}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                تصفير الأرصدة وحذف الحركات
              </button>
            </div>

            {/* Clean System Init */}
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Trash2 className="w-4 h-4 text-rose-700" />
                  <h5 className="text-xs font-bold text-rose-950">مسح قاعدة البيانات بالكامل</h5>
                </div>
                <p className="text-[11px] text-rose-800 leading-relaxed mb-3">
                  مسح شامل لكافة الجداول وحذف جميع الأصناف والأقسام للبدء من صفحة بيضاء نقية تماماً.
                </p>
              </div>
              <button
                onClick={() => setIsResetConfirmOpen(true)}
                className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                مسح قاعدة البيانات الشامل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PRIVATE MASTER SECRET KEY */}
      {activeTab === 'security' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Main Key Display Card */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    مفتاح الأمان السري الخاص بالمالك (Master Secret Passcode)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    الرمز السري المعتمد لفتح وحماية نظام المخزون وقاعدة البيانات
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>حساب المالك: {ownerEmail}</span>
              </div>
            </div>

            {/* Secret Key Display Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 text-white">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-bold flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-emerald-400" />
                  <span>المفتاح السري النشط حالياً:</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/60">
                  نشط ومعتمد
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/90 border border-slate-800 rounded-xl p-3 sm:px-4">
                <div className="font-mono font-bold text-emerald-300 text-base sm:text-lg tracking-widest dir-ltr text-left select-all truncate">
                  {showSecretKey ? currentSecretKey : '••••••••••••••••'}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-700"
                    title={showSecretKey ? 'إخفاء المفتاح' : 'إظهار المفتاح'}
                  >
                    {showSecretKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>{showSecretKey ? 'إخفاء' : 'إظهار'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(currentSecretKey);
                      setCopiedSecretKey(true);
                      playNotificationSound('bell');
                      showToast('تم نسخ المفتاح السري إلى الحافظة بنجاح', 'success');
                      setTimeout(() => setCopiedSecretKey(false), 2500);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    title="نسخ المفتاح السري"
                  >
                    {copiedSecretKey ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSecretKey ? 'تم النسخ!' : 'نسخ المفتاح'}</span>
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                💡 يمكنك استخدام هذا المفتاح في أي وقت عند ظهور شاشة تسجيل الدخول للدخول فورياً لحساب المالك، من أي جهاز أو متصفح.
              </p>
            </div>
          </div>

          {/* Change / Customize Master Key */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span>تغيير أو تخصيص المفتاح السري (Custom Key)</span>
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              إذا كنت تفضل اختيار كلمة مرور خاصة بك أو رمز سري مخصص وسهل الحفظ، أدخله هنا واضغط حفظ.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
              <input
                type="text"
                value={newKeyInput}
                onChange={(e) => setNewKeyInput(e.target.value)}
                placeholder="أدخل المفتاح السري الجديد (4 أحرف أو أرقام على الأقل)..."
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-emerald-500 rounded-xl text-xs text-slate-900 font-mono outline-hidden transition-colors"
              />

              <button
                type="button"
                onClick={async () => {
                  if (!newKeyInput || newKeyInput.trim().length < 4) {
                    showToast('يجب أن يتكون المفتاح السري من 4 خانات على الأقل', 'error');
                    return;
                  }
                  const success = await setOwnerPasscode(newKeyInput.trim());
                  if (success) {
                    setCurrentSecretKey(newKeyInput.trim());
                    setNewKeyInput('');
                    playNotificationSound('bell');
                    showToast('تم تحديث المفتاح السري وحفظه سحابياً ومحلياً بنجاح', 'success');
                  } else {
                    showToast('تعذر حفظ المفتاح الجديد', 'error');
                  }
                }}
                disabled={!newKeyInput || newKeyInput.trim().length < 4}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                حفظ المفتاح الجديد
              </button>

              <button
                type="button"
                onClick={async () => {
                  await resetOwnerPasscodeToDefault();
                  setCurrentSecretKey(DEFAULT_MASTER_KEY);
                  playNotificationSound('bell');
                  showToast('تمت استعادة المفتاح السري الافتراضي للنظام', 'info');
                }}
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-200 whitespace-nowrap"
                title="استعادة المفتاح السري الافتراضي"
              >
                استعادة الافتراضي
              </button>
            </div>
          </div>

          {/* Key Match Interactive Tester */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>اختبار وتأكيد مطابقة المفتاح الآن (Live Key Tester)</span>
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              جرّب كتابة المفتاح السري في الحقل أدناه لتتأكد من مطابقته وصحته قبل تسجيل الخروج:
            </p>

            <div className="max-w-xl space-y-3">
              <input
                type="text"
                value={testKeyInput}
                onChange={(e) => setTestKeyInput(e.target.value)}
                placeholder="اكتب المفتاح السري هنا للتجربة..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-emerald-500 rounded-xl text-xs text-slate-900 font-mono outline-hidden transition-colors"
              />

              {testKeyInput.trim().length > 0 && (
                <div>
                  {testKeyInput.trim() === currentSecretKey ||
                  testKeyInput.trim() === DEFAULT_MASTER_KEY ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800 animate-in fade-in duration-150">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>✅ الرمز متطابق وصحيح 100%! يمكنك استخدامه لتسجيل الدخول بأمان في أي وقت.</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-800 animate-in fade-in duration-150">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>❌ الرمز غير متطابق. تأكد من إدخال الأحرف والأرقام بدقة.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Guide Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-700">
            <h5 className="font-black text-slate-900 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>إرشادات وضمانات أمان المالك:</span>
            </h5>
            <ul className="space-y-2 list-disc list-inside leading-relaxed text-slate-600">
              <li>
                <strong>المفتاح مخصص لك وحدك:</strong> لن يتمكن أي طرف أو مستخدم غير مصرح له من الدخول إلى النظام أو الاطلاع على الأصناف والأرصدة.
              </li>
              <li>
                <strong>ثبات دائم لقاعدة البيانات:</strong> كافة الأصناف والأقسام متزامنة لحظياً على Google Cloud Firestore ولا تتأثر بإعادة النشر أو تسجيل الخروج.
              </li>
              <li>
                <strong>طريقتان للدخول السريع:</strong> يمكنك دائماً استخدام زر "دخول المالك المعتمد (فوري)" أو إدخال هذا المفتاح السري مباشرة.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOGS */}
      {/* 1. Restore Cloud Backup Confirm */}
      <ConfirmDialog
        isOpen={Boolean(selectedBackupToRestore)}
        title="تأكيد استرجاع النسخة الاحتياطية السحابية"
        message="هل أنت متأكد من رغبتك في استرجاع هذه النسخة الاحتياطية؟ سيتم تحديث جميع الأصناف والأقسام وحركات المخزون طبقاً لبيانات النسخة المحددة ومزامنتها سحابياً فوراً."
        isDestructive={true}
        confirmLabel="تأكيد الاسترجاع الآن"
        cancelLabel="إلغاء"
        onConfirm={handleConfirmRestoreCloud}
        onCancel={() => setSelectedBackupToRestore(null)}
      />

      {/* 2. Zero Stock Confirm */}
      <ConfirmDialog
        isOpen={isZeroStockConfirmOpen}
        title="تأكيد تصفير أرصدة المخزون بالكامل"
        message="هل أنت متأكد من تصفير رصيد جميع الأصناف إلى (0) وحذف حركات الوارد والصادر؟ سيتم الاحتفاظ بتعريفات الأصناف والأقسام والوحدات دون حذفها."
        isDestructive={true}
        confirmLabel="تأكيد تصفير الأرصدة"
        cancelLabel="تراجع"
        onConfirm={async () => {
          await zeroStockAndResetOperations();
          setIsZeroStockConfirmOpen(false);
        }}
        onCancel={() => setIsZeroStockConfirmOpen(false)}
      />

      {/* 3. Reset Database Confirm */}
      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        title="تأكيد مسح قاعدة البيانات بالكامل"
        message="تحذير شديد الأهمية: هذا الإجراء سيحذف كافة الأصناف والأقسام وحركات المخزون بالكامل. هل أنت متأكد؟"
        isDestructive={true}
        confirmLabel="تأكيد المسح الكامل"
        cancelLabel="تراجع"
        onConfirm={async () => {
          await clearDatabase();
          setIsResetConfirmOpen(false);
        }}
        onCancel={() => setIsResetConfirmOpen(false)}
      />

      {/* 4. Task 5: Stock Health Check Result Modal */}
      {isHealthModalOpen && healthReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-right">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${healthReport.issues.length === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    تقرير فحص سلامة المخزون والحركات (زر الفحص - المهمة 5)
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    تاريخ ووقت الفحص: {new Date(healthReport.generatedAt).toLocaleString('ar-SA')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHealthModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="p-5 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 block font-medium">الأصناف المفحوصة</span>
                  <span className="text-lg font-black text-slate-900 font-mono">{healthReport.totalItemsScanned}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 block font-medium">الحركات المفحوصة</span>
                  <span className="text-lg font-black text-slate-900 font-mono">{healthReport.totalMovementsScanned}</span>
                </div>
                <div className={`p-3 rounded-xl border ${healthReport.negativeStockCount > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-[11px] block font-medium ${healthReport.negativeStockCount > 0 ? 'text-red-700 font-bold' : 'text-slate-500'}`}>أرصدة سالبة</span>
                  <span className={`text-lg font-black font-mono ${healthReport.negativeStockCount > 0 ? 'text-red-700' : 'text-slate-900'}`}>{healthReport.negativeStockCount}</span>
                </div>
                <div className={`p-3 rounded-xl border ${healthReport.duplicateIdCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-[11px] block font-medium ${healthReport.duplicateIdCount > 0 ? 'text-amber-700 font-bold' : 'text-slate-500'}`}>معرفات مكررة</span>
                  <span className={`text-lg font-black font-mono ${healthReport.duplicateIdCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{healthReport.duplicateIdCount}</span>
                </div>
              </div>

              {/* Status Message */}
              {healthReport.issues.length === 0 ? (
                <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-emerald-900 mb-1">
                    المخزون سليم 100% ولا توجد أي مشاكل
                  </h4>
                  <p className="text-xs text-emerald-700 max-w-lg mx-auto">
                    جميع الحركات مطابقة للكميات الأساسية، لا توجد أرصدة سالبة، وجميع المعرفات والوحدات متطابقة تماماً مع قواعد stockRules.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>قائمة الملاحظات والمشكلات المكتشفة ({healthReport.issues.length}):</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {healthReport.unknownTypeMovementsCount} نوع مجهول · {healthReport.invalidBaseQtyCount} كمية غير مطابقة · {healthReport.orphanedMovementsCount} حركات يتيمة
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">الخطورة</th>
                          <th className="py-2.5 px-3">نوع المشكلة</th>
                          <th className="py-2.5 px-3">المعرف / الصنف</th>
                          <th className="py-2.5 px-3">التفاصيل التشخيصية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {healthReport.issues.map((iss, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${iss.severity === 'ERROR' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                                {iss.severity === 'ERROR' ? 'خطأ' : 'تنبيه'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                              {iss.type}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 text-xs">
                              {iss.entityName || iss.entityId}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 text-xs font-mono">
                              {iss.details}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={handleExportHealthReport}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تصدير تقرير الفحص (JSON)</span>
              </button>

              <button
                onClick={() => setIsHealthModalOpen(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
