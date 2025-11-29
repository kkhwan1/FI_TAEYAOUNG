/**
 * Excel 파일에서 BOM 로우데이터를 DB에 추가하는 스크립트
 * 
 * 사용법:
 * npx tsx scripts/import-bom-data.ts
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { Database } from '@/types/supabase';

// Excel 데이터 구조 (이미 읽은 데이터 기반)
interface BOMRow {
  rowNumber: number;
  납품처?: string;
  parent차종?: string;
  parent품번?: string;
  parent품명?: string;
  구매처?: string;
  child차종?: string;
  child품번?: string;
  child품명?: string;
  usage?: string; // U/S
  비고?: string;
}

async function findItemId(itemCode: string, itemName?: string): Promise<number | null> {
  if (!itemCode || itemCode.trim() === '') {
    return null;
  }

  // 먼저 item_code로 찾기
  const { data, error } = await supabaseAdmin
    .from('items')
    .select('item_id')
    .eq('item_code', itemCode.trim())
    .maybeSingle();

  if (!error && data) {
    return data.item_id;
  }

  // item_code로 못 찾으면 item_name으로 찾기
  if (itemName && itemName.trim() !== '') {
    const { data: dataByName, error: errorByName } = await supabaseAdmin
      .from('items')
      .select('item_id')
      .eq('item_name', itemName.trim())
      .maybeSingle();

    if (!errorByName && dataByName) {
      return dataByName.item_id;
    }
  }

  return null;
}

async function findCompanyId(companyName: string): Promise<number | null> {
  if (!companyName || companyName.trim() === '') {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('company_id')
    .eq('company_name', companyName.trim())
    .maybeSingle();

  if (!error && data) {
    return data.company_id;
  }

  return null;
}

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

// Excel에서 읽은 데이터를 파싱하여 BOM 행 배열로 변환
function parseExcelData(excelData: any[]): BOMRow[] {
  const bomRows: BOMRow[] = [];
  let currentParent: { 납품처?: string; 차종?: string; 품번?: string; 품명?: string } | null = null;

  for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];
    const rowNumber = i + 7; // Excel 행 번호 (헤더 포함)

    // 빈 행 건너뛰기
    if (!row || (!row[2] && !row[3] && !row[10] && !row[11])) {
      continue;
    }

    const 납품처 = row[0]?.trim();
    const parent차종 = row[1]?.trim();
    const parent품번 = row[2]?.trim();
    const parent품명 = row[3]?.trim();
    const 구매처 = row[8]?.trim();
    const child차종 = row[9]?.trim();
    const child품번 = row[10]?.trim();
    const child품명 = row[11]?.trim();
    const usage = row[12]?.trim();
    const 비고 = row[16]?.trim();

    // Parent 정보 업데이트
    if (납품처 && parent품번) {
      currentParent = {
        납품처,
        차종: parent차종,
        품번: parent품번,
        품명: parent품명
      };
    }

    // Child 정보가 없으면 건너뛰기
    if (!child품번 || child품번 === '') {
      continue;
    }

    // Parent 정보가 없으면 건너뛰기
    if (!currentParent || !currentParent.품번) {
      continue;
    }

    bomRows.push({
      rowNumber,
      납품처: currentParent.납품처,
      parent차종: currentParent.차종,
      parent품번: currentParent.품번,
      parent품명: currentParent.품명,
      구매처,
      child차종,
      child품번,
      child품명,
      usage,
      비고
    });
  }

  return bomRows;
}

async function importBOMData(bomRows: BOMRow[]) {
  console.log(`총 ${bomRows.length}개의 BOM 레코드를 처리합니다.`);

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];
  const bomDataToInsert: Database['public']['Tables']['bom']['Insert'][] = [];

  // 배치로 처리하기 위해 먼저 모든 데이터를 준비
  for (const row of bomRows) {
    try {
      // Parent item ID 찾기
      const parentItemId = await findItemId(row.parent품번 || '', row.parent품명);
      if (!parentItemId) {
        errors.push(`행 ${row.rowNumber}: 부모 품목을 찾을 수 없습니다 (품번: ${row.parent품번})`);
        errorCount++;
        continue;
      }

      // Child item ID 찾기
      const childItemId = await findItemId(row.child품번 || '', row.child품명);
      if (!childItemId) {
        errors.push(`행 ${row.rowNumber}: 자식 품목을 찾을 수 없습니다 (품번: ${row.child품번})`);
        errorCount++;
        continue;
      }

      // Quantity 파싱
      const quantity = parseNumber(row.usage) || 1;
      if (quantity <= 0) {
        errors.push(`행 ${row.rowNumber}: 소요량이 유효하지 않습니다 (${row.usage})`);
        errorCount++;
        continue;
      }

      // Customer ID 찾기
      let customerId: number | null = null;
      if (row.납품처) {
        customerId = await findCompanyId(row.납품처);
      }

      // Supplier ID 찾기
      let childSupplierId: number | null = null;
      if (row.구매처) {
        childSupplierId = await findCompanyId(row.구매처);
      }

      bomDataToInsert.push({
        parent_item_id: parentItemId,
        child_item_id: childItemId,
        quantity_required: quantity,
        level_no: 1,
        customer_id: customerId,
        child_supplier_id: childSupplierId,
        is_active: true,
        notes: row.비고 || null
      });
    } catch (error) {
      errors.push(`행 ${row.rowNumber}: ${error instanceof Error ? error.message : String(error)}`);
      errorCount++;
    }
  }

  // 배치로 삽입 (한 번에 최대 1000개씩)
  const batchSize = 1000;
  for (let i = 0; i < bomDataToInsert.length; i += batchSize) {
    const batch = bomDataToInsert.slice(i, i + batchSize);
    
    const { error: insertError } = await supabaseAdmin
      .from('bom')
      .insert(batch);

    if (insertError) {
      console.error(`배치 ${Math.floor(i / batchSize) + 1} 삽입 실패:`, insertError.message);
      errorCount += batch.length;
    } else {
      successCount += batch.length;
      console.log(`${successCount}개 BOM 레코드 삽입 완료...`);
    }
  }

  console.log('\n=== 결과 ===');
  console.log(`성공: ${successCount}개`);
  console.log(`실패: ${errorCount}개`);

  if (errors.length > 0) {
    console.log('\n=== 오류 목록 (최대 50개) ===');
    errors.slice(0, 50).forEach(err => console.log(err));
    if (errors.length > 50) {
      console.log(`... 외 ${errors.length - 50}개 오류`);
    }
  }
}

// Excel 데이터 (실제 Excel 파일에서 읽은 데이터를 여기에 넣어야 함)
// 이 부분은 Excel MCP 도구를 사용하여 읽은 데이터로 대체해야 합니다
const excelData: any[] = []; // Excel에서 읽은 원시 데이터

// 메인 실행 함수
async function main() {
  try {
    // Excel 데이터를 파싱
    const bomRows = parseExcelData(excelData);
    
    // BOM 데이터 삽입
    await importBOMData(bomRows);
    
    console.log('\n완료되었습니다.');
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

export { parseExcelData, importBOMData, findItemId, findCompanyId };





