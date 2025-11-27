/**
 * Zod validation schemas for ERP system
 * Comprehensive input validation for all API endpoints
 */
import { z } from 'zod';

// Common validation patterns
const koreanTextPattern = /^[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\ua960-\ua97f0-9a-zA-Z\s\-_.()]+$/;
const englishTextPattern = /^[a-zA-Z0-9\s\-_.()]+$/;
const mixedTextPattern = /^[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\ua960-\ua97f0-9a-zA-Z\s\-_.()]+$/;

// Base schemas for common types
export const IdSchema = z.number().int().positive();
export const PositiveNumberSchema = z.number().positive();
export const NonNegativeNumberSchema = z.number().min(0);
export const KoreanTextSchema = z.string().min(1).max(255).regex(koreanTextPattern, '한글, 영문, 숫자만 입력 가능합니다');
export const EnglishTextSchema = z.string().min(1).max(255).regex(englishTextPattern, '영문, 숫자만 입력 가능합니다');
export const MixedTextSchema = z.string().min(1).max(255).regex(mixedTextPattern, '한글, 영문, 숫자만 입력 가능합니다');
export const OptionalTextSchema = z.string().max(500).optional();

// Common enum schemas
export const ItemStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']);
export const CompanyTypeSchema = z.enum(['CUSTOMER', 'SUPPLIER', 'BOTH', '고객사', '공급사', '양방향']);
export const TransactionTypeSchema = z.enum(['입고', '생산입고', '생산출고', '출고', 'BOM_DEDUCTION', 'RECEIVE', 'PRODUCTION', 'SHIP']);
export const UserRoleSchema = z.enum(['admin', 'manager', 'operator', 'viewer']);
export const ContractStatusSchema = z.enum(['ACTIVE', 'EXPIRED', 'TERMINATED']);

// Inventory Classification enum schemas (Phase 3 - 2025-02-02)
export const InventoryTypeSchema = z.enum(['완제품', '반제품', '고객재고', '원재료', '코일'], {
  message: '재고 분류는 완제품/반제품/고객재고/원재료/코일 중 하나여야 합니다'
});
export const QualityStatusSchema = z.enum(['검수중', '합격', '불합격', '보류'], {
  message: '품질 상태는 검수중/합격/불합격/보류 중 하나여야 합니다'
});
export const WarehouseZoneSchema = z.string().regex(/^[A-Z]-\d{2}$/, '보관 구역 형식: A-01, B-03').nullable().optional();

export const ItemClassificationUpdateSchema = z.object({
  item_id: IdSchema,
  inventory_type: InventoryTypeSchema.optional(),
  warehouse_zone: WarehouseZoneSchema,
  quality_status: QualityStatusSchema.optional()
}).refine((data) => {
  // Business rule: Customer stock requires warehouse zone
  if (data.inventory_type === '고객재고' && !data.warehouse_zone) {
    return false;
  }
  return true;
}, {
  message: '고객재고는 보관 구역이 필수입니다',
  path: ['warehouse_zone']
});

// Item validation schemas (matching actual database schema)
export const ItemCreateSchema = z.object({
  item_code: EnglishTextSchema.max(50),
  item_name: KoreanTextSchema,
  item_type: z.string().max(50).optional(),
  car_model: z.string().max(100).optional(),
  spec: MixedTextSchema.optional(),
  unit: KoreanTextSchema.max(20),
  current_stock: NonNegativeNumberSchema.default(0),
  min_stock_level: NonNegativeNumberSchema.optional(),
  safety_stock: NonNegativeNumberSchema.optional(),
  unit_price: PositiveNumberSchema.optional(),
  location: OptionalTextSchema,
  description: OptionalTextSchema,
  coating_status: z.enum(['no_coating', 'before_coating', 'after_coating']).optional()
});

export const ItemUpdateSchema = ItemCreateSchema.partial().extend({
  id: IdSchema  // Using 'id' as expected by the API
});

export const ItemQuerySchema = z.object({
  type: z.string().max(50).optional(),
  search: z.string().max(255).optional(),
  with_stock: z.enum(['true', 'false']).optional()
});

export const ItemDeleteSchema = z.object({
  id: IdSchema
});

