/**
 * Coil Process Tracking Type Definitions
 *
 * 코일 공정 추적 시스템의 TypeScript 타입 정의
 * - 코일 → 판재 변환 공정 이력 관리
 * - 수율 자동 계산
 * - 재고 자동 이동 통합
 *
 * @see supabase/migrations/20250202_coil_process_tracking.sql
 * @see supabase/migrations/20250202_coil_process_automation.sql
 */

import { Database } from './database.types';

// ============================================
// Database Row Types (from Supabase)
// ============================================

/** 코일 공정 이력 Row 타입 */
export type CoilProcessRow = Database['public']['Tables']['coil_process_history']['Row'];

/** 코일 공정 이력 Insert 타입 */
export type CoilProcessInsert = Database['public']['Tables']['coil_process_history']['Insert'];

/** 코일 공정 이력 Update 타입 */
export type CoilProcessUpdate = Database['public']['Tables']['coil_process_history']['Update'];

// ============================================
// Process Status & Types
// ============================================

/** 공정 진행 상태 */
export type ProcessStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/** 공정 유형 */
export type ProcessType = '블랭킹' | '전단' | '절곡' | '용접';

/** 공정 상태 한글 레이블 */
export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
  'PENDING': '대기',
  'IN_PROGRESS': '진행중',
  'COMPLETED': '완료',
  'CANCELLED': '취소'
};

/** 공정 상태 색상 (Tailwind classes) */
export const PROCESS_STATUS_COLORS: Record<ProcessStatus, string> = {
  'PENDING': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'IN_PROGRESS': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'COMPLETED': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'CANCELLED': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
};

/** 공정 유형 옵션 */
export const PROCESS_TYPE_OPTIONS = [
  { value: '블랭킹' as const, label: '블랭킹' },
  { value: '전단' as const, label: '전단' },
  { value: '절곡' as const, label: '절곡' },
  { value: '용접' as const, label: '용접' }
];

// ============================================
// API Request/Response Types
// ============================================

/** 코일 공정 생성 요청 */
export interface CreateCoilProcessRequest {
  source_item_id: number;        // 투입 코일 품목 ID (inventory_type='코일' 필수)
  process_type: ProcessType;      // 공정 유형
  target_item_id: number;         // 산출 품목 ID
  input_quantity: number;         // 투입 수량
  output_quantity: number;        // 산출 수량
  process_date?: string;          // 공정 날짜 (ISO 8601 형식, 기본값: 오늘)
  operator_id?: number | null;    // 담당 작업자 ID
  notes?: string | null;          // 비고
}

/** 코일 공정 완료 요청 */
export interface CompleteCoilProcessRequest {
  process_id: number;             // 완료할 공정 ID
}

/** 코일 공정 조회 필터 */
export interface CoilProcessFilters {
  status?: ProcessStatus;         // 상태별 필터링
  source_item_id?: number;        // 소스 품목별 필터링
  target_item_id?: number;        // 타겟 품목별 필터링
  process_type?: ProcessType;     // 공정 유형별 필터링
  start_date?: string;            // 시작 날짜 (process_date >=)
  end_date?: string;              // 종료 날짜 (process_date <=)
}

/** 코일 공정 상세 정보 (JOIN된 데이터) */
export interface CoilProcessWithDetails extends CoilProcessRow {
  // 소스 품목 정보
  source_item?: {
    item_id: number;
    item_code: string;
    item_name: string;
    spec?: string;
    inventory_type: string;
    current_stock: number;
    unit?: string;
  };

  // 타겟 품목 정보
  target_item?: {
    item_id: number;
    item_code: string;
    item_name: string;
    spec?: string;
    inventory_type: string;
    current_stock: number;
    unit?: string;
  };

  // 작업자 정보
  operator?: {
    user_id: number;
    name: string;
    email?: string;
  };
}

/** 코일 추적성 체인 */
export interface CoilTraceabilityChain {
  item_id: number;
  item_code: string;
  item_name: string;

  // 상류 공정 (이 품목을 생산한 공정들)
  upstream: Array<{
    process_id: number;
    process_type: ProcessType;
    source_item_id: number;
    source_item_code: string;
    source_item_name: string;
    input_quantity: number;
    output_quantity: number;
    yield_rate: number;
    process_date: string;
    status: ProcessStatus;
  }>;

  // 하류 공정 (이 품목을 사용한 공정들)
  downstream: Array<{
    process_id: number;
    process_type: ProcessType;
    target_item_id: number;
    target_item_code: string;
    target_item_name: string;
    input_quantity: number;
    output_quantity: number;
    yield_rate: number;
    process_date: string;
    status: ProcessStatus;
  }>;
}

// ============================================
// Validation Helpers
// ============================================

/** 공정 상태 유효성 검증 */
export function isValidProcessStatus(status: string): status is ProcessStatus {
  return ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status);
}

/** 공정 유형 유효성 검증 */
export function isValidProcessType(type: string): type is ProcessType {
  return ['블랭킹', '전단', '절곡', '용접'].includes(type);
}

/** 수율 계산 */
export function calculateYieldRate(input: number, output: number): number {
  if (input <= 0) return 0;
  return Math.round((output / input) * 100 * 100) / 100; // 소수점 2자리
}

/** 공정 완료 가능 여부 확인 */
export function canCompleteProcess(status: ProcessStatus): boolean {
  return status === 'PENDING' || status === 'IN_PROGRESS';
}

/** 공정 취소 가능 여부 확인 */
export function canCancelProcess(status: ProcessStatus): boolean {
  return status === 'PENDING' || status === 'IN_PROGRESS';
}
