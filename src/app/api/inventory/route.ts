import { NextRequest, NextResponse } from 'next/server';
import { createValidatedRoute } from '@/lib/validationMiddleware';
import { parsePagination, buildPaginatedResponse, getPaginationFromSearchParams } from '@/lib/pagination';
import { calculateTax } from '@/lib/tax';
import { supabaseAdmin } from '@/lib/supabase';
import { mcp__supabase__execute_sql } from '@/lib/supabase-mcp';

export const dynamic = 'force-dynamic';

// SQL Injection prevention utilities
function sanitizeSqlString(input: string | null | undefined): string {
  if (input === null || input === undefined) return '';
  // Escape single quotes by doubling them (standard SQL escaping)
  // Also remove or escape potentially dangerous characters
  return String(input)
    .replace(/'/g, "''")           // Escape single quotes
    .replace(/\\/g, '\\\\')        // Escape backslashes
    .replace(/\x00/g, '')          // Remove null bytes
    .replace(/--/g, '')            // Remove SQL comment markers
    .replace(/;/g, '')             // Remove semicolons
    .substring(0, 1000);           // Limit length
}

function validateNumericId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = parseInt(String(value), 10);
  if (isNaN(num) || num <= 0 || num > 2147483647) return null;
  return num;
}

function validateDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  // Validate YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return dateStr;
}

function validateQuantity(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = parseFloat(String(value));
  if (isNaN(num) || !isFinite(num)) return null;
  // Allow reasonable quantity range
  if (Math.abs(num) > 999999999) return null;
  return num;
}


export const GET = createValidatedRoute(
  async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const itemId = searchParams.get('itemId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const companyId = searchParams.get('company_id');

    // Get pagination parameters
    const paginationInput = getPaginationFromSearchParams(searchParams);
    const paginationParams = parsePagination(paginationInput, {
      page: 1,
      limit: 50, // Inventory transactions typically need fewer per page
      maxLimit: 200
    });

    // Use Supabase Admin client to bypass RLS (uses SERVICE_ROLE_KEY)
    const supabase = supabaseAdmin;

    // Service role key verification (removed debug logs for production)

    // Optimized: Use single query with LEFT JOIN to fetch all data at once
    // This eliminates N+1 queries and reduces round trips from 3 to 1
    let query = supabase
      .from('inventory_transactions')
      .select(`
        *,
        items!inner(item_id, item_code, item_name, unit),
        companies(company_id, company_name)
      `);

    // Apply filters safely with validation
    if (type) {
      query = query.eq('transaction_type', type as '입고' | '출고' | '생산입고' | '생산출고' | '이동' | '조정' | '폐기' | '재고조정');
    }

    // Validate itemId to prevent NaN issues
    const validatedItemId = itemId ? validateNumericId(itemId) : null;
    if (itemId && validatedItemId === null) {
      return NextResponse.json(
        { success: false, error: 'Invalid itemId: must be a positive integer' },
        { status: 400 }
      );
    }
    if (validatedItemId) {
      query = query.eq('item_id', validatedItemId);
    }

    // Validate dates
    const validatedStartDate = validateDate(startDate);
    const validatedEndDate = validateDate(endDate);
    if (startDate && validatedStartDate === null) {
      return NextResponse.json(
        { success: false, error: 'Invalid startDate: must be YYYY-MM-DD format' },
        { status: 400 }
      );
    }
    if (endDate && validatedEndDate === null) {
      return NextResponse.json(
        { success: false, error: 'Invalid endDate: must be YYYY-MM-DD format' },
        { status: 400 }
      );
    }
    if (validatedStartDate) {
      query = query.gte('transaction_date', validatedStartDate);
    }
    if (validatedEndDate) {
      query = query.lte('transaction_date', validatedEndDate);
    }

    // Validate companyId
    const validatedCompanyId = companyId ? validateNumericId(companyId) : null;
    if (companyId && validatedCompanyId === null) {
      return NextResponse.json(
        { success: false, error: 'Invalid company_id: must be a positive integer' },
        { status: 400 }
      );
    }
    if (validatedCompanyId) {
      query = query.eq('company_id', validatedCompanyId);
    }

    // Apply ordering and pagination
    const offset = paginationParams.offset;

    query = query
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + paginationParams.limit - 1);

    const { data: transactions, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Get total count for pagination using safe query with inner join to match data query
    let countQuery = supabase
      .from('inventory_transactions')
      .select('*, items!inner(item_id)', { count: 'exact', head: true });

    if (type) {
      countQuery = countQuery.eq('transaction_type', type as '입고' | '출고' | '생산입고' | '생산출고' | '이동' | '조정' | '폐기' | '재고조정');
    }

    if (validatedItemId) {
      countQuery = countQuery.eq('item_id', validatedItemId);
    }

    if (validatedStartDate) {
      countQuery = countQuery.gte('transaction_date', validatedStartDate);
    }

    if (validatedEndDate) {
      countQuery = countQuery.lte('transaction_date', validatedEndDate);
    }

    if (validatedCompanyId) {
      countQuery = countQuery.eq('company_id', validatedCompanyId);
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      throw new Error(`Count query failed: ${countError.message}`);
    }

    // Optimized: Transform data with direct nested object access (no array.find loops)
    const formattedTransactions = transactions?.map((t: any) => {
      // Extract item data from nested join (items is an object, not array)
      const item = t.items || {};
      const company = t.companies || {};

      return {
        transaction_id: t.transaction_id,
        transaction_date: t.transaction_date,
        transaction_type: t.transaction_type,
        item_id: t.item_id,
        item_code: item.item_code ?? '',
        item_name: item.item_name ?? '',
        quantity: t.quantity ?? 0,
        unit: item.unit ?? '',
        unit_price: t.unit_price ?? 0,
        total_amount: t.total_amount ?? 0,
        tax_amount: t.tax_amount ?? 0,
        grand_total: t.grand_total ?? 0,
        document_number: t.document_number ?? '',
        reference_number: t.reference_number ?? '',
        warehouse_id: t.warehouse_id,
        location: t.location ?? '',
        lot_number: t.lot_number ?? '',
        expiry_date: t.expiry_date,
        status: t.status ?? '',
        notes: t.notes ?? '',
        created_at: t.created_at,
        updated_at: t.updated_at,
        created_by: t.created_by,
        updated_by: t.updated_by,
        description: t.description ?? '',
        company_name: company.company_name ?? ''
      };
    }) || [];

    // Build paginated response
    const response = buildPaginatedResponse(formattedTransactions, totalCount || 0, {
      page: paginationParams.page,
      limit: paginationParams.limit
    });

    return NextResponse.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error fetching inventory transactions:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch inventory transactions: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
  },
  { resource: 'inventory', action: 'read', requireAuth: false }
);

