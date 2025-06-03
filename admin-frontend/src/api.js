import axios from 'axios';

// Adjust this to your backend URL
const api = axios.create({
  baseURL: 'http://localhost:5000/api/admin',
});

export default api;
