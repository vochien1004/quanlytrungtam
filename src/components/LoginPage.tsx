import React, { useState } from 'react';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Loader2, 
  Crown,
  ShieldCheck,
  X,
  HelpCircle
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  doc,
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut 
} from 'firebase/auth';
import { db, auth } from '../firebase/config';
import { BrandLogo } from './BrandLogo';
import { 
  setStoredSession,
  resetAccountPassword, 
  registerSchoolCenter, 
  UserAccount,
  loginUser
} from '../services/authService';

interface LoginPageProps {
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  // Tab Switcher state: 'login' vs 'request'
  const [authMode, setAuthMode] = useState<'login' | 'request'>('login');

  // Login Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Center Request Form State
  const [reqCenterName, setReqCenterName] = useState('');
  const [reqUsername, setReqUsername] = useState('');
  const [reqRealEmail, setReqRealEmail] = useState('');
  const [reqPhone, setReqPhone] = useState('');
  const [reqAddress, setReqAddress] = useState('');
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Forgot password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Handle Login Submit - Đăng nhập chỉ với Email hoặc Username + Mật khẩu (không cần Mã trung tâm)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const input = username.trim();
    const pass = password.trim();

    if (!input) {
      setErrorMessage('Vui lòng nhập Tài khoản (Email hoặc Username).');
      return;
    }
    if (!pass) {
      setErrorMessage('Vui lòng nhập Mật khẩu.');
      return;
    }

    setIsLoading(true);

