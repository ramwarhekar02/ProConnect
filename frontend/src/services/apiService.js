import axios from 'axios';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const authService = {
  login: (username, password) =>
    apiClient.post('/auth/login', { username, password }),
  verifyToken: () => apiClient.get('/auth/verify'),
};

// Machine API calls
export const machineService = {
  getAllMachines: () => apiClient.get('/machines'),
  getMachineById: (machineId) => apiClient.get(`/machines/${machineId}`),
  createMachine: (data) => apiClient.post('/machines', data),
  updateMachine: (machineId, data) => apiClient.put(`/machines/${machineId}`, data),
  deleteMachine: (machineId) => apiClient.delete(`/machines/${machineId}`),
};

// Production API calls
export const productionService = {
  getProductionData: (params) => apiClient.get('/production', { params }),
  getOverallOEEMetrics: (hoursBackOrParams = 24) =>
    apiClient.get('/production/overall/metrics', {
      params:
        typeof hoursBackOrParams === 'object'
          ? hoursBackOrParams
          : { hoursBack: hoursBackOrParams },
    }),
  getProductionByMachine: (machineId, params) =>
    apiClient.get(`/production/${machineId}`, { params }),
  getLatestProduction: (machineId) => apiClient.get(`/production/${machineId}/latest`),
  getOEEMetrics: (machineId, hoursBackOrParams = 24) =>
    apiClient.get(`/production/${machineId}/metrics`, {
      params:
        typeof hoursBackOrParams === 'object'
          ? hoursBackOrParams
          : { hoursBack: hoursBackOrParams },
    }),
};

export const settingsService = {
  getSettings: () => apiClient.get('/settings'),
  updateSettings: (data) => apiClient.put('/settings', data),
};

export default apiClient;
