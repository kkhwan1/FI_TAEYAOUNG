/**
 * Supabase MCP Integration Library
 *
 * This module provides a wrapper around the Supabase MCP server's execute_sql function.
 * It's used to execute raw SQL queries against the Supabase PostgreSQL database.
 *
 * Usage:
 * ```typescript
 * import { mcp__supabase__execute_sql } from '@/lib/supabase-mcp';
 *
 * const result = await mcp__supabase__execute_sql({
 *   project_id: process.env.SUPABASE_PROJECT_ID!,
 *   query: 'SELECT * FROM items WHERE is_active = true'
 * });
 *
 * const rows = result?.rows || [];
 * ```
 *
 * Migration from MySQL to PostgreSQL:
 * - `= 1` → `= true`, `= 0` → `= false`
 * - `?` parameters → string interpolation (MCP doesn't support parameterized queries yet)
 * - `NOW()` → `CURRENT_TIMESTAMP`
 * - `IFNULL()` → `COALESCE()`
 *
 * Important Notes:
 * - This is a temporary wrapper during Phase 5-2 migration
 * - SQL injection prevention: Sanitize inputs before string interpolation
 * - Error handling: Always wrap in try-catch blocks
 * - Environment variable SUPABASE_PROJECT_ID must be configured
 */

import { getSupabaseClient } from './db-unified';

interface ExecuteSqlParams {
  project_id: string;
  query: string;
}

interface ExecuteSqlResult {
  rows?: Record<string, unknown>[];
  error?: string;
}

/**
 * Execute SQL query using Supabase MCP server
 *
 * @param params - Object containing project_id and SQL query
 * @returns Promise resolving to query results or error
 * @throws Error if SUPABASE_PROJECT_ID is not configured or query execution fails
 */
