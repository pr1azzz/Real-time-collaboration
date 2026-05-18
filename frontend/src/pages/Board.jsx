import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './Board.css';

const columns = [
  { id: 'new', title: 'Новые', color: '#e3f2fd' },
  { id: 'in_progress', title: 'В работе', color: '#fff3e0' },
  { id: 'done', title: 'Готово', color: '#e8f5e9' },
];

function Board() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [socket, setSocket] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const [projectMembers, setProjectMembers] = useState([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [taskHistory, setTaskHistory] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    loadTasks();
    loadProjectMembers();
    connectWebSocket();
    
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [projectId]);

  useEffect(() => {
    if (projectMembers.length > 0 && user) {
      const currentMember = projectMembers.find(m => m.id === user.id);
      setUserRole(currentMember?.role || 'viewer');
    }
  }, [projectMembers, user]);

  const connectWebSocket = () => {
    const token = localStorage.getItem('token');
    const newSocket = io('http://localhost:8081', {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    
    newSocket.on('connect', () => {
      console.log('WebSocket подключен');
      newSocket.emit('join_project', parseInt(projectId));
    });
    
    newSocket.on('task:created', (data) => {
      console.log('Создана задача (real-time):', data);
      if (data.task.project_id === parseInt(projectId)) {
        // Проверяем, нет ли уже такой задачи (防止 дублирования)
        setTasks(prev => {
          const exists = prev.some(t => t.id === data.task.id);
          if (exists) return prev;
          return [...prev, data.task];
        });
      }
    });
    
    newSocket.on('task:updated', (data) => {
      console.log('Обновлена задача (real-time):', data);
      setTasks(prev => prev.map(t => t.id === data.task.id ? data.task : t));
    });
    
    newSocket.on('task:moved', (data) => {
      console.log('Перемещена задача (real-time):', data);
      setTasks(prev => prev.map(t => 
        t.id === data.taskId ? { ...t, status: data.newStatus, position: data.newPosition } : t
      ));
    });
    
    newSocket.on('task:deleted', (data) => {
      console.log('Удалена задача (real-time):', data);
      setTasks(prev => prev.filter(t => t.id !== data.taskId));
    });
    
    setSocket(newSocket);
  };

  const loadTasks = async () => {
    try {
      const response = await api.get('/tasks', { params: { projectId } });
      // Убираем дубликаты задач по id
      const uniqueTasks = response.data.filter((task, index, self) => 
        index === self.findIndex(t => t.id === task.id)
      );
      setTasks(uniqueTasks);
    } catch (error) {
      console.error('Ошибка загрузки задач:', error);
    }
  };

  const loadProjectMembers = async () => {
    try {
      const response = await api.get(`/projects/${projectId}/members`);
      setProjectMembers(response.data);
    } catch (error) {
      console.error('Ошибка загрузки участников:', error);
    }
  };

  const loadTaskHistory = async (taskId) => {
    try {
      const response = await api.get(`/tasks/${taskId}/history`);
      setTaskHistory(response.data);
      setSelectedTaskId(taskId);
      setShowHistory(true);
    } catch (error) {
      console.error('Ошибка загрузки истории:', error);
      alert('Ошибка загрузки истории: ' + (error.response?.data?.error || error.message));
    }
  };

  const addMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail) return;
    
    if (userRole !== 'owner') {
      alert('Только владелец проекта может добавлять участников');
      return;
    }
    
    try {
      const usersResponse = await api.get('/auth/users', { 
        params: { search: newMemberEmail }
      });
      
      const foundUser = usersResponse.data[0];
      
      if (!foundUser) {
        alert('Пользователь не найден. Убедитесь, что он зарегистрирован.');
        return;
      }
      
      await api.post(`/projects/${projectId}/members`, {
        userId: foundUser.id,
        role: 'viewer'
      });
      
      setNewMemberEmail('');
      loadProjectMembers();
      alert(`Участник ${foundUser.username} успешно добавлен!`);
    } catch (error) {
      console.error('Ошибка добавления участника:', error);
      alert('Ошибка добавления участника: ' + (error.response?.data?.error || error.message));
    }
  };

  const updateMemberRole = async (userId, newRole) => {
    if (userRole !== 'owner') {
      alert('Только владелец проекта может изменять роли');
      return;
    }
    
    try {
      await api.put(`/projects/${projectId}/members/${userId}`, { role: newRole });
      loadProjectMembers();
      alert('Роль обновлена');
    } catch (error) {
      console.error('Ошибка обновления роли:', error);
      alert('Ошибка обновления роли');
    }
  };

  const getTasksByStatus = (status) => {
    return tasks.filter(task => task.status === status).sort((a, b) => a.position - b.position);
  };

  const canEdit = () => {
    return userRole === 'owner' || userRole === 'editor';
  };

  const getRoleName = (role) => {
    switch(role) {
      case 'owner': return 'Владелец';
      case 'editor': return 'Редактор';
      case 'viewer': return 'Зритель';
      default: return role;
    }
  };

  const handleDragEnd = async (result) => {
    if (!canEdit()) {
      alert('У вас нет прав для перемещения задач. Только Владелец и Редактор могут перемещать задачи.');
      return;
    }
    
    if (!result.destination) return;
    
    const { source, destination, draggableId } = result;
    const sourceColumn = source.droppableId;
    const destColumn = destination.droppableId;
    
    if (sourceColumn === destColumn && source.index === destination.index) return;
    
    const taskId = parseInt(draggableId);
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) return;
    
    const newStatus = destColumn;
    const newPosition = destination.index;
    
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus, position: newPosition } : t
    ));
    
    try {
      await api.patch(`/tasks/${taskId}/move`, { newStatus, newPosition });
      
      if (socket) {
        socket.emit('task:move', { projectId, taskId, newStatus, newPosition });
      }
    } catch (error) {
      console.error('Ошибка перемещения задачи:', error);
      alert('Ошибка перемещения задачи: ' + (error.response?.data?.error || error.message));
      loadTasks();
    }
  };

  const createTask = async (taskData) => {
    if (!canEdit()) {
      alert('У вас нет прав для создания задач. Только Владелец и Редактор могут создавать задачи.');
      return;
    }
    
    try {
      const response = await api.post('/tasks', {
        ...taskData,
        projectId: parseInt(projectId),
      });
      const newTask = response.data;
      setTasks(prev => [...prev, newTask]);
      
      if (socket) {
        socket.emit('task:create', { projectId, task: newTask });
      }
      setShowTaskModal(false);
    } catch (error) {
      console.error('Ошибка создания задачи:', error);
      alert('Ошибка создания задачи: ' + (error.response?.data?.error || error.message));
    }
  };

  const updateTask = async (taskData) => {
    if (!canEdit()) {
      alert('У вас нет прав для редактирования задач. Только Владелец и Редактор могут редактировать задачи.');
      return;
    }
    
    try {
      const response = await api.put(`/tasks/${editingTask.id}`, taskData);
      const updatedTask = response.data;
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      
      if (socket) {
        socket.emit('task:update', { projectId, task: updatedTask });
      }
      setEditingTask(null);
      setShowTaskModal(false);
    } catch (error) {
      console.error('Ошибка обновления задачи:', error);
      alert('Ошибка обновления задачи: ' + (error.response?.data?.error || error.message));
    }
  };

  const deleteTask = async (taskId) => {
    if (userRole !== 'owner') {
      alert('Только владелец проекта может удалять задачи');
      return;
    }
    
    if (!window.confirm('Вы уверены, что хотите удалить эту задачу?')) return;
    
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      
      if (socket) {
        socket.emit('task:delete', { projectId, taskId });
      }
    } catch (error) {
      console.error('Ошибка удаления задачи:', error);
      alert('Ошибка удаления задачи: ' + (error.response?.data?.error || error.message));
    }
  };

  const undoTask = async (taskId) => {
    if (!canEdit()) {
      alert('У вас нет прав для отмены изменений. Только Владелец и Редактор могут отменять изменения.');
      return;
    }
    
    try {
      const response = await api.post(`/tasks/${taskId}/undo`);
      const restoredTask = response.data;
      setTasks(prev => prev.map(t => t.id === restoredTask.id ? restoredTask : t));
      
      if (socket) {
        socket.emit('task:update', { projectId, task: restoredTask });
      }
    } catch (error) {
      console.error('Ошибка отмены:', error);
      alert('Ошибка отмены: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="board">
      <div className="board-header">
        <button onClick={() => navigate('/')} className="back-btn">Назад к проектам</button>
        <h1>Доска</h1>
        <div className="board-actions">
          <div className="user-role-badge">
            Роль: <span className={userRole}>{getRoleName(userRole)}</span>
          </div>
          <button onClick={() => setShowMembers(!showMembers)} className="members-btn">
            Участники ({projectMembers.length})
          </button>
          {canEdit() && (
            <button onClick={() => setShowTaskModal(true)} className="add-task-btn">
              Добавить задачу
            </button>
          )}
          <button onClick={logout} className="logout-btn">Выйти</button>
        </div>
      </div>
      
      {showMembers && (
        <div className="members-panel">
          <div className="members-panel-header">
            <h3>Участники проекта</h3>
            <button onClick={() => setShowMembers(false)}>✕</button>
          </div>
          <div className="members-list">
            {projectMembers.map(member => (
              <div key={member.id} className="member-item">
                <div>
                  <strong>{member.username}</strong>
                  <span className="member-email">{member.email}</span>
                </div>
                {userRole === 'owner' && member.id !== user?.id ? (
                  <select 
                    value={member.role}
                    onChange={(e) => updateMemberRole(member.id, e.target.value)}
                    className="role-select"
                  >
                    <option value="owner">Владелец</option>
                    <option value="editor">Редактор</option>
                    <option value="viewer">Просмотр</option>
                  </select>
                ) : (
                  <span className={`member-role ${member.role}`}>{getRoleName(member.role)}</span>
                )}
              </div>
            ))}
          </div>
          {userRole === 'owner' && (
            <form onSubmit={addMember} className="add-member-form">
              <input
                type="email"
                placeholder="Email пользователя для добавления"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                required
              />
              <button type="submit">Добавить участника</button>
            </form>
          )}
        </div>
      )}
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="board-columns">
          {columns.map(column => (
            <div key={column.id} className="board-column" style={{ background: column.color }}>
              <div className="column-header">
                <h3>{column.title}</h3>
                <span className="task-count">{getTasksByStatus(column.id).length}</span>
              </div>
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`task-list ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                  >
                    {getTasksByStatus(column.id).map((task, index) => (
                      <Draggable 
                        key={task.id} 
                        draggableId={String(task.id)} 
                        index={index}
                        isDragDisabled={!canEdit()}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`task-card ${snapshot.isDragging ? 'dragging' : ''}`}
                            style={provided.draggableProps.style}
                          >
                            <div className="task-card-content">
                              <h4>{task.title}</h4>
                              <p>{task.description}</p>
                              <div className="task-actions">
                                {canEdit() && (
                                  <>
                                    <button onClick={() => {
                                      setEditingTask(task);
                                      setShowTaskModal(true);
                                    }} className="edit-task-btn">Редактировать</button>
                                    <button onClick={() => undoTask(task.id)} className="undo-task-btn">Отменить</button>
                                  </>
                                )}
                                {userRole === 'owner' && (
                                  <button onClick={() => deleteTask(task.id)} className="delete-task-btn">Удалить</button>
                                )}
                                <button onClick={() => loadTaskHistory(task.id)} className="history-btn">
                                  История
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
      
      {showTaskModal && (
        <TaskModal
          task={editingTask}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
          onSave={editingTask ? updateTask : createTask}
        />
      )}
      
      {showHistory && (
        <div className="modal" onClick={() => setShowHistory(false)}>
          <div className="modal-content history-modal">
            <h3>История задачи #{selectedTaskId}</h3>
            <div className="history-list">
              {taskHistory.length === 0 ? (
                <p>Нет доступной истории для этой задачи</p>
              ) : (
                taskHistory.map((record, idx) => (
                  <div key={idx} className="history-item">
                    <div className="history-header">
                      <strong className={`history-type ${record.command_type}`}>
                        {record.command_type === 'CREATE' ? 'Создание' : 
                         record.command_type === 'UPDATE' ? 'Обновление' :
                         record.command_type === 'DELETE' ? 'Удаление' :
                         record.command_type === 'MOVE' ? 'Перемещение' : record.command_type}
                      </strong>
                      <span className="history-date">
                        {new Date(record.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="history-details">
                      <strong>ID пользователя:</strong> {record.user_id}
                    </div>
                    <pre className="history-snapshot">
                      {JSON.stringify(record.snapshot, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => setShowHistory(false)} className="close-history-btn">
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TaskModal = ({ task, onClose, onSave }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ title, description });
  };
  
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{task ? 'Редактировать задачу' : 'Создать задачу'}</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Название задачи"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            placeholder="Описание"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="4"
          />
          <div className="modal-buttons">
            <button type="button" onClick={onClose}>Отмена</button>
            <button type="submit">{task ? 'Обновить' : 'Создать'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Board;