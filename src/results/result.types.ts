export type ResultStatus = 'PASS' | 'FAIL' | 'WITHHELD';

export interface ResultQuery {
  page: number;
  limit: number;
  studentId?: string;
  subject?: string;
  examType?: string;
  semester?: number;
  academicYear?: string;
}

export interface SaveResultInput {
  id?: string;
  student_id: string;
  subject: string;
  exam_type: string;
  semester?: number | null;
  academic_year: string;
  max_marks?: number;
  marks_obtained: number;
  grade?: string | null;
  result_status?: ResultStatus;
  remarks?: string | null;
  published?: boolean;
}

export interface BulkSaveResultInput {
  results: SaveResultInput[];
}