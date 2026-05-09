import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface JwtPayload {
  userId: string;
  collegeId: string;
  role: string;
  email: string;
}

export interface User {
  id: string;
  college_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: Date;
}