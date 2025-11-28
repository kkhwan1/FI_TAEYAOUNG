/**
 * Enhanced Transaction Manager for ERP System
 * Provides comprehensive atomic transaction support with rollback capabilities
 *
 * Note: This file contains legacy MySQL transaction code that is not used in the Supabase implementation.
 * All transaction management is handled by Supabase PostgreSQL.
 */

// Type definitions for compatibility (MySQL legacy types)
type PoolConnection = any;

// Enhanced interfaces with audit trail support
export interface TransactionOptions {
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  timeout?: number; // in milliseconds
  retryAttempts?: number;
  retryDelay?: number; // in milliseconds
  enableAuditLog?: boolean;
  userId?: number;
  operation?: string;
}

export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rollbackReason?: string;
  executionTime?: number;
  auditLogId?: number;
  retryCount?: number;
}

export interface TransactionContext {
  connection: PoolConnection;
  rollback: () => Promise<void>;
  commit: () => Promise<void>;
  isActive: boolean;
  startTime: number;
  auditLogId?: number;
  userId?: number;
  operation?: string;
}

// Audit log interface
export interface AuditLog {
  id?: number;
  user_id?: number;
  operation: string;
  table_name: string;
  record_id?: number;
  old_values?: string;
  new_values?: string;
  status: 'SUCCESS' | 'FAILED' | 'ROLLBACK';
  error_message?: string;
  execution_time?: number;
  created_at?: string;
}

// Business rule validation interfaces
export interface StockValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  currentStock: number;
  requiredStock: number;
  availableStock: number;
}

export interface BOMValidationResult {
  isValid: boolean;
  errors: string[];
  circularDependency: boolean;
  materialShortages: MaterialShortage[];
  totalCost: number;
}

export interface MaterialShortage {
  item_id: number;
  item_name: string;
  required: number;
  available: number;
  shortage: number;
}

/**
 * Enhanced transaction manager with retry logic and error handling
 */
export class TransactionManager {
  private static defaultOptions: TransactionOptions = {
    isolationLevel: 'READ COMMITTED',
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
    enableAuditLog: true
  };

  /**
   * Create audit log entry (simplified version without audit_logs table)
   */
  private static async createAuditLog(
    connection: PoolConnection,
    data: Partial<AuditLog>
  ): Promise<number | null> {
    try {
      // For now, just log to console since audit_logs table doesn't exist
      // In production, you might want to create the audit_logs table

      // Return a mock ID for compatibility
      return Math.floor(Math.random() * 1000000);
    } catch (error) {
      console.error('Failed to create audit log:', error);
      return null;
    }
  }

  /**
   * Update audit log status (simplified version)
   */
  private static async updateAuditLog(
    connection: PoolConnection,
    auditLogId: number,
    status: 'SUCCESS' | 'FAILED' | 'ROLLBACK',
    errorMessage?: string,
    executionTime?: number
  ): Promise<void> {
    try {
      // For now, just log to console since audit_logs table doesn't exist
    } catch (error) {
      console.error('Failed to update audit log:', error);
    }
  }

  /**
   * Execute a transaction with enhanced error handling and retry logic
   */
  static async execute<T>(
    callback: (context: TransactionContext) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    const finalOptions = { ...this.defaultOptions, ...options };
    const lastError: any = null;
    const auditLogId: number | null = null;

    // Create initial audit log if enabled
    // Note: This is legacy MySQL code - not used in Supabase implementation
    // if (finalOptions.enableAuditLog && finalOptions.operation) {
    //   try {
    //     const connection = await getPool().getConnection();
    //     auditLogId = await this.createAuditLog(connection, {
    //       user_id: finalOptions.userId,
    //       operation: finalOptions.operation,
    //       table_name: 'TRANSACTION',
    //       status: 'FAILED' // Will be updated on success
    //     });
    //     connection.release();
    //   } catch (error) {
    //     console.warn('Failed to create initial audit log:', error);
    //   }
    // }

    for (let attempt = 1; attempt <= finalOptions.retryAttempts!; attempt++) {
      const result = await this.executeAttempt(callback, finalOptions, attempt, auditLogId);

      if (result.success) {
        // Update audit log on success
        if (auditLogId && result.data) {
          try {
            // Note: Audit log updates disabled (MySQL legacy code)
            // const connection = await getPool().getConnection();
            // await this.updateAuditLog(connection, auditLogId, 'SUCCESS', undefined, result.executionTime);
            // connection.release();
          } catch (error) {
            console.warn('Failed to update audit log on success:', error);
          }
        }
        return { ...result, auditLogId: auditLogId || undefined, retryCount: attempt - 1 };
      }


      // Don't retry for certain types of errors
      if (this.isNonRetryableError(result.error)) {
        break;
      }
      // Exponential backoff with jitter
      if (attempt < finalOptions.retryAttempts!) {
        const backoffTime = this.calculateBackoff(finalOptions.retryDelay!, attempt);
        await this.delay(backoffTime);
      }
    }

    // Update audit log on final failure
    if (auditLogId) {
      try {
        // Note: Audit log updates disabled (MySQL legacy code)
        // const connection = await getPool().getConnection();
        // await this.updateAuditLog(connection, auditLogId, 'FAILED', `Transaction failed after ${finalOptions.retryAttempts} attempts: ${lastError}`);
        // connection.release();
      } catch (error) {
        console.warn('Failed to update audit log on failure:', error);
      }
    }

    return {
      success: false,
      error: `Transaction failed after ${finalOptions.retryAttempts} attempts: ${lastError}`,
      auditLogId: auditLogId || undefined,
      retryCount: finalOptions.retryAttempts! - 1
    };
  }

