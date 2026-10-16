import { Branch, Category, CompanySettings, Customer, DamagedRecord, Item, ProductionOrder, ReturnRecord, StockMovement, Unit } from '../types/inventory';

const DB_NAME = 'MakhzouniInventoryDB';
const DB_VERSION = 5;

const STORAGE_KEYS = {
  UNITS: 'makhzouni_units_v1',
  CATEGORIES: 'makhzouni_categories_v1',
  ITEMS: 'makhzouni_items_v1',
  MOVEMENTS: 'makhzouni_movements_v1',
  BRANCHES: 'makhzouni_branches_v1',
  RETURNS: 'makhzouni_returns_v1',
  PRODUCTION_ORDERS: 'makhzouni_production_orders_v1',
  DAMAGED: 'makhzouni_damaged_v1',
  EMERGENCY_BACKUP: 'makhzouni_emergency_backup_v1',
  PENDING_SYNC_QUEUE: 'makhzouni_pending_sync_queue_v1',
};

// Open IndexedDB
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('units')) {
        db.createObjectStore('units', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('items')) {
        db.createObjectStore('items', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('movements')) {
        const movementStore = db.createObjectStore('movements', { keyPath: 'id' });
        movementStore.createIndex('itemId', 'itemId', { unique: false });
        movementStore.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('branches')) {
        db.createObjectStore('branches', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('returns')) {
        const returnsStore = db.createObjectStore('returns', { keyPath: 'id' });
        returnsStore.createIndex('returnNumber', 'returnNumber', { unique: false });
        returnsStore.createIndex('status', 'status', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// LocalStorage helpers as synchronous cache
function loadLocal<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return defaultValue;
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Error loading key ${key} from localStorage:`, err);
    return defaultValue;
  }
}

function saveLocal<T>(key: string, value: T): void {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving key ${key} to localStorage:`, err);
  }
}

export interface InventoryDatabaseData {
  units: Unit[];
  categories: Category[];
  items: Item[];
  movements: StockMovement[];
  branches?: Branch[];
  returns?: ReturnRecord[];
  customers?: Customer[];
  productionOrders?: ProductionOrder[];
  damagedRecords?: DamagedRecord[];
  settings?: CompanySettings;
}

export const isGenuineItem = (obj: any): obj is Item => {
  return Boolean(
    obj &&
    typeof obj === 'object' &&
    obj.id &&
    typeof obj.id === 'string' &&
    !obj.id.startsWith('unit_') &&
    !obj.id.startsWith('cat_') &&
    !obj.id.startsWith('branch_') &&
    !obj.id.startsWith('mov_') &&
    !obj.id.startsWith('ret_') &&
    obj.name
  );
};

export const StorageService = {
  // Initial load: loads from LocalStorage synchronously, then verifies/syncs with IndexedDB
  loadAll(): InventoryDatabaseData {

    const localUnits = loadLocal<Unit[]>(STORAGE_KEYS.UNITS, []);
    const localCategories = loadLocal<Category[]>(STORAGE_KEYS.CATEGORIES, []);
    const rawLocalItems = loadLocal<Item[]>(STORAGE_KEYS.ITEMS, []);
    const localItems = rawLocalItems.filter(isGenuineItem);
    const localMovements = loadLocal<StockMovement[]>(STORAGE_KEYS.MOVEMENTS, []);
    const localBranches = loadLocal<Branch[]>(STORAGE_KEYS.BRANCHES, []);
    const localReturns = loadLocal<ReturnRecord[]>(STORAGE_KEYS.RETURNS, []);
    const localProductionOrders = loadLocal<ProductionOrder[]>(STORAGE_KEYS.PRODUCTION_ORDERS, []);
    const localDamaged = loadLocal<DamagedRecord[]>(STORAGE_KEYS.DAMAGED, []);

    // Clean up local items key if polluted
    if (rawLocalItems.length !== localItems.length) {
      saveLocal(STORAGE_KEYS.ITEMS, localItems);
    }

    return {
      units: localUnits,
      categories: localCategories,
      items: localItems,
      movements: localMovements,
      branches: localBranches,
      returns: localReturns,
      productionOrders: localProductionOrders,
      damagedRecords: localDamaged,
    };
  },

  // Save changes to both LocalStorage and IndexedDB
  async saveAll(data: InventoryDatabaseData): Promise<void> {
    const cleanItems = (data.items || []).filter(isGenuineItem);
    saveLocal(STORAGE_KEYS.UNITS, data.units);
    saveLocal(STORAGE_KEYS.CATEGORIES, data.categories);
    saveLocal(STORAGE_KEYS.ITEMS, cleanItems);
    saveLocal(STORAGE_KEYS.MOVEMENTS, data.movements);
    if (data.branches) {
      saveLocal(STORAGE_KEYS.BRANCHES, data.branches);
    }
    if (data.returns) {
      saveLocal(STORAGE_KEYS.RETURNS, data.returns);
    }
    if (data.productionOrders) {
      saveLocal(STORAGE_KEYS.PRODUCTION_ORDERS, data.productionOrders);
    }
    if (data.damagedRecords) {
      saveLocal(STORAGE_KEYS.DAMAGED, data.damagedRecords);
    }

    // Always maintain an emergency recovery copy whenever items exist
    if (cleanItems.length > 0) {
      saveLocal(STORAGE_KEYS.EMERGENCY_BACKUP, {
        timestamp: new Date().toISOString(),
        data: { ...data, items: cleanItems },
      });
    }

    try {
      const db = await openIndexedDB();
      const tx = db.transaction(['units', 'categories', 'items', 'movements', 'branches', 'returns'], 'readwrite');

      const putStore = (storeName: string, items: any[]) => {
        const store = tx.objectStore(storeName);
        store.clear();
        for (const item of items) {
          store.put(item);
        }
      };

      putStore('units', data.units);
      putStore('categories', data.categories);
      putStore('items', data.items);
      putStore('movements', data.movements);
      putStore('branches', data.branches || []);
      putStore('returns', data.returns || []);

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('Could not persist to IndexedDB, fallback to localStorage succeeded:', err);
    }
  },

  // Read entire state asynchronously from IndexedDB
  async loadFromIndexedDB(): Promise<InventoryDatabaseData | null> {
    try {
      const db = await openIndexedDB();
      const tx = db.transaction(['units', 'categories', 'items', 'movements', 'branches', 'returns'], 'readonly');

      const getAll = (storeName: string): Promise<any[]> => {
        return new Promise((resolve) => {
          try {
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          } catch {
            resolve([]);
          }
        });
      };

      const [units, categories, items, movements, branches, returns] = await Promise.all([
        getAll('units'),
        getAll('categories'),
        getAll('items'),
        getAll('movements'),
        getAll('branches'),
        getAll('returns'),
      ]);

      return {
        units: units || [],
        categories: categories || [],
        items: (items || []).filter(isGenuineItem),
        movements: movements || [],
        branches: branches || [],
        returns: returns || [],
      };
    } catch (err) {
      console.warn('Could not read from IndexedDB directly:', err);
      return null;
    }
  },

  // Get Emergency Local Snapshot
  getEmergencySnapshot(): { timestamp: string; data: InventoryDatabaseData } | null {
    return loadLocal<{ timestamp: string; data: InventoryDatabaseData } | null>(STORAGE_KEYS.EMERGENCY_BACKUP, null);
  },

  // Deep scan all browser caches for orphaned/lost offline records
  async deepScanAndRescueOrphanedData(knownItemIds: Set<string>): Promise<{
    rescuedItems: Item[];
    rescuedMovements: StockMovement[];
    rescuedReturns: ReturnRecord[];
  }> {
    const rescuedItems: Item[] = [];
    const rescuedMovements: StockMovement[] = [];
    const rescuedReturns: ReturnRecord[] = [];

    const isGenuineItem = (obj: any): obj is Item => {
      return Boolean(
        obj &&
        typeof obj === 'object' &&
        obj.id &&
        typeof obj.id === 'string' &&
        !obj.id.startsWith('unit_') &&
        !obj.id.startsWith('cat_') &&
        !obj.id.startsWith('branch_') &&
        !obj.id.startsWith('mov_') &&
        !obj.id.startsWith('ret_') &&
        obj.name &&
        (obj.code || obj.baseUnitId || obj.categoryId)
      );
    };

    // 1. Scan IndexedDB
    try {
      const idbData = await this.loadFromIndexedDB();
      if (idbData) {
        for (const it of idbData.items || []) {
          if (isGenuineItem(it) && !knownItemIds.has(it.id)) {
            if (!rescuedItems.some((r) => r.id === it.id)) {
              rescuedItems.push(it);
            }
          }
        }
      }
    } catch {}

    // 2. Scan Emergency Snapshot
    try {
      const em = this.getEmergencySnapshot();
      if (em?.data) {
        for (const it of em.data.items || []) {
          if (isGenuineItem(it) && !knownItemIds.has(it.id) && !rescuedItems.some((r) => r.id === it.id)) {
            rescuedItems.push(it);
          }
        }
      }
    } catch {}

    // 3. Scan all localStorage keys for any other JSON dumps or backups
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith('makhzouni_')) continue;
          // Skip non-item specific collection keys
          if (
            key.startsWith('makhzouni_categories') ||
            key.startsWith('makhzouni_units') ||
            key.startsWith('makhzouni_branches') ||
            key.startsWith('makhzouni_movements') ||
            key.startsWith('makhzouni_returns')
          ) {
            continue;
          }

          try {
            const val = localStorage.getItem(key);
            if (val && val.includes('"id"') && val.includes('"name"')) {
              const parsed = JSON.parse(val);
              const candidates = Array.isArray(parsed) ? parsed : parsed.items || parsed.data?.items;
              if (Array.isArray(candidates)) {
                for (const cand of candidates) {
                  if (isGenuineItem(cand) && !knownItemIds.has(cand.id) && !rescuedItems.some((r) => r.id === cand.id)) {
                    rescuedItems.push(cand);
                  }
                }
              }
            }
          } catch {}
        }
      }
    } catch {}

    return { rescuedItems, rescuedMovements, rescuedReturns };
  },

  // Export full JSON backup
  exportDatabaseJSON(): string {
    const data = this.loadAll();
    return JSON.stringify(
      {
        appName: 'Makhzouni',
        version: '1.1.0',
        exportedAt: new Date().toISOString(),
        data,
      },
      null,
      2
    );
  },

  // Import JSON backup
  async importDatabaseJSON(jsonString: string): Promise<InventoryDatabaseData> {
    try {
      const parsed = JSON.parse(jsonString);
      const incoming = parsed.data || parsed;

      if (!Array.isArray(incoming.units) || !Array.isArray(incoming.items)) {
        throw new Error('الملف لا يحتوي على بنية بيانات المخزون الصحيحة');
      }

      const cleanData: InventoryDatabaseData = {
        units: incoming.units || [],
        categories: incoming.categories || [],
        items: incoming.items || [],
        movements: incoming.movements || [],
        branches: incoming.branches || [],
        returns: incoming.returns || [],
      };

      await this.saveAll(cleanData);
      return cleanData;
    } catch (err: any) {
      throw new Error('فشل استيراد قاعدة البيانات: ' + (err.message || 'ملف غير صالح'));
    }
  },

  // Clear all data (reset)
  async clearAll(): Promise<void> {
    const empty: InventoryDatabaseData = {
      units: [],
      categories: [],
      items: [],
      movements: [],
      branches: [],
      returns: [],
    };
    await this.saveAll(empty);
  },

  // Clear only movements and returns (zero stock operations), keeping units, categories, items, branches intact
  async clearOperationsOnly(): Promise<void> {
    saveLocal(STORAGE_KEYS.MOVEMENTS, []);
    saveLocal(STORAGE_KEYS.RETURNS, []);
    saveLocal(STORAGE_KEYS.DAMAGED, []);
    try {
      const db = await openIndexedDB();
      const tx = db.transaction(['movements', 'returns'], 'readwrite');
      tx.objectStore('movements').clear();
      tx.objectStore('returns').clear();
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('Could not clear operations in IndexedDB:', err);
    }
  },
};
