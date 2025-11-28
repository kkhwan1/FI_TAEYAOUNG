# 태창 ERP E2E 테스트

## 개요

이 디렉토리는 태창 ERP 시스템의 End-to-End (E2E) 테스트를 포함합니다.

## 테스트 구조

```
tests/e2e/
├── dashboard.spec.ts          # 대시보드 테스트
├── process.spec.ts            # 공정 관리 테스트
├── contracts.spec.ts          # 계약 관리 테스트
├── price-management.spec.ts   # 월별 단가 관리 테스트
├── master/
│   ├── items.spec.ts          # 품목 관리 테스트
│   ├── companies.spec.ts      # 거래처 관리 테스트
│   └── bom.spec.ts            # BOM 관리 테스트
├── inventory/
│   └── receiving.spec.ts      # 입고 관리 테스트
├── stock/
│   └── current.spec.ts        # 재고 현황 테스트
├── accounting/
│   ├── sales.spec.ts          # 매출 관리 테스트
│   ├── purchases.spec.ts      # 매입 관리 테스트
│   ├── collections.spec.ts    # 수금 관리 테스트
│   └── payments.spec.ts       # 지급 관리 테스트
├── helpers/
│   ├── auth.ts                # 인증 헬퍼 함수
│   └── utils.ts               # 공통 유틸리티 함수
└── test-results.md            # 테스트 결과 문서
```

## 테스트 실행

### 사전 요구사항

1. 개발 서버가 실행 중이어야 합니다 (`npm run dev`)
2. Playwright가 설치되어 있어야 합니다 (`npx playwright install`)

### 실행 방법

#### 전체 테스트 실행
```bash
npm run test:e2e
```

#### UI 모드로 실행 (디버깅)
```bash
npm run test:e2e:ui
```

#### 헤드 모드로 실행 (브라우저 표시)
```bash
npm run test:e2e:headed
```

#### 디버그 모드로 실행
```bash
npm run test:e2e:debug
```

#### 특정 테스트만 실행
```bash
# 특정 파일
npx playwright test tests/e2e/dashboard.spec.ts

# 특정 디렉토리
npx playwright test tests/e2e/master/

# 특정 테스트
npx playwright test -g "페이지 로드 확인"
```

## 테스트 통계

- **총 테스트 수**: 65개
- **테스트 파일 수**: 13개
- **테스트 커버리지**: 주요 페이지 및 기능

## 테스트 범위

### 완료된 테스트 모듈

1. ✅ 대시보드 (5개 테스트)
2. ✅ 품목 관리 (7개 테스트)
3. ✅ 거래처 관리 (5개 테스트)
4. ✅ BOM 관리 (5개 테스트)
5. ✅ 입고 관리 (4개 테스트)
6. ✅ 재고 현황 (6개 테스트)
7. ✅ 매출 관리 (6개 테스트)
8. ✅ 매입 관리 (4개 테스트)
9. ✅ 수금 관리 (3개 테스트)
10. ✅ 지급 관리 (3개 테스트)
11. ✅ 공정 관리 (6개 테스트)
12. ✅ 계약 관리 (4개 테스트)
13. ✅ 월별 단가 관리 (7개 테스트)

## 테스트 결과 확인

테스트 실행 후 HTML 보고서가 생성됩니다:

```bash
npx playwright show-report
```

보고서 위치: `playwright-report/index.html`

## CI/CD 통합

GitHub Actions 예시:

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## 참고 문서

- [테스트 결과 상세 문서](./test-results.md)
- [Playwright 공식 문서](https://playwright.dev/)

