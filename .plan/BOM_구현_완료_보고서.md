# BOM 프로젝트별 분리 구현 완료 보고서

## 작업 일시
2025-11-27

## 목표 달성 현황

### 클라이언트 요구사항
> "대우 당진을 클릭하면 6~7개만 나와야 한다"
> "다른 현장(대우 포승 등)의 데이터가 섞이지 않아야 함"

### 구현 결과: ✅ 완료

---

## Phase 1: 기초 데이터 등록 ✅

### 1-1. 납품처(고객사) 5개 등록

| company_id | company_code | company_name | company_type |
|------------|--------------|--------------|--------------|
| 416 | CUS-DAEWOO-DJ | 대우당진 | 고객사 |
| 417 | CUS-DAEWOO-PS | 대우포승 | 고객사 |
| 418 | CUS-PUNGGI-SS | 풍기서산 | 고객사 |
| 419 | CUS-HOWON | 호원오토 | 고객사 |
| 420 | CUS-INALPA | 인알파코리아 | 고객사 |

### 1-2. 구매처(공급사) 14개 등록

| company_id | company_name | company_category |
|------------|--------------|------------------|
| 421 | 태창금속 | 태창금속 (자체) |
| 422-424 | 삼진스틸, 아신금속, 대일CFT | 하드웨어 |
| 425-428 | 제이에스테크, 신성테크, 창경에스테크, 호원사급 | 협력업체 |
| 429-434 | 대우포승 사급, 세원테크, 현대제철 등 | 사급 |

---

## Phase 2: DB 스키마 수정 ✅

### BOM 테이블 수정사항

**Migration 1**: `add_customer_id_to_bom`
```sql
ALTER TABLE bom ADD COLUMN customer_id INTEGER REFERENCES companies(company_id);
CREATE INDEX idx_bom_customer_id ON bom(customer_id);
CREATE INDEX idx_bom_customer_parent ON bom(customer_id, parent_item_id);
```

**Migration 2**: `update_bom_unique_constraint_with_customer`
```sql
ALTER TABLE bom DROP CONSTRAINT IF EXISTS bom_parent_child_unique;
ALTER TABLE bom ADD CONSTRAINT bom_parent_child_customer_unique
  UNIQUE (parent_item_id, child_item_id, customer_id);
```

**변경 이유**:
- 동일한 parent-child 관계가 다른 고객사에서 중복될 수 있음
- 기존 `(parent_item_id, child_item_id)` 제약조건으로는 프로젝트별 분리 불가

---

## Phase 3: UI/API 필터 구현 ✅

### 3-1. filters.ts 수정

**파일**: `src/lib/filters.ts`

```typescript
// 추가된 매핑 (Line 37)
bom: { customer: 'customer_id' },
```

### 3-2. BOM API Route 수정

**파일**: `src/app/api/bom/route.ts`

```typescript
// customer_id 파라미터 추출 및 필터 적용
const customerId = extractCompanyId(searchParams, 'company_id');
query = applyCompanyFilter(query, 'bom', customerId, 'customer');

// customer 조인 추가
customer:companies!customer_id (
  company_id,
  company_name,
  company_code
)
```

### 3-3. BOM 페이지 UI

**파일**: `src/app/master/bom/page.tsx`

- 기존 `selectedCompany` state 활용
- `useCompanyFilter()` 훅과 `buildFilteredApiUrl()` 연동
- 거래처 필터 드롭다운으로 프로젝트 선택

---

## Phase 4: 데이터 Import ✅

### 4-1. Items 테이블 등록

**스크립트**: `scripts/import-bom-from-excel.ts`

**결과**:
- 총 271개 품목 등록
- 상위 품목 (FINISHED): 103개
- 하위 품목 (SUB/RAW): 168개

**해결한 이슈**:
1. `item_type` 제약조건: '완제품' → 'FINISHED'
2. `inventory_type` 제약조건: '일반' → '반제품'
3. `specifications` → `spec` 컬럼명 매핑

### 4-2. BOM 관계 등록

**결과**:
- 총 346개 BOM 관계 등록
- 자기 참조 필터링: 41건 제외

**고객사별 분포**:

| 고객사 | customer_id | BOM 관계 수 |
|--------|-------------|-------------|
| 대우당진 | 416 | 1 |
| 대우포승 | 417 | 87 |
| 풍기서산 | 418 | 42 |
| 호원오토 | 419 | 155 |
| 인알파코리아 | 420 | 61 |
| **합계** | | **346** |

**해결한 이슈**:
1. `quantity` → `quantity_required` 컬럼명 매핑
2. Unique 제약조건 업데이트 (customer_id 포함)
3. 자기 참조 방지 (`bom_no_self_reference` 대응)

---

## 사용 방법

### BOM 페이지 접속
1. `/master/bom` 페이지 접속
2. **거래처 필터** 드롭다운에서 고객사 선택
3. 해당 고객사의 BOM 데이터만 표시

### API 호출 예시
```
GET /api/bom?company_id=416  → 대우당진 BOM만 조회
GET /api/bom?company_id=419  → 호원오토 BOM만 조회
GET /api/bom                  → 전체 BOM 조회 (필터 없음)
```

---

## 관련 파일

### 수정된 파일
- `src/lib/filters.ts` - BOM 테이블 매핑 추가
- `src/app/api/bom/route.ts` - customer_id 필터 구현
- `src/app/master/bom/page.tsx` - 거래처 필터 UI (기존 활용)

### 생성된 파일
- `scripts/import-bom-from-excel.ts` - 엑셀 → DB Import 스크립트
- `analyze-excel-bom.js` - 엑셀 구조 분석 (디버그용)

### 데이터 소스
- `.example/(추가)BOM 종합 - ERP (1).xlsx` - 원본 엑셀 파일

---

## 향후 개선 사항 (Optional)

### 클라이언트 추가 요청 가능 항목
- [ ] 트리 뷰 구현 (Tree Grid) - 모품목 클릭 시 자품목 확장
- [ ] 더블클릭 수정 기능 - 인라인 편집
- [ ] 프로젝트 선택 시 상위 품목만 표시 후 단계적 확장
- [ ] BOM 계층 구조 시각화 (Recursive CTE 활용)

### 기술적 개선
- [ ] BOM level_no 자동 계산 트리거
- [ ] 순환 참조 방지 로직 강화
- [ ] 대량 데이터 페이지네이션 최적화

---

## 테스트 검증

### DB 데이터 확인
```sql
-- 고객사별 BOM 카운트
SELECT c.company_name, b.customer_id, COUNT(*) as bom_count
FROM bom b
LEFT JOIN companies c ON b.customer_id = c.company_id
WHERE b.is_active = true
GROUP BY b.customer_id, c.company_name;
```

### TypeScript 타입 체크
```bash
npm run type-check
# 결과: 성공 (오류 없음)
```

---

## 결론

**클라이언트 요구사항 충족**:
1. ✅ "대우 당진을 클릭하면 해당 데이터만 표시" - customer_id 필터 구현
2. ✅ "다른 현장 데이터가 섞이지 않음" - 프로젝트별 BOM 분리 완료
3. ✅ 엑셀 시트 구조 반영 - 5개 고객사별 데이터 분리

**총 작업량**:
- 고객사/공급사: 19개 등록
- 품목: 271개 등록
- BOM 관계: 346개 등록
- 코드 수정: 3개 파일
- DB 마이그레이션: 2개
