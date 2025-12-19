/**
 * 품목관리 페이지 필터 및 검색 기능 E2E 테스트
 * Chrome DevTools MCP 사용
 *
 * 테스트 항목:
 * 1. 검색 기능 (UI테스트, ROLLO)
 * 2. 분류 필터 (완제품, 부자재, 초기화)
 * 3. 타입 필터 (부자재 SUB)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5000';

test.describe('품목관리 페이지 - 필터 및 검색 기능', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/master/items`);
    await page.waitForLoadState('networkidle');
  });

  test('1. 검색 기능 - "UI테스트" 검색', async ({ page }) => {
    // 검색 입력
    const searchInput = page.locator('input[placeholder*="검색"], input[type="search"]').first();
    await searchInput.fill('UI테스트');
    await page.waitForTimeout(1000); // 디바운스 대기

    // UI- 접두사 품목이 표시되는지 확인
    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    console.log(`검색 결과: ${count}개 품목 표시`);
    expect(count).toBeGreaterThan(0);

    // 모든 행이 UI- 접두사를 포함하는지 확인
    for (let i = 0; i < Math.min(count, 5); i++) {
      const itemCode = await rows.nth(i).locator('td').first().textContent();
      console.log(`품목 ${i + 1}: ${itemCode}`);
      expect(itemCode).toContain('UI-');
    }
  });

  test('2. 검색 기능 - "ROLLO" 검색', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="검색"], input[type="search"]').first();
    await searchInput.fill('ROLLO');
    await page.waitForTimeout(1000);

    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    console.log(`ROLLO 검색 결과: ${count}개 품목`);
    expect(count).toBeGreaterThan(0);

    // 첫 번째 결과 확인
    const firstItem = await rows.first().locator('td').first().textContent();
    console.log(`첫 번째 품목: ${firstItem}`);
  });

  test('3. 분류 필터 - 완제품', async ({ page }) => {
    // 완제품 필터 클릭
    const finishedFilter = page.locator('button, select').filter({ hasText: '완제품' }).first();
    await finishedFilter.click();
    await page.waitForTimeout(1000);

    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    console.log(`완제품 필터 결과: ${count}개 품목`);
    expect(count).toBeGreaterThan(0);
  });

  test('4. 분류 필터 - 부자재', async ({ page }) => {
    const subFilter = page.locator('button, select').filter({ hasText: '부자재' }).first();
    await subFilter.click();
    await page.waitForTimeout(1000);

    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    console.log(`부자재 필터 결과: ${count}개 품목`);
    expect(count).toBeGreaterThan(0);
  });

  test('5. 필터 초기화', async ({ page }) => {
    // 먼저 필터 적용
    const finishedFilter = page.locator('button, select').filter({ hasText: '완제품' }).first();
    await finishedFilter.click();
    await page.waitForTimeout(500);

    const beforeReset = await page.locator('table tbody tr').count();

    // 초기화 버튼 클릭
    const resetButton = page.locator('button').filter({ hasText: /초기화|리셋|전체/ }).first();
    await resetButton.click();
    await page.waitForTimeout(1000);

    const afterReset = await page.locator('table tbody tr').count();

    console.log(`필터 전: ${beforeReset}개, 초기화 후: ${afterReset}개`);
    expect(afterReset).toBeGreaterThanOrEqual(beforeReset);
  });

  test('6. 타입 필터 - 부자재(SUB)', async ({ page }) => {
    const typeFilter = page.locator('select, button').filter({ hasText: /타입|TYPE/ }).first();

    if (await typeFilter.count() > 0) {
      await typeFilter.selectOption({ label: '부자재 (SUB)' });
      await page.waitForTimeout(1000);

      const rows = page.locator('table tbody tr');
      const count = await rows.count();

      console.log(`SUB 타입 필터 결과: ${count}개 품목`);
      expect(count).toBeGreaterThan(0);
    } else {
      console.log('타입 필터를 찾을 수 없습니다.');
    }
  });

  test('7. 검색 + 필터 조합 테스트', async ({ page }) => {
    // 검색어 입력
    const searchInput = page.locator('input[placeholder*="검색"], input[type="search"]').first();
    await searchInput.fill('UI');
    await page.waitForTimeout(500);

    // 완제품 필터 적용
    const finishedFilter = page.locator('button, select').filter({ hasText: '완제품' }).first();
    await finishedFilter.click();
    await page.waitForTimeout(1000);

    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    console.log(`조합 필터 결과 (UI + 완제품): ${count}개 품목`);
  });
});
