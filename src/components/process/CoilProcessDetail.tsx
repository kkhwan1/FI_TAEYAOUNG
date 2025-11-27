'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import type { CoilProcessWithDetails } from '@/types/coil';
import { useToast } from '@/contexts/ToastContext';

interface CoilProcessDetailProps {
  processId: number;
}

export default function CoilProcessDetail({ processId }: CoilProcessDetailProps) {
  const router = useRouter();
  const { success: showSuccess, error: showError } = useToast();

  const [process, setProcess] = useState<CoilProcessWithDetails | null>(null);
  const [stockHistory, setStockHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    fetchProcessDetail();
    fetchStockHistory();
  }, [processId]);

  const fetchProcessDetail = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/coil/process?process_id=${processId}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(result.error) || '공정 정보를 불러올 수 없습니다.');
      }

      // Get the specific process by ID
      const processData = result.data.find((p: any) => p.process_id === processId);
      if (!processData) {
        throw new Error('해당 공정을 찾을 수 없습니다.');
      }

      setProcess(processData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStockHistory = async () => {
    try {
      const response = await fetch(`/api/stock-history?reference_type=coil_process&reference_id=${processId}`);
      const result = await response.json();

      if (response.ok && result.success) {
        setStockHistory(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch stock history:', err);
    }
  };

  const handleCompleteProcess = async () => {
    setIsCompleting(true);

    try {
      const response = await fetch('/api/coil/process/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ process_id: processId })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(result.error) || '공정 완료 처리에 실패했습니다.');
      }

      showSuccess('공정이 성공적으로 완료되었습니다. 재고가 자동으로 이동되었습니다.');
      setShowCompleteModal(false);

      // Refresh process data
      await fetchProcessDetail();
      await fetchStockHistory();
    } catch (err) {
      const { extractErrorMessage } = await import('@/lib/fetch-utils');
      showError(extractErrorMessage(err) || '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsCompleting(false);
    }
  };

  const canComplete = process?.status === 'PENDING' || process?.status === 'IN_PROGRESS';

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      'PENDING': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'IN_PROGRESS': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'COMPLETED': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'CANCELLED': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };

    const statusLabels = {
      'PENDING': '대기',
      'IN_PROGRESS': '진행중',
      'COMPLETED': '완료',
      'CANCELLED': '취소'
    };

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusStyles[status as keyof typeof statusStyles] || statusStyles.PENDING}`}>
        {statusLabels[status as keyof typeof statusLabels] || status}
      </span>
    );
  };

  const getYieldRateColor = (yieldRate: number) => {
    if (yieldRate >= 95) return 'text-green-600 dark:text-green-400 font-semibold';
    if (yieldRate >= 90) return 'text-yellow-600 dark:text-yellow-400 font-semibold';
    return 'text-red-600 dark:text-red-400 font-semibold';
  };

  const formatNumber = (value: number) => value.toLocaleString('ko-KR');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500 dark:text-gray-400">공정 정보를 불러오는 중...</div>
      </div>
    );
  }

  if (error || !process) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-200 px-4 py-3 rounded">
          {error || '공정 정보를 찾을 수 없습니다.'}
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          ← 목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">공정 상세 정보</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            공정 ID: #{process.process_id}
          </p>
        </div>
        <div className="flex gap-3">
          {canComplete && (
            <button
              onClick={() => setShowCompleteModal(true)}
              className="bg-green-600 dark:bg-green-500 text-white px-6 py-2 rounded-md hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
            >
              공정 완료
            </button>
          )}
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            ← 목록
          </button>
        </div>
      </div>

      {/* 기본 정보 카드 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">기본 정보</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 공정 유형 */}
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">공정 유형</div>
            <div className="text-lg font-medium text-gray-900 dark:text-gray-100">{process.process_type}</div>
          </div>

          {/* 상태 */}
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">상태</div>
            <div>{getStatusBadge(process.status)}</div>
          </div>

          {/* 공정 일자 */}
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">공정 일자</div>
            <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {new Date(process.process_date).toLocaleDateString('ko-KR')}
            </div>
          </div>

          {/* 수율 */}
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">수율</div>
            <div className={`text-lg ${getYieldRateColor(process.yield_rate ?? 0)}`}>
              {(process.yield_rate ?? 0).toFixed(2)}%
            </div>
          </div>
        </div>

        {/* 비고 */}
        {process.notes && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">비고</div>
            <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{process.notes}</div>
          </div>
        )}
      </div>

      {/* 투입/산출 정보 카드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 투입 정보 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <span className="text-red-600 dark:text-red-400">▼</span>
            투입 (소스 코일)
          </h2>

          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">품목 코드</div>
              <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {process.source_item?.item_code || 'N/A'}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">품목명</div>
              <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {process.source_item?.item_name || 'N/A'}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">투입 수량</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatNumber(process.input_quantity)} {process.source_item?.unit || 'kg'}
              </div>
            </div>
          </div>
        </div>

        {/* 산출 정보 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <span className="text-green-600 dark:text-green-400">▲</span>
            산출 (타겟 품목)
          </h2>

          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">품목 코드</div>
              <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {process.target_item?.item_code || 'N/A'}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">품목명</div>
              <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {process.target_item?.item_name || 'N/A'}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">산출 수량</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatNumber(process.output_quantity)} {process.target_item?.unit || 'kg'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 재고 이동 이력 (완료된 공정만) */}
      {process.status === 'COMPLETED' && stockHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">재고 이동 이력</h2>

          <div className="space-y-3">
            {stockHistory.map((history: any) => (
              <div
                key={history.transaction_id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      history.transaction_type === '생산입고' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {history.transaction_type}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{history.transaction_number}</span>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(history.transaction_date).toLocaleString('ko-KR')}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600 dark:text-gray-400">품목</div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{history.item?.item_name || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 dark:text-gray-400">수량</div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {formatNumber(history.quantity)} {history.item?.unit || 'kg'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600 dark:text-gray-400">재고 변화</div>
                    <div className={`font-medium ${history.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {history.quantity > 0 ? '+' : ''}{formatNumber(history.quantity)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 공정 완료 확인 모달 */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">공정 완료 확인</h3>

              <div className="space-y-4 mb-6">
                <p className="text-gray-700 dark:text-gray-300">
                  공정을 완료하시겠습니까? 완료 시 다음 작업이 자동으로 수행됩니다:
                </p>

                <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-red-600 dark:text-red-400">▼</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">소스 코일 출고</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {process.source_item?.item_name} -{formatNumber(process.input_quantity)} {process.source_item?.unit || 'kg'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400">▲</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">타겟 품목 입고</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {process.target_item?.item_name} +{formatNumber(process.output_quantity)} {process.target_item?.unit || 'kg'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
                  <span>완료 후에는 되돌릴 수 없습니다.</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCompleteProcess}
                  disabled={isCompleting}
                  className="flex-1 bg-green-600 dark:bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-700 dark:hover:bg-green-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  {isCompleting ? '처리 중...' : '완료 처리'}
                </button>
                <button
                  onClick={() => setShowCompleteModal(false)}
                  disabled={isCompleting}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
