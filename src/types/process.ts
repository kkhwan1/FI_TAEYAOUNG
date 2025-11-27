/**
 * Process Operations Type Definitions
 *
 * Manufacturing process management types for:
 * - Blanking: 원자재(코일) → 반제품(판지)
 * - Press: 반제품(판지) → 완제품
 * - Assembly: 부품 조립
 *
 * @author Claude (Backend System Architect)
 * @date 2025-02-04
 */

// ============================================================================
// Core Enums
// ============================================================================

/**
 * 공정 유형
 */
export type OperationType = 'BLANKING' | 'PRESS' | 'ASSEMBLY';

/**
 * 작업 상태
 */
export type OperationStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// ============================================================================
// Base Types (Local Definitions - process_operations table not yet in DB)
// ============================================================================

/**
 * process_operations 테이블 기본 타입
 * Note: 아직 DB에 테이블이 생성되지 않아 로컬 정의 사용
 */
export interface ProcessOperation {
  operation_id: number;
  operation_type: OperationType;
  input_item_id: number;
  output_item_id: number;
  input_quantity: number;
  output_quantity: number;
  efficiency: number | null;
  operator_id: number | null;
  started_at: string | null;
  completed_at: string | null;
  status: OperationStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lot_number: string | null;
  parent_lot_number: string | null;
  child_lot_number: string | null;
  chain_id: string | null;
  chain_sequence: number | null;
  parent_operation_id: number | null;
  auto_next_operation: boolean | null;
  next_operation_type: string | null;
  quality_status: string | null;
  scrap_quantity: number | null;
  scheduled_date: string | null;
}

/**
 * process_operations INSERT 타입
 */
export interface ProcessOperationInsert {
  operation_id?: number;
  operation_type: OperationType;
  input_item_id: number;
  output_item_id: number;
  input_quantity: number;
  output_quantity: number;
  efficiency?: number | null;
  operator_id?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  status?: OperationStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  lot_number?: string | null;
  parent_lot_number?: string | null;
  child_lot_number?: string | null;
  chain_id?: string | null;
  chain_sequence?: number | null;
  parent_operation_id?: number | null;
  auto_next_operation?: boolean | null;
  next_operation_type?: string | null;
  quality_status?: string | null;
  scrap_quantity?: number | null;
  scheduled_date?: string | null;
}

/**
 * process_operations UPDATE 타입
 */
export interface ProcessOperationUpdate {
  operation_id?: number;
  operation_type?: OperationType;
  input_item_id?: number;
  output_item_id?: number;
  input_quantity?: number;
  output_quantity?: number;
  efficiency?: number | null;
  operator_id?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  status?: OperationStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  lot_number?: string | null;
  parent_lot_number?: string | null;
  child_lot_number?: string | null;
  chain_id?: string | null;
  chain_sequence?: number | null;
  parent_operation_id?: number | null;
  auto_next_operation?: boolean | null;
  next_operation_type?: string | null;
  quality_status?: string | null;
  scrap_quantity?: number | null;
  scheduled_date?: string | null;
}

// ============================================================================
// Extended Types with Relations
// ============================================================================

/**
 * 품목 기본 정보 (조인용)
 */
export interface ItemBasicInfo {
  item_id: number;
  item_name: string;
  item_code: string;
  current_stock: number;
  unit?: string;
  spec?: string;
}

/**
 * 공정 작업 정보 (품목 정보 포함)
 */
export interface ProcessOperationWithItems {
  operation_id: number;
  operation_type: OperationType;
  input_item_id: number;
  output_item_id: number;
  input_quantity: number;
  output_quantity: number;
  efficiency?: number;
  operator_id?: number;
  started_at?: string;
  completed_at?: string;
  status: OperationStatus;
  notes?: string;
  created_at: string;
  updated_at: string;

  // LOT Tracking Fields (NEW 2025-02-06)
  lot_number?: string;              // LOT 번호 (예: BLK-20251117-001)
  parent_lot_number?: string;       // 부모 LOT 번호
  child_lot_number?: string;        // 자식 LOT 번호

