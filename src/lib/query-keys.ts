/**
 * Centralized QueryKey Factory
 *
 * Hierarchical query key structure for all domains:
 * - items: Master data (5 min staleTime)
 * - companies: Master data (5 min staleTime)
 * - bom: Bill of Materials (5 min staleTime)
 * - transactions: Sales/Purchase/Collection/Payment (2 min staleTime)
 * - inventory: Stock movements (2 min staleTime)
 * - dashboard: Real-time stats (30s staleTime with auto-refresh)
 * - accounting: Financial data (5 min staleTime)
 * - batch: Production batches (2 min staleTime)
 * - price: Price management (5 min staleTime)
 */

// ==================== ITEMS DOMAIN ====================
export interface ItemFilters {
  category?: string;
  itemType?: string;
  materialType?: string;
  vehicleModel?: string;
  search?: string;
  isActive?: boolean;
}

export const itemKeys = {
  all: ['items'] as const,
  lists: () => [...itemKeys.all, 'list'] as const,
  list: (filters: ItemFilters = {}) => [...itemKeys.lists(), filters] as const,
  details: () => [...itemKeys.all, 'detail'] as const,
  detail: (id: number) => [...itemKeys.details(), id] as const,
  categories: () => [...itemKeys.all, 'categories'] as const,
  types: () => [...itemKeys.all, 'types'] as const,
  materials: () => [...itemKeys.all, 'materials'] as const,
  vehicles: () => [...itemKeys.all, 'vehicles'] as const,
};

// ==================== COMPANIES DOMAIN ====================
export interface CompanyFilters {
  type?: string;
  search?: string;
  isActive?: boolean;
  category?: string;
}

export const companyKeys = {
  all: ['companies'] as const,
  lists: () => [...companyKeys.all, 'list'] as const,
  list: (filters: CompanyFilters = {}) => [...companyKeys.lists(), filters] as const,
  details: () => [...companyKeys.all, 'detail'] as const,
  detail: (id: number) => [...companyKeys.details(), id] as const,
  customers: () => [...companyKeys.all, 'customers'] as const,
  suppliers: () => [...companyKeys.all, 'suppliers'] as const,
  partners: () => [...companyKeys.all, 'partners'] as const,
};

// ==================== BOM DOMAIN ====================
export interface BOMFilters {
  parentId?: number;
  childId?: number;
  search?: string;
}

export const bomKeys = {
  all: ['bom'] as const,
  lists: () => [...bomKeys.all, 'list'] as const,
  list: (filters: BOMFilters = {}) => [...bomKeys.lists(), filters] as const,
  details: () => [...bomKeys.all, 'detail'] as const,
  detail: (parentId: number) => [...bomKeys.details(), parentId] as const,
  tree: (parentId: number) => [...bomKeys.all, 'tree', parentId] as const,
  flat: (parentId: number) => [...bomKeys.all, 'flat', parentId] as const,
  // 인라인 BOM 관계 편집용 (lite 모드)
  byItem: (itemId: number, role: 'parent' | 'child') => [...bomKeys.all, 'byItem', itemId, role] as const,
};

// ==================== TRANSACTIONS DOMAIN ====================
export interface TransactionFilters {
  type?: string;
  itemId?: number;
  companyId?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  status?: string;
}

export const transactionKeys = {
  all: ['transactions'] as const,

  // Sales transactions
  sales: () => [...transactionKeys.all, 'sales'] as const,
  salesList: (filters: TransactionFilters = {}) => [...transactionKeys.sales(), filters] as const,
  salesDetail: (id: number) => [...transactionKeys.sales(), 'detail', id] as const,

  // Purchase transactions
  purchases: () => [...transactionKeys.all, 'purchases'] as const,
  purchasesList: (filters: TransactionFilters = {}) => [...transactionKeys.purchases(), filters] as const,
  purchasesDetail: (id: number) => [...transactionKeys.purchases(), 'detail', id] as const,

  // Collections
  collections: () => [...transactionKeys.all, 'collections'] as const,
  collectionsList: (filters: TransactionFilters = {}) => [...transactionKeys.collections(), filters] as const,
  collectionsDetail: (id: number) => [...transactionKeys.collections(), 'detail', id] as const,

  // Payments
  payments: () => [...transactionKeys.all, 'payments'] as const,
  paymentsList: (filters: TransactionFilters = {}) => [...transactionKeys.payments(), filters] as const,
  paymentsDetail: (id: number) => [...transactionKeys.payments(), 'detail', id] as const,

  // Summary/Stats
  summary: (type?: string) => [...transactionKeys.all, 'summary', { type }] as const,
};

