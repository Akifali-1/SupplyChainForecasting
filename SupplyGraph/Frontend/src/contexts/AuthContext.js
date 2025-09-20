// Auth Context
import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockAuth } from '../utils/mockData';
import { registerCompany, getCurrentUser, logout as apiLogout, getGoogleAuthUrl } from '../lib/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in via OAuth session
    const checkAuth = async () => {
      try {
        const userData = await getCurrentUser();
        if (userData) {
          setUser(userData);
          setIsAuthenticated(true);
        } else {
          // Fallback to localStorage for backward compatibility
          const localUserData = localStorage.getItem('user');
          if (localUserData) {
            const parsedUser = JSON.parse(localUserData);
            setUser(parsedUser);
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.log('No active session found');
        // Fallback to localStorage for backward compatibility
        const localUserData = localStorage.getItem('user');
        if (localUserData) {
          const parsedUser = JSON.parse(localUserData);
          setUser(parsedUser);
          setIsAuthenticated(true);
        }
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      // Mock login implementation
      const result = await mockAuth.login(email, password);
      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(result.user));
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error occurred' };
    } finally {
      setLoading(false);
    }
  };

  const register = async (companyName, email, password) => {
    setLoading(true);
    try {
      // Backend registration: create company and store companyId
      const res = await registerCompany(companyName);
      const companyId = res && res._id;

      const userPayload = {
        companyName,
        email,
        companyId,
      };
      setUser(userPayload);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(userPayload));
      if (companyId) localStorage.setItem('companyId', companyId);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Registration failed' };
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = () => {
    // Redirect to Google OAuth
    window.location.href = getGoogleAuthUrl();
  };

  const registerWithGoogle = () => {
    // For OAuth registration, we'll use the same Google OAuth flow
    // The backend will handle creating a user and we can create a company after OAuth success
    window.location.href = getGoogleAuthUrl();
  };

  const logout = async () => {
    setLoading(true);
    try {
      // Call backend logout to clear session
      await apiLogout();
    } catch (error) {
      console.log('Logout error:', error);
    } finally {
      // Clear local state regardless of backend response
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('user');
      localStorage.removeItem('companyId');
      setLoading(false);
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    register,
    loginWithGoogle,
    registerWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};