import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const cleanToken = (raw) => {
        if (!raw || typeof raw !== 'string') return null;
        const cleaned = raw.replace(/^["']|["']$/g, '').trim();
        return cleaned === 'null' || cleaned === 'undefined' ? null : cleaned;
    };

    useEffect(() => {
        const storedToken = cleanToken(localStorage.getItem('token'));
        const storedUser = localStorage.getItem('user');
        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = (userData, userToken) => {
        const sanitizedToken = cleanToken(userToken);
        setToken(sanitizedToken);
        setUser(userData);
        if (sanitizedToken) localStorage.setItem('token', sanitizedToken);
        localStorage.setItem('user', JSON.stringify(userData));
        if (userData.role === 'admin') navigate('/admin');
        else navigate('/portal');
    };

    const logout = () => {
        // Clear gallery specific access
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('gallery_unlocked_')) {
                localStorage.removeItem(key);
            }
        });
        
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    const updateUser = (userData) => {
        const newUser = { ...user, ...userData };
        setUser(newUser);
        localStorage.setItem('user', JSON.stringify(newUser));
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
