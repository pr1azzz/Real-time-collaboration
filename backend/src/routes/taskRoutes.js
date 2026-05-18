import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
  undoTask,
  getTaskHistory
} from '../controllers/taskController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.patch('/:id/move', moveTask);
router.post('/:id/undo', undoTask);
router.get('/:id/history', getTaskHistory);

export default router;