import { StockMovement, Item, Unit, MovementType } from '../types/inventory';
import { deduplicateById } from './arabicSearch';

/**
 * -----------------------------------------------------------------------------
 * stockRules.ts
 * دوال نقية بلا React لإدارة وتوحيد قواعد المخزون، احتساب الأرصدة، والتحقق من الحركات
 * -----------------------------------------------------------------------------
 */

export type NormalizedMovementType =
  | 'IN'
  | 'OUT'
  | 'ADJUSTMENT'
  | 'PRODUCTION_RECEIPT'
  | 'PRODUCTION_RETURN'
  | 'PRODUCTION_DISPATCH'
  | 'MFG_IN'
  | 'MFG_OUT'
  | 'DAMAGED'
  | 'DAMAGED_RECOVERY'
  | 'UNKNOWN';

export type MovementStockEffect = 'INCREASE' | 'DECREASE' | 'ADJUSTMENT' | 'NONE';

/**
 * دالة لتحديد حركات التسوية الجردية الصامتة/المخفية التي يجب حجبها تماماً
 * عن سجلات الحركات، شاشات العرض، وتقارير الحركات للمشاهد والتقارير العامة.
 */
export function isSilentMovement(
  m: {
    isHidden?: boolean;
    isSilent?: boolean;
    notes?: string;
    type?: string;
  } | undefined | null,
  isAdmin?: boolean
): boolean {
  if (!m) return false;
  // If explicitly in viewer mode (not admin), hide all adjustments from the viewer
  if (isAdmin === false && m.type === 'ADJUSTMENT') return true;
  if (m.isHidden || m.isSilent) return true;
  const notes = m.notes || '';
  if (
    notes.includes('تسوية جردية صامتة') ||
    notes.includes('تعديل صامت') ||
    notes.includes('صامتة') ||
    notes.includes('تعديل الرصيد الصامت') ||
    notes.includes('صامت')
  ) {
    return true;
  }
  return false;
}

/**
 * 1. جدول وحيد لتأثير كل نوع حركة:
 * - يزيد الرصيد: IN، PRODUCTION_RECEIPT، PRODUCTION_RETURN، MFG_IN، "وارد من المصنع"، DAMAGED_RECOVERY، "راجع من التالف"
 * - ينقص الرصيد: OUT، PRODUCTION_DISPATCH، MFG_OUT، DAMAGED، "خروج للمصنع"
 * - ADJUSTMENT: كميته الأساسية موقّعة (موجبة تزيد وسالبة تنقص)
 */
export const MOVEMENT_TYPE_EFFECT_MAP: Record<string, MovementStockEffect> = {
  // يزيد الرصيد (+):
  IN: 'INCREASE',
  PRODUCTION_RECEIPT: 'INCREASE',
  PRODUCTION_RETURN: 'INCREASE',
  MFG_IN: 'INCREASE',
  DAMAGED_RECOVERY: 'INCREASE',
  'وارد من المصنع': 'INCREASE',
  'راجع من التالف': 'INCREASE',
  'استرداد تالف': 'INCREASE',
  وارد: 'INCREASE',

  // ينقص الرصيد (-):
  OUT: 'DECREASE',
  PRODUCTION_DISPATCH: 'DECREASE',
  MFG_OUT: 'DECREASE',
  DAMAGED: 'DECREASE',
  'خروج للمصنع': 'DECREASE',
  تالف: 'DECREASE',
  صادر: 'DECREASE',

  // تسوية جردية موقّعة (+/-):
  ADJUSTMENT: 'ADJUSTMENT',
  تسوية: 'ADJUSTMENT',
};

/**
 * دالة normalizeMovementType توحّد الأسماء العربية مع الإنجليزية،
 * وأي نوع غير معروف يُسجَّل تحذيراً ولا يُتجاهل بصمت.
 */
