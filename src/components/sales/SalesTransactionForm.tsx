'use client';

import { useState, useEffect } from 'react';
import {
  Save,
  Loader2,
  Calendar,
  Building2,
  Hash
} from 'lucide-react';
import CompanySelect from '@/components/CompanySelect';
import InvoiceItemGrid, { type InvoiceItem } from '@/components/InvoiceItemGrid';
import PaymentSplitForm, { type PaymentSplit } from '@/components/PaymentSplitForm';

type PaymentStatus = 'PENDING' | 'PARTIAL' | 'COMPLETE';

type SalesTransaction = {
  transaction_id: number;
  transaction_date: string;
  transaction_no: string;
  customer_id: number;
  item_id: number;
  item_name: string;
  spec?: string;
  quantity: number;
  unit_price: number;
  supply_amount: number;
  tax_amount?: number;
  total_amount: number;
  payment_status?: PaymentStatus;
  payment_due_date?: string;
  notes?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  customer?: {
    company_id: number;
    company_name: string;
    company_code: string;
  };
  item?: {
    item_id: number;
    item_name: string;
    item_code: string;
  };
};

interface SalesTransactionFormProps {
  transaction?: SalesTransaction | null;
  onSave: (data: Partial<SalesTransaction>) => Promise<void>;
  onCancel: () => void;
}

