'use client';

import { useState, useEffect } from 'react';
import {
  Save,
  Loader2,
  Calendar,
  Building2,
  Hash,
  ClipboardCopy
} from 'lucide-react';
import { formStorage } from '@/utils/formStorage';

type PaymentMethod = 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD' | 'BILL';

type Payment = {
  payment_id?: number;
  payment_date: string;
  purchase_transaction_id: number;
  paid_amount: number;
  payment_method: PaymentMethod;
  bank_name?: string;
  account_number?: string;
  check_number?: string;
  card_number?: string;
  bill_number?: string;
  bill_date?: string;
  bill_drawer?: string;
  notes?: string;
  is_active?: boolean;
  remaining_balance?: number;
};

type PurchaseTransaction = {
  transaction_id: number;
  transaction_no: string;
  supplier_name: string;
  total_amount: number;
  paid_amount: number;
  remaining_balance: number;
  payment_status: string;
};

interface PaymentFormProps {
  payment?: Payment | null;
  onSave: (data: Partial<Payment>) => Promise<void>;
  onCancel: () => void;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: 'CASH', label: '현금' },
  { value: 'TRANSFER', label: '계좌이체' },
  { value: 'CHECK', label: '수표' },
  { value: 'CARD', label: '카드' },
  { value: 'BILL', label: '어음' }
];

