/**
 * BOM 종합 - ERP.xlsx 파일에서 모든 BOM 데이터를 입력하는 스크립트
 * 
 * 파일 구조:
 * - 헤더: 6행
 * - 모품목 행: A-E열 (납품처, 차종, 품번, 품명, 단가)
 * - 자품목 행: I-N열 (구매처, 차종, 품번, 품명, U/S, 단가)
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { getSupabaseClient } from '../src/lib/db-unified';

interface ParentItem {
  deliveryCompany: string; // 납품처 (A열)
  vehicleModel: string;     // 차종 (B열)
  itemCode: string;        // 품번 (C열)
  itemName: string;        // 품명 (D열)
  price: number;           // 단가 (E열)
  rowNumber: number;
}

interface ChildItem {
  supplierCategory: string; // 구매처 구분 (H열) - 태창금속, 사급, 하드웨어, 협력업체
  supplierName: string;     // 구매처 (I열)
  vehicleModel: string;     // 차종 (J열)
  itemCode: string;         // 품번 (K열)
  itemName: string;         // 품명 (L열)
  quantity: number;         // U/S (M열)
  price: number;            // 단가 (N열)
  material?: string;        // 재질 (T열)
  thickness?: number;       // 두께 (U열)
  width?: number;           // 폭 (V열)
  length?: number;          // 길이 (W열)
  rowNumber: number;
}

interface BOMEntry {
  parent: ParentItem;
  child: ChildItem;
}

// 숫자 문자열을 숫자로 변환 (쉼표 제거)
function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// 문자열 정리
function cleanString(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// Excel 파일 파싱
function parseExcelFile(filePath: string): BOMEntry[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0]; // 첫 번째 시트
  const worksheet = workbook.Sheets[sheetName];
  
  const bomEntries: BOMEntry[] = [];
  let currentParent: ParentItem | null = null;
  
  // 헤더는 6행이므로 7행부터 시작
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  
  for (let row = 7; row <= range.e.r; row++) {
    const rowData: any = {};
    
    // A부터 AE까지 모든 열 읽기
    for (let col = 0; col <= 30; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      if (cell) {
        const colLetter = String.fromCharCode(65 + col); // A=0, B=1, ...
        rowData[colLetter] = cell.v;
      }
    }
    
    // 모품목 행 확인 (A열에 값이 있으면 모품목)
    const deliveryCompany = cleanString(rowData['A']);
    const parentItemCode = cleanString(rowData['C']);
    
    if (deliveryCompany && parentItemCode) {
      // 새로운 모품목 발견
      currentParent = {
        deliveryCompany,
        vehicleModel: cleanString(rowData['B']),
        itemCode: parentItemCode,
        itemName: cleanString(rowData['D']),
        price: parseNumber(rowData['E']),
        rowNumber: row + 1
      };
    }
    
    // 자품목 행 확인 (A열이 비어있고 I열에 값이 있으면 자품목)
    const supplierCategory = cleanString(rowData['H']); // 구매처 구분
    const supplierName = cleanString(rowData['I']);     // 구매처
    const childItemCode = cleanString(rowData['K']);    // 자품목 품번
    
    if (!deliveryCompany && supplierName && childItemCode && currentParent) {
      const quantity = parseNumber(rowData['M']); // U/S
      
      // U/S가 0이거나 없으면 건너뛰기
      if (quantity <= 0) continue;
      
      const childItem: ChildItem = {
        supplierCategory: supplierCategory || '',
        supplierName,
        vehicleModel: cleanString(rowData['J']),
        itemCode: childItemCode,
        itemName: cleanString(rowData['L']),
        quantity,
        price: parseNumber(rowData['N']),
        material: cleanString(rowData['T']),
        thickness: parseNumber(rowData['U']),
        width: parseNumber(rowData['V']),
        length: parseNumber(rowData['W']),
        rowNumber: row + 1
      };
      
      bomEntries.push({
        parent: currentParent,
        child: childItem
      });
    }
  }
  
  return bomEntries;
}

// 품목 업서트 (존재하면 업데이트, 없으면 생성)
async function upsertItem(
  supabase: any,
  itemCode: string,
  itemName: string,
  vehicleModel?: string,
  price?: number
): Promise<number> {
  // 기존 품목 확인
  const { data: existing } = await supabase
    .from('items')
    .select('item_id')
    .eq('item_code', itemCode)
    .maybeSingle();
  
  const itemData: any = {
    item_code: itemCode,
    item_name: itemName,
    is_active: true,
    updated_at: new Date().toISOString()
  };
  
  if (vehicleModel) itemData.vehicle_model = vehicleModel;
  if (price && price > 0) itemData.price = price;
  
  if (existing) {
    // 업데이트
    const { data, error } = await supabase
      .from('items')
      .update(itemData)
      .eq('item_id', existing.item_id)
      .select('item_id')
      .single();
    
    if (error) throw error;
    return data.item_id;
  } else {
    // 생성
    const { data, error } = await supabase
      .from('items')
      .insert({
        ...itemData,
        item_type: 'RAW', // 기본값
        unit: 'EA',      // 기본값
        current_stock: 0
      })
      .select('item_id')
      .single();
    
    if (error) throw error;
    return data.item_id;
  }
}

// 거래처 업서트
async function upsertCompany(
  supabase: any,
  companyName: string,
  companyCategory?: string
): Promise<number | null> {
  if (!companyName || companyName.trim() === '') return null;
  
  const trimmedName = companyName.trim();
  
  // 기존 거래처 확인
  const { data: existing } = await supabase
    .from('companies')
    .select('company_id')
    .eq('company_name', trimmedName)
    .maybeSingle();
  
  // 거래처 타입 결정
  let companyType = '기타';
  if (companyCategory) {
    if (companyCategory.includes('사급')) companyType = '고객사';
    else if (companyCategory.includes('협력업체') || companyCategory.includes('협력')) companyType = '협력사';
    else if (companyCategory.includes('하드웨어')) companyType = '공급사';
    else if (trimmedName === '태창금속') companyType = '공급사';
  }
  
  const companyData: any = {
    company_name: trimmedName,
    company_type: companyType,
    is_active: true,
    updated_at: new Date().toISOString()
  };
  
  if (companyCategory) companyData.company_category = companyCategory;
  
  if (existing) {
    const { data, error } = await supabase
      .from('companies')
      .update(companyData)
      .eq('company_id', existing.company_id)
      .select('company_id')
      .single();
    
    if (error) throw error;
    return data.company_id;
  } else {
    const { data, error } = await supabase
      .from('companies')
      .insert(companyData)
      .select('company_id')
      .single();
    
    if (error) throw error;
    return data.company_id;
  }
}

// BOM 관계 생성
async function createBOMRelation(
  supabase: any,
  parentItemId: number,
  childItemId: number,
  quantity: number,
  customerId?: number
): Promise<void> {
  // 기존 BOM 확인
  const { data: existing } = await supabase
    .from('bom')
    .select('bom_id')
    .eq('parent_item_id', parentItemId)
    .eq('child_item_id', childItemId)
    .eq('is_active', true)
    .maybeSingle();
  
  const bomData: any = {
    parent_item_id: parentItemId,
    child_item_id: childItemId,
    quantity_required: quantity,
    unit: 'EA',
    is_active: true,
    updated_at: new Date().toISOString()
  };
  
  if (existing) {
    // 업데이트
    const { error } = await supabase
      .from('bom')
      .update(bomData)
      .eq('bom_id', existing.bom_id);
    
    if (error) throw error;
  } else {
    // 생성
    const { error } = await supabase
      .from('bom')
      .insert(bomData);
    
    if (error) throw error;
  }
  
  // customer_bom_templates 연결 (고객사가 있는 경우)
  if (customerId) {
    const { data: bomRecord } = await supabase
      .from('bom')
      .select('bom_id')
      .eq('parent_item_id', parentItemId)
      .eq('child_item_id', childItemId)
      .eq('is_active', true)
      .single();
    
    if (bomRecord) {
      // 기존 템플릿 확인
      const { data: existingTemplate } = await supabase
        .from('customer_bom_templates')
        .select('template_id')
        .eq('customer_id', customerId)
        .eq('bom_id', bomRecord.bom_id)
        .maybeSingle();
      
      if (!existingTemplate) {
        // 템플릿 생성
        await supabase
          .from('customer_bom_templates')
          .insert({
            customer_id: customerId,
            bom_id: bomRecord.bom_id,
            is_active: true
          });
      }
    }
  }
}

// 메인 실행 함수
async function main() {
  const filePath = path.join(process.cwd(), '.example', 'BOM 종합 - ERP.xlsx');
  
  if (!fs.existsSync(filePath)) {
    console.error(`파일을 찾을 수 없습니다: ${filePath}`);
    process.exit(1);
  }
  
  console.log('Excel 파일 파싱 중...');
  const bomEntries = parseExcelFile(filePath);
  console.log(`총 ${bomEntries.length}개의 BOM 항목을 발견했습니다.`);
  
  const supabase = getSupabaseClient();
  
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];
  
  // 통계
  const itemCodes = new Set<string>();
  const companyNames = new Set<string>();
  
  bomEntries.forEach(entry => {
    itemCodes.add(entry.parent.itemCode);
    itemCodes.add(entry.child.itemCode);
    if (entry.parent.deliveryCompany) companyNames.add(entry.parent.deliveryCompany);
    if (entry.child.supplierName) companyNames.add(entry.child.supplierName);
  });
  
  console.log(`\n발견된 품목 수: ${itemCodes.size}`);
  console.log(`발견된 거래처 수: ${companyNames.size}`);
  console.log('\n데이터 입력 시작...\n');
  
  // 배치 처리 (100개씩)
  const batchSize = 100;
  for (let i = 0; i < bomEntries.length; i += batchSize) {
    const batch = bomEntries.slice(i, i + batchSize);
    console.log(`처리 중: ${i + 1} ~ ${Math.min(i + batchSize, bomEntries.length)} / ${bomEntries.length}`);
    
    for (const entry of batch) {
      try {
        // 1. 모품목 업서트
        const parentItemId = await upsertItem(
          supabase,
          entry.parent.itemCode,
          entry.parent.itemName,
          entry.parent.vehicleModel,
          entry.parent.price
        );
        
        // 2. 자품목 업서트
        const childItemId = await upsertItem(
          supabase,
          entry.child.itemCode,
          entry.child.itemName,
          entry.child.vehicleModel,
          entry.child.price
        );
        
        // 3. 거래처 업서트
        const customerId = entry.parent.deliveryCompany
          ? await upsertCompany(supabase, entry.parent.deliveryCompany)
          : null;
        
        const supplierId = entry.child.supplierName
          ? await upsertCompany(supabase, entry.child.supplierName, entry.child.supplierCategory)
          : null;
        
        // 4. BOM 관계 생성
        await createBOMRelation(
          supabase,
          parentItemId,
          childItemId,
          entry.child.quantity,
          customerId || undefined
        );
        
        successCount++;
        
        if (successCount % 50 === 0) {
          console.log(`  진행: ${successCount}개 완료`);
        }
      } catch (error: any) {
        errorCount++;
        const errorMsg = `행 ${entry.parent.rowNumber}-${entry.child.rowNumber}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`  오류: ${errorMsg}`);
      }
    }
  }
  
  console.log('\n=== 완료 ===');
  console.log(`성공: ${successCount}개`);
  console.log(`실패: ${errorCount}개`);
  
  if (errors.length > 0) {
    console.log('\n오류 목록:');
    errors.slice(0, 20).forEach(err => console.log(`  - ${err}`));
    if (errors.length > 20) {
      console.log(`  ... 외 ${errors.length - 20}개 오류`);
    }
  }
}

// 실행
if (require.main === module) {
  main().catch(console.error);
}

export { parseExcelFile, upsertItem, upsertCompany, createBOMRelation };

