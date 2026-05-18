import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

const userSockets = new Map(); // userId -> socketId

export const setupSocketHandlers = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });
  
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.id}`);
    userSockets.set(socket.user.id, socket.id);
    
    socket.on('join_project', async (projectId) => {
      try {
        // Check if user has access to project
        const result = await query(
          `SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2`,
          [projectId, socket.user.id]
        );
        
        if (result.rows.length > 0) {
          socket.join(`project_${projectId}`);
          socket.projectId = projectId;
          console.log(`User ${socket.user.id} joined project ${projectId}`);
        }
      } catch (error) {
        console.error(error);
      }
    });
    
    socket.on('leave_project', () => {
      if (socket.projectId) {
        socket.leave(`project_${socket.projectId}`);
        console.log(`User ${socket.user.id} left project ${socket.projectId}`);
      }
    });
    
    socket.on('task:create', async (taskData) => {
      const { projectId, task } = taskData;
      io.to(`project_${projectId}`).emit('task:created', {
        task,
        user: socket.user
      });
    });
    
    socket.on('task:update', async (taskData) => {
      const { projectId, task } = taskData;
      io.to(`project_${projectId}`).emit('task:updated', {
        task,
        user: socket.user
      });
    });
    
    socket.on('task:move', async (moveData) => {
      const { projectId, taskId, newStatus, newPosition } = moveData;
      io.to(`project_${projectId}`).emit('task:moved', {
        taskId,
        newStatus,
        newPosition,
        user: socket.user
      });
    });
    
    socket.on('task:delete', async (deleteData) => {
      const { projectId, taskId } = deleteData;
      io.to(`project_${projectId}`).emit('task:deleted', {
        taskId,
        user: socket.user
      });
    });
    
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id}`);
      userSockets.delete(socket.user.id);
    });
  });
};