// ==================== INVENTORY DOMAIN ====================
export interface InventoryFilters {
  transactionType?: string;
  itemId?: number;
  companyId?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const inventoryKeys = {
  all: ['inventory'] as const,

  // Stock status
  stock: () => [...inventoryKeys.all, 'stock'] as const,
  stockList: (filters: Partial<InventoryFilters> = {}) => [...inventoryKeys.stock(), filters] as const,
  stockDetail: (itemId: number) => [...inventoryKeys.stock(), 'detail', itemId] as const,
  stockSummary: () => [...inventoryKeys.stock(), 'summary'] as const,
  stockAlerts: () => [...inventoryKeys.stock(), 'alerts'] as const,

  // Transactions
  transactions: () => [...inventoryKeys.all, 'transactions'] as const,
  transactionsList: (filters: InventoryFilters = {}) => [...inventoryKeys.transactions(), filters] as const,
  transactionsDetail: (id: number) => [...inventoryKeys.transactions(), 'detail', id] as const,

  // Movements
  movements: () => [...inventoryKeys.all, 'movements'] as const,
  movement: (itemId: number, period?: string) => [...inventoryKeys.movements(), itemId, period] as const,

  // Receiving & Shipping
  receiving: () => [...inventoryKeys.all, 'receiving'] as const,
  receivingList: (filters: Partial<InventoryFilters> = {}) => [...inventoryKeys.receiving(), filters] as const,
};

// ==================== DASHBOARD DOMAIN ====================
export interface DashboardFilters {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const dashboardKeys = {
  all: ['dashboard'] as const,

  // Overview stats
  stats: (filters: DashboardFilters = {}) => [...dashboardKeys.all, 'stats', filters] as const,

  // Charts data
  charts: () => [...dashboardKeys.all, 'charts'] as const,
  salesChart: (filters: DashboardFilters = {}) => [...dashboardKeys.charts(), 'sales', filters] as const,
  purchasesChart: (filters: DashboardFilters = {}) => [...dashboardKeys.charts(), 'purchases', filters] as const,
  inventoryChart: (filters: DashboardFilters = {}) => [...dashboardKeys.charts(), 'inventory', filters] as const,

  // Alerts & Notifications
  alerts: () => [...dashboardKeys.all, 'alerts'] as const,
  stockAlerts: () => [...dashboardKeys.alerts(), 'stock'] as const,
  paymentAlerts: () => [...dashboardKeys.alerts(), 'payment'] as const,

