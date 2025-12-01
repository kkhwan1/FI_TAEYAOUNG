'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, Package, Loader2, AlertCircle, Circle } from 'lucide-react';
import { useFontSize } from '@/contexts/FontSizeContext';

interface BOMTreeNode {
  bom_id: number;
  parent_item_id: number;
  parent_item_code: string;
  parent_item_name: string;
  child_item_id: number;
  child_item_code: string;
  child_item_name: string;
  child_spec: string;
  child_item_type: string;
  child_current_stock: number;
  child_unit_price: string;
  quantity_required: string;
  level_no: number;
  labor_cost: string;
  notes: string;
  level: number;
  depth: number;
  name_path: string[];
}

interface TreeNodeProps {
  node: BOMTreeNode;
  children: BOMTreeNode[];
  allNodes: BOMTreeNode[];  // T3: 전체 노드 목록 (재귀 탐색용)
  expandedNodes: Set<number>;
  onToggleExpand: (nodeId: number) => void;
}

// T4: 코일 연계 품목인지 확인하는 헬퍼 함수
function isCoilLinkedItem(itemType: string | null | undefined): boolean {
  if (!itemType) return false;
  const coilTypes = ['코일', 'COIL', '원자재', 'RAW', '판재', 'PLATE'];
  return coilTypes.some(type =>
    itemType.toUpperCase().includes(type.toUpperCase())
  );
}