// Company validation schemas
export const CompanyCreateSchema = z.object({
  company_name: KoreanTextSchema,
  company_type: CompanyTypeSchema,
  business_number: z.string().regex(/^\d{3}-\d{2}-\d{5}$/, '사업자번호 형식: 000-00-00000').optional(),
  contact_person: KoreanTextSchema.optional(),
  phone: z.string().regex(/^[\d\-+().\s]+$/, '올바른 전화번호 형식을 입력하세요').optional(),
  email: z.string().email('올바른 이메일 형식을 입력하세요').optional(),
  address: OptionalTextSchema,
  notes: OptionalTextSchema
});

export const CompanyUpdateSchema = CompanyCreateSchema.partial().extend({
  company_id: IdSchema
});

export const CompanyQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(255).optional(),
  company_type: CompanyTypeSchema.optional()
});

// BOM validation schemas
export const BOMCreateSchema = z.object({
  parent_item_id: IdSchema,
  child_item_id: IdSchema,
  quantity: PositiveNumberSchema,
  notes: OptionalTextSchema
}).refine((data) => data.parent_item_id !== data.child_item_id, {
  message: '부모 항목과 자식 항목이 같을 수 없습니다',
  path: ['child_item_id']
});

export const BOMUpdateSchema = BOMCreateSchema.partial().extend({
  bom_id: IdSchema
});

export const BOMQuerySchema = z.object({
  parent_item_id: IdSchema.optional(),
  child_item_id: IdSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

// Inventory transaction validation schemas
export const InventoryTransactionCreateSchema = z.object({
  item_id: IdSchema,
  transaction_type: TransactionTypeSchema,
  quantity: PositiveNumberSchema,
  unit_cost: PositiveNumberSchema.optional(),
  total_cost: PositiveNumberSchema.optional(),
  company_id: IdSchema.optional(),
  reference_number: z.string().max(50).optional(),
  notes: OptionalTextSchema
}).refine((data) => {
  // For receive transactions, company_id should be provided
  if (data.transaction_type === '입고' || data.transaction_type === 'RECEIVE') {
    return data.company_id !== undefined;
  }
  return true;
}, {
  message: '입고 거래에는 회사 정보가 필요합니다',
  path: ['company_id']
}).refine((data) => {
  // If unit_cost is provided, total_cost should match or be calculated
  if (data.unit_cost && data.total_cost) {
    return Math.abs(data.total_cost - (data.unit_cost * data.quantity)) < 0.01;
  }
  return true;
}, {
  message: '총 비용이 단가 × 수량과 일치하지 않습니다',
  path: ['total_cost']
});

export const InventoryTransactionUpdateSchema = InventoryTransactionCreateSchema.partial().extend({
  transaction_id: IdSchema
});

export const InventoryTransactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  item_id: IdSchema.optional(),
  transaction_type: TransactionTypeSchema.optional(),
  company_id: IdSchema.optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  reference_number: z.string().max(50).optional()
});

// Stock adjustment validation schemas
export const StockAdjustmentCreateSchema = z.object({
  item_id: IdSchema,
  adjustment_type: z.enum(['INCREASE', 'DECREASE', 'SET']),
  quantity: PositiveNumberSchema,
  reason: z.enum(['DAMAGED', 'LOST', 'FOUND', 'COUNT_CORRECTION', 'OTHER']),
  notes: OptionalTextSchema
});

export const StockAdjustmentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  item_id: IdSchema.optional(),
  adjustment_type: z.enum(['INCREASE', 'DECREASE', 'SET']).optional(),
  reason: z.enum(['DAMAGED', 'LOST', 'FOUND', 'COUNT_CORRECTION', 'OTHER']).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional()
});

// Daily Stock Calendar validation schema
export const DailyCalendarQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  item_id: z.coerce.number().int().positive().optional(),
  min_stock_value: z.coerce.number().min(0, '재고금액은 0 이상이어야 합니다').optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(1000, '최대 1,000건까지 조회 가능합니다').default(100),
  format: z.enum(['json', 'excel'], 'json 또는 excel 형식만 지원됩니다').default('json')
});

