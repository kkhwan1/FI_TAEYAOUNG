/**
 * Stock Levels by Category Chart Component
 * Displays stock levels grouped by category with interactive bar chart
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import {
  Download,
  Printer,
  Filter,
  RefreshCcw
} from 'lucide-react';
import {
  formatKoreanNumber,
  getRechartsTheme,
  exportChartAsImage,
  printChart,
  debounce,
  getStockLevelColor
} from '../../utils/chartUtils';

interface CategoryStockData {
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
  재고비율?: number; // Calculated property for stock ratio
}

interface StockLevelsByCategoryProps {
  data: CategoryStockData[] | null;
  loading: boolean;
  error: string | null;
  isDark?: boolean;
  onRefresh?: () => void;
  showControls?: boolean;
  className?: string;
  onCategoryClick?: (category: string) => void;
}

type ViewMode = 'quantity' | 'value' | 'ratio';
type SortOrder = 'name' | 'current' | 'shortage' | 'turnover';

export const StockLevelsByCategory: React.FC<StockLevelsByCategoryProps> = ({
  data,
  loading,
  error,
  isDark = false,
  onRefresh,
  showControls = true,
  className = '',
  onCategoryClick
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('quantity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('current');
  const [showSafetyStock, setShowSafetyStock] = useState(true);
  const [showMinimumStock, setShowMinimumStock] = useState(true);
  const [highlightIssues, setHighlightIssues] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  const chartRef = useRef<any>(null);
  const theme = getRechartsTheme(isDark);

  // Process and sort data
  const processedData = useMemo(() => {
    if (!data) return [];

    const processed = data.map(item => ({
      ...item,
      재고비율: item.최소재고 > 0 ? (item.현재고 / item.최소재고) : 0,
      재고효율성: item.품목수 > 0 ? ((item.품목수 - item.부족품목수 - item.과재고품목수) / item.품목수 * 100) : 0,
      displayValue: viewMode === 'quantity' ? item.현재고
                   : viewMode === 'value' ? item.재고가치
                   : item.재고비율
    }));

    // Sort data
    processed.sort((a, b) => {
      switch (sortOrder) {
        case 'name':
          return a.category.localeCompare(b.category);
        case 'current':
          return b.현재고 - a.현재고;
        case 'shortage':
          return b.부족품목수 - a.부족품목수;
        case 'turnover':
          return b.회전율 - a.회전율;
        default:
          return 0;
      }
    });

    return processed;
  }, [data, viewMode, sortOrder]);

  // Calculate overall statistics
  const overallStats = useMemo(() => {
    if (!processedData.length) return null;

    const totalItems = processedData.reduce((sum, cat) => sum + cat.품목수, 0);
    const totalShortage = processedData.reduce((sum, cat) => sum + cat.부족품목수, 0);
    const totalOverstock = processedData.reduce((sum, cat) => sum + cat.과재고품목수, 0);
    const totalValue = processedData.reduce((sum, cat) => sum + cat.재고가치, 0);
    const avgTurnover = processedData.reduce((sum, cat) => sum + cat.회전율, 0) / processedData.length;

    return {
      totalCategories: processedData.length,
      totalItems,
      totalShortage,
      totalOverstock,
      totalValue,
      avgTurnover,
      efficiency: totalItems > 0 ? ((totalItems - totalShortage - totalOverstock) / totalItems * 100) : 0
    };
  }, [processedData]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      return (
        <div
          className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-600 rounded-lg min-w-[250px]"
          style={theme.tooltip.contentStyle}
        >
          <p className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {label}
          </p>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">현재고</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {formatKoreanNumber(data.현재고)}개
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">재고가치</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  ₩{formatKoreanNumber(data.재고가치)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">최소재고</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {formatKoreanNumber(data.최소재고)}개
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">안전재고</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {formatKoreanNumber(data.안전재고)}개
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 품목</p>
                  <p className="font-medium text-gray-900 dark:text-white">{data.품목수}개</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">부족</p>
                  <p className="font-medium text-gray-600">{data.부족품목수}개</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">과재고</p>
                  <p className="font-medium text-gray-600">{data.과재고품목수}개</p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">재고 회전율:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {(data.회전율 || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">재고 비율:</span>
                <span className={`font-medium ${
                  (data.재고비율 || 0) < 0.5 ? 'text-gray-600'
                  : (data.재고비율 || 0) < 1 ? 'text-gray-600'
                  : 'text-gray-600'
                }`}>
                  {((data.재고비율 || 0) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Get bar color based on stock level and issues
  const getBarColor = (entry: any, index: number) => {
    if (highlightIssues) {
      if (entry.부족품목수 > 0) return theme.colors[4]; // Red for shortage
      if (entry.과재고품목수 > entry.품목수 * 0.3) return theme.colors[3]; // Orange for overstock
    }
    return theme.colors[index % theme.colors.length];
  };

  // Handle category selection
  const toggleCategorySelection = (category: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(category)) {
      newSelected.delete(category);
    } else {
      newSelected.add(category);
    }
    setSelectedCategories(newSelected);
  };

  // Handle bar click
  const handleBarClick = (data: any) => {
    if (onCategoryClick) {
      onCategoryClick(data.category);
    }
    toggleCategorySelection(data.category);
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
            카테고리별 재고 현황
          </h3>
        </div>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            
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
            카테고리별 재고 현황
          </h3>
          {overallStats && (
            <span className="ml-2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-lg">
              {overallStats.totalCategories}개 카테고리
            </span>
          )}
        </div>

        {/* Controls */}
        {showControls && (
          <div className="flex items-center gap-2">
            {/* View Mode */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
              <button
                onClick={() => setViewMode('quantity')}
                className={`px-3 py-2 sm:py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'quantity'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                수량
              </button>
              <button
                onClick={() => setViewMode('value')}
                className={`px-3 py-2 sm:py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'value'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                금액
              </button>
              <button
                onClick={() => setViewMode('ratio')}
                className={`px-3 py-2 sm:py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'ratio'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                비율
              </button>
            </div>

            {/* Sort Order */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="min-w-[120px] px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
            >
              <option value="current">현재고순</option>
              <option value="shortage">부족품목순</option>
              <option value="turnover">회전율순</option>
              <option value="name">이름순</option>
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
      <div className="h-48 sm:h-56 lg:h-64 min-h-[192px] sm:min-h-[224px] lg:min-h-[256px]" ref={chartRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
          </div>
        ) : !processedData.length ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              
              <p>표시할 카테고리 데이터가 없습니다</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processedData} margin={{ top: 5, right: 15, left: 15, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.cartesianGrid.stroke} />
              <XAxis
                dataKey="category"
                tick={{ ...theme.xAxis.tick, fontSize: 11 }}
                axisLine={theme.xAxis.axisLine}
                angle={0}
                textAnchor="middle"
                height={35}
                interval={0}
              />
              <YAxis
                tickFormatter={(value) =>
                  viewMode === 'value'
                    ? `₩${formatKoreanNumber(value)}`
                    : viewMode === 'ratio'
                    ? `${(value * 100).toFixed(0)}%`
                    : formatKoreanNumber(value)
                }
                tick={theme.yAxis.tick}
                axisLine={theme.yAxis.axisLine}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', bottom: '10px' }} />

              <Bar
                dataKey="displayValue"
                name={
                  viewMode === 'quantity' ? '현재고'
                  : viewMode === 'value' ? '재고가치'
                  : '재고비율'
                }
                onClick={handleBarClick}
                cursor="pointer"
                radius={[2, 2, 0, 0]}
              >
                {processedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={selectedCategories.has(entry.category)
                      ? theme.colors[6]
                      : getBarColor(entry, index)
                    }
                    opacity={selectedCategories.size === 0 || selectedCategories.has(entry.category) ? 1 : 0.3}
                  />
                ))}
              </Bar>

              {/* Reference lines for minimum and safety stock */}
              {viewMode === 'quantity' && showMinimumStock && (
                <ReferenceLine
                  y={processedData.reduce((sum, item) => sum + item.최소재고, 0) / processedData.length}
                  stroke={theme.colors[4]}
                  strokeDasharray="5 5"
                  label={{ 
                    value: "평균 최소재고", 
                    position: "insideRight",
                    fill: theme.colors[4],
                    fontSize: 10
                  }}
                />
              )}

              {viewMode === 'quantity' && showSafetyStock && (
                <ReferenceLine
                  y={processedData.reduce((sum, item) => sum + item.안전재고, 0) / processedData.length}
                  stroke={theme.colors[1]}
                  strokeDasharray="10 5"
                  label={{ 
                    value: "평균 안전재고", 
                    position: "insideRight",
                    fill: theme.colors[1],
                    fontSize: 10
                  }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Statistics Summary */}
      {!loading && processedData.length > 0 && overallStats && (
        <div className="mt-3 grid grid-cols-3 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">부족 품목</p>
            <p className="text-lg font-semibold text-gray-600">
              {formatKoreanNumber(overallStats.totalShortage)}개
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">과재고 품목</p>
            <p className="text-lg font-semibold text-gray-600">
              {formatKoreanNumber(overallStats.totalOverstock)}개
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">재고 효율성</p>
            <p className={`text-lg font-semibold ${
              overallStats.efficiency >= 80 ? 'text-gray-600'
              : overallStats.efficiency >= 60 ? 'text-gray-600'
              : 'text-gray-600'
            }`}>
              {overallStats.efficiency.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Selected Categories Info */}
      {selectedCategories.size > 0 && (
        <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm text-gray-800 dark:text-gray-300 font-medium">
                선택된 카테고리: {Array.from(selectedCategories).join(', ')}
              </span>
            </div>
            <button
              onClick={() => setSelectedCategories(new Set())}
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