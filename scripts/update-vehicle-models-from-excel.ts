/**
 * 엑셀 파일에서 차종 정보를 추출하여 DB의 items 테이블에 업데이트
 */

import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 고객사 매핑 (시트명 -> company_id)
const CUSTOMER_MAPPING: Record<string, number> = {
  '대우당진': 416,
  '대우포승': 417,
  '풍기서산': 418,
  '호원오토': 419,
  '인알파코리아': 420,
  '인알파코리아 ': 420, // 시트명에 공백 포함
};

interface ExcelRow {
  납품처?: string;
  차종?: string;
  차종_1?: string; // 자식 품목의 차종
  품번?: string;
  품명?: string;
  품번_구매?: string; // 자식 품목 품번
  품명_구매?: string; // 자식 품목 품명
  'U/S'?: string | number;
  구매처명?: string;
}

interface VehicleModelUpdate {
  item_code: string;
  vehicle_model: string;
  source: 'parent' | 'child';
}

/**
 * 엑셀 파일에서 차종 정보 추출
 */
function extractVehicleModelsFromExcel(filePath: string): Map<string, VehicleModelUpdate[]> {
  const workbook = XLSX.readFile(filePath);
  const vehicleModels = new Map<string, VehicleModelUpdate[]>(); // item_code -> updates

  // 각 시트 처리
  for (const sheetName of workbook.SheetNames) {
    // 종합 시트는 제외
    if (sheetName === '종합') continue;

    const customerId = CUSTOMER_MAPPING[sheetName];
    if (!customerId) {
      console.warn(`Unknown customer sheet: ${sheetName}`);
      continue;
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet, { defval: null, range: 5 }); // 6행부터 시작

    let currentParentCode: string | null = null;
    let currentParentVehicle: string | null = null;

    for (const row of rows) {
      const 납품처 = row['납품처'];
      const 차종 = row['차종'];
      const 차종_1 = row['차종_1'] || row['차종'];
      const 품번 = row['품번'];
      const 품명 = row['품명'];
      const 구매처카테고리 = row[''] || row['__EMPTY'];
      const 구매처명 = row['구매처'];
      const 품번_구매 = row['품번_1'] || row['품번'];
      const 품명_구매 = row['품명_1'] || row['품명'];
      const US = row['U/S'];

      // 상위 품목 (납품처가 있는 행)
      if (납품처 && 품번) {
        const parentCode = String(품번).trim();
        const parentVehicle = String(차종 || '').trim();
        currentParentCode = parentCode;
        currentParentVehicle = parentVehicle || null;

        // 상위 품목의 차종 정보 저장
        if (parentVehicle && parentVehicle !== '-' && parentVehicle !== '') {
          if (!vehicleModels.has(parentCode)) {
            vehicleModels.set(parentCode, []);
          }
          vehicleModels.get(parentCode)!.push({
            item_code: parentCode,
            vehicle_model: parentVehicle,
            source: 'parent'
          });
        }

        // 같은 행에 자식 정보가 있는 경우 (자기 참조 BOM)
        if (품번_구매 && (US !== undefined && US !== null && US !== '' || 구매처명)) {
          const childCode = String(품번_구매).trim();
          const childVehicle = String(차종_1 || 차종 || parentVehicle || '').trim();

          if (childVehicle && childVehicle !== '-' && childVehicle !== '') {
            if (!vehicleModels.has(childCode)) {
              vehicleModels.set(childCode, []);
            }
            vehicleModels.get(childCode)!.push({
              item_code: childCode,
              vehicle_model: childVehicle,
              source: 'child'
            });
          }
        }
      }

      // 하위 품목 (납품처가 없고, 품번_구매가 있는 행)
      const isChildRow = !납품처 && (품번_구매 || (구매처명 && 구매처카테고리));
      if (isChildRow && 품번_구매 && currentParentCode) {
        const childCode = String(품번_구매).trim();
        const childVehicle = String(차종_1 || 차종 || currentParentVehicle || '').trim();

        if (childVehicle && childVehicle !== '-' && childVehicle !== '') {
          if (!vehicleModels.has(childCode)) {
            vehicleModels.set(childCode, []);
          }
          vehicleModels.get(childCode)!.push({
            item_code: childCode,
            vehicle_model: childVehicle,
            source: 'child'
          });
        }
      }
    }
  }

  return vehicleModels;
}

/**
 * DB의 items 테이블 업데이트
 */
async function updateVehicleModelsInDB(vehicleModels: Map<string, VehicleModelUpdate[]>): Promise<void> {
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const [itemCode, updates] of vehicleModels.entries()) {
    // 가장 최신 업데이트 사용 (child가 우선순위가 높음)
    const latestUpdate = updates[updates.length - 1];
    const vehicleModel = latestUpdate.vehicle_model;

      if (!vehicleModel || vehicleModel === '-' || vehicleModel === '') {
        skippedCount++;
        continue;
      }

    try {
      // 현재 DB의 vehicle_model 확인
      const { data: currentItem, error: fetchError } = await supabase
        .from('items')
        .select('item_code, vehicle_model')
        .eq('item_code', itemCode)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // Item not found
          console.warn(`Item not found: ${itemCode}`);
          skippedCount++;
          continue;
        }
        throw fetchError;
      }

      // 이미 동일한 차종이면 스킵 (null 체크 포함)
      if (currentItem.vehicle_model === vehicleModel || 
          (currentItem.vehicle_model && currentItem.vehicle_model.trim() === vehicleModel.trim())) {
        skippedCount++;
        continue;
      }

      // 업데이트
      const { error: updateError } = await supabase
        .from('items')
        .update({ vehicle_model: vehicleModel })
        .eq('item_code', itemCode);

      if (updateError) {
        throw updateError;
      }

      console.log(`✓ Updated ${itemCode}: ${currentItem.vehicle_model || 'NULL'} → ${vehicleModel}`);
      updatedCount++;
    } catch (error) {
      console.error(`✗ Error updating ${itemCode}:`, error);
      errorCount++;
    }
  }

  console.log('\n=== 업데이트 완료 ===');
  console.log(`업데이트됨: ${updatedCount}개`);
  console.log(`스킵됨: ${skippedCount}개`);
  console.log(`오류: ${errorCount}개`);
}

/**
 * 메인 실행 함수
 */
async function main() {
  const excelFilePath = path.join(__dirname, '..', '.plan', '(추가)BOM 종합 - ERP (1) copy - 복사본.xlsx');

  console.log('엑셀 파일에서 차종 정보 추출 중...');
  const vehicleModels = extractVehicleModelsFromExcel(excelFilePath);

  console.log(`총 ${vehicleModels.size}개 품목의 차종 정보 추출됨`);

  console.log('\nDB 업데이트 중...');
  await updateVehicleModelsInDB(vehicleModels);

  console.log('\n완료!');
}

main().catch(console.error);

