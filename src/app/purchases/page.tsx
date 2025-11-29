'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import dynamicImport from 'next/dynamic';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Grid,
  List,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RotateCcw
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/hooks/useConfirm';
import { CompanyFilterSelect } from '@/components/filters/CompanyFilterSelect';
import { useCompanyFilter } from '@/contexts/CompanyFilterContext';

const Modal = dynamicImport(() => import('@/components/Modal'), { ssr: false });
const PurchaseForm = dynamicImport(() => import('@/components/forms/PurchaseForm'), { ssr: false });

type PaymentStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';

type PurchaseTransaction = {
  transaction_id: number;
  transaction_date: string;
  transaction_no: string;
  supplier_id: number;
  item_id: number;
  item_name: string;
  spec?: string;
  quantity: number;
  unit_price: number;
  supply_amount: number;
  tax_amount?: number;
  total_amount: number;
  payment_status?: PaymentStatus;
  payment_due_date?: string;
  delivery_date?: string;
  notes?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  supplier?: {
    company_id: number;
    company_name: string;
    company_code: string;
  };
  item?: {
    item_id: number;
    item_name: string;
    item_code: string;
    spec?: string;
  };
};

const PAYMENT_STATUS_OPTIONS = [
  { value: 'PENDING', label: '대기', color: 'text-gray-600 dark:text-gray-400' },
  { value: 'PARTIAL', label: '부분', color: 'text-gray-600 dark:text-gray-400' },
  { value: 'COMPLETED', label: '완료', color: 'text-gray-600 dark:text-gray-400' }
] as const;

