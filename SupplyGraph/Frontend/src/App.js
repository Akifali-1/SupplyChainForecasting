import React, { useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import Homepage from "./pages/Homepage";
import Registration from "./pages/Registration";
import Login from "./pages/Login";
import Upload from "./pages/Upload";
import Prediction from "./pages/Prediction";
import VisualizationDemo from "./components/charts/VisualizationDemo";
import { Toaster } from "./components/ui/toaster";

// OAuth Callback Handler
const OAuthCallback = () => {
  const { user, isAuthenticated, loading, register } = useAuth();
  
  useEffect(() => {
    const handleOAuthCallback = async () => {
      // If user is authenticated after OAuth callback
      if (!loading && isAuthenticated && user) {
        // Check if this is a new user (no companyId in localStorage)
        const existingCompanyId = localStorage.getItem('companyId');
        
        if (!existingCompanyId && user.email) {
          // This is a new OAuth user, create a company for them
          try {
            const companyName = user.name ? `${user.name}'s Company` : `${user.email.split('@')[0]}'s Company`;
            const result = await register(companyName, user.email, 'oauth_user');
            
            if (result.success) {
              console.log('Company created for OAuth user:', result);
            }
          } catch (error) {
            console.log('Error creating company for OAuth user:', error);
          }
        }
        
        // Redirect to upload page
        window.location.href = '/upload';
      } else if (!loading && !isAuthenticated) {
        // If OAuth failed, redirect to login
        window.location.href = '/login?error=oauth_failed';
      }
    };

    handleOAuthCallback();
  }, [user, isAuthenticated, loading, register]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Completing sign in...</p>
      </div>
    </div>
  );
};

// Protected Route component (waits for auth to hydrate from localStorage)
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null; // or a spinner placeholder
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <div className="App min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <AuthProvider>
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<Homepage />} />
            <Route path="/register" element={<Registration />} />
            <Route path="/login" element={<Login />} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            <Route path="/upload" element={
              <ProtectedRoute>
                <Upload />
              </ProtectedRoute>
            } />
            <Route path="/prediction" element={
              <ProtectedRoute>
                <Prediction />
              </ProtectedRoute>
            } />
            <Route path="/demo" element={<VisualizationDemo />} />
          </Routes>
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;