import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { APIError, handleAPIError, validateRequiredFields } from '@/lib/api-utils';
import { checkAPIResourcePermission } from '@/lib/api-permission-check';
import { logger } from '@/lib/logger';
import { metricsCollector } from '@/lib/metrics';
import type { Database, ItemInsert, ItemRow, ItemUpdate } from '@/types/supabase';
import { type CoatingStatus, normalizeCoatingStatus } from '@/lib/constants/coatingStatus';
import { extractCompanyId, applyCompanyFilter } from '@/lib/filters';

export const dynamic = 'force-dynamic';


type NormalizedItemPayload = {
  item_code: string;
  item_name: string;
  category: ItemInsert['category'] | null;
  unit: string;
  vehicle_model: string | null;
  material: string | null;
  spec: string | null;
  thickness: number | null;
  width: number | null;
  height: number | null;
  specific_gravity: number | null;
  mm_weight: number | null;
  daily_requirement: number | null;
  blank_size: number | null;
  price: number | null;
  safety_stock: number | null;
  current_stock: number | null;
  location: string | null;
  description: string | null;
  coating_status: CoatingStatus | null;
  inventory_type: ItemInsert['inventory_type'] | null;
  warehouse_zone: string | null;
  quality_status: ItemInsert['quality_status'] | null;
};

const DEFAULT_LIMIT = 20;

// handleError는 이제 api-utils.ts의 handleAPIError를 사용
function handleError(error: unknown, fallbackMessage: string): NextResponse {
  return handleAPIError(error);
}

function normalizeString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeInteger(value: unknown): number | null {
  const numeric = normalizeNumber(value);
  if (numeric === null) return null;
  return Math.trunc(numeric);
}


function computeMmWeight(payload: {
  thickness: number | null;
  width: number | null;
  height: number | null;
  blank_size: number | null;
  specific_gravity: number | null;
  mm_weight: number | null;
}): number | null {
  if (payload.mm_weight !== null && payload.mm_weight !== undefined) {
    return payload.mm_weight;
  }

  const { thickness, width, height, blank_size, specific_gravity } = payload;

  if (thickness === null || width === null) {
    return null;
  }

  const density = specific_gravity && specific_gravity > 0 ? specific_gravity : 7.85;

  if (density <= 0 || thickness <= 0 || width <= 0) {
    return null;
  }

  const thicknessCm = thickness / 10;
  const widthCm = width / 10;
  const lengthSource = blank_size && blank_size > 0 ? blank_size : height && height > 0 ? height : null;
  const lengthCm = lengthSource ? lengthSource / 10 : 100; // 기본값 1m (100cm)
  const volumeCm3 = thicknessCm * widthCm * lengthCm;
  const weightKg = (volumeCm3 * density) / 1000;
  return Number.isFinite(weightKg) ? Number(weightKg.toFixed(4)) : null;
}

function mapRow(row: ItemRow): ItemRow & { unit_price?: number } {
  const price = row.price === null ? null : Number(row.price);
  return {
    ...row,
    thickness: row.thickness === null ? null : Number(row.thickness),
    width: row.width === null ? null : Number(row.width),
    height: row.height === null ? null : Number(row.height),
    specific_gravity: row.specific_gravity === null ? null : Number(row.specific_gravity),
    mm_weight: row.mm_weight === null ? null : Number(row.mm_weight),
    daily_requirement: row.daily_requirement === null ? null : Number(row.daily_requirement),
    blank_size: row.blank_size === null ? null : Number(row.blank_size),
    price: price,
    unit_price: price === null ? undefined : price, // Add unit_price for backward compatibility
    safety_stock: row.safety_stock === null ? null : Number(row.safety_stock),
    current_stock: row.current_stock === null ? null : Number(row.current_stock),
  };
}

