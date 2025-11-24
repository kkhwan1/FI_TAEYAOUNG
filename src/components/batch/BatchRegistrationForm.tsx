'use client';

import { useState } from 'react';
import { Save, Loader2, Calendar, Plus, Trash2, Factory } from 'lucide-react';
import ItemSelect from '@/components/ItemSelect';
import { ItemForComponent as Item } from '@/types/inventory';
import { useToast } from '@/contexts/ToastContext';

interface BatchItem {
  item_id: number;
  item_type: 'INPUT' | 'OUTPUT';
  quantity: number;
  unit_price: number;
  defect_quantity?: number;
  notes?: string;
  // UI helper fields
  item_code?: string;
  item_name?: string;
  spec?: string;
  unit?: string;
}

interface BatchFormData {
  batch_date: string;
  notes: string;
  items: BatchItem[];
}

interface BatchRegistrationFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function BatchRegistrationForm({ onSuccess, onCancel }: BatchRegistrationFormProps) {
  const { success: showSuccess, error: showError } = useToast();
  const [formData, setFormData] = useState<BatchFormData>({
    batch_date: new Date().toISOString().split('T')[0],
    notes: '',
    items: [],
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          item_id: 0,
          item_type: 'INPUT',
          quantity: 0,
          unit_price: 0,
          defect_quantity: 0,
          notes: '',
        }
      ]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemSelect = (index: number, item: Item | null) => {
    if (item) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map((batchItem, i) =>
          i === index
            ? {
                ...batchItem,
                item_id: item.item_id || item.id || 0,
                item_code: item.item_code,
                item_name: item.item_name,
                spec: item.spec,
                unit: item.unit,
                unit_price: item.unit_price || item.price || 0,
              }
            : batchItem
        )
      }));
    }
  };

  const handleItemChange = (index: number, field: keyof BatchItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.batch_date) {
      newErrors.batch_date = '배치 날짜는 필수입니다';
    }

    if (formData.items.length === 0) {
      newErrors.items = '최소 1개 이상의 품목이 필요합니다';
    }

    // Validate each item
    formData.items.forEach((item, index) => {
      if (!item.item_id || item.item_id === 0) {
        newErrors[`item_${index}_id`] = '품목을 선택해주세요';
      }
      if (!item.quantity || item.quantity <= 0) {
        newErrors[`item_${index}_quantity`] = '수량은 0보다 커야 합니다';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    try {
      // Prepare items for API (remove UI helper fields)
      const apiItems = formData.items.map(item => ({
        item_id: item.item_id,
        item_type: item.item_type,
        quantity: item.quantity,
        unit_price: item.unit_price,
        defect_quantity: item.defect_quantity || 0,
        notes: item.notes || '',
      }));

      const response = await fetch('/api/batch-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          batch_date: formData.batch_date,
          notes: formData.notes,
          items: apiItems,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(result.error) || '배치 등록 실패');
      }

      showSuccess(`배치 등록 성공! 배치 번호: ${result.data.batch_number}`);

      // Reset form
      setFormData({
        batch_date: new Date().toISOString().split('T')[0],
        notes: '',
        items: [],
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('배치 등록 에러:', error);
      const { extractErrorMessage } = await import('@/lib/fetch-utils');
      showError(`배치 등록 실패: ${extractErrorMessage(error) || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Batch Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Batch Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-2" />
            배치 날짜 <span className="text-gray-600 dark:text-gray-400">*</span>
          </label>
          <input
            type="date"
            name="batch_date"
            value={formData.batch_date}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.batch_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
          />
          {errors.batch_date && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{errors.batch_date}</p>
          )}
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            메모
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="배치 관련 메모를 입력하세요"
          />
        </div>
      </div>

      {/* Items Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            <Factory className="w-5 h-5 inline mr-2" />
            투입/산출 품목
          </h3>
          <button
            type="button"
            onClick={handleAddItem}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors"
          >
            <Plus className="w-4 h-4" />
            품목 추가
          </button>
        </div>

        {errors.items && (
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{errors.items}</p>
        )}

        {formData.items.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">
              품목이 없습니다. "품목 추가" 버튼을 클릭하여 품목을 추가하세요.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {formData.items.map((item, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
              >
                <div className="flex items-start justify-between mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    품목 #{index + 1}
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Item Select */}
                  <div className="lg:col-span-3">
                    <ItemSelect
                      value={item.item_id > 0 ? item.item_id : undefined}
                      onChange={(selectedItem) => handleItemSelect(index, selectedItem)}
                      label="품목"
                      placeholder="품목 품번 또는 품명으로 검색..."
                      required={true}
                      error={errors[`item_${index}_id`]}
                      showPrice={true}
                    />
                  </div>

                  {/* Item Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      구분 <span className="text-gray-600 dark:text-gray-400">*</span>
                    </label>
                    <select
                      value={item.item_type}
                      onChange={(e) => handleItemChange(index, 'item_type', e.target.value as 'INPUT' | 'OUTPUT')}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="INPUT">투입 (INPUT)</option>
                      <option value="OUTPUT">산출 (OUTPUT)</option>
                    </select>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      수량 <span className="text-gray-600 dark:text-gray-400">*</span>
                    </label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors[`item_${index}_quantity`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                      }`}
                      placeholder="0"
                    />
                    {item.unit && (
                      <p className="mt-1 text-sm text-gray-500">단위: {item.unit}</p>
                    )}
                    {errors[`item_${index}_quantity`] && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{errors[`item_${index}_quantity`]}</p>
                    )}
                  </div>

                  {/* Unit Price */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      단가
                    </label>
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>

                  {/* Defect Quantity (only for OUTPUT) */}
                  {item.item_type === 'OUTPUT' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        불량 수량
                      </label>
                      <input
                        type="number"
                        value={item.defect_quantity || 0}
                        onChange={(e) => handleItemChange(index, 'defect_quantity', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                      {item.unit && (
                        <p className="mt-1 text-sm text-gray-500">불량품 수량</p>
                      )}
                    </div>
                  )}

                  {/* Item Notes */}
                  <div className={item.item_type === 'OUTPUT' ? 'lg:col-span-2' : 'lg:col-span-3'}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      품목 메모
                    </label>
                    <input
                      type="text"
                      value={item.notes || ''}
                      onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="품목별 메모"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              등록 중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              배치 등록
            </>
          )}
        </button>
      </div>
    </form>
  );
}
