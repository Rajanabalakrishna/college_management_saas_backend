"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateListAssignmentsQuery = validateListAssignmentsQuery;
exports.validateCreateAssignmentBody = validateCreateAssignmentBody;
exports.validateUpdateAssignmentBody = validateUpdateAssignmentBody;
exports.validateSubmitAssignmentBody = validateSubmitAssignmentBody;
exports.validateGradeSubmissionBody = validateGradeSubmissionBody;
const assignment_types_1 = require("./assignment.types");
const ASSIGNMENT_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED'];
function firstString(value) {
    if (Array.isArray(value))
        return firstString(value[0]);
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
function bodyString(body, keys) {
    for (const key of keys) {
        const value = body?.[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return undefined;
}
function nullableString(body, keys) {
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(body, key))
            continue;
        const value = body[key];
        if (value === null || value === undefined || value === '')
            return null;
        if (typeof value === 'string')
            return value.trim();
        throw new assignment_types_1.AssignmentHttpError(400, `${key} must be a string`);
    }
    return undefined;
}
function parseNumber(value, field) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(parsed)) {
        throw new assignment_types_1.AssignmentHttpError(400, `${field} must be an integer`);
    }
    return parsed;
}
function optionalNumber(body, keys) {
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(body, key))
            continue;
        const value = body[key];
        if (value === null || value === undefined || value === '')
            return null;
        return parseNumber(value, key);
    }
    return undefined;
}
function requiredDate(body, keys, field) {
    for (const key of keys) {
        const value = body?.[key];
        if (!value)
            continue;
        const date = new Date(value);
        if (!Number.isNaN(date.getTime()))
            return date;
    }
    throw new assignment_types_1.AssignmentHttpError(400, `${field} is required and must be a valid date`);
}
function optionalDate(body, keys, field) {
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(body, key))
            continue;
        const value = body[key];
        if (!value) {
            throw new assignment_types_1.AssignmentHttpError(400, `${field} must be a valid date`);
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            throw new assignment_types_1.AssignmentHttpError(400, `${field} must be a valid date`);
        }
        return date;
    }
    return undefined;
}
function normalizeAssignmentStatus(value) {
    const status = String(value || 'DRAFT').trim().toUpperCase();
    if (!ASSIGNMENT_STATUSES.includes(status)) {
        throw new assignment_types_1.AssignmentHttpError(400, `status must be one of: ${ASSIGNMENT_STATUSES.join(', ')}`);
    }
    return status;
}
function validateListAssignmentsQuery(query) {
    const page = Math.max(parseNumber(firstString(query.page) ?? '1', 'page'), 1);
    const rawLimit = Math.max(parseNumber(firstString(query.limit) ?? '10', 'limit'), 1);
    const limit = Math.min(rawLimit, 50);
    const statusValue = firstString(query.status);
    const yearValue = firstString(query.year);
    return {
        page,
        limit,
        status: statusValue ? normalizeAssignmentStatus(statusValue) : undefined,
        subject: firstString(query.subject),
        className: firstString(query.class_name) ?? firstString(query.className),
        branch: firstString(query.branch),
        year: yearValue ? parseNumber(yearValue, 'year') : undefined,
    };
}
function validateCreateAssignmentBody(body) {
    const title = bodyString(body, ['title']);
    const description = bodyString(body, ['description']);
    const subject = bodyString(body, ['subject']);
    const className = bodyString(body, ['class_name', 'className', 'class']);
    if (!title)
        throw new assignment_types_1.AssignmentHttpError(400, 'title is required');
    if (!description)
        throw new assignment_types_1.AssignmentHttpError(400, 'description is required');
    if (!subject)
        throw new assignment_types_1.AssignmentHttpError(400, 'subject is required');
    if (!className)
        throw new assignment_types_1.AssignmentHttpError(400, 'class_name is required');
    const maxMarks = optionalNumber(body, ['max_marks', 'maxMarks']) ?? 100;
    if (maxMarks <= 0) {
        throw new assignment_types_1.AssignmentHttpError(400, 'max_marks must be greater than 0');
    }
    return {
        title,
        description,
        subject,
        className,
        section: nullableString(body, ['section', 'sec']) ?? null,
        branch: nullableString(body, ['branch']) ?? null,
        year: optionalNumber(body, ['year']) ?? null,
        dueDate: requiredDate(body, ['due_date', 'dueDate'], 'due_date'),
        maxMarks,
        status: normalizeAssignmentStatus(body?.status),
        fileUrl: nullableString(body, ['file_url', 'fileUrl']) ?? null,
    };
}
function validateUpdateAssignmentBody(body) {
    const input = {};
    const title = bodyString(body, ['title']);
    if (title !== undefined)
        input.title = title;
    const description = bodyString(body, ['description']);
    if (description !== undefined)
        input.description = description;
    const subject = bodyString(body, ['subject']);
    if (subject !== undefined)
        input.subject = subject;
    const className = bodyString(body, ['class_name', 'className', 'class']);
    if (className !== undefined)
        input.className = className;
    const section = nullableString(body, ['section', 'sec']);
    if (section !== undefined)
        input.section = section;
    const branch = nullableString(body, ['branch']);
    if (branch !== undefined)
        input.branch = branch;
    const year = optionalNumber(body, ['year']);
    if (year !== undefined)
        input.year = year;
    const dueDate = optionalDate(body, ['due_date', 'dueDate'], 'due_date');
    if (dueDate !== undefined)
        input.dueDate = dueDate;
    const maxMarks = optionalNumber(body, ['max_marks', 'maxMarks']);
    if (maxMarks !== undefined) {
        if (maxMarks === null || maxMarks <= 0) {
            throw new assignment_types_1.AssignmentHttpError(400, 'max_marks must be greater than 0');
        }
        input.maxMarks = maxMarks;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
        input.status = normalizeAssignmentStatus(body.status);
    }
    const fileUrl = nullableString(body, ['file_url', 'fileUrl']);
    if (fileUrl !== undefined)
        input.fileUrl = fileUrl;
    if (Object.keys(input).length === 0) {
        throw new assignment_types_1.AssignmentHttpError(400, 'At least one field is required');
    }
    return input;
}
function validateSubmitAssignmentBody(body) {
    const answerText = nullableString(body, ['answer_text', 'answerText']) ?? null;
    const fileUrl = nullableString(body, ['file_url', 'fileUrl']) ?? null;
    if (!answerText && !fileUrl) {
        throw new assignment_types_1.AssignmentHttpError(400, 'answer_text or file_url is required');
    }
    return { answerText, fileUrl };
}
function validateGradeSubmissionBody(body) {
    if (!Object.prototype.hasOwnProperty.call(body, 'marks_obtained') &&
        !Object.prototype.hasOwnProperty.call(body, 'marksObtained')) {
        throw new assignment_types_1.AssignmentHttpError(400, 'marks_obtained is required');
    }
    const marksObtained = optionalNumber(body, ['marks_obtained', 'marksObtained']);
    if (marksObtained === null || marksObtained === undefined || marksObtained < 0) {
        throw new assignment_types_1.AssignmentHttpError(400, 'marks_obtained must be 0 or greater');
    }
    return {
        marksObtained,
        feedback: nullableString(body, ['feedback']) ?? null,
    };
}
