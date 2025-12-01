'use server';

import jwt from 'jsonwebtoken';

// Token configuration
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-production';
const TOKEN_EXPIRY = '24h';

export interface TokenPayload {
  userId: number;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate a secure JWT token
 * Uses proper cryptographic signing instead of Base64 encoding
 */
export function generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
    algorithm: 'HS256'
  });
}

/**
 * Verify and decode a JWT token
 * Returns null if token is invalid or expired
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256']
    }) as TokenPayload;
    return decoded;
  } catch (error) {
    // Token is invalid or expired
    return null;
  }
}

/**
 * Decode token without verification (for debugging only)
 * DO NOT use this for authentication
 */
export function decodeTokenUnsafe(token: string): TokenPayload | null {
  try {
    const decoded = jwt.decode(token) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeTokenUnsafe(token);
  if (!decoded || !decoded.exp) return true;
  return decoded.exp * 1000 < Date.now();
}

/**
 * Refresh token if it's close to expiry (within 1 hour)
 */
export function shouldRefreshToken(token: string): boolean {
  const decoded = decodeTokenUnsafe(token);
  if (!decoded || !decoded.exp) return true;
  const oneHourFromNow = Date.now() + 60 * 60 * 1000;
  return decoded.exp * 1000 < oneHourFromNow;
}
