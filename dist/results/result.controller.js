"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listResults = listResults;
exports.myResults = myResults;
exports.saveResult = saveResult;
exports.saveBulkResults = saveBulkResults;
const ResultService = __importStar(require("./result.service"));
function queryString(query, key) {
    const value = query[key];
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function queryNumber(query, key) {
    const value = queryString(query, key);
    if (!value)
        return undefined;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
}
function queryFromRequest(req) {
    const page = queryNumber(req.query, 'page') ?? 1;
    const limit = queryNumber(req.query, 'limit') ?? 20;
    return {
        page: Math.max(page, 1),
        limit: Math.min(Math.max(limit, 1), 100),
        studentId: queryString(req.query, 'student_id'),
        subject: queryString(req.query, 'subject'),
        examType: queryString(req.query, 'exam_type'),
        semester: queryNumber(req.query, 'semester'),
        academicYear: queryString(req.query, 'academic_year'),
    };
}
function sendError(res, error, fallback) {
    const err = error;
    console.error('Result error:', err.message ?? error);
    res.status(err.statusCode ?? 500).json({
        error: err.message || fallback,
    });
}
async function listResults(req, res) {
    try {
        const authUser = req.user;
        const data = await ResultService.listResults(authUser.collegeId, authUser.userId, authUser.role, queryFromRequest(req));
        res.status(200).json({ data });
    }
    catch (error) {
        sendError(res, error, 'Unable to load results');
    }
}
async function myResults(req, res) {
    try {
        const authUser = req.user;
        const query = queryFromRequest(req);
        query.studentId = authUser.userId;
        const data = await ResultService.listResults(authUser.collegeId, authUser.userId, authUser.role, query);
        res.status(200).json({ data });
    }
    catch (error) {
        sendError(res, error, 'Unable to load results');
    }
}
async function saveResult(req, res) {
    try {
        const authUser = req.user;
        const result = await ResultService.saveResult(authUser.collegeId, authUser.userId, req.body);
        res.status(201).json({
            message: 'Result saved successfully',
            data: result,
        });
    }
    catch (error) {
        sendError(res, error, 'Unable to save result');
    }
}
async function saveBulkResults(req, res) {
    try {
        const authUser = req.user;
        const body = req.body;
        const data = await ResultService.saveBulkResults(authUser.collegeId, authUser.userId, body.results);
        res.status(201).json({
            message: 'Results saved successfully',
            data,
        });
    }
    catch (error) {
        sendError(res, error, 'Unable to save results');
    }
}
