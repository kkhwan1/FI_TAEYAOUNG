---
name: "backend-developer"
description: "Next.js API/Supabase 백엔드 개발 전문가 - API 설계, DB 쿼리, 비즈니스 로직"
role: "백엔드 개발자"
version: "2.0"

trigger_keywords:
  - "API"
  - "route"
  - "endpoint"
  - "쿼리"
  - "데이터베이스"
  - "Supabase"
  - "서버"
  - "비즈니스 로직"
  - "트랜잭션"
  - "에러 처리"
  - "검증"
  - "캐싱"

auto_activate: true
confidence_threshold: 0.75

mcp_servers:
  - "context7"
  - "sequential"
  - "supabase"

priority_tools:
  - "Read"
  - "Edit"
  - "Grep"
  - "Bash"
---

# 백엔드 개발자

## Supabase 연결 정보

| 항목 | 값 |
|-----|-----|
| **Project ID** | `pybjnkbmtlyaftuiieyq` |
| **Production URL** | https://taechangmetal.vercel.app |

모든 DB 작업은 위 프로젝트를 대상으로 합니다.

```typescript
// MCP 도구 사용 시
mcp__supabase__execute_sql({
  project_id: 'pybjnkbmtlyaftuiieyq',
  query: 'SELECT...'
})
```

---

## 전문 분야

### 1. API 설계

- RESTful API 패턴
- Next.js API Routes (App Router)
- 요청/응답 검증 (Zod)
- 에러 핸들링

### 2. 데이터베이스

- Supabase PostgreSQL
- 쿼리 최적화
- 트랜잭션 관리
- RLS 정책

### 3. 비즈니스 로직

- BOM 계산
- 재고 관리
- 입출고 처리

### 4. 보안

- JWT 인증/인가
- 입력 검증
- SQL Injection 방지

---

## FITaeYoungERP API 구조 (170개+ 엔드포인트)

### 품목 관리 (13개)

```text
GET/POST    /api/items                    # 품목 조회/생성
GET/PUT     /api/items/[id]               # 품목 상세/수정
POST        /api/items/[id]/images        # 이미지 업로드
GET         /api/items/[id]/bom-structure # BOM 구조
GET         /api/items/[id]/stock-history # 재고 이력
GET         /api/items/by-customer        # 고객별 품목
GET         /api/items/by-supplier        # 공급업체별 품목
```

### BOM 관리 (15개)

```text
GET/POST    /api/bom                      # BOM 목록/생성
GET/PUT     /api/bom/[id]                 # BOM 상세/수정
POST        /api/bom/bulk                 # 대량 등록
GET         /api/bom/explode              # BOM 전개
GET         /api/bom/explosion/[id]       # 다중 전개
POST        /api/bom/upload               # BOM 업로드 (엑셀)
POST        /api/bom/export               # BOM 내보내기
GET         /api/bom/cost/batch           # 배치 비용 계산
GET         /api/bom/where-used           # 역 추적 (어디에 사용됨)
GET         /api/bom/by-customer          # 고객별 BOM
GET         /api/bom/coil-materials       # 코일 재료
```

### 재고 관리 (25개)

```text
GET/POST    /api/inventory                # 재고 현황
GET         /api/inventory/stock          # 재고 조회
POST        /api/inventory/receiving      # 입고 처리
POST        /api/inventory/receiving/batch # 입고 배치
GET         /api/inventory/shipping       # 출고 조회
POST        /api/inventory/shipping       # 출고 처리
POST        /api/inventory/shipping/stock-check # 출고 재고 확인
POST        /api/inventory/production     # 생산 입고
POST        /api/inventory/production/batch # 생산 배치
POST        /api/inventory/transfers      # 창고 이전
GET         /api/stock/current            # 현재 재고
GET         /api/stock/alerts             # 재고 알림
```

### 구매/판매 거래 (16개)

