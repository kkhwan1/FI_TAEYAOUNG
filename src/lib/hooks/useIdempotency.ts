/**
 * Idempotency Hook
 * 중복 제출 방지를 위한 React Hook
 */
import { useState, useRef, useCallback } from 'react';
import { generateIdempotencyKey, extractKeyData } from '@/lib/utils/idempotency';

interface UseIdempotencyOptions {
  userId: number | string;
  enabled?: boolean;
}

export function useIdempotency({ userId, enabled = true }: UseIdempotencyOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 중복 제출 방지된 fetch 함수
   */
  const fetchWithIdempotency = useCallback(
    async (
      url: string,
      options: RequestInit & { body?: any } = {}
    ): Promise<Response> => {
      if (!enabled) {
        // Idempotency가 비활성화된 경우 일반 fetch
        return fetch(url, options);
      }

      // 이미 제출 중인 경우 중복 제출 방지
      if (isSubmitting) {
        throw new Error('이미 처리 중인 요청이 있습니다. 잠시 후 다시 시도해주세요.');
      }

      // 이전 요청 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // 새로운 AbortController 생성
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsSubmitting(true);

      try {
        // Idempotency Key 생성
        const requestBody = options.body 
          ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body)
          : {};
        
        const keyData = extractKeyData(requestBody);
        const idempotencyKey = generateIdempotencyKey(userId, keyData);
        setCurrentKey(idempotencyKey);

        // 헤더에 Idempotency Key 추가
        const headers = new Headers(options.headers);
        headers.set('Idempotency-Key', idempotencyKey);

        // Request body 처리
        let body = options.body;
        if (body && typeof body === 'object' && !(body instanceof FormData)) {
          body = JSON.stringify(body);
          headers.set('Content-Type', 'application/json');
        }

        // Fetch 요청
        const response = await fetch(url, {
          ...options,
          headers,
          body,
          signal: abortController.signal,
        });

        return response;
      } finally {
        // 요청 완료 후 상태 초기화
        setIsSubmitting(false);
        setCurrentKey(null);
        abortControllerRef.current = null;
      }
    },
    [userId, enabled, isSubmitting]
  );

  /**
   * 제출 상태 초기화 (에러 처리 시)
   */
  const resetSubmission = useCallback(() => {
    setIsSubmitting(false);
    setCurrentKey(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    fetchWithIdempotency,
    isSubmitting,
    currentKey,
    resetSubmission,
  };
}

