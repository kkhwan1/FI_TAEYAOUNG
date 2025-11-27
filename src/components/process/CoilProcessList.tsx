'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Calendar, AlertTriangle } from 'lucide-react';
import VirtualTable, { VirtualTableColumn } from '@/components/ui/VirtualTable';
import ProcessStatusBadge from '@/components/process/ProcessStatusBadge';
import type { CoilProcessWithDetails } from '@/types/coil';

export default function CoilProcessList() {
  const router = useRouter();

  const [processes, setProcesses] = useState<CoilProcessWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    PENDING: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    ALL: 0
  });

  // 필터 상태
  const [filters, setFilters] = useState({
    status: '',
    process_type: '',
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    fetchProcesses();
  }, [filters]);

  const fetchProcesses = async () => {
    setIsLoading(true);
    setError('');

    try {
      // 쿼리 파라미터 구성
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.process_type) params.append('process_type', filters.process_type);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);

      const response = await fetch(`/api/coil/process?${params.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(result.error) || '공정 목록을 불러올 수 없습니다.');
      }

      setProcesses(result.data || []);
      
      // API에서 받은 상태별 개수 사용 (없으면 로컬 계산)
      if (result.statusCounts) {
        setStatusCounts(result.statusCounts);
      } else {
        // 폴백: 로컬에서 계산
        const counts: Record<string, number> = {
          PENDING: 0,
          IN_PROGRESS: 0,
          COMPLETED: 0,
          CANCELLED: 0,
          ALL: result.data?.length || 0
        };
        
        (result.data || []).forEach((p: CoilProcessWithDetails) => {
          if (p.status in counts) {
            counts[p.status as keyof typeof counts]++;
          }
        });
        
        setStatusCounts(counts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (process: CoilProcessWithDetails) => {
    router.push(`/process/coil-tracking/${process.process_id}`);
  };

  const getYieldRateColor = (yieldRate: number) => {
    if (yieldRate >= 95) return 'text-green-600 dark:text-green-400 font-semibold';
    if (yieldRate >= 90) return 'text-yellow-600 dark:text-yellow-400 font-semibold';
    return 'text-red-600 dark:text-red-400 font-semibold';
  };

  const columns: VirtualTableColumn<CoilProcessWithDetails>[] = [
    {
      key: 'process_id',
      label: '#',
      width: '8%',
      render: (value: unknown) => `#${value}`
    },
    {
      key: 'process_type',
      label: '공정유형',
      width: '10%'
    },
    {
      key: 'source_item',
      label: '투입 코일',
      width: '18%',
      render: (_: unknown, row: CoilProcessWithDetails) => (
        <div className="truncate" title={`${row.source_item?.item_code || ''} ${row.source_item?.item_name || ''}`}>
          <div className="font-medium text-gray-900 dark:text-white truncate">{row.source_item?.item_code || '-'}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{row.source_item?.item_name || ''}</div>
        </div>
      )
    },
    {
      key: 'target_item',
      label: '산출 품목',
      width: '18%',
      render: (_: unknown, row: CoilProcessWithDetails) => (
        <div className="truncate" title={`${row.target_item?.item_code || ''} ${row.target_item?.item_name || ''}`}>
          <div className="font-medium text-gray-900 dark:text-white truncate">{row.target_item?.item_code || '-'}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{row.target_item?.item_name || ''}</div>
        </div>
      )
    },
    {
      key: 'input_quantity',
      label: '투입량',
      width: '9%',
      align: 'right' as const,
      render: (value: unknown) => <span className="whitespace-nowrap">{(value as number).toLocaleString()}</span>
    },
    {
      key: 'output_quantity',
      label: '산출량',
      width: '9%',
      align: 'right' as const,
      render: (value: unknown) => <span className="whitespace-nowrap">{(value as number).toLocaleString()}</span>
    },
    {
      key: 'yield_rate',
      label: '수율(%)',
      width: '9%',
      align: 'right' as const,
      render: (value: unknown) => (
        <span className={`whitespace-nowrap ${getYieldRateColor(value as number)}`}>
          {(value as number).toFixed(2)}%
        </span>
      )
    },
    {
      key: 'process_date',
      label: '공정일자',
      width: '11%',
      render: (value: unknown) => <span className="whitespace-nowrap">{new Date(value as string).toLocaleDateString('ko-KR')}</span>
    },
    {
      key: 'status',
      label: '상태',
      width: '8%',
      render: (value: unknown) => <ProcessStatusBadge status={value as any} />
    }
  ];

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">공정 관리</h1>
        <button
          onClick={() => router.push('/process/coil-tracking/new')}
          className="bg-gray-800 dark:bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-900 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          새 공정 등록
        </button>
      </div>

      {/* Phase 2 Pill-Style Filter Toolbar */}
      <div className="space-y-4">
        {/* Status Filter Pills */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">상태</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { value: '', label: '전체', description: '모든 상태의 공정' },
              { value: 'PENDING', label: '대기', description: '등록만 된 공정' },
              { value: 'IN_PROGRESS', label: '진행중', description: '작업이 시작된 공정' },
              { value: 'COMPLETED', label: '완료', description: '완료된 공정' },
              { value: 'CANCELLED', label: '취소', description: '취소된 공정' }
            ].map((tab) => {
              const getTabColors = (value: string, isActive: boolean) => {
                if (isActive) {
                  switch (value) {
                    case 'PENDING':
                      return 'bg-gray-600 text-white border-gray-700';
                    case 'IN_PROGRESS':
                      return 'bg-blue-600 text-white border-blue-700';
                    case 'COMPLETED':
                      return 'bg-green-600 text-white border-green-700';
                    case 'CANCELLED':
                      return 'bg-red-600 text-white border-red-700';
                    case '':
                      return 'bg-gray-800 text-white border-gray-900';
                    default:
                      return 'bg-gray-800 text-white';
                  }
                } else {
                  return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600';
                }
              };

              const count = tab.value === '' ? statusCounts.ALL : (statusCounts[tab.value] || 0);
              const isActive = filters.status === tab.value;

              return (
            <button
                  key={tab.value || 'ALL'}
                  onClick={() => setFilters({ ...filters, status: tab.value })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border ${getTabColors(tab.value, isActive)}`}
                  title={tab.description}
                >
                  {tab.label}
                  {tab.value !== '' && (
                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                      isActive 
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

        {/* Process Type Filter Pills */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">공정 유형</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilters({ ...filters, process_type: '' })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filters.process_type === ''
                  ? 'bg-gray-800 text-white dark:bg-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setFilters({ ...filters, process_type: '블랭킹' })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filters.process_type === '블랭킹'
                  ? 'bg-gray-800 text-white dark:bg-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              블랭킹
            </button>
            <button
              onClick={() => setFilters({ ...filters, process_type: '전단' })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filters.process_type === '전단'
                  ? 'bg-gray-800 text-white dark:bg-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              전단
            </button>
            <button
              onClick={() => setFilters({ ...filters, process_type: '절곡' })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filters.process_type === '절곡'
                  ? 'bg-gray-800 text-white dark:bg-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              절곡
            </button>
            <button
              onClick={() => setFilters({ ...filters, process_type: '용접' })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filters.process_type === '용접'
                  ? 'bg-gray-800 text-white dark:bg-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              용접
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">공정 기간</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                className="pl-10 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="시작일"
              />
            </div>
            <span className="text-gray-500 dark:text-gray-400">~</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                className="pl-10 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="종료일"
              />
            </div>
            {(filters.status || filters.process_type || filters.start_date || filters.end_date) && (
              <button
                onClick={() => setFilters({ status: '', process_type: '', start_date: '', end_date: '' })}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline"
              >
                필터 초기화
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">전체 공정</div>
          <div className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">{statusCounts.ALL}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">완료</div>
          <div className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
            {statusCounts.COMPLETED}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">진행중</div>
          <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
            {statusCounts.IN_PROGRESS}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">평균 수율</div>
          <div className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">
            {processes.length > 0
              ? (processes.reduce((sum, p) => sum + (p.yield_rate ?? 0), 0) / processes.length).toFixed(2)
              : 0}%
          </div>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-200 px-4 py-3 rounded flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 공정 목록 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">로딩 중...</div>
        ) : processes.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            공정 데이터가 없습니다.
            <br />
            <button
              onClick={() => router.push('/process/coil-tracking/new')}
              className="mt-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
            >
              새 공정 등록하기
            </button>
          </div>
        ) : (
          <div className="h-[calc(100vh-400px)] min-h-[400px]">
            <VirtualTable
              data={processes}
              columns={columns}
              onRowClick={handleRowClick}
            />
          </div>
        )}
      </div>
    </div>
  );
}
