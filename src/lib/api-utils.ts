import { NextResponse } from 'next/server';

/**
 * API 에러 클래스
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * 전역 API 에러 핸들러
 */
export function handleAPIError(error: unknown): NextResponse {
  // 구조화된 로깅
  const logData = {
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    type: error instanceof APIError ? 'APIError' : 'UnexpectedError'
  };

  console.error('[API Error]', JSON.stringify(logData));

  // APIError인 경우 상세 정보 반환
  if (error instanceof APIError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        timestamp: new Date().toISOString()
      },
      { status: error.statusCode }
    );
  }

  // 예상치 못한 에러인 경우 일반적인 에러 메시지 반환
  return NextResponse.json(
    {
      success: false,
      error: '서버 오류가 발생했습니다.',
      timestamp: new Date().toISOString()
    },
    { status: 500 }
  );
}

/**
 * 입력값 검증 헬퍼
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[]
): string[] {
  const errors: string[] = [];
  
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors.push(`${field}는 필수 입력 항목입니다.`);
    }
  }
  
  return errors;
}

/**
 * 숫자 검증 헬퍼
 */
export function validateNumber(value: any, fieldName: string): number {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) {
    throw new APIError(`${fieldName}는 유효한 숫자여야 합니다.`, 400, 'INVALID_NUMBER');
  }
  return num;
}

/**
 * 문자열 검증 헬퍼
 */
export function validateString(value: any, fieldName: string, maxLength?: number): string {
  if (typeof value !== 'string') {
    throw new APIError(`${fieldName}는 문자열이어야 합니다.`, 400, 'INVALID_STRING');
  }
  
  if (maxLength && value.length > maxLength) {
    throw new APIError(`${fieldName}는 ${maxLength}자를 초과할 수 없습니다.`, 400, 'STRING_TOO_LONG');
  }
  
  return value.trim();
}

/**
 * 날짜 검증 헬퍼
 */
export function validateDate(value: any, fieldName: string): Date {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new APIError(`${fieldName}는 유효한 날짜여야 합니다.`, 400, 'INVALID_DATE');
  }
  return date;
}

/**
 * 배열 검증 헬퍼
 */
export function validateArray(value: any, fieldName: string, minLength?: number, maxLength?: number): any[] {
  if (!Array.isArray(value)) {
    throw new APIError(`${fieldName}는 배열이어야 합니다.`, 400, 'INVALID_ARRAY');
  }

  if (minLength !== undefined && value.length < minLength) {
    throw new APIError(`${fieldName}는 최소 ${minLength}개 이상이어야 합니다.`, 400, 'ARRAY_TOO_SHORT');
  }

  if (maxLength !== undefined && value.length > maxLength) {
    throw new APIError(`${fieldName}는 최대 ${maxLength}개 이하여야 합니다.`, 400, 'ARRAY_TOO_LONG');
  }

  return value;
}

/**
 * 안전한 parseInt - NaN 반환 방지
 */
export function safeParseInt(value: string | null | undefined, fallback: number = 0): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * 안전한 JSON 파싱
 */
export function safeJsonParse<T>(text: string): { data: T | null; error: string | null } {
  try {
    return { data: JSON.parse(text), error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'JSON 파싱 오류' };
  }
}

/**
 * 안전한 Math.max - 빈 배열 처리
 */
export function safeMathMax(arr: number[], fallback: number = 0): number {
  return arr.length > 0 ? Math.max(...arr) : fallback;
}
