import React, { lazy, Suspense, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Navbar from "./components/Navbar";
import { Toaster } from "./components/ui/toaster";

// Keep the initial bundle small. The homepage pulls in Three.js and the
// authenticated pages pull in charts/forms that are not needed on first load.
const Homepage = lazy(() => import("./pages/Homepage"));
const Registration = lazy(() => import("./pages/Registration"));
const Login = lazy(() => import("./pages/Login"));
const Upload = lazy(() => import("./pages/Upload"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Prediction = lazy(() => import("./pages/Prediction"));
const Inventory = lazy(() => import("./pages/Inventory"));
const InvitePage = lazy(() => import("./pages/InvitePage"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const SetupCompany = lazy(() => import("./pages/SetupCompany"));
const ReorderIntelligence = lazy(() => import("./pages/ReorderIntelligence"));
const InfoPage = lazy(() => import("./pages/InfoPage"));

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-black">
    <div className="h-10 w-10 rounded-full border-2 border-slate-300 border-t-[#00B4D8] animate-spin" />
  </div>
);

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
  if (loading) return <RouteFallback />;
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Admin-only Route component (requires admin role)
const AdminRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <RouteFallback />;
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
            <Suspense fallback={<RouteFallback />}>
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
              {/* Footer Information & Legal Routes */}
              <Route path="/about" element={<InfoPage />} />
              <Route path="/features" element={<InfoPage />} />
              <Route path="/pricing" element={<InfoPage />} />
              <Route path="/blog" element={<InfoPage />} />
              <Route path="/help" element={<InfoPage />} />
              <Route path="/contact" element={<InfoPage />} />
              <Route path="/privacy" element={<InfoPage />} />
              <Route path="/terms" element={<InfoPage />} />
              <Route path="/legal" element={<InfoPage />} />
            </Routes>
            </Suspense>
            </PageWrapper>
            <Toaster />
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
