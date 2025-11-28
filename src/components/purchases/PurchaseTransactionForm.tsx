'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Building2,
  Hash,
  Loader2,
  Save
} from 'lucide-react';
import CompanySelect from '@/components/CompanySelect';

type PaymentStatus = 'PENDING' | 'PARTIAL' | 'COMPLETE';

type PurchaseTransaction = {
  transaction_id?: number;
  transaction_date: string;
  transaction_no?: string;
  supplier_id: number;
  item_id: number;
  item_name?: string;
  spec?: string;
  vehicle_model?: string;
  quantity: number;
  unit_price: number;
  supply_amount?: number;
  tax_amount?: number;
  total_amount?: number;
  payment_status?: PaymentStatus;
  payment_due_date?: string;
  notes?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  supplier?: {
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

interface PurchaseTransactionFormProps {
  transaction: PurchaseTransaction | null;
  onSave: (data: Partial<PurchaseTransaction>) => Promise<void>;
  onCancel: () => void;
}

const PAYMENT_STATUS_OPTIONS = [
  { value: 'PENDING', label: '대기' },
  { value: 'PARTIAL', label: '부분' },
  { value: 'COMPLETE', label: '완료' }
];

export default function PurchaseTransactionForm({ transaction, onSave, onCancel }: PurchaseTransactionFormProps) {
  const [formData, setFormData] = useState<Partial<PurchaseTransaction>>({
    transaction_date: new Date().toISOString().split('T')[0],
    supplier_id: undefined,
    item_id: undefined,
    item_name: '',
    spec: '',
    vehicle_model: '',
    quantity: 1,
    unit_price: 0,
    supply_amount: 0,
    tax_amount: 0,
    total_amount: 0,
    payment_status: 'PENDING',
    payment_due_date: '',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form with transaction data if editing
  useEffect(() => {
    if (transaction) {
      setFormData({
        transaction_date: transaction.transaction_date,
        supplier_id: transaction.supplier_id,
        item_id: transaction.item_id,
        item_name: transaction.item_name || '',
        spec: transaction.spec || '',
        vehicle_model: transaction.vehicle_model || '',
        quantity: transaction.quantity,
        unit_price: transaction.unit_price,
        supply_amount: transaction.supply_amount,
        tax_amount: transaction.tax_amount,
        total_amount: transaction.total_amount,
        payment_status: transaction.payment_status || 'PENDING',
        payment_due_date: transaction.payment_due_date || '',
        notes: transaction.notes || ''
      });
    }
  }, [transaction]);

  // Auto-calculate amounts when quantity or unit_price changes
  useEffect(() => {
    const supplyAmount = (formData.quantity || 0) * (formData.unit_price || 0);
    const taxAmount = supplyAmount * 0.1; // 10% 부가세
    const totalAmount = supplyAmount + taxAmount;

    setFormData(prev => ({
      ...prev,
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount
    }));
  }, [formData.quantity, formData.unit_price]);

  const handleSupplierChange = (supplierId: number | null) => {
    setFormData(prev => ({ ...prev, supplier_id: supplierId || undefined }));
    if (errors.supplier_id) {
      setErrors(prev => ({ ...prev, supplier_id: '' }));
    }
  };

  // 품목명이 변경될 때 item_id는 선택사항으로 처리
  const handleItemNameChange = (itemName: string) => {
    setFormData(prev => ({
      ...prev,
      item_name: itemName
    }));
    if (errors.item_name) {
      setErrors(prev => ({ ...prev, item_name: '' }));
    }
  };

  const handleInputChange = (field: keyof PurchaseTransaction, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.transaction_date) {
      newErrors.transaction_date = '거래일자는 필수입니다';
    }

    if (!formData.supplier_id) {
      newErrors.supplier_id = '공급사를 선택해주세요';
    }

    if (!formData.item_name || formData.item_name.trim() === '') {
      newErrors.item_name = '품목명을 입력해주세요';
    }

    if (!formData.quantity || formData.quantity <= 0) {
      newErrors.quantity = '수량은 0보다 커야 합니다';
    }

    if (formData.unit_price === undefined || formData.unit_price < 0) {
      newErrors.unit_price = '단가는 0 이상이어야 합니다';
    }

    // Validate payment_due_date if provided
    if (formData.payment_due_date && formData.transaction_date) {
      if (new Date(formData.payment_due_date) < new Date(formData.transaction_date)) {
        newErrors.payment_due_date = '지급예정일은 거래일자 이후여야 합니다';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      // Remove server-generated and relation fields
      const { 
        transaction_no, 
        supplier, 
        item, 
        created_at, 
        updated_at, 
        is_active, 
        ...dataToSave 
      } = formData as any;

      // Explicitly remove unwanted fields
      delete dataToSave.supplier_name;
      delete dataToSave.spec;
      // item_id is optional now, remove if not set
      if (!dataToSave.item_id) {
        delete dataToSave.item_id;
      }
      delete dataToSave.vehicle_model;
      delete dataToSave.material_type;
      delete dataToSave.unit;
      delete dataToSave.receiving_date;
      delete dataToSave.warehouse_location;
      delete dataToSave.tax_invoice_id;
      delete dataToSave.tax_invoice_received;
      delete dataToSave.created_by;
      delete dataToSave.updated_by;

      // Clean up empty strings and null values but preserve notes
      Object.keys(dataToSave).forEach(key => {
        if ((dataToSave[key] === '' || dataToSave[key] === null) && key !== 'notes') {
          delete dataToSave[key];
        }
      });

      await onSave(dataToSave);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 거래일자 */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4" />
            거래일자 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.transaction_date}
            onChange={(e) => handleInputChange('transaction_date', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
              errors.transaction_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {errors.transaction_date && (
            <p className="mt-1 text-sm text-red-500">{errors.transaction_date}</p>
          )}
        </div>

        {/* 공급사 */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Building2 className="w-4 h-4" />
            공급사 <span className="text-red-500">*</span>
          </label>
          <CompanySelect
            value={formData.supplier_id || null}
            onChange={handleSupplierChange}
            error={errors.supplier_id}
            placeholder="업체를 선택하세요"
          />
        </div>

        {/* 품목명 */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            
            품목명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.item_name || ''}
            onChange={(e) => handleItemNameChange(e.target.value)}
            placeholder="품목명을 입력하세요"
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
              errors.item_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {errors.item_name && (
            <p className="mt-1 text-sm text-red-500">{errors.item_name}</p>
          )}
        </div>

        {/* 규격 (읽기전용) */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            
            규격
          </label>
          <input
            type="text"
            value={formData.spec || ''}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed"
          />
        </div>

        {/* 차종 (편집 가능) */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            
            차종
          </label>
          <input
            type="text"
            value={formData.vehicle_model || ''}
            onChange={(e) => handleInputChange('vehicle_model', e.target.value)}
            placeholder="차종을 입력하세요"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* 수량 */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Hash className="w-4 h-4" />
            수량 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={formData.quantity || ''}
            onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
              errors.quantity ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {errors.quantity && (
            <p className="mt-1 text-sm text-red-500">{errors.quantity}</p>
          )}
        </div>

        {/* 단가 */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            
            단가 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.unit_price || ''}
            onChange={(e) => handleInputChange('unit_price', parseFloat(e.target.value) || 0)}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
              errors.unit_price ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {errors.unit_price && (
            <p className="mt-1 text-sm text-red-500">{errors.unit_price}</p>
          )}
        </div>

        {/* 공급가액 (자동계산, 읽기전용) */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            
            공급가액
          </label>
          <input
            type="text"
            value={(formData.supply_amount || 0).toLocaleString()}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed"
          />
        </div>

        {/* 세액 (자동계산, 읽기전용) */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            
            세액 (10%)
          </label>
          <input
            type="text"
            value={(formData.tax_amount || 0).toLocaleString()}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed"
          />
        </div>

        {/* 총액 (자동계산, 읽기전용) */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            
            총액
          </label>
          <input
            type="text"
            value={(formData.total_amount || 0).toLocaleString()}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold cursor-not-allowed"
          />
        </div>

        {/* 지급상태 */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            
            지급상태
          </label>
          <select
            value={formData.payment_status || 'PENDING'}
            onChange={(e) => handleInputChange('payment_status', e.target.value as PaymentStatus)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {PAYMENT_STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 지급예정일 */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4" />
            지급예정일
          </label>
          <input
            type="date"
            value={formData.payment_due_date || ''}
            onChange={(e) => handleInputChange('payment_due_date', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
              errors.payment_due_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {errors.payment_due_date && (
            <p className="mt-1 text-sm text-red-500">{errors.payment_due_date}</p>
          )}
        </div>

        {/* 비고 (전체 너비) */}
        <div className="md:col-span-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            
            비고
          </label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            placeholder="추가 메모 사항을 입력하세요"
          />
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {transaction ? '수정' : '등록'}
        </button>
      </div>
    </form>
  );
}
