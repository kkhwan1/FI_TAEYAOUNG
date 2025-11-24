'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Table,
  LayoutGrid,
  X,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/hooks/useConfirm';
import { useCompanyFilter } from '@/contexts/CompanyFilterContext';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { safeFetchJson } from '@/lib/fetch-utils';

// Dynamic imports for better code splitting
const Modal = dynamic(() => import('@/components/Modal'), { ssr: false });

const SalesTransactionForm = dynamic(
  () => import('@/components/sales/SalesTransactionForm'),
  { ssr: false }
);

// Types
type PaymentStatus = 'PENDING' | 'PARTIAL' | 'COMPLETE';

type SalesTransaction = {
  transaction_id: number;
  transaction_date: string;
  transaction_no: string;
  customer_id: number;
  item_id: number;
  quantity: number;
  unit_price: number;
  total_amount: number;
  collected_amount: number; // API에서 paid_amount로 매핑됨
  payment_status: PaymentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: {
    company_id: number;
    company_name: string;
    company_code: string;
  };
  item?: {
    item_id: number;
    item_name: string;
    item_code: string;
  };
};

type SortConfig = {
  key: keyof SalesTransaction | 'customer_name' | 'item_name';
  direction: 'asc' | 'desc';
};

interface SalesContentProps {
  className?: string;
}

