import React, { useState } from 'react';
import { Settings, Save, School, Shield, Bell, CheckCircle2 } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [centerName, setCenterName] = useState('Trung Tâm Dạy Thêm Học Giỏi');
  const [address, setAddress] = useState('Số 124 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh');
  const [phone, setPhone] = useState('0912.345.678');
  const [email, setEmail] = useState('hotro@hocgioi.edu.vn');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <h1 className="text-xl font-black text-[#0B486B]">Cài Đặt &amp; Thông Tin Trung Tâm</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Cấu hình thông tin thương hiệu, địa chỉ, phương thức liên lạc và quy định điểm danh
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Tên trung tâm</label>
            <input
              type="text"
              value={centerName}
              onChange={(e) => setCenterName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-[#0072B5] focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Số điện thoại / Hotline Zalo</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-[#0072B5] focus:outline-hidden"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Địa chỉ trụ sở chính</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Hòm thư điện tử (Email)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-[#0072B5] focus:outline-hidden"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          {saved ? (
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Đã lưu thông tin thành công!
            </span>
          ) : <span />}

          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white px-5 py-2.5 text-xs font-bold transition-all shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>Lưu Thay Đổi</span>
          </button>
        </div>
      </form>
    </div>
  );
};
