/**
 * Base CRUD Handler
 * Provides standardized CRUD operations for all API routes
 *
 * Features:
 * - Standard APIResponse format
 * - Automatic pagination
 * - Soft delete support
 * - Korean text encoding (request.text() + JSON.parse())
 * - Error handling integration
 * - Search and filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import {
  handleError,
  createSuccessResponse,
  handleNotFoundError,
  handleValidationError
} from '@/lib/errorHandler';
import type {
  APIResponse,
  QueryParams,
  RequestContext,
  HandlerOptions,
  ICRUDHandler,
  SupabaseClientType
} from './types';

/**
 * Base CRUD Handler Class
 * Extend this class for domain-specific handlers
 */
export abstract class CRUDHandler<T = any> implements ICRUDHandler<T> {
  protected supabase: SupabaseClientType;
  protected options: HandlerOptions;

  constructor(options: HandlerOptions) {
    this.supabase = getSupabaseClient();
    this.options = {
      idField: options.idField || `${options.tableName}_id`,
      activeField: options.activeField || 'is_active',
      searchFields: options.searchFields || [],
      selectFields: options.selectFields || '*',
      relationFields: options.relationFields || '',
      ...options
    };
  }

  /**
   * Parse request body with Korean encoding support
   * CRITICAL: Uses request.text() + JSON.parse() pattern
   */
  protected async parseRequestBody(request: NextRequest): Promise<any> {
    const text = await request.text();
    return JSON.parse(text);
  }

  /**
   * Parse query parameters for list operations
   */
  protected parseQueryParams(request: NextRequest): QueryParams {
    const searchParams = request.nextUrl.searchParams;
    return {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      search: searchParams.get('search') || undefined,
      orderBy: searchParams.get('orderBy') || undefined,
      orderDirection: (searchParams.get('orderDirection') as 'asc' | 'desc') || 'asc',
      filters: this.parseFilters(searchParams)
    };
  }

  /**
   * Parse additional filters from query string
   */
  protected parseFilters(searchParams: URLSearchParams): Record<string, any> {
    const filters: Record<string, any> = {};
    for (const [key, value] of searchParams.entries()) {
      if (!['page', 'limit', 'search', 'orderBy', 'orderDirection'].includes(key)) {
        filters[key] = value;
      }
    }
    return filters;
  }

  /**
   * Build search query
   */
  protected buildSearchQuery(query: any, search: string): any {
    if (!search || !this.options.searchFields || this.options.searchFields.length === 0) {
      return query;
    }

    const searchConditions = this.options.searchFields
      .map(field => `${field}.ilike.%${search}%`)
      .join(',');

    return query.or(searchConditions);
  }