  /**
   * Calculate exponential backoff with jitter
   */
  private static calculateBackoff(baseDelay: number, attempt: number): number {
    // Exponential backoff: delay * 2^(attempt-1) with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    // Add random jitter (±25%)
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
    return Math.round(exponentialDelay + jitter);
  }

  /**
   * Execute a single transaction attempt
   */
  private static async executeAttempt<T>(
    callback: (context: TransactionContext) => Promise<T>,
    options: TransactionOptions,
    attemptNumber: number,
    auditLogId?: number | null
  ): Promise<TransactionResult<T>> {
    const startTime = Date.now();
    const connection: PoolConnection | null = null;
    let isCommitted = false;
    let isRolledBack = false;

    try {
      // Note: MySQL connection pool disabled (using Supabase now)
      // Transaction management handled by Supabase

      // Set up timeout if specified
      let timeoutHandle: NodeJS.Timeout | null = null;
      if (options.timeout) {
        timeoutHandle = setTimeout(() => {
          throw new Error(`Transaction timeout after ${options.timeout}ms`);
        }, options.timeout);
      }

      // Ensure connection is not null before creating context
      if (!connection) {
        throw new Error('Failed to get database connection');
      }

      // Create enhanced transaction context
      const context: TransactionContext = {
        connection,
        rollback: async () => {
          if (!isRolledBack && !isCommitted) {
            // Note: Rollback disabled (MySQL legacy - using Supabase transactions)
            isRolledBack = true;
          }
        },
        commit: async () => {
          if (!isRolledBack && !isCommitted) {
            // Note: Commit disabled (MySQL legacy - using Supabase transactions)
            isCommitted = true;
          }
        },
        isActive: true,
        startTime,
        auditLogId: auditLogId || undefined,
        userId: options.userId,
        operation: options.operation
      };

      try {
        // Execute the callback
        const result = await callback(context);

        // Clear timeout
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        // Auto-commit if not already committed or rolled back
        if (!isCommitted && !isRolledBack) {
          // Note: Auto-commit disabled (MySQL legacy - using Supabase transactions)
          isCommitted = true;
        }

        const executionTime = Date.now() - startTime;

        return {
          success: true,
          data: result,
          executionTime
        };

      } catch (error) {
        // Clear timeout
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        // Auto-rollback if not already rolled back
        if (!isRolledBack && !isCommitted) {
          // Note: Auto-rollback disabled (MySQL legacy - using Supabase transactions)
          isRolledBack = true;
        }

        throw error;
      }

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`Transaction attempt ${attemptNumber} failed:`, {
        error: errorMessage,
        executionTime,
        isolationLevel: options.isolationLevel
      });

      return {
        success: false,
        error: errorMessage,
        rollbackReason: 'Exception during transaction execution',
        executionTime
      };

    } finally {
      // Note: Connection release disabled (MySQL legacy - using Supabase)
      // if (connection) {
      //   connection.release();
      // }
    }
  }

  /**
   * Check if an error should not be retried
   */
  private static isNonRetryableError(error: unknown): boolean {
    const errorMessage = String(error).toLowerCase();

    // Don't retry for validation errors, constraint violations, business logic errors
    const nonRetryablePatterns = [
      'duplicate entry',
      'foreign key constraint',
      'data too long',
      'out of range',
      'incorrect',
      'syntax error',
      'access denied',
      'table doesn\'t exist',
      'column cannot be null',
      'insufficient stock',
      'circular dependency',
      'business rule violation',
      'invalid transaction type',
      'bom relationship already exists',
      'parent item not found',
      'child item not found'
    ];

    return nonRetryablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Validate stock availability for transaction
   */
  static async validateStock(
    connection: PoolConnection,
    itemId: number,
    requiredQuantity: number,
    transactionType: string
  ): Promise<StockValidationResult> {
    try {
      // Get current stock information
      const [stockData] = await connection.execute(
        'SELECT current_quantity as current_stock, name as item_name, safety_stock FROM current_stock WHERE id = ?',
        [itemId]
      ) as any[];

      if (!stockData || stockData.length === 0) {
        return {
          isValid: false,
          errors: ['Item not found or inactive'],
          warnings: [],
          currentStock: 0,
          requiredStock: requiredQuantity,
          availableStock: 0
        };
      }

      const stock = stockData[0];
      const currentStock = stock.current_stock || 0;
      const safetyStock = stock.safety_stock || 0;
      const availableStock = Math.max(0, currentStock - safetyStock);

      const errors: string[] = [];
      const warnings: string[] = [];

      // For outgoing transactions, check if we have enough stock
      if (['출고', 'SHIP', '생산출고', 'PRODUCTION_OUT'].includes(transactionType)) {
        if (currentStock < requiredQuantity) {
          errors.push(`Insufficient stock for ${stock.item_name}. Required: ${requiredQuantity}, Available: ${currentStock}`);
        } else if (currentStock - requiredQuantity < safetyStock) {
          warnings.push(`Transaction will reduce stock below safety level for ${stock.item_name}`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        currentStock,
        requiredStock: requiredQuantity,
        availableStock
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Stock validation failed: ${error}`],
        warnings: [],
        currentStock: 0,
        requiredStock: requiredQuantity,
        availableStock: 0
      };
    }
  }

  /**
   * Validate BOM structure and material availability
   */
  static async validateBOM(
    connection: PoolConnection,
    parentItemId: number,
    productionQuantity: number
  ): Promise<BOMValidationResult> {
    try {
      // Get BOM structure
      const [bomData] = await connection.execute(
        `SELECT b.child_item_id, b.quantity as bom_quantity, i.name as item_name, cs.current_quantity as current_stock, i.unit_price
         FROM boms b
         JOIN items i ON b.child_item_id = i.id
         LEFT JOIN current_stock cs ON i.id = cs.id
         WHERE b.parent_item_id = ? AND b.is_active = 1 AND i.is_active = 1`,
        [parentItemId]
      ) as any[];

      if (!bomData || bomData.length === 0) {
        return {
          isValid: false,
          errors: ['No active BOM found for this item'],
          circularDependency: false,
          materialShortages: [],
          totalCost: 0
        };
      }

      const errors: string[] = [];
      const materialShortages: MaterialShortage[] = [];
      let totalCost = 0;

      // Check material availability
      for (const material of bomData) {
        const requiredQuantity = material.bom_quantity * productionQuantity;
        const currentStock = material.current_stock || 0;
        const unitPrice = material.unit_price || 0;

        totalCost += requiredQuantity * unitPrice;

        if (currentStock < requiredQuantity) {
          const shortage = requiredQuantity - currentStock;
          materialShortages.push({
            item_id: material.child_item_id,
            item_name: material.item_name,
            required: requiredQuantity,
            available: currentStock,
            shortage: shortage
          });
          errors.push(`Insufficient stock for ${material.item_name}. Required: ${requiredQuantity}, Available: ${currentStock}`);
        }
      }

      // 순환 참조 허용: 모든 순환 참조(자기 참조 포함)를 허용함

      return {
        isValid: errors.length === 0,
        errors: errors,
        circularDependency: false,
        materialShortages,
        totalCost
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`BOM validation failed: ${error}`],
        circularDependency: false,
        materialShortages: [],
        totalCost: 0
      };
    }
  }

  /**
   * Check for circular dependencies in BOM
   * 순환 참조 허용: 모든 순환 참조(자기 참조 포함)를 허용함
   */
  private static async checkCircularDependency(
    connection: PoolConnection,
    parentItemId: number,
    visited: Set<number> = new Set(),
    depth: number = 0
  ): Promise<boolean> {
    // 항상 false를 반환하여 순환 참조 검사를 비활성화
    return false;
  }

  /**
   * Delay helper for retry logic
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Additional business logic validation functions
 */
export class BusinessRuleValidator {
  /**
   * Validate item transfer between locations
   */
  static async validateLocationTransfer(
    connection: PoolConnection,
    itemId: number,
    fromLocation: string,
    toLocation: string,
    quantity: number
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate that locations are different
      if (fromLocation === toLocation) {
        errors.push('Source and destination locations cannot be the same');
      }

      // Check if item exists at source location with sufficient quantity
      const [locationStock] = await connection.execute(
        `SELECT SUM(
          CASE
            WHEN transaction_type IN ('입고', '생산입고') AND (to_location = ? OR to_location IS NULL) THEN quantity
            WHEN transaction_type IN ('출고', '생산출고', '폐기') AND (from_location = ? OR from_location IS NULL) THEN -quantity
            WHEN transaction_type = '이동' AND to_location = ? THEN quantity
            WHEN transaction_type = '이동' AND from_location = ? THEN -quantity
            ELSE 0
          END
        ) as location_stock
        FROM inventory_transactions
        WHERE item_id = ?`,
        [fromLocation, fromLocation, fromLocation, fromLocation, itemId]
      ) as any[];

      const locationQuantity = locationStock[0]?.location_stock || 0;
      if (locationQuantity < quantity) {
        errors.push(`Insufficient stock at location ${fromLocation}. Available: ${locationQuantity}, Required: ${quantity}`);
      }

      return { isValid: errors.length === 0, errors, warnings };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Location validation failed: ${error}`],
        warnings: []
      };
    }
  }

  /**
   * Validate expiry date for items with expiration tracking
   */
  static validateExpiryDate(
    expiryDate: string | null,
    transactionType: string,
    leadTimeDays: number = 0
  ): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!expiryDate) {
      return { isValid: true, errors, warnings };
    }

    const expiry = new Date(expiryDate);
    const today = new Date();
    const warningThreshold = new Date();
    warningThreshold.setDate(today.getDate() + 30); // 30 days warning

    // Check if already expired
    if (expiry < today) {
      errors.push(`Item has expired on ${expiryDate}`);
    }
    // Check if expiring soon for incoming transactions
    else if (['입고', '생산입고'].includes(transactionType) && expiry < warningThreshold) {
      warnings.push(`Item will expire soon on ${expiryDate}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate lot number format and uniqueness
   */
  static async validateLotNumber(
    connection: PoolConnection,
    itemId: number,
    lotNo: string | null,
    transactionType: string
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!lotNo) {
      return { isValid: true, errors, warnings };
    }

    try {
      // Check lot number format (example: YYYYMMDD-XXXX)
      const lotPattern = /^\d{8}-\d{4}$/;
      if (!lotPattern.test(lotNo)) {
        warnings.push(`Lot number ${lotNo} does not follow standard format (YYYYMMDD-XXXX)`);
      }

      // For incoming transactions, check if lot already exists
      if (['입고', '생산입고'].includes(transactionType)) {
        const [existingLot] = await connection.execute(
          'SELECT COUNT(*) as count FROM inventory_transactions WHERE item_id = ? AND lot_no = ?',
          [itemId, lotNo]
        ) as any[];

        if (existingLot[0]?.count > 0) {
          warnings.push(`Lot number ${lotNo} already exists for this item`);
        }
      }

      return { isValid: errors.length === 0, errors, warnings };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Lot validation failed: ${error}`],
        warnings: []
      };
    }
  }
}

