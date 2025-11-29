'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import {
  Database,
  MemoryStick,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Monitor,
  Cpu,
  Minus
} from 'lucide-react';

// Type definitions
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  responseTime: number;
  checks: {
    database: {
      status: string;
      responseTime: number;
      connectionPool: {
        active: number;
        idle: number;
        total: number;
        limit: number;
        utilizationPercent: number;
      };
      error?: string;
    };
    memory: {
      status: string;
      usage: number;
      heap: number;
      external: number;
      limit: number;
    };
    system: {
      status: string;
      nodeVersion: string;
      platform: string;
      architecture: string;
      pid: number;
      uptime: number;
      environment: string;
    };
  };
  timestamp: string;
  correlationId: string;
}

interface Metrics {
  timestamp: number;
  requestCount: number;
  responseTime: {
    avg: number;
    min: number;
    max: number;
    p95: number;
  };
  errorRate: number;
  dbConnections: {
    active: number;
    idle: number;
    total: number;
  };
  memory: {
    usage: number;
    heap: number;
    external: number;
  };
  businessMetrics: {
    totalItems: number;
    totalCompanies: number;
    totalTransactions: number;
    lowStockItems: number;
  };
}

export default function MonitoringDashboard() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

  // Fetch health status
  const fetchHealthStatus = async () => {
    try {
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setHealthStatus(data);
    } catch (err) {
      console.error('Error fetching health status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Fetch metrics
  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/metrics?detailed=true');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        await Promise.all([fetchHealthStatus(), fetchMetrics()]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(async () => {
      try {
        await Promise.all([fetchHealthStatus(), fetchMetrics()]);
      } catch (err) {
        console.error('Auto refresh error:', err);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // Manual refresh
  const handleRefresh = async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([fetchHealthStatus(), fetchMetrics()]);
    } finally {
      setLoading(false);
    }
  };

  // Format uptime
  const formatUptime = (ms: number | undefined) => {
    if (!ms || isNaN(ms)) return '0분';
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}일 ${hours}시간 ${minutes}분`;
    if (hours > 0) return `${hours}시간 ${minutes}분`;
    return `${minutes}분`;
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
      case 'degraded':
        return ;
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
      default:
        return <Minus className="w-5 h-5 text-gray-500" />;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'degraded':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'unhealthy':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get trend icon
  const getTrendIcon = (value: number, threshold: number) => {
    if (value > threshold) return ;
    if (value < threshold * 0.5) return ;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  if (loading && !healthStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span>모니터링 데이터를 로드하는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">시스템 모니터링</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            실시간 시스템 상태 및 성능 지표
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label htmlFor="auto-refresh-toggle" className="text-sm text-gray-600 dark:text-gray-400">자동 새로고침</label>
            <input
              id="auto-refresh-toggle"
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="refresh-interval-select" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              새로고침 간격
            </label>
            <select
              id="refresh-interval-select"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-600"
              disabled={!autoRefresh}
            >
              <option value={10000}>10초</option>
              <option value={30000}>30초</option>
              <option value={60000}>1분</option>
              <option value={300000}>5분</option>
            </select>
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-400">오류: {error}</span>
          </div>
        </div>
      )}

      {/* Overall System Status */}
      {healthStatus && (
        <div className={`border rounded-lg p-6 ${getStatusColor(healthStatus.status || 'unknown')}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getStatusIcon(healthStatus.status || 'unknown')}
              <div>
                <h2 className="text-xl font-semibold">전체 시스템 상태</h2>
                <p className="text-sm opacity-75">
                  마지막 확인: {healthStatus.timestamp ? new Date(healthStatus.timestamp).toLocaleString('ko-KR') : 'N/A'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{healthStatus.status?.toUpperCase() || 'UNKNOWN'}</div>
              <div className="text-sm">응답시간: {healthStatus.responseTime || 0}ms</div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Uptime */}
        {healthStatus && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">시스템 가동시간</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatUptime(healthStatus.uptime || healthStatus.checks?.system?.uptime)}
                </p>
              </div>
              <Clock className="w-8 h-8 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        )}

        {/* Memory Usage */}
        {healthStatus && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">메모리 사용량</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(healthStatus.checks.memory.usage)}MB
                </p>
                <p className="text-xs text-gray-500">
                  / {healthStatus.checks.memory.limit}MB
                </p>
              </div>
              <div className="flex items-center space-x-1">
                <MemoryStick className="w-8 h-8 text-gray-600 dark:text-gray-400" />
                {getTrendIcon(healthStatus.checks.memory.usage, healthStatus.checks.memory.limit * 0.8)}
              </div>
            </div>
          </div>
        )}

        {/* Database Connections */}
        {healthStatus && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">DB 연결</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {healthStatus.checks.database.connectionPool.total}
                </p>
                <p className="text-xs text-gray-500">
                  활성: {healthStatus.checks.database.connectionPool.active} /
                  유휴: {healthStatus.checks.database.connectionPool.idle}
                </p>
              </div>
              <div className="flex items-center space-x-1">
                <Database className="w-8 h-8 text-gray-600 dark:text-gray-400" />
                {getTrendIcon(
                  healthStatus.checks.database.connectionPool.utilizationPercent,
                  80
                )}
              </div>
            </div>
          </div>
        )}

        {/* Request Count */}
        {metrics && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">총 요청 수</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metrics.requestCount?.toLocaleString() || '0'}
                </p>
                <p className="text-xs text-gray-500">
                  오류율: {(metrics.errorRate || 0).toFixed(2)}%
                </p>
              </div>
              <div className="flex items-center space-x-1">
                
                {getTrendIcon(metrics.errorRate, 5)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Information */}
        {healthStatus && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Monitor className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">시스템 정보</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Node.js 버전</span>
                <span className="text-sm font-medium">{healthStatus.checks.system.nodeVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">플랫폼</span>
                <span className="text-sm font-medium">{healthStatus.checks.system.platform}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">아키텍처</span>
                <span className="text-sm font-medium">{healthStatus.checks.system.architecture}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">환경</span>
                <span className="text-sm font-medium">{healthStatus.checks.system.environment}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">프로세스 ID</span>
                <span className="text-sm font-medium">{healthStatus.checks.system.pid}</span>
              </div>
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        {metrics && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Cpu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">성능 지표</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">평균 응답시간</span>
                <span className="text-sm font-medium">{metrics.responseTime?.avg?.toFixed(2) || '0.00'}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">95% 응답시간</span>
                <span className="text-sm font-medium">{metrics.responseTime?.p95?.toFixed(2) || '0.00'}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">최소 응답시간</span>
                <span className="text-sm font-medium">{metrics.responseTime?.min?.toFixed(2) || '0.00'}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">최대 응답시간</span>
                <span className="text-sm font-medium">{metrics.responseTime?.max?.toFixed(2) || '0.00'}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">힙 메모리</span>
                <span className="text-sm font-medium">{Math.round(metrics.memory?.heap || 0)}MB</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Business Metrics */}
      {metrics && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">비즈니스 지표</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {metrics.businessMetrics?.totalItems?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">총 품목 수</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {metrics.businessMetrics?.totalCompanies?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">총 거래처 수</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {metrics.businessMetrics?.totalTransactions?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">월간 거래 수</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {(metrics.businessMetrics?.lowStockItems || 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">재고 부족 품목</div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        <p>마지막 업데이트: {new Date().toLocaleString('ko-KR')}</p>
        {healthStatus && (
          <p className="mt-1">시스템 버전: {healthStatus.version} | 상관관계 ID: {healthStatus.correlationId}</p>
        )}
      </div>
    </div>
  );
}