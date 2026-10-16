# Damaged Items (التالف) Feature Implementation Plan

This plan outlines the architecture, UX design, and data strategy for adding the **Damaged Items (التالف)** management feature to **مدهال الطيب**, supporting both General Inventory (المخزون العام) and Production & Manufacturing (الإنتاج والتصنيع).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Section Selection**: Users choose between General Inventory and Production & Manufacturing when recording damaged items.
> - **Stock Deduction**: Automatically deducts the damaged quantity from the item's stock in the specified section without double-counting in regular outgoing or production dispatches.
> - **Permissions**: Fully integrates existing permissions (Manager can record/manage; Viewer/Auditor can view only without recording, editing, deleting, printing, or exporting).

---

## 1. Overview & Core Concept

- **What It Does**: Provides a dedicated workflow and log for recording damaged, spoiled, broken, or expired items across General Inventory and Production & Manufacturing, complete with stock validation, dedicated search/filters, and analytics reports.
- **Target Audience / Persona**: Warehouse managers and inventory supervisors tracking waste and damages, and auditors reviewing damaged item analytics.
- **Key Value**: Accurate inventory balancing, waste traceability, and analytical visibility into damaged stock without compromising production records or regular dispatch logs.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. Navigation: Access the new "التالف" (Damaged) tab from the main sidebar or reports.
  2. Recording Damage Modal ("تسجيل صنف تالف"):
     - Step 1: Select Section (المخزون العام vs. الإنتاج والتصنيع).
     - Step 2: Select Item (filtered by section compatibility).
     - Step 3: Enter Quantity (validated against available stock in that section).
     - Step 4: Select Reason (e.g., تلف تخزين, انتهاء صلاحية, كسر عرضي, عيب مصنعي, أخرى) and optional notes.
     - Step 5: Save -> Updates stock and creates an independent damaged record.
  3. Damaged Log & Filters: Searchable table with filters by date, section, item, and reason.
  4. Reports & Analytics: Charts and breakdown tables showing total damaged quantities grouped by period, section, and item.
- **Visual Identity & Theme**:
  - Consistent with the app's clean Tailwind UI (slate/indigo/amber/rose palettes for warnings/damages).
  - Clear amber/rose status badges for damaged records.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Storage and Stock Integration**
  - *Chosen Approach*: Maintain a dedicated `damagedRecords` collection in context/storage, and record corresponding inventory deduction movements (or subtract in `getItemStock`) so stock reflects the damage once without duplicating regular dispatches.
  - *Why*: Ensures strict separation from regular sales/dispatches while maintaining accurate real-time inventory balances.
- **Decision 2: Permission Enforcement**
  - *Chosen Approach*: Enforce `isAdmin` / `canEdit` checks so viewers/auditors can only inspect the damaged log and reports without modifying or recording.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   InventoryContext                     │
│  - damagedRecords state & Firestore persistence        │
│  - addDamagedRecord / deleteDamagedRecord              │
│  - getItemStock integration                            │
└───────────────┬───────────────────────┬────────────────┘
                │                       │
                ▼                       ▼
┌───────────────────────────┐   ┌──────────────────────────┐
│  DamagedManagementView    │   │      ReportsView         │
│  - Log & Table            │   │  - Damaged Analytics     │
│  - Filters & Search       │   │  - Period & Section breakdown│
│  - Add Damaged Modal      │   │                          │
└───────────────────────────┘   └──────────────────────────┘
```

- **Data Model (`DamagedRecord`)**:
  - `id`: string
  - `date`: string (ISO)
  - `section`: `'GENERAL' | 'PRODUCTION'`
  - `itemId`: string
  - `unitId`: string
  - `quantity`: number
  - `baseQuantity`: number
  - `reason`: string
  - `notes`?: string
  - `createdById`?: string
  - `createdByName`?: string
