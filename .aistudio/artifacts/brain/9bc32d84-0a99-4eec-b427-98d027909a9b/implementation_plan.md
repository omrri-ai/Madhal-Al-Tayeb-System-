# Implementation Plan: Unified Stock Voucher Management

The goal is to transition from individual movement records to a "Voucher" entity model, grouping related movements (same reference/ID).

## 1. Data Structure Changes
- Maintain existing `StockMovement` as the base record.
- Use `referenceNumber` as the primary key for grouping.
- Add fields for `lastModifiedAt` and `isModified` flag.
- Maintain `auditLogs` for historical tracking of "before" and "after" values.

## 2. UI/UX Changes (Movements/Dashboard)
- **Grouping**: Implement a `useMemo` in `MovementsView` to group movements by `referenceNumber` (or `batchId`).
- **Accordion View**:
  - Main row: Summary of the voucher (Type, Date, Reference, Total Items/Qty, Notes, "Modified" badge if applicable).
  - Expanded row: List of individual items in the voucher, including detailed audit log summaries.
  - **Mobile**: Table transforms into responsive cards on smaller screens.
- **Actions**: Provide `Print` (entire voucher), `Edit` (multi-item), `Delete` (entire voucher), and `Copy` buttons.

## 3. Implementation Steps
1. **MovementsView.tsx**:
   - Refactor `filteredMovements` to group by `referenceNumber`.
   - Update table rendering for accordion functionality and mobile responsiveness.
   - Implement "Edit Voucher" and "Delete Voucher" actions.
   - Ensure search functionality returns the entire voucher if any item inside matches.
2. **StockMovementModal.tsx / MultiItemVoucherModal**:
   - Refactor edit functionality for multi-item vouchers.
   - Ensure atomic updates for voucher integrity and stock validations.
3. **MovementVoucherModal.tsx**:
   - Redesign A4 print template: Logo, company name, reference number, date, type, destination/branch, detailed items table, totals, notes, and signatures.
4. **Export (CSV/PDF)**:
   - CSV: Include `Voucher Number` column, and add an option to export a single voucher.
5. **Safety & Audit**:
   - Implement robust stock validations to prevent negative stock upon editing/deletion.
   - Log changes (before/after values) to the audit log for each voucher modification.

## 4. Migration Strategy
- Treat existing individual records (without reference numbers) as single-item vouchers.
- Retain existing structure for backward compatibility.
