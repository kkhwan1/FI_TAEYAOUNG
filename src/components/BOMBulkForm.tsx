'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Loader2, Search, Plus, Trash2, AlertCircle } from 'lucide-react';

interface BOMEntry {
  id: string; // 임시 ID (클라이언트 측)
  parent_item_id: number;
  child_item_id: number;
  parent_item_name?: string;
  child_item_name?: string;
  quantity: number;
  notes?: string;
  errors?: string[];
}

interface Item {
  item_id: number;
  item_code: string;
  item_name: string;
  category: string;
  unit: string;
  inventory_type?: string;
}

interface BOMBulkFormProps {
  items: Item[];
  onSubmit: (entries: Omit<BOMEntry, 'id' | 'parent_item_name' | 'child_item_name' | 'errors'>[]) => Promise<{
    success: boolean;
    message?: string;
    data?: {
      success_count: number;
      fail_count: number;
      validation_errors?: { index: number; errors: string[] }[];
    };
  }>;
  onCancel: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function BOMBulkForm({ items, onSubmit, onCancel }: BOMBulkFormProps) {
  const [entries, setEntries] = useState<BOMEntry[]>([
    { id: generateId(), parent_item_id: 0, child_item_id: 0, quantity: 1, notes: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showCoilOnly, setShowCoilOnly] = useState(false);

  // 검색 상태 관리
  const [activeDropdown, setActiveDropdown] = useState<{ entryId: string; type: 'parent' | 'child' } | null>(null);
  const [searchTerms, setSearchTerms] = useState<Record<string, { parent: string; child: string }>>({});

  // 새 행 추가
  const addEntry = useCallback(() => {
    const newEntry: BOMEntry = {
      id: generateId(),
      parent_item_id: 0,
      child_item_id: 0,
      quantity: 1,
      notes: ''
    };
    setEntries(prev => [...prev, newEntry]);
    setSearchTerms(prev => ({
      ...prev,
      [newEntry.id]: { parent: '', child: '' }
    }));
  }, []);

  // 행 제거
  const removeEntry = useCallback((id: string) => {
    if (entries.length <= 1) return;
    setEntries(prev => prev.filter(e => e.id !== id));
    setSearchTerms(prev => {
      const newTerms = { ...prev };
      delete newTerms[id];
      return newTerms;
    });
  }, [entries.length]);

  // 항목 업데이트
  const updateEntry = useCallback((id: string, field: keyof BOMEntry, value: any) => {
    setEntries(prev => prev.map(entry =>
      entry.id === id ? { ...entry, [field]: value, errors: undefined } : entry
    ));
  }, []);

  // 검색어 업데이트
  const updateSearchTerm = useCallback((id: string, type: 'parent' | 'child', value: string) => {
    setSearchTerms(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [type]: value
      }
    }));
  }, []);

