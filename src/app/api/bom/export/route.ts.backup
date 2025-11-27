/**
 * BOM Export API - Export BOM data to Excel
 * GET /api/bom/export
 *
 * Query parameters:
 * - parent_item_id: Filter by parent item (optional)
 * - include_inactive: Include inactive BOM entries (default: false)
 * - include_cost_analysis: Include cost calculations (default: true)
 *
 * Returns Excel file with multiple sheets:
 * 1. BOM 구조 (BOM structure data) - 업로드 가능한 형식
 * 2. 내보내기 정보 (Export metadata) - 참고용
 * 3. 원가 분석 (Cost analysis - if included) - 참고용
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

interface BOMDetailRow {
  bom_id: number;
  parent_item_id: number;
  parent_code: string;
  parent_name: string;
  child_item_id: number;
  child_code: string;
  child_name: string;
  item_type: string;
  quantity_required: number;
  level_no: number;
  purchase_unit_price?: number;
  weight_per_piece?: number;
  production_unit_price?: number;
  effective_unit_price: number;
  component_cost: number;
  scrap_revenue_per_piece?: number;
  net_cost: number;
  created_at: string;
  updated_at: string;
  // Added by transformation
  is_active?: boolean;
  // Parent item details
  parent_spec?: string;
  parent_unit?: string;
  parent_category?: string;
  parent_inventory_type?: string;
  parent_car_model?: string;
  parent_location?: string;
  // Child item details
  child_spec?: string;
  child_unit?: string;
  child_category?: string;
  child_inventory_type?: string;
  child_car_model?: string;
  child_location?: string;
  // Supplier information (parent)
  parent_supplier_name?: string;
  parent_supplier_code?: string;
  parent_supplier_phone?: string;
  parent_supplier_email?: string;
  parent_supplier_address?: string;
  parent_supplier_type?: string;
  parent_supplier_business_number?: string;
  parent_supplier_representative?: string;
  // Supplier information (child)
  child_supplier_name?: string;
  child_supplier_code?: string;
  child_supplier_phone?: string;
  child_supplier_email?: string;
  child_supplier_address?: string;
  child_supplier_type?: string;
  child_supplier_business_number?: string;
  child_supplier_representative?: string;
  // Monthly price information (parent)
  parent_price_month?: string;
  parent_unit_price?: number;
  parent_price_per_kg?: number;
  parent_price_note?: string;
  // Monthly price information (child)
  child_price_month?: string;
  child_unit_price?: number;
  child_price_per_kg?: number;
  child_price_note?: string;
}

interface ExportOptions {
  includeInactive: boolean;
  includeCostAnalysis: boolean;
  filterByParentId?: number;
  includeMasterData?: boolean; // 전체 기준정보 포함 여부
}

interface ParentCostSummary {
  parent_code: string;
  parent_name: string;
  total_material_cost: number;
  total_scrap_revenue: number;
  total_net_cost: number;
  child_count: number;
}

// ============================================================================
// EXCEL GENERATION
// ============================================================================

/**
 * Generate Excel file with BOM data
 * Returns buffer ready for download
 */