/**
 * Specific transaction types for ERP operations
 */
export class ERPTransactions {
  /**
   * Create inventory transaction with comprehensive validation and stock update
   */
  static async createInventoryTransaction(data: {
    item_id: number;
    transaction_type: string;
    quantity: number;
    unit_price?: number;
    company_id?: number;
    reference_no?: string;
    notes?: string;
    created_by: number;
    transaction_date?: string;
    from_location?: string;
    to_location?: string;
    lot_no?: string;
    expiry_date?: string;
  }): Promise<TransactionResult<any>> {
    return TransactionManager.execute(async (context) => {
      const { connection } = context;

      // Validate item exists and is active
      const [itemCheck] = await connection.execute(
        'SELECT id, name, unit FROM items WHERE id = ? AND is_active = 1',
        [data.item_id]
      ) as any[];

      if (!itemCheck || itemCheck.length === 0) {
        throw new Error('Item not found or inactive');
      }

      const item = itemCheck[0];

      // Validate transaction type
      const validTypes = ['입고', '출고', '생산입고', '생산출고', '이동', '조정', '폐기'];
      if (!validTypes.includes(data.transaction_type)) {
        throw new Error(`Invalid transaction type: ${data.transaction_type}`);
      }

      // Pre-validate stock for outgoing transactions
      if (['출고', '생산출고', '폐기'].includes(data.transaction_type)) {
        const stockValidation = await TransactionManager.validateStock(
          connection,
          data.item_id,
          data.quantity,
          data.transaction_type
        );

        if (!stockValidation.isValid) {
          throw new Error(`Business rule violation: ${stockValidation.errors.join(', ')}`);
        }

        // Log warnings
        if (stockValidation.warnings.length > 0) {
          console.warn('Stock warnings:', stockValidation.warnings);
        }
      }

      // Validate location transfer if it's a movement transaction
      if (data.transaction_type === '이동' && data.from_location && data.to_location) {
        const locationValidation = await BusinessRuleValidator.validateLocationTransfer(
          connection,
          data.item_id,
          data.from_location,
          data.to_location,
          data.quantity
        );

        if (!locationValidation.isValid) {
          throw new Error(`Location transfer validation failed: ${locationValidation.errors.join(', ')}`);
        }

        if (locationValidation.warnings.length > 0) {
          console.warn('Location transfer warnings:', locationValidation.warnings);
        }
      }

      // Validate expiry date if provided
      if (data.expiry_date) {
        const expiryValidation = BusinessRuleValidator.validateExpiryDate(
          data.expiry_date,
          data.transaction_type
        );

        if (!expiryValidation.isValid) {
          throw new Error(`Expiry date validation failed: ${expiryValidation.errors.join(', ')}`);
        }

        if (expiryValidation.warnings.length > 0) {
          console.warn('Expiry date warnings:', expiryValidation.warnings);
        }
      }

      // Validate lot number if provided
      if (data.lot_no) {
        const lotValidation = await BusinessRuleValidator.validateLotNumber(
          connection,
          data.item_id,
          data.lot_no,
          data.transaction_type
        );

        if (!lotValidation.isValid) {
          throw new Error(`Lot number validation failed: ${lotValidation.errors.join(', ')}`);
        }

        if (lotValidation.warnings.length > 0) {
          console.warn('Lot number warnings:', lotValidation.warnings);
        }
      }

      // Validate company if provided
      if (data.company_id) {
        const [companyCheck] = await connection.execute(
          'SELECT id FROM companies WHERE id = ? AND is_active = 1',
          [data.company_id]
        ) as any[];

        if (!companyCheck || companyCheck.length === 0) {
          throw new Error('Company not found or inactive');
        }
      }

      // Calculate total amount
      const total_amount = data.quantity * (data.unit_price || 0);

      // Insert inventory transaction with correct field names
      const [insertResult] = await connection.execute(
        `INSERT INTO inventory_transactions (
          transaction_date, transaction_type, item_id, quantity,
          unit_price, total_amount, company_id, reference_no,
          from_location, to_location, lot_no, expiry_date,
          notes, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          data.transaction_date || new Date().toISOString().split('T')[0],
          data.transaction_type,
          data.item_id,
          data.quantity,
          data.unit_price || 0,
          total_amount,
          data.company_id || null,
          data.reference_no || null,
          data.from_location || null,
          data.to_location || null,
          data.lot_no || null,
          data.expiry_date || null,
          data.notes || null,
          data.created_by
        ]
      );

      const transactionId = (insertResult as any).insertId;

      // Note: Stock is managed by the current_stock view, not directly updating items table
      // The view automatically calculates current stock from inventory_transactions

      // Get updated stock information
      const [stockInfo] = await connection.execute(
        'SELECT current_quantity, stock_status FROM current_stock WHERE id = ?',
        [data.item_id]
      ) as any[];

      const newStock = stockInfo[0]?.current_quantity || 0;
      const stockStatus = stockInfo[0]?.stock_status || '알수없음';

      return {
        transaction_id: transactionId,
        item_name: item.name,
        transaction_type: data.transaction_type,
        quantity: data.quantity,
        unit_price: data.unit_price || 0,
        total_amount,
        new_stock: newStock,
        stock_status: stockStatus
      };
    }, {
      enableAuditLog: true,
      userId: data.created_by,
      operation: 'CREATE_INVENTORY_TRANSACTION'
    });
  }

  /**
   * Update inventory transaction with comprehensive validation and stock adjustment
   */
  static async updateInventoryTransaction(
    transaction_id: number,
    updateData: any,
    user_id: number
  ): Promise<TransactionResult<any>> {
    return TransactionManager.execute(async (context) => {
      const { connection } = context;

      // Get current transaction data
      const [currentData] = await connection.execute(
        'SELECT * FROM inventory_transactions WHERE id = ?',
        [transaction_id]
      ) as any[];

      if (!currentData || currentData.length === 0) {
        throw new Error('Transaction not found');
      }

      const current = currentData[0];

      // Store original values for audit trail
      const originalValues = { ...current };

      // Validate that quantity/type changes won't cause business rule violations
      if (updateData.quantity !== undefined || updateData.transaction_type !== undefined) {
        const newQuantity = updateData.quantity ?? current.quantity;
        const newType = updateData.transaction_type ?? current.transaction_type;

        // For outgoing transactions, validate stock availability
        if (['출고', '생산출고', '폐기'].includes(newType)) {
          // Get current stock before this transaction
          const [stockBeforeUpdate] = await connection.execute(
            'SELECT current_quantity FROM current_stock WHERE id = ?',
            [current.item_id]
          ) as any[];

          const currentStock = stockBeforeUpdate[0]?.current_quantity || 0;

          // Calculate what the stock would be without the original transaction
          let stockWithoutOriginal = currentStock;
          if (['입고', '생산입고'].includes(current.transaction_type)) {
            stockWithoutOriginal -= current.quantity;
          } else if (['출고', '생산출고', '폐기'].includes(current.transaction_type)) {
            stockWithoutOriginal += current.quantity;
          }

          // Check if the new transaction would be valid
          if (['출고', '생산출고', '폐기'].includes(newType) && stockWithoutOriginal < newQuantity) {
            throw new Error(`Insufficient stock for updated transaction. Available: ${stockWithoutOriginal}, Required: ${newQuantity}`);
          }
        }
      }

      // Calculate total amount if price or quantity changed
      if (updateData.quantity !== undefined || updateData.unit_price !== undefined) {
        const quantity = updateData.quantity ?? current.quantity;
        const unit_price = updateData.unit_price ?? current.unit_price;
        updateData.total_amount = quantity * unit_price;
      }

      // Add updated_at timestamp
      updateData.updated_at = new Date();

      // Build dynamic update query
      const updateFields = Object.keys(updateData)
        .filter(key => key !== 'id') // Don't update ID
        .map(key => `${key} = ?`)
        .join(', ');

      const updateValues = Object.keys(updateData)
        .filter(key => key !== 'id')
        .map(key => updateData[key]);

      await connection.execute(
        `UPDATE inventory_transactions SET ${updateFields} WHERE id = ?`,
        [...updateValues, transaction_id]
      );

      // Get updated stock information (automatically calculated by view)
      const [stockInfo] = await connection.execute(
        'SELECT current_quantity, stock_status FROM current_stock WHERE id = ?',
        [current.item_id]
      ) as any[];

      const newStock = stockInfo[0]?.current_quantity || 0;
      const stockStatus = stockInfo[0]?.stock_status || '알수없음';

      return {
        transaction_id,
        updated_fields: Object.keys(updateData).filter(key => key !== 'updated_at'),
        original_values: originalValues,
        new_stock: newStock,
        stock_status: stockStatus
      };
    }, {
      enableAuditLog: true,
      userId: user_id,
      operation: 'UPDATE_INVENTORY_TRANSACTION'
    });
  }

  /**
   * Delete inventory transaction with comprehensive validation and stock reversal
   */
  static async deleteInventoryTransaction(
    transaction_id: number,
    user_id: number
  ): Promise<TransactionResult<any>> {
    return TransactionManager.execute(async (context) => {
      const { connection } = context;

      // Get transaction data before deletion
      const [transactionData] = await connection.execute(
        'SELECT * FROM inventory_transactions WHERE id = ?',
        [transaction_id]
      ) as any[];

      if (!transactionData || transactionData.length === 0) {
        throw new Error('Transaction not found');
      }

      const transaction = transactionData[0];

      // Store original transaction for audit trail
      const originalTransaction = { ...transaction };

      // Business rule: Check if deleting this transaction would cause negative stock
      const [currentStockData] = await connection.execute(
        'SELECT current_quantity FROM current_stock WHERE id = ?',
        [transaction.item_id]
      ) as any[];

      const currentStock = currentStockData[0]?.current_quantity || 0;

      // Calculate what stock would be after deletion
      let stockAfterDeletion = currentStock;
      if (['입고', '생산입고'].includes(transaction.transaction_type)) {
        stockAfterDeletion -= transaction.quantity; // Removing an incoming transaction decreases stock
      } else if (['출고', '생산출고', '폐기'].includes(transaction.transaction_type)) {
        stockAfterDeletion += transaction.quantity; // Removing an outgoing transaction increases stock
      }

      if (stockAfterDeletion < 0) {
        throw new Error(`Cannot delete transaction: would result in negative stock (${stockAfterDeletion})`);
      }

      // Check if this transaction is referenced by other transactions
      const [referencedTransactions] = await connection.execute(
        'SELECT COUNT(*) as count FROM inventory_transactions WHERE reference_no = ? AND id != ?',
        [transaction.reference_no, transaction_id]
      ) as any[];

      if (referencedTransactions[0]?.count > 0 && transaction.reference_no) {
        console.warn(`Warning: Deleting transaction that is part of a group (reference: ${transaction.reference_no})`);
      }

      // Delete the transaction (stock will be automatically recalculated by the view)
      const [deleteResult] = await connection.execute(
        'DELETE FROM inventory_transactions WHERE id = ?',
        [transaction_id]
      );

      if ((deleteResult as any).affectedRows === 0) {
        throw new Error('Failed to delete transaction');
      }

      // Get updated stock information
      const [newStockData] = await connection.execute(
        'SELECT current_quantity, stock_status FROM current_stock WHERE id = ?',
        [transaction.item_id]
      ) as any[];

      const newStock = newStockData[0]?.current_quantity || 0;
      const stockStatus = newStockData[0]?.stock_status || '알수없음';

      return {
        deleted_transaction_id: transaction_id,
        original_transaction: originalTransaction,
        new_stock: newStock,
        stock_status: stockStatus,
        stock_change: newStock - currentStock
      };
    }, {
      enableAuditLog: true,
      userId: user_id,
      operation: 'DELETE_INVENTORY_TRANSACTION'
    });
  }

  /**
   * Create BOM with validation
   */
  static async createBOM(data: {
    parent_item_id: number;
    child_item_id: number;
    quantity: number;
    notes?: string;
    user_id: number;
  }): Promise<TransactionResult<any>> {
    return TransactionManager.execute(async (context) => {
      const { connection } = context;

      // Validate parent and child items exist
      const [parentCheck] = await connection.execute(
        'SELECT id, name FROM items WHERE id = ? AND is_active = 1',
        [data.parent_item_id]
      ) as any[];

      const [childCheck] = await connection.execute(
        'SELECT id, name FROM items WHERE id = ? AND is_active = 1',
        [data.child_item_id]
      ) as any[];

      if (!parentCheck || parentCheck.length === 0) {
        throw new Error('Parent item not found or inactive');
      }

      if (!childCheck || childCheck.length === 0) {
        throw new Error('Child item not found or inactive');
      }

      // 순환 참조 허용: 모든 순환 참조(자기 참조 포함)를 허용함
      // 중복 입력 허용: 같은 품목 조합도 여러 번 입력 가능

      // Insert BOM record
      const [insertResult] = await connection.execute(
        `INSERT INTO boms (parent_item_id, child_item_id, quantity, notes, is_active, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, NOW(), NOW())`,
        [data.parent_item_id, data.child_item_id, data.quantity, data.notes, data.user_id]
      );

      return {
        bom_id: (insertResult as any).insertId,
        parent_item: parentCheck[0].name,
        child_item: childCheck[0].name,
        quantity: data.quantity
      };
    }, {
      enableAuditLog: true,
      userId: data.user_id,
      operation: 'CREATE_BOM'
    });
  }

  /**
   * Bulk create multiple inventory transactions atomically
   */
  static async createBulkInventoryTransactions(
    transactions: Array<{
      item_id: number;
      transaction_type: string;
      quantity: number;
      unit_price?: number;
      company_id?: number;
      reference_no?: string;
      notes?: string;
      from_location?: string;
      to_location?: string;
      lot_no?: string;
      expiry_date?: string;
    }>,
    user_id: number
  ): Promise<TransactionResult<any[]>> {
    return TransactionManager.execute(async (context) => {
      const { connection } = context;
      const results = [];

      for (const txData of transactions) {
        // Use the same validation logic as single transaction
        const result = await ERPTransactions.createInventoryTransaction({
          ...txData,
          created_by: user_id
        });

        if (!result.success) {
          throw new Error(`Failed to create transaction for item ${txData.item_id}: ${result.error}`);
        }

        results.push(result.data);
      }

      return results;
    }, {
      enableAuditLog: true,
      userId: user_id,
      operation: 'CREATE_BULK_INVENTORY_TRANSACTIONS'
    });
  }

  /**
   * Stock adjustment transaction with comprehensive audit trail
   */
  static async createStockAdjustment(data: {
    item_id: number;
    adjustment_quantity: number; // Can be positive or negative
    reason: string;
    reference_no?: string;
    notes?: string;
    user_id: number;
  }): Promise<TransactionResult<any>> {
    return TransactionManager.execute(async (context) => {
      const { connection } = context;

      // Get current stock
      const [currentStockData] = await connection.execute(
        'SELECT current_quantity, name FROM current_stock WHERE id = ?',
        [data.item_id]
      ) as any[];

      if (!currentStockData || currentStockData.length === 0) {
        throw new Error('Item not found');
      }

      const currentStock = currentStockData[0].current_quantity || 0;
      const itemName = currentStockData[0].name;
      const newStock = currentStock + data.adjustment_quantity;

      // Prevent negative stock unless explicitly allowed
      if (newStock < 0) {
        throw new Error(`Stock adjustment would result in negative stock. Current: ${currentStock}, Adjustment: ${data.adjustment_quantity}`);
      }

      // Create adjustment transaction
      const [insertResult] = await connection.execute(
        `INSERT INTO inventory_transactions (
          transaction_date, transaction_type, item_id, quantity,
          unit_price, total_amount, reference_no, notes, created_by
        ) VALUES (CURDATE(), '조정', ?, ?, 0, 0, ?, ?, ?)`,
        [
          data.item_id,
          data.adjustment_quantity,
          data.reference_no || `ADJ-${Date.now()}`,
          `${data.reason}: ${data.notes || ''}`,
          data.user_id
        ]
      );

      return {
        transaction_id: (insertResult as any).insertId,
        item_name: itemName,
        previous_stock: currentStock,
        adjustment_quantity: data.adjustment_quantity,
        new_stock: newStock,
        reason: data.reason
      };
    }, {
      enableAuditLog: true,
      userId: data.user_id,
      operation: 'CREATE_STOCK_ADJUSTMENT'
    });
  }

  /**
   * Production transaction with BOM consumption
   */
  static async createProductionTransaction(data: {
    parent_item_id: number;
    production_quantity: number;
    reference_id?: string;
    note?: string;
    user_id: number;
  }): Promise<TransactionResult<any>> {
    return TransactionManager.execute(async (context) => {
      const { connection } = context;

      // Get BOM for the parent item
      const [bomData] = await connection.execute(
        `SELECT b.child_item_id, b.quantity, i.name as item_name, cs.current_quantity as current_stock
         FROM boms b
         JOIN items i ON b.child_item_id = i.id
         LEFT JOIN current_stock cs ON i.id = cs.id
         WHERE b.parent_item_id = ? AND b.is_active = 1 AND i.is_active = 1`,
        [data.parent_item_id]
      ) as any[];

      if (!bomData || bomData.length === 0) {
        throw new Error('No active BOM found for this item');
      }

      // Check if we have enough materials
      for (const material of bomData) {
        const requiredQuantity = material.quantity * data.production_quantity;
        if (material.current_stock < requiredQuantity) {
          throw new Error(`Insufficient stock for ${material.item_name}. Required: ${requiredQuantity}, Available: ${material.current_stock}`);
        }
      }

      // Create production transaction (increases finished goods stock)
      const [productionResult] = await connection.execute(
        `INSERT INTO inventory_transactions (
          transaction_date, transaction_type, item_id, quantity,
          unit_price, total_amount, reference_no, notes, created_by
        ) VALUES (CURDATE(), '생산입고', ?, ?, 0, 0, ?, ?, ?)`,
        [data.parent_item_id, data.production_quantity, data.reference_id, data.note, data.user_id]
      );

      // Consume materials
      const consumedMaterials = [];
      for (const material of bomData) {
        const consumedQuantity = material.quantity * data.production_quantity;

        // Create consumption transaction
        await connection.execute(
          `INSERT INTO inventory_transactions (
            transaction_date, transaction_type, item_id, quantity,
            unit_price, total_amount, reference_no, notes, created_by
          ) VALUES (CURDATE(), '생산출고', ?, ?, 0, 0, ?, ?, ?)`,
          [material.child_item_id, consumedQuantity, data.reference_id,
           `Production consumption for ${data.reference_id}`, data.user_id]
        );

        consumedMaterials.push({
          item_id: material.child_item_id,
          item_name: material.item_name,
          consumed_quantity: consumedQuantity,
          remaining_stock: material.current_stock - consumedQuantity
        });
      }

      return {
        production_transaction_id: (productionResult as any).insertId,
        produced_quantity: data.production_quantity,
        consumed_materials: consumedMaterials
      };
    }, {
      enableAuditLog: true,
      userId: data.user_id,
      operation: 'CREATE_PRODUCTION_TRANSACTION'
    });
  }

  /**
   * Create scrap transaction with detailed tracking
   */
  static async createScrapTransaction(data: {
    item_id: number;
    quantity: number;
    reason: '불량' | '파손' | '유효기간만료' | '기타';
    description?: string;
    disposal_method?: '폐기' | '반품' | '재활용' | '기타';
    cost_amount?: number;
    reference_no?: string;
    user_id: number;
  }): Promise<TransactionResult<any>> {
    return TransactionManager.execute(async (context) => {
      const { connection } = context;

      // Validate stock availability
      const stockValidation = await TransactionManager.validateStock(
        connection,
        data.item_id,
        data.quantity,
        '폐기'
      );

      if (!stockValidation.isValid) {
        throw new Error(`Insufficient stock for scrap: ${stockValidation.errors.join(', ')}`);
      }

      // Create scrap record
      const [scrapResult] = await connection.execute(
        `INSERT INTO scraps (
          scrap_date, item_id, quantity, reason, description,
          disposal_method, cost_amount, reference_no, created_by
        ) VALUES (CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.item_id,
          data.quantity,
          data.reason,
          data.description || null,
          data.disposal_method || null,
          data.cost_amount || 0,
          data.reference_no || `SCRAP-${Date.now()}`,
          data.user_id
        ]
      );

      // Create inventory transaction for stock reduction
      const [inventoryResult] = await connection.execute(
        `INSERT INTO inventory_transactions (
          transaction_date, transaction_type, item_id, quantity,
          unit_price, total_amount, reference_no, notes, created_by
        ) VALUES (CURDATE(), '폐기', ?, ?, 0, 0, ?, ?, ?)`,
        [
          data.item_id,
          data.quantity,
          data.reference_no || `SCRAP-${Date.now()}`,
          `Scrap - ${data.reason}: ${data.description || ''}`,
          data.user_id
        ]
      );

      // Get updated stock
      const [stockInfo] = await connection.execute(
        'SELECT current_quantity, stock_status FROM current_stock WHERE id = ?',
        [data.item_id]
      ) as any[];

      return {
        scrap_id: (scrapResult as any).insertId,
        inventory_transaction_id: (inventoryResult as any).insertId,
        scrapped_quantity: data.quantity,
        reason: data.reason,
        new_stock: stockInfo[0]?.current_quantity || 0,
        stock_status: stockInfo[0]?.stock_status || '알수없음'
      };
    }, {
      enableAuditLog: true,
      userId: data.user_id,
      operation: 'CREATE_SCRAP_TRANSACTION'
    });
  }

