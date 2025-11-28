import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';

interface BOMBulkEntry {
  parent_item_id: number;
  child_item_id: number;
  quantity_required: number;
  level_no?: number;
  notes?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  index: number;
}

/**
 * POST /api/bom/bulk
 * 대량 BOM 등록 엔드포인트
 * Body: {
 *   entries: BOMBulkEntry[]
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // CRITICAL: Use request.text() + JSON.parse() for proper Korean encoding
    const text = await request.text();
    const body = JSON.parse(text);

    const { entries } = body as { entries: BOMBulkEntry[] };

    // 기본 유효성 검사
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({
        success: false,
        error: '등록할 BOM 항목이 없습니다.'
      }, { status: 400 });
    }

    if (entries.length > 100) {
      return NextResponse.json({
        success: false,
        error: '한 번에 최대 100개 항목까지 등록할 수 있습니다.'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 1단계: 모든 항목에 대한 유효성 검사
    const validationResults: ValidationResult[] = [];
    const validEntries: BOMBulkEntry[] = [];

    // 필요한 item_id들을 수집하여 일괄 조회 (N+1 방지)
    const allItemIds = new Set<number>();
    entries.forEach(entry => {
      allItemIds.add(entry.parent_item_id);
      allItemIds.add(entry.child_item_id);
    });

    // 모든 품목 정보 일괄 조회
    const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select('item_id, item_name, is_active')
      .in('item_id', Array.from(allItemIds));

    if (itemsError) {
      return NextResponse.json({
        success: false,
        error: '품목 정보 조회에 실패했습니다.'
      }, { status: 500 });
    }

    const itemsMap = new Map(
      (itemsData || []).map(item => [item.item_id, item])
    );

    // 중복 입력 허용: 같은 품목 조합도 여러 번 입력 가능

    // 순환 참조 허용: 모든 순환 참조(자기 참조 포함)를 허용함
    async function hasCircularReference(
      parentId: number,
      childId: number,
      visited: Set<number> = new Set()
    ): Promise<boolean> {
      // 항상 false를 반환하여 순환 참조 검사를 비활성화
      return false;
    }

    // 각 항목 유효성 검사
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const errors: string[] = [];

      // 필수 필드 검사
      if (!entry.parent_item_id) {
        errors.push('모품목을 선택해주세요');
      }
      if (!entry.child_item_id) {
        errors.push('자품목을 선택해주세요');
      }
      if (!entry.quantity_required || entry.quantity_required <= 0) {
        errors.push('소요량은 0보다 커야 합니다');
      }

      // 자기 참조 허용: 모품목과 자품목이 같을 수 있음

      // 품목 존재 및 활성 상태 검사
      const parentItem = itemsMap.get(entry.parent_item_id);
      const childItem = itemsMap.get(entry.child_item_id);

      if (!parentItem) {
        errors.push('모품목을 찾을 수 없습니다');
      } else if (!parentItem.is_active) {
        errors.push('비활성화된 모품목입니다');
      }

      if (!childItem) {
        errors.push('자품목을 찾을 수 없습니다');
      } else if (!childItem.is_active) {
        errors.push('비활성화된 자품목입니다');
      }

      // 중복 입력 허용: 같은 품목 조합도 여러 번 입력 가능

      // 순환 참조 허용: 모든 순환 참조(자기 참조 포함)를 허용함

      validationResults.push({
        valid: errors.length === 0,
        errors,
        index: i
      });

      if (errors.length === 0) {
        validEntries.push({
          ...entry,
          level_no: entry.level_no || 1
        });
      }
    }

    // 모든 항목이 유효하지 않으면 에러 반환
    const invalidEntries = validationResults.filter(r => !r.valid);
    if (invalidEntries.length === entries.length) {
      return NextResponse.json({
        success: false,
        error: '모든 항목에 유효성 오류가 있습니다.',
        validation_errors: invalidEntries.map(r => ({
          index: r.index + 1,
          errors: r.errors
        }))
      }, { status: 400 });
    }

    // 2단계: 유효한 항목만 일괄 삽입
    const insertData = validEntries.map(entry => ({
      parent_item_id: entry.parent_item_id,
      child_item_id: entry.child_item_id,
      quantity_required: entry.quantity_required,
      level_no: entry.level_no || 1,
      is_active: true,
      notes: entry.notes || null
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from('bom')
      .insert(insertData)
      .select();

    if (insertError) {
      console.error('BOM bulk insert failed:', insertError);
      return NextResponse.json({
        success: false,
        error: `BOM 대량 등록에 실패했습니다: ${insertError.message}`
      }, { status: 500 });
    }

    // 3단계: 결과 반환
    const successCount = insertedData?.length || 0;
    const failCount = invalidEntries.length;

    return NextResponse.json({
      success: true,
      message: `${successCount}개 항목이 등록되었습니다.${failCount > 0 ? ` (${failCount}개 실패)` : ''}`,
      data: {
        inserted: insertedData,
        success_count: successCount,
        fail_count: failCount,
        validation_errors: failCount > 0 ? invalidEntries.map(r => ({
          index: r.index + 1,
          errors: r.errors
        })) : []
      }
    });

  } catch (error: any) {
    console.error('Error in bulk BOM insert:', error);
    return NextResponse.json({
      success: false,
      error: `BOM 대량 등록 중 오류가 발생했습니다: ${error.message || 'Unknown error'}`
    }, { status: 500 });
  }
}
