/**
 * BOM (Bill of Materials) React Query 훅
 * 중앙화된 타입 정의와 유틸리티 함수를 사용하여 중복 제거
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bomKeys, type BOMFilters } from '@/lib/query-keys';

// 중앙화된 타입 정의 import
import type {
  BOMEntry,
  BOMTreeNode,
  BOMAPIResponse,
  BOMCreateRequest,
  BOMUpdateRequest,
  BOMStatistics,
} from '@/types/bom';

// 중앙화된 유틸리티 함수 import
import {
  extractBOMEntries,
  buildBOMTree,
  flattenBOMTree,
  calculateBOMStatistics,
  searchBOMEntries,
  hasCoilSpec,
} from '@/lib/bom-utils';

// 기존 타입 호환성을 위한 re-export
export type { BOMEntry, BOMTreeNode, BOMCreateRequest, BOMUpdateRequest };

// Legacy 타입 별칭 (기존 코드 호환성 유지)
/** @deprecated Use BOMEntry instead */
export type BOMItem = BOMEntry;

/** @deprecated Use BOMTreeNode instead */
export interface BOMTree {
  item_id: number;
  item_code: string;
  item_name: string;
  quantity: number;
  unit: string;
  level: number;
  children?: BOMTree[];
}

// BOM Flat structure for easy calculation
export interface BOMFlat {
  item_id: number;
  item_code: string;
  item_name: string;
  total_quantity: number;
  unit: string;
  path: string[];
}

// Create BOM data type (without bom_id and timestamps)
export type CreateBOMData = BOMCreateRequest;

// Update BOM data type
export type UpdateBOMData = BOMUpdateRequest;

// ==================== API FUNCTIONS ====================

// Fetch BOM items with optional filtering
async function fetchBOMItems(filters: BOMFilters = {}): Promise<BOMItem[]> {
  const searchParams = new URLSearchParams();

  if (filters.parentId) searchParams.append('parent_id', filters.parentId.toString());
  if (filters.childId) searchParams.append('child_id', filters.childId.toString());
  if (filters.search) searchParams.append('search', filters.search);

  const response = await fetch(`/api/bom?${searchParams}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<BOMItem[]> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch BOM items');
  }

  return data.data || [];
}

// Fetch BOM tree structure for a parent item
async function fetchBOMTree(parentId: number): Promise<BOMTree> {
  const response = await fetch(`/api/bom/tree?parent_id=${parentId}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<BOMTree> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch BOM tree');
  }

  return data.data!;
}

