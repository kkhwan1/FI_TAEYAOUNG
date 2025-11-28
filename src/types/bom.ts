/**
 * BOM (Bill of Materials) 타입 정의
 * 중앙 집중식 타입 관리로 코드 일관성 및 타입 안전성 향상
 */

/**
 * 기본 BOM 필드 (데이터베이스 스키마와 일치)
 */
export interface BOMBase {
  bom_id: number;
  parent_item_id: number;
  child_item_id: number;
  quantity_required: number;
  level_no: number;
  is_active: boolean;
  remarks?: string | null;
  created_at?: string;
  updated_at?: string;
  // 모품목 마감 정보 (Excel F, G열)
  parent_closing_quantity?: number | null;
  parent_closing_amount?: number | null;
  // 자품목 구매 정보 (Excel O, P열)
  child_purchase_quantity?: number | null;
  child_purchase_amount?: number | null;
}

/**
 * 품목 기본 정보 (BOM 관계에서 사용)
 */
export interface BOMItem {
  item_id: number;
  item_code: string;
  item_name: string;
  spec?: string | null;
  unit?: string | null;
  category?: string | null;
  item_type?: string | null;
  current_stock?: number;
  safety_stock?: number;
  unit_price?: number;
  is_active?: boolean;
}

/**
 * 코일 스펙 정보
 */
export interface CoilSpec {
  spec_id?: number;
  item_id: number;
  material_grade: string;
  thickness?: number | null;
  width?: number | null;
  outer_diameter?: number | null;
  inner_diameter?: number | null;
  weight_per_piece?: number | null;
  standard_length?: number | null;
  density?: number | null;
}

/**
 * 회사 정보 (납품처/공급처용)
 */
export interface BOMCompanyInfo {
  company_id: number;
  company_name: string;
  company_code?: string;
  company_type?: string;
}

/**
 * BOM 엔트리 (코일 스펙 정보 포함)
 * API 응답 및 컴포넌트에서 사용하는 확장 타입
 */
export interface BOMEntry extends BOMBase {
  // 코일 스펙 관련 필드 (JOIN 결과)
  material_grade?: string | null;
  weight_per_piece?: number | null;
  thickness?: number | null;
  width?: number | null;

  // 관계 데이터 (선택적)
  parent_item?: BOMItem | null;
  child_item?: BOMItem | null;

  // 납품처/공급처 관계 데이터 (새로 추가된 컬럼)
  customer_id?: number | null;
  child_supplier_id?: number | null;
  customer?: BOMCompanyInfo | null;
  child_supplier?: BOMCompanyInfo | null;

  // 편의 필드 (API 응답에서 flatten된 데이터)
  parent_item_code?: string;
  parent_item_name?: string;
  child_item_code?: string;
  child_item_name?: string;
  child_item_spec?: string;
  child_item_unit?: string;
  child_item_category?: string;
  child_item_type?: string;
  child_current_stock?: number;
  child_unit_price?: number;

  // 계산/파생 필드 (컴포넌트에서 사용)
  level?: number; // level_no의 정규화된 형태
  item_type?: string; // 품목 유형
  material_cost?: number; // 자재비
  scrap_revenue?: number; // 스크랩 수익
  net_cost?: number; // 순원가
}

/**
 * BOM 전체 관계 데이터 포함
 * 마스터 페이지에서 사용하는 가장 상세한 타입
 */
export interface BOMWithRelations extends BOMEntry {
  // 추가 계산 필드
  total_cost?: number;
  total_weight?: number;

  // 고객사 BOM 템플릿 관련
  customer_id?: number;
  customer_name?: string;

  // 공정 관련
  process_code?: string;
  process_name?: string;

  // 상태 및 메타데이터
  validation_status?: 'valid' | 'warning' | 'error';
  validation_message?: string;
}

/**
 * BOM 트리 노드 (트리 뷰 렌더링용)
 */
export interface BOMTreeNode {
  entry: BOMEntry;
  children: BOMTreeNode[];
  level: number;
  expanded: boolean;
  path?: number[]; // 루트부터의 item_id 경로
}

/**
 * BOM API 응답 타입
 */
export interface BOMAPIResponse {
  success: boolean;
  data?: BOMEntry[] | {
    bom_entries?: BOMEntry[];
    bomEntries?: BOMEntry[]; // 호환성을 위한 camelCase
    total_count?: number;
    coil_count?: number;
  };
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    totalCount: number;
  };
}

/**
 * BOM 생성/수정 요청 타입
 */
export interface BOMCreateRequest {
  parent_item_id: number;
  child_item_id: number;
  quantity_required: number;
  level_no?: number;
  remarks?: string;
}

export interface BOMUpdateRequest extends Partial<BOMCreateRequest> {
  bom_id: number;
  is_active?: boolean;
}

/**
 * BOM 통계 타입
 */
export interface BOMStatistics {
  total_count: number;
  coil_count: number;
  active_count: number;
  level_distribution: Record<number, number>;
}

/**
 * BOM 필터 옵션
 */
export interface BOMFilterOptions {
  parent_item_id?: number;
  child_item_id?: number;
  level_no?: number;
  is_active?: boolean;
  has_coil_spec?: boolean;
  search?: string;
  customer_id?: number;
}
