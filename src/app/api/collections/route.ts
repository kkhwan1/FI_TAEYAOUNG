import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { mcp__supabase__execute_sql } from '@/lib/supabase-mcp';
import { parsePagination, buildPaginatedResponse } from '@/lib/pagination';
import { extractCompanyId, applyCompanyFilter } from '@/lib/filters';
import { z } from 'zod';

export const dynamic = 'force-dynamic';


// 수금 생성 스키마
const CollectionCreateSchema = z.object({
  collection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD'),
  sales_transaction_id: z.number().positive('판매 거래 ID는 양수여야 합니다'),
  collected_amount: z.number().positive('수금 금액은 0보다 커야 합니다'),
  payment_method: z.enum(['CASH', 'TRANSFER', 'CHECK', 'CARD', 'BILL']),
  collection_no: z.string().max(50).optional(),
  bank_name: z.string().max(100).optional(),
  account_number: z.string().max(50).optional(),
  check_number: z.string().max(50).optional(),
  card_number: z.string().max(20).optional(),
  bill_number: z.string().max(50).optional(),
  bill_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD').optional(),
  bill_drawer: z.string().max(100).optional(),
  notes: z.string().optional()
});

// 수금 수정 스키마
const CollectionUpdateSchema = z.object({
  collected_amount: z.number().positive('수금 금액은 0보다 커야 합니다').optional(),
  collection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD').optional(),
  notes: z.string().optional()
});

