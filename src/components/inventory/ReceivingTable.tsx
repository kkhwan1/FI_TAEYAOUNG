'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Circle, Layers, Package, ShoppingCart, Plus, Trash2, Save, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import CompanySelect from '@/components/CompanySelect';
import {
  ReceivingType,
  ReceivingSubType,
  ReceivingInputRow,
  ReceivingRequest,
  ReceivingHistoryItem
} from '@/types/receiving';

const RECEIVING_ROWS = [
  {
    key: 'COIL' as ReceivingType,
    label: '코일',
    description: '원소재 코일 입고',
    icon: Circle,
    color: 'bg-blue-500',
    hasSubType: true,
    hasWeight: true,
    category: '원소재(코일)',
    subTypes: [
      { key: 'TAECHANG' as ReceivingSubType, label: '태창금속', companyName: '태창금속' },
      { key: 'PARTNER' as ReceivingSubType, label: '협력사', companyName: null }
    ]
  },
  {
    key: 'SHEET' as ReceivingType,
    label: '시트(블랭킹)',
    description: '원소재 시트 입고',
    icon: Layers,
    color: 'bg-amber-500',
    hasSubType: false,
    hasWeight: true,
    category: '원소재(시트)',
    subTypes: []
  },
  {
    key: 'SUBMATERIAL' as ReceivingType,
    label: '부자재',
    description: '부자재 입고',
    icon: Package,
    color: 'bg-green-500',
    hasSubType: true,
    hasWeight: false,
    category: '부자재',
    subTypes: [
      { key: 'TAECHANG' as ReceivingSubType, label: '사금', companyName: '사금' },
      { key: 'PARTNER' as ReceivingSubType, label: '협력사', companyName: null }
    ]
  },
  {
    key: 'MARKET' as ReceivingType,
    label: '시중구매',
    description: '시중 구매 품목',
    icon: ShoppingCart,
    color: 'bg-purple-500',
    hasSubType: false,
    hasWeight: false,
    category: '부자재',
    subTypes: []
  }
];
const createEmptyRow = (): ReceivingInputRow => ({
  id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  itemId: null,
  itemCode: '',
  itemName: '',
  quantity: '',
  unitPrice: '',
  amount: 0,
  thickness: '',
  width: '',
  weight: ''
});

interface QuickSelectItem {
  item_id: number;
  item_code: string;
  item_name: string;
  category: string;
  unit: string;
}

