import React, { useState } from 'react';
import { FolderTree, Plus, Edit, Trash2, Boxes, X } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { Category } from '../../types/inventory';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const CategoriesView: React.FC = () => {
  const { categories, items, addCategory, updateCategory, deleteCategory } = useInventory();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setDescription(category.description || '');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('يرجى إدخال اسم القسم');
      return;
    }

    if (editingCategory) {
      const res = updateCategory(editingCategory.id, name.trim(), description.trim());
      if (!res.success) {
        setErrorMsg(res.error || 'حدث خطأ أثناء التعديل');
        return;
      }
    } else {
      const res = addCategory(name.trim(), description.trim());
      if (!res.success) {
        setErrorMsg(res.error || 'حدث خطأ أثناء الإضافة');
        return;
      }
    }

    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteCategory(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">أقسام وتصنيفات المخزون</h3>
          <p className="text-xs text-slate-500 mt-1">
            تنظيم وتوزيع الأصناف في تصنيفات واضحة لتسهيل الجرد وتصفية الحركات
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة قسم جديد</span>
        </button>
      </div>

      {/* Categories Grid */}
      {categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-4">
            <FolderTree className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">لا توجد أقسام مسجلة</h3>
          <p className="text-xs text-slate-500 mb-6">
            أنشئ أول قسم لتنظيم أصناف مستودعك (مثل: المواد الغذائية، الأدوات الكهربائية، قطع الغيار...).
          </p>
          <button
            onClick={handleOpenAdd}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء أول قسم</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const count = items.filter((i) => !i.isDeleted && i.categoryId === cat.id).length;
            return (
              <div
                key={cat.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: cat.color || '#3b82f6' }}
                      >
                        <FolderTree className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">{cat.name}</h4>
                        <span className="text-xs text-slate-400 font-mono">
                          {new Date(cat.createdAt).toLocaleDateString('ar-SA')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(cat)}
                        className="p-1.5 hover:text-slate-800 text-slate-400 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        title="تعديل"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(cat)}
                        className="p-1.5 hover:text-rose-600 text-slate-400 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {cat.description && (
                    <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                      {cat.description}
                    </p>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                    <Boxes className="w-4 h-4 text-slate-400" />
                    الأصناف التابعة:
                  </span>
                  <span className="font-bold font-mono text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {count} صنف
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 text-right">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingCategory ? 'تعديل بيانات القسم' : 'إضافة قسم جديد'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  اسم القسم <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: مشروبات وعصائر / قطع غيار..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  وصف القسم (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف مختصر للأصناف التي تنتمي لهذا القسم..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  {editingCategory ? 'حفظ التعديل' : 'إضافة القسم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="حذف القسم"
        message={`هل أنت متأكد من رغبتك في حذف القسم "${deleteTarget?.name}"؟`}
        confirmLabel="حذف القسم"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
