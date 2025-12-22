'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { RefreshCw, Trash2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ReceivingHistoryItem } from '@/types/receiving';

interface ReceivingHistoryProps {
  refreshTrigger?: number;
  onRefresh?: () => void;
  workDate?: string;  // YYYY-MM-DD 형식, 미지정시 금일
}

export default function ReceivingHistory({ refreshTrigger, onRefresh, workDate }: ReceivingHistoryProps) {
  const [transactions, setTransactions] = useState<ReceivingHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 작업일자 (prop 또는 금일)
  const targetDate = workDate || format(new Date(), 'yyyy-MM-dd');

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/inventory/receiving?start_date=${targetDate}&end_date=${targetDate}&limit=50`
      );
      const result = await response.json();

      if (result.success) {
        const transactionsData = result.data?.transactions || result.data || [];
        const todayData = (Array.isArray(transactionsData) ? transactionsData : []).filter((t: any) => {
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

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, refreshTrigger]);

  const handleDelete = async (transactionId: number, itemCode: string) => {
    if (!confirm(`${itemCode} 입고를 삭제하시겠습니까?\n재고가 차감됩니다.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/inventory/receiving/${transactionId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        toast.success('입고가 삭제되었습니다.');
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
      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-300 rounded-lg p-4 text-center">
        <p className="text-gray-900 dark:text-white">{error}</p>
        <button
          onClick={fetchTransactions}
          className="mt-2 text-sm text-gray-900 dark:text-white underline hover:no-underline"
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
          <Package className="w-4 h-4 text-gray-900 dark:text-white" />
          <h3 className="font-semibold text-gray-900 dark:text-white">입고 이력</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({targetDate})
          </span>
          <span className="px-2 py-0.5 text-xs font-medium bg-gray-50 dark:bg-gray-900 border border-gray-400 text-gray-900 dark:text-white rounded-full">
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
            <p>해당 일자의 입고 이력이 없습니다.</p>
            <p className="text-xs mt-1">위에서 입고등록을 진행하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                <th className="px-2 py-2 text-center font-semibold w-16">시간</th>
                <th className="px-2 py-2 text-left font-semibold">품번</th>
                <th className="px-2 py-2 text-left font-semibold">품명</th>
                <th className="px-2 py-2 text-center font-semibold w-20">분류</th>
                <th className="px-2 py-2 text-right font-semibold w-24">수량</th>
                <th className="px-2 py-2 text-right font-semibold w-24">단가</th>
                <th className="px-2 py-2 text-right font-semibold w-28">금액</th>
                <th className="px-2 py-2 text-left font-semibold">공급업체</th>
                <th className="px-2 py-2 text-center font-semibold w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {transactions.map((tx) => (
                <tr key={tx.transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-2 py-2 text-center text-xs text-gray-600 dark:text-gray-400 font-mono">
                    {formatTime(tx.created_at)}
                  </td>
                  <td className="px-2 py-2 text-sm text-gray-900 dark:text-white font-medium">
                    {tx.item_code}
                  </td>
                  <td className="px-2 py-2 text-sm text-gray-700 dark:text-gray-300">
                    {tx.item_name}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {tx.receiving_type}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right text-sm text-gray-900 dark:text-white">
                    {tx.quantity.toLocaleString()}
                    {tx.weight && (
                      <div className="text-xs text-gray-500">
                        ({tx.weight.toLocaleString()} kg)
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right text-sm text-gray-600 dark:text-gray-400">
                    {tx.unit_price.toLocaleString()}
                  </td>
                  <td className="px-2 py-2 text-right text-sm text-gray-900 dark:text-white font-medium">
                    {tx.total_amount.toLocaleString()}
                  </td>
                  <td className="px-2 py-2 text-sm text-gray-700 dark:text-gray-300">
                    {tx.company_name || '-'}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => handleDelete(tx.transaction_id, tx.item_code)}
                      className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
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
              수량 합계: {transactions.reduce((sum, tx) => sum + tx.quantity, 0).toLocaleString()} |
              금액 합계: {transactions.reduce((sum, tx) => sum + tx.total_amount, 0).toLocaleString()}원
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
