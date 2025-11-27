/**
 * Average Efficiency API
 * 
 * 과거 공정 작업의 평균 수율을 조회하여 산출수량 자동 계산에 활용
 * 
 * GET /api/process-operations/average-efficiency
 * 
 * Query Parameters:
 * - input_item_id: number (필수)
 * - output_item_id: number (필수)
 * - operation_type?: 'BLANKING' | 'PRESS' | 'ASSEMBLY'
 * - operator_id?: number (선택사항)
 * - days?: number (기간, 기본값: 30일)
 * 
 * @author Claude (Backend System Architect)
 * @date 2025-01-21
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);

    const input_item_id = searchParams.get('input_item_id');
    const output_item_id = searchParams.get('output_item_id');
    const operation_type = searchParams.get('operation_type');
    const operator_id = searchParams.get('operator_id');
    const days = parseInt(searchParams.get('days') || '30');

    // Validation
    if (!input_item_id || !output_item_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'input_item_id와 output_item_id는 필수입니다.',
        },
        { status: 400 }
      );
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build query
    let query = supabase
      .from('process_operations')
      .select('efficiency, input_quantity, output_quantity')
      .eq('input_item_id', parseInt(input_item_id))
      .eq('output_item_id', parseInt(output_item_id))
      .eq('status', 'COMPLETED')
      .gte('completed_at', startDate.toISOString())
      .lte('completed_at', endDate.toISOString());

    // Apply optional filters
    if (operation_type) {
      query = query.eq('operation_type', operation_type);
    }

    if (operator_id) {
      query = query.eq('operator_id', parseInt(operator_id));
    }

    const { data: operations, error } = await query;

    if (error) {
      console.error('[Average Efficiency] Query error:', error);
      return NextResponse.json(
        {
          success: false,
          error: `수율 조회 실패: ${error.message}`,
        },
        { status: 500 }
      );
    }

    if (!operations || operations.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          average_efficiency: null,
          sample_count: 0,
          message: '과거 작업 이력이 없습니다.',
        },
      });
    }

    // Calculate statistics
    const efficiencies = operations
      .filter(op => op.efficiency != null && op.efficiency > 0)
      .map(op => parseFloat(String(op.efficiency)));

    if (efficiencies.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          average_efficiency: null,
          sample_count: 0,
          message: '유효한 수율 데이터가 없습니다.',
        },
      });
    }

    const averageEfficiency = efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length;
    const minEfficiency = Math.min(...efficiencies);
    const maxEfficiency = Math.max(...efficiencies);

    // Calculate standard deviation
    const variance = efficiencies.reduce((sum, eff) => sum + Math.pow(eff - averageEfficiency, 2), 0) / efficiencies.length;
    const stdDev = Math.sqrt(variance);

    return NextResponse.json({
      success: true,
      data: {
        average_efficiency: Math.round(averageEfficiency * 100) / 100,
        sample_count: efficiencies.length,
        min_efficiency: Math.round(minEfficiency * 100) / 100,
        max_efficiency: Math.round(maxEfficiency * 100) / 100,
        std_deviation: Math.round(stdDev * 100) / 100,
        period_days: days,
      },
    });
  } catch (error: any) {
    console.error('[Average Efficiency] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '평균 수율 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

