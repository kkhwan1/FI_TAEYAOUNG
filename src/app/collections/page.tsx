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
  Download,
  Grid,
  List,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/hooks/useConfirm';
import { QuickDateSelector } from '@/components/ui/QuickDateSelector';

const Modal = dynamicImport(() => import('@/components/Modal'), { ssr: false });
const CollectionForm = dynamicImport(() => import('@/components/forms/CollectionForm'), { ssr: false });

type PaymentMethod = 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD' | 'BILL';

type Collection = {
  collection_id: number;
  collection_date: string;
  collection_no: string;
  sales_transaction_id: number;
  collected_amount: number;
  payment_method: PaymentMethod;
  bank_name?: string;
  account_number?: string;
  check_number?: string;
  card_number?: string;
  notes?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  sales_transaction?: {
    transaction_id: number;
    transaction_no: string;
    transaction_date: string;
    total_amount: number;
    payment_status: string;
    customer_id: number;
  };
  customer?: {
    company_id: number;
    company_name: string;
    company_code: string;
  };
};

const PAYMENT_METHOD_OPTIONS = [
  { value: 'CASH', label: '현금', color: 'text-gray-600 dark:text-gray-400' },
  { value: 'TRANSFER', label: '계좌이체', color: 'text-gray-600 dark:text-gray-400' },
  { value: 'CHECK', label: '수표', color: 'text-gray-600 dark:text-gray-400' },
  { value: 'CARD', label: '카드', color: 'text-gray-600 dark:text-gray-400' }
];

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<PaymentMethod | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortColumn, setSortColumn] = useState<string>('collection_date');
  const [summary, setSummary] = useState({
    totalOutstanding: 0,     // 총 미수금
    overdueCount: 0,          // 30일 이상 미처리
    thisWeekAmount: 0,        // 이번주 처리 예정
    avgDaysOverdue: 0         // 평균 지연일수
  });

  const { showToast } = useToast();
  const { confirm } = useConfirm();

  // 수금 목록 조회
  const fetchCollections = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterPaymentMethod) params.append('payment_method', filterPaymentMethod);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/collections?${params}`, {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        setCollections(result.data);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showToast(extractErrorMessage(result.error) || '수금 내역 조회 실패', 'error');
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
      showToast('수금 내역 조회 중 오류가 발생했습니다', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
    calculateSummary();
  }, [searchTerm, filterPaymentMethod, startDate, endDate]);

  // 요약 계산
  const calculateSummary = async () => {
    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const data = await safeFetchJson('/api/collections/summary', {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });
      if (data.success) {
        setSummary(data.data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  // 수금 등록
  const handleAdd = () => {
    setSelectedCollection(null);
    setIsFormOpen(true);
  };

  // 수금 수정
  const handleEdit = (collection: Collection) => {
    setSelectedCollection(collection);
    setIsFormOpen(true);
  };

  // 수금 삭제
  const handleDelete = async (collection: Collection) => {
    if (isDeleting === collection.collection_id) return;

    const confirmed = await confirm({
      title: '수금 내역 삭제',
      message: `수금번호 ${collection.collection_no}를 삭제하시겠습니까?\n매출 거래의 수금 금액이 조정됩니다.`,
      confirmText: '삭제',
      cancelText: '취소'
    });

    if (!confirmed) return;

    setIsDeleting(collection.collection_id);
    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/collections?id=${collection.collection_id}`, {
        method: 'DELETE',
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        showToast('수금 내역이 삭제되었습니다', 'success');
        fetchCollections();
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showToast(extractErrorMessage(result.error) || '삭제 실패', 'error');
      }
    } catch (error) {
      console.error('Error deleting collection:', error);
      showToast('삭제 중 오류가 발생했습니다', 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  // 필터 초기화
  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterPaymentMethod('');
    setStartDate('');
    setEndDate('');
  };

  // 폼 저장
  const handleSaveCollection = async (data: Partial<Collection>) => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      const url = selectedCollection
        ? `/api/collections/${selectedCollection.collection_id}`
        : '/api/collections';

      const method = selectedCollection ? 'PUT' : 'POST';

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
          selectedCollection ? '수금 내역이 수정되었습니다' : '수금 내역이 등록되었습니다',
          'success'
        );
        setIsFormOpen(false);
        setSelectedCollection(null);
        fetchCollections();
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showToast(extractErrorMessage(result.error) || '저장 실패', 'error');
      }
    } catch (error) {
      console.error('Error saving collection:', error);
      showToast('저장 중 오류가 발생했습니다', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Excel 다운로드
  const handleExcelDownload = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterPaymentMethod) params.append('payment_method', filterPaymentMethod);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const { safeFetch } = await import('@/lib/fetch-utils');
      const response = await safeFetch(`/api/export/collections?${params}`, {}, {
        timeout: 60000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (!response.ok) {
        throw new Error('다운로드 실패');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `수금내역_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('Excel 파일이 다운로드되었습니다', 'success');
    } catch (error) {
      console.error('Error downloading Excel:', error);
      showToast('Excel 다운로드 중 오류가 발생했습니다', 'error');
    } finally {
      setIsDownloading(false);
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

  // 필터링된 수금 목록
  const filteredCollections = useMemo(() => {
    let filtered = [...collections];

    // 정렬 적용
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'collection_date':
          aValue = new Date((a as any).created_at || a.collection_date).getTime();
          bValue = new Date((b as any).created_at || b.collection_date).getTime();
          break;
        case 'collection_no':
          aValue = a.collection_no || '';
          bValue = b.collection_no || '';
          break;
        case 'sales_transaction_no':
          aValue = a.sales_transaction?.transaction_no || '';
          bValue = b.sales_transaction?.transaction_no || '';
          break;
        case 'company_name':
          aValue = a.customer?.company_name || '';
          bValue = b.customer?.company_name || '';
          break;
        case 'collected_amount':
          aValue = a.collected_amount || 0;
          bValue = b.collected_amount || 0;
          break;
        case 'payment_method':
          aValue = a.payment_method || '';
          bValue = b.payment_method || '';
          break;
        case 'payment_status':
          aValue = a.sales_transaction?.payment_status || '';
          bValue = b.sales_transaction?.payment_status || '';
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
  }, [collections, sortColumn, sortOrder]);

  // 결제방법 색상
  const getPaymentMethodColor = (method?: PaymentMethod) => {
    const option = PAYMENT_METHOD_OPTIONS.find(opt => opt.value === method);
    return option?.color || 'text-gray-600 dark:text-gray-400';
  };

  // 결제방법 라벨
  const getPaymentMethodLabel = (method?: PaymentMethod) => {
    const option = PAYMENT_METHOD_OPTIONS.find(opt => opt.value === method);
    return option?.label || '-';
  };

  // 결제 상세 정보
  const getPaymentDetails = (collection: Collection): string => {
    switch (collection.payment_method) {
      case 'TRANSFER':
        return collection.bank_name && collection.account_number
          ? `${collection.bank_name} ${collection.account_number}`
          : '-';
      case 'CHECK':
        return collection.check_number || '-';
      case 'CARD':
        return collection.card_number || '-';
      case 'CASH':
      default:
        return '-';
    }
  };

  // 날짜 범위 변경 핸들러
  const handleDateRangeChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">수금 관리</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          고객으로부터의 수금 내역을 관리합니다
        </p>
      </div>

      {/* Section 2: Filter Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="수금번호, 매출번호, 고객사 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
          </div>

          {/* 결제방법 필터 */}
          <select
            value={filterPaymentMethod}
            onChange={(e) => setFilterPaymentMethod(e.target.value as PaymentMethod | '')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          >
            <option value="">전체 결제방법</option>
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* 시작일 */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          />

          {/* 종료일 */}
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          />
        </div>

        {/* 빠른 날짜 선택 */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            빠른 날짜 선택
          </label>
          <QuickDateSelector onDateRangeChange={handleDateRangeChange} />
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
            onClick={handleExcelDownload}
            disabled={isDownloading}
            className="flex items-center gap-1 px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                다운로드 중...
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                Excel 다운로드
              </>
            )}
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs font-medium whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            수금 등록
          </button>
        </div>
        </div>
      </div>

      {/* 요약 카드 섹션 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div
          className="p-4 bg-white rounded-lg shadow"
        >
          <p className="text-sm text-gray-600">총 미수금</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            ₩{summary.totalOutstanding.toLocaleString()}
          </p>
        </div>
        
        <div
          className="p-4 bg-white rounded-lg shadow"
        >
          <p className="text-sm text-gray-600">30일 이상 미처리</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {summary.overdueCount}건
          </p>
          {summary.overdueCount > 0 && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1">
              
              확인 필요
            </p>
          )}
        </div>
        
        <div className="p-4 bg-white rounded-lg shadow">
          <p className="text-sm text-gray-600">이번주 처리 예정</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
            ₩{summary.thisWeekAmount.toLocaleString()}
          </p>
        </div>
        
        <div className="p-4 bg-white rounded-lg shadow">
          <p className="text-sm text-gray-600">평균 지연일수</p>
          <p className="text-2xl font-bold text-gray-600">
            {summary.avgDaysOverdue}일
          </p>
        </div>
      </div>

      {/* Section 3: Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
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
        <div className="overflow-x-auto">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort('collection_date')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      수금일자
                      {sortColumn === 'collection_date' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort('collection_no')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      수금번호
                      {sortColumn === 'collection_no' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort('sales_transaction_no')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      매출번호
                      {sortColumn === 'sales_transaction_no' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort('company_name')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      고객사명
                      {sortColumn === 'company_name' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort('collected_amount')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                    >
                      수금금액
                      {sortColumn === 'collected_amount' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
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
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    결제 정보
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort('payment_status')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mx-auto"
                    >
                      상태
                      {sortColumn === 'payment_status' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    비고
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {filteredCollections.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      수금 내역이 없습니다
                    </td>
                  </tr>
                ) : (
                  filteredCollections.map((collection) => (
                    <tr key={collection.collection_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          <div className="flex flex-col">
                            {(() => {
                              const date = (collection as any).created_at || collection.collection_date;
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
                                  {(collection as any).created_at && (
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
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={collection.collection_no}>
                          {collection.collection_no}
                        </div>
                      </td>
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-900 dark:text-gray-100 truncate" title={collection.sales_transaction?.transaction_no || '-'}>
                          {collection.sales_transaction?.transaction_no || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-900 dark:text-gray-100 truncate" title={collection.customer?.company_name || '-'}>
                          {collection.customer?.company_name || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-sm text-right font-medium text-gray-900 dark:text-gray-100 truncate">
                          ₩ {collection.collected_amount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 overflow-hidden text-center">
                        <span className={`font-medium text-sm truncate ${getPaymentMethodColor(collection.payment_method)}`}>
                          {getPaymentMethodLabel(collection.payment_method)}
                        </span>
                      </td>
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-600 dark:text-gray-400 truncate" title={getPaymentDetails(collection)}>
                          {getPaymentDetails(collection)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          collection.sales_transaction?.payment_status === 'COMPLETE' 
                            ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            : collection.sales_transaction?.payment_status === 'PARTIAL'
                            ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-400'
                            : 'bg-gray-300 text-gray-600 dark:bg-gray-500 dark:text-gray-400'
                        }`}>
                          {collection.sales_transaction?.payment_status === 'COMPLETE' ? '완료' 
                            : collection.sales_transaction?.payment_status === 'PARTIAL' ? '부분'
                            : '대기'}
                        </span>
                      </td>
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-900 dark:text-gray-100 truncate" title={collection.notes || '-'}>
                          {collection.notes || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(collection)}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(collection)}
                            disabled={isDeleting === collection.collection_id}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="삭제"
                          >
                            {isDeleting === collection.collection_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
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
            ) : filteredCollections.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                수금 내역이 없습니다
              </div>
            ) : (
              filteredCollections.map((collection) => (
                <div key={collection.collection_id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {collection.collection_no}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {(() => {
                          const date = (collection as any).created_at || collection.collection_date;
                          const d = new Date(date);
                          return (collection as any).created_at
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
                    <span className={`text-xs px-2 py-1 rounded ${getPaymentMethodColor(collection.payment_method)}`}>
                      {getPaymentMethodLabel(collection.payment_method)}
                    </span>
                  </div>
                  <div className="text-sm mb-2">
                    <div className="text-gray-700 dark:text-gray-300">매출번호: {collection.sales_transaction?.transaction_no || '-'}</div>
                    <div className="text-gray-700 dark:text-gray-300">고객사: {collection.customer?.company_name || '-'}</div>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400">수금금액</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      ₩{collection.collected_amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(collection)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                    >
                      <Edit2 className="w-3 h-3" />
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(collection)}
                      disabled={isDeleting === collection.collection_id}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeleting === collection.collection_id ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          삭제 중...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3 h-3" />
                          삭제
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Section 4: Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedCollection ? '수금 내역 수정' : '수금 내역 등록'}
      >
        <CollectionForm
          collection={selectedCollection}
          onSave={handleSaveCollection}
          onCancel={() => {
            if (!isSaving) {
              setIsFormOpen(false);
              setSelectedCollection(null);
            }
          }}
        />
      </Modal>
    </div>
  );
}
