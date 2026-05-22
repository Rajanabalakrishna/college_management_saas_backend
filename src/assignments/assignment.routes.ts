import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  createAssignment,
  getAssignment,
  getMySubmission,
  gradeSubmission,
  listAssignments,
  listSubmissions,
  submitAssignment,
  updateAssignment,
} from './assignment.controller';

const router = Router();

router.use(authenticate);

router.get('/', listAssignments);
router.post('/', createAssignment);

router.get('/:id', getAssignment);
router.patch('/:id', updateAssignment);

router.post('/:id/submit', submitAssignment);
router.get('/:id/my-submission', getMySubmission);

router.get('/:id/submissions', listSubmissions);
router.patch('/:id/submissions/:submissionId/grade', gradeSubmission);

export default router;