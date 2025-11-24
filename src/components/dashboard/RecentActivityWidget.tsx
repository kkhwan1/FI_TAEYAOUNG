'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Building2,
  RefreshCw
} from 'lucide-react';

interface RecentTransaction {
  transaction_id: number;
  transaction_date: string;
  transaction_type: string;
  item_id: number;
  item_code: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  company_id?: number;
  company_name?: string;
  reference_no?: string;
  user_name?: string;
  created_at: string;
}

interface RecentActivityProps {
  limit?: number;
  hoursRange?: number;
}

const getTransactionTypeInfo = (type: string) => {
  switch (type) {
    case '입고':
      return {
        label: '입고',
        icon: <Building2 className="w-4 h-4" />,
        color: 'text-gray-700 dark:text-gray-400',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-600'
      };
    case '출고':
      return {
        label: '출고',
        icon: <Building2 className="w-4 h-4" />,
        color: 'text-gray-800 dark:text-gray-300',
        bgColor: 'bg-gray-200 dark:bg-gray-700',
        borderColor: 'border-gray-400 dark:border-gray-600'
      };
    case '생산입고':
      return {
        label: '생산입고',
        icon: <Clock className="w-4 h-4" />,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200'
      };
    case '생산출고':
      return {
        label: '생산출고',
        icon: <Clock className="w-4 h-4" />,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200'
      };
    case '조정':
      return {
        label: '재고조정',
        icon: <RefreshCw className="w-4 h-4" />,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200'
      };
    default:
      return {
        label: type,
        icon: <Clock className="w-4 h-4" />,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200'
      };
  }
};

const formatTimeAgo = (dateString: string): string => {
  const now = new Date();
  const transactionDate = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - transactionDate.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) {
    return '방금 전';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}분 전`;
  } else if (diffInMinutes < 1440) { // 24 hours
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours}시간 전`;
  } else {
    const days = Math.floor(diffInMinutes / 1440);
    return `${days}일 전`;
  }
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('ko-KR').format(num);
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const RecentActivityWidget: React.FC<RecentActivityProps> = ({
  limit = 10,
  hoursRange = 24
}) => {
  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentActivity();
  }, [limit, hoursRange]);

  const fetchRecentActivity = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate start date for the range
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (hoursRange * 60 * 60 * 1000));

      const params = new URLSearchParams({
        limit: limit.toString(),
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/inventory?${params}`, {}, {
        timeout: 10000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        // Handle both direct array and paginated response formats
        const transactionData = Array.isArray(result.data) ? result.data : [];
        setTransactions(transactionData);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(result.error) || '최근 활동을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('Error fetching recent activity:', err);
      setError(err instanceof Error ? err.message : '최근 활동을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchRecentActivity();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 flex items-center min-w-fit">
            <Clock className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
            최근 활동 ({hoursRange}시간)
          </h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center space-x-3 p-3 rounded-lg border">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="w-32 h-4 bg-gray-200 rounded mb-1"></div>
                  <div className="w-24 h-3 bg-gray-200 rounded"></div>
                </div>
                <div className="text-right">
                  <div className="w-16 h-4 bg-gray-200 rounded mb-1"></div>
                  <div className="w-12 h-3 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 flex items-center min-w-fit">
            <Clock className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
            최근 활동 ({hoursRange}시간)
          </h3>
          <button
            onClick={handleRefresh}
            className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 font-medium"
          >
            새로고침
          </button>
        </div>
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-700 dark:text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center min-w-fit">
          <Clock className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
          최근 활동 ({hoursRange}시간)
        </h3>
        <button
          onClick={handleRefresh}
          className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 font-medium"
        >
          새로고침
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">최근 {hoursRange}시간 동안의 활동이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {transactions.map((transaction) => {
            const typeInfo = getTransactionTypeInfo(transaction.transaction_type);

            return (
              <div
                key={transaction.transaction_id}
                className={`p-3 rounded-lg border ${typeInfo.bgColor} ${typeInfo.borderColor}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className={`flex-shrink-0 p-2 rounded-full ${typeInfo.bgColor}`}>
                      <div className={typeInfo.color}>
                        {typeInfo.icon}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${typeInfo.bgColor} ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(transaction.created_at)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate mt-1">
                        {transaction.item_name}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{transaction.item_code}</span>
                        {transaction.company_name && (
                          <span className="flex items-center">
                            <Building2 className="w-3 h-3 mr-1" />
                            {transaction.company_name}
                          </span>
                        )}
                        {transaction.reference_no && (
                          <span>참조: {transaction.reference_no}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 ml-4">
                    <p className={`text-sm font-semibold ${typeInfo.color}`}>
                      {transaction.transaction_type === '출고' || transaction.transaction_type === '생산출고' ? '-' : '+'}
                      {formatNumber(transaction.quantity)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {formatCurrency(transaction.total_amount)}
                    </p>
                    {transaction.user_name && (
                      <p className="text-xs text-gray-500 mt-1">
                        {transaction.user_name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecentActivityWidget;