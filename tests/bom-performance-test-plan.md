# BOM API 성능 최적화 테스트 계획

## 📋 최적화 요약

### 구현된 최적화 사항

1. ✅ **N+1 쿼리 제거**: 가격 히스토리 배치 쿼리로 변경 (1,000+ 쿼리 → 2 쿼리)
2. ✅ **페이지네이션 개선**: 기본값 10,000 → 100, 최대 500 제한
3. ✅ **서버 사이드 필터링**: coilOnly, supplierId, vehicleType SQL 쿼리로 이동
4. ✅ **데이터베이스 인덱스**: 4개의 성능 최적화 인덱스 추가

### 파일 변경 사항

- **수정**: `src/app/api/bom/route.ts`
- **추가**: `supabase/migrations/20251129193411_add_bom_performance_indexes.sql`

---

## 🧪 테스트 시나리오

### 1. 기능 테스트 (Functional Testing)

#### 1.1 기본 BOM 목록 조회
```bash
GET /api/bom?limit=100&offset=0
```
**검증 항목**:
- [ ] 응답 상태 코드 200
- [ ] 응답 형식 유지 (entries, totalCount, finalTotal)
- [ ] 최대 100개 항목 반환
- [ ] totalCount 정확성
- [ ] finalTotal 정확성

#### 1.2 코일 전용 필터 (coilOnly)
```bash
GET /api/bom?coilOnly=true&limit=50
```
**검증 항목**:
- [ ] 코일 타입 항목만 반환 (inventory_type = '코일')
- [ ] totalCount가 필터 적용된 값
- [ ] 성능: 필터 적용 전보다 빠름

#### 1.3 납품처 필터 (supplierId)
```bash
GET /api/bom?supplierId=123&limit=50
```
**검증 항목**:
- [ ] 해당 납품처 항목만 반환
- [ ] totalCount 정확성
- [ ] 필터 미적용 항목 없음

#### 1.4 차종 필터 (vehicleType)
```bash
GET /api/bom?vehicleType=현대&limit=50
```
**검증 항목**:
- [ ] parent 또는 child의 vehicle_model이 일치하는 항목만 반환
- [ ] OR 조건 정상 동작

#### 1.5 복합 필터
```bash
GET /api/bom?coilOnly=true&supplierId=123&vehicleType=현대&limit=50
```
**검증 항목**:
- [ ] 모든 필터 조건 동시 적용
- [ ] AND 조건 정상 동작
- [ ] totalCount 정확성

#### 1.6 페이지네이션
```bash
# 첫 페이지
GET /api/bom?limit=20&offset=0

# 두 번째 페이지
GET /api/bom?limit=20&offset=20

# 세 번째 페이지
GET /api/bom?limit=20&offset=40
```
**검증 항목**:
- [ ] 각 페이지가 중복 없이 다른 항목 반환
- [ ] offset + limit이 totalCount를 초과하면 빈 배열
- [ ] 페이지네이션 메타데이터 정확성

#### 1.7 Limit 경계값 테스트
```bash
# 최소값
GET /api/bom?limit=1

# 기본값 (파라미터 없음)
GET /api/bom

# 최대값
GET /api/bom?limit=500

# 최대값 초과 (자동 제한)
GET /api/bom?limit=10000

# 음수 (자동 1로 변경)
GET /api/bom?limit=-10
```
**검증 항목**:
- [ ] limit=1: 1개 항목만 반환
- [ ] 기본값: 100개 반환
- [ ] limit=500: 최대 500개 반환
- [ ] limit=10000: 500개로 제한됨
- [ ] limit=-10: 1개 반환

#### 1.8 가격 히스토리 조회
```bash
GET /api/bom?priceMonth=2024-01&limit=100
```
**검증 항목**:
- [ ] 모든 항목에 unit_price 존재
- [ ] price_month가 일치하는 가격 반환
- [ ] 가격 없는 경우 item.price로 fallback
- [ ] total_price 계산 정확성

#### 1.9 빈 결과 처리
```bash
# 존재하지 않는 supplierId
GET /api/bom?supplierId=999999

# 존재하지 않는 vehicleType
GET /api/bom?vehicleType=존재하지않음
```
**검증 항목**:
- [ ] 빈 배열 반환
- [ ] totalCount = 0
- [ ] finalTotal = 0
- [ ] 에러 발생 안 함

---

### 2. 성능 테스트 (Performance Testing)

#### 2.1 응답 시간 측정

**테스트 조건**:
- 데이터베이스에 1,000개 이상의 BOM 항목 존재
- 동일한 쿼리를 5회 반복하여 평균 측정
- 캐시 영향 제거를 위해 각 테스트 전 서버 재시작

