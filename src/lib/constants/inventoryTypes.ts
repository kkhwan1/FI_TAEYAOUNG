/**
 * 재고 분류 타입 및 상수 정의
 *
 * 이 파일은 전체 시스템에서 사용되는 재고 분류 타입을 중앙집중식으로 관리합니다.
 * - Database CHECK 제약조건과 일치
 * - Zod 검증 스키마와 동기화
 * - UI 컴포넌트에서 공유 사용
 *
 * @see supabase/migrations/20250202_add_inventory_classification.sql
 * @see supabase/migrations/20250202_add_coil_inventory_type.sql
 * @see src/lib/validation.ts (InventoryTypeSchema)
 */

// ============================================
// 재고 분류 (Inventory Type)
// ============================================

/** 재고 분류 타입 (완제품/반제품/고객재고/원재료/코일) */
export type InventoryType = '완제품' | '반제품' | '고객재고' | '원재료' | '코일';

/** 재고 분류 옵션 배열 */
export const INVENTORY_TYPE_VALUES: readonly InventoryType[] = [
  '완제품',
  '반제품',
  '고객재고',
  '원재료',
  '코일'
] as const;

/** 재고 분류 드롭다운 옵션 (label + value) */
export const INVENTORY_TYPE_OPTIONS = INVENTORY_TYPE_VALUES.map(value => ({
  value,
  label: value
}));

/** 재고 분류별 설명 */
export const INVENTORY_TYPE_DESCRIPTIONS: Record<InventoryType, string> = {
  '완제품': '최종 완성된 제품',
  '반제품': '제조 과정 중인 부분품',
  '고객재고': '고객 위탁 보관 재고',
  '원재료': '생산에 사용되는 원자재',
  '코일': '코일 형태 원자재 (블랭킹 전단)'
};

/** 재고 분류 타입 체크 함수 */
export function isValidInventoryType(value: unknown): value is InventoryType {
  return typeof value === 'string' && INVENTORY_TYPE_VALUES.includes(value as InventoryType);
}

// ============================================
// 품질 상태 (Quality Status)
// ============================================

/** 품질 상태 타입 */
export type QualityStatus = '검수중' | '합격' | '불합격' | '보류';

/** 품질 상태 옵션 배열 */
export const QUALITY_STATUS_VALUES: readonly QualityStatus[] = [
  '검수중',
  '합격',
  '불합격',
  '보류'
] as const;

/** 품질 상태 드롭다운 옵션 */
export const QUALITY_STATUS_OPTIONS = QUALITY_STATUS_VALUES.map(value => ({
  value,
  label: value
}));

/** 품질 상태별 색상 (Tailwind classes) - 흑백 테마 */
export const QUALITY_STATUS_COLORS: Record<QualityStatus, string> = {
  '검수중': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-600',
  '합격': 'bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white border border-gray-400 dark:border-gray-500',
  '불합격': 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white border-2 border-gray-500 dark:border-gray-400',
  '보류': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border border-dashed border-gray-400 dark:border-gray-500'
};

/** 품질 상태 타입 체크 함수 */
export function isValidQualityStatus(value: unknown): value is QualityStatus {
  return typeof value === 'string' && QUALITY_STATUS_VALUES.includes(value as QualityStatus);
}

// ============================================
// 비즈니스 규칙 (Business Rules)
// ============================================

/** 고객재고 타입인지 확인 */
export function isCustomerStock(inventoryType?: InventoryType | null): boolean {
  return inventoryType === '고객재고';
}

/** 완제품 타입인지 확인 */
export function isFinishedProduct(inventoryType?: InventoryType | null): boolean {
  return inventoryType === '완제품';
}

/** 코일 타입인지 확인 */
export function isCoilType(inventoryType?: InventoryType | null): boolean {
  return inventoryType === '코일';
}

/**
 * 재고 분류별 필수 필드 체크
 * @param inventoryType 재고 분류
 * @param warehouseZone 보관 구역
 * @returns 검증 결과 및 에러 메시지
 */
export function validateInventoryClassification(
  inventoryType?: InventoryType | null,
  warehouseZone?: string | null
): { valid: boolean; error?: string } {
  // 고객재고는 보관 구역 필수
  if (isCustomerStock(inventoryType) && !warehouseZone) {
    return {
      valid: false,
      error: '고객재고는 보관 구역이 필수입니다'
    };
  }

  return { valid: true };
}

/**
 * 보관 구역 형식 검증 (예: A-01, B-03)
 * @param zone 보관 구역
 * @returns 검증 결과
 */
export function isValidWarehouseZone(zone?: string | null): boolean {
  if (!zone) return true; // Optional field
  return /^[A-Z]-\d{2}$/.test(zone);
}
