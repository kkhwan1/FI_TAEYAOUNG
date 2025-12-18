'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, X, AlertCircle } from 'lucide-react';
import { ItemForComponent as Item } from '@/types/inventory';

export interface MultiItemSelectProps {
  value?: number[];
  onChange: (items: Item[]) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  className?: string;
  showPrice?: boolean;
  itemType?: 'ALL' | string;
  supplierId?: number | null;
  customerId?: number | null;
  isWeightManaged?: boolean;
  maxSelection?: number;
}

interface ApiSuccessResponse {
  success: true;
  data: {
    items: Item[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  };
}

interface ApiErrorResponse {
  success: false;
  error?: string;
}

type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

export default function MultiItemSelect({
  value = [],
  onChange,
  placeholder = "품번 또는 품명으로 검색...",
  label = "품목",
  required = false,
  error,
  disabled = false,
  className = "",
  showPrice = false,
  itemType = 'ALL',
  supplierId,
  customerId,
  isWeightManaged,
  maxSelection
}: MultiItemSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  // 성능 최적화: 드롭다운 열 때만 로딩 (마운트 시 로딩 제거)
  const [hasFetched, setHasFetched] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  // Fetch items from API - 성능 최적화: 드롭다운 열 때만 실행
  const fetchItems = useCallback(async (force = false) => {
    // 이미 로드했으면 스킵 (강제 새로고침 제외)
    if (hasFetched && !force) return;

    setLoading(true);
    setLoadError('');

    try {
      let url: string;

      if (customerId) {
        // 성능 최적화: limit 축소 (1000 → 200)
        url = `/api/items/by-customer?customer_id=${customerId}&limit=200`;
      } else {
        // 성능 최적화: limit 축소 (1000 → 200)
        url = '/api/items?limit=200';
        if (itemType !== 'ALL') {
          const categoryMap: Record<string, string> = {
            'PRODUCT': '완제품',
            'SEMI_PRODUCT': '반제품',
            'RAW_MATERIAL': '원자재',
            'SUBSIDIARY': '부자재'
          };
          const category = categoryMap[itemType as string] || (itemType as string);
          url += `&category=${encodeURIComponent(category)}`;
        }

        if (supplierId && !isWeightManaged) {
          url += `&company_id=${supplierId}`;
        }
      }

      const response = await fetch(url);
      const data: ApiResponse = await response.json();

      if (data.success && 'data' in data && data.data && 'items' in data.data && Array.isArray(data.data.items)) {
        const successData = data as ApiSuccessResponse;

        const transformedItems: Item[] = successData.data.items
          .map((item: any) => {
            const itemId = item.item_id || item.id || 0;
            const itemCode = (item.item_code || '').trim();
            const itemName = (item.item_name || item.name || '').trim();

            return {
              ...item,
              item_id: itemId,
              item_name: itemName || itemCode || `품목 ${itemId}`,
              item_code: itemCode || `ITEM-${itemId}`,
              unit: item.unit || 'EA',
              unit_price: item.unit_price || item.price || 0
            };
          })
          .filter((item) => {
            const isValid = item.item_id > 0;
            if (!isValid) return false;

            if (isWeightManaged !== undefined) {
              const itemIsWeightManaged = item.is_weight_managed === true;
              if (isWeightManaged && !itemIsWeightManaged) return false;
              if (!isWeightManaged && itemIsWeightManaged) return false;
            }

            return true;
          });

        setItems(transformedItems);
        setHasFetched(true);
      } else {
        const errorMsg = !data.success && 'error' in data ? (data as ApiErrorResponse).error : '품목 목록을 불러오는데 실패했습니다.';
        throw new Error(errorMsg);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '품목 목록을 불러오는데 실패했습니다.';
      setLoadError(`${errorMessage} (새로고침 버튼을 클릭하여 다시 시도하세요)`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [customerId, itemType, supplierId, isWeightManaged, hasFetched]);

  // 성능 최적화: 조건 변경 시 hasFetched 리셋 (다음 열 때 다시 로드)
  useEffect(() => {
    setHasFetched(false);
    setItems([]);
  }, [customerId, itemType, supplierId]);

  // items가 업데이트되면 filteredItems 설정
  useEffect(() => {
    if (items.length > 0) {
      const selectedIds = selectedItems.map(i => i.item_id);
      const availableItems = items.filter(item => !selectedIds.includes(item.item_id));

      if (search.trim()) {
        const searchLower = search.toLowerCase().trim();
        const filtered = availableItems.filter(item => {
          const codeMatch = item.item_code?.toLowerCase().includes(searchLower) || false;
          const nameMatch = item.item_name?.toLowerCase().includes(searchLower) || false;
          return codeMatch || nameMatch;
        });
        setFilteredItems(filtered.slice(0, 10));
      } else {
        setFilteredItems(availableItems.slice(0, 10));
      }
    } else {
      setFilteredItems([]);
    }
  }, [items, search, selectedItems]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // value 변경 시 selectedItems 동기화
  useEffect(() => {
    if (value.length > 0 && items.length > 0) {
      const newSelected = value
        .map(id => items.find(item => item.item_id === id))
        .filter((item): item is Item => item !== undefined);

      if (JSON.stringify(newSelected.map(i => i.item_id)) !== JSON.stringify(selectedItems.map(i => i.item_id))) {
        setSelectedItems(newSelected);
      }
    } else if (value.length === 0 && selectedItems.length > 0) {
      setSelectedItems([]);
    }
  }, [value, items]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleItemSelect = (item: Item) => {
    if (maxSelection && selectedItems.length >= maxSelection) return;

    const newSelected = [...selectedItems, item];
    setSelectedItems(newSelected);
    onChange(newSelected);
    setSearch('');
    inputRef.current?.focus();
  };

  const handleItemRemove = (itemId: number) => {
    const newSelected = selectedItems.filter(item => item.item_id !== itemId);
    setSelectedItems(newSelected);
    onChange(newSelected);
  };

  const handleInputFocus = () => {
    updateDropdownPosition();
    // 성능 최적화: 드롭다운 열 때 데이터 로드 (마운트 시 로딩 제거)
    if (!hasFetched) {
      fetchItems();
    }
    setIsOpen(true);
    requestAnimationFrame(() => {
      updateDropdownPosition();
    });
  };

  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      const handleScroll = () => updateDropdownPosition();
      const handleResize = () => updateDropdownPosition();

      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Backspace' && !search && selectedItems.length > 0) {
      handleItemRemove(selectedItems[selectedItems.length - 1].item_id);
    } else if (e.key === 'ArrowDown' && filteredItems.length > 0) {
      e.preventDefault();
      setIsOpen(true);
    } else if (e.key === 'Enter' && isOpen && filteredItems.length === 1) {
      e.preventDefault();
      handleItemSelect(filteredItems[0]);
    }
  };

  const handleRefresh = () => {
    // 강제 새로고침
    fetchItems(true);
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative" ref={dropdownRef}>
        {/* Selected Tags + Input Container */}
        <div
          className={`flex flex-wrap items-center gap-1 min-h-[38px] px-2 py-1 border rounded-lg bg-white dark:bg-gray-800 ${
            error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
          } focus-within:ring-2 focus-within:ring-blue-500 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => !disabled && inputRef.current?.focus()}
        >
          {/* Selected Tags */}
          {selectedItems.map(item => (
            <span
              key={item.item_id}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
            >
              <span className="max-w-[100px] truncate">{item.item_code}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleItemRemove(item.item_id);
                  }}
                  className="hover:text-blue-600 dark:hover:text-blue-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}

          {/* Search Input */}
          <div className="flex-1 min-w-[80px] flex items-center">
            <Search className="w-3 h-3 text-gray-400 mr-1 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={handleSearchChange}
              onFocus={handleInputFocus}
              onKeyDown={handleKeyDown}
              placeholder={selectedItems.length === 0 ? placeholder : "추가 검색..."}
              disabled={disabled || loading || (maxSelection !== undefined && selectedItems.length >= maxSelection)}
              className="flex-1 min-w-0 py-1 text-sm bg-transparent text-gray-900 dark:text-white focus:outline-none disabled:cursor-not-allowed"
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed flex-shrink-0"
            title="품목 목록 새로고침"
          >
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {(error || loadError) && (
        <div className="mt-1 flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="w-3 h-3" />
          <span>{error || loadError}</span>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && !disabled && (loading || filteredItems.length > 0) && (
        <div
          className="fixed z-[99999] mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto min-w-[300px]"
          style={{
            top: dropdownPosition ? `${dropdownPosition.top}px` : '0px',
            left: dropdownPosition ? `${dropdownPosition.left}px` : '0px',
            width: dropdownPosition ? `${Math.max(dropdownPosition.width, 300)}px` : '300px',
            maxWidth: '90vw',
            zIndex: 99999
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 로딩 상태 */}
          {loading && (
            <div className="px-3 py-4 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-500" />
              <span className="text-xs text-gray-500 mt-1 block">품목 로딩 중...</span>
            </div>
          )}
          {!loading && filteredItems.map(item => (
            <button
              key={item.item_id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleItemSelect(item);
              }}
              className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 last:border-b-0 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.item_code}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {item.item_name}
                    </span>
                    {item.spec && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({item.spec})
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {/* 재고 정보 표시 */}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    (item.current_stock || 0) > 0
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    재고: {(item.current_stock || 0).toLocaleString()} {item.unit}
                  </span>
                  {showPrice && (
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      ₩{item.unit_price?.toLocaleString() || 0}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
          {/* 로드 완료 후 결과 없음 */}
          {!loading && filteredItems.length === 0 && hasFetched && !search && (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
              품목이 없습니다.
            </div>
          )}
        </div>
      )}

      {/* No Results */}
      {isOpen && search && filteredItems.length === 0 && !loading && (
        <div
          className="fixed z-[99999] mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm"
          style={{
            top: dropdownPosition ? `${dropdownPosition.top}px` : '0px',
            left: dropdownPosition ? `${dropdownPosition.left}px` : '0px',
            width: dropdownPosition ? `${dropdownPosition.width}px` : '300px',
            zIndex: 99999
          }}
        >
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
            검색 결과가 없습니다.
          </div>
        </div>
      )}

      {/* Selection Count */}
      {selectedItems.length > 0 && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {selectedItems.length}개 선택됨
          {maxSelection && ` (최대 ${maxSelection}개)`}
        </div>
      )}
    </div>
  );
}