**측정 항목**:

| 시나리오 | 최적화 전 (예상) | 최적화 후 (목표) | 개선율 |
|---------|----------------|----------------|--------|
| 기본 조회 (limit=100) | ~5,000ms | <500ms | 90% |
| 코일 필터 (limit=100) | ~6,000ms | <600ms | 90% |
| 납품처 필터 (limit=100) | ~5,500ms | <550ms | 90% |
| 복합 필터 (limit=100) | ~7,000ms | <700ms | 90% |
| 대량 조회 (limit=500) | ~20,000ms | <2,000ms | 90% |

#### 2.2 데이터베이스 쿼리 수

**Before (최적화 전)**:
- BOM 목록 조회: 1 쿼리
- 가격 히스토리: N 쿼리 (N = 항목 수)
- 코일 스펙: 1 쿼리
- **총**: N+2 쿼리 (1,000개 항목이면 1,002 쿼리)

**After (최적화 후)**:
- BOM 목록 조회: 1 쿼리 (필터 포함)
- 가격 히스토리: 1 쿼리 (배치)
- 코일 스펙: 1 쿼리
- **총**: 3 쿼리

**개선율**: 99.7% 감소 (1,002 → 3)

#### 2.3 네트워크 트래픽 비교

| 시나리오 | 최적화 전 | 최적화 후 | 감소율 |
|---------|----------|----------|--------|
| 기본 조회 (파라미터 없음) | ~5MB (10,000개) | ~50KB (100개) | 99% |
| 필터 적용 (coilOnly) | ~5MB → 클라이언트 필터 | ~20KB (서버 필터) | 99.6% |
| 페이지네이션 (limit=100) | ~5MB | ~50KB | 99% |

#### 2.4 메모리 사용량

**서버 메모리**:
- 최적화 전: ~500MB (10,000개 항목 로딩)
- 최적화 후: ~5MB (100개 항목 로딩)
- **개선**: 99% 감소

**클라이언트 메모리**:
- 최적화 전: ~50MB (대량 데이터)
- 최적화 후: ~500KB (페이지네이션)
- **개선**: 99% 감소

---

### 3. 데이터베이스 인덱스 검증

#### 3.1 인덱스 생성 확인

**SQL 쿼리**:
```sql
-- 인덱스 목록 확인
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('bom', 'item_price_history')
ORDER BY tablename, indexname;
```

**검증 항목**:
- [ ] `bom_active_customer_parent_child_idx` 존재
- [ ] `bom_child_level_idx` 존재
- [ ] `bom_child_supplier_idx` 존재
- [ ] `item_price_history_item_month_idx` 존재

#### 3.2 인덱스 사용 확인

**EXPLAIN ANALYZE 실행**:
```sql
EXPLAIN ANALYZE
SELECT * FROM bom
WHERE is_active = true
  AND customer_id = 1
  AND parent_item_id = 100
LIMIT 100;
```

**검증 항목**:
- [ ] `Index Scan using bom_active_customer_parent_child_idx` 표시
- [ ] `Seq Scan` (전체 테이블 스캔) 없음
- [ ] Execution time < 10ms

---

### 4. 에러 처리 테스트

#### 4.1 잘못된 파라미터

```bash
# 문자열 limit
GET /api/bom?limit=abc

# 음수 offset
GET /api/bom?offset=-100

# 잘못된 priceMonth 형식
GET /api/bom?priceMonth=invalid
```

**검증 항목**:
- [ ] 에러 발생하지 않음
- [ ] 기본값으로 대체되거나 안전하게 처리
- [ ] 500 에러 없음

#### 4.2 데이터베이스 연결 실패

**시뮬레이션**: Supabase 연결 일시 중단

**검증 항목**:
- [ ] 적절한 에러 메시지 반환
- [ ] 500 에러 응답
- [ ] 클라이언트에 민감한 정보 노출 안 됨

---

## 🔧 테스트 실행 가이드

### 준비 사항

1. **Migration 적용**:
```bash
cd c:\Users\USER\claude_code\FITaeYoungERP
npx supabase db push
```

2. **개발 서버 실행**:
```bash
npm run dev
```

3. **테스트 데이터 준비**:
- 최소 1,000개 이상의 BOM 항목 필요
- 다양한 customer_id, supplier_id, vehicle_type 포함

### 수동 테스트

#### 브라우저 테스트
```
http://localhost:3000/api/bom?limit=100
http://localhost:3000/api/bom?coilOnly=true&limit=50
http://localhost:3000/api/bom?supplierId=1&limit=50
```

#### cURL 테스트
```bash
# 응답 시간 측정
time curl "http://localhost:3000/api/bom?limit=100"

# 응답 크기 측정
curl -w "%{size_download}\n" -o /dev/null -s "http://localhost:3000/api/bom?limit=100"
```

