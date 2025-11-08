import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Response interceptor for token refresh
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 403 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers['Authorization'] = 'Bearer ' + token;
                    return axiosInstance(originalRequest);
                }).catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const { data } = await axios.post(
                    `${import.meta.env.VITE_API_URL}/auth/refresh`,
                    {},
                    { withCredentials: true }
                );

                const { accessToken } = data;
                axiosInstance.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken;
                originalRequest.headers['Authorization'] = 'Bearer ' + accessToken;

                processQueue(null, accessToken);
                isRefreshing = false;

                // Notify app to update token
                window.dispatchEvent(new CustomEvent('tokenRefreshed', { detail: accessToken }));

                return axiosInstance(originalRequest);
            } catch (err) {
                processQueue(err, null);
                isRefreshing = false;
                
                // Redirect to login
                window.location.href = '/login';
                return Promise.reject(err);
            }
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
