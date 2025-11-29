// scripts/analyze-press-items.js
// 품목 데이터 분석 - press_process_type 분류 기준 파악

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function analyzeItems() {
  console.log('=== 품목 현황 분석 시작 ===\n');

  // 1. 전체 품목 조회
  const { data: allItems, error } = await supabase
    .from('items')
    .select('item_id, item_name, item_code, category, press_process_type')
    .eq('is_active', true)
    .order('item_name');

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('총 활성 품목 수:', allItems.length);

  // 2. press_process_type 분포
  const withType = allItems.filter(i => i.press_process_type);
  const withoutType = allItems.filter(i => !i.press_process_type);
  console.log('press_process_type 설정됨:', withType.length);
  console.log('press_process_type 미설정:', withoutType.length);

  // 3. 품목명에서 키워드 찾기
  const blankingKeywords = ['블랭킹', 'BLANK', 'blank', 'BLK', 'blk', 'B/K', 'BK'];
  const stampingKeywords = ['성형', 'STAMP', 'stamp', 'FORM', 'form', 'DRAW', 'draw', 'DR', 'F/M'];

  const potentialBlanking = withoutType.filter(item =>
    blankingKeywords.some(k =>
      (item.item_name && item.item_name.toUpperCase().includes(k.toUpperCase())) ||
      (item.item_code && item.item_code.toUpperCase().includes(k.toUpperCase()))
    )
  );

  const potentialStamping = withoutType.filter(item =>
    stampingKeywords.some(k =>
      (item.item_name && item.item_name.toUpperCase().includes(k.toUpperCase())) ||
      (item.item_code && item.item_code.toUpperCase().includes(k.toUpperCase()))
    )
  );

  console.log('\n=== 키워드 기반 분류 가능 ===');
  console.log('블랭킹 후보:', potentialBlanking.length);
  potentialBlanking.slice(0, 5).forEach(i => console.log('  -', i.item_name));

  console.log('성형 후보:', potentialStamping.length);
  potentialStamping.slice(0, 5).forEach(i => console.log('  -', i.item_name));

  // 4. 카테고리별 분포
  console.log('\n=== 카테고리별 분포 ===');
  const categoryCount = {};
  withoutType.forEach(item => {
    const cat = item.category || '미분류';
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });
  Object.entries(categoryCount).forEach(([cat, count]) => {
    console.log('  ' + cat + ': ' + count + '개');
  });

  // 5. 샘플 품목명 출력
  console.log('\n=== 미분류 품목 샘플 (30개) ===');
  withoutType.slice(0, 30).forEach((item, i) => {
    const num = String(i + 1).padStart(2, ' ');
    console.log(num + '. [' + item.item_code + '] ' + item.item_name + ' (' + item.category + ')');
  });

  // 6. 분류 제안
  console.log('\n=== 분류 제안 ===');
  console.log('자동 분류 가능: ' + (potentialBlanking.length + potentialStamping.length) + '개');
  console.log('수동 분류 필요: ' + (withoutType.length - potentialBlanking.length - potentialStamping.length) + '개');
}

analyzeItems().catch(console.error);
