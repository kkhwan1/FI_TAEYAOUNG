'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import {
  Download,
  Calendar,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { formatKoreanNumber } from '@/utils/chartUtils';

interface StockSummary {
  total_items: number;
  total_stock_value: number;
  low_stock_items: number;
  excess_stock_items: number;
  out_of_stock_items: number;
}

interface CategoryBreakdown {
  item_type: string;
  item_count: number;
  stock_value: number;
  percentage: number;
}

interface MonthlyTrend {
  month: string;
  stock_value: number;
  transaction_count: number;
  in_quantity: number;
  out_quantity: number;
}

interface TopItem {
  item_code: string;
  item_name: string;
  stock_value: number;
  current_stock: number;
  safety_stock: number;
}

export default function StockReportsPage() {
  const { error: showError } = useToast();
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [topValueItems, setTopValueItems] = useState<TopItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportDate, setReportDate] = useState<string>('');
  
  // 정렬 상태 (고가 품목 TOP 10)
  const [topValueSortColumn, setTopValueSortColumn] = useState<string>('stock_value');
  const [topValueSortOrder, setTopValueSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 정렬 상태 (재고 부족 품목)
  const [lowStockSortColumn, setLowStockSortColumn] = useState<string>('current_stock');
  const [lowStockSortOrder, setLowStockSortOrder] = useState<'asc' | 'desc'>('asc');

  // Initialize report date to today
  useEffect(() => {
    setReportDate(new Date().toISOString().split('T')[0]);
  }, []);

  // Fetch all report data
  const fetchReportData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/stock/reports?date=${reportDate}`);
      const result = await response.json();

      if (result.success) {
        const data = result.data;
        setStockSummary(data.summary || null);
        setCategoryBreakdown(data.categoryBreakdown || []);
        setMonthlyTrend(data.monthlyTrend || []);
        setTopValueItems(data.topValueItems || []);
        setLowStockItems(data.lowStockItems || []);
      } else {
        console.error('[Stock Reports] API error:', result.error);
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showError(`보고서 조회 실패: ${extractErrorMessage(result.error)}`);
      }
    } catch (error) {
      console.error('[Stock Reports] Fetch error:', error);
      const { extractErrorMessage } = await import('@/lib/fetch-utils');
      showError(extractErrorMessage(error) || '보고서 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when report date changes
  useEffect(() => {
    if (reportDate) {
      fetchReportData();
    }
  }, [reportDate]);

  // Sort handlers
  const handleTopValueSort = (column: string) => {
    if (topValueSortColumn === column) {
      setTopValueSortOrder(topValueSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setTopValueSortColumn(column);
      setTopValueSortOrder('desc');
    }
  };

  const handleLowStockSort = (column: string) => {
    if (lowStockSortColumn === column) {
      setLowStockSortOrder(lowStockSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setLowStockSortColumn(column);
      setLowStockSortOrder('asc');
    }
  };

  // Sorted items using useMemo
  const sortedTopValueItems = useMemo(() => {
    if (!topValueItems || topValueItems.length === 0) return [];
    
    const sorted = [...topValueItems].sort((a, b) => {
      let aValue: any = a[topValueSortColumn as keyof TopItem];
      let bValue: any = b[topValueSortColumn as keyof TopItem];
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (topValueSortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
    
    return sorted.slice(0, 10); // Top 10
  }, [topValueItems, topValueSortColumn, topValueSortOrder]);

  const sortedLowStockItems = useMemo(() => {
    if (!lowStockItems || lowStockItems.length === 0) return [];
    
    const sorted = [...lowStockItems].sort((a, b) => {
      let aValue: any = a[lowStockSortColumn as keyof TopItem];
      let bValue: any = b[lowStockSortColumn as keyof TopItem];
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (lowStockSortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
    
    return sorted;
  }, [lowStockItems, lowStockSortColumn, lowStockSortOrder]);

  // Chart colors - Grayscale palette for SAP-style UI
  const COLORS = ['#262626', '#525252', '#737373', '#A3A3A3', '#D4D4D4', '#E5E5E5', '#F5F5F5', '#FAFAFA'];

  // Export report to CSV
  const exportReport = () => {
    if (!stockSummary) return;

    const reportData = [
      ['재고 보고서', ''],
      ['기준일', reportDate],
      ['', ''],
      ['요약 정보', ''],
      ['총 품목 수', stockSummary.total_items || 0],
      ['총 재고 금액', (stockSummary.total_stock_value || 0).toLocaleString()],
      ['재고 부족 품목', stockSummary.low_stock_items || 0],
      ['과잉 재고 품목', stockSummary.excess_stock_items || 0],
      ['재고 없음 품목', stockSummary.out_of_stock_items || 0],
      ['', ''],
      ['카테고리별 현황', ''],
      ['카테고리', '품목수', '재고금액', '비율(%)'],
      ...categoryBreakdown.map(cat => [
        cat.item_type,
        cat.item_count,
        cat.stock_value.toLocaleString(),
        cat.percentage.toFixed(1)
      ]),
      ['', ''],
      ['고가 품목 TOP 10', ''],
      ['품목코드', '품목명', '재고금액', '현재고', '안전재고'],
      ...topValueItems.map(item => [
        item.item_code,
        item.item_name,
        item.stock_value.toLocaleString(),
        item.current_stock,
        item.safety_stock
      ])
    ];

    const csvContent = reportData.map(row => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `재고보고서_${reportDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">재고 보고서</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">재고 현황 분석 및 통계 리포트</p>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400 text-sm"
              />
            </div>

            <button
              onClick={exportReport}
              disabled={!stockSummary || loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Download className="w-5 h-5" />
              보고서 내보내기
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800 mr-4"></div>
          <span className="text-gray-600 dark:text-gray-400">보고서를 생성하고 있습니다...</span>
        </div>
      ) : (
        <>
          {/* Summary Statistics */}
          {stockSummary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2">총 품목수</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">
                  {(stockSummary.total_items || 0).toLocaleString()}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2">총 재고금액</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">
                  ₩{(stockSummary.total_stock_value || 0).toLocaleString()}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2">부족품목</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">
                  {(stockSummary.low_stock_items || 0).toLocaleString()}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2">과잉재고</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">
                  {(stockSummary.excess_stock_items || 0).toLocaleString()}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2">품절품목</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">
                  {(stockSummary.out_of_stock_items || 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown Pie Chart */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 sm:mb-6">카테고리별 재고금액</h3>

              {categoryBreakdown.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={categoryBreakdown as any}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(props: any) => `${props.item_type} (${props.percentage?.toFixed(1)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="stock_value"
                      >
                        {categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`₩${value.toLocaleString()}`, '재고금액']} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  데이터가 없습니다
                </div>
              )}
            </div>

            {/* Monthly Trend Chart */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 sm:mb-6">월별 재고 추이</h3>

              {monthlyTrend.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis 
                        tickFormatter={(value) => formatKoreanNumber(value)} 
                        width={80}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          name === 'stock_value' ? `₩${value.toLocaleString()}` : value.toLocaleString(),
                          name === 'stock_value' ? '재고금액' :
                          name === 'transaction_count' ? '거래건수' :
                          name === 'in_quantity' ? '입고수량' : '출고수량'
                        ]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="stock_value"
                        stroke="#262626"
                        strokeWidth={2}
                        name="재고금액"
                      />
                      <Line
                        type="monotone"
                        dataKey="transaction_count"
                        stroke="#525252"
                        strokeWidth={2}
                        name="거래건수"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  데이터가 없습니다
                </div>
              )}
            </div>
          </div>

          {/* Tables Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Value Items */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="p-3 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100">고가 품목 TOP 10</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        <button
                          onClick={() => handleTopValueSort('item_code')}
                          className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          품목코드
                          {topValueSortColumn === 'item_code' ? (
                            topValueSortOrder === 'asc' ?
                              <ArrowUp className="w-3 h-3" /> :
                              <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-50" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        <button
                          onClick={() => handleTopValueSort('item_name')}
                          className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          품목명
                          {topValueSortColumn === 'item_name' ? (
                            topValueSortOrder === 'asc' ?
                              <ArrowUp className="w-3 h-3" /> :
                              <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-50" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        <button
                          onClick={() => handleTopValueSort('stock_value')}
                          className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                        >
                          재고금액
                          {topValueSortColumn === 'stock_value' ? (
                            topValueSortOrder === 'asc' ?
                              <ArrowUp className="w-3 h-3" /> :
                              <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-50" />
                          )}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sortedTopValueItems.length > 0 ? (
                      sortedTopValueItems.map((item) => (
                        <tr key={item.item_code} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {item.item_code}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white truncate max-w-32">
                            {item.item_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            ₩{item.stock_value.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          데이터가 없습니다
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Low Stock Items */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="p-3 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100">재고 부족 품목</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        <button
                          onClick={() => handleLowStockSort('item_code')}
                          className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          품목코드
                          {lowStockSortColumn === 'item_code' ? (
                            lowStockSortOrder === 'asc' ?
                              <ArrowUp className="w-3 h-3" /> :
                              <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-50" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        <button
                          onClick={() => handleLowStockSort('item_name')}
                          className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          품목명
                          {lowStockSortColumn === 'item_name' ? (
                            lowStockSortOrder === 'asc' ?
                              <ArrowUp className="w-3 h-3" /> :
                              <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-50" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        <button
                          onClick={() => handleLowStockSort('current_stock')}
                          className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                        >
                          현재고
                          {lowStockSortColumn === 'current_stock' ? (
                            lowStockSortOrder === 'asc' ?
                              <ArrowUp className="w-3 h-3" /> :
                              <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-50" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        <button
                          onClick={() => handleLowStockSort('safety_stock')}
                          className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                        >
                          안전재고
                          {lowStockSortColumn === 'safety_stock' ? (
                            lowStockSortOrder === 'asc' ?
                              <ArrowUp className="w-3 h-3" /> :
                              <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-50" />
                          )}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sortedLowStockItems.length > 0 ? (
                      sortedLowStockItems.map((item) => (
                        <tr key={item.item_code} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {item.item_code}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white truncate max-w-32">
                            {item.item_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-800 dark:text-gray-100">
                            {item.current_stock.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            {item.safety_stock.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          재고 부족 품목이 없습니다
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Category Breakdown Table */}
          {categoryBreakdown.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="p-3 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100">카테고리별 상세 현황</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        카테고리
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        품목 수
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        재고 금액
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        비율
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {categoryBreakdown.map((category, index) => (
                      <tr key={category.item_type} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            ></div>
                            {category.item_type}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                          {category.item_count.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                          ₩{category.stock_value.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                          {category.percentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}