  // Recent activities
  activities: (limit?: number) => [...dashboardKeys.all, 'activities', { limit }] as const,
};

// ==================== ACCOUNTING DOMAIN ====================
export interface AccountingFilters {
  year?: number;
  month?: number;
  category?: string;
}

export const accountingKeys = {
  all: ['accounting'] as const,

  // Summary
  summary: (filters: AccountingFilters = {}) => [...accountingKeys.all, 'summary', filters] as const,

  // Monthly data
  monthly: () => [...accountingKeys.all, 'monthly'] as const,
  monthlyData: (year: number, month: number) => [...accountingKeys.monthly(), year, month] as const,

  // Category breakdown
  categories: () => [...accountingKeys.all, 'categories'] as const,
  categoryBreakdown: (filters: AccountingFilters = {}) => [...accountingKeys.categories(), filters] as const,

  // Invoices
  invoices: () => [...accountingKeys.all, 'invoices'] as const,
  invoicesList: (filters: Partial<AccountingFilters> = {}) => [...accountingKeys.invoices(), filters] as const,
  invoiceDetail: (id: number) => [...accountingKeys.invoices(), 'detail', id] as const,
};

// ==================== BATCH/PRODUCTION DOMAIN ====================
export interface BatchFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export const batchKeys = {
  all: ['batch'] as const,
  lists: () => [...batchKeys.all, 'list'] as const,
  list: (filters: BatchFilters = {}) => [...batchKeys.lists(), filters] as const,
  details: () => [...batchKeys.all, 'detail'] as const,
  detail: (id: number) => [...batchKeys.details(), id] as const,
  status: (id: number) => [...batchKeys.all, 'status', id] as const,
};

// ==================== PRICE MANAGEMENT DOMAIN ====================
export interface PriceFilters {
  itemId?: number;
  companyId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export const priceKeys = {
  all: ['prices'] as const,
  lists: () => [...priceKeys.all, 'list'] as const,
  list: (filters: PriceFilters = {}) => [...priceKeys.lists(), filters] as const,
  history: (itemId: number) => [...priceKeys.all, 'history', itemId] as const,
  current: (itemId: number, companyId?: number) => [
    ...priceKeys.all,
    'current',
    itemId,
    companyId
  ] as const,
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get staleTime for a specific domain
 */
export function getStaleTime(domain: string): number {
  const staleTimes: Record<string, number> = {
    items: 5 * 60 * 1000,        // 5 minutes (master data)
    companies: 5 * 60 * 1000,    // 5 minutes (master data)
    bom: 5 * 60 * 1000,          // 5 minutes (master data)
    transactions: 2 * 60 * 1000, // 2 minutes (transactional data)
    inventory: 2 * 60 * 1000,    // 2 minutes (transactional data)
    dashboard: 30 * 1000,        // 30 seconds (real-time data)
    accounting: 5 * 60 * 1000,   // 5 minutes (financial data)
    batch: 2 * 60 * 1000,        // 2 minutes (production data)
    prices: 5 * 60 * 1000,       // 5 minutes (price data)
  };

  return staleTimes[domain] || 5 * 60 * 1000; // Default 5 minutes
}

/**
 * Get refetch interval for auto-refresh (dashboard only)
 */
export function getRefetchInterval(domain: string): number | false {
  if (domain === 'dashboard') {
    return 60 * 1000; // 1 minute auto-refresh for dashboard
  }
  return false; // No auto-refresh for other domains
}

/**
 * Check if feature flag is enabled for domain migration
 */
export function isQueryEnabled(domain: string): boolean {
  if (typeof window === 'undefined') return true; // Server-side always enabled

  const flags: Record<string, boolean> = {
    items: process.env.NEXT_PUBLIC_ENABLE_QUERY_ITEMS !== 'false',
    companies: process.env.NEXT_PUBLIC_ENABLE_QUERY_COMPANIES !== 'false',
    bom: process.env.NEXT_PUBLIC_ENABLE_QUERY_BOM !== 'false',
    transactions: process.env.NEXT_PUBLIC_ENABLE_QUERY_TRANSACTIONS !== 'false',
    inventory: process.env.NEXT_PUBLIC_ENABLE_QUERY_INVENTORY !== 'false',
    dashboard: process.env.NEXT_PUBLIC_ENABLE_QUERY_DASHBOARD !== 'false',
    accounting: process.env.NEXT_PUBLIC_ENABLE_QUERY_ACCOUNTING !== 'false',
    batch: process.env.NEXT_PUBLIC_ENABLE_QUERY_BATCH !== 'false',
    prices: process.env.NEXT_PUBLIC_ENABLE_QUERY_PRICES !== 'false',
  };

  return flags[domain] ?? true; // Default enabled
}

// Export all query keys
export const queryKeys = {
  items: itemKeys,
  companies: companyKeys,
  bom: bomKeys,
  transactions: transactionKeys,
  inventory: inventoryKeys,
  dashboard: dashboardKeys,
  accounting: accountingKeys,
  batch: batchKeys,
  prices: priceKeys,
};
