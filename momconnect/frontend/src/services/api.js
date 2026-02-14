import axios from 'axios';

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000 // 30 second timeout
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('momconnect_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('momconnect_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;