'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { RefreshCw, Trash2, Truck } from 'lucide-react';
import toast from 'react-hot-toast';

interface ShippingTransaction {
  transaction_id: number;
  transaction_no: string;
  transaction_date: string;
  transaction_type: string;
  item_id: number;
  item_code: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_amount: number;
  company_id: number | null;
  company_name: string | null;
  reference_no: string | null;
  category: string | null;
  created_at: string;
}

interface ShippingHistoryProps {
  refreshTrigger?: number;
  onRefresh?: () => void;
  workDate?: string;  // YYYY-MM-DD 형식, 미지정시 금일
}

export default function ShippingHistory({ refreshTrigger, onRefresh, workDate }: ShippingHistoryProps) {
  const [transactions, setTransactions] = useState<ShippingTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 작업일자 (prop 또는 금일)
  const targetDate = workDate || format(new Date(), 'yyyy-MM-dd');

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/inventory/shipping?start_date=${targetDate}&end_date=${targetDate}&limit=50`
      );
      const result = await response.json();

      if (result.success) {
        // API 응답 구조: { success: true, data: { transactions: [...] } }
        const transactionsData = result.data?.transactions || result.data || [];
        // 금일 데이터만 필터링
        const todayData = (Array.isArray(transactionsData) ? transactionsData : []).filter((t: ShippingTransaction) => {
          const txDate = t.transaction_date?.split('T')[0] || t.created_at?.split('T')[0] || '';
          return txDate === targetDate;
        });
        setTransactions(todayData);
      } else {
        setError(result.error || '조회 실패');
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      setError('데이터 조회 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [targetDate]);

  // 초기 로드 및 refreshTrigger/workDate 변경 시 재조회
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, refreshTrigger]);

  const handleDelete = async (transactionId: number, itemCode: string) => {
    if (!confirm(`${itemCode} 출고를 삭제하시겠습니까?\n재고가 복구됩니다.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/inventory/shipping/${transactionId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        toast.success('출고가 삭제되었습니다.');
        fetchTransactions();
        onRefresh?.();
      } else {
        toast.error(result.error || '삭제 실패');
      }
    } catch {
      toast.error('삭제 처리 중 오류가 발생했습니다.');
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
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={fetchTransactions}
          className="mt-2 text-sm text-red-700 dark:text-red-300 underline hover:no-underline"
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
          <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">출고 이력</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({targetDate})
          </span>
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
            {transactions.length}건
          </span>
        </div>
        <button
          onClick={fetchTransactions}
          disabled={isLoading}
          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        {isLoading && transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p>데이터 조회 중...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <p>해당 일자의 출고 이력이 없습니다.</p>
            <p className="text-xs mt-1">위에서 출고등록을 진행하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                <th className="px-2 py-2 text-center font-semibold" style={{width: '60px'}}>시간</th>
                <th className="px-2 py-2 text-left font-semibold" style={{width: '120px'}}>품번</th>
                <th className="px-2 py-2 text-left font-semibold">품명</th>
                <th className="px-2 py-2 text-center font-semibold" style={{width: '70px'}}>분류</th>
                <th className="px-2 py-2 text-right font-semibold" style={{width: '100px'}}>수량</th>
                <th className="px-2 py-2 text-right font-semibold" style={{width: '100px'}}>단가</th>
                <th className="px-2 py-2 text-right font-semibold" style={{width: '120px'}}>금액</th>
                <th className="px-2 py-2 text-left font-semibold" style={{width: '120px'}}>납품처</th>
                <th className="px-2 py-2 text-center font-semibold" style={{width: '40px'}}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {transactions.map((tx) => (
                <tr key={tx.transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-xs">
                  {/* 시간 */}
                  <td className="px-2 py-2 text-center text-gray-600 dark:text-gray-400 font-mono">
                    {formatTime(tx.created_at)}
                  </td>
                  {/* 품번 */}
                  <td className="px-2 py-2 text-gray-900 dark:text-white font-medium">
                    <div className="truncate" title={tx.item_code || ''}>
                      {tx.item_code || '-'}
                    </div>
                  </td>
                  {/* 품명 */}
                  <td className="px-2 py-2 text-gray-700 dark:text-gray-300">
                    <div className="truncate" title={tx.item_name || ''}>
                      {tx.item_name || '-'}
                    </div>
                  </td>
                  {/* 분류 */}
                  <td className="px-2 py-2 text-center">
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {tx.category || '-'}
                    </span>
                  </td>
                  {/* 수량 */}
                  <td className="px-2 py-2 text-right text-gray-900 dark:text-white font-medium">
                    {tx.quantity?.toLocaleString() || '-'} <span className="text-gray-500 dark:text-gray-400 font-normal">{tx.unit || ''}</span>
                  </td>
                  {/* 단가 */}
                  <td className="px-2 py-2 text-right text-gray-600 dark:text-gray-400">
                    ₩{tx.unit_price?.toLocaleString() || 0}
                  </td>
                  {/* 금액 */}
                  <td className="px-2 py-2 text-right text-gray-900 dark:text-white font-medium">
                    ₩{tx.total_amount?.toLocaleString() || 0}
                  </td>
                  {/* 납품처 */}
                  <td className="px-2 py-2 text-gray-700 dark:text-gray-300">
                    <div className="truncate" title={tx.company_name || ''}>
                      {tx.company_name || '-'}
                    </div>
                  </td>
                  {/* 삭제 */}
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => handleDelete(tx.transaction_id, tx.item_code)}
                      className="p-0.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 푸터 */}
      {transactions.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <span>
              총 {transactions.length}건 |
              수량 합계: {transactions.reduce((sum, tx) => sum + (tx.quantity || 0), 0).toLocaleString()} |
              금액 합계: ₩{transactions.reduce((sum, tx) => sum + (tx.total_amount || 0), 0).toLocaleString()}
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