export default function PaymentForm({ payment, onSave, onCancel }: PaymentFormProps) {
  const [formData, setFormData] = useState<Partial<Payment>>({
    payment_date: new Date().toISOString().split('T')[0],
    purchase_transaction_id: undefined,
    paid_amount: 0,
    payment_method: 'CASH',
    bank_name: '',
    account_number: '',
    check_number: '',
    card_number: '',
    bill_number: '',
    bill_date: '',
    bill_drawer: '',
    notes: '',
    is_active: true,
    remaining_balance: 0
  });

  const [purchaseTransactions, setPurchaseTransactions] = useState<PurchaseTransaction[]>([]);
  const [selectedPurchaseTransaction, setSelectedPurchaseTransaction] = useState<PurchaseTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastInputAvailable, setLastInputAvailable] = useState(false);

  // Load payment data for edit mode
  useEffect(() => {
    if (payment) {
      setFormData({
        ...payment,
        payment_date: payment.payment_date || new Date().toISOString().split('T')[0],
        bank_name: payment.bank_name ?? '',
        account_number: payment.account_number ?? '',
        check_number: payment.check_number ?? '',
        card_number: payment.card_number ?? '',
        bill_number: payment.bill_number ?? '',
        bill_date: payment.bill_date ?? '',
        bill_drawer: payment.bill_drawer ?? '',
        notes: payment.notes ?? ''
      });
    }
    
    // 마지막 입력값 확인
    const lastData = formStorage.loadLastInput('payment');
    setLastInputAvailable(!!lastData);
  }, [payment]);

  // Fetch pending purchase transactions
  useEffect(() => {
    const fetchPurchaseTransactions = async () => {
      try {
        setLoadingPurchases(true);

        // Import safeFetchAllJson utility
        const { safeFetchAllJson } = await import('@/lib/fetch-utils');

        // Fetch PENDING and PARTIAL transactions in parallel with timeout and retry
        const [pendingResult, partialResult] = await safeFetchAllJson([
          { url: '/api/purchase-transactions?payment_status=PENDING&limit=100' },
          { url: '/api/purchase-transactions?payment_status=PARTIAL&limit=100' }
        ], {
          timeout: 15000, // 15초 타임아웃
          maxRetries: 2,  // 최대 2회 재시도
          retryDelay: 1000 // 1초 간격
        });

        const allTransactions: any[] = [];

        if (pendingResult.success && pendingResult.data?.transactions) {
          allTransactions.push(...pendingResult.data.transactions);
        }

        if (partialResult.success && partialResult.data?.transactions) {
          allTransactions.push(...partialResult.data.transactions);
        }

        const transactions = allTransactions.map((tx: any) => ({
          transaction_id: tx.transaction_id,
          transaction_no: tx.transaction_no,
          supplier_name: tx.supplier?.company_name || 'Unknown',
          total_amount: tx.total_amount,
          paid_amount: tx.paid_amount || 0,
          remaining_balance: tx.total_amount - (tx.paid_amount || 0),
          payment_status: tx.payment_status
        }));

        setPurchaseTransactions(transactions);

        // If in edit mode and transaction is not in list, fetch it individually
        if (formData.purchase_transaction_id) {
          const found = transactions.find(t => t.transaction_id === formData.purchase_transaction_id);
          if (!found) {
            // Fetch the specific transaction with safeFetchJson
            const { safeFetchJson } = await import('@/lib/fetch-utils');
            const result = await safeFetchJson(`/api/purchases/${formData.purchase_transaction_id}`, {}, {
              timeout: 10000,
              maxRetries: 2,
              retryDelay: 1000
            });
            if (result.success && result.data) {
              const tx = result.data;
              const singleTransaction = {
                transaction_id: tx.transaction_id,
                transaction_no: tx.transaction_no,
                supplier_name: tx.supplier?.company_name || 'Unknown',
                total_amount: tx.total_amount,
                paid_amount: tx.paid_amount || 0,
                remaining_balance: tx.total_amount - (tx.paid_amount || 0),
                payment_status: tx.payment_status
              };
              setPurchaseTransactions([singleTransaction, ...transactions]);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching purchase transactions:', error);
      } finally {
        setLoadingPurchases(false);
      }
    };

    fetchPurchaseTransactions();
  }, [formData.purchase_transaction_id]);

  // Auto-calculate remaining balance when purchase transaction is selected
  useEffect(() => {
    if (selectedPurchaseTransaction) {
      const totalAmount = selectedPurchaseTransaction.total_amount;
      const paidAmount = selectedPurchaseTransaction.paid_amount || 0;
      const remainingAmount = totalAmount - paidAmount;

      setFormData(prev => ({
        ...prev,
        remaining_balance: remainingAmount
      }));
    }
  }, [selectedPurchaseTransaction]);

  // Update selected transaction when purchase_transaction_id changes
  useEffect(() => {
    if (formData.purchase_transaction_id && purchaseTransactions.length > 0) {
      const transaction = purchaseTransactions.find(
        t => t.transaction_id === formData.purchase_transaction_id
      );
      if (transaction) {
        setSelectedPurchaseTransaction(transaction);
      }
    }
  }, [formData.purchase_transaction_id, purchaseTransactions]);

  // 전액 지급
  const handleFullPayment = () => {
    if (selectedPurchaseTransaction) {
      const remainingAmount = selectedPurchaseTransaction.remaining_balance || 0;
      setFormData(prev => ({
        ...prev,
        paid_amount: remainingAmount
      }));
    }
  };

  // 이전 정보 불러오기
  const handleLoadLastInput = () => {
    const lastData = formStorage.loadLastInput('payment');
    if (lastData) {
      setFormData(prev => ({
        ...prev,
        payment_method: lastData.payment_method as PaymentMethod,
        bank_name: lastData.bank_name,
        account_number: lastData.account_number,
        check_number: lastData.check_number,
        card_number: lastData.card_number,
        bill_number: lastData.bill_number,
        bill_date: lastData.bill_date,
        bill_drawer: lastData.bill_drawer
      }));
    }
  };

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit(e as any);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'f' && e.ctrlKey) {
        e.preventDefault();
        handleFullPayment();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedPurchaseTransaction]);

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

  const handlePurchaseTransactionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const transactionId = parseInt(e.target.value);
    const transaction = purchaseTransactions.find(tx => tx.transaction_id === transactionId);

    setSelectedPurchaseTransaction(transaction || null);
    setFormData(prev => ({
      ...prev,
      purchase_transaction_id: transactionId || undefined
    }));

    if (errors.purchase_transaction_id) {
      setErrors(prev => ({ ...prev, purchase_transaction_id: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.payment_date) {
      newErrors.payment_date = '지급일자는 필수입니다';
    }

    if (!formData.purchase_transaction_id) {
      newErrors.purchase_transaction_id = '매입 거래를 선택해주세요';
    }

    if (!formData.paid_amount || formData.paid_amount <= 0) {
      newErrors.paid_amount = '지급금액은 0보다 커야 합니다';
    }

    if (formData.paid_amount && formData.remaining_balance &&
        formData.paid_amount > formData.remaining_balance) {
      newErrors.paid_amount = '지급금액이 미지급금액을 초과할 수 없습니다';
    }

    if (!formData.payment_method) {
      newErrors.payment_method = '결제방법을 선택해주세요';
    }

    // Conditional validation based on payment method
    if (formData.payment_method === 'TRANSFER') {
      if (!formData.bank_name) {
        newErrors.bank_name = '은행명은 필수입니다';
      }
      if (!formData.account_number) {
        newErrors.account_number = '계좌번호는 필수입니다';
      }
    }

    if (formData.payment_method === 'CHECK' && !formData.check_number) {
      newErrors.check_number = '수표번호는 필수입니다';
    }

    if (formData.payment_method === 'CARD' && !formData.card_number) {
      newErrors.card_number = '카드번호는 필수입니다';
    }

    if (formData.payment_method === 'BILL') {
      if (!formData.bill_number) {
        newErrors.bill_number = '어음 번호는 필수입니다';
      }
      if (!formData.bill_date) {
        newErrors.bill_date = '만기일은 필수입니다';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Remove read-only and relational fields
      const { 
        remaining_balance, 
        purchase_transaction, 
        supplier, 
        created_at, 
        updated_at,
        is_active,
        ...dataToSave 
      } = formData as any;

      // Clean up conditional fields based on payment method
      const cleanedData = { ...dataToSave };

      if (cleanedData.payment_method !== 'TRANSFER') {
        delete cleanedData.bank_name;
        delete cleanedData.account_number;
      }

      if (cleanedData.payment_method !== 'CHECK') {
        delete cleanedData.check_number;
      }

      if (cleanedData.payment_method !== 'CARD') {
        delete cleanedData.card_number;
      }

      if (cleanedData.payment_method !== 'BILL') {
        delete cleanedData.bill_number;
        delete cleanedData.bill_date;
        delete cleanedData.bill_drawer;
      }

      // Remove empty strings but preserve notes
      Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key as keyof typeof cleanedData] === '' && key !== 'notes') {
          delete cleanedData[key as keyof typeof cleanedData];
        }
      });

      // 마지막 입력값 저장 (결제 정보만)
      formStorage.saveLastInput('payment', {
        payment_method: formData.payment_method!,
        bank_name: formData.bank_name,
        account_number: formData.account_number,
        check_number: formData.check_number,
        card_number: formData.card_number,
        bill_number: formData.bill_number,
        bill_date: formData.bill_date,
        bill_drawer: formData.bill_drawer
      });

      await onSave(cleanedData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 지급일자 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-2" />
            지급일자 <span className="text-gray-500">*</span>
          </label>
          <input
            type="date"
            name="payment_date"
            value={formData.payment_date}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.payment_date ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            required
          />
          {errors.payment_date && (
            <p className="mt-1 text-sm text-gray-500">{errors.payment_date}</p>
          )}
        </div>

        {/* 매입 거래 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            
            매입 거래 <span className="text-gray-500">*</span>
          </label>
          <select
            name="purchase_transaction_id"
            value={formData.purchase_transaction_id || ''}
            onChange={handlePurchaseTransactionChange}
            disabled={loadingPurchases && purchaseTransactions.length === 0}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.purchase_transaction_id ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            } ${loadingPurchases && purchaseTransactions.length === 0 ? 'opacity-50 cursor-wait' : ''}`}
            required
          >
            <option value="">
              {loadingPurchases && purchaseTransactions.length === 0 
                ? '매입 거래를 불러오는 중...' 
                : '매입 거래를 선택하세요'}
            </option>
            {purchaseTransactions.map((tx) => (
              <option key={tx.transaction_id} value={tx.transaction_id}>
                {tx.transaction_no} - {tx.supplier_name} (미지급: ₩{tx.remaining_balance.toLocaleString()})
              </option>
            ))}
          </select>
          {errors.purchase_transaction_id && (
            <p className="mt-1 text-sm text-gray-500">{errors.purchase_transaction_id}</p>
          )}
        </div>

        {/* 미지급금액 (읽기 전용) */}
        {selectedPurchaseTransaction && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              미지급금액
            </label>
            <input
              type="text"
              value={`₩ ${(formData.remaining_balance || 0).toLocaleString()}`}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-medium"
            />
          </div>
        )}

        {/* 지급금액 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            
            지급금액 <span className="text-gray-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              name="paid_amount"
              value={formData.paid_amount}
              onChange={handleChange}
              min="0"
              step="0.01"
              max={formData.remaining_balance}
              className={`flex-1 px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.paid_amount ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
              }`}
              required
            />
            <button
              type="button"
              onClick={handleFullPayment}
              disabled={!selectedPurchaseTransaction}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Ctrl+F로 전액 지급"
            >
              전액 지급
            </button>
          </div>
          {selectedPurchaseTransaction && formData.remaining_balance !== undefined && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              남은 잔액: ₩{formData.remaining_balance.toLocaleString()}
            </p>
          )}
          {errors.paid_amount && (
            <p className="mt-1 text-sm text-gray-500">{errors.paid_amount}</p>
          )}
        </div>

        {/* 결제방법 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              
              결제방법 <span className="text-gray-500">*</span>
            </label>
            {lastInputAvailable && !payment && (
              <button
                type="button"
                onClick={handleLoadLastInput}
                className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
                title="이전 입력한 결제 정보 불러오기"
              >
                <ClipboardCopy className="w-3 h-3" />
                이전 정보 불러오기
              </button>
            )}
          </div>
          <select
            name="payment_method"
            value={formData.payment_method}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.payment_method ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            required
          >
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.payment_method && (
            <p className="mt-1 text-sm text-gray-500">{errors.payment_method}</p>
          )}
        </div>

        {/* Conditional Fields - Transfer */}
        {formData.payment_method === 'TRANSFER' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                은행명 <span className="text-gray-500">*</span>
              </label>
              <input
                type="text"
                name="bank_name"
                value={formData.bank_name ?? ''}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  errors.bank_name ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
                }`}
                placeholder="예: 국민은행"
                required
              />
              {errors.bank_name && (
                <p className="mt-1 text-sm text-gray-500">{errors.bank_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Hash className="w-4 h-4 inline mr-2" />
                계좌번호 <span className="text-gray-500">*</span>
              </label>
              <input
                type="text"
                name="account_number"
                value={formData.account_number ?? ''}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  errors.account_number ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
                }`}
                placeholder="예: 123-456-789012"
                required
              />
              {errors.account_number && (
                <p className="mt-1 text-sm text-gray-500">{errors.account_number}</p>
              )}
            </div>
          </>
        )}

        {/* Conditional Fields - Check */}
        {formData.payment_method === 'CHECK' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Hash className="w-4 h-4 inline mr-2" />
              수표번호 <span className="text-gray-500">*</span>
            </label>
            <input
              type="text"
              name="check_number"
              value={formData.check_number}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.check_number ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
              }`}
              placeholder="예: CHK-2024-001"
              required
            />
            {errors.check_number && (
              <p className="mt-1 text-sm text-gray-500">{errors.check_number}</p>
            )}
          </div>
        )}

        {/* Conditional Fields - Card */}
        {formData.payment_method === 'CARD' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              
              카드번호 (마지막 4자리) <span className="text-gray-500">*</span>
            </label>
            <input
              type="text"
              name="card_number"
              value={formData.card_number}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.card_number ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
              }`}
              placeholder="예: ****-****-****-1234"
              maxLength={4}
              required
            />
            {errors.card_number && (
              <p className="mt-1 text-sm text-gray-500">{errors.card_number}</p>
            )}
          </div>
        )}

        {/* Conditional Fields - Bill */}
        {formData.payment_method === 'BILL' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Hash className="w-4 h-4 inline mr-2" />
                어음 번호 <span className="text-gray-500">*</span>
              </label>
              <input
                type="text"
                name="bill_number"
                value={formData.bill_number ?? ''}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  errors.bill_number ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
                }`}
                placeholder="어음 번호 입력"
                required
              />
              {errors.bill_number && (
                <p className="mt-1 text-sm text-gray-500">{errors.bill_number}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                만기일 <span className="text-gray-500">*</span>
              </label>
              <input
                type="date"
                name="bill_date"
                value={formData.bill_date ?? ''}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  errors.bill_date ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
                }`}
                required
              />
              {errors.bill_date && (
                <p className="mt-1 text-sm text-gray-500">{errors.bill_date}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                발행자
              </label>
              <input
                type="text"
                name="bill_drawer"
                value={formData.bill_drawer ?? ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="발행자 입력"
              />
            </div>
          </>
        )}

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
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="지급 관련 특이사항이나 메모를 입력하세요"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              {payment ? '수정' : '등록'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
