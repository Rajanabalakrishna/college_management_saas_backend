"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const prisma_1 = __importDefault(require("./config/prisma")); // ← CHANGED
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const assignment_routes_1 = __importDefault(require("./assignments/assignment.routes"));
const attendance_routes_1 = __importDefault(require("./modules/attendance/attendance.routes"));
const result_routes_1 = __importDefault(require("./results/result.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: ['http://localhost:3000', 'http://localhost:8080'],
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10kb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/assignments', assignment_routes_1.default);
app.use('/api/v1/attendance', attendance_routes_1.default);
app.use('/api/v1/results', result_routes_1.default);
app.get('/health', async (_req, res) => {
    try {
        await prisma_1.default.$queryRaw `SELECT 1`; // ← CHANGED
        res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
    }
    catch {
        res.status(500).json({ status: 'error', db: 'disconnected' });
    }
});
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
    console.log(`🔑 Auth routes:  http://localhost:${PORT}/api/v1/auth`);
});
exports.default = app;
