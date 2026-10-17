/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Search, Check, AlertCircle, PackageSearch, Package } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { Item, MovementType } from '../../types/inventory';

interface ItemPickerBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItemId: string;
  onSelectItem: (itemId: string) => void;
  movementType?: MovementType;
  items?: Item[];
  allowZeroStockSelection?: boolean;
}

export const ItemPickerBottomSheet: React.FC<ItemPickerBottomSheetProps> = ({
  isOpen,
  onClose,
  selectedItemId,
  onSelectItem,
  movementType = 'IN',
  items: customItems,
  allowZeroStockSelection = true,
}) => {
  const { items: allItems, units, getItemStock } = useInventory();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');

  // Always use all active items from inventory context as base items
  const baseItems = useMemo(() => {
    return allItems.filter((i) => !i.isDeleted && !i.isArchived);
  }, [allItems]);

  // Focus search input when sheet opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter and sort items:
  // If OUT, available items first, zero stock items at the end
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = baseItems;

    if (q) {
      result = result.filter((item) => {
        const matchName = item.name.toLowerCase().includes(q);
        const matchCode = item.code.toLowerCase().includes(q);
        const matchNotes = (item.notes || '').toLowerCase().includes(q);
        return matchName || matchCode || matchNotes;
      });
    }

    // If OUT, exclude items already selected in OTHER rows to prevent picking duplicates
    if (movementType === 'OUT') {
      const selectedIds = new Set(
        (customItems || [])
          .filter((r: any) => !selectedItemId || r.itemId !== selectedItemId)
          .map((r: any) => r.itemId)
          .filter(Boolean)
      );
      result = result.filter((item) => !selectedIds.has(item.id));

      // Sort in-stock items first, zero-stock items last
      return [...result].sort((a, b) => {
        const stockA = getItemStock(a.id);
        const stockB = getItemStock(b.id);
        if (stockA > 0 && stockB <= 0) return -1;
        if (stockA <= 0 && stockB > 0) return 1;
        return 0;
      });
    }

    return result;
  }, [baseItems, searchQuery, movementType, getItemStock, customItems]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden flex flex-col justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Bottom Sheet Container */}
      <div
        className="relative w-full sm:max-w-xl sm:mx-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden z-10 animate-in slide-in-from-bottom duration-250 border border-slate-100"
        dir="rtl"
      >
        {/* Drag Handle Bar (Top indicator) */}
        <div className="pt-3 pb-1 cursor-grab flex justify-center">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">اختيار الصنف</h3>
              <p className="text-xs text-slate-500">
                {movementType === 'OUT'
                  ? 'اختر الصنف المراد صرفه (الأصناف برصيد 0 معطّلة)'
                  : 'اختر الصنف المراد تسجيل حركة له'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الصنف أو الكود (مثال: بخور، ITM-0001)..."
              className="w-full pr-10 pl-9 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all shadow-2xs"
              dir="rtl"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                aria-label="مسح البحث"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {movementType === 'OUT' && (
            <div className="text-[11px] text-amber-800 bg-amber-50/90 px-3 py-1.5 rounded-xl border border-amber-200/60 flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span>الأصناف ذات الرصيد صفر معطّلة تلقائياً لمنع الرصيد السالب.</span>
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-2 divide-y-0">
          {filteredItems.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <PackageSearch className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-800">لا توجد أصناف مطابقة للبحث</p>
              <p className="text-xs text-slate-500 mt-1">
                تأكد من كتابة الاسم أو الكود بشكل صحيح
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const stock = getItemStock(item.id);
              const bUnit = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';
              const isSelected = item.id === selectedItemId;
              const isOutOfStock = stock <= 0;
              const isDisabled = !allowZeroStockSelection && movementType === 'OUT' && isOutOfStock;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    onSelectItem(item.id);
                    onClose();
                  }}
                  className={`w-full text-right p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 text-right ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/20 shadow-xs'
                      : isDisabled
                      ? 'bg-slate-50/80 border-slate-200/60 opacity-50 cursor-not-allowed'
                      : 'bg-white hover:bg-slate-50/90 border-slate-200 hover:border-slate-300 shadow-2xs cursor-pointer active:scale-[0.99]'
                  }`}
                >
                  {/* Item Info (Name + Code) */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold truncate block ${
                          isSelected
                            ? 'text-emerald-950 font-extrabold'
                            : isDisabled
                            ? 'text-slate-500'
                            : 'text-slate-900'
                        }`}
                      >
                        {item.name}
                      </span>
                      {isSelected && (
                        <span className="p-0.5 bg-emerald-600 text-white rounded-full shrink-0">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span
                        dir="ltr"
                        className={`text-xs font-mono inline-block font-medium ${
                          isSelected ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {item.code}
                      </span>
                      {isDisabled && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-[11px] text-rose-600 font-semibold">
                            غير متوفر للصرف
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Stock Badge */}
                  <div className="shrink-0 flex items-center gap-2">
                    <div
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1 ${
                        stock > 0
                          ? isSelected
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {stock > 0 ? (
                        <>
                          <span>{stock}</span>
                          <span className="text-[10px] font-normal text-emerald-800/80">{bUnit}</span>
                        </>
                      ) : (
                        <span>رصيد 0</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-500">
          <span>إجمالي الأصناف: {filteredItems.length} صنف</span>
        </div>
      </div>
    </div>
  );
};
