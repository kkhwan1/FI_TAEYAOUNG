/**
 * 입고 타입 정의
 */

export type ReceivingType = 'COIL' | 'SHEET' | 'SUBMATERIAL' | 'MARKET';

// 하위 타입 (공급업체 구분)
export type ReceivingSubType = 'TAECHANG' | 'PARTNER' | null;

/**
 * 입고 타입별 설정
 */
export const RECEIVING_TYPE_CONFIGS = {
  COIL: {
    key: 'COIL' as ReceivingType,
    label: '코일',
    description: '원소재 코일 입고',
    color: 'bg-blue-500',
    icon: 'Circle',
    category: '원소재(코일)',
    hasSubType: true,
    hasWeight: true,
    unit: 'KG'
  },
  SHEET: {
    key: 'SHEET' as ReceivingType,
    label: '시트(블랭킹)',
    description: '원소재 시트 입고',
    color: 'bg-amber-500',
    icon: 'Layers',
    category: '원소재(시트)',
    hasSubType: false,
    hasWeight: true,
    unit: 'KG'
  },
  SUBMATERIAL: {
    key: 'SUBMATERIAL' as ReceivingType,
    label: '부자재',
    description: '부자재 입고',
    color: 'bg-green-500',
    icon: 'Package',
    category: '부자재',
    hasSubType: true,
    hasWeight: false,
    unit: 'EA'
  },
  MARKET: {
    key: 'MARKET' as ReceivingType,
    label: '시중구매',
    description: '시중 구매 품목',
    color: 'bg-purple-500',
    icon: 'ShoppingCart',
    category: '부자재',
    hasSubType: false,
    hasWeight: false,
    unit: 'EA'
  }
} as const;

/**
 * 하위 타입 설정 (공급업체 구분)
 */
export const RECEIVING_SUBTYPE_CONFIGS = {
  TAECHANG: {
    key: 'TAECHANG' as ReceivingSubType,
    label: '태창금속',
    companyName: '태창금속',
    color: 'bg-blue-600',
    textColor: 'text-white'
  },
  PARTNER: {
    key: 'PARTNER' as ReceivingSubType,
    label: '협력사',
    companyName: null, // 선택 가능
    color: 'bg-gray-600',
    textColor: 'text-white'
  }
} as const;

/**
 * 입력 행 인터페이스
 */
export interface ReceivingInputRow {
  id: string;
  itemId: number | null;
  itemCode: string;
  itemName: string;
  quantity: string;
  unitPrice: string;
  amount: number;
  // 중량 관리 필드 (COIL, SHEET만)
  thickness?: string;
  width?: string;
  weight?: string;
}

/**
 * 입고 등록 요청
 */
export interface ReceivingRequest {
  receiving_type: ReceivingType;
  receiving_sub_type?: ReceivingSubType;
  work_date: string;
  company_id?: number;
  items: Array<{
    item_id: number;
    quantity: number;
    unit_price: number;
    total_amount: number;
    // 중량 관리 필드 (COIL, SHEET만)
    thickness?: number;
    width?: number;
    weight?: number;
  }>;
}

/**
 * 입고 등록 응답
 */
export interface ReceivingResponse {
  success: boolean;
  data?: {
    transaction_ids: number[];
    total_amount: number;
  };
  message?: string;
  error?: string;
}

/**
 * 입고 이력 항목
 */
export interface ReceivingHistoryItem {
  transaction_id: number;
  transaction_no: string;
  transaction_date: string;
  receiving_type: ReceivingType;
  company_name?: string;
  item_code: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  thickness?: number;
  width?: number;
  weight?: number;
  user_name?: string;
  created_at: string;
}
