import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { APIError, handleAPIError, validateRequiredFields } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { metricsCollector } from '@/lib/metrics';

export const dynamic = 'force-dynamic';


// Company type mapping between Korean (DB) and English (API)
// 납품처(고객사)와 구매처(공급사)만 허용
const companyTypeMap: Record<string, string> = {
  'CUSTOMER': '고객사',
  'SUPPLIER': '공급사',
  '고객사': '고객사',
  '공급사': '공급사'
};

/**
 * GET /api/companies
 * List companies with filters
 * Query parameters:
 * - type: Filter by company type (accepts both Korean and English values, comma-separated for multiple types)
 * - search: Search in company name, business registration number, contact person, phone, email
 * - limit: Number of records to return (default: 20)
 * - offset: Pagination offset (default: 0)
 *
 * Example usage:
 * - Single type: ?type=CUSTOMER → WHERE company_type = '고객사'
 * - Multiple types: ?type=SUPPLIER,BOTH → WHERE company_type IN ('공급사', '협력사')
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/companies';

  try {
    logger.info('Companies GET request', { endpoint });
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    // If limit is not specified or is 0, fetch all companies
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : 10000; // Default to large number to fetch all
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get Supabase client from unified db layer
    const supabase = getSupabaseClient();

    // Build safe query using Supabase client
    let query = supabase
      .from('companies')
      .select('*')
      .eq('is_active', true)  // 활성 회사만 가져오기
      .order('company_name', { ascending: true });

    // Apply filters safely - map English to Korean for database query
    // 특별 처리: CUSTOMER 타입 요청 시 BOM에서 사용되는 납품처 회사들을 포함하기 위해 모든 활성 회사를 가져옴
    if (type) {
      // CUSTOMER 타입의 경우: BOM에서 실제로 사용되는 납품처 회사들을 포함하기 위해 필터를 적용하지 않음
      // (데이터베이스에서 납품처로 사용되는 회사들이 company_type='공급사'로 저장되어 있음)
      if (type === 'CUSTOMER') {
        // CUSTOMER 타입 요청 시에는 BOM에서 사용되는 회사들을 포함하기 위해 
        // 모든 활성 회사를 가져오고, BOM에서 사용되는 회사들을 우선적으로 표시
        // 필터를 적용하지 않고 모든 활성 회사를 반환
      } else {
        // Check if multiple types are provided (comma-separated)
        if (type.includes(',')) {
          // Split and map each type to Korean
          const types = type.split(',').map(t => t.trim());
          const dbTypes = types.map(t => companyTypeMap[t] || t).filter(t => t === '고객사' || t === '공급사') as ('고객사' | '공급사')[];
          if (dbTypes.length > 0) {
            query = query.in('company_type', dbTypes);
          }
        } else {
          // Single type - use .eq() for backward compatibility
          const dbType = companyTypeMap[type] || type;
          query = query.eq('company_type', dbType as '고객사' | '공급사');
        }
      }
    }

    if (search) {
      query = query.or(`company_name.ilike.%${search}%,business_number.ilike.%${search}%,representative.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply pagination only if limit is reasonable (not fetching all)
    if (limit < 10000) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data: companies, error } = (await query) as any;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Map database column names to API field names for backward compatibility
    const mappedCompanies = companies?.map((company: any) => ({
      ...company,
      contact_person: company.representative,  // Map representative to contact_person
      business_registration_no: company.business_number  // Map business_number to business_registration_no (legacy)
    })) || [];

    // Get total count for pagination (safe query)
    let countQuery = supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);  // 활성 회사만 카운트

    // Apply same filters for count - handle multiple types
    if (type) {
      // CUSTOMER 타입의 경우 필터를 적용하지 않음 (모든 활성 회사 포함)
      if (type === 'CUSTOMER') {
        // 필터 적용하지 않음
      } else {
        if (type.includes(',')) {
          // Multiple types
          const types = type.split(',').map(t => t.trim());
          const dbTypes = types.map(t => companyTypeMap[t] || t).filter(t => t === '고객사' || t === '공급사') as ('고객사' | '공급사')[];
          if (dbTypes.length > 0) {
            countQuery = countQuery.in('company_type', dbTypes);
          }
        } else {
          // Single type
          const dbType = companyTypeMap[type] || type;
          countQuery = countQuery.eq('company_type', dbType as '고객사' | '공급사');
        }
      }
    }

    if (search) {
      countQuery = countQuery.or(`company_name.ilike.%${search}%,business_number.ilike.%${search}%,representative.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { count: totalCount, error: countError } = (await countQuery) as any;

    if (countError) {
      throw new Error(`Count query failed: ${countError.message}`);
    }

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Companies GET success', { endpoint, duration, companyCount: companies?.length || 0 });

    const safeLimit = limit > 0 ? limit : 1;
    const safeTotalCount = totalCount || 0;

    return NextResponse.json({
      success: true,
      data: {
        data: mappedCompanies,
        meta: {
          limit,
          totalCount: safeTotalCount,
          totalPages: safeLimit > 0 ? Math.ceil(safeTotalCount / safeLimit) : 1,
          hasNext: offset + limit < safeTotalCount,
          hasPrev: offset > 0
        },
        pagination: {
          limit,
          totalCount: safeTotalCount,
          totalPages: safeLimit > 0 ? Math.ceil(safeTotalCount / safeLimit) : 1,
          hasNext: offset + limit < safeTotalCount,
          hasPrev: offset > 0
        }
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Companies GET error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}

/**
 * POST /api/companies
 * Create new company
 * Body: {
 *   company_name: string,
 *   company_type: string,
 *   business_registration_no?: string,
 *   contact_person?: string,
 *   phone?: string,
 *   mobile?: string,
 *   email?: string,
 *   address?: string,
 *   company_category?: string,
 *   business_info?: {
 *     business_type?: string,
 *     business_item?: string,
 *     main_products?: string
 *   },
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/companies';

  try {
    // Updated: 2025-10-27 - Fixed company_type mapping
    logger.info('Companies POST request', { endpoint });
    // Use text() + JSON.parse() for proper UTF-8 Korean character handling
    const text = await request.text();
    const body = JSON.parse(text);
    const {
      company_name,
      company_type,
      business_registration_no,
      business_number, // Also accept business_number from frontend
      contact_person,
      phone,
      fax,
      mobile,
      email,
      address,
      company_category,
      business_info,
      notes,
      payment_terms
    } = body;

    // Get Supabase client from unified db layer
    const supabase = getSupabaseClient();

    // 필수 필드 검증
    if (!company_name || !company_type) {
      return NextResponse.json({
        success: false,
        error: '회사명과 회사 유형은 필수입니다.'
      }, { status: 400 });
    }

    // Convert English API value to Korean DB value if needed
    const dbCompanyType = companyTypeMap[company_type] || company_type;

    // Validate company_category if provided
    if (company_category) {
      const validCategories = ['협력업체-원자재', '협력업체-외주', '소모품업체', '기타'];
      if (!validCategories.includes(company_category)) {
        return NextResponse.json({
          success: false,
          error: '올바른 거래처 분류를 선택해주세요.'
        }, { status: 400 });
      }
    }

    // Generate company_code automatically based on company_type
    // 납품처(고객사)와 구매처(공급사)만 허용
    const prefixMap: Record<string, string> = {
      '고객사': 'CUS',
      '공급사': 'SUP'
    };

    const prefix = prefixMap[dbCompanyType] || 'COM';

    // Get the last company code with this prefix - use MAX to get highest number
    const { data: existingCodes, error: codeError } = (await supabase
      .from('companies')
      .select('company_code')
      .like('company_code', `${prefix}%`)
      .order('company_code', { ascending: false })) as any;

    let nextNumber = 1;
    if (existingCodes && existingCodes.length > 0) {
      // Find the maximum number from all existing codes
      const numbers = existingCodes
        .map((row: any) => {
          const match = row.company_code.match(/\d+$/);
          return match ? parseInt(match[0]) : 0;
        })
        .filter((num: number) => !isNaN(num));
      
      if (numbers.length > 0) {
        nextNumber = Math.max(...numbers) + 1;
      }
    }

    const company_code = `${prefix}${String(nextNumber).padStart(3, '0')}`;
    console.log('[Companies POST] Generated company_code:', company_code);

    // Create company using Supabase client
    const insertData = {
      company_code,
      company_name,
      company_type: dbCompanyType,
      business_number: business_number || business_registration_no,  // Accept both field names
      representative: contact_person,  // Map API parameter to correct DB column
      phone,
      fax,
      // mobile column removed - does not exist in database (only phone and fax columns exist)
      email,
      address,
      company_category: company_category || null,
      business_info: business_info || null,
      payment_terms: payment_terms || null,
      // notes field removed - does not exist in database schema
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: company, error } = (await supabase
      .from('companies')
      .insert(insertData as any)
      .select()
      .single()) as any;

    if (error) {
      console.error('[Companies POST] INSERT ERROR:', error);
      throw new Error(`Database insert failed: ${error.message}`);
    }
    console.log('[Companies POST] INSERT SUCCESS - company_id:', company?.company_id);

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Companies POST success', { endpoint, duration, companyId: company?.company_id });

    return NextResponse.json({
      success: true,
      message: '거래처가 성공적으로 등록되었습니다.',
      data: company
    }, { status: 201 });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Companies POST error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}

/**
 * PUT /api/companies
 * Update existing company
 * Body: {
 *   company_id: number,
 *   ... other fields to update including company_category and business_info
 * }
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Use text() + JSON.parse() for proper UTF-8 Korean character handling
    const text = await request.text();
    const body = JSON.parse(text);
    const { company_id, ...updateData } = body;

    // Get Supabase client from unified db layer
    const supabase = getSupabaseClient();

    if (!company_id) {
      return NextResponse.json({
        success: false,
        error: '회사 ID가 필요합니다.'
      }, { status: 400 });
    }

    // Convert company_type if present in updateData (English API → Korean DB)
    if (updateData.company_type) {
      updateData.company_type = companyTypeMap[updateData.company_type] || updateData.company_type;
    }

    // Validate and handle company_category
    if (updateData.company_category !== undefined) {
      const validCategories = ['협력업체-원자재', '협력업체-외주', '소모품업체', '기타'];
      // If empty string or invalid, remove it (don't update)
      if (updateData.company_category === '' || updateData.company_category === '선택 안함') {
        delete updateData.company_category;
      } else if (!validCategories.includes(updateData.company_category)) {
        return NextResponse.json({
          success: false,
          error: '올바른 거래처 분류를 선택해주세요.'
        }, { status: 400 });
      }
    }

    // Map API field names to database column names
    const dbUpdateData: any = {};
    
    // Handle both business_registration_no and business_number field names
    if (updateData.business_registration_no !== undefined) {
      dbUpdateData.business_number = updateData.business_registration_no;
    } else if (updateData.business_number !== undefined) {
      dbUpdateData.business_number = updateData.business_number;
    }
    
    // Handle contact_person mapping to representative
    if (updateData.contact_person !== undefined) {
      dbUpdateData.representative = updateData.contact_person;
    }
    
    // Map phone field (API uses 'phone', DB uses 'phone')
    if (updateData.phone !== undefined) {
      dbUpdateData.phone = updateData.phone;
    }
    
    // Map email field
    if (updateData.email !== undefined) {
      dbUpdateData.email = updateData.email;
    }
    
    // Map address field
    if (updateData.address !== undefined) {
      dbUpdateData.address = updateData.address;
    }
    
    // Allow fax passthrough (column exists)
    if (updateData.fax !== undefined) {
      dbUpdateData.fax = updateData.fax;
    }
    
    // Handle company_name
    if (updateData.company_name !== undefined) {
      dbUpdateData.company_name = updateData.company_name;
    }
    
    // Handle company_type (already converted above)
    if (updateData.company_type !== undefined) {
      dbUpdateData.company_type = updateData.company_type;
    }
    
    // Handle company_category (validated above)
    if (updateData.company_category !== undefined) {
      dbUpdateData.company_category = updateData.company_category;
    }
    
    // business_info: accept object as-is; do not merge server-side without read
    if (updateData.business_info !== undefined) {
      dbUpdateData.business_info = updateData.business_info;
    }
    
    // payment_terms is now a valid DB column, so keep it
    if (updateData.payment_terms !== undefined) {
      dbUpdateData.payment_terms = updateData.payment_terms;
    }
    
    // Do not include fields that don't exist in database
    // (mobile, notes are already excluded by not mapping them)

    // Update company using Supabase client
    console.log('[Companies PUT] Updating company_id:', company_id, 'with data:', dbUpdateData);
    
    const { data: company, error } = (await (supabase
      .from('companies') as any)
      .update({
        ...dbUpdateData,
        updated_at: new Date().toISOString()
      })
      .eq('company_id', company_id)
      .select()
      .single()) as any;

    if (error) {
      console.error('[Companies PUT] UPDATE ERROR:', error);
      console.error('[Companies PUT] Error details:', JSON.stringify(error, null, 2));
      console.error('[Companies PUT] Update data:', JSON.stringify(dbUpdateData, null, 2));
      return NextResponse.json({
        success: false,
        error: `데이터베이스 업데이트 실패: ${error.message}`,
        details: error.details || error.hint || error.code
      }, { status: 500 });
    }
    console.log('[Companies PUT] UPDATE SUCCESS - company_id:', company?.company_id);

    return NextResponse.json({
      success: true,
      message: '거래처가 성공적으로 업데이트되었습니다.',
      data: company
    });
  } catch (error: any) {
    console.error('[Companies PUT] Error updating company:', error);
    console.error('[Companies PUT] Error stack:', error.stack);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '거래처 업데이트에 실패했습니다.',
        details: error.details || error.hint || error.code
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/companies
 * Delete company (soft delete)
 * Query parameter: id - Company ID to delete
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    // Get Supabase client from unified db layer
    const supabase = getSupabaseClient();

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '회사 ID가 필요합니다.'
      }, { status: 400 });
    }

    // Soft delete by setting is_active to false
    const { error } = (await (supabase
      .from('companies') as any)
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('company_id', id)) as any;

    if (error) {
      throw new Error(`Database delete failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '거래처가 성공적으로 삭제되었습니다.',
      data: { deleted_id: id }
    });
  } catch (error) {
    console.error('Error deleting company:', error);
    return NextResponse.json(
      {
        success: false,
        error: '거래처 삭제에 실패했습니다.'
      },
      { status: 500 }
    );
  }
}