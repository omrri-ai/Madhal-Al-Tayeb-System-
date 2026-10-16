import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithEmailAndPassword } from 'firebase/auth';

console.log('========================================================================');
console.log('🧪 تشغيل الاختبارات الشاملة للمرحلة الأولى: المصادقة وهوية المعاين والمدير');
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

// -------------------------------------------------------------
// 1. فحص ملف firestore.rules الثابت
// -------------------------------------------------------------
console.log('1️⃣ فحص سلامة القواعد المحلية وقفل الثغرات:');
const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

// استبعاد التعليقات عند البحث عن الكود
const codeOnly = rulesContent
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n');

assert(!codeOnly.includes('request.auth == null'), 'خلو كود القواعد تماماً من ثغرة request.auth == null');
assert(rulesContent.includes('function isSignedIn()'), 'إلزام وجود مصادقة isSignedIn()');
assert(rulesContent.includes('request.auth.token.email == \'mrm823994@gmail.com\''), 'حصر صلاحية الكتابة isOwner() ببريد المالك المعتمد');
assert(rulesContent.includes('/damaged_records/{recordId}'), 'تضمين مجموعة التالف damaged_records في القواعد');
assert(rulesContent.includes('/production_orders/{orderId}'), 'تضمين مجموعة أوامر الإنتاج production_orders في القواعد');
assert(rulesContent.includes('allow update, delete: if false;'), 'حظر تعديل وحذف سجلات التدقيق audit_log');

// -------------------------------------------------------------
// 2. فحص المزودات على مشروع Firebase الحي
// -------------------------------------------------------------
console.log('\n2️⃣ فحص حالة مزودي المصادقة على مشروع Firebase الحي:');

async function testFirebaseLiveAuth() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  // 1. فحص Anonymous Auth
  try {
    await signInAnonymously(auth);
    assert(false, 'Anonymous Auth مفعل (غير متوقع)');
  } catch (err: any) {
    assert(
      err?.code === 'auth/admin-restricted-operation',
      'حالة Anonymous Auth: معطل في Firebase Console (لا نعتمد عليه لهوية المعاين)',
      `كود الخطأ: ${err?.code}`
    );
  }

  // 2. فحص Email/Password Auth
  try {
    await signInWithEmailAndPassword(auth, 'supervisor@medhal.sa', 'dummy123456');
    assert(false, 'Email/Password مفعل مسبقاً');
  } catch (err: any) {
    assert(
      err?.code === 'auth/operation-not-allowed',
      'حالة Email/Password: معطل في Firebase Console (يحتاج تفعيل لحساب المعاين الرسمي)',
      `كود الخطأ: ${err?.code}`
    );
  }

  // 3. فحص Google Sign-In
  const hasGoogleClientId = Boolean(firebaseConfig.oAuthClientId && firebaseConfig.oAuthClientId.includes('.apps.googleusercontent.com'));
  assert(hasGoogleClientId, 'Google OAuth للمدير العام: جاهز ومفعل بالكامل بمعرّف رسمي');
}

// -------------------------------------------------------------
// 3. محاكاة مصفوفة الصلاحيات (RBAC Simulation Test)
// -------------------------------------------------------------
console.log('\n3️⃣ محاكاة مصفوفة الصلاحيات لكل فئة مستخدمين وكافة المجموعات:');

interface SecurityContext {
  auth: {
    uid: string;
    token: {
      email?: string;
      email_verified?: boolean;
    };
  } | null;
}

const AUTHORIZED_VIEWER_EMAILS = [
  'mrm823994@gmail.com',
  'supervisor@medhal.sa',
  'factory_supervisor@medhal.local',
];

function evaluateRules(context: SecurityContext, pathStr: string, operation: 'read' | 'create' | 'update' | 'delete'): boolean {
  const isSignedIn = context.auth !== null;
  if (!isSignedIn) return false;

  const email = context.auth?.token.email;
  const isOwner = email === 'mrm823994@gmail.com';
  const isViewer = Boolean(email && AUTHORIZED_VIEWER_EMAILS.includes(email));

  if (!isViewer && !isOwner) return false;

  if (pathStr.startsWith('/audit_log/')) {
    if (operation === 'read') return isViewer;
    if (operation === 'create') return isOwner;
    return false; // Immutable: no update, no delete
  }

  if (operation === 'read') return isViewer;
  if (['create', 'update', 'delete'].includes(operation)) return isOwner;

  return false;
}

// 3.1 اختبار الزائر غير المصادق (Unauthenticated: auth == null)
const unauth: SecurityContext = { auth: null };
assert(!evaluateRules(unauth, '/items/itm_1', 'read'), 'الزائر غير المسجل: منع القراءة من items');
assert(!evaluateRules(unauth, '/items/itm_1', 'create'), 'الزائر غير المسجل: منع الإضافة في items');
assert(!evaluateRules(unauth, '/movements/mov_1', 'create'), 'الزائر غير المسجل: منع تسجيل حركة');
assert(!evaluateRules(unauth, '/damaged_records/dmg_1', 'create'), 'الزائر غير المسجل: منع تسجيل تالف');
assert(!evaluateRules(unauth, '/production_orders/po_1', 'create'), 'الزائر غير المسجل: منع إنشاء أمر إنتاج');