  /**
   * Complex multi-location inventory transfer
   */
  static async createMultiLocationTransfer(data: {
    transfers: Array<{
      item_id: number;
      quantity: number;
      from_location: string;
      to_location: string;
      lot_no?: string;
      notes?: string;
    }>;
    reference_no?: string;
    user_id: number;
  }): Promise<TransactionResult<any[]>> {
    return TransactionManager.execute(async (context) => {
      const { connection } = context;
      const results = [];

      for (const transfer of data.transfers) {
        // Validate location transfer
        const locationValidation = await BusinessRuleValidator.validateLocationTransfer(
          connection,
          transfer.item_id,
          transfer.from_location,
          transfer.to_location,
          transfer.quantity
        );

        if (!locationValidation.isValid) {
          throw new Error(`Location transfer failed for item ${transfer.item_id}: ${locationValidation.errors.join(', ')}`);
        }

        // Create movement transaction
        const [moveResult] = await connection.execute(
          `INSERT INTO inventory_transactions (
            transaction_date, transaction_type, item_id, quantity,
            unit_price, total_amount, from_location, to_location,
            lot_no, reference_no, notes, created_by
          ) VALUES (CURDATE(), '이동', ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)`,
          [
            transfer.item_id,
            transfer.quantity,
            transfer.from_location,
            transfer.to_location,
            transfer.lot_no || null,
            data.reference_no || `MOVE-${Date.now()}`,
            transfer.notes || `Transfer from ${transfer.from_location} to ${transfer.to_location}`,
            data.user_id
          ]
        );

        results.push({
          transaction_id: (moveResult as any).insertId,
          item_id: transfer.item_id,
          quantity: transfer.quantity,
          from_location: transfer.from_location,
          to_location: transfer.to_location
        });
      }

      return results;
    }, {
      enableAuditLog: true,
      userId: data.user_id,
      operation: 'CREATE_MULTI_LOCATION_TRANSFER'
    });
  }
}

