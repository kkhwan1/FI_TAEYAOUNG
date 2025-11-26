import { NextResponse } from 'next/server';
import * as ExcelJS from 'exceljs';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';

/**
 * 메타 정보 설정 상수
 */
const METADATA_VALUES = {
  SCRAP_UNIT_PRICE: 362,      // 스크랩 단가 기준값
  DEFAULT_RATIO: 14.5,         // 기본 비율
  DEFAULT_VALUE_1: 10,
  DEFAULT_VALUE_2: 11,
};

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
    company_category?: string | null;
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
  customerId?: number;    // 고객사 ID (companies 테이블 FK)
  customerName?: string;  // 고객사명 (첫 번째 고객사 - 호환성 유지)
  customerNames?: string[];  // 고객사명 배열 (모든 연결된 고객사)
  customerIds?: number[]; // 고객사 ID 배열 (ID 기반 매핑용)
  bomId?: number;         // BOM ID (매핑용)
  parentItemId?: number;  // parent_item_id (고객사 매핑용)
}

/**
 * 공급자 카테고리 결정 (DB 기반)
 * company_category 컬럼에서 직접 조회
 *
 * 동적 카테고리 지원:
 * - DB에 새로운 카테고리를 추가하면 자동으로 반영됨
 * - 업로드 API에서 새 카테고리 추가 시 즉시 사용 가능
 * - 값이 없으면 빈 문자열 반환 (Excel에서 공백 표시)
 */
function getSupplierCategory(companyCategory: string | null, supplierName?: string): string {
  // 1순위: DB company_category 값 (동적 - 새로운 카테고리 자동 지원)
  if (companyCategory && companyCategory.trim()) {
    return companyCategory.trim();
  }
  // 2순위: 공급사명 (카테고리 미설정 시)
  if (supplierName && supplierName.trim()) {
    return supplierName.trim();
  }
  // 3순위: 빈 값 (데이터 없음)
  return '';
}

/**
 * 스타일 정의 (기준 Excel 분석 결과)
 */
