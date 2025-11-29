// test-press-process-type.js
// press_process_type 기능 테스트

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runTests() {
  console.log('=== press_process_type 기능 테스트 시작 ===\n');

  // 테스트 1: 현재 items 테이블의 press_process_type 상태 확인
  console.log('테스트 1: 현재 items 테이블 press_process_type 상태 확인');
  const { data: currentItems, error: checkError } = await supabase
    .from('items')
    .select('item_id, item_name, item_code, press_process_type')
    .eq('is_active', true)
    .limit(5);

  if (checkError) {
    console.log('  ❌ 에러:', checkError.message);
    return;
  }
  console.log('  ✅ 현재 상위 5개 품목:');
  currentItems.forEach(item => {
    console.log(`     - ${item.item_name} (${item.item_code}): press_process_type = ${item.press_process_type || 'null'}`);
  });
  console.log('');

  // 테스트 2: 새 품목 생성 (BLANKING 타입)
  console.log('테스트 2: 새 품목 생성 (press_process_type: BLANKING)');
  const testItemBlanking = {
    item_name: '테스트 블랭킹 품목',
    item_code: 'TEST-BLANK-' + Date.now(),
    item_type: '완제품',
    category: '프레스',
    unit: 'EA',
    press_process_type: 'BLANKING',
    is_active: true
  };

  const { data: insertedBlanking, error: insertError1 } = await supabase
    .from('items')
    .insert(testItemBlanking)
    .select()
    .single();

  if (insertError1) {
    console.log('  ❌ 에러:', insertError1.message);
  } else {
    console.log('  ✅ 생성 성공!');
    console.log(`     - item_id: ${insertedBlanking.item_id}`);
    console.log(`     - item_name: ${insertedBlanking.item_name}`);
    console.log(`     - press_process_type: ${insertedBlanking.press_process_type}`);
  }
  console.log('');

  // 테스트 3: 새 품목 생성 (STAMPING 타입)
  console.log('테스트 3: 새 품목 생성 (press_process_type: STAMPING)');
  const testItemStamping = {
    item_name: '테스트 성형 품목',
    item_code: 'TEST-STAMP-' + Date.now(),
    item_type: '완제품',
    category: '프레스',
    unit: 'EA',
    press_process_type: 'STAMPING',
    is_active: true
  };

  const { data: insertedStamping, error: insertError2 } = await supabase
    .from('items')
    .insert(testItemStamping)
    .select()
    .single();

  if (insertError2) {
    console.log('  ❌ 에러:', insertError2.message);
  } else {
    console.log('  ✅ 생성 성공!');
    console.log(`     - item_id: ${insertedStamping.item_id}`);
    console.log(`     - item_name: ${insertedStamping.item_name}`);
    console.log(`     - press_process_type: ${insertedStamping.press_process_type}`);
  }
  console.log('');

  // 테스트 4: press_process_type 업데이트 (BLANKING -> STAMPING)
  if (insertedBlanking) {
    console.log('테스트 4: press_process_type 업데이트 (BLANKING -> STAMPING)');
    const { data: updated, error: updateError } = await supabase
      .from('items')
      .update({ press_process_type: 'STAMPING' })
      .eq('item_id', insertedBlanking.item_id)
      .select()
      .single();

    if (updateError) {
      console.log('  ❌ 에러:', updateError.message);
    } else {
      console.log('  ✅ 업데이트 성공!');
      console.log(`     - 이전: BLANKING -> 현재: ${updated.press_process_type}`);
    }
    console.log('');
  }

  // 테스트 5: press_process_type을 null로 클리어
  if (insertedBlanking) {
    console.log('테스트 5: press_process_type을 null로 클리어');
    const { data: cleared, error: clearError } = await supabase
      .from('items')
      .update({ press_process_type: null })
      .eq('item_id', insertedBlanking.item_id)
      .select()
      .single();

    if (clearError) {
      console.log('  ❌ 에러:', clearError.message);
    } else {
      console.log('  ✅ 클리어 성공!');
      console.log(`     - press_process_type: ${cleared.press_process_type === null ? 'null (정상)' : cleared.press_process_type}`);
    }
    console.log('');
  }

  // 테스트 6: by-customer API의 프레스 용량 필터링 테스트
  console.log('테스트 6: press_process_type 필터링 테스트');

  // BLANKING 타입 품목 조회
  const { data: blankingItems, error: filterError1 } = await supabase
    .from('items')
    .select('item_id, item_name, press_process_type')
    .eq('press_process_type', 'BLANKING')
    .eq('is_active', true);

  if (filterError1) {
    console.log('  ❌ BLANKING 필터 에러:', filterError1.message);
  } else {
    console.log(`  ✅ BLANKING 타입 품목: ${blankingItems?.length || 0}개`);
  }

  // STAMPING 타입 품목 조회
  const { data: stampingItems, error: filterError2 } = await supabase
    .from('items')
    .select('item_id, item_name, press_process_type')
    .eq('press_process_type', 'STAMPING')
    .eq('is_active', true);

  if (filterError2) {
    console.log('  ❌ STAMPING 필터 에러:', filterError2.message);
  } else {
    console.log(`  ✅ STAMPING 타입 품목: ${stampingItems?.length || 0}개`);
  }
  console.log('');

  // 테스트 데이터 정리
  console.log('테스트 데이터 정리 중...');
  if (insertedBlanking) {
    await supabase.from('items').delete().eq('item_id', insertedBlanking.item_id);
    console.log(`  - ${insertedBlanking.item_code} 삭제 완료`);
  }
  if (insertedStamping) {
    await supabase.from('items').delete().eq('item_id', insertedStamping.item_id);
    console.log(`  - ${insertedStamping.item_code} 삭제 완료`);
  }

  console.log('\n=== press_process_type 기능 테스트 완료 ===');
}

runTests().catch(console.error);
