
export interface College
{
    id: string;
    name: string;
    domain: string;
    plan: string;
    is_active: boolean;
}

export interface User
{
    id: string;
    college_id: string;
    email: string;
    password_hash:string;
    role: 'admin' | 'teacher' | 'student';
    is_active:boolean;
}

export interface JwtPayLoad
{
   userId: string;
  collegeId: string;
  role: string;
  email: string; 
}

declare global
{
    namespace express
    {
        interface Request
        {
            user?: JwtPayLoad;
        }
    }
}



