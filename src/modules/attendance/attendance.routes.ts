import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { getAttendance, listStudents, saveAttendance } from './attendance.controller';

const router = Router();

router.use(authenticate);

router.get('/students', listStudents);
router.get('/', getAttendance);
router.post('/', saveAttendance);

export default router;