  /**
   * GET ALL - List records with pagination and filters
   */
  async getAll(request: NextRequest, context: RequestContext): Promise<APIResponse<T[]>> {
    try {
      const params = this.parseQueryParams(request);
      const { page = 1, limit = 20, search, orderBy, orderDirection, filters } = params;

      // Build query - Use 'any' type to avoid excessive type depth
      let query: any = this.supabase
        .from(this.options.tableName as any)
        .select(this.options.selectFields + (this.options.relationFields ? `, ${this.options.relationFields}` : ''), { count: 'exact' });

      // Apply active filter (soft delete)
      if (this.options.activeField) {
        query = query.eq(this.options.activeField, true);
      }

      // Apply search
      if (search) {
        query = this.buildSearchQuery(query, search);
      }

      // Apply custom filters
      for (const [key, value] of Object.entries(filters || {})) {
        query = query.eq(key, value);
      }

      // Apply ordering
      if (orderBy) {
        query = query.order(orderBy, { ascending: orderDirection === 'asc' });
      }

      // Apply pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error(`Error fetching ${this.options.tableName}:`, error);
        throw error;
      }

      return {
        success: true,
        data: data as T[],
        pagination: {
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit),
          totalCount: count || 0
        }
      };
    } catch (error) {
      console.error(`Error in getAll for ${this.options.tableName}:`, error);
      throw error;
    }
  }

  /**
   * GET BY ID - Retrieve single record
   */
  async getById(id: number | string, context: RequestContext): Promise<APIResponse<T>> {
    try {
      let query = this.supabase
        .from(this.options.tableName as any)
        .select(this.options.selectFields + (this.options.relationFields ? `, ${this.options.relationFields}` : ''))
        .eq(this.options.idField!, id);

      // Apply active filter
      if (this.options.activeField) {
        query = query.eq(this.options.activeField, true);
      }

      const { data, error } = await query.single();

      if (error || !data) {
        throw new Error(`${this.options.tableName} not found`);
      }

      return {
        success: true,
        data: data as T
      };
    } catch (error) {
      console.error(`Error in getById for ${this.options.tableName}:`, error);
      throw error;
    }
  }

  /**
   * POST - Create new record
   * Override this method for custom validation
   */
  async create(data: any, context: RequestContext): Promise<APIResponse<T>> {
    try {
      // Validate before insert (override in child classes)
      await this.validateCreate(data);

      const insertData = {
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (this.options.activeField) {
        insertData[this.options.activeField] = true;
      }

      const { data: createdRecord, error } = await this.supabase
        .from(this.options.tableName as any)
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error(`Error creating ${this.options.tableName}:`, error);
        throw error;
      }

      return {
        success: true,
        data: createdRecord as T,
        message: `${this.options.tableName} 생성 성공`
      };
    } catch (error) {
      console.error(`Error in create for ${this.options.tableName}:`, error);
      throw error;
    }
  }

  /**
   * PUT/PATCH - Update existing record
   */
  async update(id: number | string, data: any, context: RequestContext): Promise<APIResponse<T>> {
    try {
      // Check if record exists
      const existsCheck = await this.getById(id, context);
      if (!existsCheck.success) {
        throw new Error(`${this.options.tableName} not found`);
      }

      // Validate before update (override in child classes)
      await this.validateUpdate(id, data);

      const updateData = {
        ...data,
        updated_at: new Date().toISOString()
      };

      // Remove id field from update
      delete updateData[this.options.idField!];

      let query = this.supabase
        .from(this.options.tableName as any)
        .update(updateData)
        .eq(this.options.idField!, id);

      if (this.options.activeField) {
        query = query.eq(this.options.activeField, true);
      }

      const { data: updatedRecord, error } = await query.select().single();

      if (error) {
        console.error(`Error updating ${this.options.tableName}:`, error);
        throw error;
      }

      return {
        success: true,
        data: updatedRecord as T,
        message: `${this.options.tableName} 업데이트 성공`
      };
    } catch (error) {
      console.error(`Error in update for ${this.options.tableName}:`, error);
      throw error;
    }
  }

  /**
   * DELETE - Soft delete record (set is_active = false)
   */
  async delete(id: number | string, context: RequestContext): Promise<APIResponse<{ deleted_id: number | string }>> {
    try {
      // Check if record exists
      const existsCheck = await this.getById(id, context);
      if (!existsCheck.success) {
        throw new Error(`${this.options.tableName} not found`);
      }

      // Check dependencies before delete (override in child classes)
      await this.validateDelete(id);

      if (this.options.activeField) {
        // Soft delete
        const { error } = await this.supabase
          .from(this.options.tableName as any)
          .update({
            [this.options.activeField]: false,
            updated_at: new Date().toISOString()
          })
          .eq(this.options.idField!, id);

        if (error) {
          console.error(`Error deleting ${this.options.tableName}:`, error);
          throw error;
        }
      } else {
        // Hard delete (not recommended)
        const { error } = await this.supabase
          .from(this.options.tableName as any)
          .delete()
          .eq(this.options.idField!, id);

        if (error) {
          console.error(`Error deleting ${this.options.tableName}:`, error);
          throw error;
        }
      }

      return {
        success: true,
        data: { deleted_id: id },
        message: `${this.options.tableName} 삭제 성공`
      };
    } catch (error) {
      console.error(`Error in delete for ${this.options.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Validation hooks - Override in child classes
   */
  protected async validateCreate(data: any): Promise<void> {
    // Override in child classes
  }

  protected async validateUpdate(id: number | string, data: any): Promise<void> {
    // Override in child classes
  }

  protected async validateDelete(id: number | string): Promise<void> {
    // Override in child classes
  }

  /**
   * Create NextResponse from APIResponse
   */
  toNextResponse(response: APIResponse<any>, status: number = 200): NextResponse {
    if (!response.success) {
      return NextResponse.json(response, { status: status === 200 ? 500 : status });
    }
    return NextResponse.json(response, { status });
  }
}
