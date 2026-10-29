import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Copy,
  Check,
  CheckCircle2,
  Building2,
  User,
  GraduationCap,
  CalendarCheck,
  Loader2,
  X,
  ShieldCheck,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import QRCode from 'qrcode';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  ensureAuthSession,
  savePendingTuitionPaymentOrder,
  recordStudentTuitionPaymentSuccess,
  checkPayOSPaymentStatus,
  buildPayOSIframeListenerUrl,
  parsePayOSPostMessageEvent,
  normalizeTuitionMonthPair,
} from '../../services/firebaseService';

const PAYOS_CREATE_PAYMENT_ENDPOINT =
  'https://payos-hocphi-webhook.vochien1004.workers.dev/create-payment';

interface BankDeepLinkItem {
  id: string;
  appId: string;
  name: string;
  logo: string;
  scheme: string;
  autofill?: boolean;
}

const SUPPORTED_BANK_APPS: BankDeepLinkItem[] = [
  {
    id: 'MB',
    appId: 'mb',
    name: 'MBBank',
    logo: 'https://api.vietqr.io/img/MB.png',
    scheme: 'mbbank://',
    autofill: true,
  },
  {
    id: 'VCB',
    appId: 'vcb',
    name: 'Vietcombank',
    logo: 'https://api.vietqr.io/img/VCB.png',
    scheme: 'vietcombankmobile://',
    autofill: false,
  },
  {
    id: 'AGB',
    appId: 'vba',
    name: 'Agribank',
    logo: 'https://api.vietqr.io/img/VBA.png',
    scheme: 'agribankmobile://',
    autofill: false,
  },
  {
    id: 'TCB',
    appId: 'tcb',
    name: 'Techcombank',
    logo: 'https://api.vietqr.io/img/TCB.png',
    scheme: 'tcb://',
    autofill: false,
  },
  {
    id: 'BIDV',
    appId: 'bidv',
    name: 'BIDV',
    logo: 'https://api.vietqr.io/img/BIDV.png',
    scheme: 'bidv.smartbanking.partner://',
    autofill: true,
  },
  {
    id: 'VPB',
    appId: 'vpb',
    name: 'VPBank',
    logo: 'https://api.vietqr.io/img/VPB.png',
    scheme: 'vpbankneo://',
    autofill: false,
  },
  {
    id: 'TPB',
    appId: 'tpb',
    name: 'TPBank',
    logo: 'https://api.vietqr.io/img/TPB.png',
    scheme: 'hydro://',
    autofill: false,
  },
  {
    id: 'ICB',
    appId: 'icb',
    name: 'VietinBank',
    logo: 'https://api.vietqr.io/img/ICB.png',
    scheme: 'vietinbankipay://',
    autofill: true,
  },
];

const BIN_TO_VIETQR_BANK_CODE: Record<string, string> = {
  '970422': 'mb',
  '970436': 'vcb',
  '970405': 'vba',
  '970407': 'tcb',
  '970418': 'bidv',
  '970432': 'vpb',
  '970423': 'tpb',
  '970415': 'icb',
  '970416': 'acb',
  '970448': 'ocb',
  '970441': 'vib',
  '970443': 'shb',
  '970403': 'stb',
  '970426': 'msb',
  '970437': 'hdb',
};

function resolveVietQrBankCode(binOrBankId?: string, fallbackBankId?: string): string {
  const raw = String(binOrBankId || fallbackBankId || 'MB').trim().toUpperCase();
  if (BIN_TO_VIETQR_BANK_CODE[raw]) {
    return BIN_TO_VIETQR_BANK_CODE[raw];
  }
  const aliasMap: Record<string, string> = {
    MB: 'mb',
    MBBANK: 'mb',
    VCB: 'vcb',
    VIETCOMBANK: 'vcb',
    AGB: 'vba',
    VBA: 'vba',
    AGRIBANK: 'vba',
    TCB: 'tcb',
    TECHCOMBANK: 'tcb',
    BIDV: 'bidv',
    VPB: 'vpb',
    VPBANK: 'vpb',
    TPB: 'tpb',
    TPBANK: 'tpb',
    ICB: 'icb',
    CTG: 'icb',
    VIETINBANK: 'icb',
    ACB: 'acb',
    OCB: 'ocb',
    VIB: 'vib',
    SHB: 'shb',
    STB: 'stb',
    SACOMBANK: 'stb',
  };
  if (aliasMap[raw]) {
    return aliasMap[raw];
  }
  if (fallbackBankId) {
    const fb = String(fallbackBankId).trim().toUpperCase();
    if (BIN_TO_VIETQR_BANK_CODE[fb]) return BIN_TO_VIETQR_BANK_CODE[fb];
    if (aliasMap[fb]) return aliasMap[fb];
  }
  return raw.toLowerCase();
}

/**
 * Tạo đường dẫn Deep Link chuẩn VietQR / PayOS (`https://dl.vietqr.io/pay`)
 * giúp mở trực tiếp App Ngân hàng trên iOS & Android và tự động điền thông tin chuyển khoản (STK, Số tiền, Nội dung)
 */
