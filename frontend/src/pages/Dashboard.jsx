import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './Dashboard.css';

function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await api.get('/projects');
      // Убеждаемся что нет дубликатов по id
      const uniqueProjects = response.data.filter((project, index, self) => 
        index === self.findIndex(p => p.id === project.id)
      );
      setProjects(uniqueProjects);
    } catch (error) {
      console.error('Ошибка загрузки проектов:', error);
    }
  };

  const createProject = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/projects', {
        name: newProjectName,
        description: newProjectDesc,
      });
      
      // Проверяем, нет ли уже такого проекта
      setProjects(prev => {
        const exists = prev.some(p => p.id === response.data.id);
        if (exists) return prev;
        return [...prev, response.data];
      });
      
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
    } catch (error) {
      console.error('Ошибка создания проекта:', error);
      alert('Ошибка создания проекта: ' + (error.response?.data?.error || error.message));
    }
  };

  const openEditModal = (project) => {
    setSelectedProject(project);
    setEditProjectName(project.name);
    setEditProjectDesc(project.description || '');
    setShowEditModal(true);
  };

  const updateProject = async (e) => {
    e.preventDefault();
    try {
      const response = await api.put(`/projects/${selectedProject.id}`, {
        name: editProjectName,
        description: editProjectDesc,
      });
      setProjects(prev => prev.map(p => p.id === selectedProject.id ? response.data : p));
      setShowEditModal(false);
      setSelectedProject(null);
    } catch (error) {
      console.error('Ошибка обновления проекта:', error);
      alert('Ошибка обновления проекта: ' + (error.response?.data?.error || error.message));
    }
  };

  const openDeleteModal = (project) => {
    setProjectToDelete(project);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (projectToDelete) {
      try {
        await api.delete(`/projects/${projectToDelete.id}`);
        setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
        setShowDeleteModal(false);
        setProjectToDelete(null);
      } catch (error) {
        console.error('Ошибка удаления проекта:', error);
        alert('Ошибка удаления проекта: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const getRoleName = (role) => {
    switch(role) {
      case 'owner': return 'Владелец';
      case 'editor': return 'Редактор';
      case 'viewer': return 'Просмотр';
      default: return role;
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Менеджер задач</h1>
        <div className="user-info">
          <span>Добро пожаловать, {user?.username} ({getRoleName(user?.role)})</span>
          <button onClick={logout} className="logout-btn">Выйти</button>
        </div>
      </div>
      
      <div className="dashboard-content">
        <div className="projects-header">
          <h2>Мои проекты</h2>
          <button onClick={() => setShowCreateModal(true)} className="create-btn">
            + Новый проект
          </button>
        </div>
        
        <div className="projects-grid">
          {projects.length === 0 ? (
            <div className="no-projects">
              <p>У вас пока нет проектов</p>
              <button onClick={() => setShowCreateModal(true)}>Создать первый проект</button>
            </div>
          ) : (
            projects.map(project => (
              <div key={project.id} className="project-card">
                <div className="project-card-header">
                  <h3>{project.name}</h3>
                  <div className="project-actions">
                    <button onClick={() => openEditModal(project)} className="edit-project-btn" title="Редактировать проект">
                      Редактировать
                    </button>
                    <button onClick={() => openDeleteModal(project)} className="delete-project-btn" title="Удалить проект">
                      Удалить
                    </button>
                  </div>
                </div>
                <p>{project.description || 'Нет описания'}</p>
                <button onClick={() => navigate(`/board/${project.id}`)} className="open-board-btn">
                  Открыть доску →
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Модальное окно создания проекта */}
      {showCreateModal && (
        <div className="modal" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Создать новый проект</h3>
            <form onSubmit={createProject}>
              <input
                type="text"
                placeholder="Название проекта"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                required
              />
              <textarea
                placeholder="Описание"
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                rows="3"
              />
              <div className="modal-buttons">
                <button type="button" onClick={() => setShowCreateModal(false)}>Отмена</button>
                <button type="submit">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Модальное окно редактирования проекта */}
      {showEditModal && selectedProject && (
        <div className="modal" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Редактировать проект</h3>
            <form onSubmit={updateProject}>
              <input
                type="text"
                placeholder="Название проекта"
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
                required
              />
              <textarea
                placeholder="Описание"
                value={editProjectDesc}
                onChange={(e) => setEditProjectDesc(e.target.value)}
                rows="3"
              />
              <div className="modal-buttons">
                <button type="button" onClick={() => setShowEditModal(false)}>Отмена</button>
                <button type="submit">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Красивое модальное окно удаления проекта */}
      {showDeleteModal && projectToDelete && (
        <div className="modal delete-modal" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content delete-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="delete-icon"></div>
            <h3>Удаление проекта</h3>
            <p>Вы уверены, что хотите удалить проект <strong>"{projectToDelete.name}"</strong>?</p>
            <p className="delete-warning">Это действие невозможно отменить. Все задачи проекта будут удалены безвозвратно!</p>
            <div className="delete-modal-buttons">
              <button type="button" className="cancel-btn" onClick={() => setShowDeleteModal(false)}>
                Отмена
              </button>
              <button type="button" className="confirm-delete-btn" onClick={confirmDelete}>
                Да, удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;