// User validation schemas
export const UserCreateSchema = z.object({
  username: EnglishTextSchema.min(3).max(50),
  password: z.string().min(8).max(128),
  name: KoreanTextSchema.max(100),
  email: z.string().email('올바른 이메일 형식을 입력하세요').optional(),
  department: KoreanTextSchema.max(100).optional(),
  role: UserRoleSchema
});

export const UserUpdateSchema = UserCreateSchema.partial().extend({
  user_id: IdSchema
}).omit({ password: true });

export const UserPasswordUpdateSchema = z.object({
  user_id: IdSchema,
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(128)
});

export const UserQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(255).optional(),
  role: UserRoleSchema.optional(),
  is_active: z.coerce.boolean().optional()
});

// Authentication validation schemas
export const LoginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(128)
});

export const TokenRefreshSchema = z.object({
  refresh_token: z.string().min(1)
});

// Dashboard and reporting schemas
export const DashboardQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  period: z.enum(['today', 'week', 'month', 'quarter', 'year']).optional()
});

// Sales Transactions validation schemas
export const PaymentStatusSchema = z.enum(['PENDING', 'PARTIAL', 'COMPLETE']);

export const SalesTransactionCreateSchema = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식'),
  customer_id: IdSchema,
  item_id: IdSchema,
  vehicle_model: OptionalTextSchema,
  material_type: z.string().max(20).optional(),
  quantity: PositiveNumberSchema,
  unit: KoreanTextSchema.max(10).default('EA'),
  unit_price: PositiveNumberSchema,
  supply_amount: PositiveNumberSchema,
  tax_amount: NonNegativeNumberSchema.default(0),
  total_amount: PositiveNumberSchema,
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  delivery_address: OptionalTextSchema,
  tax_invoice_id: IdSchema.optional(),
  tax_invoice_issued: z.boolean().default(false),
  payment_status: PaymentStatusSchema.default('PENDING'),
  paid_amount: NonNegativeNumberSchema.default(0),
  payment_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  notes: OptionalTextSchema
}).refine((data) => {
  // Total amount should equal supply_amount + tax_amount
  return Math.abs(data.total_amount - (data.supply_amount + data.tax_amount)) < 0.01;
}, {
  message: '합계금액은 공급가액 + 부가세와 일치해야 합니다',
  path: ['total_amount']
}).refine((data) => {
  // Paid amount cannot exceed total amount
  return data.paid_amount <= data.total_amount;
}, {
  message: '지급액은 합계금액을 초과할 수 없습니다',
  path: ['paid_amount']
});

export const SalesTransactionUpdateSchema = SalesTransactionCreateSchema.partial().extend({
  transaction_id: IdSchema
});

export const SalesTransactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  customer_id: IdSchema.optional(),
  item_id: IdSchema.optional(),
  vehicle_model: z.string().max(50).optional(),
  payment_status: PaymentStatusSchema.optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  search: z.string().max(255).optional()
});

// Purchase Transactions validation schemas
export const PurchaseTransactionCreateSchema = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식'),
  supplier_id: IdSchema,
  item_id: IdSchema,
  vehicle_model: OptionalTextSchema,
  material_type: z.string().max(20).optional(),
  quantity: PositiveNumberSchema,
  unit: KoreanTextSchema.max(10).default('EA'),
  unit_price: PositiveNumberSchema,
  supply_amount: PositiveNumberSchema,
  tax_amount: NonNegativeNumberSchema.default(0),
  total_amount: PositiveNumberSchema,
  receiving_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  warehouse_location: z.string().max(50).optional(),
  tax_invoice_id: IdSchema.optional(),
  tax_invoice_received: z.boolean().default(false),
  payment_status: PaymentStatusSchema.default('PENDING'),
  paid_amount: NonNegativeNumberSchema.default(0),
  payment_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  notes: OptionalTextSchema
}).refine((data) => {
  // Total amount should equal supply_amount + tax_amount
  return Math.abs(data.total_amount - (data.supply_amount + data.tax_amount)) < 0.01;
}, {
  message: '합계금액은 공급가액 + 부가세와 일치해야 합니다',
  path: ['total_amount']
}).refine((data) => {
  // Paid amount cannot exceed total amount
  return data.paid_amount <= data.total_amount;
}, {
  message: '지급액은 합계금액을 초과할 수 없습니다',
  path: ['paid_amount']
});

