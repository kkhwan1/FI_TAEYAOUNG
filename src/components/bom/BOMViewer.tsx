'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  Plus,
  Search,
  Filter,
  Download,
  Wrench,
  AlertCircle,
  Check,
  X,
  RefreshCw,
  Disc,
  FileEdit,
  Pencil
} from 'lucide-react';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../hooks/useConfirm';
// 중앙화된 타입 및 유틸리티 import
import type { BOMEntry } from '@/types/bom';
import { entryHasCoilSpec } from '@/lib/bom-utils';

interface Company {
  company_id: number;
  company_name: string;
}

interface BOMViewerProps {
  parentItemId?: number;
  onUpdate?: (bomId: number, updates: Partial<BOMEntry>) => Promise<void>;
  onDelete?: (bomId: number) => Promise<void>;
  onAdd?: (parentId: number, childId: number, quantity: number) => Promise<void>;
  onEditFull?: (entry: BOMEntry) => void;  // 전체 수정 (모달) 콜백
  readOnly?: boolean;
  initialSearchTerm?: string; // 메인 검색 필드와 동기화를 위한 prop
  // 필터 props - 메인 페이지 필터와 동기화
  customerId?: number | null;         // 납품처 ID
  purchaseSupplierId?: number | null; // 구매처 ID (parent item의 supplier)
  supplierId?: number | null;         // 공급처 ID (child item의 supplier)
  vehicleType?: string;               // 차종
  // 회사 목록 (드롭다운용)
  suppliers?: Company[];              // 공급사 목록 (구매처 선택용)
}

interface CostSummary {
  total_material_cost: number;
  total_scrap_revenue: number;
  total_net_cost: number;
  coil_count: number;
  purchased_count: number;
  total_items: number;
}

