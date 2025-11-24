'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Eye, CheckCircle, XCircle, Trash2, Filter, Calendar, ChevronUp, ChevronDown } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface BatchItem {
  batch_item_id: number;
  item_id: number;
  item_type: 'INPUT' | 'OUTPUT';
  quantity: number;
  unit_price: number;
  defect_quantity: number;
  notes: string;
  item?: {
    item_id: number;
    item_code: string;
    item_name: string;
    spec: string;
    unit: string;
  };
}

interface Batch {
  batch_id: number;
  batch_number: string;
  batch_date: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  notes: string;
  created_at: string;
  items?: BatchItem[];
}

interface BatchListTableProps {
  refreshKey?: number;
}

export default function BatchListTable({ refreshKey }: BatchListTableProps) {
  const { success: showSuccess, error: showError } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchBatches();
  }, [refreshKey]);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await fetch(`/api/batch-registration?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setBatches(result.data || []);
      } else {
        console.error('배치 목록 조회 실패:', result.error);
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showError(`배치 목록 조회 실패: ${extractErrorMessage(result.error)}`);
      }
    } catch (error) {
      console.error('배치 목록 조회 에러:', error);
      const { extractErrorMessage } = await import('@/lib/fetch-utils');
      showError(extractErrorMessage(error) || '배치 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (batchId: number) => {
    try {
      const response = await fetch(`/api/batch-registration/${batchId}`);
      const result = await response.json();

      if (result.success) {
        setSelectedBatch(result.data);
        setShowDetailModal(true);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showError(`배치 상세 조회 실패: ${extractErrorMessage(result.error)}`);
      }
    } catch (error) {
      console.error('배치 상세 조회 에러:', error);
      const { extractErrorMessage } = await import('@/lib/fetch-utils');
      showError(extractErrorMessage(error) || '배치 상세 정보를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const handleUpdateStatus = async (batchId: number, status: 'COMPLETED' | 'CANCELLED') => {
    const confirmMessage = status === 'COMPLETED'
      ? '배치를 완료 처리하시겠습니까?\n재고가 자동으로 이동됩니다.'
      : '배치를 취소하시겠습니까?';

    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch(`/api/batch-registration/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ status }),
      });

      const result = await response.json();

      if (result.success) {
        showSuccess(result.message || '배치 상태가 업데이트되었습니다.');
        fetchBatches();
        if (selectedBatch?.batch_id === batchId) {
          setShowDetailModal(false);
          setSelectedBatch(null);
        }
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showError(`상태 변경 실패: ${extractErrorMessage(result.error)}`);
      }
    } catch (error) {
      console.error('배치 상태 변경 에러:', error);
      const { extractErrorMessage } = await import('@/lib/fetch-utils');
      showError(extractErrorMessage(error) || '배치 상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (batchId: number) => {
    if (!confirm('이 배치를 삭제하시겠습니까?\n완료된 배치는 삭제할 수 없습니다.')) return;

    try {
      const response = await fetch(`/api/batch-registration/${batchId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        showSuccess(result.message || '배치가 삭제되었습니다.');
        fetchBatches();
        if (selectedBatch?.batch_id === batchId) {
          setShowDetailModal(false);
          setSelectedBatch(null);
        }
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showError(`삭제 실패: ${extractErrorMessage(result.error)}`);
      }
    } catch (error) {
      console.error('배치 삭제 에러:', error);
      const { extractErrorMessage } = await import('@/lib/fetch-utils');
      showError(extractErrorMessage(error) || '배치 삭제 중 오류가 발생했습니다.');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      IN_PROGRESS: { label: '진행중', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
      COMPLETED: { label: '완료', color: 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100' },
      CANCELLED: { label: '취소', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.IN_PROGRESS;

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const handleSearch = () => {
    fetchBatches();
  };

  const handleReset = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setStartDate('');
    setEndDate('');
    setTimeout(() => fetchBatches(), 0);
  };

  // TASK-023: Table sorting with useMemo optimization
  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        // Reset to no sorting
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (key: string) => {
    if (sortKey !== key) {
      return (
        <div className="inline-flex flex-col ml-1">
          <ChevronUp className="h-3 w-3 text-gray-400" />
          <ChevronDown className="h-3 w-3 text-gray-400 -mt-2" />
        </div>
      );
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 inline ml-1" />
    );
  };

  const sortedBatches = useMemo(() => {
    if (!sortKey) return batches;

    return [...batches].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      // Handle computed fields
      if (sortKey === 'items.length') {
        aVal = a.items?.length || 0;
        bVal = b.items?.length || 0;
      } else {
        aVal = (a as any)[sortKey];
        bVal = (b as any)[sortKey];
      }

      // Handle null values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Type-specific comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal, 'ko-KR');
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      return 0;
    });
  }, [batches, sortKey, sortDirection]);

  return (
    <div className="space-y-4">
      {/* Search and Filter Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              검색
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="배치 번호로 검색..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              상태
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">전체</option>
              <option value="IN_PROGRESS">진행중</option>
              <option value="COMPLETED">완료</option>
              <option value="CANCELLED">취소</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              시작일
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              종료일
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSearch}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors"
          >
            <Filter className="w-4 h-4" />
            검색
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            초기화
          </button>
        </div>
      </div>

      {/* Batch List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : batches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <p className="text-lg font-medium">배치 내역이 없습니다</p>
            <p className="text-sm mt-2">새로운 배치를 등록해주세요</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('batch_number')}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      배치 번호
                      {getSortIcon('batch_number')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('batch_date')}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      배치 날짜
                      {getSortIcon('batch_date')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('status')}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      상태
                      {getSortIcon('status')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('items.length')}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      품목 수
                      {getSortIcon('items.length')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('notes')}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      메모
                      {getSortIcon('notes')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('created_at')}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      등록일시
                      {getSortIcon('created_at')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedBatches.map((batch) => (
                  <tr key={batch.batch_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {batch.batch_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(batch.batch_date).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(batch.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {batch.items?.length || 0}개
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {batch.notes || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(batch.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(batch.batch_id)}
                          className="p-1 text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                          title="상세보기"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {batch.status === 'IN_PROGRESS' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(batch.batch_id, 'COMPLETED')}
                              className="p-1 text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                              title="완료"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(batch.batch_id, 'CANCELLED')}
                              className="p-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                              title="취소"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(batch.batch_id)}
                              className="p-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  배치 상세 정보
                </h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              {/* Batch Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    배치 번호
                  </label>
                  <p className="text-gray-900 dark:text-white">{selectedBatch.batch_number}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    배치 날짜
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(selectedBatch.batch_date).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    상태
                  </label>
                  {getStatusBadge(selectedBatch.status)}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    등록일시
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(selectedBatch.created_at).toLocaleString('ko-KR')}
                  </p>
                </div>
                {selectedBatch.notes && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      메모
                    </label>
                    <p className="text-gray-900 dark:text-white">{selectedBatch.notes}</p>
                  </div>
                )}
              </div>

              {/* Items */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  투입/산출 품목
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 dark:border-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          구분
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          품번
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          품명
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          규격
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          수량
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          단가
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          불량수량
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          메모
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBatch.items?.map((item) => (
                        <tr key={item.batch_item_id} className="border-b border-gray-200 dark:border-gray-700">
                          <td className="px-4 py-2 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              item.item_type === 'INPUT'
                                ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                : 'bg-gray-300 text-gray-900 dark:bg-gray-600 dark:text-gray-100'
                            }`}>
                              {item.item_type === 'INPUT' ? '투입' : '산출'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                            {item.item?.item_code}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                            {item.item?.item_name}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                            {item.item?.spec || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-white">
                            {item.quantity.toLocaleString('ko-KR')} {item.item?.unit}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-white">
                            ₩{item.unit_price.toLocaleString('ko-KR')}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-white">
                            {item.defect_quantity > 0
                              ? `${item.defect_quantity.toLocaleString('ko-KR')} ${item.item?.unit}`
                              : '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                            {item.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              {selectedBatch.status === 'IN_PROGRESS' && (
                <div className="flex justify-end gap-2 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handleUpdateStatus(selectedBatch.batch_id, 'COMPLETED')}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    배치 완료
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedBatch.batch_id, 'CANCELLED')}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    배치 취소
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
