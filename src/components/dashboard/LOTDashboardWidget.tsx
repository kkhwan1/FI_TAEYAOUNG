/**
 * LOT Dashboard Widget
 * Displays real-time LOT tracking operations for the dashboard
 * Phase 3 - Process Operations & LOT Tracking System
 */

import React, { useEffect, useState } from 'react';
import { Package, AlertCircle, RefreshCw, Activity, CheckCircle, Clock } from 'lucide-react';
import { formatKoreanNumber } from '../../utils/chartUtils';

interface ProcessOperation {
  operation_id: number;
  lot_number: string;
  operation_type: string;
  status: string;
  input_quantity: number;
  output_quantity: number;
  efficiency: number | null;
  started_at: string | null;
  completed_at: string | null;
  quality_status: string | null;
  chain_id: string | null;
  chain_sequence: number | null;
  input_item: {
    item_id: number;
    item_code: string;
    item_name: string;
    unit: string;
  };
  output_item: {
    item_id: number;
    item_code: string;
    item_name: string;
    unit: string;
  };
}

interface LOTDashboardData {
  operations: ProcessOperation[];
  summary: {
    total: number;
    active: number;
    completedToday: number;
    avgEfficiency: number;
  };
  statusSummary: {
    PENDING: number;
    IN_PROGRESS: number;
    COMPLETED: number;
    CANCELLED: number;
  };
  qualitySummary: {
    OK: number;
    NG: number;
    REWORK: number;
    PENDING: number;
  };
}

interface LOTDashboardWidgetProps {
  className?: string;
  onRefresh?: () => void;
  limit?: number;
}

export const LOTDashboardWidget: React.FC<LOTDashboardWidgetProps> = ({
  className = '',
  onRefresh,
  limit = 10
}) => {
  const [data, setData] = useState<LOTDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLOTData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/process/lot/dashboard?limit=${limit}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch LOT data: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(result.error) || 'Failed to load LOT dashboard data');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching LOT dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLOTData();
  }, [limit]);

  const handleRefresh = () => {
    fetchLOTData();
    if (onRefresh) {
      onRefresh();
    }
  };

  // Map operation types to Korean labels
  const getOperationTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'BLANKING': '블랭킹',
      'PRESS': '프레스',
      'ASSEMBLY': '조립',
      'PRODUCTION': '생산',
      'INSPECTION': '검사',
      'PACKAGING': '포장',
      'REWORK': '재작업'
    };
    return labels[type] || type;
  };

  // Map status to Korean labels
  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      'PENDING': '대기',
      'IN_PROGRESS': '진행중',
      'COMPLETED': '완료',
      'CANCELLED': '취소'
    };
    return labels[status] || status;
  };

  // Get status color classes
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          bgColor: 'bg-gray-100 dark:bg-gray-700',
          textColor: 'text-gray-800 dark:text-gray-300',
          iconColor: 'text-gray-600 dark:text-gray-400'
        };
      case 'IN_PROGRESS':
        return {
          bgColor: 'bg-blue-100 dark:bg-blue-900/20',
          textColor: 'text-blue-800 dark:text-blue-300',
          iconColor: 'text-blue-600 dark:text-blue-400'
        };
      case 'COMPLETED':
        return {
          bgColor: 'bg-green-100 dark:bg-green-900/20',
          textColor: 'text-green-800 dark:text-green-300',
          iconColor: 'text-green-600 dark:text-green-400'
        };
      case 'CANCELLED':
        return {
          bgColor: 'bg-red-100 dark:bg-red-900/20',
          textColor: 'text-red-800 dark:text-red-300',
          iconColor: 'text-red-600 dark:text-red-400'
        };
      default:
        return {
          bgColor: 'bg-gray-100 dark:bg-gray-700',
          textColor: 'text-gray-800 dark:text-gray-300',
          iconColor: 'text-gray-600 dark:text-gray-400'
        };
    }
  };

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            LOT 추적 현황
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
          LOT 추적 현황
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
        <div className="space-y-3">
          {/* Loading skeleton for summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
          {/* Loading skeleton for operations list */}
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {/* Active Operations */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center space-x-2 mb-1">
                  <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    진행중
                  </span>
                </div>
                <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                  {formatKoreanNumber(data.summary.active)}
                </div>
              </div>

              {/* Completed Today */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                <div className="flex items-center space-x-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    금일 완료
                  </span>
                </div>
                <div className="text-2xl font-bold text-green-800 dark:text-green-300">
                  {formatKoreanNumber(data.summary.completedToday)}
                </div>
              </div>

              {/* Average Efficiency */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center space-x-2 mb-1">
                  <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    평균 효율
                  </span>
                </div>
                <div className="text-2xl font-bold text-purple-800 dark:text-purple-300">
                  {data.summary.avgEfficiency.toFixed(1)}%
                </div>
              </div>

              {/* Total Operations */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-1">
                  <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    전체
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-300">
                  {formatKoreanNumber(data.summary.total)}
                </div>
              </div>
            </div>
          )}

          {/* Recent Operations List */}
          {data && data.operations.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                최근 LOT 작업
              </h4>
              {data.operations.slice(0, 5).map((operation) => {
                const statusColors = getStatusColor(operation.status);
                return (
                  <div
                    key={operation.operation_id}
                    className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                            {operation.lot_number}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors.bgColor} ${statusColors.textColor}`}>
                            {getStatusLabel(operation.status)}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {getOperationTypeLabel(operation.operation_type)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {operation.input_item.item_name} → {operation.output_item.item_name}
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500 dark:text-gray-500">
                          <span>투입: {formatKoreanNumber(operation.input_quantity)} {operation.input_item.unit}</span>
                          <span>산출: {formatKoreanNumber(operation.output_quantity)} {operation.output_item.unit}</span>
                          {operation.efficiency !== null && (
                            <span>효율: {operation.efficiency.toFixed(1)}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              LOT 작업 내역이 없습니다
            </div>
          )}
        </>
      )}
    </div>
  );
};
