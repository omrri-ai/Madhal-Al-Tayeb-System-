import {
  normalizeMovementType,
  getMovementStockEffect,
  signedBaseQty,
  computeAllBalances,
  canWithdraw,
  checkStockHealth,
} from '../src/utils/stockRules';
import { Item, StockMovement, Unit } from '../src/types/inventory';

console.log('========================================================================');
console.log('🧪 تشغيل اختبارات قواعد المخزون ومطابقة الأرصدة (Task 6: stock_rules_test)');
console.log('========================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [نجاح] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [فشل] ${testName}`);
    if (details) console.error(`     تفاصيل: ${details}`);
  }
}

// -----------------------------------------------------------------------------
// 1. فحص توحيد أنواع الحركات العربية والإنجليزية
// -----------------------------------------------------------------------------
console.log('1️⃣ اختبارات دالة normalizeMovementType والأنواع العربية/الإنجليزية:');
assert(normalizeMovementType('IN') === 'IN', 'النوع IN إنجليزي');
assert(normalizeMovementType('وارد') === 'IN', 'النوع وارد بالعربي يطابق IN');
assert(normalizeMovementType('OUT') === 'OUT', 'النوع OUT إنجليزي');
assert(normalizeMovementType('صادر') === 'OUT', 'النوع صادر بالعربي يطابق OUT');
assert(normalizeMovementType('MFG_IN') === 'MFG_IN', 'النوع MFG_IN إنجليزي');
assert(normalizeMovementType('وارد من المصنع') === 'MFG_IN', 'النوع وارد من المصنع بالعربي يطابق MFG_IN');
assert(normalizeMovementType('MFG_OUT') === 'MFG_OUT', 'النوع MFG_OUT إنجليزي');
assert(normalizeMovementType('خروج للمصنع') === 'MFG_OUT', 'النوع خروج للمصنع بالعربي يطابق MFG_OUT');
assert(normalizeMovementType('DAMAGED') === 'DAMAGED', 'النوع DAMAGED');
assert(normalizeMovementType('تالف') === 'DAMAGED', 'النوع تالف بالعربي');
assert(normalizeMovementType('ADJUSTMENT') === 'ADJUSTMENT', 'النوع ADJUSTMENT');
assert(normalizeMovementType('تسوية') === 'ADJUSTMENT', 'النوع تسوية بالعربي');
assert(normalizeMovementType('PRODUCTION_RECEIPT') === 'PRODUCTION_RECEIPT', 'النوع PRODUCTION_RECEIPT');
assert(normalizeMovementType('PRODUCTION_RETURN') === 'PRODUCTION_RETURN', 'النوع PRODUCTION_RETURN');
assert(normalizeMovementType('PRODUCTION_DISPATCH') === 'PRODUCTION_DISPATCH', 'النوع PRODUCTION_DISPATCH');
assert(normalizeMovementType('INVALID_XYZ') === 'UNKNOWN', 'تسجيل النوع غير المعروف كـ UNKNOWN');

// -----------------------------------------------------------------------------
// 2. فحص تأثير أنواع الحركات (زيادة / نقص / تسوية)
// -----------------------------------------------------------------------------
console.log('\n2️⃣ اختبارات جدول أثر الحركة getMovementStockEffect:');
assert(getMovementStockEffect('IN') === 'INCREASE', 'IN يزيد المخزون');
assert(getMovementStockEffect('وارد') === 'INCREASE', 'وارد يزيد المخزون');
assert(getMovementStockEffect('PRODUCTION_RECEIPT') === 'INCREASE', 'PRODUCTION_RECEIPT يزيد المخزون');
assert(getMovementStockEffect('PRODUCTION_RETURN') === 'INCREASE', 'PRODUCTION_RETURN يزيد المخزون');
assert(getMovementStockEffect('MFG_IN') === 'INCREASE', 'MFG_IN يزيد المخزون');
assert(getMovementStockEffect('وارد من المصنع') === 'INCREASE', 'وارد من المصنع يزيد المخزون');

