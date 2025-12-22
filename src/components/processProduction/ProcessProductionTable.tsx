'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, Calculator, Scissors, Hammer, Flame, Paintbrush, Plus, Trash2, CheckCircle, Loader2, Zap, Package } from 'lucide-react';
import ConversionCalculator from './ConversionCalculator';
import ProcessProductionHistory from './ProcessProductionHistory';
import CompanySelect from '@/components/CompanySelect';
import MultiItemSelect from '@/components/MultiItemSelect';
import type { ProcessType, ProcessProductionRequest } from '@/types/processProduction';
import type { ItemForComponent } from '@/types/inventory';
import toast from 'react-hot-toast';

// 빠른 선택용 BOM 품목 인터페이스
interface QuickSelectItem {
  bom_id: number;
  quantity_required: number;
  output: {
    item_id: number;
    item_code: string;
    item_name: string;
    category: string | null;
    unit: string | null;
    vehicle_model: string | null;
  };
  input: {
    item_id: number;
    item_code: string;
    item_name: string;
    category: string | null;
    unit: string | null;
    vehicle_model: string | null;
  };
}

interface ProcessProductionTableProps {
  onSuccess?: () => void;
}

// 입력 행 인터페이스
interface InputRow {
  id: string;
  inputItemId: number | null;
  inputItemCode: string;
  inputItemName: string;
  inputQty: string;
  outputItemId: number | null;
  outputItemCode: string;
  outputItemName: string;
  outputQty: string;
}

const PROCESS_ROWS = [
  {
    processType: 'BLANKING' as ProcessType,
    processName: '블랭킹',
    inputUnit: 'KG',
    outputUnit: 'EA',
    icon: Scissors,
    description: '코일 → 블랭크',
    color: 'bg-gray-100 dark:bg-gray-800 border border-gray-300'
  },
  {
    processType: 'PRESS' as ProcessType,
    processName: '프레스',
    inputUnit: 'EA',
    outputUnit: 'EA',
    icon: Hammer,
    description: '블랭크 → 성형품',
    color: 'bg-gray-50 dark:bg-gray-900 border border-gray-400'
  },
  {
    processType: 'WELD' as ProcessType,
    processName: '용접',
    inputUnit: 'EA',
    outputUnit: 'EA',
    icon: Flame,
    description: '성형품 → 용접품',
    color: 'bg-gray-100 dark:bg-gray-800 border border-gray-400'
  },
  {
    processType: 'PAINT' as ProcessType,
    processName: '도장',
    inputUnit: 'EA',
    outputUnit: 'EA',
    icon: Paintbrush,
    description: '용접품 → 완제품',
    color: 'bg-gray-200 dark:bg-gray-700 border border-gray-400'
  },
];

// 빈 행 생성 함수
const createEmptyRow = (): InputRow => ({
  id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  inputItemId: null,
  inputItemCode: '',
  inputItemName: '',
  inputQty: '',
  outputItemId: null,
  outputItemCode: '',
  outputItemName: '',
  outputQty: ''
});

