/**
 * Monthly Inventory Trends Chart Component
 * Displays monthly inventory trends with interactive line chart
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Download,
  Printer,
  RefreshCcw,
  AlertCircle
} from 'lucide-react';
import {
  formatKoreanNumber,
  formatKoreanDate,
  getRechartsTheme,
  exportChartAsImage,
  printChart,
  debounce
} from '../../utils/chartUtils';
import type { MonthlyTrendsData } from '../../hooks/useDashboardData';

// Custom hook for mobile detection
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

interface MonthlyInventoryTrendsProps {
  data: MonthlyTrendsData[] | null;
  loading: boolean;
  error: string | null;
  isDark?: boolean;
  onRefresh?: () => void;
  showControls?: boolean;
  className?: string;
}

type ChartType = 'line' | 'area' | 'bar';
type MetricType = 'quantity' | 'value' | 'turnover';

export const MonthlyInventoryTrends: React.FC<MonthlyInventoryTrendsProps> = ({
  data,
  loading,
  error,
  isDark = false,
  onRefresh,
  showControls = true,
  className = ''
}) => {
  const isMobile = useIsMobile();
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('quantity');
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '12m'>(isMobile ? '3m' : '6m');
  const [showMovingAverage, setShowMovingAverage] = useState(!isMobile);
  const [selectedLines, setSelectedLines] = useState({
    총재고량: true,
    입고: true,
    출고: true,
    생산: false
  });

  const chartRef = useRef<any>(null);
  const theme = getRechartsTheme(isDark);

  // Filter data by time range
  const filteredData = useMemo(() => {
    if (!data) return [];

    const now = new Date();
    const monthsToShow = timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12;
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - monthsToShow + 1, 1);

    let filtered = data
      .map(item => ({
        ...item,
        date: typeof item.date === 'string' ? new Date(item.date) : item.date
      }))
      .filter(item => item.date >= cutoffDate)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Reduce data points for mobile devices
    if (isMobile && filtered.length > 6) {
      const step = Math.ceil(filtered.length / 6);
      filtered = filtered.filter((_, index) => index % step === 0);
    }
    
    return filtered;
  }, [data, timeRange, isMobile]);

  // Calculate moving averages
  const dataWithMovingAverage = useMemo(() => {
    if (!filteredData.length) return [];

    return filteredData.map((item, index) => {
      const windowSize = 3; // 3-month moving average
      const start = Math.max(0, index - windowSize + 1);
      const window = filteredData.slice(start, index + 1);

      const movingAverage = {
        총재고량_MA: window.reduce((sum, d) => sum + d.총재고량, 0) / window.length,
        입고_MA: window.reduce((sum, d) => sum + d.입고, 0) / window.length,
        출고_MA: window.reduce((sum, d) => sum + d.출고, 0) / window.length,
        생산_MA: window.reduce((sum, d) => sum + d.생산, 0) / window.length,
      };

      return {
        ...item,
        ...movingAverage
      };
    });
  }, [filteredData]);

  // Get display data based on selected metric
  const displayData = useMemo(() => {
    return dataWithMovingAverage.map(item => {
      switch (selectedMetric) {
        case 'value':
          return {
            ...item,
            총재고량: item.재고가치,
            입고: item.입고 * 1000, // Assume average unit price
            출고: item.출고 * 1000,
            생산: item.생산 * 1000,
          };
        case 'turnover':
          return {
            ...item,
            총재고량: item.회전율,
            입고: item.회전율,
            출고: item.회전율,
            생산: item.회전율,
          };
        default:
          return item;
      }
    });
  }, [dataWithMovingAverage, selectedMetric]);

  // Calculate trend statistics
  const trendStats = useMemo(() => {
    if (!displayData.length) return null;

    const latest = displayData[displayData.length - 1];
    const previous = displayData.length > 1 ? displayData[displayData.length - 2] : latest;

    const calculateChange = (current: number, prev: number) => {
      return prev !== 0 ? ((current - prev) / prev * 100) : 0;
    };

    return {
      총재고량변화: calculateChange(latest.총재고량, previous.총재고량),
      입고변화: calculateChange(latest.입고, previous.입고),
      출고변화: calculateChange(latest.출고, previous.출고),
      생산변화: calculateChange(latest.생산, previous.생산),
      평균회전율: displayData.reduce((sum, item) => sum + item.회전율, 0) / displayData.length,
    };
  }, [displayData]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-600 rounded-lg min-w-[200px]"
          style={theme.tooltip.contentStyle}
        >
          <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {label}
          </p>
          <div className="space-y-2">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex justify-between items-center">
                <div className="flex items-center">
                  <span
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-gray-600 dark:text-gray-400 text-xs">
                    {entry.name}:
                  </span>
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {selectedMetric === 'value'
                    ? `₩${formatKoreanNumber(entry.value)}`
                    : selectedMetric === 'turnover'
                    ? `${entry.value.toFixed(2)}`
                    : `${formatKoreanNumber(entry.value)}개`
                  }
                </span>
              </div>
            ))}
          </div>

          {/* Additional insights */}
          {payload[0]?.payload && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>재고 회전율:</span>
                  <span>{payload[0].payload.회전율.toFixed(2)}</span>
                </div>
                {selectedMetric === 'quantity' && (
                  <div className="flex justify-between">
                    <span>순 변화:</span>
                    <span className={
                      (payload[0].payload.입고 + payload[0].payload.생산 - payload[0].payload.출고) >= 0
                        ? 'text-gray-600' : 'text-gray-600'
                    }>
                      {formatKoreanNumber(payload[0].payload.입고 + payload[0].payload.생산 - payload[0].payload.출고)}개
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Toggle line visibility
  const toggleLine = (lineKey: keyof typeof selectedLines) => {
    setSelectedLines(prev => ({
      ...prev,
      [lineKey]: !prev[lineKey]
    }));
  };

  // Handle refresh with debounce
  const debouncedRefresh = debounce(() => {
    onRefresh?.();
  }, 1000);

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            월별 재고 동향
          </h3>
        </div>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p>차트 데이터 로드 실패</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
            {onRefresh && (
              <button
                onClick={debouncedRefresh}
                className="mt-3 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                다시 시도
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div className="flex flex-row flex-wrap items-center space-x-2">
          
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            월별 재고 동향
          </h3>
        </div>

        {/* Controls - Simplified */}
        {showControls && (
          <div className="flex items-center gap-2">
            {/* Time Range */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
              {(['3m', '6m', '12m'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-2 sm:py-1.5 rounded-md text-xs font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {range === '3m' ? '3개월' : range === '6m' ? '6개월' : '12개월'}
                </button>
              ))}
            </div>

            {/* Metric Type */}
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
              className="min-w-[120px] px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
            >
              <option value="quantity">수량</option>
              <option value="value">금액</option>
              <option value="turnover">회전율</option>
            </select>

            {/* Chart Type Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
              <button
                onClick={() => setChartType('bar')}
                className={`px-3 py-2 sm:py-1.5 rounded-md text-xs font-medium transition-colors ${
                  chartType === 'bar'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                막대
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-3 py-2 sm:py-1.5 rounded-md text-xs font-medium transition-colors ${
                  chartType === 'line'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                선형
              </button>
            </div>

            {/* Refresh Button */}
            {onRefresh && (
              <button
                onClick={debouncedRefresh}
                disabled={loading}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50"
                title="데이터 새로고침"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-48 sm:h-56 lg:h-64 min-h-[192px] sm:min-h-[224px] lg:min-h-[256px]" ref={chartRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
          </div>
        ) : !displayData.length ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p>표시할 동향 데이터가 없습니다</p>
            </div>
          </div>
        ) : chartType === 'bar' ? (
          <ResponsiveContainer width="100%" height="100%">
             <BarChart data={displayData} margin={{ top: 10, right: 20, left: 15, bottom: 20 }}>
               <CartesianGrid strokeDasharray="3 3" stroke={theme.cartesianGrid.stroke} />
               <XAxis
                 dataKey="month"
                 tick={theme.xAxis.tick}
                 axisLine={theme.xAxis.axisLine}
                 angle={0}
                 textAnchor="middle"
                 height={40}
                 interval={0}
               />
              <YAxis
                tickFormatter={(value) =>
                  selectedMetric === 'value'
                    ? `₩${formatKoreanNumber(value)}`
                    : selectedMetric === 'turnover'
                    ? value.toFixed(1)
                    : formatKoreanNumber(value)
                }
                tick={theme.yAxis.tick}
                axisLine={theme.yAxis.axisLine}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', bottom: '10px' }} />

              {selectedLines.입고 && (
                <Bar dataKey="입고" name="입고" fill={theme.colors[1]} />
              )}
              {selectedLines.총재고량 && (
                <Bar dataKey="총재고량" name="총재고량" fill={theme.colors[0]} />
              )}
              {selectedLines.출고 && (
                <Bar dataKey="출고" name="출고" fill={theme.colors[2]} />
              )}
              {selectedLines.생산 && (
                <Bar dataKey="생산" name="생산" fill={theme.colors[3]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        ) : chartType === 'area' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayData} margin={{ top: 10, right: 20, left: 15, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.cartesianGrid.stroke} />
              <XAxis
                dataKey="month"
                tick={theme.xAxis.tick}
                axisLine={theme.xAxis.axisLine}
                angle={0}
                textAnchor="middle"
                height={40}
                interval={0}
              />
              <YAxis
                tickFormatter={(value) =>
                  selectedMetric === 'value'
                    ? `₩${formatKoreanNumber(value)}`
                    : selectedMetric === 'turnover'
                    ? value.toFixed(1)
                    : formatKoreanNumber(value)
                }
                tick={theme.yAxis.tick}
                axisLine={theme.yAxis.axisLine}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', bottom: '10px' }} />

              {selectedLines.총재고량 && (
                <Area
                  type="monotone"
                  dataKey="총재고량"
                  name="총재고량"
                  stroke={theme.colors[0]}
                  fill={theme.colors[0]}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              )}
              {selectedLines.입고 && (
                <Area
                  type="monotone"
                  dataKey="입고"
                  name="입고"
                  stroke={theme.colors[1]}
                  fill={theme.colors[1]}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              )}
              {selectedLines.출고 && (
                <Area
                  type="monotone"
                  dataKey="출고"
                  name="출고"
                  stroke={theme.colors[2]}
                  fill={theme.colors[2]}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              )}
              {selectedLines.생산 && (
                <Area
                  type="monotone"
                  dataKey="생산"
                  name="생산"
                  stroke={theme.colors[3]}
                  fill={theme.colors[3]}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              )}

              {/* Moving averages */}
              {showMovingAverage && selectedLines.총재고량 && (
                <Area
                  type="monotone"
                  dataKey="총재고량_MA"
                  name="총재고량 (이동평균)"
                  stroke={theme.colors[0]}
                  fill="none"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  fillOpacity={0}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayData} margin={{ top: 10, right: 20, left: 15, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.cartesianGrid.stroke} />
              <XAxis
                dataKey="month"
                tick={theme.xAxis.tick}
                axisLine={theme.xAxis.axisLine}
                angle={0}
                textAnchor="middle"
                height={40}
                interval={0}
              />
              <YAxis
                tickFormatter={(value) =>
                  selectedMetric === 'value'
                    ? `₩${formatKoreanNumber(value)}`
                    : selectedMetric === 'turnover'
                    ? value.toFixed(1)
                    : formatKoreanNumber(value)
                }
                tick={theme.yAxis.tick}
                axisLine={theme.yAxis.axisLine}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', bottom: '10px' }} />

              {selectedLines.총재고량 && (
                <Line
                  type="monotone"
                  dataKey="총재고량"
                  name="총재고량"
                  stroke={theme.colors[0]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              )}
              {selectedLines.입고 && (
                <Line
                  type="monotone"
                  dataKey="입고"
                  name="입고"
                  stroke={theme.colors[1]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              )}
              {selectedLines.출고 && (
                <Line
                  type="monotone"
                  dataKey="출고"
                  name="출고"
                  stroke={theme.colors[2]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              )}
              {selectedLines.생산 && (
                <Line
                  type="monotone"
                  dataKey="생산"
                  name="생산"
                  stroke={theme.colors[3]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              )}

              {/* Moving averages */}
              {showMovingAverage && selectedLines.총재고량 && (
                <Line
                  type="monotone"
                  dataKey="총재고량_MA"
                  name="총재고량 (이동평균)"
                  stroke={theme.colors[0]}
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Statistics Summary */}
      {!loading && displayData.length > 0 && trendStats && (
        <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">총재고 변화</p>
            <p className={`text-lg font-semibold ${
              trendStats.총재고량변화 >= 0 ? 'text-gray-600' : 'text-gray-600'
            }`}>
              {trendStats.총재고량변화 >= 0 ? '+' : ''}{trendStats.총재고량변화.toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">평균 회전율</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {trendStats.평균회전율.toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};