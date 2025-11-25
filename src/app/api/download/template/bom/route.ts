import { NextResponse } from 'next/server';
import * as ExcelJS from 'exceljs';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';

/**
 * BOM 자품목 데이터 타입
 */
interface BomChildItem {
  bom_id: number;
  parent_item_id: number;
  child_item_id: number;
  quantity_required: number;
  level_no: number;
  parent_item: {
    item_id: number;
    item_code: string;
    item_name: string;
    vehicle_model: string | null;
    price: number | null;
    category: string | null;
    spec: string | null;
    unit: string | null;
  } | null;
  child_item: {
    item_id: number;
    item_code: string;
    item_name: string;
    vehicle_model: string | null;
    price: number | null;
    material: string | null;
    thickness: number | null;
    width: number | null;
    height: number | null;
    specific_gravity: number | null;
    mm_weight: number | null;
    sep: number | null;
    kg_unit_price: number | null;
    scrap_weight: number | null;
    scrap_unit_price: number | null;
    actual_quantity: number | null;
    supplier_id: number | null;
    category: string | null;
    spec: string | null;
    unit: string | null;
    current_stock: number | null;
    safety_stock: number | null;
    location: string | null;
  } | null;
  supplier: {
    company_id: number;
    company_name: string;
  } | null;
  supplier_category?: string;
}

/**
 * 모품목별 BOM 구조
 */
interface ParentBomData {
  parentItem: {
    item_code: string;
    item_name: string;
    vehicle_model: string | null;
    price: number | null;
  };
  childItems: Array<{
    childItem: BomChildItem['child_item'];
    quantity_required: number;
    supplier_category: string;
    supplier_name: string;
  }>;
  customerName?: string;  // 고객사명 (customer_bom_templates에서 매핑)
  bomId?: number;         // BOM ID (매핑용)
}

/**
 * 공급자 카테고리 결정
 */
function getSupplierCategory(supplierName: string | null): string {
  if (!supplierName) return '';
  const name = supplierName.toLowerCase();
  if (name.includes('태창') || name === '태창금속') return '태창금속';
  if (name.includes('대우') || name.includes('민현') || name.includes('삼진') ||
      name.includes('웅지') || name.includes('창경')) return '사급';
  if (name.includes('협력') || name.includes('태영') || name.includes('코리아')) return '협력업체';
  if (name.includes('스틸') || name.includes('bolt') || name.includes('nut')) return '하드웨어';
  return '사급';
}

/**
 * 스타일 정의 (기준 Excel 분석 결과)
 */
const STYLES = {
  // 배경색
  PARENT_ROW_BG: 'F8CBAD',  // 피치색 (모품목 행 I-L열)
  UNIT_PRICE_BG: 'FFFF00',  // 노란색 (단가 N열)
  HEADER_BG: 'D9E1F2',      // 연한 파란색 (헤더 행)

  // 테두리
  BORDER_THIN: {
    top: { style: 'thin' as const, color: { argb: 'FF000000' } },
    left: { style: 'thin' as const, color: { argb: 'FF000000' } },
    bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
    right: { style: 'thin' as const, color: { argb: 'FF000000' } },
  },

  // 숫자 포맷
  NUMBER_2_DECIMAL: '#,##0.00',
  NUMBER_1_DECIMAL: '#,##0.0',
  NUMBER_INTEGER: '#,##0',
};

/**
 * 헤더 정의 (기준 Excel 구조)
 */
const HEADERS = [
  '납품처',      // A (1)
  '차종',        // B (2)
  '품번',        // C (3)
  '품명',        // D (4)
  '단가',        // E (5)
  '마감수량',    // F (6)
  '마감금액',    // G (7)
  '',            // H (8): 빈 열
  '구매처',      // I (9)
  '차종',        // J (10)
  '품번',        // K (11)
  '품명',        // L (12)
  'U/S',         // M (13)
  '단가',        // N (14)
  '구매수량',    // O (15)
  '구매금액',    // P (16)
  '비고',        // Q (17)
  'KG단가',      // R (18)
  '단품단가',    // S (19)
  '재질',        // T (20)
  '두께',        // U (21)
  '폭',          // V (22)
  '길이',        // W (23)
  'SEP',         // X (24)
  '비중',        // Y (25)
  'EA중량',      // Z (26)
  '',            // AA (27): 빈 열
  '실적수량',    // AB (28)
  '스크랩중량',  // AC (29)
  '스크랩단가',  // AD (30)
  '스크랩금액',  // AE (31)
];