async function assertUniqueItemCode(itemCode: string, excludeId?: number): Promise<void> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('items')
    .select('item_id')
    .eq('item_code', itemCode)
    .eq('is_active', true)
    .limit(1);

  if (excludeId) {
    query = query.neq('item_id', excludeId);
  }

  const { data, error } = await query;

  if (error) {
    throw new APIError('품목 코드 중복 여부를 확인하지 못했습니다.', 500, error.message);
  }

  if (data && data.length > 0) {
    throw new APIError('이미 사용 중인 품목 코드입니다.', 409, 'DUPLICATE_ITEM_CODE', { item_code: itemCode });
  }
}

function buildNormalizedPayload(body: Record<string, unknown>): NormalizedItemPayload {
  const normalized: NormalizedItemPayload = {
    item_code: normalizeString(body.item_code) ?? '',
    item_name: normalizeString(body.item_name) ?? '',
    category: normalizeString(body.category) as ItemInsert['category'] | null,
    unit: normalizeString(body.unit) ?? '',
    vehicle_model: normalizeString(body.vehicle_model),
    material: normalizeString(body.material),
    spec: normalizeString(body.spec ?? body.specification),
    thickness: normalizeNumber(body.thickness),
    width: normalizeNumber(body.width),
    height: normalizeNumber(body.height),
    specific_gravity: normalizeNumber(body.specific_gravity),
    mm_weight: normalizeNumber(body.mm_weight),
    daily_requirement: normalizeInteger(body.daily_requirement),
    blank_size: normalizeInteger(body.blank_size),
    price: normalizeNumber(body.price ?? body.unit_price),
    safety_stock: normalizeInteger(body.safety_stock ?? body.min_stock_level),
    current_stock: normalizeInteger(body.current_stock),
    location: normalizeString(body.location),
    description: normalizeString(body.description),
    coating_status: normalizeCoatingStatus(body.coating_status),
    inventory_type: normalizeString(body.inventory_type) as ItemInsert['inventory_type'] | null,
    warehouse_zone: normalizeString(body.warehouse_zone),
    quality_status: normalizeString(body.quality_status) as ItemInsert['quality_status'] | null,
  };

  normalized.mm_weight = computeMmWeight({
    thickness: normalized.thickness,
    width: normalized.width,
    height: normalized.height,
    blank_size: normalized.blank_size,
    specific_gravity: normalized.specific_gravity,
    mm_weight: normalized.mm_weight,
  });

  return normalized;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/items';

  try {
    // 권한 체크
    const { user, response: permissionResponse } = await checkAPIResourcePermission(request, 'items', 'read');
    if (permissionResponse) return permissionResponse;
    
    logger.info('Items GET request', { endpoint });
    const supabase = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;

    const search = normalizeString(searchParams.get('search'));
    const category = normalizeString(searchParams.get('category'));
    const itemType = normalizeString(searchParams.get('itemType'));
    const materialType = normalizeString(searchParams.get('materialType'));
    const vehicleModel = normalizeString(searchParams.get('vehicleModel'));
    const coatingStatus = normalizeString(searchParams.get('coating_status'));
    const minDaily = normalizeInteger(searchParams.get('minDaily'));
    const maxDaily = normalizeInteger(searchParams.get('maxDaily'));
    const limit = normalizeInteger(searchParams.get('limit')) ?? DEFAULT_LIMIT;
    
    // Cursor-based pagination parameters
    const cursor = normalizeString(searchParams.get('cursor'));
    const direction = normalizeString(searchParams.get('direction')) === 'prev' ? 'prev' : 'next';
    
    // Fallback to offset-based pagination for backward compatibility
    const page = normalizeInteger(searchParams.get('page'));
    const useCursorPagination = searchParams.get('use_cursor') === 'true' || (!page && cursor);

    // Sort parameters
    const sortColumn = normalizeString(searchParams.get('sort_column')) ?? 'created_at';
    const sortOrder = normalizeString(searchParams.get('sort_order')) ?? 'desc';
    const sortAscending = sortOrder === 'asc';

    // Build base query
    let query = supabase
      .from('items')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    // Apply company filter
    const companyId = extractCompanyId(searchParams, 'company_id');
    query = applyCompanyFilter(query, 'items', companyId, 'supplier');

    // Apply filters
    if (search) {
      // Use pg_trgm similarity search for better Korean text search
      query = query.or(
        `item_code.ilike.%${search}%,item_name.ilike.%${search}%,spec.ilike.%${search}%,material.ilike.%${search}%`
      );
    }

    if (category) {
      query = query.eq('category', category as NonNullable<ItemInsert['category']>);
    }

    if (itemType) {
      query = query.eq('item_type', itemType);
    }

    if (materialType) {
      query = query.eq('material_type', materialType);
    }

    if (vehicleModel) {
      query = query.ilike('vehicle_model', `%${vehicleModel}%`);
    }

    if (coatingStatus) {
      query = query.eq('coating_status', coatingStatus);
    }

    if (minDaily !== null) {
      query = query.gte('daily_requirement', minDaily);
    }

    if (maxDaily !== null) {
      query = query.lte('daily_requirement', maxDaily);
    }

    let itemsData: ItemRow[] = [];
    let totalCount = 0;
    let hasMore = false;
    let nextCursor: string | null = null;
    let prevCursor: string | null = null;

    if (useCursorPagination) {
      // Cursor-based pagination
      // For 'next', we want items after the cursor (ascending order)
      // For 'prev', we want items before the cursor (descending order)
      const ascending = direction === 'next';
      
      if (cursor) {
        // When going next, get items with item_code > cursor
        // When going prev, get items with item_code < cursor
        const operator = ascending ? 'gt' : 'lt';
        query = query[operator]('item_code', cursor);
      }
      
      // Order by selected column for cursor-based pagination
      // Primary sort by dynamic column, secondary by item_code for consistency
      query = query
        .order(sortColumn, { ascending: sortAscending })
        .order('item_code', { ascending: true })
        .limit(limit + 1); // +1 to check if there are more items

      const { data: rawItems, error, count } = await query;

      if (error) {
        throw new APIError('품목 정보를 조회하지 못했습니다.', 500, error.message);
      }

      // Get total count with same filters applied
      let countQuery = supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Apply company filter to count query as well
      countQuery = applyCompanyFilter(countQuery, 'items', companyId, 'supplier');

      // Apply same filters as main query
      if (search) {
        countQuery = countQuery.or(
          `item_code.ilike.%${search}%,item_name.ilike.%${search}%,spec.ilike.%${search}%,material.ilike.%${search}%`
        );
      }
      if (category) {
        countQuery = countQuery.eq('category', category as NonNullable<ItemInsert['category']>);
      }
      if (itemType) {
        countQuery = countQuery.eq('item_type', itemType);
      }
      if (materialType) {
        countQuery = countQuery.eq('material_type', materialType);
      }
      if (vehicleModel) {
        countQuery = countQuery.ilike('vehicle_model', `%${vehicleModel}%`);
      }
      if (coatingStatus) {
        countQuery = countQuery.eq('coating_status', coatingStatus);
      }
      if (minDaily !== null) {
        countQuery = countQuery.gte('daily_requirement', minDaily);
      }
      if (maxDaily !== null) {
        countQuery = countQuery.lte('daily_requirement', maxDaily);
      }
      
      const { count: totalCountResult } = await countQuery;
      totalCount = totalCountResult || 0;
      hasMore = rawItems && rawItems.length > limit;
      
      if (hasMore) {
        itemsData = rawItems.slice(0, limit);
        const lastItem = itemsData[itemsData.length - 1];
        nextCursor = lastItem.item_code;
        
        // For prev cursor, get the first item's code
        if (itemsData.length > 0) {
          prevCursor = itemsData[0].item_code;
        }
      } else {
        itemsData = rawItems || [];
        // If no more items, set nextCursor to null
        if (itemsData.length > 0 && direction === 'next') {
          nextCursor = null;
        }
      }
    } else {
      // Offset-based pagination (backward compatibility)
      const pageNum = page || 1;
      const offset = (pageNum - 1) * limit;

      // Order by selected column for offset-based pagination
      // Primary sort by dynamic column, secondary by item_code for consistency
      query = query
        .order(sortColumn, { ascending: sortAscending })
        .order('item_code', { ascending: true })
        .range(offset, offset + limit - 1);

      const { data: rawItems, error, count } = await query;

      if (error) {
        throw new APIError('품목 정보를 조회하지 못했습니다.', 500, error.message);
      }

      itemsData = rawItems || [];
      totalCount = count || 0;
    }

    const items = itemsData.map((item) => mapRow(item as ItemRow));

    const resultData: any = {
      success: true,
      data: {
        items,
      },
      filters: {
        search,
        category,
        itemType,
        materialType,
        vehicleModel,
        coatingStatus,
        minDaily,
        maxDaily,
      },
    };

    if (useCursorPagination) {
      resultData.data.pagination = {
        limit,
        total: totalCount,
        hasMore,
        nextCursor,
        prevCursor,
        direction,
      };
    } else {
      const pageNum = page || 1;
      resultData.data.pagination = {
        page: pageNum,
        limit,
        total: totalCount,
        totalPages: totalCount ? Math.ceil(totalCount / limit) : 0,
        hasMore: totalCount ? (pageNum - 1) * limit + items.length < totalCount : false,
      };
    }

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Items GET success', { endpoint, duration, itemCount: items.length });

    return NextResponse.json(resultData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Items GET error', error as Error, { endpoint, duration });

    return handleError(error, '품목 정보를 조회하지 못했습니다.');
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 권한 체크
    const { response: permissionResponse } = await checkAPIResourcePermission(request, 'items', 'create');
    if (permissionResponse) return permissionResponse;
    
    // Korean UTF-8 support
    const text = await request.text();
    const body = JSON.parse(text);
    const normalized = buildNormalizedPayload(body);

    const requiredErrors = validateRequiredFields(
      {
        item_code: normalized.item_code,
        item_name: normalized.item_name,
        category: normalized.category,
        unit: normalized.unit,
      },
      ['item_code', 'item_name', 'category', 'unit']
    );

    if (requiredErrors.length > 0) {
      throw new APIError('필수 입력값을 확인해주세요.', 400, 'VALIDATION_ERROR', requiredErrors);
    }

    await assertUniqueItemCode(normalized.item_code);

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const payload: ItemInsert = {
      item_code: normalized.item_code,
      item_name: normalized.item_name,
      category: normalized.category as NonNullable<ItemInsert['category']>,
      unit: normalized.unit,
      vehicle_model: normalized.vehicle_model,
      material: normalized.material,
      spec: normalized.spec,
      thickness: normalized.thickness,
      width: normalized.width,
      height: normalized.height,
      specific_gravity: normalized.specific_gravity ?? 7.85,
      mm_weight: normalized.mm_weight,
      daily_requirement: normalized.daily_requirement,
      blank_size: normalized.blank_size,
      price: normalized.price,
      safety_stock: normalized.safety_stock,
      current_stock: normalized.current_stock,
      location: normalized.location,
      description: normalized.description,
      inventory_type: (normalized.inventory_type as ItemInsert['inventory_type']) || '원재료', // 기본값: 원재료
      warehouse_zone: normalized.warehouse_zone,
      quality_status: normalized.quality_status,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('items')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      throw new APIError('품목을 등록하지 못했습니다.', 500, error?.message);
    }

    return NextResponse.json({
      success: true,
      data: mapRow(data as ItemRow),
      message: '품목이 등록되었습니다.',
    });
  } catch (error) {
    return handleError(error, '품목 등록 중 오류가 발생했습니다.');
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  // ✅ CRITICAL FIX: Add permission check before processing request
  const { response: permissionResponse } = await checkAPIResourcePermission(
    request,
    'items',
    'update'
  );
  if (permissionResponse) return permissionResponse;

  try {
    // CRITICAL: Korean encoding - Use request.text() + JSON.parse()
    const text = await request.text();
    const body = JSON.parse(text);
    const itemId = normalizeInteger(body.item_id ?? body.id);

    if (!itemId) {
      throw new APIError('품목 ID가 필요합니다.', 400);
    }

    const normalized = buildNormalizedPayload(body);

    if (normalized.item_code) {
      await assertUniqueItemCode(normalized.item_code, itemId);
    }

    if (
      !normalized.item_code &&
      !normalized.item_name &&
      !normalized.unit &&
      !normalized.category &&
      normalized.vehicle_model === null &&
      normalized.material === null &&
      normalized.spec === null &&
      normalized.thickness === null &&
      normalized.width === null &&
      normalized.height === null &&
      normalized.specific_gravity === null &&
      normalized.mm_weight === null &&
      normalized.daily_requirement === null &&
      normalized.blank_size === null &&
      normalized.price === null &&
      normalized.safety_stock === null &&
      normalized.current_stock === null &&
      normalized.location === null &&
      normalized.description === null &&
      normalized.inventory_type === null &&
      normalized.warehouse_zone === null &&
      normalized.quality_status === null
    ) {
      throw new APIError('수정할 값이 없습니다.', 400);
    }

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const payload: ItemUpdate = {
      item_code: normalized.item_code ?? undefined,
      item_name: normalized.item_name ?? undefined,
      category: normalized.category ?? undefined,
      unit: normalized.unit ?? undefined,
      vehicle_model: normalized.vehicle_model ?? undefined,
      material: normalized.material ?? undefined,
      spec: normalized.spec ?? undefined,
      thickness: normalized.thickness ?? undefined,
      width: normalized.width ?? undefined,
      height: normalized.height ?? undefined,
      specific_gravity: normalized.specific_gravity ?? undefined,
      mm_weight: normalized.mm_weight ?? undefined,
      daily_requirement: normalized.daily_requirement ?? undefined,
      blank_size: normalized.blank_size ?? undefined,
      price: normalized.price ?? undefined,
      safety_stock: normalized.safety_stock ?? undefined,
      current_stock: normalized.current_stock ?? undefined,
      location: normalized.location ?? undefined,
      description: normalized.description ?? undefined,
      inventory_type: normalized.inventory_type ?? undefined,
      warehouse_zone: normalized.warehouse_zone ?? undefined,
      quality_status: normalized.quality_status ?? undefined,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('items')
      .update(payload)
      .eq('item_id', itemId)
      .select('*')
      .single();

    if (error) {
      throw new APIError('품목 정보를 수정하지 못했습니다.', 500, error.message);
    }

    if (!data) {
      throw new APIError('수정 대상 품목을 찾을 수 없습니다.', 404);
    }

    return NextResponse.json({
      success: true,
      data: mapRow(data as ItemRow),
      message: '품목 정보가 수정되었습니다.',
    });
  } catch (error) {
    // ✅ HIGH FIX: Handle JSON parse errors with 400 status
    if (error instanceof SyntaxError) {
      throw new APIError('잘못된 JSON 형식입니다.', 400);
    }
    return handleError(error, '품목 수정 중 오류가 발생했습니다.');
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // ✅ CRITICAL FIX: Add permission check before processing request
  const { response: permissionResponse } = await checkAPIResourcePermission(
    request,
    'items',
    'delete'
  );
  if (permissionResponse) return permissionResponse;

  try {
    // ✅ FIX: Use consistent Korean encoding pattern
    const text = await request.text();
    const body = JSON.parse(text);
    const itemId = normalizeInteger(body.item_id ?? body.id);

    if (!itemId) {
      throw new APIError('품목 ID가 필요합니다.', 400);
    }

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('items')
      .update({
        is_active: false,
        updated_at: now,
      })
      .eq('item_id', itemId)
      .select('item_id')
      .single();

    if (error) {
      throw new APIError('품목을 비활성화하지 못했습니다.', 500, error.message);
    }

    if (!data) {
      throw new APIError('대상 품목을 찾을 수 없습니다.', 404);
    }

    return NextResponse.json({
      success: true,
      message: '품목이 비활성화되었습니다.',
    });
  } catch (error) {
    // ✅ HIGH FIX: Handle JSON parse errors with 400 status
    if (error instanceof SyntaxError) {
      throw new APIError('잘못된 JSON 형식입니다.', 400);
    }
    return handleError(error, '품목 삭제 중 오류가 발생했습니다.');
  }
}