export function normalizeMovementType(rawType: string | undefined | null): NormalizedMovementType {
  if (!rawType) {
    console.warn('[stockRules] تحذير: نوع الحركة فارغ أو غير محدد:', rawType);
    return 'UNKNOWN';
  }

  const trimmed = String(rawType).trim();

  switch (trimmed) {
    case 'IN':
    case 'وارد':
      return 'IN';
    case 'OUT':
    case 'صادر':
      return 'OUT';
    case 'ADJUSTMENT':
    case 'تسوية':
      return 'ADJUSTMENT';
    case 'PRODUCTION_RECEIPT':
      return 'PRODUCTION_RECEIPT';
    case 'PRODUCTION_RETURN':
      return 'PRODUCTION_RETURN';
    case 'PRODUCTION_DISPATCH':
      return 'PRODUCTION_DISPATCH';
    case 'MFG_IN':
    case 'وارد من المصنع':
      return 'MFG_IN';
    case 'MFG_OUT':
    case 'خروج للمصنع':
      return 'MFG_OUT';
    case 'DAMAGED':
    case 'تالف':
      return 'DAMAGED';
    case 'DAMAGED_RECOVERY':
    case 'راجع من التالف':
    case 'استرداد تالف':
      return 'DAMAGED_RECOVERY';
    default:
      console.warn(`[stockRules] تحذير: نوع حركة غير معروف لم يُتعرف عليه: "${rawType}"`);
      return 'UNKNOWN';
  }
}

/**
 * دالة لتحديد الأثر المباشر لنوع الحركة على الرصيد
 */
export function getMovementStockEffect(type: string | undefined | null): MovementStockEffect {
  const norm = normalizeMovementType(type);
  if (norm === 'UNKNOWN') return 'NONE';

  if (
    norm === 'IN' ||
    norm === 'PRODUCTION_RECEIPT' ||
    norm === 'PRODUCTION_RETURN' ||
    norm === 'MFG_IN' ||
    norm === 'DAMAGED_RECOVERY'
  ) {
    return 'INCREASE';
  }

  if (
    norm === 'OUT' ||
    norm === 'PRODUCTION_DISPATCH' ||
    norm === 'MFG_OUT' ||
    norm === 'DAMAGED'
  ) {
    return 'DECREASE';
  }

  if (norm === 'ADJUSTMENT') {
    return 'ADJUSTMENT';
  }

  return 'NONE';
}

/**
 * دالة حساب الكمية الأساسية الخام (بدون إشارة)
 */
export function getUnsignedBaseQuantity(
  movement: Pick<StockMovement, 'quantity' | 'factorApplied' | 'baseQuantity'>
): number {
  if (
    movement.baseQuantity !== undefined &&
    movement.baseQuantity !== null &&
    !isNaN(Number(movement.baseQuantity))
  ) {
    return Math.abs(Number(movement.baseQuantity));
  }

  const factor = Number(movement.factorApplied) > 0 ? Number(movement.factorApplied) : 1;
  const qty = Number(movement.quantity) || 0;
  return Math.abs(qty * factor);
}

/**
 * 2. دالة signedBaseQty(movement):
 * تستخدم baseQuantity إن كانت رقماً صحيحاً (أو صالحاً)،
 * وإلا quantity × factorApplied (مع factor ≤ 0 تُعامل كـ 1).
 * ترجع القيمة الموقّعة حسب نوع الحركة (موجبة للوارد، سالبة للصادر، وموقّعة للتسوية).
 */
export function signedBaseQty(
  movement: Pick<StockMovement, 'type' | 'quantity' | 'factorApplied' | 'baseQuantity'>
): number {
  const factor = Number(movement.factorApplied) > 0 ? Number(movement.factorApplied) : 1;

  let rawBase: number;
  if (
    movement.baseQuantity !== undefined &&
    movement.baseQuantity !== null &&
    !isNaN(Number(movement.baseQuantity))
  ) {
    rawBase = Number(movement.baseQuantity);
  } else {
    rawBase = (Number(movement.quantity) || 0) * factor;
  }

  const effect = getMovementStockEffect(movement.type);

  switch (effect) {
    case 'INCREASE':
      return Math.abs(rawBase);
    case 'DECREASE':
      return -Math.abs(rawBase);
    case 'ADJUSTMENT':
      // في التسوية: القيمة موقّعة بذاتها (+ تزيد، - تنقص)
      return rawBase;
    case 'NONE':
    default:
      return 0;
  }
}

