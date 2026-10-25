export type MovementType =
  | 'IN'
  | 'OUT'
  | 'ADJUSTMENT'
  | 'PRODUCTION_DISPATCH' // صرف للإنتاج (سابق)
  | 'PRODUCTION_RECEIPT'  // استلام منتج جاهز من الإنتاج (سابق)
  | 'PRODUCTION_RETURN'   // مرتجع مواد من الإنتاج للمستودع (سابق)
  | 'MFG_OUT'             // خروج للمصنع
  | 'MFG_IN'              // وارد من المصنع
  | 'DAMAGED'             // تالف
  | 'DAMAGED_RECOVERY'    // راجع من التالف / استرداد
  | 'خروج للمصنع'
  | 'وارد من المصنع'
  | 'راجع من التالف';

export type DamagedSection = 'GENERAL' | 'PRODUCTION';

export type DamagedReason =
  | 'تلف تخزين'
  | 'انتهاء صلاحية'
  | 'كسر / تلف عرضي'
  | 'عيب مصنعي'
  | 'أخرى';

export type DamagedRecoveryReason =
  | 'تم الإصلاح بالمصنع'
  | 'تم الإصلاح محلياً / بالورشة'
  | 'إعادة تأهيل وتجديد'
  | 'سليم بعد الفحص والمعاينة'
  | 'العثور على صنف مفقود'
  | 'أخرى';

export interface DamagedRecoveryEntry {
  id: string;
  date: string;
  quantity: number;
  unitId: string;
  factorApplied: number;
  baseQuantity: number;
  movementId: string;
  referenceNumber?: string;
  reason: DamagedRecoveryReason | string;
  notes?: string;
  createdByName?: string;
  createdAt: string;
}

export interface DamagedRecord {
  id: string;
  date: string;
  section: DamagedSection;
  itemId: string;
  unitId: string;
  quantity: number;
  factorApplied: number;
  baseQuantity: number;
  reason: DamagedReason | string;
  notes?: string;
  movementId?: string;
  createdById?: string;
  createdByName?: string;
  recoveredQuantity?: number;
  recoveredBaseQuantity?: number;
  recoveryHistory?: DamagedRecoveryEntry[];
  status?: 'ACTIVE' | 'PARTIALLY_RECOVERED' | 'FULLY_RECOVERED';
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: string;
  name: string; // e.g., 'حبة', 'كرتون', 'درزن', 'كيلو', 'شدة'
  symbol?: string; // e.g., 'ح', 'كر', 'د', 'كغ'
  description?: string;
  createdAt: string;
}

export interface UnitConversion {
  unitId: string; // Unit ID (e.g., كرتون)
  factorToBase: number; // How many base units are in this unit? (e.g., 1 كرتون = 120 حبة -> factor = 120)
}

export interface Item {
  id: string;
  code: string; // SKU / Barcode / Item Code
  name: string;
  categoryId: string;
  baseUnitId: string; // Primary base unit for stock calculation (e.g., حبة or كيلو)
  conversions: UnitConversion[]; // Specific conversions for this item only
  minStockAlert: number; // In base units; trigger alert if currentStock <= minStockAlert
  costPrice?: number; // Optional cost per base unit
  salePrice?: number; // Optional selling price per base unit
  notes?: string;
  color?: string;
  archiveReason?: string; // Reason why item was archived
  deleteReason?: string; // Reason why item was deleted
  editReason?: string; // Last reason why item was modified
  isProductionItem?: boolean;
  isComposite?: boolean; // New: Composite product
  compositeName?: string; // New: Composite Name
  components?: { itemId: string; quantity: number }[]; // New: Components
  isArchived: boolean;
  isDeleted: boolean; // Soft delete to Trash
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  name: string;
  managerName?: string;
  branchManagerName?: string; // اسم المسؤول / مشرف الفرع
  branchManagerPhone?: string; // رقم جوال المسؤول
  city?: string;
  phone?: string;
  address?: string;
  notes?: string;
  isArchived?: boolean;
  archiveReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  taxId?: string;
  notes?: string;
  isArchived?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CompanySettings {
  name: string;
  commercialRegister: string;
  taxId: string;
  phone: string;
  address: string;
  managerName: string;
  logoUrl?: string;
}

export type ShippingCarrier = 'SMSA' | 'FASTLO' | 'ARAMEX' | 'OTHER';

export interface DispatchItemEntry {
  itemId: string;
  unitId: string;
  quantity: number;
  factorApplied: number;
  baseQuantity: number;
  notes?: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  type: MovementType; // 'IN' (دخول / توريد) or 'OUT' (خروج / صرف)
  unitId: string; // The unit selected by the user for this movement
  quantity: number; // The quantity in the selected unit
  factorApplied: number; // Factor to base unit captured at time of movement
  baseQuantity: number; // Total quantity in item's base unit (quantity * factorApplied)
  date: string; // ISO date-time string
  referenceNumber?: string; // Invoice / Receipt / Doc number
  notes?: string;

