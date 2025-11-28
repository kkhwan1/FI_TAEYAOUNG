/**
 * Excel 파일에서 자품목 단가 정보를 추출하여 items 테이블에 업데이트
 * 자품목은 품번_구매가 있는 행에서 단가를 읽어옵니다.
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

interface ChildPriceUpdate {
  item_code: string;
  price: number;
  sheet_name: string;
}

async function extractChildPricesFromExcel(filePath: string): Promise<Map<string, ChildPriceUpdate>> {
  console.log(`Reading Excel file: ${filePath}`);
  const workbook = XLSX.readFile(filePath);

  const priceMap = new Map<string, ChildPriceUpdate>();

  // 각 시트 처리 (종합 시트 제외)
  for (const sheetName of workbook.SheetNames) {
    if (sheetName === '종합') continue;

    console.log(`\nProcessing sheet: ${sheetName}`);

    const sheet = workbook.Sheets[sheetName];
    // range: 5로 읽기 (import-bom-from-excel.ts와 동일)
    const data = XLSX.utils.sheet_to_json<any>(sheet, { range: 5, defval: '' });

    let childCount = 0;

    let currentParentCode: string | null = null;

    for (const row of data) {
      // import-bom-from-excel.ts와 동일한 컬럼 매핑
      const 납품처 = String(row['납품처'] || '').trim();
      const 품번 = String(row['품번'] || '').trim();
      const 품번_구매 = String(row['품번_1'] || row['품번'] || '').trim();
      const 단가_1 = row['단가_1']; // 자품목 단가 컬럼
      const US = row['U/S'];
      
      // 모품목 행: 납품처와 품번이 있으면
      if (납품처 && 품번) {
        currentParentCode = 품번;
      }
      
      // 자품목 단가 추출
      // 품번_구매가 있고, 단가_1이 있으면 자품목 단가로 처리
      if (품번_구매 && 품번_구매 !== '') {
        // 자품목 단가는 단가_1 컬럼에 있음
        if (단가_1 !== undefined && 단가_1 !== null && 단가_1 !== '') {
          const priceStr = String(단가_1).trim().replace(/,/g, '').replace(/₩/g, '').replace(/원/g, '');
          
          if (priceStr && priceStr !== '' && priceStr !== '0' && priceStr !== '-') {
            const price = parseFloat(priceStr);
            
            if (!isNaN(price) && price > 0) {
              const itemCode = 품번_구매;
              
              // 이미 있는 경우, 더 큰 값으로 업데이트 (여러 시트에 같은 품번이 있을 수 있음)
              if (!priceMap.has(itemCode) || priceMap.get(itemCode)!.price < price) {
                priceMap.set(itemCode, {
                  item_code: itemCode,
                  price: price,
                  sheet_name: sheetName
                });
                childCount++;
              }
            }
          }
        }
      }
    }

    console.log(`  - Child items with prices: ${childCount}`);
  }

  console.log(`\nTotal child items with prices: ${priceMap.size}`);
  return priceMap;
}

async function updateChildPricesInDB(priceMap: Map<string, ChildPriceUpdate>): Promise<void> {
  console.log('\n=== Updating Child Item Prices ===');

  // 기존 품목 조회
  const itemCodes = Array.from(priceMap.keys());
  const { data: existingItems, error: fetchError } = await supabase
    .from('items')
    .select('item_id, item_code, price, item_name')
    .in('item_code', itemCodes);

  if (fetchError) {
    console.error('Error fetching existing items:', fetchError);
    return;
  }

  if (!existingItems) {
    console.log('No existing items found');
    return;
  }

  console.log(`Found ${existingItems.length} existing items`);

  // 업데이트할 품목 필터링
  const updates: Array<{ item_id: number; price: number; item_code: string; item_name: string }> = [];
  const itemCodeToId = new Map<string, number>();
  const itemCodeToName = new Map<string, string>();
  
  for (const item of existingItems) {
    itemCodeToId.set(item.item_code, item.item_id);
    itemCodeToName.set(item.item_code, item.item_name);
    const priceUpdate = priceMap.get(item.item_code);
    
    if (priceUpdate) {
      const currentPrice = parseFloat(String(item.price || 0));
      const newPrice = priceUpdate.price;
      
      // 가격이 다르거나 현재 가격이 0인 경우 업데이트
      if (newPrice !== currentPrice) {
        updates.push({
          item_id: item.item_id,
          price: newPrice,
          item_code: item.item_code,
          item_name: item.item_name || ''
        });
      }
    }
  }

  // DB에 없는 품목 확인
  const foundCodes = new Set(existingItems.map(i => i.item_code));
  const missingCodes = itemCodes.filter(code => !foundCodes.has(code));
  if (missingCodes.length > 0) {
    console.log(`\n⚠️  Items not found in DB (${missingCodes.length}):`);
    missingCodes.slice(0, 10).forEach(code => {
      const priceInfo = priceMap.get(code);
      console.log(`  - ${code}: ${priceInfo?.price.toLocaleString()} 원 (from ${priceInfo?.sheet_name})`);
    });
    if (missingCodes.length > 10) {
      console.log(`  ... and ${missingCodes.length - 10} more`);
    }
  }

  console.log(`\nItems to update: ${updates.length}`);

  if (updates.length === 0) {
    console.log('No price updates needed');
    return;
  }

  // 배치 업데이트 (100개씩)
  const batchSize = 100;
  let updatedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);

    for (const update of batch) {
      const { error } = await supabase
        .from('items')
        .update({ price: update.price })
        .eq('item_id', update.item_id);

      if (error) {
        console.error(`Error updating ${update.item_code} (${update.item_name}):`, error);
        skippedCount++;
      } else {
        updatedCount++;
        if (updatedCount % 10 === 0) {
          console.log(`  Updated ${updatedCount}/${updates.length}: ${update.item_code} -> ${update.price.toLocaleString()} 원`);
        }
      }
    }
  }

  console.log(`\n✅ Total updated: ${updatedCount} items`);
  if (skippedCount > 0) {
    console.log(`⚠️  Skipped: ${skippedCount} items`);
  }
}

async function main() {
  const filePath = path.join(__dirname, '..', '.plan', '(추가)BOM 종합 - ERP (1) copy.xlsx');

  try {
    console.log('=== 자품목 단가 업데이트 시작 ===\n');
    const priceMap = await extractChildPricesFromExcel(filePath);
    await updateChildPricesInDB(priceMap);
    console.log('\n✅ 자품목 단가 업데이트 완료!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

