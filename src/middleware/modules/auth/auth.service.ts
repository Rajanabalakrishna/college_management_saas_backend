import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../../config/db';
import { JwtPayload, User } from '../../types';

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRY  = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// ── HASH password before storing ─────────────────────────
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12; // FAANG standard: 12 rounds
  return bcrypt.hash(password, saltRounds);
}

// ── VERIFY password on login ──────────────────────────────
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ── CREATE access token (short-lived: 15 min) ─────────────
export function createAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRY,
    issuer: 'college-saas',
  } as jwt.SignOptions);
}

// ── CREATE refresh token (long-lived: 7 days) ─────────────
export function createRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRY,
    issuer: 'college-saas',
  } as jwt.SignOptions);
}

// ── VERIFY access token ───────────────────────────────────
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

// ── VERIFY refresh token ──────────────────────────────────
export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}

// ── SAVE refresh token to DB (hashed) ────────────────────
export async function saveRefreshToken(
  userId: string,
  collegeId: string,
  rawToken: string
): Promise<void> {
  // Hash the token before storing — never store raw tokens
  const tokenHash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  await query(
    `INSERT INTO refresh_tokens (user_id, college_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, collegeId, tokenHash, expiresAt]
  );
}

// ── REVOKE a refresh token (logout) ──────────────────────
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  await query(
    `UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1`,
    [tokenHash]
  );
}

// ── VERIFY refresh token is valid in DB ───────────────────
export async function isRefreshTokenValid(rawToken: string): Promise<boolean> {
  const tokenHash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  const result = await query(
    `SELECT id FROM refresh_tokens
     WHERE token_hash = $1
       AND is_revoked = false
       AND expires_at > NOW()`,
    [tokenHash]
  );

  return (result.rowCount ?? 0) > 0;
}

// ── FIND user by email within a college (multi-tenant) ────
export async function findUserByEmail(
  email: string,
  collegeId: string
): Promise<User | null> {
  const result = await query(
    `SELECT * FROM users WHERE email = $1 AND college_id = $2 AND is_active = true`,
    [email, collegeId]
  );
  return result.rows[0] || null;
}

// ── FIND college by domain ────────────────────────────────
export async function findCollegeByDomain(domain: string) {
  const result = await query(
    `SELECT * FROM colleges WHERE domain = $1 AND is_active = true`,
    [domain]
  );
  return result.rows[0] || null;
}

// ── REGISTER new user ─────────────────────────────────────
export async function registerUser(
  collegeId: string,
  email: string,
  password: string,
  fullName: string,
  role: string = 'student'
): Promise<User> {
  const passwordHash = await hashPassword(password);

  const result = await query(
    `INSERT INTO users (college_id, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, college_id, email, full_name, role, is_active, created_at`,
    [collegeId, email, passwordHash, fullName, role]
  );
  return result.rows[0];
}