export async function mcp__supabase__execute_sql(
  params: ExecuteSqlParams
): Promise<ExecuteSqlResult> {
  try {
    const { project_id, query } = params;

    if (!project_id) {
      throw new Error('SUPABASE_PROJECT_ID is required');
    }

    if (!query) {
      throw new Error('SQL query is required');
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc('execute_sql', {
      query_text: query,
      params: null
    });

    console.log('[Supabase MCP] supabase.rpc execute_sql raw response:', {
      hasData: !!data,
      dataType: typeof data,
      isArray: Array.isArray(data),
      dataValue: data ? JSON.stringify(data).substring(0, 500) : null,
      error: error ? error.message : null
    });

    if (error) {
      console.error('[Supabase MCP] execute_sql error:', error);
      return {
        rows: undefined,
        error: error.message || 'Supabase execute_sql failed'
      };
    }

    // data가 { rows: [], rowCount: 0 } 형태인 경우 처리
    let rows: Record<string, unknown>[] = [];
    if (data) {
      console.log('[Supabase MCP] Processing data:', {
        isArray: Array.isArray(data),
        hasRows: typeof data === 'object' && 'rows' in data,
        firstElement: Array.isArray(data) && data.length > 0 ? data[0] : null,
        dataKeys: typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : null
      });

      if (Array.isArray(data)) {
        // 배열인 경우
        if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null && 'rows' in data[0]) {
          // 중첩된 구조: [{ rows: [], rowCount: 0 }]
          rows = (data[0] as any).rows || [];
          console.log('[Supabase MCP] Extracted rows from nested array structure:', rows.length);
        } else {
          // 일반 배열: [{ item_id: 1, ... }]
          rows = data as Record<string, unknown>[];
          console.log('[Supabase MCP] Using array as rows directly:', rows.length);
        }
      } else if (typeof data === 'object' && 'rows' in data) {
        // 객체이고 rows 속성이 있는 경우: { rows: [], rowCount: 0 }
        rows = (data as any).rows || [];
        console.log('[Supabase MCP] Extracted rows from object.rows:', rows.length);
      } else {
        // 단일 객체인 경우
        rows = [data as Record<string, unknown>];
        console.log('[Supabase MCP] Wrapped single object as array:', rows.length);
      }
    } else {
      console.warn('[Supabase MCP] data is null or undefined');
    }

    console.log('[Supabase MCP] Final rows count:', rows.length);

    return {
      rows,
      error: undefined
    };
  } catch (error) {
    console.error('[Supabase MCP] Query execution error:', error);
    return {
      rows: undefined,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Helper function to sanitize string values for SQL interpolation
 * Prevents SQL injection by escaping single quotes
 *
 * @param value - String value to sanitize
 * @returns Sanitized string safe for SQL interpolation
 */
export function sanitizeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Helper function to build WHERE clause from filters
 *
 * @param filters - Object containing filter key-value pairs
 * @returns SQL WHERE clause string
 */
export function buildWhereClause(filters: Record<string, unknown>): string {
  const conditions: string[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'string') {
      conditions.push(`${key} = '${sanitizeSqlString(value)}'`);
    } else if (typeof value === 'boolean') {
      conditions.push(`${key} = ${value}`);
    } else if (typeof value === 'number') {
      conditions.push(`${key} = ${value}`);
    } else if (Array.isArray(value)) {
      const values = value
        .map(v => (typeof v === 'string' ? `'${sanitizeSqlString(v)}'` : `${v}`))
        .join(', ');
      conditions.push(`${key} IN (${values})`);
    }
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

/**
 * Helper function to convert MySQL syntax to PostgreSQL
 *
 * @param mysqlQuery - SQL query in MySQL syntax
 * @returns SQL query converted to PostgreSQL syntax
 */
export function convertMySqlToPostgreSql(mysqlQuery: string): string {
  let pgQuery = mysqlQuery;

  // Replace backticks with double quotes (for identifiers)
  pgQuery = pgQuery.replace(/`([^`]+)`/g, '"$1"');

  // Replace MySQL boolean values
  pgQuery = pgQuery.replace(/\s*=\s*1\s/g, ' = true ');
  pgQuery = pgQuery.replace(/\s*=\s*0\s/g, ' = false ');

  // Replace MySQL functions
  pgQuery = pgQuery.replace(/NOW\(\)/g, 'CURRENT_TIMESTAMP');
  pgQuery = pgQuery.replace(/IFNULL\(/g, 'COALESCE(');

  // Replace LIMIT syntax (MySQL allows LIMIT offset, count)
  pgQuery = pgQuery.replace(/LIMIT\s+(\d+)\s*,\s*(\d+)/gi, 'LIMIT $2 OFFSET $1');

  return pgQuery;
}

/**
 * Helper to create database views for financial statements
 */
export async function createFinancialViews(): Promise<ExecuteSqlResult> {
  const balanceSheetView = `
    CREATE OR REPLACE VIEW v_balance_sheet AS
    WITH asset_items AS (
      -- 유동자산: 재고자산
      SELECT
        '자산' AS main_category,
        '유동자산' AS category,
        '재고자산' AS account_name,
        COALESCE(SUM(i.current_stock * i.unit_price), 0) AS current_period,
        0 AS prior_period -- Will be calculated based on historical data
      FROM items i
      WHERE i.is_active = true

      UNION ALL

      -- 유동자산: 매출채권
      SELECT
        '자산' AS main_category,
        '유동자산' AS category,
        '매출채권' AS account_name,
        COALESCE(SUM(s.total_amount - s.collected_amount), 0) AS current_period,
        0 AS prior_period
      FROM sales_transactions s
      WHERE s.payment_status IN ('PENDING', 'PARTIAL')
        AND s.is_active = true
    ),
    liability_items AS (
      -- 유동부채: 매입채무
      SELECT
        '부채' AS main_category,
        '유동부채' AS category,
        '매입채무' AS account_name,
        COALESCE(SUM(p.total_amount - p.paid_amount), 0) AS current_period,
        0 AS prior_period
      FROM purchases p
      WHERE p.payment_status IN ('PENDING', 'PARTIAL')
        AND p.is_active = true
    ),
    equity_items AS (
      -- 자본: 당기순이익
      SELECT
        '자본' AS main_category,
        '자본' AS category,
        '당기순이익' AS account_name,
        (
          SELECT COALESCE(SUM(s.total_amount), 0)
          FROM sales_transactions s
          WHERE s.transaction_date >= DATE_TRUNC('year', CURRENT_DATE)
            AND s.is_active = true
        ) - (
          SELECT COALESCE(SUM(p.total_amount), 0)
          FROM purchases p
          WHERE p.transaction_date >= DATE_TRUNC('year', CURRENT_DATE)
            AND p.is_active = true
        ) AS current_period,
        0 AS prior_period
    )
    SELECT
      main_category,
      category,
      account_name,
      current_period,
      prior_period,
      current_period - prior_period AS change_amount,
      CASE
        WHEN prior_period = 0 THEN 0
        ELSE ROUND(((current_period - prior_period) / prior_period * 100)::numeric, 2)
      END AS change_rate
    FROM (
      SELECT * FROM asset_items
      UNION ALL
      SELECT * FROM liability_items
      UNION ALL
      SELECT * FROM equity_items
    ) combined
    ORDER BY
      CASE main_category
        WHEN '자산' THEN 1
        WHEN '부채' THEN 2
        WHEN '자본' THEN 3
      END,
      category,
      account_name;
  `;

  const cashFlowView = `
    CREATE OR REPLACE VIEW v_cash_flow AS
    WITH operating_activities AS (
      -- 영업활동: 매출로 인한 현금유입
      SELECT
        '영업활동' AS category,
        '매출로 인한 현금유입' AS activity_name,
        COALESCE(SUM(c.collected_amount), 0) AS amount,
        1 AS display_order
      FROM collections c
      WHERE c.collected_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND c.collected_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        AND c.is_active = true

      UNION ALL

      -- 영업활동: 매입으로 인한 현금유출
      SELECT
        '영업활동' AS category,
        '매입으로 인한 현금유출' AS activity_name,
        -COALESCE(SUM(p.paid_amount), 0) AS amount,
        2 AS display_order
      FROM payments p
      WHERE p.payment_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND p.payment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        AND p.is_active = true
    ),
    investing_activities AS (
      -- 투자활동: 고정자산 취득
      SELECT
        '투자활동' AS category,
        '고정자산 취득' AS activity_name,
        0 AS amount, -- Placeholder for future implementation
        3 AS display_order
    ),
    financing_activities AS (
      -- 재무활동: 차입금 증가
      SELECT
        '재무활동' AS category,
        '차입금 변동' AS activity_name,
        0 AS amount, -- Placeholder for future implementation
        4 AS display_order
    ),
    summary AS (
      SELECT * FROM operating_activities
      UNION ALL
      SELECT * FROM investing_activities
      UNION ALL
      SELECT * FROM financing_activities
    )
    SELECT
      category,
      activity_name,
      amount,
      SUM(amount) OVER (PARTITION BY category) AS category_total,
      SUM(amount) OVER () AS net_cash_flow
    FROM summary
    ORDER BY display_order;
  `;

  // Execute both view creation queries
  const balanceSheetResult = await mcp__supabase__execute_sql({
    project_id: process.env.SUPABASE_PROJECT_ID!,
    query: balanceSheetView
  });

  if (balanceSheetResult.error) {
    return balanceSheetResult;
  }

  const cashFlowResult = await mcp__supabase__execute_sql({
    project_id: process.env.SUPABASE_PROJECT_ID!,
    query: cashFlowView
  });

  return cashFlowResult;
}
