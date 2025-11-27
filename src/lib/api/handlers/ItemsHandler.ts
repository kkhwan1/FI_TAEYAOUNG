/**
 * Items Handler
 * Handles CRUD operations for items (품목)
 */

import { CRUDHandler } from '../CRUDHandler';
import type { APIResponse, RequestContext } from '../types';
import { ERPError, ErrorType } from '@/lib/errorHandler';

export class ItemsHandler extends CRUDHandler {
  constructor() {
    super({
      tableName: 'items',
      idField: 'item_id',
      activeField: 'is_active',
      searchFields: ['item_code', 'item_name', 'spec'],
      selectFields: `
        item_id, item_code, item_name, item_type, vehicle_model, spec,
        unit, current_stock, safety_stock, price, location,
        description, is_active, created_at, updated_at,
        category, material_type, material, thickness, width, height,
        specific_gravity, mm_weight, coating_status, scrap_rate,
        scrap_unit_price, yield_rate, overhead_rate
      `
    });
  }

  /**
   * Validation: Create item
   */
  protected async validateCreate(data: any): Promise<void> {
    // Required fields check
    if (!data.item_name || !data.unit) {
      throw new ERPError(
        ErrorType.VALIDATION,
        'item_name과 unit은 필수 입력 항목입니다.',
        { provided_fields: Object.keys(data) }
      );
    }

    // Check duplicate item_code
    if (data.item_code) {
      const { data: existing, error } = await this.supabase
        .from('items')
        .select('item_id')
        .eq('item_code', data.item_code)
        .eq('is_active', true);

      if (error) {
        console.error('Error checking duplicate item_code:', error);
      } else if (existing && existing.length > 0) {
        throw new ERPError(
          ErrorType.DUPLICATE_ENTRY,
          '이미 사용 중인 품목 코드입니다.',
          { item_code: data.item_code }
        );
      }
    }
  }

  /**
   * Validation: Update item
   */
  protected async validateUpdate(id: number | string, data: any): Promise<void> {
    // Check duplicate item_code (exclude current item)
    if (data.item_code) {
      const numericId = typeof id === 'string' ? Number(id) : id;
      const { data: existing, error } = await this.supabase
        .from('items')
        .select('item_id')
        .eq('item_code', data.item_code)
        .neq('item_id', numericId)
        .eq('is_active', true);

      if (error) {
        console.error('Error checking duplicate item_code:', error);
      } else if (existing && existing.length > 0) {
        throw new ERPError(
          ErrorType.DUPLICATE_ENTRY,
          '다른 품목이 이미 해당 코드를 사용 중입니다.',
          { item_code: data.item_code, existing_item_id: existing[0].item_id }
        );
      }
    }
  }

  /**
   * Validation: Delete item - check dependencies
   */
  protected async validateDelete(id: number | string): Promise<void> {
    const numericId = typeof id === 'string' ? Number(id) : id;
    // Check BOM usage
    const { count: bomCount, error: bomError } = await this.supabase
      .from('bom')
      .select('*', { count: 'exact', head: true })
      .or(`parent_item_id.eq.${numericId},child_item_id.eq.${numericId}`)
      .eq('is_active', true);

    if (bomError) {
      console.error('Error checking BOM usage:', bomError);
    } else if (bomCount && bomCount > 0) {
      throw new ERPError(
        ErrorType.DATABASE_CONSTRAINT,
        'BOM에서 사용 중인 품목은 삭제할 수 없습니다.',
        { item_id: id, bom_usage_count: bomCount }
      );
    }

    // Check inventory transaction history
    const { count: transactionCount, error: transactionError } = await this.supabase
      .from('inventory_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('item_id', numericId);

    if (transactionError) {
      console.error('Error checking transaction history:', transactionError);
    } else if (transactionCount && transactionCount > 0) {
      throw new ERPError(
        ErrorType.DATABASE_CONSTRAINT,
        '재고 이동 기록이 있는 품목은 삭제할 수 없습니다.',
        { item_id: id, transaction_count: transactionCount }
      );
    }
  }
}
