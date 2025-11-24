'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Calendar } from 'lucide-react';
import type { CreateCoilProcessRequest } from '@/types/coil';
import Modal from '@/components/Modal';
import ItemSelect from '@/components/ItemSelect';
import { useToast } from '@/contexts/ToastContext';

interface CoilProcessFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function CoilProcessForm({ onSuccess, onCancel }: CoilProcessFormProps) {
  const router = useRouter();

  const [formData, setFormData] = useState<CreateCoilProcessRequest>({
    source_item_id: 0,
    process_type: '블랭킹',
    target_item_id: 0,
    input_quantity: 0,
    output_quantity: 0,
    process_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [sourceItem, setSourceItem] = useState<any>(null);
  const [targetItem, setTargetItem] = useState<any>(null);
  const [yieldRate, setYieldRate] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [showYieldWarning, setShowYieldWarning] = useState(false);
  const { success, error: showError } = useToast();

  // 수율 자동 계산
  useEffect(() => {
    if (formData.input_quantity > 0 && formData.output_quantity >= 0) {
      const rate = (formData.output_quantity / formData.input_quantity) * 100;
      setYieldRate(Math.round(rate * 100) / 100);
    } else {
      setYieldRate(0);
    }
  }, [formData.input_quantity, formData.output_quantity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 클라이언트 측 검증
    if (!sourceItem) {
      setError('투입 코일을 선택해주세요.');
      return;
    }

    if (sourceItem.inventory_type !== '코일') {
      setError('소스 품목은 반드시 코일 타입이어야 합니다.');
      return;
    }

    if (!targetItem) {
      setError('산출 품목을 선택해주세요.');
      return;
    }

    if (formData.input_quantity <= 0) {
      setError('투입 수량은 0보다 커야 합니다.');
      return;
    }

    if (formData.output_quantity < 0) {
      setError('산출 수량은 0 이상이어야 합니다.');
      return;
    }

    if (yieldRate > 100) {
      setShowYieldWarning(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/coil/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(result.error) || '공정 등록에 실패했습니다.');
      }

      success('등록 완료', '공정이 성공적으로 등록되었습니다.');

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/process/coil-tracking');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleYieldConfirm = () => {
    setShowYieldWarning(false);
    setIsSubmitting(true);

    fetch('/api/coil/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(formData)
    })
      .then(res => res.json())
      .then(result => {
        if (!result.success) {
          const { extractErrorMessage } = await import('@/lib/fetch-utils');
          throw new Error(extractErrorMessage(result.error) || '공정 등록에 실패했습니다.');
        }

        success('등록 완료', '공정이 성공적으로 등록되었습니다.');

        if (onSuccess) {
          onSuccess();
        } else {
          router.push('/process/coil-tracking');
        }
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-200 px-4 py-3 rounded flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 공정 유형 */}
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
          공정 유형 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <select
          value={formData.process_type}
          onChange={(e) => setFormData({ ...formData, process_type: e.target.value })}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          required
        >
          <option value="블랭킹">블랭킹</option>
          <option value="전단">전단</option>
          <option value="절곡">절곡</option>
          <option value="용접">용접</option>
        </select>
      </div>

      {/* 투입 코일 선택 */}
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
          투입 코일 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <div className="space-y-2">
          <ItemSelect
            value={formData.source_item_id || null}
            onChange={(item) => {
              if (!item) {
                setSourceItem(null);
                setFormData({ ...formData, source_item_id: 0 });
                return;
              }
              if (item.inventory_type !== '코일') {
                showError('선택 오류', '코일 타입 품목만 선택 가능합니다.');
                return;
              }
              setSourceItem(item);
              setFormData({ ...formData, source_item_id: item.item_id });
            }}
            placeholder="코일 품목을 선택하세요"
            showPrice={true}
            required
          />
          {sourceItem && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              재고: {sourceItem.current_stock?.toLocaleString() || 0} {sourceItem.unit || 'kg'}
            </div>
          )}
        </div>
      </div>

      {/* 산출 품목 선택 */}
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
          산출 품목 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <ItemSelect
          value={formData.target_item_id || null}
          onChange={(item) => {
            if (!item) {
              setTargetItem(null);
              setFormData({ ...formData, target_item_id: 0 });
              return;
            }
            setTargetItem(item);
            setFormData({ ...formData, target_item_id: item.item_id });
          }}
          placeholder="산출 품목을 선택하세요"
          showPrice={true}
          required
        />
      </div>

      {/* 수량 입력 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
            투입 수량 <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={formData.input_quantity || ''}
            onChange={(e) => setFormData({ ...formData, input_quantity: parseFloat(e.target.value) || 0 })}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            단위: {sourceItem?.unit || 'kg'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
            산출 수량 <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.output_quantity || ''}
            onChange={(e) => setFormData({ ...formData, output_quantity: parseFloat(e.target.value) || 0 })}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            단위: {targetItem?.unit || 'kg'}
          </p>
        </div>
      </div>

      {/* 수율 자동 계산 표시 */}
      {formData.input_quantity > 0 && (
        <div className={`p-4 rounded-lg border-2 ${
          yieldRate > 100 ? 'bg-yellow-50 dark:bg-yellow-900 border-yellow-300 dark:border-yellow-700' : 'bg-blue-50 dark:bg-blue-900 border-blue-300 dark:border-blue-700'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">예상 수율:</span>
            <span className={`text-lg font-bold ${
              yieldRate >= 95 ? 'text-green-600 dark:text-green-400' :
              yieldRate >= 90 ? 'text-yellow-600 dark:text-yellow-400' :
              'text-red-600 dark:text-red-400'
            }`}>
              {yieldRate.toFixed(2)}%
            </span>
          </div>
          {yieldRate > 100 && (
            <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
              <span>수율이 100%를 초과했습니다. 입력값을 확인해주세요.</span>
            </div>
          )}
        </div>
      )}

      {/* 공정 일자 */}
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
          공정 일자 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
          <input
            type="date"
            value={formData.process_date}
            onChange={(e) => setFormData({ ...formData, process_date: e.target.value })}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            required
          />
        </div>
      </div>

      {/* 비고 */}
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">비고</label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          placeholder="공정에 대한 추가 정보를 입력하세요"
        />
      </div>

      {/* 버튼 */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 dark:bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? '등록 중...' : '공정 등록'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="sm:flex-none px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          취소
        </button>
      </div>

      {/* Yield Warning Modal */}
      <Modal
        isOpen={showYieldWarning}
        onClose={() => setShowYieldWarning(false)}
        title="수율 경고"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-500 dark:text-yellow-400 flex-shrink-0 mt-1" />
            <div>
              <p className="text-gray-900 dark:text-gray-100">
                수율이 100%를 초과했습니다 ({yieldRate.toFixed(2)}%).
              </p>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                정말로 등록하시겠습니까?
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowYieldWarning(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleYieldConfirm}
              className="px-4 py-2 bg-yellow-600 dark:bg-yellow-500 text-white rounded-md hover:bg-yellow-700 dark:hover:bg-yellow-600"
            >
              확인
            </button>
          </div>
        </div>
      </Modal>
    </form>
  );
}
