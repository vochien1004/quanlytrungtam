import React, { useState } from 'react';
import { X, School, Plus, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { ClassItem, TeacherItem } from '../data/mockData';

interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: TeacherItem[];
  onSaveClass: (newClass: Omit<ClassItem, 'id'>) => Promise<any> | void;
}

export const ClassModal: React.FC<ClassModalProps> = ({
  isOpen,
  onClose,
  teachers,
  onSaveClass,
}) => {
  const [classCode, setClassCode] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || 'teacher-1');
  const [room, setRoom] = useState('');
  const [schedule, setSchedule] = useState('');
  const [maxCapacity, setMaxCapacity] = useState(25);
  const [pricePerSession, setPricePerSession] = useState<number>(40000);
  const [status, setStatus] = useState<'active' | 'pending' | 'paused'>('active');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const teacher = teachers.find((t) => t.id === teacherId);
      await onSaveClass({
        classCode: classCode.trim() || `LH-${name.slice(0, 3).toUpperCase()}`,
        name: name.trim(),
        subject: subject.trim(),
        teacherId: teacher ? teacher.id : '',
        teacherName: teacher ? teacher.name : 'Chưa phân công',
        room: room.trim() || 'Phòng 201 (Tầng 2)',
        schedule: schedule.trim() || 'Thứ 2 - Thứ 4 - Thứ 6 (18:00 - 20:00)',
        studentCount: 0,
        maxCapacity: Number(maxCapacity) || 25,
        pricePerSession: Number(pricePerSession) || 40000,
        status: status,
      });

      // Reset form on success
      setClassCode('');
      setName('');
      setSubject('');
      setRoom('');
      setSchedule('');
      setPricePerSession(40000);
      setStatus('active');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu lớp học lên Firebase');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-2xl animate-fade-in border border-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-[#0072B5]">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Thêm Lớp Học Mới</h3>
              <p className="text-xs text-slate-500">Lưu trực tiếp vào Firestore collection &lsquo;classes&rsquo;</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mã lớp học</label>
              <input
                type="text"
                disabled={isSubmitting}
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                placeholder="VD: LOP-6A, LOP-8B"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Trạng thái</label>
              <select
                disabled={isSubmitting}
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
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
              disabled={isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Lớp 8A - Toán Nâng Cao"
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Môn học *</label>
              <input
                type="text"
                required
                disabled={isSubmitting}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="VD: Toán học"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Giáo viên phụ trách</label>
              <select
                disabled={isSubmitting}
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.subject || 'Giáo viên'})
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
                disabled={isSubmitting}
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="VD: Phòng 204 (Tầng 2)"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Sĩ số tối đa</label>
              <input
                type="number"
                min="5"
                max="60"
                disabled={isSubmitting}
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
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
                  disabled={isSubmitting}
                  value={pricePerSession}
                  onChange={(e) => setPricePerSession(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  placeholder="40000"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-emerald-700 focus:border-emerald-500 focus:outline-hidden"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">đ</span>
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Quy đổi hiển thị</label>
              <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs font-extrabold text-emerald-800 flex items-center justify-between">
                <span>{(pricePerSession || 0).toLocaleString('vi-VN')}</span>
                <span className="text-[10px] font-semibold text-emerald-600">VNĐ / buổi</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Lịch học / Thời khóa biểu</label>
            <input
              type="text"
              disabled={isSubmitting}
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="VD: Thứ 3 - Thứ 5 - Thứ 7 (18:00 - 20:00)"
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
            />
          </div>

          <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-xl px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white px-5 py-2 font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu vào Firestore...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Lưu Lớp Học (Firestore)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