  // 품목 선택
  const selectItem = useCallback((entryId: string, type: 'parent' | 'child', item: Item) => {
    const fieldId = type === 'parent' ? 'parent_item_id' : 'child_item_id';
    const fieldName = type === 'parent' ? 'parent_item_name' : 'child_item_name';

    setEntries(prev => prev.map(entry =>
      entry.id === entryId
        ? {
            ...entry,
            [fieldId]: item.item_id,
            [fieldName]: `${item.item_code} - ${item.item_name}`,
            errors: undefined
          }
        : entry
    ));

    setSearchTerms(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        [type]: `${item.item_code} - ${item.item_name}`
      }
    }));

    setActiveDropdown(null);
  }, []);

  // 필터링된 품목 목록
  const getFilteredItems = useCallback((entryId: string, type: 'parent' | 'child') => {
    const searchTerm = searchTerms[entryId]?.[type]?.toLowerCase() || '';
    const entry = entries.find(e => e.id === entryId);

    return items.filter(item => {
      // 모품목은 제품 카테고리만
      if (type === 'parent' && item.category !== '제품') return false;

      // 자품목은 자기 참조 방지
      if (type === 'child' && entry && item.item_id === entry.parent_item_id) return false;

      // 코일 필터 (자품목에만 적용)
      if (type === 'child' && showCoilOnly && item.inventory_type !== '코일') return false;

      // 검색어가 없으면 모든 항목 표시, 있으면 필터링
      if (!searchTerm) {
        return true;
      }

      // 검색어 필터
      return (
        item.item_code.toLowerCase().includes(searchTerm) ||
        item.item_name.toLowerCase().includes(searchTerm)
      );
    }).slice(0, 20); // 검색어 없을 때 더 많은 항목 표시를 위해 20개로 증가
  }, [items, searchTerms, entries, showCoilOnly]);

  // 로컬 유효성 검사
  const validateEntries = useCallback((): boolean => {
    let isValid = true;
    const newEntries = entries.map(entry => {
      const errors: string[] = [];

      if (!entry.parent_item_id) {
        errors.push('모품목을 선택해주세요');
      }
      if (!entry.child_item_id) {
        errors.push('자품목을 선택해주세요');
      }
      if (!entry.quantity || entry.quantity <= 0) {
        errors.push('소요량은 0보다 커야 합니다');
      }
      if (entry.parent_item_id && entry.parent_item_id === entry.child_item_id) {
        errors.push('모품목과 자품목이 동일할 수 없습니다');
      }

      if (errors.length > 0) isValid = false;
      return { ...entry, errors: errors.length > 0 ? errors : undefined };
    });

    // 배치 내 중복 검사
    const seen = new Set<string>();
    newEntries.forEach(entry => {
      if (entry.parent_item_id && entry.child_item_id) {
        const key = `${entry.parent_item_id}-${entry.child_item_id}`;
        if (seen.has(key)) {
          entry.errors = [...(entry.errors || []), '중복된 BOM 항목입니다'];
          isValid = false;
        }
        seen.add(key);
      }
    });

    setEntries(newEntries);
    return isValid;
  }, [entries]);

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    if (!validateEntries()) {
      setGlobalError('입력 항목을 확인해주세요.');
      return;
    }

    setLoading(true);
    try {
      const submitData = entries.map(entry => ({
        parent_item_id: entry.parent_item_id,
        child_item_id: entry.child_item_id,
        quantity: entry.quantity,
        notes: entry.notes
      }));

      const result = await onSubmit(submitData);

      if (result.success) {
        // 서버에서 반환한 validation_errors가 있으면 표시
        if (result.data?.validation_errors && result.data.validation_errors.length > 0) {
          const newEntries = [...entries];
          result.data.validation_errors.forEach(error => {
            const idx = error.index - 1; // 1-based to 0-based
            if (newEntries[idx]) {
              newEntries[idx].errors = error.errors;
            }
          });
          setEntries(newEntries);

          if (result.data.success_count > 0) {
            // 일부 성공 시 성공한 항목 제거
            setGlobalError(`${result.data.success_count}개 등록됨, ${result.data.fail_count}개 실패`);
          }
        } else {
          // 전체 성공 - 모달 닫기
          onCancel();
        }
      } else {
        setGlobalError(result.message || '등록에 실패했습니다.');
      }
    } catch (error: any) {
      setGlobalError(error.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 드롭다운 외부 클릭 처리
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 h-full">
      {/* 전역 에러 */}
      {globalError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{globalError}</span>
        </div>
      )}

      {/* 코일 필터 */}
      <div className="flex items-center justify-between">
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={showCoilOnly}
            onChange={(e) => setShowCoilOnly(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
          />
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            코일 자재만 표시
          </span>
        </label>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {entries.length}개 항목
        </span>
      </div>

      {/* 테이블 헤더 */}
      <div className="grid grid-cols-12 gap-2 px-2 py-2 bg-gray-50 dark:bg-gray-800 rounded-t-lg text-sm font-medium text-gray-700 dark:text-gray-300">
        <div className="col-span-4">모품목 *</div>
        <div className="col-span-4">자품목 *</div>
        <div className="col-span-2">소요량 *</div>
        <div className="col-span-1">비고</div>
        <div className="col-span-1"></div>
      </div>

      {/* 항목 목록 */}
      <div className="space-y-2 flex-1 min-h-[50vh] max-h-[75vh] overflow-y-auto">
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className={`grid grid-cols-12 gap-2 p-2 rounded-lg border ${
              entry.errors
                ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            {/* 모품목 */}
            <div className="col-span-4 relative dropdown-container">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerms[entry.id]?.parent || entry.parent_item_name || ''}
                  onChange={(e) => {
                    updateSearchTerm(entry.id, 'parent', e.target.value);
                    if (!e.target.value) {
                      updateEntry(entry.id, 'parent_item_id', 0);
                      updateEntry(entry.id, 'parent_item_name', '');
                    }
                  }}
                  onFocus={() => {
                    setActiveDropdown({ entryId: entry.id, type: 'parent' });
                    // 포커스 시 검색어가 없으면 빈 문자열로 설정하여 모든 항목 표시
                    if (!searchTerms[entry.id]?.parent) {
                      updateSearchTerm(entry.id, 'parent', '');
                    }
                  }}
                  className="w-full px-3 py-1.5 pr-8 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="모품목 검색..."
                />
                <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>

              {activeDropdown?.entryId === entry.id && activeDropdown?.type === 'parent' && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {getFilteredItems(entry.id, 'parent').map(item => (
                    <button
                      key={item.item_id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectItem(entry.id, 'parent', item);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{item.item_code}</div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">{item.item_name}</div>
                    </button>
                  ))}
                  {getFilteredItems(entry.id, 'parent').length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      검색 결과가 없습니다
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 자품목 */}
            <div className="col-span-4 relative dropdown-container">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerms[entry.id]?.child || entry.child_item_name || ''}
                  onChange={(e) => {
                    updateSearchTerm(entry.id, 'child', e.target.value);
                    if (!e.target.value) {
                      updateEntry(entry.id, 'child_item_id', 0);
                      updateEntry(entry.id, 'child_item_name', '');
                    }
                  }}
                  onFocus={() => {
                    setActiveDropdown({ entryId: entry.id, type: 'child' });
                    // 포커스 시 검색어가 없으면 빈 문자열로 설정하여 모든 항목 표시
                    if (!searchTerms[entry.id]?.child) {
                      updateSearchTerm(entry.id, 'child', '');
                    }
                  }}
                  className="w-full px-3 py-1.5 pr-8 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="자품목 검색..."
                />
                <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>

              {activeDropdown?.entryId === entry.id && activeDropdown?.type === 'child' && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {getFilteredItems(entry.id, 'child').map(item => (
                    <button
                      key={item.item_id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectItem(entry.id, 'child', item);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{item.item_code}</div>
                          <div className="text-gray-500 dark:text-gray-400 text-xs">{item.item_name}</div>
                        </div>
                        {item.inventory_type === '코일' && (
                          <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                            코일
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                  {getFilteredItems(entry.id, 'child').length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      검색 결과가 없습니다
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 소요량 */}
            <div className="col-span-2">
              <input
                type="number"
                value={entry.quantity}
                onChange={(e) => updateEntry(entry.id, 'quantity', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                className="w-full px-3 py-1.5 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="1"
              />
            </div>

            {/* 비고 */}
            <div className="col-span-1">
              <input
                type="text"
                value={entry.notes || ''}
                onChange={(e) => updateEntry(entry.id, 'notes', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder=""
              />
            </div>

            {/* 삭제 버튼 */}
            <div className="col-span-1 flex items-center justify-center">
              <button
                type="button"
                onClick={() => removeEntry(entry.id)}
                disabled={entries.length <= 1}
                className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                title="행 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* 에러 메시지 */}
            {entry.errors && entry.errors.length > 0 && (
              <div className="col-span-12 text-xs text-red-600 dark:text-red-400">
                {entry.errors.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 행 추가 버튼 */}
      <button
        type="button"
        onClick={addEntry}
        className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        행 추가
      </button>

      {/* 버튼 그룹 */}
      <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              처리중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {entries.length}개 항목 등록
            </>
          )}
        </button>
      </div>
    </form>
  );
}
