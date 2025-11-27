'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Search, Filter, X, ChevronDown, ChevronUp, RotateCcw,
  Star, Download, SortAsc, SortDesc
} from 'lucide-react';
import DateRangePicker, { DateRange } from './DateRangePicker';
import SearchPresets from './SearchPresets';
import {
  useAdvancedSearch,
  ItemSearchFilters,
  CompanySearchFilters,
  BOMSearchFilters,
  TransactionSearchFilters,
  BaseSearchFilters
} from '@/hooks/useAdvancedSearch';

// Type definitions for number range inputs
interface NumberRange {
  min: number | null;
  max: number | null;
}

// Props for the AdvancedSearch component
interface AdvancedSearchProps<T extends BaseSearchFilters> {
  entityType: 'items' | 'companies' | 'bom' | 'transactions';
  initialFilters: T;
  onFiltersChange?: (filters: T) => void;
  onSearch?: (filters: T) => Promise<any[]>;
  searchResults?: any[];
  loading?: boolean;
  className?: string;
  placeholder?: string;
  showPresets?: boolean;
  showExport?: boolean;
  sortOptions?: Array<{ value: string; label: string }>;
}

// Filter chip component for displaying active filters
function FilterChip({
  label,
  value,
  onRemove
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-xs rounded-full">
      <span className="font-medium">{label}:</span>
      <span>{value}</span>
      <button
        onClick={onRemove}
        className="ml-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full p-0.5"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// Number range input component
function NumberRangeInput({
  value,
  onChange,
  placeholder,
  unit = '',
  min,
  max,
  step = 1
}: {
  value: NumberRange;
  onChange: (value: NumberRange) => void;
  placeholder?: { min?: string; max?: string };
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value.min || ''}
        onChange={(e) => onChange({ ...value, min: e.target.value ? Number(e.target.value) : null })}
        placeholder={placeholder?.min || '최소값'}
        min={min}
        max={max}
        step={step}
        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
      <span className="text-gray-500 dark:text-gray-400 text-sm">~</span>
      <input
        type="number"
        value={value.max || ''}
        onChange={(e) => onChange({ ...value, max: e.target.value ? Number(e.target.value) : null })}
        placeholder={placeholder?.max || '최대값'}
        min={min}
        max={max}
        step={step}
        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
      {unit && <span className="text-gray-500 dark:text-gray-400 text-sm">{unit}</span>}
    </div>
  );
}

// Main AdvancedSearch component
export default function AdvancedSearch<T extends BaseSearchFilters>({
  entityType,
  initialFilters,
  onFiltersChange,
  onSearch,
  searchResults = [],
  loading = false,
  className = '',
  placeholder = '검색어를 입력하세요...',
  showPresets = true,
  showExport = true,
  sortOptions = []
}: AdvancedSearchProps<T>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPresetPanel, setShowPresetPanel] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Use the advanced search hook
  const {
    filters,
    results,
    loading: searchLoading,
    error,
    searchHistory,
    savedPresets,
    updateFilter,
    updateFilters,
    resetFilters,
    clearFilter,
    executeSearch,
    savePreset,
    loadPreset,
    deletePreset,
    hasActiveFilters,
    getActiveFilterCount
  } = useAdvancedSearch(entityType, initialFilters, onSearch);

  // Update parent component when filters change
  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  // Generate search suggestions based on search history and current input
  useEffect(() => {
    if (filters.search?.trim()) {
      const suggestions = searchHistory
        .filter(term => term.toLowerCase().includes(filters.search!.toLowerCase()) && term !== filters.search)
        .slice(0, 5);
      setSearchSuggestions(suggestions);
    } else {
      setSearchSuggestions(searchHistory.slice(0, 5));
    }
  }, [filters.search, searchHistory]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle export search results
  const handleExportResults = () => {
    if (searchResults.length === 0) return;

    const csvContent = generateCSV(searchResults, entityType);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityType}_search_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate CSV content based on entity type
  const generateCSV = (data: Record<string, any>[], type: string): string => {
    if (data.length === 0) return '';

    const headers = getCSVHeaders(type);
    const rows = data.map(item => headers.map(header => {
      const value = item[header.key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'number') return value.toString();
      if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
      return `"${String(value).replace(/"/g, '""')}"`;
    }));

    return [
      headers.map(h => h.label).join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  };

  // Get CSV headers based on entity type
  const getCSVHeaders = (type: string) => {
    switch (type) {
      case 'items':
        return [
          { key: 'item_code', label: '품번' },
          { key: 'item_name', label: '품명' },
          { key: 'item_type', label: '타입' },
          { key: 'car_model', label: '차종' },
          { key: 'spec', label: '규격' },
          { key: 'unit', label: '단위' },
          { key: 'current_stock', label: '현재고' },
          { key: 'min_stock_level', label: '최소재고' },
          { key: 'unit_price', label: '단가' }
        ];
      case 'companies':
        return [
          { key: 'company_code', label: '거래처코드' },
          { key: 'company_name', label: '거래처명' },
          { key: 'company_type', label: '타입' },
          { key: 'contact_person', label: '담당자' },
          { key: 'phone', label: '전화번호' },
          { key: 'email', label: '이메일' }
        ];
      default:
        return [];
    }
  };

  // Create a wrapper function that converts the generic updateFilter to the expected signature
  const updateFilterWrapper = (key: string, value: unknown) => {
    updateFilter(key as keyof T, value as T[keyof T]);
  };

  // Render entity-specific filter fields
  const renderEntityFilters = () => {
    switch (entityType) {
      case 'items':
        return renderItemFilters(filters as unknown as ItemSearchFilters, updateFilterWrapper);
      case 'companies':
        return renderCompanyFilters(filters as unknown as CompanySearchFilters, updateFilterWrapper);
      case 'bom':
        return renderBOMFilters(filters as unknown as BOMSearchFilters, updateFilterWrapper);
      case 'transactions':
        return renderTransactionFilters(filters as unknown as TransactionSearchFilters, updateFilterWrapper);
      default:
        return null;
    }
  };

  // Render filter chips for active filters
  const renderFilterChips = () => {
    const chips: React.ReactElement[] = [];

    Object.entries(filters).forEach(([key, value]) => {
      if (key === 'search' || key === 'sortBy' || key === 'sortOrder') return;
      if (value === null || value === undefined || value === '' ||
          (Array.isArray(value) && value.length === 0)) return;

      let displayValue = '';
      let displayLabel = '';

      switch (key) {
        case 'dateRange':
          const range = value as DateRange;
          if (range.startDate || range.endDate) {
            displayLabel = '날짜';
            displayValue = `${range.startDate ? range.startDate.toLocaleDateString('ko-KR') : ''} ~ ${range.endDate ? range.endDate.toLocaleDateString('ko-KR') : ''}`;
          }
          break;
        case 'itemType':
          displayLabel = '품목타입';
          displayValue = value as string;
          break;
        case 'companyType':
          displayLabel = '거래처타입';
          displayValue = value as string;
          break;
        case 'stockLevel':
        case 'priceRange':
        case 'quantityRange':
        case 'amountRange':
          const range_val = value as NumberRange;
          if (range_val.min !== null || range_val.max !== null) {
            displayLabel = key === 'stockLevel' ? '재고수준' :
                          key === 'priceRange' ? '가격범위' :
                          key === 'quantityRange' ? '수량범위' : '금액범위';
            const min = range_val.min !== null ? range_val.min.toLocaleString() : '';
            const max = range_val.max !== null ? range_val.max.toLocaleString() : '';
            displayValue = `${min} ~ ${max}`;
          }
          break;
        case 'isLowStock':
          if (value === true) {
            displayLabel = '상태';
            displayValue = '재고부족';
          }
          break;
        case 'hasMinStock':
          if (value === true) {
            displayLabel = '최소재고';
            displayValue = '설정됨';
          }
          break;
        default:
          if (typeof value === 'string' && value.trim()) {
            displayLabel = key;
            displayValue = value;
          }
          break;
      }

      if (displayValue && displayLabel) {
        chips.push(
          <FilterChip
            key={key}
            label={displayLabel}
            value={displayValue}
            onRemove={() => clearFilter(key as keyof T)}
          />
        );
      }
    });

    return chips;
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Main Search Bar */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={filters.search}
                onChange={(e) => updateFilter('search' as keyof T, e.target.value as T[keyof T])}
                onFocus={() => setShowSuggestions(true)}
                placeholder={placeholder}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* Search Suggestions */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm z-50 max-h-48 overflow-y-auto">
                  {searchSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        updateFilter('search' as keyof T, suggestion as T[keyof T]);
                        setShowSuggestions(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-sm text-gray-900 dark:text-white"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sort Dropdown */}
          {sortOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilter('sortBy' as keyof T, e.target.value as T[keyof T])}
                className="px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => updateFilter('sortOrder' as keyof T, (filters.sortOrder === 'asc' ? 'desc' : 'asc') as T[keyof T])}
                className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                title={`정렬 순서: ${filters.sortOrder === 'asc' ? '오름차순' : '내림차순'}`}
              >
                {filters.sortOrder === 'asc' ? <SortAsc className="w-5 h-5" /> : <SortDesc className="w-5 h-5" />}
              </button>
            </div>
          )}

          {/* Filter Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${hasActiveFilters ? 'bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600' : ''}`}
          >
            <Filter className="w-5 h-5" />
            <span className="hidden sm:inline">필터</span>
            {getActiveFilterCount > 0 && (
              <span className="bg-gray-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {getActiveFilterCount}
              </span>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Presets Toggle */}
          {showPresets && (
            <button
              onClick={() => setShowPresetPanel(!showPresetPanel)}
              className="flex items-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <Star className="w-5 h-5" />
              <span className="hidden sm:inline">프리셋</span>
            </button>
          )}

          {/* Export Button */}
          {showExport && searchResults.length > 0 && (
            <button
              onClick={handleExportResults}
              className="flex items-center gap-2 px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              title="검색 결과 내보내기"
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline">내보내기</span>
            </button>
          )}

          {/* Reset Button */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-2 px-4 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              title="모든 필터 초기화"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="hidden sm:inline">초기화</span>
            </button>
          )}
        </div>

        {/* Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mt-3">
            {renderFilterChips()}
          </div>
        )}

        {/* Search Results Summary */}
        <div className="flex items-center justify-between mt-3 text-sm text-gray-600 dark:text-gray-400">
          <div>
            {loading || searchLoading ? (
              <span>검색 중...</span>
            ) : (
              <span>
                총 {searchResults.length.toLocaleString()}개 결과
                {hasActiveFilters && ' (필터 적용됨)'}
              </span>
            )}
          </div>
          {error && (
            <div className="text-gray-500 dark:text-gray-400">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
          {renderEntityFilters()}
        </div>
      )}

      {/* Presets Panel */}
      {showPresetPanel && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <SearchPresets
            presets={savedPresets}
            onLoadPreset={loadPreset}
            onSavePreset={savePreset}
            onDeletePreset={deletePreset}
            currentFilters={filters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      )}
    </div>
  );
}

// Helper functions to render entity-specific filters
function renderItemFilters(filters: ItemSearchFilters, updateFilter: (key: string, value: unknown) => void) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Item Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          품목 타입
        </label>
        <select
          value={filters.itemType}
          onChange={(e) => updateFilter('itemType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체</option>
          <option value="MATERIAL">자재</option>
          <option value="PRODUCT">제품</option>
          <option value="SCRAP">스크랩</option>
        </select>
      </div>

      {/* Car Model */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          차종
        </label>
        <input
          type="text"
          value={filters.carModel}
          onChange={(e) => updateFilter('carModel', e.target.value)}
          placeholder="차종 입력"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          위치
        </label>
        <input
          type="text"
          value={filters.location}
          onChange={(e) => updateFilter('location', e.target.value)}
          placeholder="위치 입력"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Stock Level Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          재고 수준
        </label>
        <NumberRangeInput
          value={filters.stockLevel || { min: null, max: null }}
          onChange={(value) => updateFilter('stockLevel', value)}
          placeholder={{ min: '최소 재고', max: '최대 재고' }}
          min={0}
        />
      </div>

      {/* Price Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          단가 범위
        </label>
        <NumberRangeInput
          value={filters.priceRange || { min: null, max: null }}
          onChange={(value) => updateFilter('priceRange', value)}
          placeholder={{ min: '최소 단가', max: '최대 단가' }}
          unit="원"
          min={0}
        />
      </div>

      {/* Boolean Filters */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          상태 필터
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.isLowStock === true}
              onChange={(e) => updateFilter('isLowStock', e.target.checked ? true : null)}
              className="rounded border-gray-300 text-gray-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">재고 부족 품목만</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.hasMinStock === true}
              onChange={(e) => updateFilter('hasMinStock', e.target.checked ? true : null)}
              className="rounded border-gray-300 text-gray-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">최소재고 설정된 품목만</span>
          </label>
        </div>
      </div>
    </div>
  );
}

function renderCompanyFilters(filters: CompanySearchFilters, updateFilter: (key: string, value: unknown) => void) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Company Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          거래처 타입
        </label>
        <select
          value={filters.companyType}
          onChange={(e) => updateFilter('companyType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체</option>
          <option value="CUSTOMER">고객사</option>
          <option value="SUPPLIER">공급사</option>
          <option value="BOTH">고객사/공급사</option>
        </select>
      </div>

      {/* Region */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          지역
        </label>
        <input
          type="text"
          value={filters.region}
          onChange={(e) => updateFilter('region', e.target.value)}
          placeholder="지역 입력"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Contact Person */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          담당자
        </label>
        <input
          type="text"
          value={filters.contactPerson}
          onChange={(e) => updateFilter('contactPerson', e.target.value)}
          placeholder="담당자명 입력"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Payment Terms */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          결제 조건
        </label>
        <input
          type="text"
          value={filters.paymentTerms}
          onChange={(e) => updateFilter('paymentTerms', e.target.value)}
          placeholder="결제 조건 입력"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Date Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          등록일 범위
        </label>
        <DateRangePicker
          value={filters.dateRange || { startDate: null, endDate: null }}
          onChange={(value) => updateFilter('dateRange', value)}
          placeholder="날짜 범위 선택"
        />
      </div>

      {/* Active Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          활성 상태
        </label>
        <select
          value={filters.isActive === null || filters.isActive === undefined ? '' : filters.isActive.toString()}
          onChange={(e) => updateFilter('isActive', e.target.value === '' ? null : e.target.value === 'true')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체</option>
          <option value="true">활성</option>
          <option value="false">비활성</option>
        </select>
      </div>
    </div>
  );
}

function renderBOMFilters(filters: BOMSearchFilters, updateFilter: (key: string, value: unknown) => void) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Parent Item */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          상위 품목
        </label>
        <input
          type="text"
          value={filters.parentItem}
          onChange={(e) => updateFilter('parentItem', e.target.value)}
          placeholder="상위 품목 코드/명"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Child Item */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          하위 품목
        </label>
        <input
          type="text"
          value={filters.childItem}
          onChange={(e) => updateFilter('childItem', e.target.value)}
          placeholder="하위 품목 코드/명"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Hierarchy Level */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          계층 레벨
        </label>
        <input
          type="number"
          value={filters.hierarchyLevel || ''}
          onChange={(e) => updateFilter('hierarchyLevel', e.target.value ? Number(e.target.value) : null)}
          placeholder="계층 레벨"
          min={1}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Quantity Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          수량 범위
        </label>
        <NumberRangeInput
          value={filters.quantityRange || { min: null, max: null }}
          onChange={(value) => updateFilter('quantityRange', value)}
          placeholder={{ min: '최소 수량', max: '최대 수량' }}
          min={0}
          step={0.01}
        />
      </div>

      {/* Date Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          등록일 범위
        </label>
        <DateRangePicker
          value={filters.dateRange || { startDate: null, endDate: null }}
          onChange={(value) => updateFilter('dateRange', value)}
          placeholder="날짜 범위 선택"
        />
      </div>
    </div>
  );
}

function renderTransactionFilters(filters: TransactionSearchFilters, updateFilter: (key: string, value: unknown) => void) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Transaction Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          거래 타입
        </label>
        <select
          value={filters.transactionType}
          onChange={(e) => updateFilter('transactionType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체</option>
          <option value="입고">입고</option>
          <option value="생산">생산</option>
          <option value="출고">출고</option>
        </select>
      </div>

      {/* Item Code */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          품목 코드
        </label>
        <input
          type="text"
          value={filters.itemCode}
          onChange={(e) => updateFilter('itemCode', e.target.value)}
          placeholder="품목 코드 입력"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Company Code */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          거래처 코드
        </label>
        <input
          type="text"
          value={filters.companyCode}
          onChange={(e) => updateFilter('companyCode', e.target.value)}
          placeholder="거래처 코드 입력"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Amount Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          수량 범위
        </label>
        <NumberRangeInput
          value={filters.amountRange || { min: null, max: null }}
          onChange={(value) => updateFilter('amountRange', value)}
          placeholder={{ min: '최소 수량', max: '최대 수량' }}
          min={0}
          step={0.01}
        />
      </div>

      {/* Date Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          거래일 범위
        </label>
        <DateRangePicker
          value={filters.dateRange || { startDate: null, endDate: null }}
          onChange={(value) => updateFilter('dateRange', value)}
          placeholder="날짜 범위 선택"
        />
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          상태
        </label>
        <select
          value={filters.status}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체</option>
          <option value="completed">완료</option>
          <option value="pending">대기</option>
          <option value="cancelled">취소</option>
        </select>
      </div>
    </div>
  );
}