/**
 * 3. دالة computeAllBalances(movements, items?):
 * تُرجع Map<itemId, balance> بمرور واحد على الحركات بعد إزالة التكرار (deduplicateById)،
 * بتقريب 3 خانات.
 * 4. الأصناف المركّبة (isComposite):
 * الرصيد = أقل ما تسمح به المكونات (نفس المنطق الحالي)، وبحد أدنى 0.
 */
export function computeAllBalances(
  movements: StockMovement[],
  items?: Item[]
): Map<string, number> {
  const uniqueMovements = deduplicateById(movements || []);
  const balanceMap = new Map<string, number>();

  // مرور واحد لحساب أرصدة الأصناف الأساسية
  for (let i = 0; i < uniqueMovements.length; i++) {
    const m = uniqueMovements[i];
    if (!m || !m.itemId) continue;

    const delta = signedBaseQty(m);
    const prev = balanceMap.get(m.itemId) || 0;
    balanceMap.set(m.itemId, prev + delta);
  }

  // تقريب الأرصدة إلى 3 خانات
  for (const [id, val] of balanceMap.entries()) {
    balanceMap.set(id, Math.round(val * 1000) / 1000);
  }

  // إذا تم تمرير الأصناف: التحقق من الأصناف المركبة (isComposite) وضمان وجود كل صنف
  if (items && Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it || it.isDeleted) continue;

      if (!balanceMap.has(it.id)) {
        balanceMap.set(it.id, 0);
      }

      // الأصناف المركبة: الرصيد = أقل ما تسمح به المكونات
      if (it.isComposite && Array.isArray(it.components) && it.components.length > 0) {
        let minUnits = Infinity;

        for (const comp of it.components) {
          if (!comp || comp.quantity <= 0) {
            minUnits = 0;
            break;
          }
          const compStock = balanceMap.get(comp.itemId) || 0;
          const possible = compStock / comp.quantity;
          if (possible < minUnits) {
            minUnits = possible;
          }
        }

        const compositeStock =
          minUnits === Infinity ? 0 : Math.max(0, Math.round(minUnits * 1000) / 1000);
        balanceMap.set(it.id, compositeStock);
      }
    }
  }

  return balanceMap;
}

/**
 * 5. دالة canWithdraw(balance, baseQty):
 * ترجع false إذا baseQty ≤ 0 أو أكبر من الرصيد.
 * السحب بكامل الرصيد المتاح مسموح (baseQty <= balance -> true).
 */
export function canWithdraw(balance: number, baseQty: number): boolean {
  if (baseQty <= 0) return false;
  const roundedBalance = Math.round(balance * 1000) / 1000;
  const roundedQty = Math.round(baseQty * 1000) / 1000;
  return roundedQty <= roundedBalance;
}

/**
 * تقرير سلامة الأرصدة (للقراءة فقط - المهمة 5)
 */
export interface StockHealthIssue {
  type:
    | 'NEGATIVE_STOCK'
    | 'UNKNOWN_MOVEMENT_TYPE'
    | 'ORPHANED_ITEM_MOVEMENT'
    | 'ORPHANED_UNIT_MOVEMENT'
    | 'INVALID_BASE_QUANTITY'
    | 'DUPLICATE_ID';
  severity: 'ERROR' | 'WARNING';
  entityId: string;
  entityName?: string;
  details: string;
}

export interface StockHealthReport {
  generatedAt: string;
  totalItemsScanned: number;
  totalMovementsScanned: number;
  negativeStockCount: number;
  unknownTypeMovementsCount: number;
  orphanedMovementsCount: number;
  invalidBaseQtyCount: number;
  duplicateIdCount: number;
  issues: StockHealthIssue[];
}

/**
 * فحص سلامة الأرصدة والحركات للقراءة والتشخيص
 */