/**
 * 컬럼 너비 설정
 */
const COLUMN_WIDTHS = [
  12,   // A: 납품처
  8,    // B: 차종
  18,   // C: 품번
  30,   // D: 품명
  10,   // E: 단가
  10,   // F: 마감수량
  12,   // G: 마감금액
  2,    // H: 빈 열
  15,   // I: 구매처
  8,    // J: 차종
  18,   // K: 품번
  30,   // L: 품명
  8,    // M: U/S
  10,   // N: 단가
  10,   // O: 구매수량
  12,   // P: 구매금액
  10,   // Q: 비고
  10,   // R: KG단가
  10,   // S: 단품단가
  12,   // T: 재질
  8,    // U: 두께
  8,    // V: 폭
  8,    // W: 길이
  8,    // X: SEP
  8,    // Y: 비중
  10,   // Z: EA중량
  2,    // AA: 빈 열
  10,   // AB: 실적수량
  10,   // AC: 스크랩중량
  10,   // AD: 스크랩단가
  12,   // AE: 스크랩금액
];

/**
 * 고객사별 BOM 시트 생성
 */
async function createCustomerSheet(
  workbook: ExcelJS.Workbook,
  customerName: string,
  bomData?: ParentBomData[]
): Promise<void> {
  const safeSheetName = customerName.slice(0, 31).replace(/[\\\/\*\?\[\]:]/g, '_');
  const sheet = workbook.addWorksheet(safeSheetName);

  // 컬럼 너비 설정
  sheet.columns = COLUMN_WIDTHS.map((width, index) => ({
    key: String.fromCharCode(65 + index), // A, B, C...
    width: width,
  }));

  // 1-5행: 메타 정보
  sheet.getCell('AD1').value = 362;  // 스크랩 단가 기준값
  sheet.getCell('M3').value = 14.5;
  sheet.getCell('E5').value = 10;
  sheet.getCell('F5').value = 11;

  // 6행: 헤더
  const headerRow = sheet.getRow(6);
  HEADERS.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLES.HEADER_BG },
    };
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = STYLES.BORDER_THIN;
  });

  // 7행부터: BOM 데이터
  let currentRow = 7;

  if (bomData && bomData.length > 0) {
    // 고객사별로 필터링: 해당 고객사와 매핑된 BOM만 포함
    const filteredBomData = bomData.filter(parentBom => 
      parentBom.customerName === customerName
    );
    
    filteredBomData.forEach((parentBom) => {
      const childItems = parentBom.childItems;
      const hasChildren = childItems.length > 0;

      // ===== 모품목 행 =====
      const parentRow = sheet.getRow(currentRow);

      // A-G열: 모품목 정보
      parentRow.getCell(1).value = customerName;                           // A: 납품처
      parentRow.getCell(2).value = parentBom.parentItem.vehicle_model || ''; // B: 차종
      parentRow.getCell(3).value = parentBom.parentItem.item_code;         // C: 품번
      parentRow.getCell(4).value = parentBom.parentItem.item_name;         // D: 품명
      parentRow.getCell(5).value = parentBom.parentItem.price || 0;        // E: 단가
      parentRow.getCell(5).numFmt = STYLES.NUMBER_INTEGER;
      // F, G: 마감수량, 마감금액 (빈 값)

      // I-L열: 모품목 정보 반복 (피치색 배경)
      parentRow.getCell(9).value = customerName;                           // I: 구매처
      parentRow.getCell(10).value = parentBom.parentItem.vehicle_model || ''; // J: 차종
      parentRow.getCell(11).value = parentBom.parentItem.item_code;        // K: 품번
      parentRow.getCell(12).value = parentBom.parentItem.item_name;        // L: 품명

      // I-L열에 피치색 배경 적용
      for (let col = 9; col <= 12; col++) {
        const cell = parentRow.getCell(col);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: STYLES.PARENT_ROW_BG },
        };
        cell.border = STYLES.BORDER_THIN;
      }

      // 첫번째 자품목 정보 (있는 경우 같은 행에)
      if (hasChildren) {
        const firstChild = childItems[0];
        fillChildItemCells(parentRow, firstChild);
      }

      // 모든 셀에 테두리 적용
      for (let col = 1; col <= 31; col++) {
        parentRow.getCell(col).border = STYLES.BORDER_THIN;
      }

      currentRow++;

      // ===== 두번째 자품목부터 별도 행 =====
      for (let i = 1; i < childItems.length; i++) {
        const childRow = sheet.getRow(currentRow);
        const child = childItems[i];

        // H열: 업체구분
        childRow.getCell(8).value = child.supplier_category || '태창금속';

        // I-AE열: 자품목 정보
        fillChildItemCells(childRow, child);

        // 테두리 적용
        for (let col = 1; col <= 31; col++) {
          childRow.getCell(col).border = STYLES.BORDER_THIN;
        }

        currentRow++;
      }
    });
  }

  /**
   * 자품목 정보를 I-AE열에 채우는 헬퍼 함수
   */
  function fillChildItemCells(row: ExcelJS.Row, child: ParentBomData['childItems'][0]) {
    const childItem = child.childItem;

    row.getCell(9).value = child.supplier_name || '';                      // I: 구매처
    row.getCell(10).value = childItem?.vehicle_model || '';                // J: 차종
    row.getCell(11).value = childItem?.item_code || '';                    // K: 품번
    row.getCell(12).value = childItem?.item_name || '';                    // L: 품명
    row.getCell(13).value = child.quantity_required;                       // M: U/S

    // N열: 단가 (노란색 배경)
    const priceCell = row.getCell(14);
    priceCell.value = childItem?.price || '';
    priceCell.numFmt = STYLES.NUMBER_2_DECIMAL;
    priceCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLES.UNIT_PRICE_BG },
    };

    // O, P: 구매수량, 구매금액 (빈 값)
    // Q: 비고

    // R열: KG단가
    const kgPriceCell = row.getCell(18);
    kgPriceCell.value = childItem?.kg_unit_price || '';
    kgPriceCell.numFmt = STYLES.NUMBER_1_DECIMAL;

    // S열: 단품단가
    const itemPriceCell = row.getCell(19);
    itemPriceCell.value = childItem?.price || '';
    itemPriceCell.numFmt = STYLES.NUMBER_2_DECIMAL;

    row.getCell(20).value = childItem?.material || '';                     // T: 재질
    row.getCell(21).value = childItem?.thickness || '';                    // U: 두께
    row.getCell(22).value = childItem?.width || '';                        // V: 폭
    row.getCell(23).value = childItem?.height || '';                       // W: 길이
    row.getCell(24).value = childItem?.sep || '';                          // X: SEP
    row.getCell(25).value = childItem?.specific_gravity || '';             // Y: 비중

    // Z열: EA중량
    const weightCell = row.getCell(26);
    weightCell.value = childItem?.mm_weight || '';
    weightCell.numFmt = STYLES.NUMBER_2_DECIMAL;

    // AA: 빈 열
    row.getCell(28).value = childItem?.actual_quantity || '';              // AB: 실적수량

    // AC열: 스크랩중량
    const scrapWeightCell = row.getCell(29);
    scrapWeightCell.value = childItem?.scrap_weight || '';
    scrapWeightCell.numFmt = STYLES.NUMBER_1_DECIMAL;

    // AD열: 스크랩단가
    const scrapPriceCell = row.getCell(30);
    scrapPriceCell.value = childItem?.scrap_unit_price || '';
    scrapPriceCell.numFmt = STYLES.NUMBER_INTEGER;

    // AE: 스크랩금액 (빈 값)
  }
}

