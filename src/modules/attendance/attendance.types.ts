

export type AttendanceStatus = 'PRESENT' | 'ABSENT';

export interface AttendanceFilters {
  className?: string;
  sec?: string;
  branch?: string;
  year?: number;
}

export interface SaveAttendanceRecordInput {
  student_id: string;
  status: AttendanceStatus;
}

export interface SaveAttendanceInput {
  date: string;
  records: SaveAttendanceRecordInput[];
}