/**
 * Advanced stock analysis and reporting functions
 */
export class StockAnalyzer {
  /**
   * Get stock turnover analysis
   */
  static async getStockTurnoverAnalysis(
    connection: PoolConnection,
    itemId?: number,
    startDate?: string,
    endDate?: string
  ): Promise<any[]> {
    const dateFilter = startDate && endDate
      ? 'AND it.transaction_date BETWEEN ? AND ?'
      : '';
    const itemFilter = itemId ? 'AND i.id = ?' : '';

    const params = [];
    if (startDate && endDate) {
      params.push(startDate, endDate);
    }
    if (itemId) {
      params.push(itemId);
    }

    const [results] = await connection.execute(
      `SELECT
        i.id as item_id,
        i.name as item_name,
        i.category,
        cs.current_quantity,
        COALESCE(SUM(CASE WHEN it.transaction_type IN ('출고', '생산출고') THEN it.quantity ELSE 0 END), 0) as total_outgoing,
        COALESCE(SUM(CASE WHEN it.transaction_type IN ('입고', '생산입고') THEN it.quantity ELSE 0 END), 0) as total_incoming,
        CASE
          WHEN cs.current_quantity > 0 AND SUM(CASE WHEN it.transaction_type IN ('출고', '생산출고') THEN it.quantity ELSE 0 END) > 0
          THEN SUM(CASE WHEN it.transaction_type IN ('출고', '생산출고') THEN it.quantity ELSE 0 END) / cs.current_quantity
          ELSE 0
        END as turnover_ratio
      FROM items i
      LEFT JOIN current_stock cs ON i.id = cs.id
      LEFT JOIN inventory_transactions it ON i.id = it.item_id ${dateFilter}
      WHERE i.is_active = 1 ${itemFilter}
      GROUP BY i.id, i.name, i.category, cs.current_quantity
      ORDER BY turnover_ratio DESC`,
      params
    ) as any[];

    return results;
  }