/**
 * 종합 시트 생성 (모든 BOM 데이터 통합)
 */
async function createSummarySheet(
  workbook: ExcelJS.Workbook,
  bomData: ParentBomData[],
  customerSheets: string[]
): Promise<void> {
  const sheet = workbook.addWorksheet('종합');

  // 컬럼 너비 설정 (동일한 구조)
  sheet.columns = COLUMN_WIDTHS.map((width, index) => ({
    key: String.fromCharCode(65 + index),
    width: width,
  }));

  // 1-5행: 메타 정보
  sheet.getCell('A1').value = '종합 BOM 데이터';
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A2').value = `생성일: ${new Date().toLocaleDateString('ko-KR')}`;
  sheet.getCell('A3').value = `총 고객사: ${customerSheets.length}개`;
  sheet.getCell('A4').value = `총 모품목: ${bomData.length}개`;

  const totalChildItems = bomData.reduce((sum, p) => sum + p.childItems.length, 0);
  sheet.getCell('A5').value = `총 자품목: ${totalChildItems}개`;

  // 6행: 헤더
  const headerRow = sheet.getRow(6);
  HEADERS.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLES.HEADER_BG },
    };
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = STYLES.BORDER_THIN;
  });

  // 7행부터: 모든 BOM 데이터
  let currentRow = 7;

  bomData.forEach((parentBom) => {
    const childItems = parentBom.childItems;
    const hasChildren = childItems.length > 0;

    // ===== 모품목 행 =====
    const parentRow = sheet.getRow(currentRow);

    // A-G열: 모품목 정보
    parentRow.getCell(1).value = parentBom.customerName || '(미지정)';        // A: 납품처
    parentRow.getCell(2).value = parentBom.parentItem.vehicle_model || '';    // B: 차종
    parentRow.getCell(3).value = parentBom.parentItem.item_code;              // C: 품번
    parentRow.getCell(4).value = parentBom.parentItem.item_name;              // D: 품명
    parentRow.getCell(5).value = parentBom.parentItem.price || 0;             // E: 단가
    parentRow.getCell(5).numFmt = STYLES.NUMBER_INTEGER;

    // I-L열: 모품목 정보 반복 (피치색 배경)
    parentRow.getCell(9).value = parentBom.customerName || '(미지정)';        // I: 구매처
    parentRow.getCell(10).value = parentBom.parentItem.vehicle_model || '';   // J: 차종
    parentRow.getCell(11).value = parentBom.parentItem.item_code;             // K: 품번
    parentRow.getCell(12).value = parentBom.parentItem.item_name;             // L: 품명

    // I-L열에 피치색 배경 적용
    for (let col = 9; col <= 12; col++) {
      const cell = parentRow.getCell(col);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: STYLES.PARENT_ROW_BG },
      };
      cell.border = STYLES.BORDER_THIN;
    }

    // 첫번째 자품목 정보 (있는 경우 같은 행에)
    if (hasChildren) {
      const firstChild = childItems[0];
      fillSummaryChildItemCells(parentRow, firstChild);
    }

    // 모든 셀에 테두리 적용
    for (let col = 1; col <= 31; col++) {
      parentRow.getCell(col).border = STYLES.BORDER_THIN;
    }

    currentRow++;

    // ===== 두번째 자품목부터 별도 행 =====
    for (let i = 1; i < childItems.length; i++) {
      const childRow = sheet.getRow(currentRow);
      const child = childItems[i];

      // H열: 업체구분
      childRow.getCell(8).value = child.supplier_category || '태창금속';

      // I-AE열: 자품목 정보
      fillSummaryChildItemCells(childRow, child);

      // 테두리 적용
      for (let col = 1; col <= 31; col++) {
        childRow.getCell(col).border = STYLES.BORDER_THIN;
      }

      currentRow++;
    }
  });

  /**
   * 종합 시트용 자품목 정보를 I-AE열에 채우는 헬퍼 함수
   */
  function fillSummaryChildItemCells(row: ExcelJS.Row, child: ParentBomData['childItems'][0]) {
    const childItem = child.childItem;

    row.getCell(9).value = child.supplier_name || '';                      // I: 구매처
    row.getCell(10).value = childItem?.vehicle_model || '';                // J: 차종
    row.getCell(11).value = childItem?.item_code || '';                    // K: 품번
    row.getCell(12).value = childItem?.item_name || '';                    // L: 품명
    row.getCell(13).value = child.quantity_required;                       // M: U/S

    // N열: 단가 (노란색 배경)
    const priceCell = row.getCell(14);
    priceCell.value = childItem?.price || '';
    priceCell.numFmt = STYLES.NUMBER_2_DECIMAL;
    priceCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLES.UNIT_PRICE_BG },
    };

    // R열: KG단가
    const kgPriceCell = row.getCell(18);
    kgPriceCell.value = childItem?.kg_unit_price || '';
    kgPriceCell.numFmt = STYLES.NUMBER_1_DECIMAL;

    // S열: 단품단가
    const itemPriceCell = row.getCell(19);
    itemPriceCell.value = childItem?.price || '';
    itemPriceCell.numFmt = STYLES.NUMBER_2_DECIMAL;

    row.getCell(20).value = childItem?.material || '';                     // T: 재질
    row.getCell(21).value = childItem?.thickness || '';                    // U: 두께
    row.getCell(22).value = childItem?.width || '';                        // V: 폭
    row.getCell(23).value = childItem?.height || '';                       // W: 길이
    row.getCell(24).value = childItem?.sep || '';                          // X: SEP
    row.getCell(25).value = childItem?.specific_gravity || '';             // Y: 비중

    // Z열: EA중량
    const weightCell = row.getCell(26);
    weightCell.value = childItem?.mm_weight || '';
    weightCell.numFmt = STYLES.NUMBER_2_DECIMAL;

    row.getCell(28).value = childItem?.actual_quantity || '';              // AB: 실적수량

    // AC열: 스크랩중량
    const scrapWeightCell = row.getCell(29);
    scrapWeightCell.value = childItem?.scrap_weight || '';
    scrapWeightCell.numFmt = STYLES.NUMBER_1_DECIMAL;

    // AD열: 스크랩단가
    const scrapPriceCell = row.getCell(30);
    scrapPriceCell.value = childItem?.scrap_unit_price || '';
    scrapPriceCell.numFmt = STYLES.NUMBER_INTEGER;
  }
}