function TreeNode({ node, children, allNodes, expandedNodes, onToggleExpand }: TreeNodeProps) {
  const { getFontSizeClasses } = useFontSize();
  const isExpanded = expandedNodes.has(node.child_item_id);
  const hasChildren = children.length > 0;
  const indentLevel = node.level - 1;

  // T4: 코일 연계 여부 확인
  const isCoilLinked = isCoilLinkedItem(node.child_item_type);

  return (
    <div className="tree-node">
      {/* Node content */}
      <div
        className={`
          flex items-center gap-2 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700/50
          border-b border-gray-200 dark:border-gray-700
          transition-colors duration-150
        `}
        style={{ paddingLeft: `${indentLevel * 24 + 12}px` }}
      >
        {/* Expand/Collapse button */}
        {hasChildren ? (
          <button
            onClick={() => onToggleExpand(node.child_item_id)}
            className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            aria-label={isExpanded ? '접기' : '펼치기'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        ) : (
          <div className="w-6 flex-shrink-0" />
        )}

        {/* Item icon */}
        <Package className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />

        {/* Item code */}
        <div className="min-w-[120px]">
          <span className={`${getFontSizeClasses('table')} font-semibold text-gray-900 dark:text-white`}>
            {node.child_item_code}
          </span>
        </div>

        {/* Item name + T4: 코일 연계 뱃지 */}
        <div className="flex-1 min-w-[200px] flex items-center gap-2">
          <span className={`${getFontSizeClasses('table')} text-gray-700 dark:text-gray-300`}>
            {node.child_item_name || node.child_item_code || '(품명 없음)'}
          </span>
          {isCoilLinked && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
              <Circle className="w-2.5 h-2.5 fill-current" />
              코일
            </span>
          )}
        </div>

        {/* Spec */}
        {node.child_spec && (
          <div className="min-w-[120px]">
            <span className={`${getFontSizeClasses('table')} text-gray-600 dark:text-gray-400`}>
              {node.child_spec}
            </span>
          </div>
        )}

        {/* Quantity required */}
        <div className="min-w-[100px] text-right">
          <span className={`${getFontSizeClasses('table')} font-medium text-gray-900 dark:text-white`}>
            {parseFloat(node.quantity_required).toLocaleString('ko-KR')}
          </span>
        </div>

        {/* Current stock */}
        <div className="min-w-[100px] text-right">
          <span className={`${getFontSizeClasses('table')} text-gray-600 dark:text-gray-400`}>
            {node.child_current_stock.toLocaleString('ko-KR')}
          </span>
        </div>

        {/* Level indicator */}
        <div className="min-w-[60px] text-center">
          <span className={`
            ${getFontSizeClasses('table')} px-2 py-0.5 rounded-full text-xs font-medium
            ${node.level === 1 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : ''}
            ${node.level === 2 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}
            ${node.level >= 3 ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' : ''}
          `}>
            L{node.level}
          </span>
        </div>
      </div>

      {/* Render children recursively */}
      {hasChildren && isExpanded && (
        <div className="children">
          {children.map(child => {
            // T3: 전체 노드 목록에서 손자 노드 찾기 (2레벨 이상 재귀 수정)
            const grandChildren = allNodes.filter(n => n.parent_item_id === child.child_item_id);
            return (
              <TreeNode
                key={child.bom_id}
                node={child}
                children={grandChildren}
                allNodes={allNodes}
                expandedNodes={expandedNodes}
                onToggleExpand={onToggleExpand}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface BOMTreeViewProps {
  className?: string;
}

export default function BOMTreeView({ className = '' }: BOMTreeViewProps) {
  const { getFontSizeClasses } = useFontSize();
  const [treeData, setTreeData] = useState<BOMTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  // Load expansion state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bom-tree-expanded-nodes');
      if (saved) {
        const parsed = JSON.parse(saved);
        setExpandedNodes(new Set(parsed));
      }
    } catch (err) {
      console.error('Failed to load expansion state:', err);
    }
  }, []);

  // Save expansion state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('bom-tree-expanded-nodes', JSON.stringify(Array.from(expandedNodes)));
    } catch (err) {
      console.error('Failed to save expansion state:', err);
    }
  }, [expandedNodes]);

  // Fetch BOM tree data
  useEffect(() => {
    const fetchTreeData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/bom/full-tree');
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'BOM ?�리 ?�이?��? 불러?�는???�패?�습?�다');
        }

        setTreeData(result.data || []);
      } catch (err) {
        console.error('Failed to fetch BOM tree:', err);
        setError(err instanceof Error ? err.message : '?????�는 ?�류가 발생?�습?�다');
      } finally {
        setLoading(false);
      }
    };

    fetchTreeData();
  }, []);

  const handleToggleExpand = useCallback((nodeId: number) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const allNodeIds = new Set(treeData.map(node => node.child_item_id));
    setExpandedNodes(allNodeIds);
  }, [treeData]);

  const handleCollapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  // Build tree structure (root nodes)
  const rootNodes = treeData.filter(node => node.level === 1);

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400">BOM ?�리 ?�이?��? 불러?�는 �?..</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (treeData.length === 0) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400">?�록??BOM ?�이?��? ?�습?�다</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bom-tree-view ${className}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-4 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <span className={`${getFontSizeClasses('table')} font-semibold text-gray-900 dark:text-white`}>
            BOM 계층 구조
          </span>
          <span className={`${getFontSizeClasses('table')} text-gray-600 dark:text-gray-400`}>
            ({rootNodes.length}�??�목)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExpandAll}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            모두 ?�치�?          </button>
          <button
            onClick={handleCollapseAll}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            모두 ?�기
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b-2 border-gray-300 dark:border-gray-600">
        <div className="w-6 flex-shrink-0" />
        <Package className="w-4 h-4 flex-shrink-0 opacity-0" />
        <div className="min-w-[120px]">
          <span className={`${getFontSizeClasses('table')} font-semibold text-gray-700 dark:text-gray-300`}>
            ?�목코드
          </span>
        </div>
        <div className="flex-1 min-w-[200px]">
          <span className={`${getFontSizeClasses('table')} font-semibold text-gray-700 dark:text-gray-300`}>
            ?�목�?          </span>
        </div>
        <div className="min-w-[120px]">
          <span className={`${getFontSizeClasses('table')} font-semibold text-gray-700 dark:text-gray-300`}>
            규격
          </span>
        </div>
        <div className="min-w-[100px] text-right">
          <span className={`${getFontSizeClasses('table')} font-semibold text-gray-700 dark:text-gray-300`}>
            ?�요??          </span>
        </div>
        <div className="min-w-[100px] text-right">
          <span className={`${getFontSizeClasses('table')} font-semibold text-gray-700 dark:text-gray-300`}>
            ?�고
          </span>
        </div>
        <div className="min-w-[60px] text-center">
          <span className={`${getFontSizeClasses('table')} font-semibold text-gray-700 dark:text-gray-300`}>
            ?�벨
          </span>
        </div>
      </div>

      {/* Tree structure */}
      <div className="tree-container bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-b-lg overflow-auto max-h-[600px]">
        {rootNodes.map(rootNode => {
          const children = treeData.filter(node => node.parent_item_id === rootNode.child_item_id);
          return (
            <TreeNode
              key={rootNode.bom_id}
              node={rootNode}
              children={children}
              allNodes={treeData}
              expandedNodes={expandedNodes}
              onToggleExpand={handleToggleExpand}
            />
          );
        })}
      </div>
    </div>
  );
}

