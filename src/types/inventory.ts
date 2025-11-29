// Shared types and interfaces for inventory management system

// Base inventory transaction interface
export interface InventoryTransaction {
  id?: number;
  transaction_id?: number;
  transaction_no?: string;
  transaction_date: string;
  transaction_type: 'incoming' | 'production_in' | 'production_out' | 'outgoing' | '입고' | '생산입고' | '생산출고' | '출고' | 'BOM_DEDUCTION';
  item_id: number;
  item_code?: string;
  item_name?: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  total_amount: number;
  company_id?: number;
  company_name?: string;
  reference_no?: string;
  user_name?: string;
  created_at?: string;
  updated_at?: string;
}

// Item/Product interfaces
export interface Item {
  id: number;
  item_id?: number;
  item_code: string;
  name: string;
  item_name?: string;
  category?: string;
  item_type?: string;
  material_type?: string;
  vehicle_model?: string;
  material?: string;
  specification?: string;
  spec?: string;
  unit: string;
  thickness?: number;
  width?: number;
  height?: number;
  specific_gravity?: number;
  mm_weight?: number;
  daily_requirement?: number;
  blank_size?: number;
  current_stock?: number;
  safety_stock?: number;
  min_stock_level?: number;
  max_stock_level?: number;
  price?: number;
  unit_price?: number;
  description?: string;
  location?: string;
  coating_status?: 'no_coating' | 'before_coating' | 'after_coating';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Product extends Item {
  // Products inherit all Item properties
  // Additional product-specific properties can be added here
  item_type?: string; // For ProductionForm compatibility
}

// Component-specific compatibility interfaces
// These extend the base interfaces to match component expectations
export interface ItemForComponent extends Item {
  item_id: number; // Alias for id
  item_code: string; // Already exists
  item_name: string; // Alias for name
  unit: string; // Already exists
  unit_price: number; // Make required for components
}

// Company interface
export interface Company {
  id: number;
  company_code: string;
  name: string;
  business_type: 'supplier' | 'customer' | 'both' | '공급업체' | '고객' | '둘다';
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Component-specific compatibility interface for Company
export interface CompanyForComponent extends Company {
  company_id: number; // Alias for id
  company_name: string; // Alias for name
  company_type: string; // Alias for business_type
}

// Stock information interface
export interface StockInfo {
  item_id: number;
  item_code: string;
  item_name: string;
  current_stock: number;
  unit: string;
  min_stock_level?: number;
  max_stock_level?: number;
  unit_price?: number;
  location?: string;
  last_updated?: string;
}

// BOM (Bill of Materials) interfaces
export interface BOMItem {
  id?: number;
  parent_item_id?: number;
  child_item_id: number;
  child_item_code: string;
  child_item_name: string;
  bom_quantity: number; // Also include original BOM quantity field
  required_quantity: number;
  unit: string;
  scrap_rate?: number; // Add scrap rate field from ProductionForm
  current_stock: number;
  needed_quantity?: number;
  sufficient_stock: boolean;
  shortage?: number;
}

export interface BOMStructure {
  product_id: number;
  product_code: string;
  product_name: string;
  materials: BOMItem[];
  total_materials: number;
  all_sufficient: boolean;
}

// Form data interfaces for each inventory operation
export interface ReceivingItem {
  item_id: number;
  item_code: string;
  item_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  lot_no?: string;
  expiry_date?: string;
  to_location?: string;
  isMonthlyPriceApplied?: boolean;
}

export interface ReceivingFormData {
  transaction_date: string;
  items: ReceivingItem[];
  company_id?: number;
  reference_no?: string;
  created_by: number;
}

export interface ProductionItem {
  product_item_id: number;
  item_id: number;
  item_code: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  unit?: string;
  reference_no?: string;
  notes?: string;
}

export interface ProductionFormData {
  transaction_date: string;
  product_item_id: number; // 단일 품목 모드용 (호환성)
  quantity: number; // 단일 품목 모드용 (호환성)
  items?: ProductionItem[]; // 다중 품목 일괄 등록용
  reference_no?: string;
  use_bom: boolean;
  scrap_quantity?: number;
  created_by: number;
  process_types?: ('프레스' | '용접' | '도장')[]; // 공정 구분
  press_capacity?: number; // 프레스 용량 (400, 600, 800, 1000, 1600)
}

export interface ShippingItem {
  item_id: number;
  item_code: string;
  item_name: string;
  unit: string;
  unit_price: number;
  current_stock: number;
  quantity: number;
  total_amount: number;
  sufficient_stock: boolean;
  isMonthlyPriceApplied?: boolean;
}

export interface ShippingFormData {
  transaction_date: string;
  customer_id?: number;
  items: ShippingItem[];
  reference_no?: string;
  created_by: number;
}

// Search and dropdown interfaces
export interface SearchOption {
  id: number;
  code: string;
  name: string;
  specification?: string;
  unit?: string;
  current_stock?: number;
  unit_price?: number;
  business_type?: string;
}

// API response interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface TransactionListResponse {
  transactions: InventoryTransaction[];
  pagination?: PaginationInfo;
}

export interface StockListResponse {
  stocks: StockInfo[];
  pagination?: PaginationInfo;
}

// Form validation interfaces
export interface FormError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: FormError[];
}

