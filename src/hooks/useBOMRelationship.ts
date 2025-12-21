'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { bomKeys, getStaleTime } from '@/lib/query-keys';

/**
 * BOM 관계 항목 인터페이스 (lite 모드 응답)
 */
export interface BOMEntry {
  bom_id: number;
  parent_item_id: number;
  child_item_id: number;
  quantity_required: number;
  customer_id: number | null;
  child_supplier_id: number | null;
  customer: {
    company_id: number;
    company_name: string;
    company_code?: string;
  } | null;
  child_supplier: {
    company_id: number;
    company_name: string;
    company_code?: string;
  } | null;
  parent: {
    item_code: string;
    item_name: string;
  } | null;
  child: {
    item_code: string;
    item_name: string;
  } | null;
  is_active: boolean;
}

/**
 * BOM 관계 조회 옵션
 */
export interface UseBOMRelationshipOptions {
  itemId: number | null;
  role: 'parent' | 'child';
  expectedCompanyId?: number | null;
  companyType?: 'customer' | 'supplier';
  enabled?: boolean;
}

/**
 * BOM 관계 훅 반환 타입
 */
export interface UseBOMRelationshipReturn {
  bomEntries: BOMEntry[];
  isLoading: boolean;
  error: string | null;
  hasMismatch: boolean;
  mismatchInfo: {
    currentCompanyId: number | null;
    currentCompanyName: string | null;
    expectedCompanyId: number | null;
  } | null;
  updateRelationship: (
    bomId: number,
    field: 'customer_id' | 'child_supplier_id',
    newCompanyId: number
  ) => Promise<boolean>;
  refetch: () => void;
}

/**
 * BOM 관계 조회 및 수정을 위한 커스텀 훅
 *
 * @param options - 조회 옵션
 * @returns BOM 관계 데이터 및 수정 함수
 *
 * @example
 * // 입고 시 공급사 관계 확인
 * const { bomEntries, hasMismatch, updateRelationship } = useBOMRelationship({
 *   itemId: selectedItemId,
 *   role: 'child',
 *   expectedCompanyId: selectedSupplierId,
 *   companyType: 'supplier'
 * });
 *
 * // 출고/생산 시 고객사 관계 확인
 * const { bomEntries, hasMismatch } = useBOMRelationship({
 *   itemId: selectedItemId,
 *   role: 'child',
 *   expectedCompanyId: selectedCustomerId,
 *   companyType: 'customer'
 * });
 */
export function useBOMRelationship(options: UseBOMRelationshipOptions): UseBOMRelationshipReturn {
  const {
    itemId,
    role,
    expectedCompanyId,
    companyType = 'supplier',
    enabled = true
  } = options;

  const queryClient = useQueryClient();

  // BOM 관계 조회 (lite 모드)
  const {
    data,
    isLoading,
    error: queryError,
    refetch
  } = useQuery({
    queryKey: bomKeys.byItem(itemId || 0, role),
    queryFn: async (): Promise<{ bom_entries: BOMEntry[]; total: number }> => {
      const param = role === 'child' ? 'child_item_id' : 'parent_item_id';
      const response = await fetch(
        `/api/bom?${param}=${itemId}&lite=true&limit=50`
      );

      // 응답 상태 확인
      if (!response.ok) {
        // JSON 파싱 시도 (실패하면 기본 에러 메시지 사용)
        let errorMessage = 'BOM 조회에 실패했습니다';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // JSON 파싱 실패 시 상태 텍스트 사용
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // 응답 본문 검증
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error('응답을 파싱할 수 없습니다');
      }

      // 응답 구조 검증
      if (!result || typeof result !== 'object') {
        throw new Error('잘못된 응답 형식입니다');
      }

      if (!result.success) {
        throw new Error(result.error || 'BOM 조회에 실패했습니다');
      }

      // data 필드 존재 및 구조 검증
      if (!result.data || !Array.isArray(result.data.bom_entries)) {
        return { bom_entries: [], total: 0 };
      }

      return result.data;
    },
    enabled: enabled && !!itemId && itemId > 0,
    staleTime: getStaleTime('bom'),
    gcTime: 10 * 60 * 1000, // 10분 캐시
  });

  const bomEntries = data?.bom_entries || [];

  // 불일치 감지
  const mismatchInfo = useMemo(() => {
    if (!expectedCompanyId || bomEntries.length === 0) {
      return null;
    }

    // 첫 번째 BOM 항목의 관계 확인
    const entry = bomEntries[0];
    const currentCompanyId = companyType === 'customer'
      ? entry.customer_id
      : entry.child_supplier_id;
    const currentCompanyName = companyType === 'customer'
      ? entry.customer?.company_name || null
      : entry.child_supplier?.company_name || null;

    if (currentCompanyId !== expectedCompanyId) {
      return {
        currentCompanyId,
        currentCompanyName,
        expectedCompanyId
      };
    }

    return null;
  }, [bomEntries, expectedCompanyId, companyType]);

  const hasMismatch = mismatchInfo !== null;

  // BOM 관계 업데이트 뮤테이션
  const updateMutation = useMutation({
    mutationFn: async ({
      bomId,
      field,
      newCompanyId
    }: {
      bomId: number;
      field: 'customer_id' | 'child_supplier_id';
      newCompanyId: number;
    }) => {
      const response = await fetch('/api/bom', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bom_id: bomId,
          [field]: newCompanyId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'BOM 업데이트에 실패했습니다');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'BOM 업데이트에 실패했습니다');
      }

      return result;
    },
    onSuccess: () => {
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: bomKeys.all });
    }
  });

  // 관계 업데이트 함수
  const updateRelationship = useCallback(
    async (
      bomId: number,
      field: 'customer_id' | 'child_supplier_id',
      newCompanyId: number
    ): Promise<boolean> => {
      try {
        await updateMutation.mutateAsync({ bomId, field, newCompanyId });
        return true;
      } catch (error) {
        console.error('BOM 관계 업데이트 실패:', error);
        return false;
      }
    },
    [updateMutation]
  );

  return {
    bomEntries,
    isLoading: isLoading || updateMutation.isPending,
    error: queryError?.message || (updateMutation.error as Error)?.message || null,
    hasMismatch,
    mismatchInfo,
    updateRelationship,
    refetch
  };
}
