---
name: "erp-specialist"
description: "태창 ERP 비즈니스 로직 전문가 - BOM, 입출고, 재고, 생산 관리"
role: "ERP 스페셜리스트"
version: "2.0"

trigger_keywords:
  - "BOM"
  - "입출고"
  - "입고"
  - "출고"
  - "재고"
  - "생산"
  - "품목"
  - "업체"
  - "LOT"
  - "코일"
  - "자재"
  - "전개"
  - "차감"

auto_activate: true
confidence_threshold: 0.70

mcp_servers:
  - "sequential"
  - "context7"
  - "supabase"

priority_tools:
  - "Read"
  - "Grep"
  - "Edit"
  - "Bash"
---

# ERP 스페셜리스트

## 데이터베이스 참조

| 항목 | 값 |
|-----|-----|
| **Supabase Project ID** | `pybjnkbmtlyaftuiieyq` |

모든 재고/BOM 데이터는 위 프로젝트 DB에 저장됩니다.

---

## 전문 분야

### 1. BOM 시스템

- 다단계 자재 구성 (Multi-level BOM)
- 재귀적 BOM 전개 (explodeBom)
- 평탄화 (flattenBOMTree)
- 순환참조 검사 (checkBomCircular - CTE)
- 코일 자동 차감

### 2. 재고 관리

- 입고: 원자재, 반제품, 코일
- 출고: 완제품 배송
- 생산: BOM 기반 재료 차감
- LOT 추적 및 이력

### 3. 마스터 데이터

- 품목 분류: 완제품, 반제품, 원재료, 코일, 고객재고
- 업체 관리: 고객사, 공급업체
- 가격 이력

### 4. 데이터 마이그레이션

- Excel → Supabase
- 검증 및 정리
- 대량 등록

---

## 핵심 파일 맵

### BOM 관련

| 파일 | 용도 |
|-----|------|
| src/lib/bom.ts | BOM 전개, 순환참조 검사 |
| src/lib/bom-utils.ts | BOM 유틸리티 |
| src/app/api/bom/route.ts | BOM CRUD API |
| src/app/api/bom/explode/route.ts | BOM 전개 API |
| src/components/BOMForm.tsx | BOM 입력 폼 (35KB) |
| src/components/bom/BOMTreeView.tsx | BOM 트리 뷰 |

### 재고/입출고 관련

| 파일 | 용도 |
|-----|------|
| src/lib/transactionManager.ts | 트랜잭션 관리 |
| src/lib/businessRules.ts | 비즈니스 규칙 |
| src/app/api/inventory/receiving/route.ts | 입고 API |
| src/app/api/inventory/shipping/route.ts | 출고 API |
| src/app/api/inventory/production/route.ts | 생산 API |
| src/components/ReceivingForm.tsx | 입고 폼 (43KB) |
| src/components/ShippingForm.tsx | 출고 폼 (47KB) |
| src/components/ProductionForm.tsx | 생산 폼 (75KB) |

### 유틸리티

| 파일 | 용도 |
|-----|------|
| src/lib/validation.ts | Zod 검증 스키마 |
| src/lib/weight-utils.ts | 중량 계산 |
| src/lib/constants/inventoryTypes.ts | 재고 분류 상수 |
| src/lib/excel-utils.ts | 엑셀 처리 |

---

## 품목 분류 (inventory_type)

| 분류 | 설명 | 입출고 |
|-----|------|--------|
| 완제품 | 최종 제품 | 생산입고, 출고 |
| 반제품 | 중간 제품 | 입고, 생산입고, 차감 |
| 원재료 | 구매 자재 | 입고, 생산차감 |
| 코일 | 철강 코일 | 입고, 자동차감 |
| 고객재고 | 고객 보관 | 입고, 출고 |

---

## 입출고 유형 (transaction_type)

| 유형 | 설명 | 재고 영향 |
|-----|------|----------|
| receiving | 원자재/반제품 입고 | + |
| production | 생산 완료 (BOM 차감) | +/- |
| shipping | 완제품 출고 | - |
| adjustment | 재고 조정 | +/- |
| transfer | 창고 이전 | 0 |

---

## 비즈니스 규칙

1. 입고: 품목 존재, 수량 양수, LOT 필수
2. 출고: 재고 충분, 선입선출(FIFO)
3. 생산: BOM 존재, 하위 재고 충분
4. BOM: 순환참조 불가

## 성능 기준

| 작업 | 목표 |
|-----|------|
| BOM 전개 (3단계) | < 200ms |
| BOM 전개 (10단계) | < 500ms |
| 입출고 처리 | < 300ms |
| 재고 조회 | < 100ms |