/**
 * 최신단가 시트 생성
 */
async function createPriceSheet(workbook: ExcelJS.Workbook): Promise<void> {
  const sheet = workbook.addWorksheet('최신단가');

  sheet.columns = [
    { key: 'A', width: 18 },
    { key: 'B', width: 12 },
    { key: 'C', width: 15 },
    { key: 'D', width: 10 },
  ];

  const defaultData = [
    ['50010562C', 785, '태영금속', '4월기준'],
    ['69174-DO000', 1203, '태영금속', '4월기준'],
    ['69184-DO000', 1203, '태영금속', '4월기준'],
    ['69158-DO000', 451, '태영금속', '4월기준'],
    ['69168-DO000', 450, '태영금속', '4월기준'],
    ['69118-DO000', 158, '태영금속', '4월기준'],
    ['50011721C', 2169, '창경에스테크', '4월기준'],
    ['50007278B', 2631, '창경에스테크', '4월기준'],
    ['50010755C', 2644, '창경에스테크', '4월기준'],
    ['50012110B', 1707, '창경에스테크', '4월기준'],
    ['651M7-L2000', 298.6, '웅지테크', '4월기준'],
    ['65158-L8000', 561, '웅지테크', '4월기준'],
    ['65168-L8000', 561, '웅지테크', '4월기준'],
  ];

  defaultData.forEach((row, index) => {
    const sheetRow = sheet.getRow(index + 1);
    sheetRow.getCell(1).value = row[0];
    sheetRow.getCell(2).value = row[1];
    sheetRow.getCell(3).value = row[2];
    sheetRow.getCell(4).value = row[3];
  });
}

