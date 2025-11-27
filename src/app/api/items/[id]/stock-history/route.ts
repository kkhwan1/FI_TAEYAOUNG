import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// TypeScript types for company lookup
type InventoryTransactionRow = {
  transaction_date: string;
  quantity: number;
  transaction_type: string;
  transaction_number: string | null;
  company_id: number | null;
};

type CompanyLookup = Record<number, { company_name: string; company_code: string | null }>;


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = id;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Step 1: 재고 변동 이력 조회 (거래처 ID 포함)
    const { data, error } = await supabaseAdmin
      .from('inventory_transactions')
      .select(`
        transaction_date,
        quantity,
        transaction_type,
        transaction_number,
        company_id
      `)
      .eq('item_id', Number(itemId))
      .gte('transaction_date', startDate.toISOString().split('T')[0])
      .order('transaction_date', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Step 2: RLS 호환 거래처 조회 (두 단계 패턴)
    const companyIds = [...new Set(
      data?.map((tx: InventoryTransactionRow) => tx.company_id)
        .filter((id): id is number => id != null)
    )];

    const { data: companyRows, error: companyError } = companyIds.length > 0
      ? await supabaseAdmin
          .from('companies')
          .select('company_id, company_name, company_code')
          .in('company_id', companyIds)
      : { data: [], error: null };

    if (companyError) {
      console.error('거래처 조회 실패:', companyError);
      // 거래처 조회 실패해도 거래 이력은 표시 (null 처리)
    }

    // Step 3: 거래처 조회 맵 생성
    const companyMap = (companyRows || []).reduce<CompanyLookup>((acc, company) => {
      if (company.company_id != null) {
        acc[company.company_id] = {
          company_name: company.company_name ?? '미등록 거래처',
          company_code: company.company_code ?? null
        };
      }
      return acc;
    }, {});

    // Step 4: 재고 누적 계산 및 거래처 정보 매핑
    let runningStock = 0;
    const history = data.map((tx: InventoryTransactionRow) => {
      if (tx.transaction_type === '입고' || tx.transaction_type === '생산입고') {
        runningStock += tx.quantity;
      } else if (tx.transaction_type === '출고' || tx.transaction_type === '생산출고' || tx.transaction_type === '조정') {
        runningStock -= tx.quantity;
      }

      // 거래처 정보 조회 (null safe)
      const company = tx.company_id ? companyMap[tx.company_id] : undefined;

      return {
        date: tx.transaction_date,
        stock_level: runningStock,
        transaction_type: tx.transaction_type,
        transaction_no: tx.transaction_number,
        company_id: tx.company_id,
        company_name: company?.company_name ?? '미지정 거래처',
        company_code: company?.company_code ?? '-'
      };
    }).reverse();

    return NextResponse.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching stock history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stock history' },
      { status: 500 }
    );
  }
}
