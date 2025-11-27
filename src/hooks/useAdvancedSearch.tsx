'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DateRange } from '@/components/DateRangePicker';

// Search filter types for different entities
export interface BaseSearchFilters {
  search?: string;
  dateRange?: DateRange;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ItemSearchFilters extends BaseSearchFilters {
  itemType?: string;
  carModel?: string;
  stockLevel?: {
    min: number | null;
    max: number | null;
  };
  priceRange?: {
    min: number | null;
    max: number | null;
  };
  location?: string;
  hasMinStock?: boolean | null;
  isLowStock?: boolean | null;
}

export interface CompanySearchFilters extends BaseSearchFilters {
  companyType?: string;
  region?: string;
  paymentTerms?: string;
  contactPerson?: string;
  isActive?: boolean | null;
}

export interface BOMSearchFilters extends BaseSearchFilters {
  parentItem?: string;
  childItem?: string;
  hierarchyLevel?: number | null;
  quantityRange?: {
    min: number | null;
    max: number | null;
  };
}

export interface TransactionSearchFilters extends BaseSearchFilters {
  transactionType?: string;
  itemCode?: string;
  companyCode?: string;
  amountRange?: {
    min: number | null;
    max: number | null;
  };
  status?: string;
}

// Search preset interface
export interface SearchPreset {
  id: string;
  name: string;
  description?: string;
  filters: ItemSearchFilters | CompanySearchFilters | BOMSearchFilters | TransactionSearchFilters;
  entityType: 'items' | 'companies' | 'bom' | 'transactions';
  isDefault?: boolean;
  createdAt: Date;
}

// Default presets for each entity type
export const DEFAULT_PRESETS: Record<string, SearchPreset[]> = {
  items: [
    {
      id: 'low-stock-items',
      name: '재고부족품목',
      description: '현재고가 최소재고 이하인 품목',
      filters: { isLowStock: true },
      entityType: 'items',
      isDefault: true,
      createdAt: new Date()
    },
    {
      id: 'high-value-items',
      name: '고가품목',
      description: '단가 100만원 이상 품목',
      filters: { priceRange: { min: 1000000, max: null } },
      entityType: 'items',
      isDefault: true,
      createdAt: new Date()
    },
    {
      id: 'material-items',
      name: '자재품목',
      description: '자재 타입 품목만',
      filters: { itemType: 'MATERIAL' },
      entityType: 'items',
      isDefault: true,
      createdAt: new Date()
    },
    {
      id: 'product-items',
      name: '제품품목',
      description: '제품 타입 품목만',
      filters: { itemType: 'PRODUCT' },
      entityType: 'items',
      isDefault: true,
      createdAt: new Date()
    }
  ],
  companies: [
    {
      id: 'customer-companies',
      name: '고객사',
      description: '고객사만 표시',
      filters: { companyType: 'CUSTOMER' },
      entityType: 'companies',
      isDefault: true,
      createdAt: new Date()
    },
    {
      id: 'supplier-companies',
      name: '공급사',
      description: '공급사만 표시',
      filters: { companyType: 'SUPPLIER' },
      entityType: 'companies',
      isDefault: true,
      createdAt: new Date()
    },
    {
      id: 'recent-companies',
      name: '최근거래처',
      description: '최근 1개월 거래한 거래처',
      filters: {
        dateRange: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date()
        }
      },
      entityType: 'companies',
      isDefault: true,
      createdAt: new Date()
    }
  ],
  transactions: [
    {
      id: 'recent-receiving',
      name: '최근입고',
      description: '최근 1주일 입고 내역',
      filters: {
        transactionType: '입고',
        dateRange: {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          endDate: new Date()
        }
      },
      entityType: 'transactions',
      isDefault: true,
      createdAt: new Date()
    },
    {
      id: 'large-transactions',
      name: '대량거래',
      description: '수량 1000개 이상 거래',
      filters: { amountRange: { min: 1000, max: null } },
      entityType: 'transactions',
      isDefault: true,
      createdAt: new Date()
    }
  ]
};

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Local storage utilities
const STORAGE_KEYS = {
  SEARCH_PRESETS: 'erp_search_presets',
  SEARCH_HISTORY: 'erp_search_history'
};

function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;

  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
}