export function checkStockHealth(
  items: Item[],
  movements: StockMovement[],
  units: Unit[]
): StockHealthReport {
  const issues: StockHealthIssue[] = [];
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const unitMap = new Map(units.map((u) => [u.id, u]));

  // 1. فحص المعرفات المكررة في الحركات والأصناف
  const seenMovementIds = new Set<string>();
  const duplicateMovementIds = new Set<string>();
  for (const m of movements) {
    if (m.id) {
      if (seenMovementIds.has(m.id)) {
        duplicateMovementIds.add(m.id);
      } else {
        seenMovementIds.add(m.id);
      }
    }
  }
  for (const dupId of duplicateMovementIds) {
    issues.push({
      type: 'DUPLICATE_ID',
      severity: 'ERROR',
      entityId: dupId,
      details: `معرف حركة مكرر في السجلات: ${dupId}`,
    });
  }

  // 2. حساب الأرصدة وفحص الأصناف ذات الرصيد السالب
  const balances = computeAllBalances(movements, items);
  let negativeCount = 0;
  for (const item of items) {
    if (item.isDeleted) continue;
    const bal = balances.get(item.id) ?? 0;
    if (bal < 0) {
      negativeCount++;
      issues.push({
        type: 'NEGATIVE_STOCK',
        severity: 'ERROR',
        entityId: item.id,
        entityName: item.name,
        details: `الصنف "${item.name}" (${item.code}) يمتلك رصيداً سالباً: ${bal}`,
      });
    }
  }

  // 3. فحص الحركات
  let unknownTypeCount = 0;
  let orphanedCount = 0;
  let invalidBaseQtyCount = 0;

  for (const m of movements) {
    // نوع غير معروف
    const norm = normalizeMovementType(m.type);
    if (norm === 'UNKNOWN') {
      unknownTypeCount++;
      issues.push({
        type: 'UNKNOWN_MOVEMENT_TYPE',
        severity: 'WARNING',
        entityId: m.id,
        details: `الحركة #${m.referenceNumber || m.id} تحتوي على نوع حركة غير معروف: "${m.type}"`,
      });
    }

    // حركة مرتبطة بصنف غير موجود
    if (!itemMap.has(m.itemId)) {
      orphanedCount++;
      issues.push({
        type: 'ORPHANED_ITEM_MOVEMENT',
        severity: 'ERROR',
        entityId: m.id,
        details: `الحركة #${m.referenceNumber || m.id} تشير إلى صنف غير موجود برمز المعرف: ${m.itemId}`,
      });
    }

    // حركة مرتبطة بوحدة غير موجودة
    if (m.unitId && !unitMap.has(m.unitId)) {
      orphanedCount++;
      issues.push({
        type: 'ORPHANED_UNIT_MOVEMENT',
        severity: 'WARNING',
        entityId: m.id,
        details: `الحركة #${m.referenceNumber || m.id} تشير إلى وحدة غير موجودة برمز المعرف: ${m.unitId}`,
      });
    }

    // فحص baseQuantity غير صالح أو غير متطابق
    const factor = Number(m.factorApplied) > 0 ? Number(m.factorApplied) : 1;
    const expectedBase = Math.round((Number(m.quantity) || 0) * factor * 1000) / 1000;
    const actualBase = Number(m.baseQuantity);

    if (
      m.baseQuantity === undefined ||
      m.baseQuantity === null ||
      isNaN(actualBase) ||
      (actualBase === 0 && Number(m.quantity) > 0)
    ) {
      invalidBaseQtyCount++;
      issues.push({
        type: 'INVALID_BASE_QUANTITY',
        severity: 'WARNING',
        entityId: m.id,
        details: `الحركة #${m.referenceNumber || m.id} تحوي baseQuantity غير صالحة (${m.baseQuantity}) مع كمية ${m.quantity}`,
      });
    } else if (Math.abs(actualBase - expectedBase) > 0.01 && m.type !== 'ADJUSTMENT') {
      invalidBaseQtyCount++;
      issues.push({
        type: 'INVALID_BASE_QUANTITY',
        severity: 'WARNING',
        entityId: m.id,
        details: `الحركة #${m.referenceNumber || m.id} غير متطابقة: baseQuantity (${actualBase}) ≠ quantity (${m.quantity}) × factor (${factor}) = ${expectedBase}`,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totalItemsScanned: items.length,
    totalMovementsScanned: movements.length,
    negativeStockCount: negativeCount,
    unknownTypeMovementsCount: unknownTypeCount,
    orphanedMovementsCount: orphanedCount,
    invalidBaseQtyCount: invalidBaseQtyCount,
    duplicateIdCount: duplicateMovementIds.size,
    issues,
  };
}
