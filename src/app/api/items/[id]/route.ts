import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  handleError,
  createSuccessResponse,
  handleNotFoundError,
  handleValidationError,
  ErrorType,
  ERPError
} from '@/lib/errorHandler';
import { errorLoggingManager } from '@/lib/errorLogger';

export const dynamic = 'force-dynamic';


interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 특정 아이템 조회
 * GET /api/items/[id]
 */
export async function GET(
  request: NextRequest,
  routeContext: RouteContext
) {
  const context = {
    resource: 'items',
    action: 'read',
    userId: request.headers.get('x-user-id') || undefined,
    requestId: request.headers.get('x-request-id') || undefined
  };

  try {
    const { id } = await routeContext.params;
    const itemId = parseInt(id);

    // ID 유효성 검사
    if (isNaN(itemId) || itemId <= 0) {
      return handleValidationError(['유효하지 않은 아이템 ID입니다'], context);
    }

    const { data, error } = await supabaseAdmin
      .from('items')
      .select(`
        item_id, item_code, item_name, item_type, vehicle_model, spec,
        unit, current_stock, safety_stock, price, location,
        description, is_active, created_at, updated_at,
        category, material_type, material, thickness, width, height,
        specific_gravity, mm_weight, coating_status, scrap_rate,
        scrap_unit_price, yield_rate, overhead_rate
      `)
      .eq('item_id', itemId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching item:', error);
      return handleNotFoundError('아이템', itemId, context);
    }

    if (!data) {
      return handleNotFoundError('아이템', itemId, context);
    }

    return createSuccessResponse(data, '아이템을 성공적으로 조회했습니다');
  } catch (error) {
    return handleError(error, context);
  }
}

/**
 * 아이템 수정
 * PUT /api/items/[id]
 */
export async function PUT(
  request: NextRequest,
  routeContext: RouteContext
) {
  const context = {
    resource: 'items',
    action: 'update',
    userId: request.headers.get('x-user-id') || undefined,
    requestId: request.headers.get('x-request-id') || undefined
  };

  try {
    const { id } = await routeContext.params;
    const itemId = parseInt(id);

    // ID 유효성 검사
    if (isNaN(itemId) || itemId <= 0) {
      return handleValidationError(['유효하지 않은 아이템 ID입니다'], context);
    }

    // 요청 본문 파싱 (한글 지원)
    const text = await request.text();
    const body = JSON.parse(text);

    // 부분 업데이트 모드 확인 (price만 업데이트하는 경우 등)
    const isPartialUpdate = body.partial === true ||
      (Object.keys(body).length === 1 && body.price !== undefined);

    // 필수 필드 검사 (부분 업데이트가 아닌 경우에만)
    if (!isPartialUpdate) {
      const requiredFields = ['item_name', 'unit'];
      const missingFields = requiredFields.filter(field => !body[field]);

      if (missingFields.length > 0) {
        return handleValidationError(
          missingFields.map(field => `${field}는 필수 입력 항목입니다`),
          context
        );
      }
    }

    // 아이템 존재 여부 확인
    const { data: existsCheck, error: existsError } = await supabaseAdmin
      .from('items')
      .select('item_id')
      .eq('item_id', itemId)
      .eq('is_active', true)
      .single();

    if (existsError || !existsCheck) {
      return handleNotFoundError('아이템', itemId, context);
    }

    // 중복 코드 검사 (다른 아이템이 같은 코드 사용)
    if (body.item_code) {
      const { data: duplicateCheck, error: duplicateError } = await supabaseAdmin
        .from('items')
        .select('item_id')
        .eq('item_code', body.item_code)
        .neq('item_id', itemId)
        .eq('is_active', true);

      if (duplicateError) {
        console.error('Error checking duplicate code:', duplicateError);
      } else if (duplicateCheck && duplicateCheck.length > 0) {
        throw new ERPError(
          ErrorType.DUPLICATE_ENTRY,
          '다른 아이템이 이미 해당 코드를 사용 중입니다',
          { item_code: body.item_code, existing_item_id: duplicateCheck[0].item_id },
          context
        );
      }
    }

    // 업데이트 가능한 필드들
    const allowedFields = [
      'item_code', 'item_name', 'item_type', 'vehicle_model', 'spec',
      'unit', 'safety_stock', 'price', 'location', 'description',
      'category', 'material_type', 'material', 'thickness', 'width', 'height',
      'specific_gravity', 'mm_weight', 'coating_status', 'scrap_rate',
      'scrap_unit_price', 'yield_rate', 'overhead_rate', 'supplier_id'
    ];

    const updateData: any = {};
    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    if (Object.keys(updateData).length === 0) {
      throw new ERPError(
        ErrorType.VALIDATION,
        '업데이트할 필드가 없습니다',
        { provided_fields: Object.keys(body) },
        context
      );
    }

    updateData.updated_at = new Date().toISOString();

    // 업데이트 실행
    const { data: updatedItem, error: updateError } = await supabaseAdmin
      .from('items')
      .update(updateData)
      .eq('item_id', itemId)
      .eq('is_active', true)
      .select(`
        item_id, item_code, item_name, item_type, vehicle_model, spec,
        unit, current_stock, safety_stock, price, location,
        description, updated_at, category, material_type, material,
        thickness, width, height, specific_gravity, mm_weight,
        coating_status, scrap_rate, scrap_unit_price, yield_rate, overhead_rate
      `)
      .single();

    if (updateError) {
      console.error('Error updating item:', updateError);
      return handleNotFoundError('아이템', itemId, context);
    }

    if (!updatedItem) {
      return handleNotFoundError('아이템', itemId, context);
    }

    return createSuccessResponse(
      updatedItem,
      '아이템이 성공적으로 수정되었습니다'
    );
  } catch (error) {
    return handleError(error, context);
  }
}

/**
 * 아이템 삭제 (소프트 삭제)
 * DELETE /api/items/[id]
 */
export async function DELETE(
  request: NextRequest,
  routeContext: RouteContext
) {
  const context = {
    resource: 'items',
    action: 'delete',
    userId: request.headers.get('x-user-id') || undefined,
    requestId: request.headers.get('x-request-id') || undefined
  };

  try {
    const { id } = await routeContext.params;
    const itemId = parseInt(id);

    // ID 유효성 검사
    if (isNaN(itemId) || itemId <= 0) {
      return handleValidationError(['유효하지 않은 아이템 ID입니다'], context);
    }

    // 아이템 존재 여부 확인
    const { data: existsCheck, error: existsError } = await supabaseAdmin
      .from('items')
      .select('item_id, item_code, item_name')
      .eq('item_id', itemId)
      .eq('is_active', true)
      .single();

    if (existsError || !existsCheck) {
      return handleNotFoundError('아이템', itemId, context);
    }

    // BOM에서 사용 중인지 확인
    const { count: bomCount, error: bomError } = await supabaseAdmin
      .from('bom')
      .select('*', { count: 'exact', head: true })
      .or(`parent_item_id.eq.${itemId},child_item_id.eq.${itemId}`)
      .eq('is_active', true);

    if (bomError) {
      console.error('Error checking BOM usage:', bomError);
    } else if (bomCount && bomCount > 0) {
      throw new ERPError(
        ErrorType.DATABASE_CONSTRAINT,
        'BOM에서 사용 중인 아이템은 삭제할 수 없습니다',
        {
          item_id: itemId,
          item_code: existsCheck.item_code,
          bom_usage_count: bomCount
        },
        context
      );
    }

    // 재고 이동 기록이 있는지 확인
    const { count: transactionCount, error: transactionError } = await supabaseAdmin
      .from('inventory_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('item_id', itemId);

    if (transactionError) {
      console.error('Error checking transaction history:', transactionError);
    } else if (transactionCount && transactionCount > 0) {
      throw new ERPError(
        ErrorType.DATABASE_CONSTRAINT,
        '재고 이동 기록이 있는 아이템은 삭제할 수 없습니다',
        {
          item_id: itemId,
          item_code: existsCheck.item_code,
          transaction_count: transactionCount
        },
        context
      );
    }

    // 소프트 삭제 실행
    const { data: deletedItem, error: deleteError } = await supabaseAdmin
      .from('items')
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('item_id', itemId)
      .eq('is_active', true)
      .select('item_id, item_code')
      .single();

    if (deleteError) {
      console.error('Error deleting item:', deleteError);
      return handleNotFoundError('아이템', itemId, context);
    }

    if (!deletedItem) {
      return handleNotFoundError('아이템', itemId, context);
    }

    return createSuccessResponse(
      { item_id: itemId, item_code: deletedItem.item_code },
      '아이템이 성공적으로 삭제되었습니다'
    );
  } catch (error) {
    return handleError(error, context);
  }
}