/**
 * Top Items by Value Chart Component
 * Displays top items ranked by value with horizontal bar chart
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Legend
} from 'recharts';
import {
  Download,
  Printer,
  RefreshCcw,
  Crown,
  Filter
} from 'lucide-react';
import {
  formatKoreanNumber,
  getRechartsTheme,
  exportChartAsImage,
  printChart,
  debounce
} from '../../utils/chartUtils';

interface TopItemData {
  item_id: string;
  item_name: string;
  item_code: string;
  category: string;
  currentStock: number;
  unitPrice: number;
  totalValue: number;
  monthlyVolume: number;
  turnoverRate: number;
  lastTransactionDate: Date | null;
  supplier: string | null;
  stockStatus: 'low' | 'normal' | 'high' | 'overstock';
  rank: number;
}

// Alternative data format that might come from StockChartDatum
interface StockChartDatum {
  item_id?: string;
  item_name?: string;
  item_code?: string;
  category?: string;
  current_stock?: number;
  currentStock?: number;
  현재고?: number;
  현재재고?: number;
  safety_stock?: number;
  안전재고?: number;
  최소재고?: number;
  unitPrice?: number;
  price?: number;
  단가?: number;
  monthlyVolume?: number;
  월간거래량?: number;
  turnoverRate?: number;
  회전율?: number;
  lastTransactionDate?: string | Date;
  supplier?: string | null;
  rank?: number;
  code?: string;
  name?: string;
  카테고리?: string;
  totalValue?: number;
}

interface TopItemsByValueProps {
  data: (TopItemData | StockChartDatum)[] | null;
  loading: boolean;
  error: string | null;
  isDark?: boolean;
  onRefresh?: () => void;
  showControls?: boolean;
  className?: string;
  onItemClick?: (itemId: string) => void;
  limit?: number;
}

type SortMetric = 'value' | 'volume' | 'turnover' | 'stock';
type CategoryFilter = 'all' | string;

export const TopItemsByValue: React.FC<TopItemsByValueProps> = ({
  data,
  loading,
  error,
  isDark = false,
  onRefresh,
  showControls = true,
  className = '',
  onItemClick,
  limit = 10
}) => {
  const [sortMetric, setSortMetric] = useState<SortMetric>('value');
  const [topCount, setTopCount] = useState(limit);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showStockStatus, setShowStockStatus] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const chartRef = useRef<any>(null);
  const theme = getRechartsTheme(isDark);

  // Get available categories
  const categories = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return [...new Set(data.map(item => {
      // Type guard to check if item has Korean properties
      const stockDatum = item as StockChartDatum;
      return item.category || stockDatum.카테고리 || '';
    }).filter(Boolean))].sort();
  }, [data]);

  // Process and filter data
  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return [];

    // Normalize data format (handle both TopItemData and StockChartDatum formats)
    const normalizedData = data.map((item, index) => {
      // API에서 totalValue가 있는 경우도 변환이 필요할 수 있음
      // 모든 필드가 TopItemData 형식인지 확인
      const hasAllTopItemFields = 'totalValue' in item && 
                                  'item_id' in item && 
                                  'item_name' in item &&
                                  'currentStock' in item &&
                                  'unitPrice' in item;

      // If already in complete TopItemData format, use as-is
      if (hasAllTopItemFields) {
        const stockDatum = item as StockChartDatum;
        return {
          ...item,
          item_id: String(item.item_id || stockDatum.code || item.item_code || ''),
          rank: item.rank || (index + 1)
        } as TopItemData;
      }

      // Otherwise, convert from StockChartDatum or partial format
      const stockDatum = item as any;
      const currentStock = stockDatum.currentStock ?? stockDatum.current_stock ?? stockDatum.현재고 ?? stockDatum.현재재고 ?? 0;
      const safetyStock = stockDatum.safety_stock ?? stockDatum.안전재고 ?? stockDatum.최소재고 ?? 0;
      const unitPrice = stockDatum.unitPrice ?? stockDatum.price ?? stockDatum.단가 ?? 0;
      const totalValue = stockDatum.totalValue ?? (currentStock * unitPrice);

      return {
        item_id: String(stockDatum.item_id || stockDatum.code || stockDatum.item_code || ''),
        item_name: stockDatum.item_name || stockDatum.name || stockDatum.code || '',
        item_code: stockDatum.item_code || stockDatum.code || '',
        category: stockDatum.category || stockDatum.카테고리 || '기타',
        currentStock,
        unitPrice,
        totalValue,
        monthlyVolume: stockDatum.monthlyVolume || stockDatum.월간거래량 || 0,
        turnoverRate: stockDatum.turnoverRate || stockDatum.회전율 || 0,
        lastTransactionDate: stockDatum.lastTransactionDate ? new Date(stockDatum.lastTransactionDate) : null,
        supplier: stockDatum.supplier || null,
        stockStatus: currentStock < safetyStock * 0.5 ? 'low'
                    : currentStock < safetyStock ? 'normal'
                    : currentStock > safetyStock * 2 ? 'overstock'
                    : 'high' as 'low' | 'normal' | 'high' | 'overstock',
        rank: stockDatum.rank || (index + 1)
      } as TopItemData;
    });

    // 필터링: 필수 필드가 있는지 확인
    let filtered = normalizedData.filter(item => {
      if (!item) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[TopItemsByValue] Filtered out: item is falsy');
        }
        return false;
      }
      // item_id 또는 item_code가 있어야 함 (숫자 또는 문자열 모두 허용)
      const hasId = (item.item_id && String(item.item_id)) || item.item_code;
      // item_name 또는 item_code가 있어야 함
      const hasName = item.item_name || item.item_code;
      // totalValue가 있어야 차트에 표시 가능 (0도 유효한 값)
      const hasValue = item.totalValue !== undefined && item.totalValue !== null && !isNaN(item.totalValue);
      
      const isValid = hasId && hasName && hasValue;
      
      // 디버깅: 필터링된 아이템 로그
      if (process.env.NODE_ENV === 'development' && !isValid) {
        console.log('[TopItemsByValue] Filtered out item:', { item, hasId, hasName, hasValue });
      }
      
      return isValid;
    });

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => (item.category || '') === categoryFilter);
    }

    // Sort by selected metric
    filtered = filtered.sort((a, b) => {
      switch (sortMetric) {
        case 'value':
          return b.totalValue - a.totalValue;
        case 'volume':
          return b.monthlyVolume - a.monthlyVolume;
        case 'turnover':
          return b.turnoverRate - a.turnoverRate;
        case 'stock':
          return b.currentStock - a.currentStock;
        default:
          return b.totalValue - a.totalValue;
      }
    });

    // Take top N items
    const topItems = filtered.slice(0, topCount);

    // 데이터가 없으면 빈 배열 반환
    if (topItems.length === 0) {
      return [];
    }

    // Add display value and colors
    // TransactionDistribution과 완전히 동일한 패턴 사용: 필요한 필드만 포함
    const result = topItems.map((item, index) => {
      const displayValue = sortMetric === 'value' ? (item.totalValue || 0)
                   : sortMetric === 'volume' ? (item.monthlyVolume || 0)
                   : sortMetric === 'turnover' ? (item.turnoverRate || 0)
                   : (item.currentStock || 0);
      
      // displayName을 안정적으로 생성 (YAxis category로 사용)
      // TransactionDistribution의 "type" 필드와 동일한 역할
      const fullName = item.item_name || item.item_code || '알 수 없음';
      const baseDisplayName = fullName.length > 15
        ? `${fullName.substring(0, 12)}...`
        : fullName;
      
      // TransactionDistribution과 완전히 동일한 패턴 사용
      // 중요: TransactionDistribution은 원본 데이터의 "type" 필드를 사용하므로,
      // TopItemsByValue도 원본 데이터에 "type" 필드가 있으면 그대로 사용
      // 없으면 displayName을 "type" 필드로도 추가
      const processedItem = {
        ...item,
        // YAxis category로 사용할 필드 (TransactionDistribution의 "type"과 동일한 역할)
        // "type" 필드로도 추가하여 TransactionDistribution과 완전히 동일하게
        type: String(baseDisplayName).trim(),
        displayName: String(baseDisplayName).trim(),
        // Bar dataKey로 사용할 값 (TransactionDistribution의 "displayValue"와 동일)
        displayValue: Number(displayValue) || 0,
        // TransactionDistribution과 동일한 필드 구조
        color: getStatusColor(item.stockStatus),
        // 고유 식별자 (TransactionDistribution의 "id"와 동일)
        id: `${item.item_id || index}`
      };
      
      // displayName 검증
      if (!processedItem.displayName || processedItem.displayName.length === 0) {
        processedItem.displayName = `Item-${index}`;
      }
      
      // 디버깅: 데이터 구조 확인
      if (process.env.NODE_ENV === 'development' && index === 0) {
        console.log('[TopItemsByValue] First processed item (simplified):', {
          displayName: processedItem.displayName,
          displayValue: processedItem.displayValue,
          type: processedItem.type,
          typeType: typeof processedItem.type,
          valueType: typeof processedItem.displayValue,
          hasDisplayName: 'displayName' in processedItem,
          hasDisplayValue: 'displayValue' in processedItem,
          hasType: 'type' in processedItem,
          keys: Object.keys(processedItem)
        });
      }
      
      return processedItem;
    });
    
    // displayName/type 중복 방지
    const nameCounts = new Map<string, number>();
    result.forEach((item, index) => {
      const baseName = item.displayName && item.displayName.trim().length > 0
        ? item.displayName.trim()
        : `Item-${item.rank ?? index + 1}`;
      const existingCount = nameCounts.get(baseName) ?? 0;

      if (existingCount === 0) {
        nameCounts.set(baseName, 1);
        item.displayName = baseName;
        item.type = baseName;
        return;
      }

      nameCounts.set(baseName, existingCount + 1);

      const identifier = (item.item_code || item.item_id || String(existingCount + 1)).toString();
      let suffix = existingCount + 1;
      let candidate = `${baseName} (${identifier})`.trim();

      while (nameCounts.has(candidate)) {
        suffix += 1;
        candidate = `${baseName} (${identifier}-${suffix})`.trim();
      }

      item.displayName = candidate;
      item.type = candidate;
      nameCounts.set(candidate, 1);
    });
    
    // 디버깅: 개발 환경에서만 로그 출력
    if (process.env.NODE_ENV === 'development') {
      // type 필드 값 및 중복 검사
      const typeValues = result.map(r => r.type);
      const typeCounts: Record<string, number> = {};
      typeValues.forEach(type => {
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
      const duplicates = Object.entries(typeCounts).filter(([type, count]) => (count as number) > 1);
      
      console.log('[TopItemsByValue] Processed data:', {
        inputDataLength: data?.length || 0,
        normalizedCount: normalizedData.length,
        filteredCount: filtered.length,
        topItemsCount: topItems.length,
        resultCount: result.length,
        firstItem: result[0],
        displayValues: result.map(r => r.displayValue),
        typeValues: typeValues,
        typeCounts: typeCounts,
        duplicates: duplicates,
        hasDuplicates: duplicates.length > 0,
        isEmpty: result.length === 0,
        willRenderChart: result.length > 0
      });
      
      // 실제 렌더링 조건 확인
      if (result.length > 0) {
        console.log('[TopItemsByValue] Will render chart with:', result.length, 'items');
        if (duplicates.length > 0) {
          console.warn('[TopItemsByValue] WARNING: Duplicate type values found:', duplicates);
        }
      } else {
        console.warn('[TopItemsByValue] Will NOT render chart - empty data');
      }
    }
    
    return result;
  }, [data, sortMetric, topCount, categoryFilter]);

  // Get stock status color
  function getStatusColor(status: string) {
    switch (status) {
      case 'low':
        return theme.colors[4]; // Red
      case 'normal':
        return theme.colors[1]; // Green
      case 'high':
        return theme.colors[0]; // Blue
      case 'overstock':
        return theme.colors[3]; // Orange
      default:
        return theme.colors[5]; // Gray
    }
  }

  // Calculate statistics
  const stats = useMemo(() => {
    if (!processedData.length) return null;

    const totalValue = processedData.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    const totalVolume = processedData.reduce((sum, item) => sum + (item.monthlyVolume || 0), 0);
    const avgTurnover = processedData.length > 0
      ? processedData.reduce((sum, item) => sum + (item.turnoverRate || 0), 0) / processedData.length
      : 0;
    const topItem = processedData[0];
    const topItemPercentage = totalValue > 0 && topItem && topItem.totalValue !== undefined
      ? (topItem.totalValue / totalValue) * 100
      : 0;

    return {
      totalValue,
      totalVolume,
      avgTurnover,
      topItem: topItem.item_name,
      topItemValue: topItem.totalValue,
      topItemPercentage,
      lowStockCount: processedData.filter(item => item.stockStatus === 'low').length,
      overstockCount: processedData.filter(item => item.stockStatus === 'overstock').length
    };
  }, [processedData, data]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      return (
        <div
          className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-600 rounded-lg min-w-[280px]"
          style={theme.tooltip.contentStyle}
        >
          <div className="flex items-center space-x-2 mb-3">
            <Crown className="w-4 h-4 text-gray-500" />
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              #{data.rank} {data.item_name}
            </p>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">품목코드</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  {data.item_code}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">카테고리</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  {data.category}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">재고가치</p>
                <p className="font-medium text-gray-600 text-sm">
                  ₩{formatKoreanNumber(data.totalValue)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">현재고</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  {formatKoreanNumber(data.currentStock)}개
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">단가</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  ₩{formatKoreanNumber(data.unitPrice)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">월 거래량</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  {formatKoreanNumber(data.monthlyVolume)}개
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">회전율:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  {data.turnoverRate.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">재고상태:</span>
                <span className={`font-medium text-sm ${
                  data.stockStatus === 'low' ? 'text-gray-600'
                  : data.stockStatus === 'normal' ? 'text-gray-600'
                  : data.stockStatus === 'high' ? 'text-gray-600'
                  : 'text-gray-600'
                }`}>
                  {data.stockStatus === 'low' ? '부족'
                   : data.stockStatus === 'normal' ? '정상'
                   : data.stockStatus === 'high' ? '충분'
                   : '과재고'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">공급업체:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  {data.supplier}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Handle bar click
  const handleBarClick = (data: any) => {
    if (onItemClick) {
      onItemClick(data.item_id);
    }

    const newSelected = new Set(selectedItems);
    if (newSelected.has(data.item_id)) {
      newSelected.delete(data.item_id);
    } else {
      newSelected.add(data.item_id);
    }
    setSelectedItems(newSelected);
  };

  // Handle refresh with debounce
  const debouncedRefresh = debounce(() => {
    onRefresh?.();
  }, 1000);

  // Get metric label
  const getMetricLabel = () => {
    switch (sortMetric) {
      case 'value': return '재고가치';
      case 'volume': return '월 거래량';
      case 'turnover': return '회전율';
      case 'stock': return '현재고';
      default: return '재고가치';
    }
  };

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            상위 품목 (가치별)
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
          <Crown className="w-4 h-4 text-gray-500" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            상위 품목 ({getMetricLabel()})
          </h3>
          {stats && (
            <span className="ml-2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-lg">
              상위 {topCount}개 품목
            </span>
          )}
        </div>

        {/* Controls */}
        {showControls && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Top Count */}
            <select
              value={topCount}
              onChange={(e) => setTopCount(parseInt(e.target.value))}
              className="min-w-[100px] px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
            >
              <option value={5}>상위 5개</option>
              <option value={10}>상위 10개</option>
              <option value={20}>상위 20개</option>
            </select>

            {/* Sort Metric */}
            <select
              value={sortMetric}
              onChange={(e) => setSortMetric(e.target.value as SortMetric)}
              className="min-w-[120px] px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
            >
              <option value="value">재고가치</option>
              <option value="volume">거래량</option>
              <option value="turnover">회전율</option>
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
      <div className="h-64 sm:h-72 lg:h-80 min-h-[256px] sm:min-h-[288px] lg:min-h-[320px]" ref={chartRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
          </div>
        ) : !processedData || !Array.isArray(processedData) || processedData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              
              <p>표시할 품목 데이터가 없습니다</p>
              {categoryFilter !== 'all' && (
                <p className="text-sm text-gray-400 mt-1">
                  선택한 카테고리: {categoryFilter}
                </p>
              )}
              {process.env.NODE_ENV === 'development' && (
                <p className="text-xs mt-2">
                  Debug: processedData = {processedData ? 'exists' : 'null'}, length = {Array.isArray(processedData) ? processedData.length : 'N/A'}
                </p>
              )}
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={processedData}
              margin={{ top: 10, right: 20, left: 20, bottom: 50 }}
              syncId="topItemsChart"
              barCategoryGap="15%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={theme.cartesianGrid.stroke} />
              <XAxis
                dataKey="type"
                tick={{
                  ...theme.xAxis.tick,
                  fontSize: 10,
                  textAnchor: 'middle',
                  fill: isDark ? '#e5e7eb' : '#374151'
                } as any}
                axisLine={theme.xAxis.axisLine}
                height={40}
                interval={0}
              />
              <YAxis
                tickFormatter={(value) =>
                  sortMetric === 'value'
                    ? `₩${(value / 100000000).toFixed(1)}억`
                    : sortMetric === 'turnover'
                    ? value.toFixed(1)
                    : formatKoreanNumber(value)
                }
                tick={theme.yAxis.tick}
                axisLine={theme.yAxis.axisLine}
                domain={[0, 'dataMax']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={28}
                wrapperStyle={{ paddingTop: '8px' }}
                formatter={(value, entry) => {
                  const item = processedData.find(d => d.type === value || d.displayName === value);
                  if (!item) return value;
                  const percentage = stats && stats.totalValue > 0 
                    ? ((item.displayValue / (sortMetric === 'value' ? stats.totalValue : sortMetric === 'volume' ? stats.totalVolume : processedData.reduce((sum, i) => sum + i.currentStock, 0))) * 100).toFixed(1)
                    : '0.0';
                  return `${value} (${percentage}%)`;
                }}
                iconType="rect"
              />

              <Bar
                dataKey="displayValue"
                name={getMetricLabel()}
                onClick={handleBarClick}
                cursor="pointer"
                radius={[2, 2, 0, 0]}
                isAnimationActive={true}
                fill={theme.colors[0]}
              >
                {processedData.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.id || entry.item_id || index}`}
                    fill={selectedItems.has(entry.item_id)
                      ? theme.colors[6]
                      : showStockStatus
                      ? entry.color
                      : theme.colors[index % theme.colors.length]
                    }
                    opacity={selectedItems.size === 0 || selectedItems.has(entry.item_id) ? 1 : 0.3}
                  />
                ))}
              </Bar>

              {/* Average line */}
              {stats && (
                <ReferenceLine
                  x={sortMetric === 'value' ? stats.totalValue / processedData.length
                     : sortMetric === 'volume' ? stats.totalVolume / processedData.length
                     : sortMetric === 'turnover' ? stats.avgTurnover
                     : processedData.reduce((sum, item) => sum + item.currentStock, 0) / processedData.length}
                  stroke={theme.colors[3]}
                  strokeDasharray="5 5"
                  label={{ value: "평균", position: "insideTopRight" }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Statistics Summary */}
      {!loading && processedData.length > 0 && stats && (
        <div className="mt-3 grid grid-cols-3 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">1위 품목</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {stats.topItem}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ({isNaN(stats.topItemPercentage) ? '0.0' : stats.topItemPercentage.toFixed(1)}%)
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">총 재고가치</p>
            <p className="text-base font-semibold text-gray-600">
              ₩{formatKoreanNumber(stats.totalValue)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">재고 이슈</p>
            <p className="text-base font-semibold text-gray-600">
              {stats.lowStockCount + stats.overstockCount}개
            </p>
          </div>
        </div>
      )}

      {/* Selected Items Info */}
      {selectedItems.size > 0 && (
        <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm text-gray-800 dark:text-gray-300 font-medium">
                선택된 품목: {selectedItems.size}개
              </span>
            </div>
            <button
              onClick={() => setSelectedItems(new Set())}
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