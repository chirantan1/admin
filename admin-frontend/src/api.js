import axios from 'axios';

const api = axios.create({
  baseURL: 'https://admin-w4u5.onrender.com/api/admin',
  headers: {
    'Content-Type': 'application/json',
    // Add any other default headers you need
  },
  // Optional: Set timeout for requests (in milliseconds)
  timeout: 10000,
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
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response error:', error.response.status, error.response.data);
      
      // You can handle specific status codes here
      if (error.response.status === 401) {
        // Handle unauthorized access (e.g., redirect to login)
        window.location.href = '/login';
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Request error:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default api;