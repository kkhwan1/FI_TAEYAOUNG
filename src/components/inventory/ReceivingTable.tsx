'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Circle, Layers, Package, ShoppingCart, Plus, Trash2, Save, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import CompanySelect from '@/components/CompanySelect';
import ItemSelect from '@/components/ItemSelect';
import BOMRelationshipEditor from '@/components/inventory/BOMRelationshipEditor';
import { ItemForComponent } from '@/types/inventory';
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
    color: 'bg-gray-900 dark:bg-white',
    hasSubType: true,
    hasWeight: true,
    category: '원자재',
    inventoryType: '코일',
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
    color: 'bg-gray-700 dark:bg-gray-300',
    hasSubType: false,
    hasWeight: true,
    category: '원자재',
    inventoryType: '시트',
    subTypes: []
  },
  {
    key: 'SUBMATERIAL' as ReceivingType,
    label: '부자재',
    description: '부자재 입고',
    icon: Package,
    color: 'bg-gray-600 dark:bg-gray-400',
    hasSubType: true,
    hasWeight: false,
    category: '부자재',
    inventoryType: null,
    subTypes: [
      { key: 'TAECHANG' as ReceivingSubType, label: '사금', companyName: null },
      { key: 'PARTNER' as ReceivingSubType, label: '협력사', companyName: null }
    ]
  },
  {
    key: 'MARKET' as ReceivingType,
    label: '시중구매',
    description: '시중 구매 품목',
    icon: ShoppingCart,
    color: 'bg-gray-500 dark:bg-gray-500',
    hasSubType: false,
    hasWeight: false,
    category: '부자재',
    inventoryType: null,
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
  // 코일/시트 규격 정보
  thickness?: number | null;
  width?: number | null;
  height?: number | null;
  material?: string | null;
  spec?: string | null;
  mm_weight?: number | null;
  // 단가 정보
  unit_price?: number | null;
  price?: number | null;
}

