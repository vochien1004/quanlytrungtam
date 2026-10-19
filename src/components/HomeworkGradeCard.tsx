import React, { useState } from 'react';
import { 
  MessageCircle, 
  Plus, 
  ChevronRight, 
  FileText,
  BookOpen,
  ClipboardList
} from 'lucide-react';
import { AssignmentItem, StudentItem } from '../data/mockData';
import { AccountAvatar } from './common/AccountAvatar';

interface HomeworkGradeCardProps {
  assignments?: AssignmentItem[];
  students?: StudentItem[];
  isLoading?: boolean;
  onOpenAssignmentDetail?: (assignment: AssignmentItem) => void;
  onAddNewAssignment?: () => void;
}

export const HomeworkGradeCard: React.FC<HomeworkGradeCardProps> = ({
  assignments = [],
  students = [],
  isLoading = false,
  onOpenAssignmentDetail,
  onAddNewAssignment,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('student-1');

  // Fallback student object if students array is empty
  const fallbackStudent: StudentItem = {
    id: 'default-student',
    name: 'Học sinh',
    classId: '',
    className: 'Chưa chọn lớp',
    avatar: '',
    attendanceStatus: 'present',
    note: '',
    parentName: 'Phụ huynh',
    parentPhone: '',
    gpa: 8.0,
    recentGrade: '8.0/10',
  };

  const selectedStudent = (students || []).find((s) => s?.id === selectedStudentId) || students[0] || fallbackStudent;

  const getAvatarUrl = (avatarUrl?: string | null, name?: string) => {
    if (avatarUrl && avatarUrl.trim() !== '') return avatarUrl;
    const displayName = name || 'Student';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0072B5&color=fff&bold=true`;
  };

  const getStatusBadge = (status?: AssignmentItem['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span 
            title="Đã nộp và hoàn thành"
            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#00A86B] border border-emerald-200"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#00A86B]"></span>
            Hoàn thành
          </span>
        );
      case 'grading':
        return (
          <span 
            title="Đã nộp - Đang chờ giáo viên chấm"
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-[#F39C12] border border-amber-200"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#F39C12]"></span>
            Chờ chấm
          </span>
        );
      case 'working':
        return (
          <span 
            title="Học sinh đang thực hiện"
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Đang làm
          </span>
        );
      case 'graded':
        return (
          <span 
            title="Đã chấm điểm chi tiết"
            className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#0072B5] border border-blue-200"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#0072B5]"></span>
            Đã chấm
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            Chưa nộp
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border-2 border-emerald-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md flex flex-col justify-between h-full min-h-[380px]">
      <div>
        {/* Title */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-base font-extrabold text-[#0B486B] tracking-tight flex items-center gap-2">
            <span className="w-2 h-5 rounded-full bg-[#00A86B]"></span>
            Quản Lý Bài Tập &amp; Chấm Điểm
          </h2>

          {onAddNewAssignment && (
            <button
              type="button"
              onClick={onAddNewAssignment}
              className="flex items-center gap-1 text-xs font-bold text-[#0072B5] hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm bài tập</span>
            </button>
          )}
        </div>

        {/* Student Selector Card */}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/80 p-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <AccountAvatar
              name={selectedStudent?.name || 'Học sinh'}
              role="student"
              size="sm"
              className="ring-2 ring-emerald-300 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 leading-tight truncate">
                {selectedStudent?.name || 'Học sinh'} {selectedStudent?.className ? `- ${selectedStudent.className}` : ''}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                GPA: <strong className="text-emerald-700">{selectedStudent?.gpa ?? '0.0'}</strong> &bull; Phụ huynh: {selectedStudent?.parentName || 'Chưa cập nhật'}
              </div>
            </div>
          </div>

          {(students || []).length > 0 && (
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:border-[#0072B5] focus:outline-hidden shrink-0 ml-2"
            >
              {(students || []).map((st) => (
                <option key={st?.id || Math.random()} value={st?.id}>
                  {st?.name || 'Học sinh'} ({st?.className ? st.className.split(' - ')[0] : 'Lớp'})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Content: Loading Skeleton OR Empty State OR Assignments Table */}
        {isLoading ? (
          <div className="mt-4 space-y-3 animate-pulse">
            <div className="h-8 bg-slate-100 rounded-lg w-full"></div>
            <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
            <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
          </div>
        ) : (assignments || []).length === 0 ? (
          /* Empty State */
          <div className="mt-6 flex flex-col items-center justify-center p-6 text-center rounded-xl bg-slate-50/80 border border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#00A86B] mb-2 shadow-2xs">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Chưa có bài tập nào được giao</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Bấm nút bên trên để tạo bài tập mới cho học sinh trên hệ thống.
            </p>
            {onAddNewAssignment && (
              <button
                type="button"
                onClick={onAddNewAssignment}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm bài tập ngay</span>
              </button>
            )}
          </div>
        ) : (
          /* Assignments Table */
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/60">
                  <th className="py-2 px-2.5 rounded-l-lg">Tên Bài Tập</th>
                  <th className="py-2 px-2">Hạn Nộp</th>
                  <th className="py-2 px-2 text-center">Trạng Thái</th>
                  <th className="py-2 px-2 text-right rounded-r-lg">Điểm Số</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(assignments || []).map((item) => (
                  <tr
                    key={item?.id || Math.random()}
                    onClick={() => onOpenAssignmentDetail && onOpenAssignmentDetail(item)}
                    className="cursor-pointer hover:bg-slate-50 transition-colors group"
                  >
                    <td className="py-2.5 px-2.5">
                      <div className="font-semibold text-slate-800 group-hover:text-[#0072B5] transition-colors flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0072B5]" />
                        <span className="line-clamp-1">{item?.title || 'Bài tập'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-slate-500 whitespace-nowrap text-[11px]">
                      {item?.dueDate || 'Chưa định'}
                    </td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      {getStatusBadge(item?.status)}
                    </td>
                    <td className="py-2.5 px-2 text-right whitespace-nowrap">
                      {item?.score !== undefined && item?.score !== null ? (
                        <span className="font-extrabold text-[#00A86B] text-xs">
                          {Number(item.score).toFixed(1)}/10
                        </span>
                      ) : (
                        <span className="text-slate-400 font-bold">-</span>
                      )}

                      {item?.comment && (
                        <button
                          type="button"
                          title={item.comment}
                          className="ml-1.5 text-slate-400 hover:text-[#0072B5] transition-colors inline-block"
                        >
                          <MessageCircle className="w-3.5 h-3.5 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>Tổng cộng: <strong>{(assignments || []).length}</strong> bài tập</span>
        {onOpenAssignmentDetail && (assignments || []).length > 0 && (
          <button
            type="button"
            onClick={() => onOpenAssignmentDetail(assignments[0])}
            className="text-xs font-bold text-[#0072B5] hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>Xem sổ điểm chi tiết</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
