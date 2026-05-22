import { Response } from 'express';
import {
  AssignmentHttpError,
  AuthenticatedRequest,
} from './assignment.types';
import {
  validateCreateAssignmentBody,
  validateGradeSubmissionBody,
  validateListAssignmentsQuery,
  validateSubmitAssignmentBody,
  validateUpdateAssignmentBody,
} from './assignment.validation';
import * as AssignmentService from './assignment.service';

function getAuthUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new AssignmentHttpError(401, 'Authentication required');
  }

  return req.user;
}

function handleError(error: unknown, res: Response): void {
  if (error instanceof AssignmentHttpError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  console.error('Assignment error:', error);
  res.status(500).json({ error: 'Internal server error' });
}

export async function listAssignments(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const authUser = getAuthUser(req);
    const query = validateListAssignmentsQuery(req.query);

    const result = await AssignmentService.listAssignments(authUser, query);

    res.status(200).json({ data: result });
  } catch (error) {
    handleError(error, res);
  }
}

export async function getAssignment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const authUser = getAuthUser(req);

    const assignment = await AssignmentService.getAssignment(
      authUser,
      req.params.id
    );

    res.status(200).json({ data: assignment });
  } catch (error) {
    handleError(error, res);
  }
}

export async function createAssignment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const authUser = getAuthUser(req);
    const input = validateCreateAssignmentBody(req.body);

    const assignment = await AssignmentService.createAssignment(
      authUser,
      input
    );

    res.status(201).json({
      message: 'Assignment created successfully',
      data: assignment,
    });
  } catch (error) {
    handleError(error, res);
  }
}

export async function updateAssignment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const authUser = getAuthUser(req);
    const input = validateUpdateAssignmentBody(req.body);

    const assignment = await AssignmentService.updateAssignment(
      authUser,
      req.params.id,
      input
    );

    res.status(200).json({
      message: 'Assignment updated successfully',
      data: assignment,
    });
  } catch (error) {
    handleError(error, res);
  }
}

export async function submitAssignment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const authUser = getAuthUser(req);
    const input = validateSubmitAssignmentBody(req.body);

    const submission = await AssignmentService.submitAssignment(
      authUser,
      req.params.id,
      input
    );

    res.status(200).json({
      message: 'Assignment submitted successfully',
      data: submission,
    });
  } catch (error) {
    handleError(error, res);
  }
}

export async function getMySubmission(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const authUser = getAuthUser(req);

    const submission = await AssignmentService.getMySubmission(
      authUser,
      req.params.id
    );

    res.status(200).json({ data: submission });
  } catch (error) {
    handleError(error, res);
  }
}

export async function listSubmissions(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const authUser = getAuthUser(req);

    const submissions = await AssignmentService.listSubmissions(
      authUser,
      req.params.id
    );

    res.status(200).json({
      data: {
        items: submissions,
        total: submissions.length,
      },
    });
  } catch (error) {
    handleError(error, res);
  }
}

export async function gradeSubmission(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const authUser = getAuthUser(req);
    const input = validateGradeSubmissionBody(req.body);

    const submission = await AssignmentService.gradeSubmission(
      authUser,
      req.params.id,
      req.params.submissionId,
      input
    );

    res.status(200).json({
      message: 'Submission graded successfully',
      data: submission,
    });
  } catch (error) {
    handleError(error, res);
  }
}