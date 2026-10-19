import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  showSubtitle = true,
}) => {
  const iconSize = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10';
  const titleSize = size === 'sm' ? 'text-[9px]' : size === 'lg' ? 'text-xs' : 'text-[10px]';
  const brandNameSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Stylized Logo Emblem: Open book + energetic jumping students */}
      <div className={`relative flex items-center justify-center rounded-xl bg-white shadow-xs p-1 border border-slate-100 ${iconSize}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Decorative halo */}
          <circle cx="50" cy="50" r="48" fill="#F8FAFC" />
          
          {/* Open Book Pages */}
          <path d="M15 76C25 74 38 72 50 75C62 72 75 74 85 76C87 63 85 48 83 40C73 38 61 36 50 40C39 36 27 38 17 40C15 48 13 63 15 76Z" fill="#00A86B" />
          <path d="M15 78C25 76 38 74 50 77C62 74 75 76 85 78" stroke="#0072B5" strokeWidth="3" strokeLinecap="round" />
          <path d="M18 82C27 80 39 78 50 81C61 78 73 80 82 82" stroke="#E74C3C" strokeWidth="2.5" strokeLinecap="round" />
          
          {/* Inner Book Page glow */}
          <path d="M50 42C60 38 72 40 81 42V73C71 71 60 69 50 72V42Z" fill="#059669" />
          <path d="M50 42C40 38 28 40 19 42V73C29 71 40 69 50 72V42Z" fill="#10B981" />

          {/* Golden Yellow Student figure */}
          <circle cx="34" cy="30" r="6" fill="#F39C12" />
          <path d="M22 46C24 40 28 36 34 36C40 36 44 40 46 46C38 48 30 48 22 46Z" fill="#F39C12" />
          <path d="M20 34C24 38 28 41 33 40" stroke="#F39C12" strokeWidth="3.5" strokeLinecap="round" />

          {/* Joyful Red Student figure in the center */}
          <circle cx="58" cy="22" r="7" fill="#E74C3C" />
          <path d="M44 42C48 33 53 29 60 29C67 29 72 33 76 42C67 43 55 43 44 42Z" fill="#E74C3C" />
          <path d="M42 22C48 28 54 32 58 31" stroke="#E74C3C" strokeWidth="4" strokeLinecap="round" />
          <path d="M78 20C73 26 66 31 60 31" stroke="#E74C3C" strokeWidth="4" strokeLinecap="round" />

          {/* Yellow swoosh / knowledge arch */}
          <path d="M42 22C56 16 74 21 86 31" stroke="#F39C12" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>

      {/* Brand Text */}
      <div className="flex flex-col">
        <span className={`font-black tracking-wider text-slate-500 uppercase leading-tight ${titleSize}`}>
          HỆ THỐNG QUẢN LÝ
        </span>
        <div className={`font-black tracking-tight flex items-baseline leading-none mt-0.5 ${brandNameSize}`}>
          <span style={{ color: '#0072B5' }}>T</span>
          <span style={{ color: '#00A86B' }}>R</span>
          <span style={{ color: '#F39C12' }}>U</span>
          <span style={{ color: '#E74C3C' }}>N</span>
          <span style={{ color: '#0072B5' }}>G</span>
          <span className="mx-1"></span>
          <span style={{ color: '#00A86B' }}>T</span>
          <span style={{ color: '#F39C12' }}>Â</span>
          <span style={{ color: '#E74C3C' }}>M</span>
        </div>
        {showSubtitle && (
          <span className="text-[10px] text-slate-500 font-medium tracking-tight mt-0.5">
            Quản lý Lớp học, Điểm danh &amp; Sổ liên lạc
          </span>
        )}
      </div>
    </div>
  );
};
