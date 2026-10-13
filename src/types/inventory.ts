export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT';

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
  archiveReason?: string; // Reason why item was archived
  deleteReason?: string; // Reason why item was deleted
  editReason?: string; // Last reason why item was modified
  isArchived: boolean;
  isDeleted: boolean; // Soft delete to Trash
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  name: string;
  managerName?: string;
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
  
  // Destination / Source Snapshot metadata
  destinationType?: 'DIRECT' | 'BRANCH' | 'CUSTOMER' | 'DAMAGED' | 'TRANSFER' | 'OTHER';
  destinationId?: string;
  destinationName?: string;
  destinationContactName?: string;
  destinationPhone?: string;
  destinationAddress?: string;
  destinationTaxId?: string;
  
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

