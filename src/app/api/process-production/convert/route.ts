/**
 * 공정별 생산등록 - 중량/수량 환산 API
 * GET /api/process-production/convert
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { calculatePossibleEa, calculateRequiredKg, PROCESS_DEFAULTS } from '@/lib/processProduction/calcConversion';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const processType = searchParams.get('process_type') as keyof typeof PROCESS_DEFAULTS;
    const inputItemId = searchParams.get('input_item_id');
    const outputItemId = searchParams.get('output_item_id');
    const inputKg = searchParams.get('input_kg');
    const outputEa = searchParams.get('output_ea');

    // 필수 파라미터 검증
    if (!processType || !outputItemId) {
      return NextResponse.json({
        success: false,
        error: 'process_type과 output_item_id는 필수입니다'
      }, { status: 400 });
    }

    // 블랭킹 공정에서만 환산 필요
    if (processType !== 'BLANKING') {
      return NextResponse.json({
        success: true,
        data: {
          kg_per_blank: 0,
          yield_rate: PROCESS_DEFAULTS[processType]?.defaultYieldRate || 100,
          possible_ea: null,
          required_kg: null,
          formula: '환산 불필요 (동일 단위)'
        }
      });
    }

    const supabase = getSupabaseClient();

    // BOM에서 kg_per_blank 조회 (parent=블랭크, child=코일)
    const { data: bomData, error: bomError } = await supabase
      .from('bom')
      .select(`
        quantity_required,
        parent_item:items!bom_parent_item_id_fkey(item_id, item_code, item_name, yield_rate),
        child_item:items!bom_child_item_id_fkey(item_id, item_code, item_name)
      `)
      .eq('parent_item_id', parseInt(outputItemId))
      .eq('is_active', true)
      .limit(1)
      .single();

    if (bomError || !bomData) {
      // BOM이 없으면 items.mm_weight 사용
      const { data: itemData } = await supabase
        .from('items')
        .select('mm_weight, yield_rate')
        .eq('item_id', parseInt(outputItemId))
        .single();

      if (!itemData?.mm_weight) {
        return NextResponse.json({
          success: false,
          error: '해당 품목의 BOM 또는 개당중량 정보가 없습니다'
        }, { status: 404 });
      }

      const kgPerBlank = itemData.mm_weight / 1000; // mm_weight는 g 단위
      const yieldRate = itemData.yield_rate || PROCESS_DEFAULTS.BLANKING.defaultYieldRate;

      return calculateAndRespond(kgPerBlank, yieldRate, inputKg, outputEa);
    }

    // BOM 데이터 사용
    const kgPerBlank = bomData.quantity_required;
    const parentItem = bomData.parent_item as { yield_rate?: number } | null;
    const yieldRate = parentItem?.yield_rate || PROCESS_DEFAULTS.BLANKING.defaultYieldRate;

    return calculateAndRespond(kgPerBlank, yieldRate, inputKg, outputEa);

  } catch (error) {
    console.error('Convert API error:', error);
    return NextResponse.json({
      success: false,
      error: '환산 처리 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

function calculateAndRespond(
  kgPerBlank: number,
  yieldRate: number,
  inputKg: string | null,
  outputEa: string | null
) {
  const params = { kgPerBlank, yieldRate };

  // 투입 kg → 가능 EA 계산
  if (inputKg) {
    const result = calculatePossibleEa(parseFloat(inputKg), params);
    return NextResponse.json({
      success: true,
      data: {
        kg_per_blank: result.kgPerBlank,
        yield_rate: result.yieldRate,
        possible_ea: result.possibleEa,
        required_kg: null,
        formula: result.formula
      }
    });
  }

  // 산출 EA → 필요 kg 계산
  if (outputEa) {
    const result = calculateRequiredKg(parseInt(outputEa), params);
    return NextResponse.json({
      success: true,
      data: {
        kg_per_blank: result.kgPerBlank,
        yield_rate: result.yieldRate,
        possible_ea: null,
        required_kg: result.requiredKg,
        formula: result.formula
      }
    });
  }

  // 둘 다 없으면 기본 정보만 반환
  return NextResponse.json({
    success: true,
    data: {
      kg_per_blank: kgPerBlank,
      yield_rate: yieldRate,
      possible_ea: null,
      required_kg: null,
      formula: `1 EA = ${kgPerBlank} kg (수율 ${yieldRate}%)`
    }
  });
}
