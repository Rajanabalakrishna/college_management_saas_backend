import { Response } from 'express';
import { AuthRequest } from '../types';
import * as ResultService from './result.service';
import { BulkSaveResultInput, ResultQuery, SaveResultInput } from './result.types';

type HttpError = Error & { statusCode?: number };

function queryString(query: AuthRequest['query'], key: string): string | undefined {
  const value = query[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function queryNumber(query: AuthRequest['query'], key: string): number | undefined {
  const value = queryString(query, key);
  if (!value) return undefined;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function queryFromRequest(req: AuthRequest): ResultQuery {
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

function sendError(res: Response, error: unknown, fallback: string): void {
  const err = error as HttpError;
  console.error('Result error:', err.message ?? error);
  res.status(err.statusCode ?? 500).json({
    error: err.message || fallback,
  });
}

export async function listResults(req: AuthRequest, res: Response): Promise<void> {
  try {
    const authUser = req.user!;
    const data = await ResultService.listResults(
      authUser.collegeId,
      authUser.userId,
      authUser.role,
      queryFromRequest(req)
    );

    res.status(200).json({ data });
  } catch (error) {
    sendError(res, error, 'Unable to load results');
  }
}

export async function myResults(req: AuthRequest, res: Response): Promise<void> {
  try {
    const authUser = req.user!;
    const query = queryFromRequest(req);
    query.studentId = authUser.userId;

    const data = await ResultService.listResults(
      authUser.collegeId,
      authUser.userId,
      authUser.role,
      query
    );

    res.status(200).json({ data });
  } catch (error) {
    sendError(res, error, 'Unable to load results');
  }
}

export async function saveResult(req: AuthRequest, res: Response): Promise<void> {
  try {
    const authUser = req.user!;
    const result = await ResultService.saveResult(
      authUser.collegeId,
      authUser.userId,
      req.body as SaveResultInput
    );

    res.status(201).json({
      message: 'Result saved successfully',
      data: result,
    });
  } catch (error) {
    sendError(res, error, 'Unable to save result');
  }
}

export async function saveBulkResults(req: AuthRequest, res: Response): Promise<void> {
  try {
    const authUser = req.user!;
    const body = req.body as BulkSaveResultInput;

    const data = await ResultService.saveBulkResults(
      authUser.collegeId,
      authUser.userId,
      body.results
    );

    res.status(201).json({
      message: 'Results saved successfully',
      data,
    });
  } catch (error) {
    sendError(res, error, 'Unable to save results');
  }
}