### 성능 벤치마크

**Before (최적화 전) 측정**:
1. 최적화 코드를 임시로 되돌림 (git stash)
2. 응답 시간, 쿼리 수, 네트워크 트래픽 측정
3. 결과 기록

**After (최적화 후) 측정**:
1. 최적화 코드 복원 (git stash pop)
2. 동일한 측정 수행
3. Before/After 비교

### 자동화된 테스트 (추후 구현)

```typescript
// tests/api/bom.test.ts
describe('BOM API Performance', () => {
  test('응답 시간 500ms 이하', async () => {
    const start = Date.now();
    const res = await fetch('/api/bom?limit=100');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('페이지네이션 limit 제한', async () => {
    const res = await fetch('/api/bom?limit=10000');
    const data = await res.json();
    expect(data.entries.length).toBeLessThanOrEqual(500);
  });

  test('서버 사이드 필터링', async () => {
    const res = await fetch('/api/bom?coilOnly=true');
    const data = await res.json();
    expect(data.entries.every(e => e.child.inventory_type === '코일')).toBe(true);
  });
});
```

---

## 📊 예상 성능 개선 지표

### 종합 개선 요약

| 지표 | 최적화 전 | 최적화 후 | 개선율 |
|-----|----------|----------|--------|
| **응답 시간** | ~5,000ms | <500ms | **90%** |
| **쿼리 수** | 1,000+ | 3 | **99.7%** |
| **네트워크 트래픽** | ~5MB | ~50KB | **99%** |
| **서버 메모리** | ~500MB | ~5MB | **99%** |
| **클라이언트 메모리** | ~50MB | ~500KB | **99%** |

### 사용자 체감 개선

- ✅ 페이지 로딩 시간: 5초 → 0.5초 미만
- ✅ 필터 적용 속도: 즉시 반영
- ✅ 페이지네이션: 부드러운 UX
- ✅ 서버 부하 감소: 동시 사용자 수 증가 가능

---

## ✅ 테스트 체크리스트

### 필수 테스트 (Priority 1)

- [ ] 기본 BOM 목록 조회 (limit=100)
- [ ] 코일 전용 필터 동작
- [ ] 납품처 필터 동작
- [ ] 페이지네이션 (offset/limit)
- [ ] 응답 시간 500ms 이하
- [ ] 데이터베이스 쿼리 3개 이하
- [ ] 인덱스 생성 확인
- [ ] 인덱스 사용 확인 (EXPLAIN ANALYZE)

### 추가 테스트 (Priority 2)

- [ ] 차종 필터 동작
- [ ] 복합 필터 (coilOnly + supplierId)
- [ ] Limit 경계값 테스트
- [ ] 가격 히스토리 조회
- [ ] 빈 결과 처리
- [ ] 네트워크 트래픽 측정
- [ ] 메모리 사용량 측정

### 선택 테스트 (Priority 3)

- [ ] 에러 처리 (잘못된 파라미터)
- [ ] 에러 처리 (데이터베이스 연결 실패)
- [ ] 동시성 테스트 (100명 동시 접속)
- [ ] 부하 테스트 (1000 req/min)

---

## 📝 테스트 결과 보고

### 보고서 양식

```markdown
# BOM API 성능 최적화 테스트 결과

**테스트 일시**: YYYY-MM-DD HH:MM:SS
**테스터**: [이름]
**환경**: [개발/스테이징/프로덕션]

## 테스트 요약
- 총 테스트 항목: [N]개
- 통과: [N]개
- 실패: [N]개
- 건너뜀: [N]개

## 성능 측정 결과

| 지표 | Before | After | 개선율 |
|-----|--------|-------|--------|
| 응답 시간 | XXms | XXms | XX% |
| 쿼리 수 | XX | XX | XX% |
| 네트워크 | XXMB | XXKB | XX% |

## 발견된 이슈
1. [이슈 설명]
2. [이슈 설명]

## 권장 사항
1. [권장 사항]
2. [권장 사항]
```

---

## 🚀 배포 전 최종 체크리스트

- [ ] 모든 Priority 1 테스트 통과
- [ ] 응답 시간 목표 달성 (<500ms)
- [ ] 데이터베이스 인덱스 적용 완료
- [ ] 에러 로그 확인 (24시간)
- [ ] 롤백 계획 수립
- [ ] 모니터링 대시보드 설정
- [ ] 팀 리뷰 완료
- [ ] 문서 업데이트 (API 문서, 변경 사항 기록)

---

**작성일**: 2024-11-29
**최종 수정**: 2024-11-29
**버전**: 1.0
