import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Проверяем сохранённые данные при загрузке приложения
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      
      console.log('Проверка авторизации:', { hasToken: !!token, hasUser: !!savedUser });
      
      if (token && savedUser) {
        try {
          // Устанавливаем токен в заголовки axios
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Пробуем получить данные пользователя для проверки валидности токена
          const response = await api.get('/projects');
          if (response.data) {
            // Токен валиден, восстанавливаем пользователя
            setUser(JSON.parse(savedUser));
            console.log('Пользователь восстановлен:', JSON.parse(savedUser));
          }
        } catch (error) {
          console.error('Ошибка проверки токена:', error);
          // Токен невалиден, очищаем данные
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          delete api.defaults.headers.common['Authorization'];
        }
      }
      setLoading(false);
    };
    
    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, token } = response.data;
      
      // Сохраняем в localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Устанавливаем токен в заголовки axios
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(user);
      return user;
    } catch (error) {
      console.error('Ошибка входа:', error);
      throw error;
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await api.post('/auth/register', { username, email, password });
      const { user, token } = response.data;
      
      // Сохраняем в localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Устанавливаем токен в заголовки axios
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(user);
      return user;
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      throw error;
    }
  };

  const logout = () => {
    // Очищаем localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Удаляем токен из заголовков axios
    delete api.defaults.headers.common['Authorization'];
    
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};