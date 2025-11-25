import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { calculateBatchScrapRevenue } from '@/lib/bom';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';


/**
 * GET /api/bom
 * List BOM entries with filters
 * Query parameters:
 * - parent_item_id: Filter by parent item
 * - child_item_id: Filter by child item
 * - level_no: Filter by BOM level
 * - coil_only: If true, filter to only entries where child item is inventory_type='코일' (Track 2C)
 * - limit: Number of records to return (default: 100)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parentItemId = searchParams.get('parent_item_id');
    const childItemId = searchParams.get('child_item_id');
    const levelNo = searchParams.get('level_no');
    const coilOnly = searchParams.get('coil_only') === 'true'; // Track 2C: Coil filter
    const priceMonth = searchParams.get('price_month') ||
      new Date().toISOString().slice(0, 7) + '-01';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getSupabaseClient();

    // 기존 BOM 데이터 조회 (Track 2C: inventory_type 추가)
    let query = supabase
      .from('bom')
      .select(`
        *,
        parent:items!parent_item_id (
          item_code,
          item_name,
          spec,
          price
        ),
        child:items!child_item_id (
          item_code,
          item_name,
          spec,
          unit,
          price,
          category,
          inventory_type
        )
      `)
      .eq('is_active', true)
      .order('parent_item_id', { ascending: true });

    // 필터 적용
    if (parentItemId) query = query.eq('parent_item_id', parseInt(parentItemId));
    if (childItemId) query = query.eq('child_item_id', parseInt(childItemId));
    if (levelNo) query = query.eq('level_no', parseInt(levelNo));

    query = query.range(offset, offset + limit - 1);

    const { data: bomEntries, error } = await query;

    if (error) {
      console.error('[BOM API] BOM query failed:', error);
      console.error('[BOM API] Error details:', JSON.stringify(error, null, 2));
      return NextResponse.json({
        success: false,
        error: `BOM 조회에 실패했습니다: ${error.message || 'Unknown error'}`
      }, { status: 500 });
    }

    // Track 2C: Filter to coil materials only if coil_only=true
    let filteredEntries = bomEntries || [];
    if (coilOnly) {
      filteredEntries = filteredEntries.filter((entry: any) =>
        entry.child?.inventory_type === '코일'
      );
    }

    // Step 1: 코일 스펙 정보 일괄 조회 (N+1 문제 방지)
    const childItemIds = filteredEntries.map((item: any) => item.child_item_id);
    const coilSpecsMap = new Map<number, { material_grade: string; weight_per_piece?: number }>();
    
    // childItemIds가 있을 때만 조회
    if (childItemIds.length > 0) {
      const { data: coilSpecsData, error: coilSpecsError } = await supabase
        .from('coil_specs')
        .select('item_id, material_grade, weight_per_piece')
        .in('item_id', childItemIds);

      if (coilSpecsError) {
        console.error('[BOM API] Coil specs query error:', coilSpecsError);
        // 에러가 발생해도 계속 진행 (코일 스펙이 없는 경우도 있음)
      } else if (coilSpecsData) {
        coilSpecsData.forEach((spec: any) => {
          coilSpecsMap.set(spec.item_id, {
            material_grade: spec.material_grade,
            weight_per_piece: spec.weight_per_piece
          });
        });
      }
    }

    // Step 2: 월별 단가 및 재료비 계산
    const entriesWithPrice = await Promise.all(
      filteredEntries.map(async (item: any) => {
        // 월별 단가 조회 (없으면 items.price 사용)
        // price_month는 DATE 형식이므로 'YYYY-MM-01' 형식 사용
        const { data: priceData } = await supabase
          .from('item_price_history')
          .select('unit_price')
          .eq('item_id', item.child_item_id)
          .eq('price_month', priceMonth) // priceMonth는 이미 'YYYY-MM-01' 형식
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(); // single() 대신 maybeSingle() 사용하여 에러 방지

        const unitPrice = priceData?.unit_price || item.child?.price || 0;
        const materialCost = item.quantity_required * unitPrice;

        // 코일 스펙 정보 추가 (T4: 코일 연계 뱃지 표시용)
        const coilSpec = coilSpecsMap.get(item.child_item_id);

        return {
          ...item,
          bom_id: item.bom_id,
          parent_item_id: item.parent_item_id,
          child_item_id: item.child_item_id,
          parent_code: item.parent?.item_code,
          parent_name: item.parent?.item_name,
          child_code: item.child?.item_code,
          child_name: item.child?.item_name,
          quantity_required: item.quantity_required,
          level_no: item.level_no || 1,
          unit: item.child?.unit || 'EA',
          unit_price: unitPrice,
          material_cost: materialCost,
          item_type: item.child?.category === '원자재' || item.child?.category === '부자재' 
            ? 'external_purchase' 
            : 'internal_production',
          // T4: 코일 스펙 정보 추가
          material_grade: coilSpec?.material_grade,
          weight_per_piece: coilSpec?.weight_per_piece,
          is_active: true
        };
      })
    );

    // Step 3: 배치 스크랩 수익 계산 (N+1 문제 해결)
    const itemQuantities = entriesWithPrice.map(item => ({
      item_id: item.child_item_id,
      quantity: item.quantity_required
    }));
    
    const scrapRevenueMap = await calculateBatchScrapRevenue(supabase, itemQuantities);

    // Step 4: 스크랩 수익 및 순 원가 추가
    const enrichedEntries = entriesWithPrice.map((item: any) => {
      const itemScrapRevenue = scrapRevenueMap.get(item.child_item_id) || 0;
      
      return {
        ...item,
        item_scrap_revenue: itemScrapRevenue,
        net_cost: item.material_cost - itemScrapRevenue
      };
    });

    // 원가 요약 계산
    // 개별 항목의 스크랩 수익 합계로 계산
    const totalScrapRevenue = enrichedEntries.reduce(
      (sum, item) => sum + (item.item_scrap_revenue || 0), 
      0
    );

    const totalMaterialCost = enrichedEntries.reduce((sum, item) => sum + (item.material_cost || 0), 0);
    const totalLaborCost = enrichedEntries.reduce((sum, item) => sum + (item.labor_cost || 0), 0);
    const totalOverheadCost = (totalMaterialCost + totalLaborCost) * 0.1; // 10% 간접비

    const costSummary = {
      total_material_cost: totalMaterialCost,
      total_labor_cost: totalLaborCost,
      total_overhead_cost: totalOverheadCost,
      total_scrap_revenue: totalScrapRevenue,
      total_net_cost: totalMaterialCost + totalLaborCost + totalOverheadCost - totalScrapRevenue,
      coil_count: enrichedEntries.filter(item => item.material_grade && item.material_grade.trim() !== '').length,
      purchased_count: enrichedEntries.filter(item => item.item_type === 'external_purchase').length
    };

    // Get total count for pagination
    let countQuery = supabase
      .from('bom')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Apply same filters for count
    if (parentItemId) countQuery = countQuery.eq('parent_item_id', parseInt(parentItemId));
    if (childItemId) countQuery = countQuery.eq('child_item_id', parseInt(childItemId));
    if (levelNo) countQuery = countQuery.eq('level_no', parseInt(levelNo));

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      console.error('Count query failed:', countError);
    }

    return NextResponse.json({
      success: true,
      data: {
        bom_entries: enrichedEntries,
        cost_summary: costSummary,
        price_month: priceMonth,
        pagination: {
          total: totalCount || 0,
          limit,
          offset,
          has_more: offset + limit < (totalCount || 0)
        }
      }
    });
  } catch (error: any) {
    console.error('[BOM API] Error fetching BOM:', error);
    console.error('[BOM API] Error stack:', error?.stack);
    console.error('[BOM API] Error message:', error?.message);
    return NextResponse.json(
      {
        success: false,
        error: `BOM 조회 중 오류가 발생했습니다: ${error?.message || 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bom
 * Create new BOM entry
 * Body: {
 *   parent_item_id: number,
 *   child_item_id: number,
 *   quantity_required: number,
 *   level_no?: number (default: 1)
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // CRITICAL: Use request.text() + JSON.parse() for proper Korean encoding
    const text = await request.text();
    const body = JSON.parse(text);

    const {
      parent_item_id,
      child_item_id,
      quantity_required,
      level_no = 1,
      notes
    } = body;

    const supabase = getSupabaseClient();

    // Validation
    if (!parent_item_id || !child_item_id || !quantity_required) {
      return NextResponse.json({
        success: false,
        error: '부모 품목, 자식 품목, 소요수량은 필수입니다.'
      }, { status: 400 });
    }

    // 1. 자기 자신 참조 방지
    if (parent_item_id === child_item_id) {
      return NextResponse.json({
        success: false,
        error: "모품목과 자품목이 동일할 수 없습니다"
      }, { status: 400 });
    }

    // 2. 중복 BOM 체크 (활성 + 비활성 모두 확인)
    const { data: existing } = await supabase
      .from('bom')
      .select('bom_id, is_active')
      .eq('parent_item_id', parent_item_id)
      .eq('child_item_id', child_item_id)
      .single();

    if (existing) {
      // 비활성화된 BOM이 있으면 삭제
      if (!existing.is_active) {
        await supabase
          .from('bom')
          .delete()
          .eq('bom_id', existing.bom_id);
      } else {
        return NextResponse.json({
          success: false,
          error: "이미 등록된 BOM 구조입니다. 기존 항목을 수정해주세요."
        }, { status: 400 });
      }
    }

    // 3. 순환 참조 체크 함수
    async function checkCircularReference(
      supabase: any, 
      parentId: number, 
      childId: number
    ): Promise<boolean> {
      // childId를 모품목으로 가지는 BOM들을 재귀적으로 조회
      const { data } = await supabase
        .from('bom')
        .select('child_item_id')
        .eq('parent_item_id', childId)
        .eq('is_active', true);
      
      if (!data || data.length === 0) return false;
      
      for (const row of data) {
        if (row.child_item_id === parentId) return true;
        if (await checkCircularReference(supabase, parentId, row.child_item_id)) {
          return true;
        }
      }
      return false;
    }

    // 순환 참조 체크 실행
    const hasCircularReference = await checkCircularReference(supabase, parent_item_id, child_item_id);
    if (hasCircularReference) {
      return NextResponse.json({
        success: false,
        error: "순환 참조가 감지되었습니다. BOM 구조를 확인해주세요."
      }, { status: 400 });
    }

    // 4. 소요량 검증
    if (quantity_required <= 0) {
      return NextResponse.json({
        success: false,
        error: "소요량은 0보다 커야 합니다"
      }, { status: 400 });
    }

    if (quantity_required > 1000) {
      // 경고만 (저장은 가능하지만 확인 필요)
      console.warn(`High quantity detected: ${quantity_required} for BOM ${parent_item_id}->${child_item_id}`);
    }

    if (parent_item_id === child_item_id) {
      return NextResponse.json({
        success: false,
        error: '부모 품목과 자식 품목이 같을 수 없습니다.'
      }, { status: 400 });
    }

    // Check if parent and child items exist
    const { data: parentItem, error: parentError } = await supabase
      .from('items')
      .select('item_id, item_name, is_active')
      .eq('item_id', parent_item_id)
      .single() as any;

    if (parentError || !parentItem) {
      return NextResponse.json({
        success: false,
        error: '부모 품목을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    if (!parentItem.is_active) {
      return NextResponse.json({
        success: false,
        error: '비활성화된 부모 품목입니다.'
      }, { status: 400 });
    }

    const { data: childItem, error: childError } = await supabase
      .from('items')
      .select('item_id, item_name, is_active')
      .eq('item_id', child_item_id)
      .single() as any;

    if (childError || !childItem) {
      return NextResponse.json({
        success: false,
        error: '자식 품목을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    if (!childItem.is_active) {
      return NextResponse.json({
        success: false,
        error: '비활성화된 자식 품목입니다.'
      }, { status: 400 });
    }

    // Check for duplicate BOM entry (활성 + 비활성 모두 확인)
    const { data: existingBom } = await supabase
      .from('bom')
      .select('bom_id, is_active')
      .eq('parent_item_id', parent_item_id)
      .eq('child_item_id', child_item_id)
      .maybeSingle();

    if (existingBom) {
      // 비활성화된 BOM이 있으면 삭제
      if (!existingBom.is_active) {
        await supabase
          .from('bom')
          .delete()
          .eq('bom_id', existingBom.bom_id);
      } else {
        return NextResponse.json({
          success: false,
          error: '이미 존재하는 BOM 항목입니다.'
        }, { status: 400 });
      }
    }

    // Create BOM entry
    const { data: bomEntry, error } = (await supabase
      .from('bom')
      .insert({
        parent_item_id,
        child_item_id,
        quantity_required,
        level_no,
        is_active: true,
        notes: notes || null
      } as any)
      .select()
      .single()) as any;

    if (error) {
      console.error('BOM insert failed:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return NextResponse.json({
        success: false,
        error: `BOM 등록에 실패했습니다: ${error.message || 'Unknown error'}`
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'BOM 항목이 성공적으로 등록되었습니다.',
      data: bomEntry
    });
  } catch (error: any) {
    console.error('Error creating BOM entry:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return NextResponse.json(
      {
        success: false,
        error: `BOM 등록 중 오류가 발생했습니다: ${error.message || 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/bom
 * Update existing BOM entry
 * Body: {
 *   bom_id: number,
 *   quantity_required?: number,
 *   level_no?: number,
 *   is_active?: boolean
 * }
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // CRITICAL: Use request.text() + JSON.parse() for proper Korean encoding
    const text = await request.text();
    const body = JSON.parse(text);

    const { bom_id, ...updateData } = body;

    const supabase = getSupabaseClient();

    if (!bom_id) {
      return NextResponse.json({
        success: false,
        error: 'BOM ID가 필요합니다.'
      }, { status: 400 });
    }

    // Validate quantity_required if being updated
    if (updateData.quantity_required !== undefined && updateData.quantity_required <= 0) {
      return NextResponse.json({
        success: false,
        error: '소요수량은 0보다 커야 합니다.'
      }, { status: 400 });
    }

    // Check if BOM entry exists
    const { data: existingBom, error: checkError } = await supabase
      .from('bom')
      .select('bom_id, parent_item_id, child_item_id')
      .eq('bom_id', bom_id)
      .single() as any;

    if (checkError || !existingBom) {
      return NextResponse.json({
        success: false,
        error: 'BOM 항목을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // Update BOM entry
    type BOMRow = Database['public']['Tables']['bom']['Row'];
    const { data: bomEntry, error } = await supabase
      .from('bom')
      .update(updateData as Database['public']['Tables']['bom']['Update'])
      .eq('bom_id', bom_id)
      .select(`
        *,
        parent_item:items!bom_parent_item_id_fkey(item_code, item_name, spec, unit),
        child_item:items!bom_child_item_id_fkey(item_code, item_name, spec, unit)
      `)
      .single() as { data: BOMRow | null; error: any };

    if (error) {
      console.error('BOM update failed:', error);
      return NextResponse.json({
        success: false,
        error: 'BOM 업데이트에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'BOM 항목이 성공적으로 업데이트되었습니다.',
      data: bomEntry
    });
  } catch (error) {
    console.error('Error updating BOM entry:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'BOM 업데이트 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bom
 * Delete BOM entry (soft delete)
 * Query parameter: id - BOM ID to delete
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    const supabase = getSupabaseClient();

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'BOM ID가 필요합니다.'
      }, { status: 400 });
    }

    // Check if BOM entry exists
    const bomId = parseInt(id);
    const { data: existingBom, error: checkError } = await supabase
      .from('bom')
      .select('bom_id')
      .eq('bom_id', bomId)
      .single() as any;

    if (checkError || !existingBom) {
      return NextResponse.json({
        success: false,
        error: 'BOM 항목을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('bom')
      .update({ is_active: false } as Database['public']['Tables']['bom']['Update'])
      .eq('bom_id', bomId);

    if (error) {
      console.error('BOM delete failed:', error);
      return NextResponse.json({
        success: false,
        error: 'BOM 삭제에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'BOM 항목이 성공적으로 삭제되었습니다.',
      data: { deleted_id: bomId }
    });
  } catch (error) {
    console.error('Error deleting BOM entry:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'BOM 삭제 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}
