import React, { useState } from 'react';
import { 
  School, 
  Users, 
  GraduationCap, 
  Search, 
  Plus, 
  FileSpreadsheet, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Phone, 
  Calendar, 
  Filter,
  Check,
  Loader2,
  X,
  DollarSign
} from 'lucide-react';
import { ClassItem, TeacherItem, StudentItem, AttendanceStatus } from '../../data/mockData';
import { EntityType } from './EditEntityModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { areSameTeacher } from '../../services/firebaseService';
import { AccountAvatar } from '../common/AccountAvatar';


interface AdminManagementHubProps {
  initialTab?: EntityType;
  classes: ClassItem[];
  teachers: TeacherItem[];
  students: StudentItem[];
  onOpenAddClass: () => void;
  onOpenAddStudent: () => void;
  onOpenAddTeacher: () => void;
  onOpenImport: (type: EntityType) => void;
  onEditEntity: (type: EntityType, entity: any) => void;
  onDeleteEntity: (type: EntityType, id: string) => void;
  onUpdateAttendance: (studentId: string, status: AttendanceStatus) => void;
  onUpdateClassPrice?: (classId: string, price: number) => Promise<void> | void;
}

export const AdminManagementHub: React.FC<AdminManagementHubProps> = ({
  initialTab = 'class',
  classes,
  teachers,
  students,
  onOpenAddClass,
  onOpenAddStudent,
  onOpenAddTeacher,
  onOpenImport,
  onEditEntity,
  onDeleteEntity,
  onUpdateAttendance,
  onUpdateClassPrice,
}) => {
  // Sub-tabs for Directory: 'class' | 'teacher' | 'student'
  const [activeTab, setActiveTab] = useState<EntityType>(initialTab);

  // Trạng thái chỉnh sửa nhanh đơn giá / buổi trực tiếp trên bảng
  const [editingPriceClassId, setEditingPriceClassId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(40000);
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);

  const handleSavePrice = async (classId: string) => {
    if (!onUpdateClassPrice) return;
    setSavingPriceId(classId);
    try {
      await onUpdateClassPrice(classId, tempPrice);
      setEditingPriceClassId(null);
    } finally {
      setSavingPriceId(null);
    }
  };

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      setSearchTerm('');
      setStatusFilter('all');
    }
  }, [initialTab]);

  // Realtime Search & Filter state for Directory
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Confirmation modal state for deletions
  const [deletingEntity, setDeletingEntity] = useState<{
    type: EntityType;
    id: string;
    name: string;
    code?: string;
    subInfo?: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deletingEntity) return;
    setIsDeleting(true);
    try {
      await onDeleteEntity(deletingEntity.type, deletingEntity.id);
      setDeletingEntity(null);
    } catch {
      // Keep state if needed, error handling in parent
    } finally {
      setIsDeleting(false);
    }
  };

  // Calculations for Student Attendance Status Filter
  const presentCount = students.filter(s => s.attendanceStatus === 'present' || !s.attendanceStatus).length;
  const excusedCount = students.filter(s => s.attendanceStatus === 'excused').length;
  const unexcusedCount = students.filter(s => s.attendanceStatus === 'unexcused').length;

  // Filtered Directory Data
  const filteredClasses = (classes || []).filter(c => {
    if (!c) return false;
    const s = searchTerm.trim().toLowerCase();
    if (!s) return true;
    const matchName = (c.name || '').toLowerCase().includes(s);
    const matchTeacher = (c.teacherName || '').toLowerCase().includes(s);
    const matchRoom = (c.room || '').toLowerCase().includes(s);
    const matchCode = (c.classCode || '').toLowerCase().includes(s);
    const matchSubject = (c.subject || '').toLowerCase().includes(s);
    return matchName || matchTeacher || matchRoom || matchCode || matchSubject;
  });

  // Khử trùng lặp tuyệt đối để không bao giờ hiển thị 2 giáo viên giống nhau
  const uniqueTeachers = (teachers || []).filter((tc, idx, arr) => {
    if (!tc) return false;
    if ((tc.status as any) === 'deleted' || (tc as any)._deleted) return false;
    return arr.findIndex((other) => areSameTeacher(other, tc)) === idx;
  });

  const filteredTeachers = uniqueTeachers.filter(t => {
    if (!t) return false;
    const s = searchTerm.trim().toLowerCase();
    if (!s) return true;
    const matchName = (t.name || '').toLowerCase().includes(s);
    const matchSubject = (t.subject || '').toLowerCase().includes(s);
    const matchClass = (t.mainClassName || '').toLowerCase().includes(s);
    const matchPhone = (t.phone || '').includes(s);
    const matchCode = (t.teacherCode || '').toLowerCase().includes(s);
    return matchName || matchSubject || matchClass || matchPhone || matchCode;
  });

  const filteredStudents = (students || []).filter(s => {
    if (!s) return false;
    if ((s.status as any) === 'deleted' || (s as any)._deleted) return false;
    const sTerm = searchTerm.trim().toLowerCase();
    
    // Nếu có từ khóa tìm kiếm thì so khớp, nếu không có thì luôn khớp
    const matchSearch = !sTerm ||
      (s.name || '').toLowerCase().includes(sTerm) ||
      (s.className || '').toLowerCase().includes(sTerm) ||
      (s.parentName || '').toLowerCase().includes(sTerm) ||
      (s.parentPhone || '').includes(sTerm) ||
      (s.studentCode || '').toLowerCase().includes(sTerm) ||
      (s.username || '').toLowerCase().includes(sTerm);

    const matchStatus = statusFilter === 'all' || 
      s.attendanceStatus === statusFilter ||
      (statusFilter === 'present' && !s.attendanceStatus);
      
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5 animate-fade-in text-slate-800">
      {/* Top Banner */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-6 rounded-full bg-[#0072B5]"></span>
            <h1 className="text-xl font-black text-[#0B486B] tracking-tight">
              Khu Vực Quản Trị Hệ Thống (ADMIN)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Trung tâm dạy thêm Học Giỏi &bull; Bảng điều khiển quản lý toàn bộ Lớp học, Giáo viên và Học sinh
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* QUẢN LÝ LỚP HỌC, GIÁO VIÊN, HỌC SINH (TAB INTERFACE + TABLES) */}
      {/* ========================================================================= */}
      <div className="space-y-4">
          {/* Sub-Tabs: Lớp học | Giáo viên | Học sinh */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setActiveTab('class'); setSearchTerm(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
                  activeTab === 'class'
                    ? 'border-[#0072B5] text-[#0072B5] bg-blue-50/70 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <School className="w-4 h-4 text-[#0072B5]" />
                <span>Danh Sách Lớp Học ({classes.length})</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('teacher'); setSearchTerm(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
                  activeTab === 'teacher'
                    ? 'border-[#F39C12] text-[#B7791F] bg-amber-50/70 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4 text-[#F39C12]" />
                <span>Danh Sách Giáo Viên ({teachers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('student'); setSearchTerm(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
                  activeTab === 'student'
                    ? 'border-[#00A86B] text-[#00A86B] bg-emerald-50/70 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <GraduationCap className="w-4 h-4 text-[#00A86B]" />
                <span>Danh Sách Học Sinh ({students.length})</span>
              </button>
            </div>

            {/* Quick Action Buttons for Current Tab */}
            <div className="flex items-center gap-2 mb-1">
              <button
                type="button"
                onClick={() => onOpenImport(activeTab)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 text-xs font-bold transition-all shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nhập Excel / CSV</span>
              </button>

              {activeTab === 'class' && (
                <button
                  type="button"
                  onClick={onOpenAddClass}
                  className="flex items-center gap-1.5 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white px-3.5 py-2 text-xs font-bold transition-all shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>[+] Thêm Lớp Mới</span>
                </button>
              )}

              {activeTab === 'teacher' && (
                <button
                  type="button"
                  onClick={onOpenAddTeacher}
                  className="flex items-center gap-1.5 rounded-xl bg-[#F39C12] hover:bg-amber-600 text-white px-3.5 py-2 text-xs font-bold transition-all shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>[+] Thêm Giáo Viên</span>
                </button>
              )}

              {activeTab === 'student' && (
                <button
                  type="button"
                  onClick={onOpenAddStudent}
                  className="flex items-center gap-1.5 rounded-xl bg-[#00A86B] hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold transition-all shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>[+] Thêm Học Sinh</span>
                </button>
              )}
            </div>
          </div>

          {/* Search & Realtime Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3.5 border border-slate-200/90 shadow-2xs">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={
                  activeTab === 'class'
                    ? 'Tìm theo tên lớp, mã lớp, môn học, giáo viên...'
                    : activeTab === 'teacher'
                    ? 'Tìm theo họ tên giáo viên, số điện thoại, môn dạy...'
                    : 'Tìm theo họ tên học sinh, lớp, phụ huynh, SĐT Zalo...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {activeTab === 'student' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Điểm danh hôm nay:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-hidden"
                >
                  <option value="all">Tất cả ({students.length})</option>
                  <option value="present">🟢 Có mặt ({presentCount})</option>
                  <option value="excused">🟠 Có phép ({excusedCount})</option>
                  <option value="unexcused">🔴 Không phép ({unexcusedCount})</option>
                </select>
              </div>
            )}
          </div>

          {/* TAB 1: TABLE LỚP HỌC */}
          {activeTab === 'class' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold">
                      <th className="py-3 px-4">Mã Lớp</th>
                      <th className="py-3 px-4">Tên Lớp Học</th>
                      <th className="py-3 px-3">Môn Học</th>
                      <th className="py-3 px-3">Giáo Viên Phụ Trách</th>
                      <th className="py-3 px-3">Phòng Học &amp; Lịch Học</th>
                      <th className="py-3 px-3 text-center">Sĩ Số</th>
                      <th className="py-3 px-3 text-center">Đơn Giá/Buổi</th>
                      <th className="py-3 px-3 text-center">Trạng Thái</th>
                      <th className="py-3 px-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredClasses.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          <School className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                          <p className="font-bold text-sm text-slate-600">Chưa có lớp học nào trong danh sách</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {searchTerm ? 'Không tìm thấy lớp học phù hợp với từ khóa tìm kiếm.' : 'Nhấn nút "[+] Thêm Lớp Mới" phía trên để tạo lớp học đầu tiên cho trung tâm!'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredClasses.map((cls) => {
                        const code = cls.classCode || (cls.id.startsWith('class-') ? `LH-${cls.id.replace('class-', '').toUpperCase()}` : `LH-${cls.id.slice(0, 4).toUpperCase()}`);
                        const isTeaching = cls.status === 'active' || !cls.status;
                        const isPending = cls.status === 'pending';
                        const currentPrice = cls.pricePerSession !== undefined ? cls.pricePerSession : 40000;
                        return (
                          <tr key={cls.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-extrabold text-[#0B486B] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md font-mono text-[11px]">
                                {code}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-800">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isTeaching ? 'bg-[#0072B5]' : isPending ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                                <span>{cls.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-600 font-semibold">{cls.subject}</td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-slate-800">{cls.teacherName || 'Chưa phân công'}</span>
                            </td>
                            <td className="py-3 px-3 text-slate-500">
                              <div>{cls.room || 'Phòng học'}</div>
                              <div className="text-[10px] text-slate-400">{cls.schedule || 'Lịch linh hoạt'}</div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="font-black text-slate-800">
                                {cls.studentCount || 0}/{cls.maxCapacity || 25}
                              </span>
                            </td>
                            {/* Cột Đơn Giá/Buổi - Đồng bộ trực tiếp với Bảng điểm danh & học phí & Firebase */}
                            <td className="py-3 px-3 text-center">
                              {editingPriceClassId === cls.id ? (
                                <div className="inline-flex items-center gap-1 bg-white border-2 border-emerald-500 rounded-xl px-2 py-1 shadow-xs">
                                  <input
                                    type="number"
                                    step="5000"
                                    min="0"
                                    value={tempPrice}
                                    onChange={(e) => setTempPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                    className="w-20 text-xs font-black text-emerald-800 text-right focus:outline-hidden"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSavePrice(cls.id);
                                      if (e.key === 'Escape') setEditingPriceClassId(null);
                                    }}
                                  />
                                  <span className="text-[10px] font-bold text-slate-500">đ</span>
                                  <button
                                    type="button"
                                    disabled={savingPriceId === cls.id}
                                    onClick={() => handleSavePrice(cls.id)}
                                    className="p-1 rounded-lg bg-[#00A86B] hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                                    title="Lưu vào Firebase"
                                  >
                                    {savingPriceId === cls.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingPriceClassId(null)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                    title="Hủy"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/90 px-2.5 py-1 rounded-xl text-xs font-black shadow-2xs group hover:bg-emerald-100 transition-colors">
                                  <span>{currentPrice.toLocaleString('vi-VN')}</span>
                                  <span className="text-[10px] text-emerald-600 font-semibold">đ/buổi</span>
                                  {onUpdateClassPrice && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingPriceClassId(cls.id);
                                        setTempPrice(currentPrice);
                                      }}
                                      className="opacity-40 group-hover:opacity-100 hover:text-emerald-900 transition-opacity p-0.5 rounded hover:bg-emerald-200/60 cursor-pointer"
                                      title="Chỉnh sửa nhanh đơn giá/buổi (Lưu Firebase)"
                                    >
                                      <Edit3 className="w-3 h-3 text-emerald-700" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {isTeaching ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-[#00A86B] border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#00A86B]"></span>
                                  Đang giảng dạy
                                </span>
                              ) : isPending ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  Chờ khai giảng
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 border border-slate-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  Tạm dừng
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onEditEntity('class', cls)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#0072B5] hover:bg-blue-50 transition-colors"
                                  title="Chỉnh sửa lớp học"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingEntity({
                                    type: 'class',
                                    id: cls.id,
                                    name: cls.name,
                                    code: cls.classCode,
                                    subInfo: `Môn: ${cls.subject} • Sĩ số: ${cls.studentCount || 0}/${cls.maxCapacity || 25} học sinh • GV: ${cls.teacherName || 'Chưa phân công'}`
                                  })}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Xóa lớp học"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: TABLE GIÁO VIÊN */}
          {activeTab === 'teacher' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold">
                      <th className="py-3 px-4">Mã GV</th>
                      <th className="py-3 px-4">Họ và Tên Giáo Viên</th>
                      <th className="py-3 px-3">Chuyên Môn</th>
                      <th className="py-3 px-3">Lớp Đảm Nhận</th>
                      <th className="py-3 px-3">Số Điện Thoại / Zalo</th>
                      <th className="py-3 px-3">Email Liên Hệ</th>
                      <th className="py-3 px-3 text-center">Trạng Thái</th>
                      <th className="py-3 px-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredTeachers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                          <p className="font-bold text-sm text-slate-600">Chưa có giáo viên nào trong danh sách</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {searchTerm ? 'Không tìm thấy giáo viên phù hợp với từ khóa tìm kiếm.' : 'Nhấn nút "[+] Thêm Giáo Viên" phía trên để thêm hồ sơ giáo viên mới cho trung tâm!'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredTeachers.map((tc, idx) => {
                        const code = tc.teacherCode || `GV-0${idx + 1}`;
                        const username = tc.username || (tc.phone ? `gv_${tc.phone.replace(/[^0-9]/g, '')}` : `gv_${tc.id.replace('teacher-', '')}`);
                        return (
                          <tr key={tc.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-extrabold text-[#B7791F] bg-amber-50 px-2 py-0.5 rounded-md font-mono text-[11px] border border-amber-200">
                                {code}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <AccountAvatar
                                  name={tc.name}
                                  role="teacher"
                                  size="sm"
                                  className="ring-1 ring-slate-200"
                                />
                                <div>
                                  <div className="font-extrabold text-slate-800">{tc.name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">User: @{username}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-700">{tc.subject}</td>
                            <td className="py-3 px-3">
                              {(() => {
                                const classList = Array.isArray(tc.assignedClassNames) && tc.assignedClassNames.length > 0
                                  ? tc.assignedClassNames
                                  : tc.mainClassName
                                  ? tc.mainClassName.split(',').map((s: string) => s.trim())
                                  : [];
                                if (classList.length === 0) {
                                  return <span className="text-slate-400 italic text-[11px]">Chưa phân lớp</span>;
                                }
                                return (
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {classList.map((cName: string, cIdx: number) => (
                                      <span key={cIdx} className="font-bold text-[#0072B5] bg-blue-50 px-2 py-0.5 rounded-md text-[11px] border border-blue-100">
                                        {cName}
                                      </span>
                                    ))}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-700">
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-[#0072B5]" />
                                <span>{tc.phone}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-500 text-[11px]">{tc.email}</td>
                            <td className="py-3 px-3 text-center">
                              {tc.status === 'paused' || tc.status === 'inactive' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 border border-slate-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  Tạm nghỉ
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-[#00A86B] border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#00A86B]"></span>
                                  Đang đứng lớp
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onEditEntity('teacher', tc)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#0072B5] hover:bg-blue-50 transition-colors cursor-pointer"
                                  title="Chỉnh sửa giáo viên"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingEntity({
                                    type: 'teacher',
                                    id: tc.id,
                                    name: tc.name || tc.fullName || 'Giáo viên',
                                    code: tc.teacherCode,
                                    subInfo: `Môn: ${tc.subject || 'Chưa rõ'} • Tên đăng nhập: @${tc.username} • SĐT: ${tc.phone || 'Chưa cập nhật'}`
                                  })}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Xóa giáo viên"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: TABLE HỌC SINH */}
          {activeTab === 'student' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold">
                      <th className="py-3 px-4">Mã HS</th>
                      <th className="py-3 px-4">Họ và Tên Học Sinh</th>
                      <th className="py-3 px-3">Lớp Học</th>
                      <th className="py-3 px-3">Phụ Huynh &amp; SĐT</th>
                      <th className="py-3 px-3 text-center">GPA</th>
                      <th className="py-3 px-3 text-center">Điểm Danh Hôm Nay</th>
                      <th className="py-3 px-3 text-center">Trạng Thái Hoạt Động</th>
                      <th className="py-3 px-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <GraduationCap className="w-8 h-8 text-slate-300" />
                            <p className="text-sm font-semibold text-slate-500">
                              Chưa có học sinh nào trong danh sách
                            </p>
                            <p className="text-xs text-slate-400">
                              Nhấn "[+] Thêm Học Sinh" hoặc "Nhập Excel / CSV" để nạp danh sách học sinh vào hệ thống.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((st, idx) => {
                        const code = st.studentCode || `HS-0${idx + 1}`;
                        const avatarUrl = st.avatar || (st.gender === 'Nữ'
                          ? 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80'
                          : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80');
                        return (
                          <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-extrabold text-[#00A86B] bg-emerald-50 px-2 py-0.5 rounded-md font-mono text-[11px] border border-emerald-200">
                                {code}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <AccountAvatar
                                  name={st.name}
                                  role="student"
                                  size="sm"
                                  className="ring-1 ring-slate-200"
                                />
                                <div>
                                  <div className="font-extrabold text-slate-800">{st.name}</div>
                                  <div className="text-[10px] text-slate-400">Niên khóa 2023 - 2024</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-[#0072B5] bg-blue-50 px-2 py-0.5 rounded-md">
                                {st.className || 'Chưa xếp lớp'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-800">{st.parentName || 'Chưa cập nhật'}</div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-[#0072B5]" />
                                <span>{st.parentPhone || 'Chưa có SĐT'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-black text-slate-800 text-sm">
                              {st.gpa ?? 8.0}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {st.attendanceStatus === 'present' && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateAttendance(st.id, 'excused')}
                                  title="Nhấp để đổi trạng thái"
                                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-[#00A86B] border border-emerald-200"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Có mặt
                                </button>
                              )}
                              {st.attendanceStatus === 'excused' && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateAttendance(st.id, 'unexcused')}
                                  title="Nhấp để đổi trạng thái"
                                  className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-[#F39C12] border border-amber-200"
                                >
                                  <Clock className="w-3.5 h-3.5" /> Có phép
                                </button>
                              )}
                              {st.attendanceStatus === 'unexcused' && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateAttendance(st.id, 'present')}
                                  title="Nhấp để đổi trạng thái"
                                  className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-[#E74C3C] border border-rose-200"
                                >
                                  <AlertCircle className="w-3.5 h-3.5" /> Không phép
                                </button>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {st.status === 'probation' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-[#F39C12] border border-amber-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#F39C12]"></span>
                                  Học thử 3 buổi
                                </span>
                              ) : st.status === 'suspended' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 border border-slate-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  Bảo lưu
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-[#00A86B] border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#00A86B]"></span>
                                  Chính thức
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onEditEntity('student', st)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#0072B5] hover:bg-blue-50 transition-colors cursor-pointer"
                                  title="Chỉnh sửa học sinh"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingEntity({
                                    type: 'student',
                                    id: st.id,
                                    name: st.name,
                                    code: st.studentCode,
                                    subInfo: `Lớp: ${st.className || 'Chưa xếp lớp'} • Phụ huynh: ${st.parentName || 'Chưa rõ'} (${st.parentPhone || 'Chưa có SĐT'})`
                                  })}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Xóa học sinh"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>





      {/* MODAL CẢNH BÁO XÁC NHẬN XÓA (GIÁO VIÊN / HỌC SINH / LỚP HỌC) */}
      {deletingEntity && (
        <ConfirmDeleteModal
          isOpen={!!deletingEntity}
          itemName={deletingEntity.name}
          itemType={
            deletingEntity.type === 'teacher'
              ? 'giáo viên'
              : deletingEntity.type === 'student'
              ? 'học sinh'
              : 'lớp học'
          }
          itemCode={deletingEntity.code}
          itemSubInfo={deletingEntity.subInfo}
          isDeleting={isDeleting}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeletingEntity(null)}
        />
      )}
    </div>
  );
};
