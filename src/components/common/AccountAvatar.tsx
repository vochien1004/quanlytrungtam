import React from 'react';

/**
 * Rút trích 2 chữ cái viết tắt từ họ tên tài khoản.
 * Ví dụ thực tế:
 * - "Cô Yên" => "CY"
 * - "Khang" => "KH"
 * - "Admin" => "AD"
 * - "Super Admin" => "SA"
 * - "Center Admin" => "CA"
 * - "Thầy Nam" => "TN"
 * - "Nguyễn Thị Hoa" => "NH"
 * - "Bạch Dương" => "BD"
 * - "Phụ huynh" => "PH"
 */
export function getAccountInitials(name?: string | null, fallbackRole?: string): string {
  if (!name || typeof name !== 'string') {
    if (fallbackRole) {
      const r = fallbackRole.toLowerCase().trim();
      if (r.includes('teacher') || r.includes('giao')) return 'GV';
      if (r.includes('super')) return 'SA';
      if (r.includes('admin')) return 'AD';
      if (r.includes('parent') || r.includes('phu')) return 'PH';
      if (r.includes('student') || r.includes('hoc')) return 'HS';
    }
    return 'ND';
  }

  // Loại bỏ các ký tự đặc biệt đầu chuỗi như @, #, gv_, v.v.
  const cleaned = name.replace(/^[@#_.\-]+/, '').trim();
  if (!cleaned) return 'ND';

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'ND';

  // Trường hợp tên chỉ có 1 từ duy nhất (Ví dụ: "Khang" => "KH", "Admin" => "AD")
  if (words.length === 1) {
    const single = words[0];
    if (single.length >= 2) {
      return (single[0] + single[1]).toUpperCase();
    }
    return (single[0] + single[0]).toUpperCase();
  }

  // Trường hợp tên có từ 2 từ trở lên:
  // Lấy chữ cái đầu của từ đầu tiên và chữ cái đầu của từ cuối cùng
  // Ví dụ:
  // - "Cô Yên" => C + Y = "CY"
  // - "Thầy Nam" => T + N = "TN"
  // - "Nguyễn Thị Hoa" => N + H = "NH"
  // - "Bạch Dương" => B + D = "BD"
  const firstWord = words[0];
  const lastWord = words[words.length - 1];
  const firstChar = firstWord ? firstWord[0] : '';
  const lastChar = lastWord ? lastWord[0] : '';

  return (firstChar + lastChar).toUpperCase();
}

export type AvatarRoleType = 'admin' | 'super_admin' | 'center_admin' | 'teacher' | 'student' | 'parent' | string;

export interface AccountAvatarProps {
  name?: string | null;
  role?: AvatarRoleType;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'rounded';
  className?: string;
  title?: string;
}

export const AccountAvatar: React.FC<AccountAvatarProps> = ({
  name,
  role,
  size = 'md',
  shape = 'circle',
  className = '',
  title,
}) => {
  const initials = getAccountInitials(name, role);
  const displayName = name || 'Tài khoản';

  // Xác định bảng màu tương ứng với vai trò tài khoản
  const getThemeStyles = () => {
    const r = (role || '').toLowerCase().trim();
    const n = (name || '').toLowerCase().trim();

    if (r === 'super_admin' || n.includes('super admin')) {
      return 'bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white border-amber-300/80 shadow-amber-200/50';
    }
    if (r === 'teacher' || r === 'teachers' || r === 'giaovien' || n.includes('cô') || n.includes('thầy') || n.includes('giáo viên')) {
      return 'bg-gradient-to-br from-[#00A86B] via-[#059669] to-[#047857] text-white border-emerald-300/80 shadow-emerald-200/50';
    }
    if (r === 'parent' || r === 'parents' || n.includes('phụ huynh') || n.includes('mẹ ') || n.includes('bố ')) {
      return 'bg-gradient-to-br from-[#F39C12] via-[#E67E22] to-[#D35400] text-white border-amber-300/80 shadow-orange-200/50';
    }
    if (r === 'student' || r === 'students' || n.includes('học sinh')) {
      return 'bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#1E40AF] text-white border-blue-300/80 shadow-blue-200/50';
    }
    if (r === 'admin' || r === 'center_admin' || n.includes('admin') || n.includes('trung tâm')) {
      return 'bg-gradient-to-br from-[#0072B5] via-[#0B486B] to-[#08334c] text-white border-sky-300/80 shadow-blue-200/50';
    }

    // Mặc định: Xanh dương chuẩn nhận diện thương hiệu
    return 'bg-gradient-to-br from-[#0072B5] via-[#0B486B] to-[#08334c] text-white border-sky-300/80 shadow-blue-200/50';
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'xs':
        return 'w-6 h-6 text-[10px] tracking-tight font-black';
      case 'sm':
        return 'w-8 h-8 text-xs tracking-tight font-black';
      case 'md':
        return 'w-9 h-9 text-xs tracking-tight font-black';
      case 'lg':
        return 'w-11 h-11 text-sm tracking-tight font-black';
      case 'xl':
        return 'w-14 h-14 text-base tracking-normal font-black';
      case '2xl':
        return 'w-20 h-20 text-2xl tracking-normal font-black';
      default:
        return 'w-9 h-9 text-xs tracking-tight font-black';
    }
  };

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  return (
    <div
      title={title || `${displayName} (${initials})`}
      className={`inline-flex items-center justify-center select-none shrink-0 border shadow-2xs font-sans uppercase transition-transform hover:scale-105 ${shapeClass} ${getSizeClasses()} ${getThemeStyles()} ${className}`}
    >
      <span className="leading-none drop-shadow-xs">{initials}</span>
    </div>
  );
};
