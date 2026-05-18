import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  addMember,
  getProjectMembers,
  updateMemberRole,
  removeMember
} from '../controllers/projectController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getProjects);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
router.post('/:projectId/members', addMember);
router.get('/:projectId/members', getProjectMembers);
router.put('/:projectId/members/:userId', updateMemberRole);
router.delete('/:projectId/members/:userId', removeMember);

export default router;