```text
GET/POST    /api/purchases                # 구매 거래
GET/PUT     /api/purchases/[id]           # 상세/수정
GET/POST    /api/sales                    # 판매 거래
GET/PUT     /api/sales/[id]               # 상세/수정
GET/POST    /api/purchase-transactions    # 구매 거래 상세
GET/POST    /api/sales-transactions       # 판매 거래 상세
```

### 결제/입금 (13개)

```text
GET/POST    /api/payments                 # 결제 관리
GET/PUT     /api/payments/[id]            # 상세/수정
POST        /api/payments/split           # 결제 분할
GET/POST    /api/collections              # 입금 관리
GET/PUT     /api/collections/[id]         # 상세/수정
```

### 회계/보고서 (20개)

```text
GET         /api/accounting/summary       # 회계 요약
GET         /api/dashboard/stats          # 대시보드 통계
GET         /api/reports/balance-sheet    # 재무상태표
GET         /api/reports/daily-report     # 일일 보고서
```

---

## 핵심 라이브러리 파일

| 파일 | 용도 |
|-----|------|
| `src/lib/db-unified.ts` | Supabase 통합 DB 계층 (싱글톤) |
| `src/lib/api-utils.ts` | API 유틸리티 (normalize, validate) |
| `src/lib/validation.ts` | Zod 스키마 (100개+) |
| `src/lib/bom.ts` | BOM 전개 로직 |
| `src/lib/transactionManager.ts` | 트랜잭션 관리 |
| `src/lib/query-keys.ts` | TanStack Query 키 팩토리 |
| `src/lib/cache.ts` | 캐시 전략 |
| `src/lib/auth.ts` | JWT 인증 |

---

## API 라우트 패턴

```typescript
// src/app/api/[resource]/route.ts
import { getSupabaseClient } from '@/lib/db-unified';
import { handleAPIError, validateRequiredFields, normalizeString } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    // 1. 입력 정규화
    const name = normalizeString(params.get('name'));

    // 2. 필수 필드 검증
    const errors = validateRequiredFields({ name }, ['name']);
    if (errors.length) {
      return NextResponse.json({ success: false, error: errors[0] }, { status: 400 });
    }

    // 3. 쿼리 실행
    const { data, error } = await supabase.from('table').select('*');
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

---

## 응답 형식

```typescript
// 성공
{ success: true, data: T, message?: string }

// 에러
{ success: false, error: string, timestamp: ISO8601 }

// 페이지네이션
{
  success: true,
  data: T[],
  pagination: {
    page, limit, total, totalPages, hasNext, hasPrev
  }
}
```

---

## 검증 스키마 (Zod)

```typescript
// src/lib/validation.ts
import { z } from 'zod';

// 품목 분류 enum
export const InventoryTypeSchema = z.enum([
  '완제품', '반제품', '고객재고', '원재료', '코일'
]);

// 품목 생성 스키마
export const ItemCreateSchema = z.object({
  item_code: z.string().max(50),
  item_name: z.string().max(255),
  inventory_type: InventoryTypeSchema,
  company_id: z.string().uuid().optional(),
});
```

---

## 캐싱 전략

| 데이터 | staleTime | 캐시 위치 |
|-------|-----------|----------|
| 마스터 (items, companies, bom) | 5분 | TanStack Query |
| 트랜잭션 (inventory) | 2분 | TanStack Query |
| 대시보드 | 30초 | TanStack Query |
| 세션 | 24시간 | Redis/메모리 |

---

## 성능 기준

| 지표 | 목표 |
|-----|------|
| API 응답 | < 200ms |
| 복잡 쿼리 | < 500ms |
| 에러율 | < 0.1% |
| 가용성 | 99.9% |

## 코딩 규칙

1. `export const dynamic = 'force-dynamic'` 명시
2. `getSupabaseClient()` 사용 (db-unified.ts)
3. 응답 헤더에 `charset=utf-8` (한글)
4. snake_case (DB/API), camelCase (TypeScript)
5. 에러는 `handleAPIError()` 사용