// GET: 수금 목록 조회
export const GET = async (request: NextRequest) => {
  try {
    console.log('=== Collections GET Request Start ===');
    const searchParams = request.nextUrl.searchParams;
    const { page, limit, offset } = parsePagination({
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined
    });

    console.log('Pagination:', { page, limit, offset });

    // 중앙 집중식 company_id 추출
    const companyId = extractCompanyId(searchParams, 'company_id');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const payment_method = searchParams.get('payment_method');
    const search = searchParams.get('search');
    const orderBy = searchParams.get('orderBy') || 'collection_date';
    const order = searchParams.get('order') || 'desc';

    // Build query with joins
    let query = supabaseAdmin
      .from('collections')
      .select(`
        *,
        sales_transaction:sales_transactions!sales_transaction_id(
          transaction_id,
          transaction_no,
          transaction_date,
          total_amount,
          payment_status,
          customer_id
        ),
        customer:companies!customer_id(
          company_id,
          company_name,
          company_code
        )
      `, { count: 'exact' })
      .eq('is_active', true);

    // 중앙 집중식 거래처 필터 적용 (customer_id)
    query = applyCompanyFilter(query, 'collections', companyId, 'customer');

    // Apply filters
    if (startDate) {
      query = query.gte('collection_date', startDate);
    }

    if (endDate) {
      query = query.lte('collection_date', endDate);
    }

    if (payment_method) {
      query = query.eq('payment_method', payment_method);
    }

    if (search) {
      // Search by collection_no or customer name
      // First, find customer IDs matching the search term
      const { data: matchingCustomers } = await supabaseAdmin
        .from('companies')
        .select('company_id')
        .or(`company_name.ilike.%${search}%,company_code.ilike.%${search}%`)
        .limit(100);
      
      const customerIds = matchingCustomers?.map(c => c.company_id) || [];
      
      // Build search conditions
      const searchConditions: string[] = [];
      searchConditions.push(`collection_no.ilike.%${search}%`);
      
      if (customerIds.length > 0) {
        // Search by customer_id if we found matching customers
        const customerIdConditions = customerIds.map(id => `customer_id.eq.${id}`).join(',');
        searchConditions.push(customerIdConditions);
      }
      
      if (searchConditions.length > 0) {
        query = query.or(searchConditions.join(','));
      }
    }

    // Apply ordering and pagination
    // Validate offset and limit to prevent negative values
    const safeOffset = Math.max(0, offset);
    const safeLimit = Math.max(1, limit);
    
    query = query
      .order(orderBy, { ascending: order === 'asc' })
      .range(safeOffset, safeOffset + safeLimit - 1);
    
    console.log('Query range:', { safeOffset, safeLimit, end: safeOffset + safeLimit - 1 });

    const { data, error, count } = await query;

    if (error) {
      console.error('=== Collections list query error ===');
      console.error('Error:', error);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      console.error('Error details:', error?.details);
      console.error('Error hint:', error?.hint);
      return NextResponse.json(
        { 
          success: false, 
          error: error?.message || '수금 조회 실패',
          details: {
            code: error?.code,
            hint: error?.hint,
            details: error?.details
          }
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error: any) {
    console.error('=== Collections GET catch error ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || '수금 조회 중 오류가 발생했습니다',
        details: {
          type: error?.constructor?.name,
          message: error?.message
        }
      },
      { status: 500 }
    );
  }
};

// POST: 수금 생성
export const POST = async (request: NextRequest) => {
  try {
    console.log('=== Collections POST Request Start ===');
    // Korean encoding: Use request.text() + JSON.parse() pattern
    const text = await request.text();
    const body = JSON.parse(text);

    // Validate input
    const result = CollectionCreateSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map((err: { message: string }) => err.message).join(', ');
      return NextResponse.json(
        { success: false, error: errorMessages || '입력 데이터가 유효하지 않습니다' },
        { status: 400 }
      );
    }

    const validatedData = result.data;

    // Verify sales transaction exists and get current status
    const { data: salesTx, error: salesError } = await supabaseAdmin
      .from('sales_transactions')
      .select('transaction_id, customer_id, total_amount, payment_status')
      .eq('transaction_id', validatedData.sales_transaction_id)
      .eq('is_active', true)
      .single() as any;

    if (salesError || !salesTx) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 판매 거래 ID입니다' },
        { status: 400 }
      );
    }

    // Calculate total collected amount for this sales transaction
    const { data: existingCollections } = (await supabaseAdmin
      .from('collections')
      .select('collected_amount')
      .eq('sales_transaction_id', validatedData.sales_transaction_id)
      .eq('is_active', true)) as any;

    const previouslyCollected = existingCollections?.reduce(
      (sum: number, col: any) => sum + (col.collected_amount || 0),
      0
    ) || 0;

    const totalCollected = previouslyCollected + validatedData.collected_amount;
    const remaining = salesTx.total_amount - totalCollected;

    // Validate that collection doesn't exceed total amount
    if (remaining < 0) {
      return NextResponse.json(
        {
          success: false,
          error: `수금 금액이 잔액을 초과합니다. 잔액: ${salesTx.total_amount - previouslyCollected}원`
        },
        { status: 400 }
      );
    }

    // Determine new payment status
    let newPaymentStatus: 'PENDING' | 'PARTIAL' | 'COMPLETE';
    if (remaining === 0) {
      newPaymentStatus = 'COMPLETE';
    } else if (remaining < salesTx.total_amount) {
      newPaymentStatus = 'PARTIAL';
    } else {
      newPaymentStatus = 'PENDING';
    }

    // Generate collection number if not provided
    let collectionNo = validatedData.collection_no;
    if (!collectionNo) {
      const { data: generatedNo, error: genError } = await supabaseAdmin
        .rpc('generate_collection_no');

      if (genError) {
        console.error('Generate collection no error:', genError);
        // Fallback: Use timestamp-based number
        const timestamp = new Date().getTime();
        collectionNo = `COL-${timestamp}`;
      } else {
        collectionNo = generatedNo;
      }
    }

    // Verify customer exists before inserting
    if (!salesTx.customer_id) {
      return NextResponse.json(
        { success: false, error: '고객 ID가 없습니다' },
        { status: 400 }
      );
    }

    const { data: customerData, error: customerError } = await supabaseAdmin
      .from('companies')
      .select('company_id')
      .eq('company_id', salesTx.customer_id)
      .single();

    if (customerError || !customerData) {
      console.error('Customer verification error:', customerError);
      return NextResponse.json(
        { 
          success: false, 
          error: `유효하지 않은 고객 ID: ${salesTx.customer_id}`,
          details: customerError
        },
        { status: 400 }
      );
    }

    // Insert collection using Supabase client
    const insertData = {
      collection_no: collectionNo,
      collection_date: validatedData.collection_date,
      sales_transaction_id: validatedData.sales_transaction_id,
      customer_id: salesTx.customer_id,
      collected_amount: validatedData.collected_amount,
      payment_method: validatedData.payment_method,
      bank_name: validatedData.bank_name || null,
      account_number: validatedData.account_number || null,
      check_number: validatedData.check_number || null,
      card_number: validatedData.card_number || null,
      bill_number: validatedData.bill_number || null,
      bill_date: validatedData.bill_date || null,
      bill_drawer: validatedData.bill_drawer || null,
      notes: validatedData.notes || null,
      is_active: true
    };

    console.log('Inserting collection:', {
      collection_no: insertData.collection_no,
      sales_transaction_id: insertData.sales_transaction_id,
      customer_id: insertData.customer_id,
      collected_amount: insertData.collected_amount
    });

    const { data: insertedCollection, error: insertError } = await (supabaseAdmin
      .from('collections') as any)
      .insert([insertData])
      .select('collection_id')
      .single();

    if (insertError || !insertedCollection) {
      console.error('Collection insert error:', {
        error: insertError,
        errorMessage: insertError?.message,
        errorCode: insertError?.code,
        errorDetails: insertError?.details,
        errorHint: insertError?.hint,
        insertData: {
          ...insertData,
          customer_id: insertData.customer_id
        }
      });
      return NextResponse.json(
        { 
          success: false, 
          error: insertError?.message || '수금 생성 실패',
          details: {
            code: insertError?.code,
            hint: insertError?.hint,
            details: insertError?.details
          }
        },
        { status: 500 }
      );
    }

    const collectionId = insertedCollection.collection_id;

    // Update sales transaction payment status
    console.log('Updating sales transaction payment status:', {
      transaction_id: validatedData.sales_transaction_id,
      newPaymentStatus,
      previousStatus: salesTx.payment_status
    });

    // First verify the transaction exists and is active
    const { data: verifyTx, error: verifyError } = await supabaseAdmin
      .from('sales_transactions')
      .select('transaction_id, payment_status, is_active')
      .eq('transaction_id', validatedData.sales_transaction_id)
      .maybeSingle();

    if (verifyError) {
      console.error('Transaction verification error:', verifyError);
      // Rollback
      await supabaseAdmin.from('collections').delete().eq('collection_id', collectionId);
      return NextResponse.json(
        { success: false, error: `거래 확인 실패: ${verifyError.message}` },
        { status: 500 }
      );
    }

    if (!verifyTx || !verifyTx.is_active) {
      console.error('Transaction not found or inactive:', {
        transaction_id: validatedData.sales_transaction_id,
        found: !!verifyTx,
        is_active: verifyTx?.is_active
      });
      // Rollback
      await supabaseAdmin.from('collections').delete().eq('collection_id', collectionId);
      return NextResponse.json(
        { success: false, error: '거래를 찾을 수 없거나 비활성 상태입니다' },
        { status: 400 }
      );
    }

    // Now update the payment status and paid_amount
    // Note: updated_at is auto-updated by trigger, don't set it manually
    const { data: updatedSalesTx, error: updateError } = await (supabaseAdmin
      .from('sales_transactions') as any)
      .update({
        payment_status: newPaymentStatus,
        paid_amount: totalCollected
      })
      .eq('transaction_id', validatedData.sales_transaction_id)
      .select('transaction_id, payment_status')
      .maybeSingle();

    if (updateError) {
      console.error('Sales transaction update error details:', {
        error: updateError,
        errorMessage: updateError?.message,
        errorCode: updateError?.code,
        errorDetails: updateError?.details,
        errorHint: updateError?.hint,
        transaction_id: validatedData.sales_transaction_id,
        newPaymentStatus,
        previousStatus: salesTx.payment_status
      });
      
      // Rollback: Delete the collection
      const { error: rollbackError } = await supabaseAdmin
        .from('collections')
        .delete()
        .eq('collection_id', collectionId);

      if (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }

      return NextResponse.json(
        { 
          success: false, 
          error: `판매 거래 상태 업데이트 실패: ${updateError?.message || '알 수 없는 오류'}`,
          details: {
            transaction_id: validatedData.sales_transaction_id,
            newPaymentStatus,
            previousStatus: salesTx.payment_status,
            errorCode: updateError?.code
          }
        },
        { status: 500 }
      );
    }

    if (!updatedSalesTx) {
      console.error('Sales transaction not found or not updated:', {
        transaction_id: validatedData.sales_transaction_id,
        newPaymentStatus
      });
      
      // Rollback: Delete the collection
      const { error: rollbackError } = await supabaseAdmin
        .from('collections')
        .delete()
        .eq('collection_id', collectionId);

      if (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }

      return NextResponse.json(
        { 
          success: false, 
          error: '판매 거래를 찾을 수 없거나 업데이트에 실패했습니다',
          details: {
            transaction_id: validatedData.sales_transaction_id,
            newPaymentStatus,
            previousStatus: salesTx.payment_status
          }
        },
        { status: 500 }
      );
    }

    console.log('Sales transaction payment status updated successfully:', {
      transaction_id: updatedSalesTx.transaction_id,
      payment_status: updatedSalesTx.payment_status
    });

    // Fetch created collection with joins using Supabase client
    const { data: createdCollection, error: fetchError } = await supabaseAdmin
      .from('collections')
      .select(`
        *,
        sales_transaction:sales_transactions!sales_transaction_id(
          transaction_id,
          transaction_no,
          transaction_date,
          total_amount,
          payment_status
        ),
        customer:companies!customer_id(
          company_id,
          company_name,
          company_code
        )
      `)
      .eq('collection_id', collectionId)
      .single() as any;

    if (fetchError || !createdCollection) {
      console.error('Fetch created collection error:', fetchError);
      return NextResponse.json({
        success: true,
        data: { collection_id: collectionId },
        message: '수금이 생성되었으나 조회에 실패했습니다'
      });
    }

    return NextResponse.json({
      success: true,
      data: createdCollection,
      message: '수금이 생성되고 판매 거래 상태가 업데이트되었습니다'
    });
  } catch (error: any) {
    console.error('=== Collection create error ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    const errorMessage = error instanceof Error ? error.message : '수금 생성 중 오류가 발생했습니다';
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: {
          type: error?.constructor?.name,
          message: error?.message,
          code: error?.code,
          hint: error?.hint
        }
      },
      { status: 500 }
    );
  }
};

