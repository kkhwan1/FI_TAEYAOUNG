import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

const COMPANY_ID = 359; // 대우당진
const MISSING_ITEMS = [
  { code: '65852-BY000', name: 'MBR-RR FLR CTR CROSS (HEV)' },
  { code: '66724-2J700', name: 'R/F COWL INR LWR' },
  { code: '66798-2J700', name: 'COWL COVER FRT' }
];

export async function GET() {
  const supabase = getSupabaseClient();

  const results = {
    itemsNotInDB: [] as typeof MISSING_ITEMS,
    itemsWithoutBOM: [] as Array<{ code: string; name: string; item_id: number }>,
    itemsWithoutTemplate: [] as Array<{ code: string; name: string; item_id: number; bom_ids: number[] }>,
    itemsComplete: [] as Array<{ code: string; name: string; item_id: number }>,
  };

  for (const item of MISSING_ITEMS) {
    // 1. items 테이블에서 품번 확인
    const { data: itemData, error: itemError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name')
      .eq('item_code', item.code)
      .maybeSingle();

    if (itemError || !itemData) {
      results.itemsNotInDB.push(item);
      continue;
    }

    // 2. bom 테이블에서 parent_item_id로 등록되어 있는지 확인
    const { data: bomData, error: bomError } = await supabase
      .from('bom')
      .select('bom_id, parent_item_id')
      .eq('parent_item_id', itemData.item_id);

    if (bomError || !bomData || bomData.length === 0) {
      results.itemsWithoutBOM.push({
        code: item.code,
        name: item.name,
        item_id: itemData.item_id,
      });
      continue;
    }

    // 3. customer_bom_templates 테이블에서 인알파코리아와 매핑 확인
    const bomIds = bomData.map(b => b.bom_id);
    const { data: templateData, error: templateError } = await supabase
      .from('customer_bom_templates')
      .select('template_id, bom_id, company_id')
      .eq('company_id', COMPANY_ID)
      .in('bom_id', bomIds);

    if (templateError || !templateData || templateData.length === 0) {
      results.itemsWithoutTemplate.push({
        code: item.code,
        name: item.name,
        item_id: itemData.item_id,
        bom_ids: bomIds,
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
      itemsWithoutTemplate: results.itemsWithoutTemplate.length,
      itemsComplete: results.itemsComplete.length,
    },
    details: results,
  });
}
