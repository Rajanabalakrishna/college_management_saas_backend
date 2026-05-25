import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface JwtPayload {
  userId: string;
  collegeId: string;
  role: string;
  email: string;
  jti?: string;
}

export interface User {
  id:            string;
  college_id:    string;
  email:         string;
  full_name:     string;
  role:          string;
  is_active:     boolean;
  created_at:    Date;
  // student-specific (nullable)
  roll_no?:       string | null;
  class_name?:    string | null;
  sec?:           string | null;
  starting_year?: number | null;
  ending_year?:   number | null;
  branch?:        string | null;
  year?:          number | null;
}