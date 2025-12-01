import { NextRequest, NextResponse } from 'next/server';
import { createValidatedRoute } from '@/lib/validationMiddleware';
import { getSupabaseClient } from '@/lib/db-unified';
import { type InventoryType, type QualityStatus } from '@/lib/constants/inventoryTypes';

export const dynamic = 'force-dynamic';


interface CurrentStock {
  item_id: number;
  item_code: string;
  item_name: string;
  spec?: string | null;
  category: string;
  unit: string;
  current_stock: number;
  safety_stock?: number;
  stock_value: number;
  is_low_stock: boolean;
  // 규격 및 숫자 필드
  thickness?: number | null;
  width?: number | null;
  height?: number | null;
  specific_gravity?: number | null;
  mm_weight?: number | null;
  daily_requirement?: number | null;
  blank_size?: number | null;
  material?: string | null;
  vehicle_model?: string | null;
  item_type?: string | null;
  material_type?: string | null;
  // Phase 3 - Classification fields
  inventory_type?: InventoryType | null;
  warehouse_zone?: string | null;
  quality_status?: QualityStatus | null;
  // Phase 4 - 중량 관리 필드
  is_weight_managed?: boolean;
  current_weight?: number | null;
}

export const GET = createValidatedRoute(
  async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const supplierId = searchParams.get('supplier_id');

    const supabase = getSupabaseClient();

    // Build query - get stock data from items table (Phase 3: includes classification fields)
    // 규격 및 모든 숫자 필드 포함
    let query = supabase
      .from('items')
      .select('item_id, item_code, item_name, spec, category, unit, current_stock, safety_stock, price, thickness, width, height, specific_gravity, mm_weight, daily_requirement, blank_size, material, vehicle_model, item_type, material_type, is_active, inventory_type, warehouse_zone, quality_status, supplier_id, is_weight_managed, current_weight')
      .eq('is_active', true);

    // Apply filters
    if (category) {
      query = query.eq('category', category as any);
    }

    if (search) {
      // Use multiple ilike filters with or() - Supabase format: column.operator.value,column.operator.value
      query = query.or(`item_code.ilike.%${search}%,item_name.ilike.%${search}%,spec.ilike.%${search}%`);
    }

    if (supplierId) {
      const supplierIdNum = parseInt(supplierId);
      if (!isNaN(supplierIdNum)) {
        query = query.eq('supplier_id', supplierIdNum);
      }
    }

    // Apply ordering
    query = query.order('item_code', { ascending: true });

    const { data: items, error } = await query;

    if (error) {
      console.error('Error fetching current stock:', error);
      console.error('Query details:', { category, status, search, supplierId });
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch current stock: ${error.message}`,
          details: error
        },
        { status: 500 }
      );
    }

    // 1. 현재 월 계산
    const currentMonth = new Date().toISOString().substring(0, 7) + '-01';

    // 2. 모든 품목 ID 추출
    const itemIds = (items || []).map(i => i.item_id);

    // 3. 월별 단가 배치 조회 (생산관리와 동일한 로직)
    // Fix: 빈 배열일 때는 쿼리 실행하지 않음 (Supabase .in()은 빈 배열을 허용하지 않음)
    let monthlyPrices: any[] = [];
    if (itemIds.length > 0) {
      const { data, error: priceError } = await supabase
        .from('item_price_history')
        .select('item_id, unit_price')
        .in('item_id', itemIds)
        .eq('price_month', currentMonth);
      
      if (priceError) {
        console.error('Error fetching monthly prices:', priceError);
        // Continue with empty prices if error occurs
      } else {
        monthlyPrices = data || [];
      }
    }

    // 4. 각 품목의 마지막 거래 조회 (배치)
    // Fix: 빈 배열일 때는 쿼리 실행하지 않음
    let lastTransactions: any[] = [];
    if (itemIds.length > 0) {
      const { data, error: txError } = await supabase
        .from('inventory_transactions')
        .select('item_id, transaction_date, created_at, transaction_type')
        .in('item_id', itemIds)
        .order('created_at', { ascending: false });
      
      if (txError) {
        console.error('Error fetching last transactions:', txError);
        // Continue with empty transactions if error occurs
      } else {
        lastTransactions = data || [];
      }
    }

    // 5. Map으로 빠른 조회
    const priceMap = new Map(
      monthlyPrices.map(p => [p.item_id, p.unit_price])
    );

    // 각 품목의 첫 번째(최신) 거래만 저장
    // created_at을 우선 사용 (시간 정보 포함), 없으면 transaction_date 사용
    const lastTxMap = new Map();
    lastTransactions.forEach((tx: any) => {
      if (!lastTxMap.has(tx.item_id)) {
        lastTxMap.set(tx.item_id, {
          date: tx.created_at || tx.transaction_date, // created_at 우선 (시간 정보 포함)
          type: tx.transaction_type
        });
      }
    });

    // 6. Transform data and calculate stock status with monthly price
    const stocks = ((items || []) as any[]).map((item: any) => {
      // current_stock이 null이거나 undefined인 경우 0으로 처리
      // 하지만 숫자 0은 유효한 값이므로 그대로 사용
      const currentStock = (item.current_stock !== null && item.current_stock !== undefined) 
        ? Number(item.current_stock) 
        : 0;
      const safetyStock = (item.safety_stock !== null && item.safety_stock !== undefined) 
        ? Number(item.safety_stock) 
        : 0;
      
      // 월별 단가 우선 적용 (월별 단가 > price)
      const monthlyPrice = priceMap.get(item.item_id);
      const priceFromItem = item.price !== null && item.price !== undefined 
        ? Number(item.price) 
        : null;
      
      // 우선순위: 월별 단가 > price > 0
      const unitPrice = monthlyPrice || priceFromItem || 0;
      const stockValue = Number(unitPrice) * Number(currentStock);
      const isLowStock = currentStock <= safetyStock;
      
      // 마지막 거래 정보
      const lastTx = lastTxMap.get(item.item_id);

      return {
        item_id: item.item_id,
        item_code: item.item_code,
        item_name: item.item_name,
        spec: item.spec || null,
        category: item.category,
        unit: item.unit,
        current_stock: currentStock,
        safety_stock: safetyStock,
        unit_price: unitPrice,
        stock_value: stockValue,
        is_low_stock: isLowStock,
        last_transaction_date: lastTx?.date || null,
        last_transaction_type: lastTx?.type || null,
        // 규격 및 숫자 필드
        thickness: item.thickness !== null && item.thickness !== undefined ? Number(item.thickness) : null,
        width: item.width !== null && item.width !== undefined ? Number(item.width) : null,
        height: item.height !== null && item.height !== undefined ? Number(item.height) : null,
        specific_gravity: item.specific_gravity !== null && item.specific_gravity !== undefined ? Number(item.specific_gravity) : null,
        mm_weight: item.mm_weight !== null && item.mm_weight !== undefined ? Number(item.mm_weight) : null,
        daily_requirement: item.daily_requirement !== null && item.daily_requirement !== undefined ? Number(item.daily_requirement) : null,
        blank_size: item.blank_size !== null && item.blank_size !== undefined ? Number(item.blank_size) : null,
        material: item.material || null,
        vehicle_model: item.vehicle_model || null,
        item_type: item.item_type || null,
        material_type: item.material_type || null,
        // Phase 3 - Classification fields
        inventory_type: item.inventory_type || null,
        warehouse_zone: item.warehouse_zone || null,
        quality_status: item.quality_status || null,
        // Phase 4 - 중량 관리 필드
        is_weight_managed: item.is_weight_managed || false,
        current_weight: item.current_weight !== null && item.current_weight !== undefined ? Number(item.current_weight) : null
      };
    });

    // Apply status filter if needed
    let filteredStocks = stocks;
    if (status === 'low') {
      filteredStocks = stocks.filter(s => s.is_low_stock);
    } else if (status === 'normal') {
      filteredStocks = stocks.filter(s => !s.is_low_stock);
    }

    // Calculate summary statistics
    const summary = {
      total_items: filteredStocks.length,
      normal_items: filteredStocks.filter(s => !s.is_low_stock).length,
      low_stock_items: filteredStocks.filter(s => s.is_low_stock).length,
      total_value: filteredStocks.reduce((sum, s) => sum + s.stock_value, 0)
    };

    return NextResponse.json({
      success: true,
      data: filteredStocks,
      summary
    });
  } catch (error) {
    console.error('Error fetching current stock:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch current stock: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
  },
  { resource: 'inventory', action: 'read', requireAuth: false }
);

// Get stock history for a specific item
export const POST = createValidatedRoute(
  async (request: NextRequest) => {
  try {
    // Korean UTF-8 support
    const text = await request.text();
    const body = JSON.parse(text);
    const { item_id, start_date, end_date } = body;

    if (!item_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Item ID is required'
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // SECURITY FIX: Use Supabase client instead of raw SQL to prevent SQL injection
    // Build query with parameterized filters
    let query = supabase
      .from('inventory_transactions')
      .select(`
        *,
        items!inner(item_code, item_name),
        companies(company_name),
        users!created_by(name)
      `)
      .eq('item_id', item_id);

    // Apply date filters using parameterized queries (SQL injection safe)
    if (start_date) {
      query = query.gte('transaction_date', start_date);
    }

    if (end_date) {
      query = query.lte('transaction_date', end_date);
    }

    // Order by date descending
    query = query.order('transaction_date', { ascending: false })
                 .order('created_at', { ascending: false });

    const { data: transactions, error } = await query;

    if (error) {
      console.error('Error fetching stock history:', error);
      throw new Error(error.message);
    }

    // Calculate running balance for each transaction
    const history = (transactions || []).map((txn: any, index: number) => {
      // Calculate cumulative balance up to this transaction
      let runningBalance = 0;

      for (let i = transactions.length - 1; i >= index; i--) {
        const t = transactions[i];
        const type = t.transaction_type;

        if (type === '입고' || type === '생산입고') {
          runningBalance += t.quantity;
        } else if (type === '출고' || type === '생산출고' || type === '폐기') {
          runningBalance -= t.quantity;
        } else if (type === '재고조정') {
          runningBalance += t.quantity;
        }
      }

      return {
        ...txn,
        item_code: txn.items?.item_code || '',
        item_name: txn.items?.item_name || '',
        company_name: txn.companies?.company_name || '',
        created_by_name: txn.users?.name || '',
        running_balance: runningBalance
      };
    });

    return NextResponse.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching stock history:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch stock history'
      },
      { status: 500 }
    );
  }
  },
  { resource: 'inventory', action: 'read', requireAuth: false }
);