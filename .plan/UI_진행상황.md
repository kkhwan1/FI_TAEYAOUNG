# BOM UI 프로젝트 필터 구현 진행상황

## 작업 일시
2025-11-27

## 목표
클라이언트 요구사항: **프로젝트(고객사)별 BOM 데이터 분리**
- "대우 당진을 클릭하면 6~7개만 나와야 한다"
- 다른 현장(대우 포승 등)의 데이터가 섞이지 않아야 함

---

## 완료된 작업

### 1. filters.ts BOM 테이블 매핑 추가 ✅
**파일**: `src/lib/filters.ts`

**변경 내용**:
```typescript
// 추가된 코드 (Line 37)
bom: { customer: 'customer_id' },  // BOM 관계 (프로젝트별 분리)
```

**효과**: `applyCompanyFilter()` 함수가 BOM 테이블에서 `customer_id` 컬럼을 자동으로 인식

---

### 2. BOM API Route customer_id 필터 추가 ✅
**파일**: `src/app/api/bom/route.ts`

**변경 내용**:

1. **Import 추가** (Line 4):
```typescript
import { extractCompanyId, applyCompanyFilter } from '@/lib/filters';
```

2. **JSDoc 업데이트** (Line 14):
```typescript
* - company_id: Filter by customer/project (프로젝트별 BOM 분리)
```

3. **customer_id 추출 및 필터 적용** (Line 25, 66-67):
```typescript
const customerId = extractCompanyId(searchParams, 'company_id');  // 프로젝트별 필터
// ...
query = applyCompanyFilter(query, 'bom', customerId, 'customer');
```

4. **customer 조인 추가** (Line 57-61):
```typescript
customer:companies!customer_id (
  company_id,
  company_name,
  company_code
)
```

---

### 3. BOM 페이지 UI 프로젝트 필터 개선 ✅
**파일**: `src/app/master/bom/page.tsx`

**기존 구현 확인**:
- `selectedCompany` state: Line 151
- `useCompanyFilter` hook: Line 157
- `fetchBOMData`에서 `buildFilteredApiUrl` 사용: Line 213-217
- 거래처 필터 드롭다운: Line 2270-2288

**UI 수정** (Line 2270-2288):
- 라벨: "거래처 필터 - BOM 분리용" (원래 명칭 유지)
- 드롭다운 텍스트: "전체 거래처" / 개별 거래처명
- 스타일: 다른 필터와 동일한 기본 스타일 유지

---

## 작동 방식

### API 호출 흐름
```
1. 사용자가 프로젝트(고객사) 선택
   ↓
2. selectedCompany state 업데이트
   ↓
3. fetchBOMData() 호출 (useCallback dependency)
   ↓
4. buildFilteredApiUrl('/api/bom', selectedCompany, {...})
   → /api/bom?company_id=416  (예: 대우당진 선택시)
   ↓
5. API에서 extractCompanyId(searchParams, 'company_id')
   → customerId = 416
   ↓
6. applyCompanyFilter(query, 'bom', 416, 'customer')
   → query.eq('customer_id', 416)
   ↓
7. 대우당진 프로젝트의 BOM만 반환
```

---

## 고객사(프로젝트) 매핑
| 시트명 | company_id | 설명 |
|--------|------------|------|
| 대우당진 | 416 | 대우 당진 현장 |
| 대우포승 | 417 | 대우 포승 현장 |
| 풍기서산 | 418 | 풍기 서산 현장 |
| 호원오토 | 419 | 호원 오토 현장 |
| 인알파코리아 | 420 | 인알파코리아 현장 |

---

## 완료된 작업 (Phase 3)

### 4. Phase 3-2: Items 테이블 품목 등록 ✅
**실행일시**: 2025-11-27

**결과**:
- 총 271개 품목 등록 (3 배치)
- 상위 품목: 103개 (item_type: FINISHED)
- 하위 품목: 168개 (item_type: SUB/RAW)

**해결한 이슈**:
1. `item_type` 제약조건: '완제품' → 'FINISHED' (DB: RAW, SUB, FINISHED)
2. `inventory_type` 제약조건: '일반' → '반제품' (DB: 완제품, 반제품, 고객재고, 원재료, 코일)
3. `specifications` → `spec` 컬럼명 매핑

---

### 5. Phase 3-3: BOM 관계 등록 ✅
**실행일시**: 2025-11-27

**결과**:
- 총 346개 BOM 관계 등록
- 자기 참조 필터링: 41건 제외 (parent_id = child_id)

**고객사별 BOM 수**:
| 고객사 | customer_id | BOM 관계 수 |
|--------|-------------|-------------|
| 대우당진 | 416 | 1 |
| 대우포승 | 417 | 87 |
| 풍기서산 | 418 | 42 |
| 호원오토 | 419 | 155 |
| 인알파코리아 | 420 | 61 |

**해결한 이슈**:
1. `quantity` → `quantity_required` 컬럼명 매핑
2. BOM unique 제약조건 업데이트: `(parent_item_id, child_item_id)` → `(parent_item_id, child_item_id, customer_id)`
3. 자기 참조 방지 필터 추가 (`bom_no_self_reference` 제약조건 대응)

---

## 남은 작업

### 추가 개선 사항 (Optional)
- [ ] 트리 뷰 구현 (Tree Grid)
- [ ] 더블클릭 수정 기능
- [ ] 프로젝트 선택시 상위 품목만 표시 후 확장

---

## TypeScript 타입 체크
```bash
npm run type-check
# 결과: 성공 (오류 없음)
```

---

## 참고 파일
- `.plan/계획.md`: 클라이언트 요구사항 및 분석
- `scripts/import-bom-from-excel.ts`: BOM 데이터 Import 스크립트
- `.example/(추가)BOM 종합 - ERP (1).xlsx`: 원본 엑셀 파일
