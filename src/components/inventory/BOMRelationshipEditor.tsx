'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle, Check, X, Edit2, Loader2 } from 'lucide-react';
import CompanySelect from '@/components/CompanySelect';
import { useBOMRelationship, BOMEntry } from '@/hooks/useBOMRelationship';

/**
 * BOMRelationshipEditor Props
 */
export interface BOMRelationshipEditorProps {
  // 품목 정보
  itemId: number | null;
  itemCode?: string;
  itemName?: string;

  // 관계 정보
  mode: 'receiving' | 'production' | 'shipping';
  expectedCompanyId: number | null;
  expectedCompanyName?: string;

  // 콜백
  onUpdate?: (bomId: number, newCompanyId: number) => void;
  onDismiss?: () => void;

  // 스타일
  className?: string;
}

/**
 * BOM 관계 인라인 편집 컴포넌트
 *
 * 거래처-품목 연결이 BOM과 일치하지 않을 때 경고를 표시하고
 * 인라인으로 BOM 관계를 수정할 수 있게 합니다.
 *
 * @example
 * // 입고 탭에서 공급사 관계 수정
 * <BOMRelationshipEditor
 *   itemId={selectedItemId}
 *   itemCode="ABC-001"
 *   itemName="시트블랭킹 A"
 *   mode="receiving"
 *   expectedCompanyId={selectedSupplierId}
 *   expectedCompanyName="현대글로벌"
 *   onUpdate={(bomId, newCompanyId) => refetchItems()}
 * />
 */
export default function BOMRelationshipEditor({
  itemId,
  itemCode,
  itemName,
  mode,
  expectedCompanyId,
  expectedCompanyName,
  onUpdate,
  onDismiss,
  className = ''
}: BOMRelationshipEditorProps) {
  // 편집 모드 상태
  const [isEditing, setIsEditing] = useState(false);
  const [selectedNewCompanyId, setSelectedNewCompanyId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 모드에 따른 관계 타입 결정
  const companyType = mode === 'receiving' ? 'supplier' : 'customer';
  const companyField = mode === 'receiving' ? 'child_supplier_id' : 'customer_id';
  const companyTypeLabel = mode === 'receiving' ? '공급사' : '고객사';

  // BOM 관계 훅 사용
  const {
    bomEntries,
    isLoading,
    hasMismatch,
    mismatchInfo,
    updateRelationship
  } = useBOMRelationship({
    itemId,
    role: 'child',
    expectedCompanyId,
    companyType,
    enabled: !!itemId && !!expectedCompanyId
  });

  // 저장 핸들러
  const handleSave = useCallback(async () => {
    if (!selectedNewCompanyId || bomEntries.length === 0) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // 모든 관련 BOM 항목 업데이트
      for (const entry of bomEntries) {
        const success = await updateRelationship(
          entry.bom_id,
          companyField as 'customer_id' | 'child_supplier_id',
          selectedNewCompanyId
        );

        if (!success) {
          throw new Error('BOM 업데이트에 실패했습니다');
        }
      }

      setIsEditing(false);
      setSelectedNewCompanyId(null);
      onUpdate?.(bomEntries[0].bom_id, selectedNewCompanyId);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'BOM 업데이트에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  }, [selectedNewCompanyId, bomEntries, updateRelationship, companyField, onUpdate]);

  // 취소 핸들러
  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setSelectedNewCompanyId(null);
    setSaveError(null);
  }, []);

  // 무시 핸들러
  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  // 로딩 중
  if (isLoading) {
    return null; // 로딩 중에는 아무것도 표시하지 않음
  }

  // 불일치가 없으면 아무것도 표시하지 않음
  if (!hasMismatch || !mismatchInfo) {
    return null;
  }

  // 편집 모드
  if (isEditing) {
    return (
      <div className={`bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3 ${className}`}>
        <div className="flex flex-col gap-3">
          <div className="text-sm text-gray-800 dark:text-gray-200">
            <span className="font-medium">{companyTypeLabel} 변경:</span>
            {' '}
            <span className="text-gray-600 dark:text-gray-400">
              {mismatchInfo.currentCompanyName || '없음'}
            </span>
            {' → '}
            <span className="font-medium">{expectedCompanyName || '선택된 거래처'}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <CompanySelect
                value={selectedNewCompanyId}
                onChange={(companyId) => setSelectedNewCompanyId(companyId)}
                companyType={mode === 'receiving' ? 'SUPPLIER' : 'CUSTOMER'}
                placeholder={`새 ${companyTypeLabel} 선택...`}
                disabled={isSaving}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={!selectedNewCompanyId || isSaving}
              className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="저장"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Check className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
              title="취소"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {saveError && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {saveError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 경고 모드 (불일치 감지됨)
  return (
    <div className={`bg-gray-100 dark:bg-gray-800 border border-dashed border-gray-400 dark:border-gray-500 rounded-lg p-3 ${className}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-800 dark:text-gray-200">
            <span className="font-medium">{companyTypeLabel} 불일치:</span>
            {' '}
            {itemCode && (
              <span className="text-gray-600 dark:text-gray-400">
                [{itemCode}]
              </span>
            )}
            {' '}
            {itemName && (
              <span className="text-gray-700 dark:text-gray-300">
                {itemName}
              </span>
            )}
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            현재: <span className="font-medium">{mismatchInfo.currentCompanyName || '없음'}</span>
            {' → '}
            선택: <span className="font-medium">{expectedCompanyName || '선택된 거래처'}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md transition-colors flex items-center gap-1"
          >
            <Edit2 className="w-3.5 h-3.5" />
            연결 수정
          </button>

          {onDismiss && (
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              무시
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
