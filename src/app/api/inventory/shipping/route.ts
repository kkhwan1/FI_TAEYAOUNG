import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { APIError, handleAPIError } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { metricsCollector } from '@/lib/metrics';

export const dynamic = 'force-dynamic';


export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/inventory/shipping';

  try {
    logger.info('Inventory shipping GET request', { endpoint });
    const supabase = supabaseAdmin;

    const { data: transactions, error } = await supabase
      .from('inventory_transactions')
      .select(`
        *,
        items!inner(item_code, item_name, spec, unit),
        companies(company_name),
        users!created_by(username)
      `)
      .eq('transaction_type', '출고')
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Inventory shipping GET success', { endpoint, duration, transactionCount: transactions?.length || 0 });

    return NextResponse.json({ success: true, data: { transactions: transactions || [] } }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Inventory shipping GET error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}

/**
 * POST /api/inventory/shipping
 * Create new shipping transaction
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/inventory/shipping';

  try {
    logger.info('Inventory shipping POST request', { endpoint });
    
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
      lot_no,
      expiry_date,
      location,
      delivery_date,
      notes,
      created_by
    } = body;

    // 필수 필드 검증
    if (!transaction_date || !item_id || quantity === undefined || unit_price === undefined || !created_by) {
      return NextResponse.json({
        success: false,
        error: '필수 필드가 누락되었습니다. (거래일자, 품목, 수량, 단가, 작성자 필수)'
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

    const supabase = supabaseAdmin;

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

    // 거래처 존재 및 활성 상태 확인 (company_id가 있는 경우)
    if (company_id) {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('company_id, company_name, company_type, is_active')
        .eq('company_id', company_id)
        .single();

      if (companyError || !company) {
        return NextResponse.json({
          success: false,
          error: '존재하지 않는 거래처입니다.'
        }, { status: 404 });
      }

      if (!company.is_active) {
        return NextResponse.json({
          success: false,
          error: '비활성화된 거래처입니다.'
        }, { status: 400 });
      }
    }

    // Calculate total amount
    const total_amount = quantity * unit_price;

    // Insert shipping transaction
    const { data, error } = await supabase
      .from('inventory_transactions')
      .insert([{
        item_id,
        company_id,
        created_by,
        transaction_type: '출고',
        quantity,
        unit_price,
        total_amount,
        location,
        delivery_date,
        lot_number: lot_no,
        expiry_date,
        reference_number,
        transaction_date,
        notes
      }])
      .select(`
        *,
        items!inner(item_code, item_name, spec, unit),
        companies(company_name)
      `);

    if (error) {
      console.error('Supabase insert error:', error);
      console.error('Insert data:', {
        item_id,
        company_id,
        created_by,
        transaction_type: '출고',
        quantity,
        unit_price,
        total_amount,
        location,
        lot_number: lot_no,
        expiry_date,
        reference_number,
        transaction_date,
        notes
      });
      return NextResponse.json({
        success: false,
        error: '출고 등록 중 오류가 발생했습니다.',
        details: error.message
      }, { status: 500 });
    }

    // Update stock - subtract shipped quantity
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

    const new_stock = (itemData?.current_stock || 0) - quantity;

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

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Inventory shipping POST success', { endpoint, duration, transactionId: data[0]?.transaction_id });

    return NextResponse.json({
      success: true,
      message: '출고가 성공적으로 등록되었습니다.',
      data: data[0]
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Inventory shipping POST error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}

/**
 * PUT /api/inventory/shipping
 * Update existing shipping transaction
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body with error handling (Korean UTF-8 support)
    let body;
    try {
      const text = await request.text();
      body = JSON.parse(text);
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        error: '잘못된 JSON 형식입니다.'
      }, { status: 400 });
    }
    const { id, ...updateData } = body;

          if (!id) {
        return NextResponse.json({
          success: false,
          error: 'Transaction ID is required'
        }, { status: 400 });
      }

      const supabase = supabaseAdmin;

      // Check if transaction exists and is a shipping transaction
      const { data: existingTransaction, error: existingError } = await supabase
        .from('inventory_transactions')
        .select('*')
        .eq('transaction_id', id)
        .eq('transaction_type', '출고')
        .single();

    if (existingError || !existingTransaction) {
      return NextResponse.json({
        success: false,
        error: 'Shipping transaction not found'
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
        companies(company_name),
        users!created_by(username)
      `);

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to update shipping transaction',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Shipping transaction updated successfully',
      data: data[0]
    });
  } catch (error) {
    console.error('Error updating shipping transaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update shipping transaction',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inventory/shipping
 * Delete shipping transaction
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

      const supabase = supabaseAdmin;

      // Check if transaction exists and is a shipping transaction
      const { data: existingTransaction, error: existingError } = await supabase
        .from('inventory_transactions')
        .select('transaction_id')
        .eq('transaction_id', parseInt(id))
      .eq('transaction_type', '출고')
      .single();

    if (existingError || !existingTransaction) {
      return NextResponse.json({
        success: false,
        error: 'Shipping transaction not found'
      }, { status: 404 });
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
        error: 'Failed to delete shipping transaction',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Shipping transaction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting shipping transaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete shipping transaction',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}