export default function SalesContent({ className }: SalesContentProps) {
  // State
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'transaction_date',
    direction: 'desc'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<SalesTransaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [selectedCompany, setSelectedCompany] = useState<number | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });

  // Hooks
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { companies, loading: companiesLoading } = useCompanyFilter();

  // Fetch transactions
  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/sales-transactions';
      const params = new URLSearchParams();

      if (selectedCompany !== 'ALL') {
        params.append('company_id', String(selectedCompany));
      }
      if (dateFilter.start) {
        params.append('start_date', dateFilter.start);
      }
      if (dateFilter.end) {
        params.append('end_date', dateFilter.end);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const result = await safeFetchJson(url);

      if (result.success) {
        // API 응답 구조: { success: true, data: { transactions: [...], pagination: {...} } }
        const data = result.data;
        let transactionsArray: any[] = [];
        
        if (Array.isArray(data)) {
          transactionsArray = data;
        } else if (data && Array.isArray(data.transactions)) {
          transactionsArray = data.transactions;
        } else if (data && Array.isArray(data.data)) {
          transactionsArray = data.data;
        } else {
          console.warn('API 응답이 배열이 아닙니다:', data);
          transactionsArray = [];
        }
        
        // paid_amount를 collected_amount로 매핑하고 item 정보 정리
        const mappedTransactions = transactionsArray.map((tx: any) => ({
          ...tx,
          collected_amount: tx.paid_amount ?? 0,
          item: tx.item_name ? {
            item_id: tx.item_id,
            item_name: tx.item_name,
            item_code: tx.item_code || ''
          } : tx.item
        }));
        
        setTransactions(mappedTransactions);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(result.error) || '데이터를 불러오는데 실패했습니다');
      }
    } catch (err) {
      console.error('Error fetching sales transactions:', err);
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다');
      showToast('데이터를 불러오는데 실패했습니다', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedCompany, dateFilter.start, dateFilter.end]);

  // Filtered and sorted transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.transaction_no?.toLowerCase().includes(search) ||
          tx.customer?.company_name?.toLowerCase().includes(search) ||
          tx.item?.item_name?.toLowerCase().includes(search) ||
          tx.notes?.toLowerCase().includes(search)
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((tx) => tx.payment_status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: string | number | null = null;
      let bValue: string | number | null = null;

      switch (sortConfig.key) {
        case 'customer_name':
          aValue = a.customer?.company_name || '';
          bValue = b.customer?.company_name || '';
          break;
        case 'item_name':
          aValue = a.item?.item_name || '';
          bValue = b.item?.item_name || '';
          break;
        default:
          aValue = a[sortConfig.key] as string | number;
          bValue = b[sortConfig.key] as string | number;
      }

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue, 'ko-KR')
          : bValue.localeCompare(aValue, 'ko-KR');
      }

      return sortConfig.direction === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return filtered;
  }, [transactions, searchTerm, statusFilter, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, selectedCompany]);

  // Handlers
  const handleSort = (key: SortConfig['key']) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key: SortConfig['key']) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="h-4 w-4 text-blue-500" />
    ) : (
      <ArrowDown className="h-4 w-4 text-blue-500" />
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedTransactions.map((tx) => tx.transaction_id)));
    }
  };

  const handleSelectOne = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: '삭제 확인',
      message: '이 거래를 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/sales-transactions/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        throw new Error('삭제에 실패했습니다');
      }

      showToast('거래가 삭제되었습니다', 'success');
      fetchTransactions();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('삭제에 실패했습니다', 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = await confirm({
      title: '일괄 삭제 확인',
      message: `선택한 ${selectedIds.size}개의 거래를 삭제하시겠습니까?`,
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      const deletePromises = Array.from(selectedIds).map((id) =>
        fetch(`/api/sales-transactions/${id}`, { method: 'DELETE' })
      );

      await Promise.all(deletePromises);
      showToast(`${selectedIds.size}개의 거래가 삭제되었습니다`, 'success');
      setSelectedIds(new Set());
      fetchTransactions();
    } catch (err) {
      console.error('Bulk delete error:', err);
      showToast('일부 삭제에 실패했습니다', 'error');
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCompany !== 'ALL') params.append('company_id', String(selectedCompany));
      if (dateFilter.start) params.append('start_date', dateFilter.start);
      if (dateFilter.end) params.append('end_date', dateFilter.end);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const url = `/api/export/sales${params.toString() ? `?${params.toString()}` : ''}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('내보내기 실패');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `매출거래_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      showToast('Excel 파일이 다운로드되었습니다', 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('내보내기에 실패했습니다', 'error');
    }
  };

  const handleFormSubmit = async () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
    await fetchTransactions();
    showToast(
      editingTransaction ? '거래가 수정되었습니다' : '거래가 등록되었습니다',
      'success'
    );
  };

  const getStatusBadge = (status: PaymentStatus) => {
    const config = {
      PENDING: {
        label: '미수금',
        icon: <Clock className="h-3 w-3" />,
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      },
      PARTIAL: {
        label: '부분수금',
        icon: <AlertCircle className="h-3 w-3" />,
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      },
      COMPLETE: {
        label: '수금완료',
        icon: <CheckCircle className="h-3 w-3" />,
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      }
    };

    const { label, icon, className: badgeClass } = config[status] || config.PENDING;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badgeClass}`}
      >
        {icon}
        {label}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // Table header component
  const SortableHeader = ({
    label,
    sortKey
  }: {
    label: string;
    sortKey: SortConfig['key'];
  }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {getSortIcon(sortKey)}
      </div>
    </th>
  );

  if (loading) {
    return (
      <div className={`p-4 ${className || ''}`}>
        <TableSkeleton rows={10} columns={8} />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-900 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="거래번호, 고객사, 품목명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'ALL')}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="ALL">전체 상태</option>
              <option value="PENDING">미수금</option>
              <option value="PARTIAL">부분수금</option>
              <option value="COMPLETE">수금완료</option>
            </select>

            {/* Date filters */}
            <input
              type="date"
              value={dateFilter.start}
              onChange={(e) => setDateFilter((prev) => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            />
            <span className="self-center text-gray-500">~</span>
            <input
              type="date"
              value={dateFilter.end}
              onChange={(e) => setDateFilter((prev) => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title={viewMode === 'table' ? '카드 보기' : '테이블 보기'}
              aria-label={viewMode === 'table' ? '카드 보기' : '테이블 보기'}
              data-testid="view-mode-toggle"
            >
              {viewMode === 'table' ? (
                <LayoutGrid className="h-4 w-4" />
              ) : (
                <Table className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={fetchTransactions}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="새로고침"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={handleExport}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Excel 내보내기"
              aria-label="Excel 내보내기"
              data-testid="excel-export-button"
            >
              <FileSpreadsheet className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setEditingTransaction(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">신규 등록</span>
            </button>
          </div>
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="mt-4 flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {selectedIds.size}개 선택됨
            </span>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
              삭제
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400"
            >
              선택 해제
            </button>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="mx-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Content */}
      {viewMode === 'table' ? (
        /* Table View */
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={
                      paginatedTransactions.length > 0 &&
                      selectedIds.size === paginatedTransactions.length
                    }
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </th>
                <SortableHeader label="거래일" sortKey="transaction_date" />
                <SortableHeader label="거래번호" sortKey="transaction_no" />
                <SortableHeader label="고객사" sortKey="customer_name" />
                <SortableHeader label="품목" sortKey="item_name" />
                <SortableHeader label="수량" sortKey="quantity" />
                <SortableHeader label="단가" sortKey="unit_price" />
                <SortableHeader label="총액" sortKey="total_amount" />
                <SortableHeader label="수금액" sortKey="collected_amount" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  상태
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {searchTerm || statusFilter !== 'ALL'
                      ? '검색 결과가 없습니다'
                      : '등록된 거래가 없습니다'}
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => (
                  <tr
                    key={tx.transaction_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(tx.transaction_id)}
                        onChange={() => handleSelectOne(tx.transaction_id)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {formatDate(tx.transaction_date)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">
                      {tx.transaction_no}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {tx.customer?.company_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {tx.item?.item_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right">
                      {tx.quantity?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right">
                      {formatCurrency(tx.unit_price)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 text-right">
                      {formatCurrency(tx.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right">
                      {formatCurrency(tx.collected_amount ?? 0)}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(tx.payment_status)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingTransaction(tx);
                            setIsModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(tx.transaction_id)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 text-sm"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {paginatedTransactions.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
              {searchTerm || statusFilter !== 'ALL'
                ? '검색 결과가 없습니다'
                : '등록된 거래가 없습니다'}
            </div>
          ) : (
            paginatedTransactions.map((tx) => (
              <div
                key={tx.transaction_id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-medium text-blue-600 dark:text-blue-400">
                      {tx.transaction_no}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(tx.transaction_date)}
                    </p>
                  </div>
                  {getStatusBadge(tx.payment_status)}
                </div>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-gray-500 dark:text-gray-400">고객사:</span>{' '}
                    <span className="text-gray-900 dark:text-gray-100">
                      {tx.customer?.company_name || '-'}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-500 dark:text-gray-400">품목:</span>{' '}
                    <span className="text-gray-900 dark:text-gray-100">
                      {tx.item?.item_name || '-'}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-500 dark:text-gray-400">총액:</span>{' '}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(tx.total_amount)}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-500 dark:text-gray-400">수금:</span>{' '}
                    <span className="text-gray-900 dark:text-gray-100">
                      {formatCurrency(tx.collected_amount ?? 0)}
                    </span>
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setEditingTransaction(tx);
                      setIsModalOpen(true);
                    }}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(tx.transaction_id)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 text-sm"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">페이지당</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              / 총 {filteredTransactions.length}건
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTransaction(null);
          }}
          title={editingTransaction ? '매출 거래 수정' : '매출 거래 등록'}
          size="lg"
        >
          <SalesTransactionForm
            transaction={editingTransaction}
            onSubmit={handleFormSubmit}
            onCancel={() => {
              setIsModalOpen(false);
              setEditingTransaction(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
