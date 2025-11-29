/**
 * API #3: PATCH /api/companies/[id]
 *
 * Update company information including Phase 2 fields
 *
 * URL Parameters:
 * - id: Company ID (UUID)
 *
 * Body (all fields optional):
 * {
 *   company_name?: string,
 *   company_type?: string,
 *   company_category?: string,  // NEW: '협력업체-원자재' | '협력업체-외주' | '소모품업체' | '기타'
 *   business_info?: {           // NEW: JSONB
 *     business_type?: string,
 *     business_item?: string,
 *     main_products?: string
 *   },
 *   business_number?: string,
 *   representative?: string,
 *   phone?: string,
 *   email?: string,
 *   address?: string,
 *   notes?: string
 * }
 *
 * CRITICAL: Uses request.text() + JSON.parse() for proper Korean UTF-8 handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { handleError, createSuccessResponse, handleNotFoundError, handleValidationError } from '@/lib/errorHandler';
import { COMPANY_CATEGORY_VALUES, isValidCompanyCategory } from '@/types/accounting.types';
import type { BusinessInfo } from '@/types/accounting.types';

export const dynamic = 'force-dynamic';


// Company type mapping between Korean (DB) and English (API)
const companyTypeMap: Record<string, string> = {
  'CUSTOMER': '고객사',
  'SUPPLIER': '공급사',
  '고객사': '고객사',
  '공급사': '공급사'
};

/**
 * GET /api/companies/[id]
 * Retrieve a single company by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const companyId = parseInt(id);
    const supabase = getSupabaseClient();
    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .eq('company_id', companyId)
      .single() as any;

    if (error || !company) {
      return handleNotFoundError('회사', id);
    }

    return createSuccessResponse(company);

  } catch (error) {
    console.error('Error fetching company:', error);
    return handleError(error, {
      resource: 'companies',
      action: 'read'
    });
  }
}

/**
 * PATCH /api/companies/[id]
 * Update company information with Phase 2 fields support
 *
 * CRITICAL: Uses request.text() + JSON.parse() for Korean UTF-8 handling
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const companyId = parseInt(id);

    // CRITICAL: Use request.text() + JSON.parse() for proper Korean UTF-8 encoding
    const text = await request.text();
    const data = JSON.parse(text);

    // Validation: Check if company exists
    const supabase = getSupabaseClient();
    const { data: existingCompany, error: fetchError } = await supabase
      .from('companies')
      .select('company_id')
      .eq('company_id', companyId)
      .single() as any;

    if (fetchError || !existingCompany) {
      return handleNotFoundError('회사', id);
    }

    // Validation: company_category
    if (data.company_category !== undefined) {
      if (!isValidCompanyCategory(data.company_category)) {
        return handleValidationError({
          company_category: `유효하지 않은 업체 구분입니다. 허용값: ${COMPANY_CATEGORY_VALUES.join(', ')}`
        });
      }
    }

    // Validation: business_info structure
    if (data.business_info !== undefined) {
      if (typeof data.business_info !== 'object' || data.business_info === null) {
        return handleValidationError({
          business_info: '사업자 정보는 객체 형식이어야 합니다.'
        });
      }

      const businessInfo = data.business_info as BusinessInfo;
      const allowedFields = ['business_type', 'business_item', 'main_products'];
      const extraFields = Object.keys(businessInfo).filter(key => !allowedFields.includes(key));

      if (extraFields.length > 0) {
        return handleValidationError({
          business_info: `허용되지 않은 필드: ${extraFields.join(', ')}. 허용값: ${allowedFields.join(', ')}`
        });
      }

      // Validate field types
      for (const [key, value] of Object.entries(businessInfo)) {
        if (value !== undefined && value !== null && typeof value !== 'string') {
          return handleValidationError({
            business_info: `${key}는 문자열이어야 합니다.`
          });
        }
      }
    }

    // Convert company_type if present (English API → Korean DB)
    if (data.company_type) {
      data.company_type = companyTypeMap[data.company_type] || data.company_type;
    }

    // Prepare update data
    const updateData: any = {
      ...data,
      updated_at: new Date().toISOString()
    };

    // Remove company_id from update if accidentally included
    delete updateData.company_id;

    // Update company using Supabase client
    const { data: updatedCompany, error: updateError } = (await (supabase
      .from('companies') as any)
      .update(updateData)
      .eq('company_id', companyId)
      .select()
      .single()) as any;

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    return createSuccessResponse(
      updatedCompany,
      '회사 정보가 성공적으로 업데이트되었습니다.'
    );

  } catch (error) {
    console.error('Error updating company:', error);
    return handleError(error, {
      resource: 'companies',
      action: 'update'
    });
  }
}

/**
 * DELETE /api/companies/[id]
 * Soft delete a company (set is_active = false)
 *
 * Query Parameters:
 * - force=true: 참조가 있어도 강제 삭제
 *
 * 참조 테이블 확인:
 * - BOM (customer_id)
 * - Items (customer_id)
 * - inventory_transactions (customer_id)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const forceDelete = searchParams.get('force') === 'true';

    const companyId = parseInt(id);
    const supabase = getSupabaseClient();

    // Check if company exists
    const { data: existingCompany, error: fetchError } = await supabase
      .from('companies')
      .select('company_id, company_name')
      .eq('company_id', companyId)
      .single() as any;

    if (fetchError || !existingCompany) {
      return handleNotFoundError('회사', id);
    }

    // 참조 무결성 검사 (force=true가 아닐 때만)
    if (!forceDelete) {
      const references: string[] = [];

      // BOM 참조 확인
      const { count: bomCount } = await supabase
        .from('bom')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', companyId) as any;
      if (bomCount && bomCount > 0) {
        references.push(`BOM ${bomCount}건`);
      }

      // Items 참조 확인
      const { count: itemsCount } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', companyId) as any;
      if (itemsCount && itemsCount > 0) {
        references.push(`품목 ${itemsCount}건`);
      }

      // inventory_transactions 참조 확인
      const { count: txCount } = await supabase
        .from('inventory_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', companyId) as any;
      if (txCount && txCount > 0) {
        references.push(`재고거래 ${txCount}건`);
      }

      // 참조가 있으면 경고 반환
      if (references.length > 0) {
        return NextResponse.json({
          success: false,
          error: '참조 데이터가 존재합니다',
          message: `이 회사를 참조하는 데이터가 있습니다: ${references.join(', ')}. 강제 삭제하려면 ?force=true 파라미터를 사용하세요.`,
          references: references,
          company_name: existingCompany.company_name
        }, { status: 409 });
      }
    }

    // Soft delete by setting is_active to false
    const { error: deleteError } = (await (supabase
      .from('companies') as any)
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('company_id', companyId)) as any;

    if (deleteError) {
      throw new Error(`Database delete failed: ${deleteError.message}`);
    }

    return createSuccessResponse(
      {
        deleted_id: id,
        company_name: existingCompany.company_name,
        force_deleted: forceDelete
      },
      forceDelete
        ? '회사가 강제 삭제되었습니다. (참조 데이터는 유지됨)'
        : '회사가 성공적으로 삭제되었습니다.'
    );

  } catch (error) {
    console.error('Error deleting company:', error);
    return handleError(error, {
      resource: 'companies',
      action: 'delete'
    });
  }
}
