import React, { useState } from 'react';
import { X, CheckCircle2, MessageSquare, Award, Calendar, User, Loader2, AlertCircle } from 'lucide-react';
import { AssignmentItem } from '../data/mockData';

interface AssignmentModalProps {
  assignment: AssignmentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateScore: (id: string, score: number, comment: string) => Promise<any> | void;
}

export const AssignmentModal: React.FC<AssignmentModalProps> = ({
  assignment,
  isOpen,
  onClose,
  onUpdateScore,
}) => {
  if (!isOpen || !assignment) return null;

  const [score, setScore] = useState<number>(assignment.score || 8.5);
  const [comment, setComment] = useState<string>(
    assignment.comment || 'Bài làm tốt, trình bày sạch sẽ, cần chú ý thêm bước biến đổi ở câu c.'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onUpdateScore(assignment.id, Number(score), comment);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi cập nhật điểm lên Firestore');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-2xl animate-fade-in border border-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800">Chấm Điểm &amp; Nhận Xét Bài Tập</h3>
            <p className="text-xs text-slate-500">{assignment.title}</p>
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

        <form onSubmit={handleSave} className="mt-4 space-y-3.5 text-xs">
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">Học sinh:</span>
              <strong className="text-slate-800">{assignment.studentName}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">Lớp:</span>
              <strong className="text-slate-800">{assignment.className}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">Hạn nộp:</span>
              <strong className="text-slate-800">{assignment.dueDate}</strong>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-[#F39C12]" />
              Điểm số (Thang điểm 10):
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              required
              disabled={isSubmitting}
              value={score}
              onChange={(e) => setScore(parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-[#00A86B] text-lg focus:border-[#0072B5] focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-[#0072B5]" />
              Lời phê của giáo viên:
            </label>
            <textarea
              rows={3}
              required
              disabled={isSubmitting}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Nhập nhận xét chi tiết..."
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-[#0072B5] focus:outline-hidden"
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
              className="flex items-center gap-1.5 rounded-xl bg-[#00A86B] hover:bg-emerald-700 text-white px-5 py-2 font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu Firestore...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Lưu &amp; Cập Nhật Firestore</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
