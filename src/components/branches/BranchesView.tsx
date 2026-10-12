import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  MapPin,
  Phone,
  FileText,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { Branch } from '../../types/inventory';

export const BranchesView: React.FC = () => {
  const { branches, addBranch, deleteBranch, updateBranch, showToast } = useInventory();
  
  // New branch form state
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      showToast('يرجى كتابة اسم الفرع', 'error');
      return;
    }

    const res = addBranch(cleanName, city.trim(), phone.trim(), notes.trim());
    if (res.success) {
      setName('');
      setCity('');
      setPhone('');
      setNotes('');
    }
  };

  const startEdit = (b: Branch) => {
    setEditingId(b.id);
    setEditName(b.name);
    setEditCity(b.city || '');
    setEditPhone(b.phone || '');
    setEditNotes(b.notes || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = (id: string) => {
    const cleanName = editName.trim();
    if (!cleanName) {
      showToast('اسم الفرع مطلوب', 'error');
      return;
    }

    const res = updateBranch(id, cleanName, editCity.trim(), editPhone.trim(), editNotes.trim());
    if (res.success) {
      setEditingId(null);
      showToast(`تم تحديث بيانات الفرع "${cleanName}" بنجاح`, 'success');
    }
  };

  const handleDelete = (id: string, branchName: string) => {
    if (confirm(`هل أنت متأكد من حذف الفرع "${branchName}"؟`)) {
      const res = deleteBranch(id);
      if (res.success) {
        showToast(`تم حذف الفرع "${branchName}" بنجاح`, 'success');
      }
    }
  };

  const filteredBranches = branches.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      (b.city && b.city.toLowerCase().includes(q)) ||
      (b.phone && b.phone.includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white">إدارة الفروع والمستودعات</h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                إضافة وتحديث وحذف الفروع المعتمدة لاستلام شحنات الصادر والتوزيع
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-xl bg-white/10 text-emerald-300 text-xs font-bold border border-white/10">
              إجمالي الفروع: {branches.length}
            </span>
          </div>
        </div>
      </div>

      {/* Add New Branch Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-600" />
          <span>إضافة فرع جديد</span>
        </h2>

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم الفرع <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="مثال: فرع الرياض الرئيسي"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المدينة / المنطقة</label>
              <input
                type="text"
                placeholder="مثال: الرياض"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف / الجوال</label>
              <input
                type="text"
                placeholder="05XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
              <input
                type="text"
                placeholder="موقع الفرع أو المشرف..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>حفظ الفرع في النظام</span>
            </button>
          </div>
        </form>
      </div>

      {/* Branches List Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Card Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-600" />
            <h3 className="font-bold text-slate-900 text-sm">قائمة الفروع المعتمدة ({branches.length})</h3>
          </div>

          {branches.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="بحث باسم الفرع أو المدينة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white font-medium"
              />
            </div>
          )}
        </div>

        {branches.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 shadow-2xs">
              <Building2 className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">لا توجد أي فروع مضافة حالياً</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              تم تصفير الفروع التجريبية. يمكنك الآن إضافة فروعك ومستودعاتك المعتمدة أعلاه لبدء إصدار أذونات الصادر والشحنات إليها مباشرة.
            </p>
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            لا توجد أي فروع مطابقة لبحثك "{searchQuery}".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">اسم الفرع</th>
                  <th className="py-3 px-4">المدينة / المنطقة</th>
                  <th className="py-3 px-4">رقم التواصل</th>
                  <th className="py-3 px-4">ملاحظات</th>
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBranches.map((b, idx) => {
                  const isEditing = editingId === b.id;

                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isEditing ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>

                      <td className="py-3 px-4 font-bold text-slate-900">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-emerald-400 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span>{b.name}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editCity}
                            onChange={(e) => setEditCity(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-emerald-400 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                          />
                        ) : b.city ? (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{b.city}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-emerald-400 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                          />
                        ) : b.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{b.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-emerald-400 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                          />
                        ) : (
                          b.notes || '-'
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => saveEdit(b.id)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                                title="حفظ التعديل"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>حفظ</span>
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                                title="إلغاء التعديل"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(b)}
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="تعديل بيانات الفرع"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(b.id, b.name)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="حذف الفرع"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
