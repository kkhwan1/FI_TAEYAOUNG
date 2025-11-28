/**
 * BOM 데이터 엑셀 Import 스크립트
 *
 * 엑셀 파일에서 items 및 BOM 관계를 추출하여 Supabase에 등록
 * customer_id를 포함하여 프로젝트별 BOM 분리 지원
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

// 매핑 정보 (DB에서 동적으로 조회)
let customerMapping: Record<string, number> = {};
let supplierMapping: Record<string, number> = {};

interface ExcelRow {
  납품처?: string;
  차종?: string;
  품번?: string;
  품명?: string;
  단가?: string | number;
  마감수량?: string | number;
  마감금액?: string | number;
  구매처?: string; // H열: 구매처 카테고리
  구매처명?: string; // I열: 실제 구매처명
  품번_구매?: string; // K열
  품명_구매?: string; // L열
  'U/S'?: string | number;
  단가_구매?: string | number; // N열: 구매 단가
  구매수량?: string | number;
  구매금액?: string | number;
  비고?: string;
  KG단가?: string | number;
  단품단가?: string | number;
  재질?: string;
  두께?: string | number;
  폭?: string | number;
  길이?: string | number;
  SEP?: string | number;
  비중?: string | number;
  EA중량?: string | number;
  실적수량?: string | number;
  스크랩중량?: string | number;
  스크랩단가?: string | number;
  스크랩금액?: string | number;
}

interface ParsedItem {
  item_code: string;
  item_name: string;
  item_type: 'RAW' | 'SUB' | 'FINISHED';  // DB constraint: RAW, SUB, FINISHED
  unit: string;
  // supplier_id는 제외 - BOM별로 다른 구매처를 가질 수 있으므로 items 테이블에 저장하지 않음
  unit_price?: number;
  specifications?: string;
  material?: string;
  vehicle_model?: string; // 차종 정보 추가
  // 추가 필드들
  price?: number; // 단가 (E열)
  kg_unit_price?: number; // KG단가 (R열)
  thickness?: number; // 두께 (U열)
  width?: number; // 폭 (V열)
  height?: number; // 길이 (W열)
  sep?: number; // SEP (X열)
  specific_gravity?: number; // 비중 (Y열)
  mm_weight?: number; // EA중량 (Z열)
  actual_quantity?: number; // 실적수량 (AB열)
  scrap_weight?: number; // 스크랩중량 (AC열)
  scrap_unit_price?: number; // 스크랩단가 (AD열)
  scrap_amount?: number; // 스크랩금액 (AE열)
  description?: string; // 비고 (Q열)
}

interface ParsedBOM {
  parent_item_code: string;
  child_item_code: string;
  quantity: number;
  customer_id: number;
  child_supplier_name?: string; // 구매처명 (나중에 연결할 수 있도록 추출만 함)
  child_supplier_id?: number | null; // 구매처명을 company_id로 변환한 값
}


// 품목 유형 결정 - DB constraint 기준 (RAW, SUB, FINISHED)
function determineItemType(category?: string, itemName?: string): 'RAW' | 'SUB' | 'FINISHED' {
  if (!category) return 'SUB';

  const cat = category.toLowerCase();
  if (cat.includes('하드웨어')) return 'RAW';  // 부자재 → RAW
  if (cat.includes('사급') || cat.includes('협력업체')) return 'SUB';
  if (cat.includes('태창금속')) return 'SUB';

  // 품명 기반 추정
  if (itemName) {
    const name = itemName.toLowerCase();
    if (name.includes('nut') || name.includes('bolt') || name.includes('screw')) return 'RAW';
    if (name.includes('assy') || name.includes('ass\'y')) return 'SUB';
  }

  return 'SUB';
}

// 엑셀 파일 파싱
async function parseExcelFile(filePath: string): Promise<{
  items: Map<string, ParsedItem>;
  boms: ParsedBOM[];
}> {
  console.log(`Reading Excel file: ${filePath}`);
  const workbook = XLSX.readFile(filePath);

  const items = new Map<string, ParsedItem>();
  const boms: ParsedBOM[] = [];

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
    // 헤더는 6행, 데이터는 7행부터 시작 (range: 5는 6행을 헤더로, 7행부터 데이터로 파싱)
    const data = XLSX.utils.sheet_to_json<any>(sheet, { range: 5, defval: '' });

    let currentParentCode: string | null = null;
    let currentParentName: string | null = null;
    let parentCount = 0;
    let childCount = 0;

    for (const row of data) {
      // 컬럼 매핑 - Excel 구조에 맞게 수정
      // 모품목: A-G열 (납품처, 차종, 품번, 품명, 단가, 마감수량, 마감금액)
      // 자품목: I-P열 (구매처, 차종, 품번, 품명, U/S, 단가, 구매수량, 구매금액)
      const 납품처 = String(row['납품처'] || '').trim();
      const 차종 = String(row['차종'] || '').trim();
      const 품번 = String(row['품번'] || '').trim();
      const 품명 = String(row['품명'] || '').trim();
      // H열은 비어있거나 업체구분이므로 건너뜀
      // I열부터 자품목 정보 시작
      const 구매처명 = String(row['구매처'] || '').trim();
      // Excel에서 자품목의 품번, 품명, 차종은 중복된 헤더명이므로 인덱스로 접근하거나 다른 방법 사용
      // XLSX는 중복 헤더를 자동으로 _1, _2로 변환하므로 확인 필요
      const 품번_구매 = String(row['품번_1'] || row['품번'] || '').trim();
      const 품명_구매 = String(row['품명_1'] || row['품명'] || '').trim();
      const 차종_구매 = String(row['차종_1'] || row['차종'] || '').trim();
      const US = row['U/S'];
      const 단가 = row['단가'];
      const 재질 = row['재질'];
      const 두께 = row['두께'];
      const 폭 = row['폭'];
      const 길이 = row['길이'];
      const KG단가 = row['KG단가'];
      const 단품단가 = row['단품단가'];
      const SEP = row['SEP'];
      const 비중 = row['비중'];
      const EA중량 = row['EA중량'];
      const 실적수량 = row['실적수량'];
      const 스크랩중량 = row['스크랩중량'];
      const 스크랩단가 = row['스크랩단가'];
      const 스크랩금액 = row['스크랩금액'];
      const 비고 = row['비고'];

      // 1. 모품목 판별: A-G열 중 하나라도 값이 있으면 모품목 행
      // Excel 구조: 모품목은 A-G열에 데이터, 자품목은 A-G열이 비어있고 H열 이후에 데이터
      const isParentRow = 납품처 || 차종 || 품번 || 품명 || 단가;
      
      if (isParentRow && 품번) {
        currentParentCode = 품번;
        currentParentName = 품명;
        
        // 모품목 등록
        if (!items.has(품번)) {
          const parentPrice = 단가 ? parseFloat(String(단가).replace(/,/g, '')) : undefined;
          items.set(품번, {
            item_code: 품번,
            item_name: 품명,
            item_type: 'FINISHED',
            unit: 'EA',
            vehicle_model: 차종 || undefined,
            price: parentPrice,
            description: 비고 ? String(비고).trim() : undefined,
          });
          parentCount++;
        }
      }

      // 2. 자품목 판별: A-G열이 비어있고 H열 이후에 값이 있으면 자품목 행
      // Excel 구조: 자품목은 A-G열이 비어있고, H열(업체구분) 또는 I열(구매처)부터 데이터
      const isChildRow = !isParentRow && (구매처명 || 품번_구매 || 품명_구매);
      
      if (isChildRow && currentParentCode) {
        // 구매처명이 있으면 자품목 행으로 처리
        const childCode = 품번_구매 || 품번; // 자품목 품번이 없으면 모품목 품번 사용 (자기 참조)
        let 구매처명_값 = 구매처명;
        
        // 자기 참조이고 구매처명이 없으면 납품처명 사용
        // 구매처명이 있더라도 자기 참조이면 그대로 사용 (Excel에 명시되어 있음)
        if (childCode === currentParentCode && !구매처명_값 && 납품처) {
          구매처명_값 = 납품처;
        }
        
        const childName = 품명_구매 || 품명;
        const childVehicle = 차종_구매 || 차종;
        const quantity = (US !== undefined && US !== null && US !== '') ? parseFloat(String(US).replace(/,/g, '')) : 1;

        // 자식 품목 등록
        if (!items.has(childCode)) {
          let specs = '';
          if (재질) specs += `재질:${재질}`;
          if (두께) specs += specs ? `, 두께:${두께}` : `두께:${두께}`;
          if (폭) specs += specs ? `, 폭:${폭}` : `폭:${폭}`;
          if (길이) specs += specs ? `, 길이:${길이}` : `길이:${길이}`;

          const childPrice = 단가 ? parseFloat(String(단가).replace(/,/g, '')) : undefined;
          const kgPrice = KG단가 ? parseFloat(String(KG단가).replace(/,/g, '')) : undefined;
          const unitPrice = 단품단가 ? parseFloat(String(단품단가).replace(/,/g, '')) : undefined;
          const thickness = 두께 ? parseFloat(String(두께)) : undefined;
          const width = 폭 ? parseFloat(String(폭)) : undefined;
          const height = 길이 ? parseFloat(String(길이)) : undefined;
          const sep = SEP ? parseInt(String(SEP)) : undefined;
          const gravity = 비중 ? parseFloat(String(비중)) : undefined;
          const mmWeight = EA중량 ? parseFloat(String(EA중량)) : undefined;
          const actualQty = 실적수량 ? parseInt(String(실적수량)) : undefined;
          const scrapWeight = 스크랩중량 ? parseFloat(String(스크랩중량)) : undefined;
          const scrapUnitPrice = 스크랩단가 ? parseFloat(String(스크랩단가).replace(/,/g, '')) : undefined;
          const scrapAmount = 스크랩금액 ? parseFloat(String(스크랩금액).replace(/,/g, '')) : undefined;

          items.set(childCode, {
            item_code: childCode,
            item_name: childName,
            item_type: determineItemType(undefined, childName),
            unit: 'EA',
            vehicle_model: childVehicle || undefined,
            specifications: specs || undefined,
            material: 재질 ? String(재질) : undefined,
            price: childPrice || unitPrice,
            kg_unit_price: kgPrice,
            thickness: thickness,
            width: width,
            height: height,
            sep: sep,
            specific_gravity: gravity,
            mm_weight: mmWeight,
            actual_quantity: actualQty,
            scrap_weight: scrapWeight,
            scrap_unit_price: scrapUnitPrice,
            scrap_amount: scrapAmount,
            description: 비고 ? String(비고).trim() : undefined,
          });
          childCount++;
        }

        // BOM 관계 등록
        const childSupplierId = getSupplierId(구매처명_값);
        boms.push({
          parent_item_code: currentParentCode,
          child_item_code: childCode,
          quantity: quantity,
          customer_id: customerId,
          child_supplier_name: 구매처명_값 || undefined,
          child_supplier_id: childSupplierId,
        });
      }

    }

    console.log(`  - Parent items: ${parentCount}`);
    console.log(`  - Child items: ${childCount}`);
    const sheetBoms = boms.filter(b => b.customer_id === customerId);
    console.log(`  - BOM relations: ${sheetBoms.length}`);
    
    // 대우당진 시트 디버그
    if (sheetName === '대우당진') {
      console.log(`\n  대우당진 BOM 상세:`);
      sheetBoms.forEach(b => {
        console.log(`    ${b.parent_item_code} -> ${b.child_item_code} (${b.child_supplier_name || 'NULL'})`);
      });
    }
  }

  console.log(`\nTotal unique items: ${items.size}`);
  console.log(`Total BOM relations: ${boms.length}`);
  
  // 대우당진 BOM 디버그
  const daewooBoms = boms.filter(b => {
    const customerName = Object.entries(customerMapping).find(([_, id]) => id === b.customer_id)?.[0];
    return customerName === '대우당진';
  });
  console.log(`\n대우당진 BOM 상세:`);
  daewooBoms.forEach(b => {
    console.log(`  ${b.parent_item_code} -> ${b.child_item_code} (${b.child_supplier_name || 'NULL'})`);
  });

  return { items, boms };
}

// items 테이블에 등록
async function insertItems(items: Map<string, ParsedItem>): Promise<Map<string, number>> {
  console.log('\n=== Inserting Items ===');
  const itemIdMap = new Map<string, number>();

  // 기존 품목 조회
  const { data: existingItems, error: fetchError } = await supabase
    .from('items')
    .select('item_id, item_code')
    .in('item_code', Array.from(items.keys()));

  if (fetchError) {
    console.error('Error fetching existing items:', fetchError);
  } else if (existingItems) {
    for (const item of existingItems) {
      itemIdMap.set(item.item_code, item.item_id);
    }
    console.log(`Found ${existingItems.length} existing items`);
  }

  // 새 품목만 필터링
  const newItems: ParsedItem[] = [];
  for (const [code, item] of items) {
    if (!itemIdMap.has(code)) {
      newItems.push(item);
    }
  }

  console.log(`New items to insert: ${newItems.length}`);

  if (newItems.length === 0) {
    return itemIdMap;
  }

  // 배치 삽입 (100개씩)
  const batchSize = 100;
  for (let i = 0; i < newItems.length; i += batchSize) {
    const batch = newItems.slice(i, i + batchSize);

    const insertData = batch.map(item => ({
      item_code: item.item_code,
      item_name: item.item_name,
      item_type: item.item_type,
      category: '반제품',  // NOT NULL - valid enum: 원자재, 부자재, 반제품, 제품, 상품
      inventory_type: '반제품',  // NOT NULL - valid: 완제품, 반제품, 고객재고, 원재료, 코일
      unit: item.unit,
      supplier_id: null, // 구매처 정보는 BOM 레벨에서 관리하므로 NULL로 설정
      vehicle_model: item.vehicle_model || null, // 차종 정보 추가
      spec: item.specifications,  // specifications → spec
      material: item.material,
      price: item.price || 0, // 단가
      kg_unit_price: item.kg_unit_price || 0, // KG단가
      thickness: item.thickness || null, // 두께
      width: item.width || null, // 폭
      height: item.height || null, // 길이
      sep: item.sep || 1, // SEP
      specific_gravity: item.specific_gravity || 7.85, // 비중 (기본값 7.85)
      mm_weight: item.mm_weight || null, // EA중량
      actual_quantity: item.actual_quantity || 0, // 실적수량
      scrap_weight: item.scrap_weight || 0, // 스크랩중량
      scrap_unit_price: item.scrap_unit_price || 0, // 스크랩단가
      scrap_amount: item.scrap_amount || 0, // 스크랩금액
      description: item.description || null, // 비고
      is_active: true,
    }));

    const { data, error } = await supabase
      .from('items')
      .insert(insertData)
      .select('item_id, item_code');

    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
    } else if (data) {
      for (const item of data) {
        itemIdMap.set(item.item_code, item.item_id);
      }
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}: ${data.length} items`);
    }
  }

  return itemIdMap;
}

// BOM 테이블에 등록
async function insertBOMs(boms: ParsedBOM[], itemIdMap: Map<string, number>): Promise<void> {
  console.log('\n=== Inserting BOM Relations ===');

  // item_code -> item_id 변환 (누락된 ID 필터링)
  // 자기 참조 BOM은 허용됨 (DB 제약조건 제거됨)
  const filteredBoms = boms.filter(bom => {
    const parentId = itemIdMap.get(bom.parent_item_code);
    const childId = itemIdMap.get(bom.child_item_code);
    if (!parentId || !childId) {
      console.warn(`Missing item ID: parent=${bom.parent_item_code}, child=${bom.child_item_code}`);
      return false;
    }
    return true;
  });

  const bomData = filteredBoms.map(bom => ({
      parent_item_id: itemIdMap.get(bom.parent_item_code)!,
      child_item_id: itemIdMap.get(bom.child_item_code)!,
      quantity_required: bom.quantity,  // DB column name: quantity_required
      customer_id: bom.customer_id,
      child_supplier_id: bom.child_supplier_id || null, // Excel의 구매처명을 company_id로 변환한 값
      is_active: true,
    }));

  console.log(`BOM records to insert: ${bomData.length}`);

  if (bomData.length === 0) {
    return;
  }

  // 중복 제거 (같은 parent-child-customer-supplier 조합)
  // child_supplier_id가 다른 경우는 다른 BOM으로 처리 (같은 parent-child-customer라도 구매처가 다르면 다른 BOM)
  const uniqueKey = (b: typeof bomData[0]) => `${b.parent_item_id}-${b.child_item_id}-${b.customer_id}-${b.child_supplier_id || 'NULL'}`;
  const uniqueBoms = Array.from(
    new Map(bomData.map(b => [uniqueKey(b), b])).values()
  );

  console.log(`Unique BOM records: ${uniqueBoms.length}`);

  // 모품목 기준으로 정렬 (Excel 파일 순서 유지)
  // parent_item_id를 기준으로 정렬하여 모품목별로 그룹화
  uniqueBoms.sort((a, b) => {
    if (a.parent_item_id !== b.parent_item_id) {
      return a.parent_item_id - b.parent_item_id;
    }
    // 같은 모품목 내에서는 자품목 ID로 정렬
    return a.child_item_id - b.child_item_id;
  });

  // 기존 BOM 데이터를 삭제하지 않고 upsert로 업데이트/추가
  // Excel 파일 기준으로 모품목 위주로 변경
  console.log(`Updating/Inserting BOMs based on Excel file order (parent item focused)`);

  // 기존 BOM 조회 (모든 고객사의 BOM)
  const customerIds = [...new Set(uniqueBoms.map(b => b.customer_id).filter(id => id !== null))];
  const { data: existingBoms, error: fetchError } = await supabase
    .from('bom')
    .select('bom_id, parent_item_id, child_item_id, customer_id, child_supplier_id')
    .in('customer_id', customerIds);

  if (fetchError) {
    console.error('Error fetching existing BOMs:', fetchError);
  }

  // 기존 BOM을 Map으로 변환 (키: parent-child-customer-supplier 조합)
  const existingBomMap = new Map<string, number>();
  if (existingBoms) {
    existingBoms.forEach(bom => {
      const key = `${bom.parent_item_id}-${bom.child_item_id}-${bom.customer_id}-${bom.child_supplier_id || 'NULL'}`;
      existingBomMap.set(key, bom.bom_id);
    });
  }

  console.log(`Found ${existingBomMap.size} existing BOM records`);

  // 업데이트할 BOM과 새로 삽입할 BOM 분리
  const bomsToUpdate: Array<{ bom_id: number; data: typeof uniqueBoms[0] }> = [];
  const bomsToInsert: typeof uniqueBoms = [];

  uniqueBoms.forEach(bom => {
    const key = `${bom.parent_item_id}-${bom.child_item_id}-${bom.customer_id}-${bom.child_supplier_id || 'NULL'}`;
    const existingBomId = existingBomMap.get(key);
    if (existingBomId) {
      bomsToUpdate.push({ bom_id: existingBomId, data: bom });
    } else {
      bomsToInsert.push(bom);
    }
  });

  console.log(`BOMs to update: ${bomsToUpdate.length}`);
  console.log(`BOMs to insert: ${bomsToInsert.length}`);

  // 배치 업데이트 및 삽입 (100개씩)
  const batchSize = 100;
  let updatedCount = 0;
  let insertedCount = 0;

  // 기존 BOM 업데이트
  for (let i = 0; i < bomsToUpdate.length; i += batchSize) {
    const batch = bomsToUpdate.slice(i, i + batchSize);
    
    for (const { bom_id, data } of batch) {
      const { error } = await supabase
        .from('bom')
        .update({
          quantity_required: data.quantity_required,
          is_active: data.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('bom_id', bom_id);

      if (error) {
        console.error(`Error updating BOM ${bom_id}:`, error);
      } else {
        updatedCount++;
      }
    }
    
    if (batch.length > 0) {
      console.log(`Updated BOM batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);
    }
  }

  // 새 BOM 삽입
  for (let i = 0; i < bomsToInsert.length; i += batchSize) {
    const batch = bomsToInsert.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('bom')
      .insert(batch)
      .select('bom_id');

    if (error) {
      console.error(`Error inserting BOM batch ${Math.floor(i / batchSize) + 1}:`, error);
    } else if (data) {
      insertedCount += data.length;
      console.log(`Inserted BOM batch ${Math.floor(i / batchSize) + 1}: ${data.length} records`);
    }
  }

  console.log(`\nTotal BOM records processed: ${updatedCount + insertedCount}`);
  console.log(`  - Updated: ${updatedCount} existing BOMs`);
  console.log(`  - Inserted: ${insertedCount} new BOMs`);
  console.log(`BOM data updated/inserted based on Excel file order (parent item focused)`);
}

// 메인 실행
async function main() {
  const excelPath = path.join(__dirname, '..', '.example', '(추가)BOM 종합 - ERP (1).xlsx');

  try {
    // 0. 데이터베이스에서 매핑 정보 조회
    console.log('데이터베이스에서 거래처 매핑 정보 조회 중...');
    customerMapping = await getCustomerMappingFromDB(supabase);
    supplierMapping = await getSupplierMappingFromDB(supabase);
    console.log(`  - 고객사: ${Object.keys(customerMapping).length}개`);
    console.log(`  - 공급사: ${Object.keys(supplierMapping).length}개`);

    // 1. 엑셀 파싱
    const { items, boms } = await parseExcelFile(excelPath);

    // 2. Items 등록
    const itemIdMap = await insertItems(items);

    // 3. BOM 등록
    await insertBOMs(boms, itemIdMap);

    console.log('\n=== Import Complete ===');
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

main();
