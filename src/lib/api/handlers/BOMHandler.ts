/**
 * BOM Handler
 * Handles CRUD operations for BOM (Bill of Materials)
 */

import { CRUDHandler } from '../CRUDHandler';
import type { APIResponse, RequestContext } from '../types';
import { ERPError, ErrorType } from '@/lib/errorHandler';

export class BOMHandler extends CRUDHandler {
  constructor() {
    super({
      tableName: 'bom',
      idField: 'bom_id',
      activeField: 'is_active',
      searchFields: [],
      selectFields: '*',
      relationFields: `
        parent:items!parent_item_id (item_code, item_name, spec, price),
        child:items!child_item_id (item_code, item_name, spec, unit, price, category)
      `
    });
  }

  /**
   * Validation: Create BOM
   */
  protected async validateCreate(data: any): Promise<void> {
    const { parent_item_id, child_item_id, quantity_required } = data;

    // Required fields
    if (!parent_item_id || !child_item_id || !quantity_required) {
      throw new ERPError(
        ErrorType.VALIDATION,
        '부모 품목, 자식 품목, 소요수량은 필수입니다.'
      );
    }

    // 자기 참조 허용: 모품목과 자품목이 같을 수 있음

    // Quantity validation
    if (quantity_required <= 0) {
      throw new ERPError(
        ErrorType.VALIDATION,
        '소요량은 0보다 커야 합니다'
      );
    }

    // Check if items exist and are active
    await this.validateItemExists(parent_item_id, '부모 품목');
    await this.validateItemExists(child_item_id, '자식 품목');

    // Check circular reference
    const hasCircular = await this.checkCircularReference(parent_item_id, child_item_id);
    if (hasCircular) {
      throw new ERPError(
        ErrorType.VALIDATION,
        '순환 참조가 감지되었습니다. BOM 구조를 확인해주세요.'
      );
    }
  }

  /**
   * Validation: Update BOM
   */
  protected async validateUpdate(id: number | string, data: any): Promise<void> {
    if (data.quantity_required !== undefined && data.quantity_required <= 0) {
      throw new ERPError(
        ErrorType.VALIDATION,
        '소요수량은 0보다 커야 합니다.'
      );
    }
  }

  /**
   * Check if item exists and is active
   */
  private async validateItemExists(itemId: number, itemType: string): Promise<void> {
    const { data: item, error } = await this.supabase
      .from('items')
      .select('item_id, item_name, is_active')
      .eq('item_id', itemId)
      .single();

    if (error || !item) {
      throw new ERPError(
        ErrorType.NOT_FOUND,
        `${itemType}을 찾을 수 없습니다.`
      );
    }

    if (!item.is_active) {
      throw new ERPError(
        ErrorType.VALIDATION,
        `비활성화된 ${itemType}입니다.`
      );
    }
  }

  /**
   * Check for circular reference in BOM structure
   */
  private async checkCircularReference(
    parentId: number,
    childId: number
  ): Promise<boolean> {
    const { data } = await this.supabase
      .from('bom')
      .select('child_item_id')
      .eq('parent_item_id', childId)
      .eq('is_active', true);

    if (!data || data.length === 0) return false;

    for (const row of data) {
      if (row.child_item_id === parentId) return true;
      if (await this.checkCircularReference(parentId, row.child_item_id)) {
        return true;
      }
    }
    return false;
  }
}
