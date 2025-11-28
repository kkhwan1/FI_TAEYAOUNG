'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';

interface ItemEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: number;
  onItemUpdated?: () => void;
}

interface ItemData {
  item_id: number;
  item_code: string;
  item_name: string;
  item_type: string | null;
  vehicle_model: string | null;
  spec: string | null;
  unit: string | null;
  current_stock: number;
  safety_stock: number | null;
  price: number | null;
  location: string | null;
  description: string | null;
  category: string | null;
  material_type: string | null;
  material: string | null;
  thickness: number | null;
  width: number | null;
  height: number | null;
  specific_gravity: number | null;
  mm_weight: number | null;
  coating_status: string | null;
  scrap_rate: number | null;
  scrap_unit_price: number | null;
  yield_rate: number | null;
  overhead_rate: number | null;
}

export const ItemEditModal: React.FC<ItemEditModalProps> = ({
  isOpen,
  onClose,
  itemId,
  onItemUpdated
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itemData, setItemData] = useState<ItemData | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !saving) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, saving, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen && !loading && itemData && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [isOpen, loading, itemData]);

  useEffect(() => {
    if (isOpen && itemId) {
      fetchItemData();
    }
  }, [isOpen, itemId]);

  const fetchItemData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/items/${itemId}`);
      if (!response.ok) {
        throw new Error('품목 정보를 가져오는데 실패했습니다');
      }
      const result = await response.json();
      setItemData(result.data);
    } catch (error) {
      console.error('품목 데이터 조회 실패:', error);
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
      toast.error('품목 정보 조회 실패', errorMsg);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!itemData) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(itemData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '품목 수정에 실패했습니다');
      }

      toast.success('품목 수정 완료', '품목 정보가 성공적으로 수정되었습니다');

      onItemUpdated?.();
      onClose();
    } catch (error) {
      console.error('품목 수정 실패:', error);
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
      toast.error('품목 수정 실패', errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = useCallback(<K extends keyof ItemData>(
    field: K,
    value: ItemData[K]
  ) => {
    if (!itemData) return;
    setItemData({ ...itemData, [field]: value });
  }, [itemData]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-edit-modal-title"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 id="item-edit-modal-title" className="text-xl font-semibold text-gray-900 dark:text-white">
            품목 수정
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : itemData ? (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">기본 정보</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      품목코드
                    </label>
                    <input
                      ref={firstInputRef}
                      type="text"
                      value={itemData.item_code}
                      onChange={(e) => handleInputChange('item_code', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      품명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={itemData.item_name}
                      onChange={(e) => handleInputChange('item_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      품목유형
                    </label>
                    <select
                      value={itemData.item_type || ''}
                      onChange={(e) => handleInputChange('item_type', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">선택</option>
                      <option value="제품">제품</option>
                      <option value="반제품">반제품</option>
                      <option value="원재료">원재료</option>
                      <option value="부재료">부재료</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      차종
                    </label>
                    <input
                      type="text"
                      value={itemData.vehicle_model || ''}
                      onChange={(e) => handleInputChange('vehicle_model', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      규격
                    </label>
                    <input
                      type="text"
                      value={itemData.spec || ''}
                      onChange={(e) => handleInputChange('spec', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      단위 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={itemData.unit || ''}
                      onChange={(e) => handleInputChange('unit', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 재고 정보 */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">재고 정보</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      현재고
                    </label>
                    <input
                      type="number"
                      value={itemData.current_stock}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      안전재고
                    </label>
                    <input
                      type="number"
                      value={itemData.safety_stock || ''}
                      onChange={(e) => handleInputChange('safety_stock', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      단가
                    </label>
                    <input
                      type="number"
                      value={itemData.price || ''}
                      onChange={(e) => handleInputChange('price', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      보관위치
                    </label>
                    <input
                      type="text"
                      value={itemData.location || ''}
                      onChange={(e) => handleInputChange('location', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 재질 정보 */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">재질 정보</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      분류
                    </label>
                    <input
                      type="text"
                      value={itemData.category || ''}
                      onChange={(e) => handleInputChange('category', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      재질유형
                    </label>
                    <input
                      type="text"
                      value={itemData.material_type || ''}
                      onChange={(e) => handleInputChange('material_type', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      재질
                    </label>
                    <input
                      type="text"
                      value={itemData.material || ''}
                      onChange={(e) => handleInputChange('material', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      두께 (mm)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={itemData.thickness || ''}
                      onChange={(e) => handleInputChange('thickness', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      폭 (mm)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={itemData.width || ''}
                      onChange={(e) => handleInputChange('width', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      높이 (mm)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={itemData.height || ''}
                      onChange={(e) => handleInputChange('height', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 원가 정보 */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">원가 정보</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      비중
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={itemData.specific_gravity || ''}
                      onChange={(e) => handleInputChange('specific_gravity', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      mm중량 (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={itemData.mm_weight || ''}
                      onChange={(e) => handleInputChange('mm_weight', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      도장여부
                    </label>
                    <input
                      type="text"
                      value={itemData.coating_status || ''}
                      onChange={(e) => handleInputChange('coating_status', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      스크랩률 (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={itemData.scrap_rate || ''}
                      onChange={(e) => handleInputChange('scrap_rate', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      스크랩단가
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={itemData.scrap_unit_price || ''}
                      onChange={(e) => handleInputChange('scrap_unit_price', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      수율 (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={itemData.yield_rate || ''}
                      onChange={(e) => handleInputChange('yield_rate', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      경비율 (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={itemData.overhead_rate || ''}
                      onChange={(e) => handleInputChange('overhead_rate', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 비고 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  비고
                </label>
                <textarea
                  value={itemData.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value || null)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !itemData?.item_name || !itemData?.unit}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            저장
          </button>
        </div>
      </div>
    </div>
  );
};
