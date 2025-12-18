import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';

/**
 * 납품처별 BOM 품목 조회 API
 * 선택된 납품처(customer_id)와 공정 유형(process_type)에 따라 관련 품목을 반환
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    const processType = searchParams.get('process_type'); // BLANKING, PRESS, WELD, PAINT

    if (!customerId) {
      return NextResponse.json({
        success: false,
        error: 'customer_id is required'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // BOM에서 해당 납품처의 품목들 조회 (기존 /api/bom과 동일한 쿼리 방식 사용)
    // parent = 산출품목, child = 투입품목
    const { data: bomData, error: bomError } = await supabase
      .from('bom')
      .select(`
        *,
        parent:items!bom_parent_item_id_fkey (
          item_id,
          item_code,
          item_name,
          category,
          unit,
          vehicle_model
        ),
        child:items!bom_child_item_id_fkey (
          item_id,
          item_code,
          item_name,
          category,
          unit,
          vehicle_model
        )
      `)
      .eq('customer_id', parseInt(customerId))
      .eq('is_active', true);

    if (bomError) {
      console.error('BOM query error:', bomError);
      return NextResponse.json({
        success: false,
        error: 'BOM 조회 실패'
      }, { status: 500 });
    }

    // 디버깅: 조회된 데이터 확인
    console.log('[BOM by-customer] customerId:', customerId, 'processType:', processType);
    console.log('[BOM by-customer] bomData count:', bomData?.length);
    if (bomData && bomData.length > 0) {
      console.log('[BOM by-customer] sample item:', JSON.stringify(bomData[0], null, 2));
    }

    // 공정별 품목 필터링
    // BLANKING: 원자재/코일 → 반제품
    // PRESS: 반제품 → 반제품
    // WELD: 반제품 → 반제품
    // PAINT: 반제품 → 완제품

    // 카테고리 정규화 함수 (한국어/영어 모두 지원)
    const normalizeCategory = (cat: string | null): string => {
      if (!cat) return '';
      const lower = cat.toLowerCase();
      // 원자재/코일
      if (lower.includes('원자재') || lower.includes('코일') || lower === 'raw_material' || lower === 'raw') {
        return 'RAW';
      }
      // 반제품
      if (lower.includes('반제품') || lower === 'semi_product' || lower === 'semi') {
        return 'SEMI';
      }
      // 완제품
      if (lower.includes('완제품') || lower === 'product' || lower === 'finished') {
        return 'PRODUCT';
      }
      return lower;
    };

    interface BomItem {
      bom_id: number;
      parent_item_id: number;
      child_item_id: number;
      quantity_required: number;
      parent: {
        item_id: number;
        item_code: string;
        item_name: string;
        category: string | null;
        unit: string | null;
        vehicle_model: string | null;
      } | null;
      child: {
        item_id: number;
        item_code: string;
        item_name: string;
        category: string | null;
        unit: string | null;
        vehicle_model: string | null;
      } | null;
    }

    let filteredItems = (bomData as BomItem[]) || [];

    if (processType) {
      filteredItems = filteredItems.filter((bom) => {
        const parentCategory = normalizeCategory(bom.parent?.category);
        const childCategory = normalizeCategory(bom.child?.category);

        switch (processType) {
          case 'BLANKING':
            // 투입: 원자재/코일, 산출: 반제품
            return childCategory === 'RAW' && parentCategory === 'SEMI';
          case 'PRESS':
          case 'WELD':
            // 투입: 반제품, 산출: 반제품
            return childCategory === 'SEMI' && parentCategory === 'SEMI';
          case 'PAINT':
            // 투입: 반제품, 산출: 완제품
            return childCategory === 'SEMI' && parentCategory === 'PRODUCT';
          default:
            return true;
        }
      });
    }

    // 결과 형식 변환 - 빠른 선택을 위한 형태로
    const quickSelectItems = filteredItems.map((bom) => ({
      bom_id: bom.bom_id,
      quantity_required: bom.quantity_required,
      // 산출 품목 (parent)
      output: bom.parent ? {
        item_id: bom.parent.item_id,
        item_code: bom.parent.item_code,
        item_name: bom.parent.item_name,
        category: bom.parent.category,
        unit: bom.parent.unit,
        vehicle_model: bom.parent.vehicle_model
      } : null,
      // 투입 품목 (child)
      input: bom.child ? {
        item_id: bom.child.item_id,
        item_code: bom.child.item_code,
        item_name: bom.child.item_name,
        category: bom.child.category,
        unit: bom.child.unit,
        vehicle_model: bom.child.vehicle_model
      } : null
    })).filter(item => item.output && item.input);

    return NextResponse.json({
      success: true,
      data: quickSelectItems,
      count: quickSelectItems.length
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류'
    }, { status: 500 });
  }
}
