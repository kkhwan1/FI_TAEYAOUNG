/**
 * Stock History Export API - Export stock history data to Excel
 * GET /api/stock-history/export
 *
 * Query parameters:
 * - item_id: Filter by item ID (required)
 * - movement_type: Filter by movement type (optional)
 * - company_id: Filter by company (optional)
 * - start_date: Filter by start date (optional)
 * - end_date: Filter by end date (optional)
 *
 * Returns Excel file with three sheets:
 * 1. 내보내기 정보 (Export metadata)
 * 2. 재고 이력 (Stock history data)
 * 3. 통계 (Summary statistics)
 *
 * Response: Excel file download with Korean headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface StockHistoryRow {
  history_id: number;
  item_id: number;
  movement_type: 'RECEIVING' | 'SHIPPING' | 'PRODUCTION' | 'ADJUSTMENT';
  quantity_change: number;
  stock_quantity: number;
  reference_type: string;
  reference_id: number;
  created_at: string;
  company_id?: number | null;
  company_name?: string | null;
  company_code?: string | null;
  item_code?: string;
  item_name?: string;
}

interface ExportOptions {
  itemId: number;
  movementType?: string;
  companyId?: number;
  startDate?: string;
  endDate?: string;
}

interface MovementTypeSummary {
  movement_type: string;
  total_increase: number;
  total_decrease: number;
  transaction_count: number;
}

interface CompanySummary {
  company_code: string;
  company_name: string;
  total_increase: number;
  total_decrease: number;
  transaction_count: number;
}

// ============================================================================
// MOVEMENT TYPE MAPPING
// ============================================================================

const MOVEMENT_TYPE_MAP: Record<string, string> = {
  'RECEIVING': '입고',
  'SHIPPING': '출고',
  'PRODUCTION': '생산',
  'ADJUSTMENT': '조정'
};

// ============================================================================
// EXCEL GENERATION
// ============================================================================

/**
 * Generate Excel file with stock history data
 * Returns buffer ready for download
 */
