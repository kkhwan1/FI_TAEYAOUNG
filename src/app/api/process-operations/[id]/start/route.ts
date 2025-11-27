/**
 * Process Operations Start API
 *
 * Endpoint: POST /api/process-operations/[id]/start
 * Purpose: Start a process operation (PENDING → IN_PROGRESS)
 *
 * @author Claude (Backend System Architect)
 * @date 2025-02-04
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';
import type {
  ProcessOperationWithItems,
  OperationType,
  OperationStatus,
} from '@/types/process';
import { validateStatusTransition } from '@/types/process';

export const dynamic = 'force-dynamic';


// ============================================================================
// POST - Start Process Operation (PENDING → IN_PROGRESS)
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const operationId = parseInt(params.id);

    if (isNaN(operationId)) {
      return NextResponse.json(
        {
          success: false,
          error: '유효하지 않은 작업 ID입니다.',
        },
        { status: 400 }
      );
    }

    // Get current operation
    const { data: currentOp, error: fetchError } = await supabase
      .from('process_operations')
      .select('*')
      .eq('operation_id', operationId)
      .single();

    if (fetchError || !currentOp) {
      return NextResponse.json(
        {
          success: false,
          error: `작업 ID ${operationId}를 찾을 수 없습니다.`,
        },
        { status: 404 }
      );
    }

    // Validate current status is PENDING
    if (currentOp.status !== 'PENDING') {
      return NextResponse.json(
        {
          success: false,
          error: `작업을 시작할 수 없습니다. 현재 상태: ${currentOp.status}`,
        },
        { status: 400 }
      );
    }

    // Validate status transition
    const validation = validateStatusTransition(currentOp.status as OperationStatus, 'IN_PROGRESS');
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error_message,
        },
        { status: 400 }
      );
    }

    // Update operation to IN_PROGRESS
    const { data: updatedOp, error: updateError } = await supabase
      .from('process_operations')
      .update({
        status: 'IN_PROGRESS',
        started_at: new Date().toISOString(),
      })
      .eq('operation_id', operationId)
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

    if (updateError) {
      console.error('[ERROR] Operation start error:', updateError);
      return handleSupabaseError('update', 'process_operations', updateError);
    }

    // Transform response
    const operation: ProcessOperationWithItems = {
      operation_id: updatedOp.operation_id,
      operation_type: updatedOp.operation_type as OperationType,
      input_item_id: updatedOp.input_item_id,
      output_item_id: updatedOp.output_item_id,
      input_quantity: Number(updatedOp.input_quantity),
      output_quantity: Number(updatedOp.output_quantity),
      efficiency: updatedOp.efficiency ? Number(updatedOp.efficiency) : undefined,
      operator_id: updatedOp.operator_id ?? undefined,
      started_at: updatedOp.started_at ?? undefined,
      completed_at: updatedOp.completed_at ?? undefined,
      status: updatedOp.status as OperationStatus,
      notes: updatedOp.notes ?? undefined,
      created_at: updatedOp.created_at,
      updated_at: updatedOp.updated_at,
      // LOT tracking fields
      lot_number: updatedOp.lot_number ?? undefined,
      parent_lot_number: updatedOp.parent_lot_number ?? undefined,
      child_lot_number: updatedOp.child_lot_number ?? undefined,
      // Chain management fields
      chain_id: updatedOp.chain_id ?? undefined,
      chain_sequence: updatedOp.chain_sequence ?? undefined,
      parent_operation_id: updatedOp.parent_operation_id ?? undefined,
      auto_next_operation: updatedOp.auto_next_operation ?? undefined,
      next_operation_type: updatedOp.next_operation_type ?? undefined,
      // Quality control fields
      quality_status: updatedOp.quality_status ?? undefined,
      scrap_quantity: updatedOp.scrap_quantity ? Number(updatedOp.scrap_quantity) : undefined,
      scheduled_date: updatedOp.scheduled_date ?? undefined,
      input_item: {
        item_id: updatedOp.input_item.item_id,
        item_name: updatedOp.input_item.item_name,
        item_code: updatedOp.input_item.item_code,
        current_stock: Number(updatedOp.input_item.current_stock),
        unit: updatedOp.input_item.unit ?? undefined,
        spec: updatedOp.input_item.spec ?? undefined,
      },
      output_item: {
        item_id: updatedOp.output_item.item_id,
        item_name: updatedOp.output_item.item_name,
        item_code: updatedOp.output_item.item_code,
        current_stock: Number(updatedOp.output_item.current_stock),
        unit: updatedOp.output_item.unit ?? undefined,
        spec: updatedOp.output_item.spec ?? undefined,
      },
    };

    console.log(`[INFO] Process operation started: ${operation.operation_id} (${operation.operation_type})`);

    return createSuccessResponse(operation);
  } catch (error) {
    console.error('[ERROR] Unexpected error in POST /api/process-operations/[id]/start:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '공정 작업을 시작하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
