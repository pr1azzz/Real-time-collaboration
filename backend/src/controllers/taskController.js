import { query } from '../config/database.js';

export const getTasks = async (req, res) => {
  try {
    const { projectId } = req.query;
    
    const result = await query(
      'SELECT * FROM tasks WHERE project_id = $1 ORDER BY status, position',
      [projectId]
    );
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createTask = async (req, res) => {
  try {
    const { title, description, projectId, assigneeId } = req.body;
    
    // Get max position for status
    const positionResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM tasks WHERE project_id = $1 AND status = $2',
      [projectId, 'new']
    );
    
    const result = await query(
      `INSERT INTO tasks (title, description, project_id, assignee_id, created_by, position, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'new') RETURNING *`,
      [title, description, projectId, assigneeId, req.user.id, positionResult.rows[0].next_pos]
    );
    
    // Save to history
    await query(
      'INSERT INTO task_history (task_id, user_id, command_type, snapshot) VALUES ($1, $2, $3, $4)',
      [result.rows[0].id, req.user.id, 'CREATE', JSON.stringify(result.rows[0])]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, assigneeId } = req.body;
    
    // Get old version for conflict detection
    const oldTask = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    
    if (oldTask.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const result = await query(
      `UPDATE tasks SET title = $1, description = $2, assignee_id = $3, updated_at = CURRENT_TIMESTAMP, version = version + 1
       WHERE id = $4 RETURNING *`,
      [title, description, assigneeId, id]
    );
    
    // Save to history for undo
    await query(
      'INSERT INTO task_history (task_id, user_id, command_type, snapshot) VALUES ($1, $2, $3, $4)',
      [id, req.user.id, 'UPDATE', JSON.stringify(oldTask.rows[0])]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    
    const task = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    
    if (task.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Save to history for undo
    await query(
      'INSERT INTO task_history (task_id, user_id, command_type, snapshot) VALUES ($1, $2, $3, $4)',
      [id, req.user.id, 'DELETE', JSON.stringify(task.rows[0])]
    );
    
    await query('DELETE FROM tasks WHERE id = $1', [id]);
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const moveTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus, newPosition } = req.body;
    
    const oldTask = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    
    if (oldTask.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const result = await query(
      'UPDATE tasks SET status = $1, position = $2, updated_at = CURRENT_TIMESTAMP, version = version + 1 WHERE id = $3 RETURNING *',
      [newStatus, newPosition, id]
    );
    
    await query(
      'INSERT INTO task_history (task_id, user_id, command_type, snapshot) VALUES ($1, $2, $3, $4)',
      [id, req.user.id, 'MOVE', JSON.stringify(oldTask.rows[0])]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const undoTask = async (req, res) => {
  try {
    const { id } = req.params;
    
    const history = await query(
      'SELECT * FROM task_history WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    );
    
    if (history.rows.length === 0) {
      return res.status(404).json({ error: 'No history to undo' });
    }
    
    const lastState = history.rows[0].snapshot;
    
    if (history.rows[0].command_type === 'DELETE') {
      const result = await query(
        `INSERT INTO tasks (id, title, description, status, position, project_id, assignee_id, created_by, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [lastState.id, lastState.title, lastState.description, lastState.status,
         lastState.position, lastState.project_id, lastState.assignee_id,
         lastState.created_by, lastState.version + 1]
      );
      res.json(result.rows[0]);
    } else {
      const result = await query(
        `UPDATE tasks SET title = $1, description = $2, status = $3, position = $4,
         assignee_id = $5, version = version + 1 WHERE id = $6 RETURNING *`,
        [lastState.title, lastState.description, lastState.status,
         lastState.position, lastState.assignee_id, id]
      );
      res.json(result.rows[0]);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTaskHistory = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Getting history for task:', id);
    
    const result = await query(
      'SELECT * FROM task_history WHERE task_id = $1 ORDER BY created_at DESC',
      [id]
    );
    
    console.log('History found:', result.rows.length, 'records');
    res.json(result.rows);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: error.message });
  }
};