const STYLES = {
  // 배경색 (ARGB 형식: FF + RGB)
  PARENT_ROW_BG: 'FFF8CBAD',  // 피치색 (모품목 행 I-L열)
  UNIT_PRICE_BG: 'FFFFFF00',  // 노란색 (단가 N열)
  HEADER_BG: 'FFD9E1F2',      // 연한 파란색 (종합 시트 헤더 행)
  CUSTOMER_HEADER_BG: 'FFE2EFDA',  // 연한 녹색 (고객사 시트 헤더 행)
  PRICE_HEADER_BG: 'FFFCE4D6',     // 연한 주황색 (월별단가 시트 헤더 행)

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
 * 헤더 정의 - Layout 1 (대우공업, 풍기산업, 다인) - 31컬럼
 * 구매처: I(9), 소요량/U/S: M(13)
 */
const HEADERS_LAYOUT1 = [
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
  'U/S',         // M (13) - 대우공업은 'U/S', 기타는 '소요량'으로 동적 변경
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
  '스크랩 단가', // AD (30)
  '스크랩금액',  // AE (31)
];

/**
 * 헤더 정의 - Layout 2 (호원오토, 인알파코리아) - 36컬럼
 * 구매처: J(10), 소요량: N(14)
 */
const HEADERS_LAYOUT2 = [
  '납품처',      // A (1)
  '차종',        // B (2)
  '품번',        // C (3)
  '품명',        // D (4)
  '단가',        // E (5)
  '마감수량',    // F (6)
  '마감금액',    // G (7)
  '',            // H (8): 빈 열
  '',            // I (9): 빈 열 (추가)
  '구매처',      // J (10)
  '차종',        // K (11)
  '품번',        // L (12)
  '품명',        // M (13)
  '소요량',      // N (14)
  '단가',        // O (15)
  '구매수량',    // P (16)
  '구매금액',    // Q (17)
  '비고',        // R (18)
  'KG단가',      // S (19)
  '단품단가',    // T (20)
  '재질',        // U (21)
  '두께',        // V (22)
  '폭',          // W (23)
  '길이',        // X (24)
  'SEP',         // Y (25)
  '비중',        // Z (26)
  'EA중량',      // AA (27)
  '',            // AB (28): 빈 열
  '',            // AC (29): 빈 열
  '',            // AD (30): 빈 열
  '',            // AE (31): 빈 열
  '',            // AF (32): 빈 열
  '실적수량',    // AG (33)
  '스크랩중량',  // AH (34)
  '스크랩 단가', // AI (35)
  '스크랩금액',  // AJ (36)
];

/**
 * 고객사별 레이아웃 타입 결정
 */
type LayoutType = 'layout1' | 'layout2';

function getLayoutType(customerName: string): LayoutType {
  // 호원오토, 인알파코리아는 Layout 2 (36컬럼)
  if (customerName.includes('호원오토') || customerName.includes('인알파코리아')) {
    return 'layout2';
  }
  // 대우공업, 풍기산업, 다인은 Layout 1 (31컬럼)
  return 'layout1';
}

/**
 * 레이아웃별 헤더 가져오기
 */
function getHeaders(layoutType: LayoutType, customerName: string): string[] {
  if (layoutType === 'layout2') {
    return [...HEADERS_LAYOUT2];
  }
  // Layout 1: 대우공업은 'U/S', 기타는 '소요량'
  const headers = [...HEADERS_LAYOUT1];
  if (!customerName.includes('대우공업')) {
    headers[12] = '소요량'; // M열 (인덱스 12)
  }
  return headers;
}

// 레거시 호환성을 위한 기본 HEADERS (Layout 1)
const HEADERS = HEADERS_LAYOUT1;

/**
 * 컬럼 너비 설정 - Layout 1 (31컬럼)
 */
const COLUMN_WIDTHS_LAYOUT1 = [
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
  8,    // M: U/S/소요량
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
  10,   // AD: 스크랩 단가
  12,   // AE: 스크랩금액
];

/**
 * 컬럼 너비 설정 - Layout 2 (36컬럼)
 */
const COLUMN_WIDTHS_LAYOUT2 = [
  12,   // A: 납품처
  8,    // B: 차종
  18,   // C: 품번
  30,   // D: 품명
  10,   // E: 단가
  10,   // F: 마감수량
  12,   // G: 마감금액
  2,    // H: 빈 열
  2,    // I: 빈 열 (추가)
  15,   // J: 구매처
  8,    // K: 차종
  18,   // L: 품번
  30,   // M: 품명
  8,    // N: 소요량
  10,   // O: 단가
  10,   // P: 구매수량
  12,   // Q: 구매금액
  10,   // R: 비고
  10,   // S: KG단가
  10,   // T: 단품단가
  12,   // U: 재질
  8,    // V: 두께
  8,    // W: 폭
  8,    // X: 길이
  8,    // Y: SEP
  8,    // Z: 비중
  10,   // AA: EA중량
  2,    // AB: 빈 열
  2,    // AC: 빈 열
  2,    // AD: 빈 열
  2,    // AE: 빈 열
  2,    // AF: 빈 열
  10,   // AG: 실적수량
  10,   // AH: 스크랩중량
  10,   // AI: 스크랩 단가
  12,   // AJ: 스크랩금액
];

/**
 * 레이아웃별 컬럼 너비 가져오기
 */
function getColumnWidths(layoutType: LayoutType): number[] {
  return layoutType === 'layout2' ? COLUMN_WIDTHS_LAYOUT2 : COLUMN_WIDTHS_LAYOUT1;
}

// 레거시 호환성을 위한 기본 COLUMN_WIDTHS (Layout 1)
const COLUMN_WIDTHS = COLUMN_WIDTHS_LAYOUT1;

/**
 * 고객사별 BOM 시트 생성
 * @param customerId 고객사 ID (ID 기반 매칭용, 선택적)
 */
async function createCustomerSheet(
  workbook: ExcelJS.Workbook,
  customerName: string,
  bomData?: ParentBomData[],
  usedSheetNames?: Set<string>,
  allBomData?: ParentBomData[],
  customerId?: number
): Promise<void> {
  // 시트명 안전 변환 (Excel 제약: 31자, 특수문자 제거)
  // 1. 공백 정규화 (연속 공백을 하나로, 앞뒤 공백 제거)
  let normalizedName = customerName.replace(/\s+/g, ' ').trim();
  // 2. 특수문자 제거 (Excel 시트명에서 허용되지 않는 문자)
  normalizedName = normalizedName.replace(/[\\\/\*\?\[\]:]/g, '_');
  // 3. 31자 제한 (Excel 시트명 최대 길이)
  let baseSheetName = normalizedName.slice(0, 31);
  
  // 중복 시트명 처리
  let safeSheetName = baseSheetName;
  let counter = 1;
  
  if (usedSheetNames) {
    while (usedSheetNames.has(safeSheetName) || workbook.worksheets.some(ws => ws.name === safeSheetName)) {
      const suffix = `(${counter})`;
      const maxLength = 31 - suffix.length;
      safeSheetName = baseSheetName.slice(0, maxLength) + suffix;
      counter++;
      
      // 무한 루프 방지
      if (counter > 999) {
        safeSheetName = baseSheetName.slice(0, 20) + '_' + Date.now().toString().slice(-8);
        break;
      }
    }
    usedSheetNames.add(safeSheetName);
  }
  
  const sheet = workbook.addWorksheet(safeSheetName);

  // 고객사별 레이아웃 결정
  const layoutType = getLayoutType(customerName);
  const headers = getHeaders(layoutType, customerName);
  const columnWidths = getColumnWidths(layoutType);
  const totalColumns = headers.length; // 31 또는 36

  // 컬럼 너비 설정 (레이아웃별)
  sheet.columns = columnWidths.map((width, index) => ({
    key: String.fromCharCode(65 + index), // A, B, C...
    width: width,
  }));

  // 1행: 시트 메타데이터 (고객사별 통계)
  const currentDate = new Date().toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  // 이 고객사의 BOM 데이터 통계 계산
  const dataToUse = bomData || allBomData || [];
  const totalBomRecords = dataToUse.length;
  const totalChildItems = dataToUse.reduce((sum, bom) => sum + bom.childItems.length, 0);
  const uniqueParentItems = new Set(dataToUse.map(bom => bom.parentItem.item_code)).size;

  sheet.getCell('A1').value = `생성일: ${currentDate}`;
  sheet.getCell('F1').value = `고객사: ${customerName}`;
  sheet.getCell('K1').value = `모품목 수: ${uniqueParentItems}`;
  sheet.getCell('P1').value = `BOM 레코드 수: ${totalBomRecords}`;

  // 2-5행: 기존 메타 정보 유지 (레이아웃별 위치 조정)
  if (layoutType === 'layout1') {
    sheet.getCell('AD2').value = 362;  // 스크랩 단가 기준값 (Layout 1: AD)
    sheet.getCell('M4').value = 14.5;
  } else {
    sheet.getCell('AI2').value = 362;  // 스크랩 단가 기준값 (Layout 2: AI)
    sheet.getCell('N4').value = 14.5;
  }
  sheet.getCell('E6').value = 10;
  sheet.getCell('F6').value = 11;

  // 6행: 헤더 (고객사 시트는 연한 녹색)
  const headerRow = sheet.getRow(6);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLES.CUSTOMER_HEADER_BG },
    };
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = STYLES.BORDER_THIN;
  });

  // 7행부터: BOM 데이터
  let currentRow = 7;

  if (bomData && bomData.length > 0) {
    // 고객사별로 필터링: 해당 고객사와 매핑된 BOM만 포함
    // ID 기반 매칭 우선 (문자열 비교 문제 해결), 이름 매칭은 폴백으로 유지
    const filteredBomData = bomData.filter(parentBom => {
      // 1. ID 기반 매칭 (우선)
      if (customerId && parentBom.customerIds && parentBom.customerIds.includes(customerId)) {
        return true;
      }
      // 2. 이름 기반 매칭 (폴백 - 정규화된 이름 비교)
      const normalizedCustomerName = customerName.replace(/\s+/g, ' ').trim();
      const normalizedParentCustomerNames = parentBom.customerNames?.map(n => n.replace(/\s+/g, ' ').trim()) || [];
      const normalizedParentCustomerName = parentBom.customerName?.replace(/\s+/g, ' ').trim();
      return normalizedParentCustomerNames.includes(normalizedCustomerName) || normalizedParentCustomerName === normalizedCustomerName;
    });

    // 디버깅: 필터링 결과 로깅
    console.log(`[BOM Template] createCustomerSheet '${customerName}'(ID:${customerId}) - 필터링 후 BOM: ${filteredBomData.length}개 (전체: ${bomData.length}개)`);
    
    filteredBomData.forEach((parentBom) => {
      const childItems = parentBom.childItems;
      const hasChildren = childItems.length > 0;

      // ===== 모품목 행 =====
      const parentRow = sheet.getRow(currentRow);

      // A-G열: 모품목 정보 (null 체크 및 기본값 처리)
      const parentItemCode = parentBom.parentItem?.item_code || '';
      const parentItemName = parentBom.parentItem?.item_name || '';
      const parentVehicleModel = parentBom.parentItem?.vehicle_model || '';
      const parentPrice = parentBom.parentItem?.price || 0;

      // 품번/품명이 비어있으면 경고 로그
      if (!parentItemCode || !parentItemName) {
        console.warn(`[BOM Template] createCustomerSheet - 모품목 품번/품명 누락: customer=${customerName}, item_code=${parentItemCode}, item_name=${parentItemName}`);
      }

      parentRow.getCell(1).value = customerName;         // A: 납품처
      parentRow.getCell(2).value = parentVehicleModel;   // B: 차종
      parentRow.getCell(3).value = parentItemCode;       // C: 품번
      parentRow.getCell(4).value = parentItemName;       // D: 품명
      parentRow.getCell(5).value = parentPrice;          // E: 단가
      parentRow.getCell(5).numFmt = STYLES.NUMBER_INTEGER;
      // F, G: 마감수량, 마감금액 (빈 값)

      // 모품목 정보 반복 (피치색 배경) - 레이아웃별 컬럼 위치
      // Layout 1: I-L (9-12), Layout 2: J-M (10-13)
      const parentOffset = layoutType === 'layout2' ? 1 : 0;
      parentRow.getCell(9 + parentOffset).value = customerName;        // I/J: 구매처
      parentRow.getCell(10 + parentOffset).value = parentVehicleModel; // J/K: 차종
      parentRow.getCell(11 + parentOffset).value = parentItemCode;     // K/L: 품번
      parentRow.getCell(12 + parentOffset).value = parentItemName;     // L/M: 품명

      // 모품목 정보 컬럼에 피치색 배경 적용
      for (let col = 9 + parentOffset; col <= 12 + parentOffset; col++) {
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
        // H열: 업체구분 (DB 기반 동적 카테고리 - 새로운 카테고리 자동 지원)
        parentRow.getCell(8).value = firstChild.supplier_category || '';
        fillChildItemCells(parentRow, firstChild, layoutType);
      }

      // 모든 셀에 테두리 적용
      for (let col = 1; col <= totalColumns; col++) {
        parentRow.getCell(col).border = STYLES.BORDER_THIN;
      }

      currentRow++;

      // ===== 두번째 자품목부터 별도 행 =====
      for (let i = 1; i < childItems.length; i++) {
        const childRow = sheet.getRow(currentRow);
        const child = childItems[i];

        // H열: 업체구분 (DB 기반 동적 카테고리 - 새로운 카테고리 자동 지원)
        childRow.getCell(8).value = child.supplier_category || '';

        // 자품목 정보 (레이아웃별 컬럼 위치)
        fillChildItemCells(childRow, child, layoutType);

        // 테두리 적용
        for (let col = 1; col <= totalColumns; col++) {
          childRow.getCell(col).border = STYLES.BORDER_THIN;
        }

        currentRow++;
      }
    });
  }

  /**
   * 자품목 정보를 레이아웃별 컬럼 위치에 채우는 헬퍼 함수
   * Layout 1 (대우공업, 풍기산업, 다인): I(9)~AE(31) - 31컬럼
   * Layout 2 (호원오토, 인알파코리아): J(10)~AJ(36) - 36컬럼 (+1 오프셋)
   */
  function fillChildItemCells(row: ExcelJS.Row, child: ParentBomData['childItems'][0], layout: LayoutType) {
    const childItem = child.childItem;
    // Layout 2는 컬럼이 1칸씩 오른쪽으로 이동
    const offset = layout === 'layout2' ? 1 : 0;

    row.getCell(9 + offset).value = child.supplier_name || '';              // I/J: 구매처
    row.getCell(10 + offset).value = childItem?.vehicle_model || '';        // J/K: 차종
    row.getCell(11 + offset).value = childItem?.item_code || '';            // K/L: 품번
    row.getCell(12 + offset).value = childItem?.item_name || '';            // L/M: 품명
    row.getCell(13 + offset).value = child.quantity_required;               // M/N: U/S 또는 소요량

    // N/O열: 단가 (노란색 배경)
    const priceCell = row.getCell(14 + offset);
    priceCell.value = childItem?.price || '';
    priceCell.numFmt = STYLES.NUMBER_2_DECIMAL;
    priceCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLES.UNIT_PRICE_BG },
    };

    // O/P, P/Q: 구매수량, 구매금액 (빈 값)
    // Q/R: 비고

    // R/S열: KG단가
    const kgPriceCell = row.getCell(18 + offset);
    kgPriceCell.value = childItem?.kg_unit_price || '';
    kgPriceCell.numFmt = STYLES.NUMBER_1_DECIMAL;

    // S/T열: 단품단가
    const itemPriceCell = row.getCell(19 + offset);
    itemPriceCell.value = childItem?.price || '';
    itemPriceCell.numFmt = STYLES.NUMBER_2_DECIMAL;

    row.getCell(20 + offset).value = childItem?.material || '';             // T/U: 재질
    row.getCell(21 + offset).value = childItem?.thickness || '';            // U/V: 두께
    row.getCell(22 + offset).value = childItem?.width || '';                // V/W: 폭
    row.getCell(23 + offset).value = childItem?.height || '';               // W/X: 길이
    row.getCell(24 + offset).value = childItem?.sep || '';                  // X/Y: SEP
    row.getCell(25 + offset).value = childItem?.specific_gravity || '';     // Y/Z: 비중

    // Z/AA열: EA중량
    const weightCell = row.getCell(26 + offset);
    weightCell.value = childItem?.mm_weight || '';
    weightCell.numFmt = STYLES.NUMBER_2_DECIMAL;

    // Layout 2의 경우 빈 열이 더 있음 (AB-AF)
    // Layout 1: AA(27) 빈, AB(28) 실적수량
    // Layout 2: AB-AF(28-32) 빈, AG(33) 실적수량
    const emptyColsOffset = layout === 'layout2' ? 5 : 1; // Layout 2는 빈 열이 5개 더 있음

    row.getCell(27 + emptyColsOffset + offset).value = childItem?.actual_quantity || '';  // AB/AG: 실적수량

    // AC/AH열: 스크랩중량
    const scrapWeightCell = row.getCell(28 + emptyColsOffset + offset);
    scrapWeightCell.value = childItem?.scrap_weight || '';
    scrapWeightCell.numFmt = STYLES.NUMBER_1_DECIMAL;

    // AD/AI열: 스크랩단가
    const scrapPriceCell = row.getCell(29 + emptyColsOffset + offset);
    scrapPriceCell.value = childItem?.scrap_unit_price || '';
    scrapPriceCell.numFmt = STYLES.NUMBER_INTEGER;

    // AE/AJ: 스크랩금액 (빈 값)
  }
}

