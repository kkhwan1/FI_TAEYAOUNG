'use client';

import { useState, useCallback, useMemo } from 'react';
import { ItemForComponent as Item } from '@/types/inventory';

/**
 * 재고 관리 폼에서 공통으로 사용하는 품목 관리 Hook
 * - 품목 추가/제거
 * - 품목 검색 및 필터링
 * - 대량 선택 및 추가
 */

interface UseInventoryItemsOptions<T> {
  /** 현재 폼에 추가된 품목 목록 */
  formItems: T[];
  /** 폼 품목 목록 업데이트 함수 */
  setFormItems: (items: T[] | ((prev: T[]) => T[])) => void;
  /** 품목에서 ID 추출 함수 */
  getItemId: (item: T) => number;
  /** 거래일자 (월별 단가 조회용) */
  transactionDate?: string;
  /** 에러 표시 함수 */
  showError?: (message: string) => void;
  /** 경고 표시 함수 */
  showWarning?: (title: string, message: string) => void;
}

interface UseInventoryItemsReturn<T> {
  /** 공급업체/고객사 관련 품목 목록 */
  relatedItems: Item[];
  /** 관련 품목 로딩 중 여부 */
  loadingRelatedItems: boolean;
  /** 선택된 품목 ID Set */
  selectedItemIds: Set<number>;
  /** 검색어 */
  searchQuery: string;
  /** 검색어 설정 함수 */
  setSearchQuery: (query: string) => void;
  /** 필터링된 관련 품목 목록 */
  filteredRelatedItems: Item[];
  /** 품목 선택 토글 */
  toggleItemSelection: (itemId: number) => void;
  /** 전체 선택/해제 */
  toggleSelectAll: () => void;
  /** 관련 품목 조회 함수 */
  fetchRelatedItems: (companyId: number, type: 'customer' | 'supplier') => Promise<void>;
  /** 선택된 품목 일괄 추가 */
  addSelectedItems: (createItem: (item: Item, unitPrice: number, isMonthly: boolean) => T) => Promise<void>;
  /** 단일 품목 추가 */
  addItem: (item: Item, createItem: (item: Item, unitPrice: number, isMonthly: boolean) => T) => Promise<void>;
  /** 품목 제거 */
  removeItem: (itemId: number) => void;
  /** 선택 초기화 */
  clearSelection: () => void;
  /** 관련 품목 목록 초기화 */
  clearRelatedItems: () => void;
}

/**
 * 월별 단가 조회 함수
 */
async function fetchMonthlyPrice(itemId: number, dateString: string): Promise<number> {
  try {
    const month = dateString ? dateString.substring(0, 7) : new Date().toISOString().substring(0, 7);
    const { safeFetchJson } = await import('@/lib/fetch-utils');
    const result = await safeFetchJson(`/api/price-history?month=${month}`, {}, {
      timeout: 10000,
      maxRetries: 2,
      retryDelay: 1000
    });

    if (result.success && result.data) {
      const priceItem = result.data.find((p: any) => p.item_id === itemId);
      if (priceItem && priceItem.unit_price) {
        return priceItem.unit_price;
      }
    }
  } catch (error) {
    console.warn('월별 단가 조회 실패:', error);
  }
  return 0;
}

