import axios from 'axios';

const api = axios.create({
    //baseURL: 'https://eyetracking-api.liara.run',
    baseURL: 'https://eyetracking-4bez.onrender.com',
    // baseURL: 'https://eyetracking-production.up.railway.app',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
