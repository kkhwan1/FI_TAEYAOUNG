'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Search, X, Calendar, Filter } from 'lucide-react';
import ProcessStatusBadge from '@/components/process/ProcessStatusBadge';
import type { CoilTraceabilityChain } from '@/types/coil';

interface ItemSearchResult {
  item_id: number;
  item_code: string;
  item_name: string;
  spec?: string;
}

// 날짜 기간 프리셋 옵션
type DatePreset = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export default function CoilTraceabilityView() {
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [traceabilityChain, setTraceabilityChain] = useState<CoilTraceabilityChain | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // 품목 검색 상태
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<ItemSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // 날짜 필터 상태
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  // 날짜 프리셋 적용
  const applyDatePreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    const today = new Date();
    let start = '';
    let end = today.toISOString().split('T')[0];

    switch (preset) {
      case 'today':
        start = end;
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        start = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        start = monthAgo.toISOString().split('T')[0];
        break;
      case 'quarter':
        const quarterAgo = new Date(today);
        quarterAgo.setMonth(today.getMonth() - 3);
        start = quarterAgo.toISOString().split('T')[0];
        break;
      case 'year':
        const yearAgo = new Date(today);
        yearAgo.setFullYear(today.getFullYear() - 1);
        start = yearAgo.toISOString().split('T')[0];
        break;
      case 'all':
      case 'custom':
        start = '';
        end = '';
        break;
    }

    setStartDate(start);
    setEndDate(preset === 'all' || preset === 'custom' ? '' : end);
  }, []);

  const fetchTraceability = useCallback(async (itemId: number, start?: string, end?: string) => {
    setIsLoading(true);
    setError('');

    try {
      // URL에 날짜 필터 파라미터 추가
      let url = `/api/coil/traceability/${itemId}`;
      const params = new URLSearchParams();
      if (start) params.append('start_date', start);
      if (end) params.append('end_date', end);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok || !result.success) {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(result.error) || '추적성 정보를 불러올 수 없습니다.');
      }

      setTraceabilityChain(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 품목 검색 핸들러 (디바운스 적용)
  const searchItems = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/items?search=${encodeURIComponent(query)}&limit=10`);
      const result = await response.json();

      if (result.success && result.data) {
        // API returns { success, data: { items: [...], pagination: {...} } }
        const items = Array.isArray(result.data) ? result.data : (result.data.items || []);
        setSearchResults(items);
        setShowDropdown(true);
      }
    } catch (err) {
      console.error('품목 검색 오류:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 디바운스된 검색
  useEffect(() => {
    const timer = setTimeout(() => {
      searchItems(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchItems]);

  // 품목 선택 핸들러
  const handleItemSelect = (item: ItemSearchResult) => {
    setSelectedItem(item);
    setSelectedItemId(item.item_id);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
    fetchTraceability(item.item_id, startDate, endDate);
  };

  // 날짜 필터 변경 시 자동 재조회
  useEffect(() => {
    if (selectedItemId) {
      fetchTraceability(selectedItemId, startDate, endDate);
    }
  }, [startDate, endDate, selectedItemId, fetchTraceability]);

  // 선택 취소 핸들러
  const clearSelection = () => {
    setSelectedItem(null);
    setSelectedItemId(null);
    setTraceabilityChain(null);
    setSearchQuery('');
    setError('');
  };

  const formatNumber = (value: number) => value.toLocaleString('ko-KR');

  const getYieldRateColor = (yieldRate: number) => {
    if (yieldRate >= 95) return 'text-green-600 dark:text-green-400';
    if (yieldRate >= 90) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">공정 추적성</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          품목의 상류/하류 공정 이력을 추적합니다.
        </p>
      </div>

      {/* 품목 선택 */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">추적할 품목 선택</label>

        {/* 선택된 품목이 있으면 표시, 없으면 검색 입력창 */}
        {selectedItem ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex items-center justify-between">
              <span>{selectedItem.item_code} - {selectedItem.item_name}</span>
              <button
                onClick={clearSelection}
                className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="선택 취소"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => selectedItemId && fetchTraceability(selectedItemId, startDate, endDate)}
              disabled={isLoading}
              className="bg-gray-800 dark:bg-gray-700 text-white px-6 py-2 rounded-md hover:bg-gray-900 dark:hover:bg-gray-600 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {isLoading ? '조회중...' : '다시 조회'}
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="품목코드 또는 품목명으로 검색..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                />
                {isSearching && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* 검색 결과 드롭다운 */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                {searchResults.map((item) => (
                  <button
                    key={item.item_id}
                    onClick={() => handleItemSelect(item)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.item_code}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {item.item_name}
                      {item.spec && <span className="ml-2 text-gray-400">({item.spec})</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* 검색 결과 없음 */}
            {showDropdown && searchQuery && searchResults.length === 0 && !isSearching && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg p-4 text-center text-gray-500 dark:text-gray-400">
                검색 결과가 없습니다.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 날짜 필터 */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">조회 기간</span>
          </div>
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
          >
            <Filter className="w-4 h-4" />
            {showDateFilter ? '필터 숨기기' : '필터 표시'}
          </button>
        </div>

        {/* 프리셋 버튼 */}
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { key: 'all' as DatePreset, label: '전체' },
            { key: 'today' as DatePreset, label: '오늘' },
            { key: 'week' as DatePreset, label: '1주일' },
            { key: 'month' as DatePreset, label: '1개월' },
            { key: 'quarter' as DatePreset, label: '3개월' },
            { key: 'year' as DatePreset, label: '1년' },
            { key: 'custom' as DatePreset, label: '직접 입력' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => applyDatePreset(key)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                datePreset === key
                  ? 'bg-gray-800 dark:bg-gray-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 직접 입력 필드 (showDateFilter 또는 custom 선택 시 표시) */}
        {(showDateFilter || datePreset === 'custom') && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">시작일:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <span className="text-gray-400">~</span>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">종료일:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => applyDatePreset('all')}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                초기화
              </button>
            )}
          </div>
        )}

        {/* 현재 필터 상태 표시 */}
        {(startDate || endDate) && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">적용된 필터:</span>{' '}
            {startDate && endDate ? (
              <span>{startDate} ~ {endDate}</span>
            ) : startDate ? (
              <span>{startDate} 이후</span>
            ) : (
              <span>{endDate} 이전</span>
            )}
          </div>
        )}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-200 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* 로딩 */}
      {isLoading && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          추적성 정보를 불러오는 중...
        </div>
      )}

      {/* 추적성 체인 표시 */}
      {!isLoading && traceabilityChain && (
        <>
          {/* 통계 요약 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">선택된 품목</div>
              <div className="text-lg font-bold mt-1 text-gray-900 dark:text-gray-100">
                {traceabilityChain.item_code} {traceabilityChain.item_name}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">상류 공정 (이 품목을 생산)</div>
              <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                {traceabilityChain.upstream.length}개
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">하류 공정 (이 품목을 사용)</div>
              <div className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
                {traceabilityChain.downstream.length}개
              </div>
            </div>
          </div>

          {/* 상류/하류 공정 표시 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 상류 공정 (Upstream) */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <span className="text-blue-600 dark:text-blue-400">⬆</span>
                상류 공정 (이 품목을 생산한 공정)
              </h2>

              {traceabilityChain.upstream.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  상류 공정이 없습니다.
                  <br />
                  <span className="text-sm">이 품목은 최초 투입 자재입니다.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {traceabilityChain.upstream.map((process) => (
                    <div
                      key={process.process_id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {/* 공정 헤더 */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            #{process.process_id} {process.process_type}
                          </span>
                          <ProcessStatusBadge status={process.status as any} />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(process.process_date).toLocaleDateString('ko-KR')}
                        </span>
                      </div>

                      {/* 투입 정보 */}
                      <div className="bg-gray-50 dark:bg-gray-700 rounded p-3 mb-2">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">투입 (소스)</div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{process.source_item_name}</div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          수량: {formatNumber(process.input_quantity)}
                        </div>
                      </div>

                      {/* 화살표 */}
                      <div className="text-center text-2xl text-gray-400 dark:text-gray-500 my-1">↓</div>

                      {/* 산출 정보 (현재 품목) */}
                      <div className="bg-blue-50 dark:bg-blue-900 rounded p-3">
                        <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">산출 (타겟)</div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {traceabilityChain.item_code} {traceabilityChain.item_name}
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          수량: {formatNumber(process.output_quantity)}
                        </div>
                        <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                          <span className="text-sm text-gray-900 dark:text-gray-100">수율: </span>
                          <span className={`text-sm font-semibold ${getYieldRateColor(process.yield_rate)}`}>
                            {process.yield_rate.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 하류 공정 (Downstream) */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <span className="text-green-600 dark:text-green-400">⬇</span>
                하류 공정 (이 품목을 사용한 공정)
              </h2>

              {traceabilityChain.downstream.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  하류 공정이 없습니다.
                  <br />
                  <span className="text-sm">이 품목은 최종 제품이거나 아직 사용되지 않았습니다.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {traceabilityChain.downstream.map((process) => (
                    <div
                      key={process.process_id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {/* 공정 헤더 */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            #{process.process_id} {process.process_type}
                          </span>
                          <ProcessStatusBadge status={process.status as any} />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(process.process_date).toLocaleDateString('ko-KR')}
                        </span>
                      </div>

                      {/* 투입 정보 (현재 품목) */}
                      <div className="bg-green-50 dark:bg-green-900 rounded p-3 mb-2">
                        <div className="text-xs text-green-600 dark:text-green-400 mb-1">투입 (소스)</div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {traceabilityChain.item_code} {traceabilityChain.item_name}
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          수량: {formatNumber(process.input_quantity)}
                        </div>
                      </div>

                      {/* 화살표 */}
                      <div className="text-center text-2xl text-gray-400 dark:text-gray-500 my-1">↓</div>

                      {/* 산출 정보 */}
                      <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">산출 (타겟)</div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{process.target_item_name}</div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          수량: {formatNumber(process.output_quantity)}
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-sm text-gray-900 dark:text-gray-100">수율: </span>
                          <span className={`text-sm font-semibold ${getYieldRateColor(process.yield_rate)}`}>
                            {process.yield_rate.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 초기 상태 (품목 미선택) - 빈 테이블 레이아웃 표시 */}
      {!isLoading && !traceabilityChain && !error && (
        <>
          {/* 통계 요약 - 빈 상태 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">선택된 품목</div>
              <div className="text-lg font-bold mt-1 text-gray-400 dark:text-gray-500">
                품목을 선택하세요
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">상류 공정 (이 품목을 생산)</div>
              <div className="text-2xl font-bold mt-1 text-gray-400 dark:text-gray-500">
                -
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">하류 공정 (이 품목을 사용)</div>
              <div className="text-2xl font-bold mt-1 text-gray-400 dark:text-gray-500">
                -
              </div>
            </div>
          </div>

          {/* 상류/하류 공정 - 빈 테이블 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 상류 공정 (Upstream) - 빈 상태 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <span className="text-blue-600 dark:text-blue-400">⬆</span>
                상류 공정 (이 품목을 생산한 공정)
              </h2>
              <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  품목을 선택하면 상류 공정이 표시됩니다.
                </p>
              </div>
            </div>

            {/* 하류 공정 (Downstream) - 빈 상태 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <span className="text-green-600 dark:text-green-400">⬇</span>
                하류 공정 (이 품목을 사용한 공정)
              </h2>
              <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  품목을 선택하면 하류 공정이 표시됩니다.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
