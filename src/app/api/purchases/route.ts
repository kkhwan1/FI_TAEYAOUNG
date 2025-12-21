import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { extractCompanyId, applyCompanyFilter } from '@/lib/filters';
import { z } from 'zod';

export const dynamic = 'force-dynamic';


// 매입 거래 생성 스키마
const PurchaseTransactionCreateSchema = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD'),
  supplier_id: z.number().positive('공급사 ID는 양수여야 합니다'),
  item_id: z.number().positive('품목 ID는 양수여야 합니다'),
  item_name: z.string().min(1, '품목명은 필수입니다'),
  spec: z.string().optional(),
  unit: z.string().optional(),
  // SCHEMA FIX: vehicle_model and material_type removed - columns not in Supabase yet
  // TODO: Re-enable when migration is applied
  // vehicle_model: z.string().optional(),
  // material_type: z.string().optional(),
  quantity: z.number().positive('수량은 0보다 커야 합니다'),
  unit_price: z.number().min(0, '단가는 0 이상이어야 합니다'),
  supply_amount: z.number().min(0, '공급가는 0 이상이어야 합니다'),
  tax_amount: z.number().min(0, '세액은 0 이상이어야 합니다').optional(),
  total_amount: z.number().min(0, '총액은 0 이상이어야 합니다'),
  payment_status: z.enum(['PENDING', 'PARTIAL', 'COMPLETE']).optional(),
  paid_amount: z.number().min(0).optional(),
  notes: z.string().optional(),  // Changed from 'description' to match form field
  reference_no: z.string().optional()
});

