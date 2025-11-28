/**
 * Real-Time Dashboard Component
 * Main dashboard container with auto-refresh functionality
 */

import React, { Suspense, lazy, useState } from 'react';
import { RefreshControls } from './RefreshControls';
import { KPICards } from './KPICards';
import { QuickActions } from './QuickActions';
import { InventoryClassificationWidget } from './InventoryClassificationWidget';
import { LOTDashboardWidget } from './LOTDashboardWidget';
import { useDashboardData, type RefreshInterval } from '../../hooks/useDashboardData';
import { useTheme } from '../../contexts/ThemeContext';
import { formatKoreanNumber } from '../../utils/chartUtils';

// Lazy load chart components for better performance
const MonthlyInventoryTrends = lazy(() => import('../charts/MonthlyInventoryTrends').then(m => ({ default: m.MonthlyInventoryTrends })));
const StockLevelsByCategory = lazy(() => import('../charts/StockLevelsByCategory').then(m => ({ default: m.StockLevelsByCategory })));
const TransactionDistribution = lazy(() => import('../charts/TransactionDistribution').then(m => ({ default: m.TransactionDistribution })));
const TopItemsByValue = lazy(() => import('../charts/TopItemsByValue').then(m => ({ default: m.TopItemsByValue })));

interface RealTimeDashboardProps {
  className?: string;
  initialRefreshInterval?: RefreshInterval;
  autoStart?: boolean;
}

