/**
 * BOM (Bill of Materials) 유틸리티 함수
 * 중복 로직 제거 및 코드 재사용성 향상을 위한 공용 유틸리티
 */

import type { BOMEntry, BOMTreeNode } from '@/types/bom';

/**
 * 코일 스펙 존재 여부 확인
 * 5개 파일에서 중복 사용되던 로직을 통합
 *
 * @param materialGrade - 재질등급 값 (material_grade)
 * @returns 코일 스펙이 존재하면 true
 */
export function hasCoilSpec(materialGrade: string | null | undefined): boolean {
  return !!(materialGrade && materialGrade.trim() !== '');
}

/**
 * BOM 엔트리에서 코일 스펙 존재 여부 확인
 *
 * @param entry - BOM 엔트리 객체
 * @returns 코일 스펙이 존재하면 true
 */
export function entryHasCoilSpec(entry: Pick<BOMEntry, 'material_grade'>): boolean {
  return hasCoilSpec(entry.material_grade);
}

/**
 * 배열에서 코일 스펙이 있는 항목 수 계산
 *
 * @param items - material_grade 필드를 포함하는 객체 배열
 * @returns 코일 스펙이 있는 항목 수
 */
export function countCoilSpecs<T extends { material_grade?: string | null }>(
  items: T[]
): number {
  return items.filter(item => hasCoilSpec(item.material_grade)).length;
}

/**
 * BOM 엔트리 배열에서 코일 관련 품목만 필터링
 *
 * @param entries - BOM 엔트리 배열
 * @returns 코일 스펙이 있는 엔트리만 포함된 배열
 */
export function filterCoilEntries<T extends { material_grade?: string | null }>(
  entries: T[]
): T[] {
  return entries.filter(entry => hasCoilSpec(entry.material_grade));
}

/**
 * BOM 엔트리 배열을 트리 구조로 변환
 * BOMViewer.tsx에서 사용하던 로직을 공용 함수로 추출
 *
 * @param entries - BOM 엔트리 배열 (flat)
 * @returns BOM 트리 노드 배열
 */
export function buildBOMTree(entries: BOMEntry[]): BOMTreeNode[] {
  // 부모 품목별로 그룹화
  const groupedByParent = new Map<number, BOMEntry[]>();

  entries.forEach(entry => {
    const parentId = entry.parent_item_id;
    if (!groupedByParent.has(parentId)) {
      groupedByParent.set(parentId, []);
    }
    groupedByParent.get(parentId)!.push(entry);
  });

  // 루트 노드 찾기 (level 1)
  const rootEntries = entries.filter(e => e.level_no === 1);

  // 재귀적으로 트리 빌드
  function buildNode(entry: BOMEntry, level: number, path: number[]): BOMTreeNode {
    const childItemId = entry.child_item_id;
    const childEntries = groupedByParent.get(childItemId) || [];
    const currentPath = [...path, entry.bom_id];

    return {
      entry,
      children: childEntries.map(child =>
        buildNode(child, level + 1, currentPath)
      ),
      level,
      expanded: true,
      path: currentPath
    };
  }

  return rootEntries.map(entry => buildNode(entry, 1, []));
}

/**
 * BOM 트리 노드에서 모든 엔트리를 flat하게 추출
 *
 * @param nodes - BOM 트리 노드 배열
 * @returns 모든 BOM 엔트리 배열
 */
export function flattenBOMTree(nodes: BOMTreeNode[]): BOMEntry[] {
  const result: BOMEntry[] = [];

  function traverse(node: BOMTreeNode) {
    result.push(node.entry);
    node.children.forEach(traverse);
  }

  nodes.forEach(traverse);
  return result;
}

/**
 * 특정 노드와 모든 자손 노드의 확장 상태 변경
 *
 * @param nodes - BOM 트리 노드 배열
 * @param targetBomId - 대상 BOM ID (null이면 전체)
 * @param expanded - 확장 여부
 * @returns 업데이트된 트리 노드 배열
 */
