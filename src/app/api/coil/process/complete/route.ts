import { NextRequest, NextResponse } from 'next/server';
import { createValidatedRoute } from '@/lib/validationMiddleware';
import { getSupabaseClient } from '@/lib/db-unified';
import type { CompleteCoilProcessRequest } from '@/types/coil';
import { canCompleteProcess, isValidProcessStatus, type ProcessStatus } from '@/types/coil';

export const dynamic = 'force-dynamic';

/**
 * POST /api/coil/process/complete
 *
 * 코일 공정 완료 처리
 * - 공정 상태를 'COMPLETED'로 변경
 * - 데이터베이스 트리거가 자동으로 재고 이동 처리:
 *   1. 소스 코일 품목에서 투입 수량만큼 출고 (생산출고)
 *   2. 타겟 품목에 산출 수량만큼 입고 (생산입고)
 *   3. 거래번호 형식: COIL-YYYYMMDD-{process_id}
 * - 완료 가능한 상태: PENDING, IN_PROGRESS만 가능
 */
export const POST = createValidatedRoute(
  async (request: NextRequest) => {
    try {
      // Korean UTF-8 support - CRITICAL PATTERN
      const text = await request.text();
      const body = JSON.parse(text) as CompleteCoilProcessRequest;

      // Validation
      if (!body.process_id) {
        return NextResponse.json(
          {
            success: false,
            error: '공정 ID는 필수입니다.'
          },
          { status: 400 }
        );
      }

      const supabase = getSupabaseClient();

      // Fetch existing process to verify it exists and check current status
      const { data: existingProcess, error: fetchError } = await supabase
        .from('coil_process_history')
        .select('*')
        .eq('process_id', body.process_id)
        .single();

      if (fetchError || !existingProcess) {
        console.error('Error fetching process:', fetchError);
        return NextResponse.json(
          {
            success: false,
            error: `공정(ID: ${body.process_id})을 찾을 수 없습니다.`
          },
          { status: 404 }
        );
      }

      // Check if process can be completed (must be PENDING or IN_PROGRESS)
      // Validate status type before calling canCompleteProcess
      if (!existingProcess.status || !isValidProcessStatus(existingProcess.status) || !canCompleteProcess(existingProcess.status as ProcessStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: `공정을 완료할 수 없습니다. 현재 상태: ${existingProcess.status}. 완료 가능한 상태: PENDING, IN_PROGRESS`
          },
          { status: 400 }
        );
      }

      // Update process status to COMPLETED
      // This triggers auto_coil_process_stock_movement() which:
      // 1. Creates 생산출고 transaction for source_item (negative quantity)
      // 2. Creates 생산입고 transaction for target_item (positive quantity)
      // 3. Updates current_stock on both items
      // 4. Transaction number: COIL-YYYYMMDD-{process_id}
      const { data: updatedProcess, error: updateError } = await supabase
        .from('coil_process_history')
        .update({ status: 'COMPLETED' })
        .eq('process_id', body.process_id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Error completing process:', updateError);
        return NextResponse.json(
          {
            success: false,
            error: `공정 완료 실패: ${updateError.message}`
          },
          { status: 500 }
        );
      }

      // Return success with updated process
      // Note: The trigger has already created inventory transactions and updated stock levels
      return NextResponse.json({
        success: true,
        data: updatedProcess,
        message: '공정이 완료되었습니다. 재고가 자동으로 조정되었습니다.'
      });

    } catch (error) {
      console.error('Error in POST /api/coil/process/complete:', error);
      return NextResponse.json(
        {
          success: false,
          error: `공정 완료 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        { status: 500 }
      );
    }
  },
  { resource: 'coil_process', action: 'update', requireAuth: false }
);
