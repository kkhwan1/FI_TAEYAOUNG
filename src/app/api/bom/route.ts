import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { calculateBatchScrapRevenue, calculateActualQuantityWithYield } from '@/lib/bom';
import { extractCompanyId, applyCompanyFilter } from '@/lib/filters';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';


/**
 * GET /api/bom
 * List BOM entries with filters
 * Query parameters:
 * - company_id: Filter by customer/project (프로젝트별 BOM 분리)
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
    // Support both company_id and customer_id for backward compatibility
    const customerId = extractCompanyId(searchParams, 'company_id') ?? extractCompanyId(searchParams, 'customer_id');
    const parentItemId = searchParams.get('parent_item_id');
    const childItemId = searchParams.get('child_item_id');
    const levelNo = searchParams.get('level_no');
    const coilOnly = searchParams.get('coil_only') === 'true'; // Track 2C: Coil filter
    const supplierId = searchParams.get('supplier_id'); // 공급처 (child item의 supplier) 필터
    const vehicleType = searchParams.get('vehicle_type'); // 차종 필터
    const priceMonth = searchParams.get('price_month') ||
      new Date().toISOString().slice(0, 7) + '-01';

    // 페이지네이션 최적화: 기본 100, 최소 1, 최대 500
    const limitParam = Number(searchParams.get('limit') ?? 100);
    const limit = Math.min(Math.max(limitParam, 1), 500);
    const offset = Number(searchParams.get('offset') ?? 0);

    const supabase = getSupabaseClient();

    // 기존 BOM 데이터 조회 (Track 2C: inventory_type 추가)
    // Use explicit FK names to avoid ambiguity
    let query = supabase
      .from('bom')
      .select(`
        *,
        parent:items!bom_parent_item_id_fkey (
          item_code,
          item_name,
          spec,
          price,
          vehicle_model,
          thickness,
          width,
          height,
          material,
          inventory_type
        ),
        child:items!bom_child_item_id_fkey (
          item_code,
          item_name,
          spec,
          unit,
          price,
          category,
          inventory_type,
          vehicle_model,
          thickness,
          width,
          height,
          material,
          yield_rate
        ),
        customer:companies!bom_customer_id_fkey (
          company_id,
          company_name,
          company_code
        ),
        child_supplier:companies!bom_child_supplier_id_fkey (
          company_id,
          company_name,
          company_code
        )
      `)
      .eq('is_active', true)
      .order('customer_id', { ascending: true }) // 납품처 기준으로 먼저 정렬
      .order('parent_item_id', { ascending: true }); // 그 다음 모품목 기준으로 정렬

    // 프로젝트(고객사) 필터 적용
    query = applyCompanyFilter(query, 'bom', customerId, 'customer');

    // 기존 필터 적용
    if (parentItemId) query = query.eq('parent_item_id', parseInt(parentItemId));
    if (childItemId) query = query.eq('child_item_id', parseInt(childItemId));
    if (levelNo) query = query.eq('level_no', parseInt(levelNo));

    // Track 2C: Server-side coil filter
    if (coilOnly) {
      query = query.eq('child.inventory_type', '코일');
    }

    // Server-side supplier filter
    if (supplierId) {
      query = query.eq('child_supplier_id', parseInt(supplierId));
    }

    // Server-side vehicle type filter with input sanitization
    if (vehicleType) {
      // Sanitize to prevent PostgREST filter injection
      const sanitizedVehicleType = vehicleType.replace(/[,()'"\\]/g, '').substring(0, 50);
      if (sanitizedVehicleType) {
        query = query.or(`parent.vehicle_model.eq.${sanitizedVehicleType},child.vehicle_model.eq.${sanitizedVehicleType}`);
      }
    }

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

    // All filtering is now done server-side via SQL queries
    // 각 BOM 항목을 개별로 표시 (중복 합산하지 않음)
    // 사용자가 각 항목을 개별적으로 수정/삭제할 수 있도록 함
    const filteredEntries = bomEntries || [];

    // Step 1: 코일 스펙 정보 일괄 조회 (N+1 문제 방지)
    // Deduplicate child IDs to reduce payload and DB workload
    const childItemIds = Array.from(
      new Set(
        filteredEntries
          .map((item: any) => item.child_item_id)
          .filter(Boolean)
      )
    );
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

    // Step 2: 월별 단가 일괄 조회 (N+1 문제 방지)
    const priceHistoryMap = new Map<number, number>();
    if (filteredEntries.length > 0) {
      const { data: priceRows, error: priceError } = await supabase
        .from('item_price_history')
        .select('item_id, unit_price')
        .eq('price_month', priceMonth)
        .in('item_id', childItemIds);

      if (priceError) {
        console.error('[BOM API] Price history query error:', priceError);
        // 에러가 발생해도 계속 진행 (가격 정보가 없는 경우도 있음)
      } else if (priceRows) {
        priceRows.forEach((row: any) => {
          priceHistoryMap.set(row.item_id, row.unit_price);
        });
      }
    }

    // Step 3: 재료비 계산 (배치 조회된 단가 사용 + 수율 적용)
    const entriesWithPrice = filteredEntries.map((item: any) => {
      // 월별 단가 조회 (없으면 items.price 사용)
      const unitPrice = priceHistoryMap.get(item.child_item_id) ?? item.child?.price ?? 0;

      // 수율 적용: 수율이 100% 미만이면 더 많은 자재 필요
      // 예: 수율 90%이면 100개 만들려면 111.11개 필요
      const yieldRate = item.child?.yield_rate ?? 100;
      const actualQuantityRequired = calculateActualQuantityWithYield(item.quantity_required, yieldRate);
      const materialCost = actualQuantityRequired * unitPrice;

      // 코일 스펙 정보 추가 (T4: 코일 연계 뱃지 표시용)
      const coilSpec = coilSpecsMap.get(item.child_item_id);

      return {
        ...item,
        bom_id: item.bom_id,
        parent_item_id: item.parent_item_id,
        child_item_id: item.child_item_id,
        parent_code: item.parent?.item_code,
        parent_name: item.parent?.item_name,
        parent_vehicle: item.parent?.vehicle_model || null,
        child_code: item.child?.item_code,
        child_name: item.child?.item_name,
        child_vehicle: item.child?.vehicle_model || null,
        quantity_required: item.quantity_required,
        // 수율 정보 추가 (이슈 1-1 해결)
        yield_rate: yieldRate,
        actual_quantity_required: actualQuantityRequired,
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
        // customer와 child_supplier 정보 명시적으로 포함
        customer: item.customer || null,
        child_supplier: item.child_supplier || null,
        // 모품목 마감 정보 및 자품목 구매 정보
        parent_closing_quantity: item.parent_closing_quantity || null,
        parent_closing_amount: item.parent_closing_amount || null,
        child_purchase_quantity: item.child_purchase_quantity || null,
        child_purchase_amount: item.child_purchase_amount || null,
        is_active: true
      };
    });

    // Step 3: 배치 스크랩 수익 계산 (N+1 문제 해결) - 수율 적용된 실제 소요량 사용
    const itemQuantities = entriesWithPrice.map(item => ({
      item_id: item.child_item_id,
      quantity: item.actual_quantity_required
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

    // Apply same filters for count (including all server-side filters)
    countQuery = applyCompanyFilter(countQuery, 'bom', customerId, 'customer');
    if (parentItemId) countQuery = countQuery.eq('parent_item_id', parseInt(parentItemId));
    if (childItemId) countQuery = countQuery.eq('child_item_id', parseInt(childItemId));
    if (levelNo) countQuery = countQuery.eq('level_no', parseInt(levelNo));

    // Apply server-side filters to count query
    if (coilOnly) {
      countQuery = countQuery.eq('child.inventory_type', '코일');
    }
    if (supplierId) {
      countQuery = countQuery.eq('child_supplier_id', parseInt(supplierId));
    }
    if (vehicleType) {
      countQuery = countQuery.or(`parent.vehicle_model.eq.${vehicleType},child.vehicle_model.eq.${vehicleType}`);
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      console.error('Count query failed:', countError);
    }

    const finalTotal = totalCount || 0;

    return NextResponse.json({
      success: true,
      data: {
        bom_entries: enrichedEntries,
        cost_summary: costSummary,
        price_month: priceMonth,
        pagination: {
          total: finalTotal,
          limit,
          offset,
          has_more: offset + limit < finalTotal
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
 *   level_no?: number (default: 1),
 *   customer_id?: number (납품처 - 고객사),
 *   child_supplier_id?: number (자품목 공급처)
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
      notes,
      customer_id,
      child_supplier_id
    } = body;

    const supabase = getSupabaseClient();

    // Validation
    if (!parent_item_id || !child_item_id || !quantity_required) {
      return NextResponse.json({
        success: false,
        error: '부모 품목, 자식 품목, 소요수량은 필수입니다.'
      }, { status: 400 });
    }

    // 자기 참조 허용: 모품목과 자품목이 같을 수 있음
    // 중복 입력 허용: 같은 품목 조합도 여러 번 입력 가능

    // 순환 참조 허용: 모든 순환 참조를 허용함

    // 소요량 검증
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

    // Validate customer_id if provided (must be type '고객사')
    if (customer_id) {
      const { data: customerCompany, error: customerError } = await supabase
        .from('companies')
        .select('company_id, company_name, company_type, is_active')
        .eq('company_id', customer_id)
        .single() as any;

      if (customerError || !customerCompany) {
        return NextResponse.json({
          success: false,
          error: '납품처(고객사)를 찾을 수 없습니다.'
        }, { status: 404 });
      }

      if (!customerCompany.is_active) {
        return NextResponse.json({
          success: false,
          error: '비활성화된 납품처(고객사)입니다.'
        }, { status: 400 });
      }

      if (customerCompany.company_type !== '고객사') {
        return NextResponse.json({
          success: false,
          error: '납품처는 고객사 유형만 선택 가능합니다.'
        }, { status: 400 });
      }
    }

    // Validate child_supplier_id if provided (must be type '공급사' or '협력사')
    if (child_supplier_id) {
      const { data: supplierCompany, error: supplierError } = await supabase
        .from('companies')
        .select('company_id, company_name, company_type, is_active')
        .eq('company_id', child_supplier_id)
        .single() as any;

      if (supplierError || !supplierCompany) {
        return NextResponse.json({
          success: false,
          error: '공급처를 찾을 수 없습니다.'
        }, { status: 404 });
      }

      if (!supplierCompany.is_active) {
        return NextResponse.json({
          success: false,
          error: '비활성화된 공급처입니다.'
        }, { status: 400 });
      }

      if (!['공급사', '협력사'].includes(supplierCompany.company_type)) {
        return NextResponse.json({
          success: false,
          error: '공급처는 공급사 또는 협력사 유형만 선택 가능합니다.'
        }, { status: 400 });
      }
    }

    // Create BOM entry (중복 입력 허용)
    const { data: bomEntry, error } = (await supabase
      .from('bom')
      .insert({
        parent_item_id,
        child_item_id,
        quantity_required,
        level_no,
        is_active: true,
        notes: notes || null,
        customer_id: customer_id || null,
        child_supplier_id: child_supplier_id || null
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
 *   parent_item_id?: number,
 *   child_item_id?: number,
 *   quantity_required?: number,
 *   level_no?: number,
 *   is_active?: boolean,
 *   customer_id?: number | null (납품처 - 고객사),
 *   child_supplier_id?: number | null (자품목 공급처)
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

    // Validate parent_item_id if being updated
    if (updateData.parent_item_id !== undefined) {
      const { data: parentItem, error: parentError } = await supabase
        .from('items')
        .select('item_id, item_name, is_active')
        .eq('item_id', updateData.parent_item_id)
        .single() as any;

      if (parentError || !parentItem) {
        return NextResponse.json({
          success: false,
          error: '모품목을 찾을 수 없습니다.'
        }, { status: 404 });
      }

      if (!parentItem.is_active) {
        return NextResponse.json({
          success: false,
          error: '비활성화된 모품목입니다.'
        }, { status: 400 });
      }

      // 자기 참조 허용: 모품목과 자품목이 같을 수 있음
    }

    // Validate child_item_id if being updated
    if (updateData.child_item_id !== undefined) {
      const { data: childItem, error: childError } = await supabase
        .from('items')
        .select('item_id, item_name, is_active')
        .eq('item_id', updateData.child_item_id)
        .single() as any;

      if (childError || !childItem) {
        return NextResponse.json({
          success: false,
          error: '자품목을 찾을 수 없습니다.'
        }, { status: 404 });
      }

      if (!childItem.is_active) {
        return NextResponse.json({
          success: false,
          error: '비활성화된 자품목입니다.'
        }, { status: 400 });
      }

      // 자기 참조 허용: 모품목과 자품목이 같을 수 있음
    }

    // Validate customer_id if being updated (must be type '고객사' or null)
    if (updateData.customer_id !== undefined && updateData.customer_id !== null) {
      const { data: customerCompany, error: customerError } = await supabase
        .from('companies')
        .select('company_id, company_name, company_type, is_active')
        .eq('company_id', updateData.customer_id)
        .single() as any;

      if (customerError || !customerCompany) {
        return NextResponse.json({
          success: false,
          error: '납품처(고객사)를 찾을 수 없습니다.'
        }, { status: 404 });
      }

      if (!customerCompany.is_active) {
        return NextResponse.json({
          success: false,
          error: '비활성화된 납품처(고객사)입니다.'
        }, { status: 400 });
      }

      if (customerCompany.company_type !== '고객사') {
        return NextResponse.json({
          success: false,
          error: '납품처는 고객사 유형만 선택 가능합니다.'
        }, { status: 400 });
      }
    }

    // Validate child_supplier_id if being updated (must be type '공급사' or '협력사' or null)
    if (updateData.child_supplier_id !== undefined && updateData.child_supplier_id !== null) {
      const { data: supplierCompany, error: supplierError } = await supabase
        .from('companies')
        .select('company_id, company_name, company_type, is_active')
        .eq('company_id', updateData.child_supplier_id)
        .single() as any;

      if (supplierError || !supplierCompany) {
        return NextResponse.json({
          success: false,
          error: '공급처를 찾을 수 없습니다.'
        }, { status: 404 });
      }

      if (!supplierCompany.is_active) {
        return NextResponse.json({
          success: false,
          error: '비활성화된 공급처입니다.'
        }, { status: 400 });
      }

      if (!['공급사', '협력사'].includes(supplierCompany.company_type)) {
        return NextResponse.json({
          success: false,
          error: '공급처는 공급사 또는 협력사 유형만 선택 가능합니다.'
        }, { status: 400 });
      }
    }

    // 중복 입력 허용: 같은 품목 조합도 여러 번 입력 가능

    // Extract parent_item_data and child_item_data from updateData
    const { parent_item_data, child_item_data, ...bomUpdateData } = updateData;

    // Update parent item if parent_item_data is provided
    if (parent_item_data && Object.keys(parent_item_data).length > 0) {
      const parentItemId = existingBom.parent_item_id;
      const parentUpdate: any = {};
      
      if (parent_item_data.price !== undefined) parentUpdate.price = parent_item_data.price;
      if (parent_item_data.vehicle_model !== undefined) parentUpdate.vehicle_model = parent_item_data.vehicle_model;
      if (parent_item_data.thickness !== undefined) parentUpdate.thickness = parent_item_data.thickness;
      if (parent_item_data.width !== undefined) parentUpdate.width = parent_item_data.width;
      if (parent_item_data.height !== undefined) parentUpdate.height = parent_item_data.height;
      if (parent_item_data.material !== undefined) parentUpdate.material = parent_item_data.material;

      if (Object.keys(parentUpdate).length > 0) {
        const { error: parentUpdateError } = await supabase
          .from('items')
          .update(parentUpdate)
          .eq('item_id', parentItemId);

        if (parentUpdateError) {
          console.error('Parent item update failed:', parentUpdateError);
          return NextResponse.json({
            success: false,
            error: `모품목 업데이트에 실패했습니다: ${parentUpdateError.message}`
          }, { status: 500 });
        }
      }
    }

    // Update child item if child_item_data is provided
    if (child_item_data && Object.keys(child_item_data).length > 0) {
      const childItemId = existingBom.child_item_id;
      const childUpdate: any = {};
      
      if (child_item_data.price !== undefined) childUpdate.price = child_item_data.price;
      if (child_item_data.vehicle_model !== undefined) childUpdate.vehicle_model = child_item_data.vehicle_model;
      if (child_item_data.thickness !== undefined) childUpdate.thickness = child_item_data.thickness;
      if (child_item_data.width !== undefined) childUpdate.width = child_item_data.width;
      if (child_item_data.height !== undefined) childUpdate.height = child_item_data.height;
      if (child_item_data.material !== undefined) childUpdate.material = child_item_data.material;

      if (Object.keys(childUpdate).length > 0) {
        const { error: childUpdateError } = await supabase
          .from('items')
          .update(childUpdate)
          .eq('item_id', childItemId);

        if (childUpdateError) {
          console.error('Child item update failed:', childUpdateError);
          return NextResponse.json({
            success: false,
            error: `자품목 업데이트에 실패했습니다: ${childUpdateError.message}`
          }, { status: 500 });
        }
      }
    }

    // Update BOM entry
    type BOMRow = Database['public']['Tables']['bom']['Row'];
    const { data: bomEntry, error } = await supabase
      .from('bom')
      .update(bomUpdateData as Database['public']['Tables']['bom']['Update'])
      .eq('bom_id', bom_id)
      .select(`
        *,
        parent_item:items!bom_parent_item_id_fkey(item_code, item_name, spec, unit),
        child_item:items!bom_child_item_id_fkey(item_code, item_name, spec, unit),
        customer:companies!customer_id(company_id, company_name, company_code),
        child_supplier:companies!bom_child_supplier_id_fkey(company_id, company_name, company_code)
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
