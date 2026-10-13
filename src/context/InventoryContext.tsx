import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Branch,
  Category,
  CompanySettings,
  Customer,
  InventoryStats,
  Item,
  ItemStockSummary,
  MovementType,
  ReturnRecord,
  ReturnType,
  ReturnStatus,
  ReturnReason,
  ReturnItemEntry,
  ShippingCarrier,
  StockMovement,
  Unit,
  UnitConversion,
} from '../types/inventory';
import { StorageService } from '../services/storage';
import {
  FirestoreStorage,
  AuditLogEntry,
  CloudBackupRecord,
} from '../services/firestoreStorage';
import { OWNER_EMAIL } from '../services/firebase';

interface InventoryContextType {
  // State
  units: Unit[];
  categories: Category[];
  items: Item[];
  movements: StockMovement[];
  branches: Branch[];
  returns: ReturnRecord[];
  isLoading: boolean;

  // Cloud Sync & Audit State
  cloudSyncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  isOffline: boolean;
  hasUnsyncedOfflineData: boolean;
  unsyncedOfflineCount: number;
  auditLogs: AuditLogEntry[];
  cloudBackups: CloudBackupRecord[];
  refreshFromCloud: () => Promise<void>;
  syncLocalToCloudNow: () => Promise<{ success: boolean; count: number; error?: string }>;
  createCloudSnapshot: (name?: string) => Promise<{ success: boolean; backupId?: string }>;
  restoreCloudSnapshot: (backupId: string) => Promise<{ success: boolean; error?: string }>;
  refreshAuditLogs: () => Promise<void>;
  recoverOrphanedLocalData: () => Promise<{ success: boolean; foundCount: number; message: string }>;
  
  // Quick Feedback
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;

  // Branch actions
  addBranch: (
    name: string,
    city?: string,
    phone?: string,
    notes?: string,
    branchManagerName?: string,
    branchManagerPhone?: string
  ) => { success: boolean; error?: string; branch?: Branch };
  updateBranch: (
    id: string,
    name: string,
    city?: string,
    phone?: string,
    notes?: string,
    branchManagerName?: string,
    branchManagerPhone?: string,
    reason?: string
  ) => { success: boolean; error?: string };
  deleteBranch: (id: string, reason?: string) => { success: boolean; error?: string };
  clearAllBranches: () => void;

  // Customers actions & state
  customers: Customer[];
  companySettings: CompanySettings;
  addCustomer: (data: Omit<Customer, 'id' | 'createdAt'>) => { success: boolean; error?: string; customer?: Customer };
  updateCustomer: (id: string, data: Partial<Omit<Customer, 'id' | 'createdAt'>>, reason?: string) => { success: boolean; error?: string };
  deleteCustomer: (id: string, reason?: string) => { success: boolean; error?: string };
  saveCompanySettings: (settings: CompanySettings) => { success: boolean; error?: string };

  // Units actions
  addUnit: (name: string, symbol?: string, description?: string) => { success: boolean; error?: string; unit?: Unit };
  updateUnit: (id: string, name: string, symbol?: string, description?: string, reason?: string) => { success: boolean; error?: string };
  deleteUnit: (id: string, reason?: string) => { success: boolean; error?: string };
  seedCommonUnits: () => void;

  // Categories actions
  addCategory: (name: string, description?: string, color?: string) => { success: boolean; error?: string; category?: Category };
  updateCategory: (id: string, name: string, description?: string, color?: string, reason?: string) => { success: boolean; error?: string };
  deleteCategory: (id: string, reason?: string) => { success: boolean; error?: string };

  // Items actions
  addItem: (itemData: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'isArchived' | 'isDeleted'>) => { success: boolean; error?: string; item?: Item };
  updateItem: (id: string, itemData: Partial<Omit<Item, 'id' | 'createdAt' | 'updatedAt'>>, reason?: string) => { success: boolean; error?: string };
  archiveItem: (id: string, reason?: string) => { success: boolean; error?: string };
  restoreItem: (id: string) => { success: boolean; error?: string };
  softDeleteItem: (id: string, reason?: string) => { success: boolean; error?: string };
  restoreFromTrash: (id: string) => { success: boolean; error?: string };
  permanentDeleteItem: (id: string, reason?: string) => { success: boolean; error?: string };

  // Movements & Dispatches actions
  addMovement: (movementData: {
    itemId: string;
    type: MovementType;
    unitId: string;
    quantity: number;
    date: string;
    referenceNumber?: string;
    notes?: string;
    destinationType?: 'DIRECT' | 'BRANCH' | 'CUSTOMER';
    branchId?: string;
    branchName?: string;
    customerName?: string;
    customerPhone?: string;
    customerCity?: string;
    shippingCompany?: ShippingCarrier;
    shippingTrackingNumber?: string;
    batchId?: string;
  }) => { success: boolean; error?: string };
  
  addMultiItemDispatch: (dispatchData: {
    destinationType: 'BRANCH' | 'CUSTOMER';
    branchId?: string;
    branchName?: string;
    customerName?: string;
    customerPhone?: string;
    customerCity?: string;
    destinationContactName?: string;
    destinationPhone?: string;
    destinationAddress?: string;
    shippingCompany?: ShippingCarrier;
    customShippingCompany?: string;
    shippingTrackingNumber?: string;
    referenceNumber?: string;
    notes?: string;
    date: string;
    items: {
      itemId: string;
      unitId: string;
      quantity: number;
      notes?: string;
    }[];
  }) => { success: boolean; error?: string; voucherNumber?: string; movements?: StockMovement[] };

  updateMovement: (id: string, movementData: {
    unitId: string;
    quantity: number;
    type: MovementType;
    date: string;
    referenceNumber?: string;
    notes?: string;
  }) => { success: boolean; error?: string };
  deleteMovement: (id: string, reason?: string) => { success: boolean; error?: string };

  // Returns actions
  addReturn: (returnData: {
    type: ReturnType;
    status: ReturnStatus;
    date: string;
    destinationType?: 'BRANCH' | 'CUSTOMER' | 'SUPPLIER';
    branchId?: string;
    branchName?: string;
    partyName?: string;
    partyPhone?: string;
    originalReferenceNumber?: string;
    originalMovementId?: string;
    reason: ReturnReason;
    reasonDescription?: string;
    notes?: string;
    items: {
      itemId: string;
      unitId: string;
      quantity: number;
      notes?: string;
      originalMovementId?: string;
    }[];
  }) => { success: boolean; error?: string; returnId?: string; returnNumber?: string };
  approveReturn: (id: string) => { success: boolean; error?: string };
  cancelReturn: (id: string, cancellationReason?: string) => { success: boolean; error?: string };
  deleteReturnRecord: (id: string, reason?: string) => { success: boolean; error?: string };

  // Helpers & Calculations
  getItemStock: (itemId: string) => number; // in base units
  getItemStockSummary: (itemId: string) => ItemStockSummary | null;
  getAllItemsSummary: (includeArchived?: boolean, includeDeleted?: boolean) => ItemStockSummary[];
  getUnitConversionFactor: (itemId: string, unitId: string) => number | null;
  stats: InventoryStats;

