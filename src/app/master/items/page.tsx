'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamicImport from 'next/dynamic';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  RotateCcw,
  Upload,
  Download,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Grid,
  List,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/hooks/useConfirm';
import { useUserRole } from '@/hooks/useUserRole';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { ItemsExportButton } from '@/components/ExcelExportButton';
import PrintButton from '@/components/PrintButton';
import type { ItemCategory, ItemTypeCode, MaterialTypeCode } from '@/types/supabase';
import {
  type CoatingStatus,
  COATING_STATUS_OPTIONS,
  getCoatingStatusLabel,
  getCoatingStatusColor
} from '@/lib/constants/coatingStatus';

const Modal = dynamicImport(() => import('@/components/Modal'), { ssr: false });
const ItemForm = dynamicImport(() => import('@/components/ItemForm'), { ssr: false });
const ExcelUploadModal = dynamicImport(() => import('@/components/upload/ExcelUploadModal'), { ssr: false });
const ItemDetailModal = dynamicImport(() => import('@/components/ItemDetailModal').then(mod => ({ default: mod.ItemDetailModal })), { ssr: false });

type Item = {
  item_id: number;
  item_code: string;
  item_name: string;
  category: ItemCategory;
  item_type?: ItemTypeCode | null;
  material_type?: MaterialTypeCode | null;
  vehicle_model?: string | null;
  material?: string | null;
  spec?: string | null;
  unit: string;
  thickness?: number | null;
  width?: number | null;
  height?: number | null;
  specific_gravity?: number | null;
  mm_weight?: number | null;
  daily_requirement?: number | null;
  blank_size?: number | null;
  current_stock?: number | null;
  safety_stock?: number | null;
  price?: number | null;
  location?: string | null;
  description?: string | null;
  coating_status?: CoatingStatus | null;
  supplier_id?: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

const CATEGORY_OPTIONS: { value: ItemCategory; label: string }[] = [
  { value: '원자재', label: '원자재' },
  { value: '부자재', label: '부자재' },
  { value: '반제품', label: '반제품' },
  { value: '완제품', label: '완제품' },
  { value: '상품', label: '상품' }
];
const ITEM_TYPE_OPTIONS: { value: ItemTypeCode; label: string }[] = [
  { value: 'RAW', label: '원자재 (RAW)' },
  { value: 'SUB', label: '부자재 (SUB)' },
  { value: 'FINISHED', label: '완제품 (FINISHED)' }
];
const MATERIAL_TYPE_OPTIONS: { value: MaterialTypeCode; label: string }[] = [
  { value: 'COIL', label: 'COIL' },
  { value: 'SHEET', label: 'SHEET' },
  { value: 'OTHER', label: '기타 (OTHER)' }
];
// COATING_STATUS_OPTIONS now imported from @/lib/constants/coatingStatus

const ITEM_TYPE_LABEL: Record<string, string> = {
  RAW: 'RAW',
  SUB: 'SUB',
  FINISHED: 'FINISHED'
};

const formatNumberValue = (value?: number | null, fractionDigits = 0) => {
  if (value === null || value === undefined) {
    return '-';
  }

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
};

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined) {
    return '-';
  }

  return `₩${Number(value).toLocaleString()}`;
};

const formatItemTypeLabel = (itemType?: string | null) => {
  if (!itemType) return '-';
  return ITEM_TYPE_LABEL[itemType] ?? itemType;
};

const getCategoryLabel = (category?: ItemCategory | null): string => {
  if (!category) return '-';
  const found = CATEGORY_OPTIONS.find(opt => opt.value === category);
  return found ? found.label : category;
};

