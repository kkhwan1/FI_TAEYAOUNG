'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { ItemForComponent as Item } from '@/types/inventory';
import type { ItemTypeCode } from '@/types/supabase';

export interface ItemSelectProps {
  value?: number;
  onChange: (item: Item | null) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  className?: string;
  showPrice?: boolean;
  itemType?: 'ALL' | ItemTypeCode;
  supplierId?: number | null;
  customerId?: number | null;
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

export default function ItemSelect({
  value,
  onChange,
  placeholder = "품번 또는 품명으로 검색...",
  label = "품목",
  required = false,
  error,
  disabled = false,
  className = "",
  showPrice = true,
  itemType = 'ALL',
  supplierId,
  customerId
}: ItemSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  // Fetch items from API
  const fetchItems = useCallback(async () => {
    console.log(`[ItemSelect] fetchItems 시작: customerId=${customerId}, itemType=${itemType}, supplierId=${supplierId}`);
    setLoading(true);
    setLoadError('');

    try {
      let url: string;
      
      // 고객사가 선택되어 있으면 모 품목만 조회
      if (customerId) {
        console.log(`[ItemSelect] fetchItems 호출: customerId=${customerId}`);
        url = `/api/items/by-customer?customer_id=${customerId}&limit=1000`;
      } else {
        console.log(`[ItemSelect] fetchItems 호출: customerId가 없음, 전체 품목 조회`);
        url = '/api/items?limit=1000'; // Get all items (no pagination for select dropdown)
      if (itemType !== 'ALL') {
        // Map itemType to category parameter
        const categoryMap: Record<string, string> = {
          'PRODUCT': '제품',
          'SEMI_PRODUCT': '반제품',
          'RAW_MATERIAL': '원자재',
          'SUBSIDIARY': '부자재'
        };
        const category = categoryMap[itemType as string] || (itemType as string);
        url += `&category=${encodeURIComponent(category)}`;
      }

      // Filter by supplier if provided
      if (supplierId) {
        url += `&company_id=${supplierId}`;
        }
      }

      console.log(`[ItemSelect] API 호출 URL: ${url}`);
      const response = await fetch(url);
      const data: ApiResponse = await response.json();

      // 전체 API 응답 구조 확인
      console.log(`[ItemSelect] 전체 API 응답:`, JSON.stringify(data, null, 2));

      // Type guard for ApiSuccessResponse
      if (data.success && 'data' in data && data.data && 'items' in data.data && Array.isArray(data.data.items)) {
        const successData = data as ApiSuccessResponse;
        console.log(`[ItemSelect] API 응답 받음: success=${successData.success}, hasData=${!!successData.data}, hasItems=${!!(successData.data && 'items' in successData.data && successData.data.items)}`);
        console.log(`[ItemSelect] 원본 items 배열 길이: ${successData.data.items.length}`);
        console.log(`[ItemSelect] data.data 구조:`, Object.keys(successData.data || {}));
        
        // 원본 데이터 구조 확인
        if (successData.data.items.length > 0) {
          console.log(`[ItemSelect] 첫 번째 원본 항목:`, JSON.stringify(successData.data.items[0], null, 2));
          console.log(`[ItemSelect] 첫 번째 원본 항목의 필드명:`, Object.keys(successData.data.items[0]));
        }

        // Transform data to match ItemForComponent interface
        const transformedItems: Item[] = successData.data.items
          .map((item: any, index: number) => {
            // 원본 데이터의 모든 필드 확인
            const itemId = item.item_id || item.id || 0;
            const itemCode = (item.item_code || '').trim();
            const itemName = (item.item_name || item.name || '').trim();
            
            const transformed = {
              ...item,
              item_id: itemId,
              item_name: itemName || itemCode || `품목 ${itemId}`, // 둘 다 없으면 기본값 사용
              item_code: itemCode || `ITEM-${itemId}`, // 없으면 기본값 사용
              unit: item.unit || 'EA',
              unit_price: item.unit_price || item.price || 0
            };
            
            // 필터링 전에 로그 출력 (문제 있는 항목 확인)
            if (!transformed.item_id) {
              console.warn(`[ItemSelect] [${index}] item_id가 없음 - 원본:`, JSON.stringify(item, null, 2));
              console.warn(`[ItemSelect] [${index}] item_id가 없음 - 변환 후:`, JSON.stringify(transformed, null, 2));
            }
            
            return transformed;
          })
          .filter((item, index) => {
            // item_id만 있으면 유효한 품목으로 간주 (item_code와 item_name은 기본값으로 채워짐)
            const isValid = item.item_id > 0;
            if (!isValid) {
              console.warn(`[ItemSelect] [${index}] 필터링된 품목 (item_id 없음):`, JSON.stringify(item, null, 2));
            }
            return isValid;
          }); // 유효한 품목만 필터링

        console.log(`[ItemSelect] API 응답: customerId=${customerId}, items=${successData.data.items?.length || 0}, transformed=${transformedItems.length}`);
        console.log(`[ItemSelect] transformedItems 샘플:`, transformedItems.slice(0, 3));
        
        if (transformedItems.length === 0) {
          if (successData.data.items && successData.data.items.length > 0) {
            console.warn('[ItemSelect] 품목 변환 후 0개입니다. 원본 데이터:', successData.data.items.slice(0, 3));
            console.warn('[ItemSelect] 원본 데이터 전체:', JSON.stringify(successData.data.items, null, 2));
          } else {
            console.warn(`[ItemSelect] 품목이 없습니다. API 응답:`, {
              success: successData.success,
              items_count: successData.data?.items?.length || 0,
              full_response: successData
            });
          }
        } else {
          console.log(`[ItemSelect] 성공적으로 ${transformedItems.length}개 품목 로드됨`);
          console.log(`[ItemSelect] items state 업데이트됨, filteredItems는 useEffect에서 설정됨`);
        }
        
        setItems(transformedItems);
      } else {
        const errorMsg = !data.success && 'error' in data ? (data as ApiErrorResponse).error : '품목 목록을 불러오는데 실패했습니다.';
        console.error('[ItemSelect] API 응답 오류:', data);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
      const errorMessage = error instanceof Error ? error.message : '품목 목록을 불러오는데 실패했습니다.';
      setLoadError(`${errorMessage} (새로고침 버튼을 클릭하여 다시 시도하세요)`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [customerId, itemType, supplierId]);

  useEffect(() => {
    console.log(`[ItemSelect] useEffect triggered: customerId=${customerId}, itemType=${itemType}, supplierId=${supplierId}`);
    fetchItems();
  }, [fetchItems, customerId, itemType, supplierId]);

  // items가 업데이트되면 자동으로 filteredItems 설정 및 드롭다운 열기
  useEffect(() => {
    if (items.length > 0) {
      console.log(`[ItemSelect] items 업데이트됨: ${items.length}개, customerId=${customerId}, search="${search}"`);
      
      if (search.trim()) {
        // 검색어가 있으면 필터링
        const searchLower = search.toLowerCase().trim();
        let filtered = items.filter(item => {
          const codeMatch = item.item_code?.toLowerCase().includes(searchLower) || false;
          const nameMatch = item.item_name?.toLowerCase().includes(searchLower) || false;
          const codeOriginalMatch = item.item_code?.includes(search) || false;
          const nameOriginalMatch = item.item_name?.includes(search) || false;
          return codeMatch || nameMatch || codeOriginalMatch || nameOriginalMatch;
        });
        
        if (selectedItem && !filtered.find(i => i.item_id === selectedItem.item_id)) {
          filtered = [selectedItem, ...filtered];
        }
        setFilteredItems(filtered.slice(0, 10));
        if (filtered.length > 0) {
          setIsOpen(true);
        }
      } else {
        // 검색어가 없으면 최대 10개 품목 표시
        const limitedItems = items.slice(0, 10);
        if (selectedItem && !limitedItems.find(i => i.item_id === selectedItem.item_id)) {
          setFilteredItems([selectedItem, ...limitedItems]);
        } else {
          setFilteredItems(limitedItems);
        }
        
        // customerId가 있고 items가 있으면 자동으로 드롭다운 열기
        if (customerId && items.length > 0) {
          console.log(`[ItemSelect] customerId=${customerId}, items=${items.length}개, 드롭다운 자동 열기`);
          // 입력 필드에 포커스 주기
          if (inputRef.current) {
            inputRef.current.focus();
          }
          // 위치 계산 및 드롭다운 열기
          updateDropdownPosition();
          setIsOpen(true);
          requestAnimationFrame(() => {
            updateDropdownPosition();
          });
        }
      }
    } else {
      setFilteredItems([]);
      if (!search.trim()) {
        setIsOpen(false);
      }
    }
  }, [items, customerId, search, selectedItem]);

  // Handle search filtering (검색어 변경 시에만)
  useEffect(() => {
    if (search.trim() && items.length > 0) {
      const searchLower = search.toLowerCase().trim();
      let filtered = items.filter(item => {
        const codeMatch = item.item_code?.toLowerCase().includes(searchLower) || false;
        const nameMatch = item.item_name?.toLowerCase().includes(searchLower) || false;
        const codeOriginalMatch = item.item_code?.includes(search) || false;
        const nameOriginalMatch = item.item_name?.includes(search) || false;
        return codeMatch || nameMatch || codeOriginalMatch || nameOriginalMatch;
      });
      
      if (selectedItem && !filtered.find(i => i.item_id === selectedItem.item_id)) {
        filtered = [selectedItem, ...filtered];
      }
      setFilteredItems(filtered.slice(0, 10));
      if (filtered.length > 0) {
        setIsOpen(true);
      }
    }
  }, [search]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update search when value changes externally
  useEffect(() => {
    if (value && value > 0) {
      // 먼저 items 배열에서 찾기
      const item = items.find(item => item.item_id === value);
      if (item) {
        // 이미 선택된 항목이면 업데이트하지 않음 (사용자 입력 중일 수 있음)
        if (selectedItem?.item_id !== item.item_id) {
          setSelectedItem(item);
          setSearch(`${item.item_code} - ${item.item_name}`);
        }
      } else if (items.length > 0) {
        // items 배열에 없으면 개별 조회
        fetch(`/api/items/${value}`)
          .then(res => res.json())
          .then(result => {
            if (result.success && result.data) {
              const itemData = {
                ...result.data,
                item_id: result.data.item_id || result.data.id,
                item_name: result.data.item_name || result.data.name,
                unit_price: result.data.unit_price || result.data.price || 0
              };
              // 이미 선택된 항목이면 업데이트하지 않음
              if (selectedItem?.item_id !== itemData.item_id) {
                setSelectedItem(itemData);
                setSearch(`${itemData.item_code} - ${itemData.item_name}`);
              }
            }
          })
          .catch(err => console.error('Failed to fetch item:', err));
      }
    } else if (!value || value === 0) {
      // value가 없거나 0이면 초기화 (사용자가 직접 입력 중이 아닐 때만)
      if (!search || search.trim() === '') {
        setSelectedItem(null);
        setSearch('');
      }
    }
  }, [value, items]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearch = e.target.value;
    setSearch(newSearch);
    
    // 검색어가 변경되면 선택된 항목 초기화 (새로운 검색을 위해)
    if (newSearch !== `${selectedItem?.item_code} - ${selectedItem?.item_name}`) {
      setSelectedItem(null);
    }
  };

  const handleItemSelect = (item: Item) => {
    setSelectedItem(item);
    setSearch(`${item.item_code} - ${item.item_name}`);
    setIsOpen(false);
    onChange(item);
  };

  const handleInputFocus = () => {
    // 먼저 위치 계산 (동기적으로)
    updateDropdownPosition();
    
    // 포커스 시 품목이 있으면 드롭다운 표시 (검색어 없어도)
    if (filteredItems.length > 0) {
      setIsOpen(true);
      // 위치 재계산 (DOM 업데이트 후)
      requestAnimationFrame(() => {
        updateDropdownPosition();
      });
    } else if (items.length > 0) {
      // items가 있지만 filteredItems가 없으면 다시 계산
      const limitedItems = items.slice(0, 10);
      setFilteredItems(limitedItems);
      setIsOpen(true);
      // 위치 재계산 (DOM 업데이트 후)
      requestAnimationFrame(() => {
        updateDropdownPosition();
      });
    }
  };

  // 드롭다운 위치 계산 (모달 내부에서도 정확히 표시되도록)
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

  // filteredItems가 설정되고 입력 필드가 포커스되어 있으면 드롭다운 자동 열기
  useEffect(() => {
    if (filteredItems.length > 0 && inputRef.current && document.activeElement === inputRef.current && !isOpen) {
      updateDropdownPosition();
      setIsOpen(true);
    }
  }, [filteredItems, isOpen]);

  // 드롭다운이 열릴 때마다 위치 업데이트
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
    } else if (e.key === 'ArrowDown' && filteredItems.length > 0) {
      e.preventDefault();
      setIsOpen(true);
    } else if (e.key === 'Enter' && isOpen && filteredItems.length === 1) {
      e.preventDefault();
      handleItemSelect(filteredItems[0]);
    }
  };

  const handleRefresh = () => {
    fetchItems();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          
          {label} {required && <span className="text-gray-500">*</span>}
        </label>
      )}

      {/* Search Input */}
      <div className="relative" ref={dropdownRef}>
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={handleSearchChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || loading}
          className={`w-full px-4 py-2 pl-10 pr-10 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
            error ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
          }`}
        />

        {/* Search Icon */}
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />

        {/* Loading/Refresh Button */}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
          title="품목 목록 새로고침"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        </button>
      </div>

      {/* Error Message */}
      {(error || loadError) && (
        <div className="mt-1 flex items-center gap-1 text-sm text-gray-500">
          <AlertCircle className="w-3 h-3" />
          <span>{error || loadError}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && !items.length && (
        <div className="mt-2 text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          품목 목록을 불러오는 중...
        </div>
      )}

      {/* Dropdown - fixed positioning to escape modal overflow */}
      {isOpen && filteredItems.length > 0 && !disabled && (
        <div 
          className="fixed z-[99999] mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto min-w-[400px]" 
          style={{ 
            top: dropdownPosition ? `${dropdownPosition.top}px` : inputRef.current ? `${inputRef.current.getBoundingClientRect().bottom + window.scrollY}px` : '0px',
            left: dropdownPosition ? `${dropdownPosition.left}px` : inputRef.current ? `${inputRef.current.getBoundingClientRect().left + window.scrollX}px` : '0px',
            width: dropdownPosition ? `${Math.max(dropdownPosition.width, 400)}px` : inputRef.current ? `${Math.max(inputRef.current.getBoundingClientRect().width, 400)}px` : '400px',
            maxWidth: '90vw',
            zIndex: 99999
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {filteredItems.map(item => (
            <button
              key={item.item_id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleItemSelect(item);
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 last:border-b-0 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {item.item_code}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {item.item_name}
                  </div>
                </div>
                <div className="text-right ml-2 flex-shrink-0">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {item.unit}
                  </div>
                  {showPrice && (
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      ₩{item.unit_price?.toLocaleString() || 0}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}


      {/* No Results */}
      {isOpen && search && filteredItems.length === 0 && !loading && (
        <div className="absolute z-[9999] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm">
          <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
            <div className="mb-1">검색 결과가 없습니다.</div>
            {items.length === 0 ? (
              <div className="text-xs text-gray-400 mt-1">
                {supplierId
                  ? '선택한 공급업체의 품목 목록을 불러오지 못했습니다. 새로고침 버튼을 클릭하세요.'
                  : '품목 목록을 불러오지 못했습니다. 새로고침 버튼을 클릭하세요.'
                }
              </div>
            ) : (
              <div className="text-xs text-gray-400 mt-1">
                품목코드 또는 품목명의 일부를 입력하세요.
                {supplierId
                  ? ` (선택한 공급업체 품목 ${items.length}개 로드됨)`
                  : ` (현재 ${items.length}개 품목 로드됨)`
                }
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Item Info */}
      {selectedItem && !isOpen && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          선택된 품목: {selectedItem.item_code} - {selectedItem.item_name}
          {showPrice && ` (₩${selectedItem.unit_price?.toLocaleString() || 0})`}
        </div>
      )}
    </div>
  );
}