// PUT: 수금 수정 (금액, 날짜, 메모만)
export const PUT = async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '수금 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // Korean encoding
    const text = await request.text();
    const body = JSON.parse(text);

    // Validate update data
    const result = CollectionUpdateSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map((err: { message: string }) => err.message).join(', ');
      return NextResponse.json(
        { success: false, error: errorMessages || '입력 데이터가 유효하지 않습니다' },
        { status: 400 }
      );
    }

    // Get original collection data
    const collectionId = parseInt(id);
    const { data: originalCollection, error: fetchError } = await supabaseAdmin
      .from('collections')
      .select('collection_id, sales_transaction_id, collected_amount')
      .eq('collection_id', collectionId)
      .eq('is_active', true)
      .single() as any;

    if (fetchError || !originalCollection) {
      return NextResponse.json(
        { success: false, error: '수금을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // If amount is being changed, recalculate payment status
    let needsStatusUpdate = false;
    let newPaymentStatus: 'PENDING' | 'PARTIAL' | 'COMPLETE' = 'PENDING';

    if (body.collected_amount !== undefined && body.collected_amount !== originalCollection.collected_amount) {
      needsStatusUpdate = true;

      // Get sales transaction details
      const { data: salesTx, error: salesError } = await supabaseAdmin
        .from('sales_transactions')
        .select('total_amount')
        .eq('transaction_id', originalCollection.sales_transaction_id)
        .single() as any;

      if (salesError || !salesTx) {
        return NextResponse.json(
          { success: false, error: '판매 거래를 찾을 수 없습니다' },
          { status: 400 }
        );
      }

      // Calculate total collected (excluding current collection)
      const { data: otherCollections } = (await supabaseAdmin
        .from('collections')
        .select('collected_amount')
        .eq('sales_transaction_id', originalCollection.sales_transaction_id)
        .eq('is_active', true)
        .neq('collection_id', collectionId)) as any;

      const otherCollectedAmount = otherCollections?.reduce(
        (sum: number, col: any) => sum + (col.collected_amount || 0),
        0
      ) || 0;

      const totalCollected = otherCollectedAmount + body.collected_amount;
      const remaining = salesTx.total_amount - totalCollected;

      // Validate that new amount doesn't exceed total
      if (remaining < 0) {
        return NextResponse.json(
          {
            success: false,
            error: `수금 금액이 잔액을 초과합니다. 최대 수금 가능 금액: ${salesTx.total_amount - otherCollectedAmount}원`
          },
          { status: 400 }
        );
      }

      // Determine new payment status
      if (remaining === 0) {
        newPaymentStatus = 'COMPLETE';
      } else if (remaining < salesTx.total_amount) {
        newPaymentStatus = 'PARTIAL';
      } else {
        newPaymentStatus = 'PENDING';
      }
    }

    // Update collection
    const { data: updatedCollection, error: updateError } = await (supabaseAdmin
      .from('collections') as any)
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('collection_id', collectionId)
      .select(`
        *,
        sales_transaction:sales_transactions!sales_transaction_id(
          transaction_id,
          transaction_no,
          transaction_date,
          total_amount,
          payment_status
        ),
        customer:companies!customer_id(
          company_id,
          company_name,
          company_code
        )
      `)
      .single();

    if (updateError) {
      console.error('Collection update error:', updateError);
      return NextResponse.json(
        { success: false, error: updateError?.message || '수금 수정 실패' },
        { status: 500 }
      );
    }

    if (!updatedCollection) {
      return NextResponse.json(
        { success: false, error: '수금을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Update sales transaction status if needed
    if (needsStatusUpdate) {
      const { error: statusError } = await (supabaseAdmin
        .from('sales_transactions') as any)
        .update({
          payment_status: newPaymentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('transaction_id', originalCollection.sales_transaction_id);

      if (statusError) {
        console.error('Sales transaction status update error:', statusError);
        // Continue anyway - collection is updated
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedCollection,
      message: needsStatusUpdate
        ? '수금이 수정되고 판매 거래 상태가 업데이트되었습니다'
        : '수금이 수정되었습니다'
    });
  } catch (error) {
    console.error('Collection update error:', error);
    return NextResponse.json(
      { success: false, error: '수금 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};

// DELETE: 수금 삭제 (soft delete)
export const DELETE = async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '수금 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // Get collection data for payment status recalculation
    const collectionId = parseInt(id);
    const { data: collection, error: fetchError } = await supabaseAdmin
      .from('collections')
      .select('sales_transaction_id, collected_amount')
      .eq('collection_id', collectionId)
      .single() as any;

    if (fetchError || !collection) {
      return NextResponse.json(
        { success: false, error: '수금을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Soft delete collection
    const { data, error } = await (supabaseAdmin
      .from('collections') as any)
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('collection_id', collectionId)
      .select()
      .single();

    if (error) {
      console.error('Collection delete error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: '수금을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Recalculate payment status for sales transaction
    const { data: salesTx } = await supabaseAdmin
      .from('sales_transactions')
      .select('total_amount')
      .eq('transaction_id', collection.sales_transaction_id)
      .single() as any;

    if (salesTx) {
      const { data: remainingCollections } = (await supabaseAdmin
        .from('collections')
        .select('collected_amount')
        .eq('sales_transaction_id', collection.sales_transaction_id)
        .eq('is_active', true)) as any;

      const totalCollected = remainingCollections?.reduce(
        (sum: number, col: any) => sum + (col.collected_amount || 0),
        0
      ) || 0;

      const remaining = salesTx.total_amount - totalCollected;

      let newPaymentStatus: 'PENDING' | 'PARTIAL' | 'COMPLETE';
      if (remaining === 0 && totalCollected > 0) {
        newPaymentStatus = 'COMPLETE';
      } else if (remaining > 0 && totalCollected > 0) {
        newPaymentStatus = 'PARTIAL';
      } else {
        newPaymentStatus = 'PENDING';
      }

      await (supabaseAdmin
        .from('sales_transactions') as any)
        .update({
          payment_status: newPaymentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('transaction_id', collection.sales_transaction_id);
    }

    return NextResponse.json({
      success: true,
      message: '수금이 삭제되고 판매 거래 상태가 업데이트되었습니다'
    });
  } catch (error) {
    console.error('Collection delete error:', error);
    return NextResponse.json(
      { success: false, error: '수금 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};
