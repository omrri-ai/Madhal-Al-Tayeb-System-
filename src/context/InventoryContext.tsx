import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Branch,
  Category,
  CompanySettings,
  Customer,
  DamagedRecord,
  DamagedRecoveryEntry,
  DamagedSection,
  InventoryStats,
  Item,
  ItemStockSummary,
  MovementType,
  ProductionOrder,
  ProductionDispatchRecord,
  ProductionReceiptRecord,
  ProductionReturnRecord,
  ProductionConsumptionRecord,
  ProductionOrderFinishedGood,
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
import { StorageService, isGenuineItem, isPurgedMovement, normalizeItem } from '../services/storage';
import {
  FirestoreStorage,
  AuditLogEntry,
  CloudBackupRecord,
} from '../services/firestoreStorage';
import { OWNER_EMAIL } from '../services/firebase';
import { useAuth } from './AuthContext';
import { deduplicateById } from '../utils/arabicSearch';
import {
  computeAllBalances,
  canWithdraw,
  signedBaseQty,
  getMovementStockEffect,
  getUnsignedBaseQuantity,
  normalizeMovementType,
} from '../utils/stockRules';


interface InventoryContextType {
  // State
  units: Unit[];
  categories: Category[];
  items: Item[];
  movements: StockMovement[];
  branches: Branch[];
  returns: ReturnRecord[];
  productionOrders: ProductionOrder[];
  damagedRecords: DamagedRecord[];
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
  updateItem: (id: string, itemData: Partial<Omit<Item, 'id' | 'createdAt' | 'updatedAt'>>, reason?: string) => { success: boolean; error?: string; item?: Item };
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
  }) => Promise<{ success: boolean; error?: string }>;
  
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
  }) => Promise<{ success: boolean; error?: string; voucherNumber?: string; movements?: StockMovement[] }>;

  updateMultiItemDispatch: (
    voucherRefOrBatch: string,
    dispatchData: {
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
      editReason: string;
      date: string;
      items: {
        itemId: string;
        unitId: string;
        quantity: number;
        notes?: string;
      }[];
    }
  ) => { success: boolean; error?: string; voucherNumber?: string; movements?: StockMovement[] };

  updateMovement: (id: string, movementData: {
    unitId: string;
    quantity: number;
    type: MovementType;
    date: string;
    referenceNumber?: string;
    notes?: string;
  }) => { success: boolean; error?: string };
  deleteMovement: (id: string, reason?: string) => { success: boolean; error?: string };
  adjustItemStock: (data: {
    itemId: string;
    newStock: number;
    reason: string;
    unitId?: string;
    isSilent?: boolean;
    isHidden?: boolean;
  }) => { success: boolean; error?: string };
  adjustStockSilently: (itemId: string, newTargetStock: number, reason?: string) => { success: boolean; error?: string };

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

  // Production Orders actions
  createProductionOrder: (data: {
    title: string;
    targetItemId?: string | null;
    targetUnitId?: string | null;
    plannedQuantity?: number;
    date: string;
    notes?: string | null;
  }) => Promise<{ success: boolean; order?: ProductionOrder; error?: string }>;
  dispatchMaterialToProduction: (data: {
    productionOrderId: string;
    date: string;
    items: { itemId: string; unitId: string; quantity: number; notes?: string }[];
    notes?: string;
  }) => Promise<{ success: boolean; voucher?: ProductionDispatchRecord; error?: string }>;
  recordProductionConsumption: (data: {
    productionOrderId: string;
    date: string;
    items: { itemId: string; unitId: string; quantity: number; scrapQuantity?: number; scrapReason?: string; notes?: string }[];
    completedGoodsQuantity?: number;
    notes?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  receiveFinishedGoodsFromProduction: (data: {
    productionOrderId: string;
    date: string;
    quantity: number;
    unitId: string;
    notes?: string;
  }) => Promise<{ success: boolean; voucher?: ProductionReceiptRecord; error?: string }>;
  returnMaterialFromProduction: (data: {
    productionOrderId: string;
    date: string;
    items: { itemId: string; unitId: string; quantity: number; notes?: string }[];
    notes?: string;
  }) => Promise<{ success: boolean; voucher?: ProductionReturnRecord; error?: string }>;
  cancelProductionOrder: (orderId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  deleteProductionOrder: (orderId: string, reason: string) => Promise<{ success: boolean; error?: string }>;

  // Damaged Records
  addDamagedRecord: (data: {
    section: DamagedSection;
    itemId: string;
    unitId: string;
    quantity: number;
    reason: string;
    notes?: string;
  }) => Promise<{ success: boolean; error?: string; record?: DamagedRecord }>;
  addMultiDamagedRecords: (data: {
    section: DamagedSection;
    reason: string;
    generalNotes?: string;
    date?: string;
    items: { itemId: string; unitId: string; quantity: number; reason?: string; notes?: string }[];
  }) => Promise<{ success: boolean; records?: DamagedRecord[]; error?: string }>;
  recoverDamagedRecord: (data: {
    damagedRecordId?: string;
    itemId: string;
    unitId: string;
    quantity: number;
    reason: string;
    notes?: string;
    date?: string;
  }) => Promise<{ success: boolean; error?: string; movementId?: string; record?: DamagedRecord }>;
  deleteDamagedRecord: (id: string, reason?: string) => Promise<{ success: boolean; error?: string }>;

  // Simplified Factory Movements
  generateFactoryReferenceNumber: (type: 'MFG_OUT' | 'MFG_IN') => string;
  addFactoryMovement: (data: {
    itemId: string;
    type: 'MFG_OUT' | 'MFG_IN';
    unitId: string;
    quantity: number;
    notes?: string;
    date?: string;
  }) => Promise<{ success: boolean; movement?: StockMovement; error?: string }>;
  addMultiItemFactoryMovement: (data: {
    type: 'MFG_OUT' | 'MFG_IN';
    date?: string;
    notes?: string;
    items: { itemId: string; unitId: string; quantity: number; notes?: string }[];
  }) => Promise<{ success: boolean; movements?: StockMovement[]; error?: string; referenceNumber?: string }>;

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
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [damagedRecords, setDamagedRecords] = useState<DamagedRecord[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: 'نظام مخزون مدهال الطيب',
    commercialRegister: '',
    taxId: '',
    phone: '',
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
  const productionOrdersRef = React.useRef(productionOrders);
  const damagedRecordsRef = React.useRef(damagedRecords);

  useEffect(() => {
    damagedRecordsRef.current = damagedRecords;
  }, [damagedRecords]);

  useEffect(() => {
    customersRef.current = customers;
  }, [customers]);

  useEffect(() => {
    productionOrdersRef.current = productionOrders;
  }, [productionOrders]);

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

  // Immediate purge of any cached purged movement upon app initialization
  useEffect(() => {
    try {
      const raw = localStorage.getItem('makhzouni_movements_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((m) => !isPurgedMovement(m));
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('makhzouni_movements_v1', JSON.stringify(cleaned));
            setMovements((prev) => prev.filter((m) => !isPurgedMovement(m)));
          }
        }
      }
    } catch {}
  }, []);

  const { role, isOwner, user } = useAuth();
  const roleRef = useRef(role);
  const isOwnerRef = useRef(isOwner);
  roleRef.current = role;
  isOwnerRef.current = isOwner;

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  }, []);

  // Strict role security guard: blocks any write operation when user is in View-Only mode
  const ensureAdmin = useCallback(
    (actionName: string): boolean => {
      let sessionIsAdmin = false;
      try {
        const sRole =
          sessionStorage.getItem('makhzouni_active_role_session_v1') ||
          localStorage.getItem('makhzouni_active_role_session_v1');
        const lRole = localStorage.getItem('userRole');
        sessionIsAdmin = sRole === 'ADMIN' || (sRole !== 'FACTORY_VIEWER' && lRole === 'ADMIN');
      } catch {}

      const effectiveIsAdmin =
        role === 'ADMIN' ||
        isOwner ||
        roleRef.current === 'ADMIN' ||
        isOwnerRef.current ||
        sessionIsAdmin;

      if (!effectiveIsAdmin) {
        const errorMsg = `عفواً، لا تملك الصلاحية لتنفيذ (${actionName}). حساب مسؤول المصنع مخصص للمشاهدة فقط؛ يرجى التبديل لوضع المدير للمتابعة.`;
        showToast(errorMsg, 'error');
        return false;
      }
      return true;
    },
    [role, isOwner, showToast]
  );

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

      const loadedMovements = deduplicateById(
        (loaded.movements || []).filter((m) => !isPurgedMovement(m))
      );
      const loadedDamaged = deduplicateById(loaded.damagedRecords || []);
      const missingMovements: StockMovement[] = [];

      for (const dmg of loadedDamaged) {
        const hasMatchingMov = loadedMovements.some(
          (m) =>
            m.id === dmg.movementId ||
            m.damagedRecordId === dmg.id ||
            (m.type === 'DAMAGED' && m.itemId === dmg.itemId && Math.abs(m.baseQuantity - dmg.baseQuantity) < 0.001)
        );

        if (!hasMatchingMov) {
          const synthesizedMov: StockMovement = {
            id: dmg.movementId || `mov_dmg_rec_${dmg.id}`,
            itemId: dmg.itemId,
            type: 'DAMAGED',
            unitId: dmg.unitId,
            quantity: dmg.quantity,
            factorApplied: dmg.factorApplied || 1,
            baseQuantity: dmg.baseQuantity,
            date: dmg.date || dmg.createdAt || new Date().toISOString(),
            referenceNumber: `DMG-${Math.floor(100000 + Math.random() * 900000)}`,
            notes: `تلف (${dmg.section === 'GENERAL' ? 'المخزون العام' : 'الإنتاج والتصنيع'}): ${dmg.reason}${dmg.notes ? ` - ${dmg.notes}` : ''}`,
            destinationType: 'DAMAGED',
            damagedRecordId: dmg.id,
            createdByName: dmg.createdByName || 'إدارة النظام',
            status: 'APPROVED',
            createdAt: dmg.createdAt || new Date().toISOString(),
            updatedAt: dmg.updatedAt || new Date().toISOString(),
          };
          missingMovements.push(synthesizedMov);
          FirestoreStorage.saveMovement(synthesizedMov).catch((e) => console.warn(e));
        }
      }

      const allMovements = (missingMovements.length > 0 ? [...missingMovements, ...loadedMovements] : loadedMovements).filter((m) => !isPurgedMovement(m));

      setUnits(sortUnitsWithHabbaFirst(deduplicateById(finalUnits)));
      setCategories(deduplicateById(loaded.categories || []));
      setItems(deduplicateById(loaded.items || []).map(normalizeItem));
      setMovements(allMovements);
      movementsRef.current = allMovements;
      setBranches(deduplicateById(currentBranches));
      setReturns(deduplicateById(loaded.returns || []));
      setCustomers(deduplicateById(loaded.customers || []));
      setProductionOrders(deduplicateById(loaded.productionOrders || []));
      productionOrdersRef.current = deduplicateById(loaded.productionOrders || []);
      setDamagedRecords(loadedDamaged);
      damagedRecordsRef.current = loadedDamaged;
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
            setUnits(sortUnitsWithHabbaFirst(deduplicateById(localData.units)));
          }
          if (localData.categories) setCategories(deduplicateById(localData.categories));
          if (localData.items) setItems(deduplicateById(localData.items).map(normalizeItem));
          if (localData.movements) {
            const cleanMovs = deduplicateById(localData.movements.filter((m) => !isPurgedMovement(m)));
            setMovements(cleanMovs);
            movementsRef.current = cleanMovs;
          }
          if (localData.branches) setBranches(deduplicateById(localData.branches));
          if (localData.returns) setReturns(deduplicateById(localData.returns));
          if (localData.customers) setCustomers(deduplicateById(localData.customers));
          if (localData.productionOrders) {
            setProductionOrders(deduplicateById(localData.productionOrders));
            productionOrdersRef.current = deduplicateById(localData.productionOrders);
          }
          if (localData.damagedRecords) {
            setDamagedRecords(deduplicateById(localData.damagedRecords));
            damagedRecordsRef.current = deduplicateById(localData.damagedRecords);
          }
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
      onItems: (cloudItems: Item[]) => {
        const deduped = deduplicateById(cloudItems).map(normalizeItem);
        setItems(deduped);
        itemsRef.current = deduped;
      },
      onMovements: (cloudMovements: StockMovement[]) => {
        const clean = cloudMovements.filter((m) => !isPurgedMovement(m));
        const deduped = deduplicateById(clean);
        setMovements(deduped);
        movementsRef.current = deduped;
      },
      onCategories: (cloudCategories: Category[]) => {
        const deduped = deduplicateById(cloudCategories);
        setCategories(deduped);
        categoriesRef.current = deduped;
      },
      onUnits: (cloudUnits: Unit[]) => {
        if (cloudUnits.length > 0) {
          const sorted = sortUnitsWithHabbaFirst(deduplicateById(cloudUnits));
          setUnits(sorted);
          unitsRef.current = sorted;
        }
      },
      onBranches: (cloudBranches: Branch[]) => {
        const deduped = deduplicateById(cloudBranches);
        setBranches(deduped);
        branchesRef.current = deduped;
      },
      onReturns: (cloudReturns: ReturnRecord[]) => {
        const deduped = deduplicateById(cloudReturns);
        setReturns(deduped);
        returnsRef.current = deduped;
      },
      onCustomers: (cloudCustomers: Customer[]) => {
        const deduped = deduplicateById(cloudCustomers);
        setCustomers(deduped);
        customersRef.current = deduped;
      },
      onProductionOrders: (cloudOrders: ProductionOrder[]) => {
        const deduped = deduplicateById(cloudOrders);
        setProductionOrders(deduped);
        productionOrdersRef.current = deduped;
      },
      onDamagedRecords: (cloudDamaged: DamagedRecord[]) => {
        const deduped = deduplicateById(cloudDamaged);
        setDamagedRecords(deduped);
        damagedRecordsRef.current = deduped;
      },
    } as any);


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
      newReturns: ReturnRecord[] = returnsRef.current,
      newDamagedRecords: DamagedRecord[] = damagedRecordsRef.current,
      newProductionOrders: ProductionOrder[] = productionOrdersRef.current
    ) => {
      // Keep refs updated immediately
      unitsRef.current = newUnits;
      categoriesRef.current = newCategories;
      itemsRef.current = newItems;
      movementsRef.current = newMovements;
      branchesRef.current = newBranches;
      returnsRef.current = newReturns;
      damagedRecordsRef.current = newDamagedRecords;
      productionOrdersRef.current = newProductionOrders;

      const fullData = {
        units: newUnits,
        categories: newCategories,
        items: newItems,
        movements: newMovements,
        branches: newBranches,
        returns: newReturns,
        damagedRecords: newDamagedRecords,
        productionOrders: newProductionOrders,
      };

      // 1. Immediately write to local storage & IndexedDB cache for instant offline persistence across page reloads
      try {
        await StorageService.saveAll(fullData);
      } catch (storageErr) {
        console.warn('StorageService.saveAll error in persistChanges:', storageErr);
      }

      // 2. Persistent Cloud Firestore sync (Authoritative cloud-first write)
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
        console.warn(errMsg);
      }
    },
    [refreshAuditLogs, refreshCloudBackups]
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
      if (!ensureAdmin('إضافة عميل')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
    [customers, ensureAdmin]
  );

  const updateCustomer = useCallback(
    (id: string, data: Partial<Omit<Customer, 'id' | 'createdAt'>>, reason?: string) => {
      if (!ensureAdmin('تعديل عميل')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
    [customers, ensureAdmin]
  );

  const deleteCustomer = useCallback(
    (id: string, reason?: string) => {
      if (!ensureAdmin('حذف عميل')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
    [customers, ensureAdmin]
  );

  const saveCompanySettings = useCallback(
    (settings: CompanySettings) => {
      if (!ensureAdmin('تعديل إعدادات المنشأة')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
      setCompanySettings(settings);
      FirestoreStorage.saveCompanySettings(settings).catch((err) => console.warn(err));
      showToast('تم حفظ إعدادات المنشأة وسندات الطباعة بنجاح', 'success');
      return { success: true };
    },
    [showToast, ensureAdmin]
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
      if (!ensureAdmin('إضافة فرع')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
    [branches, units, categories, items, movements, returns, persistChanges, showToast, ensureAdmin]
  );

  const deleteBranch = useCallback(
    (id: string, reason?: string) => {
      if (!ensureAdmin('حذف فرع')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
    [branches, units, categories, items, movements, returns, persistChanges, ensureAdmin]
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
      if (!ensureAdmin('تعديل فرع')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
    [branches, units, categories, items, movements, returns, persistChanges, ensureAdmin]
  );

  const clearAllBranches = useCallback(() => {
    if (!ensureAdmin('تصفير الفروع')) {
      return;
    }
    for (const b of branches) {
      try {
        FirestoreStorage.deleteBranch(b.id, b.name).catch((e) => console.warn(e));
      } catch {}
    }
    setBranches([]);
    persistChanges(units, categories, items, movements, [], returns);
    showToast('تم تصفير وحذف جميع الفروع بنجاح', 'info');
  }, [branches, units, categories, items, movements, returns, persistChanges, showToast, ensureAdmin]);

  // ---------------------------------------------------------------------------
  // Task 2: Pure Stock Rules Integration & Single-Pass Balances Pre-computation
  // ---------------------------------------------------------------------------

  // Pre-compute stock balances map for all items once using pure stockRules
  const stockBalancesMap = useMemo(() => {
    return computeAllBalances(movements, items);
  }, [movements, items]);

  // Pre-compute cumulative totalIn and totalOut map for all items once using pure stockRules
  const stockTotalsMap = useMemo(() => {
    const totals = new Map<string, { totalIn: number; totalOut: number }>();
    const uniqueMovements = deduplicateById(movements || []);

    for (let i = 0; i < uniqueMovements.length; i++) {
      const m = uniqueMovements[i];
      if (!m || !m.itemId) continue;

      const effect = getMovementStockEffect(m.type);
      const baseQty = getUnsignedBaseQuantity(m);
      const curr = totals.get(m.itemId) || { totalIn: 0, totalOut: 0 };

      if (effect === 'INCREASE') {
        curr.totalIn += baseQty;
      } else if (effect === 'DECREASE') {
        // DAMAGED is classified as DECREASE, so it is accurately counted in totalOut!
        curr.totalOut += baseQty;
      } else if (effect === 'ADJUSTMENT') {
        const signed = signedBaseQty(m);
        if (signed > 0) curr.totalIn += signed;
        else curr.totalOut += Math.abs(signed);
      }
      totals.set(m.itemId, curr);
    }

    return totals;
  }, [movements]);

  // Calculate current stock in base units with stockRules:
  // Returns true signed balance (negative allowed) for regular items, and min 0 for composites.
  const getItemStock = useCallback(
    (itemId: string): number => {
      return stockBalancesMap.get(itemId) ?? 0;
    },
    [stockBalancesMap]
  );

  // Conversion factor helper
  const getUnitConversionFactor = useCallback(
    (itemId: string, unitId: string): number | null => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return null;
      if (item.baseUnitId === unitId) return 1;
      const conv = (item.conversions || []).find((c) => c.unitId === unitId);
      return conv ? conv.factorToBase : null;
    },
    [items]
  );

  // Detailed Summary for an item (Unified with stockRules and DAMAGED included in totalOut)
  const getItemStockSummary = useCallback(
    (itemId: string): ItemStockSummary | null => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return null;

      const category = categories.find((c) => c.id === item.categoryId);
      const baseUnit = units.find((u) => u.id === item.baseUnitId);
      const stock = getItemStock(itemId);
      const totals = stockTotalsMap.get(itemId) || { totalIn: 0, totalOut: 0 };

      // Format equivalents in all configured units
      const formattedBalances: ItemStockSummary['formattedBalances'] = [];

      // Base unit entry
      formattedBalances.push({
        unitName: baseUnit?.name || 'وحدة',
        factor: 1,
        equivalent: stock,
      });

      // Conversions entries
      for (const conv of item.conversions || []) {
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
        totalIn: Math.round(totals.totalIn * 1000) / 1000,
        totalOut: Math.round(totals.totalOut * 1000) / 1000,
        formattedBalances,
        status,
      };
    },
    [items, categories, units, getItemStock, stockTotalsMap]
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

      if (
        m.type === 'IN' ||
        m.type === 'PRODUCTION_RECEIPT' ||
        m.type === 'PRODUCTION_RETURN' ||
        m.type === 'MFG_IN' ||
        (m.type as string) === 'وارد من المصنع'
      ) {
        todayInMovementsCount++;
        todayInQuantityBase += baseQty;
      } else if (
        m.type === 'OUT' ||
        m.type === 'PRODUCTION_DISPATCH' ||
        m.type === 'MFG_OUT' ||
        (m.type as string) === 'خروج للمصنع'
      ) {
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
      // Production stats
      totalProductionOrdersCount: productionOrders.length,
      openProductionOrdersCount: productionOrders.filter((p) => p.status === 'OPEN').length,
      pendingReceiptProductionOrdersCount: productionOrders.filter((p) => p.status === 'PENDING_RECEIPT').length,
      completedProductionOrdersCount: productionOrders.filter((p) => p.status === 'COMPLETED').length,
    };
  }, [items, categories, movements, branches, returns, productionOrders, getItemStock]);

  // UNIT CRUD
  const addUnit = useCallback(
    (name: string, symbol?: string, description?: string) => {
      if (!ensureAdmin('إضافة وحدة')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
    [units, categories, items, movements, branches, returns, persistChanges, showToast, ensureAdmin]
  );

  const updateUnit = useCallback(
    (id: string, name: string, symbol?: string, description?: string, reason?: string) => {
      if (!ensureAdmin('تعديل وحدة')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
    [units, categories, items, movements, branches, returns, persistChanges, showToast, ensureAdmin]
  );

  const deleteUnit = useCallback(
    (id: string, reason?: string) => {
      if (!ensureAdmin('حذف وحدة')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
      const unitToDelete = units.find((u) => u.id === id);
      if (!unitToDelete) return { success: false, error: 'الوحدة غير موجودة' };

      // Check if unit is in use
      const inUseAsBase = items.some((i) => !i.isDeleted && i.baseUnitId === id);
      const inUseInConversions = items.some(
        (i) => !i.isDeleted && (i.conversions || []).some((c) => c.unitId === id)
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
    [units, items, categories, movements, branches, returns, persistChanges, showToast, ensureAdmin]
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
      if (!ensureAdmin('إضافة قسم')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
    [categories, units, items, movements, branches, returns, persistChanges, showToast, ensureAdmin]
  );

  const updateCategory = useCallback(
    (id: string, name: string, description?: string, color?: string, reason?: string) => {
      if (!ensureAdmin('تعديل قسم')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
    [categories, units, items, movements, branches, returns, persistChanges, showToast, ensureAdmin]
  );

  const deleteCategory = useCallback(
    (id: string, reason?: string) => {
      if (!ensureAdmin('حذف قسم')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
    [categories, items, units, movements, branches, returns, persistChanges, showToast, ensureAdmin]
  );

  // ITEM CRUD
  const addItem = useCallback(
    (itemData: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'isArchived' | 'isDeleted'>) => {
      if (!ensureAdmin('إضافة صنف جديد')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
      const cleanName = itemData.name.trim();
      if (!cleanName) return { success: false, error: 'يرجى إدخال اسم الصنف' };
      if (!itemData.categoryId) return { success: false, error: 'يرجى تحديد قسم الصنف' };
      if (!itemData.baseUnitId) return { success: false, error: 'يرجى تحديد الوحدة الأساسية للصنف' };

      // Prevent duplicate item name across active items only
      const existingMatch = items.find(
        (i) => !i.isDeleted && !i.isArchived && (i?.name || '').trim().toLowerCase() === cleanName.toLowerCase()
      );

      if (existingMatch) {
        return {
          success: false,
          error: `يوجد صنف نشط مسجل مسبقاً بنفس الاسم "${cleanName}"؛ يرجى اختيار اسم غير مكرر أو تمييزه.`,
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
        isComposite: itemData.isComposite,
        components: itemData.components,
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
    [items, units, categories, movements, branches, returns, persistChanges, showToast, ensureAdmin]
  );

  const updateItem = useCallback(
    (id: string, itemData: Partial<Omit<Item, 'id' | 'createdAt' | 'updatedAt'>>, reason?: string) => {
      if (!ensureAdmin('تعديل الصنف')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
      const existing = items.find((i) => i.id === id);
      if (!existing) return { success: false, error: 'الصنف غير موجود' };

      const cleanReason = reason?.trim();
      if (!cleanReason) {
        return { success: false, error: 'كتابة سبب التعديل إلزامية لتوثيق وتعديل بيانات الصنف في سجل الرقابة' };
      }

      if (itemData.name) {
        const cleanName = itemData.name.trim();
        if (!cleanName) {
          return { success: false, error: 'اسم الصنف لا يمكن أن يكون فارغاً' };
        }
        const nameConflict = items.some(
          (i) => i.id !== id && !i.isDeleted && (i?.name || '').trim().toLowerCase() === cleanName.toLowerCase()
        );
        if (nameConflict) {
          return { success: false, error: `يوجد صنف آخر مسجل مسبقاً بنفس الاسم "${cleanName}"` };
        }
      }

      if (itemData.code) {
        const cleanCode = itemData.code.trim();
        const codeConflict = items.some(
          (i) => i.id !== id && !i.isDeleted && (i?.code || '').trim().toLowerCase() === cleanCode.toLowerCase()
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

      // Check if conversions actually changed before blocking
      const haveConversionsChanged = () => {
        if (!itemData.conversions) return false;
        const oldConvs = existing.conversions || [];
        const newConvs = itemData.conversions || [];
        if (oldConvs.length !== newConvs.length) return true;
        return newConvs.some((nc) => {
          const matched = oldConvs.find((oc) => oc.unitId === nc.unitId);
          return !matched || Number(matched.factorToBase) !== Number(nc.factorToBase);
        });
      };

      if (haveConversionsChanged()) {
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
      const performer = user?.displayName || user?.email || (isOwner ? 'المدير العام' : OWNER_EMAIL);
      FirestoreStorage.recordAuditLog({
        operationType: 'تعديل',
        entityType: 'صنف',
        entityId: id,
        entityName: updatedItem.name,
        reason: cleanReason,
        userName: performer,
        dataBefore: existing,
        dataAfter: updatedItem,
      }).catch((e) => console.warn(e));
      persistChanges(units, categories, updated, movements, branches, returns, damagedRecords, productionOrders);
      showToast(`تم حفظ تعديلات الصنف "${updatedItem.name}" بنجاح`, 'success');
      return { success: true, item: updatedItem };
    },
    [
      items,
      movements,
      units,
      categories,
      branches,
      returns,
      damagedRecords,
      productionOrders,
      persistChanges,
      showToast,
      ensureAdmin,
    ]
  );

  const archiveItem = useCallback(
    (id: string, reason?: string) => {
      if (!ensureAdmin('أرشفة الصنف')) return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
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
    [items, units, categories, movements, branches, returns, persistChanges, showToast, ensureAdmin]
  );

  const restoreItem = useCallback(
    (id: string) => {
      if (!ensureAdmin('استعادة الصنف من الأرشيف')) return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
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
    [items, units, categories, movements, branches, returns, persistChanges, showToast, ensureAdmin]
  );

  const softDeleteItem = useCallback(
    (id: string, reason?: string) => {
      if (!ensureAdmin('حذف الصنف')) return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
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
    [items, units, categories, movements, branches, returns, persistChanges, showToast, ensureAdmin]
  );

  const restoreFromTrash = useCallback(
    (id: string) => {
      if (!ensureAdmin('استعادة الصنف من سلة المحذوفات')) return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
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
    [items, units, categories, movements, branches, returns, persistChanges, showToast, ensureAdmin]
  );

  const permanentDeleteItem = useCallback(
    (id: string, reason?: string) => {
      if (!ensureAdmin('الحذف النهائي للصنف')) return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      const item = items.find((i) => i.id === id);
      if (!item) return { success: false, error: 'الصنف غير موجود' };

      const cleanReason = reason?.trim();
      if (!cleanReason) {
        return { success: false, error: 'يرجى كتابة سبب الحذف النهائي للمتابعة.' };
      }

      // Remove item and its associated movements completely so it doesn't appear in movements or trash
      const updatedItems = items.filter((i) => i.id !== id);
      const updatedMovements = movements.filter((m) => m.itemId !== id);

      setItems(updatedItems);
      setMovements(updatedMovements);
      movementsRef.current = updatedMovements;

      try {
        FirestoreStorage.deleteItem(id, item.name).catch((e) => console.warn(e));
        for (const mov of movements.filter((m) => m.itemId === id)) {
          if (mov.id) {
            FirestoreStorage.deleteMovement(mov.id).catch((e) => console.warn(e));
          }
        }
      } catch {}

      FirestoreStorage.recordAuditLog({
        operationType: 'حذف',
        entityType: 'صنف',
        entityId: id,
        entityName: item.name,
        reason: `حذف نهائي شامل بدون آثار (مع الحركات المرتبطة): ${cleanReason}`,
        userName: OWNER_EMAIL,
        dataBefore: item,
        dataAfter: null,
      }).catch((e) => console.warn(e));

      persistChanges(units, categories, updatedItems, updatedMovements, branches, returns);
      showToast(`تم الحذف النهائي الشامل للصنف "${item.name}" وإزالة كافة حركاته المرتبطة بنجاح`, 'success');
      return { success: true };
    },
    [items, movements, units, categories, branches, returns, persistChanges, showToast, ensureAdmin]
  );

  // Helper to verify stock availability with canWithdraw and fresh Firestore lookup
  const verifyFreshStockAvailable = useCallback(
    async (
      targetItemId: string,
      requiredBaseQty: number
    ): Promise<{ allowed: boolean; currentBalance: number; error?: string }> => {
      const localBalance = getItemStock(targetItemId);
      if (!canWithdraw(localBalance, requiredBaseQty)) {
        return {
          allowed: false,
          currentBalance: localBalance,
          error: `الكمية المطلوبة (${requiredBaseQty}) تتجاوز الرصيد المتوفر محلياً (${localBalance}).`,
        };
      }

      // If online, re-fetch movements for this itemId from Firestore to prevent double-spending across devices
      if (!isOffline && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const freshMovements = await FirestoreStorage.fetchItemMovements(targetItemId);
          if (freshMovements && freshMovements.length > 0) {
            const mergedItemMovements = deduplicateById([
              ...freshMovements,
              ...movements.filter((m) => m && m.itemId === targetItemId),
            ]);
            const freshBalances = computeAllBalances(mergedItemMovements, items);
            const freshBalance = freshBalances.get(targetItemId) ?? localBalance;
            if (!canWithdraw(freshBalance, requiredBaseQty)) {
              return {
                allowed: false,
                currentBalance: freshBalance,
                error: `عفواً، تم تحديث رصيد هذا الصنف من جهاز آخر ولم يعد كافياً لإتمام العملية. الرصيد المحدث بالسحابة: ${freshBalance}.`,
              };
            }
            return { allowed: true, currentBalance: freshBalance };
          }
        } catch (err) {
          console.warn('[InventoryContext] Could not re-verify fresh stock from Firestore, proceeding with local check:', err);
        }
      }

      return { allowed: true, currentBalance: localBalance };
    },
    [getItemStock, isOffline, movements, items]
  );

  // STOCK MOVEMENTS
  const addMovement = useCallback(
    async (data: {
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
      if (!ensureAdmin('تسجيل حركة مخزنية')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
      
      // Handle Composite Product Components Check & Reservation
      let componentsToDispatch: { itemId: string; baseQuantity: number }[] = [];
      if (item.isComposite && item.components) {
        for (const comp of item.components) {
          const compItem = items.find(i => i.id === comp.itemId && !i.isDeleted);
          if (!compItem) return { success: false, error: `مكوّن المنتج المركب "${comp.itemId}" غير موجود.` };
          
          const totalCompBaseQty = comp.quantity * baseQuantity;
          const verify = await verifyFreshStockAvailable(comp.itemId, totalCompBaseQty);
          if (!verify.allowed) {
            const compBaseUnit = units.find((u) => u.id === compItem.baseUnitId)?.name || 'وحدة';
            const errMsg = `عفواً، لا يتوفر رصيد كافٍ للمكوّن "${compItem.name}" (المطلوب: ${totalCompBaseQty} ${compBaseUnit}، المتوفر: ${verify.currentBalance} ${compBaseUnit}).`;
            showToast(errMsg, 'error');
            return { success: false, error: errMsg };
          }
          componentsToDispatch.push({ itemId: comp.itemId, baseQuantity: totalCompBaseQty });
        }
      }

      const currentStock = getItemStock(data.itemId);
      const baseUnit = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';
      const movementUnit = units.find((u) => u.id === data.unitId)?.name || 'وحدة';

      // Negative balance guard for OUT
      if (data.type === 'OUT' && !item.isComposite) {
        const verify = await verifyFreshStockAvailable(data.itemId, baseQuantity);
        if (!verify.allowed) {
          const errMsg = `عفواً، لا يمكن إتمام عملية الخروج: الكمية المطلوبة (${data.quantity} ${movementUnit} = ${baseQuantity} ${baseUnit}) تتجاوز الرصيد المتوفر حالياً (${verify.currentBalance} ${baseUnit}). نظام مدهال الطيب يمنع الرصيد السالب نهائياً!`;
          showToast(errMsg, 'error');
          return {
            success: false,
            error: errMsg,
          };
        }
      }

      const movementId = 'mov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      
      const newMovements: StockMovement[] = [];
      
      if (item.isComposite) {
        // Create movements for each component
        for (const comp of componentsToDispatch) {
          const compItem = items.find(i => i.id === comp.itemId)!;
          newMovements.push({
            id: 'mov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            itemId: comp.itemId,
            type: data.type,
            unitId: compItem.baseUnitId, // Using base unit for components for simplicity
            quantity: comp.baseQuantity,
            factorApplied: 1,
            baseQuantity: comp.baseQuantity,
            date: data.date || new Date().toISOString(),
            referenceNumber: data.referenceNumber?.trim(),
            notes: `مكوّن للمنتج المركّب: ${item.name}`,
            itemName: compItem.name,
            itemCode: compItem.code,
            unitName: units.find(u => u.id === compItem.baseUnitId)?.name || 'وحدة',
            destinationType: data.destinationType,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            batchId: movementId, // Linked to the main requested product movement
          });
        }
      } else {
        newMovements.push({
          id: movementId,
          itemId: data.itemId,
          type: data.type,
          unitId: data.unitId,
          quantity: Number(data.quantity),
          factorApplied: factor,
          baseQuantity,
          date: data.date || new Date().toISOString(),
          referenceNumber: data.referenceNumber?.trim(),
          notes: data.notes?.trim(),
          itemName: item.name,
          itemCode: item.code,
          unitName: movementUnit,
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
        });
      }

      const updatedMovements = [...newMovements, ...movements];
      setMovements(updatedMovements);
      movementsRef.current = updatedMovements;
      // Auto-save movements directly to Cloud Firestore immediately
      newMovements.forEach((m) => {
        FirestoreStorage.saveMovement(m).catch((err) => {
          console.warn('Auto-save movement to Firestore deferred:', err);
        });
      });
      persistChanges(units, categories, items, updatedMovements, branches, returns);

      const actionText = data.type === 'IN' ? 'تسجيل دخول' : 'تسجيل خروج';
      showToast(`تم ${actionText} ${data.quantity} ${movementUnit} للصنف "${item.name}" بنجاح`, 'success');
      return { success: true };
    },
    [items, units, categories, movements, branches, returns, getItemStock, persistChanges, showToast, verifyFreshStockAvailable, ensureAdmin]
  );

  // Multi-item Outgoing Dispatch (Export to branch or Customer with SMSA / Fastlo / Aramex)
  const addMultiItemDispatch = useCallback(
    async (dispatchData: {
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
      if (!ensureAdmin('صرف شحنة وتصدير')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
        componentsToDispatch?: { itemId: string; baseQuantity: number }[];
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
            return { success: false, error: errMsg };
          }
          factor = conv.factorToBase;
        }

        const baseQuantity = Math.round(entry.quantity * factor * 1000) / 1000;

        let compEntries: { itemId: string; baseQuantity: number }[] = [];
        if (item.isComposite && item.components) {
          for (const comp of item.components) {
            const compItem = items.find(i => i.id === comp.itemId && !i.isDeleted);
            if (!compItem) return { success: false, error: `مكوّن المنتج المركب "${comp.itemId}" غير موجود.` };
            const totalCompBaseQty = comp.quantity * baseQuantity;
            cumulativePerItem[comp.itemId] = Math.round(((cumulativePerItem[comp.itemId] || 0) + totalCompBaseQty) * 1000) / 1000;
            const compStock = getItemStock(comp.itemId);
            const compBaseUnitName = units.find(u => u.id === compItem.baseUnitId)?.name || 'وحدة';

            if (!canWithdraw(compStock, cumulativePerItem[comp.itemId])) {
              const errMsg = `عفواً، لا يتوفر رصيد كافٍ للمكوّن "${compItem.name}" (المطلوب: ${cumulativePerItem[comp.itemId]} ${compBaseUnitName}، المتوفر: ${compStock} ${compBaseUnitName}).`;
              showToast(errMsg, 'error');
              return { success: false, error: errMsg };
            }
            compEntries.push({ itemId: comp.itemId, baseQuantity: totalCompBaseQty });
          }
        } else {
          cumulativePerItem[item.id] = Math.round(((cumulativePerItem[item.id] || 0) + baseQuantity) * 1000) / 1000;
          const currentStock = getItemStock(item.id);
          const baseUnit = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';
          
          if (!canWithdraw(currentStock, cumulativePerItem[item.id])) {
            const errMsg = `عفواً، لا يمكن إتمام التصدير: إجمالي الكمية المطلوبة للصنف "${item.name}" (${cumulativePerItem[item.id]} ${baseUnit}) تتجاوز الرصيد المتوفر (${currentStock} ${baseUnit}). يمنع النظام تماماً الأرصدة السالبة!`;
            showToast(errMsg, 'error');
            return {
              success: false,
              error: errMsg,
            };
          }
        }

        calculatedEntries.push({
          item,
          unitId: entry.unitId,
          quantity: entry.quantity,
          factor,
          baseQuantity,
          notes: entry.notes,
          componentsToDispatch: compEntries,
        });
      }

      // Re-verify against fresh Firestore movements to ensure no concurrent device over-withdrew
      for (const [targetId, requiredQty] of Object.entries(cumulativePerItem)) {
        const verify = await verifyFreshStockAvailable(targetId, requiredQty);
        if (!verify.allowed) {
          const targetItem = items.find((i) => i.id === targetId);
          const errMsg = `عفواً، تم تحديث رصيد الصنف "${targetItem?.name || targetId}" من جهاز آخر: ${verify.error}`;
          showToast(errMsg, 'error');
          return { success: false, error: errMsg };
        }
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

      const newMovements: StockMovement[] = [];
      for (const e of calculatedEntries) {
        if (e.item.isComposite && e.componentsToDispatch) {
          for (const comp of e.componentsToDispatch) {
            const compItem = items.find(i => i.id === comp.itemId)!;
            newMovements.push({
              id: 'mov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              itemId: comp.itemId,
              type: 'OUT',
              unitId: compItem.baseUnitId,
              quantity: comp.baseQuantity,
              factorApplied: 1,
              baseQuantity: comp.baseQuantity,
              date: dispatchData.date || nowIso,
              referenceNumber: voucherNo,
              notes: `مكوّن للمنتج المركّب: ${e.item.name} (${e.notes || dispatchData.notes?.trim() || ''})`,
              itemName: compItem.name,
              itemCode: compItem.code,
              unitName: units.find((u) => u.id === compItem.baseUnitId)?.name || 'وحدة',
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
            });
          }
        } else {
          newMovements.push({
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
            itemName: e.item.name,
            itemCode: e.item.code,
            unitName: units.find((u) => u.id === e.unitId)?.name || 'وحدة',
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
          });
        }
      }

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
      showToast(`تم تصدير الأصناف بنجاح إلى ${targetDesc} (رقم السند: ${voucherNo})`, 'success');

      return { success: true, voucherNumber: voucherNo, movements: newMovements };
    },
    [items, units, categories, movements, branches, returns, getItemStock, persistChanges, showToast, verifyFreshStockAvailable, ensureAdmin]
  );

  const updateMultiItemDispatch = useCallback(
    (
      voucherRefOrBatch: string,
      dispatchData: {
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
        editReason: string;
        date: string;
        items: {
          itemId: string;
          unitId: string;
          quantity: number;
          notes?: string;
        }[];
      }
    ) => {
      if (!ensureAdmin('تعديل سند خروج معتمد')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }

      if (!dispatchData.editReason?.trim()) {
        const errMsg = 'يرجى إدخال سبب التعديل بشكل إلزامي لضمان التوثيق والرقابة.';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }

      if (!dispatchData.items || dispatchData.items.length === 0) {
        const errMsg = 'يرجى إضافة صنف واحد على الأقل في سند الخروج.';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }

      // Enforce unique items (no item duplication within voucher)
      const itemIds = dispatchData.items.map((i) => i.itemId);
      if (new Set(itemIds).size !== itemIds.length) {
        const errMsg = 'عفواً، يتضمن السند أصناف مكررة! يمنع تكرار الصنف نفسه داخل السند.';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }

      if (dispatchData.destinationType === 'BRANCH' && !dispatchData.branchId) {
        return { success: false, error: 'يرجى تحديد الفرع المراد التصدير إليه' };
      }

      if (dispatchData.destinationType === 'CUSTOMER' && !dispatchData.customerName?.trim()) {
        return { success: false, error: 'يرجى إدخال اسم العميل للشحنة' };
      }

      // Locate existing movements belonging to this voucher batch or reference
      const searchKey = voucherRefOrBatch.trim().toLowerCase();
      const existingMovements = movements.filter((m) => {
        const mRef = (m.referenceNumber || '').trim().toLowerCase();
        const mBatch = (m.batchId || '').trim().toLowerCase();
        return (
          m.id === voucherRefOrBatch ||
          (mBatch && mBatch === searchKey) ||
          (mRef && mRef === searchKey)
        );
      });

      if (existingMovements.length === 0) {
        const errMsg = 'عفواً، لم يتم العثور على السند المعتمد المراد تعديله.';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }

      // Calculate virtual stock available after temporarily restoring previous dispatch quantities
      const virtualStockMap: Record<string, number> = {};
      existingMovements.forEach((oldM) => {
        const current = getItemStock(oldM.itemId);
        if (oldM.type === 'OUT') {
          virtualStockMap[oldM.itemId] = (virtualStockMap[oldM.itemId] ?? current) + oldM.baseQuantity;
        }
      });

      // Verify all new item entries against virtual stock
      const calculatedEntries: {
        item: Item;
        unitId: string;
        quantity: number;
        factor: number;
        baseQuantity: number;
        notes?: string;
        componentsToDispatch?: { itemId: string; baseQuantity: number }[];
      }[] = [];

      const newRequiredPerItem: Record<string, number> = {};

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
            return { success: false, error: errMsg };
          }
          factor = conv.factorToBase;
        }

        const baseQuantity = Math.round(entry.quantity * factor * 1000) / 1000;
        let compEntries: { itemId: string; baseQuantity: number }[] = [];

        if (item.isComposite && item.components) {
          for (const comp of item.components) {
            const compItem = items.find(i => i.id === comp.itemId && !i.isDeleted);
            if (!compItem) return { success: false, error: `مكوّن المنتج المركب "${comp.itemId}" غير موجود.` };
            const totalCompBaseQty = comp.quantity * baseQuantity;
            newRequiredPerItem[comp.itemId] = Math.round(((newRequiredPerItem[comp.itemId] || 0) + totalCompBaseQty) * 1000) / 1000;
            const availableVirtual = virtualStockMap[comp.itemId] ?? getItemStock(comp.itemId);
            const compBaseUnitName = units.find(u => u.id === compItem.baseUnitId)?.name || 'وحدة';

            if (!canWithdraw(availableVirtual, newRequiredPerItem[comp.itemId])) {
              const errMsg = `عفواً، لا يمكن إتمام التعديل: المكوّن "${compItem.name}" يتطلب (${newRequiredPerItem[comp.itemId]} ${compBaseUnitName}) بينما المتاح افتراضياً (${availableVirtual} ${compBaseUnitName}).`;
              showToast(errMsg, 'error');
              return { success: false, error: errMsg };
            }
            compEntries.push({ itemId: comp.itemId, baseQuantity: totalCompBaseQty });
          }
        } else {
          newRequiredPerItem[item.id] = Math.round(((newRequiredPerItem[item.id] || 0) + baseQuantity) * 1000) / 1000;
          const availableVirtual = virtualStockMap[item.id] ?? getItemStock(item.id);
          const baseUnit = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';

          if (!canWithdraw(availableVirtual, newRequiredPerItem[item.id])) {
            const errMsg = `عفواً، لا يمكن إتمام التعديل: الكمية المعدلة المطلوبة للصنف "${item.name}" (${newRequiredPerItem[item.id]} ${baseUnit}) تتجاوز الرصيد المتاح عند إرجاع الكمية السابقة (${availableVirtual} ${baseUnit}). يمنع النظام تماماً الأرصدة السالبة!`;
            showToast(errMsg, 'error');
            return { success: false, error: errMsg };
          }
        }

        calculatedEntries.push({
          item,
          unitId: entry.unitId,
          quantity: entry.quantity,
          factor,
          baseQuantity,
          notes: entry.notes,
          componentsToDispatch: compEntries,
        });
      }

      // Preservation of metadata
      const firstOld = existingMovements[0];
      const batchId = firstOld.batchId || 'batch_' + Date.now();
      const voucherNo = dispatchData.referenceNumber?.trim() || firstOld.referenceNumber || `DSP-${new Date().getFullYear()}-EDIT`;
      const originalCreatedAt = firstOld.createdAt || new Date().toISOString();
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

      const updatedMovementsList: StockMovement[] = [];
      for (const e of calculatedEntries) {
        if (e.item.isComposite && e.componentsToDispatch) {
          for (const comp of e.componentsToDispatch) {
            const compItem = items.find(i => i.id === comp.itemId)!;
            updatedMovementsList.push({
              id: 'mov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              itemId: comp.itemId,
              itemName: compItem.name,
              itemCode: compItem.code,
              type: 'OUT',
              unitId: compItem.baseUnitId,
              unitName: units.find((u) => u.id === compItem.baseUnitId)?.name || 'وحدة',
              quantity: comp.baseQuantity,
              factorApplied: 1,
              baseQuantity: comp.baseQuantity,
              date: dispatchData.date || firstOld.date || nowIso,
              referenceNumber: voucherNo,
              notes: `مكوّن للمنتج المركّب: ${e.item.name} (${e.notes || dispatchData.notes?.trim() || ''})`,
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
              createdByName: firstOld.createdByName || OWNER_EMAIL,
              status: 'APPROVED',
              createdAt: originalCreatedAt,
              updatedAt: nowIso,
            });
          }
        } else {
          updatedMovementsList.push({
            id: 'mov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            itemId: e.item.id,
            itemName: e.item.name,
            itemCode: e.item.code,
            type: 'OUT',
            unitId: e.unitId,
            unitName: units.find((u) => u.id === e.unitId)?.name || 'وحدة',
            quantity: e.quantity,
            factorApplied: e.factor,
            baseQuantity: e.baseQuantity,
            date: dispatchData.date || firstOld.date || nowIso,
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
            createdByName: firstOld.createdByName || OWNER_EMAIL,
            status: 'APPROVED',
            createdAt: originalCreatedAt,
            updatedAt: nowIso,
          });
        }
      }

      // Filter out old movements of this batch/reference and append updated ones
      const oldIdsSet = new Set(existingMovements.map((m) => m.id));
      const remainingMovements = movements.filter((m) => !oldIdsSet.has(m.id));
      const nextMovementsState = [...updatedMovementsList, ...remainingMovements];

      setMovements(nextMovementsState);
      movementsRef.current = nextMovementsState;

      // Delete removed old movements from Firestore if any
      existingMovements.forEach((oldM) => {
        if (!updatedMovementsList.some((um) => um.id === oldM.id)) {
          FirestoreStorage.deleteMovement(oldM.id).catch((e) => console.warn(e));
        }
      });

      // Save new/updated movements to Firestore
      updatedMovementsList.forEach((m) => {
        FirestoreStorage.saveMovement(m).catch((e) => console.warn(e));
      });

      // Log audit trail
      FirestoreStorage.recordAuditLog({
        operationType: 'تعديل',
        entityType: 'سند خروج معتمد',
        entityId: voucherNo,
        entityName: `سند خروج #${voucherNo} (${destinationName})`,
        reason: dispatchData.editReason.trim(),
        userName: OWNER_EMAIL,
        dataBefore: existingMovements,
        dataAfter: updatedMovementsList,
      }).catch((e) => console.warn(e));

      persistChanges(units, categories, items, nextMovementsState, branches, returns);

      showToast(`تم تعديل السند المعتمد (#${voucherNo}) بنجاح وإعادة احتساب المخزون بأمان`, 'success');
      return { success: true, voucherNumber: voucherNo, movements: updatedMovementsList };
    },
    [items, units, categories, movements, branches, returns, getItemStock, persistChanges, showToast, ensureAdmin]
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
      if (!ensureAdmin('تعديل حركة مخزنية')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
    [movements, items, units, categories, branches, returns, getItemStock, persistChanges, showToast, ensureAdmin]
  );

  const deleteMovement = useCallback(
    (id: string, reason?: string) => {
      if (!ensureAdmin('حذف حركة مخزنية')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
      const existing = movements.find((m) => m.id === id);
      if (!existing) return { success: false, error: 'الحركة غير موجودة' };

      const item = items.find((i) => i.id === existing.itemId);
      if (!item) return { success: false, error: 'الصنف غير موجود' };

      // If deleting an IN movement, stock will decrease. Verify it doesn't cause negative stock!
      if (existing.type === 'IN') {
        const currentStock = getItemStock(item.id);
        if (!canWithdraw(currentStock, existing.baseQuantity)) {
          const baseUnit = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';
          const resultingStock = Math.round((currentStock - existing.baseQuantity) * 1000) / 1000;
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
    [movements, items, units, categories, branches, returns, getItemStock, persistChanges, showToast, ensureAdmin]
  );

  const adjustItemStock = useCallback(
    (data: {
      itemId: string;
      newStock: number;
      reason: string;
      unitId?: string;
      isSilent?: boolean;
      isHidden?: boolean;
    }): { success: boolean; error?: string } => {
      if (!ensureAdmin('تسوية جردية للمخزون')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
      const item = items.find((i) => i.id === data.itemId && !i.isDeleted);
      if (!item) return { success: false, error: 'الصنف غير موجود' };

      const cleanReason = data.reason?.trim();
      if (!cleanReason) {
        return { success: false, error: 'يرجى إدخال سبب التسوية / ملاحظات الجرد (إلزامي)' };
      }

      if (data.newStock === undefined || data.newStock === null || isNaN(Number(data.newStock))) {
        return { success: false, error: 'يرجى إدخال الرصيد الفعلي الجديد بشكل صحيح' };
      }

      const targetUnitId = data.unitId || item.baseUnitId;
      let factor = 1;
      if (targetUnitId !== item.baseUnitId) {
        const conv = item.conversions.find((c) => c.unitId === targetUnitId);
        if (!conv) {
          return { success: false, error: 'معامل التحويل غير مدعوم لهذه الوحدة' };
        }
        factor = conv.factorToBase;
      }

      const newStockInBase = Math.round(Number(data.newStock) * factor * 1000) / 1000;
      if (newStockInBase < 0) {
        return { success: false, error: 'لا يمكن أن يكون الرصيد الفعلي سالباً' };
      }

      const currentStockBase = getItemStock(item.id);
      const diffBase = Math.round((newStockInBase - currentStockBase) * 1000) / 1000;

      if (diffBase === 0) {
        return { success: false, error: 'الرصيد الجديد مطابق تماماً للرصيد المسجل حالياً (لا توجد فروقات للتسوية)' };
      }

      const nowIso = new Date().toISOString();
      const refNo = `ADJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const isSilentMode = !!data.isSilent || !!data.isHidden;

      const adjustmentMovement: StockMovement = {
        id: 'mov_adj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        itemId: item.id,
        type: 'ADJUSTMENT',
        unitId: targetUnitId,
        quantity: Math.abs(Number(data.newStock) - (targetUnitId === item.baseUnitId ? currentStockBase : currentStockBase / factor)),
        factorApplied: factor,
        baseQuantity: diffBase,
        date: nowIso,
        referenceNumber: refNo,
        notes: `${isSilentMode ? 'تسوية جردية صامتة: ' : 'تسوية جردية: '}الرصيد المسجل السابق (${currentStockBase}) -> الرصيد الفعلي الجديد (${newStockInBase}). السبب: ${cleanReason}`,
        destinationType: 'DIRECT',
        createdAt: nowIso,
        updatedAt: nowIso,
        isHidden: isSilentMode,
        isSilent: isSilentMode,
      };

      const updatedMovements = [adjustmentMovement, ...movements];
      setMovements(updatedMovements);
      movementsRef.current = updatedMovements;

      FirestoreStorage.saveMovement(adjustmentMovement).catch((e) => console.warn(e));
      FirestoreStorage.recordAuditLog({
        operationType: 'تعديل',
        entityType: 'تسوية مخزنية',
        entityId: adjustmentMovement.id,
        entityName: `${item.name} (تسوية جردية)`,
        reason: cleanReason,
        userName: OWNER_EMAIL,
        dataBefore: { currentStock: currentStockBase },
        dataAfter: { newStock: newStockInBase, difference: diffBase },
      }).catch((e) => console.warn(e));

      persistChanges(units, categories, items, updatedMovements, branches, returns);
      showToast(`تم تنفيذ التسوية الجردية للصنف "${item.name}" بنجاح (الفرق: ${diffBase > 0 ? '+' : ''}${diffBase})`, 'success');
      return { success: true };
    },
    [items, movements, units, categories, branches, returns, getItemStock, persistChanges, showToast, ensureAdmin]
  );

  const adjustStockSilently = useCallback(
    (itemId: string, newTargetStock: number, reason?: string): { success: boolean; error?: string } => {
      if (!ensureAdmin('تعديل الرصيد الصامت')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
      const item = items.find((i) => i.id === itemId && !i.isDeleted);
      if (!item) return { success: false, error: 'الصنف غير موجود' };

      const currentStockBase = getItemStock(item.id);
      const targetStock = Number(newTargetStock);
      if (isNaN(targetStock) || targetStock < 0) {
        return { success: false, error: 'يرجى إدخال رصيد صحيح' };
      }

      const diff = targetStock - currentStockBase;
      if (diff === 0) {
        return { success: false, error: 'الرصيد الجديد مطابق للرصيد الحالي' };
      }

      const nowIso = new Date().toISOString();
      const refNo = `ADJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const adjMovement: StockMovement = {
        id: 'mov_adj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        itemId: item.id,
        type: 'ADJUSTMENT',
        unitId: item.baseUnitId,
        quantity: Math.abs(diff),
        factorApplied: 1,
        baseQuantity: diff,
        date: nowIso,
        referenceNumber: refNo,
        notes: `تسوية جردية صامتة: ${reason || 'تعديل الرصيد إلى ' + targetStock}`,
        destinationType: 'DIRECT',
        createdAt: nowIso,
        updatedAt: nowIso,
        isHidden: true,
        isSilent: true,
      };

      const finalMovements = [adjMovement, ...movements];
      setMovements(finalMovements);
      movementsRef.current = finalMovements;

      FirestoreStorage.saveMovement(adjMovement).catch((e) => console.warn(e));

      FirestoreStorage.recordAuditLog({
        operationType: 'تعديل',
        entityType: 'صنف',
        entityId: itemId,
        entityName: item.name,
        reason: `تعديل صامت للرصيد من ${currentStockBase} إلى ${targetStock} بدون إظهار حركة جديدة. السبب: ${reason || 'تصحيح الفارق الواقعي'}`,
        userName: OWNER_EMAIL,
        dataBefore: { stock: currentStockBase },
        dataAfter: { stock: targetStock },
      }).catch((e) => console.warn(e));

      persistChanges(units, categories, items, finalMovements, branches, returns);
      showToast(`تم تعديل رصيد الصنف "${item.name}" صامتًا إلى ${targetStock} (بدون إنشاء حركة مخزنية جديدة)`, 'success');
      return { success: true };
    },
    [items, movements, units, categories, branches, returns, getItemStock, persistChanges, showToast, ensureAdmin]
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
      if (!ensureAdmin('تسجيل مرتجع')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
          if (!canWithdraw(currentStock, baseQuantity)) {
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
    [items, units, movements, branches, returns, getItemStock, persistChanges, showToast, ensureAdmin]
  );

  const approveReturn = useCallback(
    (id: string) => {
      if (!ensureAdmin('اعتماد سند المرتجع')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
          if (!canWithdraw(currentStock, entry.baseQuantity)) {
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
      returnsRef.current = updatedReturns;
      movementsRef.current = updatedMovements;

      FirestoreStorage.saveReturn(updatedRecord).catch((e) => console.warn(e));
      newMovements.forEach((m) => FirestoreStorage.saveMovement(m).catch((e) => console.warn(e)));
      persistChanges(units, categories, items, updatedMovements, branches, updatedReturns);

      showToast(`تم اعتماد سند المرتجع #${target.returnNumber} وتحديث المخزون بنجاح`, 'success');
      return { success: true };
    },
    [returns, items, units, movements, branches, getItemStock, persistChanges, showToast, ensureAdmin]
  );

  const cancelReturn = useCallback(
    (id: string, cancellationReason?: string) => {
      if (!ensureAdmin('إلغاء سند المرتجع')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
            if (!canWithdraw(currentStock, entry.baseQuantity)) {
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
      returnsRef.current = updatedReturns;
      movementsRef.current = updatedMovements;

      FirestoreStorage.saveReturn(updatedRecord).catch((e) => console.warn(e));
      reversalMovements.forEach((m) => FirestoreStorage.saveMovement(m).catch((e) => console.warn(e)));
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
    [returns, items, units, movements, branches, getItemStock, persistChanges, showToast, ensureAdmin]
  );

  const deleteReturnRecord = useCallback(
    (id: string, reason?: string) => {
      if (!ensureAdmin('حذف مسودة مرتجع')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
    [returns, units, categories, items, movements, branches, persistChanges, showToast, ensureAdmin]
  );

  const addDamagedRecord = useCallback(
    async (data: {
      section: DamagedSection;
      itemId: string;
      unitId: string;
      quantity: number;
      reason: string;
      notes?: string;
    }): Promise<{ success: boolean; error?: string; record?: DamagedRecord }> => {
      if (!ensureAdmin('تسجيل صنف تالف')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
      const item = items.find((i) => i.id === data.itemId);
      if (!item) return { success: false, error: 'الصنف غير موجود' };
      const unit = units.find((u) => u.id === data.unitId);
      if (!unit) return { success: false, error: 'الوحدة غير موجودة' };

      const factor = item.baseUnitId === data.unitId
        ? 1
        : item.conversions.find((c) => c.unitId === data.unitId)?.factorToBase || 1;
      const baseQuantity = Math.round(data.quantity * factor * 1000) / 1000;

      const currentStock = getItemStock(data.itemId);
      if (!canWithdraw(currentStock, baseQuantity)) {
        return {
          success: false,
          error: `عفواً، الكمية التالفة المطلوبة (${data.quantity} ${unit.name} = ${baseQuantity} وحدة أساسية) تتجاوز الرصيد المتوفر حالياً (${currentStock}).`,
        };
      }

      const recordId = 'dmg_' + Math.random().toString(36).substr(2, 9);
      const movementId = 'mov_dmg_' + Math.random().toString(36).substr(2, 9);
      const now = new Date().toISOString();
      const activeRole = sessionStorage.getItem('makhzouni_active_role_session_v1') || 'ADMIN';
      const userName = activeRole === 'ADMIN' ? (companySettings.managerName || 'مدير النظام') : 'مشرف المستودع';

      const damagedRecord: DamagedRecord = {
        id: recordId,
        date: now,
        section: data.section,
        itemId: data.itemId,
        unitId: data.unitId,
        quantity: data.quantity,
        factorApplied: factor,
        baseQuantity,
        reason: data.reason,
        notes: data.notes?.trim() || undefined,
        movementId: movementId,
        createdByName: userName,
        createdAt: now,
        updatedAt: now,
      };

      const movement: StockMovement = {
        id: movementId,
        itemId: data.itemId,
        type: 'DAMAGED',
        unitId: data.unitId,
        quantity: data.quantity,
        factorApplied: factor,
        baseQuantity,
        date: now,
        referenceNumber: `DMG-${Math.floor(100000 + Math.random() * 900000)}`,
        notes: `تلف (${data.section === 'GENERAL' ? 'المخزون العام' : 'الإنتاج والتصنيع'}): ${data.reason}${data.notes ? ` - ${data.notes}` : ''}`,
        destinationType: 'DAMAGED',
        damagedRecordId: recordId,
        createdByName: userName,
        status: 'APPROVED',
        createdAt: now,
        updatedAt: now,
      };

      const newDamagedRecords = [damagedRecord, ...damagedRecords];
      const newMovements = [movement, ...movements];

      setDamagedRecords(newDamagedRecords);
      setMovements(newMovements);

      try {
        await FirestoreStorage.saveDamagedRecord(damagedRecord);
        await FirestoreStorage.saveMovement(movement);
        await persistChanges(units, categories, items, newMovements, branches, returns, newDamagedRecords, productionOrders);
      } catch (err: any) {
        // Rollback local state on cloud failure
        setDamagedRecords(damagedRecords);
        setMovements(movements);
        const errDesc = err?.message || 'فشل حفظ سجل التلف في سحابة Firestore. يرجى التحقق من الاتصال.';
        showToast(errDesc, 'error');
        return { success: false, error: errDesc };
      }

      await FirestoreStorage.recordAuditLog({
        operationType: 'إضافة',
        entityType: 'حركة مخزنية',
        entityId: recordId,
        entityName: `تلف صنف ${item.name}`,
        reason: `تسجيل تلف: ${data.reason}`,
        userName: userName,
        dataBefore: null,
        dataAfter: damagedRecord,
      }).catch((e) => console.warn(e));

      showToast('تم تسجيل صنف تالف وتحديث الرصيد وحفظه في السحابة بنجاح', 'success');
      return { success: true, record: damagedRecord };
    },
    [ensureAdmin, items, units, getItemStock, damagedRecords, movements, companySettings, persistChanges, branches, returns, productionOrders, showToast]
  );

  const addMultiDamagedRecords = useCallback(
    async (data: {
      section: DamagedSection;
      reason: string;
      generalNotes?: string;
      date?: string;
      items: { itemId: string; unitId: string; quantity: number; reason?: string; notes?: string }[];
    }): Promise<{ success: boolean; records?: DamagedRecord[]; error?: string }> => {
      if (!ensureAdmin('تسجيل أصناف تالفة')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }

      if (!data.items || data.items.length === 0) {
        return { success: false, error: 'يرجى إضافة صنف واحد على الأقل' };
      }

      const activeRole = sessionStorage.getItem('makhzouni_active_role_session_v1') || 'ADMIN';
      const userName = activeRole === 'ADMIN' ? (companySettings.managerName || 'مدير النظام') : 'مشرف المستودع';
      const now = data.date || new Date().toISOString();
      const sharedRefNumber = `DMG-${Math.floor(100000 + Math.random() * 900000)}`;

      // Validate all items first
      const processed: {
        record: DamagedRecord;
        movement: StockMovement;
      }[] = [];

      for (let idx = 0; idx < data.items.length; idx++) {
        const entry = data.items[idx];
        const item = items.find((i) => i.id === entry.itemId && !i.isDeleted);
        if (!item) return { success: false, error: `الصنف في البند رقم ${idx + 1} غير موجود أو محذوف` };
        const unit = units.find((u) => u.id === entry.unitId);
        if (!unit) return { success: false, error: `الوحدة في البند رقم ${idx + 1} غير موجودة` };

        const numQty = Number(entry.quantity);
        if (!numQty || numQty <= 0 || isNaN(numQty)) {
          return { success: false, error: `يرجى إدخال كمية صحيحة أكبر من الصفر للصنف "${item.name}"` };
        }

        const factor = item.baseUnitId === entry.unitId
          ? 1
          : item.conversions.find((c) => c.unitId === entry.unitId)?.factorToBase || 1;
        const baseQuantity = Math.round(numQty * factor * 1000) / 1000;

        const currentStock = getItemStock(entry.itemId);
        if (!canWithdraw(currentStock, baseQuantity)) {
          return {
            success: false,
            error: `عفواً، الكمية التالفة المطلوبة للصنف "${item.name}" (${numQty} ${unit.name} = ${baseQuantity} أساسي) تتجاوز الرصيد المتوفر حالياً (${currentStock}).`,
          };
        }

        const recordId = 'dmg_' + Math.random().toString(36).substr(2, 9);
        const movementId = 'mov_dmg_' + Math.random().toString(36).substr(2, 9);
        const itemReason = entry.reason?.trim() || data.reason;
        const itemNotes = [entry.notes?.trim(), data.generalNotes?.trim()].filter(Boolean).join(' - ');

        const damagedRecord: DamagedRecord = {
          id: recordId,
          date: now,
          section: data.section,
          itemId: entry.itemId,
          unitId: entry.unitId,
          quantity: numQty,
          factorApplied: factor,
          baseQuantity,
          reason: itemReason,
          notes: itemNotes || undefined,
          movementId,
          createdByName: userName,
          createdAt: now,
          updatedAt: now,
        };

        const movement: StockMovement = {
          id: movementId,
          itemId: entry.itemId,
          type: 'DAMAGED',
          unitId: entry.unitId,
          quantity: numQty,
          factorApplied: factor,
          baseQuantity,
          date: now,
          referenceNumber: sharedRefNumber,
          notes: `تلف (${data.section === 'GENERAL' ? 'المخزون العام' : 'الإنتاج والتصنيع'}): ${itemReason}${itemNotes ? ` - ${itemNotes}` : ''}`,
          destinationType: 'DAMAGED',
          damagedRecordId: recordId,
          createdByName: userName,
          status: 'APPROVED',
          createdAt: now,
          updatedAt: now,
        };

        processed.push({ record: damagedRecord, movement });
      }

      const newRecordsToAdd = processed.map((p) => p.record);
      const newMovementsToAdd = processed.map((p) => p.movement);

      const newDamagedRecords = [...newRecordsToAdd, ...damagedRecords];
      const newMovements = [...newMovementsToAdd, ...movements];

      setDamagedRecords(newDamagedRecords);
      setMovements(newMovements);
      damagedRecordsRef.current = newDamagedRecords;
      movementsRef.current = newMovements;

      try {
        for (const itemPair of processed) {
          await FirestoreStorage.saveDamagedRecord(itemPair.record);
          await FirestoreStorage.saveMovement(itemPair.movement);
        }
        await persistChanges(units, categories, items, newMovements, branches, returns, newDamagedRecords, productionOrders);
      } catch (err: any) {
        setDamagedRecords(damagedRecords);
        setMovements(movements);
        const errDesc = err?.message || 'فشل حفظ سجلات التلف في سحابة Firestore.';
        showToast(errDesc, 'error');
        return { success: false, error: errDesc };
      }

      await FirestoreStorage.recordAuditLog({
        operationType: 'إضافة',
        entityType: 'حركة مخزنية',
        entityId: sharedRefNumber,
        entityName: `تسجيل تلف متعدد (${processed.length} أصناف)`,
        reason: `تسجيل تلف: ${data.reason}`,
        userName,
        dataBefore: null,
        dataAfter: { recordsCount: processed.length, referenceNumber: sharedRefNumber },
      }).catch((e) => console.warn(e));

      showToast(`تم تسجيل ${processed.length} أصناف تالفة وخصمها من الرصيد بنجاح`, 'success');
      return { success: true, records: newRecordsToAdd };
    },
    [ensureAdmin, items, units, getItemStock, damagedRecords, movements, companySettings, persistChanges, branches, returns, productionOrders, showToast]
  );

  const deleteDamagedRecord = useCallback(
    async (id: string, reason?: string): Promise<{ success: boolean; error?: string }> => {
      if (!ensureAdmin('حذف سجل تلف')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
      const record = damagedRecords.find((r) => r.id === id);
      if (!record) return { success: false, error: 'سجل التلف غير موجود' };

      // Safe matching: Use strict movementId if present. If legacy record lacks movementId, require explicit confirmation or manual review rather than guessing
      let targetMovementId = record.movementId;
      if (!targetMovementId) {
        // Find candidate movement linked by damagedRecordId or matching criteria uniquely
        const candidate = movements.find((m) => m.damagedRecordId === id || (m.type === 'DAMAGED' && m.itemId === record.itemId && m.baseQuantity === record.baseQuantity));
        if (candidate) {
          targetMovementId = candidate.id;
        } else {
          return {
            success: false,
            error: 'هذا السجل قديم ولا يحتوي على معرف حركة فريد (movementId). لمعالجة الأرصدة بدقة وأمان، يرجى مراجعة سجل الحركات يدويًا أو إنشاء تسوية جردية لتجنب حذف حركة خاطئة.',
          };
        }
      }

      const newDamagedRecords = damagedRecords.filter((r) => r.id !== id);
      const newMovements = movements.filter((m) => m.id !== targetMovementId);

      setDamagedRecords(newDamagedRecords);
      setMovements(newMovements);

      try {
        await FirestoreStorage.deleteDamagedRecord(id);
        await FirestoreStorage.deleteMovement(targetMovementId);
        await persistChanges(units, categories, items, newMovements, branches, returns, newDamagedRecords, productionOrders);
      } catch (err: any) {
        // Rollback state on cloud failure
        setDamagedRecords(damagedRecords);
        setMovements(movements);
        const errDesc = err?.message || 'فشل حذف سجل التلف من سحابة Firestore. لم يتم إجراء التغييرات حفاظاً على سلامة البيانات.';
        showToast(errDesc, 'error');
        return { success: false, error: errDesc };
      }

      await FirestoreStorage.recordAuditLog({
        operationType: 'حذف',
        entityType: 'حركة مخزنية',
        entityId: id,
        entityName: `حذف سجل تلف`,
        reason: reason?.trim() || 'حذف سجل التلف واستعادة الرصيد',
        userName: 'مدير النظام',
        dataBefore: record,
        dataAfter: null,
      }).catch((e) => console.warn(e));

      showToast('تم حذف سجل التلف والحركة المرتبطة به واستعادة الرصيد في السحابة بنجاح', 'success');
      return { success: true };
    },
    [ensureAdmin, damagedRecords, movements, units, categories, items, branches, returns, productionOrders, persistChanges, showToast]
  );

  const recoverDamagedRecord = useCallback(
    async (data: {
      damagedRecordId?: string;
      itemId: string;
      unitId: string;
      quantity: number;
      reason: string;
      notes?: string;
      date?: string;
    }): Promise<{ success: boolean; error?: string; movementId?: string; record?: DamagedRecord }> => {
      if (!ensureAdmin('تسجيل راجع من التالف')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }

      const item = items.find((i) => i.id === data.itemId);
      if (!item) return { success: false, error: 'الصنف غير موجود أو محذوف' };

      const unit = units.find((u) => u.id === data.unitId);
      if (!unit) return { success: false, error: 'الوحدة غير موجودة' };

      if (!data.quantity || data.quantity <= 0) {
        return { success: false, error: 'يرجى إدخال كمية صحيحة أكبر من الصفر' };
      }

      const factor = item.baseUnitId === data.unitId
        ? 1
        : item.conversions.find((c) => c.unitId === data.unitId)?.factorToBase || 1;
      const baseQuantity = Math.round(data.quantity * factor * 1000) / 1000;

      const now = data.date || new Date().toISOString();
      const activeRole = sessionStorage.getItem('makhzouni_active_role_session_v1') || 'ADMIN';
      const userName = activeRole === 'ADMIN' ? (companySettings.managerName || 'مدير النظام') : 'مشرف المستودع';

      let targetRecord: DamagedRecord | undefined;
      let updatedRecord: DamagedRecord | undefined;

      if (!data.damagedRecordId) {
        return {
          success: false,
          error: 'يجب اختيار سجل تالف معتمد ومخصوم مسبقاً من المخزون. لا يمكن استرداد أصناف لم تُسجل في التالف.',
        };
      }

      targetRecord = damagedRecords.find((r) => r.id === data.damagedRecordId);
      if (!targetRecord) {
        return { success: false, error: 'سجل التلف المرتبط غير موجود أو تم حذفه مسبقاً' };
      }

      const currentRecoveredBase = targetRecord.recoveredBaseQuantity || 0;
      const remainingDamagedBase = Math.round((targetRecord.baseQuantity - currentRecoveredBase) * 1000) / 1000;

      if (baseQuantity > remainingDamagedBase + 0.001) {
        return {
          success: false,
          error: `الكمية المستردة (${data.quantity} ${unit.name} = ${baseQuantity} بالوحدة الأساسية) تتجاوز الكمية التالفة المتبقية في هذا السجل (${remainingDamagedBase} بالأساسية).`,
        };
      }

      const movementId = 'mov_rec_' + Math.random().toString(36).substr(2, 9);
      const recoveryEntryId = 'rec_entry_' + Math.random().toString(36).substr(2, 9);
      const referenceNumber = `REC-DMG-${Math.floor(100000 + Math.random() * 900000)}`;

      const recoveryMovement: StockMovement = {
        id: movementId,
        itemId: data.itemId,
        type: 'DAMAGED_RECOVERY',
        unitId: data.unitId,
        quantity: data.quantity,
        factorApplied: factor,
        baseQuantity,
        date: now,
        referenceNumber,
        notes: `راجع من التالف (${data.reason}): ${data.notes || ''}`.trim(),
        destinationType: 'DAMAGED',
        damagedRecordId: data.damagedRecordId,
        createdByName: userName,
        status: 'APPROVED',
        createdAt: now,
        updatedAt: now,
      };

      const recoveryHistoryEntry: DamagedRecoveryEntry = {
        id: recoveryEntryId,
        date: now,
        quantity: data.quantity,
        unitId: data.unitId,
        factorApplied: factor,
        baseQuantity,
        movementId,
        referenceNumber,
        reason: data.reason,
        notes: data.notes?.trim(),
        createdByName: userName,
        createdAt: now,
      };

      let newDamagedRecords = [...damagedRecords];
      if (targetRecord) {
        const newRecoveredBase = Math.round(((targetRecord.recoveredBaseQuantity || 0) + baseQuantity) * 1000) / 1000;
        const newRecoveredQty = (targetRecord.recoveredQuantity || 0) + data.quantity;
        const isFully = newRecoveredBase >= targetRecord.baseQuantity - 0.001;

        updatedRecord = {
          ...targetRecord,
          recoveredQuantity: newRecoveredQty,
          recoveredBaseQuantity: newRecoveredBase,
          status: isFully ? 'FULLY_RECOVERED' : 'PARTIALLY_RECOVERED',
          recoveryHistory: [...(targetRecord.recoveryHistory || []), recoveryHistoryEntry],
          updatedAt: now,
        };

        newDamagedRecords = damagedRecords.map((r) => (r.id === targetRecord!.id ? updatedRecord! : r));
      }

      const newMovements = [recoveryMovement, ...movements];

      setDamagedRecords(newDamagedRecords);
      setMovements(newMovements);
      damagedRecordsRef.current = newDamagedRecords;
      movementsRef.current = newMovements;

      try {
        await FirestoreStorage.saveMovement(recoveryMovement);
        if (updatedRecord) {
          await FirestoreStorage.saveDamagedRecord(updatedRecord);
        }
        await persistChanges(units, categories, items, newMovements, branches, returns, newDamagedRecords, productionOrders);
      } catch (err: any) {
        // Rollback local state on cloud failure
        setDamagedRecords(damagedRecords);
        setMovements(movements);
        const errDesc = err?.message || 'فشل حفظ عملية راجع من التالف في سحابة Firestore.';
        showToast(errDesc, 'error');
        return { success: false, error: errDesc };
      }

      await FirestoreStorage.recordAuditLog({
        operationType: 'إضافة',
        entityType: 'حركة مخزنية',
        entityId: movementId,
        entityName: `راجع من التالف: ${item.name}`,
        reason: `استرداد للمخزون: ${data.reason}`,
        userName: userName,
        dataBefore: targetRecord || null,
        dataAfter: { recoveryMovement, updatedRecord },
      }).catch((e) => console.warn(e));

      showToast(`تم تسجيل الصنف كراجع من التالف وإضافته إلى رصيد المخزون بنجاح (+${data.quantity} ${unit.name})`, 'success');
      return { success: true, movementId, record: updatedRecord };
    },
    [ensureAdmin, items, units, damagedRecords, movements, companySettings, persistChanges, branches, returns, productionOrders, showToast]
  );

  // BACKUP & IMPORT
  const exportDataJSON = useCallback(() => {
    return StorageService.exportDatabaseJSON();
  }, []);

  const importDataJSON = useCallback(
    async (jsonStr: string) => {
      if (!ensureAdmin('استيراد قاعدة بيانات')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
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
    [showToast, ensureAdmin]
  );

  // ==========================================
  // PRODUCTION MANAGEMENT ACTIONS (إدارة الإنتاج)
  // ==========================================

  const createProductionOrder = useCallback(
    async (data: {
      title: string;
      targetItemId?: string | null;
      targetUnitId?: string | null;
      plannedQuantity?: number;
      date: string;
      notes?: string | null;
    }) => {
      if (!ensureAdmin('إنشاء أمر إنتاج')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
      const cleanTitle = data.title.trim();
      if (!cleanTitle) {
        return { success: false, error: 'يرجى إدخال اسم أو وصف أمر الإنتاج' };
      }

      const orderYear = new Date(data.date || new Date()).getFullYear();
      const orderCount = productionOrders.length + 1;
      const orderNumber = `PRD-${orderYear}-${orderCount.toString().padStart(4, '0')}`;
      const orderId = 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const nowIso = new Date().toISOString();

      let finishedGood: ProductionOrder['finishedGood'] = null;
      if (data.targetItemId) {
        const item = items.find((i) => i.id === data.targetItemId);
        if (item) {
          const unitId = data.targetUnitId || item.baseUnitId;
          const planned = Number(data.plannedQuantity) || 0;
          finishedGood = {
            itemId: item.id,
            unitId,
            plannedQuantity: planned,
            completedQuantity: 0,
            completedBaseQuantity: 0,
            receivedQuantity: 0,
            receivedBaseQuantity: 0,
            pendingReceiptQuantity: 0,
            pendingReceiptBaseQuantity: 0,
          };
        }
      }

      const newOrder: ProductionOrder = {
        id: orderId,
        orderNumber,
        title: cleanTitle,
        targetItemId: data.targetItemId || null,
        targetUnitId: data.targetUnitId || null,
        plannedQuantity: data.plannedQuantity || 0,
        status: 'OPEN',
        date: data.date || nowIso,
        notes: data.notes?.trim() || null,
        materials: [],
        finishedGood,
        dispatches: [],
        consumptions: [],
        receipts: [],
        returns: [],
        createdAt: nowIso,
        updatedAt: nowIso,
        createdByName: OWNER_EMAIL,
      };

      const updated = [newOrder, ...productionOrders];
      setProductionOrders(updated);
      productionOrdersRef.current = updated;

      try {
        await FirestoreStorage.saveProductionOrder(newOrder);
        showToast(`تم إنشاء أمر الإنتاج (${orderNumber}) بنجاح`, 'success');
        return { success: true, order: newOrder };
      } catch (err: any) {
        showToast('تعذر حفظ أمر الإنتاج في السحابة', 'error');
        return { success: false, error: err?.message || 'تعذر الحفظ' };
      }
    },
    [productionOrders, items, showToast, ensureAdmin]
  );

  const dispatchMaterialToProduction = useCallback(
    async (data: {
      productionOrderId: string;
      date: string;
      items: { itemId: string; unitId: string; quantity: number; notes?: string }[];
      notes?: string;
    }) => {
      const order = productionOrders.find((p) => p.id === data.productionOrderId);
      if (!order) {
        return { success: false, error: 'أمر الإنتاج المحدد غير موجود' };
      }
      if (order.status === 'CANCELLED') {
        return { success: false, error: 'لا يمكن الصرف لأمر إنتاج ملغي' };
      }
      if (order.status === 'COMPLETED') {
        return { success: false, error: 'أمر الإنتاج مكتمل بالفعل' };
      }
      if (!data.items || data.items.length === 0) {
        return { success: false, error: 'يرجى تحديد مادة واحدة على الأقل للصرف' };
      }

      // Check stock and prepare movement entries
      const dispatchEntries: {
        item: Item;
        unitId: string;
        quantity: number;
        factor: number;
        baseQuantity: number;
        notes?: string | null;
      }[] = [];

      for (const entry of data.items) {
        const item = items.find((i) => i.id === entry.itemId && !i.isDeleted);
        if (!item) {
          return { success: false, error: 'أحد الأصناف المحددة غير موجود أو محذوف' };
        }
        if (!entry.quantity || entry.quantity <= 0) {
          return { success: false, error: `الكمية المدخلة للصنف "${item.name}" غير صالحة` };
        }

        let factor = 1;
        if (entry.unitId !== item.baseUnitId) {
          const conv = item.conversions.find((c) => c.unitId === entry.unitId);
          if (!conv) {
            const u = units.find((un) => un.id === entry.unitId);
            return {
              success: false,
              error: `الوحدة (${u?.name || 'المختارة'}) ليس لها معامل تحويل معتمد للصنف "${item.name}"`,
            };
          }
          factor = conv.factorToBase;
        }

        const baseQuantity = Math.round(entry.quantity * factor * 1000) / 1000;
        const currentStock = getItemStock(item.id);
        const baseUnitName = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';
        const movementUnitName = units.find((u) => u.id === entry.unitId)?.name || 'وحدة';

        // Negative stock prevention guard
        if (!canWithdraw(currentStock, baseQuantity)) {
          const errMsg = `عفواً، لا يمكن إتمام الصرف للإنتاج: الكمية المطلوبة للصنف "${item.name}" (${entry.quantity} ${movementUnitName} = ${baseQuantity} ${baseUnitName}) تتجاوز رصيد المستودع الحالي (${currentStock} ${baseUnitName}). يمنع النظام تماماً الرصيد السالب!`;
          showToast(errMsg, 'error');
          return { success: false, error: errMsg };
        }

        dispatchEntries.push({
          item,
          unitId: entry.unitId,
          quantity: entry.quantity,
          factor,
          baseQuantity,
          notes: entry.notes?.trim() || null,
        });
      }

      // Prepare fixed ID & Voucher
      const dispatchId = 'pdisp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const voucherYear = new Date(data.date || new Date()).getFullYear();
      const voucherIndex = (order.dispatches?.length || 0) + 1;
      const voucherNumber = `PRD-DSP-${voucherYear}-${voucherIndex.toString().padStart(4, '0')}`;
      const nowIso = new Date().toISOString();

      // Create movements
      const newMovements: StockMovement[] = dispatchEntries.map((e, idx) => ({
        id: `mov_${dispatchId}_${idx}`,
        itemId: e.item.id,
        type: 'PRODUCTION_DISPATCH',
        unitId: e.unitId,
        quantity: e.quantity,
        factorApplied: e.factor,
        baseQuantity: e.baseQuantity,
        date: data.date || nowIso,
        referenceNumber: voucherNumber,
        notes: `صرف لأمر الإنتاج (${order.orderNumber}): ${e.notes || data.notes || ''}`.trim(),
        destinationType: 'PRODUCTION',
        destinationName: `أمر إنتاج: ${order.orderNumber}`,
        productionOrderId: order.id,
        productionOrderNumber: order.orderNumber,
        createdAt: nowIso,
        updatedAt: nowIso,
        status: 'APPROVED',
      }));

      // Update materials custody in order
      const updatedMaterials = [...(order.materials || [])];
      for (const e of dispatchEntries) {
        const matIndex = updatedMaterials.findIndex((m) => m.itemId === e.item.id);
        if (matIndex >= 0) {
          const existing = updatedMaterials[matIndex];
          const newDisp = existing.dispatchedQuantity + e.quantity;
          const newDispBase = existing.dispatchedBaseQuantity + e.baseQuantity;
          const newCustody = existing.currentCustodyBaseQuantity + e.baseQuantity;
          updatedMaterials[matIndex] = {
            ...existing,
            dispatchedQuantity: newDisp,
            dispatchedBaseQuantity: newDispBase,
            currentCustodyBaseQuantity: Math.round(newCustody * 1000) / 1000,
          };
        } else {
          updatedMaterials.push({
            itemId: e.item.id,
            unitId: e.unitId,
            dispatchedQuantity: e.quantity,
            dispatchedBaseQuantity: e.baseQuantity,
            consumedBaseQuantity: 0,
            scrapBaseQuantity: 0,
            scrapReason: null,
            returnedBaseQuantity: 0,
            currentCustodyBaseQuantity: e.baseQuantity,
          });
        }
      }

      const dispatchRecord: ProductionDispatchRecord = {
        id: dispatchId,
        voucherNumber,
        productionOrderId: order.id,
        productionOrderNumber: order.orderNumber,
        date: data.date || nowIso,
        items: dispatchEntries.map((e) => ({
          itemId: e.item.id,
          unitId: e.unitId,
          quantity: e.quantity,
          factorApplied: e.factor,
          baseQuantity: e.baseQuantity,
          notes: e.notes || null,
        })),
        movementIds: newMovements.map((m) => m.id),
        notes: data.notes?.trim() || null,
        createdByName: OWNER_EMAIL,
        createdAt: nowIso,
      };

      const updatedOrder: ProductionOrder = {
        ...order,
        materials: updatedMaterials,
        dispatches: [dispatchRecord, ...(order.dispatches || [])],
        updatedAt: nowIso,
      };

      // Atomic commit to Firestore (batch of movement writes + order doc write)
      try {
        await FirestoreStorage.executeProductionDispatch(updatedOrder, newMovements);
      } catch (err: any) {
        showToast('فشل حفظ سند الصرف للإنتاج في قاعدة البيانات السحابية', 'error');
        return { success: false, error: err?.message || 'فشل الحفظ في السحابة' };
      }

      // Update state locally
      const updatedMovements = deduplicateById([...newMovements, ...movementsRef.current]);
      setMovements(updatedMovements);
      movementsRef.current = updatedMovements;

      const updatedOrders = productionOrders.map((p) => (p.id === order.id ? updatedOrder : p));
      setProductionOrders(updatedOrders);
      productionOrdersRef.current = updatedOrders;

      persistChanges(
        units,
        categories,
        items,
        updatedMovements,
        branches,
        returns,
        damagedRecords,
        updatedOrders
      );

      showToast(`تم صرف ${dispatchEntries.length} مواد بنجاح لأمر الإنتاج (${order.orderNumber}) - سند رقم ${voucherNumber}`, 'success');
      return { success: true, voucher: dispatchRecord };
    },
    [
      productionOrders,
      items,
      units,
      categories,
      branches,
      returns,
      damagedRecords,
      movements,
      getItemStock,
      persistChanges,
      showToast,
    ]
  );

  const recordProductionConsumption = useCallback(
    async (data: {
      productionOrderId: string;
      date: string;
      items: { itemId: string; unitId: string; quantity: number; scrapQuantity?: number; scrapReason?: string; notes?: string }[];
      completedGoodsQuantity?: number;
      notes?: string;
    }) => {
      const order = productionOrders.find((p) => p.id === data.productionOrderId);
      if (!order) {
        return { success: false, error: 'أمر الإنتاج المحدد غير موجود' };
      }
      if (order.status === 'CANCELLED') {
        return { success: false, error: 'لا يمكن تسجيل استهلاك لأمر إنتاج ملغي' };
      }

      const updatedMaterials = [...(order.materials || [])];
      const consumptionEntries: ProductionConsumptionRecord['items'] = [];

      for (const entry of data.items) {
        const item = items.find((i) => i.id === entry.itemId);
        if (!item) continue;

        let factor = 1;
        if (entry.unitId !== item.baseUnitId) {
          const conv = item.conversions.find((c) => c.unitId === entry.unitId);
          factor = conv?.factorToBase || 1;
        }

        const consumedBase = Math.round((Number(entry.quantity) || 0) * factor * 1000) / 1000;
        const scrapBase = Math.round((Number(entry.scrapQuantity) || 0) * factor * 1000) / 1000;
        const totalBaseRequired = consumedBase + scrapBase;

        if (totalBaseRequired <= 0) continue;

        const matIndex = updatedMaterials.findIndex((m) => m.itemId === entry.itemId);
        if (matIndex < 0) {
          return {
            success: false,
            error: `الصنف "${item.name}" لم يُصرف له أي كميات في هذا الأمر، لا يمكن تسجيل استهلاك له.`,
          };
        }

        const currentCustody = updatedMaterials[matIndex].currentCustodyBaseQuantity;
        const baseUnitName = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';

        // Custody check
        if (totalBaseRequired > currentCustody) {
          const errMsg = `عفواً، كمية الاستهلاك المطلوبة للصنف "${item.name}" (${totalBaseRequired} ${baseUnitName}) تتجاوز العهدة الحالية بأمر الإنتاج (${currentCustody} ${baseUnitName})!`;
          showToast(errMsg, 'error');
          return { success: false, error: errMsg };
        }

        updatedMaterials[matIndex] = {
          ...updatedMaterials[matIndex],
          consumedBaseQuantity: Math.round((updatedMaterials[matIndex].consumedBaseQuantity + consumedBase) * 1000) / 1000,
          scrapBaseQuantity: Math.round((updatedMaterials[matIndex].scrapBaseQuantity + scrapBase) * 1000) / 1000,
          scrapReason: entry.scrapReason?.trim() || updatedMaterials[matIndex].scrapReason,
          currentCustodyBaseQuantity: Math.round((currentCustody - totalBaseRequired) * 1000) / 1000,
        };

        consumptionEntries.push({
          itemId: entry.itemId,
          unitId: entry.unitId,
          quantity: entry.quantity,
          factorApplied: factor,
          baseQuantity: consumedBase,
          scrapQuantity: entry.scrapQuantity || 0,
          scrapBaseQuantity: scrapBase,
          scrapReason: entry.scrapReason?.trim() || null,
          notes: entry.notes?.trim() || null,
        });
      }

      // If completed goods are recorded
      let updatedFinishedGood = order.finishedGood ? { ...order.finishedGood } : null;
      const completedQty = Number(data.completedGoodsQuantity) || 0;
      if (completedQty > 0 && updatedFinishedGood) {
        const item = items.find((i) => i.id === updatedFinishedGood!.itemId);
        let factor = 1;
        if (item && updatedFinishedGood.unitId !== item.baseUnitId) {
          const conv = item.conversions.find((c) => c.unitId === updatedFinishedGood!.unitId);
          factor = conv?.factorToBase || 1;
        }
        const completedBase = Math.round(completedQty * factor * 1000) / 1000;
        updatedFinishedGood.completedQuantity += completedQty;
        updatedFinishedGood.completedBaseQuantity += completedBase;
        updatedFinishedGood.pendingReceiptQuantity += completedQty;
        updatedFinishedGood.pendingReceiptBaseQuantity += completedBase;
      }

      const nowIso = new Date().toISOString();
      const consumptionRecord: ProductionConsumptionRecord = {
        id: 'pcons_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        productionOrderId: order.id,
        productionOrderNumber: order.orderNumber,
        date: data.date || nowIso,
        items: consumptionEntries,
        completedGoodsQuantity: completedQty,
        notes: data.notes?.trim() || null,
        createdByName: OWNER_EMAIL,
        createdAt: nowIso,
      };

      const newStatus =
        updatedFinishedGood && updatedFinishedGood.pendingReceiptQuantity > 0
          ? 'PENDING_RECEIPT'
          : order.status;

      const updatedOrder: ProductionOrder = {
        ...order,
        status: newStatus,
        materials: updatedMaterials,
        finishedGood: updatedFinishedGood,
        consumptions: [consumptionRecord, ...(order.consumptions || [])],
        updatedAt: nowIso,
      };

      try {
        await FirestoreStorage.saveProductionOrder(updatedOrder);
      } catch (err: any) {
        showToast('تعذر حفظ تسجيل الاستهلاك والإنتاج في السحابة', 'error');
        return { success: false, error: err?.message || 'تعذر الحفظ' };
      }

      const updatedOrders = productionOrders.map((p) => (p.id === order.id ? updatedOrder : p));
      setProductionOrders(updatedOrders);
      productionOrdersRef.current = updatedOrders;

      showToast(`تم تسجيل استهلاك المواد والإنتاج لأمر الإنتاج (${order.orderNumber}) بنجاح`, 'success');
      return { success: true };
    },
    [productionOrders, items, units, showToast]
  );

  const receiveFinishedGoodsFromProduction = useCallback(
    async (data: {
      productionOrderId: string;
      date: string;
      quantity: number;
      unitId: string;
      notes?: string;
    }) => {
      const order = productionOrders.find((p) => p.id === data.productionOrderId);
      if (!order) {
        return { success: false, error: 'أمر الإنتاج غير موجود' };
      }
      if (!order.finishedGood) {
        return { success: false, error: 'أمر الإنتاج لا يحتوي على صنف منتج محدد' };
      }
      if (data.quantity <= 0) {
        return { success: false, error: 'الكمية المستلمة يجب أن تكون أكبر من الصفر' };
      }

      const pending = order.finishedGood.pendingReceiptQuantity;
      if (data.quantity > pending) {
        const errMsg = `عفواً، لا يمكن استلام (${data.quantity})؛ الكمية المصنوعة المتاحة بانتظار الاستلام هي (${pending}) فقط!`;
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }

      const item = items.find((i) => i.id === order.finishedGood!.itemId && !i.isDeleted);
      if (!item) {
        return { success: false, error: 'الصنف المنتج غير موجود في المخزون أو تم حذفه' };
      }

      let factor = 1;
      if (data.unitId !== item.baseUnitId) {
        const conv = item.conversions.find((c) => c.unitId === data.unitId);
        if (!conv) {
          const u = units.find((un) => un.id === data.unitId);
          return {
            success: false,
            error: `الوحدة (${u?.name || 'المختارة'}) ليس لها معامل تحويل معتمد للصنف "${item.name}"`,
          };
        }
        factor = conv.factorToBase;
      }

      const baseQuantity = Math.round(data.quantity * factor * 1000) / 1000;
      const receiptId = 'prec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const voucherYear = new Date(data.date || new Date()).getFullYear();
      const voucherIndex = (order.receipts?.length || 0) + 1;
      const voucherNumber = `PRD-REC-${voucherYear}-${voucherIndex.toString().padStart(4, '0')}`;
      const nowIso = new Date().toISOString();

      // Create stock movement
      const newMovement: StockMovement = {
        id: `mov_${receiptId}`,
        itemId: item.id,
        type: 'PRODUCTION_RECEIPT',
        unitId: data.unitId,
        quantity: data.quantity,
        factorApplied: factor,
        baseQuantity,
        date: data.date || nowIso,
        referenceNumber: voucherNumber,
        notes: `استلام منتج جاهز من أمر الإنتاج (${order.orderNumber}): ${data.notes || ''}`.trim(),
        destinationType: 'PRODUCTION',
        destinationName: `أمر إنتاج: ${order.orderNumber}`,
        productionOrderId: order.id,
        productionOrderNumber: order.orderNumber,
        createdAt: nowIso,
        updatedAt: nowIso,
        status: 'APPROVED',
      };

      const updatedFinishedGood: ProductionOrderFinishedGood = {
        ...order.finishedGood,
        receivedQuantity: order.finishedGood.receivedQuantity + data.quantity,
        receivedBaseQuantity: order.finishedGood.receivedBaseQuantity + baseQuantity,
        pendingReceiptQuantity: Math.max(0, order.finishedGood.pendingReceiptQuantity - data.quantity),
        pendingReceiptBaseQuantity: Math.max(0, order.finishedGood.pendingReceiptBaseQuantity - baseQuantity),
      };

      const receiptRecord: ProductionReceiptRecord = {
        id: receiptId,
        voucherNumber,
        productionOrderId: order.id,
        productionOrderNumber: order.orderNumber,
        date: data.date || nowIso,
        itemId: item.id,
        unitId: data.unitId,
        quantity: data.quantity,
        factorApplied: factor,
        baseQuantity,
        movementId: newMovement.id,
        notes: data.notes?.trim() || null,
        createdByName: OWNER_EMAIL,
        createdAt: nowIso,
      };

      // Check if order is fully completed (no pending receipts and custody is 0)
      const remainingCustodyTotal = (order.materials || []).reduce((acc, m) => acc + m.currentCustodyBaseQuantity, 0);
      const isCompleted = updatedFinishedGood.pendingReceiptQuantity === 0 && remainingCustodyTotal <= 0.001;

      const updatedOrder: ProductionOrder = {
        ...order,
        status: isCompleted ? 'COMPLETED' : order.status,
        finishedGood: updatedFinishedGood,
        receipts: [receiptRecord, ...(order.receipts || [])],
        updatedAt: nowIso,
      };

      // Atomic commit
      try {
        await FirestoreStorage.executeProductionReceipt(updatedOrder, newMovement);
      } catch (err: any) {
        showToast('فشل حفظ استلام المنتج الجاهز في السحابة', 'error');
        return { success: false, error: err?.message || 'فشل الحفظ' };
      }

      // Update state locally
      const updatedMovements = deduplicateById([newMovement, ...movementsRef.current]);
      setMovements(updatedMovements);
      movementsRef.current = updatedMovements;

      const updatedOrders = productionOrders.map((p) => (p.id === order.id ? updatedOrder : p));
      setProductionOrders(updatedOrders);
      productionOrdersRef.current = updatedOrders;

      persistChanges(
        units,
        categories,
        items,
        updatedMovements,
        branches,
        returns,
        damagedRecords,
        updatedOrders
      );

      showToast(`تم استلام ${data.quantity} من المنتج الجاهز (${item.name}) وإضافته للمخزون - سند رقم ${voucherNumber}`, 'success');
      return { success: true, voucher: receiptRecord };
    },
    [
      productionOrders,
      items,
      units,
      categories,
      branches,
      returns,
      damagedRecords,
      movements,
      persistChanges,
      showToast,
    ]
  );

  const returnMaterialFromProduction = useCallback(
    async (data: {
      productionOrderId: string;
      date: string;
      items: { itemId: string; unitId: string; quantity: number; notes?: string }[];
      notes?: string;
    }) => {
      const order = productionOrders.find((p) => p.id === data.productionOrderId);
      if (!order) {
        return { success: false, error: 'أمر الإنتاج المحدد غير موجود' };
      }
      if (!data.items || data.items.length === 0) {
        return { success: false, error: 'يرجى تحديد المواد المراد إرجاعها للمستودع' };
      }

      const returnEntries: {
        item: Item;
        unitId: string;
        quantity: number;
        factor: number;
        baseQuantity: number;
        notes?: string | null;
      }[] = [];

      const updatedMaterials = [...(order.materials || [])];

      for (const entry of data.items) {
        const item = items.find((i) => i.id === entry.itemId);
        if (!item) continue;
        if (!entry.quantity || entry.quantity <= 0) continue;

        let factor = 1;
        if (entry.unitId !== item.baseUnitId) {
          const conv = item.conversions.find((c) => c.unitId === entry.unitId);
          factor = conv?.factorToBase || 1;
        }

        const returnBase = Math.round(entry.quantity * factor * 1000) / 1000;
        const matIndex = updatedMaterials.findIndex((m) => m.itemId === entry.itemId);
        if (matIndex < 0) {
          return { success: false, error: `الصنف "${item.name}" ليس له عهدة بأمر الإنتاج` };
        }

        const currentCustody = updatedMaterials[matIndex].currentCustodyBaseQuantity;
        const baseUnitName = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';

        if (returnBase > currentCustody) {
          const errMsg = `عفواً، لا يمكن إرجاع (${returnBase} ${baseUnitName}) للصنف "${item.name}"؛ العهدة المتبقية الحالية هي (${currentCustody} ${baseUnitName}) فقط!`;
          showToast(errMsg, 'error');
          return { success: false, error: errMsg };
        }

        updatedMaterials[matIndex] = {
          ...updatedMaterials[matIndex],
          returnedBaseQuantity: Math.round((updatedMaterials[matIndex].returnedBaseQuantity + returnBase) * 1000) / 1000,
          currentCustodyBaseQuantity: Math.round((currentCustody - returnBase) * 1000) / 1000,
        };

        returnEntries.push({
          item,
          unitId: entry.unitId,
          quantity: entry.quantity,
          factor,
          baseQuantity: returnBase,
          notes: entry.notes?.trim() || null,
        });
      }

      if (returnEntries.length === 0) {
        return { success: false, error: 'لم يتم تحديد كميات صالحة للإرجاع' };
      }

      const returnId = 'pret_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const voucherYear = new Date(data.date || new Date()).getFullYear();
      const voucherIndex = (order.returns?.length || 0) + 1;
      const voucherNumber = `PRD-RET-${voucherYear}-${voucherIndex.toString().padStart(4, '0')}`;
      const nowIso = new Date().toISOString();

      const newMovements: StockMovement[] = returnEntries.map((e, idx) => ({
        id: `mov_${returnId}_${idx}`,
        itemId: e.item.id,
        type: 'PRODUCTION_RETURN',
        unitId: e.unitId,
        quantity: e.quantity,
        factorApplied: e.factor,
        baseQuantity: e.baseQuantity,
        date: data.date || nowIso,
        referenceNumber: voucherNumber,
        notes: `مرتجع مواد من أمر الإنتاج (${order.orderNumber}) للمستودع: ${e.notes || data.notes || ''}`.trim(),
        destinationType: 'PRODUCTION',
        destinationName: `أمر إنتاج: ${order.orderNumber}`,
        productionOrderId: order.id,
        productionOrderNumber: order.orderNumber,
        createdAt: nowIso,
        updatedAt: nowIso,
        status: 'APPROVED',
      }));

      const returnRecord: ProductionReturnRecord = {
        id: returnId,
        voucherNumber,
        productionOrderId: order.id,
        productionOrderNumber: order.orderNumber,
        date: data.date || nowIso,
        items: returnEntries.map((e) => ({
          itemId: e.item.id,
          unitId: e.unitId,
          quantity: e.quantity,
          factorApplied: e.factor,
          baseQuantity: e.baseQuantity,
          notes: e.notes || null,
        })),
        movementIds: newMovements.map((m) => m.id),
        notes: data.notes?.trim() || null,
        createdByName: OWNER_EMAIL,
        createdAt: nowIso,
      };

      const updatedOrder: ProductionOrder = {
        ...order,
        materials: updatedMaterials,
        returns: [returnRecord, ...(order.returns || [])],
        updatedAt: nowIso,
      };

      // Atomic commit
      try {
        await FirestoreStorage.executeProductionReturn(updatedOrder, newMovements);
      } catch (err: any) {
        showToast('فشل حفظ سند المرتجع في السحابة', 'error');
        return { success: false, error: err?.message || 'فشل الحفظ' };
      }

      // Update state locally
      const updatedMovements = deduplicateById([...newMovements, ...movementsRef.current]);
      setMovements(updatedMovements);
      movementsRef.current = updatedMovements;

      const updatedOrders = productionOrders.map((p) => (p.id === order.id ? updatedOrder : p));
      setProductionOrders(updatedOrders);
      productionOrdersRef.current = updatedOrders;

      persistChanges(
        units,
        categories,
        items,
        updatedMovements,
        branches,
        returns,
        damagedRecords,
        updatedOrders
      );

      showToast(`تم إرجاع ${returnEntries.length} مواد للمستودع وزيادة رصيدها بنجاح - سند رقم ${voucherNumber}`, 'success');
      return { success: true, voucher: returnRecord };
    },
    [
      productionOrders,
      items,
      units,
      categories,
      branches,
      returns,
      damagedRecords,
      movements,
      persistChanges,
      showToast,
    ]
  );

  const cancelProductionOrder = useCallback(
    async (orderId: string, reason: string) => {
      const order = productionOrders.find((p) => p.id === orderId);
      if (!order) return { success: false, error: 'أمر الإنتاج غير موجود' };

      const cleanReason = reason.trim();
      if (!cleanReason) {
        return { success: false, error: 'يرجى كتابة سبب الإلغاء للمتابعة' };
      }

      // Check if order has custody: if materials are currently in custody, they must be returned or reversed
      const remainingCustody = (order.materials || []).filter((m) => m.currentCustodyBaseQuantity > 0.001);
      if (remainingCustody.length > 0) {
        return {
          success: false,
          error: `لا يمكن إلغاء أمر الإنتاج لوجود عهدة مواد متبقية لم تُرجع للمستودع (${remainingCustody.length} أصناف). يرجى عمل "مرتجع من الإنتاج" أولاً لحفظ رصيد المخزون.`,
        };
      }

      const nowIso = new Date().toISOString();
      const updatedOrder: ProductionOrder = {
        ...order,
        status: 'CANCELLED',
        notes: (order.notes ? order.notes + ' | ' : '') + `سبب الإلغاء: ${cleanReason}`,
        updatedAt: nowIso,
      };

      try {
        await FirestoreStorage.saveProductionOrder(updatedOrder);
        await FirestoreStorage.recordAuditLog(
          'CANCEL_PRODUCTION_ORDER',
          'production_order',
          orderId,
          `إلغاء أمر الإنتاج ${order.orderNumber}: ${cleanReason}`
        );
      } catch (err: any) {
        showToast('تعذر حفظ إلغاء أمر الإنتاج في السحابة', 'error');
        return { success: false, error: err?.message || 'تعذر الحفظ' };
      }

      const updatedOrders = productionOrders.map((p) => (p.id === orderId ? updatedOrder : p));
      setProductionOrders(updatedOrders);
      productionOrdersRef.current = updatedOrders;

      showToast(`تم إلغاء أمر الإنتاج (${order.orderNumber}) بنجاح`, 'info');
      return { success: true };
    },
    [productionOrders, showToast]
  );

  const deleteProductionOrder = useCallback(
    async (orderId: string, reason: string) => {
      if (!ensureAdmin('حذف أمر الإنتاج')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
      const order = productionOrders.find((p) => p.id === orderId);
      if (!order) return { success: false, error: 'أمر الإنتاج غير موجود' };

      const cleanReason = reason.trim();
      if (!cleanReason) {
        return { success: false, error: 'يرجى كتابة سبب الحذف للمتابعة' };
      }

      if ((order.dispatches && order.dispatches.length > 0) || (order.receipts && order.receipts.length > 0)) {
        return {
          success: false,
          error: `لا يمكن حذف أمر الإنتاج (${order.orderNumber}) لاحتوائه على حركات مخزنية معتمدة. يمكنك إلغاء الأمر بدلاً من حذفه لضمان سلامة السجلات.`,
        };
      }

      try {
        await FirestoreStorage.deleteProductionOrder(orderId, order.orderNumber);
      } catch (err: any) {
        showToast('تعذر حذف أمر الإنتاج من السحابة', 'error');
        return { success: false, error: err?.message || 'تعذر الحذف' };
      }

      const updatedOrders = productionOrders.filter((p) => p.id !== orderId);
      setProductionOrders(updatedOrders);
      productionOrdersRef.current = updatedOrders;

      showToast(`تم حذف أمر الإنتاج (${order.orderNumber}) بنجاح`, 'info');
      return { success: true };
    },
    [productionOrders, showToast, ensureAdmin]
  );

  const generateFactoryReferenceNumber = useCallback(
    (type: 'MFG_OUT' | 'MFG_IN'): string => {
      const year = new Date().getFullYear();
      const prefix = type === 'MFG_OUT' ? `MFG-OUT-${year}-` : `MFG-IN-${year}-`;
      const currentList = movementsRef.current && movementsRef.current.length > 0 ? movementsRef.current : movements;
      const matchingRefs = currentList
        .map((m) => m.referenceNumber || '')
        .filter((ref) => ref.startsWith(prefix));

      let maxSeq = 0;
      for (const ref of matchingRefs) {
        const seqStr = ref.replace(prefix, '');
        const seqNum = parseInt(seqStr, 10);
        if (!isNaN(seqNum) && seqNum > maxSeq) {
          maxSeq = seqNum;
        }
      }
      const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
      return `${prefix}${nextSeq}`;
    },
    [movements]
  );

  const addFactoryMovement = useCallback(
    async (data: {
      itemId: string;
      type: 'MFG_OUT' | 'MFG_IN';
      unitId: string;
      quantity: number;
      notes?: string;
      date?: string;
    }): Promise<{ success: boolean; movement?: StockMovement; error?: string }> => {
      if (!ensureAdmin(data.type === 'MFG_OUT' ? 'خروج للمصنع' : 'وارد من المصنع')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }
      const item = items.find((i) => i.id === data.itemId && !i.isDeleted);
      if (!item) {
        const err = 'الصنف المحدد غير موجود أو محذوف من المخزون';
        showToast(err, 'error');
        return { success: false, error: err };
      }

      const numQty = Number(data.quantity);
      if (!numQty || numQty <= 0 || isNaN(numQty)) {
        const err = 'يرجى إدخال كمية صحيحة أكبر من الصفر';
        showToast(err, 'error');
        return { success: false, error: err };
      }

      let factor = 1;
      if (data.unitId !== item.baseUnitId) {
        const conv = item.conversions.find((c) => c.unitId === data.unitId);
        if (!conv) {
          const selectedUnit = units.find((u) => u.id === data.unitId);
          const err = `لم يتم تحديد معامل تحويل معتمد للوحدة (${selectedUnit?.name || 'المختارة'}) لهذا الصنف. يرجى تعديل الصنف وإضافة معامل التحويل أولاً.`;
          showToast(err, 'error');
          return { success: false, error: err };
        }
        factor = conv.factorToBase;
      }

      const baseQuantity = Math.round(numQty * factor * 1000) / 1000;
      const currentStock = getItemStock(data.itemId);
      const baseUnit = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';
      const movementUnit = units.find((u) => u.id === data.unitId)?.name || 'وحدة';

      if (data.type === 'MFG_OUT') {
        if (!canWithdraw(currentStock, baseQuantity)) {
          const err = `عفواً، لا يمكن إتمام عملية الخروج للمصنع: الكمية المطلوبة (${numQty} ${movementUnit} = ${baseQuantity} ${baseUnit}) تتجاوز الرصيد المتوفر حالياً (${currentStock} ${baseUnit}). نظام مدهال الطيب يمنع الرصيد السالب نهائياً!`;
          showToast(err, 'error');
          return { success: false, error: err };
        }
      }

      const refNumber = generateFactoryReferenceNumber(data.type);
      const nowIso = new Date().toISOString();
      const movementId = `mfg_${data.type === 'MFG_OUT' ? 'out' : 'in'}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const newMovement: StockMovement = {
        id: movementId,
        itemId: data.itemId,
        type: data.type,
        unitId: data.unitId,
        quantity: numQty,
        factorApplied: factor,
        baseQuantity,
        date: data.date ? (data.date.includes('T') ? data.date : `${data.date}T${new Date().toTimeString().split(' ')[0]}`) : nowIso,
        referenceNumber: refNumber,
        notes: data.notes?.trim() || '',
        destinationType: 'PRODUCTION',
        destinationName: 'المصنع',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      try {
        await FirestoreStorage.recordFactoryMovementTransaction(newMovement, {
          maxAllowedStock: currentStock,
        });

        const updatedMovements = deduplicateById([newMovement, ...movementsRef.current]);
        setMovements(updatedMovements);
        movementsRef.current = updatedMovements;

        persistChanges(
          units,
          categories,
          items,
          updatedMovements,
          branches,
          returns,
          damagedRecords,
          productionOrders
        );

        showToast(
          data.type === 'MFG_OUT'
            ? `تم تسجيل خروج المواد للمصنع بنجاح بالسند رقم (${refNumber})`
            : `تم استلام البضاعة من المصنع بنجاح بالسند رقم (${refNumber})`,
          'success'
        );

        return { success: true, movement: newMovement };
      } catch (err: any) {
        const errorMsg = err?.message || 'حدث خطأ أثناء تنفيذ المعاملة وحفظ الحركة في قاعدة البيانات';
        showToast(errorMsg, 'error');
        return { success: false, error: errorMsg };
      }
    },
    [
      items,
      units,
      categories,
      branches,
      returns,
      damagedRecords,
      productionOrders,
      getItemStock,
      generateFactoryReferenceNumber,
      persistChanges,
      showToast,
      ensureAdmin,
    ]
  );

  const addMultiItemFactoryMovement = useCallback(
    async (data: {
      type: 'MFG_OUT' | 'MFG_IN';
      date?: string;
      notes?: string;
      items: { itemId: string; unitId: string; quantity: number; notes?: string }[];
    }): Promise<{ success: boolean; movements?: StockMovement[]; error?: string; referenceNumber?: string }> => {
      const isOut = data.type === 'MFG_OUT';
      if (!ensureAdmin(isOut ? 'خروج للمصنع' : 'وارد من المصنع')) {
        return { success: false, error: 'غير مصرح: وضع مسؤول المصنع مخصص للمشاهدة فقط' };
      }

      if (!data.items || data.items.length === 0) {
        return { success: false, error: 'يرجى إضافة صنف واحد على الأقل' };
      }

      const refNumber = generateFactoryReferenceNumber(data.type);
      const nowIso = new Date().toISOString();
      const movementDate = data.date ? (data.date.includes('T') ? data.date : `${data.date}T${new Date().toTimeString().split(' ')[0]}`) : nowIso;
      const createdMovements: StockMovement[] = [];

      for (let idx = 0; idx < data.items.length; idx++) {
        const entry = data.items[idx];
        const item = items.find((i) => i.id === entry.itemId && !i.isDeleted);
        if (!item) return { success: false, error: `الصنف في البند ${idx + 1} غير موجود أو محذوف` };

        const numQty = Number(entry.quantity);
        if (!numQty || numQty <= 0 || isNaN(numQty)) {
          return { success: false, error: `الكمية غير صحيحة للصنف "${item.name}"` };
        }

        let factor = 1;
        if (entry.unitId !== item.baseUnitId) {
          const conv = item.conversions.find((c) => c.unitId === entry.unitId);
          if (!conv) {
            const selectedUnit = units.find((u) => u.id === entry.unitId);
            return { success: false, error: `لم يتم تحديد معامل تحويل للوحدة (${selectedUnit?.name || ''}) للصنف "${item.name}"` };
          }
          factor = conv.factorToBase;
        }

        const baseQuantity = Math.round(numQty * factor * 1000) / 1000;
        const currentStock = getItemStock(entry.itemId);

        if (isOut && !canWithdraw(currentStock, baseQuantity)) {
          const bName = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';
          return {
            success: false,
            error: `الكمية المطلوبة للصنف "${item.name}" (${numQty} = ${baseQuantity} ${bName}) تتجاوز الرصيد المتوفر (${currentStock} ${bName}). يمنع النظام الرصيد السالب!`,
          };
        }

        const movementId = `mfg_${isOut ? 'out' : 'in'}_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`;
        const noteText = [entry.notes?.trim(), data.notes?.trim()].filter(Boolean).join(' - ');

        const mov: StockMovement = {
          id: movementId,
          itemId: entry.itemId,
          type: data.type,
          unitId: entry.unitId,
          quantity: numQty,
          factorApplied: factor,
          baseQuantity,
          date: movementDate,
          referenceNumber: refNumber,
          notes: noteText || (isOut ? 'أمر صرف وخروج للمصنع' : 'استلام وارد من المصنع'),
          destinationType: 'FACTORY',
          destinationName: 'المصنع',
          status: 'APPROVED',
          createdByName: companySettings.managerName || 'مدير النظام',
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        createdMovements.push(mov);
      }

      const updatedMovements = [...createdMovements, ...movements];
      setMovements(updatedMovements);
      movementsRef.current = updatedMovements;

      try {
        for (const m of createdMovements) {
          await FirestoreStorage.saveMovement(m);
        }
        await persistChanges(units, categories, items, updatedMovements, branches, returns, damagedRecords, productionOrders);
      } catch (err: any) {
        setMovements(movements);
        return { success: false, error: 'فشل حفظ حركات المصنع في السحابة' };
      }

      await FirestoreStorage.recordAuditLog({
        operationType: 'إضافة',
        entityType: 'حركة مخزنية',
        entityId: refNumber,
        entityName: `${isOut ? 'أمر صرف للمصنع' : 'وارد من المصنع'} (${createdMovements.length} أصناف)`,
        reason: `${isOut ? 'خروج للمصنع' : 'وارد من المصنع'}: سند رقم ${refNumber}`,
        userName: companySettings.managerName || 'مدير النظام',
        dataBefore: null,
        dataAfter: { refNumber, count: createdMovements.length },
      }).catch((e) => console.warn(e));

      showToast(`تم تسجيل سند ${isOut ? 'الخروج للمصنع' : 'الوارد من المصنع'} #${refNumber} (${createdMovements.length} أصناف) بنجاح`, 'success');
      return { success: true, movements: createdMovements, referenceNumber: refNumber };
    },
    [ensureAdmin, items, units, getItemStock, movements, companySettings, persistChanges, branches, returns, damagedRecords, productionOrders, generateFactoryReferenceNumber, showToast]
  );

  const clearDatabase = useCallback(async () => {
    await StorageService.clearAll();
    setUnits([]);
    setCategories([]);
    setItems([]);
    setMovements([]);
    setBranches([]);
    setReturns([]);
    setProductionOrders([]);
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
    updateMultiItemDispatch,

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
    adjustItemStock,
    adjustStockSilently,

    addReturn,
    approveReturn,
    cancelReturn,
    deleteReturnRecord,

    // Production Orders
    productionOrders,
    createProductionOrder,
    dispatchMaterialToProduction,
    recordProductionConsumption,
    receiveFinishedGoodsFromProduction,
    returnMaterialFromProduction,
    cancelProductionOrder,
    deleteProductionOrder,

    // Damaged Records
    damagedRecords,
    addDamagedRecord,
    addMultiDamagedRecords,
    recoverDamagedRecord,
    deleteDamagedRecord,

    // Factory movements
    generateFactoryReferenceNumber,
    addFactoryMovement,
    addMultiItemFactoryMovement,

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
