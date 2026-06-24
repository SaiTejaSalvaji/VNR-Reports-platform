import axios from 'axios';
import toast from 'react-hot-toast';

// const  productionApiUrl = 'https://api-u7ysxcxtgq-as.a.run.app'; // fb functions
const productionApiUrl = 'https://vnr-reports.vercel.app'; // vercel deployment
const developmentApiUrl = 'http://localhost:3033';

export const API_BASE_URL = import.meta.env.DEV ? developmentApiUrl : productionApiUrl;
// console.log(API_BASE_URL)
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle maintenance mode
    if (error.response?.status === 503) {
      const message = error.response.data?.error || 'Scheduled maintenance in progress. Retry later.';
      toast.error(message, { duration: 6000, id: 'maintenance' });
      const maintenanceError = new Error(message);
      (maintenanceError as any).isMaintenance = true;
      return Promise.reject(maintenanceError);
    }

    // Handle JWT token expiry smoothly
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      // Clear stored auth data
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Smoothly redirect to login without hard reload
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }

    // Return the original error to preserve response data and status
    return Promise.reject(error);
  }
);

export const isMaintenanceError = (err: any): boolean => err?.isMaintenance === true;

export default api;