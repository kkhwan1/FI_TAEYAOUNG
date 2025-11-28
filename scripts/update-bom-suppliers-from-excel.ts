/**
 * 기존 BOM 데이터의 child_supplier_id 업데이트 스크립트
 * 
 * Excel 파일을 재파싱하여 구매처명을 추출하고,
 * 기존 BOM 데이터의 child_supplier_id를 업데이트합니다.
 */

import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  getCustomerMappingFromDB,
  getSupplierMappingFromDB,
  getSupplierId,
} from './company-mappings';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface ExcelBOM {
  parent_item_code: string;
  child_item_code: string;
  customer_id: number;
  supplier_name: string;
  supplier_id: number | null;
}

// Excel 파일에서 BOM과 구매처명 추출
async function parseExcelFile(
  filePath: string,
  customerMapping: Record<string, number>,
  supplierMapping: Record<string, number>
): Promise<ExcelBOM[]> {
  console.log(`Reading Excel file: ${filePath}`);
  const workbook = XLSX.readFile(filePath);

  const excelBoms: ExcelBOM[] = [];

  // 각 시트 처리 (종합 시트 제외)
  for (const sheetName of workbook.SheetNames) {
    if (sheetName === '종합') continue;

    const customerId = customerMapping[sheetName];
    if (!customerId) {
      console.warn(`Unknown customer sheet: ${sheetName}`);
      continue;
    }

    console.log(`\nProcessing sheet: ${sheetName} (customer_id: ${customerId})`);

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any>(sheet, { range: 5 }); // 6행부터 시작

    let currentParentCode: string | null = null;

    for (const row of data) {
      const 납품처 = row['납품처'];
      const 품번 = row['품번'];
      const 구매처명 = row['구매처'];
      const 품번_구매 = row['품번_1'] || row['품번'];
      const 구매처카테고리 = row[''] || row['__EMPTY'];

      // 상위 품목 (납품처가 있는 행)
      if (납품처 && 품번) {
        currentParentCode = String(품번).trim();
      }

      // 하위 품목 (납품처가 없고, 품번_1이 있는 행)
      const isChildRow = !납품처 && (품번_구매 || (구매처명 && 구매처카테고리));
      if (isChildRow && 품번_구매 && currentParentCode) {
        const childCode = String(품번_구매).trim();
        const 구매처명_값 = String(구매처명 || '').trim();
        const supplierId = getSupplierId(구매처명_값, supplierMapping);

        if (구매처명_값 && !supplierId) {
          console.warn(`  ⚠️  구매처명 매핑 실패: "${구매처명_값}" (parent: ${currentParentCode}, child: ${childCode})`);
        }

        excelBoms.push({
          parent_item_code: currentParentCode,
          child_item_code: childCode,
          customer_id: customerId,
          supplier_name: 구매처명_값,
          supplier_id: supplierId,
        });
      }
    }
  }

  console.log(`\nTotal Excel BOM entries: ${excelBoms.length}`);
  return excelBoms;
}

// DB에서 기존 BOM 데이터 조회
async function fetchExistingBOMs(): Promise<Map<string, number>> {
  console.log('\n=== Fetching existing BOMs ===');
  
  const { data: boms, error } = await supabase
    .from('bom')
    .select(`
      bom_id,
      parent_item_id,
      child_item_id,
      customer_id,
      parent:items!bom_parent_item_id_fkey(item_code),
      child:items!bom_child_item_id_fkey(item_code)
    `)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching BOMs:', error);
    throw error;
  }

  // 매칭 키: parent_code-child_code-customer_id -> bom_id
  const bomMap = new Map<string, number>();
  
  for (const bom of boms || []) {
    const parentCode = (bom.parent as any)?.item_code;
    const childCode = (bom.child as any)?.item_code;
    if (parentCode && childCode) {
      const key = `${parentCode}-${childCode}-${bom.customer_id}`;
      bomMap.set(key, bom.bom_id);
    }
  }

  console.log(`Found ${bomMap.size} existing BOMs`);
  return bomMap;
}

