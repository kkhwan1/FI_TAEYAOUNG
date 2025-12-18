/**
 * 공정별 생산등록 타입 정의
 */

export type ProcessType = 'BLANKING' | 'PRESS' | 'WELD' | 'PAINT';
export type QualityStatus = 'OK' | 'NG' | 'REWORK';
export type ProcessStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/**
 * 공정별 생산등록 요청
 */
export interface ProcessProductionRequest {
  process_type: ProcessType;
  work_date: string;
  input_item_id: number;
  input_quantity: number;
  output_item_id: number;
  output_quantity: number;
  scrap_quantity?: number;
  quality_status?: QualityStatus;
  operator_id?: number;
  notes?: string;
  customer_id?: number;  // 납품처 (고객사) - BOM 기반 자동 연결 또는 수동 선택
}

/**
 * 공정별 생산등록 응답
 */
export interface ProcessProductionResponse {
  success: boolean;
  data?: {
    operation_id: number;
    process_type: ProcessType;
    input_item: ItemBasicInfo;
    output_item: ItemBasicInfo;
    input_quantity: number;
    output_quantity: number;
    scrap_quantity: number;
    efficiency: number;
    scrap_rate: number;
    quality_status: QualityStatus;
    status: ProcessStatus;
    lot_number?: string;
    created_at: string;
  };
  message?: string;
  error?: string;
  warnings?: string[];
}

/**
 * 품목 기본 정보
 */
export interface ItemBasicInfo {
  item_id: number;
  item_code: string;
  item_name: string;
  unit: string;
  current_stock: number;
}

/**
 * 환산 요청
 */
export interface ConversionRequest {
  process_type: ProcessType;
  input_item_id: number;
  output_item_id: number;
  input_kg?: number;
  output_ea?: number;
}

/**
 * 환산 응답
 */
export interface ConversionResponse {
  success: boolean;
  data?: {
    kg_per_blank: number;
    yield_rate: number;
    possible_ea?: number;
    required_kg?: number;
    formula: string;
  };
  error?: string;
}

/**
 * WIP 조회 응답
 */
export interface WIPResponse {
  success: boolean;
  data?: {
    wip_summary: Array<{
      stage: string;
      total_qty: number;
      unit: string;
    }>;
    details: Array<{
      item_id: number;
      item_code: string;
      item_name: string;
      category: string;
      current_stock: number;
      unit: string;
    }>;
  };
  error?: string;
}

/**
 * 공정 탭 Props
 */
export interface ProcessTabProps {
  processType: ProcessType;
  onSubmit: (data: ProcessProductionRequest) => Promise<void>;
  isLoading?: boolean;
}
