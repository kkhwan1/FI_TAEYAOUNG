import { NextRequest } from 'next/server';
import { checkPermission, hashPassword, User } from '@/lib/auth';
import { createSuccessResponse, handleSupabaseError, getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';


/**
 * GET /api/users - 사용자 목록 조회 (manager 이상)
 */
export async function GET(request: NextRequest) {
  try {
    const { allowed, error, user } = await checkPermission('manager', request);

    if (!allowed) {
      return Response.json({ success: false, error }, { status: 403 });
    }

    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20')), 100); // Cap at 100
    const role = searchParams.get('role');
    const rawSearch = searchParams.get('search');
    // Sanitize search input - remove special characters that could affect queries
    const search = rawSearch ? rawSearch.replace(/[%_'"\\]/g, '').substring(0, 100) : null;
    const isActive = searchParams.get('is_active');

    let query = supabase
      .from('users')
      .select('user_id, username, name, email, phone, role, department, is_active, created_at, updated_at', { count: 'exact' });

    if (role) {
      query = query.eq('role', role);
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    if (search) {
      query = query.or(`username.ilike.%${search}%,name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1).order('created_at', { ascending: false });

    const { data, error: dbError, count } = await query;

    if (dbError) {
      const errorResponse = handleSupabaseError('select', 'users', dbError);
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
  } catch (err) {
    console.error('[GET /api/users] Exception:', err);
    return Response.json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    }, { status: 500 });
  }
}

/**
 * POST /api/users - 사용자 생성 (admin만)
 */
export async function POST(request: NextRequest) {
  const { allowed, error } = await checkPermission('admin', request);
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  // 한글 처리 패턴
  const text = await request.text();
  const body = JSON.parse(text);

  // 필수 필드 검증
  if (!body.username || !body.password || !body.name || !body.role) {
    return Response.json({
      success: false,
      error: '필수 필드가 누락되었습니다: username, password, name, role'
    }, { status: 400 });
  }

  // 역할 검증
  const validRoles = ['ceo', 'admin', 'accountant', 'manager', 'user', 'viewer', 'operator'];
  if (!validRoles.includes(body.role)) {
    return Response.json({
      success: false,
      error: `올바른 역할이 아닙니다. 가능한 역할: ${validRoles.join(', ')}`
    }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // 중복 username 확인
  const { data: existing } = await supabase
    .from('users')
    .select('username')
    .eq('username', body.username)
    .single();

  if (existing) {
    return Response.json({
      success: false,
      error: '이미 존재하는 사용자명입니다.'
    }, { status: 400 });
  }

  // 비밀번호 해싱
  const hashedPassword = await hashPassword(body.password);

  // 사용자 생성
  const { data, error: dbError } = await supabase
    .from('users')
    .insert({
      username: body.username,
      password: hashedPassword,
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: body.role,
      department: body.department,
      is_active: body.is_active !== undefined ? body.is_active : true
    })
    .select('user_id, username, name, email, phone, role, department, is_active, created_at, updated_at')
    .single();

  if (dbError) {
    const errorResponse = handleSupabaseError('insert', 'users', dbError);
    return Response.json(errorResponse, { status: 500 });
  }

  return Response.json({
    success: true,
    data: data
  }, { status: 201 });
}