export const PurchaseTransactionUpdateSchema = PurchaseTransactionCreateSchema.partial().extend({
  transaction_id: IdSchema
});

export const PurchaseTransactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  supplier_id: IdSchema.optional(),
  item_id: IdSchema.optional(),
  vehicle_model: z.string().max(50).optional(),
  payment_status: PaymentStatusSchema.optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  search: z.string().max(255).optional()
});

// Bulk operation schemas
export const BulkDeleteSchema = z.object({
  ids: z.array(IdSchema).min(1).max(100)
});

export const BulkUpdateSchema = z.object({
  updates: z.array(z.object({
    id: IdSchema,
    data: z.record(z.string(), z.any())
  })).min(1).max(100)
});

// Excel import validation schemas
export const ExcelImportSchema = z.object({
  file_type: z.enum(['items', 'companies', 'inventory']),
  overwrite_existing: z.boolean().default(false),
  validate_only: z.boolean().default(false)
});

// File upload validation schemas
export const FileUploadSchema = z.object({
  file_size: z.number().max(10 * 1024 * 1024, '파일 크기는 10MB 이하여야 합니다'),
  file_type: z.enum(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']),
  file_name: z.string().max(255)
});

// Price History validation schemas
export const PriceHistoryCreateSchema = z.object({
  item_id: IdSchema,
  price_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식'),
  unit_price: PositiveNumberSchema,
  price_per_kg: PositiveNumberSchema.optional(),
  note: OptionalTextSchema,
  created_by: z.string().max(100).optional()
});

export const PriceHistoryUpdateSchema = PriceHistoryCreateSchema.partial().extend({
  price_history_id: IdSchema
});

export const PriceHistoryBulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      item_id: IdSchema,
      price_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식'),
      unit_price: PositiveNumberSchema,
      price_per_kg: PositiveNumberSchema.optional(),
      note: OptionalTextSchema
    })
  ).min(1, '최소 1개 이상의 업데이트가 필요합니다').max(100, '최대 100개까지 업데이트 가능합니다'),
  override_existing: z.boolean().default(false)
});

export const PriceHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  item_id: IdSchema.optional(),
  start_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  end_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  category: z.string().max(50).optional(),
  supplier_id: IdSchema.optional(),
  min_price: z.coerce.number().positive().optional(),
  max_price: z.coerce.number().positive().optional(),
  search: z.string().max(255).optional(),
  sort_by: z.enum(['price_month', 'unit_price', 'item_name']).default('price_month'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// Export schemas for easy access
export type ItemCreate = z.infer<typeof ItemCreateSchema>;
export type ItemUpdate = z.infer<typeof ItemUpdateSchema>;
export type ItemQuery = z.infer<typeof ItemQuerySchema>;
export type CompanyCreate = z.infer<typeof CompanyCreateSchema>;
export type CompanyUpdate = z.infer<typeof CompanyUpdateSchema>;
export type CompanyQuery = z.infer<typeof CompanyQuerySchema>;
export type BOMCreate = z.infer<typeof BOMCreateSchema>;
export type BOMUpdate = z.infer<typeof BOMUpdateSchema>;
export type BOMQuery = z.infer<typeof BOMQuerySchema>;
export type InventoryTransactionCreate = z.infer<typeof InventoryTransactionCreateSchema>;
export type InventoryTransactionUpdate = z.infer<typeof InventoryTransactionUpdateSchema>;
export type InventoryTransactionQuery = z.infer<typeof InventoryTransactionQuerySchema>;
export type StockAdjustmentCreate = z.infer<typeof StockAdjustmentCreateSchema>;
export type StockAdjustmentQuery = z.infer<typeof StockAdjustmentQuerySchema>;
export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type UserPasswordUpdate = z.infer<typeof UserPasswordUpdateSchema>;
export type UserQuery = z.infer<typeof UserQuerySchema>;
export type Login = z.infer<typeof LoginSchema>;
export type TokenRefresh = z.infer<typeof TokenRefreshSchema>;
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;
export type BulkDelete = z.infer<typeof BulkDeleteSchema>;
export type BulkUpdate = z.infer<typeof BulkUpdateSchema>;
export type ExcelImport = z.infer<typeof ExcelImportSchema>;
export type FileUpload = z.infer<typeof FileUploadSchema>;
export type PriceHistoryCreate = z.infer<typeof PriceHistoryCreateSchema>;
export type PriceHistoryUpdate = z.infer<typeof PriceHistoryUpdateSchema>;
export type PriceHistoryBulkUpdate = z.infer<typeof PriceHistoryBulkUpdateSchema>;
export type PriceHistoryQuery = z.infer<typeof PriceHistoryQuerySchema>;

// Notification validation schemas
export const NotificationTypeSchema = z.enum(['price_alert', 'price_change', 'system']);

export const NotificationCreateSchema = z.object({
  user_id: IdSchema,
  type: NotificationTypeSchema,
  title: KoreanTextSchema.max(200),
  message: z.string().min(1).max(1000),
  item_id: IdSchema.optional(),
  is_read: z.boolean().default(false)
});

export const NotificationUpdateSchema = z.object({
  notification_id: IdSchema,
  is_read: z.boolean()
});

export const NotificationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  user_id: z.coerce.number().int().positive().optional(),
  type: NotificationTypeSchema.optional(),
  is_read: z.coerce.boolean().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional()
});

