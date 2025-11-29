'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import React from 'react';
import dynamicImport from 'next/dynamic';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/hooks/useConfirm';

const Modal = dynamicImport(() => import('@/components/Modal'), { ssr: false });
const InvoiceForm = dynamicImport(() => import('@/components/invoices/InvoiceForm'), { ssr: false });
const InvoiceItemGrid = dynamicImport(() => import('@/components/InvoiceItemGrid'), { ssr: false });
import type { InvoiceItem } from '@/components/InvoiceItemGrid';
import type { Invoice, PaymentStatus } from '@/components/invoices/InvoiceForm';

const PAYMENT_STATUS_OPTIONS = [
  { value: 'PENDING', label: '대기', color: 'text-yellow-600' },
  { value: 'PARTIAL', label: '부분', color: 'text-blue-600' },
  { value: 'COMPLETED', label: '완료', color: 'text-green-600' }
] as const;

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<number>>(new Set());
  const [sortColumn, setSortColumn] = useState<string>('transaction_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<number | null>(null);

  const { showToast } = useToast();
  const { confirm } = useConfirm();

  // 계산서 확장/축소 토글
  const toggleExpand = (invoiceId: number) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  // API items 데이터를 InvoiceItem 형식으로 변환
  const convertItemsToInvoiceItems = (items?: Invoice['items']): InvoiceItem[] => {
    if (!items || items.length === 0) return [];
    
    return items.map((item) => ({
      invoice_item_id: item.invoice_item_id,
      item_id: item.item_id,
      item_code: item.item?.item_code || '',
      item_name: item.item?.item_name || '',
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_amount: item.total_amount,
      unit: item.item?.unit || '',
      spec: item.item?.spec || ''
    }));
  };

  // 계산서 목록 조회
  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterStatus) params.append('payment_status', filterStatus);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/invoices?${params}`, {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        setInvoices(result.data || []);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showToast(extractErrorMessage(result.error) || '계산서 조회 실패', 'error');
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      showToast('계산서 조회 중 오류가 발생했습니다', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [searchTerm, filterStatus, startDate, endDate]);

  // 계산서 추가
  const handleAdd = () => {
    setSelectedInvoice(null);
    setIsFormOpen(true);
  };

  // 계산서 수정
  const handleEdit = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsFormOpen(true);
  };

  // 계산서 삭제
  const handleDelete = async (invoice: Invoice) => {
    const confirmed = await confirm({
      title: '계산서 삭제',
      message: `계산서 ${invoice.transaction_no}를 삭제하시겠습니까?`,
      confirmText: '삭제',
      cancelText: '취소'
    });

    if (!confirmed) return;

    try {
      setDeletingInvoiceId(invoice.transaction_id ?? null);
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/invoices/${invoice.transaction_id}`, {
        method: 'DELETE',
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        setSelectedIds(prev => {
          const next = new Set(prev);
          if (invoice.transaction_id !== undefined) {
            next.delete(invoice.transaction_id);
          }
          return next;
        });
        showToast('계산서가 삭제되었습니다', 'success');
        fetchInvoices();
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showToast(extractErrorMessage(result.error) || '삭제 실패', 'error');
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      showToast('삭제 중 오류가 발생했습니다', 'error');
    } finally {
      setDeletingInvoiceId(null);
    }
  };

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredInvoices.map(i => i.transaction_id).filter((id): id is number => id !== undefined)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 개별 선택/해제
  const handleSelectItem = (invoiceId: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(invoiceId);
      } else {
        next.delete(invoiceId);
      }
      return next;
    });
  };

  // 일괄 삭제
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = await confirm({
      title: '일괄 삭제',
      message: `선택한 ${selectedIds.size}개 계산서를 삭제하시겠습니까?`,
      confirmText: '삭제',
      cancelText: '취소'
    });

    if (!confirmed) return;

    const idsToDelete = Array.from(selectedIds);
    setDeletingInvoiceId(-1); // 일괄 삭제 중 표시

    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const deletePromises = idsToDelete.map(id =>
        safeFetchJson(`/api/invoices/${id}`, {
          method: 'DELETE'
        }, {
          timeout: 15000,
          maxRetries: 2,
          retryDelay: 1000
        })
      );

      const results = await Promise.allSettled(deletePromises);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

      if (failed.length > 0) {
        showToast(`${failed.length}개 계산서 삭제에 실패했습니다`, 'error');
      } else {
        showToast(`${idsToDelete.length}개 계산서가 삭제되었습니다`, 'success');
      }

      setSelectedIds(new Set());
      fetchInvoices();
    } catch (error) {
      console.error('Bulk delete error:', error);
      showToast('일괄 삭제 중 오류가 발생했습니다', 'error');
    } finally {
      setDeletingInvoiceId(null);
    }
  };

  // 정렬 핸들러
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('desc');
    }
  };

  // 폼 저장
  const handleSaveInvoice = async (data: any) => {
    try {
      const url = selectedInvoice
        ? `/api/invoices/${selectedInvoice.transaction_id}`
        : '/api/invoices';

      const method = selectedInvoice ? 'PUT' : 'POST';

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        showToast(
          selectedInvoice ? '계산서가 수정되었습니다' : '계산서가 등록되었습니다',
          'success'
        );
        setIsFormOpen(false);
        fetchInvoices();
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showToast(extractErrorMessage(result.error) || '저장 실패', 'error');
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      showToast('저장 중 오류가 발생했습니다', 'error');
    }
  };

  // 결제 상태별 색상
  const getPaymentStatusColor = (status?: PaymentStatus) => {
    const option = PAYMENT_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.color || 'text-gray-600';
  };

  // 결제 상태 라벨
  const getPaymentStatusLabel = (status?: PaymentStatus) => {
    const option = PAYMENT_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.label || '-';
  };

  // 필터링 및 정렬된 계산서 목록
  const filteredInvoices = useMemo(() => {
    let filtered = [...invoices];

    // 정렬 적용
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'transaction_date':
          aValue = new Date(a.transaction_date || 0).getTime();
          bValue = new Date(b.transaction_date || 0).getTime();
          break;
        case 'transaction_no':
          aValue = a.transaction_no || '';
          bValue = b.transaction_no || '';
          break;
        case 'customer':
          aValue = a.customer?.company_name || '';
          bValue = b.customer?.company_name || '';
          break;
        case 'item_count':
          aValue = a.items?.length || 0;
          bValue = b.items?.length || 0;
          break;
        case 'total_amount':
          aValue = a.total_amount || 0;
          bValue = b.total_amount || 0;
          break;
        case 'payment_method':
          aValue = a.payment_method || '';
          bValue = b.payment_method || '';
          break;
        case 'payment_status':
          aValue = a.payment_status || '';
          bValue = b.payment_status || '';
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

    return filtered;
  }, [invoices, sortColumn, sortOrder]);

  const sortedInvoices = filteredInvoices;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">계산서 관리</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              다중 품목 계산서 및 복합 결제 관리
            </p>
          </div>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6 mb-6">
        {/* 모바일 필터 토글 버튼 */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="sm:hidden flex items-center justify-between w-full mb-3 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">필터</span>
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* 필터 콘텐츠 */}
        <div className={`${showFilters ? 'block' : 'hidden'} sm:block`}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 검색 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                검색
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="계산서 번호, 고객사 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* 결제 상태 필터 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                결제 상태
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as PaymentStatus | '')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체 상태</option>
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 시작일 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 종료일 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                종료일
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              계산서 등록
            </button>
          </div>
        </div>
      </div>

      {/* 일괄 삭제 버튼 */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
          <span className="text-sm text-blue-900 dark:text-blue-100 font-medium">
            {selectedIds.size}개 항목 선택됨
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={deletingInvoiceId === -1}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {deletingInvoiceId === -1 ? '삭제 중...' : `선택 항목 삭제 (${selectedIds.size}개)`}
          </button>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredInvoices.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-gray-600 focus:ring-gray-400 dark:focus:ring-gray-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                    {/* 확장 아이콘 컬럼 */}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('transaction_date')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                    계산서일자
                      {sortColumn === 'transaction_date' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('transaction_no')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                    계산서번호
                      {sortColumn === 'transaction_no' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('customer')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      고객사
                      {sortColumn === 'customer' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('item_count')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mx-auto"
                    >
                      품목 수
                      {sortColumn === 'item_count' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('total_amount')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                    >
                      총액
                      {sortColumn === 'total_amount' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('payment_method')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mx-auto"
                    >
                      결제방법
                      {sortColumn === 'payment_method' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('payment_status')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mx-auto"
                    >
                      결제상태
                      {sortColumn === 'payment_status' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      등록된 계산서가 없습니다
                    </td>
                  </tr>
                ) : (
                  sortedInvoices.map((invoice) => {
                    const invoiceId = invoice.transaction_id ?? 0;
                    const isExpanded = expandedInvoices.has(invoiceId);
                    return (
                      <React.Fragment key={invoiceId}>
                        <tr
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                          onClick={() => toggleExpand(invoiceId)}
                        >
                          <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(invoiceId)}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectItem(invoiceId, e.target.checked);
                              }}
                              className="rounded border-gray-300 text-gray-600 focus:ring-gray-400 dark:focus:ring-gray-500"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(invoiceId);
                              }}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5" />
                              ) : (
                                <ChevronRight className="w-5 h-5" />
                              )}
                            </button>
                          </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {invoice.transaction_date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {invoice.transaction_no}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {invoice.customer?.company_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                        {invoice.items?.length || 0}개
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                        {invoice.total_amount.toLocaleString('ko-KR')}원
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                        {invoice.payment_method === 'COMPOUND' ? (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                            복합결제
                          </span>
                        ) : (
                          <span className="text-gray-600">{invoice.payment_method}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          invoice.payment_status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            : invoice.payment_status === 'PARTIAL'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                        }`}>
                          {getPaymentStatusLabel(invoice.payment_status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(invoice);
                            }}
                            className="text-blue-600 hover:text-blue-800"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(invoice);
                            }}
                            disabled={deletingInvoiceId === invoice.transaction_id}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="삭제"
                          >
                            {deletingInvoiceId === invoice.transaction_id ? (
                              <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && invoice.items && invoice.items.length > 0 && (
                      <tr key={`${invoice.transaction_id}-details`} className="bg-gray-50 dark:bg-gray-800/50">
                        <td colSpan={10} className="px-6 py-4">
                          <div className="transition-all duration-300 ease-in-out">
                            <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                              품목 상세 내역
                            </div>
                            <InvoiceItemGrid
                              items={convertItemsToInvoiceItems(invoice.items)}
                              onItemsChange={() => {}}
                              readOnly={true}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 계산서 폼 모달 */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedInvoice ? '계산서 수정' : '계산서 등록'}
        size="xl"
      >
        <InvoiceForm
          invoice={selectedInvoice}
          onSave={handleSaveInvoice}
          onCancel={() => setIsFormOpen(false)}
        />
      </Modal>
    </div>
  );
}
