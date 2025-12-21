/**
 * Dashboard Charts API Route
 * Provides chart data for visualizations
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';


type ItemRow = Database['public']['Tables']['items']['Row'];
type InventoryTransactionRow = Database['public']['Tables']['inventory_transactions']['Row'];
type TransactionType = Database['public']['Enums']['transaction_type'];

type StockChartDatum = {
  name: string;
  현재고: number;
  안전재고: number;
  code: string;
  item_id?: number;
  category?: string;
  price?: number;
  totalValue?: number;
};

type DailyAggregate = {
  date: string;
  입고: number;
  출고: number;
  조정: number;
};

type MonthlyAggregate = {
  month: string;
  입고: number;
  출고: number;
  조정: number;
};

const DAILY_RELEVANT_TYPES: ReadonlyArray<TransactionType> = ['입고', '출고', '생산입고', '생산출고'];
const MONTHLY_RELEVANT_TYPES: ReadonlyArray<TransactionType> = DAILY_RELEVANT_TYPES;

function formatKoreanDate(date: string | Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatKoreanMonth(date: string | Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return `${year}년 ${month}월`;
}

function isRelevantTransaction(type: TransactionType): boolean {
  return DAILY_RELEVANT_TYPES.includes(type);
}

function applyTransaction(quantity: number, type: TransactionType, target: DailyAggregate | MonthlyAggregate) {
  switch (type) {
    case '입고':
      target.입고 += quantity;
      break;
    case '출고':
      target.출고 += quantity;
      break;
    case '생산입고':
    case '생산출고':
      target.조정 += quantity;
      break;
    default:
      break;
  }
}

export async function GET(request: Request) {
  try {
    // Extract filter parameters from URL
    const url = new URL(request.url);
    const supplierId = url.searchParams.get('supplier_id');
    const customerId = url.searchParams.get('customer_id');
    const category = url.searchParams.get('category');

    // Build items query with filters
    let stockItemsQuery = supabaseAdmin
      .from('items')
      .select('item_id, item_code, item_name, current_stock, safety_stock')
      .eq('is_active', true);
    
    if (supplierId) {
      stockItemsQuery = stockItemsQuery.eq('supplier_id', parseInt(supplierId, 10));
    }
    if (category) {
      const validCategories = ['원자재', '부자재', '반제품', '제품', '상품'] as const;
      if (validCategories.includes(category as typeof validCategories[number])) {
        stockItemsQuery = stockItemsQuery.eq('category', category as typeof validCategories[number]);
      }
    }

    const { data: stockItems, error: stockError } = await stockItemsQuery.order('current_stock', { ascending: true });

    if (stockError) {
      throw new Error(`Failed to fetch stock data: ${stockError.message}`);
    }

    const safeStockItems = (stockItems ?? []) as ItemRow[];

    // Fetch prices for all items to calculate stock value
    // 실제 items 테이블 스키마에 맞게 컬럼 선택 (min_stock_level, max_stock_level 제거)
    let itemsWithPricesQuery = supabaseAdmin
      .from('items')
      .select('item_id, item_code, item_name, current_stock, safety_stock, category, price')
      .eq('is_active', true);
    
    if (supplierId) {
      itemsWithPricesQuery = itemsWithPricesQuery.eq('supplier_id', parseInt(supplierId, 10));
    }
    if (category) {
      const validCategories = ['원자재', '부자재', '반제품', '제품', '상품'] as const;
      if (validCategories.includes(category as typeof validCategories[number])) {
        itemsWithPricesQuery = itemsWithPricesQuery.eq('category', category as typeof validCategories[number]);
      }
    }

    const { data: itemsWithPrices, error: itemsPriceError } = await itemsWithPricesQuery;

    if (itemsPriceError) {
      console.error('[Dashboard Charts] Failed to fetch items with prices:', itemsPriceError);
      console.error('[Dashboard Charts] Error details:', {
        message: itemsPriceError.message,
        code: itemsPriceError.code,
        details: itemsPriceError.details,
        hint: itemsPriceError.hint
      });
      // Continue with empty array if error but log it
      // 에러가 발생했지만 빈 배열로 처리
    } else {
      console.log('[Dashboard Charts] Successfully fetched items with prices:', itemsWithPrices?.length || 0);
    }

    const safeItemsWithPrices = itemsWithPrices || [];
    
    // 디버깅: itemsWithPrices 데이터 확인
    console.log('[Dashboard Charts] itemsWithPrices count:', safeItemsWithPrices.length);
    if (safeItemsWithPrices.length > 0) {
      console.log('[Dashboard Charts] Sample item:', {
        item_id: safeItemsWithPrices[0]?.item_id,
        item_code: safeItemsWithPrices[0]?.item_code,
        category: safeItemsWithPrices[0]?.category,
        current_stock: safeItemsWithPrices[0]?.current_stock,
        price: safeItemsWithPrices[0]?.price || 0
      });
    }

    // Calculate top items by stock value (재고 가치 기준 상위 20개)
    const itemsWithValue = safeItemsWithPrices.map((item: any) => {
      const currentStock = item.current_stock || 0;
      const price = item.price || 0; // unit_price 제거
      const totalValue = currentStock * price;
      return {
        ...item,
        totalValue,
        current_stock: currentStock,
        safety_stock: item.safety_stock || 0
      };
    });

    // Sort by total value (descending) and take top 20
    const topItemsByValue = itemsWithValue
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 20);
    
    console.log('[Dashboard Charts] topItemsByValue count:', topItemsByValue.length);
    if (topItemsByValue.length > 0) {
      console.log('[Dashboard Charts] Top item sample:', {
        item_code: topItemsByValue[0]?.item_code,
        totalValue: topItemsByValue[0]?.totalValue
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    // Build transactions query with filters
    let dailyTransactionsQuery = supabaseAdmin
      .from('inventory_transactions')
      .select('transaction_date, transaction_type, quantity, company_id')
      .gte('transaction_date', thirtyDaysAgoISO);
    
    if (supplierId) {
      dailyTransactionsQuery = dailyTransactionsQuery.eq('company_id', parseInt(supplierId, 10));
    }
    if (customerId) {
      dailyTransactionsQuery = dailyTransactionsQuery.eq('company_id', parseInt(customerId, 10));
    }

    const { data: dailyTransactionsData, error: dailyError } = await dailyTransactionsQuery.order('transaction_date', { ascending: false });

    if (dailyError) {
      throw new Error(`Failed to fetch daily transactions: ${dailyError.message}`);
    }

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const twelveMonthsAgoISO = twelveMonthsAgo.toISOString();

    // Build monthly transactions query with filters
    let monthlyTransactionsQuery = supabaseAdmin
      .from('inventory_transactions')
      .select('transaction_date, transaction_type, quantity, item_id, company_id, unit_price, total_amount')
      .gte('transaction_date', twelveMonthsAgoISO);
    
    if (supplierId) {
      monthlyTransactionsQuery = monthlyTransactionsQuery.eq('company_id', parseInt(supplierId, 10));
    }
    if (customerId) {
      monthlyTransactionsQuery = monthlyTransactionsQuery.eq('company_id', parseInt(customerId, 10));
    }

    const { data: monthlyTransactionsData, error: monthlyError } = await monthlyTransactionsQuery.order('transaction_date', { ascending: false });

    if (monthlyError) {
      throw new Error(`Failed to fetch monthly transactions: ${monthlyError.message}`);
    }

    const dailyTransactions = (dailyTransactionsData ?? []) as InventoryTransactionRow[];
    const monthlyTransactions = (monthlyTransactionsData ?? []) as InventoryTransactionRow[];

    // Create stocks array with top items by value
    // TopItemsByValue 컴포넌트가 기대하는 TopItemData 형식으로 변환
    // 데이터가 없으면 빈 배열 반환
    const stocks = (topItemsByValue.length > 0) ? topItemsByValue.map((item: any, index: number) => ({
      // 기본 필수 필드들
      item_id: String(item.item_id || ''),
      item_name: item.item_name ?? item.item_code ?? '미상',
      item_code: item.item_code ?? '',
      category: item.category || '기타',
      // 재고 및 가격 정보
      currentStock: item.current_stock ?? 0,
      unitPrice: item.price || 0,
      totalValue: item.totalValue || 0,
      // 추가 필드들
      safetyStock: item.safety_stock ?? 0,
      // 호환성을 위한 한글 필드 (선택)
      현재고: item.current_stock ?? 0,
      안전재고: item.safety_stock ?? 0,
      code: item.item_code ?? '',
      name: item.item_name ?? item.item_code ?? '미상',
      price: item.price || 0,
      // 컴포넌트에서 사용할 수 있는 추가 필드
      monthlyVolume: 0, // 추후 거래량 계산 가능
      turnoverRate: 0, // 추후 회전율 계산 가능
      lastTransactionDate: null,
      supplier: null,
      stockStatus: 'normal' as 'low' | 'normal' | 'high' | 'overstock',
      rank: index + 1
    })) : [];

    const transactionsByDate = dailyTransactions.reduce<Record<string, DailyAggregate>>((acc, transaction) => {
      const { transaction_type: type, quantity } = transaction;
      if (!type || !isRelevantTransaction(type)) {
        return acc;
      }

      const transactionDate = transaction.transaction_date ?? new Date().toISOString();
      const dateStr = formatKoreanDate(transactionDate);
      const safeQuantity = Number(quantity ?? 0);

      if (!acc[dateStr]) {
        acc[dateStr] = { date: dateStr, 입고: 0, 출고: 0, 조정: 0 };
      }

      applyTransaction(safeQuantity, type, acc[dateStr]);
      return acc;
    }, {});

    const transactions = Object.values(transactionsByDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-14);

    const monthlyByMonth = monthlyTransactions.reduce<Record<string, MonthlyAggregate>>((acc, transaction) => {
      const { transaction_type: type, quantity } = transaction;
      if (!type || !MONTHLY_RELEVANT_TYPES.includes(type)) {
        return acc;
      }

      const transactionDate = transaction.transaction_date ?? new Date().toISOString();
      const monthKey = formatKoreanMonth(transactionDate);
      const safeQuantity = Number(quantity ?? 0);

      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthKey, 입고: 0, 출고: 0, 조정: 0 };
      }

      applyTransaction(safeQuantity, type, acc[monthKey]);
      return acc;
    }, {});

    const monthPattern = /(\d{4})년\s+(\d{1,2})월/;

    // Transform monthlyTrends to include all required fields
    const monthlyTrendsRaw = Object.values(monthlyByMonth)
      .sort((a, b) => {
        const aMatch = monthPattern.exec(a.month);
        const bMatch = monthPattern.exec(b.month);
        if (!aMatch || !bMatch) {
          return 0;
        }

        const aYear = Number(aMatch[1]);
        const aMonth = Number(aMatch[2]);
        const bYear = Number(bMatch[1]);
        const bMonth = Number(bMatch[2]);

        if (aYear !== bYear) {
          return aYear - bYear;
        }

        return aMonth - bMonth;
      })
      .slice(-12);

    // Fetch stock items with prices for calculating total stock value and quantity
    const { data: allStockItems } = await supabaseAdmin
      .from('items')
      .select('item_id, current_stock, price')
      .eq('is_active', true);

    // Calculate 월별 총재고량, 재고가치, 회전율
    const monthlyTrends = monthlyTrendsRaw.map((trend, index) => {
      const monthMatch = monthPattern.exec(trend.month);
      const year = monthMatch ? Number(monthMatch[1]) : new Date().getFullYear();
      const month = monthMatch ? Number(monthMatch[2]) : new Date().getMonth() + 1;
      const date = new Date(year, month - 1, 1);

      // 총재고량 계산 (현재는 간단히 입고-출고 누적)
      const previousTotal = index > 0 
        ? monthlyTrendsRaw.slice(0, index).reduce((sum, t) => sum + t.입고 - t.출고, 0)
        : 0;
      const 총재고량 = previousTotal + trend.입고 - trend.출고;

      // 재고가치 계산 (현재고 × 평균 단가)
      const totalStockValue = (allStockItems || []).reduce((sum, item) => {
        const stock = item.current_stock || 0;
        const price = item.price || 0;
        return sum + (stock * price);
      }, 0);

      // 회전율 계산 (출고량 / 평균재고량)
      const avgStock = 총재고량 > 0 ? 총재고량 : 1;
      const 회전율 = trend.출고 / avgStock;

      return {
        month: trend.month,
        date: date,
        총재고량: Math.max(0, 총재고량),
        입고: trend.입고,
        출고: trend.출고,
        생산: trend.조정, // 조정을 생산으로 매핑
        재고가치: totalStockValue,
        회전율: isNaN(회전율) ? 0 : 회전율
      };
    });

    // Calculate category stocks - use itemsWithPrices that we already fetched
    const categoryMap = new Map<string, {
      현재고: number;
      최소재고: number;
      안전재고: number;
      최대재고: number;
      품목수: number;
      재고가치: number;
      부족품목수: number;
      과재고품목수: number;
      거래량: number[];
    }>();

    // Use itemsWithPrices for category aggregation
    console.log('[Dashboard Charts] Processing category stocks, items count:', safeItemsWithPrices.length);
    
    safeItemsWithPrices.forEach((item: any) => {
      // 카테고리가 NULL이거나 빈 값이면 '기타'로 처리
      const category = (item.category && item.category.trim()) ? item.category.trim() : '기타';
      const existing = categoryMap.get(category) || {
        현재고: 0,
        최소재고: 0,
        안전재고: 0,
        최대재고: 0,
        품목수: 0,
        재고가치: 0,
        부족품목수: 0,
        과재고품목수: 0,
        거래량: []
      };

      const stock = item.current_stock || 0;
      const price = item.price || 0;
      const safety = item.safety_stock || 0;
      // min_stock_level, max_stock_level 컬럼이 없으므로 0으로 처리
      const min = 0;
      const max = 0;

      existing.현재고 += stock;
      existing.최소재고 += min;
      existing.안전재고 += safety;
      existing.최대재고 += max;
      existing.품목수 += 1;
      existing.재고가치 += stock * price;
      if (safety > 0 && stock < safety) existing.부족품목수 += 1;
      if (max > 0 && stock > max) {
        existing.과재고품목수 += 1;
      } else if (safety > 0 && stock > safety * 2) {
        existing.과재고품목수 += 1;
      }

      categoryMap.set(category, existing);
    });

    // Sort categories by 재고가치 (descending) - include all categories including '기타'
    console.log('[Dashboard Charts] categoryMap size:', categoryMap.size);
    if (categoryMap.size > 0) {
      console.log('[Dashboard Charts] Categories:', Array.from(categoryMap.keys()));
      // 카테고리 맵의 첫 번째 항목 확인
      const firstEntry = Array.from(categoryMap.entries())[0];
      if (firstEntry) {
        console.log('[Dashboard Charts] First category data:', {
          category: firstEntry[0],
          품목수: firstEntry[1].품목수,
          재고가치: firstEntry[1].재고가치
        });
      }
    }
    
    // 카테고리 필터링 제거 - 모든 카테고리 포함 (기타 포함)
    const categoryStocks = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category: category || '기타', // 카테고리가 없으면 '기타'
        현재고: data.현재고,
        최소재고: data.최소재고,
        안전재고: data.안전재고,
        최대재고: data.최대재고,
        품목수: data.품목수,
        재고가치: data.재고가치,
        회전율: data.안전재고 > 0 ? data.현재고 / data.안전재고 : 0,
        부족품목수: data.부족품목수,
        과재고품목수: data.과재고품목수
      }))
      .filter((item) => item.category && item.category.trim() !== '') // 빈 카테고리만 제외
      .sort((a, b) => b.재고가치 - a.재고가치); // 재고 가치 기준 내림차순 정렬
    
    console.log('[Dashboard Charts] Final categoryStocks count:', categoryStocks.length);

    // Calculate transaction distribution
    const transactionTypes = monthlyTransactions.reduce<Record<string, {
      count: number;
      volume: number;
      value: number;
    }>>((acc, tx) => {
      const type = tx.transaction_type || '기타';
      if (!acc[type]) {
        acc[type] = { count: 0, volume: 0, value: 0 };
      }
      const qty = Number(tx.quantity || 0);
      // total_amount가 있으면 사용, 없으면 unit_price * quantity로 계산
      const txValue = (tx as any).total_amount || ((tx as any).unit_price || 0) * qty;
      acc[type].count += 1;
      acc[type].volume += qty;
      acc[type].value += Math.abs(txValue); // 절댓값 사용 (입고/출고 모두 양수로 합산)
      return acc;
    }, {});

    const totalTransactions = Object.values(transactionTypes).reduce((sum, t) => sum + t.count, 0);
    const totalVolume = Object.values(transactionTypes).reduce((sum, t) => sum + t.volume, 0);
    const totalValue = Object.values(transactionTypes).reduce((sum, t) => sum + t.value, 0);

    const transactionDistribution = Object.entries(transactionTypes).map(([type, data]) => {
      // Get unique companies and items for this transaction type
      const typeTransactions = monthlyTransactions.filter(tx => tx.transaction_type === type);
      const uniqueCompanies = new Set();
      const uniqueItems = new Set();
      
      typeTransactions.forEach(tx => {
        if ((tx as any).company_id) uniqueCompanies.add((tx as any).company_id);
        if (tx.item_id) uniqueItems.add(tx.item_id);
      });

      return {
        type,
        count: data.count,
        volume: data.volume,
        value: data.value,
        percentage: totalTransactions > 0 ? (data.count / totalTransactions) * 100 : 0,
        items: uniqueItems.size,
        avgPerTransaction: data.count > 0 ? data.volume / data.count : 0,
        companies: uniqueCompanies.size
      };
    });

    const chartData = {
      stocks,
      transactions,
      monthlyTrends,
      categoryStocks,
      transactionDistribution
    };
    
    console.log('[Dashboard Charts] Final chart data:', {
      stocksCount: stocks.length,
      categoryStocksCount: categoryStocks.length,
      transactionsCount: transactions.length,
      monthlyTrendsCount: monthlyTrends.length,
      transactionDistributionCount: transactionDistribution.length
    });

    // 디버깅 정보 포함 (개발 환경에서만)
    const debugInfo = process.env.NODE_ENV === 'development' ? {
      itemsWithPricesCount: safeItemsWithPrices.length,
      topItemsByValueCount: topItemsByValue.length,
      categoryMapSize: categoryMap.size,
      hasItemsError: !!itemsPriceError,
      itemsError: itemsPriceError ? {
        message: itemsPriceError.message,
        code: itemsPriceError.code
      } : null
    } : undefined;

    return NextResponse.json({
      success: true,
      data: chartData,
      ...(debugInfo && { debug: debugInfo })
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Dashboard charts API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch chart data',
      },
      { status: 500 }
    );
  }
}
