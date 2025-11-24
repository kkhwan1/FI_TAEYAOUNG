'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Calendar, Filter, ChevronLeft, ChevronRight, RefreshCw, Package, Clock, Play, CheckCircle, TrendingUp } from 'lucide-react';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ProcessTraceabilityTableProps {
  onItemClick?: (processId: number) => void;
  className?: string;
}

interface ProcessTraceabilityData {
  process_id: number;
  process_type: string;
  source_item_id: number;
  source_item_code: string;
  source_item_name: string;
  target_item_id: number;
  target_item_code: string;
  target_item_name: string;
  input_quantity: number;
  output_quantity: number;
  yield_rate: number;
  process_date: string;
  status: 'pending' | 'in_progress' | 'completed';
  lot_number?: string;
  chain_id?: string;
  chain_sequence?: number;
}

interface SummaryStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  avgYield: number;
}

type SortField = 'process_id' | 'process_type' | 'source_item_name' | 'target_item_name' | 'input_quantity' | 'output_quantity' | 'yield_rate' | 'process_date' | 'status';
type SortOrder = 'asc' | 'desc';
type DateRangePreset = 'all' | 'today' | 'week' | 'month' | '3months' | 'year' | 'custom';
type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed';

// ============================================================================
// Constants
// ============================================================================

const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'today', label: '오늘' },
  { value: 'week', label: '1주일' },
  { value: 'month', label: '1개월' },
  { value: '3months', label: '3개월' },
  { value: 'year', label: '1년' },
  { value: 'custom', label: '직접 입력' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '대기' },
  { value: 'in_progress', label: '진행중' },
  { value: 'completed', label: '완료' },
];

const PROCESS_TYPE_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: '블랭킹', label: '블랭킹' },
  { value: '전단', label: '전단' },
  { value: 'Press', label: 'Press 공정' },
  { value: '조립', label: '조립 공정' },
  { value: 'slitting', label: '슬리팅' },
  { value: 'cutting', label: '재단' },
  { value: 'coating', label: '코팅' },
  { value: 'assembly', label: '조립' },
  { value: 'other', label: '기타' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// ============================================================================
// Utility Functions
// ============================================================================

function getDateRange(preset: DateRangePreset): { startDate: string | null; endDate: string | null } {
  const today = new Date();
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  switch (preset) {
    case 'all':
      return { startDate: null, endDate: null };
    case 'today':
      return { startDate: formatDate(today), endDate: formatDate(today) };
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      return { startDate: formatDate(weekAgo), endDate: formatDate(today) };
    }
    case 'month': {
      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      return { startDate: formatDate(monthAgo), endDate: formatDate(today) };
    }
    case '3months': {
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      return { startDate: formatDate(threeMonthsAgo), endDate: formatDate(today) };
    }
    case 'year': {
      const yearAgo = new Date(today);
      yearAgo.setFullYear(today.getFullYear() - 1);
      return { startDate: formatDate(yearAgo), endDate: formatDate(today) };
    }
    default:
      return { startDate: null, endDate: null };
  }
}

function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return '대기';
    case 'in_progress':
      return '진행중';
    case 'completed':
      return '완료';
    default:
      return status;
  }
}

function getYieldRateClasses(yieldRate: number): string {
  if (yieldRate >= 95) {
    return 'text-green-600 dark:text-green-400 font-semibold';
  } else if (yieldRate >= 90) {
    return 'text-yellow-600 dark:text-yellow-400 font-semibold';
  } else {
    return 'text-red-600 dark:text-red-400 font-semibold';
  }
}

function getProcessTypeLabel(processType: string): string {
  const typeMap: Record<string, string> = {
    '블랭킹': '블랭킹',
    '전단': '전단',
    'Press': 'Press 공정',
    '조립': '조립 공정',
    'slitting': '슬리팅',
    'cutting': '재단',
    'coating': '코팅',
    'assembly': '조립',
    'other': '기타',
  };
  return typeMap[processType] || processType;
}

// ============================================================================
// Component
// ============================================================================