/**
 * BOM 데이터를 모품목별로 그룹핑
 */
function groupBomByParent(bomRows: BomChildItem[]): ParentBomData[] {
  const parentMap = new Map<number, ParentBomData>();

  bomRows.forEach((row) => {
    if (!row.parent_item) return;

    const parentId = row.parent_item_id;

    if (!parentMap.has(parentId)) {
      parentMap.set(parentId, {
        parentItem: {
          item_code: row.parent_item.item_code,
          item_name: row.parent_item.item_name,
          vehicle_model: row.parent_item.vehicle_model,
          price: row.parent_item.price,
        },
        childItems: [],
        bomId: row.bom_id,  // BOM ID 저장
      });
    }

    const parentGroup = parentMap.get(parentId)!;
    const supplierName = row.supplier?.company_name || '';
    const supplierCategory = getSupplierCategory(supplierName);

    parentGroup.childItems.push({
      childItem: row.child_item,
      quantity_required: row.quantity_required,
      supplier_category: supplierCategory,
      supplier_name: supplierName,
    });
  });

  return Array.from(parentMap.values());
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // 고객사 목록 조회
    const { data: customers, error: customersError } = await supabase
      .from('companies')
      .select('company_name')
      .eq('company_type', '고객사')
      .eq('is_active', true)
      .order('company_name');

    if (customersError) {
      console.error('Error fetching customers:', customersError);
    }

    // BOM 데이터 조회
    const { data: bomData, error: bomError } = await supabase
      .from('bom')
      .select(`
        bom_id,
        parent_item_id,
        child_item_id,
        quantity_required,
        level_no,
        parent_item:items!bom_parent_item_id_fkey (
          item_id,
          item_code,
          item_name,
          vehicle_model,
          price,
          category,
          spec,
          unit
        ),
        child_item:items!bom_child_item_id_fkey (
          item_id,
          item_code,
          item_name,
          vehicle_model,
          price,
          material,
          thickness,
          width,
          height,
          specific_gravity,
          mm_weight,
          sep,
          kg_unit_price,
          scrap_weight,
          scrap_unit_price,
          actual_quantity,
          supplier_id,
          category,
          spec,
          unit,
          current_stock,
          safety_stock,
          location
        )
      `)
      .eq('is_active', true)
      .order('parent_item_id')
      .order('level_no');

    console.log('[BOM Template] BOM 데이터 조회 결과:', bomData?.length || 0, '건');

    if (bomError) {
      console.error('[BOM Template] Error fetching BOM data:', bomError);
    }

    // 구매처 정보 매핑
    let bomWithSuppliers: BomChildItem[] = [];
    if (bomData && bomData.length > 0) {
      const supplierIds = [...new Set(
        bomData
          .map((b: any) => b.child_item?.supplier_id)
          .filter((id: number | null) => id !== null)
      )];

      const { data: suppliers } = await supabase
        .from('companies')
        .select('company_id, company_name')
        .in('company_id', supplierIds);

      const supplierMap = new Map(
        (suppliers || []).map((s: any) => [s.company_id, s])
      );

      bomWithSuppliers = bomData.map((b: any) => ({
        ...b,
        parent_item: Array.isArray(b.parent_item) ? b.parent_item[0] : b.parent_item,
        child_item: Array.isArray(b.child_item) ? b.child_item[0] : b.child_item,
        supplier: b.child_item?.supplier_id
          ? supplierMap.get(b.child_item.supplier_id) || null
          : null,
      }));

      console.log('[BOM Template] bomWithSuppliers 매핑 완료:', bomWithSuppliers.length, '건');
    }

    // 모품목별 그룹핑
    const groupedBomData = groupBomByParent(bomWithSuppliers);
    console.log('[BOM Template] 모품목 그룹 수:', groupedBomData.length, '개');

    // customer_bom_templates에서 BOM-고객사 매핑 정보 조회
    const { data: customerBomTemplates, error: templateError } = await supabase
      .from('customer_bom_templates')
      .select(`
        bom_id,
        customer_id,
        customer:companies!customer_bom_templates_customer_id_fkey (
          company_id,
          company_name
        )
      `);

    if (templateError) {
      console.error('[BOM Template] Error fetching customer_bom_templates:', templateError);
    }

    // BOM ID → 고객사명 매핑 생성
    const bomToCustomerMap = new Map<number, string>();
    if (customerBomTemplates && customerBomTemplates.length > 0) {
      customerBomTemplates.forEach((template: any) => {
        const customer = Array.isArray(template.customer) ? template.customer[0] : template.customer;
        if (customer?.company_name) {
          bomToCustomerMap.set(template.bom_id, customer.company_name);
          console.log(`[BOM Template] 매핑: BOM ID ${template.bom_id} → ${customer.company_name}`);
        }
      });
      console.log('[BOM Template] BOM-고객사 매핑:', bomToCustomerMap.size, '건');
    }

    // groupedBomData에 고객사명 매핑
    let mappedCount = 0;
    groupedBomData.forEach((bomGroup) => {
      if (bomGroup.bomId && bomToCustomerMap.has(bomGroup.bomId)) {
        bomGroup.customerName = bomToCustomerMap.get(bomGroup.bomId);
        mappedCount++;
      }
    });
    console.log(`[BOM Template] ${mappedCount}/${groupedBomData.length} 개 BOM에 고객사 매핑됨`);

    // 고객사 목록
    const defaultCustomers = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];
    const customerSheets = customers && customers.length > 0
      ? customers.map(c => c.company_name).filter(Boolean)
      : defaultCustomers;

    // ExcelJS 워크북 생성
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '태창 ERP';
    workbook.created = new Date();

    // 고객사별 시트 생성
    for (const customerName of customerSheets) {
      await createCustomerSheet(workbook, customerName, groupedBomData);
    }

    // 종합 시트 추가 (마지막에)
    await createSummarySheet(workbook, groupedBomData, customerSheets);

    // 최신단가 시트 추가
    await createPriceSheet(workbook);

    // Excel 버퍼 생성
    const buffer = await workbook.xlsx.writeBuffer();

    // 응답 반환 (파일명은 프론트엔드에서 설정)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Error generating BOM template:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Excel 템플릿 생성에 실패했습니다',
      },
      { status: 500 }
    );
  }
}
