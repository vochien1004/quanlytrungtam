import React, { useState, useEffect, useRef } from 'react';
import { X, Users, Plus, Loader2, AlertCircle, KeyRound, Building2, ChevronDown, Check, BookOpen, Layers, CheckSquare, Square, Search } from 'lucide-react';
import { TeacherItem, ClassItem } from '../data/mockData';
import { CenterItem, normalizeUsername, generateCenterEmailDomain, sanitizeEmail } from '../services/firebaseService';

interface TeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassItem[];
  centers?: CenterItem[];
  activeCenterId?: string;
  onAddTeacher: (teacher: Omit<TeacherItem, 'id'> & { centerId: string }) => Promise<any> | void;
}

export const TeacherModal: React.FC<TeacherModalProps> = ({
  isOpen,
  onClose,
  classes,
  centers = [],
  activeCenterId = '',
  onAddTeacher,
}) => {
  const [centerId, setCenterId] = useState<string>(activeCenterId || (centers[0]?.id || ''));
  const [teacherCode, setTeacherCode] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123');
  const [subject, setSubject] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [classSearchTerm, setClassSearchTerm] = useState('');
  const classDropdownRef = useRef<HTMLDivElement>(null);
  const [bio, setBio] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentCenter = centers.find((c) => c.id === (centerId || activeCenterId)) || centers[0];
  const centerDomain = generateCenterEmailDomain(currentCenter?.name || currentCenter?.code || activeCenterId);

  useEffect(() => {
    if (activeCenterId) {
      setCenterId(activeCenterId);
    } else if (centers.length > 0 && !centerId) {
      setCenterId(centers[0].id);
    }
  }, [activeCenterId, centers]);

  // Auto-generate suggested teacherCode & username based on name/phone
  useEffect(() => {
    if (name.trim()) {
      const cleanName = normalizeUsername(name);
      const suggestedUser = `gv_${cleanName.slice(-10)}`;
      if (!username || username.startsWith('gv_')) {
        setUsername(suggestedUser);
      }
    }
  }, [name]);

  // Tự động thêm đuôi dạng username@tên_trung_tâm.com vào Email
  useEffect(() => {
    const cleanUser = normalizeUsername(username);
    if (cleanUser) {
      const autoEmail = `${cleanUser}@${centerDomain}`;
      // Chỉ tự động điền nếu email rỗng hoặc đang theo đuôi domain của hệ thống
      if (!email || email.includes('@') && email.endsWith('.com')) {
        setEmail(autoEmail);
      }
    }
  }, [username, centerDomain]);

  // Close class dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(event.target as Node)) {
        setIsClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSelectClass = (classId: string) => {
    setSelectedClassIds((prev) => {
      const exists = prev.includes(classId);
      const next = exists ? prev.filter((id) => id !== classId) : [...prev, classId];
      // Tự động gợi ý môn giảng dạy nếu chưa nhập
      if (!subject && next.length > 0) {
        const uniqueSubjects = Array.from(
          new Set(next.map((cId) => classes.find((c) => c.id === cId)?.subject).filter(Boolean))
        );
        if (uniqueSubjects.length > 0) {
          setSubject(uniqueSubjects.join(', '));
        }
      }
      return next;
    });
  };

  const handleSelectAllClasses = () => {
    const allIds = classes.map((c) => c.id);
    setSelectedClassIds(allIds);
    if (!subject) {
      const uniqueSubjects = Array.from(new Set(classes.map((c) => c.subject).filter(Boolean)));
      if (uniqueSubjects.length > 0) setSubject(uniqueSubjects.join(', '));
    }
  };

  const handleClearAllClasses = () => {
    setSelectedClassIds([]);
  };

  const filteredDropdownClasses = classes.filter((c) => {
    if (!classSearchTerm.trim()) return true;
    const s = classSearchTerm.toLowerCase().trim();
    return (
      (c.name || '').toLowerCase().includes(s) ||
      (c.subject || '').toLowerCase().includes(s) ||
      (c.classCode || '').toLowerCase().includes(s)
    );
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const finalCenterId = centerId.trim() || activeCenterId.trim() || (centers[0]?.id || '').trim() || 'center_01';

    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập Họ và tên giáo viên.');
      setIsSubmitting(false);
      return;
    }

    const cleanUsername = normalizeUsername(username);
    if (!cleanUsername) {
      setErrorMsg('Tên đăng nhập (username) là BẮT BUỘC và phải viết liền không dấu!');
      setIsSubmitting(false);
      return;
    }

    try {
      const selectedClasses = classes.filter((c) => selectedClassIds.includes(c.id));
      const assignedClassNames = selectedClasses.map((c) => c.name);
      const assignedSubjects = Array.from(new Set(selectedClasses.map((c) => c.subject).filter(Boolean))) as string[];
      const primaryClassId = selectedClassIds[0] || '';
      const primaryClassName = assignedClassNames.join(', ') || '';

      const cleanPassword = password.trim() || '123';
      const cleanCode = teacherCode.trim() || `GV-${Date.now().toString().slice(-3)}`;
      const cleanEmail = sanitizeEmail(email, cleanUsername, centerDomain);

      await onAddTeacher({
        centerId: finalCenterId,
        teacherCode: cleanCode,
        name: name.trim(),
        username: cleanUsername,
        password: cleanPassword,
        subject: subject.trim() || (assignedSubjects.length > 0 ? assignedSubjects.join(', ') : 'Giáo viên bộ môn'),
        phone: phone.trim(),
        email: cleanEmail,
        mainClassId: primaryClassId,
        mainClassName: primaryClassName,
        assignedClassIds: selectedClassIds,
        assignedClassNames: assignedClassNames,
        assignedSubjects: assignedSubjects,
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
        bio: bio.trim() || 'Giáo viên tận tâm, vững chuyên môn nghiệp vụ sư phạm.',
      });

      // Reset form
      setTeacherCode('');
      setName('');
      setUsername('');
      setPassword('123');
      setSubject('');
      setPhone('');
      setEmail('');
      setSelectedClassIds([]);
      setClassSearchTerm('');
      setIsClassDropdownOpen(false);
      setBio('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu giáo viên vào Firestore');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl bg-white p-4 sm:p-7 shadow-2xl animate-fade-in border border-slate-100 my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-[#F39C12]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">Thêm Giáo Viên Mới</h3>
              <p className="text-xs text-slate-500">Lưu vào Firestore &amp; tự động tạo tài khoản đăng nhập</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs font-semibold text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Section 1: Thông tin cơ bản */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mã Giáo Viên (Mã GV)</label>
              <input
                type="text"
                disabled={isSubmitting}
                value={teacherCode}
                onChange={(e) => setTeacherCode(e.target.value)}
                placeholder="VD: GV-04"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-[#0072B5] focus:outline-hidden"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Họ và tên Giáo viên *</label>
              <input
                type="text"
                required
                disabled={isSubmitting}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Cô Trần Thùy Dung"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-[#0072B5] focus:outline-hidden"
              />
            </div>
          </div>

          {/* Section 2: Tài khoản đăng nhập hệ thống */}
          <div className="rounded-2xl bg-amber-50/70 p-3.5 border border-amber-200/90 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <KeyRound className="w-3.5 h-3.5 text-amber-700" />
              <span>Thiết lập Tài khoản Đăng nhập Giáo viên (Lưu trên Firebase)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên đăng nhập (Username) *</label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="VD: gv_thuydung"
                  className="w-full rounded-xl border border-amber-300 bg-white p-2.5 text-xs font-mono font-bold focus:border-[#0072B5] focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mật khẩu (Password) *</label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="VD: 123"
                  className="w-full rounded-xl border border-amber-300 bg-white p-2.5 text-xs font-mono font-bold focus:border-[#0072B5] focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Chuyên môn & Lớp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Môn giảng dạy *</label>
              <input
                type="text"
                required
                disabled={isSubmitting}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="VD: Tiếng Anh THCS"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2" ref={classDropdownRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">
                  Lớp đảm nhận <span className="text-[10px] text-[#0072B5] font-normal">(1 giáo viên có thể đảm nhận nhiều lớp cùng lúc)</span>
                </label>
                {selectedClassIds.length > 0 && (
                  <span className="text-[11px] font-black text-[#0072B5] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    Đã chọn {selectedClassIds.length} lớp
                  </span>
                )}
              </div>

              {/* Trigger button mở dropdown xổ xuống */}
              <div
                onClick={() => !isSubmitting && setIsClassDropdownOpen((prev) => !prev)}
                className={`w-full min-h-[42px] rounded-xl border p-2 text-xs bg-white flex items-center justify-between gap-2 cursor-pointer transition-all ${
                  isClassDropdownOpen ? 'border-[#0072B5] ring-2 ring-blue-100 shadow-sm' : 'border-slate-300 hover:border-slate-400'
                }`}
              >
                <div className="flex-1 flex flex-wrap gap-1.5 items-center">
                  {selectedClassIds.length === 0 ? (
                    <span className="text-slate-400 font-medium pl-1">
                      -- Bấm vào đây để chọn các lớp đảm nhận (chọn nhiều môn/lớp khi xổ xuống) --
                    </span>
                  ) : (
                    selectedClassIds.map((cId) => {
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
                              toggleSelectClass(cId);
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

              {/* Menu xổ xuống (Dropdown list) */}
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
                          handleSelectAllClasses();
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[#0072B5] bg-blue-50 hover:bg-blue-100 border border-blue-200 cursor-pointer"
                      >
                        Chọn hết
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearAllClasses();
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer"
                      >
                        Bỏ chọn
                      </button>
                    </div>

                    {/* Danh sách lớp kèm môn học & trạng thái */}
                    {filteredDropdownClasses.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 italic">
                        {classes.length === 0
                          ? 'Chưa có lớp học nào trên hệ thống. Vui lòng tạo lớp mới trước.'
                          : 'Không tìm thấy lớp học nào khớp với từ khóa tìm kiếm.'}
                      </div>
                    ) : (
                      <div className="space-y-1 divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1">
                        {filteredDropdownClasses.map((c) => {
                          const isSelected = selectedClassIds.includes(c.id);
                          return (
                            <div
                              key={c.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectClass(c.id);
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
                                    {c.teacherName && c.teacherName !== 'Chưa phân công' && (
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
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Liên hệ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Số điện thoại liên hệ</label>
              <input
                type="text"
                disabled={isSubmitting}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0933.123.456"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Email <span className="text-[10px] text-[#0072B5] font-normal">(tự động @{centerDomain})</span>
              </label>
              <input
                type="email"
                disabled={isSubmitting}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`VD: ${username || 'gv_thaychien'}@${centerDomain}`}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
              />
            </div>
          </div>

          {/* Section 5: Giới thiệu */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Giới thiệu ngắn &amp; Trình độ</label>
            <textarea
              rows={2}
              disabled={isSubmitting}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="VD: Cử nhân Sư phạm loại Giỏi, 5 năm kinh nghiệm bồi dưỡng học sinh giỏi..."
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
            />
          </div>

          {/* Buttons */}
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
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0B486B] to-[#0072B5] hover:from-[#083652] hover:to-[#005a91] text-white px-5 py-2.5 font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu vào Firebase...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Lưu Giáo Viên (Firestore)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
