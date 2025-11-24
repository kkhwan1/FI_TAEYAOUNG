'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface ProcessCompleteButtonProps {
  operationId: number;
  onComplete?: () => void;
}

export default function ProcessCompleteButton({
  operationId,
  onComplete
}: ProcessCompleteButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/process/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation_id: operationId })
      });

      // UTF-8 pattern for Korean text handling
      const text = await response.text();
      const data = JSON.parse(text);

      if (data.success) {
        toast.success('공정이 완료되었습니다');
        onComplete?.();
        setShowConfirm(false);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        toast.error(extractErrorMessage(data.error) || '처리 중 오류가 발생했습니다');
      }
    } catch (error) {
      console.error('공정 완료 오류:', error);
      toast.error('처리 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors dark:bg-green-600 dark:hover:bg-green-700"
        type="button"
      >
        공정 완료
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => !loading && setShowConfirm(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              공정 완료 확인
            </h3>
            <p className="mb-6 text-gray-700 dark:text-gray-300">
              공정을 완료하시겠습니까?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                취소
              </button>
              <button
                onClick={handleComplete}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors dark:bg-green-700 dark:hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                {loading ? '처리 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
