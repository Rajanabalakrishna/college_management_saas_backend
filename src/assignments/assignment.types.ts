import { Request } from 'express';
import { JwtPayload } from '../types';

export type AssignmentStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type SubmissionStatus = 'SUBMITTED' | 'GRADED';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
export type AuthenticatedUser = JwtPayload;

export class AssignmentHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AssignmentHttpError';
  }
}

export interface AssignmentQuery {
  page: number;
  limit: number;
  status?: AssignmentStatus;
  subject?: string;
  className?: string;
  branch?: string;
  year?: number;
}

export interface CreateAssignmentInput {
  title: string;
  description: string;
  subject: string;
  className: string;
  section?: string | null;
  branch?: string | null;
  year?: number | null;
  dueDate: Date;
  maxMarks: number;
  status: AssignmentStatus;
  fileUrl?: string | null;
}

export interface UpdateAssignmentInput {
  title?: string;
  description?: string;
  subject?: string;
  className?: string;
  section?: string | null;
  branch?: string | null;
  year?: number | null;
  dueDate?: Date;
  maxMarks?: number;
  status?: AssignmentStatus;
  fileUrl?: string | null;
}

export interface SubmitAssignmentInput {
  answerText?: string | null;
  fileUrl?: string | null;
}

export interface GradeSubmissionInput {
  marksObtained: number;
  feedback?: string | null;
}

export interface AssignmentResponse {
  id: string;
  college_id: string;
  title: string;
  description: string;
  subject: string;
  class_name: string;
  section: string | null;
  branch: string | null;
  year: number | null;
  due_date: Date;
  max_marks: number;
  status: AssignmentStatus;
  file_url: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  _count?: {
    submissions: number;
  };
  my_submission?: AssignmentSubmissionResponse | null;
}

export interface AssignmentSubmissionResponse {
  id: string;
  assignment_id: string;
  student_id: string;
  college_id: string;
  answer_text: string | null;
  file_url: string | null;
  marks_obtained: number | null;
  feedback: string | null;
  status: SubmissionStatus;
  submitted_at: Date;
  graded_at: Date | null;
  graded_by: string | null;
  student?: {
    id: string;
    full_name: string;
    email: string;
    roll_no: string | null;
  };
}

export interface AssignmentListResponse {
  items: AssignmentResponse[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}