async function exportBOMToExcel(
  bomData: BOMDetailRow[],
  options: ExportOptions,
  supabase?: any,
  priceMonth?: string
): Promise<Buffer> {
  const workbook = XLSX.utils.book_new();

  // ========================================================================
  // 내보내기 정보 (Export Metadata) - 두 번째 시트로 추가됨
  // ========================================================================
  const now = new Date();
  const metadataSheet = XLSX.utils.aoa_to_sheet([
    ['BOM 내보내기 정보', ''],
    ['내보낸 날짜', now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })],
    ['총 레코드 수', bomData.length],
    ['비활성 항목 포함', options.includeInactive ? '예' : '아니오'],
    ['원가 분석 포함', options.includeCostAnalysis ? '예' : '아니오'],
    ['필터 조건', options.filterByParentId ? `부모 품목 ID: ${options.filterByParentId}` : '전체'],
    ['', ''],
    ['시스템 정보', ''],
    ['시스템명', '태창 ERP 시스템'],
    ['버전', '1.0.0'],
    ['내보내기 형식', 'Excel (XLSX)']
  ]);

  // ========================================================================
  // Sheet 1: BOM 구조 (BOM Structure Data) - 업로드 가능한 형식
  // ========================================================================

  // Prepare data with Korean headers (업로드 API와 호환되는 형식)
  const koreanData = bomData.map(row => ({
    // 'BOM ID'는 업로드 시 불필요하므로 제거 (업로드 가능하도록)
    // 모품목 상세 정보
    '모품목코드': row.parent_code,
    '모품목명': row.parent_name,
    '모품목규격': row.parent_spec || '',
    '모품목단위': row.parent_unit || '',
    '모품목카테고리': row.parent_category || '',
    '모품목재고타입': row.parent_inventory_type || '',
    '모품목차종': row.parent_car_model || '',
    '모품목위치': row.parent_location || '',
    // 자품목 상세 정보
    '자품목코드': row.child_code,
    '자품목명': row.child_name,
    '자품목규격': row.child_spec || '',
    '자품목단위': row.child_unit || '',
    '자품목카테고리': row.child_category || '',
    '자품목재고타입': row.child_inventory_type || '',
    '자품목차종': row.child_car_model || '',
    '자품목위치': row.child_location || '',
    // BOM 관계 정보
    '소요량': row.quantity_required,
    '레벨': row.level_no,
    '비고': row.notes || '', // 실제 notes 값 사용 (업로드 호환)
    // 거래처 정보 (모품목 공급사)
    '모품목공급사명': row.parent_supplier_name || '',
    '모품목공급사코드': row.parent_supplier_code || '',
    '모품목공급사사업자번호': row.parent_supplier_business_number || '',
    '모품목공급사대표자': row.parent_supplier_representative || '',
    '모품목공급사전화번호': row.parent_supplier_phone || '',
    '모품목공급사이메일': row.parent_supplier_email || '',
    '모품목공급사주소': row.parent_supplier_address || '',
    '모품목공급사타입': row.parent_supplier_type || '',
    // 거래처 정보 (자품목 공급사)
    '자품목공급사명': row.child_supplier_name || '',
    '자품목공급사코드': row.child_supplier_code || '',
    '자품목공급사사업자번호': row.child_supplier_business_number || '',
    '자품목공급사대표자': row.child_supplier_representative || '',
    '자품목공급사전화번호': row.child_supplier_phone || '',
    '자품목공급사이메일': row.child_supplier_email || '',
    '자품목공급사주소': row.child_supplier_address || '',
    '자품목공급사타입': row.child_supplier_type || '',
    '활성 상태': row.is_active ? '활성' : '비활성',
    // Monthly price information (parent)
    '모품목단가월': row.parent_price_month || '',
    '모품목단가': row.parent_unit_price || 0,
    '모품목KG단가': row.parent_price_per_kg || 0,
    '모품목단가비고': row.parent_price_note || '',
    // Monthly price information (child)
    '자품목단가월': row.child_price_month || '',
    '자품목단가': row.child_unit_price || 0,
    '자품목KG단가': row.child_price_per_kg || 0,
    '자품목단가비고': row.child_price_note || '',
    // Cost analysis fields (if included)
    ...(options.includeCostAnalysis && {
      '단품 원가': row.component_cost || 0,
      '스크랩 수익': row.scrap_revenue_per_piece || 0,
      '순원가': row.net_cost || 0,
      '구매 단가': row.purchase_unit_price || 0,
      'EA 중량': row.weight_per_piece || 0,
      '생산 단가': row.production_unit_price || 0
    })
  }));

  const dataSheet = XLSX.utils.json_to_sheet(koreanData);

  // Set column widths
  const columnWidths = [
    { wch: 10 }, // BOM ID
    // 모품목 상세 정보
    { wch: 15 }, // 모품목코드
    { wch: 25 }, // 모품목명
    { wch: 20 }, // 모품목규격
    { wch: 8 },  // 모품목단위
    { wch: 15 }, // 모품목카테고리
    { wch: 12 }, // 모품목재고타입
    { wch: 12 }, // 모품목차종
    { wch: 15 }, // 모품목위치
    // 자품목 상세 정보
    { wch: 15 }, // 자품목코드
    { wch: 25 }, // 자품목명
    { wch: 20 }, // 자품목규격
    { wch: 8 },  // 자품목단위
    { wch: 15 }, // 자품목카테고리
    { wch: 12 }, // 자품목재고타입
    { wch: 12 }, // 자품목차종
    { wch: 15 }, // 자품목위치
    // BOM 관계 정보
    { wch: 10 }, // 소요량
    { wch: 6 },  // 레벨
    { wch: 20 }, // 비고
    { wch: 10 }, // 활성 상태
    // 거래처 정보 (모품목 공급사)
    { wch: 20 }, // 모품목공급사명
    { wch: 15 }, // 모품목공급사코드
    { wch: 18 }, // 모품목공급사사업자번호
    { wch: 12 }, // 모품목공급사대표자
    { wch: 15 }, // 모품목공급사전화번호
    { wch: 25 }, // 모품목공급사이메일
    { wch: 30 }, // 모품목공급사주소
    { wch: 12 }, // 모품목공급사타입
    // 거래처 정보 (자품목 공급사)
    { wch: 20 }, // 자품목공급사명
    { wch: 15 }, // 자품목공급사코드
    { wch: 18 }, // 자품목공급사사업자번호
    { wch: 12 }, // 자품목공급사대표자
    { wch: 15 }, // 자품목공급사전화번호
    { wch: 25 }, // 자품목공급사이메일
      { wch: 30 }, // 자품목공급사주소
      { wch: 12 }, // 자품목공급사타입
      // Monthly price information (parent)
      { wch: 12 }, // 모품목단가월
      { wch: 12 }, // 모품목단가
      { wch: 12 }, // 모품목KG단가
      { wch: 20 }, // 모품목단가비고
      // Monthly price information (child)
      { wch: 12 }, // 자품목단가월
      { wch: 12 }, // 자품목단가
      { wch: 12 }, // 자품목KG단가
      { wch: 20 }  // 자품목단가비고
  ];

  if (options.includeCostAnalysis) {
    columnWidths.push(
      { wch: 12 }, // 단품 원가
      { wch: 12 }, // 스크랩 수익
      { wch: 12 }, // 순원가
      { wch: 12 }, // 구매 단가
      { wch: 12 }, // EA 중량
      { wch: 12 }  // 생산 단가
    );
  }

  dataSheet['!cols'] = columnWidths;

  // 첫 번째 시트로 BOM 구조 데이터 추가 (업로드 가능하도록)
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'BOM 구조');
  
  // 두 번째 시트로 내보내기 정보 추가 (참고용)
  XLSX.utils.book_append_sheet(workbook, metadataSheet, '내보내기 정보');

  // ========================================================================
  // Sheet 3: 원가 분석 (Cost Analysis - if included)
  // ========================================================================
  if (options.includeCostAnalysis) {
    // Aggregate cost statistics
    const totalMaterialCost = bomData.reduce((sum, row) => sum + (row.component_cost || 0), 0);
    const totalScrapRevenue = bomData.reduce((sum, row) => sum + (row.scrap_revenue_per_piece || 0), 0);
    const totalNetCost = bomData.reduce((sum, row) => sum + (row.net_cost || 0), 0);
    const coilItemCount = bomData.filter(row => row.weight_per_piece).length;
    const purchasedItemCount = bomData.filter(row => row.purchase_unit_price).length;

    // Group by parent item
    const parentGroups = bomData.reduce((acc, row) => {
      const key = `${row.parent_code}|${row.parent_name}`;
      if (!acc[key]) {
        acc[key] = {
          parent_code: row.parent_code,
          parent_name: row.parent_name,
          total_material_cost: 0,
          total_scrap_revenue: 0,
          total_net_cost: 0,
          child_count: 0
        };
      }
      acc[key].total_material_cost += row.component_cost || 0;
      acc[key].total_scrap_revenue += row.scrap_revenue_per_piece || 0;
      acc[key].total_net_cost += row.net_cost || 0;
      acc[key].child_count += 1;
      return acc;
    }, {} as Record<string, ParentCostSummary>);

    const costAnalysisData = [
      ['원가 분석 요약', ''],
      ['항목', '금액 (원)'],
      ['총 재료비', totalMaterialCost.toLocaleString('ko-KR')],
      ['총 스크랩 수익', totalScrapRevenue.toLocaleString('ko-KR')],
      ['총 순원가', totalNetCost.toLocaleString('ko-KR')],
      ['', ''],
      ['항목별 통계', ''],
      ['코일 사용 품목 수', coilItemCount],
      ['구매 품목 수', purchasedItemCount],
      ['총 BOM 항목 수', bomData.length],
      ['', ''],
      ['부모 품목별 원가', ''],
      ['부모 품목 코드', '부모 품목명', '재료비', '스크랩 수익', '순원가', '자식 품목 수']
    ];

    // Add parent group details
    Object.values(parentGroups).forEach((group: ParentCostSummary) => {
      costAnalysisData.push([
        group.parent_code,
        group.parent_name,
        group.total_material_cost.toLocaleString('ko-KR'),
        group.total_scrap_revenue.toLocaleString('ko-KR'),
        group.total_net_cost.toLocaleString('ko-KR'),
        group.child_count
      ]);
    });

    const costSheet = XLSX.utils.aoa_to_sheet(costAnalysisData);

    // Set column widths for cost analysis
    costSheet['!cols'] = [
      { wch: 20 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(workbook, costSheet, '원가 분석');
  }

  // ========================================================================
  // Sheet 4-6: 전체 기준정보 (Master Data) - includeMasterData가 true일 때만
  // ========================================================================
  if (options.includeMasterData && supabase) {
    // Sheet 4: 전체 품목 목록
    const { data: allItems, error: itemsError } = await supabase
      .from('items')
      .select(`
        item_id,
        item_code,
        item_name,
        spec,
        unit,
        category,
        inventory_type,
        vehicle_model,
        location,
        supplier_id,
        supplier:companies!items_supplier_id_fkey (
          company_id,
          company_name,
          company_code,
          business_number,
          representative,
          phone,
          email,
          address,
          company_type
        )
      `)
      .eq('is_active', true)
      .order('item_code', { ascending: true });

    if (!itemsError && allItems) {
      const itemsData = allItems.map((item: any) => ({
        '품목코드': item.item_code,
        '품목명': item.item_name || '',
        '규격': item.spec || '',
        '단위': item.unit || '',
        '카테고리': item.category || '',
        '재고타입': item.inventory_type || '',
        '차종': item.vehicle_model || '',
        '위치': item.location || '',
        '공급사명': item.supplier?.company_name || '',
        '공급사코드': item.supplier?.company_code || '',
        '공급사사업자번호': item.supplier?.business_number || '',
        '공급사대표자': item.supplier?.representative || '',
        '공급사전화번호': item.supplier?.phone || '',
        '공급사이메일': item.supplier?.email || '',
        '공급사주소': item.supplier?.address || '',
        '공급사타입': item.supplier?.company_type || ''
      }));

      const itemsSheet = XLSX.utils.json_to_sheet(itemsData);
      itemsSheet['!cols'] = [
        { wch: 15 }, // 품목코드
        { wch: 25 }, // 품목명
        { wch: 20 }, // 규격
        { wch: 8 },  // 단위
        { wch: 15 }, // 카테고리
        { wch: 12 }, // 재고타입
        { wch: 12 }, // 차종
        { wch: 15 }, // 위치
        { wch: 20 }, // 공급사명
        { wch: 15 }, // 공급사코드
        { wch: 18 }, // 공급사사업자번호
        { wch: 12 }, // 공급사대표자
        { wch: 15 }, // 공급사전화번호
        { wch: 25 }, // 공급사이메일
        { wch: 30 }, // 공급사주소
        { wch: 12 }  // 공급사타입
      ];
      XLSX.utils.book_append_sheet(workbook, itemsSheet, '전체 품목');
    }

    // Sheet 5: 전체 거래처 목록
    const { data: allCompanies, error: companiesError } = await supabase
      .from('companies')
      .select(`
        company_id,
        company_code,
        company_name,
        company_type,
        business_number,
        representative,
        phone,
        email,
        address
      `)
      .eq('is_active', true)
      .order('company_code', { ascending: true });

    if (!companiesError && allCompanies) {
      const companiesData = allCompanies.map((company: any) => ({
        '거래처코드': company.company_code || '',
        '거래처명': company.company_name || '',
        '거래처타입': company.company_type || '',
        '사업자번호': company.business_number || '',
        '대표자': company.representative || '',
        '전화번호': company.phone || '',
        '이메일': company.email || '',
        '주소': company.address || ''
      }));

      const companiesSheet = XLSX.utils.json_to_sheet(companiesData);
      companiesSheet['!cols'] = [
        { wch: 15 }, // 거래처코드
        { wch: 25 }, // 거래처명
        { wch: 12 }, // 거래처타입
        { wch: 18 }, // 사업자번호
        { wch: 12 }, // 대표자
        { wch: 15 }, // 전화번호
        { wch: 25 }, // 이메일
        { wch: 30 }  // 주소
      ];
      XLSX.utils.book_append_sheet(workbook, companiesSheet, '전체 거래처');
    }

    // Sheet 6: 전체 월별단가 정보 (priceMonth가 있을 때만)
    if (priceMonth) {
      const priceMonthDate = `${priceMonth}-01`;
      const { data: allPriceHistory, error: priceError } = await supabase
        .from('item_price_history')
        .select(`
          item_id,
          price_month,
          unit_price,
          price_per_kg,
          note,
          item:items!item_price_history_item_id_fkey (
            item_code,
            item_name
          )
        `)
        .eq('price_month', priceMonthDate)
        .order('item_code', { ascending: true });

      if (!priceError && allPriceHistory) {
        const priceData = allPriceHistory.map((ph: any) => ({
          '품목코드': ph.item?.item_code || '',
          '품목명': ph.item?.item_name || '',
          '단가월': priceMonth,
          '단가': ph.unit_price || 0,
          'KG단가': ph.price_per_kg || 0,
          '비고': ph.note || ''
        }));

        const priceSheet = XLSX.utils.json_to_sheet(priceData);
        priceSheet['!cols'] = [
          { wch: 15 }, // 품목코드
          { wch: 25 }, // 품목명
          { wch: 12 }, // 단가월
          { wch: 12 }, // 단가
          { wch: 12 }, // KG단가
          { wch: 20 }  // 비고
        ];
        XLSX.utils.book_append_sheet(workbook, priceSheet, '월별단가');
      }
    }
  }

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
    const parentItemId = searchParams.get('parent_item_id');
    const includeInactive = searchParams.get('include_inactive') === 'true';
    const includeCostAnalysis = searchParams.get('include_cost_analysis') !== 'false'; // Default true
    const includeMasterData = searchParams.get('include_master_data') === 'true'; // 전체 기준정보 포함 여부
    const priceMonth = searchParams.get('price_month'); // 월별단가 기준 월 (YYYY-MM 형식)

    const supabase = getSupabaseClient();

    // Build query from v_bom_details view for cost calculations
    let query = supabase
      .from('v_bom_details')
      .select('*')
      .order('parent_code', { ascending: true })
      .order('level_no', { ascending: true })
      .order('child_code', { ascending: true });

    // Apply filters
    if (parentItemId) {
      query = query.eq('parent_item_id', parseInt(parentItemId));
    }

    // NOTE: Cannot filter by is_active in v_bom_details view (column doesn't exist)
    // Will transform and filter after query

    const { data: bomData, error } = await query;

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'BOM 데이터 조회 실패',
          details: error.message
        },
        { status: 500 }
      );
    }

    // CRITICAL FIX: Transform data to include is_active field
    // v_bom_details view doesn't have is_active column, so we add it with default true
    let transformedData = (bomData || []).map((item: any) => ({
      ...item,
      is_active: item.is_active !== undefined ? item.is_active : true
    } as BOMDetailRow));

    // Apply is_active filter if includeInactive is false
    let filteredData = includeInactive
      ? transformedData
      : transformedData.filter(item => item.is_active);

    // Fetch supplier information for parent and child items
    const parentItemIds = [...new Set(filteredData.map(row => row.parent_item_id))];
    const childItemIds = [...new Set(filteredData.map(row => row.child_item_id))];
    const allItemIds = [...new Set([...parentItemIds, ...childItemIds])];

    // Fetch items with supplier information and detailed item info
    const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select(`
        item_id,
        item_code,
        item_name,
        spec,
        unit,
        category,
        inventory_type,
        vehicle_model,
        location,
        supplier_id,
        supplier:companies!items_supplier_id_fkey (
          company_id,
          company_name,
          company_code,
          business_number,
          representative,
          phone,
          email,
          address,
          company_type
        )
      `)
      .in('item_id', allItemIds);

    if (itemsError) {
      console.error('Failed to fetch supplier information:', itemsError);
      // Continue without supplier info if fetch fails
    }

    // Create item_id -> item details mapping
    const itemDetailsMap = new Map<number, {
      spec?: string;
      unit?: string;
      category?: string;
      inventory_type?: string;
      vehicle_model?: string;
      location?: string;
      supplier?: {
        company_name?: string;
        company_code?: string;
        business_number?: string;
        representative?: string;
        phone?: string;
        email?: string;
        address?: string;
        company_type?: string;
      };
    }>();

    if (itemsData) {
      itemsData.forEach((item: any) => {
        itemDetailsMap.set(item.item_id, {
          spec: item.spec,
          unit: item.unit,
          category: item.category,
          inventory_type: item.inventory_type,
          vehicle_model: item.vehicle_model,
          location: item.location,
          supplier: item.supplier ? {
            company_name: item.supplier.company_name,
            company_code: item.supplier.company_code,
            business_number: item.supplier.business_number,
            representative: item.supplier.representative,
            phone: item.supplier.phone,
            email: item.supplier.email,
            address: item.supplier.address,
            company_type: item.supplier.company_type
          } : undefined
        });
      });
    }

    // Add item details and supplier information to BOM data
    filteredData = filteredData.map(row => {
      const parentDetails = itemDetailsMap.get(row.parent_item_id);
      const childDetails = itemDetailsMap.get(row.child_item_id);
      
      return {
        ...row,
        // Parent item details
        parent_spec: parentDetails?.spec,
        parent_unit: parentDetails?.unit,
        parent_category: parentDetails?.category,
        parent_inventory_type: parentDetails?.inventory_type,
        parent_car_model: parentDetails?.vehicle_model,
        parent_location: parentDetails?.location,
        // Parent supplier information
        parent_supplier_name: parentDetails?.supplier?.company_name,
        parent_supplier_code: parentDetails?.supplier?.company_code,
        parent_supplier_business_number: parentDetails?.supplier?.business_number,
        parent_supplier_representative: parentDetails?.supplier?.representative,
        parent_supplier_phone: parentDetails?.supplier?.phone,
        parent_supplier_email: parentDetails?.supplier?.email,
        parent_supplier_address: parentDetails?.supplier?.address,
        parent_supplier_type: parentDetails?.supplier?.company_type,
        // Child item details
        child_spec: childDetails?.spec,
        child_unit: childDetails?.unit,
        child_category: childDetails?.category,
        child_inventory_type: childDetails?.inventory_type,
        child_car_model: childDetails?.vehicle_model,
        child_location: childDetails?.location,
        // Child supplier information
        child_supplier_name: childDetails?.supplier?.company_name,
        child_supplier_code: childDetails?.supplier?.company_code,
        child_supplier_business_number: childDetails?.supplier?.business_number,
        child_supplier_representative: childDetails?.supplier?.representative,
        child_supplier_phone: childDetails?.supplier?.phone,
        child_supplier_email: childDetails?.supplier?.email,
        child_supplier_address: childDetails?.supplier?.address,
        child_supplier_type: childDetails?.supplier?.company_type
      };
    });

    // Fetch monthly price information if price_month is provided
    if (priceMonth) {
      const priceMonthDate = `${priceMonth}-01`; // YYYY-MM-DD 형식으로 변환
      
      // Fetch price history for all items
      const { data: priceHistory, error: priceError } = await supabase
        .from('item_price_history')
        .select('item_id, price_month, unit_price, price_per_kg, note')
        .eq('price_month', priceMonthDate)
        .in('item_id', allItemIds);

      if (priceError) {
        console.error('Failed to fetch price history:', priceError);
        // Continue without price info if fetch fails
      } else {
        // Create item_id -> price info mapping
        const itemPriceMap = new Map<number, {
          price_month?: string;
          unit_price?: number;
          price_per_kg?: number;
          note?: string;
        }>();

        if (priceHistory) {
          priceHistory.forEach((ph: any) => {
            // Convert date to YYYY-MM format for Excel
            const priceMonthStr = ph.price_month 
              ? (typeof ph.price_month === 'string' 
                  ? ph.price_month.substring(0, 7) 
                  : new Date(ph.price_month).toISOString().substring(0, 7))
              : '';
            
            itemPriceMap.set(ph.item_id, {
              price_month: priceMonthStr,
              unit_price: ph.unit_price,
              price_per_kg: ph.price_per_kg,
              note: ph.note
            });
          });
        }

        // Add price information to BOM data
        filteredData = filteredData.map(row => {
          const parentPrice = itemPriceMap.get(row.parent_item_id);
          const childPrice = itemPriceMap.get(row.child_item_id);
          
          return {
            ...row,
            parent_price_month: parentPrice?.price_month,
            parent_unit_price: parentPrice?.unit_price,
            parent_price_per_kg: parentPrice?.price_per_kg,
            parent_price_note: parentPrice?.note,
            child_price_month: childPrice?.price_month,
            child_unit_price: childPrice?.unit_price,
            child_price_per_kg: childPrice?.price_per_kg,
            child_price_note: childPrice?.note
          };
        });
      }
    }

    if (!filteredData || filteredData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '내보낼 BOM 데이터가 없습니다',
          details: '필터 조건을 확인해주세요'
        },
        { status: 404 }
      );
    }

    // Generate Excel file
    const excelBuffer = await exportBOMToExcel(
      filteredData as BOMDetailRow[],
      {
        includeInactive,
        includeCostAnalysis,
        filterByParentId: parentItemId ? parseInt(parentItemId) : undefined,
        includeMasterData: includeMasterData || false
      },
      supabase,
      priceMonth || undefined
    );

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `BOM_구조_${timestamp}.xlsx`;

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
    console.error('BOM export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'BOM 내보내기 실패',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}
