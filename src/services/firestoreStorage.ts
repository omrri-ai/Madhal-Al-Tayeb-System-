import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  runTransaction,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, OWNER_EMAIL } from './firebase';
import {
  AuditLogEntry,
  Branch,
  Category,
  CompanySettings,
  Customer,
  Item,
  ProductionOrder,
  ReturnRecord,
  StockMovement,
  Unit,
} from '../types/inventory';
import { StorageService, InventoryDatabaseData } from './storage';

export type { AuditLogEntry };

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

function cleanObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => (item === undefined ? null : cleanObject(item)));
  }
  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val === undefined) {
      cleaned[key] = null;
    } else {
      cleaned[key] = cleanObject(val);
    }
  }
  return cleaned;
}

export const FirestoreStorage = {
  // Load all collections safely from Cloud Firestore with local cache resilience
  async loadAll(): Promise<InventoryDatabaseData> {
    try {
      const fetchColl = async (name: string) => {
        try {
          return await getDocs(collection(db, name));
        } catch (err) {
          console.warn(`Could not read collection "${name}" from Firestore (offline/latency):`, err);
          return null;
        }
      };

      const [unitsSnap, categoriesSnap, itemsSnap, movementsSnap, branchesSnap, returnsSnap, customersSnap, prodOrdersSnap] = await Promise.all([
        fetchColl('units'),
        fetchColl('categories'),
        fetchColl('items'),
        fetchColl('movements'),
        fetchColl('branches'),
        fetchColl('returns'),
        fetchColl('customers'),
        fetchColl('production_orders'),
      ]);

      let cloudSettings: CompanySettings | undefined = undefined;
      try {
        const settingsSnap = await getDoc(doc(db, 'system_settings', 'company'));
        if (settingsSnap.exists()) {
          cloudSettings = settingsSnap.data() as CompanySettings;
        }
      } catch (settingsErr) {
        console.warn('Could not read system_settings document from Firestore (offline or uninitialized):', settingsErr);
      }

      const isGenuineItem = (i: any): i is Item =>
        Boolean(i && i.id && !i.id.startsWith('unit_') && !i.id.startsWith('cat_') && !i.id.startsWith('branch_') && !i.id.startsWith('mov_') && !i.id.startsWith('ret_'));

      const cloudUnits: Unit[] = (unitsSnap?.docs || [])
        .map((d) => d.data() as Unit)
        .filter((u) => u && u.id && !u.id.startsWith('item_') && !u.id.startsWith('cat_') && !u.id.startsWith('branch_'));

      const cloudCategories: Category[] = (categoriesSnap?.docs || [])
        .map((d) => d.data() as Category)
        .filter((c) => c && c.id && !c.id.startsWith('item_') && !c.id.startsWith('unit_') && !c.id.startsWith('branch_'));

      const cloudItems: Item[] = (itemsSnap?.docs || [])
        .map((d) => d.data() as Item)
        .filter(isGenuineItem);

      const cloudMovements: StockMovement[] = (movementsSnap?.docs || [])
        .map((d) => d.data() as StockMovement)
        .filter((m) => m && m.id && m.itemId);

      const cloudBranches: Branch[] = (branchesSnap?.docs || [])
        .map((d) => d.data() as Branch)
        .filter((b) => b && b.id && !b.id.startsWith('item_') && !b.id.startsWith('unit_') && !b.id.startsWith('cat_'));

      const cloudReturns: ReturnRecord[] = (returnsSnap?.docs || [])
        .map((d) => d.data() as ReturnRecord)
        .filter((r) => r && r.id && r.type);

      const cloudCustomers: Customer[] = (customersSnap?.docs || [])
        .map((d) => d.data() as Customer)
        .filter((c) => c && c.id);

      const cloudProductionOrders: ProductionOrder[] = (prodOrdersSnap?.docs || [])
        .map((d) => d.data() as ProductionOrder)
        .filter((p) => p && p.id && p.orderNumber);

      // If all collections returned null (e.g. completely offline with no local Firestore cache)
      const hasAnyFirestoreData =
        unitsSnap !== null ||
        categoriesSnap !== null ||
        itemsSnap !== null ||
        movementsSnap !== null ||
        branchesSnap !== null ||
        returnsSnap !== null ||
        customersSnap !== null ||
        prodOrdersSnap !== null;

      if (!hasAnyFirestoreData) {
        console.warn('Firestore is completely offline or unreachable. Loading from StorageService local cache.');
        const localData = await StorageService.loadAll();
        return localData;
      }

      const cloudData: InventoryDatabaseData = {
        units: cloudUnits,
        categories: cloudCategories,
        items: cloudItems,
        movements: cloudMovements,
        branches: cloudBranches,
        returns: cloudReturns,
        customers: cloudCustomers,
        productionOrders: cloudProductionOrders,
        settings: cloudSettings,
      };

      // Ensure local offline backup is synchronized with cloud data
      StorageService.saveAll(cloudData).catch(() => {});

      return cloudData;
    } catch (error: any) {
      console.warn('Failed to load from Cloud Firestore, falling back to StorageService:', error);
      try {
        const localData = await StorageService.loadAll();
        return localData;
      } catch {
        return {
          units: [],
          categories: [],
          items: [],
          movements: [],
          branches: [],
          returns: [],
          customers: [],
        };
      }
    }
  },

  // Save single item
  async saveItem(item: Item): Promise<void> {
    try {
      await setDoc(doc(db, 'items', item.id), cleanObject(item));
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
      await setDoc(doc(db, 'categories', category.id), cleanObject(category));
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
      await setDoc(doc(db, 'units', unit.id), cleanObject(unit));
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
      await setDoc(doc(db, 'movements', movement.id), cleanObject(movement));
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
      await setDoc(doc(db, 'branches', branch.id), cleanObject(branch));
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
      await setDoc(doc(db, 'returns', ret.id), cleanObject(ret));
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

  // Save Customer
  async saveCustomer(customer: Customer): Promise<void> {
    try {
      await setDoc(doc(db, 'customers', customer.id), cleanObject(customer));
      await this.recordAuditLog('SAVE_CUSTOMER', 'customer', customer.id, `حفظ العميل: ${customer.name}`);
    } catch (err) {
      console.error('Error saving customer to Firestore:', err);
      throw err;
    }
  },

  // Delete Customer
  async deleteCustomer(customerId: string, customerName?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'customers', customerId));
      await this.recordAuditLog('DELETE_CUSTOMER', 'customer', customerId, `حذف العميل: ${customerName || customerId}`);
    } catch (err) {
      console.error('Error deleting customer from Firestore:', err);
      throw err;
    }
  },

  // Save Company Settings
  async saveCompanySettings(settings: CompanySettings): Promise<void> {
    try {
      await setDoc(doc(db, 'system_settings', 'company'), cleanObject(settings));
      await this.recordAuditLog('SAVE_SETTINGS', 'settings', 'company', 'تحديث إعدادات المنشأة والسندات');
    } catch (err) {
      console.error('Error saving company settings to Firestore:', err);
      throw err;
    }
  },

  // Save Production Order
  async saveProductionOrder(order: ProductionOrder): Promise<void> {
    try {
      await setDoc(doc(db, 'production_orders', order.id), cleanObject(order));
      await this.recordAuditLog('SAVE_PRODUCTION_ORDER', 'production_order', order.id, `حفظ أمر إنتاج: ${order.orderNumber} (${order.title})`);
    } catch (err) {
      console.error('Error saving production order to Firestore:', err);
      throw err;
    }
  },

  // Delete Production Order
  async deleteProductionOrder(orderId: string, orderNumber?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'production_orders', orderId));
      await this.recordAuditLog('DELETE_PRODUCTION_ORDER', 'production_order', orderId, `حذف أمر إنتاج: ${orderNumber || orderId}`);
    } catch (err) {
      console.error('Error deleting production order from Firestore:', err);
      throw err;
    }
  },

  // Atomic Production Dispatch: Writes movements and updates order in single atomic transaction/batch
  async executeProductionDispatch(order: ProductionOrder, newMovements: StockMovement[]): Promise<void> {
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'production_orders', order.id), cleanObject(order));
      for (const m of newMovements) {
        batch.set(doc(db, 'movements', m.id), cleanObject(m));
      }
      await batch.commit();
      await this.recordAuditLog(
        'PRODUCTION_DISPATCH',
        'production_order',
        order.id,
        `صرف مواد لأمر الإنتاج (${order.orderNumber}): عدد الأصناف ${newMovements.length}`
      );
    } catch (err) {
      console.error('Error in executeProductionDispatch:', err);
      throw err;
    }
  },

  // Atomic Production Receipt: Writes receipt movement and updates order
  async executeProductionReceipt(order: ProductionOrder, newMovement: StockMovement): Promise<void> {
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'production_orders', order.id), cleanObject(order));
      batch.set(doc(db, 'movements', newMovement.id), cleanObject(newMovement));
      await batch.commit();
      await this.recordAuditLog(
        'PRODUCTION_RECEIPT',
        'production_order',
        order.id,
        `استلام منتج جاهز من أمر الإنتاج (${order.orderNumber}): كمية ${newMovement.quantity}`
      );
    } catch (err) {
      console.error('Error in executeProductionReceipt:', err);
      throw err;
    }
  },

  // Atomic Production Return: Writes return movements and updates order
  async executeProductionReturn(order: ProductionOrder, newMovements: StockMovement[]): Promise<void> {
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'production_orders', order.id), cleanObject(order));
      for (const m of newMovements) {
        batch.set(doc(db, 'movements', m.id), cleanObject(m));
      }
      await batch.commit();
      await this.recordAuditLog(
        'PRODUCTION_RETURN',
        'production_order',
        order.id,
        `إرجاع مواد فائضة من أمر الإنتاج (${order.orderNumber}) للمستودع: ${newMovements.length} صنف`
      );
    } catch (err) {
      console.error('Error in executeProductionReturn:', err);
      throw err;
    }
  },

  // Atomic Factory Movement Transaction using Firestore runTransaction()
  async recordFactoryMovementTransaction(
    movement: StockMovement,
    options?: { maxAllowedStock?: number }
  ): Promise<void> {
    const movementRef = doc(db, 'movements', movement.id);
    const itemRef = doc(db, 'items', movement.itemId);

    await runTransaction(db, async (transaction) => {
      // 1. Check if movement already exists to prevent duplicate submission
      const existingSnap = await transaction.get(movementRef);
      if (existingSnap.exists()) {
        throw new Error('تم تسجيل هذه الحركة مسبقاً بنفس المعرّف لمنع التكرار.');
      }

      // 2. Read item from Firestore to ensure it exists and is not deleted
      const itemSnap = await transaction.get(itemRef);
      if (!itemSnap.exists()) {
        throw new Error('الصنف المحدد غير موجود في قاعدة بيانات المخزون.');
      }
      const itemData = itemSnap.data() as Item;
      if (itemData.isDeleted) {
        throw new Error('لا يمكن تسجيل حركة لمصنع على صنف محذوف.');
      }

      // 3. For OUT movements, verify stock balance
      const isOut =
        movement.type === 'MFG_OUT' ||
        movement.type === 'OUT' ||
        (movement.type as string) === 'خروج للمصنع';
      if (isOut && options?.maxAllowedStock !== undefined) {
        if (movement.baseQuantity > options.maxAllowedStock) {
          throw new Error(
            `عفواً، الكمية المطلوبة للخروج (${movement.baseQuantity}) تتجاوز الرصيد المتوفر حالياً (${options.maxAllowedStock}). يمنع النظام تماماً الأرصدة السالبة!`
          );
        }
      }

      // 4. Commit movement atomically
      transaction.set(movementRef, cleanObject(movement));
    });

    const isOut =
      movement.type === 'MFG_OUT' ||
      movement.type === 'OUT' ||
      (movement.type as string) === 'خروج للمصنع';
    await this.recordAuditLog(
      isOut ? 'FACTORY_OUT' : 'FACTORY_IN',
      'movement',
      movement.id,
      `حركة مصنع (${isOut ? 'خروج للمصنع' : 'وارد من المصنع'}): سند ${movement.referenceNumber || movement.id} - كمية ${movement.quantity}`
    );
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
    onCustomers?: (customers: Customer[]) => void;
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

    if (callbacks.onCustomers) {
      const unsub = onSnapshot(
        collection(db, 'customers'),
        (snap) => {
          const customers = snap.docs.map((d) => d.data() as Customer).filter((c) => c && c.id && c.name);
          callbacks.onCustomers?.(customers);
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

    if ((callbacks as any).onProductionOrders) {
      const unsub = onSnapshot(
        collection(db, 'production_orders'),
        (snap) => {
          const orders = snap.docs.map((d) => d.data() as ProductionOrder).filter((p) => p && p.id && p.orderNumber);
          (callbacks as any).onProductionOrders?.(orders);
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
    (data.productionOrders || []).forEach((p) => p.id && allOperations.push({ col: 'production_orders', id: p.id, data: p }));

    const CHUNK_SIZE = 100;
    for (let i = 0; i < allOperations.length; i += CHUNK_SIZE) {
      const chunk = allOperations.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const op of chunk) {
        batch.set(doc(db, op.col, op.id), cleanObject(op.data));
      }
      try {
        await batch.commit();
        syncedCount += chunk.length;
      } catch (err) {
        console.warn(`Error committing batch ${i / CHUNK_SIZE}:`, err);
        // Fallback to individual setDoc for resilience
        for (const op of chunk) {
          try {
            await setDoc(doc(db, op.col, op.id), cleanObject(op.data));
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

  // Audit Log recording (Collection: audit_log)
  async recordAuditLog(
    entryOrAction: string | Partial<AuditLogEntry>,
    entityType?: string,
    entityId?: string,
    detailsOrReason?: string,
    performedBy: string = OWNER_EMAIL
  ): Promise<void> {
    try {
      const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      let logEntry: AuditLogEntry;

      if (typeof entryOrAction === 'object') {
        const op = entryOrAction.operationType || 'تعديل';
        logEntry = {
          id: logId,
          operationType: op,
          entityType: entryOrAction.entityType || 'عام',
          entityId: entryOrAction.entityId || logId,
          entityName: entryOrAction.entityName || '',
          reason: entryOrAction.reason || '',
          userName: entryOrAction.userName || OWNER_EMAIL,
          timestamp: entryOrAction.timestamp || new Date().toISOString(),
          dataBefore: entryOrAction.dataBefore !== undefined ? entryOrAction.dataBefore : null,
          dataAfter: entryOrAction.dataAfter !== undefined ? entryOrAction.dataAfter : null,
          action: entryOrAction.action || `${op}: ${entryOrAction.entityName || entryOrAction.entityType}`,
          details: entryOrAction.details || entryOrAction.reason || '',
          performedBy: entryOrAction.userName || OWNER_EMAIL,
        };
      } else {
        const isDelete =
          entryOrAction.toUpperCase().includes('DELETE') ||
          entryOrAction.toUpperCase().includes('TRASH') ||
          entryOrAction.includes('حذف');
        logEntry = {
          id: logId,
          operationType: isDelete ? 'حذف' : 'تعديل',
          entityType: entityType || 'عام',
          entityId: entityId || logId,
          entityName: detailsOrReason || entityId || '',
          reason: detailsOrReason || '',
          userName: performedBy,
          timestamp: new Date().toISOString(),
          dataBefore: null,
          dataAfter: null,
          action: entryOrAction,
          details: detailsOrReason || '',
          performedBy,
        };
      }

      const cleaned = cleanObject(logEntry);
      // Save directly to the requested collection audit_log
      await setDoc(doc(db, 'audit_log', logId), cleaned);
    } catch (err) {
      console.warn('Could not write audit log:', err);
    }
  },

  // Fetch recent audit logs from collection audit_log (with fallback to audit_logs)
  async getAuditLogs(max: number = 200): Promise<AuditLogEntry[]> {
    try {
      const q = query(collection(db, 'audit_log'), orderBy('timestamp', 'desc'), limit(max));
      const snap = await getDocs(q);
      const logs = snap.docs.map((d) => d.data() as AuditLogEntry);
      if (logs.length === 0) {
        try {
          const qOld = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(max));
          const snapOld = await getDocs(qOld);
          return snapOld.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: data.id || d.id,
              operationType: data.action?.includes('DELETE') ? 'حذف' : 'تعديل',
              entityType: data.entityType || 'عام',
              entityId: data.entityId || d.id,
              entityName: data.details || '',
              reason: data.details || '',
              userName: data.performedBy || OWNER_EMAIL,
              timestamp: data.timestamp || new Date().toISOString(),
              dataBefore: null,
              dataAfter: null,
              ...data,
            } as AuditLogEntry;
          });
        } catch {
          return [];
        }
      }
      return logs;
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
    await setDoc(doc(db, 'backups', backupId), cleanObject(record));
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
