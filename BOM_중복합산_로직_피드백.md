# BOM 중복 합산 로직 피드백

**작성일**: 2025-11-29  
**분석 대상**: `src/app/api/bom/route.ts` (Lines 126-145)

---

## 현재 구현 상황

### 문제점

현재 BOM 조회 API (`GET /api/bom`)에서 **중복 항목을 자동으로 합산**하는 로직이 구현되어 있습니다.

```126:145:src/app/api/bom/route.ts
    // Step 0: 중복 BOM 항목 합산 (같은 parent-child-customer-supplier 조합)
    const groupedBOM = new Map<string, any>();
    (bomEntries || []).forEach((item: any) => {
      // 고유 키 생성: parent_item_id-child_item_id-customer_id-child_supplier_id
      const key = `${item.parent_item_id}-${item.child_item_id}-${item.customer?.company_id || item.customer_id || 'null'}-${item.child_supplier?.company_id || item.child_supplier_id || 'null'}`;

      if (groupedBOM.has(key)) {
        const existing = groupedBOM.get(key);
        // 수량 합산
        existing.quantity_required = (existing.quantity_required || 0) + (item.quantity_required || 0);
        // bom_id 배열로 관리 (삭제/수정 시 필요)
        existing.bom_ids = [...(existing.bom_ids || [existing.bom_id]), item.bom_id];
      } else {
        groupedBOM.set(key, {
          ...item,
          bom_ids: [item.bom_id]
        });
      }
    });
    const filteredEntries = Array.from(groupedBOM.values());
```

### 현재 동작 방식

1. **데이터베이스**: 중복 항목이 각각 별도로 저장됨 ✅
2. **API 조회 시**: 동일한 조합의 항목들을 **자동으로 합산**하여 하나로 반환 ❌
3. **프론트엔드**: 합산된 결과만 표시됨 ❌

### 문제점 상세 분석

#### 1. 데이터 손실
- 중복 항목이 합산되면서 **개별 항목의 정보가 손실**됨
- 각 항목의 `notes`, 생성일시, 수정일시 등이 보이지 않음

#### 2. 개별 관리 불가
- 사용자가 각 항목을 개별적으로 수정하거나 삭제할 수 없음
- `bom_ids` 배열로 여러 ID를 관리하지만, 실제로는 하나의 항목으로만 표시됨

#### 3. 의도와 다른 동작
- 코드 주석에 "중복 입력 허용"이라고 되어 있지만
- 실제 조회 시에는 합산되어 사용자가 중복 입력했는지 알 수 없음

---

## 사용자 요구사항

> "조회시 합산이 되는게 아니라 각 개별로 구분해서 나오도록 해야죠"

### 요구사항 분석

1. **각 개별 항목 표시**: DB에 저장된 모든 BOM 항목을 개별 행으로 표시
2. **합산 금지**: 중복 항목을 합산하지 않고 각각 별도로 표시
3. **개별 관리 가능**: 각 항목을 개별적으로 수정/삭제 가능

---

## 현재 코드의 영향 범위

### 영향받는 부분

1. **API 응답 구조**
   - `filteredEntries`: 합산된 결과만 반환
   - `bom_ids`: 배열로 관리되지만 프론트엔드에서 활용되지 않음

2. **프론트엔드 표시**
   - BOM 페이지에서 중복 항목이 하나로만 보임
   - 실제 DB에 여러 개의 항목이 있어도 화면에는 하나만 표시

3. **다운스트림 영향**
   - Excel 내보내기 시 합산된 데이터만 내보내짐
   - 원가 분석 시 합산된 수량으로 계산됨

---

## 해결 방안 제안

### 방안 1: 합산 로직 제거 (권장)

**변경 내용**:
- Lines 126-145의 그룹화 로직 제거
- `bomEntries`를 그대로 `filteredEntries`로 사용

**장점**:
- 단순하고 명확함
- 모든 개별 항목이 표시됨
- DB 상태와 화면 표시가 일치함

**단점**:
- 중복 항목이 여러 행으로 표시됨 (하지만 이것이 요구사항)

### 방안 2: 선택적 합산 (옵션)

**변경 내용**:
- 쿼리 파라미터로 `merge_duplicates` 옵션 추가
- `merge_duplicates=false`일 때만 개별 표시 (기본값)

**장점**:
- 필요 시 합산 기능 유지 가능
- 기존 기능과의 호환성

**단점**:
- 복잡도 증가
- 요구사항과 부합하지 않음 (항상 개별 표시 필요)

---

## 권장 사항

### 즉시 수정 필요

1. **Lines 126-145 제거**: 중복 합산 로직 완전 제거
2. **API 응답 구조 단순화**: `bomEntries`를 그대로 반환
3. **프론트엔드 검증**: 개별 항목이 모두 표시되는지 확인

### 추가 고려사항

1. **성능 영향**
   - 현재: 합산으로 인해 항목 수 감소 → 렌더링 성능 향상
   - 변경 후: 모든 항목 표시 → 항목 수 증가 → 성능 저하 가능
   - **대응**: 페이징 또는 가상 스크롤 고려

2. **사용자 경험**
   - 중복 항목이 여러 행으로 표시되면 혼란스러울 수 있음
   - **대응**: 필터/그룹화 기능으로 사용자가 선택적으로 확인 가능

3. **데이터 무결성**
   - 현재 합산 로직이 `bom_ids` 배열을 생성하지만 활용되지 않음
   - **대응**: 개별 항목 관리가 명확해짐

---

## 수정 예시 코드 (참고용)

### Before (현재)
```typescript
// Step 0: 중복 BOM 항목 합산
const groupedBOM = new Map<string, any>();
(bomEntries || []).forEach((item: any) => {
  // ... 합산 로직 ...
});
const filteredEntries = Array.from(groupedBOM.values());
```

### After (권장)
```typescript
// 개별 항목을 모두 표시 (합산 없음)
const filteredEntries = bomEntries || [];
```

---

## 결론

**현재 구현은 사용자 요구사항과 맞지 않습니다.**

- ✅ **요구사항**: 각 개별 항목을 구분해서 표시
- ❌ **현재 동작**: 중복 항목을 합산하여 하나로 표시

**권장 조치**: Lines 126-145의 중복 합산 로직을 제거하여 모든 항목을 개별적으로 표시하도록 변경해야 합니다.

---

## ✅ 수정 완료 (2025-11-29)

피드백에 따라 중복 합산 로직을 제거하고 개별 표시 방식으로 변경했습니다.

### 변경 내용

**파일**: `src/app/api/bom/route.ts`

**Before (합산)**:
```typescript
const groupedBOM = new Map<string, any>();
(bomEntries || []).forEach((item: any) => {
  // ... 합산 로직 ...
});
const filteredEntries = Array.from(groupedBOM.values());
```

**After (개별 표시)**:
```typescript
// 각 BOM 항목을 개별로 표시 (중복 합산하지 않음)
// 사용자가 각 항목을 개별적으로 수정/삭제할 수 있도록 함
const filteredEntries = bomEntries || [];
```

### 변경 효과

| 항목 | Before | After |
|------|--------|-------|
| 표시 방식 | 합산 (1줄) | 개별 (N줄) |
| 수정/삭제 | 복잡 (bom_ids 배열) | 간단 (개별 bom_id) |
| 데이터 정확성 | 손실 가능 | 원본 유지 |

