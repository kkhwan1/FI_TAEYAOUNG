import { NextRequest, NextResponse } from 'next/server';
// Removed unused imports: db, SupabaseQueryBuilder, handleSupabaseError, createSuccessResponse, getSupabaseClient
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';


/**
 * GET /api/inventory/shipping/stock-check
 * Check stock availability for shipping multiple items
 * Query parameters:
 * - items: JSON string of items to check [{"item_id": 1, "quantity": 5}, ...]
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const itemsParam = searchParams.get('items');

    if (!itemsParam) {
      return NextResponse.json({
        success: false,
        error: 'items parameter is required. Format: [{"item_id": 1, "quantity": 5}, ...]'
      }, { status: 400 });
    }

    let items;
    try {
      items = JSON.parse(itemsParam);
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        error: 'items parameter must be valid JSON'
      }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'items must be a non-empty array'
      }, { status: 400 });
    }

    // Validate each item in the array
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.item_id || !item.quantity) {
        return NextResponse.json({
          success: false,
          error: `Item at index ${i} must have item_id and quantity`
        }, { status: 400 });
      }

      if (typeof item.item_id !== 'number' || typeof item.quantity !== 'number') {
        return NextResponse.json({
          success: false,
          error: `Item at index ${i}: item_id and quantity must be numbers`
        }, { status: 400 });
      }

      if (item.quantity <= 0) {
        return NextResponse.json({
          success: false,
          error: `Item at index ${i}: quantity must be greater than 0`
        }, { status: 400 });
      }
    }

    // Initialize Supabase client for safe queries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // N+1 쿼리 최적화: 모든 품목을 한 번에 조회
    const itemIds = items.map((item: any) => item.item_id);

    // 빈 배열 가드: .in() 쿼리 전에 체크
    if (itemIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          can_ship_all: true,
          stock_check_results: [],
          valid_items: [],
          error_items: [],
          sufficient_items: [],
          insufficient_items: [],
          summary: {
            total_items_requested: 0,
            valid_items: 0,
            error_items: 0,
            sufficient_items: 0,
            insufficient_items: 0,
            total_order_value: 0,
            total_shortage_value: 0,
            fulfillment_rate: 100
          }
        },
        message: '조회할 항목이 없습니다'
      });
    }

    const { data: itemDataList, error: batchError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, unit, category, price, is_active, current_stock')
      .in('item_id', itemIds);

    if (batchError) {
      console.error('Batch item query failed:', batchError);
      return NextResponse.json({
        success: false,
        error: 'Failed to query items'
      }, { status: 500 });
    }

    // Map으로 변환하여 O(1) 조회
    const itemDataMap = new Map<number, any>();
    if (itemDataList) {
      itemDataList.forEach((item: any) => {
        itemDataMap.set(item.item_id, item);
      });
    }

    // 동기적으로 재고 확인 (더 이상 Promise.all 불필요)
    const stockCheckResults = items.map((item: any, index: number) => {
      const itemData = itemDataMap.get(item.item_id);

      if (!itemData) {
        return {
          index,
          item_id: item.item_id,
          error: `Item with ID ${item.item_id} not found`,
          sufficient: false
        };
      }

      if (!itemData.is_active) {
        return {
          index,
          item_id: item.item_id,
          item_code: itemData.item_code,
          item_name: itemData.item_name,
          error: `Item ${itemData.item_name} is not active`,
          sufficient: false
        };
      }

      const currentStock = itemData.current_stock || 0;
      const requested = item.quantity;
      const shortage = Math.max(0, requested - currentStock);

      return {
        index,
        item_id: item.item_id,
        item_code: itemData.item_code,
        item_name: itemData.item_name,
        category: itemData.category,
        unit: itemData.unit,
        unit_price: itemData.price || 0,
        requested_quantity: requested,
        current_stock: currentStock,
        sufficient: currentStock >= requested,
        shortage: shortage,
        availability_percentage: currentStock > 0 ? Math.round((Math.min(requested, currentStock) / requested) * 10000) / 100 : 0,
        total_value: requested * (itemData.price || 0)
      };
    });

    // Filter out items with errors for summary calculations
    const validResults = stockCheckResults.filter(result => !result.error);
    const errorResults = stockCheckResults.filter(result => result.error);

    const canShipAll = validResults.every(item => item.sufficient);
    const insufficientItems = validResults.filter(item => !item.sufficient);
    const sufficientItems = validResults.filter(item => item.sufficient);

    // Calculate totals
    const totalValue = validResults.reduce((sum, item) => sum + (item.total_value || 0), 0);
    const totalShortageValue = insufficientItems.reduce(
      (sum, item) => sum + ((item.shortage || 0) * (item.unit_price || 0)),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        can_ship_all: canShipAll && errorResults.length === 0,
        stock_check_results: stockCheckResults,
        valid_items: validResults,
        error_items: errorResults,
        sufficient_items: sufficientItems,
        insufficient_items: insufficientItems,
        summary: {
          total_items_requested: items.length,
          valid_items: validResults.length,
          error_items: errorResults.length,
          sufficient_items: sufficientItems.length,
          insufficient_items: insufficientItems.length,
          total_order_value: Math.round(totalValue * 100) / 100,
          total_shortage_value: Math.round(totalShortageValue * 100) / 100,
          fulfillment_rate: validResults.length > 0 ?
            Math.round((sufficientItems.length / validResults.length) * 10000) / 100 : 0
        }
      }
    });
  } catch (error) {
    console.error('Error checking stock availability:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to check stock availability';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/shipping/stock-check
 * Check stock availability for shipping (alternative method using POST body)
 * Body: {
 *   items: Array<{
 *     item_id: number,
 *     quantity: number
 *   }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Korean UTF-8 support
    const text = await request.text();
    const body = JSON.parse(text);
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'items must be a non-empty array'
      }, { status: 400 });
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.item_id || !item.quantity) {
        return NextResponse.json({
          success: false,
          error: `Item at index ${i} must have item_id and quantity`
        }, { status: 400 });
      }

      if (typeof item.item_id !== 'number' || typeof item.quantity !== 'number') {
        return NextResponse.json({
          success: false,
          error: `Item at index ${i}: item_id and quantity must be numbers`
        }, { status: 400 });
      }

      if (item.quantity <= 0) {
        return NextResponse.json({
          success: false,
          error: `Item at index ${i}: quantity must be greater than 0`
        }, { status: 400 });
      }
    }

    // Initialize Supabase client for safe queries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // N+1 쿼리 최적화: 모든 품목을 한 번에 조회
    const itemIds = items.map((item: any) => item.item_id);

    // 빈 배열 가드: .in() 쿼리 전에 체크
    if (itemIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          can_ship_all: true,
          stock_check_results: [],
          valid_items: [],
          error_items: [],
          sufficient_items: [],
          insufficient_items: [],
          summary: {
            total_items_requested: 0,
            valid_items: 0,
            error_items: 0,
            sufficient_items: 0,
            insufficient_items: 0,
            total_order_value: 0,
            total_shortage_value: 0,
            fulfillment_rate: 100
          }
        },
        message: '조회할 항목이 없습니다'
      });
    }

    const { data: itemDataList, error: batchError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, unit, category, price, is_active, current_stock')
      .in('item_id', itemIds);

    if (batchError) {
      console.error('Batch item query failed:', batchError);
      return NextResponse.json({
        success: false,
        error: 'Failed to query items'
      }, { status: 500 });
    }

    // Map으로 변환하여 O(1) 조회
    const itemDataMap = new Map<number, any>();
    if (itemDataList) {
      itemDataList.forEach((item: any) => {
        itemDataMap.set(item.item_id, item);
      });
    }

    // 동기적으로 재고 확인 (더 이상 Promise.all 불필요)
    const stockCheckResults = items.map((item: any, index: number) => {
      const itemData = itemDataMap.get(item.item_id);

      if (!itemData) {
        return {
          index,
          item_id: item.item_id,
          error: `Item with ID ${item.item_id} not found`,
          sufficient: false
        };
      }

      if (!itemData.is_active) {
        return {
          index,
          item_id: item.item_id,
          item_code: itemData.item_code,
          item_name: itemData.item_name,
          error: `Item ${itemData.item_name} is not active`,
          sufficient: false
        };
      }

      const currentStock = itemData.current_stock || 0;
      const requested = item.quantity;
      const shortage = Math.max(0, requested - currentStock);

      return {
        index,
        item_id: item.item_id,
        item_code: itemData.item_code,
        item_name: itemData.item_name,
        category: itemData.category,
        unit: itemData.unit,
        unit_price: itemData.price || 0,
        requested_quantity: requested,
        current_stock: currentStock,
        sufficient: currentStock >= requested,
        shortage: shortage,
        availability_percentage: currentStock > 0 ? Math.round((Math.min(requested, currentStock) / requested) * 10000) / 100 : 0,
        total_value: requested * (itemData.price || 0)
      };
    });

    // Filter out items with errors for summary calculations
    const validResults = stockCheckResults.filter(result => !result.error);
    const errorResults = stockCheckResults.filter(result => result.error);

    const canShipAll = validResults.every(item => item.sufficient);
    const insufficientItems = validResults.filter(item => !item.sufficient);
    const sufficientItems = validResults.filter(item => item.sufficient);

    // Calculate totals
    const totalValue = validResults.reduce((sum, item) => sum + (item.total_value || 0), 0);
    const totalShortageValue = insufficientItems.reduce(
      (sum, item) => sum + ((item.shortage || 0) * (item.unit_price || 0)),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        can_ship_all: canShipAll && errorResults.length === 0,
        stock_check_results: stockCheckResults,
        valid_items: validResults,
        error_items: errorResults,
        sufficient_items: sufficientItems,
        insufficient_items: insufficientItems,
        summary: {
          total_items_requested: items.length,
          valid_items: validResults.length,
          error_items: errorResults.length,
          sufficient_items: sufficientItems.length,
          insufficient_items: insufficientItems.length,
          total_order_value: Math.round(totalValue * 100) / 100,
          total_shortage_value: Math.round(totalShortageValue * 100) / 100,
          fulfillment_rate: validResults.length > 0 ?
            Math.round((sufficientItems.length / validResults.length) * 10000) / 100 : 0
        }
      }
    });
  } catch (error) {
    console.error('Error checking stock availability:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to check stock availability';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}