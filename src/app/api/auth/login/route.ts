import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

// Secure JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-production';
const TOKEN_EXPIRY = '24h';


export async function POST(request: NextRequest) {
  try {
    // Korean UTF-8 support
    const text = await request.text();
    const body = JSON.parse(text);
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({
        success: false,
        error: '사용자명과 비밀번호를 입력해주세요.'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 사용자 조회
    const { data: users, error } = await supabase
      .from('users')
      .select('user_id, username, password, name, email, role, is_active')
      .eq('username', username)
      .eq('is_active', true);

    if (error || !users || users.length === 0) {
      return NextResponse.json({
        success: false,
        error: '사용자명 또는 비밀번호가 올바르지 않습니다.'
      }, { status: 401 });
    }

    const user = users[0];

    // 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json({
        success: false,
        error: '사용자명 또는 비밀번호가 올바르지 않습니다.'
      }, { status: 401 });
    }

    // Secure JWT token generation with cryptographic signing
    const token = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
        role: user.role
      },
      JWT_SECRET,
      {
        expiresIn: TOKEN_EXPIRY,
        algorithm: 'HS256'
      }
    );

    const userResponse = {
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const response = NextResponse.json({
      success: true,
      data: { user: userResponse, token },
      message: '로그인에 성공했습니다'
    });

    // HTTP-only 쿠키에 토큰 저장
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24시간
      path: '/'
    });

    // user_id 쿠키 저장 (기존 인증 시스템 호환)
    response.cookies.set('user_id', user.user_id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24시간
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({
      success: false,
      error: '로그인 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}