// GET: 매입 거래 목록 조회
export const GET = async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const offset = (page - 1) * limit;

    // 중앙 집중식 company_id 추출
    const companyId = extractCompanyId(searchParams, 'company_id');
    const item_id = searchParams.get('item_id');
    const vehicle_model = searchParams.get('vehicle_model');
    const payment_status = searchParams.get('payment_status');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const search = searchParams.get('search');
    const orderBy = searchParams.get('orderBy') || 'transaction_date';
    const order = searchParams.get('order') || 'desc';

    const supabase = getSupabaseClient();

    // Build query
    let query = supabase
      .from('purchase_transactions')
      .select(`
        *,
        supplier:companies!supplier_id(company_id, company_name, company_code),
        item:items!item_id(item_id, item_name, item_code)
      `, { count: 'exact' })
      .eq('is_active', true);

    // 중앙 집중식 거래처 필터 적용 (supplier_id)
    query = applyCompanyFilter(query, 'purchase_transactions', companyId, 'supplier');

    if (item_id) {
      query = query.eq('item_id', parseInt(item_id, 10));
    }

    // Note: vehicle_model filter temporarily disabled (column not in current schema)
    // if (vehicle_model) {
    //   query = query.ilike('vehicle_model', `%${vehicle_model}%`);
    // }

    if (payment_status) {
      query = query.eq('payment_status', payment_status);
    }

    if (start_date) {
      query = query.gte('transaction_date', start_date);
    }

    if (end_date) {
      query = query.lte('transaction_date', end_date);
    }

    // Note: search for joined table fields (supplier_name) needs to be done client-side
    // Don't apply search filter at DB level to allow filtering by supplier name
    // All filtering will be done client-side after fetching data

    // Apply ordering and pagination
    query = query
      .order(orderBy, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Purchase list error:', error);
      return NextResponse.json(
        { success: false, error: error?.message || '매입 거래 조회 실패' },
        { status: 500 }
      );
    }

    // Apply client-side filters for all search fields (transaction_no, item_name, supplier_name)
    let filteredData = data || [];
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter((txn: any) => {
        const transactionNo = txn.transaction_no?.toLowerCase() || '';
        const itemName = txn.item_name?.toLowerCase() || '';
        const supplierName = txn.supplier?.company_name?.toLowerCase() || '';
        return (
          transactionNo.includes(searchLower) ||
          itemName.includes(searchLower) ||
          supplierName.includes(searchLower)
        );
      });
    }

    // Handle payment_status filter (normalize COMPLETED to COMPLETE)
    if (payment_status) {
      const normalizedStatus = payment_status === 'COMPLETED' ? 'COMPLETE' : payment_status;
      filteredData = filteredData.filter((txn: any) => {
        const status = txn.payment_status || 'PENDING';
        return status === normalizedStatus;
      });
    }

    return NextResponse.json({
      success: true,
      data: filteredData,
      pagination: {
        page,
        limit,
        total: filteredData.length, // Use filtered count for accurate pagination
        totalPages: Math.ceil(filteredData.length / limit)
      }
    });
  } catch (error) {
    console.error('Purchase list error:', error);
    return NextResponse.json(
      { success: false, error: '매입 거래 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};

// POST: 매입 거래 생성 (재고 증가 포함)
export const POST = async (request: NextRequest) => {
  try {
    const text = await request.text();
    const body = JSON.parse(text);

    // Validate input
    const result = PurchaseTransactionCreateSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map((err: any) => err.message).join(', ');
      return NextResponse.json(
        { success: false, error: errorMessages || '입력 데이터가 유효하지 않습니다' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Verify supplier exists (all company types allowed)
    const { data: supplier, error: supplierError } = await supabase
      .from('companies')
      .select('company_id, company_type')
      .eq('company_id', result.data.supplier_id)
      .eq('is_active', true)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 업체 ID입니다' },
        { status: 400 }
      );
    }

    // Verify item exists only if item_id is provided
    let item = null;
    if (result.data.item_id) {
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('item_id, current_stock')
        .eq('item_id', result.data.item_id)
        .eq('is_active', true)
        .single();

      if (itemError || !itemData) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 품목 ID입니다' },
          { status: 400 }
        );
      }
      item = itemData;
    }

    // Generate transaction number
    const { data: transactionNo, error: genError } = await supabase
      .rpc('generate_purchase_no');

    if (genError) {
      console.error('Generate transaction no error:', genError);
      return NextResponse.json(
        { success: false, error: genError?.message || '거래번호 생성 실패' },
        { status: 500 }
      );
    }

    // Create transaction
    const { data, error } = await supabase
      .from('purchase_transactions')
      .insert({
        ...result.data,
        transaction_no: transactionNo,
        payment_status: result.data.payment_status || 'PENDING',
        paid_amount: result.data.paid_amount || 0,
        is_active: true
      })
      .select(`
        *,
        supplier:companies!supplier_id(company_id, company_name, company_code),
        item:items!item_id(item_id, item_name, item_code)
      `)
      .single();

    if (error) {
      console.error('Purchase create error:', error);
      return NextResponse.json(
        { success: false, error: error?.message || '매입 거래 생성 실패' },
        { status: 500 }
      );
    }

    // Update item stock (increase) only if item_id is provided
    if (result.data.item_id && item) {
      const newStock = (item.current_stock || 0) + result.data.quantity;
      const { error: stockError } = await supabase
        .from('items')
        .update({
          current_stock: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('item_id', result.data.item_id);

      if (stockError) {
        console.error('Stock update error:', stockError);
        // Rollback transaction by deleting
        await supabase
          .from('purchase_transactions')
          .delete()
          .eq('transaction_id', data.transaction_id);

        return NextResponse.json(
          { success: false, error: '재고 업데이트 실패로 거래가 취소되었습니다' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data,
      message: '매입 거래가 생성되고 재고가 증가되었습니다'
    });
  } catch (error) {
    console.error('Purchase create error:', error);
    const errorMessage = error instanceof Error ? error.message : '매입 거래 생성 중 오류가 발생했습니다';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
};

// PUT: 매입 거래 수정
export const PUT = async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '거래 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const text = await request.text();
    const body = JSON.parse(text);

    // Validate update data (use partial schema for optional updates)
    const UpdateSchema = PurchaseTransactionCreateSchema.partial();
    const result = UpdateSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map((err: any) => err.message).join(', ');
      return NextResponse.json(
        { success: false, error: errorMessages || '입력 데이터가 유효하지 않습니다' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Get original transaction for stock adjustment
    const { data: originalData, error: fetchError } = await supabase
      .from('purchase_transactions')
      .select('item_id, quantity')
      .eq('transaction_id', parseInt(id, 10))
      .single();

    if (fetchError || !originalData) {
      return NextResponse.json(
        { success: false, error: '거래를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // CRITICAL FIX #3: Prevent item_id changes (business rule)
    if (body.item_id !== undefined && body.item_id !== originalData.item_id) {
      return NextResponse.json(
        { success: false, error: '품목은 변경할 수 없습니다. 거래를 삭제하고 새로 생성하세요.' },
        { status: 400 }
      );
    }

    // Update transaction
    const { data, error } = await supabase
      .from('purchase_transactions')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('transaction_id', parseInt(id, 10))
      .select(`
        *,
        supplier:companies!supplier_id(company_id, company_name, company_code),
        item:items!item_id(item_id, item_name, item_code)
      `)
      .single();

    if (error) {
      console.error('Purchase update error:', error);
      return NextResponse.json(
        { success: false, error: error?.message || '매입 거래 수정 실패' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: '거래를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Update stock if quantity changed
    if (body.quantity !== undefined && body.quantity !== originalData.quantity) {
      const quantityDiff = body.quantity - originalData.quantity;
      const item_id = body.item_id || originalData.item_id;

      // Get current stock
      const { data: currentItem, error: getItemError } = await supabase
        .from('items')
        .select('current_stock')
        .eq('item_id', item_id)
        .single();

      if (!getItemError && currentItem) {
        const newStock = (currentItem.current_stock || 0) + quantityDiff;

        // Prevent negative stock when decreasing quantity
        if (newStock < 0) {
          return NextResponse.json(
            { success: false, error: '재고가 부족하여 수량을 감소시킬 수 없습니다' },
            { status: 400 }
          );
        }

        const { error: stockError } = await supabase
          .from('items')
          .update({
            current_stock: newStock,
            updated_at: new Date().toISOString()
          })
          .eq('item_id', item_id);

        if (stockError) {
          console.error('Stock adjustment error:', stockError);
          // CRITICAL FIX #2: Rollback transaction update on stock failure
          await supabase
            .from('purchase_transactions')
            .update({
              quantity: originalData.quantity,
              item_id: originalData.item_id,
              updated_at: data.updated_at  // Restore original timestamp
            })
            .eq('transaction_id', parseInt(id, 10));

          return NextResponse.json(
            { success: false, error: '재고 업데이트 실패로 거래 수정이 취소되었습니다' },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      data,
      message: '매입 거래가 수정되었습니다'
    });
  } catch (error) {
    console.error('Purchase update error:', error);
    return NextResponse.json(
      { success: false, error: '매입 거래 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};

// DELETE: 매입 거래 삭제 (soft delete, 재고 감소)
export const DELETE = async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '거래 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Get transaction data for stock reversal
    const { data: transactionData, error: fetchError } = await supabase
      .from('purchase_transactions')
      .select('item_id, quantity')
      .eq('transaction_id', parseInt(id, 10))
      .single();

    if (fetchError || !transactionData) {
      return NextResponse.json(
        { success: false, error: '거래를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Soft delete transaction
    const { data, error } = await supabase
      .from('purchase_transactions')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('transaction_id', parseInt(id, 10))
      .select()
      .single();

    if (error) {
      console.error('Purchase delete error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: '거래를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Decrease stock (reverse the purchase)
    const { data: currentItem, error: getItemError } = await supabase
      .from('items')
      .select('current_stock')
      .eq('item_id', transactionData.item_id)
      .single();

    if (!getItemError && currentItem) {
      const newStock = (currentItem.current_stock || 0) - transactionData.quantity;

      // Prevent negative stock
      if (newStock < 0) {
        // Rollback soft delete
        await supabase
          .from('purchase_transactions')
          .update({ is_active: true })
          .eq('transaction_id', parseInt(id, 10));

        return NextResponse.json(
          { success: false, error: '재고가 부족하여 거래를 삭제할 수 없습니다' },
          { status: 400 }
        );
      }

      const { error: stockError } = await supabase
        .from('items')
        .update({
          current_stock: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('item_id', transactionData.item_id);

      if (stockError) {
        console.error('Stock reversal error:', stockError);
        // Continue even if stock update fails, transaction is already marked deleted
      }
    }

    return NextResponse.json({
      success: true,
      message: '매입 거래가 삭제되고 재고가 조정되었습니다'
    });
  } catch (error) {
    console.error('Purchase delete error:', error);
    return NextResponse.json(
      { success: false, error: '매입 거래 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};
