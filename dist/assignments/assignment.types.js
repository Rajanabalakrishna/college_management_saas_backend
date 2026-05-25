"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignmentHttpError = void 0;
class AssignmentHttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'AssignmentHttpError';
    }
}
exports.AssignmentHttpError = AssignmentHttpError;