export default function ReceivingTable() {
  const [selectedType, setSelectedType] = useState<ReceivingType>('COIL');
  const [selectedSubType, setSelectedSubType] = useState<ReceivingSubType | null>('TAECHANG');
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [inputRows, setInputRows] = useState<ReceivingInputRow[]>([createEmptyRow()]);
  const [quickSelectItems, setQuickSelectItems] = useState<QuickSelectItem[]>([]);
  const [todayHistory, setTodayHistory] = useState<ReceivingHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTypeConfig = RECEIVING_ROWS.find(r => r.key === selectedType);
  const requiresWeight = selectedTypeConfig?.hasWeight ?? false;

  const getCompanyFilter = useCallback(() => {
    if (!selectedTypeConfig?.hasSubType || !selectedSubType) return undefined;
    const subTypeConfig = selectedTypeConfig.subTypes.find(s => s.key === selectedSubType);
    return subTypeConfig?.companyName ? [subTypeConfig.companyName] : undefined;
  }, [selectedSubType, selectedTypeConfig]);

  const handleTypeChange = (type: ReceivingType) => {
    setSelectedType(type);
    const config = RECEIVING_ROWS.find(r => r.key === type);
    setSelectedSubType(config?.hasSubType && config.subTypes.length > 0 ? config.subTypes[0].key : null);
    setCompanyId(null);
    setInputRows([createEmptyRow()]);
    setQuickSelectItems([]);
  };

  const handleSubTypeChange = (subType: ReceivingSubType) => {
    setSelectedSubType(subType);
    setCompanyId(null);
    setInputRows([createEmptyRow()]);
  };

  const loadQuickSelectItems = useCallback(async () => {
    if (!selectedTypeConfig) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/items?category=${encodeURIComponent(selectedTypeConfig.category)}&limit=50`);
      if (response.ok) {
        const data = await response.json();
        setQuickSelectItems(data.data || []);
      }
    } catch (error) {
      console.error('품목 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTypeConfig]);

  const loadTodayHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/inventory/receiving?date=${workDate}&type=${selectedType}`);
      if (response.ok) {
        const data = await response.json();
        setTodayHistory(data.data || []);
      }
    } catch (error) {
      console.error('이력 로드 실패:', error);
    }
  }, [workDate, selectedType]);

  useEffect(() => {
    loadQuickSelectItems();
    loadTodayHistory();
  }, [loadQuickSelectItems, loadTodayHistory]);

  const handleQuickSelect = (item: QuickSelectItem) => {
    const idx = inputRows.findIndex(row => !row.itemId);
    if (idx >= 0) {
      const newRows = [...inputRows];
      newRows[idx] = { ...newRows[idx], itemId: item.item_id, itemCode: item.item_code, itemName: item.item_name };
      setInputRows(newRows);
    } else {
      setInputRows([...inputRows, { ...createEmptyRow(), itemId: item.item_id, itemCode: item.item_code, itemName: item.item_name }]);
    }
  };

  const addRow = () => setInputRows([...inputRows, createEmptyRow()]);
  const removeRow = (id: string) => { if (inputRows.length > 1) setInputRows(inputRows.filter(row => row.id !== id)); };

  const updateRow = (id: string, field: keyof ReceivingInputRow, value: string | number) => {
    setInputRows(inputRows.map(row => {
      if (row.id !== id) return row;
      const updatedRow = { ...row, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = parseFloat(field === 'quantity' ? String(value) : row.quantity) || 0;
        const price = parseFloat(field === 'unitPrice' ? String(value) : row.unitPrice) || 0;
        updatedRow.amount = qty * price;
      }
      return updatedRow;
    }));
  };

  const handleBulkRegister = async () => {
    const validRows = inputRows.filter(row => row.itemId && parseFloat(row.quantity) > 0);
    if (validRows.length === 0) { toast.error('등록할 품목이 없습니다'); return; }
    if (!companyId && selectedTypeConfig?.hasSubType) { toast.error('공급업체를 선택해주세요'); return; }

    setIsSubmitting(true);
    try {
      const request: ReceivingRequest = {
        receiving_type: selectedType,
        receiving_sub_type: selectedSubType,
        work_date: workDate,
        company_id: companyId || undefined,
        items: validRows.map(row => ({
          item_id: row.itemId!,
          quantity: parseFloat(row.quantity),
          unit_price: parseFloat(row.unitPrice) || 0,
          total_amount: row.amount,
          ...(requiresWeight && {
            thickness: row.thickness ? parseFloat(row.thickness) : undefined,
            width: row.width ? parseFloat(row.width) : undefined,
            weight: row.weight ? parseFloat(row.weight) : undefined
          })
        }))
      };

      const response = await fetch('/api/inventory/receiving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (response.ok) {
        toast.success(`${validRows.length}건 입고 등록 완료`);
        setInputRows([createEmptyRow()]);
        loadTodayHistory();
      } else {
        const error = await response.json();
        toast.error(error.message || '등록 실패');
      }
    } catch (error) {
      console.error('등록 오류:', error);
      toast.error('등록 중 오류가 발생했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 메인 타입 버튼 */}
      <div className="grid grid-cols-4 gap-2">
        {RECEIVING_ROWS.map((row) => {
          const Icon = row.icon;
          const isSelected = selectedType === row.key;
          return (
            <button
              key={row.key}
              onClick={() => handleTypeChange(row.key)}
              className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                isSelected ? `${row.color} text-white border-transparent` : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              <Icon className={`w-6 h-6 mb-1 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
              <span className="text-sm font-medium">{row.label}</span>
            </button>
          );
        })}
      </div>

      {/* 서브타입 버튼 */}
      {selectedTypeConfig?.hasSubType && selectedTypeConfig.subTypes.length > 0 && (
        <div className="flex gap-2">
          {selectedTypeConfig.subTypes.map((sub) => (
            <button
              key={sub.key}
              onClick={() => handleSubTypeChange(sub.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                selectedSubType === sub.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {sub.label}
            </button>
          ))}
        </div>
      )}

      {/* 작업일자 & 공급업체 */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">작업일자</label>
          <input
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">공급업체</label>
          <CompanySelect
            value={companyId}
            onChange={setCompanyId}
            companyType="SUPPLIER"
            allowedCompanyNames={getCompanyFilter()}
            placeholder="공급업체 선택"
          />
        </div>
        <button
          onClick={() => { loadQuickSelectItems(); loadTodayHistory(); }}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          title="새로고침"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* 빠른 선택 */}
      <div className="bg-gray-50 rounded-lg p-3">
        <h4 className="text-sm font-medium text-gray-700 mb-2">빠른 선택</h4>
        {isLoading ? (
          <div className="text-sm text-gray-500">로딩 중...</div>
        ) : quickSelectItems.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {quickSelectItems.map((item) => (
              <button
                key={item.item_id}
                onClick={() => handleQuickSelect(item)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-sm hover:bg-blue-50 hover:border-blue-300"
              >
                {item.item_name}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">품목이 없습니다</div>
        )}
      </div>

      {/* 입력 테이블 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-10">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">품목</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">수량</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-28">단가</th>
              {requiresWeight && (
                <>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">두께</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">폭</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">중량(kg)</th>
                </>
              )}
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-28">금액</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {inputRows.map((row, index) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-sm text-gray-500">{index + 1}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={row.itemName}
                    readOnly
                    placeholder="빠른 선택에서 품목 선택"
                    className="w-full px-2 py-1 border border-gray-200 rounded text-sm bg-gray-50"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                    placeholder="0"
                    className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={row.unitPrice}
                    onChange={(e) => updateRow(row.id, 'unitPrice', e.target.value)}
                    placeholder="0"
                    className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right"
                  />
                </td>
                {requiresWeight && (
                  <>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.1"
                        value={row.thickness}
                        onChange={(e) => updateRow(row.id, 'thickness', e.target.value)}
                        placeholder="0.0"
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={row.width}
                        onChange={(e) => updateRow(row.id, 'width', e.target.value)}
                        placeholder="0"
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={row.weight}
                        onChange={(e) => updateRow(row.id, 'weight', e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right"
                      />
                    </td>
                  </>
                )}
                <td className="px-3 py-2 text-sm text-right font-medium">{row.amount.toLocaleString()}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => removeRow(row.id)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                    disabled={inputRows.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-t">
          <button
            onClick={addRow}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded"
          >
            <Plus className="w-4 h-4" /> 행 추가
          </button>
          <button
            onClick={handleBulkRegister}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            <Save className="w-4 h-4" /> {isSubmitting ? '등록 중...' : '일괄 등록'}
          </button>
        </div>
      </div>

      {/* 금일 입고 이력 */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">금일 입고 이력</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">전표번호</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">품목</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">공급업체</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">수량</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">단가</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">금액</th>
                {requiresWeight && <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">중량</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {todayHistory.length > 0 ? (
                todayHistory.map((item) => (
                  <tr key={item.transaction_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900">{item.transaction_no}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{item.item_name}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">{item.company_name || '-'}</td>
                    <td className="px-3 py-2 text-sm text-right">{item.quantity.toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm text-right">{item.unit_price.toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm text-right font-medium">{item.total_amount.toLocaleString()}</td>
                    {requiresWeight && <td className="px-3 py-2 text-sm text-right">{item.weight?.toLocaleString() || '-'}</td>}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={requiresWeight ? 7 : 6} className="px-3 py-8 text-center text-sm text-gray-500">
                    금일 입고 내역이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}