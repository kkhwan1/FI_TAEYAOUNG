/**
 * 공정별 생산등록 API
 * POST /api/process-production - 생산등록
 * GET /api/process-production - 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { calculateEfficiency, calculateScrapRate, PROCESS_DEFAULTS } from '@/lib/processProduction/calcConversion';
import type { ProcessType, QualityStatus } from '@/types/processProduction';

// 한글 텍스트 처리를 위한 요청 파싱
async function parseRequestBody(request: NextRequest) {
  const text = await request.text();
  return JSON.parse(text);
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseRequestBody(request);
    const {
      process_type,
      work_date,
      input_item_id,
      input_quantity,
      output_item_id,
      output_quantity,
      scrap_quantity = 0,
      quality_status = 'OK',
      operator_id,
      notes,
      customer_id
    } = body;

    // 필수 필드 검증
    if (!process_type || !work_date || !input_item_id || !output_item_id ||
        input_quantity === undefined || output_quantity === undefined) {
      return NextResponse.json({
        success: false,
        error: '필수 항목을 모두 입력해주세요'
      }, { status: 400 });
    }

    // 공정 타입 검증
    const validProcessTypes = ['BLANKING', 'PRESS', 'WELD', 'PAINT'];
    if (!validProcessTypes.includes(process_type)) {
      return NextResponse.json({
        success: false,
        error: `유효하지 않은 공정 타입: ${process_type}`
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const warnings: string[] = [];

    // 투입 품목 재고 확인
    const { data: inputItem } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, current_stock, unit')
      .eq('item_id', input_item_id)
      .single();

    if (!inputItem) {
      return NextResponse.json({
        success: false,
        error: '투입 품목을 찾을 수 없습니다'
      }, { status: 404 });
    }

    // 재고 부족 확인 (경고만)
    if ((inputItem.current_stock || 0) < input_quantity) {
      warnings.push(`투입 품목 재고 부족: 현재 ${inputItem.current_stock || 0} ${inputItem.unit}`);
    }

    // 산출 품목 확인
    const { data: outputItem } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, current_stock, unit')
      .eq('item_id', output_item_id)
      .single();

    if (!outputItem) {
      return NextResponse.json({
        success: false,
        error: '산출 품목을 찾을 수 없습니다'
      }, { status: 404 });
    }

    // 수율 계산
    const processDefaults = PROCESS_DEFAULTS[process_type as ProcessType];
    let kgPerBlank: number | undefined;

    if (process_type === 'BLANKING') {
      // BOM에서 kg_per_blank 조회
      const { data: bomData } = await supabase
        .from('bom')
        .select('quantity_required')
        .eq('parent_item_id', output_item_id)
        .eq('is_active', true)
        .limit(1)
        .single();

      kgPerBlank = bomData?.quantity_required;
    }

    const efficiency = calculateEfficiency(input_quantity, output_quantity, kgPerBlank);
    const scrapRate = calculateScrapRate(output_quantity, scrap_quantity);

    // 수율 저하 경고
    const expectedYield = processDefaults?.defaultYieldRate || 100;
    if (efficiency < expectedYield - 10) {
      warnings.push(`수율 저하: ${efficiency}% (기준 ${expectedYield}%)`);
    }

    // 스크랩율 경고
    if (scrapRate > 5) {
      warnings.push(`스크랩율 높음: ${scrapRate}%`);
    }

    // LOT 번호 생성
    const lotNumber = `${process_type.substring(0, 3)}-${work_date.replace(/-/g, '')}-${Date.now().toString().slice(-6)}`;

    // process_operations에 등록
    const { data: operation, error: insertError } = await supabase
      .from('process_operations')
      .insert({
        operation_type: process_type,
        input_item_id,
        input_quantity,
        output_item_id,
        output_quantity,
        scrap_quantity,
        efficiency,
        quality_status,
        status: 'COMPLETED',
        lot_number: lotNumber,
        operator_id,
        notes,
        scheduled_date: work_date,
        completed_at: new Date().toISOString(),
        customer_id: customer_id || null
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({
        success: false,
        error: '생산등록 저장 실패'
      }, { status: 500 });
    }

    // P1: 재고 변동 처리 - inventory_transactions 기록 + 수동 재고 업데이트 (트리거 백업)
    // 1. 투입 품목 재고 차감 (생산소비)
    const inputStockBefore = inputItem.current_stock || 0;
    const inputStockAfter = inputStockBefore - input_quantity;

    const { error: inputTxError } = await supabase
      .from('inventory_transactions')
      .insert({
        item_id: input_item_id,
        transaction_type: '생산투입',
        quantity: -input_quantity,  // 마이너스로 차감
        unit_price: 0,
        total_amount: 0,
        transaction_date: work_date,
        reference_number: lotNumber,
        notes: `[${process_type}] 공정 투입 → ${outputItem.item_name || outputItem.item_code}`,
        status: '완료'
      });

    if (inputTxError) {
      console.error('Input transaction error:', inputTxError);
      warnings.push('투입 품목 재고 차감 실패 - 수동 확인 필요');
    } else {
      // 수동 재고 업데이트 (트리거 백업)
      await supabase
        .from('items')
        .update({ current_stock: inputStockAfter })
        .eq('item_id', input_item_id);
    }

    // 2. 산출 품목 재고 증가 (생산)
    const outputStockBefore = outputItem.current_stock || 0;
    const outputStockAfter = outputStockBefore + output_quantity;

    const { error: outputTxError } = await supabase
      .from('inventory_transactions')
      .insert({
        item_id: output_item_id,
        transaction_type: '생산산출',
        quantity: output_quantity,
        unit_price: 0,
        total_amount: 0,
        transaction_date: work_date,
        reference_number: lotNumber,
        notes: `[${process_type}] 공정 산출 ← ${inputItem.item_name || inputItem.item_code}`,
        status: '완료'
      });

    if (outputTxError) {
      console.error('Output transaction error:', outputTxError);
      warnings.push('산출 품목 재고 증가 실패 - 수동 확인 필요');
    } else {
      // 수동 재고 업데이트 (트리거 백업)
      await supabase
        .from('items')
        .update({ current_stock: outputStockAfter })
        .eq('item_id', output_item_id);
    }

    // P2 Task 8: 스크랩(불량) 수량 재고 처리
    // 산출 품목에서 불량 수량만큼 차감
    if (!outputTxError && scrap_quantity > 0) {
      const scrapStockAfter = outputStockAfter - scrap_quantity;

      const { error: scrapTxError } = await supabase
        .from('inventory_transactions')
        .insert({
          item_id: output_item_id,
          transaction_type: '생산불량',
          quantity: -scrap_quantity,
          unit_price: 0,
          total_amount: 0,
          transaction_date: work_date,
          reference_number: lotNumber,
          notes: `[${process_type}] 불량 처리 - ${outputItem.item_name || outputItem.item_code}`,
          status: '완료'
        });

      if (scrapTxError) {
        console.error('Scrap transaction error:', scrapTxError);
        warnings.push(`스크랩 재고 차감 실패 (${scrap_quantity}개) - 수동 확인 필요`);
      } else {
        // 불량 수량만큼 재고 차감
        await supabase
          .from('items')
          .update({ current_stock: scrapStockAfter })
          .eq('item_id', output_item_id);
      }
    }

    // P2 Task 9: 도장(PAINT) 공정 완료 시 완제품 자동 분류 및 coating_status 업데이트
    let finishedGoodsMessage = '';
    if (process_type === 'PAINT') {
      // 산출 품목의 카테고리 확인
      const { data: outputItemFull } = await supabase
        .from('items')
        .select('category, coating_status')
        .eq('item_id', output_item_id)
        .single();

      // coating_status를 'after_coating'으로 업데이트
      const { error: coatingError } = await supabase
        .from('items')
        .update({ coating_status: 'after_coating' })
        .eq('item_id', output_item_id);

      if (coatingError) {
        console.error('Coating status update error:', coatingError);
        warnings.push('도장 상태 업데이트 실패 - 수동 확인 필요');
      }

      if (outputItemFull?.category === '제품') {
        finishedGoodsMessage = ` (완제품 ${output_quantity}EA 입고 완료, 도장완료)`;
      } else {
        finishedGoodsMessage = ' (도장 완료)';
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        operation_id: operation.operation_id,
        process_type,
        input_item: inputItem,
        output_item: outputItem,
        input_quantity,
        output_quantity,
        scrap_quantity,
        efficiency,
        scrap_rate: scrapRate,
        quality_status,
        status: 'COMPLETED',
        lot_number: lotNumber,
        created_at: operation.created_at
      },
      message: `생산등록이 완료되었습니다${finishedGoodsMessage}`,
      warnings: warnings.length > 0 ? warnings : undefined
    });

  } catch (error) {
    console.error('Process production POST error:', error);
    return NextResponse.json({
      success: false,
      error: '생산등록 처리 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const processType = searchParams.get('process_type');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    // 성능 최적화: count는 필요할 때만 (include_count=true)
    const includeCount = searchParams.get('include_count') === 'true';

    const supabase = getSupabaseClient();

    // 성능 최적화: * 대신 필요한 컬럼만 선택, count 옵션화
    const selectColumns = `
      operation_id,
      operation_type,
      input_quantity,
      output_quantity,
      scrap_quantity,
      efficiency,
      quality_status,
      status,
      lot_number,
      scheduled_date,
      completed_at,
      created_at,
      input_item:items!process_operations_input_item_id_fkey(item_id, item_code, item_name, unit, price, category),
      output_item:items!process_operations_output_item_id_fkey(item_id, item_code, item_name, unit, price, category),
      customer:companies!process_operations_customer_id_fkey(company_id, company_name)
    `;

    let query = supabase
      .from('process_operations')
      .select(selectColumns, includeCount ? { count: 'exact' } : { count: 'planned' });

    // 필터 적용
    if (processType) {
      query = query.eq('operation_type', processType);
    }
    if (dateFrom) {
      query = query.gte('scheduled_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('scheduled_date', dateTo);
    }
    if (status) {
      query = query.eq('status', status);
    }

    // 페이지네이션
    const from = (page - 1) * limit;
    query = query
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Query error:', error);
      return NextResponse.json({
        success: false,
        error: '조회 중 오류가 발생했습니다'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || data?.length || 0,
        totalPages: count ? Math.ceil(count / limit) : 1
      }
    });

  } catch (error) {
    console.error('Process production GET error:', error);
    return NextResponse.json({
      success: false,
      error: '조회 처리 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}
