/**
 * Dashboard data hooks for real-time data fetching
 * Handles auto-refresh, error handling, and state management
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Types for dashboard data
export interface DashboardStats {
  totalItems: number;
  activeCompanies: number;
  monthlyVolume: number;
  lowStockItems: number;
  volumeChange: number;
  // New KPIs
  totalStockValue: number;
  monthlyTransactionAmount: number;
  newRegistrations: {
    items: number;
    companies: number;
    total: number;
  };
  trends: {
    items: number;
    companies: number;
    volume: number;
    lowStock: number;
    stockValue: number;
    transactionAmount: number;
    newRegistrations: number;
  };
}

// Chart-specific data types (matching component interfaces)
export interface MonthlyTrendsData {
  month: string;
  date: Date;
  총재고량: number;
  입고: number;
  출고: number;
  생산: number;
  재고가치: number;
  회전율: number;
}

export interface CategoryStockData {
  category: string;
  현재고: number;
  최소재고: number;
  안전재고: number;
  최대재고: number;
  품목수: number;
  재고가치: number;
  회전율: number;
  부족품목수: number;
  과재고품목수: number;
  재고비율?: number;
}

export interface TransactionDistributionData {
  type: string;
  count: number;
  volume: number;
  value: number;
  percentage: number;
  items: number;
  avgPerTransaction: number;
  companies: number;
}

export interface TopItemData {
  item_id: string;
  item_name: string;
  item_code: string;
  category: string;
  currentStock: number;
  minimumStock?: number;
  safetyStock?: number;
  unitPrice: number;
  totalValue: number;
  monthlyVolume: number;
  turnoverRate: number;
  lastTransactionDate: Date | null;
  supplier: string | null;
  stockStatus: 'low' | 'normal' | 'high' | 'overstock';
  rank: number;
}

export interface ChartData {
  stocks: TopItemData[];
  transactions: TransactionDistributionData[];
  monthlyTrends: MonthlyTrendsData[];
  categoryStocks: CategoryStockData[];
}

export interface LowStockAlertData {
  item_id: string;
  item_name: string;
  item_code: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  safetyStock: number;
  averageConsumption: number;
  stockoutRisk: number;
  daysUntilStockout: number;
  lastRestockDate: Date;
  supplier: string;
  leadTime: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  alertCreatedAt: Date;
  autoReorderEnabled: boolean;
  estimatedCost: number;
}

export interface AlertData {
  lowStockItems: LowStockAlertData[];
  recentTransactions: Array<{
    transaction_id: number;
    transaction_type: string;
    item_name: string;
    quantity: number;
    transaction_date: string;
    status: string;
  }>;
}

export interface DashboardData {
  stats: DashboardStats;
  charts: ChartData;
  alerts: AlertData;
  lastUpdated: Date;
}

// Refresh intervals in milliseconds
export const REFRESH_INTERVALS = {
  '30초': 30000,
  '1분': 60000,
  '5분': 300000,
  '수동': 0
} as const;

export type RefreshInterval = keyof typeof REFRESH_INTERVALS;

// Custom hook for dashboard data management
export const useDashboardData = (
  initialInterval: RefreshInterval = '1분',
  autoStart: boolean = true,
  filters: { supplierId?: string; customerId?: string; category?: string } = {}
) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(initialInterval);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(autoStart);
  const [retryCount, setRetryCount] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async (showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      // Build query parameters from filters
      const queryParams = new URLSearchParams();
      if (filters.supplierId) queryParams.set('supplier_id', filters.supplierId);
      if (filters.customerId) queryParams.set('customer_id', filters.customerId);
      if (filters.category) queryParams.set('category', filters.category);
      const queryString = queryParams.toString();
      const suffix = queryString ? `?${queryString}` : '';

      // Fetch data from multiple endpoints for complete dashboard (타임아웃 및 재시도 포함)
      const { safeFetchAllJson } = await import('@/lib/fetch-utils');
      
      const [statsResult, chartsResult, alertsResult] = await safeFetchAllJson([
        {
          url: `/api/dashboard/stats${suffix}`,
          options: {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          }
        },
        {
          url: `/api/dashboard/charts${suffix}`,
          options: {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          }
        },
        {
          url: `/api/dashboard/alerts${suffix}`,
          options: {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          }
        }
      ], {
        timeout: 15000, // 15초 타임아웃
        maxRetries: 2,  // 최대 2회 재시도
        retryDelay: 1000 // 1초 간격
      });

      // Validate responses
      if (!statsResult.success) {
        throw new Error(statsResult.error || 'Failed to fetch stats');
      }
      if (!chartsResult.success) {
        throw new Error(chartsResult.error || 'Failed to fetch charts');
      }
      if (!alertsResult.success) {
        throw new Error(alertsResult.error || 'Failed to fetch alerts');
      }

      const newData: DashboardData = {
        stats: statsResult.data,
        charts: chartsResult.data,
        alerts: alertsResult.data,
        lastUpdated: new Date()
      };

      setData(newData);
      setLastUpdated(new Date());
      setRetryCount(0);

    } catch (err: any) {
      console.error('Dashboard data fetch error:', err);
      setError(err.message || 'Failed to fetch dashboard data');
      setRetryCount(prev => prev + 1);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  // Auto-refresh with continuous intervals
  useEffect(() => {
    if (!isAutoRefreshEnabled || refreshInterval === '수동') {
      return;
    }

    const interval = REFRESH_INTERVALS[refreshInterval];
    if (interval <= 0) return;

    // Use setInterval for continuous refreshing
    intervalRef.current = setInterval(() => {
      fetchDashboardData(false); // Silent refresh for auto-updates
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchDashboardData, refreshInterval, isAutoRefreshEnabled]);

  // Initial data fetch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchDashboardData(true);
    }

    return () => {
      // Cleanup on unmount
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [fetchDashboardData, filters]);

  // Pause auto-refresh when tab is not visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsAutoRefreshEnabled(false);
      } else {
        setIsAutoRefreshEnabled(true);
        // Refresh data when tab becomes visible again
        fetchDashboardData(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchDashboardData]);

  return {
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
  };
};

// Hook for real-time stats updates
export const useRealTimeStats = (refreshInterval: RefreshInterval = '1분') => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/dashboard/stats', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch stats');
      }

      setStats(result.data);
    } catch (err: any) {
      console.error('Stats fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    if (refreshInterval === '수동') return;

    const interval = REFRESH_INTERVALS[refreshInterval];
    const timer = setInterval(fetchStats, interval);

    return () => clearInterval(timer);
  }, [fetchStats, refreshInterval]);

  return { stats, loading, error, refresh: fetchStats };
};

// Hook for chart data updates
export const useChartData = (refreshInterval: RefreshInterval = '5분') => {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChartData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/dashboard/charts', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch chart data');
      }

      setChartData(result.data);
    } catch (err: any) {
      console.error('Chart data fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChartData();

    if (refreshInterval === '수동') return;

    const interval = REFRESH_INTERVALS[refreshInterval];
    const timer = setInterval(fetchChartData, interval);

    return () => clearInterval(timer);
  }, [fetchChartData, refreshInterval]);

  return { chartData, loading, error, refresh: fetchChartData };
};

// Hook for alerts and notifications
export const useAlerts = (refreshInterval: RefreshInterval = '1분') => {
  const [alerts, setAlerts] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/dashboard/alerts', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch alerts');
      }

      setAlerts(result.data);
    } catch (err: any) {
      console.error('Alerts fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();

    if (refreshInterval === '수동') return;

    const interval = REFRESH_INTERVALS[refreshInterval];
    const timer = setInterval(fetchAlerts, interval);

    return () => clearInterval(timer);
  }, [fetchAlerts, refreshInterval]);

  return { alerts, loading, error, refresh: fetchAlerts };
};

// WebSocket hook for real-time updates (optional)
export const useWebSocketUpdates = (enabled: boolean = false) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    if (!enabled) return;

    const websocket = new WebSocket(`ws://localhost:3001/api/dashboard/ws`);

    websocket.onopen = () => {
      setConnected(true);
      console.log('WebSocket connected');
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    };

    websocket.onclose = () => {
      setConnected(false);
      console.log('WebSocket disconnected');
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [enabled]);

  return { ws, connected, lastMessage };
};