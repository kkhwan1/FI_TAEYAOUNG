import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { getCustomerMappingFromDB } from '@/lib/company-mappings';
const MISSING_ITEMS = [
  { code: '65852-BY000', name: 'MBR-RR FLR CTR CROSS (HEV)' },
  { code: '66724-2J700', name: 'R/F COWL INR LWR' },
  { code: '66798-2J700', name: 'COWL COVER FRT' }
];

export async function GET() {
  const supabase = getSupabaseClient();

  // 데이터베이스에서 대우당진 company_id 조회
  let COMPANY_ID: number | null = null;
  try {
    const customerMapping = await getCustomerMappingFromDB(supabase);
    COMPANY_ID = customerMapping['대우당진'] || null;
    
    if (!COMPANY_ID) {
      // 대우당진을 찾을 수 없으면 직접 조회
      const { data: companyData } = await supabase
        .from('companies')
        .select('company_id')
        .eq('company_name', '대우당진')
        .eq('company_type', '고객사')
        .eq('is_active', true)
        .maybeSingle();
      
      COMPANY_ID = companyData?.company_id || null;
    }
  } catch (error) {
    console.error('Failed to fetch company ID:', error);
    return NextResponse.json({
      success: false,
      error: '거래처 정보를 조회할 수 없습니다.'
    }, { status: 500 });
  }

  if (!COMPANY_ID) {
    return NextResponse.json({
      success: false,
      error: '대우당진 거래처를 찾을 수 없습니다.'
    }, { status: 404 });
  }

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
