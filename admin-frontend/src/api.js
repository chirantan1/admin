import axios from 'axios';

// Pointing to deployed backend on Render
const api = axios.create({
  baseURL: 'https://admin-w4u5.onrender.com/api/admin',
});

export default api;
