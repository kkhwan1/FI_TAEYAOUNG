'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { Save, X } from 'lucide-react';

interface BOM {
  bom_id: number;
  child_item_id: number;
  child_item_code?: string;
  child_item_name?: string;
  quantity?: number;
  quantity_required?: number;
  notes?: string;
  child?: {
    price?: number | null;
    vehicle_model?: string | null;
    thickness?: number | null;
    width?: number | null;
    height?: number | null;
    material?: string | null;
  };
  child_item_data?: {
    price?: number | null;
    vehicle_model?: string | null;
    thickness?: number | null;
    width?: number | null;
    height?: number | null;
    material?: string | null;
  };
}

interface ChildItemEditModalProps {
  bom: BOM;
  onClose: () => void;
  onSave: (data: {
    quantity?: number;
    notes?: string;
    child_item_data?: {
      price?: number | null;
      vehicle_model?: string | null;
      thickness?: number | null;
      width?: number | null;
      height?: number | null;
      material?: string | null;
    };
  }) => Promise<void>;
}

export default function ChildItemEditModal({ bom, onClose, onSave }: ChildItemEditModalProps) {
  console.log('[ChildItemEditModal] 렌더링됨, bom:', bom);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    quantity: bom.quantity || bom.quantity_required || 1,
    notes: bom.notes || '',
    price: bom.child?.price || bom.child_item_data?.price || null,
    vehicle_model: bom.child?.vehicle_model || bom.child_item_data?.vehicle_model || '',
    thickness: bom.child?.thickness || bom.child_item_data?.thickness || null,
    width: bom.child?.width || bom.child_item_data?.width || null,
    height: bom.child?.height || bom.child_item_data?.height || null,
    material: bom.child?.material || bom.child_item_data?.material || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData: any = {
        quantity: formData.quantity,
        notes: formData.notes || null,
        child_item_data: {
          price: formData.price || null,
          vehicle_model: formData.vehicle_model || null,
          thickness: formData.thickness || null,
          width: formData.width || null,
          height: formData.height || null,
          material: formData.material || null,
        },
      };

      await onSave(updateData);
    } catch (error) {
      console.error('Failed to save child item details:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="자품목 상세 수정"
      size="lg"
      maxHeight="tall"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 자품목 정보 */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">자품목 정보</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">품번:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {bom.child_item_code || '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">품명:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {bom.child_item_name || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* BOM 정보 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              소요량 (U/S) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              비고
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="비고를 입력하세요"
            />
          </div>
        </div>

        {/* 자품목 상세 정보 */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">자품목 상세 정보</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                단가 (₩)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price || ''}
                onChange={(e) => setFormData({ ...formData, price: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="단가를 입력하세요"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                차종
              </label>
              <input
                type="text"
                value={formData.vehicle_model || ''}
                onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="차종을 입력하세요"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                두께 (mm)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.thickness || ''}
                onChange={(e) => setFormData({ ...formData, thickness: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="두께를 입력하세요"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                폭 (mm)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.width || ''}
                onChange={(e) => setFormData({ ...formData, width: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="폭을 입력하세요"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                높이 (mm)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.height || ''}
                onChange={(e) => setFormData({ ...formData, height: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="높이를 입력하세요"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                재질
              </label>
              <input
                type="text"
                value={formData.material || ''}
                onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="재질을 입력하세요"
              />
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                저장 중...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                저장
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

