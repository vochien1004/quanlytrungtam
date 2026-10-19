import React, { useState } from 'react';
import { 
  Paperclip, 
  Trash2, 
  Check, 
  ChevronDown, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileCheck2,
  Sparkles,
  Loader2
} from 'lucide-react';
import { StudentItem, ClassItem, TeacherItem, AttendanceStatus } from '../data/mockData';
import { AccountAvatar } from './common/AccountAvatar';

interface TeacherSystemCardProps {
  students: StudentItem[];
  classes: ClassItem[];
  teacher: TeacherItem;
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  onUpdateAttendance: (studentId: string, status: AttendanceStatus) => void;
  onSaveDailyNote: (note: string) => void;
}

export const TeacherSystemCard: React.FC<TeacherSystemCardProps> = ({
  students,
  classes,
  teacher,
  selectedClassId,
  onSelectClassId,
  onUpdateAttendance,
  onSaveDailyNote,
}) => {
  const [dailyNote, setDailyNote] = useState('Hôm nay cả lớp học tốt, hiểu bài phương trình bậc nhất. Nhắc các em hoàn thành bài tập số 3 và 4.');
  const [attachedFile, setAttachedFile] = useState<string | null>('Phieu_Bai_Tap_On_Tap_Tuan_4.pdf');
  const [showSavedToast, setShowSavedToast] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const currentClass = classes.find(c => c.id === selectedClassId) || classes[0];
  
  // Filter students or show all with current class highlighted
  const displayStudents = students;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveDailyNote(dailyNote);
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
    } catch (err) {
      console.error('Lỗi lưu điểm danh:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-[#00A86B] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-[#00A86B]"></span>
            Có mặt
          </span>
        );
      case 'excused':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-[#F39C12] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-[#F39C12]"></span>
            Có phép
          </span>
        );
      case 'unexcused':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-[#E74C3C] bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-[#E74C3C]"></span>
            Không phép
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border-2 border-sky-300/80 bg-white p-5 shadow-xs transition-all hover:shadow-md flex flex-col justify-between">
      <div>
        {/* Top Header: Teacher Profile & Stylized "LỚP HỌC HÔM NAY" Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Teacher Profile */}
          <div className="flex items-center gap-3">
            <AccountAvatar
              name={teacher?.name || 'Giáo viên'}
              role="teacher"
              size="lg"
              className="ring-2 ring-sky-300 shadow-xs"
            />
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 leading-tight">
                {teacher?.name || 'Giáo viên phụ trách'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {teacher?.subject || 'Bộ môn Văn hóa'} &bull; {teacher?.mainClassName ? `Chủ nhiệm ${teacher.mainClassName}` : 'Chưa phân công lớp'}
              </p>
            </div>
          </div>

          {/* Stylized colorful Title matching the screenshot */}
          <div className="text-right">
            <div className="text-lg font-black tracking-tight flex items-baseline justify-end leading-none">
              <span style={{ color: '#0072B5' }}>L</span>
              <span style={{ color: '#E74C3C' }}>Ớ</span>
              <span style={{ color: '#00A86B' }}>P</span>
              <span className="mx-1"></span>
              <span style={{ color: '#F39C12' }}>H</span>
              <span style={{ color: '#E74C3C' }}>Ọ</span>
              <span style={{ color: '#0072B5' }}>C</span>
              <span className="mx-1.5"></span>
              <span style={{ color: '#0072B5' }}>H</span>
              <span style={{ color: '#E74C3C' }}>Ô</span>
              <span style={{ color: '#00A86B' }}>M</span>
              <span className="mx-1"></span>
              <span style={{ color: '#F39C12' }}>N</span>
              <span style={{ color: '#E74C3C' }}>A</span>
              <span style={{ color: '#0072B5' }}>Y</span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              {currentClass?.schedule ? currentClass.schedule.split('(')[0] : 'Lịch học linh hoạt'}
            </span>
          </div>
        </div>

        {/* Section title & Class Selector */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-[#00A86B]" />
              Điểm Danh &amp; Nhận Xét
            </h4>
          </div>

          {/* Class Select Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Lớp học:</span>
            <div className="relative">
              <select
                value={selectedClassId}
                onChange={(e) => onSelectClassId(e.target.value)}
                className="appearance-none rounded-xl border border-slate-300 bg-slate-50 py-1.5 pl-3 pr-8 text-xs font-bold text-slate-800 shadow-2xs hover:border-[#0072B5] focus:outline-hidden focus:ring-2 focus:ring-blue-100"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-2.5 flex items-center justify-start gap-4 rounded-lg bg-slate-50/80 p-2 text-[11px] font-medium text-slate-600 border border-slate-100">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00A86B]"></span>
            <strong>Xanh</strong> - Có mặt
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F39C12]"></span>
            <strong>Cam</strong> - Vắng có phép
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E74C3C]"></span>
            <strong>Đỏ</strong> - Vắng không phép
          </span>
        </div>

        {/* Student Attendance List */}
        <div className="mt-3 divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1">
          {displayStudents.map((st) => (
            <div
              key={st.id}
              className={`flex items-center justify-between py-2 px-2 rounded-lg transition-colors ${
                st.classId === selectedClassId ? 'bg-sky-50/40 hover:bg-sky-50/80' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AccountAvatar
                  name={st.name}
                  role="student"
                  size="xs"
                  className="ring-1 ring-slate-200"
                />
                <div>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>{st.name}</span>
                    {st.classId === selectedClassId && (
                      <span className="text-[10px] text-blue-600 bg-blue-100 px-1 rounded-sm">Lớp này</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500">{st.className}</div>
                </div>
              </div>

              {/* Status Selector Pills: Present (Green) / Excused (Orange) / Unexcused (Red) */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onUpdateAttendance(st.id, 'present')}
                  title="Điểm danh: Có mặt"
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    st.attendanceStatus === 'present'
                      ? 'bg-[#00A86B] text-white ring-2 ring-emerald-300 scale-110 shadow-xs'
                      : 'bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-700'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateAttendance(st.id, 'excused')}
                  title="Điểm danh: Vắng có phép"
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    st.attendanceStatus === 'excused'
                      ? 'bg-[#F39C12] text-white ring-2 ring-amber-300 scale-110 shadow-xs'
                      : 'bg-slate-100 text-slate-400 hover:bg-amber-100 hover:text-amber-700'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateAttendance(st.id, 'unexcused')}
                  title="Điểm danh: Vắng không phép"
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    st.attendanceStatus === 'unexcused'
                      ? 'bg-[#E74C3C] text-white ring-2 ring-rose-300 scale-110 shadow-xs'
                      : 'bg-slate-100 text-slate-400 hover:bg-rose-100 hover:text-rose-700'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Nhận Xét Hàng Ngày */}
        <div className="mt-3.5">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Nhận Xét Hàng Ngày:
          </label>
          <textarea
            rows={2}
            value={dailyNote}
            onChange={(e) => setDailyNote(e.target.value)}
            placeholder="Nhận xét hàng ngày, dặn dò..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50/50 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100 shadow-2xs"
          />
        </div>

        {/* Giao Bài Tập & File Attachments */}
        <div className="mt-3">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Giao Bài Tập:
          </label>
          <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600 truncate">
              <Paperclip className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="truncate font-medium text-slate-700">
                {attachedFile || 'Chưa đính kèm tài liệu'}
              </span>
            </div>

            {attachedFile ? (
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                className="text-slate-400 hover:text-rose-500 p-1"
                title="Xóa tệp đính kèm"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <label className="cursor-pointer text-[11px] font-bold text-[#0072B5] hover:underline">
                [+ Đính kèm]
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setAttachedFile(e.target.files[0].name);
                    }
                  }}
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">
          Đã điểm danh: <strong>{students.filter(s => s.attendanceStatus === 'present').length}/{students.length}</strong> học sinh
        </span>

        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="flex items-center gap-1.5 rounded-xl bg-[#00A86B] hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold transition-all shadow-xs disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Đang lưu Firestore...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Lưu Sổ &amp; Gửi Phụ Huynh</span>
            </>
          )}
        </button>
      </div>

      {showSavedToast && (
        <div className="mt-2 text-center text-xs font-bold text-emerald-700 bg-emerald-100 py-1 px-3 rounded-lg animate-fade-in">
          ✓ Đã lưu điểm danh &amp; gửi thông báo Zalo đến phụ huynh thành công!
        </div>
      )}
    </div>
  );
};
