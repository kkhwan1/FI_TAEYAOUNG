/**
 * Centralized Company Filter Utilities
 *
 * Provides consistent company filtering logic across frontend and backend.
 * Addresses Codex feedback:
 * - Schema-aware FK column mapping
 * - NULL/empty value handling
 * - Type-safe parameter extraction
 * - Reusable query builder
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PostgrestQuery = any;

/**
 * Table-specific FK column mapping
 *
 * Maps table names to their company-related FK columns.
 * Ensures correct column names are used for filtering.
 *
 * Based on actual database schema (2025-02-02):
 * - items: supplier_id
 * - sales_transactions, collections, collection_transactions: customer_id
 * - purchase_transactions, payments, payment_transactions: supplier_id
 * - inventory_transactions, stock_history: company_id
 * - contracts, portal_users: company_id
 * - customer_bom_templates: customer_id
 */
export const COMPANY_FK_COLUMNS: Record<string, {
  customer?: string;
  supplier?: string;
  company?: string;
}> = {
  // Master data
  items: { supplier: 'supplier_id' },
  customer_bom_templates: { customer: 'customer_id' },
  bom: { customer: 'customer_id' },  // BOM 관계 (프로젝트별 분리)

  // Sales & Collections
  sales_transactions: { customer: 'customer_id' },
  collections: { customer: 'customer_id' },
  collection_transactions: { customer: 'customer_id' },

  // Purchases & Payments
  purchase_transactions: { supplier: 'supplier_id' },
  payments: { supplier: 'supplier_id' },
  payment_transactions: { supplier: 'supplier_id' },

  // Inventory & Stock
  inventory_transactions: { company: 'company_id' },
  stock_history: { company: 'company_id' },

  // Contracts & Users
  contracts: { company: 'company_id' },
  portal_users: { company: 'company_id' },
};

/**
 * Safely extract and validate company_id from URL search params
 *
 * Handles:
 * - NULL/empty strings
 * - Invalid values ('null', 'undefined', '0')
 * - Non-numeric values
 *
 * @param searchParams - URL search params
 * @param paramName - Parameter name (default: 'company_id')
 * @returns Validated company_id or null
 */
export function extractCompanyId(
  searchParams: URLSearchParams,
  paramName: string = 'company_id'
): number | null {
  const value = searchParams.get(paramName);

  // Handle NULL, empty, or invalid strings
  if (!value || value === 'null' || value === 'undefined' || value === '0') {
    return null;
  }

  // Parse and validate numeric value
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

/**
 * Apply company filter to Supabase query
 *
 * Centralized filtering logic that:
 * - Uses correct FK column based on table and filter type
 * - Handles NULL company_id (returns all records)
 * - Type-safe query building
 *
 * @param query - Supabase query builder
 * @param tableName - Table name for FK column lookup
 * @param companyId - Company ID to filter by (null = show all)
 * @param filterType - Type of company filter ('customer' | 'supplier' | 'company')
 * @returns Modified query with filter applied
 *
 * @example
 * ```typescript
 * let query = supabase.from('sales_transactions').select('*');
 * query = applyCompanyFilter(query, 'sales_transactions', companyId, 'customer');
 * ```
 */
export function applyCompanyFilter(
  query: PostgrestQuery,
  tableName: string,
  companyId: number | null,
  filterType: 'customer' | 'supplier' | 'company' = 'company'
): PostgrestQuery {
  // If no company filter, return all records
  if (!companyId) {
    return query;
  }

  // Get FK column name for this table
  const columnMapping = COMPANY_FK_COLUMNS[tableName];
  if (!columnMapping) {
    console.warn(`No company FK mapping found for table: ${tableName}`);
    return query;
  }

  // Get specific column based on filter type
  const columnName = columnMapping[filterType];
  if (!columnName) {
    console.warn(`No ${filterType} column found for table: ${tableName}`);
    return query;
  }

  // Apply filter
  return query.eq(columnName, companyId);
}

/**
 * Frontend: Build API URL with company filter
 *
 * Ensures consistent URL construction with proper parameter encoding.
 *
 * @param baseUrl - Base API endpoint URL
 * @param companyId - Company ID to filter by
 * @param additionalParams - Additional query parameters
 * @returns Complete URL with query parameters
 *
 * @example
 * ```typescript
 * const url = buildFilteredApiUrl('/api/items', selectedCompany);
 * const response = await fetch(url);
 * ```
 */
export function buildFilteredApiUrl(
  baseUrl: string,
  companyId: string | number | null,
  additionalParams?: Record<string, string>
): string {
  const url = new URL(baseUrl, window.location.origin);

  // Add company_id if valid
  if (companyId && companyId !== '' && companyId !== '0') {
    url.searchParams.set('company_id', companyId.toString());
  }

  // Add additional parameters
  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
  }

  return url.toString();
}

/**
 * Validate company filter authorization
 *
 * Placeholder for future auth integration.
 * Should check if user has access to the requested company.
 *
 * @param userId - Current user ID
 * @param companyId - Company ID to access
 * @returns True if authorized
 *
 * @todo Implement actual authorization logic when auth system is ready
 */
export async function validateCompanyAccess(
  userId: string | null,
  companyId: number | null
): Promise<boolean> {
  // TODO: Implement when authentication is added
  // For now, allow all access (Phase 1/2/3 have requireAuth: false)
  return true;
}
