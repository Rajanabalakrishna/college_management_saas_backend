"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const prisma_1 = __importDefault(require("../../config/prisma"));
const router = (0, express_1.Router)();
// ── Public routes (no token needed) ──────────────────────
router.post('/register', auth_controller_1.register);
router.post('/login', auth_controller_1.login);
router.post('/refresh', auth_controller_1.refresh);
router.post('/logout', auth_controller_1.logout);
// ── Protected route (token required) ─────────────────────
// auth.routes.ts — replace the /me inline handler
router.get('/me', auth_middleware_1.authenticate, async (req, res) => {
    const jwtUser = req.user;
    const user = await prisma_1.default.user.findUnique({
        where: { id: jwtUser.userId },
        select: {
            id: true, college_id: true, email: true, full_name: true,
            role: true, is_active: true, created_at: true,
            roll_no: true, class_name: true, sec: true,
            starting_year: true, ending_year: true, branch: true, year: true,
        },
    });
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    // Map class_name → class for Flutter
    res.json({
        data: { ...user, class: user.class_name, class_name: undefined }
    });
});
exports.default = router;
