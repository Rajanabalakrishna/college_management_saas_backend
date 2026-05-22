import prisma from '../config/prisma';
import {
  AssignmentHttpError,
  AssignmentListResponse,
  AssignmentQuery,
  AssignmentResponse,
  AssignmentSubmissionResponse,
  AuthenticatedUser,
  CreateAssignmentInput,
  GradeSubmissionInput,
  SubmitAssignmentInput,
  UpdateAssignmentInput,
} from './assignment.types';

type CurrentUser = {
  id: string;
  college_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  class_name: string | null;
  sec: string | null;
  branch: string | null;
  year: number | null;
};

const assignmentInclude = {
  _count: {
    select: {
      submissions: true,
    },
  },
};

function normalizedRole(role: string): string {
  return role.trim().toLowerCase();
}

function isAssignmentManager(role: string): boolean {
  return ['admin', 'faculty', 'teacher'].includes(normalizedRole(role));
}

function isAdmin(role: string): boolean {
  return normalizedRole(role) === 'admin';
}

function isStudent(role: string): boolean {
  return normalizedRole(role) === 'student';
}

async function getCurrentUser(auth: AuthenticatedUser): Promise<CurrentUser> {
  const user = await prisma.user.findFirst({
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
    throw new AssignmentHttpError(401, 'Invalid user session');
  }

  return user;
}

function applyStudentAssignmentScope(where: any, user: CurrentUser): void {
  where.status = 'PUBLISHED';

  const and: any[] = where.AND ?? [];

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

function assignmentMatchesStudent(assignment: any, user: CurrentUser): boolean {
  if (assignment.status !== 'PUBLISHED') return false;

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

function toAssignmentResponse(
  assignment: any,
  mySubmission?: any | null
): AssignmentResponse {
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

function toSubmissionResponse(submission: any): AssignmentSubmissionResponse {
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

async function getManagedAssignment(user: CurrentUser, assignmentId: string) {
  if (!isAssignmentManager(user.role)) {
    throw new AssignmentHttpError(403, 'Only faculty or admin can manage assignments');
  }

  const where: any = {
    id: assignmentId,
    college_id: user.college_id,
  };

  if (!isAdmin(user.role)) {
    where.created_by = user.id;
  }

  const assignment = await prisma.assignment.findFirst({ where });

  if (!assignment) {
    throw new AssignmentHttpError(404, 'Assignment not found');
  }

  return assignment;
}

export async function listAssignments(
  auth: AuthenticatedUser,
  query: AssignmentQuery
): Promise<AssignmentListResponse> {
  const user = await getCurrentUser(auth);

  const where: any = {
    college_id: auth.collegeId,
  };

  if (query.status) where.status = query.status;
  if (query.subject) where.subject = { contains: query.subject, mode: 'insensitive' };
  if (query.className) where.class_name = query.className;
  if (query.branch) where.branch = query.branch;
  if (query.year !== undefined) where.year = query.year;

  if (!isAssignmentManager(user.role)) {
    applyStudentAssignmentScope(where, user);
  } else if (!isAdmin(user.role)) {
    where.created_by = user.id;
  }

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.assignment.findMany({
      where,
      include: assignmentInclude,
      orderBy: [{ due_date: 'asc' }, { created_at: 'desc' }],
      skip,
      take: query.limit,
    }),
    prisma.assignment.count({ where }),
  ]);

  return {
    items: items.map((item) => toAssignmentResponse(item)),
    page: query.page,
    limit: query.limit,
    total,
    total_pages: Math.max(Math.ceil(total / query.limit), 1),
  };
}

export async function getAssignment(
  auth: AuthenticatedUser,
  assignmentId: string
): Promise<AssignmentResponse> {
  const user = await getCurrentUser(auth);

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      college_id: auth.collegeId,
    },
    include: assignmentInclude,
  });

  if (!assignment) {
    throw new AssignmentHttpError(404, 'Assignment not found');
  }

  if (isAssignmentManager(user.role)) {
    if (!isAdmin(user.role) && assignment.created_by !== user.id) {
      throw new AssignmentHttpError(403, 'You can access only your assignments');
    }

    return toAssignmentResponse(assignment);
  }

  if (!assignmentMatchesStudent(assignment, user)) {
    throw new AssignmentHttpError(404, 'Assignment not found');
  }

  const mySubmission = await prisma.assignmentSubmission.findFirst({
    where: {
      assignment_id: assignment.id,
      student_id: user.id,
      college_id: user.college_id,
    },
  });

  return toAssignmentResponse(assignment, mySubmission);
}

