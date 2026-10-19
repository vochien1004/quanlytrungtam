import React, { useState, useEffect } from 'react';
import { X, GraduationCap, Plus, Loader2, AlertCircle, KeyRound, UserCheck, ShieldCheck } from 'lucide-react';
import { ClassItem, StudentItem } from '../data/mockData';
import { CenterItem, normalizeUsername, generateCenterEmailDomain } from '../services/firebaseService';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassItem[];
  centers?: CenterItem[];
  activeCenterId?: string;
  onAddStudent: (student: Omit<StudentItem, 'id'> & { centerId?: string }) => Promise<any> | void;
}

export const StudentModal: React.FC<StudentModalProps> = ({
  isOpen,
  onClose,
  classes,
  centers = [],
  activeCenterId = '',
  onAddStudent,
}) => {
  const [studentCode, setStudentCode] = useState('');
  const [name, setName] = useState('');
  const [classId, setClassId] = useState(classes[0]?.id || 'class-6a');
  const [gender, setGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [dob, setDob] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123');
  const [gpa, setGpa] = useState<number>(8.5);
  const [recentGrade, setRecentGrade] = useState('8.5 / 10');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'active' | 'probation' | 'suspended'>('active');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (classes.length > 0 && (!classId || !classes.some((c) => c.id === classId))) {
      setClassId(classes[0].id);
    }
  }, [classes, isOpen]);

  const currentCenter = centers.find((c) => c.id === activeCenterId) || centers[0];
  const centerDomain = generateCenterEmailDomain(currentCenter?.name || currentCenter?.code || activeCenterId);

  if (!isOpen) return null;

  // Tự động gợi ý username và email phụ huynh khi nhập số điện thoại hoặc tên
  const handlePhoneChange = (val: string) => {
    setParentPhone(val);
    const clean = val.replace(/[^0-9]/g, '');
    if (clean) {
      const suggestedUser = `ph_${clean}`;
      if (!username || username.startsWith('ph_')) {
        setUsername(suggestedUser);
        if (!parentEmail || parentEmail.includes('@') && parentEmail.endsWith('.com')) {
          setParentEmail(`${suggestedUser}@${centerDomain}`);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const selClass = classes.find((c) => c.id === classId) || classes[0];
      const cleanPhone = parentPhone.replace(/[^0-9]/g, '');
      const rawUser = username.trim() || (cleanPhone ? `ph_${cleanPhone}` : `ph_${Date.now().toString().slice(-4)}`);
      const finalUsername = normalizeUsername(rawUser);
      const targetCenterId = (activeCenterId || (centers[0]?.id || '')).trim();

      await onAddStudent({
        centerId: targetCenterId,
        studentCode: studentCode.trim() || `HS-0${Math.floor(Math.random() * 90 + 10)}`,
        name: name.trim(),
        classId: selClass ? selClass.id : 'class-6a',
        className: selClass ? selClass.name : 'Lớp 6A - Toán',
        avatar:
          gender === 'Nữ'
            ? 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80'
            : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
        attendanceStatus: 'present',
        note: note.trim() || 'Học sinh mới đăng ký học.',
        parentName: parentName.trim() || `Phụ huynh em ${name.trim()}`,
        parentPhone: parentPhone.trim() || '0901.234.567',
        parentEmail: parentEmail.trim(),
        username: finalUsername,
        password: password.trim() || '123',
        gender: gender,
        dob: dob,
        gpa: Number(gpa) || 8.0,
        recentGrade: recentGrade.trim() || `${gpa} / 10`,
        status: status,
      });

      // Reset form
      setStudentCode('');
      setName('');
      setParentName('');
      setParentPhone('');
      setParentEmail('');
      setUsername('');
      setPassword('123');
      setNote('');
      setDob('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu học sinh vào Firestore');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl animate-fade-in border border-slate-100 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-[#0072B5]">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Thêm Mới Học Sinh</h3>
              <p className="text-xs text-slate-500">Lưu vào Firestore &lsquo;students&rsquo; và tạo tài khoản Phụ huynh</p>
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
          {/* 1. THÔNG TIN HỌC SINH */}
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70 space-y-3">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[#0072B5]" />
              1. Thông Tin Học Sinh
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mã học sinh</label>
                <input
                  type="text"
                  disabled={isSubmitting}
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  placeholder="VD: HS-01, HS-008"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Họ và tên học sinh *</label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Nguyễn Văn Bảo"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Lớp đăng ký *</label>
                <select
                  disabled={isSubmitting}
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Giới tính</label>
                <select
                  disabled={isSubmitting}
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
                >
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Điểm TB (GPA)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  disabled={isSubmitting}
                  value={gpa}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setGpa(v);
                    setRecentGrade(`${v} / 10`);
                  }}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* 2. THÔNG TIN PHỤ HUYNH & TÀI KHOẢN */}
          <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-200/60 space-y-3">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-[#0072B5]" />
              2. Thông Tin Phụ Huynh & Sổ Liên Lạc Điện Tử
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Họ tên Phụ huynh *</label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="VD: Nguyễn Văn Cường"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Số điện thoại / Zalo *</label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={parentPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="VD: 0912.345.678"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên đăng nhập PH</label>
                <input
                  type="text"
                  disabled={isSubmitting}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="VD: ph_0912345678"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mật khẩu PH</label>
                <input
                  type="text"
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mặc định: 123"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Email Phụ huynh <span className="text-[10px] text-[#0072B5] font-normal">(tự động @{centerDomain})</span>
              </label>
              <input
                type="email"
                disabled={isSubmitting}
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                placeholder={`VD: ${username || 'ph_0901234567'}@${centerDomain}`}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Ghi chú & Nhận xét học lực</label>
            <textarea
              rows={2}
              disabled={isSubmitting}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Học sinh nắm bài tốt, cần rèn luyện thêm phần bài tập nâng cao."
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
                  <span>Lưu Học Sinh (Firestore)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