assert(getMovementStockEffect('OUT') === 'DECREASE', 'OUT ينقص المخزون');
assert(getMovementStockEffect('صادر') === 'DECREASE', 'صادر ينقص المخزون');
assert(getMovementStockEffect('PRODUCTION_DISPATCH') === 'DECREASE', 'PRODUCTION_DISPATCH ينقص المخزون');
assert(getMovementStockEffect('MFG_OUT') === 'DECREASE', 'MFG_OUT ينقص المخزون');
assert(getMovementStockEffect('خروج للمصنع') === 'DECREASE', 'خروج للمصنع ينقص المخزون');
assert(getMovementStockEffect('DAMAGED') === 'DECREASE', 'DAMAGED ينقص المخزون');
assert(getMovementStockEffect('تالف') === 'DECREASE', 'تالف ينقص المخزون');

assert(getMovementStockEffect('ADJUSTMENT') === 'ADJUSTMENT', 'ADJUSTMENT تسوية موقّعة');
assert(getMovementStockEffect('تسوية') === 'ADJUSTMENT', 'تسوية موقّعة');

// -----------------------------------------------------------------------------
// 3. اختبارات الكمية الأساسية الموقعة signedBaseQty ومعامل التحويل
// -----------------------------------------------------------------------------
console.log('\n3️⃣ اختبارات دالة signedBaseQty وتحويل المعاملات:');
assert(
  signedBaseQty({ type: 'IN', quantity: 5, factorApplied: 10, baseQuantity: 50 }) === 50,
  'حركة توريد بـ baseQuantity محددة تعطي +50'
);
assert(
  signedBaseQty({ type: 'OUT', quantity: 2, factorApplied: 12, baseQuantity: 24 }) === -24,
  'حركة صرف تعطي -24'
);
assert(
  signedBaseQty({ type: 'ADJUSTMENT', quantity: 10, factorApplied: 1, baseQuantity: 15 }) === 15,
  'تسوية موجبة تعطي +15'
);
assert(
  signedBaseQty({ type: 'ADJUSTMENT', quantity: 5, factorApplied: 1, baseQuantity: -7 }) === -7,
  'تسوية سالبة تعطي -7'
);
// اختبار حساب factor عند غياب baseQuantity
assert(
  signedBaseQty({ type: 'IN', quantity: 3, factorApplied: 12, baseQuantity: undefined as any }) === 36,
  'احتساب factorApplied تلقائياً (3 × 12 = 36) عند غياب baseQuantity'
);
assert(
  signedBaseQty({ type: 'OUT', quantity: 4, factorApplied: 0, baseQuantity: undefined as any }) === -4,
  'معامل التحويل ≤ 0 يُعامل كـ 1 (4 × 1 = -4 للصادر)'
);