interface TreeNode {
  entry: BOMEntry;
  children: TreeNode[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatCurrency = (value?: number): string => {
  if (value === undefined || value === null) return '0';
  return new Intl.NumberFormat('ko-KR').format(value);
};

const getItemIcon = (itemType: string): React.ReactNode => {
  switch (itemType) {
    case 'internal_production':
      return <Wrench className="w-4 h-4 text-blue-500" />;
    case 'external_purchase':
      return <AlertCircle className="w-4 h-4 text-orange-500" />;
    default:
      return <AlertCircle className="w-4 h-4 text-gray-400" />;
  }
};

// 코일 연계 여부 확인 (T4: 코일 스펙 연결 시각화)
// 중앙화된 함수 사용: entryHasCoilSpec from '@/lib/bom-utils'
const hasCoilSpec = entryHasCoilSpec;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const BOMViewer: React.FC<BOMViewerProps> = ({
  parentItemId,
  onUpdate,
  onDelete,
  onAdd,
  onEditFull,
  readOnly = false,
  initialSearchTerm = '',
  customerId,
  purchaseSupplierId,
  supplierId,
  vehicleType,
  suppliers = []
}) => {
  const toast = useToast();
  const { deleteConfirm } = useConfirm();

  // State management
  const [bomData, setBOMData] = useState<BOMEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [filterLevel, setFilterLevel] = useState<number | null>(null);
  const [filterItemType, setFilterItemType] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [editingBomId, setEditingBomId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<BOMEntry>>({});
  // 인라인 편집 확장: 수량, 레벨, 비고, 차종, 단가, 구매처 동시 편집 가능
  const [editingFields, setEditingFields] = useState<{
    quantity_required?: number;
    level_no?: number;
    remarks?: string;
    vehicle_model?: string;
    unit_price?: number;
    purchase_supplier_id?: number | null; // 구매처 (parent item의 supplier_id)
  }>({});

  // initialSearchTerm이 변경되면 searchTerm 동기화
  useEffect(() => {
    setSearchTerm(initialSearchTerm);
  }, [initialSearchTerm]);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchBOMData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (parentItemId) {
        params.append('parent_item_id', parentItemId.toString());
      }
      // 납품처/구매처/공급처/차종 필터 파라미터 추가
      if (customerId) {
        params.append('customer_id', customerId.toString());
      }
      if (purchaseSupplierId) {
        params.append('purchase_supplier_id', purchaseSupplierId.toString());
      }
      if (supplierId) {
        params.append('supplier_id', supplierId.toString());
      }
      if (vehicleType) {
        params.append('vehicle_type', vehicleType);
      }

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/bom?${params}`, {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        // API returns bom_entries (snake_case), handle both formats for compatibility
        const rawData = result.data.bom_entries || result.data.bomEntries || [];
        
        // API 응답 필드명을 BOMViewer가 기대하는 형식으로 변환
        // API: parent_code, child_code, level_no
        // BOMViewer: parent_item_code, child_item_code, level
        const normalizedData = rawData.map((entry: any) => ({
          ...entry,
          parent_item_code: entry.parent_code || entry.parent_item_code,
          parent_item_name: entry.parent_name || entry.parent_item_name,
          child_item_code: entry.child_code || entry.child_item_code,
          child_item_name: entry.child_name || entry.child_item_name,
          level: entry.level_no || entry.level || 1,
          bom_id: entry.bom_id || entry.id
        }));
        
        setBOMData(normalizedData);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        const errorMsg = extractErrorMessage(result.error) || 'BOM 데이터 로드 실패';
        setError(errorMsg);
        toast.error('데이터 로드 실패', errorMsg);
      }
    } catch (err) {
      const errorMsg = 'BOM 데이터 로딩 실패';
      setError(errorMsg);
      toast.error('오류 발생', errorMsg);
      console.error('BOM fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [parentItemId, customerId, purchaseSupplierId, supplierId, vehicleType, toast]);

  useEffect(() => {
    fetchBOMData();
  }, [fetchBOMData]);

  // ============================================================================
  // TREE BUILDING
  // ============================================================================

  const buildTree = useCallback((entries: BOMEntry[]): TreeNode[] => {
    const nodeMap = new Map<number, TreeNode>();
    const roots: TreeNode[] = [];

    // Create nodes for all entries
    entries.forEach(entry => {
      nodeMap.set(entry.bom_id, { entry, children: [] });
    });

    // Build tree structure (T3 버그 수정: 올바른 부모-자식 관계 매핑)
    entries.forEach(entry => {
      const node = nodeMap.get(entry.bom_id);
      if (!node) return;

      if (entry.level === 1) {
        // Level 1은 루트 노드
        roots.push(node);
      } else {
        // 부모 찾기: 현재 entry의 parent_item_id가 부모 entry의 child_item_id와 일치
        // 그리고 부모의 level은 현재보다 1 작음
        const parentEntry = entries.find(
          e => e.child_item_id === entry.parent_item_id && e.level === (entry.level ?? 0) - 1
        );
        if (parentEntry) {
          const parentNode = nodeMap.get(parentEntry.bom_id);
          if (parentNode) {
            parentNode.children.push(node);
          }
        } else {
          // 부모를 찾지 못한 경우, 같은 parent_item_id를 가진 level-1 노드 찾기
          const altParentEntry = entries.find(
            e => e.parent_item_id === entry.parent_item_id &&
                 e.child_item_id !== entry.child_item_id &&
                 e.level === (entry.level ?? 0) - 1
          );
          if (altParentEntry) {
            const altParentNode = nodeMap.get(altParentEntry.bom_id);
            if (altParentNode) {
              altParentNode.children.push(node);
            }
          }
        }
      }
    });

    return roots;
  }, []);

  // ============================================================================
  // FILTERING & SEARCH
  // ============================================================================

  const filteredBOMData = useMemo(() => {
    return bomData.filter(entry => {
      const matchesSearch = searchTerm === '' ||
        (entry.child_item_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.child_item_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.parent_item_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.parent_item_name || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesLevel = filterLevel === null || entry.level === filterLevel;

      const matchesType = filterItemType === 'all' || entry.item_type === filterItemType;

      return matchesSearch && matchesLevel && matchesType;
    });
  }, [bomData, searchTerm, filterLevel, filterItemType]);

  const treeData = useMemo(() => {
    return buildTree(filteredBOMData);
  }, [filteredBOMData, buildTree]);

  // ============================================================================
  // COST CALCULATION
  // ============================================================================

  const costSummary = useMemo((): CostSummary => {
    return filteredBOMData.reduce((acc, entry) => ({
      total_material_cost: acc.total_material_cost + (entry.material_cost || 0),
      total_scrap_revenue: acc.total_scrap_revenue + (entry.scrap_revenue || 0),
      total_net_cost: acc.total_net_cost + (entry.net_cost || 0),
      coil_count: acc.coil_count + (entry.material_grade ? 1 : 0),
      purchased_count: acc.purchased_count + (entry.item_type === 'external_purchase' ? 1 : 0),
      total_items: acc.total_items + 1
    }), {
      total_material_cost: 0,
      total_scrap_revenue: 0,
      total_net_cost: 0,
      coil_count: 0,
      purchased_count: 0,
      total_items: 0
    });
  }, [filteredBOMData]);

  // ============================================================================
  // EXPAND/COLLAPSE HANDLERS
  // ============================================================================

  const toggleExpand = useCallback((bomId: number) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(bomId)) {
        next.delete(bomId);
      } else {
        next.add(bomId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedNodes(new Set(bomData.map(entry => entry.bom_id)));
  }, [bomData]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  // ============================================================================
  // EDIT HANDLERS
  // ============================================================================

  // 인라인 편집 시작 (수량, 레벨, 비고, 차종, 단가, 구매처)
  const handleInlineEdit = useCallback((entry: BOMEntry) => {
    setEditingBomId(entry.bom_id);
    setEditingFields({
      quantity_required: entry.quantity_required,
      level_no: entry.level ?? entry.level_no ?? 1,
      remarks: entry.remarks ?? '',
      vehicle_model: entry.vehicle_model ?? '',
      unit_price: entry.unit_price ?? 0,
      purchase_supplier_id: entry.parent_supplier?.company_id ?? null
    });
    setEditValues({ quantity_required: entry.quantity_required });
  }, []);

  // 기존 handleEdit는 인라인 편집용으로 유지 (호환성)
  const handleEdit = useCallback((entry: BOMEntry) => {
    handleInlineEdit(entry);
  }, [handleInlineEdit]);

  // 전체 편집 (모달) - parent/child/customer/supplier 변경용
  const handleFullEdit = useCallback((entry: BOMEntry) => {
    if (onEditFull) {
      onEditFull(entry);
    }
  }, [onEditFull]);

  const handleSave = async () => {
    if (editingBomId && onUpdate) {
      try {
        // 현재 편집 중인 BOM 엔트리 찾기
        const currentEntry = bomData.find(entry => entry.bom_id === editingBomId);
        if (!currentEntry) {
          toast.error('저장 실패', 'BOM 엔트리를 찾을 수 없습니다');
          return;
        }

        // 인라인 편집: 수량, 레벨, 비고, 차종, 단가 저장
        const bomUpdates: Partial<BOMEntry> = {};

        if (editingFields.quantity_required !== undefined) {
          bomUpdates.quantity_required = editingFields.quantity_required;
        }
        if (editingFields.level_no !== undefined) {
          bomUpdates.level_no = editingFields.level_no;
        }
        if (editingFields.remarks !== undefined) {
          bomUpdates.remarks = editingFields.remarks;
        }
        if (editingFields.vehicle_model !== undefined) {
          bomUpdates.vehicle_model = editingFields.vehicle_model;
        }
        if (editingFields.unit_price !== undefined) {
          bomUpdates.unit_price = editingFields.unit_price;
        }

        // 구매처(parent item의 supplier_id) 변경 여부 확인
        const purchaseSupplierChanged =
          editingFields.purchase_supplier_id !== undefined &&
          editingFields.purchase_supplier_id !== (currentEntry.parent_supplier?.company_id ?? null);

        if (Object.keys(bomUpdates).length === 0 && !purchaseSupplierChanged) {
          toast.warning('변경 없음', '수정된 내용이 없습니다');
          return;
        }

        // 1. BOM 테이블 업데이트 (수량, 레벨, 비고, 차종, 단가 등)
        if (Object.keys(bomUpdates).length > 0) {
          await onUpdate(editingBomId, bomUpdates);
        }

        // 2. 구매처 변경 시 Items API 호출 (parent item의 supplier_id 업데이트)
        if (purchaseSupplierChanged && currentEntry.parent_item_id) {
          try {
            const itemUpdateResponse = await fetch(`/api/items/${currentEntry.parent_item_id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json; charset=utf-8'
              },
              body: JSON.stringify({
                supplier_id: editingFields.purchase_supplier_id
              })
            });

            if (!itemUpdateResponse.ok) {
              const errorData = await itemUpdateResponse.json();
              throw new Error(errorData.message || '구매처 업데이트 실패');
            }
          } catch (itemError) {
            console.error('구매처 업데이트 실패:', itemError);
            toast.error('구매처 수정 실패', itemError instanceof Error ? itemError.message : '구매처 업데이트에 실패했습니다');
            // BOM 업데이트는 성공했으므로 계속 진행
          }
        }

        toast.success('수정 완료', 'BOM 정보가 성공적으로 업데이트되었습니다');
        setEditingBomId(null);
        setEditingFields({});
        setEditValues({});
        await fetchBOMData();
      } catch (error) {
        toast.error('수정 실패', 'BOM 업데이트에 실패했습니다');
        console.error('Update error:', error);
      }
    }
  };

  const handleCancel = useCallback(() => {
    setEditingBomId(null);
    setEditingFields({});
    setEditValues({});
  }, []);

  const handleDelete = async (bomId: number) => {
    if (!onDelete) return;

    const confirmed = await deleteConfirm('삭제 확인', '정말 삭제하시겠습니까?');
    if (!confirmed) return;

    try {
      await onDelete(bomId);
      toast.success('삭제 완료', 'BOM 항목이 삭제되었습니다');
      await fetchBOMData();
    } catch (error) {
      toast.error('삭제 실패', 'BOM 항목 삭제에 실패했습니다');
      console.error('Delete error:', error);
    }
  };

  // ============================================================================
  // EXPORT HANDLER
  // ============================================================================

  const handleExport = async () => {
    try {
      toast.info('내보내기 중...', '엑셀 파일을 생성하고 있습니다');

      const params = new URLSearchParams();
      if (parentItemId) {
        params.append('parent_item_id', parentItemId.toString());
      }
      params.append('include_cost_analysis', 'true');

      const { safeFetch } = await import('@/lib/fetch-utils');
      const response = await safeFetch(`/api/bom/export?${params}`, {}, {
        timeout: 60000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BOM_구조_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('내보내기 완료', '엑셀 파일이 다운로드되었습니다');
    } catch (err) {
      toast.error('내보내기 실패', '엑셀 파일 생성에 실패했습니다');
      console.error('Export failed:', err);
    }
  };

  // ============================================================================
  // TREE NODE RENDERER
  // ============================================================================

  const renderTreeNode = useCallback((node: TreeNode, level: number) => {
    const { entry } = node;
    const isExpanded = expandedNodes.has(entry.bom_id);
    const hasChildren = node.children.length > 0;
    const indent = level * 24;
    const isEditing = editingBomId === entry.bom_id;

    return (
      <div key={entry.bom_id} className="bom-tree-node">
        {/* Current Node */}
        <div
          style={{ paddingLeft: `${indent}px` }}
          className={`
            flex items-center py-3 px-4 border-b border-gray-200 dark:border-gray-700
            hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
            ${level > 0 ? 'border-l-2 border-gray-300 dark:border-gray-600' : ''}
            ${isEditing ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
          `}
        >
          {/* Expand/Collapse Button */}
          <button
            onClick={() => toggleExpand(entry.bom_id)}
            disabled={!hasChildren}
            className={`
              mr-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700
              ${!hasChildren ? 'invisible' : ''}
            `}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {/* Item Icon */}
          <div className="mr-2">
            {getItemIcon(entry.item_type || '')}
          </div>

          {/* Item Info - 편집 모드일 때와 아닐 때 레이아웃 다르게 */}
          {isEditing ? (
            // 인라인 편집 UI (수량, 레벨, 비고, 차종, 단가)
            <div className="flex-1 min-w-0">
              <div className="mb-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {entry.child_item_code}
                </span>
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  {entry.child_item_name}
                </span>
              </div>
              <div className="grid grid-cols-12 gap-3 items-end">
                {/* 수량 */}
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">소요량</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingFields.quantity_required ?? ''}
                    onChange={(e) => setEditingFields(prev => ({
                      ...prev,
                      quantity_required: e.target.value ? parseFloat(e.target.value) : undefined
                    }))}
                    className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-blue-500"
                    autoFocus
                  />
                </div>
                {/* 레벨 */}
                <div className="col-span-1">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">레벨</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editingFields.level_no ?? ''}
                    onChange={(e) => setEditingFields(prev => ({
                      ...prev,
                      level_no: e.target.value ? parseInt(e.target.value) : undefined
                    }))}
                    className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-blue-500"
                  />
                </div>
                {/* 구매처 (parent item의 supplier) */}
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">구매처</label>
                  <select
                    value={editingFields.purchase_supplier_id ?? ''}
                    onChange={(e) => setEditingFields(prev => ({
                      ...prev,
                      purchase_supplier_id: e.target.value ? parseInt(e.target.value) : null
                    }))}
                    className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-blue-500"
                  >
                    <option value="">선택 안함</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.company_id} value={supplier.company_id}>
                        {supplier.company_name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* 차종 */}
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">차종</label>
                  <input
                    type="text"
                    value={editingFields.vehicle_model ?? ''}
                    onChange={(e) => setEditingFields(prev => ({
                      ...prev,
                      vehicle_model: e.target.value
                    }))}
                    placeholder="차종 입력..."
                    className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-blue-500"
                  />
                </div>
                {/* 단가 */}
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">단가</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingFields.unit_price ?? ''}
                    onChange={(e) => setEditingFields(prev => ({
                      ...prev,
                      unit_price: e.target.value ? parseFloat(e.target.value) : undefined
                    }))}
                    placeholder="0"
                    className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-blue-500"
                  />
                </div>
                {/* 비고 */}
                <div className="col-span-1">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">비고</label>
                  <input
                    type="text"
                    value={editingFields.remarks ?? ''}
                    onChange={(e) => setEditingFields(prev => ({
                      ...prev,
                      remarks: e.target.value
                    }))}
                    placeholder="비고 입력..."
                    className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-blue-500"
                  />
                </div>
                {/* 저장/취소 버튼 */}
                <div className="col-span-2 flex justify-end space-x-1">
                  <button
                    onClick={handleSave}
                    className="p-1.5 text-white bg-blue-500 hover:bg-blue-600 rounded"
                    title="저장"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="p-1.5 text-gray-600 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded"
                    title="취소"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // 일반 표시 UI
            <div className="flex-1 min-w-0 grid grid-cols-12 gap-4 items-center">
              {/* Item Code & Name */}
              <div className="col-span-4 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900 dark:text-white truncate">
                    {entry.child_item_code}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                    L{entry.level}
                  </span>
                  {/* T4: 코일 연계 표시 - 코일 스펙 연결된 품목에 시각적 표시 */}
                  {hasCoilSpec(entry) && (
                    <span
                      className="flex items-center space-x-1 text-xs text-purple-600 dark:text-purple-400 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded"
                      title={`코일 규격: ${entry.material_grade}`}
                    >
                      <Disc className="w-3 h-3" />
                      <span>코일</span>
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {entry.child_item_name}
                  {/* 코일 규격 표시 */}
                  {hasCoilSpec(entry) && (
                    <span className="ml-2 text-xs text-purple-500 dark:text-purple-400">
                      ({entry.material_grade})
                    </span>
                  )}
                </div>
                {/* 비고 표시 */}
                {entry.remarks && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                    📝 {entry.remarks}
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="col-span-1">
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">수량: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {entry.quantity_required}
                  </span>
                </div>
              </div>

              {/* Vehicle Model */}
              <div className="col-span-2">
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">차종: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {entry.vehicle_model || '-'}
                  </span>
                </div>
              </div>

              {/* Purchase Company (구매처) */}
              <div className="col-span-2">
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">구매처: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {entry.parent_supplier?.company_name || '-'}
                  </span>
                </div>
              </div>

              {/* Supplier (공급처) */}
              <div className="col-span-2">
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">공급처: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {entry.child_supplier?.company_name || '-'}
                  </span>
                </div>
              </div>

              {/* Unit Price */}
              <div className="col-span-2">
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">단가: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ₩{formatCurrency(entry.unit_price)}
                  </span>
                </div>
              </div>

              {/* Material Cost */}
              {entry.material_cost !== undefined && (
                <div className="col-span-1 text-right">
                  <div className="text-xs text-gray-500 dark:text-gray-400">자재비</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    ₩{formatCurrency(entry.material_cost)}
                  </div>
                </div>
              )}

              {/* Net Cost */}
              {entry.net_cost !== undefined && (
                <div className="col-span-1 text-right">
                  <div className="text-xs text-gray-500 dark:text-gray-400">순원가</div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    ₩{formatCurrency(entry.net_cost)}
                  </div>
                </div>
              )}

              {/* Actions - 3가지 버튼: 빠른수정, 전체수정, 삭제 */}
              {!readOnly && (
                <div className="col-span-2 flex justify-end space-x-1">
                  {/* 빠른 수정 (인라인: 수량, 레벨, 비고) */}
                  <button
                    onClick={() => handleInlineEdit(entry)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded"
                    title="빠른 수정 (수량, 레벨, 비고)"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {/* 전체 수정 (모달: 품목, 거래처 포함) */}
                  {onEditFull && (
                    <button
                      onClick={() => handleFullEdit(entry)}
                      className="p-1.5 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 rounded"
                      title="전체 수정 (품목, 거래처 포함)"
                    >
                      <FileEdit className="w-4 h-4" />
                    </button>
                  )}
                  {/* 삭제 */}
                  <button
                    onClick={() => handleDelete(entry.bom_id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  }, [expandedNodes, editingBomId, editingFields, readOnly, toggleExpand, handleInlineEdit, handleFullEdit, handleSave, handleCancel, handleDelete, onEditFull]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading && bomData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-8">
        <LoadingSpinner size="lg" text="BOM 데이터 로딩 중..." />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            BOM 구조 뷰
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchBOMData}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>새로고침</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-4 py-2 text-white bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>엑셀 내보내기</span>
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="품목코드 또는 품목명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filter Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                showFilters
                  ? 'bg-gray-50 border-gray-300 text-gray-700 dark:bg-gray-900/20 dark:border-gray-700 dark:text-gray-300'
                  : 'border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Filter className="w-5 h-5" />
              필터
            </button>

            {/* Expand/Collapse All */}
            <button
              onClick={expandAll}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              모두 펼치기
            </button>
            <button
              onClick={collapseAll}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              모두 접기
            </button>
          </div>
        </div>

        {/* Filter Dropdowns */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Level Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                레벨 필터
              </label>
              <select
                value={filterLevel ?? ''}
                onChange={(e) => setFilterLevel(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">모든 레벨</option>
                <option value="1">레벨 1</option>
                <option value="2">레벨 2</option>
                <option value="3">레벨 3</option>
                <option value="4">레벨 4</option>
                <option value="5">레벨 5</option>
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                품목 유형
              </label>
              <select
                value={filterItemType}
                onChange={(e) => setFilterItemType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체</option>
                <option value="internal_production">내부 생산품</option>
                <option value="external_purchase">외부 구매품</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900/20 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Data Info */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          전체 {bomData.length}개 항목 중 {filteredBOMData.length}개 표시
        </div>
      </div>

      {/* Tree View */}
      <div className="max-h-[600px] overflow-y-auto">
        {filteredBOMData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            
            <p className="text-lg font-medium">BOM 데이터가 없습니다</p>
            <p className="text-sm">품목에 BOM을 추가해주세요</p>
          </div>
        ) : (
          <div>
            {treeData.map(node => renderTreeNode(node, 0))}
          </div>
        )}
      </div>

      {/* Cost Summary Footer */}
      {filteredBOMData.length > 0 && (
        <div className="p-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            원가 요약
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Material Cost */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">총 자재비</div>
              <div className="text-xl font-bold text-gray-600 dark:text-gray-400">
                ₩{formatCurrency(costSummary.total_material_cost)}
              </div>
            </div>

            {/* Total Scrap Revenue */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">총 스크랩금액</div>
              <div className="text-xl font-bold text-gray-600 dark:text-gray-400">
                ₩{formatCurrency(costSummary.total_scrap_revenue)}
              </div>
            </div>

            {/* Total Net Cost */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">순원가</div>
              <div className="text-xl font-bold text-gray-600 dark:text-gray-400">
                ₩{formatCurrency(costSummary.total_net_cost)}
              </div>
            </div>

            {/* Item Counts */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">품목 구성</div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">코일재:</span>
                <span className="font-medium text-gray-900 dark:text-white">{costSummary.coil_count}개</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">구매품:</span>
                <span className="font-medium text-gray-900 dark:text-white">{costSummary.purchased_count}개</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">전체:</span>
                <span className="text-gray-900 dark:text-white">{costSummary.total_items}개</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BOMViewer;