function exportStockHistoryToExcel(
  historyData: StockHistoryRow[],
  options: ExportOptions
): Buffer {
  const workbook = XLSX.utils.book_new();

  // ========================================================================
  // Sheet 1: 내보내기 정보 (Export Metadata)
  // ========================================================================
  const now = new Date();
  const filterInfo: string[] = [];

  if (options.movementType) {
    filterInfo.push(`유형: ${MOVEMENT_TYPE_MAP[options.movementType] || options.movementType}`);
  }
  if (options.companyId) {
    filterInfo.push(`거래처 ID: ${options.companyId}`);
  }
  if (options.startDate) {
    filterInfo.push(`시작일: ${options.startDate}`);
  }
  if (options.endDate) {
    filterInfo.push(`종료일: ${options.endDate}`);
  }

  const metadataSheet = XLSX.utils.aoa_to_sheet([
    ['재고 이력 내보내기 정보', ''],
    ['내보낸 날짜', now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })],
    ['품목 ID', options.itemId],
    ['품목 코드', historyData[0]?.item_code || '-'],
    ['품목명', historyData[0]?.item_name || '-'],
    ['총 레코드 수', historyData.length],
    ['필터 조건', filterInfo.length > 0 ? filterInfo.join(', ') : '전체'],
    ['', ''],
    ['시스템 정보', ''],
    ['시스템명', '태창 ERP 시스템'],
    ['버전', '1.0.0'],
    ['내보내기 형식', 'Excel (XLSX)']
  ]);

  XLSX.utils.book_append_sheet(workbook, metadataSheet, '내보내기 정보');

  // ========================================================================
  // Sheet 2: 재고 이력 (Stock History Data)
  // ========================================================================

  // Prepare data with Korean headers
  const koreanData = historyData.map(row => ({
    '이력 ID': row.history_id,
    '날짜': new Date(row.created_at).toLocaleString('ko-KR'),
    '유형': MOVEMENT_TYPE_MAP[row.movement_type] || row.movement_type,
    '거래처 코드': row.company_code || '미지정',
    '거래처 명': row.company_name || '미지정 거래처',
    '참조 유형': row.reference_type || '-',
    '참조 ID': row.reference_id || '-',
    '수량 변화': row.quantity_change,
    '재고 수량': row.stock_quantity
  }));

  const dataSheet = XLSX.utils.json_to_sheet(koreanData);

  // Set column widths
  dataSheet['!cols'] = [
    { wch: 10 }, // 이력 ID
    { wch: 20 }, // 날짜
    { wch: 12 }, // 유형
    { wch: 15 }, // 거래처 코드
    { wch: 25 }, // 거래처 명
    { wch: 15 }, // 참조 유형
    { wch: 12 }, // 참조 ID
    { wch: 12 }, // 수량 변화
    { wch: 12 }  // 재고 수량
  ];

  XLSX.utils.book_append_sheet(workbook, dataSheet, '재고 이력');

  // ========================================================================
  // Sheet 3: 통계 (Summary Statistics)
  // ========================================================================

  // Calculate movement type statistics
  const movementStats = historyData.reduce((acc, row) => {
    const type = row.movement_type;
    if (!acc[type]) {
      acc[type] = {
        movement_type: MOVEMENT_TYPE_MAP[type] || type,
        total_increase: 0,
        total_decrease: 0,
        transaction_count: 0
      };
    }

    if (row.quantity_change > 0) {
      acc[type].total_increase += row.quantity_change;
    } else {
      acc[type].total_decrease += Math.abs(row.quantity_change);
    }
    acc[type].transaction_count += 1;

    return acc;
  }, {} as Record<string, MovementTypeSummary>);

  // Calculate company statistics (only for non-null companies)
  const companyStats = historyData
    .filter(row => row.company_id && row.company_code && row.company_name)
    .reduce((acc, row) => {
      const key = `${row.company_code}|${row.company_name}`;
      if (!acc[key]) {
        acc[key] = {
          company_code: row.company_code!,
          company_name: row.company_name!,
          total_increase: 0,
          total_decrease: 0,
          transaction_count: 0
        };
      }

      if (row.quantity_change > 0) {
        acc[key].total_increase += row.quantity_change;
      } else {
        acc[key].total_decrease += Math.abs(row.quantity_change);
      }
      acc[key].transaction_count += 1;

      return acc;
    }, {} as Record<string, CompanySummary>);

  // Overall statistics
  const totalIncrease = historyData
    .filter(row => row.quantity_change > 0)
    .reduce((sum, row) => sum + row.quantity_change, 0);

  const totalDecrease = historyData
    .filter(row => row.quantity_change < 0)
    .reduce((sum, row) => sum + Math.abs(row.quantity_change), 0);

  const statsData = [
    ['통계 요약', ''],
    ['항목', '값'],
    ['총 거래 건수', historyData.length],
    ['총 입고 수량', totalIncrease.toLocaleString('ko-KR')],
    ['총 출고 수량', totalDecrease.toLocaleString('ko-KR')],
    ['순 변화량', (totalIncrease - totalDecrease).toLocaleString('ko-KR')],
    ['', ''],
    ['유형별 통계', ''],
    ['유형', '입고 수량', '출고 수량', '거래 건수']
  ];

  // Add movement type statistics
  Object.values(movementStats).forEach((stat: MovementTypeSummary) => {
    statsData.push([
      stat.movement_type,
      stat.total_increase.toLocaleString('ko-KR'),
      stat.total_decrease.toLocaleString('ko-KR'),
      stat.transaction_count
    ]);
  });

  // Add company statistics if available
  if (Object.keys(companyStats).length > 0) {
    statsData.push(['', '']);
    statsData.push(['거래처별 통계', '']);
    statsData.push(['거래처 코드', '거래처 명', '입고 수량', '출고 수량', '거래 건수']);

    Object.values(companyStats).forEach((stat: CompanySummary) => {
      statsData.push([
        stat.company_code,
        stat.company_name,
        stat.total_increase.toLocaleString('ko-KR'),
        stat.total_decrease.toLocaleString('ko-KR'),
        stat.transaction_count
      ]);
    });
  }

  const statsSheet = XLSX.utils.aoa_to_sheet(statsData);

  // Set column widths for stats
  statsSheet['!cols'] = [
    { wch: 20 },
    { wch: 25 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 }
  ];

  XLSX.utils.book_append_sheet(workbook, statsSheet, '통계');

  // ========================================================================
  // Generate buffer
  // ========================================================================
  const excelBuffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true
  });

  return excelBuffer;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const itemId = searchParams.get('item_id');
    const movementType = searchParams.get('movement_type');
    const companyId = searchParams.get('company_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!itemId) {
      return NextResponse.json(
        {
          success: false,
          error: '품목 ID가 필요합니다'
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Build query
    // Type assertion needed because v_stock_history is a view not in the generated types
    let query = supabase
      .from('v_stock_history' as any)
      .select('*')
      .eq('item_id', parseInt(itemId))
      .order('created_at', { ascending: false });

    // Apply filters
    if (movementType && movementType !== 'ALL') {
      query = query.eq('movement_type', movementType);
    }

    if (companyId && companyId !== 'ALL') {
      query = query.eq('company_id', parseInt(companyId));
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: historyData, error } = await query;

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json(
        {
          success: false,
          error: '재고 이력 조회 실패',
          details: error.message
        },
        { status: 500 }
      );
    }

    if (!historyData || historyData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '내보낼 재고 이력이 없습니다',
          details: '필터 조건을 확인해주세요'
        },
        { status: 404 }
      );
    }

    // Generate Excel file
    // Type assertion needed because data from view may have different shape than typed interface
    const excelBuffer = exportStockHistoryToExcel(
      historyData as unknown as StockHistoryRow[],
      {
        itemId: parseInt(itemId),
        movementType: movementType || undefined,
        companyId: companyId ? parseInt(companyId) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      }
    );

    // Generate filename with timestamp and item info
    const timestamp = new Date().toISOString().split('T')[0];
    // Use optional chaining and type guard for item_code
    const itemCode = (historyData[0] as any)?.item_code || itemId;
    const filename = `재고_이력_${itemCode}_${timestamp}.xlsx`;

    // Return as downloadable file with proper headers
    return new NextResponse(Buffer.from(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': excelBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Stock history export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '재고 이력 내보내기 실패',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}