// Fetch BOM flat structure (all components with calculated quantities)
async function fetchBOMFlat(parentId: number): Promise<BOMFlat[]> {
  const response = await fetch(`/api/bom/flat?parent_id=${parentId}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<BOMFlat[]> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch BOM flat structure');
  }

  return data.data || [];
}

// Create new BOM item
async function createBOMItem(bomData: CreateBOMData): Promise<BOMItem> {
  const response = await fetch('/api/bom', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(bomData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<BOMItem> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to create BOM item');
  }

  return data.data!;
}

// Update existing BOM item
async function updateBOMItem(bomData: UpdateBOMData): Promise<BOMItem> {
  const response = await fetch('/api/bom', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(bomData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<BOMItem> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to update BOM item');
  }

  return data.data!;
}

// Delete BOM item
async function deleteBOMItem(id: number): Promise<void> {
  const response = await fetch(`/api/bom?id=${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: ApiResponse<void> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to delete BOM item');
  }
}

// ==================== REACT QUERY HOOKS ====================

/**
 * Hook for fetching BOM items with caching
 */
export function useBOMItems(filters: BOMFilters = {}) {
  return useQuery({
    queryKey: bomKeys.list(filters),
    queryFn: () => fetchBOMItems(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes (master data)
    gcTime: 10 * 60 * 1000,   // 10 minutes
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook for fetching BOM tree structure
 */
export function useBOMTree(parentId: number) {
  return useQuery({
    queryKey: bomKeys.tree(parentId),
    queryFn: () => fetchBOMTree(parentId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    enabled: !!parentId && parentId > 0,
    retry: 2,
  });
}

/**
 * Hook for fetching BOM flat structure (material requirements)
 */
export function useBOMFlat(parentId: number) {
  return useQuery({
    queryKey: bomKeys.flat(parentId),
    queryFn: () => fetchBOMFlat(parentId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    enabled: !!parentId && parentId > 0,
    retry: 2,
  });
}

/**
 * Hook for creating BOM items with optimistic updates
 */
export function useCreateBOMItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBOMItem,
    onSuccess: (newBOM) => {
      // Invalidate all BOM queries
      queryClient.invalidateQueries({ queryKey: bomKeys.all });

      // Invalidate specific parent's tree and flat structure
      queryClient.invalidateQueries({ queryKey: bomKeys.tree(newBOM.parent_item_id) });
      queryClient.invalidateQueries({ queryKey: bomKeys.flat(newBOM.parent_item_id) });

      // Optimistic update for list
      queryClient.setQueriesData<BOMItem[]>(
        { queryKey: bomKeys.lists() },
        (oldBOMs) => {
          if (!oldBOMs) return [newBOM];
          return [newBOM, ...oldBOMs];
        }
      );
    },
    onError: (error) => {
      console.error('Failed to create BOM item:', error);
    },
  });
}

/**
 * Hook for updating BOM items with optimistic updates
 */
export function useUpdateBOMItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateBOMItem,
    onSuccess: (updatedBOM) => {
      // Invalidate all BOM queries
      queryClient.invalidateQueries({ queryKey: bomKeys.all });

      // Invalidate specific parent's tree and flat structure
      queryClient.invalidateQueries({ queryKey: bomKeys.tree(updatedBOM.parent_item_id) });
      queryClient.invalidateQueries({ queryKey: bomKeys.flat(updatedBOM.parent_item_id) });

      // Update specific BOM in cache
      queryClient.setQueriesData<BOMItem[]>(
        { queryKey: bomKeys.lists() },
        (oldBOMs) => {
          if (!oldBOMs) return [updatedBOM];
          return oldBOMs.map(bom =>
            bom.bom_id === updatedBOM.bom_id ? updatedBOM : bom
          );
        }
      );
    },
    onError: (error) => {
      console.error('Failed to update BOM item:', error);
    },
  });
}

/**
 * Hook for deleting BOM items with optimistic updates
 */
export function useDeleteBOMItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteBOMItem,
    onSuccess: (_, deletedId) => {
      // Invalidate all BOM queries
      queryClient.invalidateQueries({ queryKey: bomKeys.all });

      // Remove BOM from cache
      queryClient.setQueriesData<BOMItem[]>(
        { queryKey: bomKeys.lists() },
        (oldBOMs) => {
          if (!oldBOMs) return [];
          return oldBOMs.filter(bom => bom.bom_id !== deletedId);
        }
      );
    },
    onError: (error) => {
      console.error('Failed to delete BOM item:', error);
    },
  });
}

/**
 * Hook for prefetching BOM data
 */
export function usePrefetchBOM() {
  const queryClient = useQueryClient();

  return {
    prefetchBOMItems: (filters: BOMFilters = {}) => {
      queryClient.prefetchQuery({
        queryKey: bomKeys.list(filters),
        queryFn: () => fetchBOMItems(filters),
        staleTime: 5 * 60 * 1000,
      });
    },
    prefetchBOMTree: (parentId: number) => {
      if (!parentId || parentId <= 0) return;
      queryClient.prefetchQuery({
        queryKey: bomKeys.tree(parentId),
        queryFn: () => fetchBOMTree(parentId),
        staleTime: 5 * 60 * 1000,
      });
    },
    prefetchBOMFlat: (parentId: number) => {
      if (!parentId || parentId <= 0) return;
      queryClient.prefetchQuery({
        queryKey: bomKeys.flat(parentId),
        queryFn: () => fetchBOMFlat(parentId),
        staleTime: 5 * 60 * 1000,
      });
    },
  };
}

/**
 * Utility hook to invalidate all BOM-related queries
 */
export function useInvalidateBOM() {
  const queryClient = useQueryClient();

  return (parentId?: number) => {
    if (parentId) {
      // Invalidate specific parent's data
      queryClient.invalidateQueries({ queryKey: bomKeys.tree(parentId) });
      queryClient.invalidateQueries({ queryKey: bomKeys.flat(parentId) });
      queryClient.invalidateQueries({ queryKey: bomKeys.detail(parentId) });
    } else {
      // Invalidate all BOM data
      queryClient.invalidateQueries({ queryKey: bomKeys.all });
    }
  };
}
