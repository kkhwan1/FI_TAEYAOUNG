/**
 * Transaction Distribution Chart Component
 * Displays transaction type distribution with interactive pie and donut charts
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import {
  PieChart as PieChartIcon,
  Download,
  Printer,
  RefreshCcw
} from 'lucide-react';
import {
  formatKoreanNumber,
  getRechartsTheme,
  exportChartAsImage,
  printChart,
  debounce,
  getTransactionTypeColor
} from '../../utils/chartUtils';

interface TransactionDistributionData {
  type: string;
  count: number;
  volume: number;
  value: number;
  percentage: number;
  items: number;
  avgPerTransaction: number;
  companies: number;
}

interface TransactionDistributionProps {
  data: TransactionDistributionData[] | null;
  loading: boolean;
  error: string | null;
  isDark?: boolean;
  onRefresh?: () => void;
  showControls?: boolean;
  className?: string;
  onTypeClick?: (type: string) => void;
}

type ChartType = 'pie' | 'donut' | 'bar';
type MetricType = 'count' | 'volume' | 'value';
type TimeRange = 'today' | 'week' | 'month' | 'quarter';

export const TransactionDistribution: React.FC<TransactionDistributionProps> = ({
  data,
  loading,
  error,
  isDark = false,
  onRefresh,
  showControls = true,
  className = '',
  onTypeClick
}) => {
  const [chartType, setChartType] = useState<ChartType>('pie');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('volume');
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [showLabels, setShowLabels] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  const chartRef = useRef<any>(null);
  const theme = getRechartsTheme(isDark);

  // Process data for display
  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }

    const processed = data.map((item, index) => {
      const displayValue = selectedMetric === 'count' ? (item.count || 0)
                   : selectedMetric === 'volume' ? (item.volume || 0)
                   : (item.value || 0);
      
      const numericValue = Number(displayValue);
      const finalValue = (!isNaN(numericValue) && numericValue !== null && numericValue !== undefined) 
        ? numericValue 
        : 0;
      
      return {
        ...item,
        displayValue: finalValue, // 숫자로 변환하고 NaN 방지
        color: getTransactionTypeColor(item.type, isDark),
        id: `${item.type}-${index}`
      };
    }).filter(item => {
      // displayValue가 0보다 크거나, count나 volume이 0보다 큰 경우
      // displayValue가 NaN이 아닌지도 확인
      // value가 0이어도 count나 volume이 있으면 표시 (금액이 없어도 거래가 있으면 표시)
      const hasValidValue = !isNaN(item.displayValue) && item.displayValue !== null && 
                            (item.displayValue > 0 || item.count > 0 || item.volume > 0 || item.value > 0);
      
      // 디버깅: 필터링된 아이템 로그
      if (process.env.NODE_ENV === 'development' && !hasValidValue) {
        console.log('[TransactionDistribution] Filtered out item:', item);
      }
      
      return hasValidValue;
    });

    // Calculate total for percentage calculation
    const total = processed.reduce((sum, item) => sum + item.displayValue, 0);
    
    // Add percentage to each item
    const withPercentage = processed.map(item => ({
      ...item,
      percentage: total > 0 ? (item.displayValue / total) : 0
    }));

    const sorted = withPercentage.sort((a, b) => b.displayValue - a.displayValue);
    
    // 디버깅: 개발 환경에서만 로그 출력
    if (process.env.NODE_ENV === 'development') {
      console.log('[TransactionDistribution] Processed data:', {
        inputDataLength: data?.length || 0,
        processedCount: processed.length,
        sortedCount: sorted.length,
        firstItem: sorted[0],
        displayValues: sorted.map(r => r.displayValue),
        displayValueTypes: sorted.map(r => typeof r.displayValue),
        displayValueNaNs: sorted.map(r => isNaN(r.displayValue)),
        isEmpty: sorted.length === 0,
        willRenderChart: sorted.length > 0,
        selectedMetric: selectedMetric
      });
      
      // 실제 렌더링 조건 확인
      if (sorted.length > 0) {
        console.log('[TransactionDistribution] Will render chart with:', sorted.length, 'items');
        // 각 아이템의 displayValue 확인
        sorted.forEach((item, index) => {
          console.log(`[TransactionDistribution] Item ${index}:`, {
            type: item.type,
            displayValue: item.displayValue,
            displayValueType: typeof item.displayValue,
            isNaN: isNaN(item.displayValue),
            hasDisplayValue: 'displayValue' in item,
            keys: Object.keys(item)
          });
        });
      } else {
        console.warn('[TransactionDistribution] Will NOT render chart - empty data');
      }
    }
    
    return sorted;
  }, [data, selectedMetric, isDark]);

  // Calculate total and percentages
  const totals = useMemo(() => {
    if (!processedData.length) return null;

    const total = processedData.reduce((sum, item) => sum + item.displayValue, 0);
    const totalCount = processedData.reduce((sum, item) => sum + item.count, 0);
    const totalVolume = processedData.reduce((sum, item) => sum + item.volume, 0);
    const totalValue = processedData.reduce((sum, item) => sum + item.value, 0);

    return {
      total,
      totalCount,
      totalVolume,
      totalValue,
      avgTransaction: totalCount > 0 ? totalVolume / totalCount : 0,
      topType: processedData[0]?.type || '',
      topPercentage: total > 0 ? (processedData[0]?.displayValue || 0) / total * 100 : 0
    };
  }, [processedData]);

  // Custom tooltip for pie charts
  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = totals && totals.total > 0 ? (data.value / totals.total * 100) : 0;

      return (
        <div
          className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-600 rounded-lg min-w-[200px]"
          style={theme.tooltip.contentStyle}
        >
          <div className="flex items-center space-x-2 mb-3">
            <span
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: data.payload.color }}
            />
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {data.payload.type}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">거래 건수:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatKoreanNumber(data.payload.count)}건
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">거래량:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatKoreanNumber(data.payload.volume)}개
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">거래금액:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                ₩{formatKoreanNumber(data.payload.value)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-600">
              <span className="text-gray-600 dark:text-gray-400 text-sm">비율:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {percentage.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">평균 거래량:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatKoreanNumber(data.payload.avgPerTransaction)}개
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">거래처 수:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {data.payload.companies}개
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom label function for pie/donut charts - labels outside the pie
  const renderCustomLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent, name, value
  }: any) => {
    if (!showLabels || percent < 0.05) return null; // Don't show labels for slices < 5%

    const RADIAN = Math.PI / 180;
    // Position label outside the pie
    const radius = outerRadius + 20; // 20px outside the pie
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill={isDark ? '#F9FAFB' : '#1F2937'}
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize="11"
        fontWeight="500"
      >
        {`${name} (${(percent * 100).toFixed(1)}%)`}
      </text>
    );
  };

  // Handle sector click
  const handleSectorClick = (data: any) => {
    if (onTypeClick) {
      onTypeClick(data.type);
    }

    const newSelected = new Set(selectedTypes);
    if (newSelected.has(data.type)) {
      newSelected.delete(data.type);
    } else {
      newSelected.add(data.type);
    }
    setSelectedTypes(newSelected);
  };

  // Handle refresh with debounce
  const debouncedRefresh = debounce(() => {
    onRefresh?.();
  }, 1000);

  // Get metric label
  const getMetricLabel = () => {
    switch (selectedMetric) {
      case 'count': return '거래 건수';
      case 'volume': return '거래량';
      case 'value': return '거래금액';
      default: return '거래량';
    }
  };

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            거래 유형 분포
          </h3>
        </div>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <PieChartIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
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
        <div className="flex flex-row flex-wrap items-center space-x-1.5">
          
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            거래 유형 분포
          </h3>
          {totals && (
            <span className="ml-2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-lg">
              총 {formatKoreanNumber(totals.totalCount)}건
            </span>
          )}
        </div>

        {/* Controls */}
        {showControls && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Chart Type Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
              <button
                onClick={() => setChartType('pie')}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  chartType === 'pie'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
                title="파이 차트"
              >
                파이
              </button>
              <button
                onClick={() => setChartType('donut')}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  chartType === 'donut'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
                title="도넛 차트"
              >
                도넛
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  chartType === 'bar'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
                title="막대 차트"
              >
                막대
              </button>
            </div>

            {/* Metric Type */}
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
              className="min-w-[120px] px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
            >
              <option value="count">건수</option>
              <option value="volume">수량</option>
              <option value="value">금액</option>
            </select>

            {/* Refresh Button */}
            {onRefresh && (
              <button
                onClick={debouncedRefresh}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                title="데이터 새로고침"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-48 sm:h-56 lg:h-64" ref={chartRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
          </div>
        ) : !processedData || !Array.isArray(processedData) || processedData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <PieChartIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>표시할 거래 데이터가 없습니다</p>
              {process.env.NODE_ENV === 'development' && (
                <p className="text-xs mt-2">
                  Debug: processedData = {processedData ? 'exists' : 'null'}, length = {Array.isArray(processedData) ? processedData.length : 'N/A'}
                </p>
              )}
            </div>
          </div>
        ) : chartType === 'pie' ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={processedData}
                cx="50%"
                cy="50%"
                labelLine={showLabels ? { stroke: isDark ? '#9CA3AF' : '#6B7280', strokeWidth: 1 } : false}
                label={showLabels ? renderCustomLabel : false}
                outerRadius={75}
                innerRadius={0}
                fill="#8884d8"
                dataKey="displayValue"
                nameKey="type"
                onClick={handleSectorClick}
                cursor="pointer"
              >
                {processedData.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.id || entry.type || index}`}
                    fill={selectedTypes.has(entry.type)
                      ? theme.colors[6]
                      : entry.color || theme.colors[index % theme.colors.length]
                    }
                    opacity={selectedTypes.size === 0 || selectedTypes.has(entry.type) ? 1 : 0.3}
                  />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              {showLegend && (
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value, entry: any) => {
                    const typeName = entry.payload?.type || value;
                    const percentage = ((entry.payload?.percentage || 0) * 100).toFixed(1);
                    return `${typeName} (${percentage}%)`;
                  }}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
        ) : chartType === 'donut' ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={processedData}
                cx="50%"
                cy="50%"
                labelLine={showLabels ? { stroke: isDark ? '#9CA3AF' : '#6B7280', strokeWidth: 1 } : false}
                label={showLabels ? renderCustomLabel : false}
                outerRadius={75}
                innerRadius={35}
                fill="#8884d8"
                dataKey="displayValue"
                nameKey="type"
                onClick={handleSectorClick}
                cursor="pointer"
              >
                {processedData.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.id || entry.type || index}`}
                    fill={selectedTypes.has(entry.type)
                      ? theme.colors[6]
                      : entry.color || theme.colors[index % theme.colors.length]
                    }
                    opacity={selectedTypes.size === 0 || selectedTypes.has(entry.type) ? 1 : 0.3}
                  />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              {showLegend && (
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value, entry: any) => {
                    const typeName = entry.payload?.type || value;
                    const percentage = ((entry.payload?.percentage || 0) * 100).toFixed(1);
                    return `${typeName} (${percentage}%)`;
                  }}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={processedData} 
              layout="horizontal"
              margin={{ top: 5, right: 15, left: 110, bottom: 5 }}
              barCategoryGap="10%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={theme.cartesianGrid.stroke} />
              <XAxis
                type="number"
                tickFormatter={(value) =>
                  selectedMetric === 'value'
                    ? `₩${formatKoreanNumber(value)}`
                    : selectedMetric === 'volume'
                    ? formatKoreanNumber(value)
                    : formatKoreanNumber(value)
                }
                tick={theme.xAxis.tick}
                axisLine={theme.xAxis.axisLine}
                domain={[0, 'dataMax']}
                allowDataOverflow={false}
                allowDecimals={true}
              />
              <YAxis
                type="category"
                dataKey="type"
                tick={{ ...theme.yAxis.tick, fontSize: 11 }}
                axisLine={theme.yAxis.axisLine}
                width={90}
              />
              <Tooltip content={<PieTooltip />} />

              <Bar
                dataKey="displayValue"
                name={getMetricLabel()}
                onClick={handleSectorClick}
                cursor="pointer"
                radius={[0, 2, 2, 0]}
                isAnimationActive={false}
                fill={theme.colors[0]}
                minPointSize={2}
              >
                {processedData.map((entry, index) => {
                  // 디버깅: 각 Cell의 데이터 확인
                  if (process.env.NODE_ENV === 'development' && index < 3) {
                    console.log(`[TransactionDistribution] Cell ${index}:`, {
                      type: entry.type,
                      displayValue: entry.displayValue,
                      hasDisplayValue: 'displayValue' in entry,
                      color: entry.color
                    });
                  }
                  return (
                    <Cell
                      key={`cell-${entry.id || entry.type || index}`}
                      fill={selectedTypes.has(entry.type)
                        ? theme.colors[6]
                        : entry.color || theme.colors[0]
                      }
                      opacity={selectedTypes.size === 0 || selectedTypes.has(entry.type) ? 1 : 0.3}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Statistics Summary */}
      {!loading && processedData.length > 0 && totals && (
        <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">총 거래금액</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              ₩{formatKoreanNumber(totals.totalValue)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">평균 거래량</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatKoreanNumber(totals.avgTransaction)}개
            </p>
          </div>
        </div>
      )}

      {/* Selected Types Info */}
      {selectedTypes.size > 0 && (
        <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              
              <span className="text-sm text-gray-800 dark:text-gray-300 font-medium">
                선택된 유형: {Array.from(selectedTypes).join(', ')}
              </span>
            </div>
            <button
              onClick={() => setSelectedTypes(new Set())}
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              선택 해제
            </button>
          </div>
        </div>
      )}
    </div>
  );
};