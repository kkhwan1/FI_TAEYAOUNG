'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { RefreshCw, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProcessOperation {
  operation_id: number;
  operation_type: string;
  input_item: {
    item_id: number;
    item_code: string;
    item_name: string;
    unit: string;
    price?: number;
    category?: string;
  } | null;
  output_item: {
    item_id: number;
    item_code: string;
    item_name: string;
    unit: string;
    price?: number;
    category?: string;
  } | null;
  customer: {
    company_id: number;
    company_name: string;
  } | null;
  input_quantity: number;
  output_quantity: number;
  scrap_quantity: number;
  efficiency: number;
  quality_status: string;
  status: string;
  lot_number: string;
  scheduled_date: string;
  completed_at: string;
  created_at: string;
}

interface ProcessProductionHistoryProps {
  refreshTrigger?: number;
  onRefresh?: () => void;
  workDate?: string;  // YYYY-MM-DD 형식, 미지정시 금일
}

const PROCESS_TYPE_MAP: Record<string, { label: string; color: string }> = {
  BLANKING: { label: '블랭킹', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600' },
  PRESS: { label: '프레스', color: 'bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border border-gray-400 dark:border-gray-500' },
  WELD: { label: '용접', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-dashed border-gray-400 dark:border-gray-500' },
  PAINT: { label: '도장', color: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border border-gray-400 dark:border-gray-500' },
};

const STATUS_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  COMPLETED: { label: '완료', icon: CheckCircle, color: 'text-gray-700 dark:text-gray-300' },
  IN_PROGRESS: { label: '진행중', icon: Clock, color: 'text-gray-600 dark:text-gray-400' },
  PENDING: { label: '대기', icon: AlertCircle, color: 'text-gray-500 dark:text-gray-500' },
  CANCELLED: { label: '취소', icon: XCircle, color: 'text-gray-400 dark:text-gray-600' },
};

export default function ProcessProductionHistory({ refreshTrigger, onRefresh, workDate }: ProcessProductionHistoryProps) {
  const [operations, setOperations] = useState<ProcessOperation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 작업일자 (prop 또는 금일)
  const targetDate = workDate || format(new Date(), 'yyyy-MM-dd');

  const fetchOperations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/process-production?date_from=${targetDate}&date_to=${targetDate}&limit=50`
      );
      const result = await response.json();

      if (result.success) {
        setOperations(result.data || []);
      } else {
        setError(result.error || '조회 실패');
      }
    } catch (err) {
      console.error('Failed to fetch operations:', err);
      setError('데이터 조회 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [targetDate]);

  // 초기 로드 및 refreshTrigger/workDate 변경 시 재조회
  useEffect(() => {
    fetchOperations();
  }, [fetchOperations, refreshTrigger]);

  const handleCancel = async (operationId: number, lotNumber: string) => {
    if (!confirm(`LOT ${lotNumber} 작업을 취소하시겠습니까?\n재고 변동이 롤백됩니다.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/process-production/${operationId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        toast.success('작업이 취소되었습니다.');
        fetchOperations();
        onRefresh?.();
      } else {
        toast.error(result.error || '취소 실패');
      }
    } catch {
      toast.error('취소 처리 중 오류가 발생했습니다.');
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm', { locale: ko });
    } catch {
      return '-';
    }
  };

  if (error) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
        <p className="text-gray-700 dark:text-gray-300">{error}</p>
        <button
          onClick={fetchOperations}
          className="mt-2 text-sm text-gray-600 dark:text-gray-400 underline hover:no-underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">생산 이력</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({targetDate})
          </span>
          <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full">
            {operations.length}건
          </span>
        </div>
        <button
          onClick={fetchOperations}
          disabled={isLoading}
          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        {isLoading && operations.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p>데이터 조회 중...</p>
          </div>
        ) : operations.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <p>해당 일자의 생산 이력이 없습니다.</p>
            <p className="text-xs mt-1">위에서 생산등록을 진행하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                <th className="px-1 py-2 text-center font-semibold" style={{width: '50px'}}>시간</th>
                <th className="px-1 py-2 text-center font-semibold" style={{width: '55px'}}>공정</th>
                <th className="px-1 py-2 text-center font-semibold" style={{width: '70px'}}>납품처</th>
                <th className="px-1 py-2 text-left font-semibold" style={{width: '90px'}}>투입 품번</th>
                <th className="px-1 py-2 text-left font-semibold" style={{width: '100px'}}>투입 품명</th>
                <th className="px-1 py-2 text-right font-semibold" style={{width: '75px'}}>수량</th>
                <th className="px-1 py-2 text-right font-semibold" style={{width: '70px'}}>단가</th>
                <th className="px-1 py-2 text-center font-semibold" style={{width: '55px'}}>분류</th>
                <th className="px-1 py-2 text-left font-semibold" style={{width: '90px'}}>산출 품번</th>
                <th className="px-1 py-2 text-left font-semibold" style={{width: '100px'}}>산출 품명</th>
                <th className="px-1 py-2 text-right font-semibold" style={{width: '75px'}}>수량</th>
                <th className="px-1 py-2 text-right font-semibold" style={{width: '70px'}}>단가</th>
                <th className="px-1 py-2 text-center font-semibold" style={{width: '55px'}}>분류</th>
                <th className="px-1 py-2 text-center font-semibold" style={{width: '45px'}}>수율</th>
                <th className="px-1 py-2 text-center font-semibold" style={{width: '35px'}}>상태</th>
                <th className="px-1 py-2 text-center font-semibold" style={{width: '30px'}}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {operations.map((op) => {
                const processType = PROCESS_TYPE_MAP[op.operation_type] || { label: op.operation_type, color: 'bg-gray-100 text-gray-800' };
                const status = STATUS_MAP[op.status] || STATUS_MAP.PENDING;
                const StatusIcon = status.icon;

                return (
                  <tr key={op.operation_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-xs">
                    {/* 시간 */}
                    <td className="px-1 py-1.5 text-center text-gray-600 dark:text-gray-400 font-mono">
                      {formatTime(op.created_at)}
                    </td>
                    {/* 공정 */}
                    <td className="px-1 py-1.5 text-center">
                      <span className={`px-1 py-0.5 text-xs font-medium rounded ${processType.color}`}>
                        {processType.label}
                      </span>
                    </td>
                    {/* 납품처 */}
                    <td className="px-1 py-1.5 text-center text-gray-700 dark:text-gray-300">
                      <div className="truncate" title={op.customer?.company_name || ''}>
                        {op.customer?.company_name || '-'}
                      </div>
                    </td>
                    {/* 투입 품번 */}
                    <td className="px-1 py-1.5 text-gray-900 dark:text-white font-medium">
                      <div className="truncate" title={op.input_item?.item_code || ''}>
                        {op.input_item?.item_code || '-'}
                      </div>
                    </td>
                    {/* 투입 품명 */}
                    <td className="px-1 py-1.5 text-gray-700 dark:text-gray-300">
                      <div className="truncate" title={op.input_item?.item_name || ''}>
                        {op.input_item?.item_name || '-'}
                      </div>
                    </td>
                    {/* 투입 수량 (단위 포함) */}
                    <td className="px-1 py-1.5 text-right text-gray-900 dark:text-white font-medium">
                      {op.input_quantity?.toLocaleString() || '-'} <span className="text-gray-500 dark:text-gray-400 font-normal">{op.input_item?.unit || ''}</span>
                    </td>
                    {/* 투입 단가 */}
                    <td className="px-1 py-1.5 text-right text-gray-600 dark:text-gray-400">
                      {op.input_item?.price ? `${op.input_item.price.toLocaleString()}` : '-'}
                    </td>
                    {/* 투입 카테고리 */}
                    <td className="px-1 py-1.5 text-center">
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        {op.input_item?.category || '-'}
                      </span>
                    </td>
                    {/* 산출 품번 */}
                    <td className="px-1 py-1.5 text-gray-900 dark:text-white font-medium">
                      <div className="truncate" title={op.output_item?.item_code || ''}>
                        {op.output_item?.item_code || '-'}
                      </div>
                    </td>
                    {/* 산출 품명 */}
                    <td className="px-1 py-1.5 text-gray-700 dark:text-gray-300">
                      <div className="truncate" title={op.output_item?.item_name || ''}>
                        {op.output_item?.item_name || '-'}
                      </div>
                    </td>
                    {/* 산출 수량 (단위 포함) */}
                    <td className="px-1 py-1.5 text-right text-gray-900 dark:text-white font-medium">
                      {op.output_quantity?.toLocaleString() || '-'} <span className="text-gray-500 dark:text-gray-400 font-normal">{op.output_item?.unit || ''}</span>
                    </td>
                    {/* 산출 단가 */}
                    <td className="px-1 py-1.5 text-right text-gray-600 dark:text-gray-400">
                      {op.output_item?.price ? `${op.output_item.price.toLocaleString()}` : '-'}
                    </td>
                    {/* 산출 카테고리 */}
                    <td className="px-1 py-1.5 text-center">
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        {op.output_item?.category || '-'}
                      </span>
                    </td>
                    {/* 수율 */}
                    <td className="px-1 py-1.5 text-center">
                      <span className={`font-medium ${op.efficiency >= 95 ? 'text-green-600 dark:text-green-400' : op.efficiency >= 90 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                        {op.efficiency?.toFixed(0)}%
                      </span>
                    </td>
                    {/* 상태 */}
                    <td className="px-1 py-1.5 text-center">
                      <StatusIcon className={`w-3.5 h-3.5 mx-auto ${status.color}`} />
                    </td>
                    {/* 취소 */}
                    <td className="px-1 py-1.5 text-center">
                      {op.status === 'COMPLETED' && (
                        <button
                          onClick={() => handleCancel(op.operation_id, op.lot_number)}
                          className="p-0.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          title={`취소 (LOT: ${op.lot_number})`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 푸터 */}
      {operations.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <span>
              총 {operations.length}건 |
              투입 합계: {operations.reduce((sum, op) => sum + (op.input_quantity || 0), 0).toLocaleString()} |
              산출 합계: {operations.reduce((sum, op) => sum + (op.output_quantity || 0), 0).toLocaleString()}
            </span>
            <span className="text-gray-400">
              마지막 갱신: {format(new Date(), 'HH:mm:ss')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
