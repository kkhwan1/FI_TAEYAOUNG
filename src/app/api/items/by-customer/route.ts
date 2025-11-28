import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';

/**
 * GET /api/items/by-customer
 * Get items associated with a customer (parent items from BOM)
 * Query parameters:
 * - customer_id: Customer company ID (required)
 * - limit: Number of records to return (default: 1000)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customer_id');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!customerId) {
      return NextResponse.json({
        success: false,
        error: '고객 ID가 필요합니다.'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // BOM에서 customer_id로 모품목(제품) 조회
    const { data: bomItems, error: bomError } = await supabase
      .from('bom')
      .select(`
        parent_item_id,
        parent:items!bom_parent_item_id_fkey (
          item_id,
          item_code,
          item_name,
          spec,
          unit,
          price,
          category,
          inventory_type,
          vehicle_model,
          is_active
        )
      `)
      .eq('customer_id', parseInt(customerId))
      .eq('is_active', true);

    if (bomError) {
      console.error('[Items by Customer API] BOM query error:', bomError);
    }

    // 중복 제거
    const itemMap = new Map<number, any>();

    // BOM에서 조회한 모품목 추가
    if (bomItems) {
      bomItems.forEach((bom: any) => {
        if (bom.parent && bom.parent.is_active) {
          const itemId = bom.parent.item_id;
          if (!itemMap.has(itemId)) {
            itemMap.set(itemId, {
              ...bom.parent,
              source: 'bom' // BOM에서 조회된 품목임을 표시
            });
          }
        }
      });
    }

    // Map을 배열로 변환
    const items = Array.from(itemMap.values());

    // 정렬: 품번 기준 오름차순
    items.sort((a, b) => {
      const codeA = a.item_code || '';
      const codeB = b.item_code || '';
      return codeA.localeCompare(codeB, 'ko');
    });

    return NextResponse.json({
      success: true,
      data: {
        items,
        total: items.length,
        customer_id: parseInt(customerId)
      }
    });
  } catch (error: any) {
    console.error('[Items by Customer API] Error:', error);
    return NextResponse.json({
      success: false,
      error: `고객별 품목 조회 중 오류가 발생했습니다: ${error.message || 'Unknown error'}`
    }, { status: 500 });
  }
}