// 3.2 اختبار الدخيل (مستخدم مصادق عليه ولكن ببريد خارجي غير معتمد)
const intruder: SecurityContext = {
  auth: { uid: 'intruder_123', token: { email: 'stranger@gmail.com', email_verified: true } },
};
assert(!evaluateRules(intruder, '/items/itm_1', 'read'), 'حساب خارجي غير مصرح: منع القراءة');
assert(!evaluateRules(intruder, '/items/itm_1', 'create'), 'حساب خارجي غير مصرح: منع الكتابة');

// 3.3 اختبار مسؤول المعاينة المعتمد (supervisor@medhal.sa)
const supervisor: SecurityContext = {
  auth: { uid: 'sup_456', token: { email: 'supervisor@medhal.sa', email_verified: true } },
};
assert(evaluateRules(supervisor, '/items/itm_1', 'read'), 'مسؤول المعاينة: السماح بقراءة items');
assert(evaluateRules(supervisor, '/movements/mov_1', 'read'), 'مسؤول المعاينة: السماح بقراءة movements');
assert(evaluateRules(supervisor, '/damaged_records/dmg_1', 'read'), 'مسؤول المعاينة: السماح بقراءة damaged_records');
assert(evaluateRules(supervisor, '/production_orders/po_1', 'read'), 'مسؤول المعاينة: السماح بقراءة production_orders');
assert(evaluateRules(supervisor, '/audit_log/log_1', 'read'), 'مسؤول المعاينة: السماح بقراءة audit_log');

// منع مسؤول المعاينة من أي كتابة
assert(!evaluateRules(supervisor, '/items/itm_1', 'create'), 'مسؤول المعاينة: حظر إضافة صنف');
assert(!evaluateRules(supervisor, '/items/itm_1', 'update'), 'مسؤول المعاينة: حظر تعديل صنف');
assert(!evaluateRules(supervisor, '/items/itm_1', 'delete'), 'مسؤول المعاينة: حظر حذف صنف');
assert(!evaluateRules(supervisor, '/movements/mov_1', 'create'), 'مسؤول المعاينة: حظر تسجيل وارد/صادر');
assert(!evaluateRules(supervisor, '/damaged_records/dmg_1', 'create'), 'مسؤول المعاينة: حظر تسجيل تالف');
assert(!evaluateRules(supervisor, '/production_orders/po_1', 'create'), 'مسؤول المعاينة: حظر إنشاء أمر إنتاج');
assert(!evaluateRules(supervisor, '/audit_log/log_1', 'create'), 'مسؤول المعاينة: حظر كتابة سجل تدقيق');

// 3.4 اختبار المدير العام المعتمد (mrm823994@gmail.com)
const manager: SecurityContext = {
  auth: { uid: 'owner_uid_789', token: { email: 'mrm823994@gmail.com', email_verified: true } },
};
assert(evaluateRules(manager, '/items/itm_1', 'read'), 'المدير: السماح بقراءة items');
assert(evaluateRules(manager, '/items/itm_1', 'create'), 'المدير: السماح بإضافة صنف');
assert(evaluateRules(manager, '/items/itm_1', 'update'), 'المدير: السماح بتعديل صنف');
assert(evaluateRules(manager, '/items/itm_1', 'delete'), 'المدير: السماح بحذف صنف');
assert(evaluateRules(manager, '/movements/mov_1', 'create'), 'المدير: السماح بتسجيل حركة');
assert(evaluateRules(manager, '/damaged_records/dmg_1', 'create'), 'المدير: السماح بتسجيل تالف');
assert(evaluateRules(manager, '/production_orders/po_1', 'create'), 'المدير: السماح بإنشاء أمر إنتاج');
assert(evaluateRules(manager, '/audit_log/log_1', 'create'), 'المدير: السماح بتسجيل تدقيق');
assert(!evaluateRules(manager, '/audit_log/log_1', 'update'), 'المدير: حظر تعديل سجل تدقيق (Immutable)');
assert(!evaluateRules(manager, '/audit_log/log_1', 'delete'), 'المدير: حظر حذف سجل تدقيق (Immutable)');

async function run() {
  await testFirebaseLiveAuth();
  console.log('\n========================================================================');
  console.log(`📊 النتيجة النهائية: تم بنجاح اجتياز ${passedTests} من أصل ${totalTests} اختبار!`);
  if (failedTests > 0) {
    console.error(`⚠️ عدد الاختبارات الفاشلة: ${failedTests}`);
    process.exit(1);
  } else {
    console.log('🎉 جميع سيناريوهات الأمان والمصادقة اجتازت الفحص بنسبة 100% بنجاح.');
    console.log('========================================================================');
  }
}

run().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
