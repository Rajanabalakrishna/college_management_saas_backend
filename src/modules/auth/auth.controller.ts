import { Request, Response } from 'express';
import * as AuthService from './auth.service';

// ── POST /api/v1/auth/register ────────────────────────────
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const {
      email,
      password,
      full_name,
      image_url,
      role,
      college_domain,
      roll_no,
      class_name,
      sec,
      starting_year,
      ending_year,
      branch,
      year,
    } = req.body;

    if (!email || !password || !full_name || !college_domain) {
      res.status(400).json({ error: 'email, password, full_name and college_domain are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const college = await AuthService.findCollegeByDomain(college_domain);
    if (!college) {
      res.status(404).json({ error: 'College not found' });
      return;
    }

    const existing = await AuthService.findUserByEmail(email, college.id);
    if (existing) {
      res.status(409).json({ error: 'Email already registered in this college' });
      return;
    }

    const user = await AuthService.registerUser({
      collegeId:    college.id,
      email,
      password,
      fullName:     full_name,
      imageUrl: image_url ?? null,
      role:         role || 'student',
      rollNo:       roll_no       ?? null,
      className:    class_name    ?? null,
      sec:          sec           ?? null,
      startingYear: starting_year ?? null,
      endingYear:   ending_year   ?? null,
      branch:       branch        ?? null,
      year:         year          ?? null,
    });

    res.status(201).json({
      message: 'Registration successful',
      data: {
        id:            user.id,
        email:         user.email,
        full_name:     user.full_name,
        role:          user.role,
        image_url: user.image_url ?? null,
        college_id:    user.college_id,
        is_active:     user.is_active,
        created_at:    user.created_at,
        roll_no:       user.roll_no,
        class:         user.class_name,
        sec:           user.sec,
        starting_year: user.starting_year,
        ending_year:   user.ending_year,
        branch:        user.branch,
        year:          user.year,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── POST /api/v1/auth/login ───────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, college_domain } = req.body;

    if (!email || !password || !college_domain) {
      res.status(400).json({ error: 'Email, password and college_domain are required' });
      return;
    }

    const college = await AuthService.findCollegeByDomain(college_domain);
    if (!college) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = await AuthService.findUserByEmail(email, college.id);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValid = await AuthService.verifyPassword(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const jwtPayload = {
      userId:    user.id,
      collegeId: user.college_id,
      role:      user.role,
      email:     user.email,
    };

    const accessToken  = AuthService.createAccessToken(jwtPayload);
    const refreshToken = AuthService.createRefreshToken(jwtPayload);

    await AuthService.saveRefreshToken(user.id, user.college_id, refreshToken);

    res.status(200).json({
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id:            user.id,
          email:         user.email,
          full_name:     user.full_name,
          role:          user.role,
          college_id:    user.college_id,
          is_active:     user.is_active,
          created_at:    user.created_at,
          roll_no:       user.roll_no       ?? null,
          class:         user.class_name    ?? null,
          sec:           user.sec           ?? null,
          starting_year: user.starting_year ?? null,
          ending_year:   user.ending_year   ?? null,
          branch:        user.branch        ?? null,
          year:          user.year          ?? null,
        },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── POST /api/v1/auth/refresh ─────────────────────────────
export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    let payload;
    try {
      payload = AuthService.verifyRefreshToken(refresh_token);
    } catch {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const isValid = await AuthService.isRefreshTokenValid(refresh_token);
    if (!isValid) {
      res.status(401).json({ error: 'Refresh token has been revoked' });
      return;
    }

    await AuthService.revokeRefreshToken(refresh_token);

    const jwtPayload = {
      userId:    payload.userId,
      collegeId: payload.collegeId,
      role:      payload.role,
      email:     payload.email,
    };

    const newAccessToken  = AuthService.createAccessToken(jwtPayload);
    const newRefreshToken = AuthService.createRefreshToken(jwtPayload);

    await AuthService.saveRefreshToken(payload.userId, payload.collegeId, newRefreshToken);

    res.status(200).json({
      data: {
        accessToken:  newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── POST /api/v1/auth/logout ──────────────────────────────
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    await AuthService.revokeRefreshToken(refresh_token);

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}