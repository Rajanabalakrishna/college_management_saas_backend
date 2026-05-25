"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAssignments = listAssignments;
exports.getAssignment = getAssignment;
exports.createAssignment = createAssignment;
exports.updateAssignment = updateAssignment;
exports.submitAssignment = submitAssignment;
exports.getMySubmission = getMySubmission;
exports.listSubmissions = listSubmissions;
exports.gradeSubmission = gradeSubmission;
const prisma_1 = __importDefault(require("../config/prisma"));
const redis_1 = __importDefault(require("../config/redis"));
const assignment_types_1 = require("./assignment.types");
const assignmentInclude = {
    _count: {
        select: {
            submissions: true,
        },
    },
};
const ASSIGNMENT_CACHE_TTL_SECONDS = 60;
function assignmentListCacheKey(user, query) {
    return `assignments:${user.college_id}:list:${user.id}:${JSON.stringify(query)}`;
}
function assignmentDetailCacheKey(user, assignmentId) {
    return `assignments:${user.college_id}:detail:${user.id}:${assignmentId}`;
}
async function getCached(key) {
    try {
        const cached = await redis_1.default.get(key);
        return cached ? JSON.parse(cached) : null;
    }
    catch {
        return null;
    }
}
async function setCached(key, value) {
    try {
        await redis_1.default.set(key, JSON.stringify(value), 'EX', ASSIGNMENT_CACHE_TTL_SECONDS);
    }
    catch {
        // ignore cache failure
    }
}
async function clearAssignmentCache(collegeId) {
    try {
        let cursor = '0';
        do {
            const [nextCursor, keys] = await redis_1.default.scan(cursor, 'MATCH', `assignments:${collegeId}:*`, 'COUNT', '100');
            cursor = nextCursor;
            if (keys.length > 0) {
                await redis_1.default.del(...keys);
            }
        } while (cursor !== '0');
    }
    catch {
        // ignore cache failure
    }
}
function normalizedRole(role) {
    return role.trim().toLowerCase();
}
function isAssignmentManager(role) {
    return ['admin', 'faculty', 'teacher'].includes(normalizedRole(role));
}
function isAdmin(role) {
    return normalizedRole(role) === 'admin';
}
function isStudent(role) {
    return normalizedRole(role) === 'student';
}
async function getCurrentUser(auth) {
    const user = await prisma_1.default.user.findFirst({
        where: {
            id: auth.userId,
            college_id: auth.collegeId,
            is_active: true,
        },
        select: {
            id: true,
            college_id: true,
            email: true,
            full_name: true,
            role: true,
            is_active: true,
            class_name: true,
            sec: true,
            branch: true,
            year: true,
        },
    });
    if (!user) {
        throw new assignment_types_1.AssignmentHttpError(401, 'Invalid user session');
    }
    return user;
}
function applyStudentAssignmentScope(where, user) {
    where.status = 'PUBLISHED';
    const and = where.AND ?? [];
    if (user.class_name) {
        and.push({ class_name: user.class_name });
    }
    if (user.sec) {
        and.push({
            OR: [{ section: null }, { section: user.sec }],
        });
    }
    if (user.branch) {
        and.push({
            OR: [{ branch: null }, { branch: user.branch }],
        });
    }
    if (user.year !== null && user.year !== undefined) {
        and.push({
            OR: [{ year: null }, { year: user.year }],
        });
    }
    if (and.length > 0) {
        where.AND = and;
    }
}
function assignmentMatchesStudent(assignment, user) {
    if (assignment.status !== 'PUBLISHED')
        return false;
    if (assignment.class_name && user.class_name && assignment.class_name !== user.class_name) {
        return false;
    }
    if (assignment.section && user.sec && assignment.section !== user.sec) {
        return false;
    }
    if (assignment.branch && user.branch && assignment.branch !== user.branch) {
        return false;
    }
    if (assignment.year !== null && assignment.year !== undefined && user.year !== null && user.year !== undefined) {
        return assignment.year === user.year;
    }
    return true;
}
function toAssignmentResponse(assignment, mySubmission) {
    return {
        id: assignment.id,
        college_id: assignment.college_id,
        title: assignment.title,
        description: assignment.description,
        subject: assignment.subject,
        class_name: assignment.class_name,
        section: assignment.section ?? null,
        branch: assignment.branch ?? null,
        year: assignment.year ?? null,
        due_date: assignment.due_date,
        max_marks: assignment.max_marks,
        status: assignment.status,
        file_url: assignment.file_url ?? null,
        created_by: assignment.created_by,
        created_at: assignment.created_at,
        updated_at: assignment.updated_at,
        _count: assignment._count,
        my_submission: mySubmission ? toSubmissionResponse(mySubmission) : undefined,
    };
}
function toSubmissionResponse(submission) {
    return {
        id: submission.id,
        assignment_id: submission.assignment_id,
        student_id: submission.student_id,
        college_id: submission.college_id,
        answer_text: submission.answer_text ?? null,
        file_url: submission.file_url ?? null,
        marks_obtained: submission.marks_obtained ?? null,
        feedback: submission.feedback ?? null,
        status: submission.status,
        submitted_at: submission.submitted_at,
        graded_at: submission.graded_at ?? null,
        graded_by: submission.graded_by ?? null,
        student: submission.student
            ? {
                id: submission.student.id,
                full_name: submission.student.full_name,
                email: submission.student.email,
                roll_no: submission.student.roll_no ?? null,
            }
            : undefined,
    };
}
async function getManagedAssignment(user, assignmentId) {
    if (!isAssignmentManager(user.role)) {
        throw new assignment_types_1.AssignmentHttpError(403, 'Only faculty or admin can manage assignments');
    }
    const where = {
        id: assignmentId,
        college_id: user.college_id,
    };
    if (!isAdmin(user.role)) {
        where.created_by = user.id;
    }
    const assignment = await prisma_1.default.assignment.findFirst({ where });
    if (!assignment) {
        throw new assignment_types_1.AssignmentHttpError(404, 'Assignment not found');
    }
    return assignment;
}
async function listAssignments(auth, query) {
    const user = await getCurrentUser(auth);
    const cacheKey = assignmentListCacheKey(user, query);
    const cached = await getCached(cacheKey);
    if (cached) {
        return cached;
    }
    const where = {
        college_id: auth.collegeId,
    };
    if (query.status)
        where.status = query.status;
    if (query.subject)
        where.subject = { contains: query.subject, mode: 'insensitive' };
    if (query.className)
        where.class_name = query.className;
    if (query.branch)
        where.branch = query.branch;
    if (query.year !== undefined)
        where.year = query.year;
    if (!isAssignmentManager(user.role)) {
        applyStudentAssignmentScope(where, user);
    }
    else if (!isAdmin(user.role)) {
        where.created_by = user.id;
    }
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
        prisma_1.default.assignment.findMany({
            where,
            include: assignmentInclude,
            orderBy: [{ due_date: 'asc' }, { created_at: 'desc' }],
            skip,
            take: query.limit,
        }),
        prisma_1.default.assignment.count({ where }),
    ]);
    const result = {
        items: items.map((item) => toAssignmentResponse(item)),
        page: query.page,
        limit: query.limit,
        total,
        total_pages: Math.max(Math.ceil(total / query.limit), 1),
    };
    await setCached(cacheKey, result);
    return result;
}
async function getAssignment(auth, assignmentId) {
    const user = await getCurrentUser(auth);
    const cacheKey = assignmentDetailCacheKey(user, assignmentId);
    const cached = await getCached(cacheKey);
    if (cached) {
        return cached;
    }
    const assignment = await prisma_1.default.assignment.findFirst({
        where: {
            id: assignmentId,
            college_id: auth.collegeId,
        },
        include: assignmentInclude,
    });
    if (!assignment) {
        throw new assignment_types_1.AssignmentHttpError(404, 'Assignment not found');
    }
    if (isAssignmentManager(user.role)) {
        if (!isAdmin(user.role) && assignment.created_by !== user.id) {
            throw new assignment_types_1.AssignmentHttpError(403, 'You can access only your assignments');
        }
        const response = toAssignmentResponse(assignment);
        await setCached(cacheKey, response);
        return response;
    }
    if (!assignmentMatchesStudent(assignment, user)) {
        throw new assignment_types_1.AssignmentHttpError(404, 'Assignment not found');
    }
    const mySubmission = await prisma_1.default.assignmentSubmission.findFirst({
        where: {
            assignment_id: assignment.id,
            student_id: user.id,
            college_id: user.college_id,
        },
    });
    const response = toAssignmentResponse(assignment, mySubmission);
    await setCached(cacheKey, response);
    return response;
}
async function createAssignment(auth, input) {
    const user = await getCurrentUser(auth);
    if (!isAssignmentManager(user.role)) {
        throw new assignment_types_1.AssignmentHttpError(403, 'Only faculty or admin can create assignments');
    }
    const assignment = await prisma_1.default.assignment.create({
        data: {
            college_id: user.college_id,
            title: input.title,
            description: input.description,
            subject: input.subject,
            class_name: input.className,
            section: input.section ?? null,
            branch: input.branch ?? null,
            year: input.year ?? null,
            due_date: input.dueDate,
            max_marks: input.maxMarks,
            status: input.status,
            file_url: input.fileUrl ?? null,
            created_by: user.id,
        },
        include: assignmentInclude,
    });
    await clearAssignmentCache(user.college_id);
    return toAssignmentResponse(assignment);
}
async function updateAssignment(auth, assignmentId, input) {
    const user = await getCurrentUser(auth);
    await getManagedAssignment(user, assignmentId);
    const data = {};
    if (input.title !== undefined)
        data.title = input.title;
    if (input.description !== undefined)
        data.description = input.description;
    if (input.subject !== undefined)
        data.subject = input.subject;
    if (input.className !== undefined)
        data.class_name = input.className;
    if (input.section !== undefined)
        data.section = input.section;
    if (input.branch !== undefined)
        data.branch = input.branch;
    if (input.year !== undefined)
        data.year = input.year;
    if (input.dueDate !== undefined)
        data.due_date = input.dueDate;
    if (input.maxMarks !== undefined)
        data.max_marks = input.maxMarks;
    if (input.status !== undefined)
        data.status = input.status;
    if (input.fileUrl !== undefined)
        data.file_url = input.fileUrl;
    const assignment = await prisma_1.default.assignment.update({
        where: { id: assignmentId },
        data,
        include: assignmentInclude,
    });
    await clearAssignmentCache(user.college_id);
    return toAssignmentResponse(assignment);
}
async function submitAssignment(auth, assignmentId, input) {
    const user = await getCurrentUser(auth);
    if (!isStudent(user.role)) {
        throw new assignment_types_1.AssignmentHttpError(403, 'Only students can submit assignments');
    }
    const assignment = await prisma_1.default.assignment.findFirst({
        where: {
            id: assignmentId,
            college_id: user.college_id,
        },
    });
    if (!assignment || !assignmentMatchesStudent(assignment, user)) {
        throw new assignment_types_1.AssignmentHttpError(404, 'Assignment not found');
    }
    if (assignment.status !== 'PUBLISHED') {
        throw new assignment_types_1.AssignmentHttpError(400, 'Assignment is not open for submissions');
    }
    if (new Date() > assignment.due_date) {
        throw new assignment_types_1.AssignmentHttpError(400, 'Assignment due date has passed');
    }
    const existing = await prisma_1.default.assignmentSubmission.findFirst({
        where: {
            assignment_id: assignment.id,
            student_id: user.id,
            college_id: user.college_id,
        },
    });
    if (existing?.status === 'GRADED') {
        throw new assignment_types_1.AssignmentHttpError(409, 'Graded submission cannot be changed');
    }
    const submission = existing
        ? await prisma_1.default.assignmentSubmission.update({
            where: { id: existing.id },
            data: {
                answer_text: input.answerText ?? null,
                file_url: input.fileUrl ?? null,
                submitted_at: new Date(),
                status: 'SUBMITTED',
                marks_obtained: null,
                feedback: null,
                graded_at: null,
                graded_by: null,
            },
        })
        : await prisma_1.default.assignmentSubmission.create({
            data: {
                assignment_id: assignment.id,
                student_id: user.id,
                college_id: user.college_id,
                answer_text: input.answerText ?? null,
                file_url: input.fileUrl ?? null,
            },
        });
    await clearAssignmentCache(user.college_id);
    return toSubmissionResponse(submission);
}
async function getMySubmission(auth, assignmentId) {
    const user = await getCurrentUser(auth);
    const submission = await prisma_1.default.assignmentSubmission.findFirst({
        where: {
            assignment_id: assignmentId,
            student_id: user.id,
            college_id: user.college_id,
        },
    });
    return submission ? toSubmissionResponse(submission) : null;
}
async function listSubmissions(auth, assignmentId) {
    const user = await getCurrentUser(auth);
    await getManagedAssignment(user, assignmentId);
    const submissions = await prisma_1.default.assignmentSubmission.findMany({
        where: {
            assignment_id: assignmentId,
            college_id: user.college_id,
        },
        include: {
            student: {
                select: {
                    id: true,
                    full_name: true,
                    email: true,
                    roll_no: true,
                },
            },
        },
        orderBy: {
            submitted_at: 'desc',
        },
    });
    return submissions.map((submission) => toSubmissionResponse(submission));
}
async function gradeSubmission(auth, assignmentId, submissionId, input) {
    const user = await getCurrentUser(auth);
    const assignment = await getManagedAssignment(user, assignmentId);
    if (input.marksObtained > assignment.max_marks) {
        throw new assignment_types_1.AssignmentHttpError(400, `marks_obtained cannot be greater than max_marks (${assignment.max_marks})`);
    }
    const existing = await prisma_1.default.assignmentSubmission.findFirst({
        where: {
            id: submissionId,
            assignment_id: assignmentId,
            college_id: user.college_id,
        },
    });
    if (!existing) {
        throw new assignment_types_1.AssignmentHttpError(404, 'Submission not found');
    }
    const submission = await prisma_1.default.assignmentSubmission.update({
        where: { id: existing.id },
        data: {
            marks_obtained: input.marksObtained,
            feedback: input.feedback ?? null,
            status: 'GRADED',
            graded_at: new Date(),
            graded_by: user.id,
        },
        include: {
            student: {
                select: {
                    id: true,
                    full_name: true,
                    email: true,
                    roll_no: true,
                },
            },
        },
    });
    return toSubmissionResponse(submission);
}
