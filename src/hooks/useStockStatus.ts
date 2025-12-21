import { useQuery, useQueryClient } from '@tanstack/react-query';

// API Response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Stock status interface
export interface StockStatus {
  item_id: number;
  item_code: string;
  item_name: string;
  item_type: string;
  spec?: string;
  unit: string;
  current_stock: number;
  min_stock_level?: number;
  max_stock_level?: number;
  stock_status: '정상' | '주의' | '부족' | '과재고';
  last_transaction_date?: string;
  location?: string;
}

// Stock summary interface
export interface StockSummary {
  total_items: number;
  normal_stock: number;
  low_stock: number;
  out_of_stock: number;
  excess_stock: number;
  total_value: number;
  categories: {
    category: string;
    count: number;
    value: number;
  }[];
}

// Stock movement interface
export interface StockMovement {
  item_id: number;
  item_code: string;
  item_name: string;
  date: string;
  type: '입고' | '출고' | '생산입고' | '생산출고' | '이동' | '조정';
  quantity: number;
  running_total: number;
}

// Stock query parameters
export interface StockQueryParams {
  item_type?: string;
  status?: string;
  location?: string;
  search?: string;
  low_stock_only?: boolean;
}

// Query key factory for stock data
export const stockKeys = {
  all: ['stock'] as const,
  status: () => [...stockKeys.all, 'status'] as const,
  statusList: (params: StockQueryParams) => [...stockKeys.status(), params] as const,
  summary: () => [...stockKeys.all, 'summary'] as const,
  movements: () => [...stockKeys.all, 'movements'] as const,
  movement: (itemId: number, period?: string) => [...stockKeys.movements(), itemId, period] as const,
  alerts: () => [...stockKeys.all, 'alerts'] as const,
};

// Paginated response interface
interface PaginatedResponse<T> {
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary?: {
    total_items: number;
    low_stock_items: number;
    total_value: number;
  };
}

// Fetch stock status with optional filtering
async function fetchStockStatus(params: StockQueryParams = {}): Promise<StockStatus[]> {
  const searchParams = new URLSearchParams();

  if (params.item_type) searchParams.append('item_type', params.item_type);
  if (params.status) searchParams.append('status', params.status);
  if (params.location) searchParams.append('location', params.location);
  if (params.search) searchParams.append('search', params.search);
  if (params.low_stock_only) searchParams.append('low_stock', 'true');

  const response = await fetch(`/api/inventory/stock?${searchParams}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result: ApiResponse<PaginatedResponse<StockStatus> | StockStatus[]> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch stock status');
  }

  // Handle both paginated and array responses for backwards compatibility
  const data = result.data;
  if (!data) return [];

  // Check if response is paginated (has 'data' property as array)
  if ('data' in data && Array.isArray(data.data)) {
    return data.data;
  }

  // Legacy array response
  if (Array.isArray(data)) {
    return data;
  }

  return [];
}

// Fetch stock summary/analytics
async function fetchStockSummary(): Promise<StockSummary> {
  const response = await fetch('/api/inventory/stock/summary');

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<StockSummary> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch stock summary');
  }

  return data.data!;
}

// Fetch stock movements for a specific item
async function fetchStockMovements(itemId: number, period: string = '30d'): Promise<StockMovement[]> {
  const response = await fetch(`/api/inventory/stock/movements?item_id=${itemId}&period=${period}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<StockMovement[]> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch stock movements');
  }

  return data.data || [];
}

// Fetch low stock alerts
async function fetchStockAlerts(): Promise<StockStatus[]> {
  const response = await fetch('/api/inventory/stock/alerts');

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<StockStatus[]> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch stock alerts');
  }

  return data.data || [];
}

// Hook for fetching stock status with caching and error handling
export function useStockStatus(params: StockQueryParams = {}) {
  return useQuery({
    queryKey: stockKeys.statusList(params),
    queryFn: () => fetchStockStatus(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

// Hook for fetching stock summary
export function useStockSummary() {
  return useQuery({
    queryKey: stockKeys.summary(),
    queryFn: fetchStockSummary,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

// Hook for fetching stock movements for a specific item
export function useStockMovements(itemId: number, period: string = '30d') {
  return useQuery({
    queryKey: stockKeys.movement(itemId, period),
    queryFn: () => fetchStockMovements(itemId, period),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    enabled: !!itemId, // Only run query if itemId is provided
    retry: 2,
  });
}

// Hook for fetching stock alerts (low stock items)
export function useStockAlerts() {
  return useQuery({
    queryKey: stockKeys.alerts(),
    queryFn: fetchStockAlerts,
    staleTime: 2 * 60 * 1000, // 2 minutes (more frequent for alerts)
    gcTime: 5 * 60 * 1000,    // 5 minutes
    refetchOnWindowFocus: true,
    retry: 2,
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes for alerts
  });
}

// Hook for fetching low stock items specifically
export function useLowStockItems() {
  return useStockStatus({ low_stock_only: true });
}

// Hook for prefetching stock data (useful for dashboard or navigation)
export function usePrefetchStock() {
  const queryClient = useQueryClient();

  return {
    prefetchStockStatus: (params: StockQueryParams = {}) => {
      queryClient.prefetchQuery({
        queryKey: stockKeys.statusList(params),
        queryFn: () => fetchStockStatus(params),
        staleTime: 5 * 60 * 1000,
      });
    },
    prefetchStockSummary: () => {
      queryClient.prefetchQuery({
        queryKey: stockKeys.summary(),
        queryFn: fetchStockSummary,
        staleTime: 5 * 60 * 1000,
      });
    },
    prefetchStockAlerts: () => {
      queryClient.prefetchQuery({
        queryKey: stockKeys.alerts(),
        queryFn: fetchStockAlerts,
        staleTime: 2 * 60 * 1000,
      });
    },
  };
}

// Utility function to invalidate all stock-related queries
export function useInvalidateStock() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: stockKeys.all });
  };
}

// Utility function to refresh critical stock data
export function useRefreshStockData() {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: stockKeys.summary() }),
      queryClient.invalidateQueries({ queryKey: stockKeys.alerts() }),
      queryClient.invalidateQueries({ queryKey: stockKeys.status() }),
    ]);
  };
}