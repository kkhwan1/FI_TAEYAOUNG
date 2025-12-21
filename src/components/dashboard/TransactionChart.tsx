/**
 * Transaction Chart Component
 * Visualizes transaction trends with area and line charts
 */

import React, { useState, useRef } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  PieChart as PieChartIcon,
  Download,
  Printer,
  Calendar
} from 'lucide-react';
import {
  formatKoreanNumber,
  getRechartsTheme,
  exportChartAsImage,
  printChart,
  getTransactionTypeColor
} from '../../utils/chartUtils';
import type { ChartData } from '../../hooks/useDashboardData';

interface TransactionChartProps {
  data: ChartData['transactions'] | null;
  monthlyData: ChartData['monthlyTrends'] | null;
  loading: boolean;
  error: string | null;
  isDark?: boolean;
}

type ChartType = 'area' | 'line' | 'pie';
type TimeRange = 'daily' | 'monthly';

export const TransactionChart: React.FC<TransactionChartProps> = ({
  data,
  monthlyData,
  loading,
  error,
  isDark = false
}) => {
  const [chartType, setChartType] = useState<ChartType>('area');
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');
  const [selectedTypes, setSelectedTypes] = useState({
    입고: true,
    출고: true,
    생산: true
  });
  const chartRef = useRef<any>(null);

  const theme = getRechartsTheme(isDark);

  // Get current data based on time range
  const currentData = timeRange === 'daily' ? data : monthlyData;

  // Calculate totals for pie chart
  const totals = React.useMemo(() => {
    if (!currentData) return [];

    const sums = currentData.reduce(
      (acc, item) => ({
        입고: acc.입고 + (typeof (item as any).입고 === 'number' ? (item as any).입고 : 0),
        출고: acc.출고 + (typeof (item as any).출고 === 'number' ? (item as any).출고 : 0),
        생산: acc.생산 + (typeof (item as any).생산 === 'number' ? (item as any).생산 : 0)
      }),
      { 입고: 0, 출고: 0, 생산: 0 }
    );

    return [
      { name: '입고', value: sums.입고, color: getTransactionTypeColor('입고', isDark) },
      { name: '출고', value: sums.출고, color: getTransactionTypeColor('출고', isDark) },
      { name: '생산', value: sums.생산, color: getTransactionTypeColor('생산', isDark) }
    ].filter(item => item.value > 0);
  }, [currentData, isDark]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg"
          style={theme.tooltip.contentStyle}
        >
          <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {label}
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <p key={index} className="flex justify-between items-center">
                <span className="flex items-center">
                  <span
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: entry.color }}
                  ></span>
                  {entry.name}:
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100 ml-2">
                  {formatKoreanNumber(entry.value)}개
                </span>
              </p>
            ))}
            {payload.length > 1 && (
              <p className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-600">
                <span className="text-gray-600 dark:text-gray-400">총계:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {formatKoreanNumber(payload.reduce((sum: number, entry: any) => sum + entry.value, 0))}개
                </span>
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Pie chart tooltip
  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const total = totals.reduce((sum, item) => sum + item.value, 0);
      const percentage = total > 0 ? (data.value / total * 100).toFixed(1) : '0';

      return (
        <div
          className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg"
          style={theme.tooltip.contentStyle}
        >
          <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
            {data.name}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            수량: <span className="font-medium text-gray-900 dark:text-gray-100">
              {formatKoreanNumber(data.value)}개
            </span>
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            비율: <span className="font-medium text-gray-900 dark:text-gray-100">
              {percentage}%
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Toggle transaction type visibility
  const toggleTransactionType = (type: keyof typeof selectedTypes) => {
    setSelectedTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            거래 동향 차트
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
        <div className="flex items-center space-x-2">
          
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            거래 동향 차트
          </h3>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-1 flex-wrap gap-y-1">
          {/* Time Range Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setTimeRange('daily')}
              className={`px-2 py-2 sm:py-1.5 rounded text-sm font-medium ${
                timeRange === 'daily'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              일별
            </button>
            <button
              onClick={() => setTimeRange('monthly')}
              className={`px-2 py-2 sm:py-1.5 rounded text-sm font-medium ${
                timeRange === 'monthly'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              월별
            </button>
          </div>

          {/* Chart Type Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setChartType('area')}
              className={`px-2 py-2 sm:py-1.5 rounded text-sm font-medium ${
                chartType === 'area'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              영역
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
            <button
              onClick={() => setChartType('pie')}
              className={`px-2 py-2 sm:py-1.5 rounded text-sm font-medium ${
                chartType === 'pie'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              원형
            </button>
          </div>

          {/* Export buttons */}
          <button
            onClick={() => exportChartAsImage(chartRef, '거래동향차트.png')}
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

      {/* Transaction Type Filters */}
      {chartType !== 'pie' && (
        <div className="flex items-center space-x-4 mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">표시 항목:</span>
          {Object.entries(selectedTypes).map(([type, selected]) => (
            <button
              key={type}
              onClick={() => toggleTransactionType(type as keyof typeof selectedTypes)}
              className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-sm font-medium ${
                selected
                  ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getTransactionTypeColor(type, isDark) }}
              ></span>
              <span>{type}</span>
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="h-80 min-h-[320px]" ref={chartRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 dark:border-gray-400"></div>
          </div>
        ) : !currentData?.length ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              
              <p>표시할 거래 데이터가 없습니다</p>
            </div>
          </div>
        ) : chartType === 'pie' ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={totals}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props: any) => `${props.name} ${(props.percent * 100).toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {totals.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : chartType === 'area' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={currentData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.cartesianGrid.stroke} />
              <XAxis
                dataKey="date"
                tick={theme.xAxis.tick}
                axisLine={theme.xAxis.axisLine}
              />
              <YAxis
                tickFormatter={formatKoreanNumber}
                tick={theme.yAxis.tick}
                axisLine={theme.yAxis.axisLine}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {selectedTypes.입고 && (
                <Area
                  type="monotone"
                  dataKey="입고"
                  stackId="1"
                  stroke={getTransactionTypeColor('입고', isDark)}
                  fill={getTransactionTypeColor('입고', isDark)}
                  fillOpacity={0.6}
                />
              )}
              {selectedTypes.출고 && (
                <Area
                  type="monotone"
                  dataKey="출고"
                  stackId="1"
                  stroke={getTransactionTypeColor('출고', isDark)}
                  fill={getTransactionTypeColor('출고', isDark)}
                  fillOpacity={0.6}
                />
              )}
              {selectedTypes.생산 && (
                <Area
                  type="monotone"
                  dataKey="생산"
                  stackId="1"
                  stroke={getTransactionTypeColor('생산', isDark)}
                  fill={getTransactionTypeColor('생산', isDark)}
                  fillOpacity={0.6}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={currentData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.cartesianGrid.stroke} />
              <XAxis
                dataKey="date"
                tick={theme.xAxis.tick}
                axisLine={theme.xAxis.axisLine}
              />
              <YAxis
                tickFormatter={formatKoreanNumber}
                tick={theme.yAxis.tick}
                axisLine={theme.yAxis.axisLine}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {selectedTypes.입고 && (
                <Line
                  type="monotone"
                  dataKey="입고"
                  stroke={getTransactionTypeColor('입고', isDark)}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              )}
              {selectedTypes.출고 && (
                <Line
                  type="monotone"
                  dataKey="출고"
                  stroke={getTransactionTypeColor('출고', isDark)}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              )}
              {selectedTypes.생산 && (
                <Line
                  type="monotone"
                  dataKey="생산"
                  stroke={getTransactionTypeColor('생산', isDark)}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary */}
      {!loading && currentData && currentData.length > 0 && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">총 입고</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {formatKoreanNumber(totals.find(t => t.name === '입고')?.value || 0)}개
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">총 출고</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {formatKoreanNumber(totals.find(t => t.name === '출고')?.value || 0)}개
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">총 생산</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {formatKoreanNumber(totals.find(t => t.name === '생산')?.value || 0)}개
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">순 증감</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {formatKoreanNumber(
                (totals.find(t => t.name === '입고')?.value || 0) +
                (totals.find(t => t.name === '생산')?.value || 0) -
                (totals.find(t => t.name === '출고')?.value || 0)
              )}개
            </p>
          </div>
        </div>
      )}
    </div>
  );
};