  // Backup & Import & Initialization
  exportDataJSON: () => string;
  importDataJSON: (jsonStr: string) => Promise<{ success: boolean; error?: string }>;
  clearDatabase: () => Promise<void>;
  zeroStockAndResetOperations: () => Promise<void>;
  initializeCleanSystem: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | null>(null);

export const SYSTEM_DEFAULT_UNITS = [
  { name: 'حبة', symbol: 'حبة', description: 'وحدة فردية بالقطعة (1)' },
  { name: 'درزن', symbol: 'درزن', description: '12 حبة' },
  { name: 'كرتون', symbol: 'كرتون', description: 'سعة متغيرة بحسب الكمية المكتوبة بداخل الكرتون لكل صنف' },
  { name: 'كيلو', symbol: 'كغ', description: '1000 جرام' },
  { name: 'جرام', symbol: 'ج', description: 'وحدة قياس أساسية للوزن' },
  { name: 'نص', symbol: 'نصف كغ', description: '500 جرام (نصف كيلو)' },
  { name: 'ربع', symbol: 'ربع كغ', description: '250 جرام (ربع كيلو)' },
  { name: 'ثمن', symbol: 'ثمن كغ', description: '125 جرام' },
];

export const DEFAULT_BRANCHES: Branch[] = [];

// Helper to keep 'حبة' always at the top of the units list
export const sortUnitsWithHabbaFirst = (list: Unit[]): Unit[] => {
  return [...list].sort((a, b) => {
    const aIsHabba = a.name.trim() === 'حبة';
    const bIsHabba = b.name.trim() === 'حبة';
    if (aIsHabba && !bIsHabba) return -1;
    if (!aIsHabba && bIsHabba) return 1;
    return 0;
  });
};

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: 'نظام مخزون مدهال الطيب',
    commercialRegister: '1010000000',
    taxId: '300000000000003',
    phone: '0500000000',
    address: 'المملكة العربية السعودية',
    managerName: 'إدارة المخزون',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [hasUnsyncedOfflineData, setHasUnsyncedOfflineData] = useState(false);
  const [unsyncedOfflineCount, setUnsyncedOfflineCount] = useState(0);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [cloudBackups, setCloudBackups] = useState<CloudBackupRecord[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Synchronized state refs to prevent any stale closure issues
  const unitsRef = React.useRef(units);
  const categoriesRef = React.useRef(categories);
  const itemsRef = React.useRef(items);
  const movementsRef = React.useRef(movements);
  const branchesRef = React.useRef(branches);
  const returnsRef = React.useRef(returns);
  const customersRef = React.useRef(customers);

  useEffect(() => {
    customersRef.current = customers;
  }, [customers]);

  useEffect(() => {
    unitsRef.current = units;
  }, [units]);
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    movementsRef.current = movements;
  }, [movements]);
  useEffect(() => {
    branchesRef.current = branches;
  }, [branches]);
  useEffect(() => {
    returnsRef.current = returns;
  }, [returns]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const refreshAuditLogs = useCallback(async () => {
    const logs = await FirestoreStorage.getAuditLogs(50);
    setAuditLogs(logs);
  }, []);

  const refreshCloudBackups = useCallback(async () => {
    const backups = await FirestoreStorage.listCloudBackups();
    setCloudBackups(backups);
  }, []);

  // Safe Cloud & Cache Loading on Mount (Permanent Persistence)
  const refreshFromCloud = useCallback(async () => {
    setCloudSyncStatus('syncing');
    try {
      // Load from Cloud Firestore with automatic two-way merge of any offline data
      const loaded = await FirestoreStorage.loadAll();
      const currentUnits = loaded.units || [];
      const currentBranches = loaded.branches || [];

      // Respect customer's existing units exactly as stored in Cloud Firestore
      let finalUnits = currentUnits;
      if (currentUnits.length === 0) {
        const now = new Date().toISOString();
        finalUnits = SYSTEM_DEFAULT_UNITS.map((def) => ({
          id: 'unit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          name: def.name,
          symbol: def.symbol,
          description: def.description,
          createdAt: now,
        }));
      }

      setUnits(sortUnitsWithHabbaFirst(finalUnits));
      setCategories(loaded.categories || []);
      setItems(loaded.items || []);
      setMovements(loaded.movements || []);
      setBranches(currentBranches);
      setReturns(loaded.returns || []);
      setCustomers(loaded.customers || []);
      if (loaded.settings) {
        setCompanySettings(loaded.settings);
      }
      setCloudSyncStatus(navigator.onLine ? 'synced' : 'offline');
      setIsOffline(!navigator.onLine);

      // Load initial audit logs & backups in background
      refreshAuditLogs().catch(() => {});
      refreshCloudBackups().catch(() => {});
    } catch (err: any) {
      console.warn('Could not load inventory directly from Cloud Firestore, falling back to local storage cache:', err);
      try {
        const localData = await StorageService.loadAll();
        if (localData) {
          if (localData.units && localData.units.length > 0) {
            setUnits(sortUnitsWithHabbaFirst(localData.units));
          }
          if (localData.categories) setCategories(localData.categories);
          if (localData.items) setItems(localData.items);
          if (localData.movements) setMovements(localData.movements);
          if (localData.branches) setBranches(localData.branches);
          if (localData.returns) setReturns(localData.returns);
          if (localData.customers) setCustomers(localData.customers);
          if (localData.settings) setCompanySettings(localData.settings);
        }
      } catch (localErr) {
        console.warn('Local storage fallback error:', localErr);
      }
      setCloudSyncStatus('offline');
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  }, [refreshAuditLogs, refreshCloudBackups]);

  useEffect(() => {
    refreshFromCloud();

    // Instantaneous multi-device synchronization (PC & Mobile stay perfectly in sync in real time)
    const unsubscribe = FirestoreStorage.subscribeToAllCollections({
      onItems: (cloudItems) => {
        setItems(cloudItems);
        itemsRef.current = cloudItems;
      },
      onMovements: (cloudMovements) => {
        setMovements(cloudMovements);
        movementsRef.current = cloudMovements;
      },
      onCategories: (cloudCategories) => {
        setCategories(cloudCategories);
        categoriesRef.current = cloudCategories;
      },
      onUnits: (cloudUnits) => {
        if (cloudUnits.length > 0) {
          const sorted = sortUnitsWithHabbaFirst(cloudUnits);
          setUnits(sorted);
          unitsRef.current = sorted;
        }
      },
      onBranches: (cloudBranches) => {
        setBranches(cloudBranches);
        branchesRef.current = cloudBranches;
      },
      onReturns: (cloudReturns) => {
        setReturns(cloudReturns);
        returnsRef.current = cloudReturns;
      },
      onCustomers: (cloudCustomers) => {
        setCustomers(cloudCustomers);
        customersRef.current = cloudCustomers;
      },
    });

    return () => {
      unsubscribe();
    };
  }, [refreshFromCloud]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Dedicated explicit method to force sync local data to Cloud Firestore immediately
  const syncLocalToCloudNow = useCallback(async (): Promise<{ success: boolean; count: number; error?: string }> => {
    setCloudSyncStatus('syncing');
    try {
      const currentData = {
        units: unitsRef.current,
        categories: categoriesRef.current,
        items: itemsRef.current,
        movements: movementsRef.current,
        branches: branchesRef.current,
        returns: returnsRef.current,
      };
      // 1. Ensure local cache has current data
      await StorageService.saveAll(currentData);
      // 2. Direct upload to Cloud Firestore
      const result = await FirestoreStorage.syncAllToFirestore(currentData);
      setCloudSyncStatus('synced');
      setHasUnsyncedOfflineData(false);
      setUnsyncedOfflineCount(0);
      await refreshAuditLogs();
      await refreshCloudBackups();
      showToast(
        `تم حفظ وتحديث بيانات المخزون في السحابة بنجاح (${result.count} عنصراً)`,
        'success'
      );
      return result;
    } catch (err: any) {
      setCloudSyncStatus('error');
      showToast('تعذر المزامنة مع السحابة، يرجى المحاولة مرة أخرى', 'error');
      return { success: false, count: 0, error: 'تعذر المزامنة مع السحابة' };
    }
  }, [refreshAuditLogs, refreshCloudBackups, showToast]);

  // Sync to Storage (Dual: Local Cache + Cloud Firestore)
  const persistChanges = useCallback(
    async (
      newUnits: Unit[] = unitsRef.current,
      newCategories: Category[] = categoriesRef.current,
      newItems: Item[] = itemsRef.current,
      newMovements: StockMovement[] = movementsRef.current,
      newBranches: Branch[] = branchesRef.current,
      newReturns: ReturnRecord[] = returnsRef.current
    ) => {
      // Keep refs updated immediately
      unitsRef.current = newUnits;
      categoriesRef.current = newCategories;
      itemsRef.current = newItems;
      movementsRef.current = newMovements;
      branchesRef.current = newBranches;
      returnsRef.current = newReturns;

      const fullData = {
        units: newUnits,
        categories: newCategories,
        items: newItems,
        movements: newMovements,
        branches: newBranches,
        returns: newReturns,
      };

      // Persistent Cloud Firestore sync (Authoritative cloud-first write)
      setCloudSyncStatus('syncing');
      try {
        await FirestoreStorage.syncAllToFirestore(fullData);
        setCloudSyncStatus('synced');
        setHasUnsyncedOfflineData(false);
        setUnsyncedOfflineCount(0);
        await refreshAuditLogs();
        await refreshCloudBackups();
      } catch (err: any) {
        console.error('Cloud Firestore sync error:', err);
        setCloudSyncStatus('error');
        const errMsg = err?.message || 'فشل حفظ وتحديث البيانات في سحابة Firestore. يرجى التحقق من الاتصال والصلاحيات.';
        showToast(errMsg, 'error');
        throw new Error(errMsg);
      }
    },
    [refreshAuditLogs, refreshCloudBackups, showToast]
  );

  // Online / Offline Listeners & Auto-Sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      showToast('تم استعادة الاتصال بالإنترنت! جارٍ المزامنة السحابية التلقائية...', 'info');
      syncLocalToCloudNow().then((res) => {
        if (res.success) {
          showToast(`تمت مزامنة بياناتك بنجاح مع السحابة (${res.count} عنصراً)`, 'success');
        }
      });
    };

    const handleOffline = () => {
      setIsOffline(true);
      setCloudSyncStatus('offline');
      showToast('انقطع الاتصال بالإنترنت. تم تفعيل وضع الحفظ المحلي ولن تُفقد بياناتك عند التحديث.', 'info');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsyncedOfflineData) {
        e.preventDefault();
        e.returnValue = 'لديك بيانات مسجلة لم تكتمل مزامنتها مع السحابة بعد. هل أنت متأكد من مغادرة الصفحة؟';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsyncedOfflineData, syncLocalToCloudNow, showToast]);

  // Emergency Deep Scan & Orphaned Local Data Recovery
  const recoverOrphanedLocalData = useCallback(async (): Promise<{ success: boolean; foundCount: number; message: string }> => {
    try {
      const knownItemIds = new Set(itemsRef.current.map((i) => i.id));
      const { rescuedItems, rescuedMovements, rescuedReturns } = await StorageService.deepScanAndRescueOrphanedData(knownItemIds);

      const totalFound = rescuedItems.length + rescuedMovements.length + rescuedReturns.length;
      if (totalFound === 0) {
        return {
          success: false,
          foundCount: 0,
          message: 'تم فحص ذاكرة المتصفح وIndexedDB بالكامل؛ لا توجد مسودات أصناف غير مسجلة.',
        };
      }

      const updatedItems = [...itemsRef.current, ...rescuedItems];
      const updatedMovements = [...movementsRef.current, ...rescuedMovements];
      const updatedReturns = [...returnsRef.current, ...rescuedReturns];

      setItems(updatedItems);
      setMovements(updatedMovements);
      setReturns(updatedReturns);

      await persistChanges(
        unitsRef.current,
        categoriesRef.current,
        updatedItems,
        updatedMovements,
        branchesRef.current,
        updatedReturns
      );

      if (navigator.onLine) {
        await FirestoreStorage.syncAllToFirestore({
          units: unitsRef.current,
          categories: categoriesRef.current,
          items: updatedItems,
          movements: updatedMovements,
          branches: branchesRef.current,
          returns: updatedReturns,
        });
      }

      showToast(`تم استرجاع وتثبيت ${rescuedItems.length} صنف و ${rescuedMovements.length} حركة بنجاح!`, 'success');
      return {
        success: true,
        foundCount: totalFound,
        message: `تم العثور على ${rescuedItems.length} صنف محفوظ في ذاكرة المتصفح وتم استرجاعه وتثبيته سحابياً بنجاح!`,
      };
    } catch (err: any) {
      return {
        success: false,
        foundCount: 0,
        message: 'حدث خطأ أثناء فحص الذاكرة: ' + (err.message || 'خطأ غير معروف'),
      };
    }
  }, [persistChanges, showToast]);

  // CUSTOMERS ACTIONS
  const addCustomer = useCallback(
    (data: Omit<Customer, 'id' | 'createdAt'>) => {
      const now = new Date().toISOString();
      const newCustomer: Customer = {
        id: 'cust_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: data.name.trim(),
        phone: data.phone?.trim() || undefined,
        address: data.address?.trim() || undefined,
        taxId: data.taxId?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      const updated = [newCustomer, ...customers];
      setCustomers(updated);
      customersRef.current = updated;
      FirestoreStorage.saveCustomer(newCustomer).catch((err) => console.warn(err));
      return { success: true, customer: newCustomer };
    },
    [customers]
  );

  const updateCustomer = useCallback(
    (id: string, data: Partial<Omit<Customer, 'id' | 'createdAt'>>, reason?: string) => {
      const existing = customers.find((c) => c.id === id);
      if (!existing) return { success: false, error: 'العميل غير موجود' };
      const updatedCust: Customer = {
        ...existing,
        ...data,
        name: data.name !== undefined ? data.name.trim() : existing.name,
        updatedAt: new Date().toISOString(),
      };
      const updated = customers.map((c) => (c.id === id ? updatedCust : c));
      setCustomers(updated);
      customersRef.current = updated;
      FirestoreStorage.saveCustomer(updatedCust).catch((err) => console.warn(err));
      FirestoreStorage.recordAuditLog({
        operationType: 'تعديل',
        entityType: 'عميل',
        entityId: id,
        entityName: updatedCust.name,
        reason: reason?.trim() || 'تعديل بيانات العميل',
        userName: OWNER_EMAIL,
        dataBefore: existing,
        dataAfter: updatedCust,
      }).catch((e) => console.warn(e));
      return { success: true };
    },
    [customers]
  );

  const deleteCustomer = useCallback(
    (id: string, reason?: string) => {
      const existing = customers.find((c) => c.id === id);
      if (!existing) return { success: false, error: 'العميل غير موجود' };
      const updated = customers.filter((c) => c.id !== id);
      setCustomers(updated);
      customersRef.current = updated;
      FirestoreStorage.deleteCustomer(id, existing.name).catch((err) => console.warn(err));
      FirestoreStorage.recordAuditLog({
        operationType: 'حذف',
        entityType: 'عميل',
        entityId: id,
        entityName: existing.name,
        reason: reason?.trim() || 'حذف العميل من النظام',
        userName: OWNER_EMAIL,
        dataBefore: existing,
        dataAfter: null,
      }).catch((e) => console.warn(e));
      return { success: true };
    },
    [customers]
  );

  const saveCompanySettings = useCallback(
    (settings: CompanySettings) => {
      setCompanySettings(settings);
      FirestoreStorage.saveCompanySettings(settings).catch((err) => console.warn(err));
      showToast('تم حفظ إعدادات المنشأة وسندات الطباعة بنجاح', 'success');
      return { success: true };
    },
    [showToast]
  );

  // Branch operations
  const addBranch = useCallback(
    (
      name: string,
      city?: string,
      phone?: string,
      notes?: string,
      branchManagerName?: string,
      branchManagerPhone?: string
    ) => {
      const cleanName = name.trim();
      if (!cleanName) {
        return { success: false, error: 'يرجى إدخال اسم الفرع' };
      }

      const exists = branches.some((b) => (b?.name || '').trim().toLowerCase() === cleanName.toLowerCase());
      if (exists) {
        return { success: false, error: `الفرع "${cleanName}" مسجل مسبقاً` };
      }

      const newBranch: Branch = {
        id: 'branch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: cleanName,
        city: city?.trim() || undefined,
        phone: phone?.trim() || undefined,
        notes: notes?.trim() || undefined,
        branchManagerName: branchManagerName?.trim() || undefined,
        managerName: branchManagerName?.trim() || undefined,
        branchManagerPhone: branchManagerPhone?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      const updated = [...branches, newBranch];
      setBranches(updated);
      branchesRef.current = updated;
      FirestoreStorage.saveBranch(newBranch).catch((e) => console.warn(e));
      persistChanges(units, categories, items, movements, updated, returns);
      showToast(`تمت إضافة الفرع "${cleanName}" بنجاح`, 'success');
      return { success: true, branch: newBranch };
    },
    [branches, units, categories, items, movements, returns, persistChanges, showToast]
  );

  const deleteBranch = useCallback(
    (id: string, reason?: string) => {
      const target = branches.find((b) => b.id === id);
      if (!target) return { success: false, error: 'الفرع غير موجود' };

      const updated = branches.filter((b) => b.id !== id);
      setBranches(updated);
      branchesRef.current = updated;
      try {
        FirestoreStorage.deleteBranch(id, target.name).catch((e) => console.warn(e));
      } catch {}
      FirestoreStorage.recordAuditLog({
        operationType: 'حذف',
        entityType: 'فرع',
        entityId: id,
        entityName: target.name,
        reason: reason?.trim() || 'حذف الفرع من النظام',
        userName: OWNER_EMAIL,
        dataBefore: target,
        dataAfter: null,
      }).catch((e) => console.warn(e));
      persistChanges(units, categories, items, movements, updated, returns);
      return { success: true };
    },
    [branches, units, categories, items, movements, returns, persistChanges]
  );

  const updateBranch = useCallback(
    (
      id: string,
      name: string,
      city?: string,
      phone?: string,
      notes?: string,
      branchManagerName?: string,
      branchManagerPhone?: string,
      reason?: string
    ) => {
      const cleanName = name.trim();
      if (!cleanName) return { success: false, error: 'يرجى إدخال اسم الفرع' };

      const exists = branches.some((b) => b.id !== id && (b?.name || '').trim().toLowerCase() === cleanName.toLowerCase());
      if (exists) return { success: false, error: `الفرع "${cleanName}" مسجل مسبقاً` };

      const target = branches.find((b) => b.id === id);
      const updatedBranch: Branch = {
        id,
        name: cleanName,
        city: city?.trim() || undefined,
        phone: phone?.trim() || undefined,
        notes: notes?.trim() || undefined,
        branchManagerName: branchManagerName !== undefined ? branchManagerName.trim() : target?.branchManagerName,
        managerName: branchManagerName !== undefined ? branchManagerName.trim() : target?.managerName,
        branchManagerPhone: branchManagerPhone !== undefined ? branchManagerPhone.trim() : target?.branchManagerPhone,
        createdAt: target?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = branches.map((b) => (b.id === id ? updatedBranch : b));
      setBranches(updated);
      branchesRef.current = updated;
      FirestoreStorage.saveBranch(updatedBranch).catch((e) => console.warn(e));
      FirestoreStorage.recordAuditLog({
        operationType: 'تعديل',
        entityType: 'فرع',
        entityId: id,
        entityName: cleanName,
        reason: reason?.trim() || 'تعديل بيانات الفرع',
        userName: OWNER_EMAIL,
        dataBefore: target || null,
        dataAfter: updatedBranch,
      }).catch((e) => console.warn(e));
      persistChanges(units, categories, items, movements, updated, returns);
      return { success: true };
    },
    [branches, units, categories, items, movements, returns, persistChanges]
  );

  const clearAllBranches = useCallback(() => {
    for (const b of branches) {
      try {
        FirestoreStorage.deleteBranch(b.id, b.name).catch((e) => console.warn(e));
      } catch {}
    }
    setBranches([]);
    persistChanges(units, categories, items, movements, [], returns);
    showToast('تم تصفير وحذف جميع الفروع بنجاح', 'info');
  }, [branches, units, categories, items, movements, returns, persistChanges, showToast]);

  // Calculate current stock in base units with foolproof numerical safety
  const getItemStock = useCallback(
    (itemId: string): number => {
      const itemMovements = movements.filter((m) => m && m.itemId === itemId);
      let stock = 0;
      for (const m of itemMovements) {
        const factor = Number(m.factorApplied) > 0 ? Number(m.factorApplied) : 1;
        const baseQty =
          m.baseQuantity !== undefined && m.baseQuantity !== null && !isNaN(Number(m.baseQuantity))
            ? Number(m.baseQuantity)
            : (Number(m.quantity) || 0) * factor;

        if (m.type === 'IN') {
          stock += baseQty;
        } else if (m.type === 'OUT') {
          stock -= baseQty;
        }
      }
      const rawStock = Math.round(stock * 1000) / 1000;
      return Math.max(0, rawStock);
    },
    [movements]
  );

  // Conversion factor helper
  const getUnitConversionFactor = useCallback(
    (itemId: string, unitId: string): number | null => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return null;
      if (item.baseUnitId === unitId) return 1;
      const conv = item.conversions.find((c) => c.unitId === unitId);
      return conv ? conv.factorToBase : null;
    },
    [items]
  );

  // Detailed Summary for an item
  const getItemStockSummary = useCallback(
    (itemId: string): ItemStockSummary | null => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return null;

      const category = categories.find((c) => c.id === item.categoryId);
      const baseUnit = units.find((u) => u.id === item.baseUnitId);
      const stock = getItemStock(itemId);

      let totalIn = 0;
      let totalOut = 0;
      for (const m of movements.filter((m) => m && m.itemId === itemId)) {
        const factor = Number(m.factorApplied) > 0 ? Number(m.factorApplied) : 1;
        const baseQty =
          m.baseQuantity !== undefined && m.baseQuantity !== null && !isNaN(Number(m.baseQuantity))
            ? Number(m.baseQuantity)
            : (Number(m.quantity) || 0) * factor;

        if (m.type === 'IN') totalIn += baseQty;
        if (m.type === 'OUT') totalOut += baseQty;
      }

      // Format equivalents in all configured units
      const formattedBalances: ItemStockSummary['formattedBalances'] = [];
      
      // Base unit entry
      formattedBalances.push({
        unitName: baseUnit?.name || 'وحدة',
        factor: 1,
        equivalent: stock,
      });

      // Conversions entries
      for (const conv of (item.conversions || [])) {
        const u = units.find((u) => u.id === conv.unitId);
        const factor = Number(conv.factorToBase);
        if (u && factor > 0) {
          const equiv = Math.round((stock / factor) * 1000) / 1000;
          formattedBalances.push({
            unitName: u.name,
            factor,
            equivalent: equiv,
          });
        }
      }

      let status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK' = 'IN_STOCK';
      if (stock <= 0) {
        status = 'OUT_OF_STOCK';
      } else if (item.minStockAlert > 0 && stock <= item.minStockAlert) {
        status = 'LOW_STOCK';
      }

      return {
        item,
        categoryName: category?.name || 'غير محدد',
        baseUnitName: baseUnit?.name || 'وحدة',
        currentStock: stock,
        totalIn: Math.round(totalIn * 1000) / 1000,
        totalOut: Math.round(totalOut * 1000) / 1000,
        formattedBalances,
        status,
      };
    },
    [items, categories, units, getItemStock, movements]
  );

  // Get summary for all items
  const getAllItemsSummary = useCallback(
    (includeArchived = false, includeDeleted = false): ItemStockSummary[] => {
      return items
        .filter((item) => {
          if (!includeDeleted && item.isDeleted) return false;
          if (!includeArchived && item.isArchived) return false;
          return true;
        })
        .map((item) => getItemStockSummary(item.id)!)
        .filter(Boolean);
    },
    [items, getItemStockSummary]
  );

  // Overall Statistics with local calendar day calculation
  const stats: InventoryStats = useMemo(() => {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    const todayMovements = movements.filter((m) => {
      if (!m || !m.date) return false;
      const d = new Date(m.date);
      return (
        !isNaN(d.getTime()) &&
        d.getFullYear() === todayYear &&
        d.getMonth() === todayMonth &&
        d.getDate() === todayDate
      );
    });

    let todayInMovementsCount = 0;
    let todayOutMovementsCount = 0;
    let todayInQuantityBase = 0;
    let todayOutQuantityBase = 0;

    for (const m of todayMovements) {
      const factor = Number(m.factorApplied) > 0 ? Number(m.factorApplied) : 1;
      const baseQty =
        m.baseQuantity !== undefined && m.baseQuantity !== null && !isNaN(Number(m.baseQuantity))
          ? Number(m.baseQuantity)
          : (Number(m.quantity) || 0) * factor;

      if (m.type === 'IN') {
        todayInMovementsCount++;
        todayInQuantityBase += baseQty;
      } else if (m.type === 'OUT') {
        todayOutMovementsCount++;
        todayOutQuantityBase += baseQty;
      }
    }

    const activeItems = items.filter((i) => !i.isDeleted && !i.isArchived);
    let lowStockItemsCount = 0;
    let outOfStockItemsCount = 0;

    for (const item of activeItems) {
      const stock = getItemStock(item.id);
      if (stock <= 0) {
        outOfStockItemsCount++;
      } else if (item.minStockAlert > 0 && stock <= item.minStockAlert) {
        lowStockItemsCount++;
      }
    }

    const activeBranches = branches.filter((b) => !b.isArchived);

    return {
      totalItemsCount: items.length,
      activeItemsCount: activeItems.length,
      archivedItemsCount: items.filter((i) => i.isArchived && !i.isDeleted).length,
      deletedItemsCount: items.filter((i) => i.isDeleted).length,
      categoriesCount: categories.length,
      todayInMovementsCount,
      todayOutMovementsCount,
      todayInQuantityBase: Math.round(todayInQuantityBase * 100) / 100,
      todayOutQuantityBase: Math.round(todayOutQuantityBase * 100) / 100,
      lowStockItemsCount,
      outOfStockItemsCount,
      branchesCount: branches.length,
      activeBranchesCount: activeBranches.length,
      archivedBranchesCount: branches.filter((b) => b.isArchived).length,
      totalReturnsCount: returns.length,
      approvedReturnsCount: returns.filter((r) => r.status === 'APPROVED').length,
      draftReturnsCount: returns.filter((r) => r.status === 'DRAFT').length,
      inReturnsCount: returns.filter((r) => r.type === 'RETURN_IN' && r.status === 'APPROVED').length,
      outReturnsCount: returns.filter((r) => r.type === 'RETURN_OUT' && r.status === 'APPROVED').length,
    };
  }, [items, categories, movements, branches, returns, getItemStock]);

  // UNIT CRUD
  const addUnit = useCallback(
    (name: string, symbol?: string, description?: string) => {
      const cleanName = name.trim();
      if (!cleanName) return { success: false, error: 'يرجى إدخال اسم الوحدة' };

      const exists = units.some((u) => (u?.name || '').trim().toLowerCase() === cleanName.toLowerCase());
      if (exists) return { success: false, error: 'الوحدة موجودة مسبقاً' };

      const newUnit: Unit = {
        id: 'unit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        name: cleanName,
        symbol: symbol?.trim(),
        description: description?.trim(),
        createdAt: new Date().toISOString(),
      };

      const updated = [...units, newUnit];
      setUnits(sortUnitsWithHabbaFirst(updated));
      unitsRef.current = sortUnitsWithHabbaFirst(updated);
      FirestoreStorage.saveUnit(newUnit).catch((e) => console.warn(e));
      persistChanges(updated, categories, items, movements, branches, returns);
      showToast(`تمت إضافة الوحدة "${cleanName}" بنجاح`, 'success');
      return { success: true, unit: newUnit };
    },
    [units, categories, items, movements, branches, returns, persistChanges, showToast]
  );

  const updateUnit = useCallback(
    (id: string, name: string, symbol?: string, description?: string, reason?: string) => {
      const cleanName = name.trim();
      if (!cleanName) return { success: false, error: 'يرجى إدخال اسم الوحدة' };

      const duplicate = units.some(
        (u) => u.id !== id && (u?.name || '').trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicate) return { success: false, error: 'يوجد وحدة أخرى بهذا الاسم' };

      const target = units.find((u) => u.id === id);
      const updatedUnit = { id, name: cleanName, symbol: symbol?.trim(), description: description?.trim(), createdAt: target?.createdAt || new Date().toISOString() };
      const updated = units.map((u) => (u.id === id ? updatedUnit : u));
      setUnits(updated);
      unitsRef.current = updated;
      FirestoreStorage.saveUnit(updatedUnit).catch((e) => console.warn(e));
      FirestoreStorage.recordAuditLog({
        operationType: 'تعديل',
        entityType: 'وحدة',
        entityId: id,
        entityName: cleanName,
        reason: reason?.trim() || 'تعديل بيانات الوحدة',
        userName: OWNER_EMAIL,
        dataBefore: target || null,
        dataAfter: updatedUnit,
      }).catch((e) => console.warn(e));
      persistChanges(updated, categories, items, movements, branches, returns);
      showToast(`تم تعديل الوحدة "${cleanName}" بنجاح`, 'success');
      return { success: true };
    },
    [units, categories, items, movements, branches, returns, persistChanges, showToast]
  );

  const deleteUnit = useCallback(
    (id: string, reason?: string) => {
      const unitToDelete = units.find((u) => u.id === id);
      if (!unitToDelete) return { success: false, error: 'الوحدة غير موجودة' };

      // Check if unit is in use
      const inUseAsBase = items.some((i) => !i.isDeleted && i.baseUnitId === id);
      const inUseInConversions = items.some(
        (i) => !i.isDeleted && i.conversions.some((c) => c.unitId === id)
      );

      if (inUseAsBase || inUseInConversions) {
        return {
          success: false,
          error: `لا يمكن حذف الوحدة "${unitToDelete.name}" لأنها مستخدمة كوحدة أساسية أو في تحويلات أصناف قائمة`,
        };
      }

      const updated = units.filter((u) => u.id !== id);
      setUnits(updated);
      try {
        FirestoreStorage.deleteUnit(id, unitToDelete.name).catch((e) => console.warn(e));
      } catch {}
      FirestoreStorage.recordAuditLog({
        operationType: 'حذف',
        entityType: 'وحدة',
        entityId: id,
        entityName: unitToDelete.name,
        reason: reason?.trim() || 'حذف الوحدة العامة',
        userName: OWNER_EMAIL,
        dataBefore: unitToDelete,
        dataAfter: null,
      }).catch((e) => console.warn(e));
      persistChanges(updated, categories, items, movements, branches, returns);
      showToast(`تم حذف الوحدة "${unitToDelete.name}" بنجاح`, 'success');
      return { success: true };
    },
    [units, items, categories, movements, branches, returns, persistChanges, showToast]
  );

  // Common units quick seed helper
  const seedCommonUnits = useCallback(() => {
    const newUnitsToAdd: Unit[] = [];
    const now = new Date().toISOString();

    for (const def of SYSTEM_DEFAULT_UNITS) {
      if (!units.some((u) => u.name.trim().toLowerCase() === def.name.trim().toLowerCase())) {
        newUnitsToAdd.push({
          id: 'unit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          name: def.name,
          symbol: def.symbol,
          description: def.description,
          createdAt: now,
        });
      }
    }

    if (newUnitsToAdd.length === 0) {
      showToast('الوحدات الشائعة مضافة بالفعل', 'info');
      return;
    }

    const updated = [...units, ...newUnitsToAdd];
    setUnits(sortUnitsWithHabbaFirst(updated));
    persistChanges(updated, categories, items, movements);
    showToast(`تمت إضافة ${newUnitsToAdd.length} وحدات شائعة بنجاح`, 'success');
  }, [units, categories, items, movements, persistChanges, showToast]);

  // CATEGORY CRUD
  const addCategory = useCallback(
    (name: string, description?: string, color?: string) => {
      const cleanName = name.trim();
      if (!cleanName) return { success: false, error: 'يرجى إدخال اسم القسم' };

      const exists = categories.some((c) => (c?.name || '').trim().toLowerCase() === cleanName.toLowerCase());
      if (exists) return { success: false, error: 'القسم موجود مسبقاً' };

      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];
      const assignedColor = color || colors[categories.length % colors.length];

      const newCategory: Category = {
        id: 'cat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        name: cleanName,
        description: description?.trim(),
        color: assignedColor,
        createdAt: new Date().toISOString(),
      };

      const updated = [...categories, newCategory];
      setCategories(updated);
      categoriesRef.current = updated;
      FirestoreStorage.saveCategory(newCategory).catch((e) => console.warn(e));
      persistChanges(units, updated, items, movements, branches, returns);
      showToast(`تم إنشاء القسم "${cleanName}" بنجاح`, 'success');
      return { success: true, category: newCategory };
    },
    [categories, units, items, movements, branches, returns, persistChanges, showToast]
  );

  const updateCategory = useCallback(
    (id: string, name: string, description?: string, color?: string, reason?: string) => {
      const cleanName = name.trim();
      if (!cleanName) return { success: false, error: 'يرجى إدخال اسم القسم' };

      const duplicate = categories.some(
        (c) => c.id !== id && (c?.name || '').trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicate) return { success: false, error: 'يوجد قسم آخر بهذا الاسم' };

      const target = categories.find((c) => c.id === id);
      const updatedCategory: Category = {
        id,
        name: cleanName,
        description: description?.trim(),
        color,
        createdAt: target?.createdAt || new Date().toISOString(),
      };
      const updated = categories.map((c) => (c.id === id ? updatedCategory : c));
      setCategories(updated);
      categoriesRef.current = updated;
      FirestoreStorage.saveCategory(updatedCategory).catch((e) => console.warn(e));
      FirestoreStorage.recordAuditLog({
        operationType: 'تعديل',
        entityType: 'قسم',
        entityId: id,
        entityName: cleanName,
        reason: reason?.trim() || 'تعديل بيانات القسم',
        userName: OWNER_EMAIL,
        dataBefore: target || null,
        dataAfter: updatedCategory,
      }).catch((e) => console.warn(e));
      persistChanges(units, updated, items, movements, branches, returns);
      showToast(`تم تعديل القسم "${cleanName}" بنجاح`, 'success');
      return { success: true };
    },
    [categories, units, items, movements, branches, returns, persistChanges, showToast]
  );

  const deleteCategory = useCallback(
    (id: string, reason?: string) => {
      const cat = categories.find((c) => c.id === id);
      if (!cat) return { success: false, error: 'القسم غير موجود' };

      const itemsInCat = items.filter((i) => !i.isDeleted && i.categoryId === id);
      if (itemsInCat.length > 0) {
        return {
          success: false,
          error: `لا يمكن حذف القسم "${cat.name}" لأنه يحتوي على ${itemsInCat.length} صنف. يرجى نقل الأصناف أو تعديلها أولاً.`,
        };
      }

      const updated = categories.filter((c) => c.id !== id);
      setCategories(updated);
      try {
        FirestoreStorage.deleteCategory(id, cat.name).catch((e) => console.warn(e));
      } catch {}
      FirestoreStorage.recordAuditLog({
        operationType: 'حذف',
        entityType: 'قسم',
        entityId: id,
        entityName: cat.name,
        reason: reason?.trim() || 'حذف القسم من النظام',
        userName: OWNER_EMAIL,
        dataBefore: cat,
        dataAfter: null,
      }).catch((e) => console.warn(e));
      persistChanges(units, updated, items, movements, branches, returns);
      showToast(`تم حذف القسم "${cat.name}" بنجاح`, 'success');
      return { success: true };
    },
    [categories, items, units, movements, branches, returns, persistChanges, showToast]
  );

  // ITEM CRUD
  const addItem = useCallback(
    (itemData: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'isArchived' | 'isDeleted'>) => {
      const cleanName = itemData.name.trim();
      if (!cleanName) return { success: false, error: 'يرجى إدخال اسم الصنف' };
      if (!itemData.categoryId) return { success: false, error: 'يرجى تحديد قسم الصنف' };
      if (!itemData.baseUnitId) return { success: false, error: 'يرجى تحديد الوحدة الأساسية للصنف' };

      // Prevent duplicate item name (across active, archived, and trash items)
      const nameExists = items.some(
        (i) => (i?.name || '').trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (nameExists) {
        return {
          success: false,
          error: `يوجد صنف مسجل مسبقاً بنفس الاسم "${cleanName}"؛ يرجى اختيار اسم غير مكرر أو تمييزه.`,
        };
      }

      // Ensure valid conversions (no duplicate unit, factor > 0, not equal to base unit)
      const validConversions: UnitConversion[] = [];
      const seenUnits = new Set<string>();

      for (const conv of itemData.conversions || []) {
        if (conv.unitId === itemData.baseUnitId) continue;
        if (seenUnits.has(conv.unitId)) continue;
        if (conv.factorToBase <= 0) continue;
        seenUnits.add(conv.unitId);
        validConversions.push({
          unitId: conv.unitId,
          factorToBase: Number(conv.factorToBase),
        });
      }

      const cleanCode = itemData.code?.trim() || `ITM-${(items.length + 1).toString().padStart(4, '0')}`;
      const codeExists = items.some(
        (i) => (i?.code || '').trim().toLowerCase() === cleanCode.toLowerCase()
      );
      if (codeExists) {
        return {
          success: false,
          error: `رمز أو رقم الصنف "${cleanCode}" مسجل مسبقاً لصنف آخر؛ يرجى اختيار رمز أو رقم غير مكرر.`,
        };
      }

      const newItem: Item = {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        code: cleanCode,
        name: cleanName,
        categoryId: itemData.categoryId,
        baseUnitId: itemData.baseUnitId,
        conversions: validConversions,
        minStockAlert: Number(itemData.minStockAlert) || 0,
        costPrice: itemData.costPrice !== undefined ? Number(itemData.costPrice) : undefined,
        salePrice: itemData.salePrice !== undefined ? Number(itemData.salePrice) : undefined,
        notes: itemData.notes?.trim(),
        isArchived: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updated = [...items, newItem];
      setItems(updated);
      itemsRef.current = updated;

      FirestoreStorage.saveItem(newItem)
        .then(() => {
          persistChanges(units, categories, updated, movements, branches, returns);
          showToast(`تمت إضافة وحفظ الصنف "${cleanName}" في السحابة بنجاح`, 'success');
        })
        .catch((err: any) => {
          console.error('Failed to save item to Firestore:', err);
          const errMsg = err?.message || 'فشل حفظ الصنف في سحابة Firestore. يرجى التحقق من الاتصال والصلاحيات.';
          showToast(errMsg, 'error');
        });

      return { success: true, item: newItem };
    },
    [items, units, categories, movements, branches, returns, persistChanges, showToast]
  );

  const updateItem = useCallback(
    (id: string, itemData: Partial<Omit<Item, 'id' | 'createdAt' | 'updatedAt'>>, reason?: string) => {
      const existing = items.find((i) => i.id === id);
      if (!existing) return { success: false, error: 'الصنف غير موجود' };

      const cleanReason = reason?.trim();
      if (!cleanReason) {
        return { success: false, error: 'يرجى إدخال سبب التعديل لحفظ التغييرات.' };
      }

      if (itemData.name) {
        const cleanName = itemData.name.trim();
        if (!cleanName) {
          return { success: false, error: 'اسم الصنف لا يمكن أن يكون فارغاً' };
        }
        const nameConflict = items.some(
          (i) => i.id !== id && (i?.name || '').trim().toLowerCase() === cleanName.toLowerCase()
        );
        if (nameConflict) {
          return { success: false, error: `يوجد صنف آخر مسجل مسبقاً بنفس الاسم "${cleanName}"` };
        }
      }

      if (itemData.code) {
        const cleanCode = itemData.code.trim();
        const codeConflict = items.some(
          (i) => i.id !== id && (i?.code || '').trim().toLowerCase() === cleanCode.toLowerCase()
        );
        if (codeConflict) {
          return { success: false, error: `رمز أو رقم الصنف "${cleanCode}" مسجل مسبقاً لصنف آخر` };
        }
      }

      // Check if base unit is changing when movements already exist
      if (itemData.baseUnitId && itemData.baseUnitId !== existing.baseUnitId) {
        const hasMovements = movements.some((m) => m.itemId === id);
        if (hasMovements) {
          return {
            success: false,
            error:
              'لا يمكن تغيير الوحدة الأساسية لهذا الصنف لوجود حركات مخزنية سابقة مسجلة بها؛ يمكنك ضبط التحويلات التابعة بدلاً من ذلك.',
          };
        }
      }

      // Check if conversions are changing when movements already exist
      if (itemData.conversions) {
         const hasMovements = movements.some((m) => m.itemId === id);
         if (hasMovements) {
           return {
             success: false,
             error: 'لا يمكن تعديل معاملات التحويل لوجود حركات مخزنية سابقة مرتبطة بالصنف.',
           };
         }
      }

      // Clean conversions
      let validConversions = existing.conversions;
      if (itemData.conversions) {
        const baseUnit = itemData.baseUnitId || existing.baseUnitId;
        const seenUnits = new Set<string>();
        validConversions = [];
        for (const conv of itemData.conversions) {
          if (conv.unitId === baseUnit) continue;
          if (seenUnits.has(conv.unitId)) continue;
          if (conv.factorToBase <= 0) continue;
          seenUnits.add(conv.unitId);
          validConversions.push({
            unitId: conv.unitId,
            factorToBase: Number(conv.factorToBase),
          });
        }
      }

      const updatedItem: Item = {
        ...existing,
        ...itemData,
        conversions: validConversions,
        editReason: cleanReason,
        updatedAt: new Date().toISOString(),
      };

      const updated = items.map((i) => (i.id === id ? updatedItem : i));
      setItems(updated);
      itemsRef.current = updated;
      // Auto-save: immediately write to Cloud Firestore
      FirestoreStorage.saveItem(updatedItem).catch((err) => {
        console.warn('Auto-save update item to Firestore deferred:', err);
      });
      FirestoreStorage.recordAuditLog({
        operationType: 'تعديل',
        entityType: 'صنف',
        entityId: id,
        entityName: updatedItem.name,
        reason: cleanReason,
        userName: OWNER_EMAIL,
        dataBefore: existing,
        dataAfter: updatedItem,
      }).catch((e) => console.warn(e));
      persistChanges(units, categories, updated, movements, branches, returns);
      showToast(`تم حفظ تعديلات الصنف "${updatedItem.name}" بنجاح`, 'success');
      return { success: true };
    },
    [items, movements, units, categories, branches, returns, persistChanges, showToast]
  );

  const archiveItem = useCallback(
    (id: string, reason?: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return { success: false, error: 'الصنف غير موجود' };

      const cleanReason = reason?.trim();
      if (!cleanReason) {
        return { success: false, error: 'يرجى كتابة سبب الأرشفة قبل المتابعة.' };
      }

      const updatedItem = { ...item, isArchived: true, archiveReason: cleanReason, updatedAt: new Date().toISOString() };
      const updated = items.map((i) => (i.id === id ? updatedItem : i));
      setItems(updated);
      itemsRef.current = updated;
      FirestoreStorage.saveItem(updatedItem).catch((e) => console.warn(e));
      FirestoreStorage.recordAuditLog({
        operationType: 'تعديل',
        entityType: 'صنف',
        entityId: id,
        entityName: item.name,
        reason: `أرشفة الصنف: ${cleanReason}`,
        userName: OWNER_EMAIL,
        dataBefore: item,
        dataAfter: updatedItem,
      }).catch((e) => console.warn(e));
      persistChanges(units, categories, updated, movements, branches, returns);
      showToast(`تم أرشفة الصنف "${item.name}" (السبب: ${cleanReason})`, 'info');
      return { success: true };
    },
    [items, units, categories, movements, branches, returns, persistChanges, showToast]
  );

  const restoreItem = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return { success: false, error: 'الصنف غير موجود' };

      const updatedItem = { ...item, isArchived: false, updatedAt: new Date().toISOString() };
      const updated = items.map((i) => (i.id === id ? updatedItem : i));
      setItems(updated);
      itemsRef.current = updated;
      FirestoreStorage.saveItem(updatedItem).catch((e) => console.warn(e));
      persistChanges(units, categories, updated, movements, branches, returns);
      showToast(`تم استعادة الصنف "${item.name}" من الأرشيف`, 'success');
      return { success: true };
    },
    [items, units, categories, movements, branches, returns, persistChanges, showToast]
  );

  const softDeleteItem = useCallback(
    (id: string, reason?: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return { success: false, error: 'الصنف غير موجود' };

      const cleanReason = reason?.trim();
      if (!cleanReason) {
        return { success: false, error: 'يرجى كتابة سبب الحذف قبل المتابعة.' };
      }

      const updatedItem = { ...item, isDeleted: true, deleteReason: cleanReason, updatedAt: new Date().toISOString() };
      const updated = items.map((i) => (i.id === id ? updatedItem : i));
      setItems(updated);
      itemsRef.current = updated;
      FirestoreStorage.saveItem(updatedItem).catch((e) => console.warn(e));
      FirestoreStorage.recordAuditLog({
        operationType: 'حذف',
        entityType: 'صنف',
        entityId: id,
        entityName: item.name,
        reason: cleanReason,
        userName: OWNER_EMAIL,
        dataBefore: item,
        dataAfter: null,
      }).catch((e) => console.warn(e));
      persistChanges(units, categories, updated, movements, branches, returns);
      showToast(`تم نقل الصنف "${item.name}" إلى سلة المحذوفات (السبب: ${cleanReason})`, 'info');
      return { success: true };
    },
    [items, units, categories, movements, branches, returns, persistChanges, showToast]
  );

  const restoreFromTrash = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return { success: false, error: 'الصنف غير موجود' };

      const updatedItem = { ...item, isDeleted: false, updatedAt: new Date().toISOString() };
      const updated = items.map((i) => (i.id === id ? updatedItem : i));
      setItems(updated);
      itemsRef.current = updated;
      FirestoreStorage.saveItem(updatedItem).catch((e) => console.warn(e));
      persistChanges(units, categories, updated, movements, branches, returns);
      showToast(`تمت استعادة الصنف "${item.name}" بنجاح`, 'success');
      return { success: true };
    },
    [items, units, categories, movements, branches, returns, persistChanges, showToast]
  );

  const permanentDeleteItem = useCallback(
    (id: string, reason?: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return { success: false, error: 'الصنف غير موجود' };

      const cleanReason = reason?.trim();
      if (!cleanReason) {
        return { success: false, error: 'يرجى كتابة سبب الحذف النهائي للمتابعة.' };
      }

      // Protection: movements can be kept or removed if zero stock, but keeping historical integrity is safer
      const itemMovements = movements.filter((m) => m.itemId === id);
      if (itemMovements.length > 0) {
        return {
          success: false,
          error: `لا يمكن الحذف النهائي للصنف "${item.name}" لوجود ${itemMovements.length} حركة مخزنية سابقة مرتبطة به لضمان سلامة السجلات المالية والمخزنية. يمكنك إبقاؤه في الأرشيف أو المحذوفات.`,
        };
      }

      const updatedItems = items.filter((i) => i.id !== id);
      setItems(updatedItems);
      try {
        FirestoreStorage.deleteItem(id, item.name).catch((e) => console.warn(e));
      } catch {}
      FirestoreStorage.recordAuditLog({
        operationType: 'حذف',
        entityType: 'صنف',
        entityId: id,
        entityName: item.name,
        reason: cleanReason,
        userName: OWNER_EMAIL,
        dataBefore: item,
        dataAfter: null,
      }).catch((e) => console.warn(e));
      persistChanges(units, categories, updatedItems, movements, branches, returns);
      showToast(`تم الحذف النهائي للصنف "${item.name}"`, 'success');
      return { success: true };
    },
    [items, movements, units, categories, branches, returns, persistChanges, showToast]
  );

  // STOCK MOVEMENTS
  const addMovement = useCallback(
    (data: {
      itemId: string;
      type: MovementType;
      unitId: string;
      quantity: number;
      date: string;
      referenceNumber?: string;
      notes?: string;
      destinationType?: 'DIRECT' | 'BRANCH' | 'CUSTOMER';
      branchId?: string;
      branchName?: string;
      customerName?: string;
      customerPhone?: string;
      customerCity?: string;
      shippingCompany?: ShippingCarrier;
      shippingTrackingNumber?: string;
      batchId?: string;
    }) => {
      const item = items.find((i) => i.id === data.itemId && !i.isDeleted);
      if (!item) return { success: false, error: 'الصنف المحدد غير موجود أو محذوف' };

      if (!data.quantity || data.quantity <= 0) {
        return { success: false, error: 'يرجى إدخال كمية صحيحة أكبر من الصفر' };
      }

      // Determine factor to base unit
      let factor = 1;
      if (data.unitId !== item.baseUnitId) {
        const conv = item.conversions.find((c) => c.unitId === data.unitId);
        if (!conv) {
          const selectedUnit = units.find((u) => u.id === data.unitId);
          return {
            success: false,
            error: `لم يتم تحديد تحويل معتمد للوحدة (${selectedUnit?.name || 'المختارة'}) لهذا الصنف. يرجى تعديل الصنف وإضافة معامل التحويل أولاً.`,
          };
        }
        factor = conv.factorToBase;
      }

      const baseQuantity = Math.round(data.quantity * factor * 1000) / 1000;
      const currentStock = getItemStock(data.itemId);
      const baseUnit = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';
      const movementUnit = units.find((u) => u.id === data.unitId)?.name || 'وحدة';

      // Negative balance guard for OUT
      if (data.type === 'OUT') {
        if (currentStock < baseQuantity || currentStock <= 0) {
          const errMsg = `عفواً، لا يمكن إتمام عملية الخروج: الكمية المطلوبة (${data.quantity} ${movementUnit} = ${baseQuantity} ${baseUnit}) تتجاوز الرصيد المتوفر حالياً (${currentStock} ${baseUnit}). نظام مدهال الطيب يمنع الرصيد السالب نهائياً!`;
          showToast(errMsg, 'error');
          return {
            success: false,
            error: errMsg,
          };
        }
      }

      const newMovement: StockMovement = {
        id: 'mov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        itemId: data.itemId,
        type: data.type,
        unitId: data.unitId,
        quantity: Number(data.quantity),
        factorApplied: factor,
        baseQuantity,
        date: data.date || new Date().toISOString(),
        referenceNumber: data.referenceNumber?.trim(),
        notes: data.notes?.trim(),
        destinationType: data.destinationType,
        branchId: data.branchId,
        branchName: data.branchName,
        customerName: data.customerName?.trim(),
        customerPhone: data.customerPhone?.trim(),
        customerCity: data.customerCity?.trim(),
        shippingCompany: data.shippingCompany,
        shippingTrackingNumber: data.shippingTrackingNumber?.trim(),
        batchId: data.batchId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedMovements = [newMovement, ...movements];
      setMovements(updatedMovements);
      movementsRef.current = updatedMovements;
      // Auto-save movement directly to Cloud Firestore immediately
      FirestoreStorage.saveMovement(newMovement).catch((err) => {
        console.warn('Auto-save movement to Firestore deferred:', err);
      });
      persistChanges(units, categories, items, updatedMovements, branches, returns);

      const actionText = data.type === 'IN' ? 'تسجيل دخول' : 'تسجيل خروج';
      showToast(`تم ${actionText} ${data.quantity} ${movementUnit} للصنف "${item.name}" بنجاح`, 'success');
      return { success: true };
    },
    [items, units, categories, movements, branches, returns, getItemStock, persistChanges, showToast]
  );

  // Multi-item Outgoing Dispatch (Export to branch or Customer with SMSA / Fastlo / Aramex)
  const addMultiItemDispatch = useCallback(
    (dispatchData: {
      destinationType: 'BRANCH' | 'CUSTOMER';
      branchId?: string;
      branchName?: string;
      customerName?: string;
      customerPhone?: string;
      customerCity?: string;
      destinationContactName?: string;
      destinationPhone?: string;
      destinationAddress?: string;
      shippingCompany?: ShippingCarrier;
      customShippingCompany?: string;
      shippingTrackingNumber?: string;
      referenceNumber?: string;
      notes?: string;
      date: string;
      items: {
        itemId: string;
        unitId: string;
        quantity: number;
        notes?: string;
      }[];
    }) => {
      if (!dispatchData.items || dispatchData.items.length === 0) {
        return { success: false, error: 'يرجى إضافة صنف واحد على الأقل في أمر التصدير' };
      }

      if (dispatchData.destinationType === 'BRANCH' && !dispatchData.branchId) {
        return { success: false, error: 'يرجى تحديد الفرع المراد التصدير إليه' };
      }

      if (dispatchData.destinationType === 'CUSTOMER' && !dispatchData.customerName?.trim()) {
        return { success: false, error: 'يرجى إدخال اسم العميل للشحنة' };
      }

      // Check stock availability for all items before applying any changes
      const calculatedEntries: {
        item: Item;
        unitId: string;
        quantity: number;
        factor: number;
        baseQuantity: number;
        notes?: string;
      }[] = [];

      const cumulativePerItem: Record<string, number> = {};

      for (const entry of dispatchData.items) {
        const item = items.find((i) => i.id === entry.itemId && !i.isDeleted);
        if (!item) {
          const errMsg = 'أحد الأصناف المحددة غير موجود أو تم حذفه';
          showToast(errMsg, 'error');
          return { success: false, error: errMsg };
        }
        if (entry.quantity <= 0) {
          const errMsg = `الكمية المدخلة للصنف "${item.name}" يجب أن تكون أكبر من الصفر`;
          showToast(errMsg, 'error');
          return { success: false, error: errMsg };
        }

        let factor = 1;
        if (entry.unitId !== item.baseUnitId) {
          const conv = item.conversions.find((c) => c.unitId === entry.unitId);
          if (!conv) {
            const u = units.find((un) => un.id === entry.unitId);
            const errMsg = `الوحدة (${u?.name || 'المختارة'}) ليس لها معامل تحويل معتمد للصنف "${item.name}"`;
            showToast(errMsg, 'error');
            return {
              success: false,
              error: errMsg,
            };
          }
          factor = conv.factorToBase;
        }

        const baseQuantity = Math.round(entry.quantity * factor * 1000) / 1000;
        cumulativePerItem[item.id] = Math.round(((cumulativePerItem[item.id] || 0) + baseQuantity) * 1000) / 1000;

        const currentStock = getItemStock(item.id);
        const baseUnit = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';
        
        if (currentStock < cumulativePerItem[item.id] || currentStock <= 0) {
          const errMsg = `عفواً، لا يمكن إتمام التصدير: إجمالي الكمية المطلوبة للصنف "${item.name}" (${cumulativePerItem[item.id]} ${baseUnit}) تتجاوز الرصيد المتوفر (${currentStock} ${baseUnit}). يمنع النظام تماماً الأرصدة السالبة!`;
          showToast(errMsg, 'error');
          return {
            success: false,
            error: errMsg,
          };
        }

        calculatedEntries.push({
          item,
          unitId: entry.unitId,
          quantity: entry.quantity,
          factor,
          baseQuantity,
          notes: entry.notes,
        });
      }

      // All verified! Generate voucher and batch
      const batchId = 'batch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const voucherNo =
        dispatchData.referenceNumber?.trim() ||
        `DSP-${new Date().getFullYear()}-${(movements.length + 1).toString().padStart(4, '0')}`;
      const nowIso = new Date().toISOString();

      const targetBranch = dispatchData.destinationType === 'BRANCH'
        ? branches.find((b) => b.id === dispatchData.branchId)
        : undefined;

      const destinationContact = dispatchData.destinationType === 'BRANCH'
        ? (dispatchData.destinationContactName?.trim() || targetBranch?.branchManagerName || targetBranch?.managerName || targetBranch?.name)
        : dispatchData.customerName?.trim();

      const destinationPhone = dispatchData.destinationType === 'BRANCH'
        ? (dispatchData.destinationPhone?.trim() || targetBranch?.branchManagerPhone || targetBranch?.phone)
        : dispatchData.customerPhone?.trim();

      const destinationAddress = dispatchData.destinationType === 'BRANCH'
        ? (dispatchData.destinationAddress?.trim() || targetBranch?.city || targetBranch?.address)
        : dispatchData.customerCity?.trim();

      const destinationName = dispatchData.destinationType === 'BRANCH'
        ? (dispatchData.branchName || targetBranch?.name)
        : dispatchData.customerName?.trim();

      const newMovements: StockMovement[] = calculatedEntries.map((e) => ({
        id: 'mov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        itemId: e.item.id,
        type: 'OUT',
        unitId: e.unitId,
        quantity: e.quantity,
        factorApplied: e.factor,
        baseQuantity: e.baseQuantity,
        date: dispatchData.date || nowIso,
        referenceNumber: voucherNo,
        notes: e.notes || dispatchData.notes?.trim(),
        destinationType: dispatchData.destinationType,
        destinationName,
        destinationContactName: destinationContact,
        destinationPhone,
        destinationAddress,
        branchId: dispatchData.branchId,
        branchName: destinationName,
        customerName: dispatchData.customerName?.trim(),
        customerPhone: destinationPhone,
        customerCity: destinationAddress,
        shippingCompany: dispatchData.shippingCompany,
        customShippingCompany: dispatchData.customShippingCompany?.trim(),
        shippingTrackingNumber: dispatchData.shippingTrackingNumber?.trim(),
        batchId,
        createdAt: nowIso,
        updatedAt: nowIso,
      }));

      const updatedMovements = [...newMovements, ...movements];
      setMovements(updatedMovements);
      movementsRef.current = updatedMovements;
      newMovements.forEach((m) => {
        FirestoreStorage.saveMovement(m).catch((e) => console.warn(e));
      });
      persistChanges(units, categories, items, updatedMovements, branches, returns);

      const targetDesc =
        dispatchData.destinationType === 'BRANCH'
          ? `الفرع (${dispatchData.branchName})`
          : `العميل (${dispatchData.customerName})`;
      showToast(`تم تصدير ${calculatedEntries.length} أصناف بنجاح إلى ${targetDesc} (رقم السند: ${voucherNo})`, 'success');

      return { success: true, voucherNumber: voucherNo, movements: newMovements };
    },
    [items, units, categories, movements, branches, returns, getItemStock, persistChanges, showToast]
  );

  const updateMovement = useCallback(
    (
      id: string,
      data: {
        unitId: string;
        quantity: number;
        type: MovementType;
        date: string;
        referenceNumber?: string;
        notes?: string;
      }
    ) => {
      const existing = movements.find((m) => m.id === id);
      if (!existing) return { success: false, error: 'الحركة غير موجودة' };

      const item = items.find((i) => i.id === existing.itemId);
      if (!item) return { success: false, error: 'الصنف المرتبط بالحركة غير موجود' };

      if (!data.quantity || data.quantity <= 0) {
        return { success: false, error: 'يرجى إدخال كمية صحيحة أكبر من الصفر' };
      }

      // Determine factor
      let factor = 1;
      if (data.unitId !== item.baseUnitId) {
        const conv = item.conversions.find((c) => c.unitId === data.unitId);
        if (!conv) {
          const selectedUnit = units.find((u) => u.id === data.unitId);
          return {
            success: false,
            error: `لم يتم تحديد تحويل معتمد للوحدة (${selectedUnit?.name || 'المختارة'}) لهذا الصنف.`,
          };
        }
        factor = conv.factorToBase;
      }

      const newBaseQuantity = Math.round(data.quantity * factor * 1000) / 1000;

      // Integrity Check: Calculate new balance if this edit is applied
      // 1. Remove old movement's effect
      const currentStock = getItemStock(item.id);
      let stockWithoutThisMovement = currentStock;
      if (existing.type === 'IN') {
        stockWithoutThisMovement -= existing.baseQuantity;
      } else {
        stockWithoutThisMovement += existing.baseQuantity;
      }

      // 2. Add new movement's effect
      let resultingStock = stockWithoutThisMovement;
      if (data.type === 'IN') {
        resultingStock += newBaseQuantity;
      } else {
        resultingStock -= newBaseQuantity;
      }

      resultingStock = Math.round(resultingStock * 1000) / 1000;

      if (resultingStock < 0) {
        const baseUnit = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';
        return {
          success: false,
          error: `لا يمكن تعديل الحركة: هذا التعديل سيتسبب في رصيد سالب (${resultingStock} ${baseUnit}) للصنف "${item.name}".`,
        };
      }

      const updatedMovement: StockMovement = {
        ...existing,
        unitId: data.unitId,
        quantity: Number(data.quantity),
        type: data.type,
        factorApplied: factor,
        baseQuantity: newBaseQuantity,
        date: data.date,
        referenceNumber: data.referenceNumber?.trim(),
        notes: data.notes?.trim(),
        updatedAt: new Date().toISOString(),
      };

      const updatedMovements = movements.map((m) => (m.id === id ? updatedMovement : m));
      setMovements(updatedMovements);
      movementsRef.current = updatedMovements;
      // Auto-save updated movement directly to Cloud Firestore
      FirestoreStorage.saveMovement(updatedMovement).catch((err) => {
        console.warn('Auto-save update movement to Firestore deferred:', err);
      });
      FirestoreStorage.recordAuditLog({
        operationType: 'تعديل',
        entityType: 'حركة مخزنية',
        entityId: id,
        entityName: `${item.name} (${updatedMovement.type === 'IN' ? 'وارد' : 'صادر'})`,
        reason: data.notes?.trim() || 'تعديل كمية/بيانات الحركة المخزنية',
        userName: OWNER_EMAIL,
        dataBefore: existing,
        dataAfter: updatedMovement,
      }).catch((e) => console.warn(e));
      persistChanges(units, categories, items, updatedMovements, branches, returns);
      showToast(`تم تعديل الحركة بنجاح`, 'success');
      return { success: true };
    },
    [movements, items, units, categories, branches, returns, getItemStock, persistChanges, showToast]
  );

  const deleteMovement = useCallback(
    (id: string, reason?: string) => {
      const existing = movements.find((m) => m.id === id);
      if (!existing) return { success: false, error: 'الحركة غير موجودة' };

      const item = items.find((i) => i.id === existing.itemId);
      if (!item) return { success: false, error: 'الصنف غير موجود' };

      // If deleting an IN movement, stock will decrease. Verify it doesn't cause negative stock!
      if (existing.type === 'IN') {
        const currentStock = getItemStock(item.id);
        const resultingStock = Math.round((currentStock - existing.baseQuantity) * 1000) / 1000;
        if (resultingStock < 0) {
          const baseUnit = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';
          return {
            success: false,
            error: `لا يمكن حذف حركة الدخول: الكمية تم صرفها بالفعل في حركات لاحقة، وحذفها سيؤدي إلى رصيد سالب (${resultingStock} ${baseUnit}).`,
          };
        }
      }

      const updatedMovements = movements.filter((m) => m.id !== id);
      setMovements(updatedMovements);
      try {
        FirestoreStorage.deleteMovement(id).catch((e) => console.warn(e));
      } catch {}
      FirestoreStorage.recordAuditLog({
        operationType: 'حذف',
        entityType: 'حركة مخزنية',
        entityId: id,
        entityName: `${item.name} - ${existing.referenceNumber || existing.id}`,
        reason: reason?.trim() || existing.notes || 'حذف الحركة المخزنية وتعديل الرصيد',
        userName: OWNER_EMAIL,
        dataBefore: existing,
        dataAfter: null,
      }).catch((e) => console.warn(e));
      persistChanges(units, categories, items, updatedMovements, branches, returns);
      showToast(`تم حذف الحركة بنجاح مع تحديث الرصيد`, 'success');
      return { success: true };
    },
    [movements, items, units, categories, branches, returns, getItemStock, persistChanges, showToast]
  );

  // RETURNS ACTIONS
  const addReturn = useCallback(
    (returnData: {
      type: ReturnType;
      status: ReturnStatus;
      date: string;
      destinationType?: 'BRANCH' | 'CUSTOMER' | 'SUPPLIER';
      branchId?: string;
      branchName?: string;
      partyName?: string;
      partyPhone?: string;
      originalReferenceNumber?: string;
      originalMovementId?: string;
      reason: ReturnReason;
      reasonDescription?: string;
      notes?: string;
      items: {
        itemId: string;
        unitId: string;
        quantity: number;
        notes?: string;
        originalMovementId?: string;
      }[];
    }) => {
      const calculatedItems: ReturnItemEntry[] = [];
      const linkedMovementIds: string[] = [];
      const newMovements: StockMovement[] = [];
      const returnNumber = 'RET-' + Math.floor(100000 + Math.random() * 900000);
      const returnId = 'ret_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const now = new Date().toISOString();

      for (const entry of returnData.items) {
        const item = items.find((i) => i.id === entry.itemId && !i.isDeleted);
        if (!item) return { success: false, error: 'أحد الأصناف المحددة غير موجود أو محذوف' };

        if (!entry.quantity || entry.quantity <= 0) {
          return { success: false, error: 'يرجى إدخال كمية صحيحة أكبر من الصفر لجميع الأصناف' };
        }

        let factor = 1;
        if (entry.unitId !== item.baseUnitId) {
          const conv = item.conversions.find((c) => c.unitId === entry.unitId);
          if (!conv) {
            const selectedUnit = units.find((u) => u.id === entry.unitId);
            return {
              success: false,
              error: `لم يتم تحديد تحويل معتمد للوحدة (${selectedUnit?.name || 'المختارة'}) للصنف "${item.name}".`,
            };
          }
          factor = conv.factorToBase;
        }

        const baseQuantity = Math.round(entry.quantity * factor * 1000) / 1000;

        if (returnData.status === 'APPROVED' && returnData.type === 'RETURN_OUT') {
          const currentStock = getItemStock(entry.itemId);
          if (currentStock < baseQuantity) {
            const baseUnitName = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';
            const msg = `عفواً، لا يمكن إتمام المرتجع الصادر: الكمية المطلوبة للصنف "${item.name}" تتجاوز الرصيد المتوفر (${currentStock} ${baseUnitName}). نظام مدهال الطيب يمنع الرصيد السالب نهائياً!`;
            showToast(msg, 'error');
            return { success: false, error: msg };
          }
        }

        calculatedItems.push({
          itemId: entry.itemId,
          unitId: entry.unitId,
          quantity: Number(entry.quantity),
          factorApplied: factor,
          baseQuantity,
          notes: entry.notes?.trim(),
          originalMovementId: entry.originalMovementId,
        });

        if (returnData.status === 'APPROVED') {
          const movId = 'mov_ret_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          const movType: MovementType = returnData.type === 'RETURN_IN' ? 'IN' : 'OUT';
          const newMov: StockMovement = {
            id: movId,
            itemId: entry.itemId,
            type: movType,
            unitId: entry.unitId,
            quantity: Number(entry.quantity),
            factorApplied: factor,
            baseQuantity,
            date: returnData.date || now,
            referenceNumber: returnData.originalReferenceNumber || returnNumber,
            notes: `سند مرتجع رقم ${returnNumber} - ${returnData.reason}`,
            destinationType: returnData.destinationType === 'BRANCH' ? 'BRANCH' : returnData.destinationType === 'CUSTOMER' ? 'CUSTOMER' : 'DIRECT',
            branchId: returnData.branchId,
            branchName: returnData.branchName,
            customerName: returnData.partyName,
            customerPhone: returnData.partyPhone,
            createdAt: now,
            updatedAt: now,
          };
          newMovements.push(newMov);
          linkedMovementIds.push(movId);
        }
      }

      const newReturnRecord: ReturnRecord = {
        id: returnId,
        returnNumber,
        type: returnData.type,
        status: returnData.status,
        date: returnData.date || now,
        destinationType: returnData.destinationType,
        branchId: returnData.branchId,
        branchName: returnData.branchName,
        partyName: returnData.partyName?.trim(),
        partyPhone: returnData.partyPhone?.trim(),
        originalReferenceNumber: returnData.originalReferenceNumber?.trim(),
        originalMovementId: returnData.originalMovementId,
        reason: returnData.reason,
        reasonDescription: returnData.reasonDescription?.trim(),
        notes: returnData.notes?.trim(),
        items: calculatedItems,
        linkedMovementIds,
        createdByName: 'مدير النظام',
        approvedAt: returnData.status === 'APPROVED' ? now : undefined,
        approvedByName: returnData.status === 'APPROVED' ? 'مدير النظام' : undefined,
        createdAt: now,
        updatedAt: now,
      };

      const updatedReturns = [newReturnRecord, ...returns];
      const updatedMovements = [...newMovements, ...movements];

      setReturns(updatedReturns);
      setMovements(updatedMovements);
      returnsRef.current = updatedReturns;
      movementsRef.current = updatedMovements;

      FirestoreStorage.saveReturn(newReturnRecord).catch((e) => console.warn(e));
      newMovements.forEach((m) => FirestoreStorage.saveMovement(m).catch((e) => console.warn(e)));
      persistChanges(units, categories, items, updatedMovements, branches, updatedReturns);

      showToast(`تم تسجيل سند المرتجع #${returnNumber} بنجاح`, 'success');
      return { success: true, returnId, returnNumber };
    },
    [items, units, movements, branches, returns, getItemStock, persistChanges, showToast]
  );

  const approveReturn = useCallback(
    (id: string) => {
      const target = returns.find((r) => r.id === id);
      if (!target) return { success: false, error: 'سند المرتجع غير موجود' };
      if (target.status === 'APPROVED') return { success: false, error: 'السند معتمد مسبقاً' };
      if (target.status === 'CANCELLED') return { success: false, error: 'لا يمكن اعتماد سند ملغي' };

      const now = new Date().toISOString();
      const newMovements: StockMovement[] = [];
      const linkedMovementIds: string[] = [];

      for (const entry of target.items) {
        const item = items.find((i) => i.id === entry.itemId);
        if (!item) return { success: false, error: 'صنف في السند غير موجود' };

        if (target.type === 'RETURN_OUT') {
          const currentStock = getItemStock(entry.itemId);
          if (currentStock < entry.baseQuantity) {
            return {
              success: false,
              error: `تعذر الاعتماد: الكمية المطلوبة للصنف "${item.name}" تتجاوز الرصيد المتوفر (${currentStock}).`,
            };
          }
        }

        const movId = 'mov_ret_app_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const movType: MovementType = target.type === 'RETURN_IN' ? 'IN' : 'OUT';
        const newMov: StockMovement = {
          id: movId,
          itemId: entry.itemId,
          type: movType,
          unitId: entry.unitId,
          quantity: entry.quantity,
          factorApplied: entry.factorApplied,
          baseQuantity: entry.baseQuantity,
          date: now,
          referenceNumber: target.originalReferenceNumber || target.returnNumber,
          notes: `اعتماد سند مرتجع رقم ${target.returnNumber} - ${target.reason}`,
          destinationType: target.destinationType === 'BRANCH' ? 'BRANCH' : 'CUSTOMER',
          branchId: target.branchId,
          branchName: target.branchName,
          customerName: target.partyName,
          customerPhone: target.partyPhone,
          createdAt: now,
          updatedAt: now,
        };
        newMovements.push(newMov);
        linkedMovementIds.push(movId);
      }

      const updatedRecord: ReturnRecord = {
        ...target,
        status: 'APPROVED',
        linkedMovementIds,
        approvedAt: now,
        approvedByName: 'مدير النظام',
        updatedAt: now,
      };

      const updatedReturns = returns.map((r) => (r.id === id ? updatedRecord : r));
      const updatedMovements = [...newMovements, ...movements];

      setReturns(updatedReturns);
      setMovements(updatedMovements);
      persistChanges(units, categories, items, updatedMovements, branches, updatedReturns);

      showToast(`تم اعتماد سند المرتجع #${target.returnNumber} وتحديث المخزون بنجاح`, 'success');
      return { success: true };
    },
    [returns, items, units, movements, branches, getItemStock, persistChanges, showToast]
  );

  const cancelReturn = useCallback(
    (id: string, cancellationReason?: string) => {
      const target = returns.find((r) => r.id === id);
      if (!target) return { success: false, error: 'سند المرتجع غير موجود' };
      if (target.status === 'CANCELLED') return { success: false, error: 'السند ملغي مسبقاً' };

      const now = new Date().toISOString();
      const reversalMovements: StockMovement[] = [];
      const reversalMovementIds: string[] = [];

      if (target.status === 'APPROVED') {
        for (const entry of target.items) {
          const item = items.find((i) => i.id === entry.itemId);
          if (!item) continue;

          const counterType: MovementType = target.type === 'RETURN_IN' ? 'OUT' : 'IN';

          if (counterType === 'OUT') {
            const currentStock = getItemStock(entry.itemId);
            if (currentStock < entry.baseQuantity) {
              return {
                success: false,
                error: `تعذر الإلغاء: الكمية المراد سحبها عكسياً للصنف "${item.name}" غير متوفرة حالياً في الرصيد (${currentStock}).`,
              };
            }
          }

          const movId = 'mov_rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          const revMov: StockMovement = {
            id: movId,
            itemId: entry.itemId,
            type: counterType,
            unitId: entry.unitId,
            quantity: entry.quantity,
            factorApplied: entry.factorApplied,
            baseQuantity: entry.baseQuantity,
            date: now,
            referenceNumber: `REV-${target.returnNumber}`,
            notes: `حركة عكسية لإلغاء سند المرتجع #${target.returnNumber} (${cancellationReason || 'بدون سبب'})`,
            createdAt: now,
            updatedAt: now,
          };
          reversalMovements.push(revMov);
          reversalMovementIds.push(movId);
        }
      }

      const updatedRecord: ReturnRecord = {
        ...target,
        status: 'CANCELLED',
        reversalMovementIds,
        cancelledAt: now,
        cancelledByName: 'مدير النظام',
        cancellationReason: cancellationReason?.trim() || 'إلغاء يدوي',
        updatedAt: now,
      };

      const updatedReturns = returns.map((r) => (r.id === id ? updatedRecord : r));
      const updatedMovements = [...reversalMovements, ...movements];

      setReturns(updatedReturns);
      setMovements(updatedMovements);
      FirestoreStorage.recordAuditLog({
        operationType: 'تعديل',
        entityType: 'مرتجع',
        entityId: id,
        entityName: `سند مرتجع #${target.returnNumber}`,
        reason: cancellationReason?.trim() || 'إلغاء سند المرتجع وتطبيق حركات عكسية',
        userName: OWNER_EMAIL,
        dataBefore: target,
        dataAfter: updatedRecord,
      }).catch((e) => console.warn(e));
      persistChanges(units, categories, items, updatedMovements, branches, updatedReturns);

      showToast(`تم إلغاء سند المرتجع #${target.returnNumber} بنجاح وتطبيق الحركة العكسية`, 'success');
      return { success: true };
    },
    [returns, items, units, movements, branches, getItemStock, persistChanges, showToast]
  );

  const deleteReturnRecord = useCallback(
    (id: string, reason?: string) => {
      const target = returns.find((r) => r.id === id);
      if (!target) return { success: false, error: 'السند غير موجود' };
      if (target.status === 'APPROVED') {
        return { success: false, error: 'لا يمكن حذف سند معتمد مباشرة، يرجى إلغاؤه أولاً للحفاظ على سلامة سجل التدقيق.' };
      }

      const updatedReturns = returns.filter((r) => r.id !== id);
      setReturns(updatedReturns);
      try {
        FirestoreStorage.deleteReturn(id).catch((e) => console.warn(e));
      } catch {}
      FirestoreStorage.recordAuditLog({
        operationType: 'حذف',
        entityType: 'مرتجع',
        entityId: id,
        entityName: `مسودة مرتجع #${target.returnNumber}`,
        reason: reason?.trim() || 'حذف مسودة سند المرتجع',
        userName: OWNER_EMAIL,
        dataBefore: target,
        dataAfter: null,
      }).catch((e) => console.warn(e));
      persistChanges(units, categories, items, movements, branches, updatedReturns);
      showToast('تم حذف مسودة المرتجع بنجاح', 'success');
      return { success: true };
    },
    [returns, units, categories, items, movements, branches, persistChanges, showToast]
  );

  // BACKUP & IMPORT
  const exportDataJSON = useCallback(() => {
    return StorageService.exportDatabaseJSON();
  }, []);

  const importDataJSON = useCallback(
    async (jsonStr: string) => {
      try {
        const imported = await StorageService.importDatabaseJSON(jsonStr);
        setUnits(imported.units);
        setCategories(imported.categories);
        setItems(imported.items);
        setMovements(imported.movements);
        setBranches(imported.branches || []);
        setReturns(imported.returns || []);
        showToast('تم استيراد قاعدة البيانات بنجاح واستعادة جميع السجلات بما فيها المرتجعات', 'success');
        return { success: true };
      } catch (err: any) {
        showToast(err.message || 'فشل الاستيراد', 'error');
        return { success: false, error: err.message };
      }
    },
    [showToast]
  );

  const clearDatabase = useCallback(async () => {
    await StorageService.clearAll();
    setUnits([]);
    setCategories([]);
    setItems([]);
    setMovements([]);
    setBranches([]);
    setReturns([]);
    showToast('تم مسح قاعدة البيانات بالكامل', 'info');
  }, [showToast]);

  // Zero stock and reset movements while preserving items, units, categories, and branches
  const zeroStockAndResetOperations = useCallback(async () => {
    // 1. Delete all movements & returns from Cloud Firestore online
    try {
      await Promise.all([
        FirestoreStorage.deleteAllMovements(),
        FirestoreStorage.deleteAllReturns(),
      ]);
    } catch (err) {
      console.warn('Error deleting movements/returns in Cloud Firestore:', err);
    }

    // 2. Clear operations from LocalStorage and IndexedDB
    await StorageService.clearOperationsOnly();

    // 3. Clear movements and returns in React state
    setMovements([]);
    setReturns([]);
    movementsRef.current = [];
    returnsRef.current = [];

    // 4. Update items so every item is ensured 0 quantity
    const zeroedItems = items.map((i) => ({
      ...i,
      currentQuantity: 0,
      openingBalance: 0,
      updatedAt: new Date().toISOString(),
    }));
    setItems(zeroedItems);
    itemsRef.current = zeroedItems;

    // 5. Update local cache
    await StorageService.saveAll({
      units,
      categories,
      items: zeroedItems,
      movements: [],
      branches,
      returns: [],
    });

    await refreshAuditLogs();
    showToast(
      'تم تصفير المخزون بالكامل وحذف جميع حركات الوارد والصادر بنجاح؛ رصيد جميع الأصناف حالياً (0) ومتطابق على الجوال والجهاز.',
      'success'
    );
  }, [units, categories, items, branches, refreshAuditLogs, showToast]);

  // Clean system initialization: Standard units preserved, zero items, zero movements, zero branches, zero returns
  const initializeCleanSystem = useCallback(async () => {
    const now = new Date().toISOString();
    const standardUnits: Unit[] = SYSTEM_DEFAULT_UNITS.map((def) => ({
      id: 'unit_' + def.name + '_' + Math.random().toString(36).substring(2, 7),
      name: def.name,
      symbol: def.symbol,
      description: def.description,
      createdAt: now,
    }));

    await StorageService.saveAll({
      units: standardUnits,
      categories: [],
      items: [],
      movements: [],
      branches: [],
      returns: [],
    });

    setUnits(standardUnits);
    setCategories([]);
    setItems([]);
    setMovements([]);
    setBranches([]);
    setReturns([]);
    showToast('تمت التهيئة الرسمية للنظام بنجاح: النظام جاهز لإدخال الأصناف والكميات الحقيقية', 'success');
  }, [showToast]);

  // Cloud Snapshots Creation & Restoration
  const createCloudSnapshot = useCallback(
    async (name?: string) => {
      try {
        const backupName = name?.trim() || `نسخة احتياطية ${new Date().toLocaleString('ar-SA')}`;
        const record = await FirestoreStorage.createCloudBackup(backupName, {
          units,
          categories,
          items,
          movements,
          branches,
          returns,
        });
        await refreshCloudBackups();
        showToast(`تم حفظ النسخة الاحتياطية السحابية بنجاح (${record.itemCount} أصناف)`, 'success');
        return { success: true, backupId: record.id };
      } catch (err: any) {
        showToast('تعذر إنشاء النسخة السحابية، يرجى المحاولة مرة أخرى', 'error');
        return { success: false };
      }
    },
    [units, categories, items, movements, branches, returns, refreshCloudBackups, showToast]
  );

  const restoreCloudSnapshot = useCallback(
    async (backupId: string) => {
      try {
        const target = cloudBackups.find((b) => b.id === backupId);
        if (!target || !target.data) {
          return { success: false, error: 'النسخة الاحتياطية غير موجودة أو تالفة' };
        }

        const data = target.data;
        if (!Array.isArray(data.items) || !Array.isArray(data.categories)) {
          return { success: false, error: 'بيانات النسخة الاحتياطية غير صالحة' };
        }

        // Automatic safety snapshot of current live state before overwriting
        try {
          await FirestoreStorage.createCloudBackup(
            `نسخة أمان سريعة (قبل استعادة: ${target.name})`,
            {
              units,
              categories,
              items,
              movements,
              branches,
              returns,
            }
          );
        } catch (e) {
          console.warn('Could not save pre-restore safety backup:', e);
        }

        setUnits(data.units || []);
        setCategories(data.categories || []);
        setItems(data.items || []);
        setMovements(data.movements || []);
        setBranches(data.branches || []);
        setReturns(data.returns || []);

        await persistChanges(
          data.units || [],
          data.categories || [],
          data.items || [],
          data.movements || [],
          data.branches || [],
          data.returns || []
        );

        await FirestoreStorage.recordAuditLog('RESTORE_BACKUP', 'backup', backupId, `استعادة النسخة: ${target.name}`);
        await refreshAuditLogs();

        showToast(`تم استرجاع النسخة بنجاح: ${target.name} (${data.items.length} أصناف)`, 'success');
        return { success: true };
      } catch (err: any) {
        showToast('تعذر استرجاع النسخة، يرجى المحاولة مرة أخرى', 'error');
        return { success: false, error: 'تعذر استرجاع النسخة' };
      }
    },
    [cloudBackups, persistChanges, refreshAuditLogs, showToast]
  );

  const value = {
    units,
    categories,
    items,
    movements,
    branches,
    returns,
    customers,
    companySettings,
    isLoading,
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
    toast,
    showToast,
    clearToast,

    addBranch,
    updateBranch,
    deleteBranch,
    clearAllBranches,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    saveCompanySettings,
    addMultiItemDispatch,

    addUnit,
    updateUnit,
    deleteUnit,
    seedCommonUnits,

    addCategory,
    updateCategory,
    deleteCategory,

    addItem,
    updateItem,
    archiveItem,
    restoreItem,
    softDeleteItem,
    restoreFromTrash,
    permanentDeleteItem,

    addMovement,
    updateMovement,
    deleteMovement,

    addReturn,
    approveReturn,
    cancelReturn,
    deleteReturnRecord,

    getItemStock,
    getItemStockSummary,
    getAllItemsSummary,
    getUnitConversionFactor,
    stats,

    exportDataJSON,
    importDataJSON,
    clearDatabase,
    zeroStockAndResetOperations,
    initializeCleanSystem,
  };

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
