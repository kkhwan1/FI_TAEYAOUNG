/**
 * Stock Chart Component
 * Visualizes stock levels with bar and line charts
 */

import React, { useState, useRef } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Download,
  Printer
} from 'lucide-react';
import {
  formatKoreanNumber,
  getRechartsTheme,
  exportChartAsImage,
  printChart,
  getStockLevelColor
} from '../../utils/chartUtils';
import type { ChartData } from '../../hooks/useDashboardData';

interface StockChartProps {
  data: ChartData['stocks'] | null;
  loading: boolean;
  error: string | null;
  isDark?: boolean;
}

type ChartType = 'bar' | 'line';

export const StockChart: React.FC<StockChartProps> = ({
  data,
  loading,
  error,
  isDark = false
}) => {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [showSafetyStock, setShowSafetyStock] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'current' | 'ratio'>('ratio');
  const chartRef = useRef<any>(null);

  const theme = getRechartsTheme(isDark);

  // Sort and prepare data
  const sortedData = React.useMemo(() => {
    if (!data) return [];

    const sorted = [...data].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.item_name.localeCompare(b.item_name);
        case 'current':
          return b.currentStock - a.currentStock;
        case 'ratio':
          const ratioA = (a.minimumStock || 0) > 0 ? a.currentStock / (a.minimumStock || 1) : 0;
          const ratioB = (b.minimumStock || 0) > 0 ? b.currentStock / (b.minimumStock || 1) : 0;
          return ratioA - ratioB;
        default:
          return 0;
      }
    });

    // Limit to top 20 items for better visualization
    return sorted.slice(0, 20);
  }, [data, sortBy]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const ratio = (data.minimumStock || 0) > 0 ? (data.currentStock / (data.minimumStock || 1)) : 0;

      return (
        <div
          className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg"
          style={theme.tooltip.contentStyle}
        >
          <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {label}
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">
            품번: {data.item_code}
          </p>
          <div className="space-y-1">
            <p className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">현재고:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatKoreanNumber(data.currentStock)}개
              </span>
            </p>
            <p className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">최소재고:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatKoreanNumber(data.minimumStock || 0)}개
              </span>
            </p>
            {showSafetyStock && (
              <p className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">안전재고:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {formatKoreanNumber(data.safetyStock || 0)}개
                </span>
              </p>
            )}
            <p className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-600">
              <span className="text-gray-600 dark:text-gray-400">재고비율:</span>
              <span
                className={`font-medium ${
                  ratio < 0.5
                    ? 'text-gray-900 dark:text-gray-100'
                    : ratio < 1
                    ? 'text-gray-700 dark:text-gray-300'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {(ratio * 100).toFixed(1)}%
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom bar color function
  const getBarColor = (entry: any) => {
    return getStockLevelColor(entry.currentStock, entry.minimumStock || 0, isDark);
  };

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            재고 현황 차트
          </h3>
        </div>
        <div className="flex items-center justify-center h-64 text-gray-600 dark:text-gray-400">
          <div className="text-center">
            
            <p>차트 데이터 로드 실패</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-1.5">
          
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            재고 현황 차트
          </h3>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-1 flex-wrap gap-y-1">
          {/* Chart Type Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setChartType('bar')}
              className={`px-2 py-2 sm:py-1.5 rounded text-sm font-medium ${
                chartType === 'bar'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              막대
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-2 py-2 sm:py-1.5 rounded text-sm font-medium ${
                chartType === 'line'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              선형
            </button>
          </div>

          {/* Sort Options */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="min-w-[120px] px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          >
            <option value="ratio">재고비율순</option>
            <option value="current">현재고순</option>
            <option value="name">품명순</option>
          </select>

          {/* Options */}
          <button
            onClick={() => setShowSafetyStock(!showSafetyStock)}
              className={`px-2 py-2 sm:py-1.5 rounded-lg text-sm font-medium ${
              showSafetyStock
                ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            안전재고
          </button>

          {/* Export buttons */}
          <button
            onClick={() => exportChartAsImage(chartRef, '재고현황차트.png')}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="이미지로 내보내기"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => printChart(chartRef)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="인쇄"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80 min-h-[320px]" ref={chartRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 dark:border-gray-400"></div>
          </div>
        ) : !sortedData.length ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              
              <p>표시할 재고 데이터가 없습니다</p>
            </div>
          </div>
        ) : chartType === 'bar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sortedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.cartesianGrid.stroke} />
              <XAxis
                dataKey="item_name"
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ ...theme.xAxis.tick, fontSize: 11 }}
                axisLine={theme.xAxis.axisLine}
              />
              <YAxis
                tickFormatter={formatKoreanNumber}
                tick={theme.yAxis.tick}
                axisLine={theme.yAxis.axisLine}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              <Bar
                dataKey="currentStock"
                name="현재고"
                fill={theme.colors[0]}
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="minimumStock"
                name="최소재고"
                fill={theme.colors[3]}
                radius={[2, 2, 0, 0]}
              />
              {showSafetyStock && (
                <Bar
                  dataKey="safetyStock"
                  name="안전재고"
                  fill={theme.colors[1]}
                  radius={[2, 2, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sortedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.cartesianGrid.stroke} />
              <XAxis
                dataKey="item_name"
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ ...theme.xAxis.tick, fontSize: 11 }}
                axisLine={theme.xAxis.axisLine}
              />
              <YAxis
                tickFormatter={formatKoreanNumber}
                tick={theme.yAxis.tick}
                axisLine={theme.yAxis.axisLine}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              <Line
                type="monotone"
                dataKey="currentStock"
                name="현재고"
                stroke={theme.colors[0]}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="minimumStock"
                name="최소재고"
                stroke={theme.colors[3]}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 4 }}
              />
              {showSafetyStock && (
                <Line
                  type="monotone"
                  dataKey="safetyStock"
                  name="안전재고"
                  stroke={theme.colors[1]}
                  strokeWidth={2}
                  strokeDasharray="10 5"
                  dot={{ r: 4 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary */}
      {!loading && sortedData.length > 0 && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">총 품목</p>
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {sortedData.length}개
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">부족 품목</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {sortedData.filter(item => item.currentStock < (item.minimumStock || 0)).length}개
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">과재고 품목</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {sortedData.filter(item => item.currentStock > (item.safetyStock || 0)).length}개
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">평균 재고율</p>
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {(
                sortedData.reduce((sum, item) => {
                  const ratio = (item.minimumStock || 0) > 0 ? item.currentStock / (item.minimumStock || 1) : 0;
                  return sum + ratio;
                }, 0) / sortedData.length * 100
              ).toFixed(1)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
};