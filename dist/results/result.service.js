"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listResults = listResults;
exports.saveResult = saveResult;
exports.saveBulkResults = saveBulkResults;
const prisma_1 = __importDefault(require("../config/prisma"));
function httpError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}
function normalizeRole(role) {
    return role.trim().toLowerCase();
}
function isStudent(role) {
    return normalizeRole(role) === 'student';
}
function requiredString(value, field) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw httpError(`${field} is required`, 400);
    }
    return value.trim();
}
function optionalString(value) {
    if (value === undefined || value === null)
        return null;
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
}
function optionalInt(value, field) {
    if (value === undefined || value === null || value === '')
        return null;
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue)) {
        throw httpError(`${field} must be an integer`, 400);
    }
    return numberValue;
}
function requiredNumber(value, field) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
        throw httpError(`${field} must be a number`, 400);
    }
    return numberValue;
}
function normalizeStatus(value, marks, maxMarks) {
    if (value === 'PASS' || value === 'FAIL' || value === 'WITHHELD')
        return value;
    return maxMarks > 0 && (marks / maxMarks) * 100 >= 35 ? 'PASS' : 'FAIL';
}
function gradeFromMarks(marks, maxMarks) {
    const percentage = maxMarks <= 0 ? 0 : (marks / maxMarks) * 100;
    if (percentage >= 90)
        return 'A+';
    if (percentage >= 80)
        return 'A';
    if (percentage >= 70)
        return 'B';
    if (percentage >= 60)
        return 'C';
    if (percentage >= 50)
        return 'D';
    return 'F';
}
function toResultResponse(result) {
    const percentage = result.max_marks > 0
        ? Number(((result.marks_obtained / result.max_marks) * 100).toFixed(2))
        : 0;
    return {
        id: result.id,
        college_id: result.college_id,
        student_id: result.student_id,
        subject: result.subject,
        exam_type: result.exam_type,
        semester: result.semester ?? null,
        academic_year: result.academic_year,
        max_marks: result.max_marks,
        marks_obtained: result.marks_obtained,
        percentage,
        grade: result.grade ?? null,
        result_status: result.result_status,
        remarks: result.remarks ?? null,
        published: result.published,
        created_by: result.created_by ?? null,
        created_at: result.created_at,
        updated_at: result.updated_at,
        student: result.student
            ? {
                id: result.student.id,
                full_name: result.student.full_name,
                email: result.student.email,
                roll_no: result.student.roll_no ?? null,
                class: result.student.class_name ?? null,
                sec: result.student.sec ?? null,
                branch: result.student.branch ?? null,
                year: result.student.year ?? null,
            }
            : undefined,
    };
}
function summaryFromResults(results) {
    const totalSubjects = results.length;
    const totalMarks = results.reduce((sum, item) => sum + item.max_marks, 0);
    const marksObtained = results.reduce((sum, item) => sum + item.marks_obtained, 0);
    const passCount = results.filter((item) => item.result_status === 'PASS').length;
    const failCount = results.filter((item) => item.result_status === 'FAIL').length;
    const withheldCount = results.filter((item) => item.result_status === 'WITHHELD').length;
    return {
        total_subjects: totalSubjects,
        total_marks: totalMarks,
        marks_obtained: marksObtained,
        percentage: totalMarks > 0
            ? Number(((marksObtained / totalMarks) * 100).toFixed(2))
            : 0,
        pass_count: passCount,
        fail_count: failCount,
        withheld_count: withheldCount,
    };
}
function resultInclude() {
    return {
        student: {
            select: {
                id: true,
                full_name: true,
                email: true,
                roll_no: true,
                class_name: true,
                sec: true,
                branch: true,
                year: true,
            },
        },
    };
}
async function listResults(collegeId, authUserId, authRole, query) {
    const where = {
        college_id: collegeId,
        published: true,
    };
    if (query.studentId) {
        where.student_id = query.studentId;
    }
    else if (isStudent(authRole)) {
        where.student_id = authUserId;
    }
    if (query.subject) {
        where.subject = { contains: query.subject, mode: 'insensitive' };
    }
    if (query.examType)
        where.exam_type = query.examType;
    if (query.semester !== undefined)
        where.semester = query.semester;
    if (query.academicYear)
        where.academic_year = query.academicYear;
    const skip = (query.page - 1) * query.limit;
    const [items, total, allForSummary] = await Promise.all([
        prisma_1.default.studentResult.findMany({
            where,
            include: resultInclude(),
            orderBy: [
                { academic_year: 'desc' },
                { semester: 'desc' },
                { exam_type: 'asc' },
                { subject: 'asc' },
            ],
            skip,
            take: query.limit,
        }),
        prisma_1.default.studentResult.count({ where }),
        prisma_1.default.studentResult.findMany({
            where,
            select: {
                max_marks: true,
                marks_obtained: true,
                result_status: true,
            },
        }),
    ]);
    return {
        items: items.map((item) => toResultResponse(item)),
        page: query.page,
        limit: query.limit,
        total,
        total_pages: Math.max(Math.ceil(total / query.limit), 1),
        summary: summaryFromResults(allForSummary),
    };
}
async function saveResult(collegeId, creatorUserId, input) {
    const studentId = requiredString(input.student_id, 'student_id');
    const subject = requiredString(input.subject, 'subject');
    const examType = requiredString(input.exam_type, 'exam_type');
    const academicYear = requiredString(input.academic_year, 'academic_year');
    const semester = optionalInt(input.semester, 'semester');
    const maxMarks = input.max_marks === undefined
        ? 100
        : requiredNumber(input.max_marks, 'max_marks');
    const marksObtained = requiredNumber(input.marks_obtained, 'marks_obtained');
    if (maxMarks <= 0) {
        throw httpError('max_marks must be greater than 0', 400);
    }
    if (marksObtained < 0 || marksObtained > maxMarks) {
        throw httpError('marks_obtained must be between 0 and max_marks', 400);
    }
    const student = await prisma_1.default.user.findFirst({
        where: {
            id: studentId,
            college_id: collegeId,
            role: 'student',
            is_active: true,
        },
        select: { id: true },
    });
    if (!student) {
        throw httpError('Student not found in this college', 404);
    }
    const data = {
        college_id: collegeId,
        student_id: studentId,
        subject,
        exam_type: examType,
        semester,
        academic_year: academicYear,
        max_marks: maxMarks,
        marks_obtained: marksObtained,
        grade: optionalString(input.grade) ?? gradeFromMarks(marksObtained, maxMarks),
        result_status: normalizeStatus(input.result_status, marksObtained, maxMarks),
        remarks: optionalString(input.remarks),
        published: input.published ?? true,
        created_by: creatorUserId,
    };
    const existing = input.id
        ? await prisma_1.default.studentResult.findFirst({
            where: { id: input.id, college_id: collegeId },
        })
        : await prisma_1.default.studentResult.findFirst({
            where: {
                student_id: studentId,
                subject,
                exam_type: examType,
                semester,
                academic_year: academicYear,
            },
        });
    const saved = existing
        ? await prisma_1.default.studentResult.update({
            where: { id: existing.id },
            data,
            include: resultInclude(),
        })
        : await prisma_1.default.studentResult.create({
            data,
            include: resultInclude(),
        });
    return toResultResponse(saved);
}
async function saveBulkResults(collegeId, creatorUserId, inputs) {
    if (!Array.isArray(inputs) || inputs.length === 0) {
        throw httpError('results are required', 400);
    }
    const saved = [];
    for (const input of inputs) {
        saved.push(await saveResult(collegeId, creatorUserId, input));
    }
    return {
        items: saved,
        total: saved.length,
    };
}
