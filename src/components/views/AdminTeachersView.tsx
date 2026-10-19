import React, { useState } from 'react';
import { Users, Mail, Phone, Award, Plus, Edit3, Trash2, Download } from 'lucide-react';
import { TeacherItem } from '../../data/mockData';
import { downloadCSVTemplate } from '../admin/ExcelImportModal';
import { ConfirmDeleteModal } from '../admin/ConfirmDeleteModal';
import { areSameTeacher } from '../../services/firebaseService';
import { AccountAvatar } from '../common/AccountAvatar';

interface AdminTeachersViewProps {
  teachers?: TeacherItem[];
  onOpenAddTeacher?: () => void;
  onEditTeacher?: (teacher: TeacherItem) => void;
  onDeleteTeacher?: (id: string) => void;
}

export const AdminTeachersView: React.FC<AdminTeachersViewProps> = ({
  teachers = [],
  onOpenAddTeacher,
  onEditTeacher,
  onDeleteTeacher,
}) => {
  const [deletingTeacher, setDeletingTeacher] = useState<TeacherItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDeleteTeacher = async () => {
    if (!deletingTeacher || !onDeleteTeacher) return;
    setIsDeleting(true);
    try {
      await onDeleteTeacher(deletingTeacher.id);
      setDeletingTeacher(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const getAvatarUrl = (avatarUrl?: string | null, name?: string) => {
    if (avatarUrl && avatarUrl.trim() !== '') return avatarUrl;
    const displayName = name || 'Teacher';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=00A86B&color=fff&bold=true`;
  };

  // Khử trùng lặp tuyệt đối để không bao giờ hiển thị 2 giáo viên giống nhau
  const uniqueTeachers = (teachers || []).filter((tc, idx, arr) => {
    if (!tc) return false;
    return arr.findIndex((x) => areSameTeacher(x, tc)) === idx;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-[#0B486B]">Đội Ngũ Giáo Viên &amp; Giảng Viên</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Danh sách giáo viên cơ hữu và giáo viên thỉnh giảng bồi dưỡng văn hóa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadCSVTemplate('teacher')}
            className="flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-3.5 text-xs font-bold transition-all border border-slate-200 cursor-pointer"
            title="Tải về file Excel mẫu để nhập nhiều giáo viên cùng lúc"
          >
            <Download className="w-4 h-4 text-[#00A86B]" />
            <span>Tải Mẫu Excel</span>
          </button>
          {onOpenAddTeacher && (
            <button
              type="button"
              onClick={onOpenAddTeacher}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0B486B] to-[#0072B5] hover:from-[#083652] hover:to-[#005a91] text-white py-2.5 px-4 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Giáo Viên Mới</span>
            </button>
          )}
        </div>
      </div>

      {uniqueTeachers.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-[#F39C12] mb-2">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Chưa có thông tin giáo viên</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Tất cả giáo viên được tạo sẽ tự động khởi tạo tài khoản đăng nhập hệ thống và lưu lên Firestore.
          </p>
          {onOpenAddTeacher && (
            <button
              type="button"
              onClick={onOpenAddTeacher}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white px-4 py-2 text-xs font-bold transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm giáo viên đầu tiên</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {uniqueTeachers.map((tc, idx) => {
            if (!tc) return null;
            const code = tc?.teacherCode || `GV-0${idx + 1}`;
            const username = tc?.username || (tc?.phone ? `gv_${tc.phone.replace(/[^0-9]/g, '')}` : `gv_${tc?.id?.replace('teacher-', '') || idx}`);

            return (
              <div
                key={tc?.id || idx}
                className="rounded-3xl border-2 border-slate-200/80 bg-white p-5 shadow-xs hover:border-[#00A86B] hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <AccountAvatar
                        name={tc?.name || 'Giáo viên'}
                        role="teacher"
                        size="xl"
                        shape="rounded"
                        className="ring-2 ring-emerald-300 shadow-xs shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-[#B7791F] bg-amber-50 px-2 py-0.5 rounded-md font-mono text-[10px] border border-amber-200">
                            {code}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">@{username}</span>
                        </div>
                        <h3 className="text-sm font-black text-slate-800 mt-0.5">{tc?.name || 'Giáo viên'}</h3>
                        <p className="text-xs text-[#00A86B] font-bold">{tc?.subject || 'Bộ môn'}</p>
                      </div>
                    </div>

                    {/* Actions: Edit & Delete */}
                    <div className="flex items-center gap-1">
                      {onEditTeacher && (
                        <button
                          type="button"
                          onClick={() => onEditTeacher(tc)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#0072B5] hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Chỉnh sửa giáo viên"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      {onDeleteTeacher && (
                        <button
                          type="button"
                          onClick={() => setDeletingTeacher(tc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Xóa giáo viên"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    {(() => {
                      const classList = Array.isArray(tc?.assignedClassNames) && tc.assignedClassNames.length > 0
                        ? tc.assignedClassNames
                        : tc?.mainClassName
                        ? tc.mainClassName.split(',').map((s: string) => s.trim())
                        : [];
                      if (classList.length === 0) {
                        return (
                          <span className="inline-block text-[11px] font-semibold text-slate-400 italic bg-slate-100 px-2.5 py-0.5 rounded-lg">
                            Chưa phân lớp
                          </span>
                        );
                      }
                      return (
                        <div className="flex flex-wrap gap-1 items-center">
                          <span className="text-[11px] font-bold text-slate-500 mr-1">Lớp:</span>
                          {classList.map((cName: string, cIdx: number) => (
                            <span key={cIdx} className="inline-block text-[11px] font-bold text-[#0072B5] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                              {cName}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  <p className="mt-3 text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    &ldquo;{tc?.bio || 'Giáo viên giàu kinh nghiệm, tận tụy với học sinh.'}&rdquo;
                  </p>

                  <div className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#0072B5]" />
                      <span className="font-semibold text-slate-700">{tc?.phone || 'Chưa có SĐT'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[#0072B5]" />
                      <span className="truncate">{tc?.email || `${username}@tthocgioi.edu.vn`}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                    <Award className="w-3.5 h-3.5" /> Chuẩn sư phạm
                  </span>
                  {onEditTeacher && (
                    <button
                      type="button"
                      onClick={() => onEditTeacher(tc)}
                      className="text-xs font-bold text-[#0072B5] hover:underline cursor-pointer"
                    >
                      Chỉnh sửa &rarr;
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deletingTeacher && (
        <ConfirmDeleteModal
          isOpen={!!deletingTeacher}
          itemName={deletingTeacher.name || deletingTeacher.fullName || 'Giáo viên'}
          itemType="giáo viên"
          itemCode={deletingTeacher.teacherCode}
          itemSubInfo={`Môn: ${deletingTeacher.subject || 'Chưa rõ'} • Tên đăng nhập: @${deletingTeacher.username} • SĐT: ${deletingTeacher.phone || 'Chưa cập nhật'}`}
          isDeleting={isDeleting}
          onConfirm={handleConfirmDeleteTeacher}
          onClose={() => setDeletingTeacher(null)}
        />
      )}
    </div>
  );
};
