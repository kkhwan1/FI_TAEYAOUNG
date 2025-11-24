'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import {
  Calendar,
  Search,
  Download,
  History,
  RotateCcw,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';

interface StockHistoryItem {
  transaction_id: number;
  transaction_date: string;
  created_at?: string; // 생성 시간 (시간 정보 포함)
  item_code: string;
  item_name: string;
  transaction_type: string;
  quantity_change: number;
  quantity?: number;
  stock_balance: number;
  unit?: string;
  unit_price?: number;
  total_amount?: number;
  shortage?: number; // 부족 수량 (새 필드)
  company_name?: string;
  reference_number?: string;
  reference_no?: string; // Alternative field name
  notes?: string;
}

interface StockItem {
  item_id: number;
  item_code: string;
  item_name: string;
}

export default function StockHistoryPage() {
  const router = useRouter();
  const { error: showError } = useToast();
  const [stockHistory, setStockHistory] = useState<StockHistoryItem[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortColumn, setSortColumn] = useState<string>('transaction_date');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Initialize date range (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));

    setDateTo(today.toISOString().split('T')[0]);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  // Fetch stock items for dropdown
  useEffect(() => {
    const fetchStockItems = async () => {
      try {
        const { safeFetchJson } = await import('@/lib/fetch-utils');
        const result = await safeFetchJson('/api/stock/items', {}, {
          timeout: 15000,
          maxRetries: 2,
          retryDelay: 1000
        });

        if (result.success) {
          setStockItems(result.data || []);
        }
      } catch (error) {
        console.error('품목 조회 오류:', error);
      }
    };

    fetchStockItems();
  }, []);

  // Fetch stock history
  const fetchStockHistory = async (showLoading: boolean = true) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedItem) params.append('item_id', selectedItem);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/stock/history?${params.toString()}`, {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        setStockHistory(result.data.history || []);
      } else {
        if (showLoading) {
          const { extractErrorMessage } = await import('@/lib/fetch-utils');
          showError(`재고 이력 조회 실패: ${extractErrorMessage(result.error)}`);
        }
        setStockHistory([]);
      }
    } catch (error) {
      console.error('재고 이력 조회 오류:', error);
      if (showLoading) {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showError(extractErrorMessage(error) || '재고 이력 조회 중 오류가 발생했습니다.');
      }
      setStockHistory([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Auto-fetch when filters change
  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchStockHistory();
    }
  }, [selectedItem, dateFrom, dateTo]);

  // 실시간 자동 업데이트 (5초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      if (dateFrom && dateTo) {
        fetchStockHistory(false); // showLoading=false로 깜빡임 방지
      }
    }, 5000); // 5초마다 업데이트

    return () => clearInterval(interval);
  }, [dateFrom, dateTo, selectedItem]);

  // 정렬 핸들러
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // 같은 컬럼 클릭 시 정렬 순서 토글
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // 다른 컬럼 클릭 시 해당 컬럼으로 정렬 (기본: 내림차순)
      setSortColumn(column);
      setSortOrder('desc');
    }
  };

  // Filter history by search term (expanded to include reference_number and notes)
  const filteredHistory = stockHistory
    .filter(item =>
      item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.company_name && item.company_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.reference_number && item.reference_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'transaction_date':
          aValue = new Date(a.transaction_date || a.created_at || 0).getTime();
          bValue = new Date(b.transaction_date || b.created_at || 0).getTime();
          break;
        case 'item_code':
          aValue = a.item_code || '';
          bValue = b.item_code || '';
          break;
        case 'item_name':
          aValue = a.item_name || '';
          bValue = b.item_name || '';
          break;
        case 'quantity_change':
          aValue = a.quantity_change || 0;
          bValue = b.quantity_change || 0;
          break;
        case 'stock_balance':
          aValue = a.stock_balance || 0;
          bValue = b.stock_balance || 0;
          break;
        case 'unit_price':
          aValue = a.unit_price || 0;
          bValue = b.unit_price || 0;
          break;
        case 'total_amount':
          aValue = a.total_amount || 0;
          bValue = b.total_amount || 0;
          break;
        case 'company_name':
          aValue = a.company_name || '';
          bValue = b.company_name || '';
          break;
        case 'reference_number':
          aValue = a.reference_number || a.reference_no || '';
          bValue = b.reference_number || b.reference_no || '';
          break;
        case 'transaction_type':
          aValue = a.transaction_type || '';
          bValue = b.transaction_type || '';
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue, 'ko')
          : bValue.localeCompare(aValue, 'ko');
      } else {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 페이지당 항목 수 변경 시 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  // Get transaction type display info
  const getTransactionTypeInfo = (type: string) => {
    switch (type) {
      case 'IN':
      case '입고':
        return { label: '입고', color: 'border-2 border-gray-800 text-gray-800 bg-transparent dark:border-gray-300 dark:text-gray-300' };
      case 'OUT':
      case '출고':
        return { label: '출고', color: 'border-2 border-gray-800 text-gray-800 bg-transparent dark:border-gray-300 dark:text-gray-300' };
      case '생산입고':
        return { label: '생산입고', color: 'border-2 border-blue-600 text-blue-600 bg-transparent dark:border-blue-400 dark:text-blue-400' };
      case '생산출고':
        return { label: '생산출고', color: 'border-2 border-orange-600 text-orange-600 bg-transparent dark:border-orange-400 dark:text-orange-400' };
      case 'BOM차감':
        return { label: 'BOM차감', color: 'border-2 border-red-600 text-red-600 bg-transparent dark:border-red-400 dark:text-red-400' };
      case 'ADJUST':
      case '조정':
        return { label: '조정', color: 'border-2 border-gray-800 text-gray-800 bg-transparent dark:border-gray-300 dark:text-gray-300' };
      default:
        return { label: type, color: 'border-2 border-gray-800 text-gray-800 bg-transparent dark:border-gray-300 dark:text-gray-300' };
    }
  };

  // Export to CSV
  const exportToCsv = () => {
    const csvContent = [
      ['일자', '품목코드', '품목명', '거래유형', '변동수량', '재고잔량', '거래처', '참조번호', '비고'],
      ...filteredHistory.map(item => [
        new Date(item.transaction_date).toLocaleDateString(),
        item.item_code,
        item.item_name,
        getTransactionTypeInfo(item.transaction_type).label,
        item.quantity_change,
        item.stock_balance,
        item.company_name || '',
        item.reference_no || '',
        item.notes || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `재고이력_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">재고 이력</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">품목별 재고 변동 이력을 조회합니다</p>
          </div>

          <button
            onClick={exportToCsv}
            disabled={filteredHistory.length === 0}
            className="flex items-center gap-1 px-2 py-1 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            CSV 내보내기
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 sm:w-8 sm:h-8 text-gray-800 dark:text-gray-100" />
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">총 거래 건수</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100">{filteredHistory.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">총 재고금액</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
              {filteredHistory.reduce((sum, item) => sum + (item.total_amount || 0), 0).toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' })}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">총 입고수량</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
              {filteredHistory
                .filter(item =>
                  item.transaction_type === 'IN' ||
                  item.transaction_type === '입고' ||
                  item.transaction_type === '생산입고'
                )
                .reduce((sum, item) => sum + Math.abs(item.quantity || item.quantity_change || 0), 0)
                .toLocaleString('ko-KR')} EA
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">총 출고수량</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
              {filteredHistory
                .filter(item =>
                  item.transaction_type === 'OUT' ||
                  item.transaction_type === '출고' ||
                  item.transaction_type === '생산출고'
                )
                .reduce((sum, item) => sum + Math.abs(item.quantity || item.quantity_change || 0), 0)
                .toLocaleString('ko-KR')} EA
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Item Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              품목 선택
            </label>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <option value="">전체 품목</option>
              {stockItems.map((item) => (
                <option key={item.item_id} value={item.item_id}>
                  {item.item_code} - {item.item_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              시작일
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              종료일
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              검색
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="품목명, 코드, 거래처, 참조번호, 비고..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          </div>

          {/* Refresh Button */}
          <div className="flex items-end">
            <button
              onClick={() => fetchStockHistory()}
              disabled={loading}
              className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle whitespace-nowrap">
                  <button
                    onClick={() => handleSort('transaction_date')}
                    className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    거래일자
                    {sortColumn === 'transaction_date' ? (
                      sortOrder === 'asc' ?
                        <ArrowUp className="w-3 h-3" /> :
                        <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle whitespace-nowrap">
                  <button
                    onClick={() => handleSort('transaction_type')}
                    className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    구분
                    {sortColumn === 'transaction_type' ? (
                      sortOrder === 'asc' ?
                        <ArrowUp className="w-3 h-3" /> :
                        <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle whitespace-nowrap">
                  <button
                    onClick={() => handleSort('item_code')}
                    className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    품번/품명
                    {sortColumn === 'item_code' ? (
                      sortOrder === 'asc' ?
                        <ArrowUp className="w-3 h-3" /> :
                        <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle whitespace-nowrap">
                  <button
                    onClick={() => handleSort('quantity_change')}
                    className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                  >
                    수량
                    {sortColumn === 'quantity_change' ? (
                      sortOrder === 'asc' ?
                        <ArrowUp className="w-3 h-3" /> :
                        <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle whitespace-nowrap">
                  <button
                    onClick={() => handleSort('unit_price')}
                    className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                  >
                    단가
                    {sortColumn === 'unit_price' ? (
                      sortOrder === 'asc' ?
                        <ArrowUp className="w-3 h-3" /> :
                        <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle whitespace-nowrap">
                  <button
                    onClick={() => handleSort('total_amount')}
                    className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                  >
                    금액
                    {sortColumn === 'total_amount' ? (
                      sortOrder === 'asc' ?
                        <ArrowUp className="w-3 h-3" /> :
                        <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle whitespace-nowrap">
                  <button
                    onClick={() => handleSort('company_name')}
                    className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    거래처
                    {sortColumn === 'company_name' ? (
                      sortOrder === 'asc' ?
                        <ArrowUp className="w-3 h-3" /> :
                        <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle whitespace-nowrap">
                  <button
                    onClick={() => handleSort('reference_number')}
                    className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    참조번호
                    {sortColumn === 'reference_number' ? (
                      sortOrder === 'asc' ?
                        <ArrowUp className="w-3 h-3" /> :
                        <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50" />
                    )}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 sm:px-6 py-8 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mr-3"></div>
                      <span className="text-gray-500">재고 이력을 조회하고 있습니다...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 sm:px-6 py-8 text-center">
                    <div className="text-gray-500 dark:text-gray-400">
                      <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-lg mb-1">재고 이력이 없습니다</p>
                      <p className="text-sm">조건을 변경하여 다시 조회해보세요</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((item) => {
                  const typeInfo = getTransactionTypeInfo(item.transaction_type);
                  const date = item.transaction_date || item.created_at;
                  const d = date ? new Date(date) : null;
                  const quantity = item.quantity || item.quantity_change || 0;
                  const unitPrice = item.unit_price || 0;
                  const totalAmount = item.total_amount || 0;

                  return (
                    <tr
                      key={item.transaction_id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => {
                        const transactionType = item.transaction_type === '생산입고' ? 'production' :
                                                item.transaction_type === '입고' ? 'receiving' :
                                                item.transaction_type === '출고' ? 'shipping' : 'production';
                        router.push(`/inventory?tab=${transactionType}&transaction_id=${item.transaction_id}`);
                      }}
                    >
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap align-middle">
                        {d ? (
                          <div className="text-sm text-gray-900 dark:text-white">
                            <div className="flex flex-col">
                              <span>
                                {d.toLocaleDateString('ko-KR', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit'
                                }).replace(/\. /g, '.').replace(/\.$/, '')}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {d.toLocaleTimeString('ko-KR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  hour12: false
                                })}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden align-middle text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full truncate ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden align-middle">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={item.item_code}>
                            {item.item_code}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={item.item_name}>
                            {item.item_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right align-middle">
                        {quantity > 0 ? '+' : ''}{quantity.toLocaleString('ko-KR')} {item.unit || 'EA'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right align-middle">
                        {unitPrice?.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' }) || '₩0'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right align-middle">
                        {totalAmount?.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' }) || '₩0'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden text-sm text-gray-500 dark:text-gray-400 truncate align-middle" title={item.company_name || '-'}>
                        {item.company_name || '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden text-sm text-gray-500 dark:text-gray-400 truncate align-middle" title={item.reference_number || item.reference_no || '-'}>
                        {item.reference_number || item.reference_no || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* 페이지네이션 컨트롤 */}
        {paginatedHistory.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 gap-3">
            {/* 페이지당 항목 수 선택 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">페이지당:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value={30}>30개</option>
                <option value={50}>50개</option>
                <option value={70}>70개</option>
                <option value={100}>100개</option>
                <option value={130}>130개</option>
              </select>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                총 {filteredHistory.length.toLocaleString()}개 중 {((currentPage - 1) * itemsPerPage + 1).toLocaleString()}-{Math.min(currentPage * itemsPerPage, filteredHistory.length).toLocaleString()}개 표시
              </span>
            </div>

            {/* 페이지 이동 버튼 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                처음
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                이전
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {currentPage} / {totalPages || 1}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages || 1, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                다음
              </button>
              <button
                onClick={() => setCurrentPage(totalPages || 1)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                마지막
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}