# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Korean automotive parts manufacturing ERP system (태창 ERP). Production-ready cloud-native application for managing master data, inventory, accounting, and contracts.

**Tech Stack**: Next.js 14.2.16 + React 18.3.1 + TypeScript + Supabase PostgreSQL + Zustand + TanStack Query

**Production**: https://taechangmetal.vercel.app

## Commands

```bash
# Development (Windows - handles port conflicts)
npm run dev:safe          # Start dev server on port 5000
npm run dev:status        # Check server status
npm run dev:stop          # Stop server
npm run dev:restart       # Restart server
npm run clean:all         # Clear cache + restart

# Build & Quality
npm run build             # Production build
npm run type-check        # TypeScript checking
npm run lint              # ESLint

# Testing
npm run test              # Jest unit tests
npm run test:watch        # Watch mode
npm run test:api          # API tests only
npm run test:lib          # Library tests only
npm run test:e2e          # Playwright E2E
npm run test:e2e:ui       # Playwright with UI

# Database
npm run db:types          # Generate TypeScript types from Supabase
npm run migrate:up        # Run migrations
npm run migrate:status    # Check migration status

# Excel Migration
npm run excel:all         # Run all Excel imports
npm run excel:dry-run     # Dry run import
```

## Architecture

### Core Layers

| Layer | Location | Purpose |
|-------|----------|---------|
| Pages/API | `src/app/` | Next.js App Router, API routes |
| Components | `src/components/` | React components (feature-based) |
| Business Logic | `src/lib/` | Database, validation, utilities |
| Data Fetching | `src/hooks/` | TanStack Query hooks |
| Client State | `src/stores/` | Zustand stores |
| Types | `src/types/` | TypeScript definitions |

### Database Pattern

Use the unified database layer from `src/lib/db-unified.ts`:

```typescript
import { getSupabaseClient } from '@/lib/db-unified';
import { handleSupabaseError, createSuccessResponse } from '@/lib/db-unified';

const supabase = getSupabaseClient();
const { data, error } = await supabase.from('items').select('*');
if (error) return handleSupabaseError('fetch', 'items', error);
return createSuccessResponse(data);
```

**Two clients available:**
- `supabase` (browser) - Uses anon key with RLS
- `supabaseAdmin` (server) - Bypasses RLS for admin operations

### API Route Pattern

All API routes follow this structure:

```typescript
// src/app/api/[resource]/route.ts
import { getSupabaseClient } from '@/lib/db-unified';
import { handleAPIError, validateRequiredFields, normalizeString, normalizeNumber } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    // 1. Normalize inputs
    const name = normalizeString(params.get('name'));
    const quantity = normalizeNumber(params.get('quantity'));

    // 2. Validate required fields
    const errors = validateRequiredFields({ name }, ['name']);
    if (errors.length) return NextResponse.json({ success: false, error: errors[0] }, { status: 400 });

    // 3. Execute query
    const { data, error } = await supabase.from('table').select('*');
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

**Response format:**

```typescript
// Success
{ success: true, data: T, message?: string }

// Error
{ success: false, error: string, timestamp: ISO8601 }

// Paginated
{ success: true, data: T[], pagination: { page, limit, total, totalPages, hasNext, hasPrev } }
```

### Query Key Pattern

Hooks use hierarchical query keys from `src/lib/query-keys.ts`:

```typescript
// Query key factory
const itemKeys = {
  all: ['items'] as const,
  lists: () => [...itemKeys.all, 'list'] as const,
  list: (filters) => [...itemKeys.lists(), filters] as const,
  detail: (id) => [...itemKeys.all, 'detail', id] as const,
};
```

**Stale times by domain:**
- Master data (items, companies, bom): 5 minutes
- Transactional data (inventory, transactions): 2 minutes
- Dashboard stats: 30 seconds with 1 min auto-refresh

### State Management

Zustand stores in `src/stores/` with persistence:
- `useAppStore` - Locale, theme, sidebar
- `useFilterStore` - Global filters
- `useUserStore` - Authentication
- `useModalStore` - Modal visibility

## Key Business Logic

### BOM System (`src/lib/bom.ts`)

- Multi-level bill of materials with recursive traversal
- `explodeBom()` - Builds full BOM tree
- `flattenBOMTree()` - Converts to flat structure for calculations

### Inventory Transactions (`src/lib/transactionManager.ts`)

- Receiving, production, shipping with LOT tracking
- Double validation: API-level + Database triggers
- Automatic BOM material deduction on production

### Validation (`src/lib/validation.ts`)

- Zod schemas for all domain entities
- Korean ERP enums: `'완제품', '반제품', '고객재고', '원재료', '코일'`
- Business rule validation via `.refine()`

## Conventions

### Naming

- Database/API fields: `snake_case` (item_code, company_id)
- TypeScript: `camelCase` (itemCode, companyId)
- Types: `PascalCase` (ItemSchema, CompanyInsert)

### Patterns

- **Soft deletes**: Use `is_active: false` instead of hard deletes
- **Korean responses**: Always set `charset=utf-8` in response headers
- **Path alias**: Use `@/` for all imports (`@/lib/db-unified`)
- **Types**: Run `npm run db:types` after schema changes

### Design System

- Black and white theme (no colors)
- Simple icons from lucide-react
- Card-based headers, fixed table layouts
- UI/comments in Korean, code in English
