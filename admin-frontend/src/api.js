import axios from 'axios';

// Create an Axios instance with default settings
const api = axios.create({
  baseURL: 'https://admin-w4u5.onrender.com/api/admin',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // Optional timeout (in milliseconds)
});

// Request interceptor for adding auth token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('Response error:', error.response.status, error.response.data);

      if (error.response.status === 401) {
        // Handle unauthorized access
        window.location.href = '/login';
      }
    } else if (error.request) {
      console.error('Request error:', error.request);
    } else {
      console.error('Setup error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default api;
