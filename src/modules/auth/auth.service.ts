// src/modules/auth/auth.service.ts

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../config/prisma';          // ← NEW import
import { JwtPayload } from '../../types';

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRY  = process.env.JWT_ACCESS_EXPIRES_IN  || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// ── Password ──────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ── JWT ───────────────────────────────────────────────────
export function createAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRY,
    issuer: 'college-saas',
  } as jwt.SignOptions);
}

export function createRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRY,
    issuer: 'college-saas',
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}

// ── Refresh Token DB (Prisma) ─────────────────────────────
export async function saveRefreshToken(
  userId: string,
  collegeId: string,
  rawToken: string
): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({           // ← was: query(INSERT INTO refresh_tokens...)
    data: {
      user_id:    userId,
      college_id: collegeId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    },
  });
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await prisma.refreshToken.updateMany({       // ← was: query(UPDATE refresh_tokens SET is_revoked...)
    where: { token_hash: tokenHash },
    data:  { is_revoked: true },
  });
}

export async function isRefreshTokenValid(rawToken: string): Promise<boolean> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const token = await prisma.refreshToken.findFirst({  // ← was: query(SELECT id FROM refresh_tokens...)
    where: {
      token_hash: tokenHash,
      is_revoked: false,
      expires_at: { gt: new Date() },
    },
  });

  return token !== null;
}

// ── User & College (Prisma) ───────────────────────────────
export async function findUserByEmail(email: string, collegeId: string) {
  return prisma.user.findFirst({               // ← was: query(SELECT * FROM users WHERE email...)
    where: {
      email:      email,
      college_id: collegeId,
      is_active:  true,
    },
  });
}

export async function findCollegeByDomain(domain: string) {
  return prisma.college.findFirst({            // ← was: query(SELECT * FROM colleges WHERE domain...)
    where: {
      domain:    domain,
      is_active: true,
    },
  });
}

export async function registerUser(
  collegeId: string,
  email: string,
  password: string,
  fullName: string,
  role: string = 'student'
) {
  const passwordHash = await hashPassword(password);

  return prisma.user.create({                  // ← was: query(INSERT INTO users...)
    data: {
      college_id:    collegeId,
      email:         email,
      password_hash: passwordHash,
      full_name:     fullName,
      role:          role,
    },
    select: {
  id:            true,
  college_id:    true,
  email:         true,
  full_name:     true,
  role:          true,
  is_active:     true,
  created_at:    true,
  // student fields
  roll_no:       true,
  class_name:    true,
  sec:           true,
  starting_year: true,
  ending_year:   true,
  branch:        true,
  year:          true,
},
  });
}


// ── params type ───────────────────────────────────────────
interface RegisterUserParams {
  collegeId:    string;
  email:        string;
  password:     string;
  fullName:     string;
  role:         string;
  rollNo:       string | null;
  className:    string | null;
  sec:          string | null;
  startingYear: number | null;
  endingYear:   number | null;
  branch:       string | null;
  year:         number | null;
}

export async function registerUser(params: RegisterUserParams) {
  const passwordHash = await hashPassword(params.password);

  return prisma.user.create({
    data: {
      college_id:    params.collegeId,
      email:         params.email,
      password_hash: passwordHash,
      full_name:     params.fullName,
      role:          params.role,
      roll_no:       params.rollNo,
      class_name:    params.className,
      sec:           params.sec,
      starting_year: params.startingYear,
      ending_year:   params.endingYear,
      branch:        params.branch,
      year:          params.year,
    },
    select: {
      id:            true,
      college_id:    true,
      email:         true,
      full_name:     true,
      role:          true,
      is_active:     true,
      created_at:    true,
      roll_no:       true,
      class_name:    true,
      sec:           true,
      starting_year: true,
      ending_year:   true,
      branch:        true,
      year:          true,
    },
  });
}

export async function findUserByEmail(email: string, collegeId: string) {
  return prisma.user.findFirst({
    where: {
      email:      email,
      college_id: collegeId,
      is_active:  true,
    },
    // no select = returns ALL fields including password_hash (needed for login verify)
  });
}