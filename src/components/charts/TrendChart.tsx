/**
 * Price Trend Chart Component
 * Displays price trends over time with interactive line chart
 */

import React, { useState, useRef, useMemo } from 'react';
import {
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
  printChart
} from '../../utils/chartUtils';

interface TrendData {
  date: string;
  month: string;
  item_id: number;
  item_name: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  price_changes: number;
}

interface TrendChartProps {
  data: TrendData[] | null;
  loading: boolean;
  timeRange: '3m' | '6m' | '12m';
  isDark?: boolean;
  showControls?: boolean;
  className?: string;
}

type MetricType = 'avg_price' | 'min_price' | 'max_price';

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  loading,
  timeRange,
  isDark = false,
  showControls = true,
  className = ''
}) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('avg_price');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [showRange, setShowRange] = useState(true);

  const chartRef = useRef<any>(null);
  const theme = getRechartsTheme(isDark);

  // Get unique items from data
  const uniqueItems = useMemo(() => {
    if (!data) return [];
    const itemsMap = new Map<number, string>();
    data.forEach(item => {
      if (!itemsMap.has(item.item_id)) {
        itemsMap.set(item.item_id, item.item_name);
      }
    });
    return Array.from(itemsMap.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  // Initialize selected items (show first 3 items by default)
  React.useEffect(() => {
    if (uniqueItems.length > 0 && selectedItems.size === 0) {
      setSelectedItems(new Set(uniqueItems.slice(0, 3).map(item => item.id)));
    }
  }, [uniqueItems]);

  // Transform data for chart
  const chartData = useMemo(() => {
    if (!data) return [];

    // Group by month
    const monthlyData = new Map<string, any>();

    data.forEach(item => {
      if (!selectedItems.has(item.item_id)) return;

      if (!monthlyData.has(item.month)) {
        monthlyData.set(item.month, { month: item.month });
      }

      const monthData = monthlyData.get(item.month)!;
      const itemKey = `item_${item.item_id}`;

      switch (selectedMetric) {
        case 'avg_price':
          monthData[itemKey] = item.avg_price;
          break;
        case 'min_price':
          monthData[itemKey] = item.min_price;
          break;
        case 'max_price':
          monthData[itemKey] = item.max_price;
          break;
      }

      // Store item name for legend
      monthData[`${itemKey}_name`] = item.item_name;
    });

    return Array.from(monthlyData.values()).sort((a, b) =>
      a.month.localeCompare(b.month)
    );
  }, [data, selectedItems, selectedMetric]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-600 rounded-lg min-w-[200px]"
          style={theme.tooltip.contentStyle}
        >
          <p className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {label}
          </p>
          <div className="space-y-2">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex justify-between items-center gap-4">
                <div className="flex items-center">
                  <span
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-gray-600 dark:text-gray-400 text-sm">
                    {entry.name}:
                  </span>
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  ₩{formatKoreanNumber(entry.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Toggle item visibility
  const toggleItem = (itemId: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  // Get metric label
  const getMetricLabel = (metric: MetricType) => {
    switch (metric) {
      case 'avg_price': return '평균 단가';
      case 'min_price': return '최저 단가';
      case 'max_price': return '최고 단가';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-700 dark:border-gray-300"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-row flex-wrap items-center space-x-2">
          
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            가격 추세 분석
          </h3>
        </div>

        {/* Controls */}
        {showControls && (
          <div className="flex items-center space-x-2">
            {/* Metric Type */}
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="avg_price">평균 단가</option>
              <option value="min_price">최저 단가</option>
              <option value="max_price">최고 단가</option>
            </select>

            {/* Range Toggle */}
            <button
              onClick={() => setShowRange(!showRange)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showRange
                  ? 'bg-gray-800 text-white hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              가격 범위 표시
            </button>

            {/* Export buttons */}
            <button
              onClick={() => exportChartAsImage(chartRef, '가격추세.png')}
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
        )}
      </div>

      {/* Item Visibility Controls */}
      <div className="mb-4">
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">표시 품목:</span>
          {uniqueItems.slice(0, 10).map((item, index) => (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                selectedItems.has(item.id)
                  ? 'bg-gray-800 text-white dark:bg-gray-700'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: theme.colors[index % theme.colors.length]
                }}
              />
              <span className="truncate max-w-[120px]">{item.name}</span>
            </button>
          ))}
          {uniqueItems.length > 10 && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              외 {uniqueItems.length - 10}개
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-96 min-h-[384px]" ref={chartRef}>
        {!chartData.length ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              
              <p>표시할 가격 추세 데이터가 없습니다</p>
              <p className="text-sm text-gray-400 mt-1">품목을 선택해주세요</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.cartesianGrid.stroke} />
              <XAxis
                dataKey="month"
                tick={theme.xAxis.tick}
                axisLine={theme.xAxis.axisLine}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tickFormatter={(value) => `₩${formatKoreanNumber(value)}`}
                tick={theme.yAxis.tick}
                axisLine={theme.yAxis.axisLine}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {/* Render lines for each selected item */}
              {Array.from(selectedItems).map((itemId, index) => {
                const item = uniqueItems.find(i => i.id === itemId);
                if (!item) return null;

                return (
                  <Line
                    key={itemId}
                    type="monotone"
                    dataKey={`item_${itemId}`}
                    name={item.name}
                    stroke={theme.colors[index % theme.colors.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary Statistics */}
      {chartData.length > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">분석 기간</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {timeRange === '3m' ? '3개월' : timeRange === '6m' ? '6개월' : '12개월'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">선택된 품목</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedItems.size}개
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">표시 지표</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {getMetricLabel(selectedMetric)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">데이터 포인트</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {chartData.length}개
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrendChart;
