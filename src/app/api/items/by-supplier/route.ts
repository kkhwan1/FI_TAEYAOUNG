import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';

/**
 * GET /api/items/by-supplier
 * Get items associated with a supplier
 * Query parameters:
 * - supplier_id: Supplier company ID (required)
 * - limit: Number of records to return (default: 1000)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const supplierId = searchParams.get('supplier_id');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!supplierId) {
      return NextResponse.json({
        success: false,
        error: '공급업체 ID가 필요합니다.'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 1. BOM에서 child_supplier_id로 자품목 조회
    const { data: bomItems, error: bomError } = await supabase
      .from('bom')
      .select(`
        child_item_id,
        child:items!bom_child_item_id_fkey (
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
      .eq('child_supplier_id', parseInt(supplierId))
      .eq('is_active', true);

    if (bomError) {
      console.error('[Items by Supplier API] BOM query error:', bomError);
    }

    // 2. items 테이블에서 supplier_id로 직접 조회
    const { data: directItems, error: directError } = await supabase
      .from('items')
      .select(`
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
      `)
      .eq('supplier_id', parseInt(supplierId))
      .eq('is_active', true)
      .range(offset, offset + limit - 1);

    if (directError) {
      console.error('[Items by Supplier API] Direct items query error:', directError);
    }

    // 3. 두 결과를 합쳐서 중복 제거
    const itemMap = new Map<number, any>();

    // BOM에서 조회한 자품목 추가
    if (bomItems) {
      bomItems.forEach((bom: any) => {
        if (bom.child && bom.child.is_active) {
          const itemId = bom.child.item_id;
          if (!itemMap.has(itemId)) {
            itemMap.set(itemId, {
              ...bom.child,
              source: 'bom' // BOM에서 조회된 품목임을 표시
            });
          }
        }
      });
    }

    // items 테이블에서 직접 조회한 품목 추가
    if (directItems) {
      directItems.forEach((item: any) => {
        const itemId = item.item_id;
        if (!itemMap.has(itemId)) {
          itemMap.set(itemId, {
            ...item,
            source: 'direct' // items 테이블에서 직접 조회된 품목임을 표시
          });
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
        supplier_id: parseInt(supplierId)
      }
    });
  } catch (error: any) {
    console.error('[Items by Supplier API] Error:', error);
    return NextResponse.json({
      success: false,
      error: `공급업체별 품목 조회 중 오류가 발생했습니다: ${error.message || 'Unknown error'}`
    }, { status: 500 });
  }
}

