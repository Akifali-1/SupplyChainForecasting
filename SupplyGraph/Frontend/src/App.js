import React, { useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Navbar from "./components/Navbar";
import Homepage from "./pages/Homepage";
import Registration from "./pages/Registration";
import Login from "./pages/Login";
import Upload from "./pages/Upload";
import Dashboard from "./pages/Dashboard";
import Prediction from "./pages/Prediction";
import Inventory from "./pages/Inventory";
import InvitePage from "./pages/InvitePage";
import UserManagement from "./pages/UserManagement";
import SetupCompany from "./pages/SetupCompany"; // ✅ First-login onboarding
import ReorderIntelligence from "./pages/ReorderIntelligence"; // ✅ Reorder Intelligence
import { Toaster } from "./components/ui/toaster";

// OAuth Callback Handler
const OAuthCallback = () => {
  const { user, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated && user) {
        // If admin hasn't named their company yet, send to setup
        if (user.needsSetup) {
          window.location.href = '/setup-company';
        } else {
          window.location.href = '/dashboard';
        }
      } else {
        window.location.href = '/login?error=oauth_failed';
      }
    }
  }, [user, isAuthenticated, loading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
        <p className="text-slate-400">Completing sign in...</p>
      </div>
    </div>
  );
};

// Protected Route component (waits for auth to hydrate)
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Admin-only Route component (requires admin role)
const AdminRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated && user?.role === 'admin' ? children : <Navigate to="/dashboard" />;
};

// Adds top padding on all pages except homepage (which has its own inline floating navbar)
const PageWrapper = ({ children }) => {
  const location = useLocation();
  const isHome = location.pathname === '/';
  return (
    <div className={isHome ? '' : 'pt-24'}>
      {children}
    </div>
  );
};

function App() {
  return (
    <div className="App min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:bg-black dark:from-black dark:to-black">
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            <Navbar />
            <PageWrapper>
            <Routes>
              <Route path="/" element={<Homepage />} />
              <Route path="/register" element={<Registration />} />
              <Route path="/login" element={<Login />} />
              <Route path="/oauth/callback" element={<OAuthCallback />} />
              <Route path="/setup-company" element={<SetupCompany />} /> {/* ✅ First-login onboarding */}
              <Route path="/invite/:token" element={<InvitePage />} />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/upload" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <Upload />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/settings/members" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <UserManagement />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/prediction" element={
                <ProtectedRoute>
                  <Prediction />
                </ProtectedRoute>
              } />
              <Route path="/inventory" element={
                <ProtectedRoute>
                  <Inventory />
                </ProtectedRoute>
              } />
              <Route path="/reorder" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <ReorderIntelligence />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/inventory-optimization" element={<Navigate to="/inventory" />} />
            </Routes>
            </PageWrapper>
            <Toaster />
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
