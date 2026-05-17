import bcrypt  from 'bcryptjs';
import jwt     from 'jsonwebtoken';
import crypto  from 'crypto';
import prisma  from '../../config/prisma';
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

// ── Refresh Token DB ──────────────────────────────────────
export async function saveRefreshToken(
  userId: string,
  collegeId: string,
  rawToken: string
): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
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
  await prisma.refreshToken.updateMany({
    where: { token_hash: tokenHash },
    data:  { is_revoked: true },
  });
}

export async function isRefreshTokenValid(rawToken: string): Promise<boolean> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const token = await prisma.refreshToken.findFirst({
    where: {
      token_hash: tokenHash,
      is_revoked: false,
      expires_at: { gt: new Date() },
    },
  });
  return token !== null;
}

// ── College ───────────────────────────────────────────────
export async function findCollegeByDomain(domain: string) {
  return prisma.college.findFirst({
    where: { domain, is_active: true },
  });
}

// ── User ──────────────────────────────────────────────────
export async function findUserByEmail(email: string, collegeId: string) {
  return prisma.user.findFirst({
    where: { email, college_id: collegeId, is_active: true },
  });
}

interface RegisterUserParams {
  collegeId:    string;
  email:        string;
  password:     string;
  fullName:     string;
  role:         string;
  rollNo:       string | null;
  imageUrl:     string | null;
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
      image_url:     params.imageUrl,
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
      image_url:     true,
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