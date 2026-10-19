import React, { useState } from 'react';
import { 
  GraduationCap, 
  Search, 
  Plus, 
  Phone, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Edit3, 
  Trash2,
  Users,
  Download
} from 'lucide-react';
import { StudentItem, AttendanceStatus } from '../../data/mockData';
import { downloadCSVTemplate } from '../admin/ExcelImportModal';
import { ConfirmDeleteModal } from '../admin/ConfirmDeleteModal';
import { AccountAvatar } from '../common/AccountAvatar';

interface AdminStudentsViewProps {
  students?: StudentItem[];
  onAddStudentClick?: () => void;
  onImportClick?: () => void;
  onEditStudentClick?: (student: StudentItem) => void;
  onDeleteStudentClick?: (studentId: string) => void;
}

export const AdminStudentsView: React.FC<AdminStudentsViewProps> = ({
  students = [],
  onAddStudentClick,
  onImportClick,
  onEditStudentClick,
  onDeleteStudentClick,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');
  const [deletingStudent, setDeletingStudent] = useState<StudentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDeleteStudent = async () => {
    if (!deletingStudent || !onDeleteStudentClick) return;
    setIsDeleting(true);
    try {
      await onDeleteStudentClick(deletingStudent.id);
      setDeletingStudent(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const getAvatarUrl = (avatarUrl?: string | null, name?: string) => {
    if (avatarUrl && avatarUrl.trim() !== '') return avatarUrl;
    const displayName = name || 'Student';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0072B5&color=fff&bold=true`;
  };

  const filteredStudents = (students || []).filter((s) => {
    if (!s) return false;
    const code = s.studentCode || '';
    const nameStr = s.name || '';
    const classStr = s.className || '';
    const parentStr = s.parentName || '';
    const phoneStr = s.parentPhone || '';

    const matchSearch =
      nameStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      classStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parentStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      phoneStr.includes(searchTerm);

    const matchStatus = statusFilter === 'all' || s.attendanceStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-[#0B486B]">Hồ Sơ Học Sinh &amp; Sĩ Số</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý hồ sơ học sinh, phụ huynh liên hệ và tài khoản sổ liên lạc lưu trên Firestore &lsquo;students&rsquo;
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadCSVTemplate('student')}
            className="flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-3.5 text-xs font-bold transition-all border border-slate-200 cursor-pointer"
            title="Tải về file Excel mẫu để nhập nhiều học sinh cùng lúc"
          >
            <Download className="w-4 h-4 text-[#0072B5]" />
            <span>Tải Mẫu Excel</span>
          </button>
          {onAddStudentClick && (
            <button
              type="button"
              onClick={onAddStudentClick}
              className="flex items-center gap-1.5 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white py-2.5 px-4 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tiếp Nhận Học Sinh</span>
            </button>
          )}
          {onImportClick && (
            <button
              type="button"
              onClick={onImportClick}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 py-2.5 px-4 text-xs font-bold transition-all border border-emerald-200 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Nhập Excel / CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo Mã HS, tên học sinh, lớp, số điện thoại hoặc phụ huynh..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
          >
            <option value="all">Tất cả ({(students || []).length})</option>
            <option value="present">Có mặt (🟢)</option>
            <option value="excused">Có phép (🟠)</option>
            <option value="unexcused">Không phép (🔴)</option>
          </select>
        </div>
      </div>

      {/* Students Table or Empty State */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
            <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0072B5] mb-2">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Chưa có hồ sơ học sinh nào</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {searchTerm ? 'Không tìm thấy học sinh khớp với từ khóa tìm kiếm.' : 'Bấm tiếp nhận học sinh để tạo hồ sơ mới lưu trực tiếp vào Firestore.'}
            </p>
            {onAddStudentClick && !searchTerm && (
              <button
                type="button"
                onClick={onAddStudentClick}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white px-4 py-2 text-xs font-bold transition-all shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm học sinh ngay</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold">
                  <th className="py-3 px-3 w-16">Mã HS</th>
                  <th className="py-3 px-4">Học Sinh</th>
                  <th className="py-3 px-3">Lớp Học</th>
                  <th className="py-3 px-3">Phụ Huynh &amp; Sổ Liên Lạc</th>
                  <th className="py-3 px-3 text-center">Trạng Thái</th>
                  <th className="py-3 px-3 text-center">Điểm TB (GPA)</th>
                  <th className="py-3 px-4">Nhận Xét Học Lực</th>
                  <th className="py-3 px-3 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st, idx) => {
                  if (!st) return null;
                  const code = st.studentCode || `HS-0${idx + 1}`;
                  const username = st.username || (st.parentPhone ? `ph_${st.parentPhone.replace(/[^0-9]/g, '')}` : `ph_${st.id.slice(-4)}`);

                  return (
                    <tr key={st.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#0072B5]">
                        <span className="bg-blue-50 px-2 py-1 rounded border border-blue-100 block text-center">
                          {code}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <AccountAvatar
                            name={st?.name || 'Học sinh'}
                            role="student"
                            size="md"
                            className="ring-1 ring-slate-200 shrink-0"
                          />
                          <div>
                            <div className="font-extrabold text-slate-800">{st?.name || 'Chưa đặt tên'}</div>
                            <div className="text-[10px] text-slate-400">
                              {st?.gender ? `Giới tính: ${st.gender}` : 'Học sinh chính thức'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        <span className="bg-blue-50 text-[#0072B5] px-2 py-0.5 rounded-md font-bold">
                          {st?.className || 'Chưa xếp lớp'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800">{st?.parentName || 'Chưa cập nhật'}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-[#0072B5]" />
                          <span>{st?.parentPhone || 'N/A'}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          User: @{username}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {st?.attendanceStatus === 'present' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-[#00A86B] border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Có mặt
                          </span>
                        )}
                        {st?.attendanceStatus === 'excused' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-[#F39C12] border border-amber-200">
                            <Clock className="w-3.5 h-3.5" /> Có phép
                          </span>
                        )}
                        {st?.attendanceStatus === 'unexcused' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-[#E74C3C] border border-rose-200">
                            <AlertCircle className="w-3.5 h-3.5" /> Không phép
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-black text-slate-800 text-sm">{st?.gpa ?? 8.0}</span>
                        <span className="text-[10px] text-slate-400 block">{st?.recentGrade || 'Thang 10'}</span>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <p className="text-slate-600 italic text-[11px] truncate" title={st?.note}>
                          &ldquo;{st?.note || 'Học sinh chăm ngoan, tiếp thu bài tốt.'}&rdquo;
                        </p>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditStudentClick && onEditStudentClick(st)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#0072B5] hover:bg-blue-50 transition-colors"
                            title="Chỉnh sửa học sinh"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingStudent(st)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Xóa học sinh"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {deletingStudent && (
        <ConfirmDeleteModal
          isOpen={!!deletingStudent}
          itemName={deletingStudent.name || 'Học sinh'}
          itemType="học sinh"
          itemCode={deletingStudent.studentCode}
          itemSubInfo={`Lớp: ${deletingStudent.className || 'Chưa xếp lớp'} • Phụ huynh: ${deletingStudent.parentName || 'Chưa rõ'} (${deletingStudent.parentPhone || 'Chưa có SĐT'})`}
          isDeleting={isDeleting}
          onConfirm={handleConfirmDeleteStudent}
          onClose={() => setDeletingStudent(null)}
        />
      )}
    </div>
  );
};