// BOM의 child_supplier_id 업데이트
async function updateBOMSuppliers(
  excelBoms: ExcelBOM[],
  bomMap: Map<string, number>
): Promise<void> {
  console.log('\n=== Updating BOM Suppliers ===');

  // 현재 상태 백업 (SELECT로 현재 값 저장)
  const bomIds = Array.from(bomMap.values());
  const { data: currentBoms, error: fetchError } = await supabase
    .from('bom')
    .select('bom_id, child_supplier_id')
    .in('bom_id', bomIds);

  if (fetchError) {
    console.error('Error fetching current BOM states:', fetchError);
    throw fetchError;
  }

  const backup = new Map<number, number | null>();
  for (const bom of currentBoms || []) {
    backup.set(bom.bom_id, bom.child_supplier_id);
  }
  console.log(`Backed up ${backup.size} BOM states`);

  // Excel BOM과 DB BOM 매칭 및 업데이트 준비
  const updates: Array<{ bom_id: number; supplier_id: number | null; supplier_name: string }> = [];
  let matchedCount = 0;
  let unmatchedCount = 0;
  const unmatchedSuppliers = new Set<string>();

  for (const excelBom of excelBoms) {
    const key = `${excelBom.parent_item_code}-${excelBom.child_item_code}-${excelBom.customer_id}`;
    const bomId = bomMap.get(key);

    if (!bomId) {
      unmatchedCount++;
      continue;
    }

    matchedCount++;

    // supplier_id가 있는 경우만 업데이트 (NULL로 설정하는 것은 제외)
    if (excelBom.supplier_id !== null) {
      updates.push({
        bom_id: bomId,
        supplier_id: excelBom.supplier_id,
        supplier_name: excelBom.supplier_name,
      });
    } else if (excelBom.supplier_name) {
      unmatchedSuppliers.add(excelBom.supplier_name);
    }
  }

  console.log(`\nMatched BOMs: ${matchedCount}`);
  console.log(`Unmatched BOMs: ${unmatchedCount}`);
  console.log(`BOMs to update: ${updates.length}`);
  
  if (unmatchedSuppliers.size > 0) {
    console.log(`\n⚠️  매핑되지 않은 구매처명 (${unmatchedSuppliers.size}개):`);
    Array.from(unmatchedSuppliers).sort().forEach(name => {
      console.log(`  - ${name}`);
    });
  }

  if (updates.length === 0) {
    console.log('\nNo updates needed.');
    return;
  }

  // 배치 업데이트 (효율성을 위해 여러 BOM을 한 번에 업데이트)
  let updatedCount = 0;
  let errorCount = 0;

  // Supabase는 배치 업데이트를 지원하지 않으므로, 개별 업데이트를 병렬로 처리
  const updatePromises = updates.map(async (update) => {
    const { error } = await supabase
      .from('bom')
      .update({ child_supplier_id: update.supplier_id })
      .eq('bom_id', update.bom_id);

    if (error) {
      console.error(`Error updating BOM ${update.bom_id} (${update.supplier_name}):`, error);
      return false;
    }
    return true;
  });

  // 병렬 처리 (동시에 최대 10개씩)
  const batchSize = 10;
  for (let i = 0; i < updatePromises.length; i += batchSize) {
    const batch = updatePromises.slice(i, i + batchSize);
    const results = await Promise.all(batch);
    results.forEach(success => {
      if (success) updatedCount++;
      else errorCount++;
    });
    
    if ((i + batchSize) % 50 === 0 || i + batchSize >= updatePromises.length) {
      console.log(`Progress: ${Math.min(i + batchSize, updatePromises.length)}/${updatePromises.length} updated`);
    }
  }

  console.log(`\n=== Update Complete ===`);
  console.log(`Successfully updated: ${updatedCount}`);
  console.log(`Errors: ${errorCount}`);
}

// 메인 실행
async function main() {
  const excelPath = path.join(
    __dirname,
    '..',
    '.plan',
    '(추가)BOM 종합 - ERP (1) copy.xlsx'
  );

  try {
    // 0. 데이터베이스에서 매핑 정보 조회
    console.log('데이터베이스에서 거래처 매핑 정보 조회 중...');
    const customerMapping = await getCustomerMappingFromDB(supabase);
    const supplierMapping = await getSupplierMappingFromDB(supabase);
    console.log(`  - 고객사: ${Object.keys(customerMapping).length}개`);
    console.log(`  - 공급사: ${Object.keys(supplierMapping).length}개`);

    // 1. Excel 파일 파싱
    const excelBoms = await parseExcelFile(excelPath, customerMapping, supplierMapping);

    // 2. 기존 BOM 데이터 조회
    const bomMap = await fetchExistingBOMs();

    // 3. child_supplier_id 업데이트
    await updateBOMSuppliers(excelBoms, bomMap);

    console.log('\n=== Script Complete ===');
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();

