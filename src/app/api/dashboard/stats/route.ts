/**
 * Dashboard Stats API Route
 * Provides KPI statistics and metrics
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createValidatedRoute } from '@/lib/validationMiddleware';
import { calculateKPIs } from '@/utils/chartUtils';

export const dynamic = 'force-dynamic';


export const GET = createValidatedRoute(
  async (request: Request) => {
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const threeMonthsAgoISO = threeMonthsAgo.toISOString();

      const [itemsResult, transactionsResult, companiesResult] = (await Promise.all([
        supabaseAdmin
          .from('items')
          .select('item_id, item_code, item_name, current_stock, safety_stock, price, is_active, created_at')
          .eq('is_active', true), // 활성 품목만 조회
        supabaseAdmin
          .from('inventory_transactions')
          .select('transaction_id, transaction_type, quantity, transaction_date, item_id, total_amount')
          .gte('transaction_date', threeMonthsAgoISO)
          .order('transaction_date', { ascending: false }),
        supabaseAdmin
          .from('companies')
          .select('company_id, company_name, company_type, is_active, created_at')
          .eq('is_active', true), // 활성 회사만 조회
      ])) as any;

      if (itemsResult.error) throw itemsResult.error;
      if (transactionsResult.error) throw transactionsResult.error;
      if (companiesResult.error) throw companiesResult.error;

      const items = itemsResult.data ?? [];
      const transactions = transactionsResult.data ?? [];
      const companies = companiesResult.data ?? [];

      const kpis = calculateKPIs({
        items,
        transactions,
        companies,
      });

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      const currentMonthTransactions = transactions.filter((transaction: any) => {
        const date = new Date(transaction.transaction_date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });

      const previousMonthTransactions = transactions.filter((transaction: any) => {
        const date = new Date(transaction.transaction_date);
        return date.getMonth() === previousMonth && date.getFullYear() === previousYear;
      });

      const currentVolume = currentMonthTransactions.reduce((sum: any, t: any) => sum + (t.quantity ?? 0), 0);
      const previousVolume = previousMonthTransactions.reduce((sum: any, t: any) => sum + (t.quantity ?? 0), 0);
      const volumeChange = previousVolume > 0 ? ((currentVolume - previousVolume) / previousVolume) * 100 : 0;

      // Calculate previous month end date (last day of previous month)
      const previousMonthEndDate = new Date(previousYear, previousMonth + 1, 0);
      previousMonthEndDate.setHours(23, 59, 59, 999);

      // Calculate item trend: current active items vs previous month end active items
      // 전월 말까지 생성된 품목 수 (활성 여부 무관) = 전월 말 시점에 존재했던 품목 수
      // 주의: is_active 변경 이력이 없어서 정확한 전월 말 활성 상태는 알 수 없음
      // 따라서 전월 말까지 생성된 품목 수를 기준으로 계산
      const currentActiveItems = items.filter((item: any) => item.is_active).length;
      const previousMonthActiveItems = items.filter((item: any) => {
        // 전월 말까지 생성된 품목 (활성 여부 무관)
        if (!item.created_at) return false;
        const created = new Date(item.created_at);
        return created.getTime() <= previousMonthEndDate.getTime();
      }).length;

      const itemTrend = previousMonthActiveItems > 0
        ? ((currentActiveItems - previousMonthActiveItems) / previousMonthActiveItems) * 100
        : 0;

      // Calculate company trend: current active companies vs previous month end active companies
      // 전월 말까지 생성된 거래처 수 (활성 여부 무관) = 전월 말 시점에 존재했던 거래처 수
      // 주의: is_active 변경 이력이 없어서 정확한 전월 말 활성 상태는 알 수 없음
      // 따라서 전월 말까지 생성된 거래처 수를 기준으로 계산
      const currentActiveCompanies = companies.filter((c: any) => c.is_active).length;
      const previousMonthActiveCompanies = companies.filter((c: any) => {
        // 전월 말까지 생성된 거래처 (활성 여부 무관)
        if (!c.created_at) return false;
        const created = new Date(c.created_at);
        return created.getTime() <= previousMonthEndDate.getTime();
      }).length;

      const companyTrend = previousMonthActiveCompanies > 0
        ? ((currentActiveCompanies - previousMonthActiveCompanies) / previousMonthActiveCompanies) * 100
        : 0;

      // Calculate low stock trend: current low stock vs previous month end low stock
      // 전월 말 시점의 재고 수준을 inventory_transactions로 역산하여 계산
      const currentLowStock = kpis.lowStockItems;

      // 전월 말 시점의 재고 수준 계산을 위한 함수
      const calculateStockAtDate = (itemId: number, targetDate: Date): number => {
        try {
          const item = items.find((i: any) => i.item_id === itemId);
          if (!item) return 0;

          // 현재 재고에서 시작
          let stock = parseFloat(String(item.current_stock)) || 0;

          // 현재월 및 전월 이후의 거래를 역순으로 적용하여 전월 말 재고 계산
          const relevantTransactions = transactions.filter((tx: any) => {
            if (!tx || !tx.transaction_date || tx.item_id !== itemId) return false;
            try {
              const txDate = new Date(tx.transaction_date);
              if (isNaN(txDate.getTime())) return false;
              return txDate.getTime() > targetDate.getTime();
            } catch {
              return false;
            }
          });

          // 역순으로 거래 적용 (현재 재고에서 거래를 역산)
          relevantTransactions.forEach((tx: any) => {
            try {
              const quantity = parseFloat(String(tx.quantity)) || 0;
              if (isNaN(quantity)) return;
              
              const txType = String(tx.transaction_type || '');

              // 거래를 역산: 입고는 빼고, 출고는 더함
              if (txType === '입고' || txType === '생산입고') {
                stock -= quantity;
              } else if (txType === '출고' || txType === '생산출고' || txType === '조정') {
                stock += quantity;
              }
            } catch (err) {
              // 개별 거래 처리 실패 시 무시하고 계속 진행
              console.warn('Failed to process transaction for stock calculation:', err);
            }
          });

          return Math.max(0, stock); // 재고는 음수가 될 수 없음
        } catch (err) {
          console.error('Error calculating stock at date:', err);
          return 0; // 에러 발생 시 0 반환
        }
      };

      // 전월 말 시점의 재고 부족 품목 수 계산
      let previousMonthLowStock = 0;
      try {
        previousMonthLowStock = items.filter((item: any) => {
          if (!item || !item.is_active || !item.item_id) return false;

          // 전월 말 시점의 재고 수준 계산
          const stockAtPreviousMonthEnd = calculateStockAtDate(item.item_id, previousMonthEndDate);
          const minimum = item.safety_stock || 0;

          return stockAtPreviousMonthEnd < minimum;
        }).length;
      } catch (err) {
        console.error('Error calculating previous month low stock:', err);
        previousMonthLowStock = 0; // 에러 발생 시 0으로 설정
      }

      const lowStockTrend = previousMonthLowStock > 0
        ? ((currentLowStock - previousMonthLowStock) / previousMonthLowStock) * 100
        : 0;

      // Calculate total stock value (총 재고 가치)
      const totalStockValue = items.reduce((sum: number, item: any) => {
        const stock = parseFloat(String(item.current_stock)) || 0;
        const price = parseFloat(String(item.price)) || 0;
        return sum + (stock * price);
      }, 0);

      // Calculate previous month stock value (전월 말 재고 가치)
      let previousMonthStockValue = 0;
      try {
        previousMonthStockValue = items.reduce((sum: number, item: any) => {
          if (!item.is_active) return sum;
          const stockAtPreviousMonthEnd = calculateStockAtDate(item.item_id, previousMonthEndDate);
          const price = parseFloat(String(item.price)) || 0;
          return sum + (stockAtPreviousMonthEnd * price);
        }, 0);
      } catch (err) {
        console.error('Error calculating previous month stock value:', err);
        previousMonthStockValue = 0;
      }

      const stockValueTrend = previousMonthStockValue > 0
        ? ((totalStockValue - previousMonthStockValue) / previousMonthStockValue) * 100
        : 0;

      // Calculate monthly transaction amount (월 거래 금액)
      const currentMonthAmount = currentMonthTransactions.reduce((sum: number, t: any) => {
        return sum + (parseFloat(String(t.total_amount)) || 0);
      }, 0);
      const previousMonthAmount = previousMonthTransactions.reduce((sum: number, t: any) => {
        return sum + (parseFloat(String(t.total_amount)) || 0);
      }, 0);
      const transactionAmountTrend = previousMonthAmount > 0
        ? ((currentMonthAmount - previousMonthAmount) / previousMonthAmount) * 100
        : 0;

      // Calculate new registrations (신규 등록 수)
      const currentMonthNewItems = items.filter((item: any) => {
        if (!item.created_at) return false;
        const created = new Date(item.created_at);
        return created.getMonth() === currentMonth && created.getFullYear() === currentYear;
      }).length;

      const previousMonthNewItems = items.filter((item: any) => {
        if (!item.created_at) return false;
        const created = new Date(item.created_at);
        return created.getMonth() === previousMonth && created.getFullYear() === previousYear;
      }).length;

      const currentMonthNewCompanies = companies.filter((c: any) => {
        if (!c.created_at) return false;
        const created = new Date(c.created_at);
        return created.getMonth() === currentMonth && created.getFullYear() === currentYear;
      }).length;

      const previousMonthNewCompanies = companies.filter((c: any) => {
        if (!c.created_at) return false;
        const created = new Date(c.created_at);
        return created.getMonth() === previousMonth && created.getFullYear() === previousYear;
      }).length;

      const totalNewRegistrations = currentMonthNewItems + currentMonthNewCompanies;
      const previousTotalNewRegistrations = previousMonthNewItems + previousMonthNewCompanies;
      const newRegistrationsTrend = previousTotalNewRegistrations > 0
        ? ((totalNewRegistrations - previousTotalNewRegistrations) / previousTotalNewRegistrations) * 100
        : 0;

      const stats = {
        totalItems: kpis.totalItems,
        activeCompanies: kpis.activeCompanies,
        monthlyVolume: kpis.monthlyVolume,
        lowStockItems: kpis.lowStockItems,
        volumeChange,
        // New KPIs
        totalStockValue,
        monthlyTransactionAmount: currentMonthAmount,
        newRegistrations: {
          items: currentMonthNewItems,
          companies: currentMonthNewCompanies,
          total: totalNewRegistrations,
        },
        trends: {
          items: itemTrend,
          companies: companyTrend,
          volume: volumeChange,
          lowStock: lowStockTrend,
          stockValue: stockValueTrend,
          transactionAmount: transactionAmountTrend,
          newRegistrations: newRegistrationsTrend,
        },
      };

      return NextResponse.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Dashboard stats API error:', error);
      let errorMessage = 'Unknown error';
      let errorStack: string | undefined;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = String(error);
        }
      }
      
      console.error('Error details:', { errorMessage, errorStack });
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch dashboard statistics',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        },
        { status: 500 }
      );
    }
  },
  {
    resource: 'dashboard',
    action: 'read',
    requireAuth: false,
  }
);