  // Item & Unit snapshot fields for fail-safe printing
  itemName?: string;
  itemCode?: string;
  unitName?: string;
  
  // Destination / Source Snapshot metadata
  destinationType?: 'DIRECT' | 'BRANCH' | 'CUSTOMER' | 'DAMAGED' | 'TRANSFER' | 'PRODUCTION' | 'FACTORY' | 'OTHER';
  destinationId?: string;
  destinationName?: string;
  destinationContactName?: string;
  destinationPhone?: string;
  destinationAddress?: string;
  destinationTaxId?: string;
  
  // Production Order Link
  productionOrderId?: string;
  productionOrderNumber?: string;
  
  // Damaged Record Link
  damagedRecordId?: string;
  
  // Legacy / Direct fields
  branchId?: string;
  branchName?: string;
  customerName?: string;
  customerPhone?: string;
  customerCity?: string;

  // Supplier Snapshot for IN movements
  supplierName?: string;
  supplierPhone?: string;
  supplierAddress?: string;
  supplierTaxId?: string;

  shippingCompany?: ShippingCarrier;
  customShippingCompany?: string;
  shippingTrackingNumber?: string;
  batchId?: string; // Groups multi-item dispatches together
  
  createdByName?: string;
  status?: 'APPROVED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string; // Optional accent color
  createdAt: string;
}

export interface ItemStockSummary {
  item: Item;
  categoryName: string;
  baseUnitName: string;
  currentStock: number; // In base unit
  totalIn: number;
  totalOut: number;
  formattedBalances: {
    unitName: string;
    factor: number;
    equivalent: number;
  }[];
  status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';
}

export interface InventoryStats {
  totalItemsCount: number;
  activeItemsCount: number;
  archivedItemsCount: number;
  deletedItemsCount: number;
  categoriesCount: number;
  todayInMovementsCount: number;
  todayOutMovementsCount: number;
  todayInQuantityBase: number;
  todayOutQuantityBase: number;
  lowStockItemsCount: number;
  outOfStockItemsCount: number;
  branchesCount: number;
  activeBranchesCount: number;
  archivedBranchesCount: number;
  // Returns stats
  totalReturnsCount: number;
  approvedReturnsCount: number;
  draftReturnsCount: number;
  inReturnsCount: number;
  outReturnsCount: number;
  // Production stats
  totalProductionOrdersCount: number;
  openProductionOrdersCount: number;
  pendingReceiptProductionOrdersCount: number;
  completedProductionOrdersCount: number;
}

export type ReturnType = 'RETURN_IN' | 'RETURN_OUT';
export type ReturnStatus = 'DRAFT' | 'APPROVED' | 'CANCELLED';
export type ReturnReason =
  | 'DAMAGED'
  | 'DEFECTIVE'
  | 'EXPIRED'
  | 'WRONG_ITEM'
  | 'SURPLUS'
  | 'CUSTOMER_REQUEST'
  | 'OTHER';

export interface ReturnItemEntry {
  itemId: string;
  unitId: string;
  quantity: number;
  factorApplied: number;
  baseQuantity: number;
  notes?: string;
  originalMovementId?: string;
}

export interface ReturnRecord {
  id: string;
  returnNumber: string;
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
  items: ReturnItemEntry[];
  linkedMovementIds: string[];
  reversalMovementIds?: string[];
  createdByName?: string;
  approvedAt?: string;
  approvedByName?: string;
  cancelledAt?: string;
  cancelledByName?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  operationType: 'تعديل' | 'حذف' | string;
  entityType: 'صنف' | 'قسم' | 'وحدة' | 'فرع' | 'عميل' | 'حركة مخزنية' | 'مرتجع' | 'إعدادات' | string;
  entityId: string;
  entityName: string;
  reason: string;
  userName: string;
  timestamp: string;
  dataBefore: any;
  dataAfter: any | null;
  // Backward compatibility fields
  action?: string;
  details?: string;
  performedBy?: string;
}

// ==========================================
// PRODUCTION MANAGEMENT TYPES (نظام إدارة الإنتاج والتصنيع)
// ==========================================

export type ProductionOrderStatus = 'OPEN' | 'PENDING_RECEIPT' | 'COMPLETED' | 'CANCELLED';

export interface ProductionOrderMaterialEntry {
  itemId: string;
  unitId: string;
  dispatchedQuantity: number;      // الكمية المصروفة بالوحدة المختارة
  dispatchedBaseQuantity: number;  // الكمية المصروفة بالوحدة الأساسية
  consumedBaseQuantity: number;    // الكمية المستهلكة بالوحدة الأساسية
  scrapBaseQuantity: number;       // الكمية التالفة/الهالكة بالوحدة الأساسية (ضمن المستهلك)
  scrapReason?: string | null;     // سبب الهالك
  returnedBaseQuantity: number;    // الكمية المرتجعة للمستودع بالوحدة الأساسية
  currentCustodyBaseQuantity: number; // العهدة المتبقية = المصروف - المستهلك - المرتجع
}

export interface ProductionOrderFinishedGood {
  itemId: string;                  // معرّف الصنف المنتج الجاهز
  unitId: string;                  // الوحدة المختارة للإنتاج
  plannedQuantity: number;         // الكمية المستهدفة
  completedQuantity: number;       // الكمية المصنوعة المكتملة
  completedBaseQuantity: number;   // بالوحدة الأساسية
  receivedQuantity: number;        // الكمية المستلمة في المخزون
  receivedBaseQuantity: number;    // بالوحدة الأساسية
  pendingReceiptQuantity: number;  // بانتظار الاستلام = completed - received
  pendingReceiptBaseQuantity: number;
}

export interface ProductionDispatchItemEntry {
  itemId: string;
  unitId: string;
  quantity: number;
  factorApplied: number;
  baseQuantity: number;
  notes?: string | null;
}

export interface ProductionDispatchRecord {
  id: string;                      // معرّف فريد للعملية
  voucherNumber: string;           // رقم السند: PRD-DSP-2026-XXXX
  productionOrderId: string;
  productionOrderNumber: string;
  date: string;
  items: ProductionDispatchItemEntry[];
  movementIds: string[];           // المعرفات المرتبطة في movements
  notes?: string | null;
  createdByName?: string | null;
  createdAt: string;
}

export interface ProductionConsumptionItemEntry {
  itemId: string;
  unitId: string;
  quantity: number;
  factorApplied: number;
  baseQuantity: number;
  scrapQuantity?: number;
  scrapBaseQuantity?: number;
  scrapReason?: string | null;
  notes?: string | null;
}

export interface ProductionConsumptionRecord {
  id: string;                      // معرّف فريد للعملية
  productionOrderId: string;
  productionOrderNumber: string;
  date: string;
  items: ProductionConsumptionItemEntry[];
  completedGoodsQuantity?: number; // إن كان تسجيل الاستهلاك مترافقاً مع إنتاج مكتمل
  notes?: string | null;
  createdByName?: string | null;
  createdAt: string;
}

export interface ProductionReceiptRecord {
  id: string;                      // معرّف فريد للعملية
  voucherNumber: string;           // رقم السند: PRD-REC-2026-XXXX
  productionOrderId: string;
  productionOrderNumber: string;
  date: string;
  itemId: string;
  unitId: string;
  quantity: number;
  factorApplied: number;
  baseQuantity: number;
  movementId: string;              // الحركة المسجلة في movements
  notes?: string | null;
  createdByName?: string | null;
  createdAt: string;
}

export interface ProductionReturnItemEntry {
  itemId: string;
  unitId: string;
  quantity: number;
  factorApplied: number;
  baseQuantity: number;
  notes?: string | null;
}

export interface ProductionReturnRecord {
  id: string;                      // معرّف فريد للعملية
  voucherNumber: string;           // رقم السند: PRD-RET-2026-XXXX
  productionOrderId: string;
  productionOrderNumber: string;
  date: string;
  items: ProductionReturnItemEntry[];
  movementIds: string[];           // الحركات المسجلة في movements
  notes?: string | null;
  createdByName?: string | null;
  createdAt: string;
}

export interface ProductionOrder {
  id: string;                      // معرّف الوثيقة في production_orders
  orderNumber: string;             // PRD-2026-0001
  title: string;                   // وصف أو اسم عملية الإنتاج
  targetItemId?: string | null;    // الصنف الجاهز المستهدف
  targetUnitId?: string | null;    // وحدة الصنف الجاهز
  plannedQuantity?: number;        // الكمية المخطط إنتاجها
  status: ProductionOrderStatus;
  date: string;                    // تاريخ أمر الإنتاج
  notes?: string | null;

  // المواد الخام وعهدة الإنتاج
  materials: ProductionOrderMaterialEntry[];

  // المنتج التام بانتظار الاستلام والمستلم
  finishedGood?: ProductionOrderFinishedGood | null;

  // سجلات العمليات المرتبطة بالأمر
  dispatches: ProductionDispatchRecord[];
  consumptions: ProductionConsumptionRecord[];
  receipts: ProductionReceiptRecord[];
  returns: ProductionReturnRecord[];

  createdAt: string;
  updatedAt: string;
  createdByName?: string | null;
}