interface QuickSelectState {
  selectedItemIds: Set<number>;
  quantities: Map<number, number>;
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
  // 빠른 선택 테이블용 상태
  const [selectedQuickItemIds, setSelectedQuickItemIds] = useState<Set<number>>(new Set());
  const [quickItemQuantities, setQuickItemQuantities] = useState<Map<number, number>>(new Map());
  const [quickItemUnitPrices, setQuickItemUnitPrices] = useState<Map<number, number>>(new Map());
  // BOM 관계 수정용 상태
  const [selectedItemForBOM, setSelectedItemForBOM] = useState<{ itemId: number; itemCode: string; itemName: string } | null>(null);
  const [dismissedBOMWarnings, setDismissedBOMWarnings] = useState<Set<number>>(new Set());

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
    // 빠른 선택 상태 초기화
    setSelectedQuickItemIds(new Set());
    setQuickItemQuantities(new Map());
    setQuickItemUnitPrices(new Map());
    // BOM 경고 상태 초기화
    setDismissedBOMWarnings(new Set());
    setSelectedItemForBOM(null);
  };

  const handleSubTypeChange = (subType: ReceivingSubType) => {
    setSelectedSubType(subType);
    setCompanyId(null);
    setInputRows([createEmptyRow()]);
    // 빠른 선택 상태 초기화
    setSelectedQuickItemIds(new Set());
    setQuickItemQuantities(new Map());
    setQuickItemUnitPrices(new Map());
    // BOM 경고 상태 초기화
    setDismissedBOMWarnings(new Set());
    setSelectedItemForBOM(null);
  };

  const loadQuickSelectItems = useCallback(async () => {
    if (!selectedTypeConfig) return;
    setIsLoading(true);
    try {
      let url = `/api/items?category=${encodeURIComponent(selectedTypeConfig.category)}&limit=50`;
      if (selectedTypeConfig.inventoryType) {
        url += `&inventory_type=${encodeURIComponent(selectedTypeConfig.inventoryType)}`;
      }
      // 공급업체가 선택된 경우 해당 업체의 품목만 조회
      if (companyId) {
        url += `&supplier_id=${companyId}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        // API 응답 구조: { success: true, data: { items: [...], pagination: {...} } }
        setQuickSelectItems(data.data?.items || data.data || []);
      }
    } catch (error) {
      console.error('품목 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTypeConfig, companyId]);

  const loadTodayHistory = useCallback(async () => {
    try {
      // API uses start_date/end_date parameters
      const response = await fetch(`/api/inventory/receiving?start_date=${workDate}&end_date=${workDate}`);
      if (response.ok) {
        const data = await response.json();
        // API returns {transactions: [...], summary: {...}}
        const transactions = data.data?.transactions || [];

        // 선택된 타입의 notes로 시작하는 항목만 필터링
        // notes 형식: "COIL-TAECHANG", "MARKET", "SUBMATERIAL-PARTNER" 등
        const filteredTransactions = transactions.filter((t: ReceivingHistoryItem & { notes?: string }) => {
          if (!t.notes) return false;
          return t.notes.startsWith(selectedType);
        });

        setTodayHistory(filteredTransactions);
      }
    } catch (error) {
      console.error('이력 로드 실패:', error);
    }
  }, [workDate, selectedType]);

  useEffect(() => {
    loadQuickSelectItems();
    loadTodayHistory();
  }, [loadQuickSelectItems, loadTodayHistory]);

  // BroadcastChannel을 통한 품목 업데이트 수신
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('items-update');
      channel.onmessage = (event) => {
        console.log('품목 업데이트 수신:', event.data);
        // 품목 목록 새로고침
        loadQuickSelectItems();
      };
      return () => channel.close();
    } catch (error) {
      // BroadcastChannel 미지원 브라우저에서는 조용히 실패
      console.warn('BroadcastChannel not supported:', error);
    }
  }, [loadQuickSelectItems]);

  // 빠른 선택 테이블 핸들러
  const handleQuickItemToggle = (itemId: number) => {
    const newSelected = new Set(selectedQuickItemIds);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
      const newQuantities = new Map(quickItemQuantities);
      newQuantities.delete(itemId);
      setQuickItemQuantities(newQuantities);
      const newPrices = new Map(quickItemUnitPrices);
      newPrices.delete(itemId);
      setQuickItemUnitPrices(newPrices);
    } else {
      newSelected.add(itemId);
    }
    setSelectedQuickItemIds(newSelected);
  };

  const handleSelectAllQuickItems = () => {
    if (selectedQuickItemIds.size === quickSelectItems.length) {
      setSelectedQuickItemIds(new Set());
      setQuickItemQuantities(new Map());
      setQuickItemUnitPrices(new Map());
    } else {
      setSelectedQuickItemIds(new Set(quickSelectItems.map(item => item.item_id)));
    }
  };

  const handleAddSelectedItems = () => {
    if (selectedQuickItemIds.size === 0) {
      toast.error('품목을 선택해주세요');
      return;
    }

    const itemsToAdd = quickSelectItems.filter(item => selectedQuickItemIds.has(item.item_id));
    const newRows = [...inputRows];

    itemsToAdd.forEach(item => {
      const quantity = quickItemQuantities.get(item.item_id) || 0;
      // 빠른 선택에서 입력한 단가가 있으면 사용, 없으면 품목 마스터 단가 사용
      const unitPrice = quickItemUnitPrices.get(item.item_id)
        || item.unit_price
        || item.price
        || 0;
      const rowData: ReceivingInputRow = {
        ...createEmptyRow(),
        itemId: item.item_id,
        itemCode: item.item_code,
        itemName: item.item_name,
        quantity: quantity > 0 ? String(quantity) : '',
        unitPrice: unitPrice > 0 ? String(unitPrice) : '',
        amount: quantity * unitPrice,
        thickness: item.thickness ? String(item.thickness) : '',
        width: item.width ? String(item.width) : ''
      };

      // 빈 행이 있으면 채우고, 없으면 추가
      const emptyIdx = newRows.findIndex(row => !row.itemId);
      if (emptyIdx >= 0) {
        newRows[emptyIdx] = rowData;
      } else {
        newRows.push(rowData);
      }
    });

    setInputRows(newRows);
    setSelectedQuickItemIds(new Set());
    setQuickItemQuantities(new Map());
    setQuickItemUnitPrices(new Map());
    toast.success(`${itemsToAdd.length}개 품목 추가 완료`);
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
    // 코일/시트 등 중량 기반 품목은 weight 필드 사용, 그 외는 quantity 필드 사용
    const validRows = inputRows.filter(row => {
      if (!row.itemId) return false;
      const hasQuantity = parseFloat(row.quantity) > 0;
      const hasWeight = parseFloat(row.weight || '0') > 0;
      return requiresWeight ? (hasQuantity || hasWeight) : hasQuantity;
    });
    if (validRows.length === 0) {
      toast.error(requiresWeight ? '중량 또는 수량을 입력해주세요' : '등록할 품목이 없습니다');
      return;
    }
    if (!companyId && selectedTypeConfig?.hasSubType) { toast.error('공급업체를 선택해주세요'); return; }

    setIsSubmitting(true);
    try {
      const request: ReceivingRequest = {
        receiving_type: selectedType,
        receiving_sub_type: selectedSubType,
        work_date: workDate,
        company_id: companyId || undefined,
        items: validRows.map(row => {
          // 중량 기반 품목: quantity가 비어있으면 weight를 quantity로 사용
          const qty = parseFloat(row.quantity) || 0;
          const wgt = parseFloat(row.weight || '0') || 0;
          const finalQuantity = requiresWeight && qty === 0 && wgt > 0 ? wgt : qty;

          return {
            item_id: row.itemId!,
            quantity: finalQuantity,
            unit_price: parseFloat(row.unitPrice) || 0,
            total_amount: row.amount || finalQuantity * (parseFloat(row.unitPrice) || 0),
            ...(requiresWeight && {
              thickness: row.thickness ? parseFloat(row.thickness) : undefined,
              width: row.width ? parseFloat(row.width) : undefined,
              weight: wgt || undefined
            })
          };
        })
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
                selectedSubType === sub.key ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
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
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <h4 className="text-sm font-medium text-gray-700">빠른 선택</h4>
          {selectedQuickItemIds.size > 0 && (
            <button
              onClick={handleAddSelectedItems}
              className="px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm rounded-md hover:bg-gray-800 dark:hover:bg-gray-100 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              선택 품목 추가 ({selectedQuickItemIds.size})
            </button>
          )}
        </div>
        {isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">로딩 중...</div>
        ) : quickSelectItems.length > 0 ? (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-12">
                    <input
                      type="checkbox"
                      checked={selectedQuickItemIds.size === quickSelectItems.length && quickSelectItems.length > 0}
                      onChange={handleSelectAllQuickItems}
                      className="w-4 h-4 text-gray-900 bg-gray-100 border-gray-300 rounded focus:ring-gray-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[120px]">품번</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[180px]">품명</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-28">
                    규격 (두께×폭)
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">수량</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">단가</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">단위</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {quickSelectItems.map((item) => {
                  const isSelected = selectedQuickItemIds.has(item.item_id);
                  const isAlreadyAdded = inputRows.some(row => row.itemId === item.item_id);

                  return (
                    <tr
                      key={item.item_id}
                      className={`hover:bg-gray-50 transition-colors ${
                        isAlreadyAdded ? 'opacity-50 bg-gray-100' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleQuickItemToggle(item.item_id)}
                          disabled={isAlreadyAdded}
                          className="w-4 h-4 text-gray-900 bg-gray-100 border-gray-300 rounded focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600"
                        />
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900">
                        {item.item_code}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900">
                        {item.item_name}
                        {isAlreadyAdded && (
                          <span className="ml-2 text-xs text-gray-500">(이미 추가됨)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-center text-gray-600">
                        {(item.thickness || item.width) ? (
                          <span>
                            {item.thickness || '-'} × {item.width || '-'}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          min="0"
                          value={quickItemQuantities.get(item.item_id) || ''}
                          onChange={(e) => {
                            const newQuantities = new Map(quickItemQuantities);
                            const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                            newQuantities.set(item.item_id, value);
                            setQuickItemQuantities(newQuantities);
                          }}
                          className="w-full px-2 py-1 text-sm text-right border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                          placeholder="수량"
                          disabled={isAlreadyAdded}
                        />
                      </td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          min="0"
                          value={quickItemUnitPrices.get(item.item_id) ?? (item.unit_price || item.price || '')}
                          onChange={(e) => {
                            const newPrices = new Map(quickItemUnitPrices);
                            const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            newPrices.set(item.item_id, value);
                            setQuickItemUnitPrices(newPrices);
                          }}
                          className="w-full px-2 py-1 text-sm text-right border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                          placeholder="단가"
                          disabled={isAlreadyAdded}
                        />
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-500">
                        {item.unit || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-gray-500">품목이 없습니다</div>
        )}
      </div>

      {/* BOM 관계 수정 경고 */}
      {selectedItemForBOM && companyId && !dismissedBOMWarnings.has(selectedItemForBOM.itemId) && (
        <BOMRelationshipEditor
          itemId={selectedItemForBOM.itemId}
          itemCode={selectedItemForBOM.itemCode}
          itemName={selectedItemForBOM.itemName}
          mode="receiving"
          expectedCompanyId={companyId}
          onUpdate={() => {
            loadQuickSelectItems();
            setSelectedItemForBOM(null);
          }}
          onDismiss={() => {
            setDismissedBOMWarnings(prev => new Set(prev).add(selectedItemForBOM.itemId));
            setSelectedItemForBOM(null);
          }}
        />
      )}

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
                  <ItemSelect
                    value={row.itemId || undefined}
                    onChange={(item: ItemForComponent | null) => {
                      if (item) {
                        const newRows = [...inputRows];
                        const idx = newRows.findIndex(r => r.id === row.id);
                        if (idx >= 0) {
                          // 품목 마스터 단가 가져오기
                          const masterPrice = item.unit_price || 0;
                          const qty = parseFloat(newRows[idx].quantity) || 0;
                          newRows[idx] = {
                            ...newRows[idx],
                            itemId: item.item_id,
                            itemCode: item.item_code,
                            itemName: item.item_name,
                            // 코일/시트의 경우 규격 정보 자동 입력
                            thickness: item.thickness ? String(item.thickness) : newRows[idx].thickness,
                            width: item.width ? String(item.width) : newRows[idx].width,
                            // 품목 마스터 단가 자동 입력
                            unitPrice: masterPrice > 0 ? String(masterPrice) : newRows[idx].unitPrice,
                            // 금액 자동 계산
                            amount: qty * (masterPrice || parseFloat(newRows[idx].unitPrice) || 0)
                          };
                          setInputRows(newRows);
                        }
                      } else {
                        updateRow(row.id, 'itemId', 0);
                        updateRow(row.id, 'itemCode', '');
                        updateRow(row.id, 'itemName', '');
                      }
                    }}
                    supplierId={companyId || undefined}
                    itemType="ALL"
                    placeholder="품목 검색..."
                    label=""
                    showPrice={true}
                    className="min-w-[200px]"
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
                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded"
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
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <Plus className="w-4 h-4" /> 행 추가
          </button>
          <button
            onClick={handleBulkRegister}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-md hover:bg-gray-800 dark:hover:bg-gray-100 disabled:bg-gray-400 disabled:dark:bg-gray-600"
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