export function updateTreeExpansion(
  nodes: BOMTreeNode[],
  targetBomId: number | null,
  expanded: boolean
): BOMTreeNode[] {
  function updateNode(node: BOMTreeNode): BOMTreeNode {
    const shouldUpdate = targetBomId === null || node.entry.bom_id === targetBomId;

    return {
      ...node,
      expanded: shouldUpdate ? expanded : node.expanded,
      children: shouldUpdate && targetBomId !== null
        ? node.children.map(child => ({ ...child, expanded, children: updateNodeDescendants(child.children, expanded) }))
        : node.children.map(updateNode)
    };
  }

  function updateNodeDescendants(children: BOMTreeNode[], expanded: boolean): BOMTreeNode[] {
    return children.map(child => ({
      ...child,
      expanded,
      children: updateNodeDescendants(child.children, expanded)
    }));
  }

  return nodes.map(updateNode);
}

/**
 * BOM 엔트리 검색 필터링
 *
 * @param entries - BOM 엔트리 배열
 * @param searchTerm - 검색어
 * @returns 필터링된 BOM 엔트리 배열
 */
export function searchBOMEntries(
  entries: BOMEntry[],
  searchTerm: string
): BOMEntry[] {
  if (!searchTerm.trim()) return entries;

  const term = searchTerm.toLowerCase().trim();

  return entries.filter(entry => {
    const searchableFields = [
      entry.parent_item_code,
      entry.parent_item_name,
      entry.child_item_code,
      entry.child_item_name,
      entry.child_item_spec,
      entry.material_grade,
      entry.remarks
    ];

    return searchableFields.some(field =>
      field?.toLowerCase().includes(term)
    );
  });
}

/**
 * BOM 레벨별 통계 계산
 *
 * @param entries - BOM 엔트리 배열
 * @returns 레벨별 항목 수 객체
 */
export function calculateLevelDistribution(
  entries: BOMEntry[]
): Record<number, number> {
  return entries.reduce((acc, entry) => {
    const level = entry.level_no;
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
}

/**
 * BOM 통계 계산
 *
 * @param entries - BOM 엔트리 배열
 * @returns BOM 통계 객체
 */
export function calculateBOMStatistics(entries: BOMEntry[]): {
  total_count: number;
  coil_count: number;
  active_count: number;
  level_distribution: Record<number, number>;
} {
  return {
    total_count: entries.length,
    coil_count: countCoilSpecs(entries),
    active_count: entries.filter(e => e.is_active).length,
    level_distribution: calculateLevelDistribution(entries)
  };
}

/**
 * API 응답에서 BOM 엔트리 배열 추출
 * snake_case / camelCase 호환성 처리
 *
 * @param data - API 응답 데이터
 * @returns BOM 엔트리 배열
 */
export function extractBOMEntries(
  data: BOMEntry[] | { bom_entries?: BOMEntry[]; bomEntries?: BOMEntry[] } | null | undefined
): BOMEntry[] {
  if (!data) return [];

  // 배열인 경우 직접 반환
  if (Array.isArray(data)) return data;

  // 객체인 경우 snake_case 또는 camelCase 프로퍼티 확인
  return data.bom_entries || data.bomEntries || [];
}

/**
 * 부모 품목 ID로 BOM 엔트리 필터링
 *
 * @param entries - BOM 엔트리 배열
 * @param parentItemId - 부모 품목 ID
 * @returns 필터링된 BOM 엔트리 배열
 */
export function filterByParentItem(
  entries: BOMEntry[],
  parentItemId: number
): BOMEntry[] {
  return entries.filter(entry => entry.parent_item_id === parentItemId);
}

/**
 * 고유한 부모 품목 ID 목록 추출
 *
 * @param entries - BOM 엔트리 배열
 * @returns 고유한 부모 품목 ID 배열
 */
export function getUniqueParentIds(entries: BOMEntry[]): number[] {
  return [...new Set(entries.map(e => e.parent_item_id))];
}

/**
 * 고유한 자품목 ID 목록 추출
 *
 * @param entries - BOM 엔트리 배열
 * @returns 고유한 자품목 ID 배열
 */
export function getUniqueChildIds(entries: BOMEntry[]): number[] {
  return [...new Set(entries.map(e => e.child_item_id))];
}