export default function ItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedItemType, setSelectedItemType] = useState<string>('');
  const [selectedMaterialType, setSelectedMaterialType] = useState<string>('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [selectedCoatingStatus, setSelectedCoatingStatus] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<number | 'ALL' | 'NONE'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [selectedItemForImage, setSelectedItemForImage] = useState<Item | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Mobile optimization states
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Pagination state
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [currentDirection, setCurrentDirection] = useState<'next' | 'prev'>('next');
  const [useCursorPagination, setUseCursorPagination] = useState(false);  // 오프셋 기반 페이지네이션 사용
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { success, error } = useToast();
  const { deleteWithToast, ConfirmDialog } = useConfirm();
  const { canEdit, isAccountant } = useUserRole();
  const { companies, loading: companiesLoading, error: companiesError, refetch: refetchCompanies } = useCompanyFilter();

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleCursorChange = (cursor: string | null, direction: 'next' | 'prev') => {
    fetchItems(cursor, direction);
  };

  // Search handler
  const handleSearch = () => {
    fetchItems(null, 'next');
  };

  // Sort handler
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle order if clicking same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column with desc as default
      setSortColumn(column);
      setSortOrder('desc');
    }
  };

  // Reset pagination when filters or sort changes
  useEffect(() => {
    setCurrentCursor(null);
    setCurrentDirection('next');
    setCurrentPage(1);  // 필터 변경 시 첫 페이지로 리셋
  }, [selectedCategory, selectedItemType, selectedMaterialType, vehicleFilter, selectedCoatingStatus, selectedCompany, sortColumn, sortOrder, searchTerm]);

  // Fetch items when currentPage changes (for offset-based pagination)
  useEffect(() => {
    fetchItems(null, 'next');
  }, [currentPage, selectedCategory, selectedItemType, selectedMaterialType, vehicleFilter, selectedCoatingStatus, selectedCompany, sortColumn, sortOrder, searchTerm]);

  const fetchItems = async (cursor?: string | null, direction: 'next' | 'prev' = 'next') => {
    setLoading(true);
    try {
      // 중앙 집중식 필터 헬퍼 사용
      const { buildFilteredApiUrl } = await import('@/lib/filters');
      const additionalParams: Record<string, string> = {};
      if (selectedCategory) additionalParams.category = selectedCategory;
      if (selectedItemType) additionalParams.itemType = selectedItemType;
      if (selectedMaterialType) additionalParams.materialType = selectedMaterialType;
      if (vehicleFilter) additionalParams.vehicleModel = vehicleFilter;
      if (selectedCoatingStatus) additionalParams.coating_status = selectedCoatingStatus;
      if (searchTerm) additionalParams.search = searchTerm;

      // Sort parameters
      additionalParams.sort_column = sortColumn;
      additionalParams.sort_order = sortOrder;

      // Pagination parameters
      if (useCursorPagination) {
        additionalParams.use_cursor = 'true';
        additionalParams.limit = '20';
        if (cursor) {
          additionalParams.cursor = cursor;
          additionalParams.direction = direction;
        }
      } else {
        additionalParams.page = String(currentPage);
        additionalParams.limit = '20';
      }

      // 공급업체 필터 처리
      let companyParam: number | null = null;
      if (selectedCompany === 'NONE') {
        additionalParams.supplier_id = 'null'; // 미지정 품목 조회
      } else if (selectedCompany !== 'ALL') {
        companyParam = selectedCompany;
      }

      const url = buildFilteredApiUrl(
        '/api/items',
        companyParam,
        additionalParams
      );

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const data = await safeFetchJson(url, {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (!data.success) {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(data.error) || '품목 정보를 불러오지 못했습니다.');
      }

      setItems(data.data?.items ?? []);
      setPagination(data.data?.pagination ?? null);
      setCurrentCursor(cursor || null);
      setCurrentDirection(direction);
    } catch (err) {
      console.error('Failed to fetch items:', err);
      error('데이터 로드 실패', '품목 데이터를 가져오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item: Item) => {
    const deleteAction = async () => {
      setDeletingItemId(item.item_id);
      try {
        const { safeFetchJson } = await import('@/lib/fetch-utils');
        const data = await safeFetchJson('/api/items', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ item_id: item.item_id })
        }, {
          timeout: 15000,
          maxRetries: 2,
          retryDelay: 1000
        });

        if (!data.success) {
          const { extractErrorMessage } = await import('@/lib/fetch-utils');
          throw new Error(extractErrorMessage(data.error) || '품목 삭제에 실패했습니다.');
        }

        success('삭제 완료', '품목이 비활성화되었습니다.');
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(item.item_id);
          return next;
        });
        fetchItems();
      } finally {
        setDeletingItemId(null);
      }
    };

    await deleteWithToast(deleteAction, {
      title: '품목 삭제',
      itemName: `${item.item_name} (${item.item_code})`,
      successMessage: '품목이 비활성화되었습니다.',
      errorMessage: '품목 삭제 중 오류가 발생했습니다.'
    });
  };

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredItems.map(item => item.item_id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 개별 선택/해제
  const handleSelectItem = (itemId: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  };

  // 일괄 삭제
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(`선택한 ${selectedIds.size}개 품목을 삭제하시겠습니까?`);
    if (!confirmed) return;

    const idsToDelete = Array.from(selectedIds);
    setDeletingItemId(-1); // 일괄 삭제 중 표시

    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const deletePromises = idsToDelete.map(itemId =>
        safeFetchJson('/api/items', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ item_id: itemId })
        }, {
          timeout: 15000,
          maxRetries: 2,
          retryDelay: 1000
        })
      );

      const results = await Promise.allSettled(deletePromises);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

      if (failed.length > 0) {
        error('일부 삭제 실패', `${failed.length}개 품목 삭제에 실패했습니다.`);
      } else {
        success('삭제 완료', `${idsToDelete.length}개 품목이 비활성화되었습니다.`);
      }

      setSelectedIds(new Set());
      fetchItems();
    } catch (err) {
      error('삭제 실패', '일괄 삭제 중 오류가 발생했습니다.');
      console.error('Bulk delete error:', err);
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleSaveItem = async (payload: Record<string, unknown>) => {
    try {
      const method = editingItem ? 'PUT' : 'POST';
      const body = editingItem ? { ...payload, item_id: editingItem.item_id } : payload;

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const data = await safeFetchJson('/api/items', {
        method,
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(body)
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (!data.success) {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(data.error) || '품목 저장 요청에 실패했습니다.');
      }

      const message = editingItem ? '품목이 수정되었습니다.' : '품목이 등록되었습니다.';
      success(editingItem ? '수정 완료' : '등록 완료', message);
      setShowAddModal(false);
      setEditingItem(null);

      // 새로 등록한 품목이 즉시 표시되도록 첫 번째 페이지로 이동
      if (!editingItem) {
        setCurrentCursor(null);
        setCurrentDirection('next');
      }
      fetchItems();

      // BroadcastChannel을 통해 다른 페이지에 품목 업데이트 알림
      try {
        const channel = new BroadcastChannel('items-update');
        channel.postMessage({
          type: 'item-updated',
          timestamp: Date.now(),
          action: editingItem ? 'update' : 'create'
        });
        channel.close();
      } catch (broadcastError) {
        // BroadcastChannel 미지원 브라우저에서는 조용히 실패
        console.warn('BroadcastChannel not supported:', broadcastError);
      }
    } catch (err) {
      console.error('Failed to save item:', err);
      error('요청 실패', '품목 정보를 저장하는 중 오류가 발생했습니다.');
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingItem(null);
  };

  const handleUploadSuccess = () => {
    success('업로드 완료', '품목 데이터가 성공적으로 업로드되었습니다.');
    setShowUploadModal(false);
    fetchItems();
  };

  const handleTemplateDownload = async () => {
    try {
      const { safeFetch } = await import('@/lib/fetch-utils');
      const response = await safeFetch('/api/download/template/items', {}, {
        timeout: 30000,
        maxRetries: 2,
        retryDelay: 1000
      });
      if (!response.ok) {
        throw new Error('템플릿 다운로드에 실패했습니다.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'items_template.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download template:', err);
      error('다운로드 실패', '템플릿 파일을 다운로드하지 못했습니다.');
    }
  };

  // Fetch all unique vehicle models from API
  const [vehicleOptions, setVehicleOptions] = useState<string[]>([]);
  
  useEffect(() => {
    const fetchVehicleOptions = async () => {
      try {
        const { safeFetchJson } = await import('@/lib/fetch-utils');
        // Fetch all items to get unique vehicle models
        const data = await safeFetchJson('/api/items?limit=1000', {}, {
          timeout: 10000,
          maxRetries: 1
        });
        
        if (data.success && data.data?.items) {
          const uniqueVehicles: string[] = Array.from(
            new Set(
              data.data.items
                .map((item: Item) => item.vehicle_model)
                .filter((v: string | null | undefined): v is string => Boolean(v && v.trim()))
            )
          );
          setVehicleOptions(uniqueVehicles.sort());
        }
      } catch (err) {
        console.error('Failed to fetch vehicle options:', err);
        // Fallback to current items if API fails
        const uniqueVehicles: string[] = Array.from(
          new Set(
            items
              .map(item => item.vehicle_model)
              .filter((v): v is string => Boolean(v && typeof v === 'string' && v.trim()))
          )
        );
        setVehicleOptions(uniqueVehicles.sort());
      }
    };
    
    fetchVehicleOptions();
  }, []); // Only fetch once on mount

  const resetFilters = () => {
    setSelectedCategory('');
    setSelectedItemType('');
    setSelectedMaterialType('');
    setVehicleFilter('');
    setSelectedCoatingStatus('');
    setSelectedCompany('ALL');
    setSearchTerm('');
    setCurrentCursor(null);
    setCurrentDirection('next');
    fetchItems(null, 'next');
  };

  // Remove client-side filtering - use server-side search only
  const filteredItems = items;

  const filtersApplied = Boolean(
    selectedCategory || selectedItemType || selectedMaterialType || vehicleFilter || selectedCoatingStatus || selectedCompany !== 'ALL' || searchTerm.trim()
  );

  const printColumns = [
    { key: 'item_code', label: '품목코드', align: 'left' as const, width: '12%' },
    { key: 'item_name', label: '품목명', align: 'left' as const, width: '18%' },
    { key: 'category', label: '분류', align: 'center' as const, width: '8%' },
    { key: 'item_type', label: '타입', align: 'center' as const, width: '8%' },
    { key: 'material_type', label: '소재형태', align: 'center' as const, width: '10%' },
    { key: 'vehicle_model', label: '차종', align: 'left' as const, width: '10%' },
    { key: 'spec', label: '규격', align: 'left' as const, width: '15%' },
    { key: 'coating_status', label: '도장상태', align: 'center' as const, width: '8%' },
    { key: 'mm_weight', label: '단위중량', align: 'right' as const, width: '8%', type: 'number' as const },
    { key: 'current_stock', label: '현재고', align: 'right' as const, width: '8%', type: 'number' as const },
    { key: 'safety_stock', label: '안전재고', align: 'right' as const, width: '8%', type: 'number' as const },
    { key: 'price', label: '기준단가', align: 'right' as const, width: '9%', type: 'currency' as const }
  ];

  return (
    <div className="space-y-6">
      {/* Fixed height header to prevent CLS */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700 min-h-[120px]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3">

            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 leading-tight">품목 관리</h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 leading-snug">자동차 부품 및 원자재 품목을 관리합니다.</p>
            </div>
          </div>
          <div className="flex flex-nowrap gap-1.5 items-center overflow-x-auto pb-1 flex-shrink-0">
            <PrintButton
              data={filteredItems}
              columns={printColumns}
              title="품목 목록"
              subtitle={filtersApplied ? '필터 적용됨' : undefined}
              orientation="landscape"
              className="bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white whitespace-nowrap text-xs px-2 py-1 flex items-center gap-1 flex-shrink-0 h-8"
            />
            <button
              onClick={handleTemplateDownload}
              className="flex items-center gap-1 px-2 py-1 h-8 bg-gray-800 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-xs whitespace-nowrap flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5 flex-shrink-0" />
              템플릿 다운로드
            </button>
            <ItemsExportButton items={filteredItems} filtered={filtersApplied} className="text-xs px-2 py-1 flex-shrink-0 h-8" />
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-1 px-2 py-1 h-8 bg-gray-800 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-xs whitespace-nowrap flex-shrink-0"
            >
              <Upload className="w-3.5 h-3.5 flex-shrink-0" />
              일괄 업로드
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              disabled={!canEdit}
              className={`flex items-center gap-1 px-3 py-1.5 h-8 rounded-lg transition-colors text-xs font-medium whitespace-nowrap flex-shrink-0 ${
                canEdit
                  ? 'bg-gray-800 text-white hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-50'
              }`}
              title={!canEdit ? '회계 담당자는 수정할 수 없습니다' : ''}
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              품목 등록
            </button>
          </div>
        </div>
      </div>

      {/* Fixed height filter section to prevent CLS */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700 min-h-[140px] sm:min-h-[80px]">
        {/* Mobile Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="sm:hidden flex items-center justify-between w-full mb-3 px-3 py-2 h-10 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">필터</span>
          {showFilters ? <ChevronUp className="w-4 h-4 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 flex-shrink-0" />}
        </button>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="search-filter" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 h-4">
              검색
            </label>
            <div className="relative h-10">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                id="search-filter"
                type="text"
                placeholder="품목코드, 품목명, 규격, 소재로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full h-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
              />
            </div>
          </div>
          <div className={`flex flex-wrap gap-2 md:w-auto ${showFilters || 'hidden'} sm:flex`}>
            <label className="sr-only" htmlFor="category-filter">분류 필터</label>
            <select
              id="category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="분류 필터"
              className="w-full sm:w-auto h-10 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              <option value="">전체 분류</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="item-type-filter">타입 필터</label>
            <select
              id="item-type-filter"
              value={selectedItemType}
              onChange={(e) => setSelectedItemType(e.target.value)}
              aria-label="타입 필터"
              className="w-full sm:w-auto h-10 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              <option value="">전체 타입</option>
              {ITEM_TYPE_OPTIONS.map((option) => (
                <option key={option.value ?? ''} value={option.value ?? ''}>
                  {option.label}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="material-type-filter">소재 필터</label>
            <select
              id="material-type-filter"
              value={selectedMaterialType}
              onChange={(e) => setSelectedMaterialType(e.target.value)}
              aria-label="소재 필터"
              className="w-full sm:w-auto h-10 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              <option value="">전체 소재</option>
              {MATERIAL_TYPE_OPTIONS.map((option) => (
                <option key={option.value ?? ''} value={option.value ?? ''}>
                  {option.label}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="vehicle-filter">차종 필터</label>
            <select
              id="vehicle-filter"
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              aria-label="차종 필터"
              className="w-full sm:w-auto h-10 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              <option value="">전체 차종</option>
              {vehicleOptions.map((vehicle) => (
                <option key={vehicle} value={vehicle}>
                  {vehicle}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="company-filter">공급업체 필터</label>
            <select
              id="company-filter"
              value={selectedCompany}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'ALL') setSelectedCompany('ALL');
                else if (val === 'NONE') setSelectedCompany('NONE' as any);
                else setSelectedCompany(Number(val));
              }}
              aria-label="공급업체 필터"
              disabled={companiesLoading}
              className="w-full sm:w-auto h-10 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              <option value="ALL">전체 공급업체</option>
              <option value="NONE">미지정 (공급업체 없음)</option>
              {companies.map((company) => (
                <option key={company.value} value={company.value}>
                  {company.label}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="coating-status-filter">도장상태 필터</label>
            <select
              id="coating-status-filter"
              value={selectedCoatingStatus}
              onChange={(e) => setSelectedCoatingStatus(e.target.value)}
              aria-label="도장상태 필터"
              className="w-full sm:w-auto h-10 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              {COATING_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-2 px-4 py-2 h-10 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <RotateCcw className="w-5 h-5 flex-shrink-0" />
              초기화
            </button>
          </div>
        </div>
      </div>

      {/* Fixed min-height table container to prevent CLS */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[600px]">
        {/* View Toggle (Mobile Only) */}
        <div className="sm:hidden flex items-center justify-end gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 h-12">
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

        {/* 선택된 항목 일괄 삭제 버튼 */}
        {selectedIds.size > 0 && (
          <div className="mb-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
            <span className="text-sm text-blue-900 dark:text-blue-100 font-medium">
              {selectedIds.size}개 항목 선택됨
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={deletingItemId === -1}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {deletingItemId === -1 ? '삭제 중...' : `선택 항목 삭제 (${selectedIds.size}개)`}
            </button>
          </div>
        )}

        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className={`w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed ${viewMode === 'card' ? 'hidden' : 'table'}`} style={{ minWidth: '1400px' }}>
            <thead className="bg-gray-50 dark:bg-gray-700 h-14">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '48px' }}>
                  <input
                    type="checkbox"
                    checked={filteredItems.length > 0 && filteredItems.every(item => selectedIds.has(item.item_id))}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    aria-label="전체 선택"
                  />
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '120px' }}>
                  <button onClick={() => handleSort('item_code')} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100">
                    품목코드
                    {sortColumn === 'item_code' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 flex-shrink-0" /> : <ArrowDown className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50 flex-shrink-0" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '180px' }}>
                  <button onClick={() => handleSort('item_name')} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100">
                    품목명
                    {sortColumn === 'item_name' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 flex-shrink-0" /> : <ArrowDown className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50 flex-shrink-0" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '80px' }}>
                  <button onClick={() => handleSort('category')} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100 mx-auto">
                    분류
                    {sortColumn === 'category' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 flex-shrink-0" /> : <ArrowDown className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50 flex-shrink-0" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '80px' }}>
                  <button onClick={() => handleSort('item_type')} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100 mx-auto">
                    타입
                    {sortColumn === 'item_type' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 flex-shrink-0" /> : <ArrowDown className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50 flex-shrink-0" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '100px' }}>
                  <button onClick={() => handleSort('material_type')} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100 mx-auto">
                    소재형태
                    {sortColumn === 'material_type' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 flex-shrink-0" /> : <ArrowDown className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50 flex-shrink-0" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '100px' }}>
                  <button onClick={() => handleSort('vehicle_model')} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100">
                    차종
                    {sortColumn === 'vehicle_model' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 flex-shrink-0" /> : <ArrowDown className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50 flex-shrink-0" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '150px' }}>
                  <button onClick={() => handleSort('spec')} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100">
                    규격 / 소재
                    {sortColumn === 'spec' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 flex-shrink-0" /> : <ArrowDown className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50 flex-shrink-0" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '100px' }}>
                  <button onClick={() => handleSort('mm_weight')} className="flex items-center gap-1 ml-auto hover:text-gray-700 dark:hover:text-gray-100">
                    단위중량(kg)
                    {sortColumn === 'mm_weight' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 flex-shrink-0" /> : <ArrowDown className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50 flex-shrink-0" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '80px' }}>
                  <button onClick={() => handleSort('current_stock')} className="flex items-center gap-1 ml-auto hover:text-gray-700 dark:hover:text-gray-100">
                    현재고
                    {sortColumn === 'current_stock' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 flex-shrink-0" /> : <ArrowDown className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50 flex-shrink-0" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '80px' }}>
                  <button onClick={() => handleSort('safety_stock')} className="flex items-center gap-1 ml-auto hover:text-gray-700 dark:hover:text-gray-100">
                    안전재고
                    {sortColumn === 'safety_stock' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 flex-shrink-0" /> : <ArrowDown className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50 flex-shrink-0" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '100px' }}>
                  <button onClick={() => handleSort('price')} className="flex items-center gap-1 ml-auto hover:text-gray-700 dark:hover:text-gray-100">
                    기준단가
                    {sortColumn === 'price' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 flex-shrink-0" /> : <ArrowDown className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50 flex-shrink-0" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '90px' }}>
                  <button onClick={() => handleSort('coating_status')} className="flex items-center gap-1 mx-auto hover:text-gray-700 dark:hover:text-gray-100">
                    도장상태
                    {sortColumn === 'coating_status' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 flex-shrink-0" /> : <ArrowDown className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50 flex-shrink-0" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '100px' }}>
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {loading ? (
                <tr>
                  <td colSpan={14} className="p-3 sm:p-6">
                    <TableSkeleton rows={8} columns={14} showHeader={false} />
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-3 sm:px-6 py-12 text-center text-gray-500">
                    조건에 맞는 품목이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.item_id} className="hover:bg-gray-50 dark:hover:bg-gray-800 h-16">
                    <td className="px-3 sm:px-6 py-4 text-center h-16">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.item_id)}
                        onChange={(e) => handleSelectItem(item.item_id, e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        aria-label={`${item.item_name} 선택`}
                      />
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      <button
                        onClick={() => router.push(`/master/items/${item.item_id}`)}
                        className="text-sm font-medium text-gray-800 hover:text-gray-900 dark:text-gray-100 dark:hover:text-white hover:underline truncate block w-full text-left"
                        title={item.item_code}
                      >
                        {item.item_code}
                      </button>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      <button
                        onClick={() => router.push(`/master/items/${item.item_id}`)}
                        className="text-sm text-gray-900 dark:text-white hover:underline text-left truncate block w-full"
                        title={item.item_name}
                      >
                        {item.item_name}
                      </button>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden text-center">
                      <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {getCategoryLabel(item.category)}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden text-center">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full border-2 border-gray-800 text-gray-800 bg-transparent dark:border-gray-300 dark:text-gray-300 truncate">
                        {formatItemTypeLabel(item.item_type)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden text-center">
                      <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {item.material_type ?? '-'}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      <div className="text-sm text-gray-600 dark:text-gray-400 truncate" title={item.vehicle_model || '-'}>
                        {item.vehicle_model || '-'}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      <div className="text-sm text-gray-600 dark:text-gray-400 truncate" title={item.spec || item.material || '-'}>
                        {item.spec || item.material || '-'}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      <div className="text-sm text-right text-gray-900 dark:text-white truncate">
                        {formatNumberValue(item.mm_weight, 4)}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      <div className="text-sm text-right text-gray-900 dark:text-white truncate">
                        {formatNumberValue(item.current_stock)}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      <div className="text-sm text-right text-gray-900 dark:text-white truncate">
                        {formatNumberValue(item.safety_stock)}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden">
                      <div className="text-sm text-right text-gray-900 dark:text-white truncate">
                        {formatCurrency(item.price)}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 overflow-hidden text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full truncate ${getCoatingStatusColor(item.coating_status)}`}>
                        {getCoatingStatusLabel(item.coating_status)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-center h-16">
                      <div className="flex items-center justify-center gap-2 h-full">
                        <button
                          onClick={() => {
                            setSelectedItemForImage(item);
                            setShowImageModal(true);
                          }}
                          className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 w-8 h-8 flex items-center justify-center"
                          title="이미지 관리"
                        >
                          <ImageIcon className="w-4 h-4 flex-shrink-0" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setShowAddModal(true);
                          }}
                          className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 w-8 h-8 flex items-center justify-center"
                          title="품목 수정"
                        >
                          <Edit2 className="w-4 h-4 flex-shrink-0" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          disabled={deletingItemId === item.item_id}
                          className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed w-8 h-8 flex items-center justify-center"
                          title="품목 삭제"
                        >
                          {deletingItemId === item.item_id ? (
                            <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                          ) : (
                            <Trash2 className="w-4 h-4 flex-shrink-0" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Card View (Mobile Only) */}
        {viewMode === 'card' && (
          <div className="sm:hidden p-3 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                조건에 맞는 품목이 없습니다.
              </div>
            ) : (
              filteredItems.map((item) => (
                <div key={item.item_id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <button
                        onClick={() => router.push(`/master/items/${item.item_id}`)}
                        className="text-sm font-semibold text-gray-900 dark:text-white hover:underline"
                      >
                        {item.item_code}
                      </button>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.item_name}</p>
                    </div>
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full border-2 border-gray-800 text-gray-800 bg-transparent">
                      {formatItemTypeLabel(item.item_type)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400 mb-3">
                    <div>
                      <span className="font-medium">분류:</span> {item.category || '-'}
                    </div>
                    <div>
                      <span className="font-medium">소재:</span> {item.material_type || '-'}
                    </div>
                    <div>
                      <span className="font-medium">현재고:</span> {formatNumberValue(item.current_stock)}
                    </div>
                    <div>
                      <span className="font-medium">단가:</span> {formatCurrency(item.price)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-gray-500">
                      {getCoatingStatusLabel(item.coating_status)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedItemForImage(item);
                          setShowImageModal(true);
                        }}
                        className="p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                        title="이미지 관리"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setShowAddModal(true);
                        }}
                        className="p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                        title="품목 수정"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={deletingItemId === item.item_id}
                        className="p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="품목 삭제"
                      >
                        {deletingItemId === item.item_id ? (
                          <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                ))
              )}
        </div>
        )}

        {/* Fixed height pagination to prevent CLS */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 min-h-[80px] flex items-center">
          {pagination && (
            <Pagination
              pagination={pagination}
              onPageChange={handlePageChange}
              onCursorChange={handleCursorChange}
              loading={loading}
            />
          )}
        </div>
      </div>

      <Modal
        isOpen={showAddModal || !!editingItem}
        onClose={handleCloseModal}
        title={editingItem ? '품목 수정' : '품목 등록'}
        size="lg"
      >
        <ItemForm
          item={editingItem ? {
            ...editingItem,
            item_type: editingItem.item_type ?? undefined,
            material_type: editingItem.material_type ?? undefined,
            vehicle_model: editingItem.vehicle_model ?? undefined,
            material: editingItem.material ?? undefined,
            spec: editingItem.spec ?? undefined,
            thickness: editingItem.thickness != null ? String(editingItem.thickness) : undefined,
            width: editingItem.width != null ? String(editingItem.width) : undefined,
            height: editingItem.height != null ? String(editingItem.height) : undefined,
            specific_gravity: editingItem.specific_gravity != null ? String(editingItem.specific_gravity) : undefined,
            mm_weight: editingItem.mm_weight != null ? String(editingItem.mm_weight) : undefined,
            daily_requirement: editingItem.daily_requirement != null ? String(editingItem.daily_requirement) : undefined,
            blank_size: editingItem.blank_size != null ? String(editingItem.blank_size) : undefined,
            current_stock: editingItem.current_stock != null ? String(editingItem.current_stock) : undefined,
            safety_stock: editingItem.safety_stock != null ? String(editingItem.safety_stock) : undefined,
            price: editingItem.price != null ? String(editingItem.price) : undefined,
            location: editingItem.location ?? undefined,
            description: editingItem.description ?? undefined,
            coating_status: editingItem.coating_status ?? undefined,
            supplier_id: editingItem.supplier_id ?? undefined
          } : null}
          onSubmit={handleSaveItem}
          onCancel={handleCloseModal}
        />
      </Modal>

      <ExcelUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        uploadUrl="/api/upload/items"
        title="품목 데이터 업로드"
        onUploadSuccess={handleUploadSuccess}
      />

      {showImageModal && selectedItemForImage && (
        <ItemDetailModal
          itemId={String(selectedItemForImage.item_id)}
          itemName={selectedItemForImage.item_name}
          itemCode={selectedItemForImage.item_code}
          onClose={() => {
            setShowImageModal(false);
            setSelectedItemForImage(null);
          }}
        />
      )}

      <ConfirmDialog />
    </div>
  );
}