export function useInventoryItems<T>({
  formItems,
  setFormItems,
  getItemId,
  transactionDate = '',
  showError,
  showWarning
}: UseInventoryItemsOptions<T>): UseInventoryItemsReturn<T> {
  const [relatedItems, setRelatedItems] = useState<Item[]>([]);
  const [loadingRelatedItems, setLoadingRelatedItems] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // 이미 추가된 품목 ID Set
  const existingItemIds = useMemo(() => {
    return new Set(formItems.map(item => getItemId(item)));
  }, [formItems, getItemId]);

  // 필터링된 관련 품목 목록
  const filteredRelatedItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return relatedItems;
    }
    const searchLower = searchQuery.toLowerCase().trim();
    return relatedItems.filter(item => {
      const codeMatch = item.item_code?.toLowerCase().includes(searchLower) || false;
      const nameMatch = item.item_name?.toLowerCase().includes(searchLower) || false;
      return codeMatch || nameMatch;
    });
  }, [relatedItems, searchQuery]);

  // 관련 품목 조회
  const fetchRelatedItems = useCallback(async (companyId: number, type: 'customer' | 'supplier') => {
    setLoadingRelatedItems(true);
    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const endpoint = type === 'customer'
        ? `/api/items/by-customer?customer_id=${companyId}&limit=1000`
        : `/api/items/by-supplier?supplier_id=${companyId}&limit=1000`;

      const result = await safeFetchJson(endpoint, {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success && result.data && result.data.items) {
        // 이미 추가된 품목은 제외
        const filteredItems = result.data.items.filter((item: Item) =>
          !existingItemIds.has(item.item_id || item.id)
        );
        setRelatedItems(filteredItems);
      } else {
        setRelatedItems([]);
      }
    } catch (error) {
      console.error('Failed to fetch related items:', error);
      setRelatedItems([]);
    } finally {
      setLoadingRelatedItems(false);
    }
  }, [existingItemIds]);

  // 품목 선택 토글
  const toggleItemSelection = useCallback((itemId: number) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  // 전체 선택/해제
  const toggleSelectAll = useCallback(() => {
    if (selectedItemIds.size === filteredRelatedItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredRelatedItems.map(item => item.item_id || item.id)));
    }
  }, [selectedItemIds.size, filteredRelatedItems]);

  // 단일 품목 추가
  const addItem = useCallback(async (
    item: Item,
    createItem: (item: Item, unitPrice: number, isMonthly: boolean) => T
  ) => {
    const itemId = item.item_id || item.id;

    if (existingItemIds.has(itemId)) {
      showWarning?.('품목 중복', '이미 추가된 품목입니다.');
      return;
    }

    let unitPrice = item.unit_price || item.price || 0;
    let isMonthly = false;

    if (transactionDate && itemId) {
      const monthlyPrice = await fetchMonthlyPrice(itemId, transactionDate);
      if (monthlyPrice > 0) {
        unitPrice = monthlyPrice;
        isMonthly = true;
      }
    }

    const newItem = createItem(item, unitPrice, isMonthly);
    setFormItems(prev => [...prev, newItem]);

    // 관련 품목 목록에서 제거
    setRelatedItems(prev => prev.filter(i => (i.item_id || i.id) !== itemId));
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(itemId);
      return newSet;
    });
  }, [existingItemIds, transactionDate, setFormItems, showWarning]);

  // 선택된 품목 일괄 추가
  const addSelectedItems = useCallback(async (
    createItem: (item: Item, unitPrice: number, isMonthly: boolean) => T
  ) => {
    if (selectedItemIds.size === 0) {
      showWarning?.('품목 선택 필요', '추가할 품목을 선택해주세요.');
      return;
    }

    const itemsToAdd = filteredRelatedItems.filter(item =>
      selectedItemIds.has(item.item_id || item.id)
    );

    const newItems = itemsToAdd.filter(item => !existingItemIds.has(item.item_id || item.id));

    if (newItems.length === 0) {
      showWarning?.('품목 중복', '이미 추가된 품목들입니다.');
      setSelectedItemIds(new Set());
      return;
    }

    for (const item of newItems) {
      await addItem(item, createItem);
    }

    setSelectedItemIds(new Set());
  }, [selectedItemIds, filteredRelatedItems, existingItemIds, addItem, showWarning]);

  // 품목 제거
  const removeItem = useCallback((itemId: number) => {
    setFormItems(prev => prev.filter(item => getItemId(item) !== itemId));
  }, [setFormItems, getItemId]);

  // 선택 초기화
  const clearSelection = useCallback(() => {
    setSelectedItemIds(new Set());
  }, []);

  // 관련 품목 목록 초기화
  const clearRelatedItems = useCallback(() => {
    setRelatedItems([]);
    setSelectedItemIds(new Set());
    setSearchQuery('');
  }, []);

  return {
    relatedItems,
    loadingRelatedItems,
    selectedItemIds,
    searchQuery,
    setSearchQuery,
    filteredRelatedItems,
    toggleItemSelection,
    toggleSelectAll,
    fetchRelatedItems,
    addSelectedItems,
    addItem,
    removeItem,
    clearSelection,
    clearRelatedItems
  };
}
