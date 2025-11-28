/**
 * Excel 파일에서 단가 정보를 추출하여 items 테이블에 업데이트
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

interface PriceUpdate {
  item_code: string;
  price: number;
  source: 'parent' | 'child'; // 모품목 단가인지 자품목 단가인지
}

async function extractPricesFromExcel(filePath: string): Promise<Map<string, PriceUpdate>> {
  console.log(`Reading Excel file: ${filePath}`);
  const workbook = XLSX.readFile(filePath);

  const priceMap = new Map<string, PriceUpdate>();

  // 각 시트 처리 (종합 시트 제외)
  for (const sheetName of workbook.SheetNames) {
    if (sheetName === '종합') continue;

    console.log(`\nProcessing sheet: ${sheetName}`);

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any>(sheet, { range: 5 }); // 6행부터 시작

    for (const row of data) {
      const 납품처 = row['납품처'];
      const 품번 = row['품번'];
      const 품번_구매 = row['품번_1'] || row['품번'];
      const 단가 = row['단가']; // E열: 모품목 단가 또는 N열: 자품목 단가

      // 모품목 단가 (납품처가 있는 행, E열의 단가)
      if (납품처 && 품번) {
        const itemCode = String(품번).trim();
        const priceStr = String(단가 || '').trim().replace(/,/g, '');
        if (priceStr && priceStr !== '' && priceStr !== '0') {
          const price = parseFloat(priceStr);
          if (!isNaN(price) && price > 0) {
            // 모품목 단가가 있으면 우선적으로 사용
            if (!priceMap.has(itemCode) || priceMap.get(itemCode)!.source === 'child') {
              priceMap.set(itemCode, { item_code: itemCode, price: price, source: 'parent' });
            }
          }
        }
      }

      // 자품목 단가 (납품처가 없고, 품번_구매가 있는 행, N열의 단가)
      if (!납품처 && 품번_구매) {
        const itemCode = String(품번_구매).trim();
        const priceStr = String(단가 || '').trim().replace(/,/g, '');
        if (priceStr && priceStr !== '' && priceStr !== '0') {
          const price = parseFloat(priceStr);
          if (!isNaN(price) && price > 0) {
            // 자품목 단가는 모품목 단가가 없을 때만 사용
            if (!priceMap.has(itemCode)) {
              priceMap.set(itemCode, { item_code: itemCode, price: price, source: 'child' });
            }
          }
        }
      }
    }
  }

  console.log(`\nTotal items with prices: ${priceMap.size}`);
  return priceMap;
}

async function updatePricesInDB(priceMap: Map<string, PriceUpdate>): Promise<void> {
  console.log('\n=== Updating Prices ===');

  // 기존 품목 조회
  const itemCodes = Array.from(priceMap.keys());
  const { data: existingItems, error: fetchError } = await supabase
    .from('items')
    .select('item_id, item_code, price')
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

  // 업데이트할 품목 필터링 (가격이 0이 아니고, 기존 가격과 다른 경우)
  const updates: Array<{ item_id: number; price: number; item_code: string }> = [];
  const itemCodeToId = new Map<string, number>();
  
  for (const item of existingItems) {
    itemCodeToId.set(item.item_code, item.item_id);
    const priceUpdate = priceMap.get(item.item_code);
    if (priceUpdate) {
      const currentPrice = parseFloat(String(item.price || 0));
      if (priceUpdate.price !== currentPrice) {
        updates.push({
          item_id: item.item_id,
          price: priceUpdate.price,
          item_code: item.item_code
        });
      }
    }
  }

  console.log(`Items to update: ${updates.length}`);

  if (updates.length === 0) {
    console.log('No price updates needed');
    return;
  }

  // 배치 업데이트 (100개씩)
  const batchSize = 100;
  let updatedCount = 0;

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);

    for (const update of batch) {
      const { error } = await supabase
        .from('items')
        .update({ price: update.price })
        .eq('item_id', update.item_id);

      if (error) {
        console.error(`Error updating ${update.item_code}:`, error);
      } else {
        updatedCount++;
        console.log(`Updated ${update.item_code}: ${update.price.toLocaleString()} 원`);
      }
    }
  }

  console.log(`\nTotal updated: ${updatedCount} items`);
}

async function main() {
  const filePath = path.join(__dirname, '..', '.plan', '(추가)BOM 종합 - ERP (1) copy.xlsx');

  try {
    const priceMap = await extractPricesFromExcel(filePath);
    await updatePricesInDB(priceMap);
    console.log('\n✅ Price update completed!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