export const RealTimeDashboard: React.FC<RealTimeDashboardProps> = ({
  className = '',
  initialRefreshInterval = '수동',
  autoStart = false
}) => {
  const { isDark } = useTheme();
  const [supplierId, setSupplierId] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [suppliers, setSuppliers] = useState<Array<{company_id: number; company_name: string}>>([]);
  const [customers, setCustomers] = useState<Array<{company_id: number; company_name: string}>>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const {
    data,
    loading,
    error,
    lastUpdated,
    refreshInterval,
    isAutoRefreshEnabled,
    retryCount,
    setRefreshInterval,
    setIsAutoRefreshEnabled,
    refresh
  } = useDashboardData(initialRefreshInterval, autoStart, { supplierId, customerId, category });

  // 거래처 목록 로드
  React.useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const [suppliersRes, customersRes] = await Promise.all([
          fetch('/api/companies?type=공급사&limit=1000'),
          fetch('/api/companies?type=고객사&limit=1000')
        ]);
        const suppliersData = await suppliersRes.json();
        const customersData = await customersRes.json();
        if (suppliersData.success) {
          setSuppliers(suppliersData.data?.companies || []);
        }
        if (customersData.success) {
          setCustomers(customersData.data?.companies || []);
        }
      } catch (err) {
        console.error('Failed to fetch companies:', err);
      }
    };
    fetchCompanies();
  }, []);

  // 필터 변경 시 데이터 새로고침
  React.useEffect(() => {
    // 초기 로드가 완료된 후에만 필터 변경 시 새로고침
    if (data && (supplierId || customerId || category)) {
      refresh();
    }
  }, [supplierId, customerId, category, data, refresh]);

  // 카테고리 목록 로드
  React.useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/items?limit=10000');
        const data = await res.json();
        if (data.success && data.data?.items) {
          const uniqueCategories = [...new Set(data.data.items.map((item: any) => item.category).filter(Boolean))];
          setCategories(uniqueCategories.sort());
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };
    fetchCategories();
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Refresh Controls */}
      <RefreshControls
        refreshInterval={refreshInterval}
        onRefreshIntervalChange={setRefreshInterval}
        isAutoRefreshEnabled={isAutoRefreshEnabled}
        onAutoRefreshToggle={setIsAutoRefreshEnabled}
        onManualRefresh={refresh}
        loading={loading}
        lastUpdated={lastUpdated}
        retryCount={retryCount}
      />

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
        <div className="hidden md:flex flex-nowrap gap-2 items-end overflow-x-auto pb-1">
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="min-w-[150px] px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
          >
            <option value="">납품처</option>
            {suppliers.map((supplier) => (
              <option key={supplier.company_id} value={supplier.company_id}>
                {supplier.company_name}
              </option>
            ))}
          </select>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="min-w-[150px] px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
          >
            <option value="">고객사</option>
            {customers.map((customer) => (
              <option key={customer.company_id} value={customer.company_id}>
                {customer.company_name}
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-w-[150px] px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
          >
            <option value="">카테고리</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Global Error Message */}
      {error && !data && (
        <div className="bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-gray-800 dark:bg-gray-300 rounded-full"></div>
            <span className="text-gray-800 dark:text-gray-300 font-medium">
              대시보드 데이터 로드 실패
            </span>
          </div>
          <p className="text-gray-700 dark:text-gray-400 text-sm mt-1">
            {error}
          </p>
          <button
            onClick={refresh}
            disabled={loading}
            className="mt-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-300 text-sm rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? '재시도 중...' : '다시 시도'}
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <KPICards
        stats={data?.stats || null}
        loading={loading}
        error={error}
      />

      {/* Phase 3 - Inventory Classification Widget */}
      <InventoryClassificationWidget onRefresh={refresh} />

      {/* Phase 3 - LOT Tracking Dashboard Widget */}
      <LOTDashboardWidget onRefresh={refresh} limit={10} />

      {/* Monthly Trends - Responsive Full Width */}
      <Suspense fallback={<div className="min-h-96 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg border" />}>
        <MonthlyInventoryTrends
          onRefresh={refresh}
          data={data?.charts.monthlyTrends || null}
          loading={loading}
          error={error}
          isDark={isDark}
        />
      </Suspense>

      {/* Main Analytics Grid - Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stock Levels by Category */}
        <div className="min-h-72">
          <Suspense fallback={<div className="h-full animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg border" />}>
            <StockLevelsByCategory
              className="h-full"
              onRefresh={refresh}
              data={data?.charts.categoryStocks || null}
              loading={loading}
              error={error}
              isDark={isDark}
            />
          </Suspense>
        </div>

        {/* Transaction Distribution */}
        <div className="min-h-72">
          <Suspense fallback={<div className="h-full animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg border" />}>
            <TransactionDistribution
              className="h-full"
              onRefresh={refresh}
              data={(data?.charts as any)?.transactionDistribution || data?.charts.transactions || null}
              loading={loading}
              error={error}
              isDark={isDark}
            />
          </Suspense>
        </div>

        {/* Top Items by Value */}
        <div className="min-h-72 lg:col-span-2">
          <Suspense fallback={<div className="h-full animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg border" />}>
            <TopItemsByValue
              className="h-full"
              onRefresh={refresh}
              data={data?.charts.stocks || null}
              loading={loading}
              error={error}
              isDark={isDark}
            />
          </Suspense>
        </div>
      </div>

      {/* Analytics Panel */}
      <AnalyticsPanel
        data={data}
        loading={loading}
        error={error}
        isDark={isDark}
      />

      {/* Quick Actions Panel */}
      <QuickActions />
    </div>
  );
};

// Additional Analytics Panel Component
interface AnalyticsPanelProps {
  data: any;
  loading: boolean;
  error: string | null;
  isDark: boolean;
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  data,
  loading,
  error,
  isDark
}) => {
  if (error || !data) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 min-w-fit">
          분석 요약
        </h3>
        <div className="flex items-center justify-center h-32 text-gray-500">
          <p className="text-sm">분석 데이터를 불러올 수 없습니다</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 min-w-fit">
          분석 요약
        </h3>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Calculate analytics metrics using correct data sources
  const analytics = React.useMemo(() => {
    if (!data?.charts || !data?.alerts) return null;

    const categoryStocks = data.charts.categoryStocks || [];
    const lowStockItems = data.alerts.lowStockItems || [];
    const monthlyTrends = data.charts.monthlyTrends || [];
    const stocks = data.charts.stocks || [];
    const transactionDist = data.charts.transactions || [];

    // Calculate total categories
    const totalCategories = categoryStocks.length;

    // Calculate critical alerts
    const totalLowStock = lowStockItems.length;
    const criticalAlerts = lowStockItems.filter((item: any) => item.priority === 'critical').length;

    // Calculate average days until stockout
    const avgDaysUntilStockout = lowStockItems.length > 0
      ? lowStockItems.reduce((sum: number, item: any) => sum + (item.daysUntilStockout || 0), 0) / lowStockItems.length
      : 0;

    // Determine recent trend
    let recentTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (monthlyTrends.length >= 2) {
      const latest = monthlyTrends[monthlyTrends.length - 1];
      const previous = monthlyTrends[monthlyTrends.length - 2];
      recentTrend = latest.총재고량 > previous.총재고량 ? 'increasing' : 'decreasing';
    }

    // Calculate total stock value
    const totalStockValue = stocks.reduce((sum: number, item: any) => sum + (item.totalValue || 0), 0);

    // Calculate stock value change (mock calculation - would need historical data)
    const stockValueChange = monthlyTrends.length >= 2 
      ? (() => {
          const latest = monthlyTrends[monthlyTrends.length - 1]?.총재고량 || 0;
          const previous = monthlyTrends[monthlyTrends.length - 2]?.총재고량 || 0;
          if (previous === 0) return 0;
          const change = ((latest - previous) / previous) * 100;
          return isNaN(change) ? 0 : change;
        })()
      : 0;

    // Calculate average turnover rate
    const avgTurnoverRate = categoryStocks.length > 0
      ? categoryStocks.reduce((sum: number, cat: any) => sum + (cat.회전율 || 0), 0) / categoryStocks.length
      : 0;

    // Calculate healthy stock rate
    const totalItems = data.stats?.totalItems || 1;
    const healthyStockRate = ((totalItems - totalLowStock) / totalItems) * 100;

    // Calculate overstock count
    const overstockCount = categoryStocks.reduce((sum: number, cat: any) => 
      sum + (cat.과재고품목수 || 0), 0);

    // Calculate total transactions
    const totalTransactions = transactionDist.reduce((sum: number, t: any) => 
      sum + (t.count || 0), 0);

    // Calculate urgent items (7 days or less)
    const urgentItems = lowStockItems.filter((item: any) => 
      (item.daysUntilStockout || 0) <= 7).length;

    // Calculate auto reorder count
    const autoReorderCount = lowStockItems.filter((item: any) => 
      item.autoReorderEnabled).length;

    return {
      totalCategories,
      totalLowStock,
      criticalAlerts,
      avgDaysUntilStockout,
      recentTrend,
      totalStockValue,
      stockValueChange,
      avgTurnoverRate,
      healthyStockRate,
      overstockCount,
      totalTransactions,
      urgentItems,
      autoReorderCount
    };
  }, [data]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 min-w-fit">
        분석 요약
      </h3>

      {analytics && (
        <div className="space-y-2.5">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400">전체 카테고리</span>
              <span className="text-base font-semibold text-gray-900 dark:text-white">
                {analytics.totalCategories}개
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400">긴급 알림</span>
              <span className={`text-base font-semibold ${
                analytics.criticalAlerts > 0 
                  ? 'text-gray-600 dark:text-gray-400' 
                  : 'text-gray-900 dark:text-white'
              }`}>
                {analytics.criticalAlerts}개
              </span>
            </div>
          </div>

          {/* Stock Value */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">총 재고 가치</span>
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                ₩{formatKoreanNumber(analytics.totalStockValue)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">전월 대비</span>
              <span className={`text-sm font-medium ${
                analytics.stockValueChange >= 0 
                  ? 'text-gray-600 dark:text-gray-400' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {isNaN(analytics.stockValueChange) 
                  ? '0.0' 
                  : `${analytics.stockValueChange >= 0 ? '+' : ''}${analytics.stockValueChange.toFixed(1)}`}%
              </span>
            </div>
          </div>

          {/* Efficiency & Activity Grid */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">평균 회전율</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {analytics.avgTurnoverRate.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">정상 재고율</span>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {analytics.healthyStockRate.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">총 거래</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatKoreanNumber(analytics.totalTransactions)}건
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">7일 내 소진</span>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {analytics.urgentItems}개
                </span>
              </div>
            </div>
          </div>

          {/* Trend Insights */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {analytics.recentTrend === 'increasing' && (
                <div className="flex items-center space-x-1.5 text-gray-700 dark:text-gray-300">
                  <div className="w-1.5 h-1.5 bg-gray-600 dark:bg-gray-400 rounded-full"></div>
                  <span className="text-xs">재고 증가</span>
                </div>
              )}
              {analytics.recentTrend === 'decreasing' && (
                <div className="flex items-center space-x-1.5 text-gray-700 dark:text-gray-300">
                  <div className="w-1.5 h-1.5 bg-gray-600 dark:bg-gray-400 rounded-full"></div>
                  <span className="text-xs">재고 감소</span>
                </div>
              )}
              {analytics.criticalAlerts > 0 && (
                <div className="flex items-center space-x-1.5 text-gray-600 dark:text-gray-400">
                  <div className="w-1.5 h-1.5 bg-gray-600 dark:bg-gray-400 rounded-full"></div>
                  <span className="text-xs">긴급 재주문</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
