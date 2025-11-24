/**
 * Inventory Classification Widget
 * Displays statistics for inventory classification types
 * Phase 3 - Inventory Classification System
 */

import React, { useEffect, useState } from 'react';
import { Package, AlertCircle, RefreshCw } from 'lucide-react';
import { formatKoreanNumber } from '../../utils/chartUtils';

interface ClassificationStat {
  type: string;
  count: number;
  total_stock: number;
}

interface ClassificationStats {
  stats: ClassificationStat[];
  total_count: number;
  total_stock: number;
}

interface InventoryClassificationWidgetProps {
  className?: string;
  onRefresh?: () => void;
}

export const InventoryClassificationWidget: React.FC<InventoryClassificationWidgetProps> = ({
  className = '',
  onRefresh
}) => {
  const [data, setData] = useState<ClassificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClassificationStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/inventory/classification');

      if (!response.ok) {
        throw new Error(`Failed to fetch classification stats: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(result.error) || 'Failed to load classification statistics');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching classification stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassificationStats();
  }, []);

  const handleRefresh = () => {
    fetchClassificationStats();
    if (onRefresh) {
      onRefresh();
    }
  };

  // Map classification types to colors and icons
  const getTypeStyle = (type: string) => {
    switch (type) {
      case '완제품':
        return {
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-700 dark:text-blue-300',
          iconColor: 'text-blue-600 dark:text-blue-400'
        };
      case '반제품':
        return {
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          textColor: 'text-green-700 dark:text-green-300',
          iconColor: 'text-green-600 dark:text-green-400'
        };
      case '고객재고':
        return {
          bgColor: 'bg-purple-50 dark:bg-purple-900/20',
          borderColor: 'border-purple-200 dark:border-purple-800',
          textColor: 'text-purple-700 dark:text-purple-300',
          iconColor: 'text-purple-600 dark:text-purple-400'
        };
      case '원재료':
        return {
          bgColor: 'bg-orange-50 dark:bg-orange-900/20',
          borderColor: 'border-orange-200 dark:border-orange-800',
          textColor: 'text-orange-700 dark:text-orange-300',
          iconColor: 'text-orange-600 dark:text-orange-400'
        };
      case '코일':
        return {
          bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
          borderColor: 'border-indigo-200 dark:border-indigo-800',
          textColor: 'text-indigo-700 dark:text-indigo-300',
          iconColor: 'text-indigo-600 dark:text-indigo-400'
        };
      default:
        return {
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          borderColor: 'border-gray-200 dark:border-gray-800',
          textColor: 'text-gray-700 dark:text-gray-300',
          iconColor: 'text-gray-600 dark:text-gray-400'
        };
    }
  };

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            재고 분류 현황
          </h3>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
        <button
          onClick={handleRefresh}
          className="mt-3 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-300 text-sm rounded-lg font-medium"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          재고 분류 현황
        </h3>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Classification Cards */}
          {/* Show all inventory types, including those with 0 count for better UX */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {['완제품', '반제품', '고객재고', '원재료', '코일'].map((type) => {
              const stat = data?.stats?.find(s => s.type === type);
              const displayStat = stat || { type, count: 0, total_stock: 0 };
              const style = getTypeStyle(displayStat.type);
              
              // Use lighter/grayed out style for zero-count types
              const isZero = displayStat.count === 0;
              
                return (
                  <div
                  key={displayStat.type}
                  className={`${isZero ? 'bg-gray-50 dark:bg-gray-800/50' : style.bgColor} rounded-lg p-3 border ${isZero ? 'border-gray-200 dark:border-gray-700' : style.borderColor} ${isZero ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                    <Package className={`w-4 h-4 ${isZero ? 'text-gray-400 dark:text-gray-500' : style.iconColor}`} />
                    <span className={`text-sm font-medium ${isZero ? 'text-gray-500 dark:text-gray-400' : style.textColor}`}>
                      {displayStat.type}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-baseline">
                      <span className={`text-xl font-bold ${isZero ? 'text-gray-400 dark:text-gray-500' : style.textColor}`}>
                        {formatKoreanNumber(displayStat.count)}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400 ml-1">
                          개
                        </span>
                      </div>
                    <div className={`text-xs ${isZero ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'}`}>
                      재고: {formatKoreanNumber(displayStat.total_stock)}
                      </div>
                    </div>
                  </div>
                );
            })}
          </div>

          {/* Summary */}
          {data && data.stats.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">전체</span>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600 dark:text-gray-400">품목:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatKoreanNumber(data.total_count)}개
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600 dark:text-gray-400">재고:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatKoreanNumber(data.total_stock)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
