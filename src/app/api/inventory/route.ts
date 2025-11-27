import { NextRequest, NextResponse } from 'next/server';
import { createValidatedRoute } from '@/lib/validationMiddleware';
import { parsePagination, buildPaginatedResponse, getPaginationFromSearchParams } from '@/lib/pagination';
import { calculateTax } from '@/lib/tax';
import { supabaseAdmin } from '@/lib/supabase';
import { mcp__supabase__execute_sql } from '@/lib/supabase-mcp';

export const dynamic = 'force-dynamic';


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

    // Debug: Check if SERVICE_ROLE_KEY is loaded and client configuration
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log('DEBUG - SERVICE_ROLE_KEY loaded:', serviceRoleKey ? `YES (${serviceRoleKey.substring(0, 20)}...)` : 'NO');
    console.log('DEBUG - supabaseAdmin client auth header:', (supabase as any).auth?.mfaApi?.headers);
    console.log('DEBUG - Request type parameter:', type);
    console.log('DEBUG - URL-decoded type:', type ? decodeURIComponent(type) : 'null');

    // Fetch transactions without JOIN to avoid RLS issues
    let query = supabase
      .from('inventory_transactions')
      .select('*');

    // Apply filters safely
    if (type) {
      query = query.eq('transaction_type', type as '입고' | '출고' | '생산입고' | '생산출고' | '이동' | '조정' | '폐기' | '재고조정');
      console.log('DEBUG - Applied type filter:', type);
    }

    if (itemId) {
      query = query.eq('item_id', parseInt(itemId));
    }

    if (startDate) {
      query = query.gte('transaction_date', startDate);
    }

    if (endDate) {
      query = query.lte('transaction_date', endDate);
    }

    if (companyId) {
      query = query.eq('company_id', parseInt(companyId));
    }

    // Apply ordering and pagination
    const offset = paginationParams.offset;
    console.log('DEBUG - Pagination:', { page: paginationParams.page, limit: paginationParams.limit, offset, range: [offset, offset + paginationParams.limit - 1] });

    query = query
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + paginationParams.limit - 1);

    const { data: transactions, error } = await query;

    console.log('DEBUG - transactions query result:', { transactions, error, count: transactions?.length });

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Get related data separately to avoid RLS issues
    const itemIds = [...new Set(transactions?.map(t => t.item_id).filter((id): id is number => id !== null && id !== undefined) || [])];
    const companyIds = [...new Set(transactions?.map(t => t.company_id).filter((id): id is number => id !== null && id !== undefined) || [])];

    type ItemLookup = { item_id: number; item_code: string; item_name: string; unit: string };
    type CompanyLookup = { company_id: number; company_name: string };

    const { data: items } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, unit')
      .in('item_id', itemIds) as { data: ItemLookup[] | null };

    const { data: companies } = await supabase
      .from('companies')
      .select('company_id, company_name')
      .in('company_id', companyIds) as { data: CompanyLookup[] | null };

    // Get total count for pagination using safe query
    let countQuery = supabase
      .from('inventory_transactions')
      .select('*', { count: 'exact', head: true });

    if (type) {
      countQuery = countQuery.eq('transaction_type', type as '입고' | '출고' | '생산입고' | '생산출고' | '이동' | '조정' | '폐기' | '재고조정');
    }

    if (itemId) {
      countQuery = countQuery.eq('item_id', parseInt(itemId));
    }

    if (startDate) {
      countQuery = countQuery.gte('transaction_date', startDate);
    }

    if (endDate) {
      countQuery = countQuery.lte('transaction_date', endDate);
    }

    if (companyId) {
      countQuery = countQuery.eq('company_id', parseInt(companyId));
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      throw new Error(`Count query failed: ${countError.message}`);
    }

    // Transform data to match expected format - join with separately fetched data
    const formattedTransactions = transactions?.map((t: any) => {
      const item = items?.find((i: any) => i.item_id === t.item_id);
      const company = companies?.find((c: any) => c.company_id === t.company_id);

      return {
        transaction_id: t.transaction_id,
        transaction_date: t.transaction_date,
        transaction_type: t.transaction_type,
        item_id: t.item_id,
        item_code: item?.item_code ?? '',
        item_name: item?.item_name ?? '',
        quantity: t.quantity ?? 0,
        unit: item?.unit ?? '',
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
        company_name: company?.company_name ?? ''
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

    // Validate transaction type
    const validTypes = ['입고', '출고', '생산입고', '생산출고', '이동', '조정', '폐기', '재고조정'];
    if (!validTypes.includes(transaction_type)) {
      return NextResponse.json(
        { success: false, error: `Invalid transaction_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const projectId = process.env.SUPABASE_PROJECT_ID || '';

    // Check if item exists and get current stock
    const itemResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: `SELECT item_id, item_code, item_name, current_stock FROM items WHERE item_id = ${item_id}`
    });

    if (!itemResult.rows || itemResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `Item with ID ${item_id} not found` },
        { status: 404 }
      );
    }

    const currentItem = itemResult.rows[0];
    const currentStock = Number(currentItem.current_stock) || 0;

    // 출고 시 재고 부족 체크
    if (transaction_type === '출고' && currentStock < Math.abs(quantity)) {
      return NextResponse.json(
        {
          success: false,
          error: `재고 부족: ${currentItem.item_code} (필요: ${Math.abs(quantity)}, 현재: ${currentStock})`
        },
        { status: 400 }
      );
    }

    // 회사 ID가 제공된 경우 존재 여부 확인
    if (company_id) {
      const companyResult = await mcp__supabase__execute_sql({
        project_id: projectId,
        query: `SELECT company_id FROM companies WHERE company_id = ${company_id}`
      });

      if (!companyResult.rows || companyResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: `회사 ID ${company_id}를 찾을 수 없습니다` },
          { status: 404 }
        );
      }
    }

    // Calculate amounts
    const unitPrice = unit_price || 0;
    const taxResult = calculateTax({ 
      quantity: Math.abs(quantity), 
      unitPrice: unitPrice,
      taxRate: 0.1 // 10% tax rate
    });
    const totalAmount = taxResult.subtotalAmount;
    const taxAmount = taxResult.taxAmount;
    const grandTotal = taxResult.grandTotal;

    // Calculate new stock
    let newStock = currentStock;
    if (['입고', '생산입고'].includes(transaction_type)) {
      newStock += Math.abs(quantity);
    } else if (['출고', '생산출고', '폐기'].includes(transaction_type)) {
      newStock -= Math.abs(quantity);
    }

    // Create inventory transaction
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
          '${transaction_date || new Date().toISOString().split('T')[0]}',
          '${transaction_type}',
          ${item_id},
          ${company_id || 'NULL'},
          ${quantity},
          ${unitPrice},
          ${totalAmount},
          ${taxAmount},
          ${grandTotal},
          '${reference_id || ''}',
          '${reference_id || ''}',
          ${warehouse_id || 'NULL'},
          '${location || ''}',
          '${lot_number || ''}',
          ${expiry_date ? `'${expiry_date}'` : 'NULL'},
          '완료',
          '${note || ''}',
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

    // Update item stock
    await mcp__supabase__execute_sql({
      project_id: projectId,
      query: `
        UPDATE items 
        SET current_stock = ${newStock},
            updated_at = NOW()
        WHERE item_id = ${item_id}
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