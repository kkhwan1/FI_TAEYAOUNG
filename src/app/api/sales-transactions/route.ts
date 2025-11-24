import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { ERPError, ErrorType, handleError as handleErrorResponse } from '@/lib/errorHandler';
import { applyCompanyFilter } from '@/lib/filters';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';


type SalesTransactionRow = Database['public']['Tables']['sales_transactions']['Row'];
type SalesTransactionInsert = Database['public']['Tables']['sales_transactions']['Insert'];
type SalesTransactionUpdate = Database['public']['Tables']['sales_transactions']['Update'];

const DEFAULT_LIMIT = 20;

function normalizeString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeInteger(value: unknown): number | null {
  const numeric = normalizeNumber(value);
  if (numeric === null) return null;
  return Math.trunc(numeric);
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;
  const str = normalizeString(value);
  if (!str) return null;

  // Validate date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return null;
  }

  return str;
}

/**
 * Handle customer grouping with monthly breakdown
 */
async function handleCustomerGrouping(
  supabase: ReturnType<typeof getSupabaseClient>,
  filters: { customerId: number | null; startDate: string | null; endDate: string | null }
): Promise<NextResponse> {
  try {
    // Build base query for sales transactions with customer info
    // Note: Explicitly specify foreign key constraint names to avoid PGRST201 error
    let query = supabase
      .from('sales_transactions')
      .select(`
        transaction_id,
        transaction_date,
        customer_id,
        total_amount,
        customer:companies!customer_id(company_id, company_name),
        invoice_items!fk_invoice_items_sales_transactions(quantity, total_amount),
        payment_splits!fk_payment_splits_transaction_id(amount)
      `)
      .eq('is_active', true);

    // Apply filters
    if (filters.customerId !== null) {
      query = query.eq('customer_id', filters.customerId);
    }
    if (filters.startDate) {
      query = query.gte('transaction_date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('transaction_date', filters.endDate);
    }

    const { data: transactions, error } = await query;

    if (error) {
      throw error;
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Group by customer
    const customerMap = new Map<number, {
      customer_id: number;
      customer_name: string;
      total_amount: number;
      collected_amount: number;
      outstanding_amount: number;
      transaction_count: number;
      monthly_data: Map<string, { total: number; collected: number; outstanding: number }>;
    }>();

    for (const txn of transactions) {
      const customerId = txn.customer_id;
      const customerName = (txn.customer as any)?.company_name || '알 수 없음';
      const month = txn.transaction_date.substring(0, 7); // YYYY-MM

      // Calculate collected amount from payment_splits
      const collectedAmount = (txn.payment_splits || []).reduce(
        (sum: number, split: any) => sum + (split.amount || 0),
        0
      );
      const outstandingAmount = txn.total_amount - collectedAmount;

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customer_id: customerId,
          customer_name: customerName,
          total_amount: 0,
          collected_amount: 0,
          outstanding_amount: 0,
          transaction_count: 0,
          monthly_data: new Map(),
        });
      }

      const customerData = customerMap.get(customerId)!;
      customerData.total_amount += txn.total_amount;
      customerData.collected_amount += collectedAmount;
      customerData.outstanding_amount += outstandingAmount;
      customerData.transaction_count += 1;

      // Update monthly breakdown
      if (!customerData.monthly_data.has(month)) {
        customerData.monthly_data.set(month, {
          total: 0,
          collected: 0,
          outstanding: 0,
        });
      }

      const monthlyData = customerData.monthly_data.get(month)!;
      monthlyData.total += txn.total_amount;
      monthlyData.collected += collectedAmount;
      monthlyData.outstanding += outstandingAmount;
    }

    // Convert to response format
    const result = Array.from(customerMap.values()).map((customer) => ({
      customer_id: customer.customer_id,
      customer_name: customer.customer_name,
      total_amount: customer.total_amount,
      collected_amount: customer.collected_amount,
      outstanding_amount: customer.outstanding_amount,
      transaction_count: customer.transaction_count,
      monthly_breakdown: Array.from(customer.monthly_data.entries())
        .map(([month, data]) => ({
          month,
          total_amount: data.total,
          collected_amount: data.collected,
          outstanding_amount: data.outstanding,
        }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    }));

    // Sort by total amount descending
    result.sort((a, b) => b.total_amount - a.total_amount);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleErrorResponse(error, { resource: 'sales_transactions', action: 'read' });
  }
}

/**
 * Handle item grouping with monthly breakdown
 */
async function handleItemGrouping(
  supabase: ReturnType<typeof getSupabaseClient>,
  filters: { customerId: number | null; startDate: string | null; endDate: string | null }
): Promise<NextResponse> {
  try {
    // Build base query for invoice items with transaction info
    // Note: Specify FK constraint name to avoid ambiguity
    let query = supabase
      .from('invoice_items')
      .select(`
        invoice_item_id,
        item_id,
        quantity,
        total_amount,
        item:items!item_id(item_id, item_name),
        transaction:sales_transactions!fk_invoice_items_sales_transactions(
          transaction_id,
          transaction_date,
          customer_id,
          is_active
        )
      `);

    const { data: items, error } = await query;

    if (error) {
      throw error;
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Filter based on transaction filters
    const filteredItems = items.filter((item) => {
      const txn = item.transaction as any;
      if (!txn || !txn.is_active) return false;

      if (filters.customerId !== null && txn.customer_id !== filters.customerId) {
        return false;
      }

      if (filters.startDate && txn.transaction_date < filters.startDate) {
        return false;
      }

      if (filters.endDate && txn.transaction_date > filters.endDate) {
        return false;
      }

      return true;
    });

    // Group by item
    const itemMap = new Map<number, {
      item_id: number;
      item_name: string;
      total_quantity: number;
      total_amount: number;
      transaction_count: number;
      monthly_data: Map<string, { quantity: number; amount: number }>;
      transaction_ids: Set<number>;
    }>();

    for (const invItem of filteredItems) {
      const itemId = invItem.item_id;
      const itemName = (invItem.item as any)?.item_name || '알 수 없음';
      const txn = invItem.transaction as any;
      const month = txn.transaction_date.substring(0, 7); // YYYY-MM

      if (!itemMap.has(itemId)) {
        itemMap.set(itemId, {
          item_id: itemId,
          item_name: itemName,
          total_quantity: 0,
          total_amount: 0,
          transaction_count: 0,
          monthly_data: new Map(),
          transaction_ids: new Set(),
        });
      }

      const itemData = itemMap.get(itemId)!;
      itemData.total_quantity += invItem.quantity;
      itemData.total_amount += invItem.total_amount;

      // Track unique transactions
      if (!itemData.transaction_ids.has(txn.transaction_id)) {
        itemData.transaction_ids.add(txn.transaction_id);
        itemData.transaction_count += 1;
      }

      // Update monthly breakdown
      if (!itemData.monthly_data.has(month)) {
        itemData.monthly_data.set(month, {
          quantity: 0,
          amount: 0,
        });
      }

      const monthlyData = itemData.monthly_data.get(month)!;
      monthlyData.quantity += invItem.quantity;
      monthlyData.amount += invItem.total_amount;
    }

    // Convert to response format
    const result = Array.from(itemMap.values()).map((item) => ({
      item_id: item.item_id,
      item_name: item.item_name,
      total_quantity: item.total_quantity,
      total_amount: item.total_amount,
      transaction_count: item.transaction_count,
      monthly_breakdown: Array.from(item.monthly_data.entries())
        .map(([month, data]) => ({
          month,
          quantity: data.quantity,
          amount: data.amount,
        }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    }));

    // Sort by total amount descending
    result.sort((a, b) => b.total_amount - a.total_amount);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleErrorResponse(error, { resource: 'sales_transactions', action: 'read' });
  }
}

/**
 * GET /api/sales-transactions
 * List sales transactions with filtering and pagination
 * Phase 2: Returns multi-item invoices with payment splits
 * Extension: Supports groupBy parameter for customer and item grouping
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;

    // Extract query parameters
    // Support both customer_id and company_id for backward compatibility
    const customerId = normalizeInteger(searchParams.get('customer_id')) || normalizeInteger(searchParams.get('company_id'));
    const startDate = normalizeDate(searchParams.get('start_date'));
    const endDate = normalizeDate(searchParams.get('end_date'));
    const search = normalizeString(searchParams.get('search'));
    const paymentStatus = normalizeString(searchParams.get('payment_status'));
    const groupBy = normalizeString(searchParams.get('groupBy'));
    const limit = normalizeInteger(searchParams.get('limit')) ?? DEFAULT_LIMIT;
    const page = normalizeInteger(searchParams.get('page')) ?? 1;
    const offset = (page - 1) * limit;

    // Handle groupBy functionality
    if (groupBy === 'customer') {
      return handleCustomerGrouping(supabase, { customerId, startDate, endDate });
    }

    if (groupBy === 'item') {
      return handleItemGrouping(supabase, { customerId, startDate, endDate });
    }

    // Phase 2: Build query without invoice_items to avoid PGRST201 error
    // We'll fetch invoice_items and payment_splits separately
    let query = supabase
      .from('sales_transactions')
      .select(`
        *,
        customer:companies!customer_id(company_id, company_name, company_code)
      `, { count: 'exact' })
      .eq('is_active', true)
      .order('transaction_date', { ascending: false })
      .order('transaction_no', { ascending: false });

    // Apply filters
    if (customerId !== null) {
      query = query.eq('customer_id', customerId);
    }

    if (startDate) {
      query = query.gte('transaction_date', startDate);
    }

    if (endDate) {
      query = query.lte('transaction_date', endDate);
    }

    // Apply pagination first (before filtering by search/payment_status)
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // Fetch invoice_items separately to avoid PGRST201 error
    const transactionIds = (data ?? []).map((txn: any) => txn.transaction_id);
    let invoiceItemsMap = new Map<number, any[]>();
    let paymentSplitsMap = new Map<number, any[]>();
    
    if (transactionIds.length > 0) {
      // Fetch invoice_items
      const { data: invoiceItems, error: invoiceItemsError } = await supabase
        .from('invoice_items')
        .select('invoice_item_id, transaction_id, item_id, quantity, unit_price, total_amount, line_no, notes')
        .in('transaction_id', transactionIds);

      if (!invoiceItemsError && invoiceItems) {
        invoiceItems.forEach((item: any) => {
          if (!invoiceItemsMap.has(item.transaction_id)) {
            invoiceItemsMap.set(item.transaction_id, []);
          }
          invoiceItemsMap.get(item.transaction_id)!.push(item);
        });
      }

      // Fetch payment_splits
      const { data: paymentSplits, error: paymentSplitsError } = await supabase
        .from('payment_splits')
        .select('payment_split_id, transaction_id, payment_method, amount, bill_number, bill_date, bill_drawer, check_number, check_bank, bank_name, account_number, notes')
        .in('transaction_id', transactionIds);

      if (!paymentSplitsError && paymentSplits) {
        paymentSplits.forEach((split: any) => {
          if (!paymentSplitsMap.has(split.transaction_id)) {
            paymentSplitsMap.set(split.transaction_id, []);
          }
          // 프론트엔드 PaymentSplitForm이 기대하는 형식으로 변환: payment_method -> method
          paymentSplitsMap.get(split.transaction_id)!.push({
            ...split,
            method: split.payment_method, // payment_method를 method로 매핑
          });
        });
      }

      // Fetch item details for invoice_items
      const itemIds = new Set<number>();
      invoiceItems?.forEach((item: any) => {
        if (item.item_id) itemIds.add(item.item_id);
      });

      let itemsMap = new Map<number, any>();
      if (itemIds.size > 0) {
        const { data: items, error: itemsError } = await supabase
          .from('items')
          .select('item_id, item_code, item_name, unit, spec')
          .in('item_id', Array.from(itemIds));

        if (!itemsError && items) {
          items.forEach((item: any) => {
            itemsMap.set(item.item_id, item);
          });
        }
      }

      // Merge item details into invoice_items
      invoiceItemsMap.forEach((items, transactionId) => {
        invoiceItemsMap.set(transactionId, items.map((item: any) => ({
          ...item,
          item: itemsMap.get(item.item_id) || null,
        })));
      });
    }

    // Merge invoice_items and payment_splits into transactions
    const enrichedData = (data ?? []).map((txn: any) => ({
      ...txn,
      invoice_items: invoiceItemsMap.get(txn.transaction_id) || [],
      payment_splits: paymentSplitsMap.get(txn.transaction_id) || [],
    }));

    // Apply client-side filters for joined table fields (customer name, item name)
    let filteredData = enrichedData;
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter((txn: any) => {
        // Search in transaction_no and notes
        if (txn.transaction_no?.toLowerCase().includes(searchLower) || 
            txn.notes?.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Search in customer name
        if (txn.customer?.company_name?.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Search in item names (from invoice_items)
        if (txn.invoice_items?.some((item: any) => 
          item.item?.item_name?.toLowerCase().includes(searchLower) ||
          item.item?.item_code?.toLowerCase().includes(searchLower)
        )) {
          return true;
        }
        
        return false;
      });
    }

    // Apply payment_status filter (client-side calculation)
    if (paymentStatus) {
      filteredData = filteredData.filter((txn: any) => {
        const paidForTxn = (txn.payment_splits ?? []).reduce((paidSum: number, split: any) => {
          return paidSum + (split.amount ?? 0);
        }, 0);

        let status = 'PENDING';
        if (paidForTxn === 0) {
          status = 'PENDING';
        } else if (paidForTxn < txn.total_amount) {
          status = 'PARTIAL';
        } else {
          status = 'COMPLETE';
        }

        return status === paymentStatus;
      });
    }

    // Phase 2: Calculate summary statistics from payment_splits (use filteredData)
    const totalAmount = filteredData.reduce((sum, txn) => sum + (txn.total_amount ?? 0), 0);

    // Calculate total paid from payment_splits
    const totalPaid = filteredData.reduce((sum, txn) => {
      const paidForTxn = (txn.payment_splits ?? []).reduce((paidSum: number, split: any) => {
        return paidSum + (split.amount ?? 0);
      }, 0);
      return sum + paidForTxn;
    }, 0);

    const totalUnpaid = totalAmount - totalPaid;

    // Phase 2: Calculate payment status summary dynamically
    const statusSummary = filteredData.reduce<Record<string, number>>((acc, txn) => {
      const paidForTxn = (txn.payment_splits ?? []).reduce((paidSum: number, split: any) => {
        return paidSum + (split.amount ?? 0);
      }, 0);

      let status = 'PENDING';
      if (paidForTxn === 0) {
        status = 'PENDING';
      } else if (paidForTxn < txn.total_amount) {
        status = 'PARTIAL';
      } else {
        status = 'COMPLETE';
      }

      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        transactions: filteredData,
        pagination: {
          page,
          limit,
          total: filteredData.length, // Use filtered count for accurate pagination
          totalPages: Math.ceil(filteredData.length / limit),
          hasMore: filteredData.length >= limit,
        },
        summary: {
          totalAmount,
          totalPaid,
          totalUnpaid,
          byPaymentStatus: statusSummary,
        },
      },
      filters: {
        customer_id: customerId,
        start_date: startDate,
        end_date: endDate,
        search,
        payment_status: paymentStatus,
      },
    });
  } catch (error) {
    return handleErrorResponse(error, { resource: 'sales_transactions', action: 'read' });
  }
}

/**
 * POST /api/sales-transactions
 * Create new sales transaction with multi-item invoice and payment splits
 * Phase 2: Supports invoice_items and payment_splits arrays
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Korean character handling: use request.text() + JSON.parse()
    const text = await request.text();
    const body = JSON.parse(text);

    // Phase 2: Extract arrays
    const invoiceItems = body.invoice_items || [];
    const paymentSplits = body.payment_splits || [];

    // Normalize transaction-level fields
    const transactionDate = normalizeDate(body.transaction_date);
    const customerId = normalizeInteger(body.customer_id);
    const supplyAmount = normalizeNumber(body.supply_amount);
    const taxAmount = normalizeNumber(body.tax_amount);
    const totalAmount = normalizeNumber(body.total_amount);
    const paymentDueDate = normalizeDate(body.payment_due_date);
    const notes = normalizeString(body.notes);

    // Validate required transaction fields
    const missingFields = [];
    if (!transactionDate) missingFields.push('transaction_date');
    if (!customerId) missingFields.push('customer_id');
    if (supplyAmount === null) missingFields.push('supply_amount');
    if (taxAmount === null) missingFields.push('tax_amount');
    if (totalAmount === null) missingFields.push('total_amount');

    if (missingFields.length > 0) {
      throw new ERPError(ErrorType.VALIDATION, `필수 입력값을 확인해주세요: ${missingFields.join(', ')}`);
    }

    // Phase 2: Validate invoice_items array
    if (!Array.isArray(invoiceItems) || invoiceItems.length === 0) {
      throw new ERPError(ErrorType.VALIDATION, '최소 1개 이상의 품목을 추가해주세요.');
    }

    // Validate each invoice item
    invoiceItems.forEach((item, index) => {
      const itemMissingFields = [];
      if (!item.item_id) itemMissingFields.push(`item_id`);
      if (!item.item_name) itemMissingFields.push(`item_name`);
      if (item.quantity === null || item.quantity === undefined) itemMissingFields.push(`quantity`);
      if (item.unit_price === null || item.unit_price === undefined) itemMissingFields.push(`unit_price`);
      if (item.total_amount === null || item.total_amount === undefined) itemMissingFields.push(`total_amount`);

      if (itemMissingFields.length > 0) {
        throw new ERPError(
          ErrorType.VALIDATION,
          `품목 ${index + 1}번: 필수 입력값을 확인해주세요 (${itemMissingFields.join(', ')})`
        );
      }

      if (item.quantity <= 0) {
        throw new ERPError(ErrorType.BUSINESS_RULE, `품목 ${index + 1}번: 수량은 0보다 커야 합니다.`);
      }

      if (item.unit_price <= 0) {
        throw new ERPError(ErrorType.BUSINESS_RULE, `품목 ${index + 1}번: 단가는 0보다 커야 합니다.`);
      }
    });

    // Phase 2: Validate payment_splits array
    if (!Array.isArray(paymentSplits) || paymentSplits.length === 0) {
      throw new ERPError(ErrorType.VALIDATION, '결제 정보를 입력해주세요.');
    }

    // Validate payment split sum
    const paymentTotal = paymentSplits.reduce((sum, p) => sum + (p.amount || 0), 0);
    if (Math.abs(paymentTotal - totalAmount!) > 0.01) {
      throw new ERPError(
        ErrorType.VALIDATION,
        `결제 금액 합계(${paymentTotal.toLocaleString('ko-KR')}원)가 총액(${totalAmount!.toLocaleString('ko-KR')}원)과 일치하지 않습니다.`
      );
    }

    // Business rule validation
    if (totalAmount! <= 0) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '합계금액은 0보다 커야 합니다.');
    }

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    // Phase 2: Prepare transaction payload (without deprecated fields)
    // Note: transaction_no is auto-generated by database trigger
    // Phase 1 호환성: 첫 번째 품목 정보를 sales_transactions 테이블에도 저장
    const firstItem = invoiceItems[0];
    const transactionPayload = {
      transaction_date: transactionDate!,
      customer_id: customerId!,
      item_id: firstItem.item_id, // Phase 1 호환성: 첫 번째 품목 ID
      item_name: firstItem.item_name || null, // Phase 1 호환성: 첫 번째 품목명
      quantity: firstItem.quantity, // Phase 1 호환성: 첫 번째 품목 수량
      unit_price: firstItem.unit_price, // Phase 1 호환성: 첫 번째 품목 단가
      supply_amount: supplyAmount!,
      tax_amount: taxAmount!,
      total_amount: totalAmount!,
      payment_due_date: paymentDueDate,
      notes,
      is_active: true,
      created_at: now,
      updated_at: now,
    } as SalesTransactionInsert;

    // Insert transaction first
    const { data: transaction, error: transactionError } = await supabase
      .from('sales_transactions')
      .insert(transactionPayload)
      .select('*')
      .single();

    if (transactionError) {
      throw transactionError;
    }

    if (!transaction) {
      throw new ERPError(ErrorType.NOT_FOUND, '판매 거래를 등록하지 못했습니다.');
    }

    // Phase 2: Insert invoice_items with transaction_id
    // Note: item_code and item_name are not stored in invoice_items table
    // They are retrieved from items table via foreign key relationship
    const invoiceItemsWithTxnId = invoiceItems.map((item, index) => ({
      transaction_id: transaction.transaction_id,
      item_id: item.item_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_amount: item.total_amount,
      line_no: index + 1,
      notes: item.notes || null,
    }));

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(invoiceItemsWithTxnId);

    if (itemsError) {
      // Rollback transaction by deleting it
      await supabase
        .from('sales_transactions')
        .delete()
        .eq('transaction_id', transaction.transaction_id);

      throw new ERPError(
        ErrorType.DATABASE,
        `품목 저장 실패: ${itemsError.message}`
      );
    }

    // Phase 2: Save payment splits via payment split API
    try {
      const paymentResponse = await fetch(`${request.nextUrl.origin}/api/payments/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: transaction.transaction_id,
          payments: paymentSplits.map(p => ({
            method: p.method,
            amount: p.amount,
            bill_number: p.bill_number || null,
            bill_date: p.bill_date || null,
            bill_drawer: p.bill_drawer || null,
            check_number: p.check_number || null,
            check_bank: p.check_bank || null,
            bank_name: p.bank_name || null, // TRANSFER용
            account_number: p.account_number || null, // TRANSFER용
            notes: p.notes || null,
          })),
        }),
      });

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json().catch(() => ({ error: '결제 정보 저장 실패' }));
        throw new Error(errorData.error || '결제 정보 저장 실패');
      }
    } catch (paymentError) {
      // Rollback: delete invoice items and transaction
      await supabase
        .from('invoice_items')
        .delete()
        .eq('transaction_id', transaction.transaction_id);

      await supabase
        .from('sales_transactions')
        .delete()
        .eq('transaction_id', transaction.transaction_id);

      throw new ERPError(
        ErrorType.DATABASE,
        `결제 정보 저장 실패: ${paymentError instanceof Error ? paymentError.message : String(paymentError)}`
      );
    }

    // Phase 2: Fetch complete transaction with joins
    // Note: Explicitly specify foreign key relationships to avoid PGRST201 error
    const { data: completeTransaction, error: fetchError } = await supabase
      .from('sales_transactions')
      .select(`
        *,
        customer:companies!customer_id(company_id, company_name, company_code),
        invoice_items!transaction_id(
          invoice_item_id, 
          item_id, 
          quantity, 
          unit_price, 
          total_amount, 
          line_no, 
          notes,
          item:items!item_id(item_id, item_code, item_name, unit, spec)
        ),
        payment_splits!transaction_id(
          payment_split_id, 
          payment_method, 
          amount, 
          bill_number, 
          bill_date, 
          bill_drawer, 
          check_number, 
          check_bank, 
          notes
        )
      `)
      .eq('transaction_id', transaction.transaction_id)
      .single();

    if (fetchError || !completeTransaction) {
      // Data is saved, but we couldn't fetch the complete record
      // Return basic transaction data
      return NextResponse.json({
        success: true,
        data: transaction,
        message: '판매 거래가 등록되었습니다.',
      });
    }

    return NextResponse.json({
      success: true,
      data: completeTransaction,
      message: '판매 거래가 등록되었습니다.',
    });
  } catch (error) {
    return handleErrorResponse(error, { resource: 'sales_transactions', action: 'create' });
  }
}
