/**
 * CompanyFilterContext
 *
 * Global context for company filter data with caching and deduplication.
 * Prevents multiple components from fetching the same data simultaneously.
 *
 * Features:
 * - Single source of truth for company data
 * - Request deduplication (prevents multiple simultaneous fetches)
 * - Automatic caching (data persists across component remounts)
 * - Stale-while-revalidate strategy (5분 캐시, 10분 stale)
 * - Error handling with retry capability
 * - ETag support for 304 Not Modified responses
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { CompanyOptionsResponse, CompanyData } from '@/types/api';

export interface CompanyOption {
  value: number;
  label: string;
}

interface CompanyFilterContextValue {
  companies: CompanyOption[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastFetchTime: number | null;
  isStale: boolean;
}

const CompanyFilterContext = createContext<CompanyFilterContextValue | undefined>(undefined);

// 캐시 설정
const CACHE_FRESH_TIME = 5 * 60 * 1000; // 5분 (fresh)
const CACHE_STALE_TIME = 10 * 60 * 1000; // 10분 (stale)

export function CompanyFilterProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);

  // Request deduplication: track in-flight requests
  const fetchInProgressRef = useRef<Promise<void> | null>(null);
  // ETag 캐싱
  const etagRef = useRef<string | null>(null);

  // 캐시 상태 확인
  const isStale = lastFetchTime ? Date.now() - lastFetchTime > CACHE_FRESH_TIME : true;
  const isCacheExpired = lastFetchTime ? Date.now() - lastFetchTime > CACHE_STALE_TIME : true;

  const fetchCompanies = useCallback(async (force: boolean = false) => {
    // If a fetch is already in progress, return that promise
    if (fetchInProgressRef.current) {
      return fetchInProgressRef.current;
    }

    // 캐시가 아직 유효하고 force가 아니면 스킵
    if (!force && !isCacheExpired && companies.length > 0) {
      return Promise.resolve();
    }

    // Create new fetch promise
    const fetchPromise = (async () => {
      try {
        setLoading(true);
        setError(null);

        // ETag 헤더 추가 (304 Not Modified 지원)
        const headers: HeadersInit = {};
        if (etagRef.current) {
          headers['If-None-Match'] = etagRef.current;
        }

        const response = await fetch('/api/companies/options', { headers });

        // 304 Not Modified: 캐시 유효, 데이터 그대로 사용
        if (response.status === 304) {
          setLastFetchTime(Date.now());
          return;
        }

        if (!response.ok) {
          throw new Error(`거래처 목록 조회 실패: ${response.status}`);
        }

        // ETag 저장
        const newEtag = response.headers.get('ETag');
        if (newEtag) {
          etagRef.current = newEtag;
        }

        const data = await response.json() as CompanyOptionsResponse;

        if (!data.success) {
          const errorMessage = (data as any).error || '거래처 목록 조회 실패';
          throw new Error(errorMessage);
        }

        // Transform API response to CompanyOption format
        const companyOptions: CompanyOption[] = data.data.map((company: CompanyData) => ({
          value: company.company_id,
          label: company.company_name,
        }));

        setCompanies(companyOptions);
        setLastFetchTime(Date.now());
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '거래처 목록 조회 중 오류가 발생했습니다';
        setError(errorMessage);
        toast.error(errorMessage);
        console.error('Company filter fetch error:', err);
      } finally {
        setLoading(false);
        fetchInProgressRef.current = null;
      }
    })();

    fetchInProgressRef.current = fetchPromise;
    return fetchPromise;
  }, [companies.length, isCacheExpired]);

  // Fetch on mount
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Stale-while-revalidate: 백그라운드 revalidation
  useEffect(() => {
    if (!isStale || !companies.length) return;

    // stale 상태이지만 데이터가 있으면 백그라운드에서 조용히 revalidate
    const timer = setTimeout(() => {
      fetchCompanies(false); // 조용히 갱신 (loading 상태 변경 없음)
    }, 1000);

    return () => clearTimeout(timer);
  }, [isStale, companies.length, fetchCompanies]);

  const value: CompanyFilterContextValue = {
    companies,
    loading,
    error,
    refetch: () => fetchCompanies(true), // force refetch
    lastFetchTime,
    isStale,
  };

  return (
    <CompanyFilterContext.Provider value={value}>
      {children}
    </CompanyFilterContext.Provider>
  );
}

/**
 * Hook to consume company filter data
 *
 * Automatically uses cached data from context, preventing duplicate fetches
 *
 * Returns:
 * - companies: 거래처 옵션 목록
 * - loading: 로딩 상태
 * - error: 에러 메시지
 * - refetch: 강제 재조회 함수
 * - lastFetchTime: 마지막 조회 시간 (ms)
 * - isStale: 캐시가 stale 상태인지 여부 (5분 경과)
 */
export function useCompanyFilter() {
  const context = useContext(CompanyFilterContext);

  if (context === undefined) {
    throw new Error('useCompanyFilter must be used within a CompanyFilterProvider');
  }

  return context;
}
