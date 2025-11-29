/**
 * Excel 파일에서 읽은 BOM 로우 데이터를 DB에 추가하는 스크립트
 * 
 * Excel MCP 도구로 읽은 데이터를 사용하여 BOM 테이블에 직접 삽입합니다.
 * 로우 데이터만 추가합니다 (items와 companies 테이블의 ID를 조회하여 사용).
 */

// Excel에서 읽은 원시 데이터 타입
type ExcelRow = (string | number | null)[];

interface ParsedBOMRow {
  rowNumber: number;
  parentSupplier?: string;
  parentCarModel?: string;
  parentItemCode?: string;
  parentItemName?: string;
  childSupplierType?: string;
  childSupplierName?: string;
  childCarModel?: string;
  childItemCode?: string;
  childItemName?: string;
  quantity?: string | number;
}

// Excel 데이터를 파싱하는 함수
function parseExcelData(excelRows: ExcelRow[]): ParsedBOMRow[] {
  const bomRows: ParsedBOMRow[] = [];
  let currentParent: {
    supplier?: string;
    carModel?: string;
    itemCode?: string;
    itemName?: string;
  } | null = null;

  // 헤더 행(7번째 행, 인덱스 6) 이후부터 처리
  for (let i = 0; i < excelRows.length; i++) {
    const row = excelRows[i];
    const rowNumber = i + 7; // Excel 행 번호 (헤더 포함)

    // 빈 행 건너뛰기
    if (!row || row.length < 13) {
      continue;
    }

    // Excel 열 매핑 (0-based index)
    const parentSupplier = row[0] ? String(row[0]).trim() : '';
    const parentCarModel = row[1] ? String(row[1]).trim() : '';
    const parentItemCode = row[2] ? String(row[2]).trim() : '';
    const parentItemName = row[3] ? String(row[3]).trim() : '';
    const childSupplierType = row[7] ? String(row[7]).trim() : '';
    const childSupplierName = row[8] ? String(row[8]).trim() : '';
    const childCarModel = row[9] ? String(row[9]).trim() : '';
    const childItemCode = row[10] ? String(row[10]).trim() : '';
    const childItemName = row[11] ? String(row[11]).trim() : '';
    const quantity = row[12] ? String(row[12]).trim() : '';

    // Parent 정보 업데이트 (supplier와 itemCode가 있으면)
    if (parentSupplier && parentItemCode) {
      currentParent = {
        supplier: parentSupplier,
        carModel: parentCarModel,
        itemCode: parentItemCode,
        itemName: parentItemName,
      };
    }

    // Child 정보가 없으면 건너뛰기
    if (!childItemCode || childItemCode === '') {
      continue;
    }

    // Parent 정보가 없으면 건너뛰기
    if (!currentParent || !currentParent.itemCode) {
      continue;
    }

    bomRows.push({
      rowNumber,
      parentSupplier: currentParent.supplier,
      parentCarModel: currentParent.carModel,
      parentItemCode: currentParent.itemCode,
      parentItemName: currentParent.itemName,
      childSupplierType,
      childSupplierName,
      childCarModel,
      childItemCode,
      childItemName,
      quantity,
    });
  }

  return bomRows;
}

// 숫자 파싱 함수
function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  const str = String(value).trim().replace(/,/g, '').replace(/\s/g, '');
  const num = parseFloat(str);

  return isNaN(num) ? null : num;
}

// Excel 데이터 (Excel MCP 도구로 읽은 데이터를 여기에 넣어야 함)
// 실제 실행 시에는 Excel MCP 도구로 읽은 데이터를 사용
const excelData: ExcelRow[] = [
  // 예시 데이터 구조:
  // [parentSupplier, parentCarModel, parentItemCode, parentItemName, ...,
  //  childSupplierType, childSupplierName, childCarModel, childItemCode, childItemName, quantity, ...]
];

// 메인 실행 함수
async function main() {
  try {
    console.log('Excel 데이터 파싱 중...');
    const bomRows = parseExcelData(excelData);

    if (bomRows.length === 0) {
      console.log('처리할 BOM 데이터가 없습니다.');
      return;
    }

    console.log(`총 ${bomRows.length}개의 BOM 레코드를 찾았습니다.`);
    console.log('\n처음 5개 레코드 샘플:');
    bomRows.slice(0, 5).forEach((row, idx) => {
      console.log(
        `${idx + 1}. Parent: ${row.parentItemCode} (${row.parentItemName}) -> Child: ${row.childItemCode} (${row.childItemName}), Qty: ${row.quantity}`
      );
    });

    console.log('\n이 스크립트는 Excel 데이터를 파싱하는 함수만 제공합니다.');
    console.log('실제 DB 삽입은 Supabase MCP를 사용하여 수행해야 합니다.');
    console.log('\n파싱된 데이터를 사용하여 다음 단계를 수행하세요:');
    console.log('1. items 테이블에서 parent_item_id와 child_item_id 조회');
    console.log('2. companies 테이블에서 customer_id와 child_supplier_id 조회');
    console.log('3. bom 테이블에 데이터 삽입');
  } catch (error) {
    console.error('오류 발생:', error);
    throw error;
  }
}

// 직접 실행 시
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('스크립트 실행 중 오류:', error);
      process.exit(1);
    });
}

export { parseExcelData, parseNumber, ParsedBOMRow };

