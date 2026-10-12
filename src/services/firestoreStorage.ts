import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, OWNER_EMAIL } from './firebase';
import { Branch, Category, Item, ReturnRecord, StockMovement, Unit } from '../types/inventory';
import { StorageService, InventoryDatabaseData } from './storage';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  performedBy: string;
}

export interface CloudBackupRecord {
  id: string;
  name: string;
  timestamp: string;
  itemCount: number;
  categoryCount: number;
  movementCount: number;
  data: InventoryDatabaseData;
  createdBy: string;
}

export const FirestoreStorage = {
  // Load all collections from Cloud Firestore with intelligent two-way merge
  async loadAll(): Promise<InventoryDatabaseData> {
    // 1. Gather all local cache sources (LocalStorage and IndexedDB)
    const localData = StorageService.loadAll();
    let currentBestLocal = localData;

    try {
      const idbData = await StorageService.loadFromIndexedDB();
      if (idbData && idbData.items && idbData.items.length > (localData.items?.length || 0)) {
        currentBestLocal = {
          units: idbData.units?.length ? idbData.units : localData.units,
          categories: idbData.categories?.length ? idbData.categories : localData.categories,
          items: idbData.items,
          movements: idbData.movements?.length ? idbData.movements : localData.movements,
          branches: idbData.branches?.length ? idbData.branches : localData.branches,
          returns: idbData.returns?.length ? idbData.returns : localData.returns,
        };
      }
    } catch {}

    try {
      const [unitsSnap, categoriesSnap, itemsSnap, movementsSnap, branchesSnap, returnsSnap] = await Promise.all([
        getDocs(collection(db, 'units')),
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'items')),
        getDocs(collection(db, 'movements')),
        getDocs(collection(db, 'branches')),
        getDocs(collection(db, 'returns')),
      ]);

      const isGenuineItem = (i: any): i is Item =>
        Boolean(i && i.id && !i.id.startsWith('unit_') && !i.id.startsWith('cat_') && !i.id.startsWith('branch_') && !i.id.startsWith('mov_') && !i.id.startsWith('ret_'));

      const cloudUnits: Unit[] = unitsSnap.docs
        .map((d) => d.data() as Unit)
        .filter((u) => u && u.id && !u.id.startsWith('item_') && !u.id.startsWith('cat_') && !u.id.startsWith('branch_'));

      const cloudCategories: Category[] = categoriesSnap.docs
        .map((d) => d.data() as Category)
        .filter((c) => c && c.id && !c.id.startsWith('item_') && !c.id.startsWith('unit_') && !c.id.startsWith('branch_'));

      const cloudItems: Item[] = itemsSnap.docs
        .map((d) => d.data() as Item)
        .filter(isGenuineItem);

      const cloudMovements: StockMovement[] = movementsSnap.docs
        .map((d) => d.data() as StockMovement)
        .filter((m) => m && m.id && m.itemId);

      const cloudBranches: Branch[] = branchesSnap.docs
        .map((d) => d.data() as Branch)
        .filter((b) => b && b.id && !b.id.startsWith('item_') && !b.id.startsWith('unit_') && !b.id.startsWith('cat_'));

      const cloudReturns: ReturnRecord[] = returnsSnap.docs
        .map((d) => d.data() as ReturnRecord)
        .filter((r) => r && r.id && r.type);

      // 2. TWO-WAY SAFE MERGE: Preserve any local items created while offline or before sync!
      const cloudItemIds = new Set(cloudItems.map((i) => i.id));
      const unsyncedItems = (currentBestLocal.items || [])
        .filter(isGenuineItem)
        .filter((i) => !cloudItemIds.has(i.id));

      const cloudCategoryIds = new Set(cloudCategories.map((c) => c.id));
      const unsyncedCategories = (currentBestLocal.categories || []).filter((c) => !cloudCategoryIds.has(c.id));

      const cloudUnitIds = new Set(cloudUnits.map((u) => u.id));
      const unsyncedUnits = (currentBestLocal.units || []).filter((u) => !cloudUnitIds.has(u.id));

      const cloudBranchIds = new Set(cloudBranches.map((b) => b.id));
      const unsyncedBranches = (currentBestLocal.branches || []).filter((b) => !cloudBranchIds.has(b.id));

      // Cloud movements & returns are the single authoritative source of truth.
      // This guarantees that zeroed or deleted movements on one device never reappear on another device!
      const mergedData: InventoryDatabaseData = {
        units: [...cloudUnits, ...unsyncedUnits],
        categories: [...cloudCategories, ...unsyncedCategories],
        items: [...cloudItems, ...unsyncedItems],
        movements: cloudMovements,
        branches: [...cloudBranches, ...unsyncedBranches],
        returns: cloudReturns,
      };

      // Update local storage with the authoritative merged picture
      await StorageService.saveAll(mergedData).catch(() => {});

      // 3. If unsynced offline records were detected, immediately sync them to Cloud Firestore in the background
      const totalUnsynced = unsyncedItems.length + unsyncedCategories.length + unsyncedUnits.length;
      if (totalUnsynced > 0) {
        console.log(`[Auto-Recovery] Found ${totalUnsynced} offline items/records. Syncing to Cloud Firestore...`);
        this.syncAllToFirestore(mergedData).catch((err) => {
          console.warn('[Auto-Recovery] Background sync of offline items deferred:', err);
        });
      }

      return mergedData;
    } catch (error) {
      console.warn('Failed to load from Cloud Firestore (offline mode active, falling back safely to local cache):', error);
      return currentBestLocal;
    }
  },

  // Save single item
  async saveItem(item: Item): Promise<void> {
    try {
      await setDoc(doc(db, 'items', item.id), item);
      await this.recordAuditLog('SAVE_ITEM', 'item', item.id, `حفظ الصنف: ${item.name} (${item.code})`);
    } catch (err) {
      console.error('Error saving item to Firestore:', err);
      throw err;
    }
  },

  // Delete single item (permanent)
  async deleteItem(itemId: string, itemName?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'items', itemId));
      await this.recordAuditLog('DELETE_ITEM', 'item', itemId, `حذف نهائي للصنف: ${itemName || itemId}`);
    } catch (err) {
      console.error('Error deleting item from Firestore:', err);
      throw err;
    }
  },

  // Save Category
  async saveCategory(category: Category): Promise<void> {
    try {
      await setDoc(doc(db, 'categories', category.id), category);
      await this.recordAuditLog('SAVE_CATEGORY', 'category', category.id, `حفظ القسم: ${category.name}`);
    } catch (err) {
      console.error('Error saving category to Firestore:', err);
      throw err;
    }
  },

  // Delete Category
  async deleteCategory(categoryId: string, categoryName?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'categories', categoryId));
      await this.recordAuditLog('DELETE_CATEGORY', 'category', categoryId, `حذف القسم: ${categoryName || categoryId}`);
    } catch (err) {
      console.error('Error deleting category from Firestore:', err);
      throw err;
    }
  },

  // Save Unit
  async saveUnit(unit: Unit): Promise<void> {
    try {
      await setDoc(doc(db, 'units', unit.id), unit);
      await this.recordAuditLog('SAVE_UNIT', 'unit', unit.id, `حفظ الوحدة: ${unit.name}`);
    } catch (err) {
      console.error('Error saving unit to Firestore:', err);
      throw err;
    }
  },

  // Delete Unit
  async deleteUnit(unitId: string, unitName?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'units', unitId));
      await this.recordAuditLog('DELETE_UNIT', 'unit', unitId, `حذف الوحدة: ${unitName || unitId}`);
    } catch (err) {
      console.error('Error deleting unit from Firestore:', err);
      throw err;
    }
  },

  // Save Stock Movement
  async saveMovement(movement: StockMovement): Promise<void> {
    try {
      await setDoc(doc(db, 'movements', movement.id), movement);
      await this.recordAuditLog(
        'SAVE_MOVEMENT',
        'movement',
        movement.id,
        `حركة مخزنية (${movement.type === 'IN' ? 'توريد' : 'صرف'}) بكمية: ${movement.quantity}`
      );
    } catch (err) {
      console.error('Error saving movement to Firestore:', err);
      throw err;
    }
  },

  // Delete Movement
  async deleteMovement(movementId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'movements', movementId));
      await this.recordAuditLog('DELETE_MOVEMENT', 'movement', movementId, `حذف حركة مخزنية: ${movementId}`);
    } catch (err) {
      console.error('Error deleting movement from Firestore:', err);
      throw err;
    }
  },

  // Save Branch
  async saveBranch(branch: Branch): Promise<void> {
    try {
      await setDoc(doc(db, 'branches', branch.id), branch);
      await this.recordAuditLog('SAVE_BRANCH', 'branch', branch.id, `حفظ الفرع: ${branch.name}`);
    } catch (err) {
      console.error('Error saving branch to Firestore:', err);
      throw err;
    }
  },

  // Delete Branch
  async deleteBranch(branchId: string, branchName?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'branches', branchId));
      await this.recordAuditLog('DELETE_BRANCH', 'branch', branchId, `حذف الفرع: ${branchName || branchId}`);
    } catch (err) {
      console.error('Error deleting branch from Firestore:', err);
      throw err;
    }
  },

  // Save Return Record
  async saveReturn(ret: ReturnRecord): Promise<void> {
    try {
      await setDoc(doc(db, 'returns', ret.id), ret);
      await this.recordAuditLog('SAVE_RETURN', 'return', ret.id, `حفظ سجل المرتجع: ${ret.returnNumber} (${ret.type})`);
    } catch (err) {
      console.error('Error saving return to Firestore:', err);
      throw err;
    }
  },

  // Delete Return Record
  async deleteReturn(returnId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'returns', returnId));
      await this.recordAuditLog('DELETE_RETURN', 'return', returnId, `حذف سجل المرتجع: ${returnId}`);
    } catch (err) {
      console.error('Error deleting return from Firestore:', err);
      throw err;
    }
  },

  // Delete all movements from Cloud Firestore (zero stock operations)
  async deleteAllMovements(): Promise<number> {
    try {
      const snap = await getDocs(collection(db, 'movements'));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      await this.recordAuditLog('ZERO_MOVEMENTS', 'movement', 'all', `حذف وتصفير جميع الحركات المخزنية (${snap.size} حركة)`);
      return snap.size;
    } catch (err) {
      console.error('Error batch deleting movements:', err);
      const snap = await getDocs(collection(db, 'movements'));
      for (const d of snap.docs) {
        try { await deleteDoc(d.ref); } catch {}
      }
      return snap.size;
    }
  },

  // Delete all returns from Cloud Firestore (zero returns operations)
  async deleteAllReturns(): Promise<number> {
    try {
      const snap = await getDocs(collection(db, 'returns'));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      await this.recordAuditLog('ZERO_RETURNS', 'return', 'all', `حذف وتصفير جميع سجلات المرتجعات (${snap.size} سجل)`);
      return snap.size;
    } catch (err) {
      console.error('Error batch deleting returns:', err);
      const snap = await getDocs(collection(db, 'returns'));
      for (const d of snap.docs) {
        try { await deleteDoc(d.ref); } catch {}
      }
      return snap.size;
    }
  },

  // Subscribe to real-time changes across Cloud Firestore collections for instantaneous multi-device sync
  subscribeToAllCollections(callbacks: {
    onItems?: (items: Item[]) => void;
    onMovements?: (movements: StockMovement[]) => void;
    onCategories?: (categories: Category[]) => void;
    onUnits?: (units: Unit[]) => void;
    onBranches?: (branches: Branch[]) => void;
    onReturns?: (returns: ReturnRecord[]) => void;
    onError?: (error: any) => void;
  }): () => void {
    const unsubscribes: (() => void)[] = [];

    const isGenuineItem = (i: any): i is Item =>
      Boolean(i && i.id && !i.id.startsWith('unit_') && !i.id.startsWith('cat_') && !i.id.startsWith('branch_') && !i.id.startsWith('mov_') && !i.id.startsWith('ret_') && i.name);

    if (callbacks.onItems) {
      const unsub = onSnapshot(
        collection(db, 'items'),
        (snap) => {
          const items = snap.docs.map((d) => d.data() as Item).filter(isGenuineItem);
          callbacks.onItems?.(items);
        },
        (err) => callbacks.onError?.(err)
      );
      unsubscribes.push(unsub);
    }

    if (callbacks.onMovements) {
      const unsub = onSnapshot(
        collection(db, 'movements'),
        (snap) => {
          const movements = snap.docs.map((d) => d.data() as StockMovement).filter((m) => m && m.id && m.itemId);
          callbacks.onMovements?.(movements);
        },
        (err) => callbacks.onError?.(err)
      );
      unsubscribes.push(unsub);
    }

    if (callbacks.onCategories) {
      const unsub = onSnapshot(
        collection(db, 'categories'),
        (snap) => {
          const categories = snap.docs.map((d) => d.data() as Category).filter((c) => c && c.id && c.name);
          callbacks.onCategories?.(categories);
        },
        (err) => callbacks.onError?.(err)
      );
      unsubscribes.push(unsub);
    }

    if (callbacks.onUnits) {
      const unsub = onSnapshot(
        collection(db, 'units'),
        (snap) => {
          const units = snap.docs.map((d) => d.data() as Unit).filter((u) => u && u.id && u.name);
          callbacks.onUnits?.(units);
        },
        (err) => callbacks.onError?.(err)
      );
      unsubscribes.push(unsub);
    }

    if (callbacks.onBranches) {
      const unsub = onSnapshot(
        collection(db, 'branches'),
        (snap) => {
          const branches = snap.docs.map((d) => d.data() as Branch).filter((b) => b && b.id && b.name);
          callbacks.onBranches?.(branches);
        },
        (err) => callbacks.onError?.(err)
      );
      unsubscribes.push(unsub);
    }

    if (callbacks.onReturns) {
      const unsub = onSnapshot(
        collection(db, 'returns'),
        (snap) => {
          const returns = snap.docs.map((d) => d.data() as ReturnRecord).filter((r) => r && r.id);
          callbacks.onReturns?.(returns);
        },
        (err) => callbacks.onError?.(err)
      );
      unsubscribes.push(unsub);
    }

    return () => {
      unsubscribes.forEach((fn) => fn());
    };
  },

  // Sync entire database safely to Firestore using fast atomic batches
  async syncAllToFirestore(data: InventoryDatabaseData): Promise<{ success: boolean; count: number }> {
    let syncedCount = 0;
    const allOperations: { col: string; id: string; data: any }[] = [];

    (data.units || []).forEach((u) => u.id && allOperations.push({ col: 'units', id: u.id, data: u }));
    (data.categories || []).forEach((c) => c.id && allOperations.push({ col: 'categories', id: c.id, data: c }));
    (data.items || []).forEach((i) => i.id && allOperations.push({ col: 'items', id: i.id, data: i }));
    (data.movements || []).forEach((m) => m.id && allOperations.push({ col: 'movements', id: m.id, data: m }));
    (data.branches || []).forEach((b) => b.id && allOperations.push({ col: 'branches', id: b.id, data: b }));
    (data.returns || []).forEach((r) => r.id && allOperations.push({ col: 'returns', id: r.id, data: r }));

    const CHUNK_SIZE = 100;
    for (let i = 0; i < allOperations.length; i += CHUNK_SIZE) {
      const chunk = allOperations.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const op of chunk) {
        batch.set(doc(db, op.col, op.id), op.data);
      }
      try {
        await batch.commit();
        syncedCount += chunk.length;
      } catch (err) {
        console.warn(`Error committing batch ${i / CHUNK_SIZE}:`, err);
        // Fallback to individual setDoc for resilience
        for (const op of chunk) {
          try {
            await setDoc(doc(db, op.col, op.id), op.data);
            syncedCount++;
          } catch {}
        }
      }
    }

    await this.recordAuditLog(
      'BATCH_SYNC',
      'database',
      'all',
      `مزامنة وتثبيت سحابي شامل لـ ${syncedCount} عنصراً في Cloud Firestore`
    );

    return { success: true, count: syncedCount };
  },

  // Audit Log recording
  async recordAuditLog(
    action: string,
    entityType: string,
    entityId: string,
    details: string,
    performedBy: string = OWNER_EMAIL
  ): Promise<void> {
    try {
      const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const logEntry: AuditLogEntry = {
        id: logId,
        timestamp: new Date().toISOString(),
        action,
        entityType,
        entityId,
        details,
        performedBy,
      };
      await setDoc(doc(db, 'audit_logs', logId), logEntry);
    } catch (err) {
      console.warn('Could not write audit log:', err);
    }
  },

  // Fetch recent audit logs
  async getAuditLogs(max: number = 50): Promise<AuditLogEntry[]> {
    try {
      const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(max));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as AuditLogEntry);
    } catch (err) {
      console.warn('Could not read audit logs:', err);
      return [];
    }
  },

  // Create Cloud Backup snapshot
  async createCloudBackup(name: string, data: InventoryDatabaseData): Promise<CloudBackupRecord> {
    const backupId = 'backup_' + Date.now();
    const record: CloudBackupRecord = {
      id: backupId,
      name,
      timestamp: new Date().toISOString(),
      itemCount: data.items.length,
      categoryCount: data.categories.length,
      movementCount: data.movements.length,
      data,
      createdBy: OWNER_EMAIL,
    };
    await setDoc(doc(db, 'backups', backupId), record);
    await this.recordAuditLog('CREATE_BACKUP', 'backup', backupId, `إنشاء نسخة احتياطية سحابية: ${name}`);
    return record;
  },

  // List Cloud Backups
  async listCloudBackups(): Promise<CloudBackupRecord[]> {
    try {
      const q = query(collection(db, 'backups'), orderBy('timestamp', 'desc'), limit(20));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as CloudBackupRecord);
    } catch (err) {
      console.warn('Could not list cloud backups:', err);
      return [];
    }
  },
};
