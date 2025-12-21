import { NextRequest, NextResponse } from 'next/server';
import { supabase, handleSupabaseError } from '@/lib/db-unified';
import { parsePagination, buildPaginatedResponse, getPaginationFromSearchParams } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

// Cache configuration
const CACHE_DURATION = 30; // seconds

/**
 * GET /api/inventory/stock
 * Get current stock levels for all items (Optimized with pagination & caching)
 * Query parameters:
 * - item_id: Filter by specific item
 * - category: Filter by item category
 * - low_stock: Show only items below reorder level
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 100, max: 500)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const itemId = searchParams.get('item_id');
    const category = searchParams.get('category');
    const lowStock = searchParams.get('low_stock');

    // Get pagination parameters
    const paginationInput = getPaginationFromSearchParams(searchParams);
    const paginationParams = parsePagination(paginationInput, {
      page: 1,
      limit: 100, // Default 100 items per page
      maxLimit: 500 // Max 500 items for stock view
    });

    // Build query using Supabase client
    let query = supabase
      .from('items')
      .select(`
        item_id,
        item_code,
        item_name,
        spec,
        unit,
        item_type,
        current_stock,
        safety_stock,
        price
      `, { count: 'exact' })
      .eq('is_active', true);

    // Apply filters with validation
    if (itemId) {
      const parsedItemId = parseInt(itemId, 10);
      if (isNaN(parsedItemId) || parsedItemId <= 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid item_id: must be a positive integer' },
          { status: 400 }
        );
      }
      query = query.eq('item_id', parsedItemId);
    }

    if (category) {
      query = query.eq('item_type', category);
    }

    // Apply low_stock filter at SQL level BEFORE pagination
    // This uses raw SQL filter to compare current_stock <= safety_stock
    if (lowStock === 'true') {
      query = query.or('current_stock.lte.safety_stock,and(safety_stock.is.null,current_stock.lte.0)');
    }

    const offset = paginationParams.offset;

    query = query
      .order('item_code', { ascending: true })
      .range(offset, offset + paginationParams.limit - 1);

    const { data: stockData, error, count } = await query;

    if (error) {
      return NextResponse.json(
        handleSupabaseError('GET', 'items', error),
        { status: 500 }
      );
    }

    // Calculate stock status for each item
    let enrichedData = (stockData || []).map((item: any) => {
      const stockStatus =
        item.current_stock <= (item.safety_stock || 0) ? 'LOW' :
        item.current_stock > (item.safety_stock || 0) * 2 ? 'HIGH' :
        'NORMAL';

      return {
        ...item,
        stock_status: stockStatus,
        calculated_stock: item.current_stock // Use current_stock as calculated value
      };
    });

    // Note: low_stock filter is now applied at SQL level before pagination
    // No need to filter again here

    // Calculate summary statistics (optimized for pagination)
    const lowStockCount = enrichedData.filter((item: any) => item.stock_status === 'LOW').length;
    const summary = {
      total_items: count || 0,
      low_stock_items: lowStock === 'true' ? (count || 0) : lowStockCount,
      total_value: enrichedData.reduce((sum: number, item: any) =>
        sum + (item.current_stock * (item.price || 0)), 0
      )
    };

    // Build paginated response
    const response = buildPaginatedResponse(enrichedData, count || 0, {
      page: paginationParams.page,
      limit: paginationParams.limit
    });

    // Set cache headers for 30 seconds
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=${CACHE_DURATION * 2}`
    });

    return NextResponse.json({
      success: true,
      data: {
        ...response,
        summary
      }
    }, { headers });
  } catch (error) {
    console.error('Error fetching stock data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch stock data'
      },
      { status: 500 }
    );
  }
}