export default function PurchasesPage() {
  const [transactions, setTransactions] = useState<PurchaseTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<PurchaseTransaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortColumn, setSortColumn] = useState<string>('transaction_date');

  // 새 필터 상태
  const [selectedCompany, setSelectedCompany] = useState<number | 'ALL'>('ALL');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { companies, loading: companiesLoading } = useCompanyFilter();

  // 매입 거래 목록 조회
  const fetchTransactions = async () => {
    try {
      setIsLoading(true);

      // 중앙 집중식 필터 헬퍼 사용
      const { buildFilteredApiUrl } = await import('@/lib/filters');
      const additionalParams: Record<string, string> = {};
      if (searchTerm) additionalParams.search = searchTerm;
      if (filterStatus) additionalParams.payment_status = filterStatus;
      if (startDate) additionalParams.start_date = startDate;
      if (endDate) additionalParams.end_date = endDate;
      if (minAmount) additionalParams.min_amount = minAmount;
      if (maxAmount) additionalParams.max_amount = maxAmount;

      const url = buildFilteredApiUrl(
        '/api/purchases',
        selectedCompany === 'ALL' ? null : selectedCompany,
        additionalParams
      );

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(url, {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        // Phase 6A API structure: { data: [...] } or { data: { transactions, pagination } }
        setTransactions(Array.isArray(result.data) ? result.data : result.data?.transactions || []);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showToast(extractErrorMessage(result.error) || '매입 거래 조회 실패', 'error');
      }
    } catch (error) {
      console.error('Error fetching purchase transactions:', error);
      showToast('매입 거래 조회 중 오류가 발생했습니다', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [searchTerm, filterStatus, startDate, endDate, selectedCompany, minAmount, maxAmount]);

  // 매입 거래 추가
  const handleAdd = () => {
    setSelectedTransaction(null);
    setIsFormOpen(true);
  };

  // 매입 거래 수정
  const handleEdit = (transaction: PurchaseTransaction) => {
    setSelectedTransaction(transaction);
    setIsFormOpen(true);
  };

  // 매입 거래 삭제
  const handleDelete = async (transaction: PurchaseTransaction) => {
    const confirmed = await confirm({
      title: '매입 거래 삭제',
      message: `거래번호 ${transaction.transaction_no}를 삭제하시겠습니까?\n재고가 ${transaction.quantity}만큼 감소됩니다.`,
      confirmText: '삭제',
      cancelText: '취소'
    });

    if (!confirmed) return;

    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/purchases?id=${transaction.transaction_id}`, {
        method: 'DELETE',
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        showToast('매입 거래가 삭제되고 재고가 조정되었습니다', 'success');
        fetchTransactions();
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showToast(extractErrorMessage(result.error) || '삭제 실패', 'error');
      }
    } catch (error) {
      console.error('Error deleting purchase transaction:', error);
      showToast('삭제 중 오류가 발생했습니다', 'error');
    }
  };

  // 필터 초기화
  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterStatus('');
    setStartDate('');
    setEndDate('');
    setSelectedCompany('ALL');
    setMinAmount('');
    setMaxAmount('');
  };

  // 폼 저장
  const handleSaveTransaction = async (data: Partial<PurchaseTransaction>) => {
    try {
      const url = selectedTransaction
        ? `/api/purchases/${selectedTransaction.transaction_id}`
        : '/api/purchases';

      const method = selectedTransaction ? 'PUT' : 'POST';

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
          selectedTransaction ? '매입 거래가 수정되었습니다' : '매입 거래가 등록되고 재고가 증가되었습니다',
          'success'
        );
        setIsFormOpen(false);
        fetchTransactions();
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showToast(extractErrorMessage(result.error) || '저장 실패', 'error');
      }
    } catch (error) {
      console.error('Error saving purchase transaction:', error);
      showToast('저장 중 오류가 발생했습니다', 'error');
    }
  };

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

  // 필터링된 거래 목록
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // 검색어 필터링 (거래번호, 품목명, 공급사명)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((transaction) => {
        const transactionNo = transaction.transaction_no?.toLowerCase() || '';
        const itemName = transaction.item_name?.toLowerCase() || '';
        const supplierName = transaction.supplier?.company_name?.toLowerCase() || '';
        return (
          transactionNo.includes(searchLower) ||
          itemName.includes(searchLower) ||
          supplierName.includes(searchLower)
        );
      });
    }

    // 지급 상태 필터링
    if (filterStatus) {
      filtered = filtered.filter((transaction) => {
        return transaction.payment_status === filterStatus;
      });
    }

    // 정렬 적용
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'transaction_date':
          aValue = new Date(a.created_at || a.transaction_date).getTime();
          bValue = new Date(b.created_at || b.transaction_date).getTime();
          break;
        case 'transaction_no':
          aValue = a.transaction_no || '';
          bValue = b.transaction_no || '';
          break;
        case 'company_name':
          aValue = a.supplier?.company_name || '';
          bValue = b.supplier?.company_name || '';
          break;
        case 'item_name':
          aValue = a.item_name || '';
          bValue = b.item_name || '';
          break;
        case 'quantity':
          aValue = a.quantity || 0;
          bValue = b.quantity || 0;
          break;
        case 'unit_price':
          aValue = a.unit_price || 0;
          bValue = b.unit_price || 0;
          break;
        case 'total_amount':
          aValue = a.total_amount || 0;
          bValue = b.total_amount || 0;
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
  }, [transactions, searchTerm, filterStatus, sortColumn, sortOrder]);

  // 지급 상태별 색상
  const getPaymentStatusColor = (status?: PaymentStatus) => {
    const option = PAYMENT_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.color || 'text-gray-600 dark:text-gray-400';
  };

  // 지급 상태 라벨
  const getPaymentStatusLabel = (status?: PaymentStatus) => {
    const option = PAYMENT_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.label || '-';
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">매입 관리</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          매입 거래 내역을 관리합니다
        </p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 검색 */}
          <div className="flex flex-col gap-1">
            <label htmlFor="search-filter" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              검색
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="search-filter"
                type="text"
                placeholder="거래번호, 품목명, 공급사명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* 공급사 필터 */}
          <div>
            <CompanyFilterSelect
              value={selectedCompany}
              onChange={(value) => setSelectedCompany(value === '' ? 'ALL' : Number(value))}
              label="공급사"
              placeholder="전체 공급사"
              className="w-full"
              showLabel={true}
            />
          </div>

          {/* 지급 상태 필터 */}
          <div className="flex flex-col gap-1">
            <label htmlFor="status-filter" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              지급 상태
            </label>
            <select
              id="status-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as PaymentStatus | '')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            >
              <option value="">전체 상태</option>
              {PAYMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 두 번째 행: 날짜 및 금액 필터 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          {/* 시작일 */}
          <div className="flex flex-col gap-1">
            <label htmlFor="start-date-filter" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              시작일
            </label>
            <input
              id="start-date-filter"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
          </div>

          {/* 종료일 */}
          <div className="flex flex-col gap-1">
            <label htmlFor="end-date-filter" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              종료일
            </label>
            <input
              id="end-date-filter"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
          </div>

          {/* 최소 금액 */}
          <div className="flex flex-col gap-1">
            <label htmlFor="min-amount-filter" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              최소 금액
            </label>
            <input
              id="min-amount-filter"
              type="number"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder="최소 금액"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
          </div>

          {/* 최대 금액 */}
          <div className="flex flex-col gap-1">
            <label htmlFor="max-amount-filter" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              최대 금액
            </label>
            <input
              id="max-amount-filter"
              type="number"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              placeholder="최대 금액"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-1.5">
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            필터 초기화
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs font-medium whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            매입 등록
          </button>
        </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {/* 뷰 전환 토글 (모바일만) */}
        <div className="sm:hidden flex items-center justify-end gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            <List className="w-3 h-3" />
            테이블
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'card'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Grid className="w-3 h-3" />
            카드
          </button>
        </div>

        {/* 테이블 뷰 */}
        <div className={viewMode === 'card' ? 'hidden' : 'block'}>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('transaction_no')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      거래번호
                      {sortColumn === 'transaction_no' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('company_name')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      공급사
                      {sortColumn === 'company_name' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('item_name')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      품목
                      {sortColumn === 'item_name' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort('quantity')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                    >
                      수량
                      {sortColumn === 'quantity' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
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
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
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
                  <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort('payment_status')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mx-auto"
                    >
                      지급상태
                      {sortColumn === 'payment_status' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 sm:px-6 py-12 text-center text-gray-600 dark:text-gray-400">
                      매입 거래가 없습니다
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <tr key={transaction.transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-900 dark:text-white">
                          <div className="flex flex-col">
                            {(() => {
                              const date = (transaction as any).created_at || transaction.transaction_date;
                              const d = new Date(date);
                              return (
                                <>
                                  <span>
                                    {d.toLocaleDateString('ko-KR', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit'
                                    }).replace(/\. /g, '.').replace(/\.$/, '')}
                                  </span>
                                  {(transaction as any).created_at && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {d.toLocaleTimeString('ko-KR', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit',
                                        hour12: false
                                      })}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={transaction.transaction_no}>
                          {transaction.transaction_no}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-900 dark:text-white truncate" title={transaction.supplier?.company_name || '-'}>
                          {transaction.supplier?.company_name || '-'}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-900 dark:text-white truncate" title={transaction.item_name || transaction.item?.item_name || '-'}>
                          {transaction.item_name || transaction.item?.item_name || '-'}
                        </div>
                        {(transaction.spec || transaction.item?.spec) && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 truncate" title={transaction.spec || transaction.item?.spec}>
                            {transaction.spec || transaction.item?.spec}
                          </div>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm text-right text-gray-900 dark:text-white truncate">
                          {transaction.quantity.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm text-right text-gray-900 dark:text-white truncate">
                          {transaction.unit_price.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm text-right font-medium text-gray-900 dark:text-white truncate">
                          {transaction.total_amount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden text-center">
                        <span className={`font-medium text-sm truncate ${getPaymentStatusColor(transaction.payment_status)}`}>
                          {getPaymentStatusLabel(transaction.payment_status)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(transaction)}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(transaction)}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        </div>

        {/* 카드 뷰 (모바일만) */}
        {viewMode === 'card' && (
          <div className="sm:hidden p-3 space-y-3">
            {isLoading ? (
              <div className="text-center py-8">로딩 중...</div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                매입 거래가 없습니다
              </div>
            ) : (
              filteredTransactions.map((transaction) => (
                <div key={transaction.transaction_id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium text-sm text-gray-900 dark:text-white">
                        {transaction.transaction_no}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {(() => {
                          const date = (transaction as any).created_at || transaction.transaction_date;
                          const d = new Date(date);
                          return (transaction as any).created_at
                            ? `${d.toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                              }).replace(/\. /g, '.').replace(/\.$/, '')} ${d.toLocaleTimeString('ko-KR', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                              })}`
                            : d.toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                              }).replace(/\. /g, '.').replace(/\.$/, '');
                        })()}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${getPaymentStatusColor(transaction.payment_status)}`}>
                      {getPaymentStatusLabel(transaction.payment_status)}
                    </span>
                  </div>
                  <div className="text-sm mb-2">
                    <div className="font-medium">{transaction.item_name || transaction.item?.item_name || '-'}</div>
                    {(transaction.spec || transaction.item?.spec) && (
                      <div className="text-xs text-gray-600 dark:text-gray-400">{transaction.spec || transaction.item?.spec}</div>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400 mb-2">
                    <span>공급사: {transaction.supplier?.company_name || '-'}</span>
                    <span>수량: {transaction.quantity.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      단가: ₩{transaction.unit_price.toLocaleString()}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      ₩{transaction.total_amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(transaction)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                    >
                      <Edit2 className="w-3 h-3" />
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(transaction)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                    >
                      <Trash2 className="w-3 h-3" />
                      삭제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 매입 거래 폼 모달 */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedTransaction ? '매입 거래 수정' : '매입 거래 등록'}
        size="lg"
      >
        <PurchaseForm
          transaction={selectedTransaction}
          onSave={handleSaveTransaction}
          onCancel={() => setIsFormOpen(false)}
        />
      </Modal>
    </div>
  );
}