    try {
      const authenticatedUser = await loginUser(input, pass);
      setStoredSession(authenticatedUser);
      onLoginSuccess(authenticatedUser);
    } catch (err: any) {
      console.warn('Lưu ý quy trình đăng nhập:', err?.message || err);
      let userFriendlyMsg = err?.message || 'Đã xảy ra lỗi không xác định trong quá trình đăng nhập.';
      if (userFriendlyMsg.includes('permission-denied') || userFriendlyMsg.includes('Missing or insufficient permissions')) {
        userFriendlyMsg = 'Tài khoản hoặc mật khẩu không chính xác, vui lòng kiểm tra lại!';
      }
      if (userFriendlyMsg.includes('auth/invalid-email') || userFriendlyMsg.includes('invalid-email')) {
        userFriendlyMsg = 'Tài khoản hoặc tên đăng nhập không hợp lệ, vui lòng kiểm tra lại!';
      }
      setErrorMessage(userFriendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = handleLogin;

  const [reqPassword, setReqPassword] = useState('');

  // Handle Register New Center Submit (Đăng ký tài khoản Trung tâm - Dùng thử 1 tháng)
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const usernameInput = reqUsername.trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, '');
    const realEmailInput = reqRealEmail.trim().toLowerCase();
    const passInput = reqPassword.trim();

    if (!reqCenterName.trim() || !usernameInput || !passInput || !reqPhone.trim()) {
      setErrorMessage('Vui lòng điền đầy đủ Tên trung tâm, Tên đăng nhập, Mật khẩu và Số điện thoại.');
      return;
    }

    if (passInput.length < 6) {
      setErrorMessage('Mật khẩu phải có tối thiểu 6 ký tự.');
      return;
    }

    setIsSubmittingReq(true);

    try {
      // Lấy username do người dùng nhập, tự động tạo fake email: `${username}@tenant.system.local`
      // Gọi createUserWithEmailAndPassword(auth, authEmail, password) và lưu `username`, `realEmail` vào Firestore
      await registerSchoolCenter({
        centerName: reqCenterName.trim(),
        username: usernameInput,
        realEmail: realEmailInput,
        password: passInput,
        phone: reqPhone.trim(),
        address: reqAddress.trim() || 'Hà Nội',
      });

      const trialDate = new Date();
      trialDate.setMonth(trialDate.getMonth() + 1);
      const expiryStr = trialDate.toLocaleDateString('vi-VN');

      setSuccessMessage(
        `✓ Đăng ký thành công! Trung tâm "${reqCenterName}" (Tên đăng nhập: ${usernameInput}) được cấp 1 THÁNG DÙNG THỬ MIỄN PHÍ (Hạn đến ngày ${expiryStr}). Vui lòng nhập mật khẩu vừa tạo để đăng nhập vào hệ thống!`
      );
      
      // Auto pre-fill username for login and switch tab to Login
      setUsername(usernameInput);
      setAuthMode('login');

      // Clear register form
      setReqCenterName('');
      setReqUsername('');
      setReqRealEmail('');
      setReqPassword('');
      setReqPhone('');
      setReqAddress('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi đăng ký tài khoản trung tâm.');
    } finally {
      setIsSubmittingReq(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotMessage(null);

    if (forgotStep === 1) {
      if (!forgotUsername.trim() && !forgotPhone.trim()) {
        setForgotError('Vui lòng nhập Tên đăng nhập hoặc Số điện thoại đã đăng ký.');
        return;
      }
      setForgotStep(2);
      return;
    }

    if (forgotStep === 2) {
      if (!newPassword || newPassword.length < 3) {
        setForgotError('Mật khẩu mới phải có tối thiểu 3 ký tự.');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setForgotError('Mật khẩu xác nhận không khớp.');
        return;
      }

      setIsResetting(true);
      try {
        const target = forgotUsername.trim() || forgotPhone.trim();
        const res = await resetAccountPassword(target, newPassword);
        if (res.success) {
          setForgotStep(3);
          setForgotMessage('Mật khẩu mới đã được cập nhật thành công lên Firebase!');
        } else {
          setForgotError(res.message);
        }
      } catch (err: any) {
        setForgotError(err.message || 'Lỗi cập nhật mật khẩu.');
      } finally {
        setIsResetting(false);
      }
    }
  };

  const closeForgotModal = () => {
    setIsForgotModalOpen(false);
    setForgotStep(1);
    setForgotUsername('');
    setForgotPhone('');
    setNewPassword('');
    setConfirmNewPassword('');
    setForgotError(null);
    setForgotMessage(null);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-[#0B486B] to-slate-900 p-3 sm:p-6 lg:p-8 relative overflow-y-auto">
      {/* Ambient background glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#0072B5]/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#00A86B]/25 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 animate-fade-in my-3 sm:my-6">
        <div className="rounded-3xl bg-white/95 backdrop-blur-xl p-5 sm:p-8 shadow-2xl border border-white/40">
          {/* Logo & Header */}
          <div className="text-center mb-4 sm:mb-5">
            <div className="inline-flex justify-center mb-2.5 sm:mb-3">
              <BrandLogo size="lg" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              {authMode === 'login' ? 'Đăng Nhập Trung Tâm' : 'Đăng Ký Khởi Tạo Trung Tâm'}
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Hệ thống Quản lý Đa Trung Tâm Multi-Tenant Dữ Liệu Tách Biệt
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 mb-5 font-bold text-xs shadow-inner">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2.5 rounded-xl transition-all cursor-pointer text-center ${
                authMode === 'login'
                  ? 'bg-white text-[#0B486B] shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Đăng Nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('request');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2.5 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                authMode === 'request'
                  ? 'bg-[#0072B5] text-white shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Đăng Ký Trung Tâm</span>
            </button>
          </div>

          {/* Alert Messages */}
          {errorMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-semibold">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-extrabold">{successMessage}</div>
            </div>
          )}

          {/* FORM 1: LOGIN FORM */}
          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tài khoản (Email hoặc Username) *
                </label>
                <div className="relative rounded-xl shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="VD: admin@tthocgioi.edu.vn hoặc gv_hoangnam"
                    required
                    autoFocus
                    className="block w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-900 text-sm font-medium focus:bg-white focus:border-[#0072B5] focus:ring-2 focus:ring-[#0072B5]/20 transition-all"
                  />
                </div>
              </div>



              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider">
                    Mật khẩu
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotUsername(username);
                      setIsForgotModalOpen(true);
                    }}
                    className="font-bold text-[#0072B5] hover:text-[#0B486B] hover:underline"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative rounded-xl shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    required
                    className="block w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-900 text-sm font-medium focus:bg-white focus:border-[#0072B5] focus:ring-2 focus:ring-[#0072B5]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0072B5] to-[#0B486B] hover:from-[#0B486B] hover:to-[#083652] text-white py-3 px-4 font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Đăng Nhập</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* FORM 2: REGISTER NEW CENTER FORM (1 MONTH FREE TRIAL) */
            <form onSubmit={handleRequestSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tên Trung Tâm / Cơ Sở *
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={reqCenterName}
                    onChange={(e) => setReqCenterName(e.target.value)}
                    placeholder="VD: Trung Tâm Bồi Dưỡng Văn Hóa Trí Đức"
                    className="block w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-900 font-bold focus:bg-white focus:border-[#0072B5]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tên Đăng Nhập *
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={reqUsername}
                    onChange={(e) => setReqUsername(e.target.value)}
                    placeholder="VD: hocgioi hoặc admin_triduc"
                    className="block w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-900 font-semibold focus:bg-white focus:border-[#0072B5]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Liên Hệ (Tùy Chọn)
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={reqRealEmail}
                    onChange={(e) => setReqRealEmail(e.target.value)}
                    placeholder="VD: lienhe@trungtam.edu.vn (Không bắt buộc)"
                    className="block w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-900 font-semibold focus:bg-white focus:border-[#0072B5]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mật Khẩu Đăng Nhập (Tối thiểu 6 ký tự) *
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={reqPassword}
                    onChange={(e) => setReqPassword(e.target.value)}
                    placeholder="Nhập mật khẩu an toàn..."
                    className="block w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-900 font-semibold focus:bg-white focus:border-[#0072B5]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Số Điện Thoại *
                  </label>
                  <input
                    type="text"
                    required
                    value={reqPhone}
                    onChange={(e) => setReqPhone(e.target.value)}
                    placeholder="0988.123.456"
                    className="block w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Địa Chỉ
                  </label>
                  <input
                    type="text"
                    value={reqAddress}
                    onChange={(e) => setReqAddress(e.target.value)}
                    placeholder="Hà Nội"
                    className="block w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-900 font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingReq}
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00A86B] to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white py-3 px-4 font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSubmittingReq ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Building2 className="w-4 h-4" />
                    <span>Đăng Ký &amp; Nhận 1 Tháng Dùng Thử</span>
                  </>
                )}
              </button>
            </form>
          )}

          
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-[#0B486B] flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#0072B5]" />
                <span>Khôi Phục Mật Khẩu</span>
              </h3>
              <button
                type="button"
                onClick={closeForgotModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="mt-4 space-y-3.5">
              {forgotError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                  {forgotError}
                </div>
              )}

              {forgotMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                  {forgotMessage}
                </div>
              )}

              {forgotStep === 1 && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tên đăng nhập hoặc Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={forgotUsername}
                    onChange={(e) => setForgotUsername(e.target.value)}
                    placeholder="VD: center01_admin hoặc 0912.345.678"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800"
                  />
                </div>
              )}

              {forgotStep === 2 && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Mật khẩu mới
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mật khẩu mới..."
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Xác nhận mật khẩu mới
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu..."
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeForgotModal}
                  className="rounded-xl px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Đóng
                </button>
                {forgotStep < 3 && (
                  <button
                    type="submit"
                    disabled={isResetting}
                    className="rounded-xl bg-[#0072B5] hover:bg-[#0B486B] text-white px-4 py-2 font-bold cursor-pointer"
                  >
                    {forgotStep === 1 ? 'Tiếp theo' : 'Cập Nhật Mật Khẩu'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