// Notification Preferences validation schemas
export const NotificationPreferencesSchema = z.object({
  user_id: IdSchema,
  email_enabled: z.boolean().default(true),
  push_enabled: z.boolean().default(false),
  price_threshold: PositiveNumberSchema.optional(),
  categories: z.array(z.string().max(50)).optional()
});

export const NotificationPreferencesUpdateSchema = NotificationPreferencesSchema.partial().extend({
  user_id: IdSchema
});

// Trend Analysis validation schemas
export const TrendAnalysisGranularitySchema = z.enum(['day', 'week', 'month']);

export const TrendAnalysisQuerySchema = z.object({
  item_id: z.coerce.number().int().positive().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  granularity: TrendAnalysisGranularitySchema.default('month'),
  include_forecast: z.coerce.boolean().default(false)
}).refine((data) => {
  if (data.start_date && data.end_date) {
    return data.start_date <= data.end_date;
  }
  return true;
}, {
  message: '시작일이 종료일보다 늦을 수 없습니다',
  path: ['start_date']
});

// Contract validation schemas
export const ContractCreateSchema = z.object({
  company_id: IdSchema,
  contract_no: EnglishTextSchema.max(50),
  contract_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식'),
  total_amount: PositiveNumberSchema,
  status: ContractStatusSchema.default('ACTIVE'),
  searchable_text: z.string().max(10000).optional(),
  notes: OptionalTextSchema
}).refine((data) => {
  return data.start_date <= data.end_date;
}, {
  message: '시작일이 종료일보다 늦을 수 없습니다',
  path: ['start_date']
});

export const ContractUpdateSchema = ContractCreateSchema.partial().extend({
  contract_id: IdSchema
});

export const ContractQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  company_id: IdSchema.optional(),
  status: ContractStatusSchema.optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식').optional(),
  search: z.string().max(255).optional(),
  sort_by: z.enum(['contract_date', 'start_date', 'end_date', 'total_amount']).default('contract_date'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export const ContractDocumentUploadSchema = z.object({
  contract_id: IdSchema,
  file_size: z.number().max(52428800, '파일 크기는 50MB 이하여야 합니다'),
  file_type: z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]),
  file_name: z.string().min(1).max(255)
});

// Export types
export type ContractCreate = z.infer<typeof ContractCreateSchema>;
export type ContractUpdate = z.infer<typeof ContractUpdateSchema>;
export type ContractQuery = z.infer<typeof ContractQuerySchema>;
export type ContractDocumentUpload = z.infer<typeof ContractDocumentUploadSchema>;

export type NotificationCreate = z.infer<typeof NotificationCreateSchema>;
export type NotificationUpdate = z.infer<typeof NotificationUpdateSchema>;
export type NotificationQuery = z.infer<typeof NotificationQuerySchema>;

export type ItemClassificationUpdate = z.infer<typeof ItemClassificationUpdateSchema>;
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;
export type NotificationPreferencesUpdate = z.infer<typeof NotificationPreferencesUpdateSchema>;
export type TrendAnalysisQuery = z.infer<typeof TrendAnalysisQuerySchema>;