// -----------------------------------------------------------------------------
// 4. اختبارات حساب الرصيد التراكمي والرصيد السالب
// -----------------------------------------------------------------------------
console.log('\n4️⃣ اختبارات computeAllBalances والرصيد السالب:');
const sampleItem: Item = {
  id: 'item_1',
  code: 'SKU-001',
  name: 'عطر دهن العود',
  categoryId: 'cat_1',
  baseUnitId: 'u_1',
  conversions: [],
  minStockAlert: 5,
  isArchived: false,
  isDeleted: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const mkMov = (m: any): StockMovement => ({
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...m,
} as StockMovement);

const movementsSample: StockMovement[] = [
  mkMov({
    id: 'mov_1',
    itemId: 'item_1',
    type: 'IN',
    quantity: 100,
    factorApplied: 1,
    baseQuantity: 100,
    date: '2026-01-01T10:00:00Z',
    unitId: 'u_1',
  }),
  mkMov({
    id: 'mov_2',
    itemId: 'item_1',
    type: 'OUT',
    quantity: 30,
    factorApplied: 1,
    baseQuantity: 30,
    date: '2026-01-02T10:00:00Z',
    unitId: 'u_1',
  }),
  mkMov({
    id: 'mov_3',
    itemId: 'item_1',
    type: 'DAMAGED',
    quantity: 5,
    factorApplied: 1,
    baseQuantity: 5,
    date: '2026-01-03T10:00:00Z',
    unitId: 'u_1',
  }),
  mkMov({
    id: 'mov_4',
    itemId: 'item_1',
    type: 'ADJUSTMENT',
    quantity: 2,
    factorApplied: 1,
    baseQuantity: -2,
    date: '2026-01-04T10:00:00Z',
    unitId: 'u_1',
  }),
];

const balances1 = computeAllBalances(movementsSample, [sampleItem]);
assert(balances1.get('item_1') === 63, 'الرصيد الصحيح = 100 - 30 - 5 - 2 = 63');

// اختبار الرصيد السالب الحقيقي (لا يُخفى بـ Math.max(0))
const negativeMovements: StockMovement[] = [
  mkMov({
    id: 'mov_neg_1',
    itemId: 'item_1',
    type: 'IN',
    quantity: 10,
    factorApplied: 1,
    baseQuantity: 10,
    date: '2026-01-01T10:00:00Z',
    unitId: 'u_1',
  }),
  mkMov({
    id: 'mov_neg_2',
    itemId: 'item_1',
    type: 'OUT',
    quantity: 25,
    factorApplied: 1,
    baseQuantity: 25,
    date: '2026-01-02T10:00:00Z',
    unitId: 'u_1',
  }),
];
const balancesNeg = computeAllBalances(negativeMovements, [sampleItem]);
assert(balancesNeg.get('item_1') === -15, 'إرجاع الرصيد السالب الحقيقي (-15) بدون إخفائه بـ 0');

// -----------------------------------------------------------------------------
// 5. اختبارات الأصناف المركبة isComposite
// -----------------------------------------------------------------------------
console.log('\n5️⃣ اختبارات الأصناف المركبة isComposite:');
const rawMaterial1: Item = {
  id: 'raw_box',
  code: 'RAW-01',
  name: 'علبة خشبية فارغة',
  categoryId: 'cat_raw',
  baseUnitId: 'u_1',
  conversions: [],
  minStockAlert: 10,
  isArchived: false,
  isDeleted: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};
const rawMaterial2: Item = {
  id: 'raw_bottle',
  code: 'RAW-02',
  name: 'تولة زجاجية ممتلئة',
  categoryId: 'cat_raw',
  baseUnitId: 'u_1',
  conversions: [],
  minStockAlert: 10,
  isArchived: false,
  isDeleted: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};
const compositeItem: Item = {
  id: 'comp_set',
  code: 'SET-01',
  name: 'طقم هدية ملكي فاخر',
  categoryId: 'cat_sets',
  baseUnitId: 'u_1',
  conversions: [],
  minStockAlert: 2,
  isComposite: true,
  compositeName: 'طقم ملكي',
  components: [
    { itemId: 'raw_box', quantity: 1 },    // يحتاج 1 علبة
    { itemId: 'raw_bottle', quantity: 3 }, // يحتاج 3 تولات
  ],
  isArchived: false,
  isDeleted: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

// علب = 10، تولات = 21 -> الممكن من الطقم = min(10/1, 21/3) = min(10, 7) = 7
const compositeMovements: StockMovement[] = [
  mkMov({
    id: 'mov_c1',
    itemId: 'raw_box',
    type: 'IN',
    quantity: 10,
    factorApplied: 1,
    baseQuantity: 10,
    date: '2026-01-01',
    unitId: 'u_1',
  }),
  mkMov({
    id: 'mov_c2',
    itemId: 'raw_bottle',
    type: 'IN',
    quantity: 21,
    factorApplied: 1,
    baseQuantity: 21,
    date: '2026-01-01',
    unitId: 'u_1',
  }),
];

const compBalances = computeAllBalances(compositeMovements, [rawMaterial1, rawMaterial2, compositeItem]);
assert(compBalances.get('comp_set') === 7, 'رصيد الصنف المركب = أقل ما تسمح به المكونات (7 أطقم)');

// لو كانت المكونات سالبة لأحد العناصر، الصنف المركب لا يقل عن 0
const compositeMovementsWithZero: StockMovement[] = [
  mkMov({
    id: 'mov_cz1',
    itemId: 'raw_box',
    type: 'OUT',
    quantity: 5,
    factorApplied: 1,
    baseQuantity: 5,
    date: '2026-01-01',
    unitId: 'u_1',
  }),
];
const compBalancesZero = computeAllBalances(compositeMovementsWithZero, [rawMaterial1, rawMaterial2, compositeItem]);
assert(compBalancesZero.get('comp_set') === 0, 'رصيد الصنف المركب يبقى بحد أدنى 0 حتى عند نقص المكونات');

// -----------------------------------------------------------------------------
// 6. اختبارات دالة canWithdraw ومنع السحب الزائد
// -----------------------------------------------------------------------------
console.log('\n6️⃣ اختبارات canWithdraw ومنع السحب الزائد:');
assert(canWithdraw(50, 10) === true, 'سحب 10 من رصيد 50 مسموح (true)');
assert(canWithdraw(50, 50) === true, 'سحب كامل الرصيد المتاح 50 من 50 مسموح (true)');
assert(canWithdraw(50, 50.001) === false, 'سحب 50.001 من رصيد 50 ممنوع (false)');
assert(canWithdraw(50, 100) === false, 'سحب 100 من رصيد 50 ممنوع (false)');
assert(canWithdraw(50, 0) === false, 'سحب كمية 0 ممنوع (false)');
assert(canWithdraw(50, -5) === false, 'سحب كمية سالبة ممنوع (false)');
assert(canWithdraw(0, 1) === false, 'السحب من رصيد صفر ممنوع (false)');
assert(canWithdraw(-10, 5) === false, 'السحب من رصيد سالب ممنوع (false)');

// -----------------------------------------------------------------------------
// 7. اختبار تقرير سلامة الأرصدة checkStockHealth
// -----------------------------------------------------------------------------
console.log('\n7️⃣ اختبار تقرير سلامة الأرصدة checkStockHealth:');
const units: Unit[] = [{ id: 'u_1', name: 'حبة', createdAt: '2026-01-01' }];
const badMovements: StockMovement[] = [
  ...movementsSample,
  mkMov({
    id: 'mov_bad_type',
    itemId: 'item_1',
    type: 'UNKNOWN_CUSTOM_TYPE' as any,
    quantity: 1,
    factorApplied: 1,
    baseQuantity: 1,
    date: '2026-01-01',
    unitId: 'u_1',
  }),
  mkMov({
    id: 'mov_dup',
    itemId: 'item_1',
    type: 'IN',
    quantity: 1,
    factorApplied: 1,
    baseQuantity: 1,
    date: '2026-01-01',
    unitId: 'u_1',
  }),
  mkMov({
    id: 'mov_dup',
    itemId: 'item_1',
    type: 'IN',
    quantity: 1,
    factorApplied: 1,
    baseQuantity: 1,
    date: '2026-01-01',
    unitId: 'u_1',
  }),
];
const health = checkStockHealth([sampleItem], badMovements, units);
assert(health.duplicateIdCount > 0, 'اكتشاف المعرفات المكررة في الحركات');
assert(health.unknownTypeMovementsCount > 0, 'اكتشاف الحركات ذات النوع غير المعروف');

console.log('\n========================================================================');
console.log(`📊 النتيجة الإجمالية: ${passedTests} من ${totalTests} اختبار نجح`);
if (failedTests > 0) {
  console.error(`❌ هناك ${failedTests} اختبارات فاشلة!`);
  process.exit(1);
} else {
  console.log('🎉 جميع اختبارات stock_rules_test اجتازت بنجاح 100%!');
}
console.log('========================================================================\n');