export default function ProcessTraceabilityTable({
  onItemClick,
  className = ''
}: ProcessTraceabilityTableProps) {
  // State - Data
  const [data, setData] = useState<ProcessTraceabilityData[]>([]);
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    avgYield: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State - Filters
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [processTypeFilter, setProcessTypeFilter] = useState<string>('all');

  // State - Sorting
  const [sortField, setSortField] = useState<SortField>('process_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // State - Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      // Date range
      let startDate: string | null = null;
      let endDate: string | null = null;

      if (dateRangePreset === 'custom') {
        startDate = customStartDate || null;
        endDate = customEndDate || null;
      } else {
        const range = getDateRange(dateRangePreset);
        startDate = range.startDate;
        endDate = range.endDate;
      }

      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (processTypeFilter !== 'all') params.append('process_type', processTypeFilter);
      // Request large limit to get all data for client-side pagination
      params.append('limit', '1000');

      const queryString = params.toString();
      const url = `/api/coil/traceability/list${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // API returns data in { items, summary, pagination } structure
        const apiData = result.data;
        const items = apiData?.items || [];
        const summary = apiData?.summary;

        // Transform API response to match component's expected format
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transformedData: ProcessTraceabilityData[] = items.map((item: Record<string, any>) => ({
          process_id: item.process_id,
          process_type: item.process_type,
          source_item_id: item.source_item_id,
          source_item_code: item.source_item?.item_code || '',
          source_item_name: item.source_item?.item_name || '',
          target_item_id: item.target_item_id,
          target_item_code: item.target_item?.item_code || '',
          target_item_name: item.target_item?.item_name || '',
          input_quantity: item.input_quantity,
          output_quantity: item.output_quantity,
          yield_rate: item.yield_rate,
          process_date: item.process_date,
          status: item.status,
          lot_number: item.process_operation?.lot_number,
          chain_id: item.process_operation?.chain_id,
          chain_sequence: item.process_operation?.chain_sequence
        }));

        setData(transformedData);

        // Update summary stats from API response
        if (summary) {
          setSummaryStats({
            total: summary.total_count || 0,
            pending: summary.pending_count || 0,
            inProgress: summary.in_progress_count || 0,
            completed: summary.completed_count || 0,
            avgYield: summary.average_yield_rate || 0
          });
        }
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(result.error) || '데이터를 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('Error fetching traceability data:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [dateRangePreset, customStartDate, customEndDate, statusFilter, processTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRangePreset, customStartDate, customEndDate, statusFilter, processTypeFilter]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  // Summary statistics are now managed via state from API response

  // Sorted data
  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      const aValue: string | number = a[sortField] ?? '';
      const bValue: string | number = b[sortField] ?? '';

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc'
          ? aValue.localeCompare(bValue, 'ko')
          : bValue.localeCompare(aValue, 'ko');
      }

      // Handle number comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return sorted;
  }, [data, sortField, sortOrder]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleRowClick = (processId: number) => {
    if (onItemClick) {
      onItemClick(processId);
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortOrder === 'asc'
      ? <ArrowUp className="h-4 w-4 text-blue-500" />
      : <ArrowDown className="h-4 w-4 text-blue-500" />;
  };

  const renderSortableHeader = (field: SortField, label: string, width?: string) => (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none ${width || ''}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {renderSortIcon(field)}
      </div>
    </th>
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            공정 추적성 현황
          </h2>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Total */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg">
                <Package className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">총 공정 수</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {summaryStats.total.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Pending */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-200 dark:bg-yellow-800/50 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-yellow-600 dark:text-yellow-400">대기 중</p>
                <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">
                  {summaryStats.pending.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* In Progress */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-200 dark:bg-blue-800/50 rounded-lg">
                <Play className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400">진행 중</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                  {summaryStats.inProgress.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Completed */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-200 dark:bg-green-800/50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-green-600 dark:text-green-400">완료</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">
                  {summaryStats.completed.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Average Yield */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-200 dark:bg-purple-800/50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-purple-600 dark:text-purple-400">평균 수율</p>
                <p className={`text-xl font-bold ${getYieldRateClasses(summaryStats.avgYield)}`}>
                  {summaryStats.avgYield.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Date Range Filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <select
                value={dateRangePreset}
                onChange={(e) => setDateRangePreset(e.target.value as DateRangePreset)}
                className="block w-full sm:w-32 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {DATE_RANGE_PRESETS.map(preset => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            {dateRangePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="block px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-gray-500 dark:text-gray-400">~</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="block px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="block w-full sm:w-32 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Process Type Filter */}
          <div className="flex items-center gap-2">
            <select
              value={processTypeFilter}
              onChange={(e) => setProcessTypeFilter(e.target.value)}
              className="block w-full sm:w-32 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {PROCESS_TYPE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">데이터를 불러오는 중...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={fetchData}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600"
            >
              다시 시도
            </button>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">조회된 공정 데이터가 없습니다.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                {renderSortableHeader('process_id', '공정ID', 'w-24')}
                {renderSortableHeader('process_type', '공정유형', 'w-28')}
                {renderSortableHeader('source_item_name', '원자재', 'min-w-[150px]')}
                {renderSortableHeader('target_item_name', '생산품', 'min-w-[150px]')}
                {renderSortableHeader('input_quantity', '투입량', 'w-28')}
                {renderSortableHeader('output_quantity', '산출량', 'w-28')}
                {renderSortableHeader('yield_rate', '수율', 'w-24')}
                {renderSortableHeader('process_date', '공정일', 'w-32')}
                {renderSortableHeader('status', '상태', 'w-24')}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedData.map((row) => (
                <tr
                  key={row.process_id}
                  onClick={() => handleRowClick(row.process_id)}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${onItemClick ? 'cursor-pointer' : ''}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {row.process_id}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {getProcessTypeLabel(row.process_type)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    <div>
                      <div className="font-medium">{row.source_item_name || '-'}</div>
                      {row.source_item_code && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {row.source_item_code}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    <div>
                      <div className="font-medium">{row.target_item_name || '-'}</div>
                      {row.target_item_code && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {row.target_item_code}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                    {row.input_quantity?.toLocaleString() ?? '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                    {row.output_quantity?.toLocaleString() ?? '-'}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm text-right ${getYieldRateClasses(row.yield_rate ?? 0)}`}>
                    {row.yield_rate != null ? `${row.yield_rate.toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {row.process_date ? new Date(row.process_date).toLocaleDateString('ko-KR') : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClasses(row.status)}`}>
                      {getStatusLabel(row.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && paginatedData.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Info */}
            <div className="text-sm text-gray-500 dark:text-gray-400">
              총 {sortedData.length.toLocaleString()}건 중{' '}
              {((currentPage - 1) * pageSize + 1).toLocaleString()} -{' '}
              {Math.min(currentPage * pageSize, sortedData.length).toLocaleString()}건 표시
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              {/* Page Size */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">페이지당</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="block w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span className="text-sm text-gray-500 dark:text-gray-400">건</span>
              </div>

              {/* Page Navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  title="첫 페이지"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <ChevronLeft className="h-4 w-4 -ml-2" />
                </button>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  title="이전 페이지"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  title="다음 페이지"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  title="마지막 페이지"
                >
                  <ChevronRight className="h-4 w-4" />
                  <ChevronRight className="h-4 w-4 -ml-2" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
