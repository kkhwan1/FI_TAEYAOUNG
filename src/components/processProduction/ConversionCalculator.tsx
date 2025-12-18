'use client';

import React, { useState, useEffect } from 'react';
import { Calculator, RefreshCw, ArrowRight } from 'lucide-react';

interface ConversionCalculatorProps {
  inputItemId?: number;
  outputItemId?: number;
  onConversionResult?: (result: ConversionResult) => void;
  onApplyInputQty?: (kgValue: number) => void;  // P0-2: 투입 수량 적용 콜백
  onApplyOutputQty?: (eaValue: number) => void;  // P0-2: 산출 수량 적용 콜백
}

interface ConversionResult {
  kgPerBlank: number;
  yieldRate: number;
  possibleEa?: number;
  requiredKg?: number;
  formula: string;
}

export default function ConversionCalculator({
  inputItemId,
  outputItemId,
  onConversionResult,
  onApplyInputQty,
  onApplyOutputQty
}: ConversionCalculatorProps) {
  const [mode, setMode] = useState<'kg_to_ea' | 'ea_to_kg'>('kg_to_ea');
  const [inputValue, setInputValue] = useState<string>('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // outputItemId 변경 시 기본 정보 로드
  useEffect(() => {
    if (outputItemId) {
      fetchConversionInfo();
    }
  }, [outputItemId]);

  const fetchConversionInfo = async () => {
    if (!outputItemId) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        process_type: 'BLANKING',
        output_item_id: outputItemId.toString()
      });

      const response = await fetch(`/api/process-production/convert?${params}`);
      const data = await response.json();

      if (data.success && data.data) {
        setResult({
          kgPerBlank: data.data.kg_per_blank,
          yieldRate: data.data.yield_rate,
          formula: data.data.formula
        });
      } else {
        setError(data.error || '환산 정보를 불러올 수 없습니다');
      }
    } catch {
      setError('환산 정보 조회 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculate = async () => {
    if (!outputItemId || !inputValue) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        process_type: 'BLANKING',
        output_item_id: outputItemId.toString()
      });

      if (mode === 'kg_to_ea') {
        params.set('input_kg', inputValue);
      } else {
        params.set('output_ea', inputValue);
      }

      const response = await fetch(`/api/process-production/convert?${params}`);
      const data = await response.json();

      if (data.success && data.data) {
        const conversionResult: ConversionResult = {
          kgPerBlank: data.data.kg_per_blank,
          yieldRate: data.data.yield_rate,
          possibleEa: data.data.possible_ea,
          requiredKg: data.data.required_kg,
          formula: data.data.formula
        };
        setResult(conversionResult);
        onConversionResult?.(conversionResult);
      } else {
        setError(data.error || '환산 실패');
      }
    } catch {
      setError('환산 처리 실패');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="w-5 h-5 text-gray-600" />
        <h4 className="font-medium text-gray-800">중량 ↔ 수량 환산기</h4>
      </div>

      {/* 모드 토글 */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMode('kg_to_ea')}
          className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
            mode === 'kg_to_ea'
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          투입 KG → 가능 EA
        </button>
        <button
          type="button"
          onClick={() => setMode('ea_to_kg')}
          className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
            mode === 'ea_to_kg'
              ? 'bg-gray-700 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          목표 EA → 필요 KG
        </button>
      </div>

      {/* 입력 */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="number"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={mode === 'kg_to_ea' ? '투입 중량 (kg)' : '목표 수량 (EA)'}
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-600 text-sm w-8">
          {mode === 'kg_to_ea' ? 'kg' : 'EA'}
        </span>
        <button
          type="button"
          onClick={handleCalculate}
          disabled={isLoading || !inputValue || !outputItemId}
          className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
          계산
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div className="text-gray-600 text-sm mb-2">{error}</div>
      )}

      {/* 결과 */}
      {result && (
        <div className="bg-white rounded p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">kg/EA:</span>
            <span className="font-medium">{result.kgPerBlank}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">수율:</span>
            <span className="font-medium">{result.yieldRate}%</span>
          </div>
          {result.possibleEa !== undefined && result.possibleEa !== null && (
            <div className="flex justify-between items-center text-sm border-t pt-2">
              <span className="text-gray-600">가능 산출:</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-700">{result.possibleEa.toLocaleString()} EA</span>
                {onApplyOutputQty && (
                  <button
                    type="button"
                    onClick={() => onApplyOutputQty(result.possibleEa!)}
                    className="px-2 py-0.5 text-xs bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                    title="산출 수량에 적용"
                  >
                    적용
                  </button>
                )}
              </div>
            </div>
          )}
          {result.requiredKg !== undefined && result.requiredKg !== null && (
            <div className="flex justify-between items-center text-sm border-t pt-2">
              <span className="text-gray-600">필요 투입:</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-700">{result.requiredKg.toLocaleString()} kg</span>
                {onApplyInputQty && (
                  <button
                    type="button"
                    onClick={() => onApplyInputQty(result.requiredKg!)}
                    className="px-2 py-0.5 text-xs bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                    title="투입 수량에 적용"
                  >
                    적용
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="text-xs text-gray-500 pt-1 border-t">
            {result.formula}
          </div>
        </div>
      )}
    </div>
  );
}
