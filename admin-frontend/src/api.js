// src/api.js
import axios from "axios";

// Create an Axios instance
const api = axios.create({
  baseURL: "https://admin-w4u5.onrender.com/api/admin",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000, // Optional timeout
});

// Add a request interceptor to attach the token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle success and errors
api.interceptors.response.use(
  (response) => {
    // Return only the response data
    return response.data;
  },
  (error) => {
    if (error.response) {
      console.error("Response error:", error.response.status, error.response.data);
      if (error.response.status === 401) {
        window.location.href = "/login"; // Redirect on unauthorized
      }
    } else if (error.request) {
      console.error("No response received:", error.request);
    } else {
      console.error("Request setup error:", error.message);
    }
    return Promise.reject(error);
  }
);

export default api;