export default function ProcessProductionTable({ onSuccess }: ProcessProductionTableProps) {
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState<ProcessType | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [customerId, setCustomerId] = useState<number | null>(null);
  // 선택된 공정 상태 추가
  const [selectedProcess, setSelectedProcess] = useState<ProcessType>('BLANKING');
  // P0-2: 환산기에서 전달받은 수량 (블랭킹용)
  const [blankingInputQty, setBlankingInputQty] = useState<number | null>(null);
  const [blankingOutputQty, setBlankingOutputQty] = useState<number | null>(null);
  // P2: 이력 그리드 새로고침 트리거
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);
  // 다중 입력 행 관리
  const [inputRows, setInputRows] = useState<InputRow[]>([createEmptyRow()]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  // 빠른 선택 품목
  const [quickSelectItems, setQuickSelectItems] = useState<QuickSelectItem[]>([]);
  const [isLoadingQuickSelect, setIsLoadingQuickSelect] = useState(false);

  // 납품처/공정 변경 시 빠른 선택 품목 조회
  useEffect(() => {
    if (!customerId) {
      setQuickSelectItems([]);
      return;
    }

    const fetchQuickSelectItems = async () => {
      setIsLoadingQuickSelect(true);
      try {
        const params = new URLSearchParams({
          customer_id: customerId.toString(),
          process_type: selectedProcess
        });
        const response = await fetch(`/api/bom/by-customer?${params}`);
        const result = await response.json();

        if (result.success) {
          setQuickSelectItems(result.data || []);
        } else {
          setQuickSelectItems([]);
        }
      } catch (error) {
        console.error('빠른 선택 품목 조회 실패:', error);
        setQuickSelectItems([]);
      } finally {
        setIsLoadingQuickSelect(false);
      }
    };

    fetchQuickSelectItems();
  }, [customerId, selectedProcess]);

  // P2: 이력 그리드 새로고침
  const refreshHistory = useCallback(() => {
    setHistoryRefreshTrigger(prev => prev + 1);
  }, []);

  // 산출 품목 변경 시 납품처 자동 설정
  // 성능 최적화: ProcessRowInput에서 BOM 조회 시 customer_id도 함께 추출하여 전달 (중복 API 호출 제거)
  const handleOutputItemChange = useCallback((_itemIds: number[], bomCustomerId?: number) => {
    if (bomCustomerId) {
      setCustomerId(bomCustomerId);
      toast.success('납품처 자동 설정됨', { duration: 1500 });
    }
  }, []);

  const handleSubmit = async (data: ProcessProductionRequest) => {
    setIsLoading(data.process_type);
    try {
      const response = await fetch('/api/process-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, work_date: workDate, customer_id: customerId || undefined })
      });
      const result = await response.json();

      if (result.success) {
        toast.success(result.message || '생산등록 완료');
        if (result.warnings?.length > 0) {
          result.warnings.forEach((w: string) => toast(w, { duration: 4000 }));
        }
        // P2: 이력 그리드 새로고침
        refreshHistory();
        onSuccess?.();
      } else {
        toast.error(result.error || '생산등록 실패');
      }
    } catch {
      toast.error('오류 발생');
    } finally {
      setIsLoading(null);
    }
  };

  // 선택된 공정 정보 가져오기
  const selectedProcessInfo = PROCESS_ROWS.find(r => r.processType === selectedProcess);

  // 행 추가
  const handleAddRow = useCallback(() => {
    setInputRows(prev => [...prev, createEmptyRow()]);
  }, []);

  // 행 삭제
  const handleRemoveRow = useCallback((rowId: string) => {
    setInputRows(prev => {
      if (prev.length <= 1) return prev; // 최소 1개 행 유지
      return prev.filter(row => row.id !== rowId);
    });
  }, []);

  // 행 업데이트
  const handleUpdateRow = useCallback((rowId: string, field: keyof InputRow, value: string | number | null) => {
    setInputRows(prev => prev.map(row =>
      row.id === rowId ? { ...row, [field]: value } : row
    ));
  }, []);

  // 유효한 행만 필터링 (투입/산출 품목과 수량이 모두 있는 행)
  const validRows = inputRows.filter(row =>
    row.inputItemId && row.outputItemId &&
    row.inputQty && parseFloat(row.inputQty) > 0 &&
    row.outputQty && parseFloat(row.outputQty) > 0
  );

  // 총계 계산
  const totalInputQty = inputRows.reduce((sum, row) => {
    const qty = parseFloat(row.inputQty) || 0;
    return sum + qty;
  }, 0);

  const totalOutputQty = inputRows.reduce((sum, row) => {
    const qty = parseFloat(row.outputQty) || 0;
    return sum + qty;
  }, 0);

  // 일괄 등록
  const handleBulkRegister = async () => {
    if (validRows.length === 0) {
      toast.error('등록할 유효한 행이 없습니다');
      return;
    }

    setIsBulkLoading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const row of validRows) {
        const data: ProcessProductionRequest = {
          process_type: selectedProcess,
          work_date: workDate,
          input_item_id: row.inputItemId!,
          input_quantity: parseFloat(row.inputQty),
          output_item_id: row.outputItemId!,
          output_quantity: parseInt(row.outputQty),
          scrap_quantity: 0,
          quality_status: 'OK'
        };

        try {
          const response = await fetch('/api/process-production', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, customer_id: customerId || undefined })
          });
          const result = await response.json();

          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount}건 등록 완료${failCount > 0 ? `, ${failCount}건 실패` : ''}`);
        // 성공한 행 초기화
        setInputRows([createEmptyRow()]);
        refreshHistory();
        onSuccess?.();
      } else {
        toast.error('등록 실패');
      }
    } finally {
      setIsBulkLoading(false);
    }
  };

  // 공정 변경 시 행 초기화
  const handleProcessChange = useCallback((processType: ProcessType) => {
    setSelectedProcess(processType);
    setInputRows([createEmptyRow()]);
  }, []);

  // 빠른 선택 품목 클릭 시 행에 자동 입력
  const handleQuickSelect = useCallback((item: QuickSelectItem) => {
    // 현재 빈 행 찾기 (투입/산출 품목이 모두 비어있는 행)
    const emptyRowIndex = inputRows.findIndex(row =>
      !row.inputItemId && !row.outputItemId
    );

    if (emptyRowIndex >= 0) {
      // 빈 행이 있으면 해당 행에 입력
      const rowId = inputRows[emptyRowIndex].id;
      setInputRows(prev => prev.map(row =>
        row.id === rowId ? {
          ...row,
          inputItemId: item.input.item_id,
          inputItemCode: item.input.item_code,
          inputItemName: item.input.item_name,
          inputQty: '',
          outputItemId: item.output.item_id,
          outputItemCode: item.output.item_code,
          outputItemName: item.output.item_name,
          outputQty: ''
        } : row
      ));
    } else {
      // 빈 행이 없으면 새 행 추가
      const newRow: InputRow = {
        id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        inputItemId: item.input.item_id,
        inputItemCode: item.input.item_code,
        inputItemName: item.input.item_name,
        inputQty: '',
        outputItemId: item.output.item_id,
        outputItemCode: item.output.item_code,
        outputItemName: item.output.item_name,
        outputQty: ''
      };
      setInputRows(prev => [...prev, newRow]);
    }

    toast.success(`${item.output.item_name} 추가됨`, { duration: 1500 });
  }, [inputRows]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">공정별 생산등록 (반제품)</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            코일 - 블랭킹 - 프레스 - 용접 - 도장
          </span>
        </div>
      </div>

      {/* 공정 선택 버튼 그리드 */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-4 gap-2">
          {PROCESS_ROWS.map((row) => {
            const Icon = row.icon;
            const isSelected = selectedProcess === row.processType;
            return (
              <button
                key={row.processType}
                type="button"
                onClick={() => handleProcessChange(row.processType)}
                className={`
                  flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all
                  ${isSelected
                    ? `${row.color} border-transparent text-white shadow-md`
                    : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                <Icon className={`w-6 h-6 mb-1 ${isSelected ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                <span className="font-semibold text-sm">{row.processName}</span>
                <span className={`text-xs mt-0.5 ${isSelected ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                  {row.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 환산기 토글 섹션 - 블랭킹 선택 시에만 표시 */}
      {selectedProcess === 'BLANKING' && (
        <div className="border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setShowCalculator(!showCalculator)}
            className="w-full px-4 py-2 flex items-center justify-between text-sm text-left bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="font-medium text-gray-700 dark:text-gray-300">중량↔수량 환산기 (블랭킹 전용)</span>
            </div>
            <span className="text-gray-600 dark:text-gray-400">{showCalculator ? '접기 ▲' : '펼치기 ▼'}</span>
          </button>

          {showCalculator && (
            <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50">
              <ConversionCalculator
                onApplyInputQty={(kgValue) => {
                  setBlankingInputQty(kgValue);
                  toast.success(`투입 수량 ${kgValue.toLocaleString()} kg 적용됨`, { duration: 2000 });
                }}
                onApplyOutputQty={(eaValue) => {
                  setBlankingOutputQty(eaValue);
                  toast.success(`산출 수량 ${eaValue.toLocaleString()} EA 적용됨`, { duration: 2000 });
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* 작업일자 및 납품처 */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">작업일자</label>
          <input
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
          />
        </div>
        <div className="flex items-center gap-2 min-w-[250px]">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">납품처</label>
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

      {/* 빠른 선택 섹션 - 납품처 선택 시에만 표시 */}
      {customerId && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              빠른 선택
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              (클릭하면 자동 입력)
            </span>
          </div>

          {isLoadingQuickSelect ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              품목 로딩 중...
            </div>
          ) : quickSelectItems.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {quickSelectItems.map((item) => (
                <button
                  key={item.bom_id}
                  type="button"
                  onClick={() => handleQuickSelect(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all shadow-sm group"
                >
                  <Package className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {item.output.item_name}
                  </span>
                  {item.output.vehicle_model && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      ({item.output.vehicle_model})
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Package className="w-4 h-4" />
              {selectedProcessInfo?.processName} 공정에 해당하는 품목이 없습니다
            </div>
          )}
        </div>
      )}

      {/* 다중 입력 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">
              <th className="px-2 py-2.5 text-center font-semibold w-10">#</th>
              <th className="px-2 py-2.5 text-left font-semibold">투입 품목</th>
              <th className="px-2 py-2.5 text-center font-semibold w-28">투입 수량</th>
              <th className="px-2 py-2.5 text-left font-semibold">산출 품목</th>
              <th className="px-2 py-2.5 text-center font-semibold w-28">산출 수량</th>
              <th className="px-2 py-2.5 text-center font-semibold w-16">삭제</th>
            </tr>
          </thead>
          <tbody>
            {inputRows.map((row, index) => {
              // 투입 품목 타입 결정
              const inputItemType = selectedProcess === 'BLANKING' ? 'RAW_MATERIAL' : 'SEMI_PRODUCT';
              // 산출 품목 타입 결정
              const outputItemType = selectedProcess === 'PAINT' ? 'PRODUCT' : 'SEMI_PRODUCT';

              return (
                <tr key={row.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  {/* 행 번호 */}
                  <td className="px-2 py-2 text-center text-sm text-gray-500 dark:text-gray-400">
                    {index + 1}
                  </td>

                  {/* 투입 품목 */}
                  <td className="px-2 py-2">
                    <div className="min-w-[180px]">
                      <MultiItemSelect
                        value={row.inputItemId ? [row.inputItemId] : []}
                        onChange={(items: ItemForComponent[]) => {
                          if (items.length > 0) {
                            const item = items[0];
                            handleUpdateRow(row.id, 'inputItemId', item.item_id);
                            handleUpdateRow(row.id, 'inputItemCode', item.item_code);
                            handleUpdateRow(row.id, 'inputItemName', item.item_name);
                          } else {
                            handleUpdateRow(row.id, 'inputItemId', null);
                            handleUpdateRow(row.id, 'inputItemCode', '');
                            handleUpdateRow(row.id, 'inputItemName', '');
                          }
                        }}
                        placeholder="투입 품목 검색..."
                        itemType={inputItemType}
                        maxSelection={1}
                        className="text-sm"
                      />
                    </div>
                  </td>

                  {/* 투입 수량 */}
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1 justify-center">
                      <input
                        type="number"
                        value={row.inputQty}
                        onChange={(e) => handleUpdateRow(row.id, 'inputQty', e.target.value)}
                        className="w-20 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-right text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500"
                        placeholder="0"
                        min="0"
                        step={selectedProcessInfo?.inputUnit === 'KG' ? '0.01' : '1'}
                      />
                      <span className="text-xs text-gray-500 w-6">{selectedProcessInfo?.inputUnit}</span>
                    </div>
                  </td>

                  {/* 산출 품목 */}
                  <td className="px-2 py-2">
                    <div className="min-w-[180px]">
                      <MultiItemSelect
                        value={row.outputItemId ? [row.outputItemId] : []}
                        onChange={(items: ItemForComponent[]) => {
                          if (items.length > 0) {
                            const item = items[0];
                            handleUpdateRow(row.id, 'outputItemId', item.item_id);
                            handleUpdateRow(row.id, 'outputItemCode', item.item_code);
                            handleUpdateRow(row.id, 'outputItemName', item.item_name);
                          } else {
                            handleUpdateRow(row.id, 'outputItemId', null);
                            handleUpdateRow(row.id, 'outputItemCode', '');
                            handleUpdateRow(row.id, 'outputItemName', '');
                          }
                        }}
                        placeholder="산출 품목 검색..."
                        itemType={outputItemType}
                        maxSelection={1}
                        className="text-sm"
                      />
                    </div>
                  </td>

                  {/* 산출 수량 */}
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1 justify-center">
                      <input
                        type="number"
                        value={row.outputQty}
                        onChange={(e) => handleUpdateRow(row.id, 'outputQty', e.target.value)}
                        className="w-20 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-right text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500"
                        placeholder="0"
                        min="0"
                        step="1"
                      />
                      <span className="text-xs text-gray-500 w-6">{selectedProcessInfo?.outputUnit}</span>
                    </div>
                  </td>

                  {/* 삭제 버튼 */}
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      disabled={inputRows.length <= 1}
                      className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="행 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* 총계 행 */}
            <tr className="bg-gray-50 dark:bg-gray-700/50 font-semibold">
              <td colSpan={2} className="px-3 py-2 text-right text-sm text-gray-700 dark:text-gray-300">
                총계 ({inputRows.length}건)
              </td>
              <td className="px-2 py-2 text-center text-sm text-gray-900 dark:text-white font-medium">
                {totalInputQty.toLocaleString()} {selectedProcessInfo?.inputUnit}
              </td>
              <td className="px-2 py-2"></td>
              <td className="px-2 py-2 text-center text-sm text-gray-900 dark:text-white font-medium">
                {totalOutputQty.toLocaleString()} {selectedProcessInfo?.outputUnit}
              </td>
              <td className="px-2 py-2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 행 추가 및 일괄 등록 버튼 */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <button
          type="button"
          onClick={handleAddRow}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          행 추가
        </button>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            유효 {validRows.length}건 / 전체 {inputRows.length}건
          </span>
          <button
            type="button"
            onClick={handleBulkRegister}
            disabled={isBulkLoading || validRows.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isBulkLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                등록 중...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                전체 등록 ({validRows.length}건)
              </>
            )}
          </button>
        </div>
      </div>

      {/* 푸터 안내 - 선택된 공정 정보 강조 */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${selectedProcessInfo?.color || 'bg-gray-400'}`}></span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            현재 공정: {selectedProcessInfo?.processName} ({selectedProcessInfo?.description})
          </span>
        </div>
      </div>

      {/* P2: 작업일자 기준 생산 이력 그리드 */}
      <div className="mt-4">
        <ProcessProductionHistory
          refreshTrigger={historyRefreshTrigger}
          onRefresh={refreshHistory}
          workDate={workDate}
        />
      </div>
    </div>
  );
}