  // Process Chain Management Fields (NEW 2025-02-06)
  chain_id?: string;                // 프로세스 체인 식별자
  chain_sequence?: number;          // 체인 내 순서 (1, 2, 3...)
  parent_operation_id?: number;     // 부모 공정 ID
  auto_next_operation?: boolean;    // 완료 시 다음 공정 자동 시작 여부
  next_operation_type?: string;     // 자동 시작할 다음 공정 타입

  // Quality Control Fields (NEW 2025-02-06)
  quality_status?: string;          // 품질 상태 (OK, NG, REWORK)
  scrap_quantity?: number;          // 불량 수량
  scheduled_date?: string;          // 예정일

  // Coil process tracking (bidirectional sync)
  coil_process_id?: number;
  coil_process?: {
    process_id: number;
    process_type: string;
    status: string;
    process_date?: string;
    yield_rate?: number;
    notes?: string;
  };

  // Relations
  input_item: ItemBasicInfo;
  output_item: ItemBasicInfo;
}

/**
 * 공정 작업 생성 요청
 */
export interface CreateProcessOperationRequest {
  operation_type: OperationType;
  input_item_id: number;
  output_item_id: number;
  input_quantity: number;
  output_quantity: number;
  efficiency?: number;
  operator_id?: number;
  notes?: string;
}

/**
 * 공정 작업 업데이트 요청
 */
export interface UpdateProcessOperationRequest {
  status?: OperationStatus;
  input_quantity?: number;
  output_quantity?: number;
  efficiency?: number;
  operator_id?: number;
  started_at?: string;
  completed_at?: string;
  notes?: string;
}

/**
 * 공정 작업 상태 전환 요청
 */
export interface OperationStatusTransitionRequest {
  status: OperationStatus;
  notes?: string;
}

// ============================================================================
// Filter & Query Types
// ============================================================================

/**
 * 공정 작업 목록 필터
 */
export interface ProcessOperationFilters {
  operation_type?: OperationType | OperationType[];
  status?: OperationStatus | OperationStatus[];
  input_item_id?: number;
  output_item_id?: number;
  operator_id?: number;
  start_date?: string; // ISO date string
  end_date?: string;   // ISO date string
  search?: string;     // Search in notes, item names
}

/**
 * 공정 작업 목록 조회 옵션
 */
export interface ProcessOperationListOptions extends ProcessOperationFilters {
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'started_at' | 'completed_at' | 'operation_type' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * 공정 작업 목록 응답
 */
export interface ProcessOperationListResponse {
  success: true;
  data: ProcessOperationWithItems[];
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalCount: number;
  };
}

/**
 * 공정 작업 단일 조회 응답
 */
export interface ProcessOperationDetailResponse {
  success: true;
  data: ProcessOperationWithItems;
}

/**
 * 공정 작업 생성/수정 응답
 */
export interface ProcessOperationMutationResponse {
  success: true;
  data: ProcessOperationWithItems;
}

/**
 * 공정 작업 삭제 응답
 */
export interface ProcessOperationDeleteResponse {
  success: true;
  message: string;
}

// ============================================================================
// Statistics & Analytics Types
// ============================================================================

/**
 * 공정별 통계
 */
export interface ProcessOperationStatistics {
  operation_type: OperationType;
  total_operations: number;
  completed_operations: number;
  pending_operations: number;
  in_progress_operations: number;
  cancelled_operations: number;
  total_input_quantity: number;
  total_output_quantity: number;
  average_efficiency: number;
  completion_rate: number; // Percentage
}

/**
 * 수율 분석 결과
 */
export interface EfficiencyAnalysis {
  operation_type: OperationType;
  average_efficiency: number;
  min_efficiency: number;
  max_efficiency: number;
  target_efficiency: number; // Target 수율
  variance: number;
}

/**
 * 작업 시간 분석
 */
