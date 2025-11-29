/**
 * Idempotency Key 유틸리티
 * 중복 입력 방지를 위한 고유 키 생성 및 검증
 */

/**
 * Idempotency Key 생성
 * 요청 내용의 해시값과 타임스탬프를 조합하여 고유 키 생성
 */
export function generateIdempotencyKey(
  userId: number | string,
  requestBody: Record<string, any>,
  timestamp?: number
): string {
  const ts = timestamp || Date.now();
  
  // 요청 본문을 문자열로 변환하여 해시 생성
  const bodyString = JSON.stringify(requestBody, Object.keys(requestBody).sort());
  
  // 간단한 해시 함수 (실제 운영환경에서는 crypto API 사용 권장)
  let hash = 0;
  for (let i = 0; i < bodyString.length; i++) {
    const char = bodyString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit 정수로 변환
  }
  
  // 양수로 변환
  const hashString = Math.abs(hash).toString(36);
  
  return `${userId}-${ts}-${hashString}`;
}

/**
 * Idempotency Key에서 정보 추출
 */
export function parseIdempotencyKey(key: string): {
  userId: string;
  timestamp: number;
  hash: string;
} | null {
  const parts = key.split('-');
  if (parts.length < 3) return null;
  
  const userId = parts[0];
  const timestamp = parseInt(parts[1], 10);
  const hash = parts.slice(2).join('-');
  
  if (isNaN(timestamp)) return null;
  
  return { userId, timestamp, hash };
}

/**
 * 요청 본문에서 Idempotency Key 생성용 데이터 추출
 */
export function extractKeyData(requestBody: Record<string, any>): Record<string, any> {
  // 시간에 따라 변할 수 있는 필드 제외 (timestamp, created_at 등)
  const excludedFields = [
    'created_at',
    'updated_at',
    'timestamp',
    'idempotency_key',
    'id',
  ];
  
  const keyData: Record<string, any> = {};
  for (const [key, value] of Object.entries(requestBody)) {
    if (!excludedFields.includes(key) && value !== undefined && value !== null) {
      keyData[key] = value;
    }
  }
  
  return keyData;
}

