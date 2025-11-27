import { NextRequest, NextResponse } from 'next/server';
import { db, handleSupabaseError, createSuccessResponse } from '@/lib/db-unified';
import { ItemClassificationUpdateSchema } from '@/lib/validation';

/**
 * GET /api/inventory/classification
 *
 * 재고 분류 통계 조회
 * Returns inventory classification statistics (count and total stock by type)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Classification API] Starting getClassificationStats...');

    // Get classification statistics using domain helper
    const statsResult = await db.items.getClassificationStats();

    console.log('[Classification API] getClassificationStats result:', JSON.stringify(statsResult, null, 2));

    if (!statsResult.success) {
      console.error('[Classification API] statsResult failed:', statsResult);
      return NextResponse.json(statsResult, { status: 500 });
    }

    return NextResponse.json(statsResult);
  } catch (error) {
    console.error('[Classification API] Caught error:', error);
    console.error('[Classification API] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return handleSupabaseError('select', 'items', error);
  }
}

/**
 * POST /api/inventory/classification
 *
 * 재고 분류 정보 업데이트
 * Updates inventory classification fields (inventory_type, warehouse_zone, quality_status)
 *
 * Request body:
 * {
 *   item_id: number,
 *   inventory_type?: '완제품' | '반제품' | '고객재고' | '원재료' | '코일',
 *   warehouse_zone?: string (format: A-01, B-03) or null,
 *   quality_status?: '검수중' | '합격' | '불합격' | '보류'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body with UTF-8 preservation
    const text = await request.text();
    const body = JSON.parse(text);

    // Validate request data
    const parseResult = ItemClassificationUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parseResult.error.issues
        },
        { status: 400 }
      );
    }

    const { item_id, inventory_type, warehouse_zone, quality_status } = parseResult.data;

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};

    if (inventory_type !== undefined) {
      updateData.inventory_type = inventory_type;
    }

    if (warehouse_zone !== undefined) {
      updateData.warehouse_zone = warehouse_zone;
    }

    if (quality_status !== undefined) {
      updateData.quality_status = quality_status;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No fields to update. Provide at least one of: inventory_type, warehouse_zone, quality_status'
        },
        { status: 400 }
      );
    }

    // Perform update using SupabaseQueryBuilder
    const { SupabaseQueryBuilder } = await import('@/lib/db-unified');
    const builder = new SupabaseQueryBuilder();

    const result = await builder.update('items', item_id, updateData, 'item_id');

    if ('error' in result) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Classification update error:', error);

    // Check if it's a database trigger error (business rule violation)
    if (error instanceof Error && error.message.includes('고객재고는 보관 구역이 필수입니다')) {
      return NextResponse.json(
        {
          success: false,
          error: error.message
        },
        { status: 400 }
      );
    }

    return handleSupabaseError('update', 'items', error);
  }
}