export async function createAssignment(
  auth: AuthenticatedUser,
  input: CreateAssignmentInput
): Promise<AssignmentResponse> {
  const user = await getCurrentUser(auth);

  if (!isAssignmentManager(user.role)) {
    throw new AssignmentHttpError(403, 'Only faculty or admin can create assignments');
  }

  const assignment = await prisma.assignment.create({
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

  return toAssignmentResponse(assignment);
}

export async function updateAssignment(
  auth: AuthenticatedUser,
  assignmentId: string,
  input: UpdateAssignmentInput
): Promise<AssignmentResponse> {
  const user = await getCurrentUser(auth);
  await getManagedAssignment(user, assignmentId);

  const data: any = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.subject !== undefined) data.subject = input.subject;
  if (input.className !== undefined) data.class_name = input.className;
  if (input.section !== undefined) data.section = input.section;
  if (input.branch !== undefined) data.branch = input.branch;
  if (input.year !== undefined) data.year = input.year;
  if (input.dueDate !== undefined) data.due_date = input.dueDate;
  if (input.maxMarks !== undefined) data.max_marks = input.maxMarks;
  if (input.status !== undefined) data.status = input.status;
  if (input.fileUrl !== undefined) data.file_url = input.fileUrl;

  const assignment = await prisma.assignment.update({
    where: { id: assignmentId },
    data,
    include: assignmentInclude,
  });

  return toAssignmentResponse(assignment);
}

export async function submitAssignment(
  auth: AuthenticatedUser,
  assignmentId: string,
  input: SubmitAssignmentInput
): Promise<AssignmentSubmissionResponse> {
  const user = await getCurrentUser(auth);

  if (!isStudent(user.role)) {
    throw new AssignmentHttpError(403, 'Only students can submit assignments');
  }

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      college_id: user.college_id,
    },
  });

  if (!assignment || !assignmentMatchesStudent(assignment, user)) {
    throw new AssignmentHttpError(404, 'Assignment not found');
  }

  if (assignment.status !== 'PUBLISHED') {
    throw new AssignmentHttpError(400, 'Assignment is not open for submissions');
  }

  if (new Date() > assignment.due_date) {
    throw new AssignmentHttpError(400, 'Assignment due date has passed');
  }

  const existing = await prisma.assignmentSubmission.findFirst({
    where: {
      assignment_id: assignment.id,
      student_id: user.id,
      college_id: user.college_id,
    },
  });

  if (existing?.status === 'GRADED') {
    throw new AssignmentHttpError(409, 'Graded submission cannot be changed');
  }

  const submission = existing
    ? await prisma.assignmentSubmission.update({
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
    : await prisma.assignmentSubmission.create({
        data: {
          assignment_id: assignment.id,
          student_id: user.id,
          college_id: user.college_id,
          answer_text: input.answerText ?? null,
          file_url: input.fileUrl ?? null,
        },
      });

  return toSubmissionResponse(submission);
}

export async function getMySubmission(
  auth: AuthenticatedUser,
  assignmentId: string
): Promise<AssignmentSubmissionResponse | null> {
  const user = await getCurrentUser(auth);

  const submission = await prisma.assignmentSubmission.findFirst({
    where: {
      assignment_id: assignmentId,
      student_id: user.id,
      college_id: user.college_id,
    },
  });

  return submission ? toSubmissionResponse(submission) : null;
}

export async function listSubmissions(
  auth: AuthenticatedUser,
  assignmentId: string
): Promise<AssignmentSubmissionResponse[]> {
  const user = await getCurrentUser(auth);
  await getManagedAssignment(user, assignmentId);

  const submissions = await prisma.assignmentSubmission.findMany({
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

export async function gradeSubmission(
  auth: AuthenticatedUser,
  assignmentId: string,
  submissionId: string,
  input: GradeSubmissionInput
): Promise<AssignmentSubmissionResponse> {
  const user = await getCurrentUser(auth);
  const assignment = await getManagedAssignment(user, assignmentId);

  if (input.marksObtained > assignment.max_marks) {
    throw new AssignmentHttpError(
      400,
      `marks_obtained cannot be greater than max_marks (${assignment.max_marks})`
    );
  }

  const existing = await prisma.assignmentSubmission.findFirst({
    where: {
      id: submissionId,
      assignment_id: assignmentId,
      college_id: user.college_id,
    },
  });

  if (!existing) {
    throw new AssignmentHttpError(404, 'Submission not found');
  }

  const submission = await prisma.assignmentSubmission.update({
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