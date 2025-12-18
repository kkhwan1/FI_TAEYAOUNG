'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Package, ArrowRight, Save, RefreshCw } from 'lucide-react';
import ItemSelect from '@/components/ItemSelect';
import CompanySelect from '@/components/CompanySelect';
import type { ProcessType, ProcessProductionRequest, QualityStatus } from '@/types/processProduction';
import type { ItemForComponent } from '@/types/inventory';

interface ProcessTabProps {
  processType: ProcessType;
  title: string;
  inputLabel: string;
  outputLabel: string;
  onSubmit: (data: ProcessProductionRequest) => Promise<void>;
  isLoading?: boolean;
}

export default function ProcessTab({
  processType,
  title,
  inputLabel,
  outputLabel,
  onSubmit,
  isLoading = false
}: ProcessTabProps) {
  // Form state
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [inputItem, setInputItem] = useState<ItemForComponent | null>(null);
  const [outputItem, setOutputItem] = useState<ItemForComponent | null>(null);
  const [inputQuantity, setInputQuantity] = useState<string>('');
  const [outputQuantity, setOutputQuantity] = useState<string>('');
  const [scrapQuantity, setScrapQuantity] = useState<string>('0');
  const [qualityStatus, setQualityStatus] = useState<QualityStatus>('OK');
  const [notes, setNotes] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!inputItem) newErrors.inputItem = '투입 품목을 선택하세요';
    if (!outputItem) newErrors.outputItem = '산출 품목을 선택하세요';
    if (!inputQuantity || parseInt(inputQuantity) <= 0) {
      newErrors.inputQuantity = '투입 수량을 입력하세요';
    }
    if (!outputQuantity || parseInt(outputQuantity) <= 0) {
      newErrors.outputQuantity = '산출 수량을 입력하세요';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    await onSubmit({
      process_type: processType,
      work_date: workDate,
      input_item_id: inputItem!.item_id,
      input_quantity: parseInt(inputQuantity),
      output_item_id: outputItem!.item_id,
      output_quantity: parseInt(outputQuantity),
      scrap_quantity: parseInt(scrapQuantity) || 0,
      quality_status: qualityStatus,
      notes,
      customer_id: customerId || undefined
    });
  };

  const handleReset = () => {
    setInputItem(null);
    setOutputItem(null);
    setInputQuantity('');
    setOutputQuantity('');
    setScrapQuantity('0');
    setQualityStatus('OK');
    setNotes('');
    setCustomerId(null);
    setErrors({});
  };

  // 투입수량 = 산출수량으로 자동 설정
  const handleInputChange = (value: string) => {
    setInputQuantity(value);
    if (value && !outputQuantity) {
      setOutputQuantity(value);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>

      {/* 작업일자 및 납품처 */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Calendar className="w-4 h-4" />
            작업일자
          </label>
          <input
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
        </div>
        <div className="flex items-center gap-4 min-w-[300px]">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            납품처
          </label>
          <div className="flex-1">
            <CompanySelect
              value={customerId}
              onChange={(id) => setCustomerId(id)}
              companyType="CUSTOMER"
              placeholder="납품처 선택..."
              deliveryOnly={true}
              hideDeliveryPrefix={true}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 투입 (Input) */}
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Package className="w-5 h-5" />
            투입 ({inputLabel})
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {inputLabel} 선택 <span className="text-red-500">*</span>
            </label>
            <ItemSelect
              value={inputItem?.item_id}
              onChange={(item) => setInputItem(item)}
              placeholder={`${inputLabel} 선택...`}
              itemType="SEMI_PRODUCT"
            />
            {errors.inputItem && (
              <p className="text-red-500 text-sm mt-1">{errors.inputItem}</p>
            )}
            {inputItem && (
              <p className="text-sm text-gray-500 mt-1">
                가용재고: {(inputItem.current_stock || 0).toLocaleString()} EA
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              투입 수량 (EA) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={inputQuantity}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="0"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-600 font-medium">EA</span>
            </div>
            {errors.inputQuantity && (
              <p className="text-red-500 text-sm mt-1">{errors.inputQuantity}</p>
            )}
          </div>
        </div>

        {/* 화살표 */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
          <ArrowRight className="w-8 h-8 text-gray-400" />
        </div>

        {/* 산출 (Output) */}
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Package className="w-5 h-5" />
            산출 ({outputLabel})
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {outputLabel} 선택 <span className="text-red-500">*</span>
            </label>
            <ItemSelect
              value={outputItem?.item_id}
              onChange={(item) => setOutputItem(item)}
              placeholder={`${outputLabel} 선택...`}
              itemType={processType === 'PAINT' ? 'PRODUCT' : 'SEMI_PRODUCT'}
            />
            {errors.outputItem && (
              <p className="text-red-500 text-sm mt-1">{errors.outputItem}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              산출 수량 (EA) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={outputQuantity}
                onChange={(e) => setOutputQuantity(e.target.value)}
                placeholder="0"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-600 font-medium">EA</span>
            </div>
            {errors.outputQuantity && (
              <p className="text-red-500 text-sm mt-1">{errors.outputQuantity}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              불량/스크랩 (EA)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={scrapQuantity}
                onChange={(e) => setScrapQuantity(e.target.value)}
                placeholder="0"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-600 font-medium">EA</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              품질상태
            </label>
            <div className="flex gap-4">
              {(['OK', 'NG', 'REWORK'] as QualityStatus[]).map((status) => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="qualityStatus"
                    value={status}
                    checked={qualityStatus === status}
                    onChange={(e) => setQualityStatus(e.target.value as QualityStatus)}
                    className="w-4 h-4 text-gray-600"
                  />
                  <span className={`text-sm font-medium ${
                    status === 'OK' ? 'text-gray-700' :
                    status === 'NG' ? 'text-gray-700' : 'text-gray-700'
                  }`}>
                    {status}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 비고 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          비고
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="특이사항을 입력하세요"
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <RefreshCw className="w-4 h-4 inline mr-1" />
          초기화
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          완료 및 재고반영
        </button>
      </div>
    </form>
  );
}