  /**
   * Get ABC analysis based on value and movement
   */
  static async getABCAnalysis(
    connection: PoolConnection,
    analysisType: 'value' | 'movement' | 'combined' = 'combined'
  ): Promise<any[]> {
    const [results] = await connection.execute(
      `SELECT
        i.id as item_id,
        i.name as item_name,
        i.category,
        cs.current_quantity,
        i.unit_price,
        (cs.current_quantity * i.unit_price) as stock_value,
        COALESCE(SUM(CASE WHEN it.transaction_type IN ('출고', '생산출고') THEN it.quantity ELSE 0 END), 0) as total_movement,
        (cs.current_quantity * i.unit_price) + COALESCE(SUM(CASE WHEN it.transaction_type IN ('출고', '생산출고') THEN it.quantity ELSE 0 END), 0) as combined_score
      FROM items i
      LEFT JOIN current_stock cs ON i.id = cs.id
      LEFT JOIN inventory_transactions it ON i.id = it.item_id
        AND it.transaction_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      WHERE i.is_active = 1
      GROUP BY i.id, i.name, i.category, cs.current_quantity, i.unit_price
      ORDER BY
        CASE
          WHEN ? = 'value' THEN (cs.current_quantity * i.unit_price)
          WHEN ? = 'movement' THEN COALESCE(SUM(CASE WHEN it.transaction_type IN ('출고', '생산출고') THEN it.quantity ELSE 0 END), 0)
          ELSE (cs.current_quantity * i.unit_price) + COALESCE(SUM(CASE WHEN it.transaction_type IN ('출고', '생산출고') THEN it.quantity ELSE 0 END), 0)
        END DESC`,
      [analysisType, analysisType]
    ) as any[];

    // Add ABC classification with proper type assertions
    const totalValue = results.reduce((sum: number, item: unknown) => {
      const itemData = item as Record<string, any>;
      const value = analysisType === 'value' ? (itemData.stock_value || 0) :
                   analysisType === 'movement' ? (itemData.total_movement || 0) :
                   (itemData.combined_score || 0);
      return sum + value;
    }, 0);

    let cumulativeValue = 0;
    return results.map((item: unknown) => {
      const itemData = item as Record<string, any>;
      const value = analysisType === 'value' ? (itemData.stock_value || 0) :
                   analysisType === 'movement' ? (itemData.total_movement || 0) :
                   (itemData.combined_score || 0);
      cumulativeValue += value;
      const percentage = (cumulativeValue / totalValue) * 100;

      let classification = 'C';
      if (percentage <= 80) classification = 'A';
      else if (percentage <= 95) classification = 'B';

      return {
        ...itemData,
        abc_classification: classification,
        cumulative_percentage: percentage.toFixed(2)
      };
    });
  }
}

/**
 * Legacy transaction function for backward compatibility
 */
export async function transaction<T = any>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const result = await TransactionManager.execute(async (context) => {
    return await callback(context.connection);
  });

  if (result.success) {
    return result.data!;
  } else {
    throw new Error(result.error);
  }
}