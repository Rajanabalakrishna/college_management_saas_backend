"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.createAccessToken = createAccessToken;
exports.createRefreshToken = createRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.saveRefreshToken = saveRefreshToken;
exports.revokeRefreshToken = revokeRefreshToken;
exports.isRefreshTokenValid = isRefreshTokenValid;
exports.findCollegeByDomain = findCollegeByDomain;
exports.findUserByEmail = findUserByEmail;
exports.registerUser = registerUser;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../../config/prisma"));
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
// ── Password ──────────────────────────────────────────────
async function hashPassword(password) {
    return bcryptjs_1.default.hash(password, 12);
}
async function verifyPassword(plain, hash) {
    return bcryptjs_1.default.compare(plain, hash);
}
// ── JWT ───────────────────────────────────────────────────
function createAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, ACCESS_SECRET, {
        expiresIn: ACCESS_EXPIRY,
        issuer: 'college-saas',
    });
}
function createRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, REFRESH_SECRET, {
        expiresIn: REFRESH_EXPIRY,
        issuer: 'college-saas',
    });
}
function verifyAccessToken(token) {
    return jsonwebtoken_1.default.verify(token, ACCESS_SECRET);
}
function verifyRefreshToken(token) {
    return jsonwebtoken_1.default.verify(token, REFRESH_SECRET);
}
// ── Refresh Token DB ──────────────────────────────────────
async function saveRefreshToken(userId, collegeId, rawToken) {
    const tokenHash = crypto_1.default.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma_1.default.refreshToken.create({
        data: {
            user_id: userId,
            college_id: collegeId,
            token_hash: tokenHash,
            expires_at: expiresAt,
        },
    });
}
async function revokeRefreshToken(rawToken) {
    const tokenHash = crypto_1.default.createHash('sha256').update(rawToken).digest('hex');
    await prisma_1.default.refreshToken.updateMany({
        where: { token_hash: tokenHash },
        data: { is_revoked: true },
    });
}
async function isRefreshTokenValid(rawToken) {
    const tokenHash = crypto_1.default.createHash('sha256').update(rawToken).digest('hex');
    const token = await prisma_1.default.refreshToken.findFirst({
        where: {
            token_hash: tokenHash,
            is_revoked: false,
            expires_at: { gt: new Date() },
        },
    });
    return token !== null;
}
// ── College ───────────────────────────────────────────────
async function findCollegeByDomain(domain) {
    return prisma_1.default.college.findFirst({
        where: { domain, is_active: true },
    });
}
// ── User ──────────────────────────────────────────────────
async function findUserByEmail(email, collegeId) {
    return prisma_1.default.user.findFirst({
        where: { email, college_id: collegeId, is_active: true },
    });
}
async function registerUser(params) {
    const passwordHash = await hashPassword(params.password);
    return prisma_1.default.user.create({
        data: {
            college_id: params.collegeId,
            email: params.email,
            password_hash: passwordHash,
            full_name: params.fullName,
            image_url: params.imageUrl,
            role: params.role,
            roll_no: params.rollNo,
            class_name: params.className,
            sec: params.sec,
            starting_year: params.startingYear,
            ending_year: params.endingYear,
            branch: params.branch,
            year: params.year,
        },
        select: {
            id: true,
            college_id: true,
            email: true,
            full_name: true,
            role: true,
            image_url: true,
            is_active: true,
            created_at: true,
            roll_no: true,
            class_name: true,
            sec: true,
            starting_year: true,
            ending_year: true,
            branch: true,
            year: true,
        },
    });
}
