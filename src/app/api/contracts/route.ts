import { NextRequest } from 'next/server';
import { checkPermission } from '@/lib/auth';
import { validateContract } from '@/lib/contractValidation';
import { createSuccessResponse, handleSupabaseError, getSupabaseClient } from '@/lib/db-unified';
import { safeParseInt } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';


/**
 * GET /api/contracts - 계약 목록 조회 (user 이상)
 */
export async function GET(request: NextRequest) {
  const { allowed, error } = await checkPermission('user', request);
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);

  const page = safeParseInt(searchParams.get('page'), 1);
  const limit = safeParseInt(searchParams.get('limit'), 20);
  const contractType = searchParams.get('contract_type');
  const status = searchParams.get('status');
  const companyId = searchParams.get('company_id');
  const search = searchParams.get('search');

  let query = supabase
    .from('contracts')
    .select(`
      *,
      company:companies(company_id, company_name, company_type)
    `, { count: 'exact' })
    .eq('is_active', true);

  if (contractType) {
    query = query.eq('contract_type', contractType);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (companyId) {
    query = query.eq('company_id', safeParseInt(companyId));
  }

  if (search) {
    query = query.or(`contract_no.ilike.%${search}%,contract_name.ilike.%${search}%`);
  }

  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1).order('created_at', { ascending: false });

  const { data, error: dbError, count } = await query;

  if (dbError) {
    const errorResponse = handleSupabaseError('select', 'contracts', dbError);
    return Response.json(errorResponse, { status: 500 });
  }

  return Response.json({
    success: true,
    data: data,
    pagination: {
      page,
      limit,
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / limit)
    }
  });
}

/**
 * POST /api/contracts - 계약 생성 (manager 이상, 자동 번호 생성)
 */
export async function POST(request: NextRequest) {
  const { allowed, error, user } = await checkPermission('manager', request);
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  // 한글 처리 패턴
  const text = await request.text();
  const body = JSON.parse(text);

  // 필수 필드 검증
  if (!body.company_id || !body.contract_name || !body.contract_type || !body.start_date || !body.end_date) {
    return Response.json({
      success: false,
      error: '필수 필드가 누락되었습니다: company_id, contract_name, contract_type, start_date, end_date'
    }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // 검증
  const validation = await validateContract({
    company_id: body.company_id,
    contract_type: body.contract_type,
    start_date: body.start_date,
    end_date: body.end_date,
    total_amount: body.total_amount || 0
  });

  if (!validation.valid) {
    return Response.json({
      success: false,
      error: validation.error,
      warning: validation.warning
    }, { status: 400 });
  }

  // 계약 생성 (contract_no는 트리거로 자동 생성되지만 TypeScript를 위해 임시값 제공)
  const { data, error: dbError } = await supabase
    .from('contracts')
    .insert({
      company_id: body.company_id,
      contract_no: `TEMP-${Date.now()}`, // 트리거가 실제 값으로 대체
      contract_name: body.contract_name,
      contract_type: body.contract_type,
      contract_date: body.contract_date || new Date().toISOString().split('T')[0],
      start_date: body.start_date,
      end_date: body.end_date,
      total_amount: body.total_amount || 0,
      status: body.status || '진행중',
      terms: body.terms,
      notes: body.notes,
      created_by: user!.user_id
    })
    .select(`
      *,
      company:companies(company_id, company_name, company_type)
    `)
    .single();

  if (dbError) {
    const errorResponse = handleSupabaseError('insert', 'contracts', dbError);
    return Response.json(errorResponse, { status: 500 });
  }

  return Response.json({ success: true, data }, { status: 201 });
}
