import { query } from '../config/database.js';

export const getProjects = async (req, res) => {
  try {
    const result = await query(
      `SELECT p.* FROM projects p
       JOIN project_members pm ON p.id = pm.project_id
       WHERE pm.user_id = $1 OR p.owner_id = $1`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createProject = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const result = await query(
      'INSERT INTO projects (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description, req.user.id]
    );
    
    const project = result.rows[0];
    
    await query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [project.id, req.user.id, 'owner']
    );
    
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    const result = await query(
      'UPDATE projects SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND owner_id = $4 RETURNING *',
      [name, description, id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found or no permission' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM projects WHERE id = $1 AND owner_id = $2 RETURNING id',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found or no permission' });
    }
    
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addMember = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId, role } = req.body;
    
    const ownerCheck = await query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );
    
    if (ownerCheck.rows[0]?.role !== 'owner') {
      return res.status(403).json({ error: 'Only owner can add members' });
    }
    
    await query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3',
      [projectId, userId, role]
    );
    
    res.json({ message: 'Member added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProjectMembers = async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await query(
      `SELECT u.id, u.username, u.email, pm.role 
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1`,
      [projectId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateMemberRole = async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const { role } = req.body;
    
    const ownerCheck = await query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );
    
    if (ownerCheck.rows[0]?.role !== 'owner') {
      return res.status(403).json({ error: 'Only owner can change roles' });
    }
    
    await query(
      'UPDATE project_members SET role = $1 WHERE project_id = $2 AND user_id = $3',
      [role, projectId, userId]
    );
    
    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const removeMember = async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    
    const ownerCheck = await query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );
    
    if (ownerCheck.rows[0]?.role !== 'owner') {
      return res.status(403).json({ error: 'Only owner can remove members' });
    }
    
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Owner cannot remove themselves' });
    }
    
    await query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );
    
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};