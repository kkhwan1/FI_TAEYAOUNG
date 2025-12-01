import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { checkIdempotency } from '@/lib/api/idempotency-check';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('company_id');
    
    // Use Supabase Admin client to bypass RLS
    const supabase = supabaseAdmin;

    let query = supabase
      .from('inventory_transactions')
      .select(`
        *,
        items!inner(item_code, item_name, spec, unit, category, price),
        users!created_by(username),
        companies(company_id, company_name)
      `)
      .in('transaction_type', ['생산입고', '생산출고']);

    // Apply company filter if provided
    if (companyId) {
      query = query.eq('company_id', parseInt(companyId));
    }

    const { data: transactions, error } = await query
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // 1. 배치로 월별 단가 조회 (N+1 문제 방지)
    const priceKeys = (transactions || []).map((tx: any) => {
      const transactionDate = tx.transaction_date || tx.created_at;
      const priceMonth = transactionDate 
        ? new Date(transactionDate).toISOString().substring(0, 7) + '-01'
        : null;
      
      return {
        item_id: tx.item_id,
        price_month: priceMonth
      };
    }).filter(k => k.price_month);

    // 중복 제거 및 배열 추출
    const uniqueItemIds = [...new Set(priceKeys.map(k => k.item_id))];
    const uniqueMonths = [...new Set(priceKeys.map(k => k.price_month))].filter((m): m is string => m !== null);

    // 배치로 월별 단가 조회
    const { data: monthlyPrices } = await supabase
      .from('item_price_history')
      .select('item_id, price_month, unit_price')
      .in('item_id', uniqueItemIds)
      .in('price_month', uniqueMonths);

    // Map으로 빠른 조회 (key: 'item_id_price_month', value: unit_price)
    const priceMap = new Map(
      (monthlyPrices || []).map(p => [`${p.item_id}_${p.price_month}`, p.unit_price])
    );

    // 2. 각 거래에 대해 BOM 차감 로그 조회 및 단가 적용
    const transactionsWithShortage = await Promise.all(
      (transactions || []).map(async (tx: any) => {
        // 해당 생산입고 거래의 BOM 차감 로그 조회 (원자재 정보 포함)
        const { data: bomLogs } = await supabase
          .from('bom_deduction_log')
          .select(`
            quantity_required,
            deducted_quantity,
            parent_quantity,
            items!child_item_id(item_code, item_name, unit)
          `)
          .eq('transaction_id', tx.transaction_id);

        // 부족 총 수량 계산 (전체 자재의 부족 수량 합계)
        // quantity_required: BOM 단위 수량 (예: 1.0)
        // parent_quantity: 생산 수량 (예: 50,000)
        // 실제 필요 수량 = quantity_required × parent_quantity (또는 tx.quantity)
        // 부족 수량 = 실제 필요 수량 - deducted_quantity
        const totalShortage = (bomLogs || []).reduce((sum, log) => {
          const bomUnitQty = parseFloat(String(log.quantity_required || 0)); // BOM 단위 수량
          const deducted = parseFloat(String(log.deducted_quantity || 0)); // 실제 차감 수량
          const productionQty = parseFloat(String(log.parent_quantity || tx.quantity || 0)); // 생산 수량
          
          // 실제 필요 수량 계산
          const actualRequired = bomUnitQty * productionQty;
          
          // 부족 수량 계산 (0보다 작으면 0으로 처리)
          const shortage = Math.max(0, actualRequired - deducted);
          
          return sum + shortage;
        }, 0);
        
        // 부족 자재의 단위 정보 추출 (대부분의 부족 자재가 같은 단위를 사용한다고 가정)
        const shortageUnits = (bomLogs || [])
          .filter((log: any) => {
            const bomUnitQty = parseFloat(log.quantity_required || 0);
            const deducted = parseFloat(log.deducted_quantity || 0);
            const productionQty = parseFloat(log.parent_quantity || tx.quantity || 0);
            const actualRequired = bomUnitQty * productionQty;
            return actualRequired > deducted;
          })
          .map((log: any) => log.items?.unit || 'EA');
        const primaryUnit = shortageUnits.length > 0 ? shortageUnits[0] : 'EA';

        // 월별 단가 조회
        const transactionDate = tx.transaction_date || tx.created_at;
        const priceMonth = transactionDate 
          ? new Date(transactionDate).toISOString().substring(0, 7) + '-01'
          : null;
        
        const monthlyPrice = priceMonth ? priceMap.get(`${tx.item_id}_${priceMonth}`) : null;

        // 단가 우선순위: 거래 단가 > 월별 단가 > 품목 기본 단가 > 0
        const unit_price = (tx.unit_price && tx.unit_price > 0)
          ? tx.unit_price 
          : (monthlyPrice || tx.items?.price || 0);

        // 금액 재계산
        const total_amount = tx.quantity * unit_price;

        return {
          ...tx,
          unit_price,
          total_amount,
          item_code: tx.items?.item_code || tx.item_code,
          item_name: tx.items?.item_name || tx.item_name,
          company_name: tx.companies?.company_name || null,
          shortage_total: totalShortage,
          shortage_unit: primaryUnit,
          bomLogs: bomLogs || []
        };
      })
    );

    return NextResponse.json({ success: true, data: { transactions: transactionsWithShortage } });
  } catch (error) {
    console.error('Error fetching production history:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch production history' }, { status: 500 });
  }
}

