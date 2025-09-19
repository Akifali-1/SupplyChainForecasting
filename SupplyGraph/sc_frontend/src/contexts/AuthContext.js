// Auth Context
import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockAuth } from '../utils/mockData';
import { registerCompany } from '../lib/api';

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
    // Check if user is logged in from localStorage (mock implementation)
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      setIsAuthenticated(true);
    }
    setLoading(false);
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

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};