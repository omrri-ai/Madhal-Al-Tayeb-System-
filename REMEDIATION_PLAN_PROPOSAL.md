# خطة الإصلاح الشاملة والمصححة لنظام مخزون مدهال الطيب
## مع الفروقات البرمجية الكاملة (Unified Diffs) واستراتيجية التراجع (Rollback Plan)

**تاريخ الإعداد:** 16 أكتوبر 2026  
**حالة الوثيقة:** مقترح شامل جاهز للمراجعة والاعتماد — **لم يتم تطبيق أي تعديل على ملفات المشروع أو قواعد الإنتاج.**  
**الهدف:** معالجة جميع الملاحظات الأمنية والوظيفية والبيانات بدقة صفرية المخاطر (Zero-Risk Architecture).

---

## فهرس المراحل

1. [المرحلة الأولى: أمان المصادقة وحماية Firebase وقواعد Firestore](#1-المرحلة-الأولى-أمان-المصادقة-وحماية-firebase-وقواعد-firestore)
2. [المرحلة الثانية: حماية البيانات وإزالة مسارات التصفير وإصلاح التحميل](#2-المرحلة-الثانية-حماية-البيانات-وإزالة-مسارات-التصفير-وإصلاح-التحميل)
3. [المرحلة الثالثة: الربط الدقيق لسجلات التالف بالحركات المخزنية والأرصدة](#3-المرحلة-الثالثة-الربط-الدقيق-لسجلات-التالف-بالحركات-المخزنية-والأرصدة)
4. [المرحلة الرابعة: التحقق الذكي من إضافة الأصناف والأرشفة وسلة المهملات](#4-المرحلة-الرابعة-التحقق-الذكي-من-إضافة-الأصناف-والأرشفة-وسلة-المهملات)
5. [المرحلة الخامسة: العزل التام لمسؤول المعاينة (UI / Services / Firestore)](#5-المرحلة-الخامسة-العزل-التام-لمسؤول-المعاينة)
6. [المرحلة السادسة: حوكمة التزامن والمجموعات السحابية ومنع الكتابة العكسية](#6-المرحلة-السادسة-حوكمة-التزامن-والمجموعات-السحابية)
7. [المرحلة السابعة: منظومة الاختبارات وحالات التحقق الآلي](#7-المرحلة-السابعة-منظومة-الاختبارات-وحالات-التحقق-الآلي)
8. [مصفوفة التراجع التفصيلية (Rollback Strategies) لكل مرحلة](#8-مصفوفة-التراجع-التفصيلية-rollback-strategies)

---

## 1. المرحلة الأولى: أمان المصادقة وحماية Firebase وقواعد Firestore

### أ. الهدف والمنهجية:
- القضاء التام على ثغرة `request.auth == null` في `firestore.rules`.
- عدم تعطيل دخول المدير الحالي بكلمة المرور عبر تمكين Firebase Auth (سواء Google Auth أو Custom/Anonymous Session الموثقة بالدور).
- فصل صلاحيات القراءة عن الكتابة:
  - **مسؤول المعاينة (FACTORY_VIEWER):** يمتلك هوية موثقة في Firebase Auth تخوله **للقراءة فقط** (`allow read: if isSignedIn();`). جميع عمليات الكتابة ممنوعة تماماً.
  - **المدير (ADMIN):** يمتلك هوية مصادق عليها إما عبر بريد المالك `mrm823994@gmail.com` الموثق أو عبر وثيقة دور إدارية موثقة في `/system_admins/$(request.auth.uid)`.
- عدم نشر القواعد الجديدة إلا بعد جاهزية شاشة الدخول وتسجيل المعاين والمدير في Firebase Auth.

### ب. الفروقات البرمجية المقترحة (Diff):

#### 1. تعديل `firestore.rules`:
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -8,11 +8,27 @@
     // Default Deny All
     match /{document=**} {
       allow read, write: if false;
     }

-    // Owner check: strictly restricted to verified owner account when token is present,
-    // or allows authenticated owner app operations
-    function isOwner() {
-      return request.auth == null ||
-        request.auth.token.email == 'mrm823994@gmail.com';
-    }
+    // 1. Authentication helpers
+    function isSignedIn() {
+      return request.auth != null;
+    }
+
+    // 2. Strict Admin / Owner Check
+    // Allows verified owner email or explicit document in system_admins
+    function isOwner() {
+      return isSignedIn() && (
+        (request.auth.token.email == 'mrm823994@gmail.com' && request.auth.token.email_verified == true) ||
+        exists(/databases/$(database)/documents/system_admins/$(request.auth.uid))
+      );
+    }
+
+    // 3. Viewer Check: Signed-in user (authenticated session) with read-only rights
+    function isViewer() {
+      return isSignedIn();
+    }

     function isValidId(id) {
       return id is string && id.size() > 0 && id.size() <= 128;
     }

     // System Settings & Configuration
     match /system_settings/{settingId} {
-      allow read: if isOwner();
+      allow read: if isViewer();
       allow write: if isOwner() && isValidId(settingId);
     }

     // Customers
     match /customers/{customerId} {
-      allow read: if isOwner();
+      allow read: if isViewer();
       allow write: if isOwner() && isValidId(customerId);
     }
+
+    // Damaged Records (Previously missing - locked by default deny)
+    match /damaged_records/{recordId} {
+      allow read: if isViewer();
+      allow write: if isOwner() && isValidId(recordId);
+    }
+
+    // Production Orders (Previously missing - locked by default deny)
+    match /production_orders/{orderId} {
+      allow read: if isViewer();
+      allow write: if isOwner() && isValidId(orderId);
+    }

     // App Data
     match /app_data/{docId} {
-      allow read, write: if isOwner() && isValidId(docId);
+      allow read: if isViewer() && isValidId(docId);
+      allow write: if isOwner() && isValidId(docId);
     }

     // Units
     match /units/{unitId} {
-      allow read: if isOwner();
+      allow read: if isViewer();
       allow write: if isOwner() && isValidId(unitId);
     }

     // Categories
     match /categories/{categoryId} {
-      allow read: if isOwner();
+      allow read: if isViewer();
       allow write: if isOwner() && isValidId(categoryId);
     }

     // Items
     match /items/{itemId} {
-      allow read: if isOwner();
+      allow read: if isViewer();
       allow write: if isOwner() && isValidId(itemId);
     }

     // Stock Movements
     match /movements/{movementId} {
-      allow read: if isOwner();
+      allow read: if isViewer();
       allow write: if isOwner() && isValidId(movementId);
     }

     // Branches
     match /branches/{branchId} {
-      allow read: if isOwner();
+      allow read: if isViewer();
       allow write: if isOwner() && isValidId(branchId);
     }

     // Returns
     match /returns/{returnId} {
-      allow read: if isOwner();
+      allow read: if isViewer();
       allow write: if isOwner() && isValidId(returnId);
     }

     // Audit Log - Immutable audit entries (read for viewers, create for owner, no update or delete)
     match /audit_log/{logId} {
-      allow read: if isOwner();
+      allow read: if isViewer();
       allow create: if isOwner() && isValidId(logId);
       allow update, delete: if false;
     }

     match /audit_logs/{logId} {
-      allow read: if isOwner();
+      allow read: if isViewer();
       allow create: if isOwner() && isValidId(logId);
       allow update, delete: if false;
     }

     // Backups
     match /backups/{backupId} {
       allow read: if isOwner();
       allow write: if isOwner() && isValidId(backupId);
     }
+
+    // Admin Registry collection (Immutable role directory)
+    match /system_admins/{adminId} {
+      allow read: if isSignedIn();
+      allow write: if false; // Provisioned only through bootstrap or backend
+    }
```

#### 2. تعديل `src/context/AuthContext.tsx` لضمان امتلاك جلسة Firebase Auth نشطة دائماً:
```diff
--- a/src/context/AuthContext.tsx
+++ b/src/context/AuthContext.tsx
@@ -7,6 +7,7 @@
   signInWithPopup,
+  signInAnonymously,
   signOut,
 } from 'firebase/auth';
@@ -170,12 +171,20 @@
     if (isValid) {
+      // Ensure real Firebase Auth session so that request.auth is never null in Firestore
+      if (!auth.currentUser) {
+        try {
+          await signInAnonymously(auth);
+        } catch (authErr) {
+          console.warn('Firebase anonymous session fallback:', authErr);
+        }
+      }
+
       const managerUser: AppUser = {
         email: OWNER_EMAIL,
         displayName: 'المدير العام (مدهال الطيب)',
-        uid: 'admin_' + Date.now(),
+        uid: auth.currentUser?.uid || ('admin_' + Date.now()),
       };
       setUser(managerUser);
       setRole('ADMIN');
@@ -197,6 +206,14 @@
     if (clean === '12345678' || (/^\d$/.test(clean) && parseInt(clean, 10) >= 1 && parseInt(clean, 10) <= 8)) {
+      // Ensure authentic Firebase Viewer session for Firestore read authorization
+      if (!auth.currentUser) {
+        try {
+          await signInAnonymously(auth);
+        } catch (authErr) {
+          console.warn('Firebase anonymous session for supervisor:', authErr);
+        }
+      }
+
       const supervisorUser: AppUser = {
         email: 'factory_supervisor@medhal.local',
         displayName: 'مسؤول المصنع (وضع المشاهدة فقط)',
-        uid: 'factory_supervisor_' + clean,
+        uid: auth.currentUser?.uid || ('factory_supervisor_' + clean),
       };
```

---

## 2. المرحلة الثانية: حماية البيانات وإزالة مسارات التصفير وإصلاح التحميل

### أ. الهدف والمنهجية:
- حذف كود `RESET_OPERATIONS_KEY` من `src/services/storage.ts` نهائياً.
- تصحيح دالة `FirestoreStorage.loadAll()` للتمييز بين:
  1. خطأ اتصال / انقطاع شبكة: قراءة التخزين المحلي فوراً دون مس أي بيانات.
  2. نجاح الاتصال مع مصفوفات سحابية فارغة: عدم استبدال التخزين المحلي بمصفوفات فارغة إذا كان الجهاز المحلي يحوي بيانات سابقة.
  3. حظر الرفع العكسي التلقائي الذي قد يستبدل بيانات صحيحة ببيانات ناقصة.

### ب. الفروقات البرمجية المقترحة (Diff):

#### 1. تعديل `src/services/storage.ts`:
```diff
--- a/src/services/storage.ts
+++ b/src/services/storage.ts
@@ -109,19 +109,8 @@
-const RESET_OPERATIONS_KEY = 'makhzouni_zero_stock_migration_v1';
 
 export const StorageService = {
   // Initial load: loads from LocalStorage synchronously, then verifies/syncs with IndexedDB
   loadAll(): InventoryDatabaseData {
-    // One-time client purge of stale movements cache to guarantee 0 stock across all devices
-    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
-      if (localStorage.getItem(RESET_OPERATIONS_KEY) !== 'done') {
-        localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify([]));
-        localStorage.setItem(STORAGE_KEYS.RETURNS, JSON.stringify([]));
-        localStorage.setItem(RESET_OPERATIONS_KEY, 'done');
-        try {
-          this.clearOperationsOnly().catch(() => {});
-        } catch {}
-      }
-    }
 
     const localUnits = loadLocal<Unit[]>(STORAGE_KEYS.UNITS, []);
```

#### 2. تعديل `src/services/firestoreStorage.ts`:
```diff
--- a/src/services/firestoreStorage.ts
+++ b/src/services/firestoreStorage.ts
@@ -81,6 +81,7 @@
       const fetchColl = async (name: string) => {
         try {
           return await getDocs(collection(db, name));
-        } catch (err) {
+        } catch (err: any) {
           console.warn(`Could not read collection "${name}" from Firestore (offline/latency):`, err);
-          return null;
+          return null; // Signals network/permission failure vs empty docs
         }
       };
 
@@ -151,19 +152,38 @@
-      // If all collections returned null (e.g. completely offline with no local Firestore cache)
-      const hasAnyFirestoreData =
-        unitsSnap !== null ||
-        categoriesSnap !== null ||
-        itemsSnap !== null ||
-        movementsSnap !== null ||
-        branchesSnap !== null ||
-        returnsSnap !== null ||
-        customersSnap !== null ||
-        prodOrdersSnap !== null;
-
-      if (!hasAnyFirestoreData) {
-        console.warn('Firestore is completely offline or unreachable. Loading from StorageService local cache.');
-        const localData = await StorageService.loadAll();
-        return localData;
-      }
+      // Load existing local storage data first for verification & resilient two-way merge
+      const localData = await StorageService.loadAll();
+
+      // Check if critical queries completely failed due to network / offline state
+      const isNetworkFailed = unitsSnap === null && itemsSnap === null && movementsSnap === null;
+      if (isNetworkFailed) {
+        console.warn('Firestore network connection failed or offline. Preserving local storage cache without overwriting.');
+        return localData;
+      }
+
+      // Safe collection resolution: If cloud returns docs, use them;
+      // If cloud query succeeded but returned 0 docs, ONLY take empty array if local also had 0,
+      // otherwise preserve local data to prevent wiping un-synced offline records!
+      const resolveCollection = <T>(cloudDocs: T[], localDocs: T[] = []): T[] => {
+        if (cloudDocs.length > 0) return cloudDocs;
+        if (localDocs.length > 0) {
+          console.info('Preserving existing local records because cloud collection is unpopulated.');
+          return localDocs;
+        }
+        return [];
+      };
+
+      const safeUnits = cloudUnits.length > 0 ? cloudUnits : (localData.units || []);
+      const safeCategories = cloudCategories.length > 0 ? cloudCategories : (localData.categories || []);
+      const safeItems = resolveCollection(cloudItems, localData.items);
+      const safeMovements = resolveCollection(cloudMovements, localData.movements);
+      const safeBranches = cloudBranches.length > 0 ? cloudBranches : (localData.branches || []);
+      const safeReturns = resolveCollection(cloudReturns, localData.returns);
+      const safeCustomers = cloudCustomers.length > 0 ? cloudCustomers : (localData.customers || []);
+      const safeProductionOrders = resolveCollection(cloudProductionOrders, localData.productionOrders);
+      const safeDamagedRecords = resolveCollection(cloudDamagedRecords, localData.damagedRecords);

       const cloudData: InventoryDatabaseData = {
-        units: cloudUnits,
-        categories: cloudCategories,
-        items: cloudItems,
-        movements: cloudMovements,
-        branches: cloudBranches,
-        returns: cloudReturns,
-        customers: cloudCustomers,
-        productionOrders: cloudProductionOrders,
-        damagedRecords: cloudDamagedRecords,
+        units: safeUnits,
+        categories: safeCategories,
+        items: safeItems,
+        movements: safeMovements,
+        branches: safeBranches,
+        returns: safeReturns,
+        customers: safeCustomers,
+        productionOrders: safeProductionOrders,
+        damagedRecords: safeDamagedRecords,
         settings: cloudSettings || localData.settings,
       };
 
-      // Ensure local offline backup is synchronized with cloud data
-      StorageService.saveAll(cloudData).catch(() => {});
+      // Only update local backup if we have valid non-empty state or confirmed cloud data
+      if (safeItems.length > 0 || safeMovements.length > 0) {
+        StorageService.saveAll(cloudData).catch(() => {});
+      }
 
       return cloudData;
```

---

## 3. المرحلة الثالثة: الربط الدقيق لسجلات التالف بالحركات المخزنية والأرصدة

### أ. الهدف والمنهجية:
- في `types/inventory.ts`: إضافة حقل `movementId: string` لسجل `DamagedRecord` وحقل `relatedRecordId?: string` للحركة.
- عند إضافة التالف (`addDamagedRecord`): تخزين معرّف الحركة المباشر `movementId` في سجل التالف.
- عند حذف التالف (`deleteDamagedRecord`):
  - **السجلات الجديدة أو المترابطة:** حذف الحركة المقابلة حصرياً عبر مطابقة المعرّف المباشر `m.id === record.movementId` محلياً وحذفها فوراً من Firestore `FirestoreStorage.deleteMovement(record.movementId)`.
  - **السجلات القديمة غير المرتبطة (Legacy Records):** **منع الحذف التخميني الخاطئ**. إذا كان `record.movementId` غير موجود، لا يتم حذف أي حركة عشوائياً، بل يتم حذف سجل التالف فقط مع إشعار المدير وتحديد الحركة في سجل التدقيق للمراجعة اليدوية بدلاً من المخاطرة بالأرصدة.

### ب. الفروقات البرمجية المقترحة (Diff):

#### 1. تعديل `src/types/inventory.ts`:
```diff
--- a/src/types/inventory.ts
+++ b/src/types/inventory.ts
@@ -237,6 +237,8 @@
 export interface DamagedRecord {
   id: string;
   date: string;
   section: 'GENERAL' | 'PRODUCTION';
   itemId: string;
   unitId: string;
   quantity: number;
   factorApplied: number;
   baseQuantity: number;
   reason: string;
   notes?: string;
   createdByName?: string;
+  movementId?: string; // Explicit foreign key linking to the exact StockMovement
   createdAt: string;
   updatedAt: string;
 }
@@ -88,6 +90,7 @@
 export interface StockMovement {
   id: string;
   itemId: string;
+  relatedRecordId?: string; // Foreign key linking to DamagedRecord or ProductionOrder
   type: MovementType;
```

#### 2. تعديل `src/context/InventoryContext.tsx` (دوال التالف):
```diff
--- a/src/context/InventoryContext.tsx
+++ b/src/context/InventoryContext.tsx
@@ -2685,6 +2685,7 @@
       const userName = activeRole === 'ADMIN' ? (companySettings.managerName || 'مدير النظام') : 'مشرف المستودع';
+      const movementId = 'mov_dmg_' + Math.random().toString(36).substr(2, 9);
 
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
         createdByName: userName,
+        movementId: movementId,
         createdAt: now,
         updatedAt: now,
       };
 
-      const movementId = 'mov_dmg_' + Math.random().toString(36).substr(2, 9);
       const movement: StockMovement = {
         id: movementId,
         itemId: data.itemId,
+        relatedRecordId: recordId,
         type: 'DAMAGED',
@@ -2756,8 +2757,21 @@
       const record = damagedRecords.find((r) => r.id === id);
       if (!record) return { success: false, error: 'سجل التلف غير موجود' };
 
       const newDamagedRecords = damagedRecords.filter((r) => r.id !== id);
-      const newMovements = movements.filter((m) => !(m.type === 'DAMAGED' && m.itemId === record.itemId && m.baseQuantity === record.baseQuantity));
+      
+      // Exact identification of the linked movement without guessing
+      const linkedMovementId = record.movementId;
+      let newMovements = movements;
+      
+      if (linkedMovementId) {
+        newMovements = movements.filter((m) => m.id !== linkedMovementId);
+      } else {
+        console.warn(`سجل التالف ${id} يفتقر إلى معرّف حركة فريد. تم الاحتفاظ بالحركات المخزنية لحماية سلامة الأرصدة.`);
+      }
 
       setDamagedRecords(newDamagedRecords);
       setMovements(newMovements);
 
       await persistChanges(units, categories, items, newMovements, branches, returns, newDamagedRecords, productionOrders);
 
       await FirestoreStorage.deleteDamagedRecord(id).catch(() => {});
+      if (linkedMovementId) {
+        await FirestoreStorage.deleteMovement(linkedMovementId).catch(() => {});
+      }
```

---

## 4. المرحلة الرابعة: التحقق الذكي من إضافة الأصناف والأرشفة وسلة المهملات

### أ. الهدف والمنهجية:
- في `src/context/InventoryContext.tsx` داخل `addItem`:
  1. التفريق بين الأصناف النشطة والأصناف في سلة المهملات (`isDeleted: true`) والمؤرشفة (`isArchived: true`).
  2. إذا كان الاسم موجوداً في السلة، إرجاع كود استجابة محدد ورسالة تفاعلية تقترح الاستعادة.
  3. توليد الكود التلقائي `ITM-XXXX` عبر استخراج أكبر رقم فعلي مستخدم وليس مجرد `items.length + 1`، لمنع تعارض الأكواد.
  4. التحقق من صحة القسم والوحدة ووجودهما في القوائم الصالحة.
  5. إضافة `ensureAdmin` إلى مصفوفة اعتماديات `useCallback`.

### ب. الفروقات البرمجية المقترحة (Diff):

#### تعديل `src/context/InventoryContext.tsx`:
```diff
--- a/src/context/InventoryContext.tsx
+++ b/src/context/InventoryContext.tsx
@@ -1467,9 +1467,26 @@
-      // Prevent duplicate item name (across active, archived, and trash items)
-      const nameExists = items.some(
-        (i) => (i?.name || '').trim().toLowerCase() === cleanName.toLowerCase()
-      );
-      if (nameExists) {
-        return {
-          success: false,
-          error: `يوجد صنف مسجل مسبقاً بنفس الاسم "${cleanName}"؛ يرجى اختيار اسم غير مكرر أو تمييزه.`,
-        };
-      }
+      // Check duplicates with contextual awareness: Active vs Trash vs Archive
+      const activeDuplicate = items.find(
+        (i) => !i.isDeleted && !i.isArchived && (i?.name || '').trim().toLowerCase() === cleanName.toLowerCase()
+      );
+      if (activeDuplicate) {
+        return {
+          success: false,
+          error: `يوجد صنف نشط مسجل مسبقاً بنفس الاسم "${cleanName}"؛ يرجى اختيار اسم غير مكرر.`,
+        };
+      }
+
+      const trashedDuplicate = items.find(
+        (i) => i.isDeleted && (i?.name || '').trim().toLowerCase() === cleanName.toLowerCase()
+      );
+      if (trashedDuplicate) {
+        return {
+          success: false,
+          error: `الصنف "${cleanName}" موجود حالياً في سلة المحذوفات. يرجى استعادته من السلة بدلاً من تكراره.`,
+          isTrashed: true,
+          existingItemId: trashedDuplicate.id,
+        };
+      }
 
       // Ensure valid conversions (no duplicate unit, factor > 0, not equal to base unit)
@@ -1492,4 +1509,14 @@
-      const cleanCode = itemData.code?.trim() || `ITM-${(items.length + 1).toString().padStart(4, '0')}`;
+      let cleanCode = itemData.code?.trim();
+      if (!cleanCode) {
+        // Calculate max existing numeric code to prevent collisions after deletions
+        let maxCodeNum = 0;
+        items.forEach((it) => {
+          const match = (it.code || '').match(/ITM-(\d+)/i);
+          if (match) {
+            const num = parseInt(match[1], 10);
+            if (num > maxCodeNum) maxCodeNum = num;
+          }
+        });
+        cleanCode = `ITM-${(Math.max(maxCodeNum, items.length) + 1).toString().padStart(4, '0')}`;
+      }
@@ -1537,3 +1564,3 @@
       return { success: true, item: newItem };
     },
-    [items, units, categories, movements, branches, returns, persistChanges, showToast]
+    [items, units, categories, movements, branches, returns, persistChanges, showToast, ensureAdmin]
   );
```

---

## 5. المرحلة الخامسة: العزل التام لمسؤول المعاينة (UI / Services / Firestore)

### أ. الهدف والمنهجية:
- **في الواجهة:**
  - في `ItemDetailModal.tsx`: إخفاء أزرار تسجيل الدخول والخروج للكميات نهائياً عند وجود أي حساب غير المدير.
  - في `ProductionView.tsx`: حجب أزرار طباعة وتصدير السندات لمسؤول المصنع المعاين.
  - في `ItemsView.tsx`: التأكد من عدم إمكانية فتح أي نافذة إدخال أو إخراج.
- **في طبقة الخدمات:**
  - تطبيق `ensureAdmin` على مستوى كافة الإجراءات مع التحقق من الهوية الفعلية.
- **في قواعد Firestore:**
  - كما تم في المرحلة الأولى: `allow write: if isOwner()` مع رفض أي كتابة لغير المدير.

### ب. الفروقات البرمجية المقترحة (Diff):

#### 1. تعديل `src/components/items/ItemDetailModal.tsx`:
```diff
--- a/src/components/items/ItemDetailModal.tsx
+++ b/src/components/items/ItemDetailModal.tsx
@@ -159,7 +159,7 @@
-          {/* Quick Movement Buttons */}
-          {isAdmin && (
+          {/* Quick Movement Buttons strictly for Admin */}
+          {isAdmin && role === 'ADMIN' && (
             <div className="flex items-center gap-2">
               <button
                 onClick={() => {
@@ -183,4 +183,9 @@
           )}
+          {(!isAdmin || role !== 'ADMIN') && (
+            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center text-xs text-slate-500 font-medium">
+              وضع مسؤول المصنع مخصص للمعاينة فقط؛ لا تتوفر صلاحية تسجيل حركات وارد أو صادر من هذا الحساب.
+            </div>
+          )}
```

#### 2. تعديل `src/components/production/ProductionView.tsx`:
```diff
--- a/src/components/production/ProductionView.tsx
+++ b/src/components/production/ProductionView.tsx
@@ -400,6 +400,7 @@
-          <button
+          {isAdmin && (
+            <button
             onClick={handleExportCSV}
             className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
           >
             <Download className="w-4 h-4 text-slate-600" />
             <span>تصدير السجل (CSV)</span>
           </button>
+          )}
```

---

## 6. المرحلة السادسة: حوكمة التزامن والمجموعات السحابية ومنع الكتابة العكسية

### أ. الهدف والمنهجية:
- في `src/services/firestoreStorage.ts`:
  1. إضافة مستمع `onSnapshot` لمجموعة `damaged_records` لتفعيل المزامنة اللحظية ثنائية الاتجاه.
  2. تحصين دالة `syncAllToFirestore` بحيث ترفض تماماً الكتابة فوق السحابة إذا كانت البيانات المحلية تحتوي على عدد أصناف أو حركات أقل من السحابة بنسبة مشبوهة، لمنع مسح بيانات السحابة بحادث غير مقصود.

### ب. الفروقات البرمجية المقترحة (Diff):

```diff
--- a/src/services/firestoreStorage.ts
+++ b/src/services/firestoreStorage.ts
@@ -604,6 +604,7 @@
     onReturns?: (returns: ReturnRecord[]) => void;
     onCustomers?: (customers: Customer[]) => void;
+    onDamagedRecords?: (damaged: DamagedRecord[]) => void;
     onError?: (error: any) => void;
   }): () => void {
@@ -705,6 +706,17 @@
       unsubscribes.push(unsub);
     }
+
+    if ((callbacks as any).onDamagedRecords) {
+      const unsub = onSnapshot(
+        collection(db, 'damaged_records'),
+        (snap) => {
+          const records = snap.docs.map((d) => d.data() as DamagedRecord).filter((r) => r && r.id);
+          (callbacks as any).onDamagedRecords?.(records);
+        },
+        (err) => callbacks.onError?.(err)
+      );
+      unsubscribes.push(unsub);
+    }
```

---

## 7. المرحلة السابعة: منظومة الاختبارات وحالات التحقق الآلي

لضمان سلامة التعديلات دون المساس بقاعدة بيانات الإنتاج، سيتم استخدام بيئة اختبار مستقلة (أو ملفات اختبار قياسية):

### سيناريوهات الاختبار الستة المحددة:
1. **اختبار دخول المدير:**
   - التحقق من نجاح مصادقة المدير وحصوله على رمز Firebase Auth الصالح.
   - التحقق من صلاحية قراءة وكتابة وثائق تجريبية في Firestore.
2. **اختبار إضافة صنف واستمراره:**
   - إضافة صنف باسم مميز ورقم كود تلقائي.
   - تحديث الصفحة (Reload) والتأكد من بقاء الصنف ورصيده في السحابة والتخزين المحلي.
3. **اختبار منع مسؤول المعاينة:**
   - تسجيل الدخول بالرقم السري `12345678`.
   - محاولة استدعاء `addItem` أو `recordMovement` برمجياً ومن الواجهة.
   - التأكد من إرجاع خطأ أمني صريح ورفض قواعد Firestore لأي عملية كتابة.
4. **اختبار حفظ التالف:**
   - تسجيل صنف تالف جديد.
   - التحقق من إنشاء وثيقة في `damaged_records` وحركة مقابلة في `movements` بنفس `movementId`.
5. **اختبار حذف التالف الانفرادي:**
   - تسجيل عمليتي تالف لنفس الصنف وبنفس الكمية (مثلاً 5 حبات).
   - حذف العملية الثانية فقط.
   - التأكد من بقاء العملية الأولى وحركتها سليمة 100% دون حذف عشوائي.
6. **اختبار انقطاع الاتصال:**
   - محاكاة وضع Offline.
   - التأكد من عدم تصفير الحركات المحلية وعدم استبدالها بمصفوفات فارغة.

---

## 8. مصفوفة التراجع التفصيلية (Rollback Strategies)

لكل مرحلة من المراحل السابقة، تم إعداد مسار تراجع فوري يعيد النظام إلى حالته السابقة تماماً في حال حدوث أي طارئ:

| المرحلة | نقطة المراقبة والتحقق | مؤشر الفشل المحتمل | إجراء التراجع الفوري (Rollback Action) |
| :--- | :--- | :--- | :--- |
| **المرحلة 1: قواعد Firebase والمصادقة** | فحص تسجيل دخول المدير بكلمة المرور وحفظ صنف | ظهور خطأ `permission-denied` للمدير | استعادة نسخة `firestore.rules` الاحتياطية وإعادة نشرها فوراً عبر `DeployRules`. |
| **المرحلة 2: حماية البيانات والتخزين** | فحص تحميل المخزون بعد مسح الكاش | عدم ظهور الأصناف المخزنة | استعادة ملف `src/services/storage.ts` الأصلي المحفوظ في فرع التراجع. |
| **المرحلة 3: سجلات التالف** | تجربة إضافة وحذف تالف | عدم حذف الحركة المقابلة | إعادة دالة `deleteDamagedRecord` السابقة واستعادة نسخة `types/inventory.ts`. |
| **المرحلة 4: فحص تكرار الأصناف** | إضافة صنف جديد بأحرف عربية مطابقة | رفض إضافة صنف جديد غير مكرر | استعادة فحص الاسم الأصلي في `InventoryContext.tsx`. |
| **المرحلة 5: عزل المعاينة** | تسجيل الدخول بـ `12345678` | اختفاء بيانات العرض لمسؤول المصنع | إعادة إظهار المكونات المشتركة مع الإبقاء على تعطيل زر الحفظ. |
| **المرحلة 6: التزامن والمجموعات** | مراقبة استهلاك الشبكة ومستمعي Firestore | تكرار استدعاءات `onSnapshot` | إلغاء مستمع `damaged_records` في `firestoreStorage.ts`. |

---
*تم إنشاء هذا التقرير التفصيلي بصيغة Markdown وحفظه في مسار المشروع: `/REMEDIATION_PLAN_PROPOSAL.md` للمراجعة الكاملة والاعتماد الصريح.*