/**
 * POST /api/inventory/production
 * Create new production transaction with auto BOM deduction
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Idempotency Key 추출 (헤더에서)
    const idempotencyKey = request.headers.get('Idempotency-Key') || 
                          request.headers.get('idempotency-key') || 
                          null;

    // Korean text handling pattern - prevents character corruption
    const text = await request.text();
    const body = JSON.parse(text);

    const {
      transaction_date,
      item_id,
      quantity,
      unit_price,
      company_id,
      reference_number,
      notes,
      created_by,
      transaction_type,
      process_types,
      press_capacity
    } = body;

    // 필수 필드 검증
    if (!transaction_date || !item_id || !quantity || unit_price === undefined || !created_by || !transaction_type) {
      return NextResponse.json({
        success: false,
        error: '필수 필드가 누락되었습니다. (거래일자, 품목, 수량, 단가, 작성자, 거래유형 필수)'
      }, { status: 400 });
    }

    if (!['생산입고', '생산출고'].includes(transaction_type)) {
      return NextResponse.json({
        success: false,
        error: '거래유형은 생산입고 또는 생산출고여야 합니다.'
      }, { status: 400 });
    }

    // 데이터 타입 강제 변환 및 검증
    const parsedQuantity = Math.floor(Number(quantity));
    const parsedUnitPrice = parseFloat(String(unit_price));

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      return NextResponse.json({
        success: false,
        error: '수량은 양의 정수여야 합니다.'
      }, { status: 400 });
    }

    if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0) {
      return NextResponse.json({
        success: false,
        error: '단가는 유효한 숫자여야 합니다.'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if item exists and is active
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('item_id, item_name, unit, is_active')
      .eq('item_id', item_id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({
        success: false,
        error: '존재하지 않는 품목입니다.'
      }, { status: 404 });
    }

    if (!item.is_active) {
      return NextResponse.json({
        success: false,
        error: '비활성화된 품목입니다.'
      }, { status: 400 });
    }

    // Calculate total amount using parsed values
    const total_amount = parsedQuantity * parsedUnitPrice;

    // Initialize stock warnings variable
    let stockWarnings: any = null;

    // === API 레벨 BOM 검증 및 차감 (이중 보장) ===
    if (transaction_type === '생산입고') {
      // 1. BOM 조회
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
        .eq('parent_item_id', item_id)
        .eq('is_active', true);

      if (bomError) {
        console.error('BOM query error:', bomError);
        // BOM이 없어도 생산은 가능하도록 허용
      }

      // 2. 재고 검증 및 부족 원자재 체크 (경고만, 에러 아님)
      if (bomData && bomData.length > 0) {
        const stockShortages: Array<{ item_code: string; item_name: string; required: number; available: number }> = [];
        let maxProducible = Infinity;
        let bottleneckItem: any = null;
        
        for (const bomItem of bomData) {
          const childItem = Array.isArray(bomItem.child_item) ? bomItem.child_item[0] : bomItem.child_item;
          if (!childItem) continue;

          const requiredQuantity = (bomItem.quantity_required || 0) * parsedQuantity;
          const currentStock = childItem.current_stock || 0;
          const bomQuantityPerUnit = bomItem.quantity_required || 0;
          const maxProducibleByThisItem = Math.floor(currentStock / bomQuantityPerUnit);
          
          if (currentStock < requiredQuantity) {
            stockShortages.push({
              item_code: childItem.item_code,
              item_name: childItem.item_name,
              required: requiredQuantity,
              available: currentStock
            });
          }
          
          // Track bottleneck
          if (maxProducibleByThisItem < maxProducible) {
            maxProducible = maxProducibleByThisItem;
            bottleneckItem = {
              item_code: childItem.item_code,
              item_name: childItem.item_name,
              required: requiredQuantity,
              available: currentStock
            };
          }
        }
        
        // 재고 부족 시 경고 정보 저장 (에러 아님)
        if (stockShortages.length > 0) {
          stockWarnings = {
            has_shortage: true,
            max_producible: maxProducible === Infinity ? parsedQuantity : maxProducible,
            shortage_quantity: Math.max(0, parsedQuantity - (maxProducible === Infinity ? parsedQuantity : maxProducible)),
            bottleneck_materials: stockShortages
          };
        }
      }
    }
    // === API 레벨 BOM 검증 종료 ===

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

    // Insert production transaction using parsed values
    const { data, error } = await supabase
      .from('inventory_transactions')
      .insert([{
        item_id,
        created_by,
        transaction_type,
        quantity: parsedQuantity,  // 변환된 정수값
        unit_price: parsedUnitPrice,  // 변환된 숫자값
        total_amount,
        company_id: company_id || null,
        reference_number: reference_number || null,
        transaction_date,
        notes: notes || null,
        description: description  // 생산 실적 정보 저장 (프레스/용접/도장, 프레스 용량)
      }])
      .select(`
        *,
        items!inner(item_code, item_name, spec, unit, category),
        users!created_by(username)
      `);

    if (error) {
      console.error('Supabase insert error:', error);
      // Note: stock shortage errors are handled by trigger, don't fail here

      // SECURITY FIX: Hide schema details in production
      const response: any = {
        success: false,
        error: '생산 등록 중 오류가 발생했습니다.'
      };

      if (process.env.NODE_ENV !== 'production') {
        response.details = error.message;
      }

      return NextResponse.json(response, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: false,
        error: '생산 등록에 실패했습니다.'
      }, { status: 500 });
    }

    const transaction = data[0];
    const transactionId = transaction.transaction_id;

    // NOTE: 재고 업데이트는 DB 트리거 `update_stock_on_transaction`에서 자동 처리
    // API에서 수동 업데이트 시 이중 반영되므로 제거됨 (2025-11-30)
    // 생산입고: 트리거가 완제품 재고 증가 + trg_auto_deduct_bom이 BOM 자재 자동 차감
    // 생산출고: 트리거가 완제품 재고 감소

    // Fetch auto-generated BOM deduction logs with child item details
    const { data: deductionLogs, error: deductionError } = await supabase
      .from('bom_deduction_log')
      .select(`
        log_id,
        child_item_id,
        deducted_quantity,
        usage_rate,
        stock_before,
        stock_after,
        items:child_item_id (
          item_code,
          item_name,
          unit
        )
      `)
      .eq('transaction_id', transactionId)
      .order('log_id', { ascending: true });

    if (deductionError) {
      console.error('Error fetching deduction logs:', deductionError);
      // Continue execution - deduction logs are optional info
    }

    // Format auto_deductions array
    const auto_deductions = (deductionLogs || []).map((log: any) => ({
      log_id: log.log_id,
      child_item_id: log.child_item_id,
      item_code: log.items?.item_code || '',
      item_name: log.items?.item_name || '',
      unit: log.items?.unit || '',
      deducted_quantity: log.deducted_quantity,
      usage_rate: log.usage_rate,
      stock_before: log.stock_before,
      stock_after: log.stock_after
    }));

    const responseData: any = {
      transaction,
      auto_deductions
    };
    
    // Add stock warnings if any
    if (stockWarnings) {
      responseData.stock_warning = stockWarnings;
    }
    
    return NextResponse.json({
      success: true,
      message: stockWarnings 
        ? '생산이 등록되었습니다. (재고 부족 경고 있음)'
        : '생산이 성공적으로 등록되었습니다.',
      data: responseData
    });
  } catch (error) {
    console.error('Error creating production transaction:', error);

    return NextResponse.json(
      {
        success: false,
        error: '생산 등록 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/inventory/production
 * Update existing production transaction
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Korean text handling pattern - prevents character corruption
    const text = await request.text();
    const body = JSON.parse(text);
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Transaction ID is required'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if transaction exists and is a production transaction
    const { data: existingTransaction, error: existingError } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('transaction_id', id)
      .in('transaction_type', ['생산입고', '생산출고'])
      .single();

    if (existingError || !existingTransaction) {
      return NextResponse.json({
        success: false,
        error: 'Production transaction not found'
      }, { status: 404 });
    }

    // Validate fields if being updated
    if (updateData.quantity !== undefined && updateData.quantity <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Quantity must be greater than 0'
      }, { status: 400 });
    }

    if (updateData.unit_price !== undefined && updateData.unit_price < 0) {
      return NextResponse.json({
        success: false,
        error: 'Unit price cannot be negative'
      }, { status: 400 });
    }

    // Recalculate total amount if quantity or unit_price is updated
    if (updateData.quantity !== undefined || updateData.unit_price !== undefined) {
      const newQuantity = updateData.quantity ?? existingTransaction.quantity;
      const newUnitPrice = updateData.unit_price ?? existingTransaction.unit_price;
      updateData.total_amount = newQuantity * newUnitPrice;
    }

    // Get user info from request headers (if available)
    const userId = request.headers.get('x-user-id') || null;
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;

    // Update transaction
    const { data, error } = await supabase
      .from('inventory_transactions')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('transaction_id', id)
      .select(`
        *,
        items!inner(item_code, item_name, spec, unit, category),
        users!created_by(username)
      `);

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to update production transaction',
        details: error.message
      }, { status: 500 });
    }

    // Create audit log entry
    try {
      await supabase
        .from('audit_log')
        .insert({
          user_id: userId ? parseInt(userId) : null,
          operation: 'UPDATE',
          table_name: 'inventory_transactions',
          record_id: parseInt(id),
          old_values: existingTransaction as any,
          new_values: data[0] as any,
          status: 'SUCCESS',
          ip_address: ipAddress,
          user_agent: userAgent,
          created_at: new Date().toISOString()
        });
    } catch (auditError) {
      // Log error but don't fail the update
      console.error('Failed to create audit log:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'Production transaction updated successfully',
      data: data[0]
    });
  } catch (error) {
    console.error('Error updating production transaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update production transaction',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inventory/production
 * Delete production transaction
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Transaction ID is required'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if transaction exists and is a production transaction
    const { data: existingTransaction, error: existingError } = await supabase
      .from('inventory_transactions')
      .select('transaction_id')
      .eq('transaction_id', id)
      .in('transaction_type', ['생산입고', '생산출고'])
      .single();

    if (existingError || !existingTransaction) {
      return NextResponse.json({
        success: false,
        error: 'Production transaction not found'
      }, { status: 404 });
    }

    // Delete transaction
    const { error } = await supabase
      .from('inventory_transactions')
      .delete()
      .eq('transaction_id', id);

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to delete production transaction',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Production transaction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting production transaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete production transaction',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}