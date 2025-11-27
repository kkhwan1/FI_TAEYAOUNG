'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

/**
 * Process Operations Management Page
 *
 * Manages manufacturing process operations (Blanking, Press, Assembly)
 * Features:
 * - Tab-based filtering (In Progress, Completed, All)
 * - Process type and date range filtering
 * - Real-time status updates
 * - Virtual table for performance
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamicImport from 'next/dynamic';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/hooks/useConfirm';
import ProcessStatusBadge from '@/components/process/ProcessStatusBadge';
import ProcessCompleteButton from '@/components/process/ProcessCompleteButton';
import ProcessStartButton from '@/components/process/ProcessStartButton';

const Modal = dynamicImport(() => import('@/components/Modal'), { ssr: false });
const ProcessOperationForm = dynamicImport(() => import('@/components/process/ProcessOperationForm'), { ssr: false });

type OperationType = 'BLANKING' | 'PRESS' | 'ASSEMBLY';
type OperationStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

interface ProcessOperation {
  operation_id: number;
  operation_type: OperationType;
  input_item_id: number;
  output_item_id: number;
  input_quantity: number;
  output_quantity: number;
  status: OperationStatus;
  operator_id?: string;
  notes?: string;
  started_at?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
  coil_process_type?: string; // Optional property for coil tracking data source
  input_item?: {
    item_id: number;
    item_name: string;
    item_code: string;
  };
  output_item?: {
    item_id: number;
    item_name: string;
    item_code: string;
  };
}

const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  'BLANKING': 'Blanking 공정',
  'PRESS': 'Press 공정',
  'ASSEMBLY': '조립 공정'
};

const TAB_OPTIONS = [
  { value: 'PENDING', label: '대기', description: '등록만 된 공정 작업' },
  { value: 'IN_PROGRESS', label: '진행중', description: '작업이 시작된 공정' },
  { value: 'COMPLETED', label: '완료', description: '완료된 공정 작업' },
  { value: 'ALL', label: '전체', description: '모든 상태의 공정 작업' }
];

// 데이터 소스 타입 (공정 작업 vs 코일 추적)
type DataSource = 'process_operations' | 'coil_tracking';

export default function ProcessPage() {
  const searchParams = useSearchParams();
  const [operations, setOperations] = useState<ProcessOperation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<ProcessOperation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    PENDING: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    ALL: 0
  });
  // URL 파라미터에서 데이터 소스 확인
  const initialDataSource = (searchParams?.get('source') === 'coil_tracking' ? 'coil_tracking' : 'process_operations') as DataSource;
  const [dataSource, setDataSource] = useState<DataSource>(initialDataSource);
  const [filterType, setFilterType] = useState<OperationType | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingOperationId, setDeletingOperationId] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortColumn, setSortColumn] = useState<string>('created_at');

  const { showToast } = useToast();
  const { confirm } = useConfirm();

  // 공정 작업 목록 조회
  const fetchOperations = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();

      // 데이터 소스에 따라 다른 API 호출
      if (dataSource === 'coil_tracking') {
        // 코일 추적 데이터 조회
        if (activeTab !== 'ALL') {
          params.append('status', activeTab);
        }
        // 공정 유형 필터 (코일 추적용)
        if (filterType) {
          const processTypeMap: Record<OperationType, string> = {
            'BLANKING': '블랭킹',
            'PRESS': '전단',
            'ASSEMBLY': '용접'
          };
          if (processTypeMap[filterType]) {
            params.append('process_type', processTypeMap[filterType]);
          }
        }
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        const response = await fetch(`/api/coil/process?${params.toString()}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          const { extractErrorMessage } = await import('@/lib/fetch-utils');
          throw new Error(extractErrorMessage(result.error) || '코일 공정 목록을 불러올 수 없습니다.');
        }

        // 코일 추적 데이터를 공정 작업 형식으로 변환
        const processTypeToOperationType: Record<string, OperationType> = {
          '블랭킹': 'BLANKING',
          '전단': 'PRESS',
          '절곡': 'PRESS',
          '용접': 'ASSEMBLY'
        };

        const convertedOperations: ProcessOperation[] = (result.data || []).map((cp: any) => ({
          operation_id: cp.process_id,
          operation_type: processTypeToOperationType[cp.process_type] || 'BLANKING' as OperationType,
          input_item_id: cp.source_item_id,
          output_item_id: cp.target_item_id,
          input_quantity: cp.input_quantity,
          output_quantity: cp.output_quantity,
          efficiency: cp.yield_rate,
          operator_id: cp.operator_id,
          started_at: cp.started_at || cp.process_date,
          completed_at: cp.completed_at,
          status: cp.status as OperationStatus,
          notes: cp.notes,
          created_at: cp.created_at,
          updated_at: cp.updated_at || cp.created_at,
          lot_number: null,
          // 코일 추적 정보 저장 (표시용)
          coil_process_type: cp.process_type,
          input_item: cp.source_item ? {
            item_id: cp.source_item.item_id,
            item_name: cp.source_item.item_name,
            item_code: cp.source_item.item_code,
            current_stock: cp.source_item.current_stock || 0,
            unit: null,
            spec: cp.source_item.spec
          } : null,
          output_item: cp.target_item ? {
            item_id: cp.target_item.item_id,
            item_name: cp.target_item.item_name,
            item_code: cp.target_item.item_code,
            current_stock: cp.target_item.current_stock || 0,
            unit: null,
            spec: cp.target_item.spec
          } : null
        }));

        setOperations(convertedOperations);
        
        // 상태별 개수 설정
        if (result.statusCounts) {
          setStatusCounts(result.statusCounts);
        } else {
          const counts: Record<string, number> = {
            PENDING: 0,
            IN_PROGRESS: 0,
            COMPLETED: 0,
            CANCELLED: 0,
            ALL: convertedOperations.length
          };
          convertedOperations.forEach((op: ProcessOperation) => {
            if (op.status in counts) {
              counts[op.status as keyof typeof counts]++;
            }
          });
          setStatusCounts(counts);
        }
        return;
      }

      // 기본: 공정 작업 데이터 조회
      // activeTab 필터는 클라이언트에서 적용하여 모든 탭의 정확한 카운트 표시
      // API에서는 전체 데이터를 가져옴 (status 파라미터 제거)
      if (searchTerm) params.append('search', searchTerm);
      if (filterType) params.append('operation_type', filterType);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const { fetchApi } = await import('@/lib/fetch-utils');
      const result = await fetchApi(`/api/process-operations?${params}`, {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        const operationsData = result.data?.operations || result.data || [];
        setOperations(operationsData);
        
        // API에서 받은 상태별 개수 사용 (없으면 로컬 계산)
        if (result.data?.statusCounts) {
          setStatusCounts(result.data.statusCounts);
        } else {
          // 폴백: 로컬에서 계산
          const counts: Record<string, number> = {
            PENDING: 0,
            IN_PROGRESS: 0,
            COMPLETED: 0,
            CANCELLED: 0,
            ALL: operationsData.length
          };
          
          operationsData.forEach((op: ProcessOperation) => {
            if (op.status in counts) {
              counts[op.status as keyof typeof counts]++;
            }
          });
          
          setStatusCounts(counts);
        }
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showToast(extractErrorMessage(result.error) || '공정 작업 조회 실패', 'error');
      }
    } catch (error) {
      console.error('Error fetching process operations:', error);
      showToast('공정 작업 조회 중 오류가 발생했습니다', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOperations();
  }, [activeTab, searchTerm, filterType, startDate, endDate, dataSource]);

  // 공정 작업 추가
  const handleAdd = () => {
    setSelectedOperation(null);
    setIsFormOpen(true);
  };

  // 공정 작업 수정
  const handleEdit = (operation: ProcessOperation) => {
    setSelectedOperation(operation);
    setIsFormOpen(true);
  };

  // 공정 작업 삭제
  const handleDelete = async (operation: ProcessOperation) => {
    const confirmed = await confirm({
      title: '공정 작업 삭제',
      message: `공정번호 ${operation.operation_id}를 삭제하시겠습니까?`,
      confirmText: '삭제',
      cancelText: '취소'
    });

    if (!confirmed) return;

    try {
      setDeletingOperationId(operation.operation_id);
      const { fetchApi } = await import('@/lib/fetch-utils');
      const result = await fetchApi(`/api/process-operations/${operation.operation_id}`, {
        method: 'DELETE',
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(operation.operation_id);
          return next;
        });
        showToast('공정 작업이 삭제되었습니다', 'success');
        fetchOperations();
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showToast(extractErrorMessage(result.error) || '삭제 실패', 'error');
      }
    } catch (error) {
      console.error('Error deleting process operation:', error);
      showToast('삭제 중 오류가 발생했습니다', 'error');
    } finally {
      setDeletingOperationId(null);
    }
  };

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredOperations.map(op => op.operation_id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 개별 선택/해제
  const handleSelectItem = (operationId: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(operationId);
      } else {
        next.delete(operationId);
      }
      return next;
    });
  };

  // 일괄 삭제
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = await confirm({
      title: '일괄 삭제',
      message: `선택한 ${selectedIds.size}개 공정 작업을 삭제하시겠습니까?`,
      confirmText: '삭제',
      cancelText: '취소'
    });

    if (!confirmed) return;

    const idsToDelete = Array.from(selectedIds);
    setDeletingOperationId(-1); // 일괄 삭제 중 표시

    try {
      const { fetchApi } = await import('@/lib/fetch-utils');
      const deletePromises = idsToDelete.map(id =>
        fetchApi(`/api/process-operations/${id}`, {
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
        showToast(`${failed.length}개 공정 작업 삭제에 실패했습니다`, 'error');
      } else {
        showToast(`${idsToDelete.length}개 공정 작업이 삭제되었습니다`, 'success');
      }

      setSelectedIds(new Set());
      fetchOperations();
    } catch (error) {
      console.error('Bulk delete error:', error);
      showToast('일괄 삭제 중 오류가 발생했습니다', 'error');
    } finally {
      setDeletingOperationId(null);
    }
  };

  // 폼 저장
  const handleSaveOperation = async (data: Partial<ProcessOperation>) => {
    try {
      const url = selectedOperation
        ? `/api/process-operations/${selectedOperation.operation_id}`
        : '/api/process-operations';

      const method = selectedOperation ? 'PATCH' : 'POST';

      const { fetchApi } = await import('@/lib/fetch-utils');
      const result = await fetchApi(url, {
        method,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: JSON.stringify(data),
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        showToast(
          selectedOperation ? '공정 작업이 수정되었습니다' : '공정 작업이 등록되었습니다',
          'success'
        );
        setIsFormOpen(false);
        fetchOperations();
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showToast(extractErrorMessage(result.error) || '저장 실패', 'error');
      }
    } catch (error) {
      console.error('Error saving process operation:', error);
      showToast('저장 중 오류가 발생했습니다', 'error');
    }
  };

  // 수율 계산
  const calculateEfficiency = (inputQty: number, outputQty: number) => {
    if (inputQty > 0) {
      return ((outputQty / inputQty) * 100).toFixed(2);
    }
    return '0.00';
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('asc');
    }
  };

  // 필터링 및 정렬된 작업 목록
  const filteredOperations = useMemo(() => {
    let filtered = [...operations];

    // activeTab 필터 적용 (클라이언트 측)
    if (activeTab !== 'ALL') {
      filtered = filtered.filter(op => op.status === activeTab);
    }

    // 검색 필터
    if (searchTerm) {
      filtered = filtered.filter(op => 
        op.operation_id.toString().includes(searchTerm) ||
        op.input_item?.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.output_item?.item_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 공정 유형 필터
    if (filterType) {
      filtered = filtered.filter(op => op.operation_type === filterType);
    }

    // 날짜 필터
    if (startDate) {
      filtered = filtered.filter(op => {
        const opDate = op.started_at || op.created_at || '';
        return opDate >= startDate;
      });
    }
    if (endDate) {
      filtered = filtered.filter(op => {
        const opDate = op.started_at || op.created_at || '';
        return opDate <= endDate;
      });
    }

    // 정렬
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'operation_id':
          aValue = a.operation_id;
          bValue = b.operation_id;
          break;
        case 'operation_type':
          aValue = OPERATION_TYPE_LABELS[a.operation_type];
          bValue = OPERATION_TYPE_LABELS[b.operation_type];
          break;
        case 'input_item':
          aValue = a.input_item?.item_name || '';
          bValue = b.input_item?.item_name || '';
          break;
        case 'output_item':
          aValue = a.output_item?.item_name || '';
          bValue = b.output_item?.item_name || '';
          break;
        case 'input_quantity':
          aValue = a.input_quantity || 0;
          bValue = b.input_quantity || 0;
          break;
        case 'output_quantity':
          aValue = a.output_quantity || 0;
          bValue = b.output_quantity || 0;
          break;
        case 'efficiency':
          aValue = a.input_quantity > 0 ? (a.output_quantity / a.input_quantity) * 100 : 0;
          bValue = b.input_quantity > 0 ? (b.output_quantity / b.input_quantity) * 100 : 0;
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'operator':
          aValue = a.operator_id || '';
          bValue = b.operator_id || '';
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
  }, [operations, activeTab, searchTerm, filterType, startDate, endDate, sortColumn, sortOrder]);

  // 원본 operations에서 필터(검색, 날짜 등)만 적용한 상태별 카운트 계산
  // activeTab 필터는 제외하여 모든 탭에서 정확한 카운트 표시
  const filteredStatusCounts = useMemo(() => {
    // activeTab 필터를 제외한 필터링 (검색, 날짜, 공정 유형만)
    let filtered = [...operations];

    // 검색 필터
    if (searchTerm) {
      filtered = filtered.filter(op => 
        op.operation_id.toString().includes(searchTerm) ||
        op.input_item?.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.output_item?.item_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 공정 유형 필터
    if (filterType) {
      filtered = filtered.filter(op => op.operation_type === filterType);
    }

    // 날짜 필터
    if (startDate) {
      filtered = filtered.filter(op => {
        const opDate = op.started_at || op.created_at || '';
        return opDate >= startDate;
      });
    }
    if (endDate) {
      filtered = filtered.filter(op => {
        const opDate = op.started_at || op.created_at || '';
        return opDate <= endDate;
      });
    }

    // 상태별 카운트 계산
    const counts: Record<string, number> = {
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      ALL: filtered.length
    };

    filtered.forEach((op) => {
      if (op.status in counts) {
        counts[op.status as keyof typeof counts]++;
      }
    });

    return counts;
  }, [operations, searchTerm, filterType, startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">공정 관리</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
              {dataSource === 'coil_tracking' 
                ? '코일 공정 추적 내역을 관리합니다 (블랭킹, 전단, 절곡, 용접)'
                : '제조 공정 작업 내역을 관리합니다 (Blanking, Press, 조립)'}
        </p>
          </div>
          {/* 데이터 소스 선택 */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setDataSource('process_operations')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                dataSource === 'process_operations'
                  ? 'bg-gray-800 dark:bg-gray-700 text-white border-gray-900 dark:border-gray-600'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600'
              }`}
              title="일반 공정 작업"
            >
              공정 작업
            </button>
            <button
              onClick={() => setDataSource('coil_tracking')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                dataSource === 'coil_tracking'
                  ? 'bg-gray-800 dark:bg-gray-700 text-white border-gray-900 dark:border-gray-600'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600'
              }`}
              title="코일 공정 추적"
            >
              코일 추적
            </button>
          </div>
        </div>
      </div>

      {/* 탭 필터 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
        <div className="flex gap-1.5 overflow-x-auto">
          {TAB_OPTIONS.map((tab) => {
            // 상태별 색상 구분
            const getTabColors = (value: string, isActive: boolean) => {
              if (isActive) {
                switch (value) {
                  case 'PENDING':
                    return 'bg-gray-600 dark:bg-gray-500 text-white border-gray-700 dark:border-gray-400';
                  case 'IN_PROGRESS':
                    return 'bg-blue-600 dark:bg-blue-500 text-white border-blue-700 dark:border-blue-400';
                  case 'COMPLETED':
                    return 'bg-green-600 dark:bg-green-500 text-white border-green-700 dark:border-green-400';
                  case 'ALL':
                    return 'bg-gray-800 dark:bg-gray-700 text-white border-gray-900 dark:border-gray-600';
                  default:
                    return 'bg-gray-800 dark:bg-gray-700 text-white';
                }
              } else {
                return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600';
              }
            };

            // 필터링된 데이터(검색, 날짜 등)에서 해당 상태의 개수 표시
            // activeTab 필터는 제외하여 모든 탭에서 정확한 카운트 표시
            const count = filteredStatusCounts[tab.value] || 0;
            return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${getTabColors(tab.value, activeTab === tab.value)}`}
                title={tab.description}
            >
              {tab.label}
                {tab.value !== 'ALL' && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.value 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}>
                    {count}
                  </span>
                )}
            </button>
            );
          })}
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
        {/* 모바일 필터 토글 버튼 */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="sm:hidden flex items-center justify-between w-full mb-3 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            필터
          </span>
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
                placeholder="공정번호, 품목명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>

            {/* 공정 유형 필터 */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as OperationType | '')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            >
              <option value="">전체 공정</option>
              {Object.entries(OPERATION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {/* 시작일 */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>

            {/* 종료일 */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleAdd}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-xs font-medium whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              공정 등록
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
            disabled={deletingOperationId === -1}
            className="px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-xs font-medium"
          >
            {deletingOperationId === -1 ? '삭제 중...' : `선택 항목 삭제 (${selectedIds.size}개)`}
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
                  <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredOperations.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-gray-600 focus:ring-gray-400 dark:focus:ring-gray-500"
                    />
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <button
                      onClick={() => handleSort('operation_id')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      공정번호
                      {sortColumn === 'operation_id' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <button
                      onClick={() => handleSort('operation_type')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      공정유형
                      {sortColumn === 'operation_type' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <button
                      onClick={() => handleSort('input_item')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      투입재료
                      {sortColumn === 'input_item' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <button
                      onClick={() => handleSort('output_item')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      산출제품
                      {sortColumn === 'output_item' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <button
                      onClick={() => handleSort('input_quantity')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                    >
                      투입수량
                      {sortColumn === 'input_quantity' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <button
                      onClick={() => handleSort('output_quantity')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                    >
                      산출수량
                      {sortColumn === 'output_quantity' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <button
                      onClick={() => handleSort('efficiency')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mx-auto"
                    >
                      수율
                      {sortColumn === 'efficiency' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <button
                      onClick={() => handleSort('status')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mx-auto"
                    >
                      상태
                      {sortColumn === 'status' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <button
                      onClick={() => handleSort('operator')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      작업자
                      {sortColumn === 'operator' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {filteredOperations.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 sm:px-6 py-12 text-center text-gray-600 dark:text-gray-400">
                      공정 작업이 없습니다
                    </td>
                  </tr>
                ) : (
                  filteredOperations.map((operation) => (
                    <tr key={operation.operation_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-3 sm:px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(operation.operation_id)}
                          onChange={(e) => handleSelectItem(operation.operation_id, e.target.checked)}
                          className="rounded border-gray-300 text-gray-600 focus:ring-gray-400 dark:focus:ring-gray-500"
                        />
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {operation.operation_id}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {dataSource === 'coil_tracking' && operation.coil_process_type
                            ? operation.coil_process_type
                            : OPERATION_TYPE_LABELS[operation.operation_type]}
                        </div>
                        {dataSource === 'coil_tracking' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                            코일 추적
                          </div>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {operation.input_item?.item_name || '-'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {operation.input_item?.item_code || ''}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {operation.output_item?.item_name || '-'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {operation.output_item?.item_code || ''}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-right">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {operation.input_quantity.toLocaleString('ko-KR')}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-right">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {operation.output_quantity.toLocaleString('ko-KR')}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-center">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {calculateEfficiency(operation.input_quantity, operation.output_quantity)}%
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-center">
                        <ProcessStatusBadge status={operation.status} />
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {operation.operator_id || '-'}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Quick action buttons based on status (공정 작업만) */}
                          {dataSource === 'process_operations' && (
                            <>
                          {operation.status === 'PENDING' && (
                            <ProcessStartButton
                              operationId={operation.operation_id}
                              onStart={fetchOperations}
                            />
                          )}

                          {operation.status === 'IN_PROGRESS' && (
                            <ProcessCompleteButton
                              operationId={operation.operation_id}
                              onComplete={fetchOperations}
                            />
                              )}
                            </>
                          )}

                          {/* Standard Edit/Delete actions */}
                          <button
                            onClick={() => handleEdit(operation)}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(operation)}
                            disabled={deletingOperationId === operation.operation_id}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="삭제"
                          >
                            {deletingOperationId === operation.operation_id ? (
                              <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
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

      {/* 공정 작업 폼 모달 */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedOperation ? '공정 작업 수정' : '공정 작업 등록'}
        size="lg"
      >
        <ProcessOperationForm
          operation={selectedOperation}
          onSave={handleSaveOperation}
          onCancel={() => setIsFormOpen(false)}
        />
      </Modal>
    </div>
  );
}
