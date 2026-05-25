"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.todayYmdInIndia = todayYmdInIndia;
exports.listStudents = listStudents;
exports.getAttendanceByDate = getAttendanceByDate;
exports.saveTodayAttendance = saveTodayAttendance;
const prisma_1 = __importDefault(require("../../config/prisma"));
function httpError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}
function requireYmd(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw httpError('date must be in YYYY-MM-DD format', 400);
    }
}
function toDbDate(date) {
    requireYmd(date);
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}
function todayYmdInIndia() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const pick = (type) => parts.find((part) => part.type === type)?.value;
    return `${pick('year')}-${pick('month')}-${pick('day')}`;
}
function normalizeStatus(value) {
    if (value === 'PRESENT' || value === 'ABSENT')
        return value;
    throw httpError('status must be PRESENT or ABSENT', 400);
}
function studentWhere(collegeId, filters) {
    return {
        college_id: collegeId,
        role: 'student',
        is_active: true,
        ...(filters.className ? { class_name: filters.className } : {}),
        ...(filters.sec ? { sec: filters.sec } : {}),
        ...(filters.branch ? { branch: filters.branch } : {}),
        ...(filters.year ? { year: filters.year } : {}),
    };
}
const studentSelect = {
    id: true,
    college_id: true,
    email: true,
    full_name: true,
    roll_no: true,
    class_name: true,
    sec: true,
    branch: true,
    year: true,
};
async function listStudents(collegeId, filters) {
    return prisma_1.default.user.findMany({
        where: studentWhere(collegeId, filters),
        select: studentSelect,
        orderBy: [
            { class_name: 'asc' },
            { sec: 'asc' },
            { roll_no: 'asc' },
            { full_name: 'asc' },
        ],
    });
}
async function getAttendanceByDate(collegeId, date, filters) {
    const attendanceDate = toDbDate(date);
    const today = todayYmdInIndia();
    const editable = date === today;
    const students = await listStudents(collegeId, filters);
    const studentIds = students.map((student) => student.id);
    const records = studentIds.length === 0
        ? []
        : await prisma_1.default.attendanceRecord.findMany({
            where: {
                college_id: collegeId,
                attendance_date: attendanceDate,
                student_id: { in: studentIds },
            },
            select: {
                id: true,
                student_id: true,
                status: true,
                marked_by: true,
                updated_at: true,
            },
        });
    const byStudent = new Map(records.map((record) => [record.student_id, record]));
    const items = students.map((student) => {
        const record = byStudent.get(student.id);
        const status = (record?.status ?? 'ABSENT');
        return {
            id: student.id,
            college_id: student.college_id,
            email: student.email,
            full_name: student.full_name,
            roll_no: student.roll_no,
            class: student.class_name,
            sec: student.sec,
            branch: student.branch,
            year: student.year,
            attendance_id: record?.id ?? null,
            attendance_status: status,
            marked_by: record?.marked_by ?? null,
            marked_at: record?.updated_at ?? null,
        };
    });
    const presentCount = items.filter((item) => item.attendance_status === 'PRESENT').length;
    return {
        date,
        today,
        editable,
        total: items.length,
        present_count: presentCount,
        absent_count: items.length - presentCount,
        students: items,
    };
}
async function saveTodayAttendance(collegeId, markerUserId, date, inputRecords) {
    const today = todayYmdInIndia();
    if (date !== today) {
        throw httpError('Only today attendance can be edited', 403);
    }
    const attendanceDate = toDbDate(date);
    if (!Array.isArray(inputRecords) || inputRecords.length === 0) {
        throw httpError('records are required', 400);
    }
    const records = inputRecords.map((record) => ({
        student_id: String(record.student_id),
        status: normalizeStatus(record.status),
    }));
    const uniqueStudentIds = [...new Set(records.map((record) => record.student_id))];
    const students = await prisma_1.default.user.findMany({
        where: {
            id: { in: uniqueStudentIds },
            college_id: collegeId,
            role: 'student',
            is_active: true,
        },
        select: { id: true },
    });
    if (students.length !== uniqueStudentIds.length) {
        throw httpError('One or more student ids are invalid for this college', 400);
    }
    const dedupedMap = new Map();
    for (const record of records) {
        dedupedMap.set(record.student_id, record.status);
    }
    const deduped = [...dedupedMap.entries()].map(([student_id, status]) => ({
        student_id,
        status,
    }));
    await prisma_1.default.$transaction(deduped.map((record) => prisma_1.default.attendanceRecord.upsert({
        where: {
            student_id_attendance_date: {
                student_id: record.student_id,
                attendance_date: attendanceDate,
            },
        },
        create: {
            college_id: collegeId,
            student_id: record.student_id,
            attendance_date: attendanceDate,
            status: record.status,
            marked_by: markerUserId,
        },
        update: {
            status: record.status,
            marked_by: markerUserId,
        },
    })));
    return getAttendanceByDate(collegeId, date, {});
}
