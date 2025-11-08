import { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';

const AuthContext = createContext(null);

// Helper function to decode JWT token
const decodeToken = (token) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Failed to decode token:', error);
        return null;
    }
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Listen for token refresh events
        const handleTokenRefresh = (event) => {
            const token = event.detail;
            setAccessToken(token);
            const decoded = decodeToken(token);
            if (decoded) {
                setUser({ id: decoded.userId, email: decoded.email });
            }
        };
        window.addEventListener('tokenRefreshed', handleTokenRefresh);

        // Try to refresh token on mount
        refreshToken();

        return () => {
            window.removeEventListener('tokenRefreshed', handleTokenRefresh);
        };
    }, []);

    const refreshToken = async () => {
        try {
            const { data } = await axiosInstance.post('/auth/refresh');
            setAccessToken(data.accessToken);
            axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
            
            // Decode the token to get user info
            const decoded = decodeToken(data.accessToken);
            if (decoded) {
                setUser({ id: decoded.userId, email: decoded.email });
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
            setUser(null);
            setAccessToken(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        const { data } = await axiosInstance.post('/auth/login', { email, password });
        setAccessToken(data.accessToken);
        setUser(data.user);
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
        return data;
    };

    const register = async (email, password) => {
        const { data } = await axiosInstance.post('/auth/register', { email, password });
        setAccessToken(data.accessToken);
        setUser(data.user);
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
        return data;
    };

    const logout = async () => {
        await axiosInstance.post('/auth/logout');
        setAccessToken(null);
        setUser(null);
        delete axiosInstance.defaults.headers.common['Authorization'];
    };

    return (
        <AuthContext.Provider value={{ user, accessToken, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
