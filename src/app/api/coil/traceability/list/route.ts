import { NextRequest, NextResponse } from 'next/server';
import { createValidatedRoute } from '@/lib/validationMiddleware';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';

/**
 * 공정 추적성 일괄 조회 API
 *
 * GET /api/coil/traceability/list
 *
 * 코일 공정 이력 일괄 조회 및 통계
 * - 날짜 범위, 상태, 공정 유형별 필터링
 * - 페이지네이션 지원
 * - 요약 통계 포함 (총 건수, 상태별 건수, 투입/산출 수량, 평균 수율)
 *
 * Query Parameters:
 * - start_date: 시작일 (YYYY-MM-DD) - 선택사항
 * - end_date: 종료일 (YYYY-MM-DD) - 선택사항
 * - status: 상태 필터 (all, pending, in_progress, completed) - 기본값: all
 * - process_type: 공정 유형 필터 - 선택사항
 * - page: 페이지 번호 - 기본값: 1
 * - limit: 페이지당 항목 수 - 기본값: 50
 * - sort_by: 정렬 기준 - 기본값: process_date
 * - sort_order: 정렬 방향 (asc, desc) - 기본값: desc
 */

interface ProcessHistoryItem {
  process_id: number;
  process_type: string;
  source_item_id: number;
  target_item_id: number;
  input_quantity: number;
  output_quantity: number;
  yield_rate: number | null;
  process_date: string;
  status: string;
  created_at: string;
  source_item?: {
    item_code: string;
    item_name: string;
  };
  target_item?: {
    item_code: string;
    item_name: string;
  };
  process_operation?: {
    operation_id: number;
    lot_number: string;
    chain_id: string | null;
    chain_sequence: number | null;
  } | null;
}

interface ProcessHistorySummary {
  total_count: number;
  pending_count: number;
  in_progress_count: number;
  completed_count: number;
  total_input_quantity: number;
  total_output_quantity: number;
  average_yield_rate: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total_pages: number;
  total_count: number;
}

