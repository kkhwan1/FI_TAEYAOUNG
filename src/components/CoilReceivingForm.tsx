'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, Package, Weight, Ruler, Save, X, Calculator, RefreshCw } from 'lucide-react';
import { CoilReceivingItem, WeightManagedItem, Company } from '@/types/inventory';
import { formatSpec, normalizeWeightToKg, autoFormatWeight } from '@/lib/weight-utils';

interface CoilReceivingFormProps {
  onSubmit: (data: CoilReceivingFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface CoilReceivingFormData {
  transaction_date: string;
  company_id: number;
  items: CoilReceivingItem[];
  reference_no?: string;
  created_by: number;
}

export default function CoilReceivingForm({ onSubmit, onCancel, isLoading = false }: CoilReceivingFormProps) {
  // Form State
  const [transactionDate, setTransactionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [weightManagedItems, setWeightManagedItems] = useState<WeightManagedItem[]>([]);
  const [referenceNo, setReferenceNo] = useState('');

  // Item Input State
  const [selectedItem, setSelectedItem] = useState<WeightManagedItem | null>(null);
  const [thickness, setThickness] = useState<string>('');
  const [width, setWidth] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'ton'>('ton');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [material, setMaterial] = useState<string>('');

  // Loading states
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Fetch suppliers on mount
  useEffect(() => {
    fetchCompanies();
    fetchWeightManagedItems();
  }, []);

  const fetchCompanies = async () => {
    setIsLoadingCompanies(true);
    try {
      const response = await fetch('/api/companies?type=SUPPLIER');
      const result = await response.json();
      if (result.success && result.data) {
        // Transform API response to match expected format
        const transformed = result.data.map((c: any) => ({
          id: c.company_id,
          name: c.company_name,
          type: c.company_type
        }));
        setCompanies(transformed);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  const fetchWeightManagedItems = async () => {
    setIsLoadingItems(true);
    try {
      const response = await fetch('/api/items?limit=1000');
      const result = await response.json();
      if (result.success && result.data) {
        // Filter items where is_weight_managed = true
        const filtered = result.data.filter((item: any) => item.is_weight_managed === true);
        // Transform to match WeightManagedItem format
        const transformed = filtered.map((item: any) => ({
          item_id: item.item_id,
          item_code: item.item_code,
          item_name: item.item_name,
          thickness: item.thickness,
          width: item.width,
          is_weight_managed: item.is_weight_managed,
          current_weight: item.current_weight || 0
        }));
        setWeightManagedItems(transformed);
      }
    } catch (error) {
      console.error('Failed to fetch weight managed items:', error);
    } finally {
      setIsLoadingItems(false);
    }
  };

  // Auto-generate spec when thickness/width changes
  const currentSpec = thickness && width
    ? formatSpec(parseFloat(thickness), parseFloat(width))
    : '';

  // Normalize weight to kg for display
  const normalizedWeightKg = weight
    ? normalizeWeightToKg(parseFloat(weight), weightUnit)
    : 0;

  // Format weight for display
  const weightDisplay = normalizedWeightKg > 0
    ? autoFormatWeight(normalizedWeightKg)
    : '-';

  // Calculate total amount
  const totalAmount = weight && unitPrice
    ? parseFloat(weight) * parseFloat(unitPrice)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCompany || !selectedItem || !weight || !unitPrice) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }

    const coilItem: CoilReceivingItem = {
      item_id: selectedItem.item_id,
      item_code: selectedItem.item_code,
      item_name: selectedItem.item_name,
      unit: 'kg',
      quantity: 1, // Coils are typically counted as 1 unit
      unit_price: parseFloat(unitPrice),
      material_type: 'coil',
      thickness: parseFloat(thickness) || 0,
      width: parseFloat(width) || 0,
      weight: normalizedWeightKg,
      weight_unit: 'kg', // Always store in kg
      spec: currentSpec,
      material: material || undefined,
    };

    const formData: CoilReceivingFormData = {
      transaction_date: transactionDate,
      company_id: selectedCompany.id,
      items: [coilItem],
      reference_no: referenceNo || undefined,
      created_by: 1, // TODO: Get from auth context
    };

    await onSubmit(formData);
  };

  const resetForm = () => {
    setSelectedItem(null);
    setThickness('');
    setWidth('');
    setWeight('');
    setWeightUnit('ton');
    setUnitPrice('');
    setMaterial('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 rounded-lg border border-orange-200">
        <div className="flex items-center gap-2 text-orange-700">
          <Weight className="h-5 w-5" />
          <h3 className="font-semibold">원자재(코일) 입고</h3>
        </div>
        <p className="text-sm text-orange-600 mt-1">
          코일/시트 등 중량 관리 품목을 입고합니다.
        </p>
      </div>

      {/* Basic Info Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Transaction Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Calendar className="inline h-4 w-4 mr-1" />
            입고일자 *
          </label>
          <input
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            required
          />
        </div>

        {/* Supplier Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            공급업체 *
          </label>
          <select
            value={selectedCompany?.id || ''}
            onChange={(e) => {
              const company = companies.find(c => c.id === parseInt(e.target.value));
              setSelectedCompany(company || null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            required
            disabled={isLoadingCompanies}
          >
            <option value="">공급업체 선택</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        {/* Reference Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            참조번호
          </label>
          <input
            type="text"
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            placeholder="발주번호 등"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
      </div>

      {/* Item Selection Section */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-700 flex items-center gap-2">
            <Package className="h-4 w-4" />
            원자재 품목 선택
          </h4>
          <button
            type="button"
            onClick={resetForm}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            초기화
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Item Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              품목 *
            </label>
            <select
              value={selectedItem?.item_id || ''}
              onChange={(e) => {
                const item = weightManagedItems.find(i => i.item_id === parseInt(e.target.value));
                setSelectedItem(item || null);
                if (item) {
                  setThickness(item.thickness?.toString() || '');
                  setWidth(item.width?.toString() || '');
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
              disabled={isLoadingItems}
            >
              <option value="">원자재 선택</option>
              {weightManagedItems.map((item) => (
                <option key={item.item_id} value={item.item_id}>
                  [{item.item_code}] {item.item_name}
                </option>
              ))}
            </select>
          </div>

          {/* Material Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              재질
            </label>
            <input
              type="text"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="SPCC, SPHC, SAPH 등"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Specification Section */}
      <div className="border rounded-lg p-4 bg-blue-50">
        <h4 className="font-medium text-blue-700 flex items-center gap-2 mb-4">
          <Ruler className="h-4 w-4" />
          규격 정보
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Thickness */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              두께 (mm) *
            </label>
            <input
              type="number"
              step="0.01"
              value={thickness}
              onChange={(e) => setThickness(e.target.value)}
              placeholder="1.5"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Width */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              폭 (mm) *
            </label>
            <input
              type="number"
              step="1"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="630"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Auto-generated Spec Display */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              규격 (자동생성)
            </label>
            <div className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-gray-700 font-mono">
              {currentSpec || '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Weight & Price Section */}
      <div className="border rounded-lg p-4 bg-green-50">
        <h4 className="font-medium text-green-700 flex items-center gap-2 mb-4">
          <Calculator className="h-4 w-4" />
          중량 및 금액
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Weight Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              중량 *
            </label>
            <input
              type="number"
              step="0.001"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="2.5"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
            />
          </div>

          {/* Weight Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              단위
            </label>
            <select
              value={weightUnit}
              onChange={(e) => setWeightUnit(e.target.value as 'kg' | 'ton')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="ton">톤 (ton)</option>
              <option value="kg">킬로그램 (kg)</option>
            </select>
          </div>

          {/* Normalized Weight Display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              환산 중량
            </label>
            <div className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-gray-700">
              {weightDisplay}
            </div>
          </div>

          {/* Unit Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              단가 (원/{weightUnit}) *
            </label>
            <input
              type="number"
              step="1"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="1200000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
            />
          </div>
        </div>

        {/* Total Amount Display */}
        {totalAmount > 0 && (
          <div className="mt-4 p-3 bg-white rounded-md border border-green-200">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">총 금액:</span>
              <span className="text-lg font-bold text-green-700">
                {totalAmount.toLocaleString('ko-KR')} 원
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
          취소
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-white bg-orange-600 rounded-md hover:bg-orange-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading || !selectedItem || !weight || !unitPrice}
        >
          <Save className="h-4 w-4" />
          {isLoading ? '저장 중...' : '입고 등록'}
        </button>
      </div>
    </form>
  );
}
