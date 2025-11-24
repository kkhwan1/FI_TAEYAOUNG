import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { handleSupabaseError, createSuccessResponse } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';


/**
 * POST /api/payments/split
 * 결제 분할 정보 저장 API
 *
 * 요청:
 * {
 *   transaction_id: number;
 *   payments: Array<{
 *     method: 'CASH' | 'CARD' | 'BILL' | 'CHECK' | 'CREDIT';
 *     amount: number;
 *     bill_number?: string;
 *     bill_date?: string;
 *     bill_drawer?: string;
 *     check_number?: string;
 *     check_bank?: string;
 *     notes?: string;
 *   }>;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 한글 문자 처리: request.text() + JSON.parse()
    const text = await request.text();
    const { transaction_id, payments } = JSON.parse(text);

    // 유효성 검증
    if (!transaction_id || !payments || !Array.isArray(payments) || payments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '거래 ID와 결제 정보가 필요합니다.'
        },
        { status: 400 }
      );
    }

    // 0원 결제 수단 필터링
    const validPayments = payments.filter((p: any) => p.amount > 0);
    
    if (validPayments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '최소 1개 이상의 유효한 결제 정보가 필요합니다.'
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 1. 거래 정보 확인
    const { data: transaction, error: transactionError } = await supabase
      .from('sales_transactions')
      .select('total_amount')
      .eq('transaction_id', transaction_id)
      .single();

    if (transactionError || !transaction) {
      return NextResponse.json(
        {
          success: false,
          error: '거래를 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    // 2. 결제 금액 합계 검증
    const totalSplit = validPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    if (Math.abs(totalSplit - transaction.total_amount) > 0.01) {
      return NextResponse.json(
        {
          success: false,
          error: `결제 금액 합계(${totalSplit.toLocaleString('ko-KR')}원)가 거래 총액(${transaction.total_amount.toLocaleString('ko-KR')}원)과 일치하지 않습니다.`
        },
        { status: 400 }
      );
    }

    // 3. 기존 결제 분할 삭제 (중복 방지)
    const { error: deleteError } = await supabase
      .from('payment_splits')
      .delete()
      .eq('transaction_id', transaction_id);

    if (deleteError) {
      console.error('기존 결제 분할 삭제 오류:', deleteError);
      // 삭제 실패해도 계속 진행 (없는 경우일 수 있음)
    }

    // 4. 새로운 결제 분할 데이터 준비
    const splits = validPayments.map((p: any) => ({
      transaction_id,
      payment_method: p.method,
      amount: p.amount,
      bill_number: p.bill_number || null,
      bill_date: p.bill_date || null,
      bill_drawer: p.bill_drawer || null,
      check_number: p.check_number || null,
      check_bank: p.check_bank || null,
      bank_name: p.bank_name || null, // TRANSFER용
      account_number: p.account_number || null, // TRANSFER용
      notes: p.notes || null
    }));

    // 5. Batch Insert
    const { data: insertedSplits, error: insertError } = await supabase
      .from('payment_splits')
      .insert(splits)
      .select();

    if (insertError) {
      return handleSupabaseError('insert', 'payment_splits', insertError);
    }

    return createSuccessResponse({
      message: '결제 정보가 저장되었습니다.',
      splits: insertedSplits,
      total: totalSplit
    });

  } catch (error) {
    console.error('결제 분할 저장 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '결제 정보 저장 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payments/split?transaction_id=123
 * 특정 거래의 결제 분할 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transaction_id = searchParams.get('transaction_id');

    if (!transaction_id) {
      return NextResponse.json(
        {
          success: false,
          error: '거래 ID가 필요합니다.'
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('payment_splits')
      .select('*')
      .eq('transaction_id', parseInt(transaction_id))
      .order('payment_split_id', { ascending: true });

    if (error) {
      return handleSupabaseError('select', 'payment_splits', error);
    }

    return createSuccessResponse({
      splits: data || [],
      count: data?.length || 0
    });

  } catch (error) {
    console.error('결제 분할 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '결제 분할 조회 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/payments/split?transaction_id=123
 * 특정 거래의 결제 분할 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transaction_id = searchParams.get('transaction_id');

    if (!transaction_id) {
      return NextResponse.json(
        {
          success: false,
          error: '거래 ID가 필요합니다.'
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('payment_splits')
      .delete()
      .eq('transaction_id', parseInt(transaction_id));

    if (error) {
      return handleSupabaseError('delete', 'payment_splits', error);
    }

    return createSuccessResponse({
      message: '결제 분할이 삭제되었습니다.'
    });

  } catch (error) {
    console.error('결제 분할 삭제 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '결제 분할 삭제 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

