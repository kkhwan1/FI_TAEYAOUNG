import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { parsePagination, buildPaginatedResponse } from '@/lib/pagination';
import { extractCompanyId, applyCompanyFilter } from '@/lib/filters';
import { z } from 'zod';

export const dynamic = 'force-dynamic';


// 지급 생성 스키마
const PaymentCreateSchema = z.object({
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD'),
  purchase_transaction_id: z.number().positive('매입 거래 ID는 양수여야 합니다'),
  paid_amount: z.number().positive('지급 금액은 0보다 커야 합니다'),
  payment_method: z.enum(['CASH', 'TRANSFER', 'CHECK', 'CARD', 'BILL']),
  payment_no: z.string().max(50).optional(),
  bank_name: z.string().max(100).optional(),
  account_number: z.string().max(50).optional(),
  check_number: z.string().max(50).optional(),
  card_number: z.string().max(20).optional(),
  bill_number: z.string().max(50).optional(),
  bill_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD').optional(),
  bill_drawer: z.string().max(100).optional(),
  notes: z.string().optional()
});

// 지급 수정 스키마
const PaymentUpdateSchema = z.object({
  paid_amount: z.number().positive('지급 금액은 0보다 커야 합니다').optional(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD').optional(),
  notes: z.string().optional()
});

// GET: 지급 목록 조회
export const GET = async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit, offset } = parsePagination({
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined
    });

    // 중앙 집중식 company_id 추출
    const companyId = extractCompanyId(searchParams, 'company_id');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const payment_method = searchParams.get('payment_method');
    const search = searchParams.get('search');
    const orderBy = searchParams.get('orderBy') || 'payment_date';
    const order = searchParams.get('order') || 'desc';

    // Build query with joins
    let query = supabaseAdmin
      .from('payments')
      .select(`
        *,
        purchase_transaction:purchase_transactions!purchase_transaction_id(
          transaction_id,
          transaction_no,
          transaction_date,
          total_amount,
          payment_status,
          supplier_id
        ),
        supplier:companies!supplier_id(
          company_id,
          company_name,
          company_code
        )
      `, { count: 'exact' })
      .eq('is_active', true);

    // 중앙 집중식 거래처 필터 적용 (supplier_id)
    query = applyCompanyFilter(query, 'payments', companyId, 'supplier');

    // Apply filters
    if (startDate) {
      query = query.gte('payment_date', startDate);
    }

    if (endDate) {
      query = query.lte('payment_date', endDate);
    }

    if (payment_method) {
      query = query.eq('payment_method', payment_method);
    }

    if (search) {
      // Search by payment_no or supplier name
      // First, find supplier IDs matching the search term
      const { data: matchingSuppliers } = await supabaseAdmin
        .from('companies')
        .select('company_id')
        .or(`company_name.ilike.%${search}%,company_code.ilike.%${search}%`)
        .limit(100);
      
      const supplierIds = matchingSuppliers?.map(s => s.company_id) || [];
      
      // Get purchase transaction IDs for matching suppliers
      let purchaseTransactionIds: number[] = [];
      if (supplierIds.length > 0) {
        const { data: matchingPurchases } = await supabaseAdmin
          .from('purchase_transactions')
          .select('transaction_id')
          .in('supplier_id', supplierIds)
          .eq('is_active', true)
          .limit(1000);
        
        purchaseTransactionIds = matchingPurchases?.map(p => p.transaction_id) || [];
      }
      
      // Build search conditions
      const searchConditions: string[] = [];
      searchConditions.push(`payment_no.ilike.%${search}%`);
      
      if (purchaseTransactionIds.length > 0) {
        // Search by purchase_transaction_id if we found matching suppliers
        const purchaseIdConditions = purchaseTransactionIds.map(id => `purchase_transaction_id.eq.${id}`).join(',');
        searchConditions.push(purchaseIdConditions);
      }
      
      if (searchConditions.length > 0) {
        query = query.or(searchConditions.join(','));
      }
    }

    // Apply ordering and pagination
    query = query
      .order(orderBy, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Payments list error:', error);
      return NextResponse.json(
        { success: false, error: error?.message || '지급 조회 실패' },
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
  } catch (error) {
    console.error('Payments list error:', error);
    return NextResponse.json(
      { success: false, error: '지급 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};

// POST: 지급 생성
export const POST = async (request: NextRequest) => {
  try {
    // Korean encoding: Use request.text() + JSON.parse() pattern
    const text = await request.text();
    const body = JSON.parse(text);

    // Validate input
    const result = PaymentCreateSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map((err: any) => err.message).join(', ');
      return NextResponse.json(
        { success: false, error: errorMessages || '입력 데이터가 유효하지 않습니다' },
        { status: 400 }
      );
    }

    const validatedData = result.data;

    // Verify purchase transaction exists and get current status
    const { data: purchaseTx, error: purchaseError } = await supabaseAdmin
      .from('purchase_transactions')
      .select('transaction_id, supplier_id, total_amount, payment_status, paid_amount')
      .eq('transaction_id', validatedData.purchase_transaction_id)
      .eq('is_active', true)
      .single() as any;

    if (purchaseError || !purchaseTx) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 매입 거래 ID입니다' },
        { status: 400 }
      );
    }

    // Calculate total paid amount for this purchase transaction
    const { data: existingPayments } = await supabaseAdmin
      .from('payments')
      .select('paid_amount')
      .eq('purchase_transaction_id', validatedData.purchase_transaction_id)
      .eq('is_active', true);

    const previouslyPaid = existingPayments?.reduce(
      (sum, payment) => sum + (payment.paid_amount || 0),
      0
    ) || 0;

    const totalPaid = previouslyPaid + validatedData.paid_amount;
    const remaining = purchaseTx.total_amount - totalPaid;

    // Validate that payment doesn't exceed total amount
    if (remaining < 0) {
      return NextResponse.json(
        {
          success: false,
          error: `지급 금액이 잔액을 초과합니다. 잔액: ${purchaseTx.total_amount - previouslyPaid}원`
        },
        { status: 400 }
      );
    }

    // Determine new payment status
    let newPaymentStatus: 'PENDING' | 'PARTIAL' | 'COMPLETE';
    if (remaining === 0) {
      newPaymentStatus = 'COMPLETE';
    } else if (remaining < purchaseTx.total_amount) {
      newPaymentStatus = 'PARTIAL';
    } else {
      newPaymentStatus = 'PENDING';
    }

    // Generate payment number if not provided
    let paymentNo = validatedData.payment_no;
    if (!paymentNo) {
      const { data: generatedNo, error: genError } = await supabaseAdmin
        .rpc('generate_payment_no');

      if (genError) {
        console.error('Generate payment no error:', genError);
        // Fallback: Use timestamp-based number
        const timestamp = new Date().getTime();
        paymentNo = `PAY-${timestamp}`;
      } else {
        paymentNo = generatedNo;
      }
    }

    // Insert payment using direct Supabase client (proven pattern from Collections)
    const { data: newPayment, error: insertError } = await supabaseAdmin
      .from('payments')
      .insert({
        payment_no: paymentNo,
        payment_date: validatedData.payment_date,
        purchase_transaction_id: validatedData.purchase_transaction_id,
        supplier_id: purchaseTx.supplier_id,
        paid_amount: validatedData.paid_amount,
        payment_method: validatedData.payment_method,
        bank_name: validatedData.bank_name,
        account_number: validatedData.account_number,
        check_number: validatedData.check_number,
        card_number: validatedData.card_number,
        bill_number: validatedData.bill_number,
        bill_date: validatedData.bill_date,
        bill_drawer: validatedData.bill_drawer,
        notes: validatedData.notes,
        is_active: true
      })
      .select()
      .single() as any;

    if (insertError || !newPayment) {
      console.error('Payment insert error:', insertError);
      return NextResponse.json(
        { success: false, error: insertError?.message || '지급 생성 실패' },
        { status: 500 }
      );
    }

    const paymentId = newPayment.payment_id;

    // Update purchase transaction using direct Supabase client (matching Collections pattern)
    // Note: updated_at is auto-updated by trigger, don't set it manually
    const { error: updateError } = await supabaseAdmin
      .from('purchase_transactions')
      .update({
        payment_status: newPaymentStatus,
        paid_amount: totalPaid
      })
      .eq('transaction_id', validatedData.purchase_transaction_id);

    if (updateError) {
      console.error('Purchase transaction update error:', updateError);
      // Rollback: Delete the payment
      await supabaseAdmin
        .from('payments')
        .delete()
        .eq('payment_id', paymentId);

      return NextResponse.json(
        { success: false, error: '매입 거래 상태 업데이트 실패로 지급이 취소되었습니다' },
        { status: 500 }
      );
    }

    // Fetch created payment with joins using Supabase client
    const { data: createdPayment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select(`
        payment_id,
        payment_no,
        payment_date,
        purchase_transaction_id,
        supplier_id,
        paid_amount,
        payment_method,
        bank_name,
        account_number,
        check_number,
        card_number,
        notes,
        is_active,
        created_at,
        updated_at,
        purchase_transaction:purchase_transactions!purchase_transaction_id(
          transaction_id,
          transaction_no,
          transaction_date,
          total_amount,
          payment_status
        ),
        supplier:companies!supplier_id(
          company_id,
          company_name,
          company_code
        )
      `)
      .eq('payment_id', paymentId)
      .single() as any;

    if (fetchError || !createdPayment) {
      console.error('Fetch created payment error:', fetchError);
      return NextResponse.json(
        { success: false, error: '지급 생성 후 조회 실패' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: createdPayment,
      message: '지급이 생성되고 매입 거래 상태가 업데이트되었습니다'
    });
  } catch (error) {
    console.error('Payment create error:', error);
    const errorMessage = error instanceof Error ? error.message : '지급 생성 중 오류가 발생했습니다';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
};

// PUT: 지급 수정 (금액, 날짜, 메모만)
export const PUT = async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '지급 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // Korean encoding
    const text = await request.text();
    const body = JSON.parse(text);

    // Validate update data
    const result = PaymentUpdateSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map((err: any) => err.message).join(', ');
      return NextResponse.json(
        { success: false, error: errorMessages || '입력 데이터가 유효하지 않습니다' },
        { status: 400 }
      );
    }

    // Get original payment data
    const { data: originalPayment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('payment_id, purchase_transaction_id, paid_amount')
      .eq('payment_id', parseInt(id, 10))
      .eq('is_active', true)
      .single() as any;

    if (fetchError || !originalPayment) {
      return NextResponse.json(
        { success: false, error: '지급을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // If amount is being changed, recalculate payment status
    let needsStatusUpdate = false;
    let newPaymentStatus: 'PENDING' | 'PARTIAL' | 'COMPLETED' = 'PENDING';

    if (body.paid_amount !== undefined && body.paid_amount !== originalPayment.paid_amount) {
      needsStatusUpdate = true;

      // Get purchase transaction details
      const { data: purchaseTx, error: purchaseError } = await supabaseAdmin
        .from('purchase_transactions')
        .select('total_amount')
        .eq('transaction_id', originalPayment.purchase_transaction_id)
        .single() as any;

      if (purchaseError || !purchaseTx) {
        return NextResponse.json(
          { success: false, error: '매입 거래를 찾을 수 없습니다' },
          { status: 400 }
        );
      }

      // Calculate total paid (excluding current payment)
      const { data: otherPayments } = await supabaseAdmin
        .from('payments')
        .select('paid_amount')
        .eq('purchase_transaction_id', originalPayment.purchase_transaction_id)
        .eq('is_active', true)
        .neq('payment_id', parseInt(id, 10));

      const otherPaidAmount = otherPayments?.reduce(
        (sum, payment) => sum + (payment.paid_amount || 0),
        0
      ) || 0;

      const totalPaid = otherPaidAmount + body.paid_amount;
      const remaining = purchaseTx.total_amount - totalPaid;

      // Validate that new amount doesn't exceed total
      if (remaining < 0) {
        return NextResponse.json(
          {
            success: false,
            error: `지급 금액이 잔액을 초과합니다. 최대 지급 가능 금액: ${purchaseTx.total_amount - otherPaidAmount}원`
          },
          { status: 400 }
        );
      }

      // Determine new payment status
      if (remaining === 0) {
        newPaymentStatus = 'COMPLETE';
      } else if (remaining < purchaseTx.total_amount) {
        newPaymentStatus = 'PARTIAL';
      } else {
        newPaymentStatus = 'PENDING';
      }
    }

    // Update payment
    // Note: updated_at is auto-updated by trigger, don't set it manually
    const { data: updatedPayment, error: updateError } = await supabaseAdmin
      .from('payments')
      .update({
        ...body
      })
      .eq('payment_id', parseInt(id, 10))
      .select(`
        *,
        purchase_transaction:purchase_transactions!purchase_transaction_id(
          transaction_id,
          transaction_no,
          transaction_date,
          total_amount,
          payment_status
        ),
        supplier:companies!supplier_id(
          company_id,
          company_name,
          company_code
        )
      `)
      .single() as any;

    if (updateError) {
      console.error('Payment update error:', updateError);
      return NextResponse.json(
        { success: false, error: updateError?.message || '지급 수정 실패' },
        { status: 500 }
      );
    }

    if (!updatedPayment) {
      return NextResponse.json(
        { success: false, error: '지급을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Update purchase transaction status if needed
    if (needsStatusUpdate) {
      // Calculate new paid_amount for purchase transaction
      const { data: allPayments } = await supabaseAdmin
        .from('payments')
        .select('paid_amount')
        .eq('purchase_transaction_id', originalPayment.purchase_transaction_id)
        .eq('is_active', true);

      const newTotalPaid = allPayments?.reduce(
        (sum, payment) => sum + (payment.paid_amount || 0),
        0
      ) || 0;

      // Note: updated_at is auto-updated by trigger, don't set it manually
      const { error: statusError } = await supabaseAdmin
        .from('purchase_transactions')
        .update({
          payment_status: newPaymentStatus,
          paid_amount: newTotalPaid
        })
        .eq('transaction_id', originalPayment.purchase_transaction_id);

      if (statusError) {
        console.error('Purchase transaction status update error:', statusError);
        // Continue anyway - payment is updated
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedPayment,
      message: needsStatusUpdate
        ? '지급이 수정되고 매입 거래 상태가 업데이트되었습니다'
        : '지급이 수정되었습니다'
    });
  } catch (error) {
    console.error('Payment update error:', error);
    return NextResponse.json(
      { success: false, error: '지급 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};

// DELETE: 지급 삭제 (soft delete)
export const DELETE = async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '지급 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // Get payment data for payment status recalculation
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('purchase_transaction_id, paid_amount')
      .eq('payment_id', parseInt(id, 10))
      .single() as any;

    if (fetchError || !payment) {
      return NextResponse.json(
        { success: false, error: '지급을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Soft delete payment
    const { data, error } = await supabaseAdmin
      .from('payments')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('payment_id', parseInt(id, 10))
      .select()
      .single() as any;

    if (error) {
      console.error('Payment delete error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: '지급을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Recalculate payment status for purchase transaction
    const { data: purchaseTx } = await supabaseAdmin
      .from('purchase_transactions')
      .select('total_amount')
      .eq('transaction_id', payment.purchase_transaction_id)
      .single() as any;

    if (purchaseTx) {
      const { data: remainingPayments } = await supabaseAdmin
        .from('payments')
        .select('paid_amount')
        .eq('purchase_transaction_id', payment.purchase_transaction_id)
        .eq('is_active', true);

      const totalPaid = remainingPayments?.reduce(
        (sum, payment) => sum + (payment.paid_amount || 0),
        0
      ) || 0;

      const remaining = purchaseTx.total_amount - totalPaid;

      let newPaymentStatus: 'PENDING' | 'PARTIAL' | 'COMPLETE';
      if (remaining === 0 && totalPaid > 0) {
        newPaymentStatus = 'COMPLETE';
      } else if (remaining > 0 && totalPaid > 0) {
        newPaymentStatus = 'PARTIAL';
      } else {
        newPaymentStatus = 'PENDING';
      }

      await supabaseAdmin
        .from('purchase_transactions')
        .update({
          payment_status: newPaymentStatus,
          paid_amount: totalPaid,
          updated_at: new Date().toISOString()
        })
        .eq('transaction_id', payment.purchase_transaction_id);
    }

    return NextResponse.json({
      success: true,
      message: '지급이 삭제되고 매입 거래 상태가 업데이트되었습니다'
    });
  } catch (error) {
    console.error('Payment delete error:', error);
    return NextResponse.json(
      { success: false, error: '지급 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};
