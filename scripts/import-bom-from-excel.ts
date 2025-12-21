import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

interface ExcelRow {
  납품처?: string;
  차종?: string;
  품번?: string;
  품명?: string;
  단가?: string;
  마감수량?: string;
  마감금액?: string;
  구매처?: string;
  '차종.1'?: string;
  '품번.1'?: string;
  '품명.1'?: string;
  'U/S'?: string;
  '단가.1'?: string;
  구매수량?: string;
  구매금액?: string;
  비고?: string;
  KG단가?: string;
  단품단가?: string;
  재질?: string;
  두께?: string;
  폭?: string;
  길이?: string;
  SEP?: string;
  비중?: string;
  EA중량?: string;
  실적수량?: string;
  스크랩중량?: string;
  스크랩단가?: string;
  스크랩금액?: string;
}

async function findItemId(itemCode: string, itemName?: string): Promise<number | null> {
  if (!itemCode || itemCode.trim() === '') {
    return null;
  }

  // 먼저 item_code로 찾기
  const { data, error } = await supabase
    .from('items')
    .select('item_id')
    .eq('item_code', itemCode.trim())
    .single();

  if (!error && data) {
    return data.item_id;
  }

  // item_code로 못 찾으면 item_name으로 찾기
  if (itemName && itemName.trim() !== '') {
    const { data: dataByName, error: errorByName } = await supabase
      .from('items')
      .select('item_id')
      .eq('item_name', itemName.trim())
      .single();

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

  const { data, error } = await supabase
    .from('companies')
    .select('company_id')
    .eq('company_name', companyName.trim())
    .single();

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

  const str = String(value).trim().replace(/,/g, '');
  const num = parseFloat(str);
  
  return isNaN(num) ? null : num;
}

async function importBOMFromExcel() {
  const excelPath = path.join(process.cwd(), '.example', '(추가)BOM 종합 - ERP (1).xlsx');
  
  if (!fs.existsSync(excelPath)) {
    console.error(`Excel 파일을 찾을 수 없습니다: ${excelPath}`);
    return;
  }

  console.log('Excel 파일 읽기 중...');
  const workbook = XLSX.readFile(excelPath);
  const sheetName = '종합';
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    console.error(`시트 '${sheetName}'를 찾을 수 없습니다.`);
    return;
  }

  // Excel 데이터를 JSON으로 변환
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    defval: '',
    raw: false
  }).slice(5) as ExcelRow[]; // 헤더 6행 제외 (0-5행)

  console.log(`총 ${rows.length}행의 데이터를 처리합니다.`);

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // 현재 parent 정보를 추적하기 위한 변수
  let currentParentItemCode: string | null = null;
  let currentParentItemName: string | null = null;
  let currentCustomerName: string | null = null;
  let currentCarModel: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as any;
    const rowNumber = i + 7; // 실제 Excel 행 번호 (헤더 포함)

    try {
      // 빈 행 건너뛰기
      if (!row[2] && !row[3] && !row[10] && !row[11]) {
        continue;
      }

      // Parent 정보 추출 (납품처가 있으면 새로운 parent)
      const 납품처 = row[0]?.trim();
      const parent차종 = row[1]?.trim();
      const parent품번 = row[2]?.trim();
      const parent품명 = row[3]?.trim();

      // Child 정보 추출
      const 구매처 = row[8]?.trim();
      const child차종 = row[9]?.trim();
      const child품번 = row[10]?.trim();
      const child품명 = row[11]?.trim();
      const usage = row[12]?.trim(); // U/S

      // Parent 정보 업데이트
      if (납품처 && parent품번) {
        currentCustomerName = 납품처;
        currentCarModel = parent차종;
        currentParentItemCode = parent품번;
        currentParentItemName = parent품명;
      }

      // Child 정보가 없으면 건너뛰기
      if (!child품번 || child품번 === '') {
        continue;
      }

      // Parent 정보가 없으면 건너뛰기
      if (!currentParentItemCode || currentParentItemCode === '') {
        continue;
      }

      // Parent item ID 찾기
      const parentItemId = await findItemId(currentParentItemCode, currentParentItemName ?? undefined);
      if (!parentItemId) {
        errors.push(`행 ${rowNumber}: 부모 품목을 찾을 수 없습니다 (품번: ${currentParentItemCode})`);
        errorCount++;
        continue;
      }

      // Child item ID 찾기
      const childItemId = await findItemId(child품번, child품명);
      if (!childItemId) {
        errors.push(`행 ${rowNumber}: 자식 품목을 찾을 수 없습니다 (품번: ${child품번})`);
        errorCount++;
        continue;
      }

      // Quantity 파싱
      const quantity = parseNumber(usage) || 1; // 기본값 1
      if (quantity <= 0) {
        errors.push(`행 ${rowNumber}: 소요량이 유효하지 않습니다 (${usage})`);
        errorCount++;
        continue;
      }

      // Customer ID 찾기
      let customerId: number | null = null;
      if (currentCustomerName) {
        customerId = await findCompanyId(currentCustomerName);
      }

      // Supplier ID 찾기
      let childSupplierId: number | null = null;
      if (구매처) {
        childSupplierId = await findCompanyId(구매처);
      }

      // BOM 데이터 삽입
      const bomData: Database['public']['Tables']['bom']['Insert'] = {
        parent_item_id: parentItemId,
        child_item_id: childItemId,
        quantity_required: quantity,
        level_no: 1,
        customer_id: customerId,
        child_supplier_id: childSupplierId,
        is_active: true,
        notes: row[16]?.trim() || null // 비고
      };

      const { error: insertError } = await supabase
        .from('bom')
        .insert(bomData);

      if (insertError) {
        errors.push(`행 ${rowNumber}: ${insertError.message}`);
        errorCount++;
      } else {
        successCount++;
        if (successCount % 100 === 0) {
          console.log(`${successCount}개 BOM 레코드 삽입 완료...`);
        }
      }
    } catch (error) {
      errors.push(`행 ${rowNumber}: ${error instanceof Error ? error.message : String(error)}`);
      errorCount++;
    }
  }

  console.log('\n=== 결과 ===');
  console.log(`성공: ${successCount}개`);
  console.log(`실패: ${errorCount}개`);

  if (errors.length > 0) {
    console.log('\n=== 오류 목록 ===');
    errors.slice(0, 50).forEach(err => console.log(err));
    if (errors.length > 50) {
      console.log(`... 외 ${errors.length - 50}개 오류`);
    }
  }
}

// 스크립트 실행
importBOMFromExcel()
  .then(() => {
    console.log('\n완료되었습니다.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('오류 발생:', error);
    process.exit(1);
  });
