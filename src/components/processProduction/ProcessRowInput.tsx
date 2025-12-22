'use client';

import React, { useState } from 'react';
import { Check, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react';
import MultiItemSelect from '@/components/MultiItemSelect';
import type { ProcessType, ProcessProductionRequest } from '@/types/processProduction';
import type { ItemForComponent } from '@/types/inventory';
import toast from 'react-hot-toast';

interface ItemWithQty {
  item: ItemForComponent;
  qty: string;
}

interface ProcessRowInputProps {
  processType: ProcessType;
  processName: string;
  inputUnit: string;
  outputUnit: string;
  onSubmit: (data: ProcessProductionRequest) => Promise<void>;
  isLoading?: boolean;
  onOutputItemChange?: (itemIds: number[], bomCustomerId?: number) => void;  // 산출 품목 변경 시 콜백 (BOM에서 추출한 납품처 ID 포함)
  externalInputQty?: number | null;  // P0-2: 환산기에서 전달받은 투입 수량
  externalOutputQty?: number | null;  // P0-2: 환산기에서 전달받은 산출 수량
}

export default function ProcessRowInput({
  processType,
  processName,
  inputUnit,
  outputUnit,
  onSubmit,
  isLoading,
  onOutputItemChange,
  externalInputQty,
  externalOutputQty
}: ProcessRowInputProps) {
  const [inputItems, setInputItems] = useState<ItemWithQty[]>([]);
  const [outputItems, setOutputItems] = useState<ItemWithQty[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingBom, setIsLoadingBom] = useState(false);

  // P0-2: 외부에서 전달받은 투입 수량 적용
  React.useEffect(() => {
    if (externalInputQty !== undefined && externalInputQty !== null && inputItems.length > 0) {
      setInputItems(prev => prev.map(p => ({ ...p, qty: externalInputQty.toString() })));
    }
  }, [externalInputQty]);

  // P0-2: 외부에서 전달받은 산출 수량 적용
  React.useEffect(() => {
    if (externalOutputQty !== undefined && externalOutputQty !== null && outputItems.length > 0) {
      setOutputItems(prev => prev.map(p => ({ ...p, qty: Math.floor(externalOutputQty).toString() })));
    }
  }, [externalOutputQty]);

  // 블랭킹: 원자재(코일) → 반제품(블랭크)
  // 프레스/용접: 반제품 → 반제품
  // 도장: 반제품 → 제품
  const inputItemType = processType === 'BLANKING' ? 'RAW_MATERIAL' : 'SEMI_PRODUCT';
  const outputItemType = processType === 'PAINT' ? 'PRODUCT' : 'SEMI_PRODUCT';

  // 공정별 배경색
  const rowBgClass = {
    'BLANKING': 'bg-gray-50 dark:bg-gray-900/10',
    'PRESS': 'bg-gray-50 dark:bg-gray-900/10',
    'WELD': 'bg-gray-50 dark:bg-gray-900/10',
    'PAINT': 'bg-gray-50 dark:bg-gray-900/10'
  }[processType] || '';

  // 투입 품목 선택 변경 핸들러
  const handleInputItemsChange = (items: ItemForComponent[]) => {
    setInputItems(prev => {
      const newItems: ItemWithQty[] = items.map(item => {
        const existing = prev.find(p => p.item.item_id === item.item_id);
        return existing || { item, qty: '' };
      });
      return newItems;
    });
  };

  // 산출 품목 선택 변경 핸들러
  const handleOutputItemsChange = async (items: ItemForComponent[]) => {
    setOutputItems(prev => {
      const newItems: ItemWithQty[] = items.map(item => {
        const existing = prev.find(p => p.item.item_id === item.item_id);
        return existing || { item, qty: '' };
      });
      return newItems;
    });

    // P0-1: 역방향 BOM 조회 - 산출 품목(parent)에서 투입 품목(child) + 납품처(customer_id) 자동 조회
    // 성능 최적화: 하나의 API 호출로 투입 품목 + 납품처 모두 처리 (중복 호출 제거)
    if (items.length > 0) {
      setIsLoadingBom(true);
      try {
        const response = await fetch(`/api/bom?parent_item_id=${items[0].item_id}`);
        const result = await response.json();

        let bomCustomerId: number | undefined;

        if (result.success && result.data?.length > 0) {
          const bomData = result.data[0];

          // 납품처 ID 추출 (BOM에서)
          bomCustomerId = bomData.customer_id;

          // 투입 품목이 비어있을 때만 자동 설정
          if (inputItems.length === 0) {
            const childItems = result.data
              .filter((bom: any) => bom.child && bom.child.item_id)
              .map((bom: any) => ({
                item: {
                  item_id: bom.child.item_id,
                  item_code: bom.child.item_code || '',
                  item_name: bom.child.item_name || '',
                  unit: bom.child.unit || 'EA',
                  unit_price: bom.child.unit_price || 0
                } as ItemForComponent,
                qty: ''
              }));

            if (childItems.length > 0) {
              setInputItems(childItems);
            }
          }
        }

        // 부모 컴포넌트에 알림 (품목 ID + BOM 납품처 ID 함께 전달)
        if (onOutputItemChange) {
          onOutputItemChange(items.map(item => item.item_id), bomCustomerId);
        }
      } catch (error) {
        console.error('BOM 조회 실패:', error);
        // 오류 시에도 품목 ID는 전달
        if (onOutputItemChange) {
          onOutputItemChange(items.map(item => item.item_id));
        }
      } finally {
        setIsLoadingBom(false);
      }
    } else {
      // 품목이 없을 때 콜백 호출
      if (onOutputItemChange) {
        onOutputItemChange([]);
      }
    }
  };

  // 수량 변경 핸들러
  const handleInputQtyChange = (itemId: number, qty: string) => {
    setInputItems(prev => prev.map(p =>
      p.item.item_id === itemId ? { ...p, qty } : p
    ));
  };

  const handleOutputQtyChange = (itemId: number, qty: string) => {
    setOutputItems(prev => prev.map(p =>
      p.item.item_id === itemId ? { ...p, qty } : p
    ));
  };

  // 품목 제거 핸들러
  const handleRemoveInput = (itemId: number) => {
    setInputItems(prev => prev.filter(p => p.item.item_id !== itemId));
  };

  const handleRemoveOutput = (itemId: number) => {
    setOutputItems(prev => prev.filter(p => p.item.item_id !== itemId));
  };

  // 일괄 수량 적용
  const handleApplyAllInputQty = (qty: string) => {
    setInputItems(prev => prev.map(p => ({ ...p, qty })));
  };

  const handleApplyAllOutputQty = (qty: string) => {
    setOutputItems(prev => prev.map(p => ({ ...p, qty })));
  };

  // 단가 변경 핸들러 (DB 업데이트)
  const handlePriceChange = async (itemId: number, newPrice: string, isInput: boolean) => {
    const priceValue = parseFloat(newPrice);
    if (isNaN(priceValue) || priceValue < 0) return;

    // 로컬 상태 먼저 업데이트
    if (isInput) {
      setInputItems(prev => prev.map(p =>
        p.item.item_id === itemId
          ? { ...p, item: { ...p.item, unit_price: priceValue } }
          : p
      ));
    } else {
      setOutputItems(prev => prev.map(p =>
        p.item.item_id === itemId
          ? { ...p, item: { ...p.item, unit_price: priceValue } }
          : p
      ));
    }

    // DB 업데이트 API 호출
    try {
      const response = await fetch(`/api/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: priceValue })
      });
      const result = await response.json();

      if (result.success) {
        toast.success('단가가 업데이트되었습니다', { duration: 1500 });
      } else {
        toast.error(result.error || '단가 업데이트 실패');
      }
    } catch (error) {
      console.error('Price update error:', error);
      toast.error('단가 업데이트 중 오류 발생');
    }
  };

  // 등록 가능 여부 체크
  const canRegister = inputItems.length > 0 &&
    outputItems.length > 0 &&
    inputItems.every(i => i.qty && parseFloat(i.qty) > 0) &&
    outputItems.every(o => o.qty && parseFloat(o.qty) > 0);

  // 등록 핸들러 (각 조합에 대해 API 호출)
  const handleRegister = async () => {
    if (!canRegister) return;

    // 모든 투입-산출 조합에 대해 순차 등록
    for (const input of inputItems) {
      for (const output of outputItems) {
        await onSubmit({
          process_type: processType,
          work_date: '',  // 부모에서 설정
          input_item_id: input.item.item_id,
          input_quantity: parseFloat(input.qty),
          output_item_id: output.item.item_id,
          output_quantity: parseInt(output.qty),
          scrap_quantity: 0,
          quality_status: 'OK'
        });
      }
    }

    // 성공 시 수량만 초기화
    setInputItems(prev => prev.map(p => ({ ...p, qty: '' })));
    setOutputItems(prev => prev.map(p => ({ ...p, qty: '' })));
  };

  // 선택된 품목 요약 표시
  const renderItemSummary = (items: ItemWithQty[], unit: string) => {
    if (items.length === 0) {
      return <span className="text-gray-400 text-xs">선택 없음</span>;
    }

    const visibleItems = items.slice(0, 2);
    const remainingCount = items.length - 2;

    return (
      <div className="flex flex-wrap gap-1">
        {visibleItems.map(({ item, qty }) => (
          <span
            key={item.item_id}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
          >
            <span className="max-w-[60px] truncate">{item.item_code}</span>
            {qty && <span className="text-gray-700 dark:text-gray-400">{qty}{unit}</span>}
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            +{remainingCount}
          </span>
        )}
      </div>
    );
  };

  // 확장 패널의 품목별 수량 입력 UI (표 형태, 한 줄씩)
  const renderItemQtyInputs = (
    items: ItemWithQty[],
    unit: string,
    onQtyChange: (itemId: number, qty: string) => void,
    onRemove: (itemId: number) => void,
    onApplyAll: (qty: string) => void,
    isInput: boolean  // 투입/산출 구분 (단가 업데이트용)
  ) => {
    if (items.length === 0) return null;

    return (
      <div>
        {/* 일괄 적용 */}
        {items.length > 1 && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1 pb-1 border-b border-gray-200 dark:border-gray-600">
            <span>일괄:</span>
            <input
              type="number"
              placeholder="수량"
              className="w-14 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-right text-xs bg-white dark:bg-gray-800"
              onChange={(e) => e.target.value && onApplyAll(e.target.value)}
              min="0"
              step={unit === 'KG' ? '0.01' : '1'}
            />
            <span>{unit}</span>
          </div>
        )}

        {/* 표 형태 품목 목록 */}
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
              <th className="py-1 text-left" style={{width: '80px'}}>품번</th>
              <th className="py-1 text-left" style={{width: '90px'}}>품명</th>
              <th className="py-1 text-left" style={{width: '50px'}}>규격</th>
              <th className="py-1 text-center" style={{width: '45px'}}>분류</th>
              <th className="py-1 text-right" style={{width: '55px'}}>재고</th>
              <th className="py-1 text-right" style={{width: '70px'}}>단가</th>
              <th className="py-1 text-right" style={{width: '80px'}}>수량</th>
              <th className="py-1 w-5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map(({ item, qty }) => (
              <tr key={item.item_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                {/* 품번 */}
                <td className="py-1 font-medium text-gray-900 dark:text-white truncate" title={item.item_code}>
                  {item.item_code}
                </td>
                {/* 품명 */}
                <td className="py-1 text-gray-700 dark:text-gray-300 truncate" title={item.item_name}>
                  {item.item_name}
                </td>
                {/* 규격 */}
                <td className="py-1 text-gray-600 dark:text-gray-400 truncate" title={item.spec || ''}>
                  {item.spec || '-'}
                </td>
                {/* 카테고리 */}
                <td className="py-1 text-center">
                  <span className={`px-1 py-0.5 rounded text-xs ${
                    item.category === '원자재' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-300' :
                    item.category === '반제품' ? 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-300 border border-gray-400' :
                    item.category === '제품' || item.category === '완제품' ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-400' :
                    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {item.category || '-'}
                  </span>
                </td>
                {/* 재고 */}
                <td className={`py-1 text-right font-medium ${
                  (item.current_stock || 0) > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-500'
                }`}>
                  {(item.current_stock || 0).toLocaleString()}
                </td>
                {/* 단가 (수정 가능) */}
                <td className="py-1">
                  <input
                    type="number"
                    defaultValue={item.unit_price || 0}
                    onBlur={(e) => handlePriceChange(item.item_id, e.target.value, isInput)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handlePriceChange(item.item_id, (e.target as HTMLInputElement).value, isInput);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-16 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-right text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-gray-500 focus:border-blue-500"
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                </td>
                {/* 수량 입력 */}
                <td className="py-1">
                  <div className="flex items-center gap-1 justify-end">
                    <input
                      type="number"
                      value={qty}
                      onChange={(e) => onQtyChange(item.item_id, e.target.value)}
                      className="w-16 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-right text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-gray-500"
                      placeholder="0"
                      min="0"
                      step={unit === 'KG' ? '0.01' : '1'}
                    />
                    <span className="text-gray-500 w-5">{unit}</span>
                  </div>
                </td>
                {/* 삭제 */}
                <td className="py-1 text-center">
                  <button
                    type="button"
                    onClick={() => onRemove(item.item_id)}
                    className="p-0.5 text-gray-400 hover:text-red-500"
                    title="제거"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      {/* 메인 행 */}
      <tr className={`border-b border-gray-200 dark:border-gray-700 ${rowBgClass}`}>
        {/* 공정명 */}
        <td className="px-3 py-2">
          <span className="font-medium text-gray-900 dark:text-white text-sm">{processName}</span>
        </td>

        {/* 투입 품목 */}
        <td className="px-2 py-2">
          <div className="min-w-[160px]">
            <MultiItemSelect
              value={inputItems.map(i => i.item.item_id)}
              onChange={handleInputItemsChange}
              placeholder="품목 검색..."
              itemType={inputItemType}
              className="text-sm"
            />
          </div>
        </td>

        {/* 산출 품목 */}
        <td className="px-2 py-2">
          <div className="min-w-[160px]">
            <MultiItemSelect
              value={outputItems.map(o => o.item.item_id)}
              onChange={handleOutputItemsChange}
              placeholder="품목 검색..."
              itemType={outputItemType}
              className="text-sm"
            />
          </div>
        </td>

        {/* 투입 수량 요약/단일입력 */}
        <td className="px-2 py-2">
          {inputItems.length <= 1 ? (
            <div className="flex items-center gap-1 justify-center">
              <input
                type="number"
                value={inputItems[0]?.qty || ''}
                onChange={(e) => inputItems[0] && handleInputQtyChange(inputItems[0].item.item_id, e.target.value)}
                className="w-20 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-right text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                min="0"
                step={inputUnit === 'KG' ? '0.01' : '1'}
                disabled={inputItems.length === 0}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 w-6">{inputUnit}</span>
            </div>
          ) : (
            <div className="text-center">
              {renderItemSummary(inputItems, inputUnit)}
            </div>
          )}
        </td>

        {/* 산출 수량 요약/단일입력 */}
        <td className="px-2 py-2">
          {outputItems.length <= 1 ? (
            <div className="flex items-center gap-1 justify-center">
              <input
                type="number"
                value={outputItems[0]?.qty || ''}
                onChange={(e) => outputItems[0] && handleOutputQtyChange(outputItems[0].item.item_id, e.target.value)}
                className="w-20 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-right text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                min="0"
                step="1"
                disabled={outputItems.length === 0}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 w-6">{outputUnit}</span>
            </div>
          ) : (
            <div className="text-center">
              {renderItemSummary(outputItems, outputUnit)}
            </div>
          )}
        </td>

        {/* 등록 버튼 & 확장 토글 */}
        <td className="px-2 py-2 text-center">
          <div className="flex items-center justify-center gap-1">
            {/* 확장 토글 (1개 이상 선택 시) */}
            {(inputItems.length >= 1 || outputItems.length >= 1) && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title={isExpanded ? '접기' : '상세 보기'}
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}

            {/* 등록 버튼 */}
            <button
              type="button"
              onClick={handleRegister}
              disabled={isLoading || !canRegister}
              className="inline-flex items-center justify-center px-3 py-1.5 bg-gray-800 text-white text-sm rounded hover:bg-gray-700 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-600 dark:disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  등록
                </>
              )}
            </button>
          </div>
        </td>
      </tr>

      {/* 확장 패널 (1개 이상 선택 시 상세 정보 표시) */}
      {isExpanded && (inputItems.length >= 1 || outputItems.length >= 1) && (
        <tr className={`${rowBgClass}`}>
          <td colSpan={6} className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 투입 품목 상세 */}
              {inputItems.length >= 1 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-700 dark:bg-gray-300"></span>
                    투입 품목 ({inputItems.length}개)
                  </h4>
                  {renderItemQtyInputs(
                    inputItems,
                    inputUnit,
                    handleInputQtyChange,
                    handleRemoveInput,
                    handleApplyAllInputQty,
                    true  // 투입 품목
                  )}
                </div>
              )}

              {/* 산출 품목 상세 */}
              {outputItems.length >= 1 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400"></span>
                    산출 품목 ({outputItems.length}개)
                  </h4>
                  {renderItemQtyInputs(
                    outputItems,
                    outputUnit,
                    handleOutputQtyChange,
                    handleRemoveOutput,
                    handleApplyAllOutputQty,
                    false  // 산출 품목
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
