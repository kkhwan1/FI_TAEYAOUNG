/**
 * Chart utilities for ERP dashboard
 * Handles Korean formatting, themes, and chart configurations
 */

import type { ChartOptions } from 'chart.js';

// Korean number formatting (천단위 구분만, 축약 없음)
export const formatKoreanNumber = (value: number): string => {
  // Handle NaN, null, undefined
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  return value.toLocaleString('ko-KR');
};

// Korean number formatting with abbreviation (기존 함수 - 만/억 축약)
export const formatKoreanNumberAbbrev = (value: number): string => {
  // Handle NaN, null, undefined
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)}억`;
  } else if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}만`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}천`;
  }
  return value.toLocaleString('ko-KR');
};

// Korean currency formatting
export const formatKoreanCurrency = (value: number): string => {
  return `₩${formatKoreanNumber(value)}`;
};

// Korean percentage formatting
export const formatKoreanPercent = (value: number): string => {
  // Handle NaN, null, undefined
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  
  return `${value.toFixed(1)}%`;
};

// Color schemes for charts (Grayscale - SAP Style)
export const colorSchemes = {
  light: {
    primary: '#262626',      // Gray-800
    secondary: '#525252',    // Gray-600
    accent: '#404040',       // Gray-700
    warning: '#525252',      // Gray-600 (SAP Grayscale)
    danger: '#262626',       // Gray-800 (SAP Grayscale)
    success: '#737373',      // Gray-500 (SAP Grayscale)
    info: '#525252',         // Gray-600 (SAP Grayscale)
    
    background: '#FFFFFF',
    surface: '#F9FAFB',
    border: '#E5E7EB',
    
    text: '#1F2937',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    
    gridLines: '#E5E7EB',
    
    chart: {
      primary: '#262626',
      secondary: '#525252',
      tertiary: '#737373',
      quaternary: '#A3A3A3',
      quinary: '#D4D4D4'
    }
  },
  dark: {
    primary: '#E5E5E5',      // Light Gray
    secondary: '#A3A3A3',    // Gray-400
    accent: '#737373',       // Gray-500
    warning: '#A3A3A3',      // Gray-400 (SAP Grayscale)
    danger: '#E5E5E5',       // Light Gray (SAP Grayscale)
    success: '#D4D4D4',      // Gray-300 (SAP Grayscale)
    info: '#A3A3A3',         // Gray-400 (SAP Grayscale)
    
    background: '#111827',
    surface: '#1F2937',
    border: '#374151',
    
    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
    textTertiary: '#9CA3AF',
    
    gridLines: '#374151',
    
    chart: {
      primary: '#E5E5E5',
      secondary: '#A3A3A3',
      tertiary: '#737373',
      quaternary: '#525252',
      quinary: '#404040'
    }
  }
};

/**
 * Get theme-appropriate colors
 * @param isDark Whether dark mode is active
 * @returns Color scheme object
 */
export const getTheme = (isDark: boolean = false) => {
  return isDark ? colorSchemes.dark : colorSchemes.light;
};

/**
 * Get transaction type color
 * @param type Transaction type (입고, 출고, 생산, 조정)
 * @param isDark Whether dark mode is active
 * @returns Color string
 */
export const getTransactionTypeColor = (type: string, isDark: boolean = false) => {
  const theme = isDark ? colorSchemes.dark : colorSchemes.light;

  switch (type) {
    case '입고':
      return theme.secondary;
    case '출고':
      return theme.primary;
    case '생산':
      return theme.warning;
    case '조정':
      return theme.accent;
    default:
      return theme.textSecondary;
  }
};

/**
 * Get color based on stock level relative to minimum
 * Returns danger color if below minimum, warning if near minimum, success if above
 */
export const getStockLevelColor = (current: number, minimum: number, isDark: boolean = false): string => {
  const theme = isDark ? colorSchemes.dark : colorSchemes.light;

  if (current < minimum) {
    return theme.danger; // Below minimum - red/danger
  } else if (current < minimum * 1.5) {
    return theme.warning; // Near minimum - yellow/warning
  } else {
    return theme.secondary; // Above minimum - green/success
  }
};

/**
 * Chart.js default options with Korean settings
 */
export const defaultChartOptions: ChartOptions<any> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
      display: true,
      position: 'top' as const,
        labels: {
        usePointStyle: true,
        padding: 15,
          font: {
          size: 12,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", Arial, sans-serif'
          }
        }
      },
      tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: 12,
        titleFont: {
        size: 13,
        family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", Arial, sans-serif'
        },
        bodyFont: {
        size: 12,
        family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", Arial, sans-serif'
      },
      callbacks: {
        label: function(context: any) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed.y !== null) {
            label += formatKoreanNumber(context.parsed.y);
          }
          return label;
        }
        }
      }
    },
    scales: {
      x: {
        grid: {
        display: false
        },
        ticks: {
          font: {
          size: 11,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", Arial, sans-serif'
          }
        }
      },
      y: {
      beginAtZero: true,
        grid: {
        color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: {
          size: 11,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", Arial, sans-serif'
        },
        callback: function(value: any) {
          return formatKoreanNumber(value as number);
        }
      }
    }
  }
};

/**
 * Get chart colors for multiple datasets
 * @param count Number of colors needed
 * @param isDark Whether dark mode is active
 * @returns Array of color strings
 */
export const getChartColors = (count: number, isDark: boolean = false): string[] => {
  const theme = getTheme(isDark);
  const baseColors = [
    theme.chart.primary,
    theme.chart.secondary,
    theme.chart.tertiary,
    theme.chart.quaternary,
    theme.chart.quinary
  ];
  
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  
  return colors;
};

/**
 * Create gradient for chart background
 * @param ctx Canvas rendering context
 * @param colorStart Start color
 * @param colorEnd End color
 * @returns CanvasGradient
 */
export const createGradient = (
  ctx: CanvasRenderingContext2D,
  colorStart: string,
  colorEnd: string
): CanvasGradient => {
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(1, colorEnd);
  return gradient;
};

/**
 * Format date for chart labels
 * @param date Date string or Date object
 * @param format Format type ('short' | 'long' | 'month')
 * @returns Formatted date string
 */
export const formatChartDate = (
  date: string | Date,
  format: 'short' | 'long' | 'month' = 'short'
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  switch (format) {
    case 'long':
      return d.toLocaleDateString('ko-KR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    case 'month':
      return d.toLocaleDateString('ko-KR', { 
        year: 'numeric', 
        month: 'short'
      });
    case 'short':
    default:
      return d.toLocaleDateString('ko-KR', { 
        month: 'short', 
        day: 'numeric' 
      });
  }
};

/**
 * Calculate percentage change
 * @param current Current value
 * @param previous Previous value
 * @returns Percentage change as number
 */
/**
 * KPI 데이터 타입 정의
 */
interface KPIData {
  items: Array<{
    is_active: boolean;
    current_stock?: number;
    minimum_stock?: number;
    min_stock_level?: number;
  }>;
  transactions: Array<{
    transaction_date: string;
    quantity: number | string;
  }>;
  companies: Array<{
    is_active: boolean;
  }>;
}

interface KPIResult {
  totalItems: number;
  activeCompanies: number;
  monthlyVolume: number;
  lowStockItems: number;
  volumeChange: number;
  trends: {
    items: number;
    companies: number;
    volume: number;
    lowStock: number;
  };
}

/**
 * KPI 계산 함수
 * @param data KPI 계산에 필요한 데이터
 * @returns 계산된 KPI 결과
 */
export const calculateKPIs = (data: KPIData): KPIResult => {
  const { items, transactions, companies } = data;

  // 활성 품목 수 계산
  const totalItems = items.filter(item => item.is_active).length;

  // 활성 거래처 수 계산
  const activeCompanies = companies.filter(company => company.is_active).length;

  // 월별 거래량 계산
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyTransactions = transactions.filter(transaction => {
    const date = new Date(transaction.transaction_date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const monthlyVolume = monthlyTransactions.reduce((sum, transaction) => {
    return sum + (parseFloat(String(transaction.quantity)) || 0);
  }, 0);

  // 재고 부족 품목 수 계산
  const lowStockItems = items.filter(item => {
    const current = item.current_stock || 0;
    const minimum = item.minimum_stock || item.min_stock_level || 0;
    return current < minimum && item.is_active;
  }).length;

  // 전월 비교를 통한 트렌드 계산
  const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const previousMonthTransactions = transactions.filter(transaction => {
    const date = new Date(transaction.transaction_date);
    return date.getMonth() === previousMonth && date.getFullYear() === previousYear;
  });

  const previousMonthVolume = previousMonthTransactions.reduce((sum, transaction) => {
    return sum + (parseFloat(String(transaction.quantity)) || 0);
  }, 0);

  const volumeChange = previousMonthVolume > 0
    ? ((monthlyVolume - previousMonthVolume) / previousMonthVolume * 100)
    : 0;

  return {
    totalItems,
    activeCompanies,
    monthlyVolume,
    lowStockItems,
    volumeChange,
    trends: {
      items: 0, // API route에서 실제 계산 (전월 말 시점 활성 품목 수 기준)
      companies: 0, // API route에서 실제 계산 (전월 말 시점 활성 거래처 수 기준)
      volume: volumeChange, // 전월 대비 거래량 변화율
      lowStock: 0 // API route에서 실제 계산 (전월 말 시점 재고 수준 역산 기반)
    }
  };
};

export const calculatePercentChange = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

/**
 * Format percentage change with sign
 * @param change Percentage change value
 * @returns Formatted string with + or - sign
 */
export const formatPercentChange = (change: number): string => {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
};

/**
 * Aggregate data by time period
 * @param data Array of data with date field
 * @param period Aggregation period ('day' | 'week' | 'month')
 * @returns Aggregated data
 */
export const aggregateByPeriod = <T extends { date: string }>(
  data: T[],
  period: 'day' | 'week' | 'month'
): { [key: string]: T[] } => {
  const grouped: { [key: string]: T[] } = {};
  
  data.forEach(item => {
    const date = new Date(item.date);
    let key: string;
    
    switch (period) {
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'day':
      default:
        key = date.toISOString().split('T')[0];
    }
    
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  });
  
  return grouped;
};

/**
 * Format Korean date
 * @param date Date string or Date object
 * @returns Formatted Korean date string
 */
export const formatKoreanDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Get Recharts theme configuration
 * @param isDark Whether dark mode is active
 * @returns Recharts theme object
 */
export const getRechartsTheme = (isDark: boolean = false) => {
  const theme = getTheme(isDark);

  return {
    colors: getChartColors(5, isDark),
    tooltip: {
      contentStyle: {
        backgroundColor: isDark ? theme.surface : '#FFFFFF',
        border: `1px solid ${theme.border}`,
        borderRadius: '8px',
        padding: '12px'
      }
    },
    cartesianGrid: {
      stroke: theme.gridLines
    },
    xAxis: {
      tick: { fill: theme.textSecondary },
      axisLine: { stroke: theme.border }
    },
    yAxis: {
      tick: { fill: theme.textSecondary },
      axisLine: { stroke: theme.border }
    }
  };
};

/**
 * Export chart as image
 * @param chartRef Chart reference
 * @param filename Optional filename
 */
export const exportChartAsImage = (chartRef: any, filename: string = 'chart.png'): void => {
  if (!chartRef?.current) {
    console.warn('Chart reference is not available');
    return;
  }

  try {
    // For recharts
    const svg = chartRef.current.querySelector('svg');
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = filename;
            link.href = url;
            link.click();
          }
        });
      };

      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }
  } catch (error) {
    console.error('Failed to export chart:', error);
  }
};

/**
 * Print chart
 * @param chartRef Chart reference
 */
export const printChart = (chartRef: any): void => {
  if (!chartRef?.current) {
    console.warn('Chart reference is not available');
    return;
  }

  try {
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      const svg = chartRef.current.querySelector('svg');
      if (svg) {
        printWindow.document.write('<html><head><title>Print Chart</title></head><body>');
        printWindow.document.write(svg.outerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
      }
    }
  } catch (error) {
    console.error('Failed to print chart:', error);
  }
};

/**
 * Debounce function
 * @param func Function to debounce
 * @param wait Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function(...args: Parameters<T>) {
    if (timeout) {
    clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Throttle function
 * @param func Function to throttle
 * @param limit Limit time in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