/**
 * 공급사별 시트 생성
 * 해당 공급사가 공급하는 BOM만 필터링하여 표시
 */
async function createSupplierSheet(
  workbook: ExcelJS.Workbook,
  supplierName: string,
  supplierId: number,
  bomData?: ParentBomData[],
  usedSheetNames?: Set<string>,
  allBomData?: ParentBomData[]
): Promise<void> {
  // 시트명 안전 변환 (Excel 제약: 31자, 특수문자 제거)
  let normalizedName = supplierName.replace(/\s+/g, ' ').trim();
  normalizedName = normalizedName.replace(/[\\\/\*\?\[\]:]/g, '_');
  let baseSheetName = normalizedName.slice(0, 31);

  // 중복 시트명 처리
  let safeSheetName = baseSheetName;
  let counter = 1;

  if (usedSheetNames) {
    while (usedSheetNames.has(safeSheetName) || workbook.worksheets.some(ws => ws.name === safeSheetName)) {
      const suffix = `(${counter})`;
      const maxLength = 31 - suffix.length;
      safeSheetName = baseSheetName.slice(0, maxLength) + suffix;
      counter++;

      if (counter > 999) {
        safeSheetName = baseSheetName.slice(0, 20) + '_' + Date.now().toString().slice(-8);
        break;
      }
    }
    usedSheetNames.add(safeSheetName);
  }

  const sheet = workbook.addWorksheet(safeSheetName);

  // 컬럼 너비 설정
  sheet.columns = COLUMN_WIDTHS.map((width, index) => ({
    key: String.fromCharCode(65 + index),
    width: width,
  }));

  // 1행: 시트 메타데이터 (공급사별 통계)
  const currentDate = new Date().toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  // 이 공급사가 공급하는 BOM 데이터 필터링
  const dataToUse = bomData || allBomData || [];
  const filteredBomData = dataToUse
    .map(parentBom => ({
      ...parentBom,
      childItems: parentBom.childItems.filter(child =>
        child.childItem?.supplier_id === supplierId
      )
    }))
    .filter(parentBom => parentBom.childItems.length > 0);

  const totalItems = filteredBomData.reduce((sum, bom) => sum + bom.childItems.length, 0);
  const totalBomRecords = filteredBomData.length;

  sheet.getCell('A1').value = `생성일: ${currentDate}`;
  sheet.getCell('F1').value = `공급사: ${supplierName}`;
  sheet.getCell('K1').value = `총 품목 수: ${totalItems}`;
  sheet.getCell('P1').value = `BOM 레코드 수: ${totalBomRecords}`;

  // 2-5행: 기존 메타 정보 유지
  sheet.getCell('AD2').value = 362;
  sheet.getCell('M4').value = 14.5;
  sheet.getCell('E6').value = 10;
  sheet.getCell('F6').value = 11;

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

  // Helper function: 공급사 시트용 자품목 셀 채우기
  function fillSupplierChildItemCells(row: ExcelJS.Row, child: ParentBomData['childItems'][0]) {
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

  // 7행부터: BOM 데이터
  let currentRow = 7;

  if (bomData && bomData.length > 0) {
    // 공급사별로 필터링: 해당 공급사가 공급하는 자품목이 있는 BOM만 포함
    const filteredBomData = bomData
      .map(parentBom => ({
        ...parentBom,
        childItems: parentBom.childItems.filter(child =>
          child.childItem?.supplier_id === supplierId
        )
      }))
      .filter(parentBom => parentBom.childItems.length > 0);

    if (filteredBomData.length > 0) {
      for (const parentBom of filteredBomData) {
        const parentItem = parentBom.parentItem;
        const childItems = parentBom.childItems;

        if (childItems.length === 0) continue;

        // ===== 첫번째 자품목 =====
        const firstChild = childItems[0];
        const row = sheet.getRow(currentRow);

        // A-G열: 모품목 정보
        row.getCell(1).value = ''; // A: 납품처 (공급사 시트에서는 비워둠)
        row.getCell(2).value = parentItem.vehicle_model || ''; // B: 차종
        row.getCell(3).value = parentItem.item_code; // C: 품번
        row.getCell(4).value = parentItem.item_name; // D: 품명
        row.getCell(5).value = parentItem.price || 0; // E: 단가
        row.getCell(5).numFmt = STYLES.NUMBER_INTEGER;
        // F, G: 마감수량, 마감금액 (빈 값)

        // H열: 업체구분 (DB 기반 동적 카테고리 - 새로운 카테고리 자동 지원)
        row.getCell(8).value = firstChild.supplier_category || '';

        // I-L열: 모품목 정보 반복 (피치색 배경)
        row.getCell(9).value = ''; // I: 구매처 (공급사 시트에서는 비워둠)
        row.getCell(10).value = parentItem.vehicle_model || ''; // J: 차종
        row.getCell(11).value = parentItem.item_code; // K: 품번
        row.getCell(12).value = parentItem.item_name; // L: 품명

        // I-L열에 피치색 배경 적용
        for (let col = 9; col <= 12; col++) {
          const cell = row.getCell(col);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: STYLES.PARENT_ROW_BG },
          };
          cell.border = STYLES.BORDER_THIN;
        }

        // I-AE열: 자품목 정보
        fillSupplierChildItemCells(row, firstChild);

        // 테두리 적용
        for (let col = 1; col <= 31; col++) {
          row.getCell(col).border = STYLES.BORDER_THIN;
        }

        currentRow++;

        // ===== 두번째 자품목부터 별도 행 =====
        for (let i = 1; i < childItems.length; i++) {
          const childRow = sheet.getRow(currentRow);
          const child = childItems[i];

          // H열: 업체구분 (DB 기반 동적 카테고리 - 새로운 카테고리 자동 지원)
          childRow.getCell(8).value = child.supplier_category || '';

          // I-AE열: 자품목 정보
          fillSupplierChildItemCells(childRow, child);

          // 테두리 적용
          for (let col = 1; col <= 31; col++) {
            childRow.getCell(col).border = STYLES.BORDER_THIN;
          }

          currentRow++;
        }
      }
    }
  }
}

