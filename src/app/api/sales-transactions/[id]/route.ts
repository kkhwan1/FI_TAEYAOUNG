import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { ERPError, ErrorType, handleError as handleErrorResponse } from '@/lib/errorHandler';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';


type SalesTransactionRow = Database['public']['Tables']['sales_transactions']['Row'];
type SalesTransactionUpdate = Database['public']['Tables']['sales_transactions']['Update'];

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
 * GET /api/sales-transactions/[id]
 * Get single sales transaction by ID
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const transactionId = normalizeInteger(id);

    if (!transactionId) {
      throw new ERPError(ErrorType.VALIDATION, '유효한 거래 ID가 필요합니다.');
    }

    const supabase = getSupabaseClient();

    // Phase 2: Fetch transaction with invoice_items and payment_splits separately
    const { data, error } = await supabase
      .from('sales_transactions')
      .select(`
        *,
        customer:companies!customer_id(company_id, company_name, company_code, company_type, phone, email, address),
        item:items(item_id, item_code, item_name, spec, unit, category, current_stock)
      `)
      .eq('transaction_id', transactionId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ERPError(ErrorType.NOT_FOUND, '판매 거래를 찾을 수 없습니다.');
      }
      throw error;
    }

    if (!data) {
      throw new ERPError(ErrorType.NOT_FOUND, '판매 거래를 찾을 수 없습니다.');
    }

    // Phase 2: Fetch invoice_items and payment_splits separately
    const [invoiceItemsResult, paymentSplitsResult] = await Promise.all([
      supabase
        .from('invoice_items')
        .select('invoice_item_id, transaction_id, item_id, quantity, unit_price, total_amount, line_no, notes')
        .eq('transaction_id', transactionId),
      supabase
        .from('payment_splits')
        .select('payment_split_id, transaction_id, payment_method, amount, bill_number, bill_date, bill_drawer, check_number, check_bank, bank_name, account_number, notes')
        .eq('transaction_id', transactionId)
    ]);

    // Merge invoice_items and payment_splits into transaction data
    const enrichedData = {
      ...data,
      invoice_items: invoiceItemsResult.data || [],
      payment_splits: (paymentSplitsResult.data || []).map((split: any) => ({
        ...split,
        method: split.payment_method, // payment_method를 method로 매핑
      })),
    };

    return NextResponse.json({
      success: true,
      data: enrichedData,
    });
  } catch (error) {
    return handleErrorResponse(error, { resource: 'sales_transactions', action: 'read' });
  }
}

/**
 * PUT /api/sales-transactions/[id]
 * Update sales transaction
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const transactionId = normalizeInteger(id);

    if (!transactionId) {
      throw new ERPError(ErrorType.VALIDATION, '유효한 거래 ID가 필요합니다.');
    }

    // Korean character handling: use request.text() + JSON.parse()
    const text = await request.text();
    const body = JSON.parse(text);

    // Normalize input
    const transactionDate = normalizeDate(body.transaction_date);
    const customerId = normalizeInteger(body.customer_id);
    const itemId = normalizeInteger(body.item_id);
    const quantity = normalizeNumber(body.quantity);
    const unitPrice = normalizeNumber(body.unit_price);
    const totalAmount = normalizeNumber(body.total_amount);
    const paidAmount = normalizeNumber(body.paid_amount);
    const paymentStatus = normalizeString(body.payment_status);
    const notes = normalizeString(body.notes);

    // Check if at least one field is being updated
    if (
      transactionDate === null &&
      customerId === null &&
      itemId === null &&
      quantity === null &&
      unitPrice === null &&
      totalAmount === null &&
      paidAmount === null &&
      paymentStatus === null &&
      notes === null
    ) {
      throw new ERPError(ErrorType.VALIDATION, '수정할 값이 없습니다.');
    }

    // Business rule validation for provided values
    if (quantity !== null && quantity <= 0) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '수량은 0보다 커야 합니다.');
    }

    if (unitPrice !== null && unitPrice <= 0) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '단가는 0보다 커야 합니다.');
    }

    if (totalAmount !== null && totalAmount <= 0) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '합계금액은 0보다 커야 합니다.');
    }

    if (paidAmount !== null && paidAmount < 0) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '지급액은 0 이상이어야 합니다.');
    }

    const supabase = getSupabaseClient();

    // Get current transaction to validate paid_amount against total_amount
    const { data: currentTxn, error: fetchError } = await supabase
      .from('sales_transactions')
      .select('total_amount, paid_amount')
      .eq('transaction_id', transactionId)
      .eq('is_active', true)
      .single();

    if (fetchError || !currentTxn) {
      throw new ERPError(ErrorType.NOT_FOUND, '수정할 판매 거래를 찾을 수 없습니다.');
    }

    // Validate paid_amount doesn't exceed total_amount
    const finalTotalAmount = totalAmount ?? currentTxn.total_amount;
    const finalPaidAmount = paidAmount ?? (currentTxn.paid_amount ?? 0);

    if (finalPaidAmount > finalTotalAmount) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '지급액은 합계금액을 초과할 수 없습니다.');
    }

    const now = new Date().toISOString();

    // Build update payload
    const payload: SalesTransactionUpdate = {
      transaction_date: transactionDate ?? undefined,
      customer_id: customerId ?? undefined,
      item_id: itemId ?? undefined,
      quantity: quantity ?? undefined,
      unit_price: unitPrice ?? undefined,
      total_amount: totalAmount ?? undefined,
      paid_amount: paidAmount ?? undefined,
      payment_status: paymentStatus as 'UNPAID' | 'PARTIAL' | 'PAID' | undefined,
      notes: notes ?? undefined,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('sales_transactions')
      .update(payload)
      .eq('transaction_id', transactionId)
      .eq('is_active', true)
      .select(`
        *,
        customer:companies!customer_id(company_id, company_name, company_code),
        item:items(item_id, item_code, item_name, spec, unit)
      `)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ERPError(ErrorType.NOT_FOUND, '수정 대상 판매 거래를 찾을 수 없습니다.');
    }

    return NextResponse.json({
      success: true,
      data,
      message: '판매 거래 정보가 수정되었습니다.',
    });
  } catch (error) {
    return handleErrorResponse(error, { resource: 'sales_transactions', action: 'update' });
  }
}

/**
 * DELETE /api/sales-transactions/[id]
 * Soft delete sales transaction
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const transactionId = normalizeInteger(id);

    if (!transactionId) {
      throw new ERPError(ErrorType.VALIDATION, '유효한 거래 ID가 필요합니다.');
    }

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('sales_transactions')
      .update({
        is_active: false,
        updated_at: now,
      })
      .eq('transaction_id', transactionId)
      .eq('is_active', true)
      .select('transaction_id, transaction_no')
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ERPError(ErrorType.NOT_FOUND, '삭제 대상 판매 거래를 찾을 수 없습니다.');
    }

    return NextResponse.json({
      success: true,
      message: '판매 거래가 삭제되었습니다.',
      data: {
        transaction_id: data.transaction_id,
        transaction_no: data.transaction_no,
      },
    });
  } catch (error) {
    return handleErrorResponse(error, { resource: 'sales_transactions', action: 'delete' });
  }
}
