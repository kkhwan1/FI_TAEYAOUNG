/**
 * API 레벨 Idempotency Key 검증
 * 중복 요청을 방지하기 위한 검증 로직
 */

interface IdempotencyCache {
  key: string;
  response: {
    status: number;
    body: any;
  };
  timestamp: number;
}

// 메모리 캐시 (실제 운영환경에서는 Redis 등을 사용 권장)
// TTL: 1시간 (3600000ms)
const IDEMPOTENCY_CACHE_TTL = 60 * 60 * 1000;
const idempotencyCache = new Map<string, IdempotencyCache>();

/**
 * Idempotency Key 검증 및 캐싱
 * @param key Idempotency Key
 * @param generateResponse 응답 생성 함수 (중복이 아닐 때 실행)
 * @returns 캐시된 응답 또는 새로 생성된 응답
 */
export async function checkIdempotency<T>(
  key: string | null | undefined,
  generateResponse: () => Promise<{ status: number; body: T }>
): Promise<{ status: number; body: T; fromCache: boolean }> {
  // Idempotency Key가 없는 경우 그대로 진행
  if (!key) {
    const response = await generateResponse();
    return { ...response, fromCache: false };
  }

  // 캐시된 응답 확인
  const cached = idempotencyCache.get(key);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    
    // TTL 내에 있는 경우 캐시된 응답 반환
    if (age < IDEMPOTENCY_CACHE_TTL) {
      return {
        status: cached.response.status,
        body: cached.response.body as T,
        fromCache: true,
      };
    } else {
      // TTL이 지난 경우 캐시 제거
      idempotencyCache.delete(key);
    }
  }

  // 새로운 응답 생성
  const response = await generateResponse();
  
  // 성공 응답만 캐시 (에러는 캐시하지 않음)
  if (response.status >= 200 && response.status < 400) {
    idempotencyCache.set(key, {
      key,
      response: {
        status: response.status,
        body: response.body,
      },
      timestamp: Date.now(),
    });
  }

  return {
    ...response,
    fromCache: false,
  };
}

/**
 * 캐시 정리 (오래된 항목 제거)
 */
export function cleanupIdempotencyCache(): void {
  const now = Date.now();
  for (const [key, cached] of idempotencyCache.entries()) {
    const age = now - cached.timestamp;
    if (age >= IDEMPOTENCY_CACHE_TTL) {
      idempotencyCache.delete(key);
    }
  }
}

// 주기적으로 캐시 정리 (1시간마다)
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupIdempotencyCache, IDEMPOTENCY_CACHE_TTL);
}

