/**
 * E2E Test Script: press_process_type filtering
 *
 * Tests the complete workflow of press_process_type field:
 * - Item creation with BLANKING/STAMPING types
 * - API filtering by press_capacity parameter
 * - Item updates and field clearing
 *
 * Run: node scripts/test-press-process-e2e.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Supabase client setup
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Test data storage
const testData = {
  items: [],
  customer_id: null,
  bom_ids: []
};

// Utility functions
const log = (message, type = 'info') => {
  const prefix = {
    info: 'ℹ️ ',
    success: '✅',
    error: '❌',
    warning: '⚠️ ',
    step: '🔹'
  }[type] || '';
  console.log(`${prefix} ${message}`);
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test scenario functions
async function cleanupTestData() {
  log('테스트 데이터 정리 중...', 'step');

  try {
    // BOM 데이터 삭제
    if (testData.bom_ids.length > 0) {
      const { error: bomError } = await supabase
        .from('bom')
        .delete()
        .in('bom_id', testData.bom_ids);

      if (bomError) {
        log(`BOM 삭제 오류: ${bomError.message}`, 'warning');
      } else {
        log(`BOM ${testData.bom_ids.length}개 삭제 완료`, 'success');
      }
    }

    // 품목 데이터 삭제
    if (testData.items.length > 0) {
      const itemIds = testData.items.map(item => item.item_id);
      const { error: itemError } = await supabase
        .from('items')
        .delete()
        .in('item_id', itemIds);

      if (itemError) {
        log(`품목 삭제 오류: ${itemError.message}`, 'warning');
      } else {
        log(`품목 ${itemIds.length}개 삭제 완료`, 'success');
      }
    }

    // 테스트 데이터 초기화
    testData.items = [];
    testData.bom_ids = [];

  } catch (error) {
    log(`정리 중 오류: ${error.message}`, 'error');
  }
}

async function getOrCreateTestCustomer() {
  log('테스트 고객사 조회/생성 중...', 'step');

  try {
    // 기존 고객사 조회 (한국어 타입 사용) - .single() 대신 .limit(1) 사용
    const { data: existingCustomers, error: fetchError } = await supabase
      .from('companies')
      .select('company_id, company_name')
      .eq('company_type', '고객사')
      .eq('is_active', true)
      .limit(1);

    if (fetchError) {
      log(`고객사 조회 오류: ${fetchError.message}`, 'warning');
    }

    if (existingCustomers && existingCustomers.length > 0) {
      const existingCustomer = existingCustomers[0];
      testData.customer_id = existingCustomer.company_id;
      log(`기존 고객사 사용: ${existingCustomer.company_name} (ID: ${existingCustomer.company_id})`, 'success');
      return existingCustomer.company_id;
    }

    // 고객사가 없으면 생성 (한국어 타입 사용, company_code 필수 필드 추가)
    const testCompanyCode = `TEST_E2E_${Date.now()}`;
    const { data: newCustomer, error: createError } = await supabase
      .from('companies')
      .insert({
        company_code: testCompanyCode,
        company_name: 'TEST_CUSTOMER_E2E',
        company_type: '고객사',
        is_active: true
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`고객사 생성 실패: ${createError.message}`);
    }

    testData.customer_id = newCustomer.company_id;
    testData.created_customer = true; // 생성된 고객사 표시 (나중에 삭제용)
    log(`새 테스트 고객사 생성: ${newCustomer.company_name} (ID: ${newCustomer.company_id})`, 'success');
    return newCustomer.company_id;

  } catch (error) {
    log(`고객사 조회/생성 오류: ${error.message}`, 'error');
    throw error;
  }
}

async function createTestItem(itemCode, itemName, pressProcessType) {
  log(`품목 생성: ${itemCode} (${pressProcessType || 'NULL'})`, 'step');

  try {
    const { data, error } = await supabase
      .from('items')
      .insert({
        item_code: itemCode,
        item_name: itemName,
        press_process_type: pressProcessType,
        category: '반제품', // 필수 필드 (enum: 반제품)
        inventory_type: '반제품', // 필수 필드 (enum: 반제품)
        unit: 'EA',
        price: 1000,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw new Error(`품목 생성 실패: ${error.message}`);
    }

    testData.items.push(data);
    log(`품목 생성 성공: ${data.item_code} (ID: ${data.item_id})`, 'success');
    return data;

  } catch (error) {
    log(`품목 생성 오류: ${error.message}`, 'error');
    throw error;
  }
}

async function createBOMForItem(parentItemId, childItemId, customerId) {
  log(`BOM 생성: parent_item_id=${parentItemId}, child_item_id=${childItemId}, customer_id=${customerId}`, 'step');

  try {
    const { data, error } = await supabase
      .from('bom')
      .insert({
        parent_item_id: parentItemId,
        child_item_id: childItemId,  // 필수 필드 (NOT NULL)
        customer_id: customerId,
        is_active: true,
        quantity_required: 1,  // 기본값 1.0
        level_no: 1  // 기본값 1
      })
      .select()
      .single();

    if (error) {
      throw new Error(`BOM 생성 실패: ${error.message}`);
    }

    testData.bom_ids.push(data.bom_id);
    log(`BOM 생성 성공: bom_id=${data.bom_id}`, 'success');
    return data;

  } catch (error) {
    log(`BOM 생성 오류: ${error.message}`, 'error');
    throw error;
  }
}

async function testAPIFiltering(pressCapacity, expectedType, expectedCount) {
  log(`API 테스트: press_capacity=${pressCapacity} → ${expectedType || 'ALL'} 예상`, 'step');

  try {
    const url = `http://localhost:5000/api/items/by-customer?customer_id=${testData.customer_id}&press_capacity=${pressCapacity}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API 응답 오류: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(`API 오류: ${result.error}`);
    }

    const items = result.data.items || [];
    const actualCount = items.length;

    // 결과 검증
    let passed = true;
    let issues = [];

    // 개수 검증
    if (actualCount !== expectedCount) {
      passed = false;
      issues.push(`예상 개수: ${expectedCount}, 실제: ${actualCount}`);
    }

    // 타입 검증
    if (expectedType) {
      const wrongTypes = items.filter(item => item.press_process_type !== expectedType);
      if (wrongTypes.length > 0) {
        passed = false;
        issues.push(`잘못된 타입 발견: ${wrongTypes.map(i => i.item_code).join(', ')}`);
      }
    }

    // 결과 출력
    if (passed) {
      log(`API 테스트 통과 - ${actualCount}개 품목 반환`, 'success');
      items.forEach(item => {
        log(`  - ${item.item_code}: ${item.press_process_type || 'NULL'}`, 'info');
      });
    } else {
      log(`API 테스트 실패`, 'error');
      issues.forEach(issue => log(`  - ${issue}`, 'error'));
    }

    return { passed, items, issues };

  } catch (error) {
    log(`API 테스트 오류: ${error.message}`, 'error');
    return { passed: false, items: [], issues: [error.message] };
  }
}

async function updateItemPressType(itemId, newType) {
  log(`품목 수정: item_id=${itemId} → ${newType || 'NULL'}`, 'step');

  try {
    const { data, error } = await supabase
      .from('items')
      .update({ press_process_type: newType })
      .eq('item_id', itemId)
      .select()
      .single();

    if (error) {
      throw new Error(`품목 수정 실패: ${error.message}`);
    }

    log(`품목 수정 성공: ${data.item_code} → ${data.press_process_type || 'NULL'}`, 'success');
    return data;

  } catch (error) {
    log(`품목 수정 오류: ${error.message}`, 'error');
    throw error;
  }
}

// Main test execution
async function runTests() {
  log('=== press_process_type E2E 테스트 시작 ===', 'info');
  log('', 'info');

  let allPassed = true;
  const testResults = [];

  try {
    // 1. 테스트 준비: 고객사 생성
    await getOrCreateTestCustomer();
    await delay(500);

    // 2. 테스트 품목 생성
    log('', 'info');
    log('=== 테스트 데이터 생성 ===', 'info');

    const blankingItem = await createTestItem('TEST_BLANK_001', '블랭킹 테스트 품목', 'BLANKING');
    await delay(500);

    const stampingItem = await createTestItem('TEST_STAMP_001', '성형 테스트 품목', 'STAMPING');
    await delay(500);

    // 3. BOM 생성 (parent_item_id, child_item_id, customer_id)
    // BLANKING 품목이 STAMPING 품목의 자품목으로 등록
    await createBOMForItem(stampingItem.item_id, blankingItem.item_id, testData.customer_id);
    await delay(500);

    // STAMPING 품목이 BLANKING 품목의 자품목으로 등록 (역방향 테스트용)
    await createBOMForItem(blankingItem.item_id, stampingItem.item_id, testData.customer_id);
    await delay(500);

    // 4. API 필터링 테스트
    log('', 'info');
    log('=== API 필터링 테스트 ===', 'info');

    // Test 1: press_capacity=600 → BLANKING만 반환
    const test1 = await testAPIFiltering(600, 'BLANKING', 1);
    testResults.push({ name: 'BLANKING 필터링 (600톤)', ...test1 });
    if (!test1.passed) allPassed = false;
    await delay(500);

    // Test 2: press_capacity=1000 → STAMPING만 반환
    const test2 = await testAPIFiltering(1000, 'STAMPING', 1);
    testResults.push({ name: 'STAMPING 필터링 (1000톤)', ...test2 });
    if (!test2.passed) allPassed = false;
    await delay(500);

    // 5. 품목 수정 테스트
    log('', 'info');
    log('=== 품목 수정 테스트 ===', 'info');

    // Test 3: BLANKING → STAMPING
    await updateItemPressType(blankingItem.item_id, 'STAMPING');
    await delay(500);

    const test3 = await testAPIFiltering(600, 'BLANKING', 0); // BLANKING 없어야 함
    testResults.push({ name: 'BLANKING → STAMPING 수정 후 필터링', ...test3 });
    if (!test3.passed) allPassed = false;
    await delay(500);

    // Test 4: press_process_type을 NULL로 클리어
    await updateItemPressType(stampingItem.item_id, null);
    await delay(500);

    const test4 = await testAPIFiltering(1000, 'STAMPING', 1); // 수정된 blankingItem만 반환
    testResults.push({ name: 'NULL 클리어 후 필터링', ...test4 });
    if (!test4.passed) allPassed = false;

    // 6. 최종 결과 요약
    log('', 'info');
    log('=== 테스트 결과 요약 ===', 'info');

    testResults.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      log(`${status} Test ${index + 1}: ${result.name}`, result.passed ? 'success' : 'error');
      if (result.issues && result.issues.length > 0) {
        result.issues.forEach(issue => log(`    - ${issue}`, 'error'));
      }
    });

    log('', 'info');
    if (allPassed) {
      log('=== 모든 테스트 통과! ===', 'success');
    } else {
      log('=== 일부 테스트 실패 ===', 'error');
    }

  } catch (error) {
    log(`테스트 실행 중 치명적 오류: ${error.message}`, 'error');
    console.error(error);
    allPassed = false;
  } finally {
    // 7. 테스트 데이터 정리
    log('', 'info');
    await cleanupTestData();

    log('', 'info');
    log('=== E2E 테스트 완료 ===', 'info');

    process.exit(allPassed ? 0 : 1);
  }
}

// Execute tests
runTests().catch(error => {
  console.error('테스트 실행 실패:', error);
  process.exit(1);
});
