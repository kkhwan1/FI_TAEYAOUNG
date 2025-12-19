/**
 * 품목관리 API 필터 및 검색 기능 수동 테스트
 * Node.js를 사용한 API 엔드포인트 직접 테스트
 */

const BASE_URL = 'http://localhost:5000';

async function testAPI(endpoint, description) {
  console.log(`\n--- ${description} ---`);
  console.log(`URL: ${BASE_URL}${endpoint}`);

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`);
    const data = await response.json();

    if (data.success) {
      const itemCount = data.data?.items?.length || 0;
      const total = data.data?.pagination?.total || 0;

      console.log(`✅ 성공`);
      console.log(`결과: ${itemCount}개 품목 (전체 ${total}개)`);

      // 첫 3개 품목 출력
      if (data.data?.items && itemCount > 0) {
        console.log('\n처음 3개 품목:');
        data.data.items.slice(0, 3).forEach((item, idx) => {
          console.log(`  ${idx + 1}. ${item.item_code} - ${item.item_name} (${item.category})`);
        });
      }

      return { success: true, count: itemCount, total, items: data.data?.items || [] };
    } else {
      console.log(`❌ 실패: ${data.error}`);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.log(`❌ 에러: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('품목관리 API 필터 및 검색 기능 테스트');
  console.log('='.repeat(70));

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  // 1. 검색 기능 테스트 - "UI테스트"
  let result = await testAPI('/api/items?search=UI테스트&limit=10', '1. 검색: "UI테스트"');
  results.total++;
  if (result.success && result.items) {
    const hasUIPrefix = result.items.every(item =>
      item.item_code?.includes('UI-') || item.item_name?.includes('UI테스트')
    );
    if (hasUIPrefix) {
      console.log('검증: ✅ 모든 결과에 UI 관련 키워드 포함');
      results.passed++;
      results.tests.push({ name: '검색: UI테스트', status: 'PASS', count: result.count });
    } else {
      console.log('검증: ❌ 일부 결과가 검색어와 일치하지 않음');
      results.failed++;
      results.tests.push({ name: '검색: UI테스트', status: 'FAIL', reason: '검색 필터 미작동' });
    }
  } else {
    results.failed++;
    results.tests.push({ name: '검색: UI테스트', status: 'FAIL', error: result.error });
  }

  // 2. 검색 기능 테스트 - "ROLLO"
  result = await testAPI('/api/items?search=ROLLO&limit=10', '2. 검색: "ROLLO"');
  results.total++;
  if (result.success && result.count > 0) {
    console.log('검증: ✅ ROLLO 검색 결과 존재');
    results.passed++;
    results.tests.push({ name: '검색: ROLLO', status: 'PASS', count: result.count });
  } else {
    results.failed++;
    results.tests.push({ name: '검색: ROLLO', status: 'FAIL', error: result.error || '결과 없음' });
  }

  // 3. 분류 필터 - 완제품
  result = await testAPI('/api/items?category=완제품&limit=10', '3. 분류 필터: 완제품');
  results.total++;
  if (result.success && result.items) {
    const allFinished = result.items.every(item => item.category === '완제품');
    if (allFinished) {
      console.log('검증: ✅ 모든 결과가 완제품');
      results.passed++;
      results.tests.push({ name: '분류 필터: 완제품', status: 'PASS', count: result.count });
    } else {
      console.log('검증: ❌ 완제품이 아닌 항목 포함');
      results.failed++;
      results.tests.push({ name: '분류 필터: 완제품', status: 'FAIL', reason: '필터 미작동' });
    }
  } else {
    results.failed++;
    results.tests.push({ name: '분류 필터: 완제품', status: 'FAIL', error: result.error });
  }

  // 4. 분류 필터 - 부자재
  result = await testAPI('/api/items?category=부자재&limit=10', '4. 분류 필터: 부자재');
  results.total++;
  if (result.success && result.items) {
    const allSub = result.items.every(item => item.category === '부자재');
    if (allSub) {
      console.log('검증: ✅ 모든 결과가 부자재');
      results.passed++;
      results.tests.push({ name: '분류 필터: 부자재', status: 'PASS', count: result.count });
    } else {
      console.log('검증: ❌ 부자재가 아닌 항목 포함');
      results.failed++;
      results.tests.push({ name: '분류 필터: 부자재', status: 'FAIL', reason: '필터 미작동' });
    }
  } else {
    results.failed++;
    results.tests.push({ name: '분류 필터: 부자재', status: 'FAIL', error: result.error });
  }

  // 5. 타입 필터 - 부자재 (SUB)
  result = await testAPI('/api/items?itemType=SUB&limit=10', '5. 타입 필터: 부자재(SUB)');
  results.total++;
  if (result.success && result.items) {
    const allSUB = result.items.every(item => item.item_type === 'SUB');
    if (allSUB) {
      console.log('검증: ✅ 모든 결과가 SUB 타입');
      results.passed++;
      results.tests.push({ name: '타입 필터: SUB', status: 'PASS', count: result.count });
    } else {
      console.log('검증: ❌ SUB 타입이 아닌 항목 포함');
      results.failed++;
      results.tests.push({ name: '타입 필터: SUB', status: 'FAIL', reason: '필터 미작동' });
    }
  } else {
    results.failed++;
    results.tests.push({ name: '타입 필터: SUB', status: 'FAIL', error: result.error });
  }

  // 6. 필터 초기화 (전체 조회)
  result = await testAPI('/api/items?limit=10', '6. 필터 초기화 (전체 조회)');
  results.total++;
  if (result.success && result.total > 0) {
    console.log(`검증: ✅ 전체 ${result.total}개 품목 확인`);
    results.passed++;
    results.tests.push({ name: '필터 초기화', status: 'PASS', total: result.total });
  } else {
    results.failed++;
    results.tests.push({ name: '필터 초기화', status: 'FAIL', error: result.error });
  }

  // 7. 조합 필터 - 검색 + 분류
  result = await testAPI('/api/items?search=UI&category=완제품&limit=10', '7. 조합 필터: UI + 완제품');
  results.total++;
  if (result.success && result.items) {
    const validCombo = result.items.every(item =>
      item.category === '완제품' && (item.item_code?.includes('UI') || item.item_name?.includes('UI'))
    );
    if (validCombo) {
      console.log('검증: ✅ 조합 필터 정상 작동');
      results.passed++;
      results.tests.push({ name: '조합 필터', status: 'PASS', count: result.count });
    } else {
      console.log('검증: ❌ 조합 필터 미작동');
      results.failed++;
      results.tests.push({ name: '조합 필터', status: 'FAIL', reason: '조건 불일치' });
    }
  } else {
    results.failed++;
    results.tests.push({ name: '조합 필터', status: 'FAIL', error: result.error });
  }

  // 최종 결과 출력
  console.log('\n' + '='.repeat(70));
  console.log('테스트 결과 요약');
  console.log('='.repeat(70));
  console.log(`총 테스트: ${results.total}개`);
  console.log(`✅ 통과: ${results.passed}개`);
  console.log(`❌ 실패: ${results.failed}개`);
  console.log(`성공률: ${((results.passed / results.total) * 100).toFixed(1)}%`);

  console.log('\n상세 결과:');
  results.tests.forEach((test, idx) => {
    const status = test.status === 'PASS' ? '✅' : '❌';
    const detail = test.count !== undefined ? `(${test.count}개)` :
                   test.total !== undefined ? `(전체 ${test.total}개)` :
                   test.error ? `(${test.error})` : '';
    console.log(`  ${idx + 1}. ${status} ${test.name} ${detail}`);
  });

  console.log('\n' + '='.repeat(70));

  return results;
}

// 테스트 실행
runTests().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('테스트 실행 중 오류:', error);
  process.exit(1);
});
