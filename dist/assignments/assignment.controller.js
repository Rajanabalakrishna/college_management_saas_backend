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
exports.listAssignments = listAssignments;
exports.getAssignment = getAssignment;
exports.createAssignment = createAssignment;
exports.updateAssignment = updateAssignment;
exports.submitAssignment = submitAssignment;
exports.getMySubmission = getMySubmission;
exports.listSubmissions = listSubmissions;
exports.gradeSubmission = gradeSubmission;
const assignment_types_1 = require("./assignment.types");
const assignment_validation_1 = require("./assignment.validation");
const AssignmentService = __importStar(require("./assignment.service"));
function getAuthUser(req) {
    if (!req.user) {
        throw new assignment_types_1.AssignmentHttpError(401, 'Authentication required');
    }
    return req.user;
}
function getRouteParam(req, name) {
    const value = req.params[name];
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new assignment_types_1.AssignmentHttpError(400, `${name} route parameter is required`);
    }
    return value;
}
function handleError(error, res) {
    if (error instanceof assignment_types_1.AssignmentHttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
    }
    console.error('Assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
}
async function listAssignments(req, res) {
    try {
        const authUser = getAuthUser(req);
        const query = (0, assignment_validation_1.validateListAssignmentsQuery)(req.query);
        const result = await AssignmentService.listAssignments(authUser, query);
        res.status(200).json({ data: result });
    }
    catch (error) {
        handleError(error, res);
    }
}
async function getAssignment(req, res) {
    try {
        const authUser = getAuthUser(req);
        const assignment = await AssignmentService.getAssignment(authUser, getRouteParam(req, 'id'));
        res.status(200).json({ data: assignment });
    }
    catch (error) {
        handleError(error, res);
    }
}
async function createAssignment(req, res) {
    try {
        const authUser = getAuthUser(req);
        const input = (0, assignment_validation_1.validateCreateAssignmentBody)(req.body);
        const assignment = await AssignmentService.createAssignment(authUser, input);
        res.status(201).json({
            message: 'Assignment created successfully',
            data: assignment,
        });
    }
    catch (error) {
        handleError(error, res);
    }
}
async function updateAssignment(req, res) {
    try {
        const authUser = getAuthUser(req);
        const input = (0, assignment_validation_1.validateUpdateAssignmentBody)(req.body);
        const assignment = await AssignmentService.updateAssignment(authUser, getRouteParam(req, 'id'), input);
        res.status(200).json({
            message: 'Assignment updated successfully',
            data: assignment,
        });
    }
    catch (error) {
        handleError(error, res);
    }
}
async function submitAssignment(req, res) {
    try {
        const authUser = getAuthUser(req);
        const input = (0, assignment_validation_1.validateSubmitAssignmentBody)(req.body);
        const submission = await AssignmentService.submitAssignment(authUser, getRouteParam(req, 'id'), input);
        res.status(200).json({
            message: 'Assignment submitted successfully',
            data: submission,
        });
    }
    catch (error) {
        handleError(error, res);
    }
}
async function getMySubmission(req, res) {
    try {
        const authUser = getAuthUser(req);
        const submission = await AssignmentService.getMySubmission(authUser, getRouteParam(req, 'id'));
        res.status(200).json({ data: submission });
    }
    catch (error) {
        handleError(error, res);
    }
}
async function listSubmissions(req, res) {
    try {
        const authUser = getAuthUser(req);
        const submissions = await AssignmentService.listSubmissions(authUser, getRouteParam(req, 'id'));
        res.status(200).json({
            data: {
                items: submissions,
                total: submissions.length,
            },
        });
    }
    catch (error) {
        handleError(error, res);
    }
}
async function gradeSubmission(req, res) {
    try {
        const authUser = getAuthUser(req);
        const input = (0, assignment_validation_1.validateGradeSubmissionBody)(req.body);
        const submission = await AssignmentService.gradeSubmission(authUser, getRouteParam(req, 'id'), getRouteParam(req, 'submissionId'), input);
        res.status(200).json({
            message: 'Submission graded successfully',
            data: submission,
        });
    }
    catch (error) {
        handleError(error, res);
    }
}
