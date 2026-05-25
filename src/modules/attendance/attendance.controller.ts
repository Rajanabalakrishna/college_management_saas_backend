import { Response } from 'express';
import { AuthRequest } from '../../types';
import * as AttendanceService from './attendance.service';
import { AttendanceFilters, SaveAttendanceInput } from './attendance.types';

type HttpError = Error & { statusCode?: number };

function filtersFromQuery(query: AuthRequest['query']): AttendanceFilters {
  const yearValue = query.year ? Number(query.year) : undefined;

  return {
    className: typeof query.class_name === 'string' ? query.class_name : undefined,
    sec: typeof query.sec === 'string' ? query.sec : undefined,
    branch: typeof query.branch === 'string' ? query.branch : undefined,
    year: Number.isFinite(yearValue) ? yearValue : undefined,
  };
}

function sendError(res: Response, error: unknown, fallback: string) {
  const err = error as HttpError;
  res.status(err.statusCode ?? 500).json({
    error: err.message || fallback,
  });
}

export async function listStudents(req: AuthRequest, res: Response): Promise<void> {
  try {
    const collegeId = req.user!.collegeId;
    const students = await AttendanceService.listStudents(collegeId, filtersFromQuery(req.query));
    res.json({ data: students.map((student) => ({ ...student, class: student.class_name })) });
  } catch (error) {
    sendError(res, error, 'Unable to load students');
  }
}

export async function getAttendance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const collegeId = req.user!.collegeId;
    const date = typeof req.query.date === 'string'
      ? req.query.date
      : AttendanceService.todayYmdInIndia();

    const data = await AttendanceService.getAttendanceByDate(
      collegeId,
      date,
      filtersFromQuery(req.query)
    );

    res.json({ data });
  } catch (error) {
    sendError(res, error, 'Unable to load attendance');
  }
}

export async function saveAttendance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const collegeId = req.user!.collegeId;
    const markerUserId = req.user!.userId;
    const body = req.body as SaveAttendanceInput;

    const data = await AttendanceService.saveTodayAttendance(
      collegeId,
      markerUserId,
      body.date,
      body.records
    );

    res.json({ message: 'Attendance saved', data });
  } catch (error) {
    sendError(res, error, 'Unable to save attendance');
  }
}