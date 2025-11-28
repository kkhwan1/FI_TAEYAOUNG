# BOM 템플릿 시스템 종합 가이드

**최종 업데이트**: 2025-11-27
**시스템 상태**: 구현 완료 ✅

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [DB 구조](#2-db-구조)
3. [Excel 템플릿 구조](#3-excel-템플릿-구조)
4. [기술 구현 세부사항](#4-기술-구현-세부사항)
5. [비즈니스 관계 정리](#5-비즈니스-관계-정리)
6. [API 사용법](#6-api-사용법)
7. [문제 해결 이력](#7-문제-해결-이력)
8. [원본 Excel vs DB 데이터 비교](#8-원본-excel-vs-db-데이터-비교)

---

## 1. 시스템 개요

### 1.1 BOM 템플릿 시스템이란?

태창금속 ERP의 **BOM(Bill of Materials) 템플릿 시스템**은 고객사별 부품 구성 정보를 Excel 파일로 내보내고 관리하는 기능입니다.

### 1.2 핵심 기능

- **고객사별 BOM 시트 생성**: 5개 고객사 각각의 납품 품목 관리
- **모품목-자품목 계층 구조**: 완제품(모품목)과 원자재/부품(자품목) 관계
- **최신 단가 추적**: 가격 정보 관리
- **납품처 자동 결정**: 품번 패턴 기반 납품처 매핑
- **마감금액 자동 계산**: Excel 수식(=단가×마감수량) 적용
- **Excel 다운로드/업로드**: 템플릿 기반 데이터 입출력

### 1.3 관련 API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/download/template/bom` | GET | BOM 템플릿 Excel 다운로드 |
| `/api/bom/upload` | POST | BOM 데이터 Excel 업로드 |
| `/api/bom` | GET/POST | BOM CRUD 작업 |

---

## 2. DB 구조

### 2.1 핵심 테이블

#### companies 테이블 (고객사/공급사)
```sql
CREATE TABLE companies (
  company_id SERIAL PRIMARY KEY,
  company_name VARCHAR(100) NOT NULL,
  company_type VARCHAR(20) NOT NULL,  -- '고객사', '공급사', '협력사'
  is_active BOOLEAN DEFAULT true
);
```

#### bom 테이블 (BOM 관계)
```sql
CREATE TABLE bom (
  bom_id SERIAL PRIMARY KEY,
  parent_item_id INTEGER REFERENCES items(item_id),  -- 모품목
  child_item_id INTEGER REFERENCES items(item_id),   -- 자품목
  quantity_required DECIMAL,  -- 소요량 (U/S)
  level_no INTEGER,           -- 레벨
  is_active BOOLEAN DEFAULT true
);
```

#### customer_bom_templates 테이블 (고객사-BOM 매핑)
```sql
CREATE TABLE customer_bom_templates (
  template_id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES companies(company_id),
  bom_id INTEGER REFERENCES bom(bom_id)
);
```

### 2.2 BOM 템플릿 고객사 현황 (2025-11-27 기준)

**시트 생성 대상 고객사** (원본 Excel 기준 5개):

| 순서 | 시트명 | company_id | 실제 납품처 | 템플릿 수 | 상태 |
|------|--------|------------|-------------|-----------|------|
| 1 | 대우공업 | 360 | 대우당진, 대우포승 | 21개 | ✅ 정상 |
| 2 | 풍기산업 | 414 | 풍기서산 | 42개 | ✅ 정상 |
| 3 | 다인 | 415 | 풍기서산 | 8개 | ✅ 정상 |
| 4 | 호원오토 | 379 | 호원오토 | 66개 | ✅ 정상 |
| 5 | 인알파코리아 | 380 | 인알파코리아 | 63개 | ✅ 정상 |

> ✅ **해결됨**: 모든 5개 고객사가 정상적으로 시트 생성됩니다.

### 2.3 DB 데이터 현황

**DB 총계**:
- 고유 모품목 (parent_item_id): **79개**
- 고유 자품목 (child_item_id): **121개**
- BOM 레코드 총 수: **261개**

---

## 3. Excel 템플릿 구조

### 3.1 시트(Sheet) 구성 - 총 6개

원본 Excel 파일(`태창금속 BOM.xlsx`) 기준:

| 시트 순서 | 시트명 | 내용 | 비고 |
|-----------|--------|------|------|
| 1 | 대우공업 | 대우공업 그룹 납품 품목 | 대우당진, 대우포승 포함 |
| 2 | 풍기산업 | 풍기산업 납품 품목 | 풍기서산에 납품 |
| 3 | 다인 | 다인 납품 품목 | 풍기서산에 납품 |
| 4 | 호원오토 | 호원오토 납품 품목 | |
| 5 | 인알파코리아 | 인알파코리아 납품 품목 | |
| 6 | **최신단가** | 단가 참조 시트 | 품번 + 단가 목록 |

### 3.2 행(Row) 구조

| 행 번호 | 내용 | 설명 |
|---------|------|------|
| 1-5 | 빈 행 | 상단 여백 |
| **6** | **헤더 행** | 컬럼 제목 (시트별 34~36개) |
| 7+ | 데이터 행 | 실제 BOM 품목 데이터 |

### 3.3 열(Column) 구조 - 시트별 상이

#### 레이아웃 1: 대우공업/풍기산업/다인 (31 컬럼, A-AE)

| 열 | 헤더명 | 설명 | 구현 상태 |
|----|--------|------|----------|
| A | 납품처 | 품번 패턴 기반 자동 결정 | ✅ 구현 |
| B | 차종 | 차량 모델 | ✅ 구현 |
| C | 품번 | 모품목 품번 | ✅ 구현 |
| D | 품명 | 모품목 품명 | ✅ 구현 |
| E | 단가 | 납품 단가 | ✅ 구현 |
| F | 마감수량 | 마감 수량 (사용자 입력) | ✅ 구현 |
| G | 마감금액 | `=E*F` 수식 | ✅ 수식 구현 |
| H | (빈칸) | 구분선 | ✅ 구현 |
| I | 구매처 | 납품처와 동일 | ✅ 구현 |
| J | 차종 | 차량 모델 | ✅ 구현 |
| K | 품번 | 자품목 품번 | ✅ 구현 |
| L | 품명 | 자품목 품명 | ✅ 구현 |
| M | U/S 또는 소요량 | 소요량 | ✅ 구현 |
| N | 단가 | 구매 단가 | ✅ 구현 |
| O | 구매수량 | 구매 수량 (사용자 입력) | ✅ 구현 |
| P | 구매금액 | `=N*O` 수식 | ✅ 수식 구현 |
| Q-AE | 기타 | 비고, KG단가, 재질 등 | ✅ 구현 |

#### 레이아웃 2: 호원오토/인알파코리아 (36 컬럼, A-AJ)

| 열 | 차이점 | 설명 |
|----|--------|------|
| J | 구매처 | (레이아웃1의 I에서 한 칸 뒤로) |
| K-AJ | 기타 | 추가 컬럼 포함 |

### 3.4 Column M 레이블 분기

| 시트명 | Column M 헤더 |
|--------|---------------|
| 대우공업 | **U/S** |
| 풍기산업 | **소요량** |
| 다인 | **소요량** |
| 호원오토 | **소요량** |
| 인알파코리아 | **소요량** |

---

## 4. 기술 구현 세부사항

### 4.1 핵심 파일

| 파일 | 설명 |
|------|------|
| `src/app/api/download/template/bom/route.ts` | BOM 템플릿 다운로드 API |
| `src/app/api/bom/upload/route.ts` | BOM 업로드 API |
| `src/lib/excel-header-mapper.ts` | Excel 헤더 매핑 유틸리티 |

### 4.2 고정 고객사 순서 (route.ts)

```typescript
// 원본 Excel 시트 순서대로 고정
const FIXED_CUSTOMER_ORDER = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];
```

### 4.3 납품처 자동 결정 함수 (신규 구현)

```typescript
/**
 * 납품처 결정 함수
 * 고객사(시트명)와 품번 패턴에 따라 실제 납품처를 반환
 *
 * 매핑 규칙 (원본 Excel 기준):
 * - 대우공업: 품번에 '-L' 패턴 → 대우포승, '-AT'/'-BY'/'-2J'/'-EV' 패턴 → 대우당진
 * - 풍기산업/다인: 모두 풍기서산
 * - 호원오토/인알파코리아: 고객사명 그대로 사용
 */
function getDeliveryDestination(customerName: string, itemCode: string): string {
  // 대우공업: 품번 패턴에 따라 납품처 결정
  if (customerName === '대우공업') {
    // L 계열 패턴 (L2000, L5000, L8400 등) → 대우포승
    if (/-L\d/.test(itemCode)) {
      return '대우포승';
    }
    // AT, BY, 2J, EV 등 패턴 → 대우당진
    if (/-AT|BY\d|2J\d|-EV/.test(itemCode)) {
      return '대우당진';
    }
    // 기본값: 대우포승 (L 계열이 더 많음)
    return '대우포승';
  }

  // 풍기산업, 다인: 풍기서산으로 납품
  if (customerName === '풍기산업' || customerName === '다인') {
    return '풍기서산';
  }

  // 호원오토, 인알파코리아 등: 고객사명 그대로 사용
  return customerName;
}
```

### 4.4 마감금액 수식 구현

```typescript
// G열: 마감금액 = 단가(E) × 마감수량(F) - Excel 수식으로 설정
parentRow.getCell(7).value = { formula: `E${currentRow}*F${currentRow}` };
parentRow.getCell(7).numFmt = STYLES.NUMBER_INTEGER;

// P열: 구매금액 = 구매단가(N) × 구매수량(O) - Excel 수식으로 설정
childRow.getCell(16 + childOffset).value = { formula: `N${currentRow}*O${currentRow}` };
```

### 4.5 ID 기반 고객사 매핑

```typescript
// ParentBomData 인터페이스
interface ParentBomData {
  parentItem: {
    item_code: string;
    item_name: string;
    vehicle_model: string;
    price: number;
  };
  childItems: Array<ChildItem>;
  customerId?: number;
  customerName?: string;
  customerNames?: string[];
  customerIds?: number[];  // ID 기반 매핑
  bomId?: number;
  parentItemId?: number;
}
```

### 4.6 고객사별 시트 필터링 로직

```typescript
const filteredBomData = groupedBomData.filter(parentBom => {
  // ID 기반 매칭 (우선)
  if (customer.id && parentBom.customerIds?.includes(customer.id)) {
    return true;
  }
  // 이름 기반 매칭 (폴백)
  return parentBom.customerNames?.includes(customer.name);
});
```

---

## 5. 비즈니스 관계 정리

### 5.1 시트명 vs 실제 납품처

| Excel 시트명 | 실제 납품처 (A열) | 결정 방식 |
|-------------|------------------|----------|
| 대우공업 | 대우당진, 대우포승 | 품번 패턴 기반 자동 결정 |
| 풍기산업 | 풍기서산 | 고정 매핑 |
| 다인 | 풍기서산 | 고정 매핑 |
| 호원오토 | 호원오토 | 시트명과 동일 |
| 인알파코리아 | 인알파코리아 | 시트명과 동일 |

### 5.2 대우공업 그룹 관계

```
대우공업 (시트명/그룹)
    ├─→ 대우당진 (당진공장) ← 품번: -AT, BY*, 2J*, -EV 패턴
    └─→ 대우포승 (포승공장) ← 품번: -L* 패턴 (기본값)
```

### 5.3 풍기 그룹 관계

```
풍기서산 (실제 납품처)
    ├─← 풍기산업 (협력업체 시트)
    └─← 다인 (협력업체 시트)
```

---

## 6. API 사용법

### 6.1 BOM 템플릿 다운로드

```bash
# GET /api/download/template/bom
curl -X GET "http://localhost:5000/api/download/template/bom" \
  -H "Accept: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" \
  -o bom_template.xlsx
```

**응답**: Excel 파일 (6개 시트: 5개 고객사 + 최신단가)

### 6.2 BOM 데이터 업로드

```bash
# POST /api/bom/upload
curl -X POST "http://localhost:5000/api/bom/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@bom_data.xlsx"
```

---

## 7. 문제 해결 이력

### 7.1 3개 시트만 생성되는 문제 (2025-11-27) ✅ 해결

**증상**: BOM 템플릿 다운로드 시 3개 시트만 생성 (풍기산업, 다인 누락)

**원인**: `customer_bom_templates` 테이블에 풍기산업(414)과 다인(415)의 매핑이 없었음

**해결**: DB에 풍기산업(414)과 다인(415) 고객사 추가 및 BOM 매핑 등록

| 고객사 | company_id | template_count | 상태 |
|--------|------------|----------------|------|
| 대우공업 | 360 | 21 | ✅ 정상 |
| 풍기산업 | 414 | 42 | ✅ 정상 |
| 다인 | 415 | 8 | ✅ 정상 |
| 호원오토 | 379 | 66 | ✅ 정상 |
| 인알파코리아 | 380 | 63 | ✅ 정상 |

### 7.2 납품처가 시트명으로 표시되는 문제 (2025-11-27) ✅ 해결

**증상**: A열 납품처에 시트명(대우공업)이 그대로 표시되어야 할 곳에 실제 납품처(대우포승, 대우당진)가 아닌 시트명이 표시됨

**원인**: `createCustomerSheet` 함수에서 `customerName`을 그대로 사용

**해결**: `getDeliveryDestination()` 함수 구현으로 품번 패턴 기반 납품처 자동 결정

```typescript
// 변경 전
parentRow.getCell(1).value = customerName;  // A: 납품처

// 변경 후
const itemCode = parentBom.parentItem.item_code;
const deliveryDest = getDeliveryDestination(customerName, itemCode);
parentRow.getCell(1).value = deliveryDest;  // A: 납품처 (품번 패턴 기반)
```

### 7.3 마감금액 수식 누락 (2025-11-27) ✅ 해결

**증상**: G열 마감금액이 빈 값으로 표시됨

**원인**: 마감금액 셀에 수식이 설정되지 않음

**해결**: Excel 수식 `=E*F` 추가

```typescript
// G: 마감금액 = 단가(E) × 마감수량(F) - 수식으로 설정
parentRow.getCell(7).value = { formula: `E${currentRow}*F${currentRow}` };
parentRow.getCell(7).numFmt = STYLES.NUMBER_INTEGER;
```

### 7.4 컬럼 구조 차이 (2025-11-27) ✅ 해결

**증상**: 현재 템플릿 31개 컬럼 vs 원본 Excel 34-36개 컬럼

**해결**: 레이아웃 타입별 컬럼 구조 정의
- **Layout1** (대우공업/풍기산업/다인): 31개 컬럼
- **Layout2** (호원오토/인알파코리아): 36개 컬럼

---

## 8. 원본 Excel vs DB 데이터 비교

### 8.1 원본 Excel 파일 (`태창금속 BOM.xlsx`) 분석

| 시트명 | 데이터행 | 모품목 | 자품목 | 실제 납품처 (A열) |
|--------|---------|--------|--------|------------------|
| 대우공업 | 137행 | 13개 | 121개 | 대우당진(4), 대우포승(9) |
| 풍기산업 | 52행 | 9개 | 42개 | 풍기서산(9) |
| 다인 | 19행 | 8개 | 8개 | 풍기서산(8) |
| 호원오토 | 225행 | 45개 | 140개 | 호원오토(45) |
| 인알파코리아 | 146행 | 50개 | 75개 | 인알파코리아(50) |
| 최신단가 | 238행 | 238개 | 0개 | (단가 참조용) |

**원본 Excel 총계**:
- **고유 모품목 (품번 기준, 최신단가 제외)**: 125개
- **고유 자품목 (품번 기준)**: 101개

### 8.2 현재 DB 데이터

- 고유 모품목 (parent_item_id): **79개**
- 고유 자품목 (child_item_id): **121개**

### 8.3 비교 결과

| 항목 | 원본 Excel | DB | 차이 |
|------|-----------|-----|------|
| 고유 모품목 | 125개 | 79개 | **-46개** (DB에 누락) |
| 고유 자품목 | 101개 | 121개 | +20개 (DB에 더 많음) |

---

## 부록: 참조 파일 목록

### .example 폴더 Excel 파일

| 파일명 | 설명 |
|--------|------|
| `태창금속 BOM.xlsx` | 원본 BOM 데이터 |
| `BOM 종합 - ERP.xlsx` | ERP 참조 데이터 |

### 소스 코드

| 파일 | 설명 |
|------|------|
| `src/app/api/download/template/bom/route.ts` | 다운로드 API |
| `src/app/api/bom/upload/route.ts` | 업로드 API |
| `src/lib/excel-header-mapper.ts` | 헤더 매핑 유틸리티 |

---

**문서 작성**: Claude AI
**최종 업데이트**: 2025-11-27
**구현 상태**: ✅ 완료