export const GET = createValidatedRoute(
  async (request: NextRequest) => {
    try {
      const searchParams = request.nextUrl.searchParams;

      // Query Parameters 추출
      const startDate = searchParams.get('start_date');
      const endDate = searchParams.get('end_date');
      const status = searchParams.get('status') || 'all';
      const processType = searchParams.get('process_type');
      const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
      const sortBy = searchParams.get('sort_by') || 'process_date';
      const sortOrder = searchParams.get('sort_order') || 'desc';

      const supabase = getSupabaseClient();

      // 1. 총 개수 및 요약 통계를 위한 기본 필터 쿼리 구성
      // 요약 통계는 필터와 관계없이 전체 데이터 기준으로 계산
      let summaryQuery = supabase
        .from('coil_process_history')
        .select('process_id, status, input_quantity, output_quantity, yield_rate', { count: 'exact' });

      // 요약 통계용 필터 (날짜, 공정 유형만 적용, 상태 필터는 제외)
      if (startDate) {
        summaryQuery = summaryQuery.gte('process_date', startDate);
      }
      if (endDate) {
        summaryQuery = summaryQuery.lte('process_date', endDate);
      }
      if (processType) {
        summaryQuery = summaryQuery.eq('process_type', processType);
      }

      const { data: allDataForSummary, count: totalCount, error: countError } = await summaryQuery;

      // 데이터 조회용 쿼리 (모든 필터 적용)
      let countQuery = supabase
        .from('coil_process_history')
        .select('process_id', { count: 'exact' });

      if (startDate) {
        countQuery = countQuery.gte('process_date', startDate);
      }
      if (endDate) {
        countQuery = countQuery.lte('process_date', endDate);
      }
      if (processType) {
        countQuery = countQuery.eq('process_type', processType);
      }
      if (status && status !== 'all') {
        countQuery = countQuery.eq('status', status);
      }

      const { count: filteredCount, error: filteredCountError } = await countQuery;

      if (countError || filteredCountError) {
        console.error('Error fetching count:', countError || filteredCountError);
        return NextResponse.json(
          {
            success: false,
            error: `통계 조회 실패: ${(countError || filteredCountError)?.message}`
          },
          { status: 500 }
        );
      }

      // 2. 요약 통계 계산 (필터와 관계없이 전체 데이터 기준)
      const summary: ProcessHistorySummary = {
        total_count: totalCount || 0,
        pending_count: 0,
        in_progress_count: 0,
        completed_count: 0,
        total_input_quantity: 0,
        total_output_quantity: 0,
        average_yield_rate: 0
      };

      if (allDataForSummary && allDataForSummary.length > 0) {
        let totalYieldRate = 0;
        let yieldRateCount = 0;

        allDataForSummary.forEach((item: any) => {
          // 상태별 카운트 (대소문자 구분 없이 비교)
          const itemStatus = (item.status || '').toLowerCase();
          if (itemStatus === 'pending' || itemStatus === '대기') {
            summary.pending_count++;
          } else if (itemStatus === 'in_progress' || itemStatus === '진행중' || itemStatus === 'inprogress') {
            summary.in_progress_count++;
          } else if (itemStatus === 'completed' || itemStatus === '완료') {
            summary.completed_count++;
          }

          // 수량 합계
          summary.total_input_quantity += item.input_quantity || 0;
          summary.total_output_quantity += item.output_quantity || 0;

          // 수율 평균 계산용
          if (item.yield_rate !== null && item.yield_rate !== undefined) {
            totalYieldRate += item.yield_rate;
            yieldRateCount++;
          }
        });

        // 평균 수율 계산
        summary.average_yield_rate = yieldRateCount > 0
          ? Math.round((totalYieldRate / yieldRateCount) * 100) / 100
          : 0;
      }

      // 3. 페이지네이션 정보 계산 (필터링된 데이터 기준)
      const totalPages = Math.ceil((filteredCount || 0) / limit);
      const offset = (page - 1) * limit;

      const pagination: PaginationInfo = {
        page,
        limit,
        total_pages: totalPages,
        total_count: filteredCount || 0
      };

      // 4. 실제 데이터 조회 (JOIN 포함)
      // 정렬 기준 유효성 검사
      const validSortColumns = ['process_date', 'process_id', 'process_type', 'status', 'input_quantity', 'output_quantity', 'yield_rate', 'created_at'];
      const actualSortBy = validSortColumns.includes(sortBy) ? sortBy : 'process_date';
      const ascending = sortOrder.toLowerCase() === 'asc';

      let dataQuery = supabase
        .from('coil_process_history')
        .select(`
          process_id,
          process_type,
          source_item_id,
          target_item_id,
          input_quantity,
          output_quantity,
          yield_rate,
          process_date,
          status,
          created_at,
          source_item:items!coil_process_history_source_item_id_fkey(
            item_code,
            item_name
          ),
          target_item:items!coil_process_history_target_item_id_fkey(
            item_code,
            item_name
          ),
          process_operation:process_operations!coil_process_id(
            operation_id,
            lot_number,
            chain_id,
            chain_sequence
          )
        `);

      // 필터 적용 (dataQuery)
      if (startDate) {
        dataQuery = dataQuery.gte('process_date', startDate);
      }
      if (endDate) {
        dataQuery = dataQuery.lte('process_date', endDate);
      }
      if (processType) {
        dataQuery = dataQuery.eq('process_type', processType);
      }
      if (status && status !== 'all') {
        // 상태 필터: 대소문자 구분 없이 비교
        // 데이터베이스의 상태 값이 'COMPLETED', 'PENDING', 'IN_PROGRESS' 등일 수 있으므로
        // ilike를 사용하거나 여러 값을 OR로 검색
        const statusUpper = status.toUpperCase();
        if (statusUpper === 'COMPLETED' || statusUpper === '완료') {
          dataQuery = dataQuery.or('status.eq.completed,status.eq.COMPLETED,status.ilike.%완료%');
        } else if (statusUpper === 'PENDING' || statusUpper === '대기') {
          dataQuery = dataQuery.or('status.eq.pending,status.eq.PENDING,status.ilike.%대기%');
        } else if (statusUpper === 'IN_PROGRESS' || statusUpper === '진행중') {
          dataQuery = dataQuery.or('status.eq.in_progress,status.eq.IN_PROGRESS,status.ilike.%진행중%');
        } else {
          dataQuery = dataQuery.ilike('status', `%${status}%`);
        }
      }

      // 정렬 및 페이지네이션
      dataQuery = dataQuery
        .order(actualSortBy, { ascending })
        .range(offset, offset + limit - 1);

      const { data: processHistory, error: dataError } = await dataQuery;

      if (dataError) {
        console.error('Error fetching process history:', dataError);
        return NextResponse.json(
          {
            success: false,
            error: `공정 이력 조회 실패: ${dataError.message}`
          },
          { status: 500 }
        );
      }

      // 5. 응답 데이터 변환
      const items: ProcessHistoryItem[] = (processHistory || []).map((p: any) => ({
        process_id: p.process_id,
        process_type: p.process_type,
        source_item_id: p.source_item_id,
        target_item_id: p.target_item_id,
        input_quantity: p.input_quantity,
        output_quantity: p.output_quantity,
        yield_rate: p.yield_rate,
        process_date: p.process_date,
        status: p.status,
        created_at: p.created_at,
        source_item: p.source_item ? {
          item_code: p.source_item.item_code || '',
          item_name: p.source_item.item_name || ''
        } : undefined,
        target_item: p.target_item ? {
          item_code: p.target_item.item_code || '',
          item_name: p.target_item.item_name || ''
        } : undefined,
        process_operation: p.process_operation ? {
          operation_id: p.process_operation.operation_id,
          lot_number: p.process_operation.lot_number || '',
          chain_id: p.process_operation.chain_id,
          chain_sequence: p.process_operation.chain_sequence
        } : null
      }));

      return NextResponse.json({
        success: true,
        data: {
          items,
          summary,
          pagination
        },
        message: `공정 이력 ${pagination.total_count}건 중 ${items.length}건을 조회했습니다.`
      });

    } catch (error) {
      console.error('Error in GET /api/coil/traceability/list:', error);
      return NextResponse.json(
        {
          success: false,
          error: `공정 이력 조회 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        { status: 500 }
      );
    }
  },
  { resource: 'coil_process', action: 'read', requireAuth: false }
);
