import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { APIError, handleAPIError } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { metricsCollector } from '@/lib/metrics';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/inventory/production/batch';

  try {
    logger.info('Inventory production batch POST request', { endpoint });
    
    // Parse request body with error handling (Korean UTF-8 support)
    let body;
    try {
      const text = await request.text();
      body = JSON.parse(text);
    } catch (parseError) {
      logger.error('JSON parse error', parseError as Error, { endpoint });
      return NextResponse.json({
        success: false,
        error: '잘못된 JSON 형식입니다.'
      }, { status: 400 });
    }

    const {
      transaction_date,
      items,
      reference_no,
      notes,
      use_bom = true,
      created_by = 1,
      process_types,
      press_capacity
    } = body;

    // 필수 필드 검증
    if (!transaction_date || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: '필수 필드가 누락되었습니다. (거래일자, 품목 목록 필수)'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 각 품목 검증 및 BOM 확인
    const productItemIds = items.map((item: any) => item.product_item_id || item.item_id);
    const { data: productItems, error: itemsError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, current_stock, is_active')
      .in('item_id', productItemIds);

    if (itemsError) {
      return NextResponse.json({
        success: false,
        error: '품목 조회 중 오류가 발생했습니다.',
        details: itemsError.message
      }, { status: 500 });
    }

    const productItemsMap = new Map(productItems?.map(item => [item.item_id, item]) || []);

    // 각 품목별 검증 및 BOM 검증
    const validationErrors: string[] = [];
    const bomValidations: Array<{ productId: number; bomData: any[]; stockShortages: any[] }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const productId = item.product_item_id || item.item_id;
      const quantity = item.quantity || 0;
      const unitPrice = item.unit_price || 0;

      if (!productId || quantity === undefined || quantity <= 0) {
        validationErrors.push(`품목 ${i + 1}: 필수 필드가 누락되었습니다. (품목, 수량 필수)`);
        continue;
      }

      const productItem = productItemsMap.get(productId);
      if (!productItem) {
        validationErrors.push(`품목 ${i + 1}: 존재하지 않는 품목입니다.`);
        continue;
      }

      if (!productItem.is_active) {
        validationErrors.push(`품목 ${i + 1}: 비활성화된 품목입니다.`);
        continue;
      }

      // BOM 확인 (use_bom이 true인 경우)
      if (use_bom) {
        const { data: bomData, error: bomError } = await supabase
          .from('bom')
          .select(`
            child_item_id,
            quantity_required,
            child_item:items!child_item_id (
              item_id,
              item_code,
              item_name,
              current_stock,
              unit
            )
          `)
          .eq('parent_item_id', productId)
          .eq('is_active', true);

        if (bomError) {
          logger.warn('BOM query error', { productId, error: bomError });
        }

        if (bomData && bomData.length > 0) {
          const stockShortages: any[] = [];
          
          for (const bomItem of bomData) {
            const childItem = Array.isArray(bomItem.child_item) ? bomItem.child_item[0] : bomItem.child_item;
            if (!childItem) continue;

            const requiredQuantity = (bomItem.quantity_required || 0) * quantity;
            const currentStock = childItem.current_stock || 0;
            
            if (currentStock < requiredQuantity) {
              stockShortages.push({
                item_code: childItem.item_code,
                item_name: childItem.item_name,
                required: requiredQuantity,
                available: currentStock,
                shortage: requiredQuantity - currentStock
              });
            }
          }

          bomValidations.push({
            productId,
            bomData: bomData || [],
            stockShortages
          });

          // 재고가 부족한 경우 경고만 표시 (생산 등록은 진행)
          // 주석 처리: 재고 부족 시에도 생산 등록이 가능하도록 변경
          // if (stockShortages.length > 0) {
          //   const shortageList = stockShortages.map(s => 
          //     `${s.item_name} (필요: ${s.required}, 보유: ${s.available})`
          //   ).join(', ');
          //   validationErrors.push(`품목 ${i + 1} (${productItem.item_name}): 원자재 재고 부족 - ${shortageList}`);
          // }
        }
      }
    }

    // 필수 필드 검증 에러만 반환 (재고 부족은 경고로만 처리)
    if (validationErrors.length > 0) {
      return NextResponse.json({
        success: false,
        error: '검증 실패',
        details: validationErrors
      }, { status: 400 });
    }

    // Prepare production metadata (process types and press capacity)
    const productionMetadata: any = {};
    if (process_types && Array.isArray(process_types) && process_types.length > 0) {
      productionMetadata.process_types = process_types;
    }
    if (press_capacity) {
      productionMetadata.press_capacity = press_capacity;
    }
    const description = Object.keys(productionMetadata).length > 0 
      ? JSON.stringify(productionMetadata) 
      : null;

    // 일괄 거래 생성 (생산입고)
    const transactions = items.map((item: any) => ({
      item_id: item.product_item_id || item.item_id,
      transaction_type: '생산입고',
      quantity: item.quantity,
      unit_price: item.unit_price || 0,
      total_amount: (item.quantity || 0) * (item.unit_price || 0),
      reference_number: reference_no || null,
      transaction_date,
      notes: notes || null,
      description: description,  // 생산 실적 정보 저장 (프레스/용접/도장, 프레스 용량)
      status: '완료',
      created_by: created_by || 1
    }));

    // 트랜잭션으로 묶어서 처리
    // 재고 업데이트: update_stock_on_transaction 트리거가 자동으로 처리
    // 트리거 함수 update_item_stock()이 '생산입고' 거래에 대해 current_stock을 자동 증가시킵니다.
    // BOM 자동 차감: trg_auto_deduct_bom 트리거가 처리 (auto_deduct_bom_materials 함수)
    // 원자재 재고는 BOM 트리거가 자동으로 차감합니다.
    const { data: insertedTransactions, error: insertError } = await supabase
      .from('inventory_transactions')
      .insert(transactions)
      .select('transaction_id, item_id, quantity');

    if (insertError) {
      console.error('Supabase batch insert error:', insertError);
      return NextResponse.json({
        success: false,
        error: '생산 일괄 등록 중 오류가 발생했습니다.',
        details: insertError.message
      }, { status: 500 });
    }

    // 재고 확인 (트리거가 올바르게 작동했는지 검증)
    // 참고: 트리거는 INSERT 직후 실행되므로, 여기서 조회하는 재고는 이미 업데이트된 상태입니다.
    
    // 업데이트된 품목 정보 조회
    const { data: updatedItems, error: itemsQueryError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, current_stock')
      .in('item_id', productItemIds);

    if (itemsQueryError) {
      logger.warn('Failed to fetch updated items', { error: itemsQueryError });
    }

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Inventory production batch POST success', {
      endpoint,
      duration,
      transactionCount: insertedTransactions?.length || 0
    });

    // 재고 부족 경고 메시지 생성
    const stockWarnings: string[] = [];
    bomValidations.forEach((validation, index) => {
      if (validation.stockShortages.length > 0) {
        const productItem = productItemsMap.get(validation.productId);
        const shortageList = validation.stockShortages.map(s => 
          `${s.item_name} (필요: ${s.required}, 보유: ${s.available}, 부족: ${s.shortage})`
        ).join(', ');
        stockWarnings.push(`품목 ${index + 1} (${productItem?.item_name || validation.productId}): 원자재 재고 부족 - ${shortageList}`);
      }
    });

    const message = stockWarnings.length > 0
      ? `생산 일괄 등록이 완료되었습니다. (경고: 일부 원자재 재고가 부족합니다. ${stockWarnings.length}개 품목)`
      : '생산 일괄 등록이 완료되었습니다. BOM 자동 차감은 데이터베이스 트리거로 처리되었습니다.';

    return NextResponse.json({
      success: true,
      data: {
        transactions: insertedTransactions || [],
        items: updatedItems || [],
        bom_validations: bomValidations,
        stock_warnings: stockWarnings,
        summary: {
          total_count: insertedTransactions?.length || 0,
          total_quantity: items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0),
          total_value: items.reduce(
            (sum: number, item: any) => sum + (item.quantity || 0) * (item.unit_price || 0),
            0
          )
        }
      },
      message,
      warnings: stockWarnings.length > 0 ? stockWarnings : undefined
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Inventory production batch POST error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}

