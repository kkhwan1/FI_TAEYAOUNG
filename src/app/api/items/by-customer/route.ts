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

    // customerId 숫자 검증 (SQL injection 방지)
    const customerIdNum = parseInt(customerId);
    if (isNaN(customerIdNum) || customerIdNum <= 0) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 고객 ID입니다.'
      }, { status: 400 });
    }

    // limit과 offset 검증
    const validLimit = Math.max(1, Math.min(limit, 10000)); // 1~10000 사이로 제한
    const validOffset = Math.max(0, offset);

    console.log(`[Items by Customer API] customer_id: ${customerId}, Supabase 쿼리 실행`);
    
    const supabase = getSupabaseClient();
    
    // 1단계: BOM 테이블에서 parent_item_id 목록 조회
    const { data: bomData, error: bomError } = await supabase
      .from('bom')
      .select('parent_item_id')
      .eq('customer_id', customerIdNum)
      .eq('is_active', true);

    if (bomError) {
      console.error('[Items by Customer API] BOM 조회 오류:', bomError);
      return NextResponse.json({
        success: false,
        error: `BOM 조회 오류: ${bomError.message}`
      }, { status: 500 });
    }

    console.log(`[Items by Customer API] BOM 조회 결과: ${bomData?.length || 0}개 BOM 항목`);

    if (!bomData || bomData.length === 0) {
      console.warn(`[Items by Customer API] customer_id=${customerId}에 대한 BOM 데이터가 없습니다.`);
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          total: 0,
          customer_id: customerIdNum
        }
      });
    }

    // 중복 제거를 위한 Set 사용
    const uniqueItemIds = new Set<number>();
    for (const bom of bomData) {
      if (bom.parent_item_id) {
        uniqueItemIds.add(bom.parent_item_id);
      }
    }

    const itemIds = Array.from(uniqueItemIds);
    console.log(`[Items by Customer API] 고유한 parent_item_id 수: ${itemIds.length}`);

    // 2단계: items 테이블에서 해당 item_id들 조회
    const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, spec, unit, price, category, inventory_type, vehicle_model, is_active')
      .in('item_id', itemIds)
      .eq('is_active', true)
      .order('item_code', { ascending: true })
      .range(validOffset, validOffset + validLimit - 1);

    if (itemsError) {
      console.error('[Items by Customer API] Items 조회 오류:', itemsError);
      return NextResponse.json({
        success: false,
        error: `Items 조회 오류: ${itemsError.message}`
      }, { status: 500 });
    }

    console.log(`[Items by Customer API] Items 조회 결과: ${itemsData?.length || 0}개 품목`);

    // 데이터 변환
    const items = (itemsData || []).map((item: any) => {
      // price가 문자열일 수 있으므로 숫자로 변환
      const priceValue = typeof item.price === 'string' 
        ? parseFloat(item.price) || 0 
        : (item.price || 0);

      return {
        item_id: item.item_id,
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        spec: item.spec || null,
        unit: item.unit || 'EA',
        price: priceValue,
        unit_price: priceValue, // ItemSelect에서 사용하는 필드
        category: item.category || null,
        inventory_type: item.inventory_type || null,
        vehicle_model: item.vehicle_model || null,
        is_active: item.is_active !== false,
        source: 'bom' // BOM에서 조회된 품목임을 표시
      };
    });

    // item_code로 정렬
    items.sort((a, b) => {
      const codeA = a.item_code || '';
      const codeB = b.item_code || '';
      return codeA.localeCompare(codeB, 'ko');
    });

    if (items.length === 0) {
      console.warn(`[Items by Customer API] customer_id=${customerId}에 대한 BOM 데이터가 없습니다.`);
    } else {
      console.log(`[Items by Customer API] customer_id: ${customerId}, 최종 품목 수: ${items.length}`);
    }

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

