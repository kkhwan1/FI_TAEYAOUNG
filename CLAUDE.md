# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**태창 ERP 시스템** - Korean automotive parts manufacturing ERP

- **Tech Stack**: Next.js 14.2.16 + React 18.3.1 + TypeScript + Supabase PostgreSQL
- **Port**: 5000 (development)
- **Production**: <https://taechangmetal.vercel.app>
- **API Routes**: 152 endpoints in `src/app/api/`

## Quick Start

```bash
npm install                  # Install dependencies
npm run dev:safe             # Start dev server (Windows optimized, auto port handling)
# Visit http://localhost:5000
```

**Environment Setup** (`.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PROJECT_ID=your-project-id
```

## Essential Commands

### Development

```bash
npm run dev:safe             # Start with auto port handling (recommended)
npm run dev                  # Standard start (port 5000)
npm run restart              # Full restart (kill processes + clean cache)
npm run port:kill            # Kill processes on port 5000
npm run clean:cache          # Clear .next cache only
```

### Build & Quality

```bash
npm run build                # Production build
npm run lint                 # ESLint
npm run type-check           # TypeScript check (tsc --noEmit)
```

### Testing

```bash
npm run test                 # Run all Jest tests
npm run test:watch           # Watch mode
npm run test:api             # API tests only (src/__tests__/api)
npm run test:lib             # Library tests only (src/__tests__/lib)
npm run test:e2e             # Playwright E2E tests
npm run test:e2e:ui          # Playwright with UI
npm run test:e2e:debug       # Playwright debug mode
```

### Database

```bash
npm run db:types             # Generate TypeScript types → src/types/database.types.ts
npm run db:check-schema      # Verify schema
npm run migrate:up           # Apply migrations
npm run migrate:status       # Check migration status
```

### Excel Data Migration

```bash
npm run excel:all            # Run all Excel imports (sequential)
npm run excel:parallel       # Run all Excel imports (parallel)
npm run excel:dry-run        # Preview without changes
npm run excel:companies      # Import companies only
npm run excel:items          # Import items only
npm run excel:bom            # Import BOM only
npm run excel:inventory      # Import inventory transactions
```

## Critical Patterns

### 1. Korean Character Encoding (CRITICAL)

**Use `parseKoreanRequest()` instead of `request.json()` for APIs receiving Korean text:**

```typescript
import { parseKoreanRequest } from '@/lib/parse-korean-request';

export async function POST(request: NextRequest) {
  // ✅ Correct - Korean characters preserved
  const data = await parseKoreanRequest<CreateItemRequest>(request);

  // ❌ Wrong - Can corrupt Korean characters
  // const data = await request.json();
}
```

Alternative pattern (manual):

```typescript
const text = await request.text();
const body = JSON.parse(text) as YourType;
```

### 2. API Error Handling

**All API routes should use centralized error handling** from `@/lib/api-utils`:

```typescript
import { APIError, handleAPIError, validateRequiredFields } from '@/lib/api-utils';
import { parseKoreanRequest } from '@/lib/parse-korean-request';

export async function POST(request: NextRequest) {
  try {
    const data = await parseKoreanRequest<CreateItemRequest>(request);

    // Validate required fields
    const errors = validateRequiredFields(data, ['item_code', 'item_name']);
    if (errors.length > 0) {
      throw new APIError(errors.join(', '), 400, 'VALIDATION_ERROR');
    }

    // ... business logic
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleAPIError(error);  // Centralized error handling
  }
}
```

### 3. TypeScript Type Safety

**Always use proper type imports and runtime validation:**

```typescript
// Import types from database.types.ts
import type { Database } from '@/types/database.types';
type ItemRow = Database['public']['Tables']['items']['Row'];
type ItemInsert = Database['public']['Tables']['items']['Insert'];

// Use type guards for runtime validation
import { isValidProcessStatus, type ProcessStatus } from '@/types/coil';

if (!isValidProcessStatus(status)) {
  throw new APIError('Invalid status', 400);
}

// Safe type casting with validation
const validatedStatus = status as ProcessStatus;
```

**Type definition files** (`src/types/`):

| File | Purpose |
|------|---------|
| `database.types.ts` | Auto-generated Supabase types (run `npm run db:types`) |
| `coil.ts` | Coil process tracking types |
| `inventory.ts` | Inventory transaction types |
| `bom.ts` | BOM structure types |
| `api.ts` | API request/response types |
| `auth.ts` | Authentication types |

## Architecture

### Database Layer (`src/lib/db-unified.ts`)

```typescript
// Option 1: Domain Helpers (recommended for CRUD)
import { db } from '@/lib/db-unified';
const items = await db.items.getAll({ filters: { is_active: true } });
const newItem = await db.items.create({ item_name: '부품', item_code: 'P001' });

// Option 2: Query Builder (dynamic queries)
import { SupabaseQueryBuilder } from '@/lib/db-unified';
const qb = new SupabaseQueryBuilder();
const result = await qb.select('items', {
  filters: { is_active: true },
  search: { field: 'item_name', value: '부품' },
  pagination: { page: 1, limit: 20 }
});

// Option 3: Direct Supabase Client
import { getSupabaseClient } from '@/lib/db-unified';
const supabase = getSupabaseClient();
const { data } = await supabase.from('items').select('*').eq('is_active', true);
```

### Three Supabase Clients

| Client | Location | RLS | Use Case |
|--------|----------|-----|----------|
| `createSupabaseBrowserClient()` | Client components | Yes | Frontend data fetching |
| `supabase` | API routes | Yes | Standard server operations |
| `getSupabaseClient()` | API routes | No | Admin operations (bypasses RLS) |

## Key Directories

```text
src/
├── app/
│   ├── api/                    # API routes
│   │   ├── items/              # Master data: items
│   │   ├── companies/          # Master data: companies
│   │   ├── bom/                # BOM management
│   │   ├── inventory/          # Inventory transactions
│   │   ├── stock/              # Stock queries
│   │   ├── sales-transactions/ # Sales
│   │   ├── purchases/          # Purchases
│   │   ├── collections/        # Collections (receivables)
│   │   ├── payments/           # Payments (payables)
│   │   ├── coil/               # Coil process tracking (코일→판재 변환)
│   │   ├── admin/              # Admin operations (migrations, etc.)
│   │   └── export/             # Excel exports
│   ├── master/                 # Master data pages
│   ├── inventory/              # Inventory page
│   ├── stock/                  # Stock status page
│   └── dashboard/              # Dashboard
├── lib/
│   ├── db-unified.ts           # Database layer (clients, helpers, query builder)
│   ├── api-utils.ts            # APIError class, handleAPIError, validators
│   ├── parse-korean-request.ts # Korean UTF-8 encoding for API requests
│   ├── validation.ts           # Zod schemas
│   ├── validationMiddleware.ts # API validation wrapper
│   ├── filters.ts              # Company filter utilities
│   ├── bom-utils.ts            # BOM calculation utilities
│   └── errorHandler.ts         # Error handling
├── components/
│   ├── layout/                 # MainLayout, Sidebar, Header
│   ├── ui/                     # Reusable UI components
│   └── filters/                # Company filter components
└── contexts/
    ├── FontSizeContext.tsx     # Global font size control
    └── CompanyFilterContext.tsx # Company filter state
```

## Key Patterns

**Company Filter**: Use `extractCompanyId()` + `applyCompanyFilter()` from `@/lib/filters.ts`

**Excel Export**: 3-sheet workbooks (메타데이터, 통계, 데이터) - see `src/app/api/export/`

## Business Logic

### Payment Status (auto-calculated by DB triggers)

```typescript
// Sales: based on collected_amount
if (collected_amount === 0) status = 'PENDING';
else if (collected_amount < total_amount) status = 'PARTIAL';
else status = 'COMPLETED';

// Purchases: based on paid_amount (same logic)
```

### Company Code Generation

Auto-generated with type prefix: `CUS001` (고객사), `SUP001` (공급사), `PAR001` (협력사), `OTH001` (기타)

### Coil Process Tracking (코일 공정)

```typescript
// Process types: 블랭킹, 전단, 절곡, 용접
// Status flow: PENDING → IN_PROGRESS → COMPLETED (or CANCELLED)

// When status changes to COMPLETED, DB trigger automatically:
// 1. Creates 생산출고 for source_item (negative quantity)
// 2. Creates 생산입고 for target_item (positive quantity)
// 3. Updates current_stock on both items
```

Types defined in `src/types/coil.ts` with validation helpers:

- `isValidProcessStatus()`, `isValidProcessType()`
- `calculateYieldRate()`, `canCompleteProcess()`

## Common Issues

| Issue | Solution |
|-------|----------|
| Port 5000 in use | `npm run port:kill` or `npm run restart` |
| File watch error (-4094) | Use `npm run dev:safe` (enables polling) |
| TypeScript DB type errors | Run `npm run db:types` |
| API returns 500 error | Check Supabase connection, verify env vars |
| Build fails on Vercel | Ensure all env vars set in Vercel Dashboard |

## Deployment

```bash
vercel --prod --yes          # Deploy to Vercel
```

Environment variables must be set in Vercel Dashboard. Re-deploy after changing env vars.
