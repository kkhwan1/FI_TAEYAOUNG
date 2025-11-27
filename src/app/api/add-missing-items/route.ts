import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

const MISSING_ITEMS = [
  { code: '50007278B', name: 'MIDDLE BEAM' },
  { code: '50007300D', name: 'GLASS PANEL REINFORCEMENT' },
  { code: '50007407B', name: 'GLASS PANEL REINFORCEMENT' },
  { code: '50008160E', name: 'GLASS REINFORCEMENT ASSY' },
  { code: '50009719C', name: 'REINFORCEMENT GLASS' },
  { code: '50009937C', name: 'REINFORCEMENT GLASS' },
  { code: '50010382C', name: 'MIDDLE BEAM B' },
  { code: '50010445D', name: 'GLASS PANEL REINFORCEMENT' },
  { code: '50010755C', name: 'MIDDLE BEAM' },
  { code: '50010779B', name: 'GLASS REINFORCEMENT' },
  { code: '50011721D', name: 'ROLLO CASSETTE ASSY' },
  { code: '50011899B', name: 'MIDDLE BEAM C' },
  { code: '50011937C', name: 'BRACKET FRAME LH' },
  { code: '50011938C', name: 'BRACKET FRAME RH' },
  { code: '50011944C', name: 'BRACKET FRAME A LH' },
  { code: '50011955C', name: 'BRACKET FRAME A RH' },
  { code: '50012093B', name: 'GLASS REINFORCEMENT REAR' },
  { code: '50012438D', name: 'REINFORCEMENT GLASS' },
  { code: '50013138A', name: 'MIDDLE BEAM' },
  { code: '50014694A', name: 'MEDDLE BEAM B' }
];

/**
 * POST /api/add-missing-items
 * 인알파코리아 누락 품목 자동 추가
 */
export async function POST() {
  const supabase = getSupabaseClient();

  const results = {
    itemsAdded: [] as Array<{ code: string; name: string; item_id: number }>,
    bomsAdded: [] as Array<{ code: string; bom_id: number }>,
    errors: [] as Array<{ code: string; error: string }>,
  };

  try {
    for (const item of MISSING_ITEMS) {
      try {
        // Step 1: items 테이블에 품목 추가
        const { data: existingItem } = await supabase
          .from('items')
          .select('item_id, item_code')
          .eq('item_code', item.code)
          .maybeSingle();

        let itemId: number;

        if (existingItem) {
          itemId = existingItem.item_id;
          console.log(`품번 ${item.code} - 이미 존재 (item_id: ${itemId})`);
        } else {
          const { data: newItem, error: itemError } = await supabase
            .from('items')
            .insert({
              item_code: item.code,
              item_name: item.name,
              item_type: 'PRODUCT',
              category: '제품' as const,
              inventory_type: '제품',
              unit_price: 0,
              is_active: true,
            })
            .select('item_id')
            .single();

          if (itemError) throw new Error(`items 추가 실패: ${itemError.message}`);
          if (!newItem) throw new Error('items 추가 후 데이터 없음');

          itemId = newItem.item_id;
          results.itemsAdded.push({
            code: item.code,
            name: item.name,
            item_id: itemId,
          });
          console.log(`품번 ${item.code} - items 추가 완료 (item_id: ${itemId})`);
        }

        // Step 2: BOM 레코드 생성
        const { data: existingBom } = await supabase
          .from('bom')
          .select('bom_id')
          .eq('parent_item_id', itemId)
          .maybeSingle();

        let bomId: number;

        if (existingBom) {
          bomId = existingBom.bom_id;
          console.log(`품번 ${item.code} - BOM 이미 존재 (bom_id: ${bomId})`);
        } else {
          const { data: newBom, error: bomError } = await supabase
            .from('bom')
            .insert({
              parent_item_id: itemId,
              child_item_id: itemId, // 임시로 자기 자신
              quantity_required: 1,
              is_active: true,
            })
            .select('bom_id')
            .single();

          if (bomError) throw new Error(`BOM 추가 실패: ${bomError.message}`);
          if (!newBom) throw new Error('BOM 추가 후 데이터 없음');

          bomId = newBom.bom_id;
          results.bomsAdded.push({
            code: item.code,
            bom_id: bomId,
          });
          console.log(`품번 ${item.code} - BOM 추가 완료 (bom_id: ${bomId})`);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors.push({
          code: item.code,
          error: errorMessage,
        });
        console.error(`품번 ${item.code} - 오류: ${errorMessage}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: '인알파코리아 누락 품목 추가 완료',
      summary: {
        total: MISSING_ITEMS.length,
        itemsAdded: results.itemsAdded.length,
        bomsAdded: results.bomsAdded.length,
        errors: results.errors.length,
      },
      details: results,
    });
  } catch (error) {
    console.error('누락 품목 추가 중 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        details: results,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/add-missing-items
 * 현재 상태 확인 (추가 전 사전 점검)
 */
export async function GET() {
  const supabase = getSupabaseClient();

  const results = {
    itemsNotInDB: [] as typeof MISSING_ITEMS,
    itemsWithoutBOM: [] as Array<{ code: string; name: string; item_id: number }>,
    itemsComplete: [] as Array<{ code: string; name: string; item_id: number }>,
  };

  for (const item of MISSING_ITEMS) {
    const { data: itemData } = await supabase
      .from('items')
      .select('item_id, item_code, item_name')
      .eq('item_code', item.code)
      .maybeSingle();

    if (!itemData) {
      results.itemsNotInDB.push(item);
      continue;
    }

    const { data: bomData } = await supabase
      .from('bom')
      .select('bom_id')
      .eq('parent_item_id', itemData.item_id);

    if (!bomData || bomData.length === 0) {
      results.itemsWithoutBOM.push({
        code: item.code,
        name: item.name,
        item_id: itemData.item_id,
      });
      continue;
    }

    results.itemsComplete.push({
      code: item.code,
      name: item.name,
      item_id: itemData.item_id,
    });
  }

  return NextResponse.json({
    success: true,
    summary: {
      total: MISSING_ITEMS.length,
      itemsNotInDB: results.itemsNotInDB.length,
      itemsWithoutBOM: results.itemsWithoutBOM.length,
      itemsComplete: results.itemsComplete.length,
    },
    details: results,
  });
}
