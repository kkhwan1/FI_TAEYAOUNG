import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { APIError, handleAPIError } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { metricsCollector } from '@/lib/metrics';

export const dynamic = 'force-dynamic';


export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/inventory/receiving';

  try {
    logger.info('Inventory receiving GET request', { endpoint });
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Simple query to get receiving transactions
    const { data: transactions, error } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('transaction_type', '입고')
      .order('transaction_date', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Get related data separately
    const itemIds = [...new Set(transactions?.map(t => t.item_id) || [])];
    const companyIds = [...new Set(transactions?.map(t => t.company_id).filter(Boolean) || [])];

    const { data: items } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, spec, unit')
      .in('item_id', itemIds);

    const { data: companies } = await supabase
      .from('companies')
      .select('company_id, company_name')
      .in('company_id', companyIds);

    // Combine data
    const enrichedTransactions = transactions?.map(transaction => ({
      ...transaction,
      item: items?.find(item => item.item_id === transaction.item_id),
      company: companies?.find(company => company.company_id === transaction.company_id)
    })) || [];

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Inventory receiving GET success', { endpoint, duration, transactionCount: enrichedTransactions.length });

    return NextResponse.json({
      success: true,
      data: {
        transactions: enrichedTransactions,
        summary: {
          total_count: enrichedTransactions.length,
          total_quantity: enrichedTransactions.reduce((sum, t) => sum + (t.quantity || 0), 0),
          total_value: enrichedTransactions.reduce((sum, t) => sum + ((t.quantity || 0) * (t.unit_price || 0)), 0)
        }
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Inventory receiving GET error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/inventory/receiving';

  try {
    logger.info('Inventory receiving POST request', { endpoint });

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
      item_id,
      quantity,
      unit_price,
      company_id,
      reference_number,
      reference_no,
      notes,
      arrival_date,
      lot_no,
      expiry_date,
      to_location
    } = body;

    // 필수 필드 검증
    if (!transaction_date || !item_id || quantity === undefined || unit_price === undefined) {
      return NextResponse.json({
        success: false,
        error: '필수 필드가 누락되었습니다. (거래일자, 품목, 수량, 단가 필수)'
      }, { status: 400 });
    }

    // 경계값 검증 (수량)
    if (typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json({
        success: false,
        error: '수량은 0보다 커야 합니다.'
      }, { status: 400 });
    }

    // 경계값 검증 (단가)
    if (typeof unit_price !== 'number' || unit_price < 0) {
      return NextResponse.json({
        success: false,
        error: '단가는 0 이상이어야 합니다.'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate total amount
    const total_amount = quantity * unit_price;

    // KOREAN ENCODING FIX: Use direct INSERT instead of RPC to preserve UTF-8
    // Insert transaction
    const { data: transactionData, error: transactionError } = await supabase
      .from('inventory_transactions')
      .insert({
        item_id,
        company_id,
        transaction_type: '입고',
        quantity,
        unit_price,
        total_amount,
        reference_number: reference_no || reference_number,
        transaction_date,
        arrival_date: arrival_date || null,
        notes,
        status: '완료'
      })
      .select('transaction_id')
      .single();

    if (transactionError) {
      console.error('Supabase transaction error:', transactionError);
      return NextResponse.json({
        success: false,
        error: '입고 등록 중 오류가 발생했습니다.',
        details: transactionError.message
      }, { status: 500 });
    }

    // Update stock
    const { data: itemData, error: stockError } = await supabase
      .from('items')
      .select('current_stock')
      .eq('item_id', item_id)
      .single();

    if (stockError) {
      console.error('Stock query error:', stockError);
      return NextResponse.json({
        success: false,
        error: '재고 조회 중 오류가 발생했습니다.',
        details: stockError.message
      }, { status: 500 });
    }

    const new_stock = (itemData?.current_stock || 0) + quantity;

    const { error: updateError } = await supabase
      .from('items')
      .update({ current_stock: new_stock })
      .eq('item_id', item_id);

    if (updateError) {
      console.error('Stock update error:', updateError);
      return NextResponse.json({
        success: false,
        error: '재고 업데이트 중 오류가 발생했습니다.',
        details: updateError.message
      }, { status: 500 });
    }

    const data = [{
      transaction_id: transactionData.transaction_id,
      item_id,
      quantity,
      unit_price,
      total_amount,
      current_stock: new_stock
    }];

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Inventory receiving POST success', { endpoint, duration, transactionId: data[0]?.transaction_id });

    return NextResponse.json({
      success: true,
      message: '입고가 성공적으로 등록되었습니다.',
      data: data[0]
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Inventory receiving POST error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}

/**
 * PUT /api/inventory/receiving
 * Update existing receiving transaction
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/inventory/receiving';

  try {
    logger.info('Inventory receiving PUT request', { endpoint });

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

    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '트랜잭션 ID가 필요합니다.'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if transaction exists and is a receiving transaction
    const { data: existingTransaction, error: existingError } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('transaction_id', id)
      .eq('transaction_type', '입고')
      .single();

    if (existingError || !existingTransaction) {
      return NextResponse.json({
        success: false,
        error: '입고 트랜잭션을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // CRITICAL: Prevent item_id changes to avoid stock corruption
    // Type normalization: Convert both to numbers for comparison
    if (updateData.item_id !== undefined && Number(updateData.item_id) !== Number(existingTransaction.item_id)) {
      return NextResponse.json({
        success: false,
        error: '품목 변경은 허용되지 않습니다. 기존 거래를 삭제하고 새로운 거래를 생성해주세요.',
        details: `기존 품목 ID: ${existingTransaction.item_id}, 요청 품목 ID: ${updateData.item_id}`
      }, { status: 400 });
    }

    // Validate fields if being updated
    if (updateData.quantity !== undefined && updateData.quantity <= 0) {
      return NextResponse.json({
        success: false,
        error: '수량은 0보다 커야 합니다.'
      }, { status: 400 });
    }

    if (updateData.unit_price !== undefined && updateData.unit_price < 0) {
      return NextResponse.json({
        success: false,
        error: '단가는 0 이상이어야 합니다.'
      }, { status: 400 });
    }

    // Recalculate total amount if quantity or unit_price is updated
    if (updateData.quantity !== undefined || updateData.unit_price !== undefined) {
      const newQuantity = updateData.quantity ?? existingTransaction.quantity;
      const newUnitPrice = updateData.unit_price ?? existingTransaction.unit_price;
      updateData.total_amount = newQuantity * newUnitPrice;
    }

    // Update stock if quantity changed (RECEIVING LOGIC: ADD to stock)
    if (updateData.quantity !== undefined) {
      const oldQuantity = existingTransaction.quantity;
      const newQuantity = updateData.quantity;
      const quantityDifference = newQuantity - oldQuantity;

      // Get current stock
      const { data: itemData, error: stockError } = await supabase
        .from('items')
        .select('current_stock')
        .eq('item_id', existingTransaction.item_id)
        .single();

      if (stockError) {
        console.error('Stock query error:', stockError);
        return NextResponse.json({
          success: false,
          error: '재고 조회 중 오류가 발생했습니다.',
          details: stockError.message
        }, { status: 500 });
      }

      const current_stock = itemData?.current_stock || 0;

      // RECEIVING LOGIC (opposite of shipping):
      // If increasing quantity (receiving more), ADD difference to stock
      // If decreasing quantity (receiving less), SUBTRACT difference from stock
      const new_stock = current_stock + quantityDifference;

      // Validate that stock doesn't go negative
      if (new_stock < 0) {
        return NextResponse.json({
          success: false,
          error: '재고가 음수가 될 수 없습니다.',
          details: `현재 재고: ${current_stock}, 수량 감소: ${-quantityDifference}, 결과 재고: ${new_stock}`
        }, { status: 400 });
      }

      const { error: updateStockError } = await supabase
        .from('items')
        .update({ current_stock: new_stock })
        .eq('item_id', existingTransaction.item_id);

      if (updateStockError) {
        console.error('Stock update error:', updateStockError);
        return NextResponse.json({
          success: false,
          error: '재고 업데이트 중 오류가 발생했습니다.',
          details: updateStockError.message
        }, { status: 500 });
      }
    }

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
        items!inner(item_code, item_name, spec, unit),
        companies(company_name)
      `);

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({
        success: false,
        error: '입고 수정 중 오류가 발생했습니다.',
        details: error.message
      }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Inventory receiving PUT success', { endpoint, duration, transactionId: id });

    return NextResponse.json({
      success: true,
      message: '입고가 성공적으로 수정되었습니다.',
      data: data[0]
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Inventory receiving PUT error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}

/**
 * DELETE /api/inventory/receiving
 * Delete receiving transaction and restore stock
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/inventory/receiving';

  try {
    logger.info('Inventory receiving DELETE request', { endpoint });

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '트랜잭션 ID가 필요합니다.'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if transaction exists and is a receiving transaction
    const { data: existingTransaction, error: existingError } = await supabase
      .from('inventory_transactions')
      .select('transaction_id, item_id, quantity')
      .eq('transaction_id', parseInt(id))
      .eq('transaction_type', '입고')
      .single();

    if (existingError || !existingTransaction) {
      return NextResponse.json({
        success: false,
        error: '입고 트랜잭션을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // Restore stock before deleting (RECEIVING LOGIC: SUBTRACT from stock when deleting)
    const { data: itemData, error: stockError } = await supabase
      .from('items')
      .select('current_stock')
      .eq('item_id', existingTransaction.item_id)
      .single();

    if (stockError) {
      console.error('Stock query error:', stockError);
      return NextResponse.json({
        success: false,
        error: '재고 조회 중 오류가 발생했습니다.',
        details: stockError.message
      }, { status: 500 });
    }

    const current_stock = itemData?.current_stock || 0;
    // RECEIVING DELETE: Subtract quantity (cancel the receiving)
    const restored_stock = current_stock - existingTransaction.quantity;

    // Validate that restored stock doesn't go negative
    if (restored_stock < 0) {
      return NextResponse.json({
        success: false,
        error: '입고 취소 시 재고가 음수가 될 수 없습니다.',
        details: `현재 재고: ${current_stock}, 입고 수량: ${existingTransaction.quantity}, 취소 후 재고: ${restored_stock}`
      }, { status: 400 });
    }

    const { error: updateStockError } = await supabase
      .from('items')
      .update({ current_stock: restored_stock })
      .eq('item_id', existingTransaction.item_id);

    if (updateStockError) {
      console.error('Stock update error:', updateStockError);
      return NextResponse.json({
        success: false,
        error: '재고 복원 중 오류가 발생했습니다.',
        details: updateStockError.message
      }, { status: 500 });
    }

    // Delete transaction
    const { error } = await supabase
      .from('inventory_transactions')
      .delete()
      .eq('transaction_id', parseInt(id));

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json({
        success: false,
        error: '입고 삭제 중 오류가 발생했습니다.',
        details: error.message
      }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Inventory receiving DELETE success', { endpoint, duration, transactionId: parseInt(id) });

    return NextResponse.json({
      success: true,
      message: '입고가 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Inventory receiving DELETE error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}