export interface ProcessTimeAnalysis {
  operation_type: OperationType;
  average_duration_hours: number;
  min_duration_hours: number;
  max_duration_hours: number;
  total_operations: number;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * 재고 가용성 확인 결과
 */
export interface StockAvailabilityCheck {
  available: boolean;
  current_stock: number;
  required_quantity: number;
  shortage?: number;
}

/**
 * 상태 전환 검증 결과
 */
export interface StatusTransitionValidation {
  valid: boolean;
  current_status: OperationStatus;
  target_status: OperationStatus;
  error_message?: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * 공정 작업 에러 코드
 */
export enum ProcessOperationErrorCode {
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',
  ITEM_NOT_FOUND = 'ITEM_NOT_FOUND',
  OPERATION_NOT_FOUND = 'OPERATION_NOT_FOUND',
  INVALID_QUANTITY = 'INVALID_QUANTITY',
  ALREADY_COMPLETED = 'ALREADY_COMPLETED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * 공정 작업 에러
 */
export interface ProcessOperationError {
  success: false;
  error: string;
  code?: ProcessOperationErrorCode;
  details?: unknown;
}

// ============================================================================
// Helper Type Guards
// ============================================================================

/**
 * Check if response is successful
 */
export function isSuccessResponse<T>(
  response: { success: boolean } | ProcessOperationError
): response is { success: true; data: T } {
  return response.success === true;
}

/**
 * Check if operation is completed
 */
export function isOperationCompleted(operation: ProcessOperation): boolean {
  return operation.status === 'COMPLETED';
}

/**
 * Check if operation can be cancelled
 */
export function canCancelOperation(operation: ProcessOperation): boolean {
  return operation.status !== 'COMPLETED' && operation.status !== 'CANCELLED';
}

/**
 * Check if operation can be started
 */
export function canStartOperation(operation: ProcessOperation): boolean {
  return operation.status === 'PENDING';
}

/**
 * Check if operation can be completed
 */
export function canCompleteOperation(operation: ProcessOperation): boolean {
  return operation.status === 'IN_PROGRESS';
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate efficiency percentage
 */
export function calculateEfficiency(inputQty: number, outputQty: number): number {
  if (inputQty <= 0) return 0;
  return Math.round((outputQty / inputQty) * 100 * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate duration in hours
 */
export function calculateDurationHours(
  startedAt?: string | null,
  completedAt?: string | null
): number | null {
  if (!startedAt || !completedAt) return null;

  const start = new Date(startedAt);
  const end = new Date(completedAt);
  const diffMs = end.getTime() - start.getTime();

  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimals
}

/**
 * Get Korean operation type label
 */
export function getOperationTypeLabel(type: OperationType): string {
  const labels: Record<OperationType, string> = {
    BLANKING: 'Blanking 공정',
    PRESS: 'Press 공정',
    ASSEMBLY: '조립 공정',
  };
  return labels[type];
}

/**
 * Get Korean status label
 */
export function getStatusLabel(status: OperationStatus): string {
  const labels: Record<OperationStatus, string> = {
    PENDING: '대기',
    IN_PROGRESS: '진행중',
    COMPLETED: '완료',
    CANCELLED: '취소',
  };
  return labels[status];
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: OperationStatus): string {
  const colors: Record<OperationStatus, string> = {
    PENDING: 'gray',
    IN_PROGRESS: 'blue',
    COMPLETED: 'green',
    CANCELLED: 'red',
  };
  return colors[status];
}

/**
 * Validate status transition
 */
export function validateStatusTransition(
  currentStatus: OperationStatus,
  targetStatus: OperationStatus
): StatusTransitionValidation {
  const validTransitions: Record<OperationStatus, OperationStatus[]> = {
    PENDING: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [], // Cannot transition from COMPLETED
    CANCELLED: [], // Cannot transition from CANCELLED
  };

  const allowedTargets = validTransitions[currentStatus];
  const valid = allowedTargets.includes(targetStatus);

  return {
    valid,
    current_status: currentStatus,
    target_status: targetStatus,
    error_message: valid
      ? undefined
      : `상태 전환 불가: ${getStatusLabel(currentStatus)} → ${getStatusLabel(targetStatus)}`,
  };
}
