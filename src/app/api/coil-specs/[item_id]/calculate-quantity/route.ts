/**
 * Coil Quantity Calculator API
 * 
 * 코일 스펙 기반 투입수량 자동 계산
 * 
 * GET /api/coil-specs/[item_id]/calculate-quantity
 * 
 * Query Parameters:
 * - total_weight?: number (코일 총 중량, kg)
 * - target_quantity?: number (목표 수량)
 * 
 * @author Claude (Backend System Architect)
 * @date 2025-01-21
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ item_id: string }> }
) {
  try {
    const supabase = getSupabaseClient();
    const { item_id } = await params;
    const { searchParams } = new URL(request.url);

    const total_weight = searchParams.get('total_weight') ? parseFloat(searchParams.get('total_weight')!) : null;
    const target_quantity = searchParams.get('target_quantity') ? parseInt(searchParams.get('target_quantity')!) : null;

    // Get coil specs
    const { data: coilSpecs, error: specError } = await supabase
      .from('coil_specs')
      .select('*')
      .eq('item_id', parseInt(item_id))
      .single();

    if (specError || !coilSpecs) {
      return NextResponse.json(
        {
          success: false,
          error: `코일 스펙을 찾을 수 없습니다. (품목 ID: ${item_id})`,
        },
        { status: 404 }
      );
    }

    // Get current stock (assumed to be in weight unit for coils)
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('current_stock, unit')
      .eq('item_id', parseInt(item_id))
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        {
          success: false,
          error: `품목을 찾을 수 없습니다. (품목 ID: ${item_id})`,
        },
        { status: 404 }
      );
    }

    const weightPerPiece = Number(coilSpecs.weight_per_piece) || 0;
    
    if (weightPerPiece <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'EA중량이 0보다 커야 합니다. 코일 스펙을 확인해주세요.',
        },
        { status: 400 }
      );
    }

    // Calculate quantities
    let maxQuantity = 0;
    let suggestedInputQuantity = 0;
    let remainingWeight = 0;

    if (total_weight) {
      // 총 중량 기반 계산
      maxQuantity = Math.floor(total_weight / weightPerPiece);
      suggestedInputQuantity = maxQuantity;
      remainingWeight = total_weight - (maxQuantity * weightPerPiece);
    } else if (target_quantity) {
      // 목표 수량 기반 계산
      suggestedInputQuantity = target_quantity;
      const requiredWeight = target_quantity * weightPerPiece;
      remainingWeight = (item.current_stock || 0) - requiredWeight;
    } else {
      // 현재 재고 기반 계산 (재고가 중량 단위라고 가정)
      const currentStock = item.current_stock || 0;
      maxQuantity = Math.floor(currentStock / weightPerPiece);
      suggestedInputQuantity = maxQuantity;
      remainingWeight = currentStock - (maxQuantity * weightPerPiece);
    }

    return NextResponse.json({
      success: true,
      data: {
        item_id: parseInt(item_id),
        weight_per_piece: weightPerPiece,
        current_stock: item.current_stock || 0,
        unit: item.unit,
        max_quantity: maxQuantity,
        suggested_input_quantity: suggestedInputQuantity,
        remaining_weight: Math.round(remainingWeight * 100) / 100,
        calculation_basis: total_weight ? 'total_weight' : target_quantity ? 'target_quantity' : 'current_stock',
      },
    });
  } catch (error: any) {
    console.error('[Coil Quantity Calculator] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '수량 계산 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