// Main hook
export function useAdvancedSearch<T extends BaseSearchFilters>(
  entityType: 'items' | 'companies' | 'bom' | 'transactions',
  initialFilters: T,
  searchFn?: (filters: T) => Promise<any[]>,
  debounceMs: number = 300
) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [filters, setFilters] = useState<T>(initialFilters);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedPresets, setSavedPresets] = useState<SearchPreset[]>([]);

  // Debounced filters
  const debouncedFilters = useDebounce(filters, debounceMs);

  // Load initial data from localStorage
  useEffect(() => {
    const history = loadFromStorage(STORAGE_KEYS.SEARCH_HISTORY, []);
    const presets = loadFromStorage(STORAGE_KEYS.SEARCH_PRESETS, {}) as Record<string, SearchPreset[]>;

    setSearchHistory(history);
    setSavedPresets(presets[entityType] || DEFAULT_PRESETS[entityType] || []);
  }, [entityType]);

  // URL synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Read filters from URL on mount
    const urlFilters = { ...initialFilters };
    let hasUrlParams = false;

    searchParams?.forEach((value, key) => {
      if (key in urlFilters) {
        hasUrlParams = true;
        try {
          // Handle different filter types
          if (key === 'dateRange') {
            const range = JSON.parse(value);
            urlFilters[key as keyof T] = {
              startDate: range.startDate ? new Date(range.startDate) : null,
              endDate: range.endDate ? new Date(range.endDate) : null
            } as any;
          } else if (key.includes('Range') || key === 'stockLevel') {
            urlFilters[key as keyof T] = JSON.parse(value) as T[keyof T];
          } else if (typeof urlFilters[key as keyof T] === 'boolean') {
            urlFilters[key as keyof T] = (value === 'true') as T[keyof T];
          } else if (typeof urlFilters[key as keyof T] === 'number') {
            urlFilters[key as keyof T] = Number(value) as T[keyof T];
          } else {
            urlFilters[key as keyof T] = value as T[keyof T];
          }
        } catch {
          // Skip invalid JSON values
        }
      }
    });

    if (hasUrlParams) {
      setFilters(urlFilters);
    }
  }, [searchParams, initialFilters]);

  // Update URL when filters change
  const updateURL = useCallback((newFilters: T) => {
    const params = new URLSearchParams();

    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '' &&
          !(Array.isArray(value) && value.length === 0) &&
          !(typeof value === 'object' && Object.values(value).every(v => v === null || v === undefined || v === ''))) {

        if (typeof value === 'object') {
          params.set(key, JSON.stringify(value));
        } else {
          params.set(key, String(value));
        }
      }
    });

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newUrl, { scroll: false });
  }, [router]);

  // Execute search
  const executeSearch = useCallback(async (searchFilters: T) => {
    if (!searchFn) return;

    setLoading(true);
    setError(null);

    try {
      const searchResults = await searchFn(searchFilters);
      setResults(searchResults);

      // Add to search history if there's a search term
      if (searchFilters.search?.trim()) {
        const newHistory = [
          searchFilters.search.trim(),
          ...searchHistory.filter(term => term !== searchFilters.search?.trim())
        ].slice(0, 10); // Keep only 10 recent searches

        setSearchHistory(newHistory);
        saveToStorage(STORAGE_KEYS.SEARCH_HISTORY, newHistory);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '검색 중 오류가 발생했습니다.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchFn, searchHistory]);

  // Auto-search when debounced filters change
  useEffect(() => {
    executeSearch(debouncedFilters);
    updateURL(debouncedFilters);
  }, [debouncedFilters, executeSearch, updateURL]);

  // Filter manipulation functions
  const updateFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateFilters = useCallback((newFilters: Partial<T>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const clearFilter = useCallback(<K extends keyof T>(key: K) => {
    const clearedValue = (() => {
      const initialValue = initialFilters[key];
      if (typeof initialValue === 'string') return '' as T[K];
      if (typeof initialValue === 'boolean') return null as T[K];
      if (typeof initialValue === 'number') return null as T[K];
      if (Array.isArray(initialValue)) return [] as T[K];
      if (typeof initialValue === 'object' && initialValue !== null) {
        return Object.keys(initialValue).reduce((acc, k) => {
          acc[k] = null;
          return acc;
        }, {} as any) as T[K];
      }
      return null as T[K];
    })();

    updateFilter(key, clearedValue);
  }, [initialFilters, updateFilter]);

  // Preset management
  const savePreset = useCallback((name: string, description?: string) => {
    const preset: SearchPreset = {
      id: Date.now().toString(),
      name,
      description,
      filters: { ...filters },
      entityType,
      createdAt: new Date()
    };

    const newPresets = [...savedPresets, preset];
    setSavedPresets(newPresets);

    const allPresets = loadFromStorage(STORAGE_KEYS.SEARCH_PRESETS, {}) as Record<string, SearchPreset[]>;
    allPresets[entityType] = newPresets;
    saveToStorage(STORAGE_KEYS.SEARCH_PRESETS, allPresets);

    return preset;
  }, [filters, savedPresets, entityType]);

  const loadPreset = useCallback((preset: SearchPreset) => {
    setFilters({ ...initialFilters, ...preset.filters });
  }, [initialFilters]);

  const deletePreset = useCallback((presetId: string) => {
    const newPresets = savedPresets.filter(p => p.id !== presetId && !p.isDefault);
    setSavedPresets(newPresets);

    const allPresets = loadFromStorage(STORAGE_KEYS.SEARCH_PRESETS, {}) as Record<string, SearchPreset[]>;
    allPresets[entityType] = newPresets;
    saveToStorage(STORAGE_KEYS.SEARCH_PRESETS, allPresets);
  }, [savedPresets, entityType]);

  // Helper functions
  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      const initial = initialFilters[key as keyof T];

      if (value === initial) return false;
      if (value === null || value === undefined || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return Object.values(value).some(v => v !== null && v !== undefined && v !== '');
      }

      return true;
    });
  }, [filters, initialFilters]);

  const getActiveFilterCount = useMemo(() => {
    return Object.entries(filters).reduce((count, [key, value]) => {
      const initial = initialFilters[key as keyof T];

      if (value === initial) return count;
      if (value === null || value === undefined || value === '') return count;
      if (Array.isArray(value) && value.length === 0) return count;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const hasActiveValues = Object.values(value).some(v => v !== null && v !== undefined && v !== '');
        return hasActiveValues ? count + 1 : count;
      }

      return count + 1;
    }, 0);
  }, [filters, initialFilters]);

  return {
    // State
    filters,
    results,
    loading,
    error,
    searchHistory,
    savedPresets,

    // Actions
    updateFilter,
    updateFilters,
    resetFilters,
    clearFilter,
    executeSearch: () => executeSearch(filters),

    // Preset management
    savePreset,
    loadPreset,
    deletePreset,

    // Helpers
    hasActiveFilters,
    getActiveFilterCount,

    // For external components
    setResults,
    setLoading,
    setError
  };
}