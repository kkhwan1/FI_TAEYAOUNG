import { getSupabaseClient } from '@/lib/db-unified';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

// Secure JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-production';

export type UserRole = 'ceo' | 'admin' | 'manager' | 'user' | 'viewer' | 'operator' | 'accountant';

interface TokenPayload {
  userId: number;
  username: string;
  role: string;
}

export interface User {
  user_id: number;
  id?: number; // Alias for user_id for compatibility with types/auth.ts
  username: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  department?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Verify JWT token and extract payload
 */
function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256']
    }) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * 현재 로그인한 사용자 정보 조회 (JWT 기반 + 세션 폴백)
 */
export async function getCurrentUser(request?: NextRequest): Promise<User | null> {
  try {
    // Development mode: bypass authentication
    if (process.env.BYPASS_AUTH === 'true') {
      const devUserId = process.env.DEV_USER_ID || '1';
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', parseInt(devUserId))
        .single();

      if (data) {
        return data as User;
      }
      // If no user found in DB, return a mock admin user for development
      return {
        user_id: parseInt(devUserId),
        username: 'dev_admin',
        name: '개발 관리자',
        role: 'admin' as UserRole,
        is_active: true
      };
    }

    // First try JWT token verification
    const authToken = request
      ? request.cookies.get('auth_token')?.value
      : (await cookies()).get('auth_token')?.value;

    let userId: string | undefined;

    if (authToken) {
      const payload = verifyToken(authToken);
      if (payload) {
        userId = payload.userId.toString();
      }
    }

    // Fallback to user_id cookie for backward compatibility
    if (!userId) {
      userId = request
        ? request.cookies.get('user_id')?.value
        : (await cookies()).get('user_id')?.value;
    }

    if (!userId) {
      return null;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', parseInt(userId))
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return data as User;
  } catch {
    return null;
  }
}

/**
 * 권한 검증 (계층적 역할)
 */
export async function checkPermission(
  requiredRole: UserRole,
  request?: NextRequest
): Promise<{ allowed: boolean; user?: User; error?: string }> {
  const user = await getCurrentUser(request);

  if (!user) {
    return { allowed: false, error: '로그인이 필요합니다.' };
  }

  if (!user.is_active) {
    return { allowed: false, error: '비활성화된 계정입니다.' };
  }

  // CEO는 모든 권한 통과
  if (user.role === 'ceo') {
    return { allowed: true, user };
  }

  const roleHierarchy: Record<UserRole, number> = {
    viewer: 1,
    operator: 2,
    user: 3,
    accountant: 3,  // viewer 이상 권한 (READ 가능)
    manager: 4,
    admin: 5,
    ceo: 6
  };

  const userLevel = roleHierarchy[user.role];
  const requiredLevel = roleHierarchy[requiredRole];

  if (userLevel >= requiredLevel) {
    return { allowed: true, user };
  }

  return { allowed: false, error: '권한이 부족합니다.' };
}

/**
 * 특정 역할만 허용 (정확한 매칭)
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<{
  allowed: boolean;
  user?: User;
  error?: string;
}> {
  const user = await getCurrentUser();

  if (!user) {
    return { allowed: false, error: '로그인이 필요합니다.' };
  }

  if (!user.is_active) {
    return { allowed: false, error: '비활성화된 계정입니다.' };
  }

  if (!allowedRoles.includes(user.role)) {
    return { allowed: false, error: '접근 권한이 없습니다.' };
  }

  return { allowed: true, user };
}

/**
 * 비밀번호 검증
 */
export async function verifyPassword(
  username: string,
  password: string
): Promise<User | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  const valid = await bcrypt.compare(password, data.password);
  if (!valid) return null;

  return data as User;
}

/**
 * 비밀번호 해싱
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * 역할 레이블 한글 변환
 */
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    ceo: 'CEO',
    admin: '관리자',
    accountant: '회계 담당자',
    manager: '매니저',
    user: '사용자',
    viewer: '열람자',
    operator: '운영자'
  };
  return labels[role] || role;
}

/**
 * 역할 배지 색상
 */
export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    ceo: 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900',
    admin: 'bg-gray-700 text-white dark:bg-gray-300 dark:text-gray-900',
    accountant: 'bg-gray-500 text-white dark:bg-gray-400 dark:text-gray-900',
    manager: 'bg-gray-400 text-gray-900 dark:bg-gray-500 dark:text-white',
    user: 'bg-gray-300 text-gray-900 dark:bg-gray-600 dark:text-white',
    viewer: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    operator: 'bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
}

/**
 * 리소스별 작업 권한 확인
 * @param user 사용자 정보
 * @param resource 리소스 타입 ('sales', 'purchases', 'items', 'inventory' 등)
 * @param action 작업 타입 ('read', 'create', 'update', 'delete')
 */
export function checkResourcePermission(
  user: User,
  resource: string,
  action: 'read' | 'create' | 'update' | 'delete'
): { allowed: boolean; error?: string } {
  // CEO는 모든 리소스에 대한 모든 작업 가능
  if (user.role === 'ceo') {
    return { allowed: true };
  }
  
  // admin은 모든 리소스 CRUD 가능
  if (user.role === 'admin') {
    return { allowed: true };
  }
  
  // accountant 특수 처리
  if (user.role === 'accountant') {
    const accountingResources = ['sales', 'purchases', 'collections', 'payments', 'accounting'];
    
    // 회계 리소스는 모든 작업 가능
    if (accountingResources.includes(resource)) {
      return { allowed: true };
    }
    
    // 회계 외 리소스는 읽기만 가능
    if (action === 'read') {
      return { allowed: true };
    }
    
    return { allowed: false, error: '회계 담당자는 회계 관련 데이터만 수정할 수 있습니다.' };
  }
  
  // 기타 역할은 기존 계층 구조 따름
  const roleHierarchy: Record<UserRole, number> = {
    viewer: 1,
    operator: 2,
    user: 3,
    accountant: 3,
    manager: 4,
    admin: 5,
    ceo: 6
  };
  
  const userLevel = roleHierarchy[user.role];
  
  // 삭제는 manager 이상
  if (action === 'delete' && userLevel < 4) {
    return { allowed: false, error: '삭제 권한이 없습니다.' };
  }
  
  // 생성/수정은 user 이상
  if ((action === 'create' || action === 'update') && userLevel < 3) {
    return { allowed: false, error: '쓰기 권한이 없습니다.' };
  }
  
  // 읽기는 operator 이상
  if (action === 'read' && userLevel < 2) {
    return { allowed: false, error: '읽기 권한이 없습니다.' };
  }
  
  return { allowed: true };
}
