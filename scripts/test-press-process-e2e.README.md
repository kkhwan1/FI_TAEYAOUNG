# press_process_type E2E 테스트 스크립트

## 개요

`test-press-process-e2e.js`는 press_process_type 필드의 전체 워크플로우를 테스트하는 E2E 스크립트입니다.

## 테스트 시나리오

### 1. 테스트 데이터 생성
- ✅ 테스트 고객사 조회/생성
- ✅ BLANKING 타입 품목 생성 (`TEST_BLANK_001`)
- ✅ STAMPING 타입 품목 생성 (`TEST_STAMP_001`)
- ✅ 각 품목에 대한 BOM 데이터 생성

### 2. API 필터링 테스트
**Test 1: BLANKING 필터링 (600톤)**
- API 호출: `/api/items/by-customer?customer_id=X&press_capacity=600`
- 예상 결과: BLANKING 타입 품목만 1개 반환
- 검증: `TEST_BLANK_001` 품목만 반환되는지 확인

**Test 2: STAMPING 필터링 (1000톤)**
- API 호출: `/api/items/by-customer?customer_id=X&press_capacity=1000`
- 예상 결과: STAMPING 타입 품목만 1개 반환
- 검증: `TEST_STAMP_001` 품목만 반환되는지 확인

### 3. 품목 수정 테스트
**Test 3: BLANKING → STAMPING 변경**
- `TEST_BLANK_001` 품목의 press_process_type을 STAMPING으로 수정
- API 호출: `/api/items/by-customer?customer_id=X&press_capacity=600`
- 예상 결과: BLANKING 타입 품목 0개 반환 (변경되었으므로)

**Test 4: press_process_type NULL 클리어**
- `TEST_STAMP_001` 품목의 press_process_type을 NULL로 설정
- API 호출: `/api/items/by-customer?customer_id=X&press_capacity=1000`
- 예상 결과: STAMPING 타입 품목 1개 반환 (변경된 TEST_BLANK_001만)

### 4. 테스트 데이터 정리
- ✅ 생성된 BOM 데이터 삭제
- ✅ 생성된 품목 데이터 삭제
- ✅ 테스트 데이터 초기화

## 실행 방법

### 사전 요구사항
1. Next.js 개발 서버가 실행 중이어야 함 (포트 5000)
   ```bash
   npm run dev:safe
   ```

2. `.env.local` 파일에 Supabase 연결 정보 설정
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

### 테스트 실행

**방법 1: npm 스크립트 사용**
```bash
npm run test:press-process
```

**방법 2: Node.js 직접 실행**
```bash
node scripts/test-press-process-e2e.js
```

## 출력 예시

```
ℹ️  === press_process_type E2E 테스트 시작 ===

🔹 테스트 고객사 조회/생성 중...
✅ 기존 고객사 사용: 현대자동차 (ID: 1)

ℹ️  === 테스트 데이터 생성 ===
🔹 품목 생성: TEST_BLANK_001 (BLANKING)
✅ 품목 생성 성공: TEST_BLANK_001 (ID: 1001)
🔹 품목 생성: TEST_STAMP_001 (STAMPING)
✅ 품목 생성 성공: TEST_STAMP_001 (ID: 1002)
🔹 BOM 생성: parent_item_id=1001, customer_id=1
✅ BOM 생성 성공: bom_id=5001
🔹 BOM 생성: parent_item_id=1002, customer_id=1
✅ BOM 생성 성공: bom_id=5002

ℹ️  === API 필터링 테스트 ===
🔹 API 테스트: press_capacity=600 → BLANKING 예상
✅ API 테스트 통과 - 1개 품목 반환
ℹ️    - TEST_BLANK_001: BLANKING
🔹 API 테스트: press_capacity=1000 → STAMPING 예상
✅ API 테스트 통과 - 1개 품목 반환
ℹ️    - TEST_STAMP_001: STAMPING

ℹ️  === 품목 수정 테스트 ===
🔹 품목 수정: item_id=1001 → STAMPING
✅ 품목 수정 성공: TEST_BLANK_001 → STAMPING
🔹 API 테스트: press_capacity=600 → BLANKING 예상
✅ API 테스트 통과 - 0개 품목 반환
🔹 품목 수정: item_id=1002 → NULL
✅ 품목 수정 성공: TEST_STAMP_001 → NULL
🔹 API 테스트: press_capacity=1000 → STAMPING 예상
✅ API 테스트 통과 - 1개 품목 반환
ℹ️    - TEST_BLANK_001: STAMPING

ℹ️  === 테스트 결과 요약 ===
✅ Test 1: BLANKING 필터링 (600톤)
✅ Test 2: STAMPING 필터링 (1000톤)
✅ Test 3: BLANKING → STAMPING 수정 후 필터링
✅ Test 4: NULL 클리어 후 필터링

🔹 테스트 데이터 정리 중...
✅ BOM 2개 삭제 완료
✅ 품목 2개 삭제 완료

ℹ️  === E2E 테스트 완료 ===
✅ === 모든 테스트 통과! ===
```

## 테스트 실패 예시

```
❌ Test 1: BLANKING 필터링 (600톤)
    - 예상 개수: 1, 실제: 2
    - 잘못된 타입 발견: TEST_STAMP_001

ℹ️  === 일부 테스트 실패 ===
```

## 종료 코드

- `0`: 모든 테스트 통과
- `1`: 하나 이상의 테스트 실패

## 주의사항

1. **개발 서버 실행 필수**: API 호출을 위해 `localhost:5000`에서 Next.js 서버가 실행 중이어야 합니다.

2. **데이터 정리**: 테스트가 완료되면 생성된 모든 데이터가 자동으로 삭제됩니다.

3. **고객사 재사용**: 기존 고객사가 있으면 재사용하고, 없으면 새로 생성합니다.

4. **BOM 필수 필드**: BOM 테이블의 스키마에 따라 `version`, `quantity` 등의 필드를 조정해야 할 수 있습니다.

## 트러블슈팅

### 오류: "고객사 조회/생성 오류"
- Supabase 연결 정보 확인
- companies 테이블 존재 여부 확인

### 오류: "품목 생성 실패"
- items 테이블 스키마 확인
- press_process_type 컬럼 존재 여부 확인

### 오류: "API 응답 오류: 404"
- Next.js 개발 서버 실행 확인: `npm run dev:safe`
- API 라우트 존재 확인: `src/app/api/items/by-customer/route.ts`

### 오류: "BOM 생성 실패"
- BOM 테이블 스키마 확인
- 필수 필드 누락 여부 확인

## 관련 파일

- **API 라우트**: `src/app/api/items/by-customer/route.ts`
- **데이터베이스**: Supabase (items, bom, companies 테이블)
- **환경 설정**: `.env.local`

## 버전 히스토리

- **v1.0.0** (2025-11-30): 초기 버전 생성
  - BLANKING/STAMPING 필터링 테스트
  - 품목 수정 및 NULL 클리어 테스트
  - 자동 데이터 정리 기능