/**
 * 종합 시트 생성 (모든 BOM 데이터 통합)
 * 고객사별 시트와 동일한 구조로 생성
 */
async function createSummarySheet(
  workbook: ExcelJS.Workbook,
  bomData: ParentBomData[],
  customerSheets: Array<{ id: number; name: string }>,
  suppliers: { company_id: number; company_name: string }[],
  customers: { company_id: number; company_name: string }[]
): Promise<void> {
  const sheet = workbook.addWorksheet('종합');

  // 컬럼 너비 설정 (고객사별 시트와 동일)
  sheet.columns = COLUMN_WIDTHS.map((width, index) => ({
    key: String.fromCharCode(65 + index),
    width: width,
  }));

  // Row 1: 전체 통계 메타데이터
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  sheet.getCell('A1').value = '생성일자';
  sheet.getCell('B1').value = dateStr;
  sheet.getCell('D1').value = '전체 공급사 수';
  sheet.getCell('E1').value = suppliers.length;
  sheet.getCell('G1').value = '전체 고객사 수';
  sheet.getCell('H1').value = customers.length;
  const uniqueParentItems = new Set(bomData.map(p => p.parentItem.item_code)).size;
  sheet.getCell('J1').value = '전체 품목 수';
  sheet.getCell('K1').value = uniqueParentItems;
  sheet.getCell('M1').value = '총 BOM 레코드';
  sheet.getCell('N1').value = bomData.length;

  // 1-5행: 메타 정보 (고객사별 시트와 동일한 위치)
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

  // 7행부터: 모든 BOM 데이터 (고객사별 시트와 동일한 구조)
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
    // F, G: 마감수량, 마감금액 (빈 값)

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
      // H열: 업체구분 (DB 기반 동적 카테고리 - 새로운 카테고리 자동 지원)
      parentRow.getCell(8).value = firstChild.supplier_category || '';
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

      // H열: 업체구분 (DB 기반 동적 카테고리 - 새로운 카테고리 자동 지원)
      childRow.getCell(8).value = child.supplier_category || '';

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
   * 고객사별 시트와 동일한 구조
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

    // O, P: 구매수량, 구매금액 (빈 값)
    
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
 * 최신단가 시트 생성 (원본 Excel과 동일한 구조)
 * 헤더 없음, 1행부터 데이터 시작
 * 형식: | 품번(A) | 단가(B) | 공급사명(C) | 비고(D) |
 */
async function createPriceSheet(workbook: ExcelJS.Workbook, supabase: any): Promise<void> {
  const sheet = workbook.addWorksheet('최신단가');

  // 컬럼 너비 설정 (원본 Excel과 동일)
  sheet.columns = [
    { key: 'item_code', width: 18 },      // A: 품번
    { key: 'unit_price', width: 10 },     // B: 단가
    { key: 'supplier_name', width: 15 },  // C: 공급사명
    { key: 'note', width: 12 },           // D: 비고
  ];

  // DB에서 최신 단가 조회 (items 테이블에서 직접)
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select(`
      item_code,
      price,
      supplier:companies!items_supplier_id_fkey(company_name)
    `)
    .eq('is_active', true)
    .not('price', 'is', null)
    .order('item_code');

  if (itemsError) {
    console.error('[BOM Template] 최신단가 조회 실패:', itemsError);
    return; // 에러 시 빈 시트 유지
  }

  // 데이터가 있으면 시트에 작성 (1행부터, 헤더 없음)
  if (items && items.length > 0) {
    items.forEach((item: any, index: number) => {
      const dataRow = sheet.getRow(index + 1);
      const supplierData = Array.isArray(item.supplier) ? item.supplier[0] : item.supplier;

      dataRow.getCell(1).value = item.item_code || '';                    // A: 품번
      dataRow.getCell(2).value = item.price || 0;                         // B: 단가
      dataRow.getCell(3).value = supplierData?.company_name || '';        // C: 공급사명
      dataRow.getCell(4).value = '';                                      // D: 비고 (빈값)

      // 숫자 포맷 적용
      dataRow.getCell(2).numFmt = '#,##0';
    });
  }
  // 데이터가 없으면 빈 시트 유지
}

/**
 * BOM 데이터를 모품목별로 그룹핑
 */
function groupBomByParent(bomRows: BomChildItem[]): ParentBomData[] {
  const parentMap = new Map<number, ParentBomData>();

  bomRows.forEach((row) => {
    // parent_item null 체크
    if (!row.parent_item) {
      console.warn(`[BOM Template] parent_item이 null인 BOM 건너뜀: bom_id=${row.bom_id}`);
      return;
    }

    // 필수 필드(item_code, item_name) 체크
    if (!row.parent_item.item_code || !row.parent_item.item_name) {
      console.warn(`[BOM Template] parent_item 필수 필드 누락: bom_id=${row.bom_id}, item_code=${row.parent_item.item_code}, item_name=${row.parent_item.item_name}`);
      return;
    }

    const parentId = row.parent_item_id;

    if (!parentMap.has(parentId)) {
      parentMap.set(parentId, {
        parentItem: {
          // null 체크 및 기본값 처리
          item_code: row.parent_item.item_code || '',
          item_name: row.parent_item.item_name || '',
          vehicle_model: row.parent_item.vehicle_model || null,
          price: row.parent_item.price || null,
        },
        childItems: [],
        bomId: row.bom_id,  // BOM ID 저장 (첫 번째 - 호환성)
        parentItemId: parentId,  // parent_item_id 저장 (고객사 매핑용)
        customerNames: [],  // 고객사 배열 초기화
      });
    }

    const parentGroup = parentMap.get(parentId)!;
    const supplierName = row.supplier?.company_name || '';
    const companyCategory = row.supplier?.company_category || null;
    // supplierName을 2순위로 전달하여 동적 카테고리 지원
    const supplierCategory = getSupplierCategory(companyCategory, supplierName);

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

    // 공급사 목록 조회
    const { data: suppliers, error: suppliersError } = await supabase
      .from('companies')
      .select('company_id, company_name')
      .eq('company_type', '공급사')
      .eq('is_active', true)
      .order('company_name');

    if (suppliersError) {
      console.error('Error fetching suppliers:', suppliersError);
    }

    // 고객사 목록 조회
    const { data: customers, error: customersError } = await supabase
      .from('companies')
      .select('company_id, company_name')
      .eq('company_type', '고객사')
      .eq('is_active', true)
      .order('company_name');

    if (customersError) {
      console.error('Error fetching customers:', customersError);
    }

    // 디버깅: customers 쿼리 결과 확인
    console.log('[BOM Template] DB customers 쿼리 결과:', customers?.length, '건');
    if (customers) {
      console.log('[BOM Template] customers 전체 목록:', customers.map(c => c.company_name));
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

    // 디버깅: BOM 데이터 샘플 확인 (처음 5개)
    if (bomData && bomData.length > 0) {
      console.log('[BOM Template] BOM 데이터 샘플 (처음 5개):');
      bomData.slice(0, 5).forEach((b: any, idx: number) => {
        console.log(`  [${idx}] bom_id=${b.bom_id}, parent_item_id=${b.parent_item_id}, parent_item=${JSON.stringify(b.parent_item)?.substring(0, 100)}`);
      });

      // parent_item이 null인 항목 수 확인
      const nullParentCount = bomData.filter((b: any) => !b.parent_item).length;
      const nullCodeCount = bomData.filter((b: any) => b.parent_item && (!b.parent_item.item_code || !b.parent_item.item_name)).length;
      console.log(`[BOM Template] parent_item null 항목: ${nullParentCount}건, item_code/item_name 누락: ${nullCodeCount}건`);
    }

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

      const { data: suppliers } = supplierIds.length > 0
        ? await supabase
            .from('companies')
            .select('company_id, company_name, company_category')
            .in('company_id', supplierIds)
        : { data: [] };

      const supplierMap = new Map(
        (suppliers || []).map((s: any) => [s.company_id, s])
      );

      bomWithSuppliers = bomData.map((b: any) => {
        // parent_item 배열 처리 및 null 체크
        let parentItem = Array.isArray(b.parent_item) ? b.parent_item[0] : b.parent_item;
        if (!parentItem) {
          console.warn(`[BOM Template] parent_item이 null: bom_id=${b.bom_id}`);
          parentItem = null;
        } else if (!parentItem.item_code || !parentItem.item_name) {
          console.warn(`[BOM Template] parent_item 필드 누락: bom_id=${b.bom_id}, item_code=${parentItem.item_code}, item_name=${parentItem.item_name}`);
        }

        // child_item 배열 처리 및 null 체크
        let childItem = Array.isArray(b.child_item) ? b.child_item[0] : b.child_item;
        if (!childItem) {
          console.warn(`[BOM Template] child_item이 null: bom_id=${b.bom_id}`);
          childItem = null;
        }

        return {
          ...b,
          parent_item: parentItem,
          child_item: childItem,
          supplier: childItem?.supplier_id
            ? supplierMap.get(childItem.supplier_id) || null
            : null,
        };
      });

      console.log('[BOM Template] bomWithSuppliers 매핑 완료:', bomWithSuppliers.length, '건');
    }

    // 모품목별 그룹핑
    const groupedBomData = groupBomByParent(bomWithSuppliers);
    console.log('[BOM Template] 모품목 그룹 수:', groupedBomData.length, '개');

    // customer_bom_templates + bom 테이블 조인하여 parent_item_id → 고객사명[] 매핑 생성
    // 핵심 수정: 하나의 parent_item_id에 여러 bom_id가 있고, 각 bom_id가 다른 고객사와 연결될 수 있음
    const { data: customerBomTemplates, error: templateError } = await supabase
      .from('customer_bom_templates')
      .select(`
        bom_id,
        customer_id,
        customer:companies!customer_bom_templates_customer_id_fkey (
          company_id,
          company_name
        ),
        bom:bom!customer_bom_templates_bom_id_fkey (
          bom_id,
          parent_item_id
        )
      `);

    if (templateError) {
      console.error('[BOM Template] Error fetching customer_bom_templates:', templateError);
    }

    // parent_item_id → 고객사 ID+이름 매핑 생성 (ID 기반 매핑으로 개선)
    const parentItemToCustomersMap = new Map<number, Map<number, string>>();
    if (customerBomTemplates && customerBomTemplates.length > 0) {
      customerBomTemplates.forEach((template: any) => {
        const customer = Array.isArray(template.customer) ? template.customer[0] : template.customer;
        const bom = Array.isArray(template.bom) ? template.bom[0] : template.bom;

        if (customer?.company_id && customer?.company_name && bom?.parent_item_id) {
          const parentItemId = bom.parent_item_id;
          const customerId = customer.company_id;
          const customerName = customer.company_name;

          if (!parentItemToCustomersMap.has(parentItemId)) {
            parentItemToCustomersMap.set(parentItemId, new Map<number, string>());
          }
          parentItemToCustomersMap.get(parentItemId)!.set(customerId, customerName);
        }
      });
      console.log('[BOM Template] parent_item_id → 고객사 매핑:', parentItemToCustomersMap.size, '개 부모품목');

      // 디버깅: 다중 고객사 매핑된 부모품목만 출력 (로그 축소)
      let totalMappings = 0;
      parentItemToCustomersMap.forEach((customers, parentId) => {
        totalMappings += customers.size;
        if (customers.size > 1) {
          const customerList = Array.from(customers.entries()).map(([id, name]) => `${name}(${id})`).join(', ');
          console.log(`[BOM Template] parent_item_id ${parentId}: ${customers.size}개 고객사 - [${customerList}]`);
        }
      });
      console.log(`[BOM Template] 총 매핑 수: ${totalMappings}개 (부모품목-고객사 쌍)`);
    }

    // groupedBomData에 고객사 ID+이름 배열 매핑 (ID 기반 매핑으로 개선)
    let mappedCount = 0;
    groupedBomData.forEach((bomGroup) => {
      if (bomGroup.parentItemId && parentItemToCustomersMap.has(bomGroup.parentItemId)) {
        const customerMap = parentItemToCustomersMap.get(bomGroup.parentItemId)!;
        bomGroup.customerIds = Array.from(customerMap.keys());
        bomGroup.customerNames = Array.from(customerMap.values());
        bomGroup.customerId = bomGroup.customerIds[0]; // 하위 호환성 유지
        bomGroup.customerName = bomGroup.customerNames[0]; // 하위 호환성 유지
        mappedCount++;
      }
    });
    console.log(`[BOM Template] ${mappedCount}/${groupedBomData.length} 개 BOM에 고객사 매핑됨`);

    // ✅ DB companies 테이블 + parentItemToCustomersMap 병합하여 고객사 시트 목록 생성
    // (DB에 없지만 customer_bom_templates에 매핑된 고객사도 시트 생성)
    const customerSheetMap = new Map<number, string>();

    // 1. DB companies 테이블에서 고객사 추가
    (customers ?? []).forEach(c => {
      const id = typeof c.company_id === 'string' ? Number(c.company_id) : c.company_id;
      const name = c.company_name?.replace(/\s+/g, ' ').trim() || '';
      if (Number.isFinite(id) && name.length > 0) {
        customerSheetMap.set(id, name);
      }
    });

    // 2. parentItemToCustomersMap에서 추가 고객사 병합 (DB에 없는 경우만)
    parentItemToCustomersMap.forEach(customerMap => {
      customerMap.forEach((rawName, rawId) => {
        const id = typeof rawId === 'string' ? Number(rawId) : rawId;
        const name = rawName?.replace(/\s+/g, ' ').trim() || '';
        if (!customerSheetMap.has(id) && Number.isFinite(id) && name.length > 0) {
          customerSheetMap.set(id, name);
          console.log(`[BOM Template] 추가 고객사 발견 (customer_bom_templates에서): ${name}(${id})`);
        }
      });
    });

    // 3. 고정 고객사 시트 순서 (사용자 요청에 따른 고정 구조)
    const FIXED_CUSTOMER_ORDER = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];

    // 고정 순서에 맞게 고객사 시트 정렬 (목록에 없는 고객사는 제외됨)
    const customerSheets: Array<{ id: number; name: string }> = [];
    for (const fixedName of FIXED_CUSTOMER_ORDER) {
      for (const [id, name] of customerSheetMap.entries()) {
        if (name.replace(/\s+/g, ' ').trim() === fixedName) {
          customerSheets.push({ id, name });
          break;
        }
      }
    }

    console.log(`[BOM Template] DB 고객사 시트 생성 대상: ${customerSheets.length}개`);
    if (customerSheets.length > 0) {
      console.log('[BOM Template] 고객사 목록:', customerSheets.map(c => `${c.name}(${c.id})`).join(', '));
    }

    // ExcelJS 워크북 생성
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '태창 ERP';
    workbook.created = new Date();

    // 시트명 중복 방지를 위한 Set
    const usedSheetNames = new Set<string>();

    // 1. 종합 시트 (전체 BOM - 공급사 + 고객사 모두 포함)
    await createSummarySheet(workbook, groupedBomData, customerSheets, suppliers || [], customers || []);
    usedSheetNames.add('종합');

    // 2. 고객사별 개별 시트 생성 (ID 기반 매칭)
    console.log(`[BOM Template] ${customerSheets.length}개 고객사 시트 생성 시작`);
    for (const customer of customerSheets) {
      // 디버깅: 각 고객사별 매핑된 BOM 수 확인
      const matchingBoms = groupedBomData.filter(bom =>
        bom.customerIds?.includes(customer.id) ||
        bom.customerNames?.includes(customer.name)
      );
      console.log(`[BOM Template] 고객사 '${customer.name}'(ID:${customer.id}) - 매핑된 BOM: ${matchingBoms.length}개`);

      await createCustomerSheet(workbook, customer.name, groupedBomData, usedSheetNames, groupedBomData, customer.id);
    }

    // 3. 월별 단가 시트 생성
    await createPriceSheet(workbook, supabase);

    // Excel 버퍼 생성
    const buffer = await workbook.xlsx.writeBuffer();

    // 응답 반환 (파일명은 프론트엔드에서 설정)
    // ExcelJS writeBuffer()는 Buffer를 반환하며 NextResponse가 직접 처리
    // 한글 파일명은 RFC 5987 형식으로 인코딩
    const filename = 'BOM_템플릿.xlsx';
    const encodedFilename = encodeURIComponent(filename);
    
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="BOM_template.xlsx"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('[BOM Template] 오류 발생:', error);
    if (error instanceof Error) {
      console.error('[BOM Template] 오류 메시지:', error.message);
      console.error('[BOM Template] 오류 스택:', error.stack);
    }
    return NextResponse.json(
      {
        success: false,
        error: 'Excel 템플릿 생성에 실패했습니다',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}


