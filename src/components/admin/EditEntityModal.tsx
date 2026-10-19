import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Edit3, Trash2, AlertTriangle, CheckCircle2, ShieldCheck, KeyRound, Building2, ChevronDown, CheckSquare, Square, BookOpen, Search } from 'lucide-react';
import { ClassItem, TeacherItem } from '../../data/mockData';

export type EntityType = 'class' | 'teacher' | 'student';

interface EditEntityModalProps {
  isOpen: boolean;
  type: EntityType;
  entity: any | null;
  classes?: ClassItem[];
  teachers?: TeacherItem[];
  onClose: () => void;
  onSave: (updatedEntity: any) => void;
  onDelete?: (id: string) => void;
}

export const EditEntityModal: React.FC<EditEntityModalProps> = ({
  isOpen,
  type,
  entity,
  classes = [],
  teachers = [],
  onClose,
  onSave,
  onDelete,
}) => {
  const [formData, setFormData] = useState<any>({});
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [classSearchTerm, setClassSearchTerm] = useState('');
  const classDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(event.target as Node)) {
        setIsClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (entity) {
      let initialClassIds: string[] = [];
      if (Array.isArray(entity.assignedClassIds) && entity.assignedClassIds.length > 0) {
        initialClassIds = [...entity.assignedClassIds];
      } else if (entity.mainClassId) {
        initialClassIds = [entity.mainClassId];
      } else if (entity.mainClassName && classes.length > 0) {
        const matched = classes.filter((c) => entity.mainClassName.includes(c.name));
        initialClassIds = matched.map((c) => c.id);
      }
      setFormData({
        ...entity,
        assignedClassIds: initialClassIds,
      });
    } else {
      setFormData({});
    }
    setIsConfirmingDelete(false);
    setIsClassDropdownOpen(false);
    setClassSearchTerm('');
  }, [entity, isOpen, classes]);

  const toggleTeacherClass = (classId: string) => {
    const currentList: string[] = Array.isArray(formData.assignedClassIds) ? formData.assignedClassIds : [];
    const nextList = currentList.includes(classId)
      ? currentList.filter((id) => id !== classId)
      : [...currentList, classId];
    const selectedClasses = classes.filter((c) => nextList.includes(c.id));
    const assignedNames = selectedClasses.map((c) => c.name);
    const assignedSubjects = Array.from(new Set(selectedClasses.map((c) => c.subject).filter(Boolean))) as string[];
    const primaryId = nextList[0] || '';
    const primaryName = assignedNames.join(', ') || '';

    setFormData((prev: any) => ({
      ...prev,
      assignedClassIds: nextList,
      assignedClassNames: assignedNames,
      assignedSubjects: assignedSubjects,
      mainClassId: primaryId,
      mainClassName: primaryName,
      subject: prev.subject || (assignedSubjects.join(', ') || prev.subject),
    }));
  };

  const selectAllTeacherClasses = () => {
    const allIds = classes.map((c) => c.id);
    const assignedNames = classes.map((c) => c.name);
    const assignedSubjects = Array.from(new Set(classes.map((c) => c.subject).filter(Boolean))) as string[];
    setFormData((prev: any) => ({
      ...prev,
      assignedClassIds: allIds,
      assignedClassNames: assignedNames,
      assignedSubjects: assignedSubjects,
      mainClassId: allIds[0] || '',
      mainClassName: assignedNames.join(', ') || '',
    }));
  };

  const clearAllTeacherClasses = () => {
    setFormData((prev: any) => ({
      ...prev,
      assignedClassIds: [],
      assignedClassNames: [],
      assignedSubjects: [],
      mainClassId: '',
      mainClassName: '',
    }));
  };

  if (!isOpen || !entity) return null;

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const getTitle = () => {
    switch (type) {
      case 'class':
        return `Chỉnh sửa Lớp học: ${entity.name}`;
      case 'teacher':
        return `Chỉnh sửa Giáo viên: ${entity.name}`;
      case 'student':
        return `Chỉnh sửa Học sinh: ${entity.name}`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-4 sm:p-6 shadow-2xl animate-fade-in border border-slate-100 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-[#0072B5]">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">{getTitle()}</h3>
              <p className="text-xs text-slate-500">Cập nhật và lưu trực tiếp lên Firebase</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isConfirmingDelete ? (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-[#E74C3C] mx-auto" />
            <h4 className="font-bold text-sm text-slate-800">
              Bạn có chắc chắn muốn xóa {entity.name}?
            </h4>
            <p className="text-xs text-slate-600">
              Hành động này sẽ xóa dữ liệu trực tiếp khỏi Firebase. Dữ liệu liên quan sẽ được đồng bộ.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDelete) onDelete(entity.id);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-[#E74C3C] text-white text-xs font-bold hover:bg-rose-700 shadow-xs"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
            {/* Form Fields for Class */}
            {type === 'class' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Mã lớp học (Mã Lớp)</label>
                    <input
                      type="text"
                      value={formData.classCode || formData.code || `LH-${entity.id.slice(-2).toUpperCase()}`}
                      onChange={(e) => {
                        handleChange('classCode', e.target.value);
                        handleChange('code', e.target.value);
                      }}
                      className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Trạng thái hoạt động</label>
                    <select
                      value={formData.status || 'active'}
                      onChange={(e) => handleChange('status', e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                    >
                      <option value="active">Đang giảng dạy</option>
                      <option value="pending">Chờ khai giảng</option>
                      <option value="paused">Tạm dừng</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tên lớp học *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Môn học *</label>
                    <input
                      type="text"
                      required
                      value={formData.subject || ''}
                      onChange={(e) => handleChange('subject', e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Giáo viên phụ trách <span className="text-[10px] text-[#0072B5] font-normal">(Liên kết GV)</span>
                    </label>
                    <select
                      value={formData.teacherId || (teachers.find((t) => t.name === formData.teacherName)?.id) || ''}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        if (!selectedId) {
                          handleChange('teacherId', '');
                          handleChange('teacherName', 'Chưa phân công');
                        } else {
                          const found = teachers.find((t) => t.id === selectedId);
                          handleChange('teacherId', selectedId);
                          handleChange('teacherName', found?.name || 'Giáo viên');
                          if (found?.phone) handleChange('teacherPhone', found.phone);
                        }
                      }}
                      className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700 bg-white focus:border-[#0072B5] focus:outline-hidden"
                    >
                      <option value="">-- Chưa phân công giáo viên --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.subject} {t.teacherCode ? `- ${t.teacherCode}` : ''})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Phòng học</label>
                    <input
                      type="text"
                      required
                      value={formData.room || ''}
                      onChange={(e) => handleChange('room', e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Sĩ số tối đa</label>
                    <input
                      type="number"
                      min="5"
                      max="60"
                      value={formData.maxCapacity || 25}
                      onChange={(e) => handleChange('maxCapacity', Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Đơn giá / buổi học (đ) <span className="text-[10px] text-emerald-600 font-semibold">* Đồng bộ Firebase</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="5000"
                        min="0"
                        value={formData.pricePerSession !== undefined ? formData.pricePerSession : 40000}
                        onChange={(e) => handleChange('pricePerSession', Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full rounded-xl border border-slate-300 p-2.5 font-bold text-emerald-700 focus:border-emerald-500 focus:outline-hidden"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">đ</span>
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Quy đổi hiển thị</label>
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-black text-emerald-800 flex items-center justify-between">
                      <span>{((formData.pricePerSession !== undefined ? formData.pricePerSession : 40000) || 0).toLocaleString('vi-VN')}</span>
                      <span className="text-[10px] font-semibold text-emerald-600">VNĐ / buổi</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lịch học</label>
                  <input
                    type="text"
                    required
                    value={formData.schedule || ''}
                    onChange={(e) => handleChange('schedule', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                  />
                </div>
              </>
            )}

            {/* Form Fields for Teacher */}
            {type === 'teacher' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Mã giáo viên (Mã GV)</label>
                    <input
                      type="text"
                      value={formData.teacherCode || formData.code || `GV-0${entity.id.slice(-1)}`}
                      onChange={(e) => {
                        handleChange('teacherCode', e.target.value);
                        handleChange('code', e.target.value);
                      }}
                      className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Môn giảng dạy *</label>
                    <input
                      type="text"
                      required
                      value={formData.subject || ''}
                      onChange={(e) => handleChange('subject', e.target.value)}
                      placeholder="VD: Toán học THCS"
                      className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Họ và tên giáo viên *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                  />
                </div>

                {/* Teacher Account Info on Firebase */}
                <div className="rounded-xl bg-amber-50 p-3 border border-amber-200 space-y-2">
                  <div className="font-bold text-[11px] text-amber-900">
                    🔐 Tài khoản Đăng nhập Giáo viên (Lưu trên Firebase)
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-0.5 text-[10px]">Tên đăng nhập (Username)</label>
                      <input
                        type="text"
                        value={formData.username || (formData.phone ? `gv_${formData.phone.replace(/[^0-9]/g, '')}` : `gv_${entity.id.replace('teacher-', '')}`)}
                        onChange={(e) => handleChange('username', e.target.value)}
                        className="w-full rounded-lg border border-amber-300 bg-white p-2 font-mono font-bold text-slate-800 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-0.5 text-[10px]">Mật khẩu (Password)</label>
                      <input
                        type="text"
                        value={formData.password || '123'}
                        onChange={(e) => handleChange('password', e.target.value)}
                        className="w-full rounded-lg border border-amber-300 bg-white p-2 font-mono font-bold text-slate-800 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Số điện thoại / Zalo</label>
                    <input
                      type="text"
                      required
                      value={formData.phone || ''}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                    />
                  </div>
                </div>

                {/* Multi-select dropdown for Lớp đảm nhận */}
                <div ref={classDropdownRef}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      Lớp đảm nhận <span className="text-[10px] text-[#0072B5] font-normal">(1 giáo viên có thể đảm nhận nhiều lớp cùng lúc)</span>
                    </label>
                    {Array.isArray(formData.assignedClassIds) && formData.assignedClassIds.length > 0 && (
                      <span className="text-[11px] font-black text-[#0072B5] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        Đã chọn {formData.assignedClassIds.length} lớp
                      </span>
                    )}
                  </div>

                  {/* Trigger button */}
                  <div
                    onClick={() => setIsClassDropdownOpen((prev) => !prev)}
                    className={`w-full min-h-[42px] rounded-xl border p-2 text-xs bg-white flex items-center justify-between gap-2 cursor-pointer transition-all ${
                      isClassDropdownOpen ? 'border-[#0072B5] ring-2 ring-blue-100 shadow-sm' : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex-1 flex flex-wrap gap-1.5 items-center">
                      {!Array.isArray(formData.assignedClassIds) || formData.assignedClassIds.length === 0 ? (
                        <span className="text-slate-400 font-medium pl-1">
                          -- Bấm vào đây để chọn các lớp đảm nhận (chọn nhiều môn/lớp khi xổ xuống) --
                        </span>
                      ) : (
                        formData.assignedClassIds.map((cId: string) => {
                          const c = classes.find((item) => item.id === cId);
                          return (
                            <span
                              key={cId}
                              className="inline-flex items-center gap-1.5 bg-blue-50 text-[#0072B5] border border-blue-200 px-2.5 py-1 rounded-lg text-xs font-bold"
                            >
                              <BookOpen className="w-3 h-3 text-[#0072B5]" />
                              <span>{c ? c.name : cId}</span>
                              {c?.subject && <span className="text-[10px] font-medium text-slate-500">({c.subject})</span>}
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTeacherClass(cId);
                                }}
                                className="hover:text-rose-600 hover:bg-rose-50 rounded-full w-4 h-4 flex items-center justify-center cursor-pointer ml-0.5"
                                title="Bỏ chọn lớp này"
                              >
                                &times;
                              </span>
                            </span>
                          );
                        })
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 text-slate-400 pr-1">
                      <ChevronDown className={`w-4 h-4 transition-transform ${isClassDropdownOpen ? 'rotate-180 text-[#0072B5]' : ''}`} />
                    </div>
                  </div>

                  {/* Dropdown list xổ xuống */}
                  {isClassDropdownOpen && (
                    <div className="relative z-30">
                      <div className="absolute left-0 right-0 mt-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl space-y-2.5 max-h-72 overflow-y-auto animate-fade-in">
                        {/* Thanh tìm kiếm nhanh */}
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                            <input
                              type="text"
                              value={classSearchTerm}
                              onChange={(e) => setClassSearchTerm(e.target.value)}
                              placeholder="Tìm theo tên lớp hoặc môn học..."
                              className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectAllTeacherClasses();
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[#0072B5] bg-blue-50 hover:bg-blue-100 border border-blue-200 cursor-pointer"
                          >
                            Chọn hết
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearAllTeacherClasses();
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer"
                          >
                            Bỏ chọn
                          </button>
                        </div>

                        {/* Danh sách lớp */}
                        <div className="space-y-1 divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1">
                          {classes
                            .filter((c) => {
                              if (!classSearchTerm.trim()) return true;
                              const s = classSearchTerm.toLowerCase().trim();
                              return (
                                (c.name || '').toLowerCase().includes(s) ||
                                (c.subject || '').toLowerCase().includes(s) ||
                                (c.classCode || '').toLowerCase().includes(s)
                              );
                            })
                            .map((c) => {
                              const isSelected = Array.isArray(formData.assignedClassIds) && formData.assignedClassIds.includes(c.id);
                              return (
                                <div
                                  key={c.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTeacherClass(c.id);
                                  }}
                                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-colors pt-2 ${
                                    isSelected
                                      ? 'bg-blue-50/80 border border-blue-200 font-bold'
                                      : 'hover:bg-slate-50 border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    {isSelected ? (
                                      <CheckSquare className="w-4 h-4 text-[#0072B5] shrink-0" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                    )}
                                    <div>
                                      <div className="text-slate-800 font-extrabold flex items-center gap-1.5">
                                        <span>{c.name}</span>
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                          Môn: {c.subject}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                                        Phòng: {c.room || 'Linh hoạt'} &bull; {c.schedule || 'Lịch học'}
                                        {c.teacherName && c.teacherId !== entity.id && c.teacherName !== 'Chưa phân công' && (
                                          <span className="text-amber-700 ml-1.5 font-medium">
                                            (Đang phụ trách: {c.teacherName})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0">
                                    {c.classCode || 'LH'}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Form Fields for Student */}
            {type === 'student' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Mã học sinh (Mã HS)</label>
                    <input
                      type="text"
                      value={formData.studentCode || formData.code || `HS-0${entity.id.slice(-1)}`}
                      onChange={(e) => {
                        handleChange('studentCode', e.target.value);
                        handleChange('code', e.target.value);
                      }}
                      className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Trạng thái học tập</label>
                    <select
                      value={formData.status || 'active'}
                      onChange={(e) => handleChange('status', e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                    >
                      <option value="active">Đang học chính thức</option>
                      <option value="probation">Học thử 3 buổi</option>
                      <option value="suspended">Bảo lưu kết quả</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Họ và tên học sinh *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Phụ huynh *</label>
                    <input
                      type="text"
                      required
                      value={formData.parentName || ''}
                      onChange={(e) => handleChange('parentName', e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Số điện thoại Zalo *</label>
                    <input
                      type="text"
                      required
                      value={formData.parentPhone || ''}
                      onChange={(e) => handleChange('parentPhone', e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                    />
                  </div>
                </div>

                {/* Parent Portal Account */}
                <div className="rounded-xl bg-blue-50 p-3 border border-blue-200 space-y-2">
                  <div className="font-bold text-[11px] text-[#0072B5]">
                    📱 Tài khoản Sổ Liên Lạc Điện Tử của Phụ Huynh
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-0.5 text-[10px]">Tên đăng nhập PH</label>
                      <input
                        type="text"
                        value={formData.username || (formData.parentPhone ? `ph_${formData.parentPhone.replace(/[^0-9]/g, '')}` : `ph_${entity.id.slice(-4)}`)}
                        onChange={(e) => handleChange('username', e.target.value)}
                        className="w-full rounded-lg border border-blue-300 bg-white p-2 font-mono font-bold text-slate-800 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-0.5 text-[10px]">Mật khẩu PH</label>
                      <input
                        type="text"
                        value={formData.password || '123'}
                        onChange={(e) => handleChange('password', e.target.value)}
                        className="w-full rounded-lg border border-blue-300 bg-white p-2 font-mono font-bold text-slate-800 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Lớp học</label>
                    {classes && classes.length > 0 ? (
                      <select
                        value={formData.classId || ''}
                        onChange={(e) => {
                          const sel = classes.find((c) => c.id === e.target.value);
                          handleChange('classId', e.target.value);
                          if (sel) handleChange('className', sel.name);
                        }}
                        className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                      >
                        <option value="">-- Chọn lớp học --</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.classCode || c.id})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        value={formData.className || ''}
                        onChange={(e) => handleChange('className', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Điểm TB (GPA)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={formData.gpa || 8.0}
                      onChange={(e) => handleChange('gpa', parseFloat(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nhận xét & Ghi chú</label>
                  <textarea
                    rows={2}
                    value={formData.note || ''}
                    onChange={(e) => handleChange('note', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-700"
                  />
                </div>
              </>
            )}

            {/* Actions */}
            <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="flex items-center gap-1 text-[#E74C3C] hover:bg-rose-50 px-3 py-2 rounded-xl font-bold transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa dữ liệu</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white px-5 py-2 font-bold shadow-xs transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu Thay Đổi (Firestore)</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
