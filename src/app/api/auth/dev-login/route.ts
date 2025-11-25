/**
 * 개발 환경 자동 로그인 API
 * 개발/테스트 목적으로만 사용
 * 
 * GET /api/auth/dev-login
 * - 개발 환경에서만 작동
 * - 첫 번째 활성 사용자로 자동 로그인
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 프로덕션 환경에서는 차단
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({
      success: false,
      error: '개발 환경에서만 사용 가능합니다.'
    }, { status: 403 });
  }

  try {
    const supabase = getSupabaseClient();

    // 첫 번째 활성 사용자 조회
    const { data: users, error } = await supabase
      .from('users')
      .select('user_id, username, name, email, role, is_active')
      .eq('is_active', true)
      .order('user_id', { ascending: true })
      .limit(1);

    if (error || !users || users.length === 0) {
      return NextResponse.json({
        success: false,
        error: '활성 사용자를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    const user = users[0];

    // JWT 토큰 생성
    const token = Buffer.from(JSON.stringify({
      userId: user.user_id,
      username: user.username,
      role: user.role,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24시간
    })).toString('base64');

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token,
        message: `개발 모드: ${user.username}(${user.name})로 자동 로그인되었습니다.`
      }
    });

    // HTTP-only 쿠키에 토큰 저장
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: false, // 개발 환경에서는 false
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24시간
      path: '/'
    });

    // user_id 쿠키 저장
    response.cookies.set('user_id', user.user_id.toString(), {
      httpOnly: true,
      secure: false, // 개발 환경에서는 false
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24시간
      path: '/'
    });

    return response;
  } catch (error: any) {
    console.error('Dev login error:', error);
    return NextResponse.json({
      success: false,
      error: `자동 로그인 중 오류가 발생했습니다: ${error.message || 'Unknown error'}`
    }, { status: 500 });
  }
}