function buildVietQrDeepLinkUrl(params: {
  appId: string;
  accountNo: string;
  bankCode: string;
  accountName: string;
  amount: number;
  memo: string;
}): string {
  const cleanAcc = String(params.accountNo || '').trim();
  const cleanBank = resolveVietQrBankCode(params.bankCode);
  const cleanName = String(params.accountName || '').trim();
  const cleanAmount = Math.max(0, Math.round(Number(params.amount) || 0));
  const cleanMemo = String(params.memo || '').trim();
  const redirectUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    `https://dl.vietqr.io/pay?app=${encodeURIComponent(params.appId.trim().toLowerCase())}` +
    `&ba=${encodeURIComponent(cleanAcc)}@${encodeURIComponent(cleanBank)}` +
    `&bn=${encodeURIComponent(cleanName)}` +
    `&am=${encodeURIComponent(String(cleanAmount))}` +
    `&tn=${encodeURIComponent(cleanMemo)}` +
    (redirectUrl ? `&redirect_url=${encodeURIComponent(redirectUrl)}` : '')
  );
}

function detectIsMobileOrTabletDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isMobileUa =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);
  const isIpadOs =
    navigator.platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
  const isSmallTouchViewport =
    window.innerWidth <= 1024 &&
    (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window || window.innerWidth < 768);

  return isMobileUa || isIpadOs || isSmallTouchViewport;
}

export interface TuitionPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  centerId: string;         // ID trung tâm
  centerName: string;       // Tên trung tâm
  studentId: string;        // ID học sinh trong trung tâm
  studentName: string;      // Tên học sinh
  classId?: string;         // ID lớp học
  className: string;        // Tên lớp học
  month: string;            // Tháng thu học phí (ví dụ: "10/2026")
  amount: number;           // Số tiền tính toán động
  attendedSessions: number; // Số buổi có mặt thực tế
  bankId?: string;          // Mã ngân hàng từ Thiết lập thanh toán của center_admin (mặc định MB)
  accountNo?: string;       // Số tài khoản từ Thiết lập thanh toán của center_admin (mặc định 09995879999)
  accountName?: string;     // Tên chủ tài khoản từ Thiết lập thanh toán của center_admin
  isAlreadyPaid?: boolean;  // Nếu học sinh đã thanh toán tháng này rồi
  existingOrderCode?: number;
  onPaymentSuccess?: (orderCode: number) => void; // Callback tải lại/đồng bộ trạng thái ở component cha
}

/**
 * Chuẩn hóa chuỗi tiếng Việt sang không dấu, loại bỏ ký tự đặc biệt và giới hạn tối đa 25 ký tự chuẩn payOS
 */
export function buildCleanPayOSDescription(
  month: string,
  studentName: string,
  className: string
): string {
  const removeVietnameseTones = (str: string) =>
    String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

  // Lấy số tháng (ví dụ "10/2026" hoặc "2026-10" -> "10")
  let monthToken = String(month || '').trim();
  if (monthToken.includes('/')) {
    monthToken = monthToken.split('/')[0];
  } else if (monthToken.includes('-')) {
    const parts = monthToken.split('-');
    monthToken = parts[0].length === 4 ? parts[1] : parts[0];
  }
  const cleanMonth = String(Number(monthToken) || monthToken).replace(/[^0-9]/g, '');

  const cleanStudent = removeVietnameseTones(studentName);
  const cleanClass = removeVietnameseTones(className).replace(/^LOP\s+/i, '');

  const rawDesc = `HP T${cleanMonth} ${cleanStudent} ${cleanClass}`
    .replace(/\s+/g, ' ')
    .trim();

  // Giới hạn tối đa 25 ký tự theo quy định của payOS
  return rawDesc.slice(0, 25).trim();
}

/**
 * Chuyển đổi giá trị qrCode từ payOS (chuỗi EMVCo hoặc URL ảnh) thành URL ảnh hiển thị được trên thẻ <img>
 */
