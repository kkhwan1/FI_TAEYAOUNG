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

// 공급사 매핑 (구매처명 -> company_id)
const SUPPLIER_MAPPING: Record<string, number> = {
  '태창금속': 421,
  '삼진스틸': 422,
  '아신금속': 423,
  '대일CFT': 424,
  '제이에스테크': 425,
  '신성테크': 426,
  '창경에스테크': 427,
  '호원사급': 428,
  '대우포승': 429,
  '대우포승 사급': 429,
  '세원테크': 430,
  '현대제철': 431,
  '신호': 432,
  '신성사출': 433,
  '신성산업': 434,
  '민현': 435,
  '세진오토': 436,
  '오토다임': 437,
  '대상': 438,
  '코리아신예': 439,
  '코리아신예(무상사급)': 439,
  // 고객사도 공급사 역할을 할 수 있음
  '대우당진': 416,
  '풍기서산': 418,
  '호원오토': 419,
  '인알파코리아': 420,
};

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

// 구매처명 → company_id 변환 함수
function getSupplierId(supplierName: string | undefined): number | null {
  if (!supplierName) return null;
  const trimmed = supplierName.trim();
  
  // "하드웨어"는 제외 (매핑하지 않음)
  if (trimmed === '하드웨어') {
    return null;
  }
  
  return SUPPLIER_MAPPING[trimmed] || null;
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

    const customerId = CUSTOMER_MAPPING[sheetName];
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
      // 컬럼 매핑 - 단순하게 Excel 순서대로 처리
      const 납품처 = String(row['납품처'] || '').trim();
      const 차종 = String(row['차종'] || '').trim();
      const 품번 = String(row['품번'] || '').trim();
      const 품명 = String(row['품명'] || '').trim();
      const 구매처명 = String(row['구매처'] || '').trim();
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

      // 1. 납품처와 품번이 있으면 모품목으로 인식
      if (납품처 && 품번) {
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

      // 2. 품번_구매가 있으면 자식으로 처리 (Excel 순서대로)
      if (품번_구매 && currentParentCode) {
        const childCode = 품번_구매;
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
    const customerName = Object.entries(CUSTOMER_MAPPING).find(([_, id]) => id === b.customer_id)?.[0];
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

  // 배치 삽입 (100개씩)
  const batchSize = 100;
  let insertedCount = 0;

  for (let i = 0; i < uniqueBoms.length; i += batchSize) {
    const batch = uniqueBoms.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('bom')
      .upsert(batch, {
        onConflict: 'parent_item_id,child_item_id,customer_id,child_supplier_id', // 새로운 제약조건에 맞게 수정
        ignoreDuplicates: false, // 덮어쓰기 허용 (복사본.xlsx 기준으로 재구성)
      })
      .select('bom_id');

    if (error) {
      console.error(`Error inserting BOM batch ${Math.floor(i / batchSize) + 1}:`, error);
    } else if (data) {
      insertedCount += data.length;
      console.log(`Inserted BOM batch ${Math.floor(i / batchSize) + 1}: ${data.length} records`);
    }
  }

  console.log(`Total BOM records inserted: ${insertedCount}`);
}

// 메인 실행
async function main() {
  const excelPath = path.join(__dirname, '..', '.plan', '(추가)BOM 종합 - ERP (1) copy - 복사본.xlsx');

  try {
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
