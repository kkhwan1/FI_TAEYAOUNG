import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { safeJsonParse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';


// ===================================
// POST /api/batch-registration
// 신규 생산 배치 등록 (다중 품목 지원)
// ===================================
export async function POST(request: NextRequest) {
  try {
    // 한글 깨짐 방지: request.text() + JSON.parse() 패턴 사용
    const text = await request.text();
    const { data, error: parseError } = safeJsonParse<any>(text);
    if (parseError || !data) {
      return NextResponse.json({ success: false, error: '잘못된 요청 형식입니다' }, { status: 400 });
    }

    const {
      batch_date,
      notes,
      items, // [{ item_id, item_type: 'INPUT' | 'OUTPUT', quantity, unit_price, defect_quantity?, notes? }]
    } = data;

    // 필수 필드 검증
    if (!batch_date || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: '배치 날짜와 최소 1개 이상의 품목이 필요합니다.' },
        { status: 400 }
      );
    }

    // 품목 검증
    for (const item of items) {
      if (!item.item_id || !item.item_type || !item.quantity) {
        return NextResponse.json(
          { success: false, error: '모든 품목은 item_id, item_type, quantity가 필요합니다.' },
          { status: 400 }
        );
      }
      if (!['INPUT', 'OUTPUT'].includes(item.item_type)) {
        return NextResponse.json(
          { success: false, error: "item_type은 'INPUT' 또는 'OUTPUT'이어야 합니다." },
          { status: 400 }
        );
      }
    }

    const supabase = getSupabaseClient();

    // 1. 배치 번호 자동 생성 (PROD-YYYYMMDD-001 형식)
    const batchDateStr = batch_date.replace(/-/g, ''); // YYYYMMDD
    const prefix = `PROD-${batchDateStr}`;

    // 같은 날짜의 최신 배치 번호 조회
    const { data: latestBatch } = await supabase
      .from('production_batch')
      .select('batch_number')
      .like('batch_number', `${prefix}-%`)
      .order('batch_number', { ascending: false })
      .limit(1)
      .single();

    let batchNumber: string;
    if (latestBatch) {
      // 기존 배치가 있으면 번호 증가
      const lastNumber = parseInt(latestBatch.batch_number.split('-')[2], 10);
      const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
      batchNumber = `${prefix}-${nextNumber}`;
    } else {
      // 첫 배치
      batchNumber = `${prefix}-001`;
    }

    // 2. production_batch 생성
    const { data: batch, error: batchError } = await supabase
      .from('production_batch')
      .insert({
        batch_date,
        batch_number: batchNumber,
        status: 'IN_PROGRESS', // 기본값: 진행중
        notes,
      })
      .select()
      .single();

    if (batchError) {
      console.error('배치 생성 실패:', batchError);
      return NextResponse.json(
        { success: false, error: `배치 생성 실패: ${batchError.message}` },
        { status: 500 }
      );
    }

    // 3. production_batch_items 생성 (다중 품목)
    const batchItems = items.map((item: any) => ({
      batch_id: batch.batch_id,
      item_id: item.item_id,
      item_type: item.item_type,
      quantity: item.quantity,
      unit_price: item.unit_price || 0,
      defect_quantity: item.defect_quantity || 0,
      notes: item.notes || null,
    }));

    const { error: itemsError } = await supabase
      .from('production_batch_items')
      .insert(batchItems);

    if (itemsError) {
      console.error('배치 품목 생성 실패:', itemsError);
      // 롤백: 생성된 배치 삭제
      await supabase.from('production_batch').delete().eq('batch_id', batch.batch_id);
      return NextResponse.json(
        { success: false, error: `배치 품목 생성 실패: ${itemsError.message}` },
        { status: 500 }
      );
    }

    // 4. 생성된 배치 전체 정보 조회 (품목 포함)
    const { data: fullBatch, error: fetchError } = await supabase
      .from('production_batch')
      .select(`
        *,
        items:production_batch_items(
          *,
          item:items(item_id, item_code, item_name, spec, unit)
        )
      `)
      .eq('batch_id', batch.batch_id)
      .single();

    if (fetchError) {
      console.error('배치 조회 실패:', fetchError);
      return NextResponse.json(
        { success: false, error: `배치 조회 실패: ${fetchError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: fullBatch,
      message: `생산 배치 ${batchNumber}이(가) 성공적으로 등록되었습니다.`,
    });
  } catch (error: any) {
    console.error('배치 등록 API 에러:', error);
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// ===================================
// GET /api/batch-registration
// 생산 배치 목록 조회 (필터링, 페이지네이션)
// ===================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 쿼리 파라미터
    const status = searchParams.get('status'); // IN_PROGRESS | COMPLETED | CANCELLED
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const search = searchParams.get('search'); // batch_number 검색
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const supabase = getSupabaseClient();

    // 쿼리 빌더 시작
    let query = supabase
      .from('production_batch')
      .select(
        `
        *,
        items:production_batch_items(
          *,
          item:items(item_id, item_code, item_name, spec, unit)
        )
      `,
        { count: 'exact' }
      )
      .eq('is_active', true);

    // 필터 적용
    if (status) {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('batch_date', startDate);
    }

    if (endDate) {
      query = query.lte('batch_date', endDate);
    }

    if (search) {
      query = query.ilike('batch_number', `%${search}%`);
    }

    // 정렬
    query = query.order('batch_date', { ascending: false }).order('batch_id', { ascending: false });

    // 페이지네이션
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('배치 목록 조회 실패:', error);
      return NextResponse.json(
        { success: false, error: `배치 목록 조회 실패: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('배치 목록 조회 API 에러:', error);
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