async function resolveQrCodeToImageSrc(rawQrCode: string): Promise<string> {
  const trimmed = String(rawQrCode || '').trim();
  if (!trimmed) return '';

  // Nếu đã là Data URL hoặc đường dẫn ảnh HTTP/HTTPS trực tiếp
  if (trimmed.startsWith('data:image/') || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Nếu là chuỗi text VietQR chuẩn EMVCo (ví dụ: "00020101021238570010A000000727...")
  try {
    const dataUrl = await QRCode.toDataURL(trimmed, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0B486B',
        light: '#FFFFFF',
      },
    });
    return dataUrl;
  } catch {
    return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=10&data=${encodeURIComponent(
      trimmed
    )}`;
  }
}

export const TuitionPaymentModal: React.FC<TuitionPaymentModalProps> = ({
  isOpen,
  onClose,
  centerId,
  centerName,
  studentId,
  studentName,
  classId,
  className,
  month,
  amount,
  attendedSessions,
  bankId,
  accountNo,
  accountName,
  isAlreadyPaid = false,
  existingOrderCode,
  onPaymentSuccess,
}) => {
  // Giữ cố định mã orderCode trong suốt phiên mở Modal, tuyệt đối không bị sinh lại khi component cha re-render
  const activeOrderCodeRef = useRef<number | null>(null);
  const hasInitializedModalSessionRef = useRef<boolean>(false);
  const hasTriggeredPaidSuccessRef = useRef<boolean>(false);
  const onPaymentSuccessRef = useRef(onPaymentSuccess);
  onPaymentSuccessRef.current = onPaymentSuccess;

  const [orderCode, setOrderCode] = useState<number | null>(null);
  const [paymentLinkId, setPaymentLinkId] = useState<string>('');
  const [checkoutUrl, setCheckoutUrl] = useState<string>('');
  const [isPaidSuccess, setIsPaidSuccess] = useState<boolean>(false);
  const [isConnectingPayOS, setIsConnectingPayOS] = useState<boolean>(true);
  const [qrImageSrc, setQrImageSrc] = useState<string>('');
  const [rawEmvQrString, setRawEmvQrString] = useState<string>('');
  const [payosTransferMemo, setPayosTransferMemo] = useState<string>('');
  const [displayAccountNo, setDisplayAccountNo] = useState<string>('');
  const [displayAccountName, setDisplayAccountName] = useState<string>('');
  const [displayBankCode, setDisplayBankCode] = useState<string>('');
  const [copiedField, setCopiedField] = useState<'memo' | 'account' | null>(null);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState<boolean>(() =>
    detectIsMobileOrTabletDevice()
  );
  const [selectedBankAppNotice, setSelectedBankAppNotice] = useState<{
    bankName: string;
    deepLinkUrl: string;
    autofill?: boolean;
  } | null>(null);
  const [failedBankLogos, setFailedBankLogos] = useState<Record<string, boolean>>({});
  const deepLinkTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const updateDeviceType = () => {
      setIsMobileOrTablet(detectIsMobileOrTabletDevice());
    };
    updateDeviceType();
    window.addEventListener('resize', updateDeviceType);
    return () => {
      window.removeEventListener('resize', updateDeviceType);
    };
  }, []);

  const effectiveCenterId = (centerId || 'HG01').trim();
  const effectiveBankId = (bankId || 'MB').trim().toUpperCase();
  const effectiveAccountNo = (accountNo || '09995879999').trim().replace(/[\[\]\s]/g, '');
  const effectiveAccountName = (accountName || 'HUYNH THI HONG YEN')
    .trim()
    .toUpperCase()
    .replace(/^\[|\]$/g, '');

  // Chuỗi nội dung chuyển khoản chuẩn payOS (không dấu, không ký tự đặc biệt, tối đa 25 ký tự)
  const cleanDescription = buildCleanPayOSDescription(month, studentName, className);

  // URL VietQR dự phòng khi cần
  const fallbackVietQrUrl = `https://img.vietqr.io/image/${encodeURIComponent(
    effectiveBankId
  )}-${encodeURIComponent(effectiveAccountNo)}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(
    cleanDescription
  )}&accountName=${encodeURIComponent(effectiveAccountName)}`;

  // Hàm xử lý tập trung khi phát hiện trạng thái PAID từ PayOS hoặc Firestore
  const confirmPaymentSuccess = async (confirmedCode?: number, linkId?: string) => {
    if (hasTriggeredPaidSuccessRef.current) return;
    hasTriggeredPaidSuccessRef.current = true;

    const finalOrderCode =
      Number(confirmedCode || activeOrderCodeRef.current || orderCode) ||
      Number(String(Date.now()).slice(-6));

    setIsPaidSuccess(true);
    setIsConnectingPayOS(false);

    // Kích hoạt callback đồng bộ ở component cha NGAY LẬP TỨC (không cần đợi đóng modal)
    if (onPaymentSuccessRef.current) {
      onPaymentSuccessRef.current(finalOrderCode);
    }

    // Đồng bộ trạng thái "Đã thanh toán" lên Firestore (students, tuition_locks, tuition_payments) bằng quyền Admin
    await recordStudentTuitionPaymentSuccess({
      orderCode: finalOrderCode,
      paymentLinkId: linkId || paymentLinkId,
      centerId: effectiveCenterId,
      centerName: centerName || '',
      studentId: studentId || '',
      studentName: studentName || '',
      classId: classId || '',
      className: className || '',
      month: month || '',
      attendedSessions: Number(attendedSessions) || 0,
      amount: Number(amount) || 0,
      description: cleanDescription,
    });
  };

  // 1. Khởi tạo phiên đơn hàng DUY NHẤT 1 LẦN khi Modal chuyển sang isOpen === true
  useEffect(() => {
    if (!isOpen) {
      hasInitializedModalSessionRef.current = false;
      hasTriggeredPaidSuccessRef.current = false;
      activeOrderCodeRef.current = null;
      setOrderCode(null);
      setPaymentLinkId('');
      setCheckoutUrl('');
      setIsPaidSuccess(false);
      setIsConnectingPayOS(false);
      setQrImageSrc('');
      setRawEmvQrString('');
      setPayosTransferMemo('');
      setDisplayBankCode('');
      setCopiedField(null);
      setSelectedBankAppNotice(null);
      if (deepLinkTimeoutRef.current) {
        window.clearTimeout(deepLinkTimeoutRef.current);
        deepLinkTimeoutRef.current = null;
      }
      return;
    }

    // Nếu học sinh đã thanh toán tháng này rồi thì hiển thị ngay màn hình xác nhận thành công
    if (isAlreadyPaid) {
      const code = existingOrderCode || Number(String(Date.now()).slice(-6));
      activeOrderCodeRef.current = code;
      setOrderCode(code);
      setIsPaidSuccess(true);
      setIsConnectingPayOS(false);
      return;
    }

    // Nếu Modal đang mở và đã sinh orderCode rồi thì KHÔNG sinh lại khi re-render
    if (hasInitializedModalSessionRef.current && activeOrderCodeRef.current !== null) {
      return;
    }

    hasInitializedModalSessionRef.current = true;
    hasTriggeredPaidSuccessRef.current = false;
    const generatedOrderCode = Number(String(Date.now()).slice(-6));
    activeOrderCodeRef.current = generatedOrderCode;

    setOrderCode(generatedOrderCode);
    setPaymentLinkId('');
    setCheckoutUrl('');
    setIsPaidSuccess(false);
    setIsConnectingPayOS(true);
    setQrImageSrc('');
    setRawEmvQrString('');
    setPayosTransferMemo(cleanDescription);
    setDisplayAccountNo(effectiveAccountNo);
    setDisplayAccountName(effectiveAccountName);
    setDisplayBankCode(resolveVietQrBankCode(effectiveBankId));

    let isCancelled = false;

    const initPaymentOrder = async () => {
      try {
        await ensureAuthSession('parent').catch(() => {});
      } catch {}

      // BƯỚC 1: Lưu document PENDING vào Firestore `/centers/${centerId}/tuition_payments/${String(orderCode)}`
      try {
        await savePendingTuitionPaymentOrder({
          orderCode: Number(generatedOrderCode),
          centerId: effectiveCenterId,
          centerName: centerName || '',
          studentId: studentId || '',
          studentName: studentName || '',
          classId: classId || '',
          className: className || '',
          month: month || '',
          attendedSessions: Number(attendedSessions) || 0,
          amount: Number(amount) || 0,
          description: cleanDescription,
        });
      } catch (err) {
        console.warn('Lưu ý ghi document tuition_payments:', err);
      }

      if (isCancelled) return;

      // BƯỚC 2: Gọi API Cloudflare Worker kết nối cổng payOS để lấy mã QR chuẩn
      try {
        const response = await fetch(PAYOS_CREATE_PAYMENT_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderCode: Number(generatedOrderCode),
            amount: Number(amount) || 0,
            description: cleanDescription,
            centerId: effectiveCenterId,
            centerName: centerName || '',
            studentId: studentId || '',
            studentName: studentName || '',
            className: className || '',
            month: month || '',
            attendedSessions: Number(attendedSessions) || 0,
            returnUrl: window.location.origin.replace(/\/+$/, ''),
            cancelUrl: window.location.origin.replace(/\/+$/, ''),
          }),
        });

        const result = await response.json();
        const payosData = result?.data || result || {};

        const returnedPaymentLinkId = String(
          payosData?.paymentLinkId || result?.paymentLinkId || ''
        ).trim();
        const returnedCheckoutUrl = String(
          payosData?.checkoutUrl || result?.checkoutUrl || ''
        ).trim();

        const workerOrderCode = payosData?.orderCode || result?.orderCode;
        const finalOrderCode =
          workerOrderCode && Number(workerOrderCode)
            ? Number(workerOrderCode)
            : generatedOrderCode;

        if (!isCancelled) {
          activeOrderCodeRef.current = finalOrderCode;
          setOrderCode(finalOrderCode);
          if (returnedPaymentLinkId) setPaymentLinkId(returnedPaymentLinkId);
          if (returnedCheckoutUrl) setCheckoutUrl(returnedCheckoutUrl);
        }

        // Lưu lại paymentLinkId & checkoutUrl vào Firestore + localStorage để đồng bộ trạng thái
        await savePendingTuitionPaymentOrder({
          orderCode: finalOrderCode,
          paymentLinkId: returnedPaymentLinkId,
          checkoutUrl: returnedCheckoutUrl,
          centerId: effectiveCenterId,
          centerName: centerName || '',
          studentId: studentId || '',
          studentName: studentName || '',
          classId: classId || '',
          className: className || '',
          month: month || '',
          attendedSessions: Number(attendedSessions) || 0,
          amount: Number(amount) || 0,
          description: payosData?.description || cleanDescription,
        });

        const returnedQrCode =
          payosData?.qrCode ||
          payosData?.qr_code ||
          result?.qrCode ||
          result?.qr_code ||
          '';

        if (!isCancelled) {
          if (payosData?.description && typeof payosData.description === 'string') {
            setPayosTransferMemo(payosData.description);
          }
          if (payosData?.accountNumber && typeof payosData.accountNumber === 'string') {
            setDisplayAccountNo(payosData.accountNumber);
          }
          if (payosData?.accountName && typeof payosData.accountName === 'string') {
            setDisplayAccountName(payosData.accountName);
          }
          if (payosData?.bin || payosData?.bankCode) {
            setDisplayBankCode(
              resolveVietQrBankCode(payosData.bin || payosData.bankCode, effectiveBankId)
            );
          }
        }

        if (returnedQrCode && !isCancelled) {
          setRawEmvQrString(String(returnedQrCode));
          const resolvedImg = await resolveQrCodeToImageSrc(String(returnedQrCode));
          if (!isCancelled && resolvedImg) {
            setQrImageSrc(resolvedImg);
            setIsConnectingPayOS(false);
            return;
          }
        }

        if (!isCancelled) {
          setQrImageSrc(fallbackVietQrUrl);
        }
      } catch (err) {
        console.warn('Lưu ý kết nối cổng payOS create-payment, dùng VietQR dự phòng:', err);
        if (!isCancelled) {
          setQrImageSrc(fallbackVietQrUrl);
        }
      } finally {
        if (!isCancelled) {
          setIsConnectingPayOS(false);
        }
      }
    };

    initPaymentOrder();

    return () => {
      if (!isOpen) {
        isCancelled = true;
      }
    };
  }, [isOpen, isAlreadyPaid]);

  // 2. Lắng nghe Realtime trên Firestore (cả root `tuition_payments/${orderCode}` VÀ `/centers/${centerId}/tuition_payments/${orderCode}`)
  useEffect(() => {
    if (!isOpen || !orderCode || isPaidSuccess) return;

    const handleSnapshotData = (data: any) => {
      if (!data) return;
      const st = String(data.status || '').toUpperCase().trim();
      if (st === 'PAID' || st === 'SUCCESS' || data.isPaid === true) {
        confirmPaymentSuccess(Number(data.orderCode || orderCode), data.paymentLinkId);
      }
    };

    // 2a. Lắng nghe trên sub-collection của trung tâm `/centers/${effectiveCenterId}/tuition_payments/${String(orderCode)}`
    const centerOrderDocRef = doc(
      db,
      'centers',
      effectiveCenterId,
      'tuition_payments',
      String(orderCode)
    );
    const unsubCenterOrder = onSnapshot(
      centerOrderDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          handleSnapshotData(snapshot.data());
        }
      },
      () => {}
    );

    // 2b. Lắng nghe trên bản ghi học sinh + tháng `/centers/${effectiveCenterId}/tuition_payments/${studentId}_${isoMonth}`
    let unsubStudentMonth = () => {};
    if (studentId) {
      const { isoMonth } = normalizeTuitionMonthPair(month);
      const studentMonthDocRef = doc(
        db,
        'centers',
        effectiveCenterId,
        'tuition_payments',
        `${String(studentId).trim()}_${isoMonth}`
      );
      unsubStudentMonth = onSnapshot(
        studentMonthDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            handleSnapshotData(snapshot.data());
          }
        },
        () => {}
      );
    }

    return () => {
      unsubCenterOrder();
      unsubStudentMonth();
    };
  }, [isOpen, orderCode, isPaidSuccess, effectiveCenterId, studentId, month]);

  // 3. Kiểm tra trực tiếp trạng thái thanh toán từ cổng PayOS mỗi 2 giây qua paymentLinkId / checkoutUrl
  useEffect(() => {
    if (!isOpen || isPaidSuccess || (!paymentLinkId && !checkoutUrl)) return;

    let isStopped = false;

    const pollPayOSStatus = async () => {
      if (isStopped || hasTriggeredPaidSuccessRef.current) return;
      const res = await checkPayOSPaymentStatus({
        paymentLinkId,
        checkoutUrl,
      });
      if (!isStopped && res.isPaid) {
        await confirmPaymentSuccess(orderCode || undefined, paymentLinkId);
      }
    };

    // Kiểm tra ngay lập tức và lặp lại mỗi 2 giây
    pollPayOSStatus();
    const timer = setInterval(pollPayOSStatus, 2000);

    return () => {
      isStopped = true;
      clearInterval(timer);
    };
  }, [isOpen, isPaidSuccess, paymentLinkId, checkoutUrl, orderCode]);

  // 4. Lắng nghe trực tiếp sự kiện postMessage từ cổng thanh toán chính thức pay.payos.vn (hoạt động 100% client-side trên Cloudflare Pages không cần proxy/CORS)
  useEffect(() => {
    if (!isOpen || isPaidSuccess || (!paymentLinkId && !checkoutUrl)) return;

    const handlePayOSMessage = (event: MessageEvent) => {
      if (hasTriggeredPaidSuccessRef.current) return;
      const parsed = parsePayOSPostMessageEvent(event);
      if (!parsed.isPayOSEvent) return;

      const matchesOrder =
        (parsed.orderCode && orderCode && Number(parsed.orderCode) === Number(orderCode)) ||
        (parsed.paymentLinkId &&
          paymentLinkId &&
          parsed.paymentLinkId.toLowerCase() === paymentLinkId.toLowerCase());

      if (parsed.isPaid && (matchesOrder || !parsed.orderCode)) {
        confirmPaymentSuccess(
          parsed.orderCode || orderCode || undefined,
          parsed.paymentLinkId || paymentLinkId
        );
      }
    };

    window.addEventListener('message', handlePayOSMessage);
    return () => {
      window.removeEventListener('message', handlePayOSMessage);
    };
  }, [isOpen, isPaidSuccess, paymentLinkId, checkoutUrl, orderCode]);

  if (!isOpen) return null;

  const payosIframeListenerUrl =
    !isPaidSuccess && (paymentLinkId || checkoutUrl)
      ? buildPayOSIframeListenerUrl({ paymentLinkId, checkoutUrl })
      : '';

  const activeMemo = payosTransferMemo || cleanDescription;
  const activeAccountNo = displayAccountNo || effectiveAccountNo;
  const activeAccountName = displayAccountName || effectiveAccountName;
  const activeBankCode = displayBankCode || resolveVietQrBankCode(effectiveBankId);

  const handleCopyText = (text: string, type: 'memo' | 'account') => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(type);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {}
  };

  const handleOpenBankApp = (bank: BankDeepLinkItem, deepLinkUrl: string) => {
    // Tự động sao chép STK để hỗ trợ dán nhanh nếu ngân hàng chưa hỗ trợ autofill
    try {
      navigator.clipboard.writeText(activeAccountNo);
      setCopiedField('account');
      setTimeout(() => setCopiedField(null), 2500);
    } catch {}

    setSelectedBankAppNotice({
      bankName: bank.name,
      deepLinkUrl,
      autofill: bank.autofill,
    });
  };

  const handleCloseModal = () => {
    if (deepLinkTimeoutRef.current) {
      window.clearTimeout(deepLinkTimeoutRef.current);
      deepLinkTimeoutRef.current = null;
    }
    if (isPaidSuccess && onPaymentSuccess && orderCode) {
      onPaymentSuccess(orderCode);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-sm p-3 sm:p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl border-3 border-[#0072B5] max-w-xl w-full overflow-hidden shadow-2xl my-auto">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-[#0B486B] via-[#0072B5] to-[#0B486B] px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              {isPaidSuccess ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              ) : (
                <QrCode className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-black text-sm sm:text-base uppercase tracking-wide truncate">
                  {isPaidSuccess
                    ? 'Xác Nhận Hoàn Tất Học Phí'
                    : `Thanh Toán Học Phí Tháng ${month}`}
                </h4>
                {orderCode && (
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-mono font-bold text-blue-100">
                    #{orderCode}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-blue-100 truncate flex items-center gap-1 mt-0.5">
                <Building2 className="w-3 h-3 shrink-0" />
                <span>{centerName || 'Trung tâm đào tạo'}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseModal}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white font-black cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Modal */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {isPaidSuccess ? (
            /* ================================================================= */
            /* MÀN HÌNH CHÚC MỪNG THÀNH CÔNG KHI NHẬN TÍN HIỆU STATUS === 'PAID'  */
            /* ================================================================= */
            <div className="py-4 text-center space-y-5 animate-fade-in">
              <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white flex items-center justify-center shadow-lg ring-4 ring-emerald-100">
                  <CheckCircle2 className="w-11 h-11 animate-bounce" />
                </div>
              </div>

              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Giao dịch #{orderCode} đã xác thực
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-[#0B486B] pt-1">
                  Thanh toán học phí thành công
                </h3>
                <p className="text-xs text-slate-500">
                  Hệ thống đã nhận tín hiệu xác nhận từ payOS và đồng bộ trạng thái <strong>Đã thanh toán</strong> cho học sinh.
                </p>
              </div>

              {/* Thông tin chi tiết giao dịch thành công */}
              <div className="rounded-2xl bg-emerald-50/70 border-2 border-emerald-200 p-4 text-left space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-emerald-200/70 pb-2">
                  <span className="text-slate-600 font-bold">Cơ sở / Trung tâm:</span>
                  <span className="font-black text-[#0B486B]">{centerName}</span>
                </div>
                <div className="flex items-center justify-between border-b border-emerald-200/70 pb-2">
                  <span className="text-slate-600 font-bold">Học sinh:</span>
                  <span className="font-black text-slate-900 text-sm">{studentName}</span>
                </div>
                <div className="flex items-center justify-between border-b border-emerald-200/70 pb-2">
                  <span className="text-slate-600 font-bold">Lớp học:</span>
                  <span className="font-extrabold text-[#0072B5]">{className}</span>
                </div>
                <div className="flex items-center justify-between border-b border-emerald-200/70 pb-2">
                  <span className="text-slate-600 font-bold">Tháng học phí &amp; Chuyên cần:</span>
                  <span className="font-bold text-slate-800">
                    Tháng {month} ({attendedSessions} buổi)
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-black text-emerald-950">Số tiền đã thanh toán:</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-700">
                    {amount.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-[#00A86B] hover:from-emerald-700 hover:to-emerald-600 text-white text-sm font-black shadow-md transition-all cursor-pointer"
                >
                  Đóng &amp; Cập nhật hồ sơ
                </button>
              </div>
            </div>
          ) : (
            /* ================================================================= */
            /* MÀN HÌNH QUÉT MÃ VIETQR & THÔNG TIN CHUYỂN KHOẢN CHUẨN PAYOS      */
            /* ================================================================= */
            <>
              {/* Dải thông tin Trung tâm & Số tiền nổi bật */}
              <div className="rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50/40 to-emerald-50/50 border-2 border-blue-200/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#0072B5] uppercase tracking-wider">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Đơn vị thu phí: {centerName}</span>
                  </div>
                  <div className="text-sm font-black text-[#0B486B] flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      {studentName}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1 text-[#0072B5]">
                      <GraduationCap className="w-3.5 h-3.5" />
                      {className}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                    <CalendarCheck className="w-3.5 h-3.5" />
                    <span>Ghi nhận điểm danh thực tế: {attendedSessions} buổi</span>
                  </div>
                </div>

                <div className="sm:text-right bg-white px-4 py-2.5 rounded-2xl border border-rose-200 shadow-2xs shrink-0">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Số tiền học phí
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-rose-600">
                    {amount.toLocaleString('vi-VN')} đ
                  </div>
                </div>
              </div>

              {/* Khung hiển thị mã QR chuẩn từ payOS (hoặc Loading Skeleton khi đang kết nối) */}
              <div className="w-full flex flex-col items-center justify-center bg-slate-50 p-4 sm:p-5 rounded-2xl border-2 border-blue-100 shadow-2xs min-h-[310px]">
                {isConnectingPayOS ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-4">
                    <div className="relative w-56 h-56 rounded-2xl bg-white border-2 border-dashed border-blue-200 flex flex-col items-center justify-center p-6 shadow-xs animate-pulse">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mb-3">
                        <Loader2 className="w-8 h-8 text-[#0072B5] animate-spin" />
                      </div>
                      <div className="h-3 w-36 bg-slate-200 rounded-full mb-2" />
                      <div className="h-2.5 w-28 bg-slate-100 rounded-full" />
                    </div>
                    <p className="text-xs sm:text-sm font-extrabold text-[#0B486B] animate-pulse">
                      Đang kết nối cổng payOS để tạo mã QR...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                      <img
                        src={qrImageSrc || fallbackVietQrUrl}
                        alt="Mã QR Thanh Toán Học Phí payOS"
                        className="w-64 sm:w-72 h-auto max-w-full object-contain rounded-xl mx-auto"
                        onError={() => {
                          if (rawEmvQrString) {
                            setQrImageSrc(
                              `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=10&data=${encodeURIComponent(
                                rawEmvQrString
                              )}`
                            );
                          } else if (qrImageSrc !== fallbackVietQrUrl) {
                            setQrImageSrc(fallbackVietQrUrl);
                          }
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-3 text-xs font-bold text-[#0B486B] text-center">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Quét mã VietQR chuẩn payOS bằng App Ngân hàng — Tự động xác nhận khi hoàn tất chuyển khoản
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Khu vực Mở ứng dụng ngân hàng (Mobile/Tablet) hoặc Gợi ý quét mã (Desktop/Laptop) ngay dưới thẻ mã QR */}
              {!isConnectingPayOS && (
                <div className="rounded-2xl bg-white border border-slate-200 p-3.5 sm:p-4 shadow-2xs space-y-2.5">
                  {isMobileOrTablet ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0B486B]">
                          <Smartphone className="w-4 h-4 text-[#0072B5] shrink-0" />
                          <span>Mở ứng dụng ngân hàng để thanh toán nhanh</span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">
                          Chạm để mở app
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {SUPPORTED_BANK_APPS.map((bank) => {
                          const deepLinkUrl = buildVietQrDeepLinkUrl({
                            appId: bank.appId,
                            accountNo: activeAccountNo,
                            bankCode: activeBankCode,
                            accountName: activeAccountName,
                            amount: Number(amount) || 0,
                            memo: activeMemo,
                          });

                          return (
                            <a
                              key={bank.id}
                              href={deepLinkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => handleOpenBankApp(bank, deepLinkUrl)}
                              className="relative flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200 bg-white hover:border-[#0072B5]/50 hover:bg-blue-50/40 active:scale-95 active:bg-blue-50 transition-all cursor-pointer min-h-[68px] no-underline"
                            >
                              {bank.autofill && (
                                <span
                                  title="Tự động điền thông tin chuyển khoản"
                                  className="absolute top-1 right-1 px-1 py-0.2 rounded bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase leading-tight"
                                >
                                  Tự điền
                                </span>
                              )}
                              <div className="h-7 w-full flex items-center justify-center mb-1">
                                {failedBankLogos[bank.id] ? (
                                  <span className="text-xs font-black text-[#0072B5]">
                                    {bank.id}
                                  </span>
                                ) : (
                                  <img
                                    src={bank.logo}
                                    alt={bank.name}
                                    referrerPolicy="no-referrer"
                                    className="h-6 w-auto max-w-[70px] object-contain mx-auto"
                                    onError={() =>
                                      setFailedBankLogos((prev) => ({
                                        ...prev,
                                        [bank.id]: true,
                                      }))
                                    }
                                  />
                                )}
                              </div>
                              <span className="text-[11px] font-bold text-slate-700 text-center leading-tight truncate w-full">
                                {bank.name}
                              </span>
                            </a>
                          );
                        })}
                      </div>

                      {selectedBankAppNotice && (
                        <div className="flex flex-col gap-2 px-3 py-2.5 rounded-xl bg-blue-50/90 border border-blue-200 text-[#0B486B] text-xs animate-fade-in">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="font-extrabold text-[#0B486B]">
                                Đang mở ứng dụng {selectedBankAppNotice.bankName} &amp; đã sao chép STK ({activeAccountNo})
                              </div>
                              <div className="text-[11px] text-slate-600 font-medium">
                                {selectedBankAppNotice.autofill
                                  ? 'Thông tin Số tài khoản, Số tiền và Nội dung chuyển khoản được truyền tự động sang ứng dụng ngân hàng.'
                                  : 'Nếu ứng dụng yêu cầu quét mã hoặc nhập STK, bạn có thể dán ngay STK đã sao chép hoặc lưu ảnh mã QR ở trên.'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedBankAppNotice(null)}
                              className="text-[11px] font-extrabold text-slate-500 hover:text-slate-800 cursor-pointer shrink-0"
                            >
                              Đóng
                            </button>
                          </div>

                          <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                            <a
                              href={selectedBankAppNotice.deepLinkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-[#0072B5] text-white text-[11px] font-extrabold hover:bg-[#0B486B] transition-colors no-underline"
                            >
                              Mở lại {selectedBankAppNotice.bankName}
                            </a>
                            {checkoutUrl && (
                              <a
                                href={checkoutUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-[#0072B5] text-[11px] font-extrabold hover:bg-blue-50 transition-colors no-underline"
                              >
                                Mở trang thanh toán PayOS
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 text-center py-0.5">
                      <Smartphone className="w-4 h-4 text-[#0072B5] shrink-0" />
                      <span>Mở ứng dụng ngân hàng trên điện thoại để quét mã QR ở trên</span>
                    </div>
                  )}
                </div>
              )}

              {/* Khung thông tin Số tài khoản & Nội dung chuyển khoản chuẩn payOS có nút Sao chép 1 chạm */}
              <div className="space-y-3 text-xs">
                {/* Ô Số tài khoản + Nút Sao chép */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="text-[11px] font-bold text-slate-500">
                      Ngân hàng <strong className="text-[#0B486B]">{effectiveBankId}</strong> • Chủ TK:{' '}
                      <strong className="text-slate-800 uppercase">{activeAccountName}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">Số tài khoản:</span>
                      <span className="font-mono font-black text-sm sm:text-base text-[#0072B5] tracking-wide">
                        {activeAccountNo}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyText(activeAccountNo, 'account')}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-blue-50 text-[#0B486B] border border-slate-300 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs transition-colors"
                  >
                    {copiedField === 'account' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Đã chép STK</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#0072B5]" />
                        <span>Sao chép STK</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Ô Mã nội dung chuyển khoản chuẩn payOS + Nút Sao chép */}
                <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">
                      Nội dung chuyển khoản (tối đa 25 ký tự chuẩn payOS):
                    </div>
                    <div className="font-mono font-black text-[#0B486B] text-sm sm:text-base truncate">
                      {activeMemo}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyText(activeMemo, 'memo')}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs transition-colors"
                  >
                    {copiedField === 'memo' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Đã chép mã CK</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-700" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Iframe ẩn kết nối trực tiếp tới pay.payos.vn để nhận tín hiệu PAID realtime qua postMessage */}
              {payosIframeListenerUrl && (
                <iframe
                  src={payosIframeListenerUrl}
                  title="PayOS Realtime Status Listener"
                  className="hidden w-0 h-0 border-0 pointer-events-none"
                  aria-hidden="true"
                />
              )}

              {/* Footer Modal */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Đang chờ xác nhận thanh toán tự động (tuition_payments/{orderCode})</span>
                </div>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 rounded-xl bg-[#0B486B] text-white text-xs font-extrabold hover:bg-[#0072B5] transition-all cursor-pointer shrink-0"
                >
                  Đóng
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
