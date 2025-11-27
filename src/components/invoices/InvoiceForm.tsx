'use client';

import { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import CompanySelect from '@/components/CompanySelect';
import InvoiceItemGrid, { type InvoiceItem } from '@/components/InvoiceItemGrid';
import PaymentSplitForm, { type PaymentSplit } from '@/components/PaymentSplitForm';

export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';

export interface Invoice {
  transaction_id?: number;
  transaction_date: string;
  transaction_no?: string;
  customer_id: number;
  total_amount: number;
  payment_method: string;
  payment_status?: PaymentStatus;
  payment_due_date?: string;
  notes?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  customer?: {
    company_id: number;
    company_name: string;
    company_code: string;
  };
  items?: Array<InvoiceItem & {
    invoice_item_id?: number;
    item_id?: number;
    item?: {
      item_code: string;
      item_name: string;
      unit?: string;
      spec?: string;
    };
  }>;
}

interface InvoiceFormProps {
  invoice: Invoice | null;
  onSave: (data: any) => void;
  onCancel: () => void;
}

interface FormData {
  transaction_date: string;
  customer_id: number | null;
  payment_status: PaymentStatus;
  payment_due_date: string;
  notes: string;
  items: InvoiceItem[];
  payment_splits: PaymentSplit[];
}

interface FormErrors {
  transaction_date?: string;
  customer_id?: string;
  items?: string;
  payment_splits?: string;
}

/**
 * 계산서 등록/수정 폼
 *
 * 기능:
 * - InvoiceItemGrid: 다중 품목 입력
 * - PaymentSplitForm: 복합 결제 입력
 * - 품목 총액 ↔ 결제 총액 일치 검증
 * - 고객사 선택 (CompanySelect)
 */
export default function InvoiceForm({ invoice, onSave, onCancel }: InvoiceFormProps) {
  const [formData, setFormData] = useState<FormData>({
    transaction_date: invoice?.transaction_date || new Date().toISOString().split('T')[0],
    customer_id: invoice?.customer_id || null,
    payment_status: invoice?.payment_status || 'PENDING',
    payment_due_date: invoice?.payment_due_date || '',
    notes: invoice?.notes || '',
    items: invoice?.items || [],
    payment_splits: []
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);

  // 품목 목록 조회
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch('/api/items?limit=1000');
        const result = await response.json();

        if (result.success) {
          setAvailableItems(result.data.items || []);
        }
      } catch (error) {
        console.error('Error fetching items:', error);
      }
    };

    fetchItems();
  }, []);

  // 품목 총액 계산
  useEffect(() => {
    const total = formData.items.reduce((sum, item) => sum + (item.total_amount || 0), 0);
    setItemsTotal(total);
  }, [formData.items]);

  // 품목 변경 핸들러
  const handleItemsChange = (items: InvoiceItem[]) => {
    setFormData(prev => ({
      ...prev,
      items
    }));
  };

  // 결제 분할 변경 핸들러
  const handlePaymentSplitsChange = (splits: PaymentSplit[]) => {
    setFormData(prev => ({
      ...prev,
      payment_splits: splits
    }));
  };

  // 입력 변경 핸들러
  const handleChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 검증
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.transaction_date) {
      newErrors.transaction_date = '거래일자는 필수입니다';
    }

    if (!formData.customer_id) {
      newErrors.customer_id = '고객사를 선택해주세요';
    }

    if (formData.items.length === 0) {
      newErrors.items = '최소 1개 이상의 품목을 추가해주세요';
    }

    // 품목 총액과 결제 분할 총액 일치 검증
    if (formData.payment_splits.length > 0) {
      const splitsTotal = formData.payment_splits.reduce((sum, s) => sum + (s.amount || 0), 0);
      if (Math.abs(itemsTotal - splitsTotal) >= 0.01) {
        newErrors.payment_splits = '결제 분할 금액 합계가 품목 총액과 일치하지 않습니다';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 제출
  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // payment_method 결정
      const payment_method = formData.payment_splits.length > 1 ? 'COMPOUND' :
                             formData.payment_splits.length === 1 ? formData.payment_splits[0].method :
                             'CASH';

      const submitData = {
        transaction_date: formData.transaction_date,
        customer_id: formData.customer_id,
        total_amount: itemsTotal,
        payment_method,
        payment_status: formData.payment_status,
        payment_due_date: formData.payment_due_date || null,
        notes: formData.notes || null,
        items: formData.items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_amount: item.total_amount,
          notes: item.notes || null
        })),
        payment_splits: formData.payment_splits.length > 0 ? formData.payment_splits : null
      };

      await onSave(submitData);
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 기본 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 거래일자 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            거래일자 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.transaction_date}
            onChange={(e) => handleChange('transaction_date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {errors.transaction_date && (
            <p className="mt-1 text-sm text-red-600">{errors.transaction_date}</p>
          )}
        </div>

        {/* 고객사 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            고객사 <span className="text-red-500">*</span>
          </label>
          <CompanySelect
            value={formData.customer_id}
            onChange={(companyId) => handleChange('customer_id', companyId)}
            companyType="CUSTOMER"
            placeholder="고객사를 선택하세요"
            error={errors.customer_id}
          />
        </div>

        {/* 결제 상태 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            결제 상태
          </label>
          <select
            value={formData.payment_status}
            onChange={(e) => handleChange('payment_status', e.target.value as PaymentStatus)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="PENDING">대기</option>
            <option value="PARTIAL">부분</option>
            <option value="COMPLETED">완료</option>
          </select>
        </div>

        {/* 지급 기한 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            지급 기한
          </label>
          <input
            type="date"
            value={formData.payment_due_date}
            onChange={(e) => handleChange('payment_due_date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 비고 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          비고
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="추가 메모 사항"
        />
      </div>

      {/* 품목 그리드 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          품목 내역 <span className="text-red-500">*</span>
        </label>
        <InvoiceItemGrid
          items={formData.items}
          onItemsChange={handleItemsChange}
          availableItems={availableItems}
        />
        {errors.items && (
          <p className="mt-2 text-sm text-red-600">{errors.items}</p>
        )}
      </div>

      {/* 품목 총액 표시 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            품목 총액
          </span>
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {itemsTotal.toLocaleString('ko-KR')}원
          </span>
        </div>
      </div>

      {/* 결제 분할 (옵션) */}
      {itemsTotal > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            결제 수단 분할 (선택사항)
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            복합 결제 시 결제 수단별 금액을 입력해주세요. 입력하지 않으면 단일 결제로 처리됩니다.
          </p>
          <PaymentSplitForm
            totalAmount={itemsTotal}
            onSplitsChange={handlePaymentSplitsChange}
            initialSplits={formData.payment_splits}
          />
          {errors.payment_splits && (
            <p className="mt-2 text-sm text-red-600">{errors.payment_splits}</p>
          )}
        </div>
      )}

      {/* 버튼 영역 */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="w-4 h-4" />
          취소
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || formData.items.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {isSubmitting ? '저장 중...' : (invoice ? '수정' : '등록')}
        </button>
      </div>
    </div>
  );
}
