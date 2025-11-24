'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export interface PaymentSplit {
  method: 'CASH' | 'CARD' | 'BILL' | 'CHECK' | 'CREDIT' | 'TRANSFER';
  amount: number;
  bill_number?: string;
  bill_date?: string;
  bill_drawer?: string;
  check_number?: string;
  check_bank?: string;
  bank_name?: string; // TRANSFER용
  account_number?: string; // TRANSFER용
  notes?: string;
}

export interface PaymentSplitFormProps {
  totalAmount: number;
  onSplitsChange: (splits: PaymentSplit[]) => void;
  readOnly?: boolean;
  initialSplits?: PaymentSplit[];
}

/**
 * 복합 결제 입력 폼
 *
 * 기능:
 * - 다중 결제 수단 선택 (현금/카드/어음/수표/외상)
 * - 결제 수단별 조건부 필드 (어음: 번호+만기일, 수표: 번호)
 * - 실시간 합계 검증 (총액과 일치 여부)
 * - 잔액 표시 및 자동 입력
 */
export default function PaymentSplitForm({
  totalAmount,
  onSplitsChange,
  readOnly = false,
  initialSplits
}: PaymentSplitFormProps) {
  const [splits, setSplits] = useState<PaymentSplit[]>(
    initialSplits || [{ method: 'CASH', amount: totalAmount }]
  );

  // Notify parent on splits change
  useEffect(() => {
    onSplitsChange(splits);
  }, [splits, onSplitsChange]);

  const currentTotal = splits.reduce((sum, s) => sum + (s.amount || 0), 0);
  const remaining = totalAmount - currentTotal;
  const isValid = Math.abs(remaining) < 0.01; // 소수점 오차 허용

  const handleAddSplit = () => {
    const newSplit: PaymentSplit = {
      method: 'CASH',
      amount: remaining > 0 ? remaining : 0
    };
    setSplits([...splits, newSplit]);
  };

  const handleDeleteSplit = (index: number) => {
    if (splits.length === 1) return; // 최소 1개 유지
    const newSplits = splits.filter((_, i) => i !== index);
    setSplits(newSplits);
  };

  const handleChangeSplit = (index: number, field: keyof PaymentSplit, value: any) => {
    const newSplits = [...splits];
    newSplits[index] = { ...newSplits[index], [field]: value };

    // 결제 수단 변경 시 조건부 필드 초기화
    if (field === 'method') {
      delete newSplits[index].bill_number;
      delete newSplits[index].bill_date;
      delete newSplits[index].bill_drawer;
      delete newSplits[index].check_number;
      delete newSplits[index].check_bank;
    }

    setSplits(newSplits);
  };

  const paymentMethods = [
    { value: 'CASH', label: '현금' },
    { value: 'TRANSFER', label: '계좌이체' },
    { value: 'CARD', label: '카드' },
    { value: 'BILL', label: '어음' },
    { value: 'CHECK', label: '수표' },
    { value: 'CREDIT', label: '외상' }
  ];

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      {/* 합계 상태 헤더 */}
      <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              총 결제 금액: <span className="text-blue-600 dark:text-blue-400 font-semibold">{totalAmount.toLocaleString('ko-KR')}원</span>
            </div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              현재 입력 금액: <span className={currentTotal === totalAmount ? 'text-gray-900 dark:text-white' : 'text-orange-600 dark:text-orange-400'}>{currentTotal.toLocaleString('ko-KR')}원</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isValid ? (
              <div className="flex items-center gap-1 text-gray-900 dark:text-white text-sm font-semibold">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                금액 일치
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-orange-600 dark:text-orange-400">
                  잔액: {remaining.toLocaleString('ko-KR')}원
                </div>
                {remaining !== 0 && (
                  <div className="text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/50 px-2 py-1 rounded">
                    {remaining > 0 ? '부족' : '초과'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 결제 분할 목록 */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {splits.map((split, index) => (
          <div key={index} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <div className="flex items-start gap-4">
              {/* 순번 */}
              <div className="flex-shrink-0 w-8 pt-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                {index + 1}
              </div>

              {/* 결제 수단 선택 */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 결제 수단 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    결제 수단 <span className="text-red-500">*</span>
                  </label>
                  {readOnly ? (
                    <div className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white">
                      {paymentMethods.find(m => m.value === split.method)?.label || split.method}
                    </div>
                  ) : (
                    <select
                      value={split.method}
                      onChange={(e) => handleChangeSplit(index, 'method', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      {paymentMethods.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 금액 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    금액 <span className="text-red-500">*</span>
                  </label>
                  {readOnly ? (
                    <div className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white text-right">
                      {split.amount.toLocaleString('ko-KR')}원
                    </div>
                  ) : (
                    <input
                      type="number"
                      value={split.amount}
                      onChange={(e) => handleChangeSplit(index, 'amount', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-right"
                      placeholder="0"
                    />
                  )}
                </div>

                {/* 조건부 필드: 어음 */}
                {split.method === 'BILL' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        어음 번호 <span className="text-red-500">*</span>
                      </label>
                      {readOnly ? (
                        <div className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white">
                          {split.bill_number || '-'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={split.bill_number || ''}
                          onChange={(e) => handleChangeSplit(index, 'bill_number', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="어음 번호 입력"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        만기일 <span className="text-red-500">*</span>
                      </label>
                      {readOnly ? (
                        <div className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white">
                          {split.bill_date || '-'}
                        </div>
                      ) : (
                        <input
                          type="date"
                          value={split.bill_date || ''}
                          onChange={(e) => handleChangeSplit(index, 'bill_date', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        발행자
                      </label>
                      {readOnly ? (
                        <div className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white">
                          {split.bill_drawer || '-'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={split.bill_drawer || ''}
                          onChange={(e) => handleChangeSplit(index, 'bill_drawer', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="발행자 입력"
                        />
                      )}
                    </div>
                  </>
                )}

                {/* 조건부 필드: 계좌이체 */}
                {split.method === 'TRANSFER' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        은행명 <span className="text-red-500">*</span>
                      </label>
                      {readOnly ? (
                        <div className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white">
                          {split.bank_name || '-'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={split.bank_name || ''}
                          onChange={(e) => handleChangeSplit(index, 'bank_name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="은행명 입력"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        계좌번호 <span className="text-red-500">*</span>
                      </label>
                      {readOnly ? (
                        <div className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white">
                          {split.account_number || '-'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={split.account_number || ''}
                          onChange={(e) => handleChangeSplit(index, 'account_number', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="계좌번호 입력"
                        />
                      )}
                    </div>
                  </>
                )}

                {/* 조건부 필드: 수표 */}
                {split.method === 'CHECK' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        수표 번호 <span className="text-red-500">*</span>
                      </label>
                      {readOnly ? (
                        <div className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white">
                          {split.check_number || '-'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={split.check_number || ''}
                          onChange={(e) => handleChangeSplit(index, 'check_number', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="수표 번호 입력"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        은행
                      </label>
                      {readOnly ? (
                        <div className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white">
                          {split.check_bank || '-'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={split.check_bank || ''}
                          onChange={(e) => handleChangeSplit(index, 'check_bank', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="은행명 입력"
                        />
                      )}
                    </div>
                  </>
                )}

                {/* 비고 (전체 너비) */}
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    비고
                  </label>
                  {readOnly ? (
                    <div className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white">
                      {split.notes || '-'}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={split.notes || ''}
                      onChange={(e) => handleChangeSplit(index, 'notes', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="추가 정보 입력"
                    />
                  )}
                </div>
              </div>

              {/* 삭제 버튼 */}
              {!readOnly && splits.length > 1 && (
                <div className="flex-shrink-0 pt-6">
                  <button
                    type="button"
                    onClick={() => handleDeleteSplit(index)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 결제 수단 추가 버튼 */}
      {!readOnly && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <button
            type="button"
            onClick={handleAddSplit}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            결제 수단 추가
          </button>
          {remaining > 0 && (
            <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">
              (잔액 {remaining.toLocaleString('ko-KR')}원이 자동으로 입력됩니다)
            </span>
          )}
        </div>
      )}

      {/* 검증 에러 메시지 */}
      {!isValid && !readOnly && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border-t border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">
              결제 금액 합계가 총액과 일치하지 않습니다. {remaining > 0 ? `${remaining.toLocaleString('ko-KR')}원 부족합니다.` : `${Math.abs(remaining).toLocaleString('ko-KR')}원 초과되었습니다.`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