export const POST = createValidatedRoute(
  async (request: NextRequest) => {
  try {
    const text = await request.text();
    const body = JSON.parse(text);
    const {
      transaction_date,
      transaction_type,
      item_id,
      quantity,
      unit_price,
      company_id,
      reference_id,
      note,
      warehouse_id,
      location,
      lot_number,
      expiry_date
    } = body;

    // Validate required fields
    if (!transaction_type || !item_id || !quantity) {
      return NextResponse.json(
        { success: false, error: 'transaction_type, item_id, and quantity are required' },
        { status: 400 }
      );
    }

    // Validate transaction type (whitelist)
    const validTypes = ['입고', '출고', '생산입고', '생산출고', '이동', '조정', '폐기', '재고조정'];
    if (!validTypes.includes(transaction_type)) {
      return NextResponse.json(
        { success: false, error: `Invalid transaction_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate and sanitize all inputs to prevent SQL injection
    const validatedItemId = validateNumericId(item_id);
    if (validatedItemId === null) {
      return NextResponse.json(
        { success: false, error: 'Invalid item_id: must be a positive integer' },
        { status: 400 }
      );
    }

    const validatedQuantity = validateQuantity(quantity);
    if (validatedQuantity === null) {
      return NextResponse.json(
        { success: false, error: 'Invalid quantity: must be a valid number' },
        { status: 400 }
      );
    }

    const validatedCompanyId = company_id ? validateNumericId(company_id) : null;
    if (company_id && validatedCompanyId === null) {
      return NextResponse.json(
        { success: false, error: 'Invalid company_id: must be a positive integer' },
        { status: 400 }
      );
    }

    const validatedWarehouseId = warehouse_id ? validateNumericId(warehouse_id) : null;
    if (warehouse_id && validatedWarehouseId === null) {
      return NextResponse.json(
        { success: false, error: 'Invalid warehouse_id: must be a positive integer' },
        { status: 400 }
      );
    }

    const validatedUnitPrice = unit_price ? validateQuantity(unit_price) : 0;
    if (unit_price && validatedUnitPrice === null) {
      return NextResponse.json(
        { success: false, error: 'Invalid unit_price: must be a valid number' },
        { status: 400 }
      );
    }

    // Validate dates
    const validatedTransactionDate = validateDate(transaction_date) || new Date().toISOString().split('T')[0];
    const validatedExpiryDate = expiry_date ? validateDate(expiry_date) : null;

    // Sanitize string inputs
    const sanitizedReferenceId = sanitizeSqlString(reference_id);
    const sanitizedNote = sanitizeSqlString(note);
    const sanitizedLocation = sanitizeSqlString(location);
    const sanitizedLotNumber = sanitizeSqlString(lot_number);

    const projectId = process.env.SUPABASE_PROJECT_ID || '';

    // Check if item exists and get current stock - using validated numeric ID
    const itemResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: `SELECT item_id, item_code, item_name, current_stock FROM items WHERE item_id = ${validatedItemId}`
    });

    if (!itemResult.rows || itemResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `Item with ID ${item_id} not found` },
        { status: 404 }
      );
    }

    const currentItem = itemResult.rows[0];
    const currentStock = Number(currentItem.current_stock) || 0;

    // 출고 시 재고 부족 체크 - using validated quantity
    if (transaction_type === '출고' && currentStock < Math.abs(validatedQuantity)) {
      return NextResponse.json(
        {
          success: false,
          error: `재고 부족: ${currentItem.item_code} (필요: ${Math.abs(validatedQuantity)}, 현재: ${currentStock})`
        },
        { status: 400 }
      );
    }

    // 회사 ID가 제공된 경우 존재 여부 확인 - using validated numeric ID
    if (validatedCompanyId) {
      const companyResult = await mcp__supabase__execute_sql({
        project_id: projectId,
        query: `SELECT company_id FROM companies WHERE company_id = ${validatedCompanyId}`
      });

      if (!companyResult.rows || companyResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: `회사 ID ${validatedCompanyId}를 찾을 수 없습니다` },
          { status: 404 }
        );
      }
    }

    // Calculate amounts using validated values
    const taxResult = calculateTax({
      quantity: Math.abs(validatedQuantity),
      unitPrice: validatedUnitPrice || 0,
      taxRate: 0.1 // 10% tax rate
    });
    const totalAmount = taxResult.subtotalAmount;
    const taxAmount = taxResult.taxAmount;
    const grandTotal = taxResult.grandTotal;

    // Calculate new stock
    let newStock = currentStock;
    if (['입고', '생산입고'].includes(transaction_type)) {
      newStock += Math.abs(validatedQuantity);
    } else if (['출고', '생산출고', '폐기'].includes(transaction_type)) {
      newStock -= Math.abs(validatedQuantity);
    }

    // Create inventory transaction with validated/sanitized values to prevent SQL injection
    const transactionResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: `
        INSERT INTO inventory_transactions (
          transaction_date,
          transaction_type,
          item_id,
          company_id,
          quantity,
          unit_price,
          total_amount,
          tax_amount,
          grand_total,
          document_number,
          reference_number,
          warehouse_id,
          location,
          lot_number,
          expiry_date,
          status,
          notes,
          created_at
        ) VALUES (
          '${validatedTransactionDate}',
          '${transaction_type}',
          ${validatedItemId},
          ${validatedCompanyId !== null ? validatedCompanyId : 'NULL'},
          ${validatedQuantity},
          ${validatedUnitPrice || 0},
          ${totalAmount},
          ${taxAmount},
          ${grandTotal},
          '${sanitizedReferenceId}',
          '${sanitizedReferenceId}',
          ${validatedWarehouseId !== null ? validatedWarehouseId : 'NULL'},
          '${sanitizedLocation}',
          '${sanitizedLotNumber}',
          ${validatedExpiryDate ? `'${validatedExpiryDate}'` : 'NULL'},
          '완료',
          '${sanitizedNote}',
          NOW()
        )
        RETURNING transaction_id
      `
    });

    if (!transactionResult.rows || transactionResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to create inventory transaction' },
        { status: 500 }
      );
    }

    const transactionId = transactionResult.rows[0].transaction_id;

    // Update item stock - using validated values to prevent SQL injection
    await mcp__supabase__execute_sql({
      project_id: projectId,
      query: `
        UPDATE items
        SET current_stock = ${newStock},
            updated_at = NOW()
        WHERE item_id = ${validatedItemId}
      `
    });

    return NextResponse.json({
      success: true,
      message: `재고 트랜잭션이 성공적으로 생성되었습니다 (새 재고: ${newStock})`,
      data: {
        transaction_id: transactionId,
        newStock
      }
    });

  } catch (error) {
    console.error('Error creating inventory transaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to create inventory transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
  },
  { resource: 'inventory', action: 'create', requireAuth: false }
);