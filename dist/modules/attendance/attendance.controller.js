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
exports.listStudents = listStudents;
exports.getAttendance = getAttendance;
exports.saveAttendance = saveAttendance;
const AttendanceService = __importStar(require("./attendance.service"));
function filtersFromQuery(query) {
    const yearValue = query.year ? Number(query.year) : undefined;
    return {
        className: typeof query.class_name === 'string' ? query.class_name : undefined,
        sec: typeof query.sec === 'string' ? query.sec : undefined,
        branch: typeof query.branch === 'string' ? query.branch : undefined,
        year: Number.isFinite(yearValue) ? yearValue : undefined,
    };
}
function sendError(res, error, fallback) {
    const err = error;
    res.status(err.statusCode ?? 500).json({
        error: err.message || fallback,
    });
}
async function listStudents(req, res) {
    try {
        const collegeId = req.user.collegeId;
        const students = await AttendanceService.listStudents(collegeId, filtersFromQuery(req.query));
        res.json({ data: students.map((student) => ({ ...student, class: student.class_name })) });
    }
    catch (error) {
        sendError(res, error, 'Unable to load students');
    }
}
async function getAttendance(req, res) {
    try {
        const collegeId = req.user.collegeId;
        const date = typeof req.query.date === 'string'
            ? req.query.date
            : AttendanceService.todayYmdInIndia();
        const data = await AttendanceService.getAttendanceByDate(collegeId, date, filtersFromQuery(req.query));
        res.json({ data });
    }
    catch (error) {
        sendError(res, error, 'Unable to load attendance');
    }
}
async function saveAttendance(req, res) {
    try {
        const collegeId = req.user.collegeId;
        const markerUserId = req.user.userId;
        const body = req.body;
        const data = await AttendanceService.saveTodayAttendance(collegeId, markerUserId, body.date, body.records);
        res.json({ message: 'Attendance saved', data });
    }
    catch (error) {
        sendError(res, error, 'Unable to save attendance');
    }
}
