/**
 * 저장된 필터 관리 컴포넌트
 * Saved Filters Management Component
 */

import React, { useState, useEffect } from 'react';
import { Save, Bookmark, Trash2, Edit2, Calendar, Filter } from 'lucide-react';
import { FilterState } from '@/hooks/useAdvancedFilter';
import { useToast } from '@/contexts/ToastContext';

interface SavedFilter {
  name: string;
  filters: FilterState;
  createdAt: string;
}

interface SavedFiltersProps {
  currentFilters: FilterState;
  onLoadFilter: (name: string) => void;
  onSaveFilter: (name: string) => void;
  onDeleteFilter: (name: string) => void;
  getSavedFilters: () => SavedFilter[];
  className?: string;
  disabled?: boolean;
}

export const SavedFilters: React.FC<SavedFiltersProps> = ({
  currentFilters,
  onLoadFilter,
  onSaveFilter,
  onDeleteFilter,
  getSavedFilters,
  className = '',
  disabled = false
}) => {
  const { error: showError } = useToast();
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [editingFilter, setEditingFilter] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    refreshSavedFilters();
  }, [getSavedFilters]);

  const refreshSavedFilters = () => {
    setSavedFilters(getSavedFilters());
  };

  const handleSaveFilter = () => {
    if (!newFilterName.trim()) return;

    // 중복 이름 확인
    const exists = savedFilters.some(f => f.name === newFilterName.trim());
    if (exists) {
      if (!confirm('같은 이름의 필터가 존재합니다. 덮어쓰시겠습니까?')) {
        return;
      }
    }

    onSaveFilter(newFilterName.trim());
    setNewFilterName('');
    setShowSaveDialog(false);
    refreshSavedFilters();
  };

  const handleDeleteFilter = (name: string) => {
    if (confirm(`"${name}" 필터를 삭제하시겠습니까?`)) {
      onDeleteFilter(name);
      refreshSavedFilters();
    }
  };

  const handleEditFilter = (oldName: string) => {
    if (!editName.trim() || editName === oldName) {
      setEditingFilter(null);
      setEditName('');
      return;
    }

    // 중복 이름 확인
    const exists = savedFilters.some(f => f.name === editName.trim());
    if (exists) {
      showError('같은 이름의 필터가 이미 존재합니다.');
      return;
    }

    // 필터 이름 변경 (삭제 후 재저장)
    const filter = savedFilters.find(f => f.name === oldName);
    if (filter) {
      onDeleteFilter(oldName);
      // 현재 필터를 임시 저장 후 해당 필터로 교체
      const currentTemp = currentFilters;
      onLoadFilter(oldName); // 필터 데이터 로드
      onSaveFilter(editName.trim()); // 새 이름으로 저장
      // 원래 필터로 복원
      Object.assign(currentFilters, currentTemp);
    }

    setEditingFilter(null);
    setEditName('');
    refreshSavedFilters();
  };

  const getFilterDescription = (filters: FilterState): string => {
    const parts = [];

    if (filters.searchTerm) {
      parts.push(`검색: "${filters.searchTerm}"`);
    }

    if (filters.dateRange.startDate || filters.dateRange.endDate) {
      const start = filters.dateRange.startDate;
      const end = filters.dateRange.endDate;
      if (start && end) {
        parts.push(`기간: ${new Date(start).toLocaleDateString('ko-KR')} ~ ${new Date(end).toLocaleDateString('ko-KR')}`);
      } else if (start) {
        parts.push(`시작일: ${new Date(start).toLocaleDateString('ko-KR')}`);
      } else if (end) {
        parts.push(`종료일: ${new Date(end).toLocaleDateString('ko-KR')}`);
      }
    }

    const filterCount = Object.values(filters.filters).filter(
      v => v !== '' && v !== null && v !== undefined
    ).length;

    if (filterCount > 0) {
      parts.push(`필터: ${filterCount}개`);
    }

    return parts.length > 0 ? parts.join(', ') : '필터 없음';
  };

  const hasCurrentFilters = () => {
    return (
      currentFilters.searchTerm !== '' ||
      currentFilters.dateRange.startDate ||
      currentFilters.dateRange.endDate ||
      Object.values(currentFilters.filters).some(
        v => v !== '' && v !== null && v !== undefined
      )
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          저장된 필터
        </h3>
        <div className="flex gap-1">
          {hasCurrentFilters() && (
            <button
              onClick={() => setShowSaveDialog(true)}
              disabled={disabled}
              className="p-1 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              title="현재 필터 저장"
            >
              <Save className="w-4 h-4" />
            </button>
          )}
          {savedFilters.length > 0 && (
            <button
              onClick={() => setShowManageDialog(true)}
              disabled={disabled}
              className="p-1 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              title="필터 관리"
            >
              <Filter className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 저장된 필터 목록 */}
      {savedFilters.length > 0 ? (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {savedFilters.slice(0, 5).map((filter) => (
            <button
              key={filter.name}
              onClick={() => onLoadFilter(filter.name)}
              disabled={disabled}
              className="w-full p-2 text-left text-sm bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2">
                <Bookmark className="w-3 h-3 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {filter.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {getFilterDescription(filter.filters)}
                  </div>
                </div>
                <div className="text-xs text-gray-400 flex-shrink-0">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  {new Date(filter.createdAt).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
              </div>
            </button>
          ))}

          {savedFilters.length > 5 && (
            <button
              onClick={() => setShowManageDialog(true)}
              className="w-full p-2 text-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              +{savedFilters.length - 5}개 더 보기...
            </button>
          )}
        </div>
      ) : (
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          저장된 필터가 없습니다
        </div>
      )}

      {/* 필터 저장 다이얼로그 */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              필터 저장
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  필터 이름
                </label>
                <input
                  type="text"
                  value={newFilterName}
                  onChange={(e) => setNewFilterName(e.target.value)}
                  placeholder="필터 이름을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                현재 필터: {getFilterDescription(currentFilters)}
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setNewFilterName('');
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveFilter}
                  disabled={!newFilterName.trim()}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 필터 관리 다이얼로그 */}
      {showManageDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              저장된 필터 관리
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2">
              {savedFilters.map((filter) => (
                <div
                  key={filter.name}
                  className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    {editingFilter === filter.name ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => handleEditFilter(filter.name)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditFilter(filter.name);
                          if (e.key === 'Escape') {
                            setEditingFilter(null);
                            setEditName('');
                          }
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <div className="font-medium text-gray-900 dark:text-white">
                        {filter.name}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {getFilterDescription(filter.filters)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      저장일: {new Date(filter.createdAt).toLocaleString('ko-KR')}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onLoadFilter(filter.name)}
                      className="p-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                      title="필터 적용"
                    >
                      <Bookmark className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingFilter(filter.name);
                        setEditName(filter.name);
                      }}
                      className="p-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                      title="이름 변경"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteFilter(filter.name)}
                      className="p-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowManageDialog(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedFilters;