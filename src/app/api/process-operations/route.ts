/**
 * Process Operations API Routes
 *
 * Endpoints:
 * - GET /api/process-operations - List operations with filtering
 * - POST /api/process-operations - Create new operation
 *
 * @author Claude (Backend System Architect)
 * @date 2025-02-04
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';
import type {
  ProcessOperationWithItems,
  ProcessOperationListOptions,
  CreateProcessOperationRequest,
  OperationType,
  OperationStatus,
} from '@/types/process';
import { calculateEfficiency } from '@/types/process';

export const dynamic = 'force-dynamic';


// ============================================================================
// GET - List Process Operations with Filtering
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    console.log('[DEBUG] GET /api/process-operations called');
    const supabase = getSupabaseClient();
    console.log('[DEBUG] Supabase client created');
    const { searchParams } = new URL(request.url);
    console.log('[DEBUG] Search params:', Object.fromEntries(searchParams.entries()));

    // Parse query parameters
    const operation_type = searchParams.get('operation_type');
    const status = searchParams.get('status');
    const input_item_id = searchParams.get('input_item_id');
    const output_item_id = searchParams.get('output_item_id');
    const operator_id = searchParams.get('operator_id');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const sortBy = (searchParams.get('sortBy') || 'created_at') as 'created_at' | 'started_at' | 'completed_at';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Build query - items 관계만 포함 (coil_process는 별도 조회)
    let query = supabase
      .from('process_operations')
      .select(`
        *,
        input_item:items!input_item_id (
          item_id,
          item_name,
          item_code,
          current_stock,
          unit,
          spec
        ),
        output_item:items!output_item_id (
          item_id,
          item_name,
          item_code,
          current_stock,
          unit,
          spec
        )
      `, { count: 'exact' });

    // Apply filters
    if (operation_type) {
      const types = operation_type.split(',') as OperationType[];
      query = query.in('operation_type', types);
    }

    if (status) {
      const statuses = status.split(',') as OperationStatus[];
      query = query.in('status', statuses);
    }

    if (input_item_id) {
      query = query.eq('input_item_id', parseInt(input_item_id));
    }

    if (output_item_id) {
      query = query.eq('output_item_id', parseInt(output_item_id));
    }

    if (operator_id) {
      query = query.eq('operator_id', parseInt(operator_id));
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    if (search) {
      // 검색어가 숫자인 경우 operation_id로도 검색
      const searchNum = parseInt(search);
      const isNumeric = !isNaN(searchNum);
      
      // items 테이블에서 품목명/품목코드로 검색하여 item_id 목록 찾기
      let itemIds: number[] = [];
      if (search) {
        const { data: itemsData } = await supabase
          .from('items')
          .select('item_id')
          .or(`item_name.ilike.%${search}%,item_code.ilike.%${search}%`);
        
        if (itemsData) {
          itemIds = itemsData.map((item: any) => item.item_id);
        }
      }
      
      // 검색 조건 구성 (Supabase .or() 문법: column.operator.value,column.operator.value)
      const searchConditions: string[] = [];
      
      // notes 검색
      searchConditions.push(`notes.ilike.%${search}%`);
      
      // operation_id 검색 (숫자인 경우)
      if (isNumeric) {
        searchConditions.push(`operation_id.eq.${searchNum}`);
      }
      
      // item_id 검색 (품목명/품목코드로 찾은 경우)
      if (itemIds.length > 0) {
        // .in() 메서드를 사용하거나, 여러 개의 .eq()를 OR로 결합
        // Supabase에서는 .or()와 .in()을 함께 사용할 수 없으므로
        // 별도로 처리하거나 클라이언트 사이드에서 필터링
        // 여기서는 간단하게 여러 조건을 OR로 결합
        itemIds.forEach(itemId => {
          searchConditions.push(`input_item_id.eq.${itemId}`);
          searchConditions.push(`output_item_id.eq.${itemId}`);
        });
      }
      
      // OR 조건으로 결합
      if (searchConditions.length > 0) {
        query = query.or(searchConditions.join(','));
      }
    }

    // Get status counts for all operations (before filtering and pagination)
    const { data: statusCountsData, error: statusCountsError } = await supabase
      .from('process_operations')
      .select('status');

    const statusCounts: Record<string, number> = {
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      ALL: 0
    };

    if (!statusCountsError && statusCountsData) {
      statusCounts.ALL = statusCountsData.length;
      statusCountsData.forEach((op: any) => {
        if (op.status in statusCounts) {
          statusCounts[op.status as keyof typeof statusCounts]++;
        }
      });
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[ERROR] Process operations query error:', error);
      return handleSupabaseError('select', 'process_operations', error);
    }

    // Transform data to include proper relations
    const operations: ProcessOperationWithItems[] = (data || []).map((op: any) => ({
      operation_id: op.operation_id,
      operation_type: op.operation_type,
      input_item_id: op.input_item_id,
      output_item_id: op.output_item_id,
      input_quantity: parseFloat(op.input_quantity || 0),
      output_quantity: parseFloat(op.output_quantity || 0),
      efficiency: op.efficiency ? parseFloat(op.efficiency) : undefined,
      operator_id: op.operator_id,
      started_at: op.started_at,
      completed_at: op.completed_at,
      status: op.status,
      notes: op.notes,
      created_at: op.created_at,
      updated_at: op.updated_at,
      // LOT tracking fields
      lot_number: op.lot_number,
      parent_lot_number: op.parent_lot_number,
      child_lot_number: op.child_lot_number,
      // Chain management fields
      chain_id: op.chain_id,
      chain_sequence: op.chain_sequence,
      parent_operation_id: op.parent_operation_id,
      auto_next_operation: op.auto_next_operation,
      next_operation_type: op.next_operation_type,
      // Quality control fields
      quality_status: op.quality_status,
      scrap_quantity: op.scrap_quantity ? parseFloat(op.scrap_quantity) : undefined,
      scheduled_date: op.scheduled_date,
      input_item: op.input_item ? {
        item_id: op.input_item.item_id,
        item_name: op.input_item.item_name || '-',
        item_code: op.input_item.item_code || '-',
        current_stock: parseFloat(op.input_item.current_stock || 0),
        unit: op.input_item.unit || null,
        spec: op.input_item.spec || null,
      } : {
        item_id: op.input_item_id,
        item_name: '-',
        item_code: '-',
        current_stock: 0,
        unit: null,
        spec: null,
      },
      output_item: op.output_item ? {
        item_id: op.output_item.item_id,
        item_name: op.output_item.item_name || '-',
        item_code: op.output_item.item_code || '-',
        current_stock: parseFloat(op.output_item.current_stock || 0),
        unit: op.output_item.unit || null,
        spec: op.output_item.spec || null,
      } : {
        item_id: op.output_item_id,
        item_name: '-',
        item_code: '-',
        current_stock: 0,
        unit: null,
        spec: null,
      },
      // Coil process tracking (bidirectional sync)
      coil_process_id: op.coil_process_id || undefined,
      coil_process: undefined, // coil_process는 필요시 별도 조회
    }));

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      data: operations,
      statusCounts, // 상태별 개수 추가
      pagination: {
        page,
        limit,
        totalPages,
        totalCount,
      },
    });
  } catch (error) {
    console.error('[ERROR] Unexpected error in GET /api/process-operations:', error);
    console.error('[ERROR] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '공정 작업 목록을 조회하는 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create Process Operation
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // Parse request body with proper UTF-8 handling
    const text = await request.text();
    const body: CreateProcessOperationRequest = JSON.parse(text);

    // Validation
    if (!body.operation_type || !['BLANKING', 'PRESS', 'ASSEMBLY'].includes(body.operation_type)) {
      return NextResponse.json(
        {
          success: false,
          error: '유효하지 않은 공정 유형입니다. (BLANKING, PRESS, ASSEMBLY 중 선택)',
        },
        { status: 400 }
      );
    }

    if (!body.input_item_id || !body.output_item_id) {
      return NextResponse.json(
        {
          success: false,
          error: '투입 품목과 산출 품목을 모두 지정해야 합니다.',
        },
        { status: 400 }
      );
    }

    if (body.input_item_id === body.output_item_id) {
      return NextResponse.json(
        {
          success: false,
          error: '투입 품목과 산출 품목이 동일할 수 없습니다.',
        },
        { status: 400 }
      );
    }

    if (!body.input_quantity || body.input_quantity <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: '투입 수량은 0보다 커야 합니다.',
        },
        { status: 400 }
      );
    }

    if (!body.output_quantity || body.output_quantity <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: '산출 수량은 0보다 커야 합니다.',
        },
        { status: 400 }
      );
    }

    // Check if items exist
    const { data: inputItem, error: inputError } = await supabase
      .from('items')
      .select('item_id, item_name, current_stock')
      .eq('item_id', body.input_item_id)
      .single();

    if (inputError || !inputItem) {
      return NextResponse.json(
        {
          success: false,
          error: `투입 품목(ID: ${body.input_item_id})을 찾을 수 없습니다.`,
        },
        { status: 404 }
      );
    }

    const { data: outputItem, error: outputError } = await supabase
      .from('items')
      .select('item_id, item_name, current_stock')
      .eq('item_id', body.output_item_id)
      .single();

    if (outputError || !outputItem) {
      return NextResponse.json(
        {
          success: false,
          error: `산출 품목(ID: ${body.output_item_id})을 찾을 수 없습니다.`,
        },
        { status: 404 }
      );
    }

    // Check stock availability for input item
    const currentStock = parseFloat(inputItem.current_stock);
    if (currentStock < body.input_quantity) {
      return NextResponse.json(
        {
          success: false,
          error: `투입 품목 "${inputItem.item_name}"의 재고가 부족합니다. (필요: ${body.input_quantity}, 현재: ${currentStock})`,
        },
        { status: 400 }
      );
    }

    // Auto-calculate efficiency if not provided
    const efficiency = body.efficiency ?? calculateEfficiency(body.input_quantity, body.output_quantity);

    // Generate LOT number using database function
    let lotNumber: string;
    try {
      const { data: lotResult, error: lotError } = await supabase
        .rpc('generate_lot_number', {
          p_operation_type: body.operation_type,
          p_item_id: body.output_item_id
        });

      if (lotError) {
        console.error('[ERROR] LOT number generation error:', lotError);
        // Fallback: Generate LOT number manually if RPC fails
        const prefix = body.operation_type === 'BLANKING' ? 'BLK' :
                      body.operation_type === 'PRESS' ? 'PRS' :
                      body.operation_type === 'ASSEMBLY' ? 'ASM' : 'OTH';
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

        // Get next sequence for today
        const { data: existingLots } = await supabase
          .from('process_operations')
          .select('lot_number')
          .like('lot_number', `${prefix}-${dateStr}-%`);

        const maxSeq = existingLots?.reduce((max, op) => {
          const match = op.lot_number?.match(/-(\d+)$/);
          return match ? Math.max(max, parseInt(match[1])) : max;
        }, 0) || 0;

        lotNumber = `${prefix}-${dateStr}-${String(maxSeq + 1).padStart(3, '0')}`;
        console.log(`[WARN] Using fallback LOT number: ${lotNumber}`);
      } else {
        lotNumber = lotResult as string;
        console.log(`[INFO] Generated LOT number: ${lotNumber}`);
      }
    } catch (error) {
      console.error('[ERROR] LOT number generation exception:', error);
      // Fallback: Generate LOT number manually
      const prefix = body.operation_type === 'BLANKING' ? 'BLK' :
                    body.operation_type === 'PRESS' ? 'PRS' :
                    body.operation_type === 'ASSEMBLY' ? 'ASM' : 'OTH';
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const timestamp = Date.now().toString().slice(-6);
      lotNumber = `${prefix}-${dateStr}-${timestamp}`;
      console.log(`[WARN] Using emergency fallback LOT number: ${lotNumber}`);
    }

    // Create operation with LOT number
    // Note: operator_id is integer in DB, but frontend may send string (operator name)
    // For now, we'll store operator name in notes if operator_id is not a valid integer
    let operatorId: number | null = null;
    if (body.operator_id) {
      const parsedId = typeof body.operator_id === 'string' 
        ? parseInt(body.operator_id, 10) 
        : body.operator_id;
      operatorId = isNaN(parsedId) ? null : parsedId;
    }

    const insertData: any = {
      operation_type: body.operation_type,
      input_item_id: body.input_item_id,
      output_item_id: body.output_item_id,
      input_quantity: body.input_quantity,
      output_quantity: body.output_quantity,
      efficiency,
      operator_id: operatorId,
      notes: body.notes || (typeof body.operator_id === 'string' && !operatorId 
        ? `작업자: ${body.operator_id}` 
        : null),
      status: 'PENDING',
      lot_number: lotNumber,
    };

    // Chain management fields (optional) - only include if provided
    if ((body as any).chain_id) insertData.chain_id = (body as any).chain_id;
    if ((body as any).chain_sequence) insertData.chain_sequence = (body as any).chain_sequence;
    if ((body as any).parent_operation_id) insertData.parent_operation_id = (body as any).parent_operation_id;
    if ((body as any).parent_lot_number) insertData.parent_lot_number = (body as any).parent_lot_number;
    if ((body as any).auto_next_operation !== undefined) insertData.auto_next_operation = (body as any).auto_next_operation;
    if ((body as any).next_operation_type) insertData.next_operation_type = (body as any).next_operation_type;

    console.log('[INFO] Inserting process operation:', JSON.stringify(insertData, null, 2));

    const { data: newOperation, error: createError } = await supabase
      .from('process_operations')
      .insert(insertData)
      .select(`
        *,
        input_item:items!input_item_id (
          item_id,
          item_name,
          item_code,
          current_stock,
          unit,
          spec
        ),
        output_item:items!output_item_id (
          item_id,
          item_name,
          item_code,
          current_stock,
          unit,
          spec
        )
      `)
      .single();

    if (createError) {
      console.error('[ERROR] Operation creation error:', createError);
      return handleSupabaseError('insert', 'process_operations', createError);
    }

    // ============================================================================
    // 코일 추적 이력 자동 생성 및 연결 (BLANKING 공정인 경우)
    // ============================================================================
    let coilProcessId: number | null = null;
    
    if (body.operation_type === 'BLANKING') {
      try {
        // 입력 품목이 코일인지 확인 (coil_specs 테이블에 존재하는지 확인)
        const { data: coilSpec, error: coilSpecError } = await supabase
          .from('coil_specs')
          .select('item_id')
          .eq('item_id', body.input_item_id)
          .single();

        // 코일인 경우에만 coil_process_history 생성
        if (!coilSpecError && coilSpec) {
          // process_type 매핑: BLANKING -> '블랭킹'
          const processType = '블랭킹';
          
          // 수율 계산
          const yieldRate = calculateEfficiency(body.input_quantity, body.output_quantity);

          // coil_process_history 생성
          const { data: coilProcess, error: coilProcessError } = await supabase
            .from('coil_process_history')
            .insert({
              source_item_id: body.input_item_id,
              target_item_id: body.output_item_id,
              process_type: processType,
              input_quantity: body.input_quantity,
              output_quantity: body.output_quantity,
              yield_rate: yieldRate,
              process_date: new Date().toISOString().split('T')[0],
              status: body.status || 'PENDING',
              operator_id: operatorId,
              notes: body.notes || null
            })
            .select('process_id')
            .single();

          if (!coilProcessError && coilProcess) {
            coilProcessId = coilProcess.process_id;
            console.log(`[INFO] Coil process history created: ${coilProcessId} for operation ${newOperation.operation_id}`);

            // process_operations에 coil_process_id 연결
            const { error: updateError } = await supabase
              .from('process_operations')
              .update({ coil_process_id: coilProcessId })
              .eq('operation_id', newOperation.operation_id);

            if (updateError) {
              console.error('[WARN] Failed to link coil_process_id:', updateError);
              // 연결 실패해도 공정 작업은 성공한 것으로 처리
            } else {
              console.log(`[INFO] Linked coil_process_id ${coilProcessId} to operation ${newOperation.operation_id}`);
            }
          } else {
            console.error('[WARN] Failed to create coil_process_history:', coilProcessError);
            // 코일 추적 이력 생성 실패해도 공정 작업은 성공한 것으로 처리
          }
        } else {
          console.log(`[INFO] Input item ${body.input_item_id} is not a coil, skipping coil_process_history creation`);
        }
      } catch (error) {
        console.error('[WARN] Error in coil process history creation:', error);
        // 에러가 발생해도 공정 작업은 성공한 것으로 처리
      }
    }

    // Transform response
    const operation: ProcessOperationWithItems = {
      operation_id: newOperation.operation_id,
      operation_type: newOperation.operation_type,
      input_item_id: newOperation.input_item_id,
      output_item_id: newOperation.output_item_id,
      input_quantity: parseFloat(newOperation.input_quantity),
      output_quantity: parseFloat(newOperation.output_quantity),
      efficiency: newOperation.efficiency ? parseFloat(newOperation.efficiency) : undefined,
      operator_id: newOperation.operator_id,
      started_at: newOperation.started_at,
      completed_at: newOperation.completed_at,
      status: newOperation.status,
      notes: newOperation.notes,
      created_at: newOperation.created_at,
      updated_at: newOperation.updated_at,
      // LOT tracking fields
      lot_number: newOperation.lot_number,
      parent_lot_number: newOperation.parent_lot_number,
      child_lot_number: newOperation.child_lot_number,
      // Chain management fields
      chain_id: newOperation.chain_id,
      chain_sequence: newOperation.chain_sequence,
      parent_operation_id: newOperation.parent_operation_id,
      auto_next_operation: newOperation.auto_next_operation,
      next_operation_type: newOperation.next_operation_type,
      // Quality control fields
      quality_status: newOperation.quality_status,
      scrap_quantity: newOperation.scrap_quantity ? parseFloat(newOperation.scrap_quantity) : undefined,
      scheduled_date: newOperation.scheduled_date,
      // Coil traceability link
      coil_process_id: coilProcessId || newOperation.coil_process_id || undefined,
      input_item: {
        item_id: newOperation.input_item.item_id,
        item_name: newOperation.input_item.item_name,
        item_code: newOperation.input_item.item_code,
        current_stock: parseFloat(newOperation.input_item.current_stock),
        unit: newOperation.input_item.unit,
        spec: newOperation.input_item.spec,
      },
      output_item: {
        item_id: newOperation.output_item.item_id,
        item_name: newOperation.output_item.item_name,
        item_code: newOperation.output_item.item_code,
        current_stock: parseFloat(newOperation.output_item.current_stock),
        unit: newOperation.output_item.unit,
        spec: newOperation.output_item.spec,
      },
    };

    console.log(`[INFO] Process operation created: ${operation.operation_id} (${operation.operation_type})`);

    return NextResponse.json(
      {
        success: true,
        data: operation,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[ERROR] Unexpected error in POST /api/process-operations:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '공정 작업을 생성하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
