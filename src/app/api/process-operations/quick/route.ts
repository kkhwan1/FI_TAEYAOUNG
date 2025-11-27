/**
 * Quick Process Operation API
 * 
 * 간편 공정 등록: 공정 작업을 생성하고 즉시 완료 처리하여 재고를 자동으로 이동시킵니다.
 * 
 * POST /api/process-operations/quick
 * 
 * Body: {
 *   operation_type: 'BLANKING' | 'PRESS' | 'ASSEMBLY',
 *   input_item_id: number,
 *   output_item_id: number,
 *   input_quantity: number,
 *   output_quantity: number,
 *   operator_id?: number,
 *   notes?: string
 * }
 * 
 * @author Claude (Backend System Architect)
 * @date 2025-01-21
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { calculateEfficiency } from '@/types/process';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // Parse request body with proper UTF-8 handling
    const text = await request.text();
    const body = JSON.parse(text);

    const {
      operation_type,
      input_item_id,
      output_item_id,
      input_quantity,
      output_quantity,
      operator_id,
      notes
    } = body;

    // Validation
    if (!operation_type || !['BLANKING', 'PRESS', 'ASSEMBLY'].includes(operation_type)) {
      return NextResponse.json(
        {
          success: false,
          error: '유효하지 않은 공정 유형입니다. (BLANKING, PRESS, ASSEMBLY 중 선택)',
        },
        { status: 400 }
      );
    }

    if (!input_item_id || !output_item_id) {
      return NextResponse.json(
        {
          success: false,
          error: '투입 품목과 산출 품목을 모두 지정해야 합니다.',
        },
        { status: 400 }
      );
    }

    if (input_item_id === output_item_id) {
      return NextResponse.json(
        {
          success: false,
          error: '투입 품목과 산출 품목이 동일할 수 없습니다.',
        },
        { status: 400 }
      );
    }

    if (!input_quantity || input_quantity <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: '투입 수량은 0보다 커야 합니다.',
        },
        { status: 400 }
      );
    }

    if (!output_quantity || output_quantity <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: '산출 수량은 0보다 커야 합니다.',
        },
        { status: 400 }
      );
    }

    // Check if items exist and get current stock
    const { data: inputItem, error: inputError } = await supabase
      .from('items')
      .select('item_id, item_name, item_code, current_stock, unit')
      .eq('item_id', input_item_id)
      .single();

    if (inputError || !inputItem) {
      return NextResponse.json(
        {
          success: false,
          error: `투입 품목(ID: ${input_item_id})을 찾을 수 없습니다.`,
        },
        { status: 404 }
      );
    }

    const { data: outputItem, error: outputError } = await supabase
      .from('items')
      .select('item_id, item_name, item_code, current_stock, unit')
      .eq('item_id', output_item_id)
      .single();

    if (outputError || !outputItem) {
      return NextResponse.json(
        {
          success: false,
          error: `산출 품목(ID: ${output_item_id})을 찾을 수 없습니다.`,
        },
        { status: 404 }
      );
    }

    // Check stock availability for input item
    const currentStock = parseFloat(String(inputItem.current_stock || '0'));
    if (currentStock < input_quantity) {
      return NextResponse.json(
        {
          success: false,
          error: `투입 품목 "${inputItem.item_name}"의 재고가 부족합니다. (필요: ${input_quantity}, 현재: ${currentStock})`,
        },
        { status: 400 }
      );
    }

    // Auto-calculate efficiency
    const efficiency = calculateEfficiency(input_quantity, output_quantity);

    // Generate LOT number
    let lotNumber: string;
    try {
      const { data: lotResult, error: lotError } = await supabase
        .rpc('generate_lot_number', {
          p_operation_type: operation_type,
          p_item_id: output_item_id
        });

      if (lotError) {
        // Fallback: Generate LOT number manually
        const prefix = operation_type === 'BLANKING' ? 'BLK' :
                      operation_type === 'PRESS' ? 'PRS' :
                      operation_type === 'ASSEMBLY' ? 'ASM' : 'OTH';
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

        const { data: existingLots } = await supabase
          .from('process_operations')
          .select('lot_number')
          .like('lot_number', `${prefix}-${dateStr}-%`);

        const maxSeq = existingLots?.reduce((max, op) => {
          const match = op.lot_number?.match(/-(\d+)$/);
          return match ? Math.max(max, parseInt(match[1])) : max;
        }, 0) || 0;

        lotNumber = `${prefix}-${dateStr}-${String(maxSeq + 1).padStart(3, '0')}`;
      } else {
        lotNumber = lotResult as string;
      }
    } catch (error) {
      // Emergency fallback
      const prefix = operation_type === 'BLANKING' ? 'BLK' :
                    operation_type === 'PRESS' ? 'PRS' :
                    operation_type === 'ASSEMBLY' ? 'ASM' : 'OTH';
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const timestamp = Date.now().toString().slice(-6);
      lotNumber = `${prefix}-${dateStr}-${timestamp}`;
    }

    // Parse operator_id
    let operatorId: number | null = null;
    if (operator_id) {
      const parsedId = typeof operator_id === 'string' 
        ? parseInt(operator_id, 10) 
        : operator_id;
      operatorId = isNaN(parsedId) ? null : parsedId;
    }

    // Step 1: Create operation with COMPLETED status directly
    // This will trigger the auto_process_stock_movement() function automatically
    const now = new Date().toISOString();
    const insertData: any = {
      operation_type,
      input_item_id,
      output_item_id,
      input_quantity,
      output_quantity,
      efficiency,
      operator_id: operatorId,
      notes: notes || (typeof operator_id === 'string' && !operatorId 
        ? `작업자: ${operator_id}` 
        : null),
      status: 'COMPLETED', // 바로 완료 상태로 생성
      lot_number: lotNumber,
      started_at: now,
      completed_at: now, // 완료 시간도 바로 설정
    };

    console.log('[INFO] Creating quick process operation (auto-complete):', JSON.stringify(insertData, null, 2));

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
      console.error('[ERROR] Quick operation creation error:', createError);
      return NextResponse.json(
        {
          success: false,
          error: `공정 등록 실패: ${createError.message}`,
        },
        { status: 500 }
      );
    }

    // ============================================================================
    // 코일 추적 이력 자동 생성 및 연결 (BLANKING 공정인 경우)
    // ============================================================================
    let coilProcessId: number | null = null;
    
    if (operation_type === 'BLANKING') {
      try {
        // 입력 품목이 코일인지 확인 (coil_specs 테이블에 존재하는지 확인)
        const { data: coilSpec, error: coilSpecError } = await supabase
          .from('coil_specs')
          .select('item_id')
          .eq('item_id', input_item_id)
          .single();

        // 코일인 경우에만 coil_process_history 생성
        if (!coilSpecError && coilSpec) {
          // process_type 매핑: BLANKING -> '블랭킹'
          const processType = '블랭킹';
          
          // coil_process_history 생성
          const { data: coilProcess, error: coilProcessError } = await supabase
            .from('coil_process_history')
            .insert({
              source_item_id: input_item_id,
              target_item_id: output_item_id,
              process_type: processType,
              input_quantity: input_quantity,
              output_quantity: output_quantity,
              yield_rate: efficiency,
              process_date: new Date().toISOString().split('T')[0],
              status: 'COMPLETED', // 간편 등록은 바로 완료 상태
              operator_id: operatorId,
              notes: notes || null
            })
            .select('process_id')
            .single();

          if (!coilProcessError && coilProcess) {
            coilProcessId = coilProcess.process_id;
            console.log(`[INFO] Coil process history created: ${coilProcessId} for quick operation ${newOperation.operation_id}`);

            // process_operations에 coil_process_id 연결
            const { error: updateError } = await supabase
              .from('process_operations')
              .update({ coil_process_id: coilProcessId })
              .eq('operation_id', newOperation.operation_id);

            if (updateError) {
              console.error('[WARN] Failed to link coil_process_id:', updateError);
              // 연결 실패해도 공정 작업은 성공한 것으로 처리
            } else {
              console.log(`[INFO] Linked coil_process_id ${coilProcessId} to quick operation ${newOperation.operation_id}`);
            }
          } else {
            console.error('[WARN] Failed to create coil_process_history:', coilProcessError);
            // 코일 추적 이력 생성 실패해도 공정 작업은 성공한 것으로 처리
          }
        } else {
          console.log(`[INFO] Input item ${input_item_id} is not a coil, skipping coil_process_history creation`);
        }
      } catch (error) {
        console.error('[WARN] Error in coil process history creation:', error);
        // 에러가 발생해도 공정 작업은 성공한 것으로 처리
      }
    }

    // Step 2: Get stock history created by trigger
    const { data: stockHistory } = await supabase
      .from('stock_history')
      .select('*')
      .eq('reference_type', 'process_operation')
      .eq('reference_id', newOperation.operation_id)
      .order('created_at', { ascending: false });

    // Step 3: Get updated item stocks
    const { data: updatedInputItem } = await supabase
      .from('items')
      .select('item_code, item_name, current_stock, unit')
      .eq('item_id', input_item_id)
      .single();

    const { data: updatedOutputItem } = await supabase
      .from('items')
      .select('item_code, item_name, current_stock, unit')
      .eq('item_id', output_item_id)
      .single();

    return NextResponse.json({
      success: true,
      message: `공정이 등록되고 재고가 자동으로 이동되었습니다. (LOT: ${lotNumber})`,
      data: {
        operation: newOperation,
        stock_movements: stockHistory || [],
        current_stocks: {
          input: updatedInputItem,
          output: updatedOutputItem
        },
        efficiency: efficiency,
        lot_number: lotNumber,
        coil_process_id: coilProcessId || undefined
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('[ERROR] Unexpected error in POST /api/process-operations/quick:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '간편 공정 등록 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

