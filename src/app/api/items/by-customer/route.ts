import { NextRequest, NextResponse } from 'next/server';
import { mcp__supabase__execute_sql } from '@/lib/supabase-mcp';

export const dynamic = 'force-dynamic';

/**
 * GET /api/items/by-customer
 * Get items associated with a customer (parent items from BOM)
 * Query parameters:
 * - customer_id: Customer company ID (required)
 * - limit: Number of records to return (default: 1000)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customer_id');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!customerId) {
      return NextResponse.json({
        success: false,
        error: '고객 ID가 필요합니다.'
      }, { status: 400 });
    }

    // customerId 숫자 검증 (SQL injection 방지)
    const customerIdNum = parseInt(customerId);
    if (isNaN(customerIdNum) || customerIdNum <= 0) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 고객 ID입니다.'
      }, { status: 400 });
    }

    // limit과 offset 검증
    const validLimit = Math.max(1, Math.min(limit, 10000)); // 1~10000 사이로 제한
    const validOffset = Math.max(0, offset);

    // Supabase 프로젝트 ID 가져오기
    const projectId = process.env.SUPABASE_PROJECT_ID || 'pybjnkbmtlyaftuiieyq';
    
    // 직접 SQL 쿼리로 BOM과 items를 JOIN하여 조회
    const sqlQuery = `
      SELECT DISTINCT
        i.item_id,
        i.item_code,
        i.item_name,
        i.spec,
        i.unit,
        i.price,
        i.category,
        i.inventory_type,
        i.vehicle_model,
        i.is_active
      FROM bom b
      INNER JOIN items i ON b.parent_item_id = i.item_id
      WHERE b.customer_id = ${customerIdNum}
        AND b.is_active = true
        AND i.is_active = true
      ORDER BY i.item_code
      LIMIT ${validLimit}
      OFFSET ${validOffset}
    `;

    console.log(`[Items by Customer API] customer_id: ${customerId}, SQL 쿼리 실행`);
    
    let items: any[] = [];
    try {
      const result = await mcp__supabase__execute_sql({
        project_id: projectId,
        query: sqlQuery
      });

      console.log(`[Items by Customer API] mcp__supabase__execute_sql 결과:`, JSON.stringify(result, null, 2));
      console.log(`[Items by Customer API] result.rows 타입:`, typeof result.rows);
      console.log(`[Items by Customer API] result.rows가 배열인가?:`, Array.isArray(result.rows));
      console.log(`[Items by Customer API] result.rows 길이:`, result.rows?.length || 0);

      if (result.error) {
        console.error('[Items by Customer API] SQL query error:', result.error);
        return NextResponse.json({
          success: false,
          error: `BOM 조회 오류: ${result.error}`
        }, { status: 500 });
      }

      const rows = result.rows || [];
      console.log(`[Items by Customer API] SQL 쿼리 결과: ${rows.length}개 품목 조회됨`);
      
      // 디버깅: 첫 번째 행의 원본 데이터 확인
      if (rows.length > 0) {
        console.log('[Items by Customer API] 첫 번째 행 원본 데이터:', JSON.stringify(rows[0], null, 2));
        console.log('[Items by Customer API] 첫 번째 행의 필드명들:', Object.keys(rows[0]));
      } else {
        console.log('[Items by Customer API] rows가 비어있습니다. result:', JSON.stringify(result, null, 2));
      }

      // SQL 결과를 기존 변환 로직과 동일하게 처리
      items = rows.map((row: any) => {
        // price가 문자열일 수 있으므로 숫자로 변환
        const priceValue = typeof row.price === 'string' 
          ? parseFloat(row.price) || 0 
          : (row.price || 0);

        // 디버깅: 원본 데이터 확인
        if (!row.item_id) {
          console.error('[Items by Customer API] item_id가 없는 데이터:', JSON.stringify(row, null, 2));
        }
        if (!row.item_code && !row.item_name) {
          console.warn('[Items by Customer API] item_code와 item_name이 모두 비어있는 데이터:', JSON.stringify(row, null, 2));
        }

        // item_id가 없으면 건너뛰기
        if (!row.item_id) {
          return null;
        }

        return {
          item_id: row.item_id,
          item_code: row.item_code || '',
          item_name: row.item_name || '',
          spec: row.spec || null,
          unit: row.unit || 'EA',
          price: priceValue,
          unit_price: priceValue, // ItemSelect에서 사용하는 필드
          category: row.category || null,
          inventory_type: row.inventory_type || null,
          vehicle_model: row.vehicle_model || null,
          is_active: row.is_active !== false,
          source: 'bom' // BOM에서 조회된 품목임을 표시
        };
      }).filter((item: any) => item !== null); // null 항목 제거

      if (rows.length === 0) {
        console.warn(`[Items by Customer API] customer_id=${customerId}에 대한 BOM 데이터가 없습니다.`);
      }
    } catch (error: any) {
      console.error('[Items by Customer API] SQL 실행 오류:', error);
      return NextResponse.json({
        success: false,
        error: `BOM 조회 중 오류가 발생했습니다: ${error.message || 'Unknown error'}`
      }, { status: 500 });
    }

    // SQL 쿼리에서 이미 정렬되어 있지만, 안전을 위해 다시 정렬
    items.sort((a, b) => {
      const codeA = a.item_code || '';
      const codeB = b.item_code || '';
      return codeA.localeCompare(codeB, 'ko');
    });

    // 디버깅: 로그 추가
    console.log(`[Items by Customer API] customer_id: ${customerId}, Final items: ${items.length}`);

    return NextResponse.json({
      success: true,
      data: {
        items,
        total: items.length,
        customer_id: parseInt(customerId)
      }
    });
  } catch (error: any) {
    console.error('[Items by Customer API] Error:', error);
    return NextResponse.json({
      success: false,
      error: `고객별 품목 조회 중 오류가 발생했습니다: ${error.message || 'Unknown error'}`
    }, { status: 500 });
  }
}