// Stock status enums and types
export type StockStatus = 'normal' | 'low' | 'empty' | 'excess';

export interface StockStatusInfo {
  status: StockStatus;
  message: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

// Inventory transaction types
export const TRANSACTION_TYPES = {
  RECEIVING: '입고',
  PRODUCTION_IN: '생산입고',
  PRODUCTION_OUT: '생산출고',
  SHIPPING: '출고',
  BOM_DEDUCTION: 'BOM_DEDUCTION'
} as const;

export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];

// Business types for companies
export const BUSINESS_TYPES = {
  SUPPLIER: '공급업체',
  CUSTOMER: '고객',
  BOTH: '둘다'
} as const;

export type BusinessType = typeof BUSINESS_TYPES[keyof typeof BUSINESS_TYPES];

// Form submission handlers
export type FormSubmitHandler<T, R = void> = (data: T) => Promise<R> | R;
export type FormCancelHandler = () => void;

// Common props for form components
export interface BaseFormProps<T, R = void> {
  onSubmit: FormSubmitHandler<T, R>;
  onCancel: FormCancelHandler;
  initialData?: Partial<T>;
  isEdit?: boolean;
  isLoading?: boolean;
}

// Props for specific form components (type aliases for clarity)
export type ReceivingFormProps = BaseFormProps<ReceivingFormData>;
export type ProductionFormProps = BaseFormProps<ProductionFormData, ProductionResponse>;
export type ShippingFormProps = BaseFormProps<ShippingFormData>;

// Tab configuration interface
export interface InventoryTab {
  id: 'receiving' | 'production' | 'shipping';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
  bgColor: string;
}

// Filter and search interfaces
export interface InventoryFilters {
  start_date?: string;
  end_date?: string;
  item_id?: number;
  company_id?: number;
  transaction_type?: TransactionType;
  reference_no?: string;
  limit?: number;
  offset?: number;
}

export interface SearchFilters {
  query?: string;
  category?: string;
  is_active?: boolean;
  business_type?: BusinessType;
  limit?: number;
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// =====================================================
// Phase P0-3: BOM Auto-Deduction UI Types
// Added: 2025-01-14
// Purpose: Type definitions for BOM preview panel and auto-deduction results
// =====================================================

/**
 * BOM Check API Response from GET /api/inventory/production/bom-check
 * Returns real-time material availability analysis for production planning
 */
export interface BOMCheckResponse {
  product_info: {
    item_id: number;
    item_code: string;
    item_name: string;
    category: string;
    unit: string;
  };
  production_quantity: number;
  can_produce: boolean;
  bom_items: BOMCheckItem[];
  summary: {
    total_bom_items: number;
    sufficient_items: number;
    insufficient_items: number;
    total_required_value: number;
    total_available_value: number;
    total_shortage: number;
    fulfillment_rate: number;
    max_producible_quantity: number;
    shortage_quantity: number;
    bottleneck_item: {
      bom_id: number;
      item_code: string;
      item_name: string;
      max_producible: number;
      required_for_requested: number;
      available_stock: number;
    } | null;
  };
}

/**
 * Individual BOM item from BOM check API
 * NOTE: Different from legacy BOMItem interface - used specifically for API response
 */
export interface BOMCheckItem {
  bom_id: number;
  child_item_id: number;
  item_code: string;
  item_name: string;
  category: string;
  spec?: string;
  unit: string;
  unit_price: number;
  required_quantity: number;
  available_stock: number;
  shortage: number;
  sufficient: boolean;
  safety_stock: number;
  required_value: number;
  available_value: number;
  max_producible_by_this_item: number;
  bom_quantity_per_unit: number;
}

/**
 * Production API Response from POST /api/inventory/production
 * Returns production transaction and auto-deducted materials
 */
export interface ProductionResponse {
  success: boolean;
  message: string;
  data: {
    transaction: InventoryTransaction;
    auto_deductions: AutoDeduction[];
    stock_warning?: {
      max_producible: number;
      shortage_quantity: number;
      bottleneck_materials?: Array<{
        item_name: string;
        item_code: string;
        required: number;
        available: number;
      }>;
    };
  };
}

/**
 * Auto-deducted material record from bom_deduction_log table
 * Created automatically by database trigger when production transaction is inserted
 */
export interface AutoDeduction {
  log_id: number;
  child_item_id: number;
  item_code: string;
  item_name: string;
  unit: string;
  deducted_quantity: number;
  usage_rate: number;
  stock_before: number;
  stock_after: number;
}

/**
 * Stock status for BOM preview panel
 * NOTE: Different from legacy StockStatus - used specifically for BOM material availability
 */
export type BOMStockStatus = 'sufficient' | 'warning' | 'insufficient';

/**
 * Color configuration for status badges in BOM preview
 */
export interface StatusColorConfig {
  icon: string;
  bg: string;
  text: string;
  badge?: string;
}