export default function SalesTransactionForm({ transaction, onSave, onCancel }: SalesTransactionFormProps) {
  const [formData, setFormData] = useState<Partial<SalesTransaction>>({
    transaction_date: new Date().toISOString().split('T')[0],
    customer_id: undefined,
    supply_amount: 0,
    tax_amount: 0,
    total_amount: 0,
    payment_due_date: '',
    notes: '',
    is_active: true
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Phase 2: Multi-item invoice and payment splits
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [availableItems, setAvailableItems] = useState<any[]>([]);

  // 품목 목록 조회
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch('/api/items?limit=1000');
        const result = await response.json();

        if (result.success) {
          // InvoiceItemGrid에서 필요한 형식으로 변환
          const items = (result.data?.items || []).map((item: any) => ({
            item_id: item.item_id,
            item_code: item.item_code || '',
            item_name: item.item_name || '',
            unit: item.unit || '',
            spec: item.spec || '',
            price: item.unit_price || item.price || 0
          }));
          setAvailableItems(items);
        }
      } catch (error) {
        console.error('Error fetching items:', error);
      }
    };

    fetchItems();
  }, []);

  useEffect(() => {
    if (transaction) {
      setFormData({
        ...transaction,
        transaction_date: transaction.transaction_date || new Date().toISOString().split('T')[0],
        payment_due_date: transaction.payment_due_date || '',
        notes: transaction.notes || ''
      });

      // Phase 2: Load existing invoice items and payment splits
      if ((transaction as any).invoice_items && Array.isArray((transaction as any).invoice_items)) {
        setInvoiceItems((transaction as any).invoice_items);
      }
      if ((transaction as any).payment_splits && Array.isArray((transaction as any).payment_splits)) {
        setPaymentSplits((transaction as any).payment_splits);
      }
    }
  }, [transaction]);

  // Phase 2: 금액 계산 - 다중 품목 합계
  useEffect(() => {
    const supplyAmount = invoiceItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);
    const taxAmount = supplyAmount * 0.1; // 10% 부가세
    const totalAmount = supplyAmount + taxAmount;

    setFormData(prev => ({
      ...prev,
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount
    }));
  }, [invoiceItems]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value ? parseFloat(value) : 0) : value
    }));

    // Clear error when field is modified
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleCustomerChange = (customerId: number | null) => {
    setFormData(prev => ({ ...prev, customer_id: customerId || undefined }));
    if (errors.customer_id) {
      setErrors(prev => ({ ...prev, customer_id: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.transaction_date) {
      newErrors.transaction_date = '거래일자는 필수입니다';
    }

    if (!formData.customer_id) {
      newErrors.customer_id = '고객사를 선택해주세요';
    }

    // Phase 2: 다중 품목 검증
    if (invoiceItems.length === 0) {
      newErrors.items = '최소 1개 이상의 품목을 추가해주세요';
    }

    // Phase 2: 결제 분할 검증
    if (paymentSplits.length === 0) {
      newErrors.payments = '결제 정보를 입력해주세요';
    } else {
      const paymentTotal = paymentSplits.reduce((sum, p) => sum + (p.amount || 0), 0);
      if (Math.abs(paymentTotal - (formData.total_amount || 0)) > 0.01) {
        newErrors.payments = `결제 금액 합계(${paymentTotal.toLocaleString('ko-KR')}원)가 총액(${(formData.total_amount || 0).toLocaleString('ko-KR')}원)과 일치하지 않습니다`;
      }
    }

    if (formData.payment_due_date && formData.transaction_date &&
        formData.payment_due_date < formData.transaction_date) {
      newErrors.payment_due_date = '납기일은 거래일자 이후여야 합니다';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Phase 2: 기본 거래 정보 (단일 품목 필드 제거)
      const {
        transaction_no,
        customer,
        item,
        created_at,
        updated_at,
        item_id,
        item_name,
        spec,
        quantity,
        unit_price,
        payment_status,
        ...dataToSave
      } = formData as any;

      // 빈 문자열과 null 값을 undefined로 변환
      Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key] === '' || dataToSave[key] === null) {
          dataToSave[key] = undefined;
        }
      });

      // Phase 2: invoice_items와 payment_splits 추가
      const completeData = {
        ...dataToSave,
        invoice_items: invoiceItems,
        payment_splits: paymentSplits
      };

      await onSave(completeData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 거래일자 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-2" />
            거래일자 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="transaction_date"
            value={formData.transaction_date}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.transaction_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            required
          />
          {errors.transaction_date && (
            <p className="mt-1 text-sm text-red-500">{errors.transaction_date}</p>
          )}
        </div>

        {/* 고객사 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Building2 className="w-4 h-4 inline mr-2" />
            고객사 <span className="text-red-500">*</span>
          </label>
          <CompanySelect
            value={formData.customer_id}
            onChange={handleCustomerChange}
            companyType="CUSTOMER"
            placeholder="고객사를 선택하세요"
            required={true}
            error={errors.customer_id}
          />
        </div>

        {/* Phase 2: 품목 그리드 (다중 품목 지원) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            품목 <span className="text-red-500">*</span>
          </label>
          <InvoiceItemGrid
            items={invoiceItems}
            onItemsChange={setInvoiceItems}
            readOnly={false}
            availableItems={availableItems}
          />
          {errors.items && (
            <p className="mt-1 text-sm text-red-500">{errors.items}</p>
          )}
        </div>

        {/* 공급가액 (자동 계산) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            공급가액
          </label>
          <input
            type="text"
            value={`₩ ${(formData.supply_amount || 0).toLocaleString()}`}
            disabled
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          />
        </div>

        {/* 세액 (자동 계산) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            세액 (10%)
          </label>
          <input
            type="text"
            value={`₩ ${(formData.tax_amount || 0).toLocaleString()}`}
            disabled
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          />
        </div>

        {/* 총액 (자동 계산) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            총액
          </label>
          <input
            type="text"
            value={`₩ ${(formData.total_amount || 0).toLocaleString()}`}
            disabled
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold"
          />
        </div>

        {/* Phase 2: 복합 결제 입력 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            결제 정보 <span className="text-red-500">*</span>
          </label>
          <PaymentSplitForm
            totalAmount={formData.total_amount || 0}
            onSplitsChange={setPaymentSplits}
            readOnly={false}
            initialSplits={paymentSplits.length > 0 ? paymentSplits : undefined}
          />
          {errors.payments && (
            <p className="mt-1 text-sm text-red-500">{errors.payments}</p>
          )}
        </div>

        {/* 납기일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            납기일
          </label>
          <input
            type="date"
            name="payment_due_date"
            value={formData.payment_due_date}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.payment_due_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {errors.payment_due_date && (
            <p className="mt-1 text-sm text-red-500">{errors.payment_due_date}</p>
          )}
        </div>


        {/* 비고 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            비고
          </label>
          <textarea
            name="notes"
            value={formData.notes ?? ''}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="매출 관련 특이사항이나 메모를 입력하세요"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {transaction ? '수정' : '등록'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}